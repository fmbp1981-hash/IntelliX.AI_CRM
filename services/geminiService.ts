/**
 * @fileoverview Serviço de integração com IA Gemini para funcionalidades do CRM.
 * 
 * Este módulo fornece todas as funções de IA do CRM, incluindo:
 * - Análise de leads e oportunidades
 * - Geração de emails e mensagens
 * - Processamento de áudio (transcrição)
 * - Chat conversacional com contexto do CRM
 * - Geração automática de boards/pipelines
 * 
 * **Segurança (VULN-002)**: Todas as chamadas de IA passam por um endpoint server-side.
 * Historicamente isso era um Edge Function (`ai-proxy`); hoje o frontend chama um endpoint
 * same-origin no Next.js (`/api/ai/actions`) que roda no servidor e lê as chaves do banco.
 * 
 * **Compliance LGPD**: Consentimento implícito - configurar uma API key = consentimento.
 * Funcionalidades de IA só funcionam quando o usuário configurou sua chave nas configurações.
 * 
 * @module services/geminiService
 */

import { callAIProxy, isConsentError, isRateLimitError } from '@/lib/supabase/ai-proxy';
import { Deal, DealView, LifecycleStage } from '@/types';


/**
 * Configuração de IA (legado).
 * 
 * @deprecated AIConfig não é mais necessária - configuração é tratada server-side.
 * Mantida para compatibilidade durante migração.
 * 
 * @interface AIConfig
 * @property {string} provider - Provedor de IA ('google' | 'openai' | 'anthropic').
 * @property {string} apiKey - Chave de API do provedor.
 * @property {string} model - ID do modelo a ser usado.
 * @property {boolean} thinking - Habilita modo de raciocínio estendido.
 * @property {boolean} search - Habilita busca web.
 * @property {boolean} anthropicCaching - Habilita cache do Anthropic.
 */
export interface AIConfig {
  provider: 'google' | 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  thinking: boolean;
  search: boolean;
  anthropicCaching: boolean;
}

/**
 * Analisa um lead/deal e fornece sugestões e score de probabilidade.
 * 
 * @param deal - O deal ou view do deal a ser analisado.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @param stageLabel - Nome do estágio atual para contexto.
 * @returns Promise com sugestão textual e score de probabilidade.
 * 
 * @example
 * ```typescript
 * const analysis = await analyzeLead(deal, undefined, 'Proposta');
 * console.log(analysis.suggestion); // "Considere agendar follow-up..."
 * console.log(analysis.probabilityScore); // 75
 * ```
 */
export const analyzeLead = async (
  deal: Deal | DealView,
  _config?: AIConfig,
  /** Nome do estágio atual (para exibir label ao invés de UUID) */
  stageLabel?: string
): Promise<{ suggestion: string; probabilityScore: number }> => {
  try {
    return await callAIProxy<{ suggestion: string; probabilityScore: number }>(
      'analyzeLead',
      {
        deal: {
          title: deal.title,
          value: deal.value,
          status: deal.status,
          probability: deal.probability,
          priority: deal.priority,
        },
        stageLabel,
      }
    );
  } catch (error) {
    console.error('Error analyzing lead:', error);

    if (isConsentError(error)) {
      return {
        suggestion: 'Consentimento necessário para usar IA. Clique para autorizar.',
        probabilityScore: deal.probability
      };
    }

    if (isRateLimitError(error)) {
      return {
        suggestion: 'Limite de requisições atingido. Tente novamente em alguns minutos.',
        probabilityScore: deal.probability
      };
    }

    return { suggestion: 'Não foi possível analisar.', probabilityScore: deal.probability };
  }
};

/**
 * Gera um rascunho de email personalizado para um deal.
 * 
 * @param deal - O deal ou view do deal para contextualizar o email.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @param stageLabel - Nome do estágio atual para contexto.
 * @returns Promise com o texto do email gerado.
 * 
 * @example
 * ```typescript
 * const email = await generateEmailDraft(deal, undefined, 'Negociação');
 * console.log(email); // "Prezado João, ..."
 * ```
 */
export const generateEmailDraft = async (
  deal: Deal | DealView,
  _config?: AIConfig,
  stageLabel?: string
): Promise<string> => {
  try {
    return await callAIProxy<string>('generateEmailDraft', {
      deal: {
        title: deal.title,
        value: deal.value,
        status: deal.status,
        contactName: 'contactName' in deal ? deal.contactName : undefined,
        companyName: 'companyName' in deal ? deal.companyName : undefined,
      },
      stageLabel,
    });
  } catch (error) {
    console.error('Error generating email:', error);
    if (isConsentError(error)) return 'Consentimento necessário para usar IA.';
    if (isRateLimitError(error)) return 'Limite de requisições atingido.';
    return 'Erro ao gerar e-mail.';
  }
};

/**
 * Gera respostas sugeridas para objeções de vendas.
 * 
 * @param deal - O deal ou view do deal relacionado.
 * @param objection - Texto da objeção do cliente.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com array de respostas sugeridas.
 * 
 * @example
 * ```typescript
 * const responses = await generateObjectionResponse(deal, 'Preço muito alto');
 * responses.forEach(r => console.log(r)); // Múltiplas sugestões de resposta
 * ```
 */
export const generateObjectionResponse = async (
  deal: Deal | DealView,
  objection: string,
  _config?: AIConfig
): Promise<string[]> => {
  try {
    return await callAIProxy<string[]>('generateObjectionResponse', {
      deal: { title: deal.title, value: deal.value },
      objection,
    });
  } catch (error) {
    console.error('Error generating objections:', error);
    if (isConsentError(error)) return ['Consentimento necessário para usar IA.'];
    if (isRateLimitError(error)) return ['Limite de requisições atingido.'];
    return ['Não foi possível gerar respostas.'];
  }
};

/**
 * Processa uma nota de áudio, transcrevendo e analisando sentimento.
 * 
 * Requer consentimento biométrico pois processa dados de voz.
 * 
 * @param audioBase64 - Áudio codificado em base64.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com transcrição, sentimento e ação sugerida.
 * 
 * @example
 * ```typescript
 * const result = await processAudioNote(audioData);
 * console.log(result.transcription); // Texto transcrito
 * console.log(result.sentiment); // 'Positivo', 'Negativo', etc.
 * console.log(result.nextAction); // { type: 'CALL', title: '...', date: '...' }
 * ```
 */
export const processAudioNote = async (
  audioBase64: string,
  _config?: AIConfig
): Promise<{
  transcription: string;
  sentiment: string;
  nextAction?: { type: string; title: string; date: string };
}> => {
  try {
    // processAudioNote requires biometric consent (voice data)
    return await callAIProxy<{
      transcription: string;
      sentiment: string;
      nextAction?: { type: string; title: string; date: string };
    }>('processAudioNote', { audioBase64 });
  } catch (error) {
    console.error('Error processing audio:', error);
    if (isConsentError(error)) {
      return {
        transcription: 'Consentimento para dados biométricos necessário.',
        sentiment: 'Erro'
      };
    }
    if (isRateLimitError(error)) {
      return { transcription: 'Limite de requisições atingido.', sentiment: 'Erro' };
    }
    return { transcription: 'Erro ao processar áudio.', sentiment: 'Erro' };
  }
};

/**
 * Dados para geração do briefing diário.
 * 
 * @interface DailyBriefingData
 * @property {Array<{name: string}>} birthdays - Aniversariantes do dia.
 * @property {number} stalledDeals - Quantidade de deals parados.
 * @property {number} overdueActivities - Atividades atrasadas.
 * @property {number} upsellDeals - Oportunidades de upsell.
 */
interface DailyBriefingData {
  birthdays: Array<{ name: string }>;
  stalledDeals: number;
  overdueActivities: number;
  upsellDeals: number;
}

/**
 * Gera um briefing diário personalizado com resumo das atividades.
 * 
 * @param data - Dados para gerar o briefing.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com texto do briefing personalizado.
 * 
 * @example
 * ```typescript
 * const briefing = await generateDailyBriefing({
 *   birthdays: [{ name: 'João' }],
 *   stalledDeals: 3,
 *   overdueActivities: 5,
 *   upsellDeals: 2
 * });
 * ```
 */
export const generateDailyBriefing = async (
  data: DailyBriefingData,
  _config?: AIConfig
): Promise<string> => {
  try {
    return await callAIProxy<string>('generateDailyBriefing', { data });
  } catch (error) {
    console.error('Error generating briefing:', error);
    if (isConsentError(error)) return 'Consentimento necessário para usar IA.';
    if (isRateLimitError(error)) return 'Limite de requisições atingido.';
    return 'Bom dia! Vamos focar em limpar as pendências hoje.';
  }
};

/**
 * Gera uma mensagem de resgate para reativar deals inativos.
 * 
 * A mensagem é personalizada de acordo com o canal de comunicação.
 * 
 * @param deal - O deal ou view do deal a ser resgatado.
 * @param channel - Canal de comunicação ('EMAIL' | 'WHATSAPP' | 'PHONE').
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @param stageLabel - Nome do estágio atual para contexto.
 * @returns Promise com a mensagem de resgate gerada.
 * 
 * @example
 * ```typescript
 * const message = await generateRescueMessage(deal, 'WHATSAPP');
 * // Mensagem curta e informal para WhatsApp
 * 
 * const email = await generateRescueMessage(deal, 'EMAIL');
 * // Email mais formal e estruturado
 * ```
 */
export const generateRescueMessage = async (
  deal: Deal | DealView,
  channel: 'EMAIL' | 'WHATSAPP' | 'PHONE',
  _config?: AIConfig,
  stageLabel?: string
): Promise<string> => {
  try {
    return await callAIProxy<string>('generateRescueMessage', {
      deal: {
        title: deal.title,
        value: deal.value,
        status: deal.status,
        contactName: 'contactName' in deal ? deal.contactName : undefined,
        companyName: 'companyName' in deal ? deal.companyName : undefined,
      },
      channel,
      stageLabel,
    });
  } catch (error) {
    console.error('Error generating rescue message:', error);
    if (isConsentError(error)) return 'Consentimento necessário para usar IA.';
    if (isRateLimitError(error)) return 'Limite de requisições atingido.';
    return 'Erro ao gerar mensagem.';
  }
};

// --- PROCESSAMENTO DE LINGUAGEM NATURAL ---

/**
 * Ação parseada de texto em linguagem natural.
 * 
 * @interface ParsedAction
 * @property {string} title - Título da ação identificada.
 * @property {'CALL' | 'MEETING' | 'EMAIL' | 'TASK'} type - Tipo da ação.
 * @property {string} [date] - Data em formato ISO (se identificada).
 * @property {string} [contactName] - Nome do contato mencionado.
 * @property {string} [companyName] - Nome da empresa mencionada.
 * @property {number} confidence - Score de confiança (0-1).
 */
export interface ParsedAction {
  title: string;
  type: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK';
  date?: string; // ISO string
  contactName?: string;
  companyName?: string;
  confidence: number;
}

/**
 * Parseia texto em linguagem natural para extrair ações do CRM.
 * 
 * Identifica tarefas, reuniões, chamadas e emails em texto livre.
 * 
 * @param text - Texto em linguagem natural.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com ação identificada ou null se não encontrada.
 * 
 * @example
 * ```typescript
 * const action = await parseNaturalLanguageAction(
 *   'Ligar para João amanhã às 14h sobre proposta'
 * );
 * // { type: 'CALL', title: 'Ligar para João', date: '...', confidence: 0.95 }
 * ```
 */
export const parseNaturalLanguageAction = async (
  text: string,
  _config?: AIConfig
): Promise<ParsedAction | null> => {
  try {
    return await callAIProxy<ParsedAction>('parseNaturalLanguageAction', { text });
  } catch (error) {
    console.error('NLP Action Parsing Error:', error);
    return null;
  }
};

/**
 * Contexto do CRM para chat conversacional.
 * 
 * @interface CRMContext
 * @property {Array<{id: string, title: string, value: number, status: string}>} [deals] - Deals do usuário.
 * @property {Array<{id: string, name: string, email: string}>} [contacts] - Contatos do usuário.
 * @property {Array<{id: string, name: string}>} [companies] - Empresas do usuário.
 * @property {Array<{id: string, title: string, type: string, date: string}>} [activities] - Atividades do usuário.
 */
interface CRMContext {
  deals?: Array<{ id: string; title: string; value: number; status: string }>;
  contacts?: Array<{ id: string; name: string; email: string }>;
  companies?: Array<{ id: string; name: string }>;
  activities?: Array<{ id: string; title: string; type: string; date: string }>;
  [key: string]: unknown;
}

/**
 * Chat conversacional com contexto completo do CRM.
 * 
 * Permite fazer perguntas sobre dados do CRM em linguagem natural.
 * 
 * @param message - Mensagem do usuário.
 * @param context - Contexto com dados do CRM para a IA.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com resposta da IA.
 * 
 * @example
 * ```typescript
 * const response = await chatWithCRM(
 *   'Quais deals estão parados há mais de 7 dias?',
 *   { deals: [...], activities: [...] }
 * );
 * ```
 */
export const chatWithCRM = async (
  message: string,
  context: CRMContext,
  _config?: AIConfig
): Promise<string> => {
  try {
    return await callAIProxy<string>('chatWithCRM', { message, context });
  } catch (error) {
    console.error('Error in chatWithCRM:', error);
    if (isConsentError(error)) return 'Consentimento necessário para usar IA.';
    if (isRateLimitError(error)) return 'Limite de requisições atingido.';
    return 'Desculpe, não consegui processar sua solicitação.';
  }
};

/**
 * Gera uma mensagem de aniversário personalizada.
 * 
 * @param contactName - Nome do contato aniversariante.
 * @param age - Idade do contato (opcional).
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com mensagem de aniversário.
 * 
 * @example
 * ```typescript
 * const message = await generateBirthdayMessage('Maria', 35);
 * // "Parabéns Maria pelos seus 35 anos! ..."
 * ```
 */
export const generateBirthdayMessage = async (
  contactName: string,
  age?: number,
  _config?: AIConfig
): Promise<string> => {
  try {
    return await callAIProxy<string>('generateBirthdayMessage', { contactName, age });
  } catch (error) {
    console.error('Error generating birthday message:', error);
    if (isConsentError(error)) return 'Consentimento necessário para usar IA.';
    if (isRateLimitError(error)) return 'Limite de requisições atingido.';
    return 'Parabéns pelo seu dia!';
  }
};

/**
 * Board gerado por IA com estrutura completa.
 * 
 * @interface GeneratedBoard
 * @property {string} name - Nome do board.
 * @property {string} description - Descrição do propósito.
 * @property {Array} stages - Estágios do pipeline.
 * @property {string[]} automationSuggestions - Sugestões de automação.
 * @property {Object} goal - Meta do board com KPIs.
 * @property {Object} agentPersona - Persona do agente de IA.
 * @property {string} entryTrigger - Gatilho de entrada de novos itens.
 * @property {number} confidence - Score de confiança da geração.
 */
export interface GeneratedBoard {
  name: string;
  description: string;
  stages: {
    name: string;
    description: string;
    color: string;
    linkedLifecycleStage: string;
    estimatedDuration?: string;
  }[];
  automationSuggestions: string[];
  goal: {
    description: string;
    kpi: string;
    targetValue: string;
    currentValue?: string;
  };
  agentPersona: {
    name: string;
    role: string;
    behavior: string;
  };
  entryTrigger: string;
  confidence: number;
  boardName?: string; // Optional alias for name, handled in wizard
  linkedLifecycleStage?: string; // Board-level lifecycle stage
}

// --- GERAÇÃO DE BOARDS EM ETAPAS ---

/**
 * Resultado da geração de estrutura de board.
 * 
 * @interface BoardStructureResult
 * @property {string} boardName - Nome sugerido para o board.
 * @property {string} description - Descrição do propósito.
 * @property {Array} stages - Estágios do pipeline com cores e lifecycle.
 * @property {string[]} automationSuggestions - Sugestões de automação.
 */
interface BoardStructureResult {
  boardName: string;
  description: string;
  stages: Array<{
    name: string;
    description: string;
    color: string;
    linkedLifecycleStage: string;
    estimatedDuration?: string;
  }>;
  automationSuggestions: string[];
}

/**
 * Gera a estrutura de um board a partir de uma descrição em linguagem natural.
 * 
 * Esta é a Etapa 1 da geração de board: cria nome, estágios e sugestões.
 * 
 * @param description - Descrição do processo de negócio desejado.
 * @param lifecycleStages - Estágios de lifecycle disponíveis para vincular.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com estrutura do board gerada.
 * @throws Error se consentimento for necessário.
 * 
 * @example
 * ```typescript
 * const structure = await generateBoardStructure(
 *   'Pipeline de vendas para SaaS B2B',
 *   lifecycleStages
 * );
 * ```
 */
export const generateBoardStructure = async (
  description: string,
  lifecycleStages: LifecycleStage[] = [],
  _config?: AIConfig
): Promise<BoardStructureResult> => {
  try {
    return await callAIProxy<BoardStructureResult>('generateBoardStructure', {
      description,
      lifecycleStages: lifecycleStages.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (error) {
    console.error('Error generating board structure:', error);
    if (isConsentError(error)) {
      throw new Error('Consentimento necessário para usar IA.');
    }
    throw error;
  }
};

/**
 * Resultado da geração de estratégia do board.
 * 
 * @interface BoardStrategyResult
 * @property {Object} goal - Meta com descrição, KPI e valor alvo.
 * @property {Object} agentPersona - Persona do agente de IA do board.
 * @property {string} entryTrigger - Gatilho para novos itens no board.
 */
interface BoardStrategyResult {
  goal: {
    description: string;
    kpi: string;
    targetValue: string;
  };
  agentPersona: {
    name: string;
    role: string;
    behavior: string;
  };
  entryTrigger: string;
}

/**
 * Gera estratégia e metas para um board baseado na estrutura.
 * 
 * Esta é a Etapa 2: define metas, KPIs, persona do agente e gatilhos.
 * 
 * @param boardData - Estrutura do board gerada na Etapa 1.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com estratégia do board.
 * 
 * @example
 * ```typescript
 * const strategy = await generateBoardStrategy(boardStructure);
 * console.log(strategy.goal.kpi); // "Taxa de conversão"
 * console.log(strategy.agentPersona.name); // "Sales Coach"
 * ```
 */
export const generateBoardStrategy = async (
  boardData: BoardStructureResult,
  _config?: AIConfig
): Promise<BoardStrategyResult> => {
  try {
    return await callAIProxy<BoardStrategyResult>('generateBoardStrategy', { boardData });
  } catch (error) {
    console.error('Error generating strategy:', error);
    // Return default strategy if step 2 fails
    return {
      goal: { description: 'Definir meta', kpi: 'N/A', targetValue: '0' },
      agentPersona: { name: 'Assistente', role: 'Operador', behavior: 'Ajudar no processo.' },
      entryTrigger: 'Novos itens',
    };
  }
};

/**
 * Gera um board completo a partir de uma descrição em linguagem natural.
 * 
 * Executa as duas etapas: estrutura (Etapa 1) e estratégia (Etapa 2).
 * 
 * @param description - Descrição do processo de negócio desejado.
 * @param lifecycleStages - Estágios de lifecycle para vincular.
 * @param config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com board completo gerado.
 * 
 * @example
 * ```typescript
 * const board = await generateBoardFromDescription(
 *   'Processo de onboarding de clientes enterprise',
 *   lifecycleStages
 * );
 * ```
 */
export const generateBoardFromDescription = async (
  description: string,
  lifecycleStages: LifecycleStage[] = [],
  config?: AIConfig
): Promise<GeneratedBoard> => {
  // Step 1: Structure
  const boardData = await generateBoardStructure(description, lifecycleStages, config);

  // Step 2: Strategy
  const strategyData = await generateBoardStrategy(boardData, config);

  // Merge Results
  const finalBoard: GeneratedBoard = {
    ...boardData,
    ...strategyData,
    confidence: 0.9,
    name: boardData.boardName,
  };

  return finalBoard;
};

/**
 * Refina um board existente com instruções em linguagem natural.
 * 
 * Permite ajustar estágios, metas e configurações via chat.
 * 
 * @param currentBoard - Board atual a ser refinado.
 * @param userInstruction - Instrução do usuário para modificação.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @param chatHistory - Histórico de conversas para contexto.
 * @returns Promise com mensagem de resposta e board atualizado.
 * @throws Error se consentimento for necessário.
 * 
 * @example
 * ```typescript
 * const result = await refineBoardWithAI(
 *   currentBoard,
 *   'Adicione um estágio de qualificação antes de proposta',
 *   undefined,
 *   chatHistory
 * );
 * console.log(result.message); // Explicação da mudança
 * console.log(result.board); // Board atualizado
 * ```
 */
export const refineBoardWithAI = async (
  currentBoard: GeneratedBoard,
  userInstruction: string,
  _config?: AIConfig,
  chatHistory?: { role: 'user' | 'ai'; content: string }[]
): Promise<{ message: string; board: GeneratedBoard | null }> => {
  try {
    const result = await callAIProxy<{ message: string; board: GeneratedBoard | null }>(
      'refineBoardWithAI',
      { currentBoard, userInstruction, chatHistory }
    );

    // SAFETY MERGE: If AI returns a board but misses strategy fields, merge from currentBoard
    if (result.board) {
      result.board = {
        ...currentBoard,
        ...result.board,
        goal: result.board.goal || currentBoard.goal,
        agentPersona: result.board.agentPersona || currentBoard.agentPersona,
        entryTrigger: result.board.entryTrigger || currentBoard.entryTrigger,
      };
    }

    return result;
  } catch (error) {
    console.error('Error refining board:', error);
    if (isConsentError(error)) {
      throw new Error('Consentimento necessário para usar IA.');
    }
    throw error;
  }
};

/**
 * Resumo de deal para contexto do agente.
 * 
 * @interface DealSummary
 * @property {string} id - ID único do deal.
 * @property {string} title - Título do deal.
 * @property {number} value - Valor monetário.
 * @property {string} status - Status atual.
 * @property {number} [probability] - Probabilidade de fechamento.
 * @property {string} [contactName] - Nome do contato principal.
 */
interface DealSummary {
  id: string;
  title: string;
  value: number;
  status: string;
  probability?: number;
  contactName?: string;
}

/**
 * Chat com o agente de IA de um board específico.
 * 
 * O agente responde com a persona configurada e tem contexto
 * completo das metas, deals e progresso do board.
 * 
 * @param message - Mensagem do usuário.
 * @param boardContext - Contexto completo do board e seus deals.
 * @param _config - Configuração de IA (deprecada, ignorada).
 * @returns Promise com resposta do agente.
 * 
 * @example
 * ```typescript
 * const response = await chatWithBoardAgent(
 *   'Como posso melhorar minha taxa de conversão?',
 *   {
 *     agentName: 'Sales Coach',
 *     agentRole: 'Mentor de Vendas',
 *     ...boardContext
 *   }
 * );
 * ```
 */
export const chatWithBoardAgent = async (
  message: string,
  boardContext: {
    agentName: string;
    agentRole: string;
    agentBehavior: string;
    goalDescription: string;
    goalKPI: string;
    goalTarget: string;
    goalCurrent: string;
    entryTrigger: string;
    dealsSummary: DealSummary[];
  },
  _config?: AIConfig
): Promise<string> => {
  try {
    return await callAIProxy<string>('chatWithBoardAgent', { message, boardContext });
  } catch (error) {
    console.error('Error in chatWithBoardAgent:', error);
    if (isConsentError(error)) return 'Consentimento necessário para usar IA.';
    if (isRateLimitError(error)) return 'Limite de requisições atingido.';
    return 'Desculpe, estou tendo dificuldades para acessar os dados do board agora.';
  }
};
