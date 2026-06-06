create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  completed boolean not null default false,
  parent_id uuid references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
create index if not exists tasks_parent_id_idx on public.tasks (parent_id);
