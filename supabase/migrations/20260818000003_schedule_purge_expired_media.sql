-- Agenda a limpeza automatica da midia de anamnese expirada.
--
-- Contexto: a job `purge_expired_media` da edge function `automation-dispatch`
-- esta implementada desde sempre, mas nunca rodou — nao havia pg_cron nas
-- migracoes nem nenhum chamador externo. Resultado: a midia acumulou ate
-- estourar a cota de 1 GB do plano Free e derrubar o projeto.
--
-- O segredo NAO fica neste arquivo. Ele e lido do Supabase Vault em tempo de
-- execucao, para nao ser versionado no git. Antes de este agendamento
-- funcionar, cadastre o segredo uma unica vez (ver README abaixo).
--
--   select vault.create_secret(
--     '<valor de INTERNAL_AUTOMATION_SECRET>',
--     'internal_automation_secret',
--     'Segredo compartilhado usado pelo cron para chamar automation-dispatch'
--   );
--
-- Para conferir o agendamento:   select * from cron.job;
-- Para ver as ultimas execucoes: select * from cron.job_run_details order by start_time desc limit 10;
-- Para remover:                  select cron.unschedule('purge-expired-anamnesis-media');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recria de forma idempotente: unschedule falha se o job nao existir, entao
-- o bloco engole a excecao.
do $$
begin
  perform cron.unschedule('purge-expired-anamnesis-media');
exception
  when others then null;
end;
$$;

-- Diariamente as 03:00 UTC (meia-noite em Brasilia). A retencao e de 48h, entao
-- rodar uma vez por dia significa apagar entre 48h e 72h apos o envio — sempre
-- depois do prazo prometido ao professor, nunca antes.
select cron.schedule(
  'purge-expired-anamnesis-media',
  '0 3 * * *',
  $cron$
  select net.http_post(
    url     := 'https://odlzptzhbqrtwcoshgiz.supabase.co/functions/v1/automation-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'internal_automation_secret' limit 1
      )
    ),
    body    := jsonb_build_object('job', 'purge_expired_media')
  );
  $cron$
);
