alter table public.profiles
add column if not exists platform_role text not null default 'default'
check (platform_role in ('default', 'dev_admin'));

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'dev_admin'
  );
$$;

grant execute on function public.is_platform_admin() to authenticated, service_role;

drop policy if exists "exercises_insert_professors" on public.exercises;
drop policy if exists "exercises_update_professors" on public.exercises;
drop policy if exists "exercises_delete_professors" on public.exercises;

create policy "exercises_insert_platform_admin"
on public.exercises
for insert
to authenticated
with check (public.is_platform_admin());

create policy "exercises_update_platform_admin"
on public.exercises
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "exercises_delete_platform_admin"
on public.exercises
for delete
to authenticated
using (public.is_platform_admin());

drop policy if exists "exercise_media_write_professors" on storage.objects;

create policy "exercise_media_write_platform_admin"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'exercise-media'
  and public.is_platform_admin()
)
with check (
  bucket_id = 'exercise-media'
  and public.is_platform_admin()
);
