-- Anamnese obrigatoria no primeiro acesso do aluno.
--
-- Contexto: existem dois caminhos para virar aluno. Pelo fluxo publico
-- (anamnese -> planos -> PIX -> pix-approve-payment) a avaliacao e obrigatoria.
-- Pelo cadastro direto do professor, nao havia nada — o aluno entrava sem peso,
-- nivel, equipamentos, historico de lesoes, fotos posturais nem Deep Squat.
-- O professor prescrevia treino sem a avaliacao que os proprios templates padrao
-- pressupoem ("Iniciante" vs "Intermediario", academia completa vs halteres).
--
-- Esta coluna e o portao: nula = aluno ainda deve preencher. O guard do
-- frontend espelha o que FirstAccessRoute ja faz com a senha temporaria.
--
-- Deliberadamente uma coluna, e nao um `exists (select ... from anamneses)`:
-- auth.service.ts ja carrega a linha de students na resolucao da sessao, entao
-- ler daqui e de graca; derivar custaria um round-trip a cada resolucao.

alter table public.students
  add column if not exists anamnesis_completed_at timestamptz;

comment on column public.students.anamnesis_completed_at is
  'Quando o aluno concluiu a anamnese. Nulo = ainda deve preencher antes de acessar o portal.';

-- Backfill: todos os alunos que ja existem ficam dispensados.
--
-- A regra vale so para quem for criado a partir de agora. Quem veio do fluxo
-- publico herda a data real da propria anamnese; os demais recebem now(), que
-- os marca como dispensados sem inventar uma data de avaliacao que nao houve.
update public.students s
set anamnesis_completed_at = coalesce(
  (
    select a.submitted_at
    from public.anamneses a
    where a.student_id = s.id
    order by a.submitted_at
    limit 1
  ),
  timezone('utc', now())
)
where s.anamnesis_completed_at is null;

-- Consultado pelo guard a cada resolucao de sessao do aluno.
create index if not exists students_anamnesis_pending_idx
  on public.students (id)
  where anamnesis_completed_at is null;
