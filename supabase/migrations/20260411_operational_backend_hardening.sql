create or replace function public.student_workout_access_blocked(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        case
          when s.status <> 'active' then true
          when s.access_status = 'inactive' then true
          when s.payment_due_date is not null
            and s.payment_due_date <= current_date - interval '3 day'
            and s.proof_of_payment_status <> 'submitted'
            then true
          else false
        end
      from public.students s
      where s.id = p_student_id
    ),
    true
  );
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

  if student_record.access_status not in ('active', 'temporary_password_pending') then
    raise exception 'Seu acesso nao esta liberado no momento.' using errcode = 'P0001';
  end if;

  if public.student_workout_access_blocked(student_record.id) then
    raise exception 'Os treinos estao bloqueados por inadimplencia.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.touch_student_last_login(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_teacher_id uuid := public.current_teacher_id();
  actor_student_id uuid := public.current_student_id();
begin
  if auth.role() <> 'service_role' then
    if actor_student_id is not null and actor_student_id <> p_student_id then
      raise exception 'Voce nao pode atualizar o login de outro aluno.' using errcode = '42501';
    end if;

    if actor_teacher_id is null and actor_student_id is null then
      raise exception 'Sessao sem permissao para atualizar o login.' using errcode = '42501';
    end if;

    if actor_teacher_id is not null then
      perform 1
      from public.students
      where id = p_student_id
        and teacher_id = actor_teacher_id;

      if not found then
        raise exception 'Aluno nao pertence ao professor autenticado.' using errcode = '42501';
      end if;
    end if;
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
  actor_teacher_id uuid := public.current_teacher_id();
  actor_student_id uuid := public.current_student_id();
  updated_student public.students%rowtype;
begin
  if auth.role() <> 'service_role' then
    if actor_student_id is not null and actor_student_id <> p_student_id then
      raise exception 'Voce nao pode concluir o primeiro acesso de outro aluno.' using errcode = '42501';
    end if;

    if actor_teacher_id is null and actor_student_id is null then
      raise exception 'Sessao sem permissao para concluir o primeiro acesso.' using errcode = '42501';
    end if;

    if actor_teacher_id is not null then
      perform 1
      from public.students
      where id = p_student_id
        and teacher_id = actor_teacher_id;

      if not found then
        raise exception 'Aluno nao pertence ao professor autenticado.' using errcode = '42501';
      end if;
    end if;
  end if;

  update public.students
  set
    access_status = 'active',
    first_access_completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_student_id
  returning * into updated_student;

  return updated_student;
end;
$$;

create or replace function public.ensure_student_workout_plan(
  p_teacher_id uuid,
  p_student_id uuid,
  p_start_date date,
  p_next_workout_change_date date default null
)
returns public.student_workout_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_record public.student_workout_plans%rowtype;
begin
  if auth.role() <> 'service_role' and public.current_teacher_id() <> p_teacher_id then
    raise exception 'Voce nao pode gerenciar o plano de treino de outro professor.' using errcode = '42501';
  end if;

  perform 1
  from public.students
  where id = p_student_id
    and teacher_id = p_teacher_id;

  if not found then
    raise exception 'Aluno nao encontrado para este professor.' using errcode = 'P0002';
  end if;

  insert into public.student_workout_plans (
    teacher_id,
    student_id,
    start_date,
    next_workout_change_date,
    blocks
  )
  values (
    p_teacher_id,
    p_student_id,
    p_start_date,
    p_next_workout_change_date,
    '[]'::jsonb
  )
  on conflict (student_id) do update
  set
    teacher_id = excluded.teacher_id,
    start_date = excluded.start_date,
    next_workout_change_date = coalesce(public.student_workout_plans.next_workout_change_date, excluded.next_workout_change_date)
  returning * into plan_record;

  return plan_record;
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
  if auth.role() <> 'service_role' and public.current_student_id() <> p_student_id then
    raise exception 'Voce nao pode enviar comprovante para outro aluno.' using errcode = '42501';
  end if;

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

create or replace function public.update_student_exercise_load(
  p_student_id uuid,
  p_block_id text,
  p_exercise_id text,
  p_student_load text
)
returns public.student_workout_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_record public.student_workout_plans%rowtype;
  updated_plan public.student_workout_plans%rowtype;
  blocks_json jsonb;
  block_item jsonb;
  exercises_json jsonb;
  exercise_item jsonb;
  next_blocks jsonb := '[]'::jsonb;
  next_exercises jsonb;
  block_found boolean := false;
  exercise_found boolean := false;
begin
  if auth.role() <> 'service_role' and public.current_student_id() <> p_student_id then
    raise exception 'Voce nao pode atualizar a carga de outro aluno.' using errcode = '42501';
  end if;

  select *
  into plan_record
  from public.student_workout_plans
  where student_id = p_student_id
  for update;

  if plan_record.id is null then
    raise exception 'Plano de treino nao encontrado.' using errcode = 'P0002';
  end if;

  blocks_json := coalesce(plan_record.blocks, '[]'::jsonb);

  for block_item in select * from jsonb_array_elements(blocks_json)
  loop
    if coalesce(block_item ->> 'id', '') = p_block_id then
      block_found := true;
      exercises_json := coalesce(block_item -> 'exercises', '[]'::jsonb);
      next_exercises := '[]'::jsonb;

      for exercise_item in select * from jsonb_array_elements(exercises_json)
      loop
        if coalesce(exercise_item ->> 'id', '') = p_exercise_id then
          exercise_found := true;
          exercise_item := jsonb_set(
            jsonb_set(
              exercise_item,
              '{studentLoad}',
              coalesce(to_jsonb(p_student_load), 'null'::jsonb),
              true
            ),
            '{updatedAt}',
            to_jsonb(timezone('utc', now())::text),
            true
          );
        end if;

        next_exercises := next_exercises || jsonb_build_array(exercise_item);
      end loop;

      block_item := jsonb_set(block_item, '{exercises}', next_exercises, true);
    end if;

    next_blocks := next_blocks || jsonb_build_array(block_item);
  end loop;

  if not block_found then
    raise exception 'Bloco de treino nao encontrado.' using errcode = 'P0002';
  end if;

  if not exercise_found then
    raise exception 'Exercicio nao encontrado.' using errcode = 'P0002';
  end if;

  update public.student_workout_plans
  set
    blocks = next_blocks,
    updated_at = timezone('utc', now())
  where id = plan_record.id
  returning * into updated_plan;

  return updated_plan;
end;
$$;

grant execute on function public.submit_student_payment_proof(uuid, text, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.update_student_exercise_load(uuid, text, text, text) to authenticated, service_role;
