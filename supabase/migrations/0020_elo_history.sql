-- Phase 3 of the social/stats work: personal records (longest win streak,
-- busiest month, best ELO gain) need a history of ELO movement. Today
-- apply_elo_change() (0018) computes a per-player delta but discards it
-- right after updating profiles.elo. This logs that delta going forward —
-- matches confirmed before this migration won't have a row.
create table elo_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  match_result_id uuid not null references match_results (id) on delete cascade,
  delta int not null,
  elo_after int not null,
  created_at timestamptz not null default now()
);

alter table elo_history enable row level security;

create policy "Elo history is viewable by authenticated users"
  on elo_history for select
  to authenticated
  using (true);

-- Same body as 0018's apply_elo_change(), plus one insert into elo_history
-- per player right after their profiles.elo update.
create or replace function public.apply_elo_change()
returns trigger as $$
declare
  rating_a numeric;
  rating_b numeric;
  expected_a numeric;
  actual_a numeric;
  games_a int := 0;
  games_b int := 0;
  set_row jsonb;
  mov_multiplier numeric;
  base_change_a numeric;
  pid uuid;
  player_elo numeric;
  played_count int;
  k_player numeric;
  team_avg numeric;
  weight numeric;
  delta int;
begin
  select avg(elo) into rating_a from profiles where id in (new.team_a_player1, new.team_a_player2);
  select avg(elo) into rating_b from profiles where id in (new.team_b_player1, new.team_b_player2);

  expected_a := 1.0 / (1.0 + power(10.0, (rating_b - rating_a) / 400.0));
  actual_a := case when new.winner = 'a' then 1.0 else 0.0 end;

  for set_row in select * from jsonb_array_elements(new.sets) loop
    games_a := games_a + (set_row->>'a')::int;
    games_b := games_b + (set_row->>'b')::int;
  end loop;

  mov_multiplier := least(1.5, 1 + abs(games_a - games_b)::numeric / 20);
  base_change_a := mov_multiplier * (actual_a - expected_a);

  foreach pid in array array[new.team_a_player1, new.team_a_player2, new.team_b_player1, new.team_b_player2]
  loop
    select elo into player_elo from profiles where id = pid;

    select count(*) into played_count
    from match_results
    where status = 'confirmed'
      and pid in (team_a_player1, team_a_player2, team_b_player1, team_b_player2);

    k_player := case when played_count < 5 then 48 else 32 end;
    team_avg := case when pid in (new.team_a_player1, new.team_a_player2) then rating_a else rating_b end;
    weight := 1 + tanh((player_elo - team_avg) / 400.0);

    if pid in (new.team_a_player1, new.team_a_player2) then
      delta := round(k_player * base_change_a * weight);
    else
      delta := round(k_player * (-base_change_a) * weight);
    end if;

    update profiles set elo = elo + delta where id = pid;

    insert into elo_history (profile_id, match_result_id, delta, elo_after)
    values (pid, new.id, delta, player_elo + delta);
  end loop;

  return new;
end;
$$ language plpgsql security definer;
