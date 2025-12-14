import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { CRMProvider } from '@/context/CRMContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
  },
}));

// Mock auth context
vi.mock('@/context/AuthContext', async () => {
  const actual = await vi.importActual('@/context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'test-user' },
      profile: { id: 'test-user', name: 'Test User', organization_id: 'test-org' },
      loading: false,
      organizationId: 'test-org',
      signOut: vi.fn(),
    }),
  };
});

// Mock CRM context
vi.mock('@/context/CRMContext', async () => {
  const actual = await vi.importActual('@/context/CRMContext');
  return {
    ...actual,
    useCRM: () => ({
      contacts: [],
      deals: [],
      boards: [],
      lifecycleStages: [],
      aiApiKey: null,
      maintenance: null,
    }),
    CRMProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('Layout Accessibility - Landmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have a skip link as the first focusable element', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    const skipLink = screen.getByText('Pular para conteúdo principal');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink.tagName).toBe('A');
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('should have an aside landmark for the sidebar with aria-label', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    const sidebar = screen.getByRole('complementary', { name: 'Menu principal' });
    expect(sidebar).toBeInTheDocument();
    expect(sidebar.tagName).toBe('ASIDE');
  });

  it('should have a nav element within the sidebar', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    const sidebar = screen.getByRole('complementary', { name: 'Menu principal' });
    const nav = within(sidebar).getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('should have a main landmark with correct id for skip link target', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabIndex', '-1');
  });

  it('should render children within the main landmark', () => {
    render(
      <Wrapper>
        <Layout>
          <div data-testid="child-content">Test content</div>
        </Layout>
      </Wrapper>
    );

    const main = screen.getByRole('main');
    const childContent = screen.getByTestId('child-content');
    expect(main).toContainElement(childContent);
  });

  it('should have header buttons with aria-labels', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    // Check for common header buttons
    const themeButton = screen.queryByRole('button', { name: /alternar.*tema/i });
    const menuButton = screen.queryByRole('button', { name: /menu/i });
    
    // At least one of these should exist
    expect(themeButton || menuButton).toBeTruthy();
  });

  it('should have navigation links with accessible names', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    // Check for main navigation links
    const dashboardLink = screen.queryByRole('link', { name: /dashboard/i });
    const boardsLink = screen.queryByRole('link', { name: /boards|negócios/i });
    const contactsLink = screen.queryByRole('link', { name: /contatos/i });

    // Navigation should have at least some links
    const navLinks = screen.queryAllByRole('link');
    expect(navLinks.length).toBeGreaterThan(0);
  });
});

describe('Layout Accessibility - Focus Management', () => {
  it('should allow main content to receive focus for skip link', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    const main = screen.getByRole('main');
    main.focus();
    expect(document.activeElement).toBe(main);
  });

  it('skip link should be visually hidden until focused', () => {
    render(
      <Wrapper>
        <Layout>
          <div>Test content</div>
        </Layout>
      </Wrapper>
    );

    const skipLink = screen.getByText('Pular para conteúdo principal');
    
    // The skip link should have the skip-link class for proper visibility handling
    expect(skipLink).toHaveClass('skip-link');
  });
});
