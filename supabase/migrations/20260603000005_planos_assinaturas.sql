-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela: planos (planos de consultoria que o aluno contrata)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.planos (
  id           uuid         primary key default gen_random_uuid(),
  slug         text         not null unique,
  nome         text         not null,
  descricao    text         not null,
  preco        numeric(10,2) not null check (preco >= 0),
  periodo_dias integer      not null default 30 check (periodo_dias > 0),
  features     jsonb        not null default '[]'::jsonb,
  destaque     boolean      not null default false,
  ativo        boolean      not null default true,
  ordem        integer      not null default 0,
  created_at   timestamptz  not null default timezone('utc', now()),
  updated_at   timestamptz  not null default timezone('utc', now())
);

create trigger planos_set_updated_at
  before update on public.planos
  for each row execute function public.set_updated_at();

alter table public.planos enable row level security;

create policy "anyone_can_view_active_planos"
  on public.planos for select
  to anon, authenticated
  using (ativo = true);

create policy "devadmin_can_manage_planos"
  on public.planos for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.platform_role = 'dev_admin'
    )
  );

-- Seed inicial — preços configuráveis diretamente no banco
insert into public.planos (slug, nome, descricao, preco, periodo_dias, destaque, ordem, features) values
(
  'basic', 'Basic',
  '1 treino por mês + check-in quinzenal',
  97.00, 30, false, 1,
  '["1 treino personalizado por mês","Check-in quinzenal com o personal","Acesso ao app Sano+","Suporte via e-mail"]'::jsonb
),
(
  'pro', 'Pro',
  'Treinos ilimitados + check-in semanal + chat',
  197.00, 30, true, 2,
  '["Treinos ilimitados e sempre atualizados","Check-in semanal com o personal","Chat direto com o personal","Acesso ao app Sano+","Suporte prioritário"]'::jsonb
),
(
  'premium', 'Premium',
  'Tudo do Pro + ajuste de treino a qualquer momento + prioridade de resposta',
  297.00, 30, false, 3,
  '["Tudo do plano Pro","Ajuste de treino a qualquer momento","Prioridade máxima de resposta","Consultoria nutricional básica","Relatório mensal de evolução"]'::jsonb
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela: assinaturas (pagamentos de alunos via Mercado Pago)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.assinaturas (
  id                           uuid         primary key default gen_random_uuid(),

  -- Relações
  aluno_id                     uuid         references public.students(id)   on delete set null,
  anamnese_id                  uuid         references public.anamneses(id)  on delete set null,
  plano_id                     uuid         not null references public.planos(id) on delete restrict,
  teacher_id                   uuid         references public.teachers(id)   on delete set null,

  -- Status
  status                       text         not null default 'pendente'
    check (status in ('pendente','ativo','cancelado','reembolsado','expirado','recusado')),

  -- Mercado Pago
  mp_payment_id                text         unique,
  mp_preference_id             text,
  mp_external_reference        text,
  metodo_pagamento             text,

  -- Financeiro
  valor_cobrado                numeric(10,2),
  moeda                        text         not null default 'BRL',

  -- Datas
  data_inicio                  date,
  data_renovacao               date,
  data_cancelamento            timestamptz,
  aviso_vencimento_enviado_at  timestamptz,

  -- Payload bruto do MP (para auditoria)
  mp_raw_payment               jsonb,

  notas                        text,
  created_at                   timestamptz  not null default timezone('utc', now()),
  updated_at                   timestamptz  not null default timezone('utc', now())
);

create trigger assinaturas_set_updated_at
  before update on public.assinaturas
  for each row execute function public.set_updated_at();

create index if not exists assinaturas_aluno_id_idx       on public.assinaturas(aluno_id);
create index if not exists assinaturas_anamnese_id_idx    on public.assinaturas(anamnese_id);
create index if not exists assinaturas_mp_payment_id_idx  on public.assinaturas(mp_payment_id);
create index if not exists assinaturas_status_idx         on public.assinaturas(status);
create index if not exists assinaturas_data_renovacao_idx on public.assinaturas(data_renovacao);
create index if not exists assinaturas_teacher_id_idx     on public.assinaturas(teacher_id);

alter table public.assinaturas enable row level security;

-- Professores veem assinaturas dos seus alunos
create policy "coach_can_view_assinaturas"
  on public.assinaturas for select
  to authenticated
  using (
    teacher_id in (select id from public.teachers where user_id = auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.platform_role = 'dev_admin'
    )
  );

-- Professores podem atualizar (cancelar, rativar)
create policy "coach_can_update_assinaturas"
  on public.assinaturas for update
  to authenticated
  using (
    teacher_id in (select id from public.teachers where user_id = auth.uid())
  );
-- Inserts via service role (webhook) — sem policy pública de insert
