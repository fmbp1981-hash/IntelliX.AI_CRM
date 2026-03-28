# Enterprise Sharp Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic "AI slop" visual defaults with the Enterprise Sharp design system — dark sidebar (slate-900), white content area, KPI cards with colored top border, proper design tokens throughout.

**Architecture:** Fix the CSS variable bridge gap (shadcn's `--primary`/`--card` vars are undefined → silent browser fallback). Add always-dark sidebar tokens. Rewrite the 5 broken UI primitives. Redesign StatCard and refresh navigation components.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Framer Motion, `next/font/google`

---

## File Map

| File | Action | Why |
|------|--------|-----|
| `app/globals.css` | Modify | Add shadcn bridge vars + always-dark sidebar tokens |
| `app/layout.tsx` | Modify | Swap Plus Jakarta Sans → DM Sans |
| `components/ui/button.tsx` | Rewrite | Uses undefined `bg-primary`, `bg-destructive`, `bg-secondary` |
| `components/ui/badge.tsx` | Rewrite | Uses undefined vars + generic `rounded-full` |
| `components/ui/card.tsx` | Modify | Uses undefined `bg-card text-card-foreground` |
| `components/ui/avatar.tsx` | Modify | `bg-muted` undefined → `bg-[var(--color-muted)]` |
| `components/ui/tabs.tsx` | Modify | `bg-muted`, `ring-offset-background`, `bg-background` undefined |
| `components/Layout.tsx` | Modify | Sidebar → always dark; header → white + breadcrumb |
| `components/navigation/NavigationRail.tsx` | Modify | Hardcoded `text-slate-500`, `hover:bg-slate-100` → tokens |
| `components/navigation/BottomNav.tsx` | Modify | Hardcoded `border-slate-200`, `bg-white/85` → tokens |
| `features/dashboard/components/StatCard.tsx` | Rewrite | Remove blur circle, add `border-top` colored accent |
| `features/boards/components/Kanban/DealCard.tsx` | Modify | Hardcoded `bg-white dark:bg-slate-800`, `border-slate-200` → tokens |

---

## Task 1: globals.css — CSS Bridge + Sidebar Tokens

**Files:**
- Modify: `app/globals.css`

This is the critical foundation. Every other task depends on this. Two additions:
1. **Shadcn CSS bridge**: maps shadcn's default var names (`--primary`, `--card`, etc.) to our real tokens — fixes the silent black/white fallback
2. **Always-dark sidebar tokens**: `--sidebar-bg` stays `#0f172a` regardless of light/dark mode

- [ ] **Step 1: Add the shadcn CSS bridge to `:root` in `globals.css`**

Locate the closing `}` of the `:root` block (after `--chart-tooltip-text`). Add the following block immediately before it:

```css
  /* ── Shadcn/UI CSS Bridge ──────────────────────────────
   * Shadcn components reference these vars by name.
   * Without them, the browser falls back to black/white.
   * We map them to our real tokens so they work correctly.
   * ──────────────────────────────────────────────────── */
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

  /* ── Sidebar (always dark — Enterprise Sharp identity) ──
   * These vars are NEVER overridden in .dark.
   * The sidebar is slate-900 in both light and dark mode.
   * ──────────────────────────────────────────────────── */
  --sidebar-bg: #0f172a;
  --sidebar-hover: #1e293b;
  --sidebar-active-bg: rgba(245, 158, 11, 0.10);
  --sidebar-text: #94a3b8;
  --sidebar-text-active: #f5a623;
  --sidebar-text-hover: #cbd5e1;
  --sidebar-border: #1e293b;
  --sidebar-section-label: #334155;
```

- [ ] **Step 2: Add `.dark` overrides for sidebar (slightly darker) and bridge vars**

Locate the closing `}` of the `.dark` block (after `--chart-tooltip-text`). Add immediately before it:

```css
  /* Sidebar gets one tone darker in dark mode */
  --sidebar-bg: #080f1a;
  --sidebar-border: #0f172a;
  --sidebar-section-label: #1e293b;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: zero errors (CSS changes don't affect TypeScript)

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: add shadcn CSS bridge and always-dark sidebar tokens to globals.css"
```

---

## Task 2: layout.tsx — Swap Font to DM Sans

**Files:**
- Modify: `app/layout.tsx`

Replace `Plus_Jakarta_Sans` with `DM_Sans` as the body font. Syne stays for display.

- [ ] **Step 1: Replace the font import and loader in `app/layout.tsx`**

Find:
```tsx
import { Plus_Jakarta_Sans, Syne } from 'next/font/google'
```

Replace with:
```tsx
import { DM_Sans, Syne } from 'next/font/google'
```

- [ ] **Step 2: Replace the font configuration object**

Find:
```tsx
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})
```

Replace with:
```tsx
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})
```

- [ ] **Step 3: Update the body className to use the new variable**

Find:
```tsx
      <body className={`${jakartaSans.variable} ${syne.variable} font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text-primary)]`}>
```

Replace with:
```tsx
      <body className={`${dmSans.variable} ${syne.variable} font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text-primary)]`}>
```

- [ ] **Step 4: Update the `@theme` block in `globals.css` to reference the new variable**

In `app/globals.css`, find:
```css
  --font-sans: 'Plus Jakarta Sans', var(--font-jakarta), sans-serif;
```

Replace with:
```css
  --font-sans: 'DM Sans', var(--font-sans), sans-serif;
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: replace Plus Jakarta Sans with DM Sans as body font"
```

---

## Task 3: button.tsx — Rewrite Variants

**Files:**
- Modify: `components/ui/button.tsx`

The current variants use `bg-primary`, `bg-destructive`, `bg-secondary` — undefined in the project, causing silent browser fallback. Replace with explicit tokens.

- [ ] **Step 1: Rewrite `buttonVariants` in `components/ui/button.tsx`**

Replace the entire `buttonVariants` `cva(...)` call:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-accent)] text-[#0f172a] hover:bg-[var(--color-accent-hover)] active:scale-[0.98]",
        secondary:
          "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] active:scale-[0.98]",
        ghost:
          "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-secondary)] active:scale-[0.98]",
        destructive:
          "bg-transparent border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] active:scale-[0.98]",
        outline:
          "bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] active:scale-[0.98]",
        link: "bg-transparent text-[var(--color-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[13px] py-[7px] rounded-[6px]",
        sm: "h-8 px-3 py-1.5 rounded-[6px] text-xs",
        lg: "h-10 px-5 py-2.5 rounded-[6px]",
        icon: "h-9 w-9 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat: rewrite Button variants with Enterprise Sharp tokens"
```

---

## Task 4: badge.tsx — Rewrite with Semantic Variants

**Files:**
- Modify: `components/ui/badge.tsx`

Current: 4 shadcn variants using undefined vars + `rounded-full`. Target: 5 semantic variants (amber, blue, green, gray, red) with `border-radius: 4px`.

- [ ] **Step 1: Rewrite `badgeVariants` in `components/ui/badge.tsx`**

Replace the entire `badgeVariants` `cva(...)` call:

```tsx
const badgeVariants = cva(
  "inline-flex items-center border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors",
  {
    variants: {
      variant: {
        amber:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
        blue:
          "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info)]/20",
        green:
          "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20",
        gray:
          "bg-[var(--color-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
        red:
          "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]/20",
        // Legacy aliases so existing usages don't break
        default:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
        secondary:
          "bg-[var(--color-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
        destructive:
          "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]/20",
        outline:
          "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 2: Add `rounded-[4px]` to the base class in the same `cva(...)` call**

The base string should start with:
```tsx
"inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors",
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add components/ui/badge.tsx
git commit -m "feat: rewrite Badge with 5 semantic variants and sharp border-radius"
```

---

## Task 5: card.tsx — Fix Token References

**Files:**
- Modify: `components/ui/card.tsx`

`bg-card` and `text-card-foreground` are now defined via the CSS bridge from Task 1, so they'll work. But we also want to align the visual spec: `border-radius: 8px`, correct shadow, and no hardcoded padding.

- [ ] **Step 1: Update `Card` root div classes in `components/ui/card.tsx`**

Find:
```tsx
        className={cn(
            "rounded-lg border bg-card text-card-foreground shadow-sm",
            className
        )}
```

Replace with:
```tsx
        className={cn(
            "rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
            className
        )}
```

- [ ] **Step 2: Update `CardDescription` to use token**

Find:
```tsx
        className={cn("text-sm text-muted-foreground", className)}
```

Replace with:
```tsx
        className={cn("text-sm text-[var(--color-text-muted)]", className)}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add components/ui/card.tsx
git commit -m "feat: update Card to use explicit design tokens"
```

---

## Task 6: avatar.tsx + tabs.tsx — Minor Token Fixes

**Files:**
- Modify: `components/ui/avatar.tsx`
- Modify: `components/ui/tabs.tsx`

Both use `bg-muted`, `bg-background`, `ring-offset-background` which are now defined via the CSS bridge (Task 1), so they'll render correctly without code changes. But `tabs.tsx` also has `ring-offset-background` in focus states which can be cleaned up.

- [ ] **Step 1: Update `AvatarFallback` in `avatar.tsx`**

Find:
```tsx
            "flex h-full w-full items-center justify-center rounded-full bg-muted",
```

Replace with:
```tsx
            "flex h-full w-full items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-text-muted)]",
```

- [ ] **Step 2: Update `TabsList` in `tabs.tsx`**

Find:
```tsx
            "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
```

Replace with:
```tsx
            "inline-flex h-10 items-center justify-center rounded-[6px] bg-[var(--color-muted)] p-1 text-[var(--color-text-muted)]",
```

- [ ] **Step 3: Update `TabsTrigger` in `tabs.tsx`**

Find:
```tsx
            "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
```

Replace with:
```tsx
            "inline-flex items-center justify-center whitespace-nowrap rounded-[4px] px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--color-surface)] data-[state=active]:text-[var(--color-text-primary)] data-[state=active]:shadow-sm",
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add components/ui/avatar.tsx components/ui/tabs.tsx
git commit -m "feat: migrate Avatar and Tabs to explicit design tokens"
```

---

## Task 7: Layout.tsx — Dark Sidebar + White Topbar + Breadcrumb

**Files:**
- Modify: `components/Layout.tsx`

Three changes:
1. Sidebar `bg` → `var(--sidebar-bg)` (always dark)
2. Nav item text/hover colors → sidebar-specific tokens
3. Header: change from `bg-[var(--color-sidebar)]` to `bg-[var(--color-surface)]` (white) + add breadcrumb

- [ ] **Step 1: Update `aside` (sidebar) background and border in `Layout.tsx`**

Find:
```tsx
          className={`hidden md:flex flex-col z-20 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[60px] items-center' : 'w-[220px]'}`}
```

Replace with:
```tsx
          className={`hidden md:flex flex-col z-20 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[60px] items-center' : 'w-[220px]'}`}
```

- [ ] **Step 2: Update sidebar logo area border**

Find:
```tsx
          <div className={`h-14 flex items-center border-b border-[var(--color-border)] shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
```

Replace with:
```tsx
          <div className={`h-14 flex items-center border-b border-[var(--sidebar-border)] shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
```

- [ ] **Step 3: Update sidebar logo text color**

Find:
```tsx
              <span className={`font-display font-bold text-[15px] text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden transition-all duration-300 tracking-tight ${sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
```

Replace with:
```tsx
              <span className={`font-display font-bold text-[15px] text-white whitespace-nowrap overflow-hidden transition-all duration-300 tracking-tight ${sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
```

- [ ] **Step 4: Update sidebar collapse button color**

Find:
```tsx
                className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] transition-colors p-1 rounded"
```

Replace with:
```tsx
                className="text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] transition-colors p-1 rounded hover:bg-[var(--sidebar-hover)]"
```

- [ ] **Step 5: Update `NavItem` component classes**

Find the `NavItem` component className string:
```tsx
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 focus-visible-ring
        ${isActuallyActive
          ? 'text-[var(--color-accent)] bg-[var(--color-accent-muted)] font-medium'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
        }`}
```

Replace with:
```tsx
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm transition-all duration-150 focus-visible-ring
        ${isActuallyActive
          ? 'text-[var(--sidebar-text-active)] bg-[var(--sidebar-active-bg)] font-medium'
          : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-hover)]'
        }`}
```

- [ ] **Step 6: Update `NavItem` active indicator bar color**

Find:
```tsx
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--color-accent)] rounded-r-full" aria-hidden="true" />
```

Replace with:
```tsx
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--sidebar-text-active)] rounded-r-[2px]" aria-hidden="true" />
```

- [ ] **Step 7: Update collapsed nav item classes**

Find (collapsed nav item link):
```tsx
                    className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${isActuallyActive
                      ? 'text-[var(--color-accent)] bg-[var(--color-accent-muted)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                      }`}
```

Replace with:
```tsx
                    className={`relative w-9 h-9 rounded-[6px] flex items-center justify-center transition-all duration-150 ${isActuallyActive
                      ? 'text-[var(--sidebar-text-active)] bg-[var(--sidebar-active-bg)]'
                      : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-hover)]'
                      }`}
```

- [ ] **Step 8: Update collapsed active indicator bar**

Find (in the collapsed branch):
```tsx
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[var(--color-accent)] rounded-r-full" aria-hidden="true" />
```

Replace with:
```tsx
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--sidebar-text-active)] rounded-r-[2px]" aria-hidden="true" />
```

- [ ] **Step 9: Update sidebar expand button (collapsed footer)**

Find:
```tsx
                className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] transition-all"
```

Replace with:
```tsx
                className="flex items-center justify-center w-9 h-9 rounded-[6px] text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-hover)] transition-all"
```

- [ ] **Step 10: Update sidebar bottom user card border and background**

Find:
```tsx
          <div className={`border-t border-[var(--color-border)] p-3 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
```

Replace with:
```tsx
          <div className={`border-t border-[var(--sidebar-border)] p-3 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
```

- [ ] **Step 11: Update user menu button hover**

Find:
```tsx
                className={`flex items-center gap-2.5 rounded-lg hover:bg-[var(--color-muted)] transition-all group focus-visible-ring ${sidebarCollapsed ? 'p-0 w-9 h-9 justify-center' : 'w-full p-2'}`}
```

Replace with:
```tsx
                className={`flex items-center gap-2.5 rounded-[6px] hover:bg-[var(--sidebar-hover)] transition-all group focus-visible-ring ${sidebarCollapsed ? 'p-0 w-9 h-9 justify-center' : 'w-full p-2'}`}
```

- [ ] **Step 12: Update user name and email text colors in sidebar**

Find:
```tsx
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-tight">
```

Replace with:
```tsx
                      <p className="text-[13px] font-medium text-[var(--sidebar-text-hover)] truncate leading-tight">
```

Find:
```tsx
                      <p className="text-[11px] text-[var(--color-text-subtle)] truncate leading-tight">
```

Replace with:
```tsx
                      <p className="text-[11px] text-[var(--sidebar-text)] truncate leading-tight">
```

- [ ] **Step 13: Update user dropdown background (appears over sidebar)**

Find:
```tsx
                  <div className={`absolute bottom-full mb-1.5 z-50 bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden ${sidebarCollapsed ? 'left-0 w-44' : 'left-0 right-0'}`}>
```

Replace with:
```tsx
                  <div className={`absolute bottom-full mb-1.5 z-50 bg-[var(--color-surface)] rounded-[8px] shadow-2xl border border-[var(--color-border)] overflow-hidden ${sidebarCollapsed ? 'left-0 w-44' : 'left-0 right-0'}`}>
```

- [ ] **Step 14: Add breadcrumb helper function before the `Layout` component**

Add this code after the imports section, before `const Layout: React.FC<LayoutProps> = ...`:

```tsx
/** Maps route segment to display label for breadcrumb */
const ROUTE_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  atendimento: 'Atendimento',
  radar: 'Radar',
  dashboard: 'Visão Geral',
  boards: 'Boards',
  pipeline: 'Pipeline',
  contacts: 'Contatos',
  activities: 'Atividades',
  reports: 'Relatórios',
  settings: 'Configurações',
  profile: 'Perfil',
};

function getBreadcrumb(pathname: string): { section: string; current: string } | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const section = ROUTE_LABELS[parts[0]] ?? parts[0];
  const current = parts.length > 1 ? (ROUTE_LABELS[parts[parts.length - 1]] ?? parts[parts.length - 1]) : '';
  return { section, current };
}
```

- [ ] **Step 15: Update header element — white background and add breadcrumb**

Find:
```tsx
          <header className="h-14 bg-[var(--color-sidebar)] border-b border-[var(--color-border)] flex items-center justify-end px-5 z-40 shrink-0" role="banner">
            <div className="flex items-center gap-1.5">
```

Replace with:
```tsx
          <header className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-5 z-40 shrink-0" role="banner">
            {/* Breadcrumb */}
            {(() => {
              const crumb = getBreadcrumb(pathname);
              if (!crumb) return <div />;
              return (
                <div className="flex items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
                  <span className="text-[var(--color-text-muted)]">{crumb.section}</span>
                  {crumb.current && (
                    <>
                      <span className="text-[var(--color-text-subtle)]">/</span>
                      <span className="text-[var(--color-text-primary)] font-medium">{crumb.current}</span>
                    </>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center gap-1.5">
```

- [ ] **Step 16: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 17: Commit**

```bash
git add components/Layout.tsx
git commit -m "feat: enforce dark sidebar with sidebar-* tokens, add topbar breadcrumb"
```

---

## Task 8: NavigationRail.tsx — Migrate to Tokens

**Files:**
- Modify: `components/navigation/NavigationRail.tsx`

Replaces hardcoded `text-slate-500`, `hover:bg-slate-100`, `bg-primary-500/10`, `text-primary-600`, `border-primary-200`.

- [ ] **Step 1: Update the logo/brand section in NavigationRail**

Find:
```tsx
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">
          N
        </div>
```

Replace with:
```tsx
        <div className="w-10 h-10 bg-[var(--color-accent)] rounded-[8px] flex items-center justify-center text-[#0f172a] font-bold text-lg">
          N
        </div>
```

- [ ] **Step 2: Update nav link classes in NavigationRail**

Find:
```tsx
                  isActive
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-900/50'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
```

Replace with:
```tsx
                  isActive
                    ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent)]/20'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-secondary)]'
```

- [ ] **Step 3: Update active icon class**

Find:
```tsx
                <Icon className={cn('h-5 w-5', isActive ? 'text-primary-500' : '')} aria-hidden="true" />
```

Replace with:
```tsx
                <Icon className={cn('h-5 w-5', isActive ? 'text-[var(--color-accent)]' : '')} aria-hidden="true" />
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add components/navigation/NavigationRail.tsx
git commit -m "feat: migrate NavigationRail to design tokens"
```

---

## Task 9: BottomNav.tsx — Migrate to Tokens

**Files:**
- Modify: `components/navigation/BottomNav.tsx`

Replaces hardcoded `border-slate-200`, `bg-white/85`, `text-slate-600`.

- [ ] **Step 1: Update the `nav` className in BottomNav**

Find:
```tsx
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:hidden',
        'border-t border-slate-200 dark:border-white/10',
        'bg-white/85 dark:bg-dark-card/85 backdrop-blur',
        'pb-[var(--app-safe-area-bottom,0px)]'
      )}
```

Replace with:
```tsx
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:hidden',
        'border-t border-[var(--color-border)]',
        'bg-[var(--color-surface)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface)]/85',
        'pb-[var(--app-safe-area-bottom,0px)]'
      )}
```

- [ ] **Step 2: Update "More" button classes**

Find:
```tsx
                  'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
```

Replace with:
```tsx
                  'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
```

- [ ] **Step 3: Update nav link inactive classes**

Find:
```tsx
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
```

Replace with:
```tsx
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
```

- [ ] **Step 4: Update active icon class**

Find:
```tsx
              <Icon className={cn('h-5 w-5', isActive ? 'text-primary-500' : '')} aria-hidden="true" />
```

Replace with:
```tsx
              <Icon className={cn('h-5 w-5', isActive ? 'text-[var(--color-accent)]' : '')} aria-hidden="true" />
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add components/navigation/BottomNav.tsx
git commit -m "feat: migrate BottomNav to design tokens"
```

---

## Task 10: StatCard.tsx — Full KPI Redesign

**Files:**
- Modify: `features/dashboard/components/StatCard.tsx`

Complete rewrite. Remove: blur circle, `slate-*` hardcoded colors, `rounded-xl`, shadow-sm. Add: `border-top: 3px solid <metric-color>`, Syne number font, DM Sans label, semantic delta colors.

The `color` prop changes meaning: instead of a Tailwind class like `bg-blue-500`, it becomes a CSS hex color string used for the `border-top` accent.

- [ ] **Step 1: Rewrite `StatCard.tsx` entirely**

```tsx
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext: string;
  subtextPositive?: boolean;
  /** CSS color value for the top border accent. e.g. "#f5a623" or "var(--color-info)" */
  accentColor?: string;
  icon: React.ElementType;
  onClick?: () => void;
  comparisonLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  subtextPositive,
  accentColor = 'var(--color-accent)',
  icon: Icon,
  onClick,
  comparisonLabel = 'vs período anterior',
}) => {
  const hasDelta = subtextPositive !== undefined;
  const TrendIcon = !hasDelta ? Minus : subtextPositive ? TrendingUp : TrendingDown;
  const deltaColor = !hasDelta
    ? 'text-[var(--color-text-muted)]'
    : subtextPositive
    ? 'text-[var(--color-success)]'
    : 'text-[var(--color-error)]';

  return (
    <div
      onClick={onClick}
      style={{ borderTop: `3px solid ${accentColor}` }}
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] p-4 transition-all duration-150${onClick ? ' cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-px' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)] mb-2"
          >
            {title}
          </p>
          <p
            className="font-display text-[28px] font-extrabold leading-none tracking-[-0.04em] text-[var(--color-text-primary)] tabular-nums"
          >
            {value}
          </p>
        </div>
        <div
          className="p-2.5 rounded-[6px] shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
        >
          <Icon
            size={18}
            strokeWidth={2}
            style={{ color: accentColor }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${deltaColor}`}>
          <TrendIcon size={11} strokeWidth={2.5} aria-hidden="true" />
          {subtext}
        </span>
        <span className="text-[11px] text-[var(--color-text-subtle)]">{comparisonLabel}</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Check usages of StatCard to update `color` prop to `accentColor`**

Find all callers of `StatCard`:

```bash
grep -r "StatCard" --include="*.tsx" C:/Projects/IntelliX.AI_CRM/features/dashboard --include="*.tsx" -l
```

Open each file. The old prop was `color="bg-blue-500"` etc. Update each usage to pass `accentColor` with hex values:

| Old `color` | New `accentColor` |
|-------------|-------------------|
| `bg-blue-500` | `var(--color-info)` |
| `bg-emerald-500` or `bg-green-500` | `var(--color-success)` |
| `bg-amber-500` or `bg-orange-500` | `var(--color-accent)` |
| `bg-red-500` | `var(--color-error)` |
| `bg-indigo-500` | `#7c3aed` |
| `bg-cyan-500` | `var(--color-info)` |

For the 4 standard dashboard KPIs per the spec:
- Receita → `accentColor="var(--color-accent)"` (amber)
- Deals → `accentColor="var(--color-info)"` (blue)
- Win rate → `accentColor="var(--color-success)"` (green)
- Ticket médio → `accentColor="#7c3aed"` (purple)

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors. If there are errors about `color` prop, it's because callers still pass the old prop — fix those callers.

- [ ] **Step 4: Commit**

```bash
git add features/dashboard/components/StatCard.tsx
git commit -m "feat: redesign StatCard as KPI card with colored border-top, remove blur circle"
```

---

## Task 11: DealCard.tsx — Token Migration

**Files:**
- Modify: `features/boards/components/Kanban/DealCard.tsx`

Replace hardcoded `bg-white dark:bg-slate-800`, `border-slate-200 dark:border-slate-700/50`, `bg-green-50 dark:bg-green-900/20`, `bg-red-50 dark:bg-red-900/20`.

- [ ] **Step 1: Update `getCardClasses()` in DealCard.tsx**

Find:
```tsx
  const getCardClasses = () => {
    const baseClasses = `
      p-3 rounded-lg border-l-4 border-y border-r
      shadow-sm cursor-grab active:cursor-grabbing group hover:shadow-md transition-all relative select-none
    `;

    if (deal.isWon) {
      return `${baseClasses}
        bg-green-50 dark:bg-green-900/20
        border-green-200 dark:border-green-700/50
        ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : ''}`;
    }

    if (deal.isLost) {
      return `${baseClasses}
        bg-red-50 dark:bg-red-900/20
        border-red-200 dark:border-red-700/50
        ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'opacity-70'}`;
    }

    // Default - open deal
    return `${baseClasses}
      border-slate-200 dark:border-slate-700/50
      ${localDragging || isDragging ? 'bg-green-100 dark:bg-green-900 opacity-50 rotate-2 scale-95' : 'bg-white dark:bg-slate-800 opacity-100'}
      ${isRotting ? 'opacity-80 saturate-50 border-dashed' : ''}
    `;
  };
```

Replace with:
```tsx
  const getCardClasses = () => {
    const baseClasses =
      'p-3 rounded-[6px] border-l-4 border-y border-r cursor-grab active:cursor-grabbing group transition-all duration-150 relative select-none shadow-[0_1px_3px_rgba(0,0,0,0.06)]';

    if (deal.isWon) {
      return `${baseClasses} bg-[var(--color-success-bg)] border-[var(--color-success)]/30 ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'hover:shadow-[0_4px_8px_rgba(0,0,0,0.08)]'}`;
    }

    if (deal.isLost) {
      return `${baseClasses} bg-[var(--color-error-bg)] border-[var(--color-error)]/30 ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'opacity-70 hover:opacity-90'}`;
    }

    return `${baseClasses} bg-[var(--color-surface)] border-[var(--color-border)] ${localDragging || isDragging ? 'opacity-50 rotate-2 scale-95' : 'hover:shadow-[0_4px_8px_rgba(0,0,0,0.08)] hover:border-[var(--color-border-subtle)]'} ${isRotting ? 'opacity-80 saturate-50 border-dashed' : ''}`;
  };
```

- [ ] **Step 2: Update won/lost badge classes**

Find:
```tsx
          className="absolute -top-2 -right-2 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 p-1 rounded-full shadow-sm z-10 flex items-center gap-0.5"
```

Replace with:
```tsx
          className="absolute -top-2 -right-2 bg-[var(--color-success-bg)] text-[var(--color-success)] p-1 rounded-full shadow-sm z-10 flex items-center gap-0.5"
```

Find:
```tsx
          className="absolute -top-2 -right-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 p-1 rounded-full shadow-sm z-10 flex items-center gap-0.5"
```

Replace with:
```tsx
          className="absolute -top-2 -right-2 bg-[var(--color-error-bg)] text-[var(--color-error)] p-1 rounded-full shadow-sm z-10 flex items-center gap-0.5"
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4: Run full precheck**

Run: `npm run precheck:fast`
Expected: lint 0 warnings, typecheck 0 errors, tests pass

- [ ] **Step 5: Commit**

```bash
git add features/boards/components/Kanban/DealCard.tsx
git commit -m "feat: migrate DealCard to design tokens, remove hardcoded slate/green/red colors"
```

---

## Success Criteria Checklist

After all tasks complete, verify:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] No `bg-primary`, `bg-card`, `bg-secondary` without CSS bridge definition
- [ ] No `slate-*`, `green-*`, `red-*` hardcoded in migrated files
- [ ] Sidebar visually dark (slate-900) in desktop light mode
- [ ] Header/topbar visually white with breadcrumb
- [ ] KPI cards have colored top border, no blur circle
- [ ] Bottom nav uses token colors
- [ ] Dark mode: content area adapts, sidebar gets slightly darker
- [ ] Mobile (bottom nav), tablet (rail), desktop (sidebar) all render correctly
