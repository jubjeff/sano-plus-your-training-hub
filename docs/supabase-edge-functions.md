# Supabase Edge Functions Blueprint

## Quando usar Edge Functions neste projeto

Use Edge Functions quando a regra:

- depende de segredo, token de terceiro ou `service_role`
- precisa validar permissao alem do que o cliente deveria conhecer
- combina varias etapas que nao devem ficar espalhadas entre browser e SQL
- recebe webhooks ou integra com APIs externas
- precisa de auditoria, rate-limit, idempotencia ou orquestracao server-side

## Casos recomendados para o dominio atual

### Acoes administrativas do professor

- emissao/reset de acesso temporario de aluno
- mudanca de status com validacoes centrais
- confirmacao de pagamento com rastreabilidade
- upgrade e reconciliacao de plano do professor

### Automacoes

- varredura de inadimplencia e bloqueio operacional
- geracao de alertas de engajamento
- expiracao de trials, janelas e pendencias operacionais

### Integracoes futuras

- gateways de pagamento
- CRMs e automacao de e-mail
- mensageria e notificacoes
- webhooks de plataformas terceiras

### Rotinas seguras

- provisionamento de contas
- reconciliacao de assinaturas
- mutacoes que precisam de `service_role`
- tarefas internas acionadas por segredo e nao pelo browser

## Estrutura criada

```text
supabase/
  config.toml
  functions/
    .env.example
    README.md
    _shared/
      auth.ts
      cors.ts
      env.ts
      http.ts
      supabase.ts
    teacher-admin-actions/
      index.ts
    automation-dispatch/
      index.ts
    integration-webhook/
      index.ts
    secure-ops/
      index.ts
src/
  integrations/supabase/
    function-contracts.ts
    functions.ts
  services/
    teacher-admin-actions.service.ts
scripts/
  supabase-functions.ps1
```

## Observacoes de arquitetura

- `teacher-admin-actions` e a porta natural para fluxos do professor autenticado via browser.
- `automation-dispatch` e `secure-ops` devem ser chamados apenas por ambiente confiavel.
- `integration-webhook` deve concentrar validacao de assinatura e roteamento de eventos externos.
- As templates atuais retornam `501 not_implemented` de proposito: a base esta pronta, mas sem regra de negocio acoplada cedo demais.

## O que foi automatizado localmente

- wrapper PowerShell para `check`, `serve`, `deploy` e `deploy-all`
- scripts `npm run supabase:functions:*` no `package.json`
- `deno.json` por function, no formato recomendado pelo Supabase
- env template para secrets de runtime
