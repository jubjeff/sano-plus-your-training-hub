create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  onboarding_completed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.teacher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.teachers (id) on delete cascade,
  plan_type text not null check (plan_type in ('basic', 'pro')),
  status text not null check (status in ('trialing', 'active', 'expired', 'blocked', 'pending_payment', 'canceled')),
  access_blocked boolean not null default false,
  billing_provider text,
  external_subscription_id text,
  started_at timestamptz not null default timezone('utc', now()),
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_granted boolean not null default false,
  canceled_at timestamptz,
  blocked_reason text,
  student_limit integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint teacher_subscriptions_student_limit_chk check (student_limit is null or student_limit > 0),
  constraint teacher_subscriptions_trial_window_chk check (
    (trial_granted = false and trial_started_at is null and trial_ends_at is null)
    or
    (trial_granted = true and trial_started_at is not null and trial_ends_at is not null and trial_ends_at > trial_started_at)
  )
);

create unique index if not exists teacher_subscriptions_external_subscription_id_key
  on public.teacher_subscriptions (external_subscription_id)
  where external_subscription_id is not null;

create table if not exists public.cpf_trial_registry (
  cpf_normalized text primary key,
  first_user_id uuid references auth.users (id) on delete set null,
  first_teacher_id uuid references public.teachers (id) on delete set null,
  granted_subscription_id uuid references public.teacher_subscriptions (id) on delete set null,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cpf_trial_registry_digits_chk check (cpf_normalized ~ '^\d{11}$'),
  constraint cpf_trial_registry_window_chk check (trial_ends_at > trial_started_at)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  birth_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  goal text not null default '',
  notes text,
  profile_photo_storage_key text,
  profile_photo_url text,
  access_status text not null default 'pre_registered' check (access_status in ('pre_registered', 'temporary_password_pending', 'active', 'inactive')),
  temporary_password_generated_at timestamptz,
  first_access_completed_at timestamptz,
  last_login_at timestamptz,
  last_check_in_at timestamptz,
  payment_due_date date,
  payment_last_paid_at date,
  proof_of_payment_status text not null default 'not_sent' check (proof_of_payment_status in ('not_sent', 'submitted', 'approved')),
  proof_of_payment_storage_key text,
  proof_of_payment_file_url text,
  proof_of_payment_file_name text,
  proof_of_payment_mime_type text,
  proof_of_payment_sent_at timestamptz,
  start_date date not null default current_date,
  workout_updated_at date,
  next_workout_change date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint students_full_name_length_chk check (char_length(trim(full_name)) >= 3),
  constraint students_phone_digits_chk check (phone is null or regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$')
);

create unique index if not exists students_teacher_email_key
  on public.students (teacher_id, email)
  where email is not null;

create index if not exists students_auth_user_id_idx on public.students (auth_user_id);
create index if not exists students_teacher_access_status_idx on public.students (teacher_id, access_status);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  name text not null,
  objective text not null default '',
  notes text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint workout_templates_name_length_chk check (char_length(trim(name)) >= 3),
  constraint workout_templates_blocks_array_chk check (jsonb_typeof(blocks) = 'array')
);

create index if not exists workout_templates_teacher_created_idx
  on public.workout_templates (teacher_id, created_at desc);

create table if not exists public.student_workout_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  student_id uuid not null unique references public.students (id) on delete cascade,
  training_structure_type text not null default 'weekly' check (training_structure_type in ('weekly', 'abcde')),
  training_progress_mode text not null default 'fixed_schedule' check (training_progress_mode in ('fixed_schedule', 'sequential_progression')),
  plan_name text not null default 'Plano principal',
  is_active boolean not null default true,
  start_date date not null,
  end_date date,
  next_workout_change_date date,
  current_suggested_block_id text,
  last_completed_block_id text,
  last_completed_at timestamptz,
  weekly_goal integer not null default 4 check (weekly_goal between 1 and 7),
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint student_workout_plans_blocks_array_chk check (jsonb_typeof(blocks) = 'array')
);

create index if not exists student_workout_plans_teacher_updated_idx
  on public.student_workout_plans (teacher_id, updated_at desc);

create table if not exists public.student_check_ins (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  workout_plan_id uuid references public.student_workout_plans (id) on delete set null,
  workout_block_id text,
  training_structure_type text,
  training_progress_mode text,
  block_label text,
  checked_in_at timestamptz not null default timezone('utc', now()),
  check_in_date date not null default current_date,
  source text not null default 'student' check (source in ('student', 'coach')),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists student_check_ins_student_checked_idx
  on public.student_check_ins (student_id, checked_in_at desc);

create unique index if not exists student_check_ins_one_per_day_block_key
  on public.student_check_ins (student_id, coalesce(workout_block_id, ''), check_in_date);

create table if not exists public.coach_alert_reads (
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  alert_id text not null,
  is_read boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (teacher_id, alert_id)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now())
);

create trigger set_teachers_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

create trigger set_teacher_subscriptions_updated_at
before update on public.teacher_subscriptions
for each row execute function public.set_updated_at();

create trigger set_cpf_trial_registry_updated_at
before update on public.cpf_trial_registry
for each row execute function public.set_updated_at();

create trigger set_students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger set_workout_templates_updated_at
before update on public.workout_templates
for each row execute function public.set_updated_at();

create trigger set_student_workout_plans_updated_at
before update on public.student_workout_plans
for each row execute function public.set_updated_at();

create trigger set_coach_alert_reads_updated_at
before update on public.coach_alert_reads
for each row execute function public.set_updated_at();

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.teachers t
  where t.user_id = auth.uid();
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  where s.auth_user_id = auth.uid();
$$;

create or replace function public.current_student_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.teacher_id
  from public.students s
  where s.auth_user_id = auth.uid();
$$;

create or replace function public.normalize_cpf(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(value, ''), '\D', '', 'g');
$$;

create or replace function public.is_valid_cpf(value text)
returns boolean
language plpgsql
immutable
as $$
declare
  digits text := public.normalize_cpf(value);
  sum_one integer := 0;
  sum_two integer := 0;
  idx integer;
  digit_one integer;
  digit_two integer;
begin
  if digits !~ '^\d{11}$' or digits ~ '^(\d)\1{10}$' then
    return false;
  end if;

  for idx in 1..9 loop
    sum_one := sum_one + cast(substr(digits, idx, 1) as integer) * (11 - idx);
    sum_two := sum_two + cast(substr(digits, idx, 1) as integer) * (12 - idx);
  end loop;

  digit_one := ((sum_one * 10) % 11) % 10;
  sum_two := sum_two + digit_one * 2;
  digit_two := ((sum_two * 10) % 11) % 10;

  return digit_one = cast(substr(digits, 10, 1) as integer)
     and digit_two = cast(substr(digits, 11, 1) as integer);
end;
$$;

create or replace function public.get_teacher_access_snapshot(teacher_uuid uuid)
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
stable
security definer
set search_path = public
as $$
declare
  subscription_record public.teacher_subscriptions%rowtype;
  student_count bigint := 0;
  effective text;
  active_access boolean := false;
  message text := 'Acesso bloqueado no momento.';
begin
  select *
  into subscription_record
  from public.teacher_subscriptions ts
  where ts.teacher_id = teacher_uuid;

  select count(*)
  into student_count
  from public.students s
  where s.teacher_id = teacher_uuid;

  if subscription_record.id is null then
    return query
    select
      teacher_uuid,
      null::uuid,
      'basic'::text,
      'blocked'::text,
      'blocked'::text,
      false,
      null::timestamptz,
      null::timestamptz,
      false,
      1,
      student_count,
      false,
      message;
    return;
  end if;

  effective := subscription_record.status;

  if subscription_record.access_blocked then
    effective := case
      when subscription_record.status = 'pending_payment' then 'pending_payment'
      else 'blocked'
    end;
  elsif subscription_record.status = 'trialing'
    and subscription_record.trial_ends_at is not null
    and subscription_record.trial_ends_at <= timezone('utc', now()) then
    effective := 'expired';
  elsif subscription_record.status = 'active'
    and subscription_record.current_period_ends_at is not null
    and subscription_record.current_period_ends_at <= timezone('utc', now()) then
    effective := 'expired';
  end if;

  active_access := effective in ('trialing', 'active');

  if effective = 'trialing' then
    message := 'Seu trial Basic esta ativo no momento.';
  elsif effective = 'expired' then
    message := 'Seu periodo de teste expirou. Faca upgrade para o plano Pro para continuar.';
  elsif effective = 'pending_payment' then
    message := coalesce(subscription_record.blocked_reason, 'Assine o plano Pro para liberar o acesso.');
  elsif effective = 'blocked' then
    message := coalesce(subscription_record.blocked_reason, message);
  elsif effective = 'active' and subscription_record.plan_type = 'pro' then
    message := 'Plano Pro ativo.';
  elsif effective = 'active' then
    message := 'Plano ativo.';
  elsif effective = 'canceled' then
    message := 'Sua assinatura foi cancelada.';
  end if;

  return query
  select
    teacher_uuid,
    subscription_record.id,
    subscription_record.plan_type,
    subscription_record.status,
    effective,
    subscription_record.status = 'trialing'
      and subscription_record.trial_ends_at is not null
      and subscription_record.trial_ends_at > timezone('utc', now()),
    subscription_record.trial_ends_at,
    subscription_record.current_period_ends_at,
    active_access,
    subscription_record.student_limit,
    student_count,
    active_access and (subscription_record.student_limit is null or student_count < subscription_record.student_limit),
    message;
end;
$$;

create or replace function public.teacher_has_active_access(teacher_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select has_active_access from public.get_teacher_access_snapshot(teacher_uuid)), false);
$$;

create or replace function public.teacher_can_add_student(teacher_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select can_add_student from public.get_teacher_access_snapshot(teacher_uuid)), false);
$$;

create or replace function public.create_initial_teacher_plan(
  p_teacher_id uuid,
  p_cpf text,
  p_origin text default 'signup'
)
returns public.teacher_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_cpf text := public.normalize_cpf(p_cpf);
  teacher_record public.teachers%rowtype;
  existing_subscription public.teacher_subscriptions%rowtype;
  created_subscription public.teacher_subscriptions%rowtype;
  trial_started timestamptz := timezone('utc', now());
  trial_ends timestamptz := timezone('utc', now()) + interval '1 month';
  trial_inserted text;
begin
  if not public.is_valid_cpf(normalized_cpf) then
    raise exception 'CPF invalido.' using errcode = '22023';
  end if;

  select * into teacher_record from public.teachers where id = p_teacher_id;
  if teacher_record.id is null then
    raise exception 'Professor nao encontrado.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_cpf, 0));

  select * into existing_subscription
  from public.teacher_subscriptions
  where teacher_id = p_teacher_id
  for update;

  if existing_subscription.id is not null then
    return existing_subscription;
  end if;

  insert into public.cpf_trial_registry (
    cpf_normalized,
    first_user_id,
    first_teacher_id,
    trial_started_at,
    trial_ends_at
  )
  values (
    normalized_cpf,
    teacher_record.user_id,
    teacher_record.id,
    trial_started,
    trial_ends
  )
  on conflict do nothing
  returning cpf_normalized into trial_inserted;

  if trial_inserted is not null then
    insert into public.teacher_subscriptions (
      teacher_id,
      plan_type,
      status,
      started_at,
      trial_started_at,
      trial_ends_at,
      trial_granted,
      student_limit,
      metadata
    )
    values (
      p_teacher_id,
      'basic',
      'trialing',
      trial_started,
      trial_started,
      trial_ends,
      true,
      1,
      jsonb_build_object('origin', p_origin)
    )
    returning * into created_subscription;

    update public.cpf_trial_registry
    set granted_subscription_id = created_subscription.id
    where cpf_normalized = normalized_cpf;
  else
    insert into public.teacher_subscriptions (
      teacher_id,
      plan_type,
      status,
      access_blocked,
      blocked_reason,
      student_limit,
      metadata
    )
    values (
      p_teacher_id,
      'basic',
      'pending_payment',
      true,
      'Este CPF ja utilizou o periodo de teste gratuito. Para liberar o acesso, e necessario assinar o plano Pro.',
      1,
      jsonb_build_object('origin', p_origin, 'trial_denied_reason', 'cpf_already_used')
    )
    returning * into created_subscription;
  end if;

  return created_subscription;
end;
$$;

create or replace function public.create_teacher_subscription_from_selection(
  p_teacher_id uuid,
  p_cpf text,
  p_selected_plan text,
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
    blocked_reason = null,
    metadata = coalesce(public.teacher_subscriptions.metadata, '{}'::jsonb) || excluded.metadata
  returning * into created_subscription;

  return created_subscription;
end;
$$;

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
  auth_metadata jsonb;
  teacher_record public.teachers%rowtype;
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

  select coalesce(raw_user_meta_data, '{}'::jsonb)
  into auth_metadata
  from auth.users
  where id = auth.uid();

  if lower(coalesce(profile_record.role, '')) <> 'professor' then
    raise exception 'Apenas professores podem provisionar conta docente.' using errcode = '42501';
  end if;

  selected_plan := lower(coalesce(nullif(trim(p_selected_plan), ''), auth_metadata ->> 'selected_plan', 'basic'));
  mock_payment_confirmed := coalesce(p_mock_pro_payment_confirmed, false) or coalesce((auth_metadata ->> 'mock_pro_payment_confirmed')::boolean, false);

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

  perform public.create_teacher_subscription_from_selection(
    teacher_record.id,
    coalesce(profile_record.cpf, auth_metadata ->> 'cpf', ''),
    selected_plan,
    mock_payment_confirmed,
    'rpc:provision_current_teacher_account'
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

create or replace function public.confirm_mock_pro_payment(
  p_teacher_id uuid default null,
  p_current_period_ends_at timestamptz default timezone('utc', now()) + interval '1 month'
)
returns public.teacher_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_teacher_id uuid;
  updated_subscription public.teacher_subscriptions%rowtype;
begin
  if auth.uid() is null and p_teacher_id is null then
    raise exception 'Professor nao informado.' using errcode = '22023';
  end if;

  resolved_teacher_id := coalesce(
    p_teacher_id,
    public.current_teacher_id()
  );

  if resolved_teacher_id is null then
    raise exception 'Professor nao encontrado para a sessao atual.' using errcode = 'P0002';
  end if;

  update public.teacher_subscriptions
  set
    plan_type = 'pro',
    status = 'active',
    access_blocked = false,
    blocked_reason = null,
    billing_provider = 'mock',
    current_period_starts_at = timezone('utc', now()),
    current_period_ends_at = p_current_period_ends_at,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('mock_payment_confirmed', true)
  where teacher_id = resolved_teacher_id
  returning * into updated_subscription;

  if updated_subscription.id is null then
    raise exception 'Assinatura do professor nao encontrada.' using errcode = 'P0002';
  end if;

  return updated_subscription;
end;
$$;

create or replace function public.assert_teacher_can_add_student(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot record;
begin
  select * into snapshot
  from public.get_teacher_access_snapshot(p_teacher_id);

  if snapshot.teacher_id is null or snapshot.has_active_access is not true then
    raise exception '%', coalesce(snapshot.access_message, 'Acesso bloqueado no momento.')
      using errcode = 'P0001';
  end if;

  if snapshot.can_add_student is not true then
    raise exception 'O plano atual nao permite adicionar mais alunos.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.enforce_student_limit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_teacher_can_add_student(new.teacher_id);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.teacher_id is distinct from old.teacher_id then
    perform public.assert_teacher_can_add_student(new.teacher_id);
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_student_limit_trigger on public.students;
create trigger enforce_student_limit_trigger
before insert or update of teacher_id on public.students
for each row execute function public.enforce_student_limit();

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

create or replace function public.sync_student_last_check_in()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.students
  set
    last_check_in_at = new.checked_in_at,
    updated_at = timezone('utc', now())
  where id = new.student_id
    and (last_check_in_at is null or last_check_in_at < new.checked_in_at);

  return new;
end;
$$;

drop trigger if exists sync_student_last_check_in_trigger on public.student_check_ins;
create trigger sync_student_last_check_in_trigger
after insert on public.student_check_ins
for each row execute function public.sync_student_last_check_in();

create or replace function public.touch_student_last_login(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
  updated_student public.students%rowtype;
begin
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

alter table public.teachers enable row level security;
alter table public.teacher_subscriptions enable row level security;
alter table public.cpf_trial_registry enable row level security;
alter table public.students enable row level security;
alter table public.workout_templates enable row level security;
alter table public.student_workout_plans enable row level security;
alter table public.student_check_ins enable row level security;
alter table public.coach_alert_reads enable row level security;

drop policy if exists "teachers_select_own" on public.teachers;
create policy "teachers_select_own"
on public.teachers
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "teachers_insert_own" on public.teachers;
create policy "teachers_insert_own"
on public.teachers
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "teachers_update_own" on public.teachers;
create policy "teachers_update_own"
on public.teachers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "teacher_subscriptions_select_own" on public.teacher_subscriptions;
create policy "teacher_subscriptions_select_own"
on public.teacher_subscriptions
for select
to authenticated
using (teacher_id = public.current_teacher_id());

drop policy if exists "students_manage_own_teacher" on public.students;
create policy "students_manage_own_teacher"
on public.students
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

drop policy if exists "students_select_own_student" on public.students;
create policy "students_select_own_student"
on public.students
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists "workout_templates_manage_own_teacher" on public.workout_templates;
create policy "workout_templates_manage_own_teacher"
on public.workout_templates
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

drop policy if exists "student_workout_plans_manage_own_teacher" on public.student_workout_plans;
create policy "student_workout_plans_manage_own_teacher"
on public.student_workout_plans
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

drop policy if exists "student_workout_plans_select_own_student" on public.student_workout_plans;
create policy "student_workout_plans_select_own_student"
on public.student_workout_plans
for select
to authenticated
using (student_id = public.current_student_id());

drop policy if exists "student_check_ins_select_own_teacher" on public.student_check_ins;
create policy "student_check_ins_select_own_teacher"
on public.student_check_ins
for select
to authenticated
using (teacher_id = public.current_teacher_id());

drop policy if exists "student_check_ins_insert_own_teacher" on public.student_check_ins;
create policy "student_check_ins_insert_own_teacher"
on public.student_check_ins
for insert
to authenticated
with check (teacher_id = public.current_teacher_id());

drop policy if exists "student_check_ins_select_own_student" on public.student_check_ins;
create policy "student_check_ins_select_own_student"
on public.student_check_ins
for select
to authenticated
using (student_id = public.current_student_id());

drop policy if exists "student_check_ins_insert_own_student" on public.student_check_ins;
create policy "student_check_ins_insert_own_student"
on public.student_check_ins
for insert
to authenticated
with check (
  student_id = public.current_student_id()
  and teacher_id = public.current_student_teacher_id()
);

drop policy if exists "coach_alert_reads_manage_own_teacher" on public.coach_alert_reads;
create policy "coach_alert_reads_manage_own_teacher"
on public.coach_alert_reads
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

drop policy if exists "cpf_trial_registry_deny_all" on public.cpf_trial_registry;
create policy "cpf_trial_registry_deny_all"
on public.cpf_trial_registry
for all
to authenticated
using (false)
with check (false);

insert into storage.buckets (id, name, public)
values ('student-profile-photos', 'student-profile-photos', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "student_profile_photos_public_read" on storage.objects;
create policy "student_profile_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'student-profile-photos');

drop policy if exists "student_profile_photos_manage" on storage.objects;
create policy "student_profile_photos_manage"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'student-profile-photos'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and (
        s.teacher_id = public.current_teacher_id()
        or s.auth_user_id = auth.uid()
      )
  )
)
with check (
  bucket_id = 'student-profile-photos'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and (
        s.teacher_id = public.current_teacher_id()
        or s.auth_user_id = auth.uid()
      )
  )
);

drop policy if exists "payment_proofs_manage" on storage.objects;
create policy "payment_proofs_manage"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and (
        s.teacher_id = public.current_teacher_id()
        or s.auth_user_id = auth.uid()
      )
  )
)
with check (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.students s
    where s.id::text = (storage.foldername(name))[1]
      and (
        s.teacher_id = public.current_teacher_id()
        or s.auth_user_id = auth.uid()
      )
  )
);

grant execute on function public.current_teacher_id() to authenticated, service_role;
grant execute on function public.current_student_id() to authenticated, service_role;
grant execute on function public.current_student_teacher_id() to authenticated, service_role;
grant execute on function public.normalize_cpf(text) to authenticated, service_role;
grant execute on function public.is_valid_cpf(text) to authenticated, service_role;
grant execute on function public.get_teacher_access_snapshot(uuid) to authenticated, service_role;
grant execute on function public.teacher_has_active_access(uuid) to authenticated, service_role;
grant execute on function public.teacher_can_add_student(uuid) to authenticated, service_role;
grant execute on function public.provision_current_teacher_account(text, boolean) to authenticated, service_role;
grant execute on function public.confirm_mock_pro_payment(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.assert_teacher_can_add_student(uuid) to authenticated, service_role;
grant execute on function public.ensure_student_workout_plan(uuid, uuid, date, date) to authenticated, service_role;
grant execute on function public.student_workout_access_blocked(uuid) to authenticated, service_role;
grant execute on function public.assert_student_can_check_in(uuid, uuid, date) to authenticated, service_role;
grant execute on function public.touch_student_last_login(uuid) to authenticated, service_role;
grant execute on function public.mark_student_first_access_complete(uuid) to authenticated, service_role;
grant execute on function public.submit_student_payment_proof(uuid, text, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.update_student_exercise_load(uuid, text, text, text) to authenticated, service_role;
