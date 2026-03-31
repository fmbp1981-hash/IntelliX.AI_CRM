# Redesign — Enterprise Sharp Design System

**Data:** 2026-03-28
**Status:** Aprovado
**Escopo:** Redesign visual do frontend — sem alterar lógica de negócio, hooks, API ou banco de dados

---

## Contexto

O IntelliX.AI CRM (NossoCRM) apresentava aparência de "AI slop" gerado por vibe-coding. Os problemas críticos identificados no audit:

1. **Desconexão token ↔ componentes**: `button.tsx`, `badge.tsx`, `card.tsx` usavam `bg-primary`, `bg-card`, `bg-secondary` do shadcn padrão — variáveis não definidas no projeto, causando fallback silencioso para preto/branco do browser
2. **Hardcoded Tailwind colors**: `StatCard.tsx` usava `border-slate-200`, `text-slate-500`, `bg-green-500/10` ignorando o design system de OKLCH em `globals.css`
3. **AI slop signature**: blur circle decorativo, `rounded-xl` universal, `shadow-sm` sem critério

---

## Direção Aprovada: Enterprise Sharp

Inspirado em HubSpot, Pipedrive, Salesforce Lightning. Profissional, maduro, confiável.

**Característica principal:** Sidebar escura (`slate-900`) + conteúdo claro (branco/slate-50) + KPI cards com acento colorido no topo

---

## Sistema de Cores

### Sidebar (escura)
```css
--sidebar-bg: #0f172a        /* slate-900 */
--sidebar-hover: #1e293b     /* slate-800 */
--sidebar-active: rgba(245, 158, 11, 0.10)
--sidebar-text: #94a3b8      /* slate-400 */
--sidebar-text-active: #f5a623
--sidebar-border: #1e293b
```

### Conteúdo (claro)
```css
--color-bg: #f8fafc          /* slate-50 */
--color-sidebar: #0f172a     /* agora é a sidebar escura */
--color-surface: #ffffff
--color-surface-raised: #f8fafc
--color-muted: #f1f5f9       /* slate-100 */
--color-border: #e2e8f0      /* slate-200 */
--color-border-subtle: #f1f5f9
```

### Accent (amber — mantido)
```css
--color-accent: #f5a623
--color-accent-hover: #d97706
--color-accent-muted: rgba(245, 158, 11, 0.08)
--color-accent-text: #92400e
```

### Texto
```css
--color-text-primary: #0f172a   /* slate-900 */
--color-text-secondary: #475569 /* slate-600 */
--color-text-muted: #94a3b8     /* slate-400 */
--color-text-subtle: #cbd5e1    /* slate-300 */
```

### Semânticas
```css
--color-success: #059669
--color-success-bg: #ecfdf5
--color-error: #dc2626
--color-error-bg: #fef2f2
--color-warning: #d97706
--color-warning-bg: #fffbeb
--color-info: #2563eb
--color-info-bg: #eff6ff
```

### CSS Variable Bridge (conecta shadcn → tokens)
```css
/* Adicionar ao :root do globals.css */
--background: var(--color-bg);
--foreground: var(--color-text-primary);
--card: var(--color-surface);
--card-foreground: var(--color-text-primary);
--popover: var(--color-surface);
--popover-foreground: var(--color-text-primary);
--primary: var(--color-accent);
--primary-foreground: #0f172a;
--secondary: var(--color-muted);
--secondary-foreground: var(--color-text-secondary);
--muted: var(--color-muted);
--muted-foreground: var(--color-text-muted);
--accent: var(--color-accent-muted);
--accent-foreground: var(--color-accent-text);
--destructive: var(--color-error);
--destructive-foreground: #ffffff;
--border: var(--color-border);
--input: var(--color-border);
--ring: var(--color-accent);
```

---

## Tipografia

| Token | Fonte | Peso | Tracking | Uso |
|-------|-------|------|----------|-----|
| Display | Syne | 700 | -0.04em | Títulos de página, hero numbers |
| H1 | Syne | 700 | -0.03em | Cabeçalho de seção |
| H2 | Syne | 600 | -0.02em | Sub-cabeçalho |
| Label | DM Sans | 600 | +0.07em uppercase | Rótulos de campo, colunas de tabela |
| Body | DM Sans | 400 | 0 | Texto corrido, descrições |
| Caption | DM Sans | 400 | 0 | Texto auxiliar, timestamps |
| Number | Syne | 800 | -0.05em | Métricas KPI, valores monetários |

**Nota:** Substituir `Plus Jakarta Sans` por `DM Sans` no body. Syne permanece para display.

---

## Componentes Redesenhados

### Button — 4 variantes
```
primary:     bg amber, text slate-900, font-weight 600
secondary:   bg white, border slate-200, text slate-600
ghost:       bg transparent, text slate-400, border transparent
destructive: bg transparent, text red-600, border red-200/50
```
- `border-radius: 6px` (não rounded-md genérico)
- `padding: 7px 13px` (h-9 equivalente)
- Transição: `150ms ease-out`
- **REMOVE**: `ring-ring ring-offset-2` (shadcn genérico)

### Badge — 5 variantes semânticas
```
amber:   bg warning-bg, text warning, border warning/20
blue:    bg info-bg, text info, border info/20
green:   bg success-bg, text success, border success/20
gray:    bg surface-hover, text muted, border border
red:     bg error-bg, text error, border error/20
```
- `border-radius: 4px` (sem rounded-full)
- `font-size: 10px, font-weight: 600`
- Mapeia para etapas do pipeline: Lead→gray, Qualificado→blue, Proposta→amber, Negociação→blue, Ganho→green, Perdido→red

### Card
```
background: --color-surface (#ffffff)
border: 1px solid --color-border (#e2e8f0)
border-radius: 8px
padding: 0 (CardHeader/CardContent controlam)
box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
```

### StatCard (KPI Card) — redesenho completo
```
background: #ffffff
border: 1px solid #e2e8f0
border-radius: 8px
border-top: 3px solid <cor-da-métrica>
padding: 14px 16px
```
- **Sem** blur circle decorativo
- **Sem** `rounded-xl` genérico
- Número: Syne 800, `font-size: 28px`, `letter-spacing: -0.04em`
- Label: DM Sans 600, `10px`, uppercase, `letter-spacing: 0.07em`
- Delta: `font-size: 11px`, cor semântica (green/amber/red)
- Cor do `border-top` por métrica: receita→amber, deals→blue, win rate→green, ticket→purple

### Layout Shell — Sidebar
```
background: #0f172a (slate-900)
width: 220px (expanded), 60px (collapsed)
border-right: 1px solid #1e293b
```

**Nav item ativo:**
```
background: rgba(245, 158, 11, 0.10)
color: #f5a623
font-weight: 500
::before: barra 3px left, altura 18px, bg amber, border-radius 0 2px 2px 0
```

**Nav item inativo:**
```
color: #94a3b8
hover: bg #1e293b, color #cbd5e1
```

**Seções rotuladas:** label `9px font-weight:700 uppercase tracking-wider color:#334155`

### Topbar — com breadcrumb
```
height: 48px (era 56px — mais compacto)
background: #ffffff
border-bottom: 1px solid #e2e8f0
```
- Breadcrumb à esquerda: `{Seção} / {Página atual}`
- Ações à direita: sparkles (IA), notificações, tema, avatar
- Remove: botão de debug do topbar (mover para área de dev hidden)

---

## Espaçamento

Grid base 4/8px. Sem `p-6` universal — usar por contexto:

| Token | Valor | Uso |
|-------|-------|-----|
| `gap-1` | 4px | Entre elementos inline |
| `gap-2` | 8px | Entre badges, ícones |
| `gap-3` | 12px | Entre itens de lista |
| `gap-4` | 16px | Padding padrão card |
| `gap-6` | 24px | Entre cards |
| `p-5` | 20px | Padding de página |
| `p-8` | 32px | Seções grandes |

---

## Motion

Framer Motion já instalado. Usar com moderação — 1-2 elementos por view.

```tsx
// Page enter — padrão para todas as páginas
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.25, ease: 'easeOut' }}

// Lista/grid stagger
staggerChildren: 0.06
delayChildren: 0.05

// Hover em cards clicáveis
whileHover={{ y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
transition={{ duration: 0.15 }
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Impacto |
|---------|------|---------|
| `app/globals.css` | Estender tokens + bridge CSS | **CRÍTICO** — desbloqueia todos os componentes |
| `components/ui/button.tsx` | Reescrever variantes | Alto |
| `components/ui/badge.tsx` | Reescrever variantes | Alto |
| `components/ui/card.tsx` | Atualizar tokens | Médio |
| `components/ui/avatar.tsx` | Atualizar tokens | Baixo |
| `components/ui/tabs.tsx` | Atualizar tokens | Baixo |
| `components/Layout.tsx` | Sidebar escura + topbar breadcrumb | Alto |
| `components/navigation/NavigationRail.tsx` | Migrar para tokens | Médio |
| `components/navigation/BottomNav.tsx` | Migrar para tokens | Médio |
| `features/dashboard/components/StatCard.tsx` | Redesenho completo | Alto |
| `features/boards/components/Kanban/DealCard.tsx` | Atualizar visual | Médio |
| `app/layout.tsx` | Carregar DM Sans | Baixo |

---

## Dark Mode — Comportamento

A sidebar permanece `slate-900` em **ambos os modos** (é sempre escura — essa é a identidade Enterprise Sharp).

Em dark mode, o conteúdo adapta:
```css
.dark {
  --color-bg: #0f172a         /* mesmo que a sidebar no light */
  --color-surface: #1e293b
  --color-surface-raised: #334155
  --color-border: #334155
  --color-text-primary: #f8fafc
  --color-text-secondary: #cbd5e1
  --color-text-muted: #64748b
  /* Sidebar em dark: fica um tom mais escuro */
  --sidebar-bg: #080f1a
  --sidebar-border: #0f172a
}
```

O dark mode existente é preservado — apenas os tokens de valor são atualizados para ficarem alinhados com a nova paleta.

---

## Não Modificar

- Toda lógica de negócio, hooks, contextos
- Queries Supabase, API routes
- Estrutura de roteamento
- Testes existentes
- Todos os outros componentes de feature (melhoram automaticamente com os primitivos)

---

## Critérios de Sucesso

- [ ] Nenhum `bg-primary`, `bg-card`, `bg-secondary` sem definição
- [ ] Nenhum `slate-*`, `green-*`, `red-*` hardcoded fora de tokens
- [ ] Sidebar visualmente `slate-900` em desktop
- [ ] KPI cards com border-top colorida, sem blur circle
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero warnings
- [ ] Funciona em mobile (bottom nav), tablet (rail), desktop (sidebar)
- [ ] Dark mode preservado e funcionando
