-- Tournaments become self-service: players can register themselves (solo
-- or as an already-accepted pair) while a tournament is "open". Admins
-- still create the tournament, pair up solo entrants, and generate the
-- bracket/round-robin once registration closes.

alter type tournament_status add value if not exists 'open';

-- New tournaments go straight to "open" (joinable) instead of the old
-- admin-only "draft" — admins no longer have to manually flip a switch
-- before players can register.
create or replace function public.admin_create_tournament(p_name text, p_format tournament_format, p_zone text, p_starts_at timestamptz)
returns uuid as $$
declare
  v_id uuid;
begin
  if not is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  insert into tournaments (name, format, zone, starts_at, created_by, status)
  values (p_name, p_format, p_zone, p_starts_at, auth.uid(), 'open')
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- Players can register themselves (and an already-accepted partner) while
-- the tournament is open for signups.
create policy "Players can join an open tournament" on tournament_participants
  for insert to authenticated
  with check (
    auth.uid() = profile_id
    and exists (select 1 from tournaments t where t.id = tournament_id and t.status = 'open')
    and (
      partner_id is null
      or exists (
        select 1 from partner_requests pr
        where pr.status = 'accepted'
        and ((pr.from_id = auth.uid() and pr.to_id = partner_id) or (pr.to_id = auth.uid() and pr.from_id = partner_id))
      )
    )
  );

-- Players can withdraw their own entry while registration is still open.
create policy "Players can leave an open tournament" on tournament_participants
  for delete to authenticated
  using (
    auth.uid() = profile_id
    and exists (select 1 from tournaments t where t.id = tournament_id and t.status = 'open')
  );

-- Admin action: merge two solo entrants into a pair (e.g. two singles
-- signups that should play together) by moving entrant B onto entrant A's
-- row as its partner, then dropping B's now-redundant row.
create or replace function public.admin_pair_tournament_participants(p_participant_a uuid, p_participant_b uuid)
returns void as $$
declare
  v_partner_b uuid;
begin
  if not is_admin(auth.uid()) then raise exception 'Not authorized'; end if;

  select profile_id into v_partner_b from tournament_participants where id = p_participant_b;
  if v_partner_b is null then raise exception 'Participant not found'; end if;

  update tournament_participants set partner_id = v_partner_b where id = p_participant_a;
  delete from tournament_participants where id = p_participant_b;
end;
$$ language plpgsql security definer;
