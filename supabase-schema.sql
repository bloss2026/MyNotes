create table if not exists public.mynotes_notebooks (
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    notebook_id text not null,
    metadata jsonb not null default '{}'::jsonb,
    page_count integer not null default 1 check (page_count >= 0),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, notebook_id)
);

alter table public.mynotes_notebooks enable row level security;

drop policy if exists "Users manage their MyNotes notebooks" on public.mynotes_notebooks;
create policy "Users manage their MyNotes notebooks"
    on public.mynotes_notebooks
    for all
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.mynotes_notebooks to authenticated;

insert into storage.buckets (id, name, public)
values ('mynotes-pages', 'mynotes-pages', false)
on conflict (id) do update set public = false;

drop policy if exists "Users manage their MyNotes page files" on storage.objects;
create policy "Users manage their MyNotes page files"
    on storage.objects
    for all
    to authenticated
    using (
        bucket_id = 'mynotes-pages'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'mynotes-pages'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
