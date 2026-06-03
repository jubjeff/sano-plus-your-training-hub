# CLAUDE.md — Sano+

Plataforma SaaS de gestão de treinos para personal trainers (professores) e seus alunos.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| UI | shadcn/ui + Radix UI + Tailwind CSS 3 |
| Forms | React Hook Form + Zod |
| Roteamento | React Router DOM 6 |
| Animações | Framer Motion 11 |
| Gráficos | Recharts 2 |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Edge Functions | Deno runtime |
| Email | Resend (via edge function `_shared/email.ts`) |
| Testes | Vitest + Testing Library + Playwright |
| Deploy | Vercel (frontend) + Supabase (backend) |

---

## Estrutura de Diretórios

```
Sano+/
├── src/
│   ├── pages/            # 16 páginas React
│   ├── components/       # 40+ componentes reutilizáveis
│   │   └── ui/           # Componentes shadcn/ui
│   ├── contexts/         # AuthContext
│   ├── hooks/            # useAuth, useTheme, useStore, useToast
│   ├── services/         # auth.ts, profile.ts, teacher-admin.ts
│   ├── lib/              # 17 módulos utilitários
│   ├── integrations/
│   │   └── supabase/     # Client Supabase + tipos gerados
│   ├── types/            # Tipos TypeScript globais
│   ├── guards/           # ProtectedRoute, PublicOnlyRoute, RoleRoute, FirstAccessRoute
│   └── auth/             # Provider, tipos e lógica de autorização
├── supabase/
│   ├── migrations/       # Migrações SQL (8+)
│   ├── functions/        # Edge Functions (5 funções)
│   │   ├── _shared/      # auth, cors, http, email, supabase, env
│   │   ├── teacher-admin-actions/
│   │   ├── automation-dispatch/
│   │   ├── integration-webhook/
│   │   ├── secure-ops/
│   │   └── auth-public-actions/
│   └── config.toml       # Project ID: sano-plus-app
├── scripts/              # Scripts PowerShell
├── docs/                 # Documentação extra
├── vite.config.ts        # Porta 8080, alias @/ → ./src/
├── tailwind.config.ts
├── vercel.json           # Rewrite SPA para /index.html
└── .env.example
```

---

## Módulos de `src/lib/`

| Arquivo | Responsabilidade |
|---|---|
| `auth-service.ts` | Lógica completa de autenticação (login, logout, sessão, snapshot) |
| `auth-validators.ts` | Validação de e-mail, telefone, senha e CPF |
| `auth-redirects.ts` | Montagem de URLs de redirecionamento do fluxo de auth |
| `store.ts` | Store Zustand-like (alunos, treinos, check-ins) com LocalStorage |
| `supabase-store.ts` | Persistência no Supabase com cache local |
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
| `/redefinir-senha` | Redefinir senha | — |
| `/auth/callback` | Callback OAuth | — |

### Aluno (role="student")
| Rota | Página | Guard |
|---|---|---|
| `/primeiro-acesso` | Troca de senha temporária | `ProtectedRoute` + `FirstAccessRoute` |
| `/aluno/dashboard` | Portal do aluno (treino, check-in, pagamento) | `ProtectedRoute` + `RoleRoute` |
| `/perfil` | Perfil do usuário | `ProtectedRoute` |

### Professor/Coach (role="coach")
| Rota | Página | Guard |
|---|---|---|
| `/dashboard` | Dashboard principal | `ProtectedRoute` + `RoleRoute` |
| `/alunos` | Lista de alunos | `ProtectedRoute` + `RoleRoute` |
| `/alunos/:id` | Perfil individual do aluno | `ProtectedRoute` + `RoleRoute` |
| `/biblioteca` | Biblioteca de templates de treino | `ProtectedRoute` + `RoleRoute` |
| `/biblioteca/:id/editar` | Editor de template | `ProtectedRoute` + `RoleRoute` |
| `/perfil` | Perfil do usuário | `ProtectedRoute` |

**`*`** → Página 404

---

## Edge Functions (Supabase / Deno)

Todas com `verify_jwt=false` no `config.toml` (auth validada manualmente dentro das funções).

| Função | Tipo de acesso | Responsabilidade |
|---|---|---|
| `teacher-admin-actions` | Autenticado (professor) | Criar aluno com senha temporária, resetar acesso, alterar status, aprovar pagamento, ativar plano Pro |
| `automation-dispatch` | Interno (secret) | Automações agendadas: varredura de pagamentos, geração de alertas, expiração |
| `integration-webhook` | Público (webhook) | Recebe eventos de gateways/terceiros, valida assinatura, roteia |
| `secure-ops` | Interno (secret) | Operações de service role, provisionamento de conta, mutações sensíveis |
| `auth-public-actions` | Público | Fluxo público de auth (`request_password_reset`) sem autenticação prévia |

**Utilitários compartilhados em `_shared/`:**
- `auth.ts` — Validação de usuário, cheque de papel (coach/student)
- `cors.ts` — Headers CORS
- `env.ts` — Carregamento de variáveis e secrets
- `http.ts` — Envelopes de resposta padronizados
- `supabase.ts` — Criação de cliente (JWT user e service role)
- `email.ts` — Envio de e-mail via Resend

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

| Bucket | Visibilidade | Quem escreve |
|---|---|---|
| `student-profile-photos` | Público | Autenticados |
| `payment-proofs` | Privado | Autenticados |
| `exercise-media` | Público | Professores |

---

## Integrações Externas

| Serviço | Status | Uso |
|---|---|---|
| **Supabase** | Ativo | DB, Auth, Storage, Edge Functions |
| **Resend** | Ativo | E-mails transacionais (senha temporária, reset de senha) |
| **Vercel** | Ativo | Hospedagem do frontend SPA |
| **Gateway de pagamento** | Mocked | Estrutura pronta, sem gateway real integrado |

---

## Variáveis de Ambiente

```bash
# .env (frontend)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=https://sanoplus.online
VITE_SUPABASE_FUNCTIONS_REGION=

# Secrets (Supabase Edge Functions)
RESEND_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTOMATION_SECRET=
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
- Validações de schema com Zod nos formulários
