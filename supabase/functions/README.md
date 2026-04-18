# Supabase Edge Functions Base

Estrutura inicial para regras de backend que nao devem ficar apenas no browser ou em SQL.

## Funcoes preparadas

- `teacher-admin-actions`
  - Acoes autenticadas do professor que precisam de validacao centralizada.
- `automation-dispatch`
  - Rotinas internas/agendadas protegidas por segredo.
- `integration-webhook`
  - Recebimento de webhooks e eventos externos.
- `secure-ops`
  - Operacoes privilegiadas que exigem `service_role` e segredo interno.

## Pasta `_shared`

Contem utilitarios reutilizaveis entre funcoes:

- `auth.ts`: autenticacao e checagem de papel do usuario
- `cors.ts`: cabecalhos CORS
- `env.ts`: leitura de segredos
- `http.ts`: resposta padronizada e tratamento de erro
- `supabase.ts`: clientes Supabase com JWT do usuario e com `service_role`

## Desenvolvimento local

1. Instale e autentique o Supabase CLI.
2. Preencha `supabase/functions/.env.example` em um arquivo local, como `.env.local`.
3. Sirva uma funcao:

```bash
supabase functions serve teacher-admin-actions --env-file supabase/functions/.env.local
```

4. Deploy:

```bash
supabase functions deploy teacher-admin-actions
```

## Scripts locais preparados

Com o Supabase CLI instalado, voce pode usar:

```bash
npm run supabase:functions:check
npm run supabase:functions:serve:teacher-admin
npm run supabase:functions:serve:automation
npm run supabase:functions:serve:webhook
npm run supabase:functions:serve:secure-ops
npm run supabase:functions:deploy:teacher-admin
npm run supabase:functions:deploy:automation
npm run supabase:functions:deploy:webhook
npm run supabase:functions:deploy:secure-ops
npm run supabase:functions:deploy:all
npm run supabase:functions:manual
```

## Observacoes

- As funcoes atuais sao templates seguros e retornam `501 not_implemented` por enquanto.
- A ideia e consolidar seguranca, secrets, integracoes e auditoria antes de mover a regra final para cada endpoint.
