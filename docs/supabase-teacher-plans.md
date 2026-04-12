## 1. Visao Geral Da Arquitetura

O backend foi desenhado para centralizar as regras criticas no Postgres/Supabase, deixando o frontend apenas como consumidor. O fluxo fica assim:

- `Supabase Auth` cria a identidade do professor.
- A Edge Function `create-teacher-account` chama a RPC `provision_teacher_account(...)`.
- A RPC cria/atualiza `profiles`, garante `teachers`, decide trial por CPF e provisiona `teacher_subscriptions`.
- O acesso efetivo e o limite de alunos sao sempre derivados por `get_teacher_access_snapshot(...)`.
- O cadastro de alunos passa por RLS e por trigger no banco, protegendo inclusive chamadas simultaneas.

Essa arquitetura atende bem porque:

- o trial unico por CPF fica persistido em `cpf_trial_registry`
- o limite do Basic fica reforcado por trigger + advisory lock
- o bloqueio por trial expirado fica centralizado em `get_teacher_access_snapshot(...)`
- o upgrade para Pro fica auditavel em `access_requests`, `payment_events` e `subscription_history`
- novos planos futuros podem ser adicionados com novos enums, limites e regras na camada de assinatura

## 2. Modelagem Das Tabelas

- `profiles`: dados do usuario autenticado, incluindo `cpf_normalized`
- `teachers`: entidade de professor vinculada a `profiles.user_id`
- `students`: biblioteca de alunos do professor
- `teacher_subscriptions`: assinatura/plano corrente do professor
- `cpf_trial_registry`: registro permanente do primeiro trial por CPF
- `access_requests`: pedidos de upgrade/acesso
- `payment_events`: conciliacao de pagamento e eventos financeiros
- `subscription_history`: trilha completa de auditoria

Todos os objetos possuem `created_at` e/ou `updated_at`, `foreign keys`, `check constraints` e indices para lookup por professor, CPF e status.

## 3. SQL Completo

Arquivos principais:

- [20260409_teacher_plans.sql](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/migrations/20260409_teacher_plans.sql)
- [20260409_teacher_plan_selection_mock.sql](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/migrations/20260409_teacher_plan_selection_mock.sql)

Ele inclui:

- extensoes `pgcrypto` e `citext`
- enums de plano, status, pedidos e historico
- tabelas, indices e comentarios
- funcoes reutilizaveis de negocio
- triggers de `updated_at` e limite de alunos
- RLS e `grant execute`

## 4. Functions E Triggers PostgreSQL

Principais funcoes implementadas:

- `normalize_cpf(text)`
- `is_valid_cpf(text)`
- `can_cpf_receive_trial(text)`
- `get_teacher_current_subscription(uuid)`
- `get_teacher_access_snapshot(uuid)`
- `teacher_has_active_access(uuid)`
- `teacher_can_add_student(uuid)`
- `create_initial_teacher_plan(uuid, text, text)`
- `create_teacher_subscription_from_selection(uuid, text, plan_type, boolean, text)`
- `activate_pro_plan(uuid, timestamptz, text, text, uuid, jsonb)`
- `confirm_mock_pro_payment(uuid, timestamptz, uuid, uuid, jsonb)`
- `request_pro_upgrade(uuid, text, integer, text, jsonb)`
- `provision_teacher_account(uuid, text, text, date, text, text, jsonb)`

Triggers principais:

- `set_*_updated_at`: auditoria automatica
- `apply_subscription_defaults_trigger`: ajusta limite conforme o plano
- `enforce_student_limit_trigger`: bloqueia segundo aluno no Basic

## 5. RLS Policies

As policies permitem:

- professor ler/editar apenas o proprio `profile`
- professor ler/editar apenas o proprio `teacher`
- professor ler e gerenciar apenas os proprios `students`
- professor ler apenas a propria `teacher_subscriptions`
- professor ler/inserir apenas os proprios `access_requests`
- professor ler apenas os proprios `payment_events` e `subscription_history`
- `cpf_trial_registry` fica fechado para clientes autenticados

## 6. Edge Functions Completas

Arquivos:

- [create-teacher-account](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/create-teacher-account/index.ts)
- [request-pro-upgrade](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/request-pro-upgrade/index.ts)
- [activate-pro-subscription](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/activate-pro-subscription/index.ts)
- [confirm-mock-pro-payment](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/confirm-mock-pro-payment/index.ts)
- [get-teacher-access-status](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/get-teacher-access-status/index.ts)

Helpers compartilhados:

- [cors.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/_shared/cors.ts)
- [http.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/_shared/http.ts)
- [supabase.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/functions/_shared/supabase.ts)

## 7. Exemplos Com Supabase JS

Helpers prontos no frontend:

- [client.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/src/lib/supabase/client.ts)
- [teacher-plans.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/src/lib/supabase/teacher-plans.ts)
- [supabase-plans.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/src/types/supabase-plans.ts)

Esses exemplos cobrem:

- `signUp` + provisionamento da conta
- selecao obrigatoria de plano no cadastro
- confirmacao mockada do Pro
- consulta do status de acesso
- tentativa de insert em `students`
- solicitacao de upgrade
- sincronizacao do estado do frontend por `buildTeacherAccessViewState(...)`

## 8. Fluxos De Negocio

Fluxo 1: novo professor com CPF elegivel

- `signUp`
- `create-teacher-account`
- `provision_teacher_account`
- `create_initial_teacher_plan` concede `basic + trialing`

Fluxo 2: novo professor com CPF ja usado

- conta criada
- perfil/teacher provisionados
- `cpf_trial_registry` impede novo trial
- `teacher_subscriptions` nasce como `basic + pending_payment`

Fluxo 3: Basic tentando segundo aluno

- insert em `students`
- trigger `enforce_student_limit_trigger`
- erro claro orientando upgrade

Fluxo 4: trial expirado

- login continua valido via Auth
- `get_teacher_access_snapshot` devolve `effective_status = expired`
- recursos principais devem ser bloqueados no app

Fluxo 5: upgrade para Pro

- `request-pro-upgrade`
- `activate-pro-subscription`
- assinatura passa para `pro + active`
- limite de alunos vira ilimitado

## 9. Mensagens De Erro

Mensagens centralizadas usadas na solucao:

- “Seu periodo de teste expirou. Faca upgrade para o plano Pro para continuar.”
- “O plano Basic permite apenas 1 aluno. Faca upgrade para o Pro para adicionar alunos ilimitados.”
- “Este CPF ja utilizou o periodo de teste gratuito. Para liberar o acesso, e necessario assinar o plano Pro.”
- “Sua assinatura Pro esta pendente de pagamento.”
- “Acesso bloqueado no momento.”

## 10. Testes E Cenarios De Borda

Arquivos:

- [teacher-plan-scenarios.sql](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/supabase/tests/teacher-plan-scenarios.sql)
- [teacher-plans.test.ts](C:/Users/JeffersonFerreiradeS/Desktop/Projetos%20Linkedin/Sano+/src/lib/supabase/teacher-plans.test.ts)

Coberturas principais:

- CPF novo ganha trial
- CPF repetido nao ganha trial
- Basic adiciona apenas 1 aluno
- Pro adiciona varios alunos
- trial expirado bloqueia acesso
- estado de UI reflete trial, bloqueio e Pro ativo

Observacao de concorrencia:

- o limite de alunos e protegido com `pg_advisory_xact_lock(hashtextextended(teacher_id::text, 0))`
- isso serializa as transacoes por professor e evita race condition no cadastro simultaneo do segundo aluno

## 11. Sugestoes Opcionais De Melhorias Futuras

- adicionar webhook real de pagamento para Stripe/Mercado Pago
- criar job agendado para marcar assinaturas vencidas como `expired` materialmente
- mover mensagens de acesso para tabela/configuracao internacionalizavel
- expandir `plan_type` para `team`, `enterprise` ou modulos add-on
- adicionar pgTAP ou testes de integracao contra banco efemero no CI
