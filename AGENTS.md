# AGENTS.md — NossoCRM

## Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint` (zero warnings enforced)
- **Typecheck**: `npm run typecheck`
- **Tests**: `npm test` (watch) | `npm run test:run` (single run) | `npx vitest path/to/file.test.ts` (single file)

## Architecture
- **Next.js 16 (App Router)**: routes in `app/`, protected routes under `app/(protected)/`
- **Supabase**: Auth + Postgres + RLS. Clients in `lib/supabase/` (client/server/service-role)
- **Proxy auth**: `proxy.ts` + `lib/supabase/middleware.ts` (not middleware.ts); excludes `/api/*`
- **State**: TanStack Query with facades in `context/`, queries in `lib/query/`
- **Cache**: Single Source of Truth pattern (see Cache Rules below)
- **AI**: SDK v6, chat via `/api/ai/chat`, tools in `lib/ai/tools.ts` (always filter by `organization_id`)

## Cache Rules (CRITICAL)
- **One cache per entity**: All operations (CRUD, Realtime, optimistic) use the SAME cache
- **Deals**: Always use `[...queryKeys.deals.lists(), 'view']` for all mutations
- **Other entities**: Use `queryKeys.{entity}.lists()` for mutations
- **NEVER use** `queryKeys.*.list({ filter })` for optimistic updates - those are separate caches
- **Prefer** `setQueryData` over `invalidateQueries` for instant UI updates

## Code Style
- TypeScript 5.x strict, React 19, Tailwind CSS v4, Radix UI primitives
- Shared components in `components/`, feature modules in `features/`
- Imports: use `@/` alias (e.g., `@/lib/utils`, `@/components/ui`)
- Naming: camelCase for variables/functions, PascalCase for components/types
- Tests: Vitest + happy-dom + React Testing Library; place `.test.ts(x)` files alongside source

## ⚡ n8n Automation & Skills
You have access to **n8n-mcp** and **n8n-skills** to build and manage workflows.

### Available Skills
Reference these skills in `n8n-skills/skills/` when performing n8n tasks:
1. **n8n-mcp-tools-expert**: `n8n-skills/skills/n8n-mcp-tools-expert/SKILL.md` (Use for ALL n8n tool interactions)
2. **Workflow Patterns**: `n8n-skills/skills/n8n-workflow-patterns/SKILL.md` (Use when designing new workflows)
3. **Expression Syntax**: `n8n-skills/skills/n8n-expression-syntax/SKILL.md` (Use when writing n8n expressions)
4. **Node Configuration**: `n8n-skills/skills/n8n-node-configuration/SKILL.md` (Use when configuring complex nodes)

### Workflow Development Process
1. **Always** read `n8n-mcp-tools-expert` skill first.
2. **Search Templates**: Use `search_templates` before building from scratch.
3. **Validate**: Use `validate_node` and `validate_workflow` at every step.
4. **Attribution**: When using templates, attribute the author.
