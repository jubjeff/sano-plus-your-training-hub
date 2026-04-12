begin;

-- Execute este arquivo somente em ambiente de teste apos aplicar a migration principal.
-- Ele documenta os cenarios essenciais do negocio e usa ASSERT nativo do PostgreSQL.

do $$
declare
  teacher_one_user uuid := gen_random_uuid();
  teacher_two_user uuid := gen_random_uuid();
  teacher_three_user uuid := gen_random_uuid();
  teacher_one_id uuid;
  teacher_two_id uuid;
  teacher_three_id uuid;
  snapshot record;
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      teacher_one_user,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'trial-1@sano.plus',
      crypt('Senha@123', gen_salt('bf')),
      timezone('utc', now()),
      '{}'::jsonb,
      '{}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    ),
    (
      teacher_two_user,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'trial-2@sano.plus',
      crypt('Senha@123', gen_salt('bf')),
      timezone('utc', now()),
      '{}'::jsonb,
      '{}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    ),
    (
      teacher_three_user,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'pro-1@sano.plus',
      crypt('Senha@123', gen_salt('bf')),
      timezone('utc', now()),
      '{}'::jsonb,
      '{}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now())
    );

  select teacher_id
  into teacher_one_id
  from public.provision_teacher_account(
    teacher_one_user,
    'trial-1@sano.plus',
    'Professor Trial',
    '1990-01-01',
    '39053344705',
    null,
    'basic',
    false,
    '{}'::jsonb
  );

  select * into snapshot from public.get_teacher_access_snapshot(teacher_one_id);
  assert snapshot.trial_active is true, 'CPF novo deve receber trial.';

  select teacher_id
  into teacher_two_id
  from public.provision_teacher_account(
    teacher_two_user,
    'trial-2@sano.plus',
    'Professor Sem Trial',
    '1990-01-01',
    '390.533.447-05',
    null,
    'basic',
    false,
    '{}'::jsonb
  );

  select * into snapshot from public.get_teacher_access_snapshot(teacher_two_id);
  assert snapshot.effective_status = 'pending_payment', 'CPF repetido nao pode receber novo trial.';

  select teacher_id
  into teacher_three_id
  from public.provision_teacher_account(
    teacher_three_user,
    'pro-1@sano.plus',
    'Professor Pro',
    '1990-01-01',
    '11144477735',
    null,
    'pro',
    true,
    '{}'::jsonb
  );

  select * into snapshot from public.get_teacher_access_snapshot(teacher_three_id);
  assert snapshot.plan_type = 'pro' and snapshot.effective_status = 'active', 'Cadastro com Pro deve ativar acesso imediatamente.';

  insert into public.students (teacher_id, full_name, email)
  values (teacher_one_id, 'Aluno Um', 'aluno-1@sano.plus');

  begin
    insert into public.students (teacher_id, full_name, email)
    values (teacher_one_id, 'Aluno Dois', 'aluno-2@sano.plus');
    raise exception 'Esperava falha ao inserir segundo aluno no Basic.';
  exception
    when others then
      if position('plano Basic permite apenas 1 aluno' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  perform public.activate_pro_plan(
    teacher_one_id,
    timezone('utc', now()) + interval '30 days',
    'manual',
    'sub_test_teacher_one',
    teacher_one_user,
    jsonb_build_object('scenario', 'upgrade')
  );

  insert into public.students (teacher_id, full_name, email)
  values (teacher_one_id, 'Aluno Tres', 'aluno-3@sano.plus');

  insert into public.students (teacher_id, full_name, email)
  values (teacher_one_id, 'Aluno Quatro', 'aluno-4@sano.plus');

  update public.teacher_subscriptions
  set
    plan_type = 'basic',
    status = 'trialing',
    access_blocked = false,
    trial_started_at = timezone('utc', now()) - interval '40 days',
    trial_ends_at = timezone('utc', now()) - interval '10 days',
    current_period_starts_at = null,
    current_period_ends_at = null
  where teacher_id = teacher_one_id;

  select * into snapshot from public.get_teacher_access_snapshot(teacher_one_id);
  assert snapshot.has_active_access is false, 'Trial expirado deve bloquear acesso principal.';
end;
$$;

rollback;
