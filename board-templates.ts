import { BoardStage, AgentPersona, BoardGoal } from './types';

export type BoardTemplateType = 'PRE_SALES' | 'SALES' | 'ONBOARDING' | 'CS' | 'CUSTOM';

// Template vazio para boards customizados (não usa template)
export const CUSTOM_TEMPLATE: BoardTemplate = {
  name: 'Personalizado',
  description: 'Board personalizado sem template',
  emoji: '⚙️',
  stages: [],
  tags: [],
};

export interface BoardTemplate {
  name: string;
  description: string;
  emoji: string;
  linkedLifecycleStage?: string;
  stages: Omit<BoardStage, 'id'>[];
  tags: string[];
  // Strategy Fields
  agentPersona?: AgentPersona;
  goal?: BoardGoal;
  entryTrigger?: string;
}

export const BOARD_TEMPLATES: Record<BoardTemplateType, BoardTemplate> = {
  PRE_SALES: {
    name: 'Pré-venda',
    description: 'Qualificação de leads até tornarem-se MQL',
    emoji: '🎯',
    linkedLifecycleStage: 'LEAD',
    tags: ['SDR', 'Qualificação', 'Outbound'],
    stages: [
      { label: 'Novos Leads', color: 'bg-blue-500', linkedLifecycleStage: 'LEAD' },
      { label: 'Contatado', color: 'bg-yellow-500', linkedLifecycleStage: 'LEAD' },
      { label: 'Qualificando', color: 'bg-purple-500', linkedLifecycleStage: 'LEAD' },
      { label: 'Qualificado (MQL)', color: 'bg-green-500', linkedLifecycleStage: 'MQL' },
    ],
    agentPersona: {
      name: 'SDR Bot',
      role: 'Pré-vendas e Qualificação',
      behavior:
        'Seja rápido e objetivo. Seu foco é qualificar o lead fazendo perguntas chave sobre orçamento, autoridade, necessidade e tempo (BANT). Se o lead for qualificado, mova para MQL.',
    },
    goal: {
      description: 'Qualificar leads frios e identificar oportunidades reais.',
      kpi: 'Leads Qualificados (MQL)',
      targetValue: '50',
      type: 'number',
    },
    entryTrigger: 'Novos leads capturados via formulário do site ou LinkedIn.',
  },

  SALES: {
    name: 'Pipeline de Vendas',
    description: 'MQL até fechamento ou perda',
    emoji: '💰',
    linkedLifecycleStage: 'MQL',
    tags: ['Vendas', 'CRM', 'Fechamento'],
    stages: [
      { label: 'Descoberta', color: 'bg-blue-500', linkedLifecycleStage: 'MQL' },
      { label: 'Proposta', color: 'bg-purple-500', linkedLifecycleStage: 'PROSPECT' },
      { label: 'Negociação', color: 'bg-orange-500', linkedLifecycleStage: 'PROSPECT' },
      { label: 'Ganho', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Perdido', color: 'bg-red-500', linkedLifecycleStage: 'OTHER' },
    ],
    agentPersona: {
      name: 'Closer Bot',
      role: 'Executivo de Vendas',
      behavior:
        'Atue como um consultor experiente. Foque em entender a dor do cliente, apresentar a solução de valor e negociar termos. Use gatilhos mentais de urgência e escassez quando apropriado.',
    },
    goal: {
      description: 'Maximizar a receita recorrente mensal (MRR).',
      kpi: 'Receita Nova (MRR)',
      targetValue: '50000',
      type: 'currency',
    },
    entryTrigger: 'Leads qualificados (MQL) vindos da Pré-venda.',
  },

  ONBOARDING: {
    name: 'Onboarding de Clientes',
    description: 'Ativação e implementação de novos clientes',
    emoji: '🚀',
    linkedLifecycleStage: 'CUSTOMER',
    tags: ['CS', 'Implementação', 'Sucesso'],
    stages: [
      { label: 'Kickoff', color: 'bg-blue-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Implementação', color: 'bg-purple-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Treinamento', color: 'bg-yellow-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Go Live', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
    ],
    agentPersona: {
      name: 'CS Manager',
      role: 'Gerente de Sucesso do Cliente',
      behavior:
        'Seja acolhedor e didático. Guie o cliente passo a passo na configuração da ferramenta. Garanta que ele veja valor rápido (First Value).',
    },
    goal: {
      description: 'Garantir que o cliente complete a configuração inicial em até 7 dias.',
      kpi: 'Clientes Ativados',
      targetValue: '20',
      type: 'number',
    },
    entryTrigger: 'Novos clientes com contrato assinado (Ganho em Vendas).',
  },

  CS: {
    name: 'CS & Upsell',
    description: 'Gestão de clientes ativos e oportunidades de expansão',
    emoji: '❤️',
    linkedLifecycleStage: 'CUSTOMER',
    tags: ['Retenção', 'Upsell', 'Relacionamento'],
    stages: [
      { label: 'Saudável', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Oportunidade Upsell', color: 'bg-blue-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Em Risco', color: 'bg-yellow-500', linkedLifecycleStage: 'CUSTOMER' },
      { label: 'Churn', color: 'bg-red-500', linkedLifecycleStage: 'OTHER' },
    ],
    agentPersona: {
      name: 'Account Manager',
      role: 'Gerente de Contas',
      behavior:
        'Monitore a saúde da conta. Identifique oportunidades de expansão (Upsell/Cross-sell) e aja proativamente para evitar cancelamentos (Churn).',
    },
    goal: {
      description: 'Aumentar a receita da base (Expansion MRR) e reduzir Churn.',
      kpi: 'Expansion MRR',
      targetValue: '10000',
      type: 'currency',
    },
    entryTrigger: 'Clientes ativos após o período de Onboarding.',
  },

  CUSTOM: CUSTOM_TEMPLATE,
};
