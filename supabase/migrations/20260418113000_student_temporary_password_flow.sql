alter table public.students
  add column if not exists must_change_password boolean;

update public.students
set must_change_password = case
  when access_status = 'active' and first_access_completed_at is not null then false
  else true
end
where must_change_password is null;

update public.students
set email = lower(trim(email))
where email is not null;

alter table public.students
  alter column email set not null,
  alter column must_change_password set default true,
  alter column must_change_password set not null;

alter table public.students
  drop constraint if exists students_access_first_access_consistency_chk;

alter table public.students
  add constraint students_access_first_access_consistency_chk
  check (
    not (access_status = 'active' and must_change_password = true)
    and not (access_status = 'temporary_password_pending' and must_change_password = false)
  );

drop index if exists students_teacher_email_key;
create unique index if not exists students_teacher_email_key
  on public.students (teacher_id, lower(email));

create index if not exists students_teacher_auth_status_idx
  on public.students (teacher_id, auth_user_id, access_status, must_change_password);

create or replace function public.guard_student_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.auth_user_id = auth.uid() then
    if new.id is distinct from old.id
      or new.teacher_id is distinct from old.teacher_id
      or new.auth_user_id is distinct from old.auth_user_id
      or new.email is distinct from old.email
      or new.status is distinct from old.status
      or new.access_status is distinct from old.access_status
      or new.must_change_password is distinct from old.must_change_password
      or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
      or new.first_access_completed_at is distinct from old.first_access_completed_at
      or new.last_login_at is distinct from old.last_login_at
      or new.last_check_in_at is distinct from old.last_check_in_at
      or new.payment_due_date is distinct from old.payment_due_date
      or new.payment_last_paid_at is distinct from old.payment_last_paid_at
      or new.proof_of_payment_status is distinct from old.proof_of_payment_status
      or new.proof_of_payment_storage_key is distinct from old.proof_of_payment_storage_key
      or new.proof_of_payment_file_url is distinct from old.proof_of_payment_file_url
      or new.proof_of_payment_file_name is distinct from old.proof_of_payment_file_name
      or new.proof_of_payment_mime_type is distinct from old.proof_of_payment_mime_type
      or new.proof_of_payment_sent_at is distinct from old.proof_of_payment_sent_at
      or new.start_date is distinct from old.start_date
      or new.workout_updated_at is distinct from old.workout_updated_at
      or new.next_workout_change is distinct from old.next_workout_change
      or new.metadata is distinct from old.metadata then
      raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_student_self_update_trigger on public.students;
create trigger guard_student_self_update_trigger
before update on public.students
for each row execute function public.guard_student_self_update();

create or replace function public.touch_student_last_login(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student public.students%rowtype;
begin
  select *
  into target_student
  from public.students
  where id = p_student_id;

  if target_student.id is null then
    raise exception 'Aluno nao encontrado.' using errcode = 'P0002';
  end if;

  if auth.role() <> 'service_role'
    and coalesce(public.current_teacher_id(), target_student.teacher_id) <> target_student.teacher_id
    and coalesce(public.current_student_id(), target_student.id) <> target_student.id then
    raise exception 'Voce nao pode registrar login para este aluno.' using errcode = '42501';
  end if;

  update public.students
  set
    last_login_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_student_id;
end;
$$;

create or replace function public.mark_student_first_access_complete(p_student_id uuid)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_student_id uuid := public.current_student_id();
  updated_student public.students%rowtype;
begin
  if auth.role() <> 'service_role' then
    if actor_student_id is null or actor_student_id <> p_student_id then
      raise exception 'Voce nao pode concluir o primeiro acesso de outro aluno.' using errcode = '42501';
    end if;
  end if;

  update public.students
  set
    must_change_password = false,
    access_status = 'active',
    first_access_completed_at = timezone('utc', now()),
    last_login_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_student_id
    and auth_user_id is not null
    and (
      access_status = 'temporary_password_pending'
      or must_change_password = true
    )
  returning * into updated_student;

  if updated_student.id is null then
    raise exception 'Primeiro acesso nao disponivel para este aluno.' using errcode = 'P0001';
  end if;

  return updated_student;
end;
$$;

create or replace function public.assert_student_can_check_in(
  p_student_id uuid,
  p_teacher_id uuid,
  p_check_in_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  student_record public.students%rowtype;
  actor_teacher_id uuid := public.current_teacher_id();
  actor_student_id uuid := public.current_student_id();
begin
  if auth.role() <> 'service_role' then
    if actor_teacher_id is null and actor_student_id is null then
      raise exception 'Sessao sem permissao para registrar check-in.' using errcode = '42501';
    end if;

    if actor_teacher_id is not null and actor_teacher_id <> p_teacher_id then
      raise exception 'Voce nao pode registrar check-in para outro professor.' using errcode = '42501';
    end if;

    if actor_student_id is not null then
      if actor_student_id <> p_student_id then
        raise exception 'Voce nao pode registrar check-in para outro aluno.' using errcode = '42501';
      end if;

      if public.current_student_teacher_id() <> p_teacher_id then
        raise exception 'Professor nao corresponde ao aluno autenticado.' using errcode = '42501';
      end if;
    end if;
  end if;

  select *
  into student_record
  from public.students
  where id = p_student_id
    and teacher_id = p_teacher_id
  for update;

  if student_record.id is null then
    raise exception 'Aluno nao encontrado.' using errcode = 'P0002';
  end if;

  if student_record.status <> 'active' then
    raise exception 'Seu acesso foi desativado. Fale com seu professor.' using errcode = 'P0001';
  end if;

  if student_record.access_status <> 'active' or student_record.must_change_password then
    raise exception 'Conclua o primeiro acesso antes de usar o restante da area autenticada.' using errcode = 'P0001';
  end if;

  if public.student_workout_access_blocked(student_record.id) then
    raise exception 'Os treinos estao bloqueados por inadimplencia.' using errcode = 'P0001';
  end if;
end;
$$;

drop policy if exists "students_manage_own_teacher" on public.students;
drop policy if exists "students_select_own_teacher" on public.students;
drop policy if exists "students_insert_own_teacher" on public.students;
drop policy if exists "students_update_own_teacher" on public.students;
drop policy if exists "students_delete_own_teacher" on public.students;
drop policy if exists "students_update_own_student" on public.students;

create policy "students_select_own_teacher"
on public.students
for select
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "students_insert_own_teacher"
on public.students
for insert
to authenticated
with check (teacher_id = public.current_teacher_id());

create policy "students_update_own_teacher"
on public.students
for update
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

create policy "students_delete_own_teacher"
on public.students
for delete
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "students_update_own_student"
on public.students
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());
