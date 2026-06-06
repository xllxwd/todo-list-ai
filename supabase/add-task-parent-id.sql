alter table public.tasks
  add column if not exists parent_id uuid;

alter table public.tasks
  drop constraint if exists tasks_parent_id_fkey;

alter table public.tasks
  add constraint tasks_parent_id_fkey
  foreign key (parent_id)
  references public.tasks (id)
  on delete cascade;

create index if not exists tasks_parent_id_idx on public.tasks (parent_id);
