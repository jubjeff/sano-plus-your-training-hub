-- Campos editaveis do profile sob RLS
-- Mantem o usuario autenticado restrito ao proprio registro
-- e limita updates apenas aos campos permitidos pela UI atual.

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists notes text;

update public.profiles as profiles
set
  birth_date = coalesce(
    profiles.birth_date,
    nullif(auth_users.raw_user_meta_data ->> 'birth_date', '')::date
  ),
  notes = coalesce(
    profiles.notes,
    nullif(trim(coalesce(auth_users.raw_user_meta_data ->> 'notes', '')), '')
  )
from auth.users as auth_users
where auth_users.id = profiles.id;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, birth_date, phone, notes) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    birth_date,
    role,
    phone,
    notes
  )
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), ''),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    case
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) in ('professor', 'aluno')
        then lower(new.raw_user_meta_data ->> 'role')
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'coach'
        then 'professor'
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'student'
        then 'aluno'
      else 'professor'
    end,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'notes', '')), '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    birth_date = coalesce(public.profiles.birth_date, excluded.birth_date),
    role = coalesce(public.profiles.role, excluded.role),
    phone = coalesce(public.profiles.phone, excluded.phone),
    notes = coalesce(public.profiles.notes, excluded.notes),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "profile_avatars_public_read" on storage.objects;
create policy "profile_avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'profile-avatars');

drop policy if exists "profile_avatars_insert_own" on storage.objects;
create policy "profile_avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_avatars_update_own" on storage.objects;
create policy "profile_avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_avatars_delete_own" on storage.objects;
create policy "profile_avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
