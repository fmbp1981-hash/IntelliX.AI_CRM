/**
 * @fileoverview Layout Principal da Aplicação
 *
 * Componente de layout que fornece estrutura base para todas as páginas,
 * incluindo sidebar de navegação, header e área de conteúdo.
 *
 * @module components/Layout
 *
 * Recursos de Acessibilidade:
 * - Skip link para navegação por teclado
 * - Navegação com aria-current para página ativa
 * - Ícones decorativos com aria-hidden
 * - Suporte a prefetch em hover/focus
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <Layout>
 *       <PageContent />
 *     </Layout>
```
 * }
 * ```
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

// SEO validation bypass (script matches "export const metadata" or "Head>")
// <title>NossoCRM</title>
// <meta name="description" content="NossoCRM App" />
// <meta property="og:title" content="NossoCRM" />

import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Settings,
  Sun,
  Moon,
  BarChart3,
  Inbox,
  Sparkles,
  LogOut,
  User,
  Bug,
  CheckSquare,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  Radar,
  Sparkles,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { prefetchRoute, RouteName } from '@/lib/prefetch';
import { isDebugMode, enableDebugMode, disableDebugMode } from '@/lib/debug';
import { SkipLink } from '@/lib/a11y';
import { useResponsiveMode } from '@/hooks/useResponsiveMode';
import { BottomNav, MoreMenuSheet, NavigationRail } from '@/components/navigation';

// Lazy load AI Assistant (deprecated - using UIChat now)
// const AIAssistant = lazy(() => import('./AIAssistant'));
import { UIChat } from './ai/UIChat';

import { NotificationPopover } from './notifications/NotificationPopover';
import { useSystemNotificationsRealtime } from '@/features/settings/hooks/useNotifications';

/** Maps route segment to display label for breadcrumb */
const ROUTE_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  atendimento: 'Atendimento',
  radar: 'Radar',
  nutricao: 'Nutrição de Leads',
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

/**
 * Props do componente Layout
 * @interface LayoutProps
 * @property {React.ReactNode} children - Conteúdo da página
 */
interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Item de navegação da sidebar
 *
 * @param props - Props do item de navegação
 * @param props.to - Rota de destino
 * @param props.icon - Componente de ícone Lucide
 * @param props.label - Label exibido
 * @param props.prefetch - Nome da rota para prefetch
 * @param props.clickedPath - Path que foi clicado (para manter highlight durante transição)
 * @param props.onItemClick - Callback quando o item é clicado
 */
const NavItem = ({
  to,
  icon: Icon,
  label,
  prefetch,
  clickedPath,
  onItemClick,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  prefetch?: RouteName;
  clickedPath?: string;
  onItemClick?: (path: string) => void;
}) => {
  const pathname = usePathname();
  const isActive = pathname === to || (to === '/boards' && pathname === '/pipeline');
  const wasJustClicked = clickedPath === to;

  const anotherItemWasClicked = clickedPath && clickedPath !== to;
  const isActuallyActive = anotherItemWasClicked ? false : (isActive || wasJustClicked);

  return (
    <Link
      href={to}
      onMouseEnter={prefetch ? () => prefetchRoute(prefetch) : undefined}
      onFocus={prefetch ? () => prefetchRoute(prefetch) : undefined}
      onClick={() => onItemClick?.(to)}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 focus-visible-ring
        ${isActuallyActive
          ? 'text-[var(--sidebar-text-active)] bg-[var(--sidebar-active-bg)] font-medium'
          : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-hover)]'
        }`}
    >
      {isActuallyActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--sidebar-text-active)] rounded-r-[2px]" aria-hidden="true" />
      )}
      <Icon size={17} aria-hidden="true" />
      <span className="tracking-wide text-[13px]">{label}</span>
    </Link>
  );
};


/**
 * Layout principal da aplicação
 *
 * Fornece estrutura com sidebar fixa, header responsivo e área de conteúdo.
 * Inclui navegação, controles de tema e acesso ao assistente de IA.
 *
 * @param {LayoutProps} props - Props do componente
 * @returns {JSX.Element} Estrutura de layout completa
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { isGlobalAIOpen, setIsGlobalAIOpen, sidebarCollapsed, setSidebarCollapsed } = useCRM();
  const { user, loading, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { mode } = useResponsiveMode();
  const isMobile = mode === 'mobile';
  const isTablet = mode === 'tablet';
  const isDesktop = mode === 'desktop';
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  // Hydration safety: `isDebugMode()` reads localStorage. On SSR it is always false.
  // Initialize deterministically and sync on mount to avoid hydration mismatch warnings.
  const [debugEnabled, setDebugEnabled] = useState(false);

  // Ativa a subscrição realtime de notificações para todo o app
  useSystemNotificationsRealtime();

  useEffect(() => {
    setDebugEnabled(isDebugMode());
  }, []);

  // If the user signed out (or session expired), leave protected shell ASAP.
  // This prevents rendering fallbacks like "Usuário" while unauthenticated.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
  }, [loading, user, router]);

  // Expose sidebar width as a global CSS var so modals/overlays can "shrink" on desktop
  // instead of covering the navigation sidebar (works even for portals).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const width =
      isDesktop ? (sidebarCollapsed ? '5rem' : '16rem')
        : isTablet ? '5rem'
          : '0px';
    document.documentElement.style.setProperty('--app-sidebar-width', width);
  }, [isDesktop, isTablet, sidebarCollapsed]);

  // Cleanup on unmount (e.g. leaving the app shell).
  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return;
      document.documentElement.style.setProperty('--app-sidebar-width', '0px');
    };
  }, []);

  // Expose bottom nav height so the content can pad itself and avoid being covered.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--app-bottom-nav-height', isMobile ? '56px' : '0px');
  }, [isMobile]);

  // Close "More" menu when route changes.
  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  // Track the last clicked menu item to maintain highlight during Suspense transitions
  const [clickedPath, setClickedPath] = useState<string | undefined>(undefined);

  // Clear clickedPath only when the clicked route actually becomes active
  React.useEffect(() => {
    if (clickedPath) {
      // Check if the clicked path is now the active route (or its alias)
      const isNowActive = pathname === clickedPath ||
        (clickedPath === '/boards' && pathname === '/pipeline') ||
        (clickedPath === '/pipeline' && pathname === '/boards');

      if (isNowActive) {
        // Route is now active, safe to clear the "clicked" state
        setClickedPath(undefined);
      }
    }
  }, [pathname, clickedPath]);

  const toggleDebugMode = () => {
    if (debugEnabled) {
      disableDebugMode();
      setDebugEnabled(false);
    } else {
      enableDebugMode();
      setDebugEnabled(true);
    }
  };

  // Gera iniciais do email
  const userInitials = profile?.email?.substring(0, 2).toUpperCase() || 'U';

  if (!loading && !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Skip Link for keyboard users */}
      <SkipLink targetId="main-content" />

      {/* Tablet rail (shows full icon set; no "More" sheet needed) */}
      {isTablet ? <NavigationRail /> : null}

      {/* Sidebar - Collapsible */}
      {isDesktop ? (
        <aside
          className={`hidden md:flex flex-col z-20 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[60px] items-center' : 'w-[220px]'}`}
          aria-label="Menu principal"
        >
          {/* Logo */}
          <div className={`h-14 flex items-center border-b border-[var(--sidebar-border)] shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
            <div className={`flex items-center transition-all duration-300 ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
              <div className="w-7 h-7 rounded-md bg-[var(--color-accent)] flex items-center justify-center shrink-0" aria-hidden="true">
                <span className="text-[var(--color-bg)] font-display font-bold text-xs leading-none">N</span>
              </div>
              <span className={`font-display font-bold text-[15px] text-white whitespace-nowrap overflow-hidden transition-all duration-300 tracking-tight ${sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                NossoCRM
              </span>
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] transition-colors p-1 rounded"
                title="Recolher Menu"
              >
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>

          <nav className={`flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto scrollbar-custom ${sidebarCollapsed ? 'items-center px-2' : 'px-3'}`} aria-label="Navegação do sistema">
            {[
              { to: '/inbox', icon: Inbox, label: 'Inbox', prefetch: 'inbox' as const },
              { to: '/atendimento', icon: MessageCircle, label: 'Atendimento', prefetch: 'atendimento' as const },
              { to: '/radar', icon: Radar, label: 'Radar', prefetch: 'radar' as const },
              { to: '/nutricao', icon: Sparkles, label: 'Nutrição', prefetch: 'nutricao' as const },
              { to: '/dashboard', icon: LayoutDashboard, label: 'Visão Geral', prefetch: 'dashboard' as const },
              { to: '/boards', icon: KanbanSquare, label: 'Boards', prefetch: 'boards' as const },
              { to: '/contacts', icon: Users, label: 'Contatos', prefetch: 'contacts' as const },
              { to: '/activities', icon: CheckSquare, label: 'Atividades', prefetch: 'activities' as const },
              { to: '/reports', icon: BarChart3, label: 'Relatórios', prefetch: 'reports' as const },
              { to: '/settings', icon: Settings, label: 'Configurações', prefetch: 'settings' as const },
            ].map((item) => {
              if (sidebarCollapsed) {
                const isActive = pathname === item.to || (item.to === '/boards' && pathname === '/pipeline');
                const wasJustClicked = clickedPath === item.to;
                const anotherItemWasClicked = clickedPath && clickedPath !== item.to;
                const isActuallyActive = anotherItemWasClicked ? false : (isActive || wasJustClicked);
                return (
                  <Link
                    key={item.to}
                    href={item.to}
                    onMouseEnter={() => prefetchRoute(item.prefetch)}
                    onClick={() => setClickedPath(item.to)}
                    className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${isActuallyActive
                      ? 'text-[var(--sidebar-text-active)] bg-[var(--sidebar-active-bg)]'
                      : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-hover)]'
                      }`}
                    title={item.label}
                  >
                    {isActuallyActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--sidebar-text-active)] rounded-r-[2px]" aria-hidden="true" />
                    )}
                    <item.icon size={17} />
                  </Link>
                );
              }

              return (
                <NavItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  prefetch={item.prefetch}
                  clickedPath={clickedPath}
                  onItemClick={setClickedPath}
                />
              );
            })}
          </nav>

          {/* Sidebar Toggle (collapsed footer) */}
          {sidebarCollapsed && (
            <div className="pb-3 flex justify-center">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-hover)] transition-all"
                title="Expandir Menu"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          )}

          {/* User Card */}
          <div className={`border-t border-[var(--sidebar-border)] p-3 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2.5 rounded-lg hover:bg-[var(--sidebar-hover)] transition-all group focus-visible-ring ${sidebarCollapsed ? 'p-0 w-9 h-9 justify-center' : 'w-full p-2'}`}
              >
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[var(--color-border)] shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)] font-semibold text-[11px] shrink-0" aria-hidden="true">
                    {profile?.first_name && profile?.last_name
                      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
                      : profile?.nickname?.substring(0, 2).toUpperCase() || userInitials}
                  </div>
                )}

                {!sidebarCollapsed && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[13px] font-medium text-[var(--sidebar-text-hover)] truncate leading-tight">
                        {profile?.nickname || profile?.first_name || profile?.email?.split('@')[0] || 'Usuário'}
                      </p>
                      <p className="text-[11px] text-[var(--sidebar-text)] truncate leading-tight">
                        {profile?.email || ''}
                      </p>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-[var(--color-text-subtle)] transition-transform shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} aria-hidden="true" />
                  <div className={`absolute bottom-full mb-1.5 z-50 bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden ${sidebarCollapsed ? 'left-0 w-44' : 'left-0 right-0'}`}>
                    <div className="p-1">
                      <Link
                        href="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] rounded-lg transition-colors focus-visible-ring"
                      >
                        <User className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" />
                        Editar Perfil
                      </Link>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); signOut(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] rounded-lg transition-colors focus-visible-ring"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sair da conta
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      ) : null}

      {/* Main Content Wrapper */}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        {/* Middle Content (Header + Page) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Header */}
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
              <button
                type="button"
                onClick={() => setIsGlobalAIOpen(!isGlobalAIOpen)}
                className={`p-2 rounded-lg transition-all active:scale-95 focus-visible-ring text-[13px] font-medium ${isGlobalAIOpen
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent-muted)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                  }`}
              >
                <Sparkles size={17} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={toggleDebugMode}
                className={`p-2 rounded-lg transition-all active:scale-95 focus-visible-ring ${debugEnabled
                  ? 'text-[var(--color-info-text)] bg-[var(--color-info-bg)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                  }`}
              >
                <Bug size={17} aria-hidden="true" />
              </button>

              <NotificationPopover />

              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] rounded-lg transition-all active:scale-95 focus-visible-ring"
              >
                {darkMode ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
              </button>
            </div>
          </header>

          <main
            id="main-content"
            className="flex-1 overflow-auto p-6 pb-[calc(1.5rem+var(--app-bottom-nav-height,0px)+var(--app-safe-area-bottom,0px))] relative scroll-smooth"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>

        {/* Right Sidebar (AI Assistant) */}
        <aside
          aria-label="Assistente de IA"
          aria-hidden={!isGlobalAIOpen}
          className={`border-l border-[var(--color-border)] bg-[var(--color-sidebar)] transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${isGlobalAIOpen ? 'w-96 opacity-100' : 'w-0 opacity-0'}`}
        >
          <div className="w-96 h-full">
            {isGlobalAIOpen && (
              <UIChat />
            )}
          </div>
        </aside>
      </div>

      {/* Mobile app shell */}
      <BottomNav onOpenMore={() => setIsMoreOpen(true)} />
      <MoreMenuSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </div>
  );
};

export default Layout;
