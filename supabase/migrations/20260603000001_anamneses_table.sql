-- Tabela de anamneses (formulário público de captação de novos alunos)
create table if not exists public.anamneses (
  id uuid primary key default gen_random_uuid(),

  -- Identificação
  full_name text not null,
  email     text not null,
  phone     text not null,

  -- Dados físicos
  age       integer not null check (age >= 10 and age <= 100),
  weight_kg numeric(5,1) not null check (weight_kg > 0 and weight_kg < 500),

  -- Objetivo e nível
  goal             text not null check (goal in ('hipertrofia','emagrecimento','condicionamento','recomposicao')),
  experience_level text not null check (experience_level in ('iniciante','intermediario','avancado')),

  -- Agenda
  available_days_per_week integer not null check (available_days_per_week between 1 and 7),
  session_duration        text    not null check (session_duration in ('30min','45min','60min','90min')),
  preferred_time          text    not null check (preferred_time in ('manha','tarde','noite')),

  -- Contexto físico e histórico
  available_equipment     text[]  not null default '{}',
  injury_history          text    not null default 'nenhuma',
  has_trained_before      boolean not null default false,
  stopped_training_duration text,

  -- Fluxo e status
  status       text not null default 'pending_review'
               check (status in ('pending_review','workout_generated','active')),
  student_id   uuid references public.students(id)  on delete set null,
  notes        text,
  reviewed_at  timestamptz,

  submitted_at timestamptz not null default timezone('utc', now()),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

-- Trigger de updated_at
create trigger anamneses_set_updated_at
  before update on public.anamneses
  for each row execute function public.set_updated_at();

-- RLS
alter table public.anamneses enable row level security;

-- Qualquer pessoa (anon ou autenticado) pode inserir
create policy "anon_can_insert_anamnesis"
  on public.anamneses for insert
  to anon, authenticated
  with check (true);

-- Apenas professores autenticados podem ler
create policy "coach_can_view_anamneses"
  on public.anamneses for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
  );

-- Apenas professores autenticados podem atualizar (trocar status, linkar aluno)
create policy "coach_can_update_anamnesis"
  on public.anamneses for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
  );
