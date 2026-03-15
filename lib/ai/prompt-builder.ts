/**
 * @fileoverview Prompt Builder — Multi-Agent Methodology System
 *
 * Constrói o system prompt final enriquecido com todos os dados de
 * personalização: metodologia de vendas, tom de voz, contexto de negócio,
 * treinamento comportamental e critérios de qualificação.
 *
 * Usado por: /api/agent/generate-prompt e pelo engine de IA em runtime.
 */

import type {
    ToneOfVoice,
    SalesMethodology,
    KnowledgeBaseConfig,
    BusinessContextExtended,
    BehavioralTraining,
    FollowUpConfig,
    SalesMethodologyConfig,
    AgentPersona,
} from '@/types/agent';
import { AGENT_SYSTEM_PROMPT_BASE } from './agent-prompts';

export interface PersonalizationInput {
    persona?: AgentPersona;
    tone_of_voice?: ToneOfVoice;
    sales_methodology?: SalesMethodologyConfig;
    knowledge_base_config?: KnowledgeBaseConfig;
    business_context_extended?: BusinessContextExtended;
    behavioral_training?: BehavioralTraining;
    follow_up_config?: FollowUpConfig;
}

export interface PromptBuildOptions {
    basePrompt?: string;
    agentRole: string;
    methodology: SalesMethodology | string;
    tone: ToneOfVoice | null;
    qualificationCriteria?: Record<string, unknown>;
    personalization?: PersonalizationInput;
}

// ─── Methodology descriptions ─────────────────────────────────────────────────

const METHODOLOGY_GUIDES: Record<string, string> = {
    bant: `
## METODOLOGIA: BANT
Qualifique leads avaliando 4 pilares nesta ordem:
- **Budget (Orçamento):** Entenda se o lead tem verba disponível. Pergunte indiretamente: "Você já tem um valor em mente para esse investimento?"
- **Authority (Autoridade):** Confirme se fala com o decisor. "A decisão é sua ou envolve mais alguém?"
- **Need (Necessidade):** Aprofunde a dor real. "O que está te incomodando mais hoje com essa situação?"
- **Timeline (Prazo):** Entenda urgência. "Você tem uma data para resolver isso?"
Leads sem Budget + Authority são descartados ou colocados em nurturing.`,

    spin: `
## METODOLOGIA: SPIN Selling
Conduza a conversa por 4 tipos de perguntas estratégicas:
- **Situação:** Colete contexto atual do lead. "Como você está fazendo isso hoje?"
- **Problema:** Revele dores latentes. "O que te frustra nesse processo atual?"
- **Implicação:** Amplie a dor — mostre o custo de não resolver. "Quanto tempo/dinheiro isso está te custando?"
- **Necessidade de Solução:** Faça o lead verbalizar o benefício desejado. "Como seria ideal para você?"
O lead que verbaliza a necessidade já está pronto para a proposta.`,

    meddic: `
## METODOLOGIA: MEDDIC/MEDDICC
Para vendas complexas B2B. Mapeie:
- **Metrics:** Que números o cliente precisa melhorar? ROI esperado?
- **Economic Buyer:** Quem aprova o orçamento?
- **Decision Criteria:** Quais critérios usam para escolher?
- **Decision Process:** Como é o processo de compra deles?
- **Identify Pain:** Qual a dor crítica que os impede de avançar?
- **Champion:** Há um defensor interno da solução?
- **Competition:** Com quem estão nos comparando?`,

    gpct: `
## METODOLOGIA: GPCT
Alinhamento completo com objetivos do cliente:
- **Goals (Metas):** Quais metas numéricas querem atingir?
- **Plans (Planos):** Que estratégias já tentaram?
- **Challenges (Desafios):** O que impede o progresso?
- **Timeline (Prazo):** Quando precisam dos resultados?
Só avance se a solução se encaixa diretamente nas metas declaradas.`,

    flavio_augusto: `
## METODOLOGIA: Flávio Augusto (Filosofia Wiser)
Princípios fundamentais que guiam toda a abordagem:
- **CAC Zero:** Reative clientes inativos antes de buscar novos. Custo de retenção << custo de aquisição.
- **Enriquecimento Mútuo:** A venda só é boa se for genuinamente boa para o cliente. Nunca empurre.
- **Timing:** Esteja no momento certo. Leads que disseram "não" antes podem dizer "sim" hoje.
- **Velocidade:** A velocidade de execução é diferencial competitivo. Não deixe o lead esfriar.
- **Referências:** Todo cliente satisfeito é uma fonte de novos clientes. Peça indicações ativamente.
- **Frugalidade Inteligente:** Maximize resultado com menor recurso. Reaproveite contatos, histórico e contexto.
Aplique: priorize reativação > upsell > cross-sell > novo lead.`,

    neurovendas: `
## METODOLOGIA: Neurovendas
Venda para o cérebro reptiliano — o centro de decisão real:
- **Contraste:** Mostre o antes e depois de forma vívida. "Hoje você perde X por mês. Com nós, recupera em 60 dias."
- **Abertura e Fechamento:** As primeiras e últimas frases ficam mais na memória. Começe e termine com impacto.
- **Visual:** Use imagens mentais e metáforas. "É como ter um vendedor trabalhando 24h por dia."
- **Prova Social:** "Mais de 200 clínicas já usam..." — o cérebro social valida decisões por comparação.
- **Urgência Real:** Prazos e escassez reais ativam o sistema de alerta. Nunca crie urgência falsa.
- **Confiança:** Espelhe a linguagem e o ritmo do lead para criar rapport subliminar.`,

    consultivo: `
## METODOLOGIA: Venda Consultiva
Posicione-se como especialista que resolve problemas, não como vendedor:
- Faça mais perguntas do que afirmações.
- Entenda profundamente o negócio do cliente antes de apresentar qualquer solução.
- Apresente a solução como consequência lógica das necessidades levantadas.
- Seja honesto se a solução não for a melhor para o caso — isso constrói confiança e referências.`,

    hybrid: `
## METODOLOGIA: Híbrida
Combine abordagens conforme o estágio do lead:
- Topo do funil: SPIN (perguntas para revelar necessidade)
- Meio do funil: BANT (qualificação) + Flávio Augusto (timing e enriquecimento mútuo)
- Fundo do funil: Neurovendas (ativação de decisão) + MEDDIC (B2B complexo)`,

    custom: '',
};

// ─── Section Builders ─────────────────────────────────────────────────────────

function buildPersonaSection(persona?: AgentPersona): string {
    if (!persona) return '';
    const parts: string[] = ['\n## IDENTIDADE DO AGENTE'];
    if (persona.name) parts.push(`- **Nome:** ${persona.name}`);
    if (persona.role_description) parts.push(`- **Papel:** ${persona.role_description}`);
    if (persona.communication_style) parts.push(`- **Estilo de comunicação:** ${persona.communication_style}`);
    if (persona.avatar_description) parts.push(`- **Perfil:** ${persona.avatar_description}`);
    return parts.join('\n');
}

function buildToneSection(tone?: ToneOfVoice | null): string {
    if (!tone) return '';
    const parts: string[] = ['\n## TOM DE VOZ'];
    parts.push(`- **Preset:** ${tone.preset}`);

    if (tone.language_style) {
        const s = tone.language_style;
        const attrs: string[] = [];
        if (s.formality) attrs.push(`formalidade: ${s.formality}`);
        if (s.energy) attrs.push(`energia: ${s.energy}`);
        if (s.empathy_level) attrs.push(`empatia: ${s.empathy_level}`);
        if (s.use_emojis !== undefined) attrs.push(`emojis: ${s.use_emojis ? 'sim' : 'não'}`);
        if (attrs.length) parts.push(`- **Estilo:** ${attrs.join(' | ')}`);
    }

    if (tone.words_to_use?.length) {
        parts.push(`- **Palavras recomendadas:** ${tone.words_to_use.slice(0, 10).join(', ')}`);
    }
    if (tone.words_to_avoid?.length) {
        parts.push(`- **Palavras proibidas:** ${tone.words_to_avoid.slice(0, 10).join(', ')}`);
    }
    if (tone.few_shot_examples?.length) {
        parts.push('\n### Exemplos de tom:');
        tone.few_shot_examples.slice(0, 3).forEach((ex) => {
            parts.push(`**Lead:** ${ex.user_message}`);
            parts.push(`**Agente:** ${ex.agent_response}`);
            if (ex.rationale) parts.push(`*(${ex.rationale})*`);
            parts.push('');
        });
    }
    return parts.join('\n');
}

function buildBusinessContextSection(ctx?: BusinessContextExtended): string {
    if (!ctx) return '';
    const parts: string[] = ['\n## CONTEXTO DO NEGÓCIO'];

    if (ctx.key_products_services?.length) {
        parts.push('\n### Produtos/Serviços Principais:');
        ctx.key_products_services.slice(0, 5).forEach((p) => {
            const price = p.price_range ? ` — ${p.price_range}` : '';
            parts.push(`- **${p.name}**${price}: ${p.description}`);
        });
    }

    if (ctx.unique_value_propositions?.length) {
        parts.push('\n### Diferenciais:');
        ctx.unique_value_propositions.forEach((uvp) => parts.push(`- ${uvp}`));
    }

    if (ctx.target_audience) {
        const ta = ctx.target_audience;
        const attrs: string[] = [];
        if (ta.age_range) attrs.push(`idade: ${ta.age_range}`);
        if (ta.income_level) attrs.push(`renda: ${ta.income_level}`);
        if (ta.main_pains?.length) attrs.push(`dores: ${ta.main_pains.join(', ')}`);
        if (attrs.length) parts.push(`\n### Público-alvo: ${attrs.join(' | ')}`);
    }

    if (ctx.important_rules?.length) {
        parts.push('\n### Regras Importantes:');
        ctx.important_rules.forEach((rule) => parts.push(`- ⚠️ ${rule}`));
    }

    return parts.join('\n');
}

function buildBehavioralSection(training?: BehavioralTraining): string {
    if (!training) return '';
    const parts: string[] = ['\n## DIRETRIZES COMPORTAMENTAIS'];

    if (training.do_list?.length) {
        parts.push('\n### SEMPRE fazer:');
        training.do_list.forEach((item) => parts.push(`- ✅ ${item}`));
    }
    if (training.dont_list?.length) {
        parts.push('\n### NUNCA fazer:');
        training.dont_list.forEach((item) => parts.push(`- ❌ ${item}`));
    }
    if (training.escalation_triggers?.length) {
        parts.push('\n### Transferir para humano se:');
        training.escalation_triggers.forEach((t) => parts.push(`- 🔁 ${t}`));
    }
    if (training.conversation_starters?.length) {
        parts.push('\n### Abordagens iniciais sugeridas:');
        training.conversation_starters.slice(0, 3).forEach((s) => parts.push(`- "${s}"`));
    }

    return parts.join('\n');
}

function buildFollowUpSection(config?: FollowUpConfig): string {
    if (!config?.sequences?.length) return '';
    const parts: string[] = ['\n## SEQUÊNCIAS DE FOLLOW-UP'];

    config.sequences.slice(0, 3).forEach((seq) => {
        const seqName = seq.name ?? seq.trigger ?? 'Sequência';
        const seqTrigger = seq.trigger_event ?? seq.trigger ?? '';
        parts.push(`\n### ${seqName} (trigger: ${seqTrigger})`);
        const steps = seq.steps ?? seq.messages ?? [];
        steps.forEach((step, i) => {
            const text = step.content ?? '';
            parts.push(`${i + 1}. Após ${step.delay_hours}h — "${text.substring(0, 80)}..."`);
        });
    });

    if (config.cac_zero_script) {
        parts.push(`\n### Script CAC Zero (reativação):\n"${config.cac_zero_script}"`);
    }

    return parts.join('\n');
}

function buildQualificationSection(criteria?: Record<string, unknown>): string {
    if (!criteria || Object.keys(criteria).length === 0) return '';
    const entries = Object.entries(criteria);
    if (!entries.length) return '';
    const lines = entries.map(([k, v]) => `- **${k}:** ${JSON.stringify(v)}`);
    return `\n## CRITÉRIOS DE QUALIFICAÇÃO DO ESTÁGIO\n${lines.join('\n')}`;
}

// ─── Main Builder ─────────────────────────────────────────────────────────────

export function buildPersonalizedSystemPrompt(opts: PromptBuildOptions): string {
    const {
        basePrompt,
        agentRole,
        methodology,
        tone,
        qualificationCriteria,
        personalization,
    } = opts;

    const sections: string[] = [];

    // 1. Base prompt (from template or global config) — or fallback to base
    sections.push(basePrompt || AGENT_SYSTEM_PROMPT_BASE);

    // 2. Persona override (if configured)
    if (personalization?.persona) {
        sections.push(buildPersonaSection(personalization.persona));
    }

    // 3. Methodology guide
    const methodologyKey = (personalization?.sales_methodology?.primary ?? methodology) as string;
    const methodologyGuide = METHODOLOGY_GUIDES[methodologyKey];
    if (methodologyGuide) {
        sections.push(methodologyGuide);
    }

    // 4. Secondary methodologies
    const secondaries = Array.isArray(personalization?.sales_methodology?.secondary)
        ? personalization.sales_methodology.secondary as string[]
        : [];
    secondaries.forEach((m) => {
        const guide = METHODOLOGY_GUIDES[m];
        if (guide && guide !== methodologyGuide) {
            sections.push(guide);
        }
    });

    // 5. Custom approach notes
    if (personalization?.sales_methodology?.custom_approach) {
        sections.push(`\n## ABORDAGEM CUSTOMIZADA\n${personalization.sales_methodology.custom_approach}`);
    }

    // 6. Tone of voice
    const activeTone = personalization?.tone_of_voice ?? tone;
    if (activeTone) {
        sections.push(buildToneSection(activeTone));
    }

    // 7. Business context
    if (personalization?.business_context_extended) {
        sections.push(buildBusinessContextSection(personalization.business_context_extended));
    }

    // 8. Behavioral training
    if (personalization?.behavioral_training) {
        sections.push(buildBehavioralSection(personalization.behavioral_training));
    }

    // 9. Knowledge base instructions
    if (personalization?.knowledge_base_config) {
        const kb = personalization.knowledge_base_config;
        const kbLines: string[] = ['\n## BASE DE CONHECIMENTO'];
        if (kb.always_search_before_respond) {
            kbLines.push('- **OBRIGATÓRIO:** Use `search_knowledge` ANTES de responder qualquer dúvida sobre produtos, preços, regras ou horários.');
        }
        kbLines.push(`- Threshold de relevância: ${kb.search_threshold ?? 0.7} | Máx. resultados: ${kb.max_results_per_query ?? 3}`);
        if (kb.sources?.length) {
            kbLines.push(`- Fontes ativas: ${kb.sources.filter((s) => s.is_active).map((s) => s.name).join(', ')}`);
        }
        sections.push(kbLines.join('\n'));
    }

    // 10. Stage-specific qualification criteria
    if (qualificationCriteria) {
        sections.push(buildQualificationSection(qualificationCriteria));
    }

    // 11. Follow-up sequences
    if (personalization?.follow_up_config) {
        sections.push(buildFollowUpSection(personalization.follow_up_config));
    }

    // 12. Agent role reminder (footer)
    if (agentRole && agentRole !== 'generic') {
        sections.push(`\n---\n*Papel atual neste pipeline: **${agentRole}***`);
    }

    return sections.filter(Boolean).join('\n\n').trim();
}
