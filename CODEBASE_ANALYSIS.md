# Análise da codebase — `crmia-next`

Data: 2025-12-14

> Objetivo: documentar **arquitetura real**, fluxos críticos e principais riscos técnicos, com foco em Next.js + Supabase + camada de IA.

---

## Stack e dependências relevantes

- **Next.js 16.0.9** (App Router)
- **React 19.2.1**
- **TypeScript 5** (com `strict: false`, mas `strictNullChecks: true`)
- **TailwindCSS 4**
- **TanStack Query v5**
- **Supabase**
  - `@supabase/ssr` (browser + server SSR client)
  - `@supabase/supabase-js` (admin/static)
- **AI**
  - `ai` + `@ai-sdk/react` + `@ai-sdk/rsc` (AI SDK v6)
  - `@ai-sdk/google` (Gemini)
- Testes: **Vitest** (config atual executa apenas `test/**/*.ts`)

Observação importante: ainda existe **`react-router-dom`** na base, sugerindo migração de SPA → Next.

---

## Visão geral da arquitetura (de fato)

A base está em **migração** de um app SPA (React Router) para **Next App Router**, com duas “camadas” convivendo:

1) **Next App Router** (pasta `app/`) define URLs reais.
2) **Features** (pasta `features/`) contém páginas e módulos de UI “legados”, que são importados de forma dinâmica e **client-only** (`ssr: false`) pelos `app/(protected)/*/page.tsx`.

Além disso, existe um **`App.tsx`** que monta rotas via **HashRouter** (`react-router-dom`). Esse arquivo parece ser o “app legado” e *não é* um entrypoint padrão do Next.

---

## Estrutura por pastas (mapa mental)

### `app/` (rotas Next)
- `app/layout.tsx`: root layout (font, theme base)
- `app/login/page.tsx`: login (Supabase browser client)
- `app/(protected)/layout.tsx`: providers + `Layout` (UI shell)
- `app/(protected)/*/page.tsx`: wrappers que fazem `dynamic(() => import('@/features/...'), { ssr:false })`
- `app/api/ai/chat/route.ts`: endpoint de chat com **AI SDK v6** + ferramentas (ToolLoopAgent)
- `app/api/chat/route.ts`: reexport do endpoint acima
- `app/auth/callback/route.ts`: callback de OAuth/magic link (exchange code)

### `components/`
- `Layout.tsx`: shell principal (sidebar/nav/header) usando `next/link` + `usePathname`
- `components/ai/UIChat.tsx`: chat UI via `@ai-sdk/react` consumindo `/api/ai/chat`

### `context/`
- `AuthContext.tsx`: sessão/usuário/perfil; também chama `rpc('is_instance_initialized')`
- `CRMContext.tsx`: “fachada” legada agregando deals/contacts/boards/settings/etc
- `AIContext.tsx`, `AIChatContext.tsx`: contexto do assistente e contexto de página

### `lib/supabase/`
- `client.ts`: browser client (retorna `null` se envs faltarem)
- `server.ts`: server client (usa `!` nos envs; pode quebrar se envs faltarem)
- `middleware.ts`: função `updateSession()` para refresh + redirects
- `ai-proxy.ts`: cliente para chamar Edge Function `ai-proxy` (legado)

### `lib/ai/`
- `crmAgent.ts`: cria ToolLoopAgent (Google model) + injeta contexto
- `tools.ts`: implementa ferramentas (CRUD/queries) via **service role**
- `actions.tsx`: server action com `streamUI` (parece uma implementação paralela/legada)

### `services/`
- `geminiService.ts`: camada grande de IA via `ai-proxy` (Edge Function) com LGPD/consent/rate-limit

---

## Fluxos críticos

### 1) Autenticação (Supabase)

- **Client**: `lib/supabase/client.ts` cria `createBrowserClient` se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem configuradas e não forem placeholder.
- **Server**: `lib/supabase/server.ts` usa `createServerClient` com `cookies()`; porém **não valida envs** (usa `!`).

### 2) Proteção de rotas

- Existe uma função de “middleware” em `lib/supabase/middleware.ts`.
- Não existe `middleware.ts` na raiz. Em vez disso há `proxy.ts`, seguindo a convenção oficial do **Next.js 16+** (o que antes era “Middleware” foi renomeado para **Proxy**).

✅ Status (confirmado via docs oficiais do Next): `proxy.ts` **é** reconhecido pelo Next 16+ quando:
- o arquivo está na raiz do projeto (ou em `src/`)
- exporta **uma única função** (default export ou named `proxy`)
- `config.matcher` (se usado) contém **constantes** (valores dinâmicos são ignorados)

Observações importantes da doc:
- Mesmo que você exclua `/_next/data` via matcher negativo, o Next pode **ainda invocar** o Proxy para `/_next/data/*` por segurança (para evitar “buracos” onde a página está protegida mas o data route não).
- Proxy é “último recurso” e roda muito cedo na pipeline; evite lógica pesada e seja criterioso no matcher.

Além disso, o componente `components/ProtectedRoute.tsx` (React Router) **não se aplica** ao App Router, e o `app/(protected)/layout.tsx` não usa esse componente.

### 3) Chat/IA (implementação nova — AI SDK v6)

- UI: `components/ai/UIChat.tsx` usa `useChat()` e envia contexto (boardId/dealId/etc) no body.
- API: `app/api/ai/chat/route.ts`
  1. valida usuário (`supabase.auth.getUser()`)
  2. busca `organization_id` em `profiles`
  3. busca `ai_google_key` e `ai_model` em `organization_settings`
  4. cria agente via `lib/ai/crmAgent.ts` (ToolLoopAgent)
  5. stream via `createAgentUIStreamResponse`

Pontos fortes:
- chave do provedor é **por organização**, buscada server-side
- contexto é enriquecido (board/stages/métricas)

Pontos de atenção:
- `lib/ai/tools.ts` usa **service role** para bypass RLS.
  - Isso é aceitável se (e somente se) `organizationId` for confiável (hoje vem do profile server-side).
  - Ainda assim, exige auditoria: logs + validações + limites.

### 4) IA (implementação legada — Edge Function `ai-proxy`)

- `services/geminiService.ts` chama `callAIProxy()` (Edge Function). Tem tratamento de consentimento e rate limit.

⚠️ A base tem **duas arquiteturas de IA** convivendo:
- Nova: `/api/ai/chat` + tools + approval
- Legada: `ai-proxy` + `geminiService`

Isso tende a gerar divergência de comportamento e de schema (vide abaixo).

---

## Inconsistências técnicas relevantes (achados)

### A) Rotas públicas citadas vs rotas reais
- `updateSession()` trata `/join` como público.
- Não há rota `app/join` no App Router (nem `pages/join.tsx`).
- Há `pages/JoinPage.tsx`, mas esse arquivo parece ser **componente legada**, não rota Next.

### B) Next middleware possivelmente não ativo
- Arquivo “middleware” está como `proxy.ts`.
- Se isso não for suportado pelo Next, o comportamento real é:
  - sem refresh de sessão
  - sem redirect server-side

### C) Divergência de schema nas camadas de IA
- `lib/ai/tools.ts` consulta `deals`, `board_stages`, `organization_id`.
- `lib/ai/actions.tsx` (RSC streamUI) consulta `deals` com `.eq('user_id', user.id)` e usa `stages` (não `board_stages`).

Isso indica código “duplo” (antigo/novo) ou migração incompleta.

### D) Testes não cobrem o front
- `vitest.config.ts` roda apenas `test/**/*.{test,spec}.ts`.
- Existem testes `.test.tsx` em `components/` e `features/`, mas **não entram** no include.

---

## Recomendações priorizadas

### P0 (segurança/produção)
1. Confirmar/ajustar middleware do Next:
   - se `proxy.ts` não for suportado, renomear para `middleware.ts`.
2. Padronizar estratégia de proteção:
   - server-side via middleware + redirects
   - evitar depender de `react-router-dom` para auth.
3. Remover hardcode de URL Supabase em `components/ai/ToolInvocation.tsx`.

### P1 (coerência e manutenção)
1. Decidir um único “sistema de rotas” (Next App Router) e remover o que restou de React Router (ou isolar completamente).
2. Unificar camada de IA:
   - escolher `/api/ai/chat` (AI SDK v6) como caminho principal
   - migrar os casos do `geminiService` gradualmente ou manter o proxy como backend único
3. Consolidar schema e queries (`organization_id` vs `user_id`, `board_stages` vs `stages`).

### P2 (DX/qualidade)
1. Ajustar Vitest para incluir testes de UI (happy-dom) se desejado.
2. Subir `strict: true` gradualmente (há comentários indicando migração).

---

## “Como eu sei que isso é verdade?” (evidências)

- Rotas de IA: `app/api/ai/chat/route.ts` e reexport em `app/api/chat/route.ts`.
- Middleware/auth: `lib/supabase/middleware.ts` e `proxy.ts`.
- Migração SPA → Next: `App.tsx` (HashRouter) + wrappers `app/(protected)/*/page.tsx` com `dynamic(..., { ssr:false })`.
- Duas IAs: `services/geminiService.ts` + `lib/supabase/ai-proxy.ts` (legado) vs `lib/ai/*` (novo).

