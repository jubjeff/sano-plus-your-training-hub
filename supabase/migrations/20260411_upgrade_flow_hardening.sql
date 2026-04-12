create or replace function public.request_pro_upgrade(
  p_teacher_id uuid,
  p_message text default null,
  p_amount_cents integer default null,
  p_currency text default 'BRL',
  p_metadata jsonb default '{}'::jsonb
)
returns public.access_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.access_requests%rowtype;
  existing_open_request public.access_requests%rowtype;
  subscription_record public.teacher_subscriptions%rowtype;
  actor_user_id uuid;
  effective_status public.subscription_status;
begin
  select user_id into actor_user_id from public.teachers where id = p_teacher_id;

  if actor_user_id is null then
    raise exception 'Professor nao encontrado.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 0));

  select *
  into subscription_record
  from public.teacher_subscriptions
  where teacher_id = p_teacher_id
  for update;

  if subscription_record.id is null then
    raise exception 'Assinatura nao encontrada.' using errcode = 'P0002';
  end if;

  select snapshot.effective_status
  into effective_status
  from public.get_teacher_access_snapshot(p_teacher_id) snapshot;

  if subscription_record.plan_type = 'pro' and effective_status = 'active' then
    raise exception 'Plano Pro ja esta ativo.' using errcode = 'P0001';
  end if;

  select *
  into existing_open_request
  from public.access_requests
  where teacher_id = p_teacher_id
    and request_type = 'upgrade_to_pro'
    and status in ('open', 'processing')
  order by created_at desc
  limit 1;

  if existing_open_request.id is not null then
    return existing_open_request;
  end if;

  insert into public.access_requests (
    teacher_id,
    request_type,
    requested_plan_type,
    status,
    message,
    metadata
  )
  values (
    p_teacher_id,
    'upgrade_to_pro',
    'pro',
    'open',
    p_message,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into request_record;

  insert into public.payment_events (
    teacher_id,
    subscription_id,
    access_request_id,
    event_type,
    status,
    amount_cents,
    currency,
    event_payload
  )
  values (
    p_teacher_id,
    subscription_record.id,
    request_record.id,
    'upgrade_request',
    'pending',
    p_amount_cents,
    p_currency,
    coalesce(p_metadata, '{}'::jsonb)
  );

  perform public.log_subscription_history(
    p_teacher_id,
    subscription_record.id,
    'upgrade_requested',
    subscription_record.plan_type,
    subscription_record.plan_type,
    subscription_record.status,
    subscription_record.status,
    actor_user_id,
    'Solicitacao de upgrade para Pro registrada.',
    jsonb_build_object('access_request_id', request_record.id)
  );

  return request_record;
end;
$$;

create or replace function public.confirm_mock_pro_payment(
  p_teacher_id uuid default null,
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
  resolved_actor_user_id uuid := coalesce(p_actor_user_id, auth.uid());
  resolved_teacher_id uuid;
begin
  if resolved_actor_user_id is not null then
    select t.id
    into resolved_teacher_id
    from public.teachers t
    where t.user_id = resolved_actor_user_id
      and (p_teacher_id is null or t.id = p_teacher_id);

    if resolved_teacher_id is null then
      raise exception 'Professor nao encontrado para o usuario autenticado.' using errcode = 'P0002';
    end if;
  else
    resolved_teacher_id := p_teacher_id;
  end if;

  if resolved_teacher_id is null then
    raise exception 'Professor nao informado.' using errcode = '22023';
  end if;

  activated_subscription := public.activate_pro_plan(
    resolved_teacher_id,
    p_current_period_ends_at,
    'mock',
    concat('mock-sub-', resolved_teacher_id::text, '-', extract(epoch from timezone('utc', now()))::bigint),
    resolved_actor_user_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
  );

  if p_access_request_id is not null then
    update public.access_requests
    set
      status = 'approved',
      resolved_at = timezone('utc', now()),
      resolved_by = resolved_actor_user_id,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
    where id = p_access_request_id
      and teacher_id = resolved_teacher_id;
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
    resolved_teacher_id,
    activated_subscription.id,
    p_access_request_id,
    'mock_payment_confirmation',
    'confirmed',
    'mock',
    concat('mock-upgrade-', resolved_teacher_id::text, '-', extract(epoch from timezone('utc', now()))::bigint),
    null,
    'BRL',
    timezone('utc', now()),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
  );

  return activated_subscription;
end;
$$;

grant execute on function public.request_pro_upgrade(uuid, text, integer, text, jsonb) to authenticated, service_role;
grant execute on function public.confirm_mock_pro_payment(uuid, timestamptz, uuid, uuid, jsonb) to authenticated, service_role;
