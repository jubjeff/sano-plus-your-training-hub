update public.students
set
  access_status = case
    when auth_user_id is not null then 'temporary_password_pending'
    else 'inactive'
  end,
  must_change_password = true,
  first_access_completed_at = null,
  updated_at = timezone('utc', now())
where access_status = 'pre_registered';

update public.students
set
  access_status = 'inactive',
  must_change_password = true,
  first_access_completed_at = null,
  updated_at = timezone('utc', now())
where auth_user_id is null
  and access_status in ('temporary_password_pending', 'active');

alter table public.students
  drop constraint if exists students_access_status_check;

alter table public.students
  add constraint students_access_status_check
  check (access_status in ('temporary_password_pending', 'active', 'inactive'));

alter table public.students
  alter column access_status set default 'inactive';

alter table public.students
  drop constraint if exists students_access_first_access_consistency_chk;

alter table public.students
  add constraint students_access_first_access_consistency_chk
  check (
    not (access_status = 'active' and must_change_password = true)
    and not (access_status = 'temporary_password_pending' and must_change_password = false)
    and not (access_status in ('active', 'temporary_password_pending') and auth_user_id is null)
  );

drop policy if exists "students_select_own_student" on public.students;
create policy "students_select_own_student"
on public.students
for select
to authenticated
using (auth_user_id = auth.uid());
