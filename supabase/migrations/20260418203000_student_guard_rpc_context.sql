create or replace function public.guard_student_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_context text := current_setting('app.student_update_context', true);
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.auth_user_id = auth.uid() then
    if update_context = 'first_access_complete' then
      if new.id is distinct from old.id
        or new.teacher_id is distinct from old.teacher_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.email is distinct from old.email
        or new.status is distinct from old.status
        or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
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

      return new;
    end if;

    if update_context = 'touch_last_login' then
      if new.id is distinct from old.id
        or new.teacher_id is distinct from old.teacher_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.email is distinct from old.email
        or new.status is distinct from old.status
        or new.access_status is distinct from old.access_status
        or new.must_change_password is distinct from old.must_change_password
        or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
        or new.first_access_completed_at is distinct from old.first_access_completed_at
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

      return new;
    end if;

    if update_context = 'submit_payment_proof' then
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
        or new.start_date is distinct from old.start_date
        or new.workout_updated_at is distinct from old.workout_updated_at
        or new.next_workout_change is distinct from old.next_workout_change
        or new.metadata is distinct from old.metadata then
        raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
          using errcode = '42501';
      end if;

      return new;
    end if;

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

  perform set_config('app.student_update_context', 'touch_last_login', true);

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

  perform set_config('app.student_update_context', 'first_access_complete', true);

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

create or replace function public.submit_student_payment_proof(
  p_student_id uuid,
  p_storage_key text,
  p_file_url text,
  p_file_name text,
  p_mime_type text,
  p_sent_at timestamptz default timezone('utc', now())
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_student public.students%rowtype;
begin
  perform set_config('app.student_update_context', 'submit_payment_proof', true);

  update public.students
  set
    proof_of_payment_status = 'submitted',
    proof_of_payment_storage_key = p_storage_key,
    proof_of_payment_file_url = p_file_url,
    proof_of_payment_file_name = p_file_name,
    proof_of_payment_mime_type = p_mime_type,
    proof_of_payment_sent_at = coalesce(p_sent_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where id = p_student_id
  returning * into updated_student;

  if updated_student.id is null then
    raise exception 'Aluno nao encontrado.' using errcode = 'P0002';
  end if;

  return updated_student;
end;
$$;
