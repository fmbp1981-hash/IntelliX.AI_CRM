/**
 * @fileoverview Agent Methodology Service
 *
 * CRUD para o sistema multi-agente de metodologias de vendas.
 * Gerencia templates de metodologia, configurações por board/estágio
 * e personalização profunda do agente.
 *
 * Hierarquia de configuração (maior prioridade primeiro):
 *   agent_stage_configs > agent_board_configs > agent_configs (global)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    AgentConfig,
    AgentMethodologyTemplate,
    AgentBoardConfig,
    AgentStageConfig,
    AgentMode,
    SalesMethodology,
    ToneOfVoice,
    KnowledgeBaseConfig,
    BusinessContextExtended,
    BehavioralTraining,
    FollowUpConfig,
    SalesMethodologyConfig,
    AgentPersona,
} from '@/types/agent';

// ─── Methodology Templates ────────────────────────────────────────────────────

export async function listMethodologyTemplates(
    supabase: SupabaseClient,
    options?: { vertical?: string | null; agent_role?: string }
): Promise<AgentMethodologyTemplate[]> {
    let query = supabase
        .from('agent_methodology_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (options?.vertical !== undefined) {
        // Return generic (vertical=null) + vertical-specific
        query = query.or(
            `vertical.is.null,vertical.eq.${options.vertical}`
        );
    }
    if (options?.agent_role) {
        query = query.eq('agent_role', options.agent_role);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AgentMethodologyTemplate[];
}

export async function getMethodologyTemplate(
    supabase: SupabaseClient,
    templateId: string
): Promise<AgentMethodologyTemplate | null> {
    const { data, error } = await supabase
        .from('agent_methodology_templates')
        .select('*')
        .eq('id', templateId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as AgentMethodologyTemplate | null;
}

// ─── Board Configs ────────────────────────────────────────────────────────────

export async function getAgentBoardConfig(
    supabase: SupabaseClient,
    organizationId: string,
    boardId: string
): Promise<AgentBoardConfig | null> {
    const { data, error } = await supabase
        .from('agent_board_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('board_id', boardId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as AgentBoardConfig | null;
}

export async function listAgentBoardConfigs(
    supabase: SupabaseClient,
    organizationId: string
): Promise<AgentBoardConfig[]> {
    const { data, error } = await supabase
        .from('agent_board_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

    if (error) throw error;
    return (data ?? []) as AgentBoardConfig[];
}

export async function upsertAgentBoardConfig(
    supabase: SupabaseClient,
    organizationId: string,
    boardId: string,
    config: Partial<AgentBoardConfig>
): Promise<AgentBoardConfig> {
    const { data, error } = await supabase
        .from('agent_board_configs')
        .upsert(
            { ...config, organization_id: organizationId, board_id: boardId },
            { onConflict: 'organization_id,board_id' }
        )
        .select()
        .single();

    if (error) throw error;
    return data as AgentBoardConfig;
}

// ─── Stage Configs ────────────────────────────────────────────────────────────

export async function getAgentStageConfig(
    supabase: SupabaseClient,
    organizationId: string,
    stageId: string
): Promise<AgentStageConfig | null> {
    const { data, error } = await supabase
        .from('agent_stage_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('stage_id', stageId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as AgentStageConfig | null;
}

export async function listAgentStageConfigsByBoard(
    supabase: SupabaseClient,
    organizationId: string,
    boardId: string
): Promise<AgentStageConfig[]> {
    const { data, error } = await supabase
        .from('agent_stage_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('board_id', boardId);

    if (error) throw error;
    return (data ?? []) as AgentStageConfig[];
}

export async function upsertAgentStageConfig(
    supabase: SupabaseClient,
    organizationId: string,
    boardId: string,
    stageId: string,
    config: Partial<AgentStageConfig>
): Promise<AgentStageConfig> {
    const { data, error } = await supabase
        .from('agent_stage_configs')
        .upsert(
            {
                ...config,
                organization_id: organizationId,
                board_id: boardId,
                stage_id: stageId,
            },
            { onConflict: 'organization_id,stage_id' }
        )
        .select()
        .single();

    if (error) throw error;
    return data as AgentStageConfig;
}

// ─── Personalization (agent_configs JSON fields) ──────────────────────────────

export type PersonalizationSection =
    | 'persona'
    | 'tone_of_voice'
    | 'sales_methodology'
    | 'knowledge_base_config'
    | 'business_context_extended'
    | 'behavioral_training'
    | 'follow_up_config';

export type PersonalizationPayload = {
    persona?: AgentPersona;
    tone_of_voice?: ToneOfVoice;
    sales_methodology?: SalesMethodologyConfig;
    knowledge_base_config?: KnowledgeBaseConfig;
    business_context_extended?: BusinessContextExtended;
    behavioral_training?: BehavioralTraining;
    follow_up_config?: FollowUpConfig;
};

export async function getAgentPersonalization(
    supabase: SupabaseClient,
    organizationId: string
): Promise<PersonalizationPayload | null> {
    const { data, error } = await supabase
        .from('agent_configs')
        .select(
            'persona, tone_of_voice, sales_methodology, knowledge_base_config, business_context_extended, behavioral_training, follow_up_config'
        )
        .eq('organization_id', organizationId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as PersonalizationPayload | null;
}

export async function updateAgentPersonalization(
    supabase: SupabaseClient,
    organizationId: string,
    section: PersonalizationSection,
    value: PersonalizationPayload[PersonalizationSection]
): Promise<void> {
    const { error } = await supabase
        .from('agent_configs')
        .update({ [section]: value })
        .eq('organization_id', organizationId);

    if (error) throw error;
}

export async function updateAgentPersonalizationBulk(
    supabase: SupabaseClient,
    organizationId: string,
    payload: Partial<PersonalizationPayload>
): Promise<AgentConfig> {
    const { data, error } = await supabase
        .from('agent_configs')
        .update(payload)
        .eq('organization_id', organizationId)
        .select()
        .single();

    if (error) throw error;
    return data as AgentConfig;
}

// ─── Resolved Prompt Builder ──────────────────────────────────────────────────
// Resolves the effective prompt for a conversation considering hierarchy:
//   stage_config > board_config > global agent_config

export interface ResolvedAgentConfig {
    system_prompt: string;
    agent_role: string;
    methodology: SalesMethodology;
    tone: ToneOfVoice | null;
    qualification_criteria: Record<string, unknown>;
}

export async function resolveAgentConfigForConversation(
    supabase: SupabaseClient,
    organizationId: string,
    opts: { stageId?: string; boardId?: string }
): Promise<ResolvedAgentConfig> {
    // 1. Try stage config (most specific)
    if (opts.stageId) {
        const stageConfig = await getAgentStageConfig(supabase, organizationId, opts.stageId);
        if (stageConfig?.system_prompt_override) {
            return {
                system_prompt: stageConfig.system_prompt_override,
                agent_role: stageConfig.agent_role ?? 'generic',
                methodology: 'custom',
                tone: null,
                qualification_criteria: stageConfig.qualification_criteria,
            };
        }
    }

    // 2. Try board config
    if (opts.boardId) {
        const boardConfig = await getAgentBoardConfig(supabase, organizationId, opts.boardId);
        if (boardConfig?.system_prompt_override) {
            return {
                system_prompt: boardConfig.system_prompt_override,
                agent_role: boardConfig.agent_role,
                methodology: 'custom',
                tone: null,
                qualification_criteria: {},
            };
        }
        // If board has a template, fetch and use it
        if (boardConfig?.methodology_template_id) {
            const template = await getMethodologyTemplate(supabase, boardConfig.methodology_template_id);
            if (template) {
                return {
                    system_prompt: template.system_prompt,
                    agent_role: template.agent_role,
                    methodology: template.methodology as SalesMethodology,
                    tone: null,
                    qualification_criteria: {},
                };
            }
        }
    }

    // 3. Fall back to global agent_config (existing behavior)
    const { data } = await supabase
        .from('agent_configs')
        .select('system_prompt_override, tone_of_voice, sales_methodology')
        .eq('organization_id', organizationId)
        .single();

    return {
        system_prompt: data?.system_prompt_override ?? '',
        agent_role: 'generic',
        methodology: (data?.sales_methodology as SalesMethodologyConfig)?.primary ?? 'bant',
        tone: data?.tone_of_voice as ToneOfVoice | null,
        qualification_criteria: {},
    };
}
