# Edge Functions Tests

Este diretório contém os testes de contrato para as Edge Functions do NossoCRM.

## 🚀 Executando os Testes

```bash
# Todos os testes
npm run test:edge

# Watch mode (re-executa ao salvar)
npm run test:edge:watch

# Diretamente com Deno
deno test --allow-env supabase/functions/
```

## 📁 Estrutura de Testes

```
supabase/functions/
├── _shared/
│   ├── test-utils.ts      # Utilities compartilhados para testes
│   └── shared.test.ts     # Testes de auth.ts, cors.ts, rate-limiter
├── ai-proxy/
│   └── index.test.ts      # Testes de contrato para todas as 13 AI actions
└── user-management.test.ts  # Testes para setup, create, delete, list, invite, accept
```

## 🎯 O Que Testamos

### AI Proxy (`ai-proxy/index.test.ts`)

| Action | Contrato Testado |
|--------|-----------------|
| `generateBoardStructure` | Input: description, lifecycleStages. Output: boardName, stages[], automationSuggestions[] |
| `refineBoardWithAI` | Input: currentBoard, userInstruction. Output: message, board (nullable) |
| `analyzeLead` | Output: score (1-10), observations[], nextActions[], objections[] |
| `generateEmailDraft` | Output: draft (string) |
| `generateRescueMessage` | Output: message (string) |
| `chatWithCRM` | Output: response (string) |
| `generateBirthdayMessage` | Output: message (string) |
| `parseNaturalLanguageAction` | Output: action, parameters, confidence |

**Também testamos:**
- Rate limiting (60/min, 1000/day)
- Consent verification (AI_DATA_PROCESSING, AI_BIOMETRIC_DATA)
- Request validation (auth header, action/data)
- Error responses (401, 400, 403, 429)
- Handler routing (evita fallback para genericAIHandler)
- Prompt output validation (Tailwind colors, JSON format)

### User Management (`user-management.test.ts`)

| Function | Testes |
|----------|--------|
| `setup-instance` | Input validation, idempotency check, output contract |
| `create-user` | Admin authorization, input validation, org inheritance, rollback |
| `delete-user` | Admin auth, cross-tenant protection (VULN-004), self-deletion prevention |
| `list-users` | Output structure (users + pendingInvites), org filtering |
| `invite-users` | Admin auth, email/role validation, token generation, duplicate prevention |
| `accept-invite` | Token validation (expired, used, wrong email), user creation, audit logging |
| `export-user-data` | Rate limiting (3/hour), data collection, LGPD notice, audit logging |

### Shared Utilities (`_shared/shared.test.ts`)

| Module | Testes |
|--------|--------|
| `auth.ts` | AuthError, requireAuth, requireAdmin, validateSameOrganization |
| `cors.ts` | getCorsHeaders, corsPreflightResponse, jsonResponse, errorResponse |
| Rate Limiter | Configuration, identifiers, limit checks, 429 responses |

## 🔴 Por Que Esses Testes Existem

Esses testes foram criados após bugs de produção que não foram detectados pelos 1000+ testes do frontend:

1. **400 Bad Request** - `getApiKey()` buscava coluna inexistente `ai_api_key_encrypted`
2. **Preview com cores erradas** - Prompt retornava hex colors em vez de Tailwind classes
3. **Chat retornando "undefined"** - `refineBoardWithAI` não tinha handler dedicado

**Problema raiz:** O frontend mockava `callAIProxy`, então o código das Edge Functions nunca era testado.

Esses testes validam os **contratos** de cada Edge Function, garantindo que:
- Input esperado está correto
- Output tem a estrutura esperada
- Erros são tratados corretamente
- Handlers específicos são usados (não caem em genericAIHandler)

## 🧪 Tipo de Testes

Estes são **testes de contrato** que:
- ✅ Validam estrutura de input/output
- ✅ Verificam lógica de validação
- ✅ Testam fluxos de erro
- ✅ Garantem que rotas existem
- ❌ NÃO chamam Supabase real
- ❌ NÃO chamam Gemini real

Para testes de integração completos, use o Supabase CLI local:
```bash
supabase start
supabase functions serve ai-proxy --env-file .env.local
```

## 📝 Adicionando Novos Testes

1. Crie um arquivo `.test.ts` na pasta da função
2. Importe os asserts do Deno:
```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
```

3. Use `describe/it` para organizar:
```typescript
describe('myFunction', () => {
  describe('Input Validation', () => {
    it('should require field X', () => {
      // ...
    });
  });
});
```

4. Execute: `npm run test:edge`

## 🔗 Relacionados

- [Copilot Instructions](/.github/copilot-instructions.md) - Convenções do projeto
- [Security Audit Report](/SECURITY_AUDIT_REPORT.md) - Vulnerabilidades corrigidas
