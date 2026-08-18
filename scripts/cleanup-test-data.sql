-- ─────────────────────────────────────────────────────────────────────────────
-- cleanup-test-data.sql
-- Execute no Supabase Dashboard > SQL Editor (projeto sano-plus-app)
-- ATENÇÃO: irreversível — apaga todos os dados de teste
-- Preserva: estrutura de tabelas, seeds de planos e exercícios globais
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Desabilitar triggers para evitar conflitos durante o truncate
set session_replication_role = replica;

-- 2. Limpar tabelas de dados transacionais (ordem de dependência)
delete from public.assinaturas;
delete from public.student_check_ins;
delete from public.student_workout_plans;
delete from public.coach_alert_reads;
delete from public.students;
delete from public.anamneses;
delete from public.workout_templates;
delete from public.teacher_subscriptions;
delete from public.cpf_trial_registry;
delete from public.integration_events;
delete from public.teachers;
delete from public.profiles;

-- 3. Exercícios criados por professores (is_global = false) — manter os globais
delete from public.exercises where is_global = false;

-- 4. Reabilitar triggers
set session_replication_role = default;

-- 5. Limpar metadados de storage (os arquivos físicos serão removidos pelo script Node)
delete from storage.objects
where bucket_id in (
  'anamnesis-photos',
  'anamnesis-videos',
  'student-profile-photos',
  'exercise-media',
  'payment-proofs',
  'profile-avatars'
);

-- 6. Usuários de autenticação (cascade apaga profiles automaticamente)
-- ATENÇÃO: execute por último — garante que as deletes acima já aconteceram
delete from auth.users;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação após a limpeza
-- ─────────────────────────────────────────────────────────────────────────────
select
  'auth.users'            as tabela, count(*) as registros from auth.users
union all select 'profiles',           count(*) from public.profiles
union all select 'teachers',           count(*) from public.teachers
union all select 'students',           count(*) from public.students
union all select 'anamneses',          count(*) from public.anamneses
union all select 'assinaturas',        count(*) from public.assinaturas
union all select 'workout_templates',  count(*) from public.workout_templates
union all select 'exercises (global)', count(*) from public.exercises where is_global = true
union all select 'planos',             count(*) from public.planos
union all select 'storage.objects',    count(*) from storage.objects;
