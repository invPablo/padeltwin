-- In-app notification feed. Push notifications (0014/0015/0019) are
-- fire-and-forget to the device and leave nothing for the app to show in
-- the Notifications screen — this table persists the same events so users
-- have a real in-app list (read/unread) to come back to, not just a stub.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "Users can mark their own notifications read"
  on notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No insert policy: rows are only ever written by the security-definer
-- trigger functions below (same pattern as push notifications), never
-- directly by a client.

create or replace function insert_notification(p_recipient uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void as $$
begin
  if p_recipient is null then
    return;
  end if;
  insert into notifications (recipient_id, type, title, body, data)
  values (p_recipient, p_type, p_title, p_body, p_data);
end;
$$ language plpgsql security definer;

-- Re-point the existing notify_* triggers to also persist an in-app row.

create or replace function notify_new_message()
returns trigger as $$
declare
  v_recipient_id uuid;
  v_recipient_token text;
  v_sender_name text;
begin
  select case when pr.from_id = new.sender_id then pr.to_id else pr.from_id end
    into v_recipient_id
  from partner_requests pr
  where pr.id = new.request_id;

  select push_token into v_recipient_token from profiles where id = v_recipient_id;
  select full_name into v_sender_name from profiles where id = new.sender_id;

  perform send_push_notification(
    v_recipient_token,
    coalesce(v_sender_name, 'New message'),
    new.body,
    jsonb_build_object('type', 'message', 'requestId', new.request_id)
  );
  perform insert_notification(
    v_recipient_id,
    'message',
    coalesce(v_sender_name, 'New message'),
    new.body,
    jsonb_build_object('requestId', new.request_id)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function notify_new_partner_request()
returns trigger as $$
declare
  v_recipient_token text;
  v_sender_name text;
begin
  select push_token into v_recipient_token from profiles where id = new.to_id;
  select full_name into v_sender_name from profiles where id = new.from_id;

  perform send_push_notification(
    v_recipient_token,
    'New partner request',
    coalesce(v_sender_name, 'Someone') || ' wants to connect with you.',
    jsonb_build_object('type', 'partner_request', 'requestId', new.id)
  );
  perform insert_notification(
    new.to_id,
    'partner_request',
    'New partner request',
    coalesce(v_sender_name, 'Someone') || ' wants to connect with you.',
    jsonb_build_object('requestId', new.id)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function notify_partner_request_accepted()
returns trigger as $$
declare
  v_recipient_token text;
  v_accepter_name text;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    select push_token into v_recipient_token from profiles where id = new.from_id;
    select full_name into v_accepter_name from profiles where id = new.to_id;

    perform send_push_notification(
      v_recipient_token,
      'Request accepted',
      coalesce(v_accepter_name, 'Someone') || ' accepted your partner request.',
      jsonb_build_object('type', 'partner_accepted', 'requestId', new.id)
    );
    perform insert_notification(
      new.from_id,
      'partner_accepted',
      'Request accepted',
      coalesce(v_accepter_name, 'Someone') || ' accepted your partner request.',
      jsonb_build_object('requestId', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function notify_new_follow()
returns trigger as $$
declare
  v_recipient_token text;
  v_follower_name text;
begin
  select push_token into v_recipient_token from profiles where id = new.followed_id;
  select full_name into v_follower_name from profiles where id = new.follower_id;

  perform send_push_notification(
    v_recipient_token,
    'New follower',
    coalesce(v_follower_name, 'Someone') || ' started following you.',
    jsonb_build_object('type', 'follow', 'profileId', new.follower_id)
  );
  perform insert_notification(
    new.followed_id,
    'follow',
    'New follower',
    coalesce(v_follower_name, 'Someone') || ' started following you.',
    jsonb_build_object('profileId', new.follower_id)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.notify_new_vib()
returns trigger as $$
declare
  v_owner uuid;
  v_token text;
  v_vibber_name text;
begin
  select full_name into v_vibber_name from profiles where id = new.profile_id;

  if new.item_type = 'achievement' then
    select profile_id into v_owner from achievements where id = new.item_id;
    if v_owner is not null and v_owner <> new.profile_id then
      select push_token into v_token from profiles where id = v_owner;
      perform send_push_notification(
        v_token,
        'New Vib',
        coalesce(v_vibber_name, 'Someone') || ' gave your achievement a Vib.',
        jsonb_build_object('type', 'vib', 'itemType', 'achievement', 'itemId', new.item_id)
      );
      perform insert_notification(
        v_owner,
        'vib',
        'New Vib',
        coalesce(v_vibber_name, 'Someone') || ' gave your achievement a Vib.',
        jsonb_build_object('itemType', 'achievement', 'itemId', new.item_id)
      );
    end if;
  elsif new.item_type = 'match_result' then
    for v_owner in
      select unnest(array[team_a_player1, team_a_player2, team_b_player1, team_b_player2])
      from match_results
      where id = new.item_id
    loop
      if v_owner <> new.profile_id then
        select push_token into v_token from profiles where id = v_owner;
        perform send_push_notification(
          v_token,
          'New Vib',
          coalesce(v_vibber_name, 'Someone') || ' gave your match a Vib.',
          jsonb_build_object('type', 'vib', 'itemType', 'match_result', 'itemId', new.item_id)
        );
        perform insert_notification(
          v_owner,
          'vib',
          'New Vib',
          coalesce(v_vibber_name, 'Someone') || ' gave your match a Vib.',
          jsonb_build_object('itemType', 'match_result', 'itemId', new.item_id)
        );
      end if;
    end loop;
  end if;

  return new;
end;
$$ language plpgsql security definer;
