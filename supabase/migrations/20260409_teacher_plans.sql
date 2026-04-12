create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.plan_type as enum ('basic', 'pro');
create type public.subscription_status as enum ('trialing', 'active', 'expired', 'blocked', 'pending_payment', 'canceled');
create type public.access_request_status as enum ('open', 'processing', 'approved', 'rejected', 'canceled');
create type public.payment_event_type as enum ('upgrade_request', 'invoice', 'payment_confirmation', 'manual_activation', 'cancellation');
create type public.payment_event_status as enum ('pending', 'confirmed', 'failed', 'refunded');
create type public.subscription_history_event as enum (
  'subscription_created',
  'trial_granted',
  'trial_denied',
  'upgrade_requested',
  'pro_activated',
  'subscription_expired',
  'subscription_blocked',
  'subscription_canceled',
  'plan_changed',
  'status_changed'
);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  full_name text not null,
  birth_date date not null,
  cpf text not null,
  cpf_normalized text not null,
  phone text,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_full_name_length_chk check (char_length(trim(full_name)) >= 3),
  constraint profiles_cpf_digits_chk check (cpf_normalized ~ '^\d{11}$'),
  constraint profiles_cpf_normalized_chk check (public.normalize_cpf(cpf) = cpf_normalized),
  constraint profiles_valid_cpf_chk check (public.is_valid_cpf(cpf_normalized)),
  constraint profiles_phone_digits_chk check (phone is null or regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$')
);

comment on table public.profiles is 'Perfil principal da conta autenticada via Supabase Auth.';
comment on column public.profiles.cpf_normalized is 'CPF normalizado para comparacoes e elegibilidade de trial.';

create unique index if not exists profiles_email_key on public.profiles (email);
create index if not exists profiles_cpf_normalized_idx on public.profiles (cpf_normalized);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (user_id) on delete cascade,
  onboarding_completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.teachers is 'Representa professores do Sano+ vinculados a uma conta do Auth.';

create table if not exists public.teacher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.teachers (id) on delete cascade,
  plan_type public.plan_type not null,
  status public.subscription_status not null,
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

comment on table public.teacher_subscriptions is 'Assinatura/plano corrente de cada professor.';
comment on column public.teacher_subscriptions.student_limit is '1 para Basic e NULL para ilimitado.';

create unique index if not exists teacher_subscriptions_external_subscription_id_key
  on public.teacher_subscriptions (external_subscription_id)
  where external_subscription_id is not null;
create index if not exists teacher_subscriptions_plan_status_idx
  on public.teacher_subscriptions (plan_type, status);

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

comment on table public.cpf_trial_registry is 'Fonte permanente de verdade para o uso unico do trial por CPF.';

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  full_name text not null,
  email citext,
  phone text,
  birth_date date,
  status text not null default 'active',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint students_full_name_length_chk check (char_length(trim(full_name)) >= 3),
  constraint students_phone_digits_chk check (phone is null or regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$'),
  constraint students_status_chk check (status in ('active', 'inactive'))
);

comment on table public.students is 'Biblioteca de alunos de cada professor.';

create unique index if not exists students_teacher_email_key
  on public.students (teacher_id, email)
  where email is not null;
create index if not exists students_teacher_id_idx on public.students (teacher_id);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  request_type text not null,
  requested_plan_type public.plan_type not null,
  status public.access_request_status not null default 'open',
  message text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint access_requests_type_chk check (request_type in ('upgrade_to_pro'))
);

comment on table public.access_requests is 'Pedidos de upgrade e outros acessos especiais do professor.';

create index if not exists access_requests_teacher_status_idx
  on public.access_requests (teacher_id, status, requested_plan_type);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subscription_id uuid references public.teacher_subscriptions (id) on delete set null,
  access_request_id uuid references public.access_requests (id) on delete set null,
  event_type public.payment_event_type not null,
  status public.payment_event_status not null,
  provider text,
  provider_reference text,
  amount_cents integer,
  currency text not null default 'BRL',
  paid_at timestamptz,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_events_amount_chk check (amount_cents is null or amount_cents >= 0),
  constraint payment_events_currency_chk check (char_length(currency) = 3)
);

comment on table public.payment_events is 'Eventos de cobranca e conciliacao do plano Pro.';

create index if not exists payment_events_teacher_created_idx
  on public.payment_events (teacher_id, created_at desc);
create unique index if not exists payment_events_provider_reference_key
  on public.payment_events (provider, provider_reference)
  where provider_reference is not null;

create table if not exists public.subscription_history (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subscription_id uuid references public.teacher_subscriptions (id) on delete set null,
  event_type public.subscription_history_event not null,
  old_plan_type public.plan_type,
  new_plan_type public.plan_type,
  old_status public.subscription_status,
  new_status public.subscription_status,
  effective_at timestamptz not null default timezone('utc', now()),
  actor_user_id uuid references auth.users (id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.subscription_history is 'Auditoria completa de mudancas de plano e status.';

create index if not exists subscription_history_teacher_effective_idx
  on public.subscription_history (teacher_id, effective_at desc);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

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

create trigger set_access_requests_updated_at
before update on public.access_requests
for each row execute function public.set_updated_at();

create trigger set_payment_events_updated_at
before update on public.payment_events
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

create or replace function public.can_cpf_receive_trial(cpf text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_cpf(cpf);
begin
  if not public.is_valid_cpf(normalized) then
    raise exception 'CPF invalido.' using errcode = '22023';
  end if;

  return not exists (
    select 1
    from public.cpf_trial_registry ctr
    where ctr.cpf_normalized = normalized
  );
end;
$$;

create or replace function public.get_teacher_current_subscription(teacher_uuid uuid)
returns table (
  subscription_id uuid,
  teacher_id uuid,
  plan_type public.plan_type,
  status public.subscription_status,
  access_blocked boolean,
  billing_provider text,
  external_subscription_id text,
  started_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_granted boolean,
  canceled_at timestamptz,
  blocked_reason text,
  student_limit integer,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ts.id,
    ts.teacher_id,
    ts.plan_type,
    ts.status,
    ts.access_blocked,
    ts.billing_provider,
    ts.external_subscription_id,
    ts.started_at,
    ts.current_period_starts_at,
    ts.current_period_ends_at,
    ts.trial_started_at,
    ts.trial_ends_at,
    ts.trial_granted,
    ts.canceled_at,
    ts.blocked_reason,
    ts.student_limit,
    ts.metadata,
    ts.created_at,
    ts.updated_at
  from public.teacher_subscriptions ts
  where ts.teacher_id = teacher_uuid;
$$;

create or replace function public.get_teacher_access_snapshot(teacher_uuid uuid)
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
stable
security definer
set search_path = public
as $$
declare
  subscription_record public.teacher_subscriptions%rowtype;
  student_count bigint := 0;
  effective public.subscription_status;
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
      'basic'::public.plan_type,
      'blocked'::public.subscription_status,
      'blocked'::public.subscription_status,
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
    message := format(
      'Seu trial Basic esta ativo ate %s.',
      to_char(subscription_record.trial_ends_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );
  elsif effective = 'expired' then
    message := 'Seu periodo de teste expirou. Faca upgrade para o plano Pro para continuar.';
  elsif effective = 'pending_payment' then
    message := 'Este CPF ja utilizou o periodo de teste gratuito. Para liberar o acesso, e necessario assinar o plano Pro.';
  elsif effective = 'blocked' and subscription_record.blocked_reason is not null then
    message := subscription_record.blocked_reason;
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

create or replace function public.log_subscription_history(
  p_teacher_id uuid,
  p_subscription_id uuid,
  p_event_type public.subscription_history_event,
  p_old_plan_type public.plan_type,
  p_new_plan_type public.plan_type,
  p_old_status public.subscription_status,
  p_new_status public.subscription_status,
  p_actor_user_id uuid default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.subscription_history (
    teacher_id,
    subscription_id,
    event_type,
    old_plan_type,
    new_plan_type,
    old_status,
    new_status,
    actor_user_id,
    notes,
    metadata
  )
  values (
    p_teacher_id,
    p_subscription_id,
    p_event_type,
    p_old_plan_type,
    p_new_plan_type,
    p_old_status,
    p_new_status,
    p_actor_user_id,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

create or replace function public.apply_subscription_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.plan_type = 'basic' then
    new.student_limit := 1;
  elsif new.plan_type = 'pro' then
    new.student_limit := null;
  end if;

  if new.status = 'blocked' then
    new.access_blocked := true;
  elsif new.status = 'active' then
    new.access_blocked := false;
  elsif new.status = 'trialing' then
    new.access_blocked := false;
  end if;

  return new;
end;
$$;

create trigger apply_subscription_defaults_trigger
before insert or update on public.teacher_subscriptions
for each row execute function public.apply_subscription_defaults();

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

  select *
  into teacher_record
  from public.teachers
  where id = p_teacher_id;

  if teacher_record.id is null then
    raise exception 'Professor nao encontrado.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_cpf, 0));

  select *
  into existing_subscription
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

    perform public.log_subscription_history(
      p_teacher_id,
      created_subscription.id,
      'trial_granted',
      null,
      created_subscription.plan_type,
      null,
      created_subscription.status,
      teacher_record.user_id,
      'Trial gratuito concedido.',
      jsonb_build_object('origin', p_origin)
    );
  else
    insert into public.teacher_subscriptions (
      teacher_id,
      plan_type,
      status,
      started_at,
      access_blocked,
      blocked_reason,
      student_limit,
      metadata
    )
    values (
      p_teacher_id,
      'basic',
      'pending_payment',
      timezone('utc', now()),
      true,
      'Este CPF ja utilizou o periodo de teste gratuito. Para liberar o acesso, e necessario assinar o plano Pro.',
      1,
      jsonb_build_object('origin', p_origin, 'trial_denied_reason', 'cpf_already_used')
    )
    returning * into created_subscription;

    perform public.log_subscription_history(
      p_teacher_id,
      created_subscription.id,
      'trial_denied',
      null,
      created_subscription.plan_type,
      null,
      created_subscription.status,
      teacher_record.user_id,
      'Conta criada sem trial por CPF ja utilizado.',
      jsonb_build_object('origin', p_origin)
    );
  end if;

  perform public.log_subscription_history(
    p_teacher_id,
    created_subscription.id,
    'subscription_created',
    null,
    created_subscription.plan_type,
    null,
    created_subscription.status,
    teacher_record.user_id,
    'Assinatura inicial provisionada.',
    jsonb_build_object('origin', p_origin)
  );

  return created_subscription;
end;
$$;

create or replace function public.activate_pro_plan(
  p_teacher_id uuid,
  p_current_period_ends_at timestamptz,
  p_provider text default 'manual',
  p_external_subscription_id text default null,
  p_actor_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.teacher_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_record public.teacher_subscriptions%rowtype;
  previous_plan public.plan_type;
  previous_status public.subscription_status;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 0));

  select *
  into subscription_record
  from public.teacher_subscriptions
  where teacher_id = p_teacher_id
  for update;

  if subscription_record.id is null then
    raise exception 'Assinatura do professor nao encontrada.' using errcode = 'P0002';
  end if;

  previous_plan := subscription_record.plan_type;
  previous_status := subscription_record.status;

  update public.teacher_subscriptions
  set
    plan_type = 'pro',
    status = 'active',
    access_blocked = false,
    blocked_reason = null,
    billing_provider = coalesce(p_provider, billing_provider),
    external_subscription_id = coalesce(p_external_subscription_id, external_subscription_id),
    current_period_starts_at = timezone('utc', now()),
    current_period_ends_at = p_current_period_ends_at,
    started_at = coalesce(started_at, timezone('utc', now())),
    canceled_at = null,
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where teacher_id = p_teacher_id
  returning * into subscription_record;

  perform public.log_subscription_history(
    p_teacher_id,
    subscription_record.id,
    'pro_activated',
    previous_plan,
    subscription_record.plan_type,
    previous_status,
    subscription_record.status,
    p_actor_user_id,
    'Plano Pro ativado.',
    coalesce(p_metadata, '{}'::jsonb)
  );

  if previous_plan is distinct from subscription_record.plan_type then
    perform public.log_subscription_history(
      p_teacher_id,
      subscription_record.id,
      'plan_changed',
      previous_plan,
      subscription_record.plan_type,
      previous_status,
      subscription_record.status,
      p_actor_user_id,
      'Mudanca de plano registrada.',
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  if previous_status is distinct from subscription_record.status then
    perform public.log_subscription_history(
      p_teacher_id,
      subscription_record.id,
      'status_changed',
      previous_plan,
      subscription_record.plan_type,
      previous_status,
      subscription_record.status,
      p_actor_user_id,
      'Mudanca de status registrada.',
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  return subscription_record;
end;
$$;

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
  subscription_record public.teacher_subscriptions%rowtype;
  actor_user_id uuid;
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

create or replace function public.assert_teacher_can_add_student(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 0));

  select *
  into snapshot
  from public.get_teacher_access_snapshot(p_teacher_id);

  if snapshot.teacher_id is null or snapshot.has_active_access is not true then
    raise exception '%', coalesce(snapshot.access_message, 'Acesso bloqueado no momento.')
      using errcode = 'P0001';
  end if;

  if snapshot.can_add_student is not true then
    raise exception 'O plano Basic permite apenas 1 aluno. Faca upgrade para o Pro para adicionar alunos ilimitados.'
      using errcode = 'P0001';
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

create trigger enforce_student_limit_trigger
before insert or update of teacher_id on public.students
for each row execute function public.enforce_student_limit();

create or replace function public.provision_teacher_account(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_birth_date date,
  p_cpf text,
  p_phone text default null,
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
    coalesce(p_metadata, '{}'::jsonb)
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
  values (p_user_id, true, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id) do update
  set
    onboarding_completed = true,
    metadata = public.teachers.metadata || excluded.metadata
  returning * into teacher_record;

  perform public.create_initial_teacher_plan(teacher_record.id, normalized_cpf, 'edge_function:create-teacher-account');

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

alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.teacher_subscriptions enable row level security;
alter table public.cpf_trial_registry enable row level security;
alter table public.access_requests enable row level security;
alter table public.payment_events enable row level security;
alter table public.subscription_history enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "teachers_select_own"
on public.teachers
for select
to authenticated
using (user_id = auth.uid());

create policy "teachers_update_own"
on public.teachers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "students_manage_own_teacher"
on public.students
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

create policy "teacher_subscriptions_select_own"
on public.teacher_subscriptions
for select
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "access_requests_select_own"
on public.access_requests
for select
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "access_requests_insert_own"
on public.access_requests
for insert
to authenticated
with check (teacher_id = public.current_teacher_id());

create policy "payment_events_select_own"
on public.payment_events
for select
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "subscription_history_select_own"
on public.subscription_history
for select
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "cpf_trial_registry_deny_all"
on public.cpf_trial_registry
for all
to authenticated
using (false)
with check (false);

grant execute on function public.normalize_cpf(text) to anon, authenticated, service_role;
grant execute on function public.is_valid_cpf(text) to anon, authenticated, service_role;
grant execute on function public.can_cpf_receive_trial(text) to authenticated, service_role;
grant execute on function public.get_teacher_current_subscription(uuid) to authenticated, service_role;
grant execute on function public.get_teacher_access_snapshot(uuid) to authenticated, service_role;
grant execute on function public.teacher_has_active_access(uuid) to authenticated, service_role;
grant execute on function public.teacher_can_add_student(uuid) to authenticated, service_role;
grant execute on function public.request_pro_upgrade(uuid, text, integer, text, jsonb) to authenticated, service_role;
grant execute on function public.create_initial_teacher_plan(uuid, text, text) to service_role;
grant execute on function public.activate_pro_plan(uuid, timestamptz, text, text, uuid, jsonb) to service_role;
grant execute on function public.provision_teacher_account(uuid, text, text, date, text, text, jsonb) to service_role;
