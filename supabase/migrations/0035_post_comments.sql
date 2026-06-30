create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index post_comments_post_idx on post_comments (post_id, created_at asc);

alter table post_comments enable row level security;

create policy "Comments are viewable by authenticated users"
  on post_comments for select
  to authenticated
  using (true);

create policy "Users can insert their own comments"
  on post_comments for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "Users can delete their own comments"
  on post_comments for delete
  to authenticated
  using (profile_id = auth.uid());
