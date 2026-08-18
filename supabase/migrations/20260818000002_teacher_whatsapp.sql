-- WhatsApp do professor.
--
-- Os videos do Deep Squat deixaram de ser enviados pelo formulario publico:
-- 3 videos de ate 15 MB nao cabem em e-mail (Resend ~40 MB, Gmail recusa
-- acima de 25 MB) e eram responsaveis por 98% do consumo de storage.
-- O aluno passa a enviar os videos direto no WhatsApp do professor, via CTA
-- na tela de conclusao da anamnese.
--
-- Coluna separada de `profiles.phone` de proposito: o telefone do perfil e
-- dado pessoal do professor, enquanto este numero e publicado para alunos.
-- Sao decisoes diferentes e o professor deve poder usar numeros diferentes.

alter table public.teachers
  add column if not exists whatsapp text;

comment on column public.teachers.whatsapp is
  'Numero de WhatsApp divulgado aos alunos para envio dos videos de avaliacao. Apenas digitos, com DDI e DDD (ex: 5511987654321).';
