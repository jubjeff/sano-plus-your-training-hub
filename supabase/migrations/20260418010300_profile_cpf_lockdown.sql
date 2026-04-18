-- Move CPF to public.profiles and keep it immutable for authenticated users.
-- This removes the app's dependence on auth.users.raw_user_meta_data for CPF reads.

alter table public.profiles
  add column if not exists cpf text;

update public.profiles as profiles
set cpf = coalesce(
  profiles.cpf,
  nullif(regexp_replace(coalesce(auth_users.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'), '')
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
    cpf,
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
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'), ''),
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
    cpf = coalesce(public.profiles.cpf, excluded.cpf),
    birth_date = coalesce(public.profiles.birth_date, excluded.birth_date),
    role = coalesce(public.profiles.role, excluded.role),
    phone = coalesce(public.profiles.phone, excluded.phone),
    notes = coalesce(public.profiles.notes, excluded.notes),
    updated_at = timezone('utc', now());

  return new;
end;
$$;
