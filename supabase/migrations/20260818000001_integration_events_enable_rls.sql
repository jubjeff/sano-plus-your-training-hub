-- Habilita RLS em public.integration_events.
--
-- A tabela foi criada em 20260418010400_backend_domain_foundation.sql sem
-- `enable row level security` e sem nenhuma policy. Como vive no schema public,
-- ela fica exposta via PostgREST: qualquer portador da chave anon — que e
-- publica e vai no bundle do frontend — pode ler e escrever o log de eventos
-- de integracao. O Security Advisor do Supabase reporta como CRITICAL
-- ("RLS Disabled in Public").
--
-- Nenhuma policy permissiva e criada de proposito: o unico escritor e a edge
-- function `integration-webhook`, que usa createServiceRoleClient(), e o
-- service role ignora RLS. Sem policy, anon e authenticated ficam sem acesso e
-- a function continua funcionando.
--
-- Se no futuro algum cliente autenticado precisar ler estes eventos, adicione
-- uma policy explicita de select com o escopo adequado.

alter table public.integration_events enable row level security;
