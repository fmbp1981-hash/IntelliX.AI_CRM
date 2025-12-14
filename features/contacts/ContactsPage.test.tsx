/**
 * @fileoverview Testes de Integração e Comportamento para Filtros da Página de Contatos
 *
 * Este arquivo contém testes que verificam:
 * - Filtros de busca por texto (nome e email)
 * - Filtros por estágio do funil (LEAD, MQL, PROSPECT, CUSTOMER)
 * - Filtros por status (ACTIVE, INACTIVE, CHURNED, RISK)
 * - Filtros por data de criação (início e fim)
 * - Interações entre múltiplos filtros
 *
 * As chamadas de API são mockadas para isolar o comportamento do componente.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Contact, ContactStage, Company } from '@/types';

// ============================================================================
// MOCKS - Todos os vi.mock devem vir antes de qualquer import do código testado
// ============================================================================

// Mock do ToastContext
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
    showToast: vi.fn(),
  }),
}));

// Mock do AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { id: 'user-1', organization_id: 'org-1', role: 'admin' },
    organizationId: 'org-1',
    loading: false,
  }),
}));

// Mock do realtime sync (não precisa fazer nada nos testes)
vi.mock('@/lib/realtime', () => ({
  useRealtimeSync: vi.fn(),
}));

// Mock do DealsQuery - controlável via mockCreateDealMutate
const mockCreateDealMutate = vi.fn();
vi.mock('@/lib/query/hooks/useDealsQuery', () => ({
  useCreateDeal: () => ({ mutate: mockCreateDealMutate, isPending: false }),
}));

// Mock do BoardsQuery - controlável via mockBoardsData
let mockBoardsData: unknown[] = [];
vi.mock('@/lib/query/hooks/useBoardsQuery', () => ({
  useBoards: () => ({ data: mockBoardsData, isLoading: false }),
}));

// Mock dos serviços Supabase
const mockGetAllContacts = vi.fn();
const mockGetAllContactsPaginated = vi.fn();
const mockGetAllCompanies = vi.fn();
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockDeleteContact = vi.fn();
const mockHasDeals = vi.fn();
const mockCreateCompany = vi.fn();
const mockGetStageCounts = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
  contactsService: {
    getAll: () => mockGetAllContacts(),
    getAllPaginated: (...args: unknown[]) => mockGetAllContactsPaginated(...args),
    create: (data: unknown) => mockCreateContact(data),
    update: (id: string, data: unknown) => mockUpdateContact(id, data),
    delete: (id: string) => mockDeleteContact(id),
    hasDeals: (id: string) => mockHasDeals(id),
    getStageCounts: () => mockGetStageCounts(),
  },
  companiesService: {
    getAll: () => mockGetAllCompanies(),
    create: (data: unknown) => mockCreateCompany(data),
  },
}));

// Import após os mocks
import { ContactsPage } from './ContactsPage';

// ============================================================================
// DADOS DE TESTE
// ============================================================================

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const sixtyDaysAgo = new Date(today);
sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
const tenDaysAgo = new Date(today);
tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    organizationId: 'org-1',
    name: 'Maria Silva',
    email: 'maria@empresa.com',
    phone: '(11) 99999-0001',
    role: 'Gerente',
    companyId: 'company-1',
    clientCompanyId: 'company-1',
    avatar: '',
    notes: '',
    status: 'ACTIVE',
    stage: ContactStage.LEAD,
    totalValue: 0,
    createdAt: today.toISOString(),
    lastPurchaseDate: today.toISOString(),
  },
  {
    id: 'contact-2',
    organizationId: 'org-1',
    name: 'João Santos',
    email: 'joao@tech.com',
    phone: '(11) 99999-0002',
    role: 'Diretor',
    companyId: 'company-2',
    clientCompanyId: 'company-2',
    avatar: '',
    notes: '',
    status: 'ACTIVE',
    stage: ContactStage.MQL,
    totalValue: 5000,
    createdAt: tenDaysAgo.toISOString(),
    lastPurchaseDate: tenDaysAgo.toISOString(),
  },
  {
    id: 'contact-3',
    organizationId: 'org-1',
    name: 'Ana Costa',
    email: 'ana@startup.io',
    phone: '(11) 99999-0003',
    role: 'CEO',
    companyId: 'company-3',
    clientCompanyId: 'company-3',
    avatar: '',
    notes: '',
    status: 'ACTIVE',
    stage: ContactStage.PROSPECT,
    totalValue: 10000,
    createdAt: thirtyDaysAgo.toISOString(),
    lastPurchaseDate: sixtyDaysAgo.toISOString(), // Compra antiga = potencial RISK
  },
  {
    id: 'contact-4',
    organizationId: 'org-1',
    name: 'Carlos Mendes',
    email: 'carlos@corp.com.br',
    phone: '(11) 99999-0004',
    role: 'Comprador',
    companyId: 'company-4',
    clientCompanyId: 'company-4',
    avatar: '',
    notes: '',
    status: 'INACTIVE',
    stage: ContactStage.CUSTOMER,
    totalValue: 25000,
    createdAt: sixtyDaysAgo.toISOString(),
    lastPurchaseDate: sixtyDaysAgo.toISOString(),
  },
  {
    id: 'contact-5',
    organizationId: 'org-1',
    name: 'Paula Lima',
    email: 'paula@solutions.net',
    phone: '(11) 99999-0005',
    role: 'Vendedora',
    companyId: 'company-5',
    clientCompanyId: 'company-5',
    avatar: '',
    notes: '',
    status: 'CHURNED',
    stage: ContactStage.LEAD,
    totalValue: 0,
    createdAt: sixtyDaysAgo.toISOString(),
  },
];

const mockCompanies: Company[] = [
  { id: 'company-1', name: 'Empresa A', industry: 'Tecnologia', createdAt: today.toISOString() },
  { id: 'company-2', name: 'Tech Corp', industry: 'Software', createdAt: today.toISOString() },
  { id: 'company-3', name: 'Startup XYZ', industry: 'SaaS', createdAt: today.toISOString() },
  { id: 'company-4', name: 'Corp Brasil', industry: 'Varejo', createdAt: today.toISOString() },
  { id: 'company-5', name: 'Solutions Ltda', industry: 'Consultoria', createdAt: today.toISOString() },
];

// Mock Boards para testes de criação de deal
const mockSingleBoard = [
  {
    id: 'board-1',
    name: 'Pipeline de Vendas',
    description: 'Board principal de vendas',
    stages: [
      { id: 'stage-1', label: 'Novo', order: 0, color: 'blue' },
      { id: 'stage-2', label: 'Negociação', order: 1, color: 'yellow' },
      { id: 'stage-3', label: 'Fechado', order: 2, color: 'green' },
    ],
  },
];

const mockMultipleBoards = [
  {
    id: 'board-1',
    name: 'Pipeline de Vendas',
    description: 'Board principal de vendas',
    stages: [
      { id: 'stage-1', label: 'Novo', order: 0, color: 'blue' },
      { id: 'stage-2', label: 'Negociação', order: 1, color: 'yellow' },
    ],
  },
  {
    id: 'board-2',
    name: 'Pré-vendas',
    description: 'Qualificação de leads',
    stages: [
      { id: 'stage-3', label: 'Lead', order: 0, color: 'gray' },
      { id: 'stage-4', label: 'Qualificado', order: 1, color: 'green' },
    ],
  },
  {
    id: 'board-3',
    name: 'Onboarding',
    description: 'Implementação de clientes',
    stages: [
      { id: 'stage-5', label: 'Kickoff', order: 0, color: 'blue' },
      { id: 'stage-6', label: 'Go Live', order: 1, color: 'green' },
    ],
  },
];

// ============================================================================
// HELPER DE RENDERIZAÇÃO
// ============================================================================

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

interface RenderOptions {
  route?: string;
  contacts?: Contact[];
  companies?: Company[];
  boards?: typeof mockSingleBoard;
}

const renderContactsPage = (options: RenderOptions = {}) => {
  const {
    route = '/contacts',
    contacts = mockContacts,
    companies = mockCompanies,
    boards = [],
  } = options;

  // Configurar mock de boards
  mockBoardsData = boards;

  // Configurar mocks de API para retornar dados de teste
  mockGetAllContacts.mockResolvedValue({ data: contacts, error: null });
  mockGetAllCompanies.mockResolvedValue({ data: companies, error: null });

  // T022: Mock para getAllPaginated - simula filtragem server-side
  mockGetAllContactsPaginated.mockImplementation((pagination, filters) => {
    let filteredContacts = [...contacts];

    // Aplicar filtros server-side simulados
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredContacts = filteredContacts.filter(
        c => c.name.toLowerCase().includes(searchLower) || c.email.toLowerCase().includes(searchLower)
      );
    }
    if (filters?.stage && filters.stage !== 'ALL') {
      filteredContacts = filteredContacts.filter(c => c.stage === filters.stage);
    }
    if (filters?.status && filters.status !== 'ALL') {
      if (filters.status === 'RISK') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filteredContacts = filteredContacts.filter(
          c => c.status === 'ACTIVE' && (!c.lastPurchaseDate || new Date(c.lastPurchaseDate) < thirtyDaysAgo)
        );
      } else {
        filteredContacts = filteredContacts.filter(c => c.status === filters.status);
      }
    }
    if (filters?.dateStart) {
      filteredContacts = filteredContacts.filter(c => new Date(c.createdAt) >= new Date(filters.dateStart));
    }
    if (filters?.dateEnd) {
      const endDate = new Date(filters.dateEnd);
      endDate.setHours(23, 59, 59, 999);
      filteredContacts = filteredContacts.filter(c => new Date(c.createdAt) <= endDate);
    }

    const { pageIndex = 0, pageSize = 50 } = pagination || {};
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    const pagedContacts = filteredContacts.slice(start, end);

    return Promise.resolve({
      data: {
        data: pagedContacts,
        totalCount: filteredContacts.length,
        pageIndex,
        pageSize,
        hasMore: end < filteredContacts.length,
      },
      error: null,
    });
  });

  // Mock para update, create e delete retornarem sucesso
  mockUpdateContact.mockResolvedValue({ data: { id: 'contact-1' }, error: null });
  mockCreateContact.mockResolvedValue({ data: { id: 'new-contact' }, error: null });
  mockDeleteContact.mockResolvedValue({ data: null, error: null });
  mockHasDeals.mockResolvedValue({ hasDeals: false, dealCount: 0, deals: [] });
  mockCreateCompany.mockResolvedValue({ data: { id: 'new-company' }, error: null });

  // Mock de contagem por estágio baseado nos contatos de teste
  // mockContacts: Maria (LEAD), João (MQL), Ana (PROSPECT), Carlos (CUSTOMER), Paula (LEAD)
  const stageCounts: Record<string, number> = {};
  contacts.forEach(c => {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  });
  mockGetStageCounts.mockResolvedValue({ data: stageCounts, error: null });

  const queryClient = createQueryClient();
  const user = userEvent.setup();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ContactsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return {
    ...result,
    user,
    queryClient,
  };
};

// ============================================================================
// TESTES
// ============================================================================

describe('ContactsPage - Filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBoardsData = [];
    mockCreateDealMutate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockBoardsData = [];
  });

  // --------------------------------------------------------------------------
  // FILTRO DE BUSCA (SEARCH)
  // --------------------------------------------------------------------------
  describe('Filtro de Busca por Texto', () => {
    it('deve exibir o campo de busca na página', async () => {
      renderContactsPage();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('deve filtrar contatos por nome ao digitar no campo de busca', async () => {
      const { user } = renderContactsPage();

      // Aguardar carregamento inicial
      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Verificar que todos os contatos aparecem inicialmente
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      expect(screen.getByText('João Santos')).toBeInTheDocument();
      expect(screen.getByText('Ana Costa')).toBeInTheDocument();

      // Digitar no campo de busca
      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'Maria');

      // Verificar que apenas Maria aparece
      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos por email ao digitar no campo de busca', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('João Santos')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'tech.com');

      await waitFor(() => {
        expect(screen.getByText('João Santos')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
      });
    });

    it('deve exibir mensagem quando nenhum contato corresponde à busca', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'NomeQueNaoExiste');

      await waitFor(() => {
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });
    });

    it('deve ser case-insensitive na busca', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'MARIA');

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });
    });

    it('deve limpar o filtro quando o campo de busca é apagado', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'Maria');

      await waitFor(() => {
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });

      // Limpar o campo
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('João Santos')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // FILTRO POR ESTÁGIO (STAGE TABS)
  // --------------------------------------------------------------------------
  describe('Filtro por Estágio do Funil', () => {
    it('deve exibir os botões de estágio com contadores', async () => {
      renderContactsPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /leads/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /mql/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /prospects/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clientes/i })).toBeInTheDocument();
      });
    });

    it('deve filtrar contatos ao clicar no botão LEAD', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no botão de Leads
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      await user.click(leadsButton);

      // Apenas LEADs devem aparecer (Maria Silva e Paula Lima)
      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
        expect(screen.queryByText('Carlos Mendes')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos ao clicar no botão MQL', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('João Santos')).toBeInTheDocument();
      });

      const mqlButton = screen.getByRole('button', { name: /mql/i });
      await user.click(mqlButton);

      await waitFor(() => {
        expect(screen.getByText('João Santos')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos ao clicar no botão PROSPECT', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
      });

      const prospectsButton = screen.getByRole('button', { name: /prospects/i });
      await user.click(prospectsButton);

      await waitFor(() => {
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos ao clicar no botão CUSTOMER', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
      });

      const customersButton = screen.getByRole('button', { name: /clientes/i });
      await user.click(customersButton);

      await waitFor(() => {
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
      });
    });

    it('deve mostrar todos os contatos ao clicar em "Todos"', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Primeiro filtrar por um estágio
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      await user.click(leadsButton);

      await waitFor(() => {
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });

      // Depois clicar em "Todos"
      const allButton = screen.getByRole('button', { name: /todos/i });
      await user.click(allButton);

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('João Santos')).toBeInTheDocument();
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // FILTRO POR STATUS
  // --------------------------------------------------------------------------
  describe('Filtro por Status', () => {
    it('deve exibir o select de status', async () => {
      renderContactsPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/filtrar por status/i)).toBeInTheDocument();
      });
    });

    it('deve filtrar contatos ATIVOS', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'ACTIVE');

      await waitFor(() => {
        // Contatos ACTIVE: Maria, João, Ana
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('João Santos')).toBeInTheDocument();
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
        // Carlos é INACTIVE, Paula é CHURNED
        expect(screen.queryByText('Carlos Mendes')).not.toBeInTheDocument();
        expect(screen.queryByText('Paula Lima')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos INATIVOS', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'INACTIVE');

      await waitFor(() => {
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos CHURNED (Perdidos)', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'CHURNED');

      await waitFor(() => {
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar contatos em RISK (Ativos com compra antiga > 30 dias)', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'RISK');

      // Ana Costa é ACTIVE mas com lastPurchaseDate há 60 dias = RISK
      await waitFor(() => {
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
        // Maria e João têm compras recentes, não são RISK
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });
    });

    it('deve mostrar todos os contatos ao selecionar "Todos os Status"', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Primeiro filtrar
      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'INACTIVE');

      await waitFor(() => {
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
      });

      // Depois voltar para "ALL"
      await user.selectOptions(statusSelect, 'ALL');

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // FILTRO POR DATA
  // --------------------------------------------------------------------------
  describe('Filtro por Data de Criação', () => {
    it('deve exibir o botão de filtros avançados', async () => {
      renderContactsPage();

      await waitFor(() => {
        expect(screen.getByLabelText(/abrir filtros avançados/i)).toBeInTheDocument();
      });
    });

    it('deve abrir o painel de filtros de data ao clicar no botão', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(início\)/i)).toBeInTheDocument();
        expect(screen.getByText(/data de criação \(fim\)/i)).toBeInTheDocument();
      });
    });

    it('deve filtrar contatos por data de início', async () => {
      const { user, container } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir filtros
      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(início\)/i)).toBeInTheDocument();
      });

      // Usar uma data que filtre contatos antigos
      const filterDate = new Date(today);
      filterDate.setDate(filterDate.getDate() - 15); // Últimos 15 dias
      const dateValue = filterDate.toISOString().split('T')[0];

      // Encontrar o primeiro input de data (type="date")
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const dateInput = dateInputs[0] as HTMLInputElement;

      if (dateInput) {
        // Limpar e definir o valor usando fireEvent para inputs de data
        await user.clear(dateInput);
        await user.type(dateInput, dateValue);

        // Contatos criados nos últimos 15 dias: Maria (hoje), João (10 dias atrás)
        await waitFor(() => {
          expect(screen.getByText('Maria Silva')).toBeInTheDocument();
          expect(screen.getByText('João Santos')).toBeInTheDocument();
          // Ana (30 dias), Carlos e Paula (60 dias) devem ser filtrados
          expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
          expect(screen.queryByText('Carlos Mendes')).not.toBeInTheDocument();
          expect(screen.queryByText('Paula Lima')).not.toBeInTheDocument();
        });
      }
    });

    it('deve filtrar contatos por data de fim', async () => {
      const { user, container } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir filtros
      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(fim\)/i)).toBeInTheDocument();
      });

      // Data de fim de 45 dias atrás (exclui contatos recentes)
      const filterDate = new Date(today);
      filterDate.setDate(filterDate.getDate() - 45);
      const dateValue = filterDate.toISOString().split('T')[0];

      // Encontrar o segundo input de data (data de fim)
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const dateInput = dateInputs[1] as HTMLInputElement;

      if (dateInput) {
        await user.clear(dateInput);
        await user.type(dateInput, dateValue);

        // Contatos criados até 45 dias atrás: Carlos e Paula (60 dias)
        await waitFor(() => {
          expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
          expect(screen.getByText('Paula Lima')).toBeInTheDocument();
          // Maria (hoje), João (10 dias), Ana (30 dias) são mais recentes
          expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
          expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
        });
      }
    });

    it('deve exibir botão de limpar filtros quando há filtro de data', async () => {
      const { user, container } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir filtros
      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(início\)/i)).toBeInTheDocument();
      });

      // Adicionar um filtro de data
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const dateInput = dateInputs[0] as HTMLInputElement;

      if (dateInput) {
        const dateValue = today.toISOString().split('T')[0];
        await user.type(dateInput, dateValue);

        // Deve aparecer o botão "Limpar Filtros"
        await waitFor(() => {
          expect(screen.getByText(/limpar filtros/i)).toBeInTheDocument();
        });
      }
    });

    it('deve limpar filtros de data ao clicar em "Limpar Filtros"', async () => {
      const { user, container } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir filtros
      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(início\)/i)).toBeInTheDocument();
      });

      // Adicionar um filtro de data
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const dateInput = dateInputs[0] as HTMLInputElement;

      if (dateInput) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 1); // Amanhã - nenhum contato deve aparecer
        await user.type(dateInput, futureDate.toISOString().split('T')[0]);

        await waitFor(() => {
          expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
        });

        // Clicar em limpar filtros
        const clearButton = screen.getByText(/limpar filtros/i);
        await user.click(clearButton);

        // Todos os contatos devem voltar
        await waitFor(() => {
          expect(screen.getByText('Maria Silva')).toBeInTheDocument();
          expect(screen.getByText('João Santos')).toBeInTheDocument();
        });
      }
    });

    it('deve fechar o painel de filtros ao clicar novamente no botão', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(início\)/i)).toBeInTheDocument();
      });

      // Agora deve ter aria-label "Fechar filtros avançados"
      const closeFilterButton = screen.getByLabelText(/fechar filtros avançados/i);
      await user.click(closeFilterButton);

      await waitFor(() => {
        expect(screen.queryByText(/data de criação \(início\)/i)).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // COMBINAÇÃO DE FILTROS
  // --------------------------------------------------------------------------
  describe('Combinação de Múltiplos Filtros', () => {
    it('deve aplicar filtro de busca + estágio simultaneamente', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Filtrar por estágio LEAD
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      await user.click(leadsButton);

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
      });

      // Adicionar busca por "Maria"
      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'Maria');

      // Apenas Maria (que é LEAD e tem "Maria" no nome)
      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.queryByText('Paula Lima')).not.toBeInTheDocument();
      });
    });

    it('deve aplicar filtro de status + busca simultaneamente', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Filtrar por status ACTIVE
      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'ACTIVE');

      // Buscar por ".com"
      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, '.com');

      // Maria (empresa.com) e João (tech.com) são ACTIVE e têm .com
      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('João Santos')).toBeInTheDocument();
        // Ana é .io, Carlos e Paula são .com.br e .net
        expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
      });
    });

    it('deve aplicar filtro de estágio + status simultaneamente', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Filtrar por estágio LEAD
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      await user.click(leadsButton);

      // Filtrar por status CHURNED
      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'CHURNED');

      // Apenas Paula é LEAD + CHURNED
      await waitFor(() => {
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
        expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
      });
    });

    it('deve aplicar todos os filtros simultaneamente (busca + estágio + status + data)', async () => {
      const { user, container } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // 1. Filtrar por status ACTIVE
      const statusSelect = screen.getByLabelText(/filtrar por status/i);
      await user.selectOptions(statusSelect, 'ACTIVE');

      // 2. Filtrar por estágio (todos = ALL)
      const allButton = screen.getByRole('button', { name: /todos/i });
      await user.click(allButton);

      // 3. Abrir filtros de data
      const filterButton = screen.getByLabelText(/abrir filtros avançados/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/data de criação \(início\)/i)).toBeInTheDocument();
      });

      // 4. Aplicar filtro de data (últimos 15 dias)
      const filterDate = new Date(today);
      filterDate.setDate(filterDate.getDate() - 15);
      const dateValue = filterDate.toISOString().split('T')[0];

      const dateInputs = container.querySelectorAll('input[type="date"]');
      const dateInput = dateInputs[0] as HTMLInputElement;

      if (dateInput) {
        await user.type(dateInput, dateValue);

        // 5. Buscar por "a" (Maria, João)
        const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
        await user.type(searchInput, 'a');

        // Maria e João são ACTIVE, criados nos últimos 15 dias, e têm "a" no nome
        await waitFor(() => {
          expect(screen.getByText('Maria Silva')).toBeInTheDocument();
          expect(screen.getByText('João Santos')).toBeInTheDocument();
          // Ana é ACTIVE mas criada há 30 dias
          expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
        });
      }
    });

    it('deve resetar filtros corretamente após limpar busca', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Aplicar filtro de estágio
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      await user.click(leadsButton);

      // Aplicar busca
      const searchInput = screen.getByPlaceholderText(/buscar nomes, emails/i);
      await user.type(searchInput, 'Maria');

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.queryByText('Paula Lima')).not.toBeInTheDocument();
      });

      // Limpar busca
      await user.clear(searchInput);

      // Deve mostrar apenas LEADs (Maria e Paula)
      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // ATUALIZAÇÃO DA LISTA
  // --------------------------------------------------------------------------
  describe('Atualização da Lista', () => {
    it('deve manter os filtros após atualização de dados', async () => {
      const { user, queryClient } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Aplicar filtro
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      await user.click(leadsButton);

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });

      // Simular adição de novo contato LEAD
      const newContact: Contact = {
        id: 'contact-new',
        organizationId: 'org-1',
        name: 'Novo Lead',
        email: 'novo@lead.com',
        phone: '(11) 99999-9999',
        role: 'Teste',
        status: 'ACTIVE',
        stage: ContactStage.LEAD,
        totalValue: 0,
        createdAt: today.toISOString(),
      };

      // T022: Update mock to include new contact in paginated response
      const updatedContacts = [...mockContacts, newContact];
      mockGetAllContactsPaginated.mockImplementation((pagination, filters) => {
        let filteredContacts = [...updatedContacts];

        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          filteredContacts = filteredContacts.filter(
            c => c.name.toLowerCase().includes(searchLower) || c.email.toLowerCase().includes(searchLower)
          );
        }
        if (filters?.stage && filters.stage !== 'ALL') {
          filteredContacts = filteredContacts.filter(c => c.stage === filters.stage);
        }
        if (filters?.status && filters.status !== 'ALL') {
          if (filters.status === 'RISK') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            filteredContacts = filteredContacts.filter(
              c => c.status === 'ACTIVE' && (!c.lastPurchaseDate || new Date(c.lastPurchaseDate) < thirtyDaysAgo)
            );
          } else {
            filteredContacts = filteredContacts.filter(c => c.status === filters.status);
          }
        }

        const { pageIndex = 0, pageSize = 50 } = pagination || {};
        const start = pageIndex * pageSize;
        const end = start + pageSize;
        const pagedContacts = filteredContacts.slice(start, end);

        return Promise.resolve({
          data: {
            data: pagedContacts,
            totalCount: filteredContacts.length,
            pageIndex,
            pageSize,
            hasMore: end < filteredContacts.length,
          },
          error: null,
        });
      });

      // Invalidar cache para forçar refetch
      queryClient.invalidateQueries({ queryKey: ['contacts'] });

      // Novo contato LEAD deve aparecer mantendo o filtro
      await waitFor(() => {
        expect(screen.getByText('Novo Lead')).toBeInTheDocument();
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.queryByText('João Santos')).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // CONTADORES
  // --------------------------------------------------------------------------
  describe('Contadores por Estágio', () => {
    it('deve exibir contadores corretos para cada estágio', async () => {
      renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Verificar que o botão "Todos" mostra o total (5)
      const allButton = screen.getByRole('button', { name: /todos/i });
      expect(allButton).toHaveTextContent('5');

      // Leads: Maria e Paula = 2
      const leadsButton = screen.getByRole('button', { name: /leads/i });
      expect(leadsButton).toHaveTextContent('2');

      // MQL: João = 1
      const mqlButton = screen.getByRole('button', { name: /mql/i });
      expect(mqlButton).toHaveTextContent('1');

      // Prospects: Ana = 1
      const prospectsButton = screen.getByRole('button', { name: /prospects/i });
      expect(prospectsButton).toHaveTextContent('1');

      // Customers: Carlos = 1
      const customersButton = screen.getByRole('button', { name: /clientes/i });
      expect(customersButton).toHaveTextContent('1');
    });
  });

  // --------------------------------------------------------------------------
  // EDIÇÃO DE CONTATOS
  // --------------------------------------------------------------------------
  describe('Edição de Contatos', () => {
    it('deve abrir o modal de edição ao clicar no botão de editar', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Encontrar o botão de editar para Maria Silva
      const editButton = screen.getByLabelText('Editar Maria Silva');
      await user.click(editButton);

      // Verificar que o modal de edição foi aberto
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Editar Contato')).toBeInTheDocument();
      });
    });

    it('deve preencher o formulário com os dados do contato ao abrir edição', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar em editar
      const editButton = screen.getByLabelText('Editar Maria Silva');
      await user.click(editButton);

      // Verificar que o formulário está preenchido com os dados do contato
      await waitFor(() => {
        expect(screen.getByDisplayValue('Maria Silva')).toBeInTheDocument();
        expect(screen.getByDisplayValue('maria@empresa.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('(11) 99999-0001')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Gerente')).toBeInTheDocument();
      });
    });

    it('deve fechar o modal ao clicar no botão de fechar', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de edição
      const editButton = screen.getByLabelText('Editar Maria Silva');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fechar o modal
      const closeButton = screen.getByLabelText('Fechar modal');
      await user.click(closeButton);

      // Verificar que o modal foi fechado
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('deve permitir editar o nome do contato e chamar API de atualização', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de edição
      const editButton = screen.getByLabelText('Editar Maria Silva');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Limpar e alterar o nome
      const nameInput = screen.getByDisplayValue('Maria Silva');
      await user.clear(nameInput);
      await user.type(nameInput, 'Maria Silva Santos');

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /salvar/i });
      await user.click(submitButton);

      // Verificar que a API de update foi chamada com os dados corretos
      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalled();
      });

      // Verificar os dados passados para o update
      const updateCall = mockUpdateContact.mock.calls[0];
      expect(updateCall[0]).toBe('contact-1'); // ID do contato
      expect(updateCall[1]).toMatchObject({
        name: 'Maria Silva Santos',
      });
    });

    it('deve permitir editar o email do contato e chamar API', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('João Santos')).toBeInTheDocument();
      });

      // Abrir modal de edição para João
      const editButton = screen.getByLabelText('Editar João Santos');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Alterar email
      const emailInput = screen.getByDisplayValue('joao@tech.com');
      await user.clear(emailInput);
      await user.type(emailInput, 'joao.santos@novoemail.com');

      // Submeter
      const submitButton = screen.getByRole('button', { name: /salvar/i });
      await user.click(submitButton);

      // Verificar que a API foi chamada
      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalled();
      });

      // Verificar dados do update
      const updateCall = mockUpdateContact.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        email: 'joao.santos@novoemail.com',
      });
    });

    it('deve permitir editar múltiplos campos do contato e chamar API', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Ana Costa')).toBeInTheDocument();
      });

      // Abrir modal de edição
      const editButton = screen.getByLabelText('Editar Ana Costa');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Alterar nome
      const nameInput = screen.getByDisplayValue('Ana Costa');
      await user.clear(nameInput);
      await user.type(nameInput, 'Ana Costa Silva');

      // Alterar cargo
      const roleInput = screen.getByDisplayValue('CEO');
      await user.clear(roleInput);
      await user.type(roleInput, 'CTO');

      // Submeter
      const submitButton = screen.getByRole('button', { name: /salvar/i });
      await user.click(submitButton);

      // Verificar que a API foi chamada com múltiplos campos
      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalled();
      });

      const updateCall = mockUpdateContact.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        name: 'Ana Costa Silva',
        role: 'CTO',
      });
    });

    it('deve manter o modal aberto se falhar ao salvar', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de edição
      const editButton = screen.getByLabelText('Editar Maria Silva');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Limpar campo obrigatório (nome) para causar validação
      const nameInput = screen.getByDisplayValue('Maria Silva');
      await user.clear(nameInput);

      // O formulário HTML deve impedir submissão com required vazio
      const submitButton = screen.getByRole('button', { name: /salvar/i });
      await user.click(submitButton);

      // Modal deve continuar aberto
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('deve alterar o status do contato ao clicar no botão de status', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Encontrar o botão de status de Maria (que é ACTIVE)
      const statusButton = screen.getByLabelText(/alterar status de maria silva/i);
      expect(statusButton).toHaveTextContent('ATIVO');

      // Clicar para mudar o status (ACTIVE -> INACTIVE)
      await user.click(statusButton);

      // A API de update deve ser chamada com o novo status
      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith('contact-1', expect.objectContaining({
          status: 'INACTIVE',
        }));
      });
    });

    it('deve ciclar corretamente entre os status: ACTIVE -> INACTIVE -> CHURNED -> ACTIVE', async () => {
      // Usar contato Carlos que é INACTIVE
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
      });

      // Carlos está INACTIVE, ao clicar deve ir para CHURNED
      const statusButtonCarlos = screen.getByLabelText(/alterar status de carlos mendes/i);
      expect(statusButtonCarlos).toHaveTextContent('INATIVO');

      await user.click(statusButtonCarlos);

      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith('contact-4', expect.objectContaining({
          status: 'CHURNED',
        }));
      });
    });

    it('deve chamar updateContact ao clicar no status de contato CHURNED voltando para ACTIVE', async () => {
      // Paula está CHURNED
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
      });

      const statusButtonPaula = screen.getByLabelText(/alterar status de paula lima/i);
      expect(statusButtonPaula).toHaveTextContent('PERDIDO');

      await user.click(statusButtonPaula);

      // CHURNED -> ACTIVE
      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith('contact-5', expect.objectContaining({
          status: 'ACTIVE',
        }));
      });
    });
  });

  // --------------------------------------------------------------------------
  // EXCLUSÃO DE CONTATOS
  // --------------------------------------------------------------------------
  describe('Exclusão de Contatos', () => {
    it('deve abrir o modal de confirmação ao clicar em excluir', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no botão de excluir
      const deleteButton = screen.getByLabelText('Excluir Maria Silva');
      await user.click(deleteButton);

      // Verificar que o modal de confirmação apareceu
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByText('Excluir Contato')).toBeInTheDocument();
        expect(screen.getByText(/tem certeza que deseja excluir/i)).toBeInTheDocument();
      });
    });

    it('deve fechar o modal de confirmação ao clicar em Cancelar', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de exclusão
      const deleteButton = screen.getByLabelText('Excluir Maria Silva');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Clicar em Cancelar
      const cancelButton = screen.getByRole('button', { name: /cancelar/i });
      await user.click(cancelButton);

      // Modal deve ser fechado
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      // Contato ainda deve aparecer na lista
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    });

    it('deve excluir o contato ao confirmar a exclusão', async () => {
      const { user, queryClient } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Paula Lima')).toBeInTheDocument();
      });

      // Abrir modal de exclusão
      const deleteButton = screen.getByLabelText('Excluir Paula Lima');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Confirmar exclusão - usar within para buscar apenas no dialog
      const dialog = screen.getByRole('alertdialog');
      const confirmButton = within(dialog).getByRole('button', { name: /^excluir$/i });
      await user.click(confirmButton);

      // Verificar que a API de verificação de deals foi chamada
      await waitFor(() => {
        expect(mockHasDeals).toHaveBeenCalledWith('contact-5'); // Paula Lima é contact-5
      });

      // Verificar que a API de delete foi chamada
      await waitFor(() => {
        expect(mockDeleteContact).toHaveBeenCalled();
      });
    });

    it('deve exibir botões de ação ao hover na linha do contato', async () => {
      renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Os botões existem mas podem estar ocultos
      const editButton = screen.getByLabelText('Editar Maria Silva');
      const deleteButton = screen.getByLabelText('Excluir Maria Silva');

      expect(editButton).toBeInTheDocument();
      expect(deleteButton).toBeInTheDocument();
    });

    it('deve chamar API de delete para diferentes contatos', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Carlos Mendes')).toBeInTheDocument();
      });

      // Abrir modal de exclusão para Carlos
      const deleteButton = screen.getByLabelText('Excluir Carlos Mendes');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Confirmar exclusão - usar within para buscar apenas no dialog
      const dialog = screen.getByRole('alertdialog');
      const confirmButton = within(dialog).getByRole('button', { name: /^excluir$/i });
      await user.click(confirmButton);

      // Verificar que hasDeals foi chamado para Carlos (contact-4)
      await waitFor(() => {
        expect(mockHasDeals).toHaveBeenCalledWith('contact-4');
      });
    });
  });

  // --------------------------------------------------------------------------
  // SELEÇÃO EM MASSA E EXCLUSÃO EM LOTE
  // --------------------------------------------------------------------------
  describe('Seleção e Exclusão em Lote', () => {
    it('deve selecionar um contato ao clicar no checkbox', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar Maria
      const checkbox = screen.getByLabelText('Selecionar Maria Silva');
      await user.click(checkbox);

      // Verificar que a barra de ações em lote aparece
      await waitFor(() => {
        expect(screen.getByText(/1 contato\(s\) selecionado\(s\)/i)).toBeInTheDocument();
      });
    });

    it('deve exibir contagem correta de selecionados', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar múltiplos contatos
      await user.click(screen.getByLabelText('Selecionar Maria Silva'));
      await user.click(screen.getByLabelText('Selecionar João Santos'));

      await waitFor(() => {
        expect(screen.getByText(/2 contato\(s\) selecionado\(s\)/i)).toBeInTheDocument();
      });
    });

    it('deve selecionar todos os contatos ao clicar no checkbox do header', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no checkbox de "selecionar todos"
      const selectAllCheckbox = screen.getByLabelText(/selecionar todos os contatos/i);
      await user.click(selectAllCheckbox);

      // Todos devem estar selecionados
      await waitFor(() => {
        expect(screen.getByText(/5 contato\(s\) selecionado\(s\)/i)).toBeInTheDocument();
      });
    });

    it('deve limpar seleção ao clicar em "Limpar seleção"', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar contatos
      await user.click(screen.getByLabelText('Selecionar Maria Silva'));
      await user.click(screen.getByLabelText('Selecionar João Santos'));

      await waitFor(() => {
        expect(screen.getByText(/2 contato\(s\) selecionado\(s\)/i)).toBeInTheDocument();
      });

      // Limpar seleção
      const clearButton = screen.getByText(/limpar seleção/i);
      await user.click(clearButton);

      // Barra de ações deve desaparecer
      await waitFor(() => {
        expect(screen.queryByText(/contato\(s\) selecionado\(s\)/i)).not.toBeInTheDocument();
      });
    });

    it('deve mostrar botão de excluir selecionados quando há seleção', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar contato
      await user.click(screen.getByLabelText('Selecionar Maria Silva'));

      // Verificar que o botão de exclusão em lote aparece
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /excluir selecionados/i })).toBeInTheDocument();
      });
    });

    it('deve abrir confirmação de exclusão em lote ao clicar no botão', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar contatos
      await user.click(screen.getByLabelText('Selecionar Maria Silva'));
      await user.click(screen.getByLabelText('Selecionar João Santos'));

      // Clicar no botão de excluir selecionados
      const bulkDeleteButton = screen.getByRole('button', { name: /excluir selecionados/i });
      await user.click(bulkDeleteButton);

      // Modal de confirmação deve aparecer
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
    });

    it('deve desmarcar contato ao clicar novamente no checkbox', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar
      const checkbox = screen.getByLabelText('Selecionar Maria Silva');
      await user.click(checkbox);

      await waitFor(() => {
        expect(screen.getByText(/1 contato\(s\) selecionado\(s\)/i)).toBeInTheDocument();
      });

      // Desmarcar
      await user.click(checkbox);

      // Barra de ações deve desaparecer
      await waitFor(() => {
        expect(screen.queryByText(/contato\(s\) selecionado\(s\)/i)).not.toBeInTheDocument();
      });
    });

    it('deve desselecionar todos ao clicar novamente no checkbox do header', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Selecionar todos
      const selectAllCheckbox = screen.getByLabelText(/selecionar todos os contatos/i);
      await user.click(selectAllCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/5 contato\(s\) selecionado\(s\)/i)).toBeInTheDocument();
      });

      // Desmarcar todos
      const deselectAllCheckbox = screen.getByLabelText(/desmarcar todos os contatos/i);
      await user.click(deselectAllCheckbox);

      await waitFor(() => {
        expect(screen.queryByText(/contato\(s\) selecionado\(s\)/i)).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // CRIAÇÃO DE CONTATOS
  // --------------------------------------------------------------------------
  describe('Criação de Contatos', () => {
    it('deve abrir o modal de criação ao clicar em "Novo Contato"', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no botão de novo contato
      const newContactButton = screen.getByRole('button', { name: /novo contato/i });
      await user.click(newContactButton);

      // Verificar que o modal foi aberto
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // O modal tem um h2 com "Novo Contato" 
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: /novo contato/i })).toBeInTheDocument();
    });

    it('deve exibir formulário vazio ao criar novo contato', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de criação
      const newContactButton = screen.getByRole('button', { name: /novo contato/i });
      await user.click(newContactButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Verificar que os campos estão vazios
      const nameInput = screen.getByPlaceholderText(/ex: ana souza/i);
      const emailInput = screen.getByPlaceholderText(/ana@empresa\.com/i);

      expect(nameInput).toHaveValue('');
      expect(emailInput).toHaveValue('');
    });

    it('deve chamar API de criação ao preencher formulário e submeter', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de criação
      const newContactButton = screen.getByRole('button', { name: /novo contato/i });
      await user.click(newContactButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Preencher formulário
      const nameInput = screen.getByPlaceholderText(/ex: ana souza/i);
      const emailInput = screen.getByPlaceholderText(/ana@empresa\.com/i);

      await user.type(nameInput, 'Novo Contato Teste');
      await user.type(emailInput, 'novo@teste.com');

      // Submeter - o botão mostra "Criar Contato" para novos contatos
      const submitButton = screen.getByRole('button', { name: /criar contato/i });
      await user.click(submitButton);

      // Verificar que a API de criação foi chamada
      await waitFor(() => {
        expect(mockCreateContact).toHaveBeenCalled();
      });

      // Verificar dados enviados
      const createCall = mockCreateContact.mock.calls[0][0];
      expect(createCall).toMatchObject({
        name: 'Novo Contato Teste',
        email: 'novo@teste.com',
      });
    });

    it('não deve chamar API se campos obrigatórios estão vazios', async () => {
      const { user } = renderContactsPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de criação
      const newContactButton = screen.getByRole('button', { name: /novo contato/i });
      await user.click(newContactButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Tentar submeter sem preencher - botão é "Criar Contato"
      const submitButton = screen.getByRole('button', { name: /criar contato/i });
      await user.click(submitButton);

      // A API NÃO deve ser chamada (validação HTML5 impede)
      expect(mockCreateContact).not.toHaveBeenCalled();

      // Modal deve continuar aberto
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // CRIAÇÃO DE DEAL (BOTÃO +)
  // --------------------------------------------------------------------------
  describe('Criação de Deal a partir de Contato', () => {
    it('deve exibir o botão de criar oportunidade em cada contato', async () => {
      renderContactsPage({ boards: mockSingleBoard });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Verificar que o botão + existe para Maria
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      expect(createDealButton).toBeInTheDocument();
    });

    it('deve criar deal diretamente quando há apenas 1 board', async () => {
      const { user } = renderContactsPage({ boards: mockSingleBoard });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no botão + para Maria
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      await user.click(createDealButton);

      // A mutação de createDeal deve ser chamada diretamente (sem modal)
      await waitFor(() => {
        expect(mockCreateDealMutate).toHaveBeenCalled();
      });

      // Verificar que o deal foi criado com os dados corretos
      const createCall = mockCreateDealMutate.mock.calls[0][0];
      expect(createCall).toMatchObject({
        title: 'Deal - Maria Silva',
        contactId: 'contact-1',
        boardId: 'board-1',
        status: 'stage-1', // Primeiro stage do board
      });

      // O modal de seleção de board NÃO deve aparecer
      expect(screen.queryByText(/selecione o board/i)).not.toBeInTheDocument();
    });

    it('deve abrir modal de seleção quando há múltiplos boards', async () => {
      const { user } = renderContactsPage({ boards: mockMultipleBoards });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no botão + para Maria
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      await user.click(createDealButton);

      // O modal de seleção de board deve aparecer
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/selecione o board para/i)).toBeInTheDocument();
        expect(screen.getByText('Maria Silva', { selector: 'strong' })).toBeInTheDocument();
      });

      // Os boards devem ser listados
      expect(screen.getByText('Pipeline de Vendas')).toBeInTheDocument();
      expect(screen.getByText('Pré-vendas')).toBeInTheDocument();
      expect(screen.getByText('Onboarding')).toBeInTheDocument();
    });

    it('deve criar deal ao selecionar um board no modal', async () => {
      const { user } = renderContactsPage({ boards: mockMultipleBoards });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal de seleção
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      await user.click(createDealButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Selecionar o board "Pré-vendas"
      const preVendasBoard = screen.getByText('Pré-vendas');
      await user.click(preVendasBoard);

      // A mutação de createDeal deve ser chamada com o board selecionado
      await waitFor(() => {
        expect(mockCreateDealMutate).toHaveBeenCalled();
      });

      const createCall = mockCreateDealMutate.mock.calls[0][0];
      expect(createCall).toMatchObject({
        title: 'Deal - Maria Silva',
        contactId: 'contact-1',
        boardId: 'board-2', // Board Pré-vendas
        status: 'stage-3', // Primeiro stage do board Pré-vendas
      });

      // Modal deve fechar após seleção
      await waitFor(() => {
        expect(screen.queryByText(/selecione o board/i)).not.toBeInTheDocument();
      });
    });

    it('deve fechar o modal de seleção de board ao clicar em fechar', async () => {
      const { user } = renderContactsPage({ boards: mockMultipleBoards });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      await user.click(createDealButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Clicar no botão de fechar
      const closeButton = screen.getByLabelText(/fechar modal/i);
      await user.click(closeButton);

      // Modal deve fechar
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // A mutação não deve ter sido chamada
      expect(mockCreateDealMutate).not.toHaveBeenCalled();
    });

    it('deve exibir número de estágios de cada board no modal', async () => {
      const { user } = renderContactsPage({ boards: mockMultipleBoards });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Abrir modal
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      await user.click(createDealButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Verificar que mostra o número de estágios para cada board
      // Todos os 3 boards têm 2 estágios
      const stageCountElements = screen.getAllByText('2 estágios');
      expect(stageCountElements).toHaveLength(3);
    });

    it('deve criar deal para diferentes contatos', async () => {
      const { user } = renderContactsPage({ boards: mockSingleBoard });

      await waitFor(() => {
        expect(screen.getByText('João Santos')).toBeInTheDocument();
      });

      // Clicar no botão + para João
      const createDealButton = screen.getByLabelText(/criar oportunidade para joão santos/i);
      await user.click(createDealButton);

      // Verificar que o deal foi criado para João
      await waitFor(() => {
        expect(mockCreateDealMutate).toHaveBeenCalled();
      });

      const createCall = mockCreateDealMutate.mock.calls[0][0];
      expect(createCall).toMatchObject({
        title: 'Deal - João Santos',
        contactId: 'contact-2',
      });
    });

    it('não deve permitir criar deal quando não há boards disponíveis', async () => {
      const { user } = renderContactsPage({ boards: [] });

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      });

      // Clicar no botão + para Maria
      const createDealButton = screen.getByLabelText(/criar oportunidade para maria silva/i);
      await user.click(createDealButton);

      // A mutação NÃO deve ser chamada
      expect(mockCreateDealMutate).not.toHaveBeenCalled();

      // Modal de seleção NÃO deve aparecer
      expect(screen.queryByText(/selecione o board/i)).not.toBeInTheDocument();
    });
  });
});
