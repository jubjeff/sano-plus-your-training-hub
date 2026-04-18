create or replace function public.provision_current_teacher_account(
  p_selected_plan text default null,
  p_mock_pro_payment_confirmed boolean default false
)
returns table (
  teacher_id uuid,
  subscription_id uuid,
  plan_type text,
  stored_status text,
  effective_status text,
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
  profile_record public.profiles%rowtype;
  teacher_record public.teachers%rowtype;
  auth_metadata jsonb;
  selected_plan text;
  mock_payment_confirmed boolean;
begin
  if auth.uid() is null then
    raise exception 'Sessao autenticada obrigatoria.' using errcode = '42501';
  end if;

  select * into profile_record
  from public.profiles
  where id = auth.uid();

  if profile_record.id is null then
    raise exception 'Perfil nao encontrado.' using errcode = 'P0002';
  end if;

  if profile_record.role <> 'professor' then
    raise exception 'Apenas professores podem provisionar conta docente.' using errcode = '42501';
  end if;

  select coalesce(raw_user_meta_data, '{}'::jsonb)
  into auth_metadata
  from auth.users
  where id = auth.uid();

  selected_plan := lower(coalesce(nullif(trim(p_selected_plan), ''), auth_metadata ->> 'selected_plan', 'basic'));
  mock_payment_confirmed := p_mock_pro_payment_confirmed or coalesce((auth_metadata ->> 'mockProPaymentConfirmed')::boolean, false);

  insert into public.teachers (user_id, onboarding_completed, metadata)
  values (
    auth.uid(),
    true,
    jsonb_build_object('selected_plan', selected_plan)
  )
  on conflict (user_id) do update
  set
    onboarding_completed = true,
    metadata = coalesce(public.teachers.metadata, '{}'::jsonb) || excluded.metadata
  returning * into teacher_record;

  if not exists (select 1 from public.teacher_subscriptions where teacher_id = teacher_record.id) then
    perform public.create_teacher_subscription_from_selection(
      teacher_record.id,
      profile_record.cpf,
      selected_plan,
      mock_payment_confirmed,
      'rpc:bootstrap'
    );
  end if;

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
