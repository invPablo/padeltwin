-- Phase 2 of the social layer: a "Vib" is the kudos-equivalent reaction —
-- polymorphic so the same table can react to either current feed item kind
-- (achievement milestone or confirmed match result) without forking the
-- table per content type.
create type vib_item_type as enum ('achievement', 'match_result');

create table vibs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  item_type vib_item_type not null,
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (profile_id, item_type, item_id)
);

alter table vibs enable row level security;

create policy "Vibs are viewable by authenticated users"
  on vibs for select
  to authenticated
  using (true);

create policy "Users can give a vib"
  on vibs for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "Users can remove their own vib"
  on vibs for delete
  to authenticated
  using (profile_id = auth.uid());

-- Notify whoever owns the vibbed item, same pg_net pattern as 0014/0015.
-- An achievement has one owner; a match result has four players — notify
-- every one of them except the vibber.
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
      end if;
    end loop;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_vib_insert_notify
  after insert on vibs
  for each row execute procedure public.notify_new_vib();
