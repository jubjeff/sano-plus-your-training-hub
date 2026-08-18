# CLAUDE.md — Sano+

Plataforma SaaS de gestão de treinos para personal trainers (professores) e seus alunos.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| UI | shadcn/ui + Radix UI + Tailwind CSS 3 |
| Validação | Zod (direto, sem React Hook Form) |
| Roteamento | React Router DOM 6 |
| Ícones | lucide-react |
| Toasts | Sonner + Radix Toast |
| QR Code | react-qr-code (PIX) |
| Compressão de imagem | browser-image-compression (anamnese) |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Edge Functions | Deno runtime |
| Email | Resend (via edge function `_shared/email.ts`) |
| Testes | Vitest + jsdom + @testing-library/jest-dom |
| Deploy | Vercel (frontend) + Supabase (backend) |

> **Não** fazem parte da stack: Framer Motion, Recharts, React Hook Form, date-fns
> e Playwright. Foram removidos na varredura de código morto — não reintroduza sem
> necessidade real. Os formulários usam estado controlado + Zod na validação.

---

## Estrutura de Diretórios

```
Sano+/
├── src/
│   ├── pages/            # 22 páginas React
│   ├── components/       # 16 componentes de negócio
│   │   └── ui/           # 17 componentes shadcn/ui (só os usados)
│   ├── auth/             # provider.tsx, use-auth, use-authorization, authorization, types
│   ├── guards/           # protected, public-only, role, first-access, subscription
│   ├── hooks/            # use-store, use-theme, use-toast
│   ├── services/         # auth, profile, session, teacher-admin-actions
│   ├── lib/              # 17 módulos de regra de negócio
│   ├── integrations/
│   │   └── supabase/     # Client, config, contratos de function, mappers, tipos
│   ├── types/            # Tipos TypeScript globais
│   └── test/             # Setup + testes Vitest
├── supabase/
│   ├── migrations/       # 22 migrações SQL
│   ├── functions/        # 10 Edge Functions
│   │   ├── _shared/      # auth, cors, http, email, supabase, env, mercadopago
│   │   ├── anamnesis-submit/
│   │   ├── auth-public-actions/
│   │   ├── automation-dispatch/
│   │   ├── integration-webhook/
│   │   ├── mp-create-preference/     # PAUSADO
│   │   ├── mp-webhook/               # PAUSADO
│   │   ├── pix-payment-submit/
│   │   ├── pix-approve-payment/
│   │   ├── secure-ops/
│   │   └── teacher-admin-actions/
│   └── config.toml       # Project ID: sano-plus-app
├── scripts/              # PowerShell (deploy de functions) + limpeza de storage
├── docs/                 # Documentação extra
├── vite.config.ts        # Porta 8080, alias @/ → ./src/
├── tailwind.config.ts
├── vercel.json           # Rewrite SPA para /index.html
└── .env.example
```

**Não existem** `src/contexts/` nem `src/assets/` — foram eliminados ao achatar a
camada de shims de re-export. O `AuthContext` vive em `src/auth/provider.tsx`.

---

## Módulos de `src/lib/`

> A lógica de autenticação **não está mais em `lib/`**: `auth-service.ts` foi movido
> para `src/services/auth.service.ts`.

| Arquivo | Responsabilidade |
|---|---|
| `auth-validators.ts` | Validação de e-mail, telefone, senha e CPF |
| `auth-redirects.ts` | Montagem de URLs de redirecionamento do fluxo de auth |
| `pix.ts` | Tipos de chave PIX, rótulos e montagem do payload copia-e-cola |
| `store.ts` | Store LocalStorage — **fallback inativo em produção**, ver "Estado do Código" |
| `supabase-store.ts` | Store real: persistência no Supabase com cache local |
| `training-management.ts` | Cálculos de treino, pontuação de engajamento, progressão |
| `student-dashboard.ts` | Estatísticas do aluno, calendário de atividades, status de pagamento |
| `student-access.ts` | Verificações de acesso do aluno |
| `student-temporary-access.ts` | Fluxo de senha temporária no onboarding |
| `exercise-utils.ts` | Filtros e resolução da biblioteca de exercícios |
| `exercise-options.ts` | Opções dos campos (categorias, músculos, equipamentos...) |
| `exercise-library-seed.ts` | Seed de 50+ exercícios globais |
| `exercise-media.ts` | Upload e preview de mídia de exercícios |
| `profile-media.ts` | Upload e download de avatar |
| `payment-proof.ts` | Validação de arquivo de comprovante de pagamento |
| `format.ts` | Formatação de datas, textos e valores |
| `utils.ts` | Utilitários gerais |

---

## Rotas Frontend

### Públicas (sem autenticação)
| Rota | Página | Guard |
|---|---|---|
| `/` | Login | `PublicOnlyRoute` |
| `/criar-conta` | Registro | `PublicOnlyRoute` |
| `/verifique-email` | Verificação de e-mail | `PublicOnlyRoute` |
| `/esqueci-senha` | Esqueci a senha | `PublicOnlyRoute` |
| `/anamnese` | Formulário público de anamnese (fotos + vídeos FMS) | — |
| `/planos` | Escolha de plano + pagamento PIX | — |
| `/pagamento/sucesso` | Retorno de pagamento aprovado | — |
| `/pagamento/pendente` | Retorno de pagamento pendente | — |
| `/pagamento/erro` | Retorno de pagamento recusado | — |
| `/redefinir-senha` | Redefinir senha | — |
| `/auth/callback` | Callback OAuth | — |

### Aluno (role="student")
| Rota | Página | Guard |
|---|---|---|
| `/primeiro-acesso` | Troca de senha temporária | `ProtectedRoute` + `FirstAccessRoute` |
| `/aluno/dashboard` | Portal do aluno (treino, check-in, pagamento) | `ProtectedRoute` + `RoleRoute` + `SubscriptionRoute` |
| `/perfil` | Perfil do usuário | `ProtectedRoute` |

### Professor/Coach (role="coach")
| Rota | Página | Guard |
|---|---|---|
| `/dashboard` | Dashboard principal | `ProtectedRoute` + `RoleRoute` |
| `/alunos` | Lista de alunos | `ProtectedRoute` + `RoleRoute` |
| `/alunos/:id` | Perfil individual do aluno | `ProtectedRoute` + `RoleRoute` |
| `/biblioteca` | Biblioteca de templates de treino | `ProtectedRoute` + `RoleRoute` |
| `/biblioteca/:id/editar` | Editor de template | `ProtectedRoute` + `RoleRoute` |
| `/anamneses` | Fila de anamneses recebidas | `ProtectedRoute` + `RoleRoute` |
| `/assinaturas` | Assinaturas e aprovação de pagamento PIX | `ProtectedRoute` + `RoleRoute` |
| `/perfil` | Perfil do usuário | `ProtectedRoute` |

### Redirects legados
`/forgot-password` → `/esqueci-senha` · `/reset-password` e `/update-password` →
`/redefinir-senha` · `/area-do-aluno` → `/aluno/dashboard` · `/home` → `/dashboard`

**`*`** → Página 404

---

## Edge Functions (Supabase / Deno)

Todas com `verify_jwt=false` no `config.toml` (auth validada manualmente dentro das funções).

| Função | Tipo de acesso | Responsabilidade | Status |
|---|---|---|---|
| `teacher-admin-actions` | Autenticado (professor) | Criar aluno com senha temporária, resetar acesso, alterar status, aprovar pagamento, ativar plano Pro | Ativa |
| `auth-public-actions` | Público | Fluxo público de auth (`request_password_reset`) sem autenticação prévia | Ativa |
| `anamnesis-submit` | Público | Recebe a anamnese pública, vincula ao professor e grava em `anamneses` | Ativa |
| `pix-payment-submit` | Público / autenticado | Modos `info`, `info_by_teacher`, `get_upload_url`, `submit`, `submit_renewal` — devolve a chave PIX do professor e registra a intenção de pagamento | Ativa |
| `pix-approve-payment` | Autenticado (professor) | Aprova o PIX e **provisiona** professor/aluno/assinatura a partir da anamnese | Ativa |
| `automation-dispatch` | Interno (secret) | Automações agendadas: varredura de pagamentos, geração de alertas, expiração | Sem chamador conhecido |
| `secure-ops` | Interno (secret) | `provision_teacher_account`, `rotate_student_access`, `reconcile_subscription_state` | Sem chamador conhecido |
| `integration-webhook` | Público (webhook) | Grava em `integration_events` e roteia por `provider` | Sem chamador conhecido |
| `mp-create-preference` | Público | Cria preferência de checkout no Mercado Pago | **Pausada** |
| `mp-webhook` | Público (webhook) | Notificação de pagamento MP → provisiona conta | **Pausada** |

**Utilitários compartilhados em `_shared/`:**
- `auth.ts` — Validação de usuário, cheque de papel (coach/student), segredo compartilhado
- `cors.ts` — Headers CORS
- `env.ts` — Carregamento de variáveis e secrets
- `http.ts` — Envelopes de resposta padronizados
- `supabase.ts` — Criação de cliente (JWT user e service role)
- `email.ts` — Envio de e-mail via Resend
- `mercadopago.ts` — Cliente do Mercado Pago (**pausado**)

---

## Banco de Dados (PostgreSQL via Supabase)

### Tabelas Principais

| Tabela | Descrição |
|---|---|
| `auth.users` | Usuários gerenciados pelo Supabase Auth |
| `profiles` | Dados de perfil (nome, CPF, avatar, role, platform_role) |
| `teachers` | Extensão do perfil professor, flag de onboarding |
| `teacher_subscriptions` | Plano e status de assinatura (basic/pro, trialing/active/expired/blocked/pending_payment/canceled) |
| `students` | Alunos vinculados a um professor, status, pagamento, acesso |
| `workout_templates` | Templates de treino criados pelo professor |
| `student_workout_plans` | Plano de treino ativo do aluno (semanal ou ABCDE) |
| `student_check_ins` | Registro de treinos concluídos pelo aluno |
| `exercises` | Biblioteca global de exercícios |
| `coach_alert_reads` | Estado de leitura de alertas do professor |
| `cpf_trial_registry` | Controle de trial único por CPF |
| `integration_events` | Log de eventos de webhooks externos |
| `anamneses` | Anamnese pública submetida (dados, fotos, vídeos FMS, vínculo com professor) |
| `planos` | Catálogo de planos vendidos na `/planos` (nome, preço, ativo) |
| `assinaturas` | Assinatura gerada após pagamento aprovado, ligada a `anamneses` e `planos` |

### Campos Relevantes por Tabela

**`students`**
- `status`: active | inactive
- `access_status`: pre_registered | temporary_password_pending | active | inactive
- `proof_of_payment`: objeto com status do comprovante e URL do arquivo
- `payment_due_date`, `payment_last_paid_at`
- `first_access_completed_at`, `last_login_at`, `last_check_in_at`

**`student_workout_plans`**
- `training_structure_type`: weekly | abcde
- `training_progress_mode`: fixed_schedule | sequential_progression
- `blocks`: JSONB — array de blocos com exercícios
- `weekly_goal`: 1–7 (dias de treino por semana)
- `current_suggested_block_id`, `last_completed_block_id`

**`teacher_subscriptions`**
- `plan_type`: basic | pro
- `status`: trialing | active | expired | blocked | pending_payment | canceled
- `student_limit`, `billing_provider` (mock atualmente)

**`exercises`**
- `category`: Musculação | Mobilidade | Alongamento | Cardio
- `difficulty_level`: Iniciante | Intermediário | Avançado
- `is_global`: true = biblioteca pública; false = criado pelo professor
- Campos de instrução: `execution_instructions`, `breathing_tips`, `posture_tips`, `contraindications`, `common_mistakes`

### Funções PostgreSQL Notáveis

| Função | Papel |
|---|---|
| `current_teacher_id()` | ID do professor autenticado |
| `current_student_id()` | ID do aluno autenticado |
| `teacher_has_active_access()` | Booleano de acesso ativo |
| `teacher_can_add_student()` | Validação de limite de alunos |
| `provision_current_teacher_account()` | Onboarding do professor |
| `create_initial_teacher_plan()` | Cria trial inicial |
| `confirm_mock_pro_payment()` | Confirma upgrade para Pro (mock) |
| `assert_student_can_check_in()` | Validação pré check-in |
| `sync_student_last_check_in()` | Trigger para sincronizar timestamps |
| `submit_student_payment_proof()` | Armazena comprovante de pagamento |
| `update_student_exercise_load()` | Atualiza carga do aluno por exercício |
| `normalize_cpf()` / `is_valid_cpf()` | Formatação e validação de CPF |

### Storage Buckets

| Bucket | Visibilidade | Limite por arquivo | Quem escreve |
|---|---|---|---|
| `anamnesis-photos` | Público | 2 MB (comprimido) | Anônimos |
| `anamnesis-videos` | Público | 15 MB | Anônimos |
| `student-profile-photos` | Público | Sem limite definido | Autenticados |
| `payment-proofs` | Privado | 8 MB | Autenticados |
| `exercise-media` | Público | 12 MB | Professores |
| `profile-avatars` | Público | 5 MB | Autenticados |

### Estratégia de Armazenamento de Mídia (Opção C — Compressão Frontend)

**Fotos de anamnese (`anamnesis-photos`):**
- Comprimidas no browser com `browser-image-compression` antes do upload
- Target: 800 KB, max 1200px, qualidade 80%, formato WebP
- Custo estimado por anamnese: ~2,4 MB (3 fotos × 800 KB)

**Vídeos de anamnese (`anamnesis-videos`):**
- Sem compressão no frontend (formato nativo)
- Limite rígido de 15 MB por vídeo — orientar usuário a gravar em 720p
- Custo estimado por anamnese: ~30–45 MB (3 vídeos × 10–15 MB)
- Custo total por anamnese: ~35–50 MB (vs. ~180 MB sem compressão)

**Limite do plano gratuito Supabase (1 GB):** ~20–25 submissões por ciclo de limpeza.

**Atenção:** Não armazenar vídeos longos no Supabase Storage. Se o volume crescer, migrar para Cloudinary free tier (25 GB) ou tornar os vídeos opcionais via link externo (YouTube, Google Drive).

---

## Integrações Externas

| Serviço | Status | Uso |
|---|---|---|
| **Supabase** | Ativo | DB, Auth, Storage, Edge Functions |
| **Resend** | Ativo | E-mails transacionais (senha temporária, reset de senha) |
| **Vercel** | Ativo | Hospedagem do frontend SPA |
| **PIX manual** | Ativo | Único fluxo de pagamento real: chave PIX do professor + aprovação manual |
| **Mercado Pago** | Pausado | Implementado por completo, sem nenhum ponto de entrada no frontend |

---

## Variáveis de Ambiente

```bash
# .env (frontend)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=https://sanoplus.online
VITE_SUPABASE_FUNCTIONS_REGION=
VITE_MP_PUBLIC_KEY=            # Mercado Pago — pausado

# Secrets (Supabase Edge Functions)
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@sanoplus.online
RESEND_FROM_NAME=Sano+
SUPABASE_SERVICE_ROLE_KEY=
AUTOMATION_SECRET=
APP_URL=https://sanoplus.online
MP_ACCESS_TOKEN=               # Mercado Pago — pausado
MP_WEBHOOK_SECRET=             # Mercado Pago — pausado
```

---

## Comandos de Desenvolvimento

```bash
npm run dev                                        # Dev server em :8080
npm run build                                      # Build para dist/
npm run lint                                       # ESLint
npm run test                                       # Vitest
npm run preview                                    # Preview do build

# Supabase Functions
npm run supabase:functions:serve:teacher-admin     # Serve função localmente
npm run supabase:functions:deploy:all              # Deploy de todas as funções
```

---

## Fluxo de Inicialização

1. `src/main.tsx` renderiza o root React
2. `src/App.tsx` configura rotas com `AuthProvider`
3. `AuthProvider` chama `authService.getAuthSnapshot()` para restaurar sessão
4. Listener do Supabase Auth dispara re-verificações de estado
5. Guards de rota redirecionam com base em autenticação e papel
6. `FirstAccessRoute` força troca de senha temporária antes de qualquer outra rota
7. `AppLayout` envolve rotas autenticadas com sidebar

---

## Papéis (Roles)

| Role | Valor em `profiles.role` | Acesso |
|---|---|---|
| Professor / Coach | `professor` | Dashboard, alunos, biblioteca, perfil |
| Aluno | `aluno` | Portal do aluno, perfil |

A distinção é feita via `platform_role` no perfil e validada nas RLS policies e nas edge functions.

---

## Modelo de Assinatura (Freemium)

- **Basic (Trial):** 30 dias grátis, limite de 1 aluno, baseado em CPF (1 trial por CPF via `cpf_trial_registry`)
- **Pro:** Ilimitado, pagamento via comprovante com aprovação manual do admin (gateway real ainda não integrado)
- Status de assinatura controla acesso às funcionalidades de gestão de alunos

---

## Padrões de Código

- Alias de caminho: `@/` → `src/`
- Strict null checks **desabilitado** no `tsconfig.json`
- Componentes UI em `src/components/ui/` (shadcn/ui — não editar diretamente)
- Lógica de negócio em `src/lib/` (pura, sem dependência de UI)
- Chamadas ao Supabase em `src/services/` e `src/lib/`
- Validações de schema com Zod (sem React Hook Form)
- Cada módulo tem **um caminho de import canônico** — não crie arquivos de
  re-export (`export { default } from ...`). A camada de shims foi removida
  justamente porque criava dois nomes para a mesma coisa.

---

## Estado do Código

Registro de decisões conscientes, para que uma próxima varredura não remova algo
de propósito nem trate peso morto como código vivo.

### Mercado Pago — pausado, mantido de propósito

`mp-create-preference`, `mp-webhook` e `_shared/mercadopago.ts` estão completos e
deployados, mas **nada no frontend os invoca**. O único fluxo de pagamento real é
o PIX manual (`Planos.tsx` → `pix-payment-submit` → `pix-approve-payment`).

⚠️ **Duplicação ativa:** `mp-webhook` e `pix-approve-payment` provisionam as mesmas
tabelas (`teachers`, `profiles`, `students`, `assinaturas`, `anamneses`). Mudou a
regra de provisionamento? **Atualize os dois.** Só o caminho PIX é exercitado.

### Funções internas sem chamador conhecido

`automation-dispatch`, `secure-ops` e `integration-webhook` não são chamadas por
nenhum código deste repositório. São protegidas por segredo compartilhado e
poderiam ser acionadas de fora (cron externo, ops manual, gateway terceiro) —
não há `pg_cron` nas migrações. **Status não confirmado: verificar antes de remover.**

### Store LocalStorage — inerte em produção

`lib/store.ts` (1.162 linhas) + `lib/exercise-library-seed.ts` (1.002 linhas)
formam um fallback para rodar o app **sem Supabase configurado**.
`hooks/use-store.ts` escolhe em runtime: `hasSupabaseRuntimeConfig() ? supabaseStore : localStore`.
Em produção sempre cai no Supabase, então essas 2.164 linhas nunca executam.

As 9 chamadas `store.*` em `services/auth.service.ts` batem no store LocalStorage
vazio e são **no-ops inertes** — não há divergência de estado, porque o arquivo
também chama os RPCs direto (`touch_student_last_login`, `mark_student_first_access_complete`).

**Decisão: manter.** Remover implica limpar 24 ramificações `hasSupabaseRuntimeConfig()`
no `auth.service.ts` (1.485 linhas, arquivo mais crítico do app) com apenas 5 testes
de cobertura. Risco alto, ganho baixo.

### Dívidas conhecidas

- `src/guards/public-only-route.tsx` — `search.has("code")` referencia variável
  inexistente no escopo; quebra em runtime quando chega link de recovery com token
- `src/integrations/supabase/types.ts` desatualizado: não foi regerado após as
  migrações de PIX/planos/assinaturas. Causa ~59 erros `never` no `tsc --noEmit`
  (o build passa porque o SWC não faz typecheck). Corrigir com `supabase gen types`
- Bundle único de ~1.164 kB — falta code-splitting por rota
