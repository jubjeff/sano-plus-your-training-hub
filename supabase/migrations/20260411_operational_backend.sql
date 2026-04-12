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

create trigger set_workout_templates_updated_at
before update on public.workout_templates
for each row execute function public.set_updated_at();

alter table public.students
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists goal text not null default '',
  add column if not exists profile_photo_storage_key text,
  add column if not exists profile_photo_url text,
  add column if not exists access_status text not null default 'pre_registered',
  add column if not exists temporary_password_generated_at timestamptz,
  add column if not exists first_access_completed_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_check_in_at timestamptz,
  add column if not exists payment_due_date date,
  add column if not exists payment_last_paid_at date,
  add column if not exists proof_of_payment_status text not null default 'not_sent',
  add column if not exists proof_of_payment_storage_key text,
  add column if not exists proof_of_payment_file_url text,
  add column if not exists proof_of_payment_file_name text,
  add column if not exists proof_of_payment_mime_type text,
  add column if not exists proof_of_payment_sent_at timestamptz,
  add column if not exists start_date date not null default current_date,
  add column if not exists workout_updated_at date,
  add column if not exists next_workout_change date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_access_status_chk'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_access_status_chk check (access_status in ('pre_registered', 'temporary_password_pending', 'active', 'inactive'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_proof_of_payment_status_chk'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_proof_of_payment_status_chk check (proof_of_payment_status in ('not_sent', 'submitted', 'approved'));
  end if;
end $$;

create index if not exists students_auth_user_id_idx on public.students (auth_user_id);
create index if not exists students_access_status_idx on public.students (teacher_id, access_status);

create table if not exists public.student_workout_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  student_id uuid not null unique references public.students (id) on delete cascade,
  training_structure_type text not null default 'weekly',
  training_progress_mode text not null default 'fixed_schedule',
  plan_name text not null default 'Plano principal',
  is_active boolean not null default true,
  start_date date not null,
  end_date date,
  next_workout_change_date date,
  current_suggested_block_id text,
  last_completed_block_id text,
  last_completed_at timestamptz,
  weekly_goal integer not null default 4,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint student_workout_plans_training_structure_chk check (training_structure_type in ('weekly', 'abcde')),
  constraint student_workout_plans_training_progress_chk check (training_progress_mode in ('fixed_schedule', 'sequential_progression')),
  constraint student_workout_plans_weekly_goal_chk check (weekly_goal between 1 and 7),
  constraint student_workout_plans_blocks_array_chk check (jsonb_typeof(blocks) = 'array')
);

create index if not exists student_workout_plans_teacher_idx
  on public.student_workout_plans (teacher_id, updated_at desc);

create trigger set_student_workout_plans_updated_at
before update on public.student_workout_plans
for each row execute function public.set_updated_at();

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
  source text not null default 'student',
  duration_minutes integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint student_check_ins_source_chk check (source in ('student', 'coach')),
  constraint student_check_ins_duration_chk check (duration_minutes is null or duration_minutes >= 0)
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

create trigger set_coach_alert_reads_updated_at
before update on public.coach_alert_reads
for each row execute function public.set_updated_at();

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
begin
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

alter table public.workout_templates enable row level security;
alter table public.student_workout_plans enable row level security;
alter table public.student_check_ins enable row level security;
alter table public.coach_alert_reads enable row level security;

create policy "students_select_own_student"
on public.students
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "workout_templates_manage_own_teacher"
on public.workout_templates
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

create policy "student_workout_plans_manage_own_teacher"
on public.student_workout_plans
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

create policy "student_workout_plans_select_own_student"
on public.student_workout_plans
for select
to authenticated
using (student_id = public.current_student_id());

create policy "student_check_ins_select_own_teacher"
on public.student_check_ins
for select
to authenticated
using (teacher_id = public.current_teacher_id());

create policy "student_check_ins_insert_own_teacher"
on public.student_check_ins
for insert
to authenticated
with check (teacher_id = public.current_teacher_id());

create policy "student_check_ins_select_own_student"
on public.student_check_ins
for select
to authenticated
using (student_id = public.current_student_id());

create policy "student_check_ins_insert_own_student"
on public.student_check_ins
for insert
to authenticated
with check (student_id = public.current_student_id() and teacher_id = public.current_student_teacher_id());

create policy "coach_alert_reads_manage_own_teacher"
on public.coach_alert_reads
for all
to authenticated
using (teacher_id = public.current_teacher_id())
with check (teacher_id = public.current_teacher_id());

grant execute on function public.current_student_id() to authenticated, service_role;
grant execute on function public.current_student_teacher_id() to authenticated, service_role;
grant execute on function public.student_workout_access_blocked(uuid) to authenticated, service_role;
grant execute on function public.assert_student_can_check_in(uuid, uuid, date) to authenticated, service_role;
grant execute on function public.touch_student_last_login(uuid) to authenticated, service_role;
grant execute on function public.mark_student_first_access_complete(uuid) to authenticated, service_role;
grant execute on function public.ensure_student_workout_plan(uuid, uuid, date, date) to authenticated, service_role;
