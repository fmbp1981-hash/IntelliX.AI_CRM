import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContactFormModal } from './ContactFormModal';
import { Contact } from '@/types';

// Mock dos serviços de API
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  },
  contactsService: {
    getAll: vi.fn().mockResolvedValue({ data: [], error: null }),
    create: vi.fn(),
    update: vi.fn(),
  },
  companiesService: {
    getAll: vi.fn().mockResolvedValue({ data: [], error: null }),
    create: vi.fn(),
  },
}));

// Mock do ToastContext
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
    showToast: vi.fn(),
  }),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const mockContact: Contact = {
  id: 'contact-1',
  organizationId: 'org-1',
  name: 'João Silva',
  email: 'joao@empresa.com',
  phone: '(11) 99999-9999',
  role: 'Gerente',
  companyId: 'company-1',
  avatar: '',
  notes: '',
  status: 'ACTIVE',
  stage: 'LEAD',
  totalValue: 0,
  createdAt: new Date().toISOString(),
};

interface RenderContactFormOptions {
  isOpen?: boolean;
  editingContact?: Contact | null;
  formData?: {
    name: string;
    email: string;
    phone: string;
    role: string;
    companyName: string;
  };
}

const defaultFormData = {
  name: '',
  email: '',
  phone: '',
  role: '',
  companyName: '',
};

const renderContactForm = (options: RenderContactFormOptions = {}) => {
  const {
    isOpen = true,
    editingContact = null,
    formData = defaultFormData,
  } = options;

  const queryClient = createQueryClient();
  const onClose = vi.fn();
  const onSubmit = vi.fn((e) => e.preventDefault());
  const setFormData = vi.fn();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ContactFormModal
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={onSubmit}
          formData={formData}
          setFormData={setFormData}
          editingContact={editingContact}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );

  return {
    ...result,
    onClose,
    onSubmit,
    setFormData,
    queryClient,
  };
};

describe('ContactFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Renderização do formulário', () => {
    it('não deve renderizar quando isOpen é false', () => {
      renderContactForm({ isOpen: false });
      
      expect(screen.queryByText('Novo Contato')).not.toBeInTheDocument();
    });

    it('deve renderizar o modal quando isOpen é true', () => {
      renderContactForm({ isOpen: true });
      
      expect(screen.getByText('Novo Contato')).toBeInTheDocument();
    });

    it('deve exibir título "Novo Contato" quando não há contato em edição', () => {
      renderContactForm({ editingContact: null });
      
      expect(screen.getByText('Novo Contato')).toBeInTheDocument();
    });

    it('deve exibir título "Editar Contato" quando há contato em edição', () => {
      renderContactForm({ editingContact: mockContact });
      
      expect(screen.getByText('Editar Contato')).toBeInTheDocument();
    });

    it('deve exibir todos os campos do formulário', () => {
      renderContactForm();
      
      // Labels
      expect(screen.getByText(/nome completo/i)).toBeInTheDocument();
      expect(screen.getByText(/email/i)).toBeInTheDocument();
      expect(screen.getByText(/telefone/i)).toBeInTheDocument();
      expect(screen.getByText(/cargo/i)).toBeInTheDocument();
      
      // Inputs (via placeholder)
      expect(screen.getByPlaceholderText(/ex: ana souza/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/ana@empresa.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/\(11\) 99999-9999/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/gerente/i)).toBeInTheDocument();
    });

    it('deve exibir campo empresa quando não está editando', () => {
      renderContactForm({ editingContact: null });
      
      expect(screen.getByText(/^empresa$/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/nome da empresa/i)).toBeInTheDocument();
    });

    it('não deve exibir campo empresa quando está editando', () => {
      renderContactForm({ editingContact: mockContact });
      
      expect(screen.queryByLabelText(/empresa/i)).not.toBeInTheDocument();
    });

    it('deve exibir botão "Criar Contato" quando não está editando', () => {
      renderContactForm({ editingContact: null });
      
      expect(screen.getByRole('button', { name: /criar contato/i })).toBeInTheDocument();
    });

    it('deve exibir botão "Salvar Alterações" quando está editando', () => {
      renderContactForm({ editingContact: mockContact });
      
      expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
    });

    it('deve exibir botão de fechar (X)', () => {
      renderContactForm();
      
      // O botão X não tem texto, então buscamos pelo SVG ou pelo role
      const closeButtons = screen.getAllByRole('button');
      // Deve haver pelo menos 2 botões: fechar (X) e submit
      expect(closeButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Estado inicial do formulário', () => {
    it('deve ter campos vazios para novo contato', () => {
      renderContactForm({
        formData: { name: '', email: '', phone: '', role: '', companyName: '' },
      });

      expect(screen.getByPlaceholderText(/ex: ana souza/i)).toHaveValue('');
      expect(screen.getByPlaceholderText(/ana@empresa.com/i)).toHaveValue('');
    });

    it('deve preencher campos com dados do contato em edição', () => {
      renderContactForm({
        editingContact: mockContact,
        formData: {
          name: mockContact.name,
          email: mockContact.email,
          phone: mockContact.phone,
          role: mockContact.role || '',
          companyName: '',
        },
      });

      expect(screen.getByPlaceholderText(/ex: ana souza/i)).toHaveValue('João Silva');
      expect(screen.getByPlaceholderText(/ana@empresa.com/i)).toHaveValue('joao@empresa.com');
    });
  });

  describe('Interação com campos', () => {
    it('deve chamar setFormData ao digitar no campo nome', async () => {
      const user = userEvent.setup();
      const { setFormData } = renderContactForm();

      const nameInput = screen.getByPlaceholderText(/ex: ana souza/i);
      await user.type(nameInput, 'Maria');

      expect(setFormData).toHaveBeenCalled();
    });

    it('deve chamar setFormData ao digitar no campo email', async () => {
      const user = userEvent.setup();
      const { setFormData } = renderContactForm();

      const emailInput = screen.getByPlaceholderText(/ana@empresa.com/i);
      await user.type(emailInput, 'test@test.com');

      expect(setFormData).toHaveBeenCalled();
    });

    it('deve chamar setFormData ao digitar no campo telefone', async () => {
      const user = userEvent.setup();
      const { setFormData } = renderContactForm();

      const phoneInput = screen.getByPlaceholderText(/\(11\) 99999-9999/i);
      await user.type(phoneInput, '11999999999');

      expect(setFormData).toHaveBeenCalled();
    });

    it('deve chamar setFormData ao digitar no campo cargo', async () => {
      const user = userEvent.setup();
      const { setFormData } = renderContactForm();

      const roleInput = screen.getByPlaceholderText(/gerente/i);
      await user.type(roleInput, 'Diretor');

      expect(setFormData).toHaveBeenCalled();
    });

    it('deve chamar setFormData ao digitar no campo empresa', async () => {
      const user = userEvent.setup();
      const { setFormData } = renderContactForm({ editingContact: null });

      const companyInput = screen.getByPlaceholderText(/nome da empresa/i);
      await user.type(companyInput, 'Empresa XYZ');

      expect(setFormData).toHaveBeenCalled();
    });
  });

  describe('Submissão do formulário', () => {
    it('deve chamar onSubmit ao submeter o formulário', async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderContactForm({
        formData: {
          name: 'Teste',
          email: 'teste@teste.com',
          phone: '11999999999',
          role: 'Dev',
          companyName: 'Empresa',
        },
      });

      const submitButton = screen.getByRole('button', { name: /criar contato/i });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalled();
    });

    it('deve chamar onSubmit ao submeter formulário de edição', async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderContactForm({
        editingContact: mockContact,
        formData: {
          name: mockContact.name,
          email: mockContact.email,
          phone: mockContact.phone,
          role: mockContact.role || '',
          companyName: '',
        },
      });

      const submitButton = screen.getByRole('button', { name: /salvar alterações/i });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('Fechar modal', () => {
    it('deve chamar onClose ao clicar no botão X', async () => {
      const user = userEvent.setup();
      const { onClose } = renderContactForm();

      // O botão X é o primeiro botão (antes do submit)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn => !btn.textContent?.includes('Contato') && !btn.textContent?.includes('Alterações'));
      
      if (closeButton) {
        await user.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Validação de campos obrigatórios', () => {
    it('deve ter campo nome como obrigatório', () => {
      renderContactForm();
      
      const nameInput = screen.getByPlaceholderText(/ex: ana souza/i);
      expect(nameInput).toHaveAttribute('required');
    });

    it('deve ter campo email como obrigatório', () => {
      renderContactForm();
      
      const emailInput = screen.getByPlaceholderText(/ana@empresa.com/i);
      expect(emailInput).toHaveAttribute('required');
    });

    it('campo telefone não deve ser obrigatório', () => {
      renderContactForm();
      
      const phoneInput = screen.getByPlaceholderText(/\(11\) 99999-9999/i);
      expect(phoneInput).not.toHaveAttribute('required');
    });

    it('campo cargo não deve ser obrigatório', () => {
      renderContactForm();
      
      const roleInput = screen.getByPlaceholderText(/gerente/i);
      expect(roleInput).not.toHaveAttribute('required');
    });
  });

  describe('Fluxo de criação de contato', () => {
    it('deve permitir preencher todos os campos e submeter', async () => {
      const user = userEvent.setup();
      
      // Usamos formData já preenchido para que a validação passe
      const { onSubmit, setFormData } = renderContactForm({
        formData: {
          name: 'Novo Contato',
          email: 'novo@email.com',
          phone: '11888888888',
          role: 'Analista',
          companyName: 'Nova Empresa',
        },
      });

      // Os inputs já estão preenchidos via value do formData
      // Verificamos que os valores estão nos campos
      expect(screen.getByPlaceholderText(/ex: ana souza/i)).toHaveValue('Novo Contato');
      expect(screen.getByPlaceholderText(/ana@empresa.com/i)).toHaveValue('novo@email.com');

      // Submete o formulário
      await user.click(screen.getByRole('button', { name: /criar contato/i }));
      expect(onSubmit).toHaveBeenCalled();
    });

    it('deve chamar setFormData quando o usuário digita em cada campo', async () => {
      const user = userEvent.setup();
      const { setFormData } = renderContactForm();

      // Digita em cada campo e verifica que setFormData foi chamado
      await user.type(screen.getByPlaceholderText(/ex: ana souza/i), 'T');
      expect(setFormData).toHaveBeenCalled();

      vi.clearAllMocks();
      await user.type(screen.getByPlaceholderText(/ana@empresa.com/i), 't');
      expect(setFormData).toHaveBeenCalled();

      vi.clearAllMocks();
      await user.type(screen.getByPlaceholderText(/\(11\) 99999-9999/i), '1');
      expect(setFormData).toHaveBeenCalled();

      vi.clearAllMocks();
      await user.type(screen.getByPlaceholderText(/gerente/i), 'D');
      expect(setFormData).toHaveBeenCalled();

      vi.clearAllMocks();
      await user.type(screen.getByPlaceholderText(/nome da empresa/i), 'E');
      expect(setFormData).toHaveBeenCalled();
    });
  });

  describe('Fluxo de edição de contato', () => {
    it('deve exibir dados do contato existente nos campos', () => {
      const contactToEdit: Contact = {
        ...mockContact,
        name: 'Pedro Santos',
        email: 'pedro@empresa.com',
        phone: '(21) 88888-8888',
        role: 'Diretor',
      };

      renderContactForm({
        editingContact: contactToEdit,
        formData: {
          name: contactToEdit.name,
          email: contactToEdit.email,
          phone: contactToEdit.phone,
          role: contactToEdit.role || '',
          companyName: '',
        },
      });

      expect(screen.getByPlaceholderText(/ex: ana souza/i)).toHaveValue('Pedro Santos');
      expect(screen.getByPlaceholderText(/ana@empresa.com/i)).toHaveValue('pedro@empresa.com');
      expect(screen.getByPlaceholderText(/\(11\) 99999-9999/i)).toHaveValue('(21) 88888-8888');
      expect(screen.getByPlaceholderText(/gerente/i)).toHaveValue('Diretor');
    });

    it('deve permitir alterar dados e submeter', async () => {
      const user = userEvent.setup();
      const { onSubmit, setFormData } = renderContactForm({
        editingContact: mockContact,
        formData: {
          name: mockContact.name,
          email: mockContact.email,
          phone: mockContact.phone,
          role: mockContact.role || '',
          companyName: '',
        },
      });

      // Altera o nome
      const nameInput = screen.getByPlaceholderText(/ex: ana souza/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Nome Alterado');

      expect(setFormData).toHaveBeenCalled();

      // Submete
      await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('Mensagem de ajuda', () => {
    it('deve exibir mensagem de ajuda no campo empresa para novo contato', () => {
      renderContactForm({ editingContact: null });
      
      expect(screen.getByText(/se a empresa já existir/i)).toBeInTheDocument();
    });
  });

  describe('Tipos de input', () => {
    it('deve ter input de email com type="email"', () => {
      renderContactForm();
      
      const emailInput = screen.getByPlaceholderText(/ana@empresa.com/i);
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('deve ter input de nome com type="text"', () => {
      renderContactForm();
      
      const nameInput = screen.getByPlaceholderText(/ex: ana souza/i);
      expect(nameInput).toHaveAttribute('type', 'text');
    });
  });
});
