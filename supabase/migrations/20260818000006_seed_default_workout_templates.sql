-- Treinos default para professores.
--
-- workout_templates.teacher_id e NOT NULL e nao existe conceito de template
-- global no schema, entao "default" aqui significa: todo professor nasce com uma
-- copia propria e editavel destes modelos. Nao sao compartilhados nem
-- somente-leitura — o professor ajusta ou apaga a vontade.
--
-- Os blocos sao montados a partir do catalogo real (public.exercises, por slug),
-- e nao com nomes digitados a mao: assim libraryExerciseId aponta para a linha
-- certa e o app re-hidrata os metadados via resolveExerciseFromLibrary.
--
-- Idempotente: cada template so e inserido se o professor ainda nao tiver um com
-- o mesmo nome.

-- ── Helper: monta o array de exercicios de um bloco ───────────────────────────
-- Recebe [{"slug": "...", "sets": 3, "reps": "10-12", "rest": "60s"}, ...] e
-- devolve o array no formato que o frontend espera (ver
-- createExerciseAssignmentFromLibrary em src/lib/exercise-utils.ts).
-- Slug inexistente e ignorado pelo join, entao um erro de digitacao nao derruba
-- a migration — apenas deixa o bloco menor.
create or replace function public.build_default_block_exercises(p_items jsonb)
returns jsonb
language sql
stable
set search_path = public
as $fn$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                    gen_random_uuid(),
        'libraryExerciseId',     e.id,
        'name',                  e.name,
        'slug',                  e.slug,
        'category',              e.category,
        'sets',                  coalesce((item->>'sets')::int, 3),
        'reps',                  coalesce(item->>'reps', '10-12'),
        'load',                  '',
        'studentLoad',           null,
        'rest',                  coalesce(item->>'rest', '60s'),
        'notes',                 '',
        'bodyRegion',            e.body_region,
        'movementType',          e.movement_type,
        'difficultyLevel',       e.difficulty_level,
        'exerciseType',          e.exercise_type,
        'equipment',             e.equipment,
        'muscleCategory',        e.muscle_category,
        'muscleGroupPrimary',    e.muscle_group_primary,
        'muscleGroupsSecondary', to_jsonb(coalesce(e.muscle_groups_secondary, array[]::text[])),
        'videoUrl',              e.video_url,
        'thumbnailUrl',          e.thumbnail_url
      )
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  join public.exercises e on e.slug = item->>'slug' and e.is_active;
$fn$;

-- ── Helper: monta um bloco ────────────────────────────────────────────────────
create or replace function public.build_default_block(
  p_letter text,
  p_name text,
  p_order integer,
  p_duration integer,
  p_items jsonb
)
returns jsonb
language sql
stable
set search_path = public
as $fn$
  select jsonb_build_object(
    'id',                gen_random_uuid(),
    'name',              p_name,
    'blockType',         'standard',
    'blockLabel',        p_letter,
    'letterLabel',       p_letter,
    'dayOfWeek',         null,
    'orderIndex',        p_order,
    'isRestDay',         false,
    'notes',             '',
    'estimatedDuration', p_duration,
    'exercises',         public.build_default_block_exercises(p_items)
  );
$fn$;

-- ── Seeder ────────────────────────────────────────────────────────────────────
create or replace function public.seed_default_workout_templates(p_teacher_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inserted integer := 0;
begin
  if p_teacher_id is null then
    return 0;
  end if;

  -- 1. Full Body 3x — Iniciante
  if not exists (
    select 1 from public.workout_templates wt
    where wt.teacher_id = p_teacher_id and wt.name = 'Full Body 3x - Iniciante'
  ) then
    insert into public.workout_templates (teacher_id, name, objective, notes, blocks)
    values (
      p_teacher_id,
      'Full Body 3x - Iniciante',
      'Adaptacao neuromuscular, tecnica e condicionamento geral',
      'Tres sessoes de corpo inteiro em dias alternados. Foco em aprender o movimento antes de aumentar carga.',
      jsonb_build_array(
        public.build_default_block('A', 'Treino A - Corpo inteiro', 0, 50, '[
          {"slug":"agachamento-livre","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"supino-reto","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"puxada-frontal","sets":3,"reps":"10-12","rest":"75s"},
          {"slug":"desenvolvimento-com-halteres","sets":3,"reps":"12","rest":"60s"},
          {"slug":"prancha","sets":3,"reps":"30s","rest":"45s"}
        ]'::jsonb),
        public.build_default_block('B', 'Treino B - Corpo inteiro', 1, 50, '[
          {"slug":"leg-press","sets":3,"reps":"12-15","rest":"90s"},
          {"slug":"supino-inclinado-com-halteres","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"remada-baixa","sets":3,"reps":"10-12","rest":"75s"},
          {"slug":"elevacao-lateral","sets":3,"reps":"12-15","rest":"45s"},
          {"slug":"abdominal-reto","sets":3,"reps":"15","rest":"45s"}
        ]'::jsonb),
        public.build_default_block('C', 'Treino C - Corpo inteiro', 2, 50, '[
          {"slug":"passada","sets":3,"reps":"10 por perna","rest":"90s"},
          {"slug":"crucifixo-reto","sets":3,"reps":"12","rest":"60s"},
          {"slug":"remada-unilateral","sets":3,"reps":"10-12","rest":"75s"},
          {"slug":"rosca-direta","sets":3,"reps":"12","rest":"45s"},
          {"slug":"triceps-corda","sets":3,"reps":"12","rest":"45s"}
        ]'::jsonb)
      )
    );
    v_inserted := v_inserted + 1;
  end if;

  -- 2. ABC Hipertrofia — Intermediario
  if not exists (
    select 1 from public.workout_templates wt
    where wt.teacher_id = p_teacher_id and wt.name = 'ABC Hipertrofia - Intermediario'
  ) then
    insert into public.workout_templates (teacher_id, name, objective, notes, blocks)
    values (
      p_teacher_id,
      'ABC Hipertrofia - Intermediario',
      'Hipertrofia com divisao por grupamento muscular',
      'Divisao classica ABC. Rodar 2x por semana (6 sessoes) ou 1x (3 sessoes), conforme a disponibilidade do aluno.',
      jsonb_build_array(
        public.build_default_block('A', 'A - Peito, ombro e triceps', 0, 65, '[
          {"slug":"supino-reto-com-barra","sets":4,"reps":"8-10","rest":"120s"},
          {"slug":"supino-inclinado-com-halteres","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"crossover","sets":3,"reps":"12-15","rest":"60s"},
          {"slug":"desenvolvimento-militar","sets":3,"reps":"8-10","rest":"90s"},
          {"slug":"elevacao-lateral","sets":4,"reps":"12-15","rest":"45s"},
          {"slug":"triceps-testa","sets":3,"reps":"10-12","rest":"60s"},
          {"slug":"triceps-corda","sets":3,"reps":"12-15","rest":"45s"}
        ]'::jsonb),
        public.build_default_block('B', 'B - Costas e biceps', 1, 65, '[
          {"slug":"barra-fixa","sets":4,"reps":"6-10","rest":"120s"},
          {"slug":"remada-curvada-com-barra","sets":4,"reps":"8-10","rest":"120s"},
          {"slug":"puxada-frontal-na-polia","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"remada-unilateral","sets":3,"reps":"10-12","rest":"75s"},
          {"slug":"face-pull","sets":3,"reps":"15","rest":"45s"},
          {"slug":"rosca-direta-com-barra","sets":3,"reps":"10-12","rest":"60s"},
          {"slug":"rosca-martelo","sets":3,"reps":"12","rest":"45s"}
        ]'::jsonb),
        public.build_default_block('C', 'C - Pernas e gluteos', 2, 70, '[
          {"slug":"agachamento-livre","sets":4,"reps":"8-10","rest":"150s"},
          {"slug":"leg-press-45","sets":4,"reps":"10-12","rest":"120s"},
          {"slug":"terra-romeno","sets":3,"reps":"10-12","rest":"120s"},
          {"slug":"cadeira-extensora","sets":3,"reps":"12-15","rest":"60s"},
          {"slug":"mesa-flexora","sets":3,"reps":"12-15","rest":"60s"},
          {"slug":"hip-thrust-com-barra","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"panturrilha-em-pe","sets":4,"reps":"15-20","rest":"45s"}
        ]'::jsonb)
      )
    );
    v_inserted := v_inserted + 1;
  end if;

  -- 3. Upper/Lower 4x — Intermediario
  if not exists (
    select 1 from public.workout_templates wt
    where wt.teacher_id = p_teacher_id and wt.name = 'Upper/Lower 4x - Intermediario'
  ) then
    insert into public.workout_templates (teacher_id, name, objective, notes, blocks)
    values (
      p_teacher_id,
      'Upper/Lower 4x - Intermediario',
      'Forca e hipertrofia com frequencia 2x por grupamento',
      'Quatro sessoes semanais alternando superior e inferior. Bom custo-beneficio para quem treina 4 dias.',
      jsonb_build_array(
        public.build_default_block('A', 'Superior A - Forca', 0, 60, '[
          {"slug":"supino-reto-com-barra","sets":4,"reps":"6-8","rest":"150s"},
          {"slug":"remada-curvada-com-barra","sets":4,"reps":"6-8","rest":"150s"},
          {"slug":"desenvolvimento-militar","sets":3,"reps":"8-10","rest":"90s"},
          {"slug":"puxada-frontal-na-polia","sets":3,"reps":"10-12","rest":"90s"},
          {"slug":"rosca-direta-com-barra","sets":3,"reps":"10","rest":"60s"},
          {"slug":"triceps-testa","sets":3,"reps":"10","rest":"60s"}
        ]'::jsonb),
        public.build_default_block('B', 'Inferior A - Forca', 1, 60, '[
          {"slug":"agachamento-livre","sets":4,"reps":"6-8","rest":"180s"},
          {"slug":"terra-romeno","sets":4,"reps":"8-10","rest":"120s"},
          {"slug":"leg-press-45","sets":3,"reps":"10-12","rest":"120s"},
          {"slug":"mesa-flexora","sets":3,"reps":"12","rest":"60s"},
          {"slug":"panturrilha-em-pe","sets":4,"reps":"12-15","rest":"45s"},
          {"slug":"prancha","sets":3,"reps":"45s","rest":"45s"}
        ]'::jsonb),
        public.build_default_block('C', 'Superior B - Volume', 2, 60, '[
          {"slug":"supino-inclinado-com-halteres","sets":4,"reps":"10-12","rest":"90s"},
          {"slug":"remada-unilateral","sets":4,"reps":"10-12","rest":"90s"},
          {"slug":"crossover","sets":3,"reps":"12-15","rest":"60s"},
          {"slug":"face-pull","sets":3,"reps":"15","rest":"45s"},
          {"slug":"elevacao-lateral","sets":4,"reps":"15","rest":"45s"},
          {"slug":"rosca-martelo","sets":3,"reps":"12","rest":"45s"},
          {"slug":"triceps-pulley","sets":3,"reps":"12-15","rest":"45s"}
        ]'::jsonb),
        public.build_default_block('D', 'Inferior B - Volume', 3, 60, '[
          {"slug":"agachamento-bulgaro","sets":3,"reps":"10 por perna","rest":"90s"},
          {"slug":"hip-thrust-com-barra","sets":4,"reps":"10-12","rest":"90s"},
          {"slug":"cadeira-extensora","sets":3,"reps":"15","rest":"60s"},
          {"slug":"stiff","sets":3,"reps":"12","rest":"90s"},
          {"slug":"abdutora","sets":3,"reps":"15","rest":"45s"},
          {"slug":"panturrilha-sentada","sets":4,"reps":"15-20","rest":"45s"}
        ]'::jsonb)
      )
    );
    v_inserted := v_inserted + 1;
  end if;

  -- 4. Mobilidade e Recuperacao
  if not exists (
    select 1 from public.workout_templates wt
    where wt.teacher_id = p_teacher_id and wt.name = 'Mobilidade e Recuperacao'
  ) then
    insert into public.workout_templates (teacher_id, name, objective, notes, blocks)
    values (
      p_teacher_id,
      'Mobilidade e Recuperacao',
      'Amplitude articular e recuperacao ativa',
      'Sessao leve para dia de descanso ou aquecimento. Sem carga: o tempo em cada posicao e o estimulo.',
      jsonb_build_array(
        public.build_default_block('A', 'Mobilidade geral', 0, 25, '[
          {"slug":"cat-cow","sets":2,"reps":"10 ciclos","rest":"30s"},
          {"slug":"open-book","sets":2,"reps":"8 por lado","rest":"30s"},
          {"slug":"90-90","sets":2,"reps":"8 por lado","rest":"30s"},
          {"slug":"worlds-greatest-stretch","sets":2,"reps":"5 por lado","rest":"30s"},
          {"slug":"hip-opener","sets":2,"reps":"45s","rest":"30s"},
          {"slug":"childs-pose","sets":2,"reps":"60s","rest":"30s"},
          {"slug":"alongamento-de-isquiotibiais-sentado","sets":2,"reps":"45s por lado","rest":"20s"},
          {"slug":"alongamento-de-quadriceps-em-pe","sets":2,"reps":"45s por lado","rest":"20s"},
          {"slug":"alongamento-de-peitoral-na-parede","sets":2,"reps":"45s por lado","rest":"20s"}
        ]'::jsonb)
      )
    );
    v_inserted := v_inserted + 1;
  end if;

  return v_inserted;
end;
$fn$;

grant execute on function public.seed_default_workout_templates(uuid) to service_role;

-- ── Aplica aos professores que ja existem ─────────────────────────────────────
do $$
declare
  r record;
begin
  for r in select id from public.teachers loop
    perform public.seed_default_workout_templates(r.id);
  end loop;
end;
$$;

-- ── E aos que vierem depois ───────────────────────────────────────────────────
-- Sem isto, "default" valeria so para quem ja existia, e todo professor novo
-- comecaria com a biblioteca vazia.
create or replace function public.seed_templates_for_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.seed_default_workout_templates(new.id);
  return new;
end;
$fn$;

drop trigger if exists teachers_seed_default_templates on public.teachers;
create trigger teachers_seed_default_templates
after insert on public.teachers
for each row
execute function public.seed_templates_for_new_teacher();
