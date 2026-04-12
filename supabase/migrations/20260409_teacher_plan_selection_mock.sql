alter type public.payment_event_type add value if not exists 'mock_payment_confirmation';

create or replace function public.create_teacher_subscription_from_selection(
  p_teacher_id uuid,
  p_cpf text,
  p_selected_plan public.plan_type,
  p_mock_payment_confirmed boolean default false,
  p_origin text default 'signup'
)
returns public.teacher_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  created_subscription public.teacher_subscriptions%rowtype;
begin
  if p_selected_plan = 'basic' then
    return public.create_initial_teacher_plan(p_teacher_id, p_cpf, p_origin);
  end if;

  if p_selected_plan <> 'pro' then
    raise exception 'Plano selecionado invalido.' using errcode = '22023';
  end if;

  if not p_mock_payment_confirmed then
    raise exception 'A confirmacao mockada do plano Pro e obrigatoria.' using errcode = '22023';
  end if;

  insert into public.teacher_subscriptions (
    teacher_id,
    plan_type,
    status,
    access_blocked,
    billing_provider,
    student_limit,
    started_at,
    current_period_starts_at,
    current_period_ends_at,
    metadata
  )
  values (
    p_teacher_id,
    'pro',
    'active',
    false,
    'mock',
    null,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now()) + interval '1 month',
    jsonb_build_object('origin', p_origin, 'mock_payment_confirmed', true)
  )
  on conflict (teacher_id) do update
  set
    plan_type = excluded.plan_type,
    status = excluded.status,
    access_blocked = false,
    billing_provider = excluded.billing_provider,
    current_period_starts_at = excluded.current_period_starts_at,
    current_period_ends_at = excluded.current_period_ends_at,
    metadata = coalesce(public.teacher_subscriptions.metadata, '{}'::jsonb) || excluded.metadata
  returning * into created_subscription;

  perform public.log_subscription_history(
    p_teacher_id,
    created_subscription.id,
    'subscription_created',
    null,
    created_subscription.plan_type,
    null,
    created_subscription.status,
    null,
    'Assinatura inicial do plano Pro criada com pagamento mockado.',
    jsonb_build_object('origin', p_origin, 'mock_payment_confirmed', true)
  );

  perform public.log_subscription_history(
    p_teacher_id,
    created_subscription.id,
    'pro_activated',
    null,
    created_subscription.plan_type,
    null,
    created_subscription.status,
    null,
    'Plano Pro ativado durante o cadastro.',
    jsonb_build_object('origin', p_origin, 'mock_payment_confirmed', true)
  );

  insert into public.payment_events (
    teacher_id,
    subscription_id,
    event_type,
    status,
    provider,
    provider_reference,
    amount_cents,
    currency,
    paid_at,
    event_payload
  )
  values (
    p_teacher_id,
    created_subscription.id,
    'mock_payment_confirmation',
    'confirmed',
    'mock',
    concat('mock-signup-', p_teacher_id::text),
    null,
    'BRL',
    timezone('utc', now()),
    jsonb_build_object('origin', p_origin, 'mock_payment_confirmed', true)
  );

  return created_subscription;
end;
$$;

create or replace function public.confirm_mock_pro_payment(
  p_teacher_id uuid,
  p_current_period_ends_at timestamptz default timezone('utc', now()) + interval '1 month',
  p_access_request_id uuid default null,
  p_actor_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.teacher_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  activated_subscription public.teacher_subscriptions%rowtype;
begin
  activated_subscription := public.activate_pro_plan(
    p_teacher_id,
    p_current_period_ends_at,
    'mock',
    concat('mock-sub-', p_teacher_id::text, '-', extract(epoch from timezone('utc', now()))::bigint),
    p_actor_user_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
  );

  if p_access_request_id is not null then
    update public.access_requests
    set
      status = 'approved',
      resolved_at = timezone('utc', now()),
      resolved_by = p_actor_user_id,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
    where id = p_access_request_id
      and teacher_id = p_teacher_id;
  end if;

  insert into public.payment_events (
    teacher_id,
    subscription_id,
    access_request_id,
    event_type,
    status,
    provider,
    provider_reference,
    amount_cents,
    currency,
    paid_at,
    event_payload
  )
  values (
    p_teacher_id,
    activated_subscription.id,
    p_access_request_id,
    'mock_payment_confirmation',
    'confirmed',
    'mock',
    concat('mock-upgrade-', p_teacher_id::text, '-', extract(epoch from timezone('utc', now()))::bigint),
    null,
    'BRL',
    timezone('utc', now()),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
  );

  return activated_subscription;
end;
$$;

create or replace function public.provision_teacher_account(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_birth_date date,
  p_cpf text,
  p_phone text default null,
  p_selected_plan public.plan_type default 'basic',
  p_mock_pro_payment_confirmed boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  teacher_id uuid,
  subscription_id uuid,
  plan_type public.plan_type,
  stored_status public.subscription_status,
  effective_status public.subscription_status,
  trial_active boolean,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  has_active_access boolean,
  student_limit integer,
  current_student_count bigint,
  can_add_student boolean,
  access_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_cpf text := public.normalize_cpf(p_cpf);
  teacher_record public.teachers%rowtype;
begin
  if p_user_id is null then
    raise exception 'Usuario autenticado nao informado.' using errcode = '22023';
  end if;

  if not public.is_valid_cpf(normalized_cpf) then
    raise exception 'CPF invalido.' using errcode = '22023';
  end if;

  insert into public.profiles (
    user_id,
    email,
    full_name,
    birth_date,
    cpf,
    cpf_normalized,
    phone,
    metadata
  )
  values (
    p_user_id,
    p_email,
    p_full_name,
    p_birth_date,
    p_cpf,
    normalized_cpf,
    p_phone,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('selected_plan', p_selected_plan)
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    birth_date = excluded.birth_date,
    cpf = excluded.cpf,
    cpf_normalized = excluded.cpf_normalized,
    phone = excluded.phone,
    metadata = public.profiles.metadata || excluded.metadata;

  insert into public.teachers (user_id, onboarding_completed, metadata)
  values (p_user_id, true, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('selected_plan', p_selected_plan))
  on conflict (user_id) do update
  set
    onboarding_completed = true,
    metadata = public.teachers.metadata || excluded.metadata
  returning * into teacher_record;

  perform public.create_teacher_subscription_from_selection(
    teacher_record.id,
    normalized_cpf,
    p_selected_plan,
    p_mock_pro_payment_confirmed,
    'edge_function:create-teacher-account'
  );

  return query
  select
    snapshot.teacher_id,
    snapshot.subscription_id,
    snapshot.plan_type,
    snapshot.stored_status,
    snapshot.effective_status,
    snapshot.trial_active,
    snapshot.trial_ends_at,
    snapshot.current_period_ends_at,
    snapshot.has_active_access,
    snapshot.student_limit,
    snapshot.current_student_count,
    snapshot.can_add_student,
    snapshot.access_message
  from public.get_teacher_access_snapshot(teacher_record.id) snapshot;
end;
$$;

grant execute on function public.create_teacher_subscription_from_selection(uuid, text, public.plan_type, boolean, text) to service_role;
grant execute on function public.confirm_mock_pro_payment(uuid, timestamptz, uuid, uuid, jsonb) to service_role;
grant execute on function public.provision_teacher_account(uuid, text, text, date, text, text, public.plan_type, boolean, jsonb) to service_role;
