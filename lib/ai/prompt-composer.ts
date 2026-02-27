/**
 * @fileoverview Prompt Composer for Verticalized AI
 *
 * Composes multi-level AI prompts based on:
 *  Level 1: Base system prompt (AI assistant persona)
 *  Level 2: Vertical context (from vertical_configs.ai_context)
 *  Level 3: Entity context (deal/contact data + custom fields)
 *
 * @module lib/ai/prompt-composer
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getOrgVerticalConfig } from '@/lib/supabase/vertical-activation';
import { getCustomFields } from '@/lib/supabase/custom-fields';
import type { VerticalConfig } from '@/types/vertical';

// ─── Types ───────────────────────────────────────────────────────────

export interface ComposedPrompt {
    systemPrompt: string;
    entityContext: string;
    verticalConfig: VerticalConfig;
}

// ─── Base System Prompt ──────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `Você é o NossoCRM AI, assistente inteligente integrado ao CRM.

Regras gerais:
- Sempre responda em português do Brasil.
- Seja claro, objetivo e profissional.
- Quando sugerir ações, seja específico e acionável.
- Nunca invente dados. Use apenas as informações fornecidas no contexto.
- Formate respostas com markdown quando apropriado.`;

// ─── Main Composer ───────────────────────────────────────────────────

/**
 * Composes a multi-level prompt for the AI based on the organization's vertical,
 * the requested action, and the entity context.
 *
 * @param organizationId - The org UUID
 * @param entityType     - 'deal' | 'contact' | null
 * @param entityId       - UUID of the entity (optional)
 * @param action         - Action key from ai_context.action_prompts (e.g. 'follow_up')
 */
export async function composePrompt(
    supabase: SupabaseClient,
    organizationId: string,
    entityType?: string | null,
    entityId?: string | null,
    action?: string | null,
): Promise<ComposedPrompt> {
    // 1. Load vertical config
    const config = await getOrgVerticalConfig(supabase, organizationId);

    if (!config) {
        return {
            systemPrompt: BASE_SYSTEM_PROMPT,
            entityContext: '',
            verticalConfig: {} as VerticalConfig,
        };
    }

    // 2. Compose system prompt (Base + Vertical)
    const verticalPrompt = config.ai_context?.system_prompt_vertical ?? '';
    const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n---\n\n${verticalPrompt}`;

    // 3. Build entity context
    let entityContext = '';
    if (entityType && entityId) {
        entityContext = await buildEntityContext(
            supabase,
            entityType,
            entityId,
            config,
        );
    }

    // 4. Append action-specific instruction
    if (action && config.ai_context?.action_prompts?.[action]) {
        entityContext += `\n\n--- INSTRUÇÃO DA AÇÃO ---\n${config.ai_context.action_prompts[action]}`;
    }

    return {
        systemPrompt,
        entityContext,
        verticalConfig: config,
    };
}

// ─── Entity Context Builder ─────────────────────────────────────────

async function buildEntityContext(
    supabase: SupabaseClient,
    entityType: string,
    entityId: string,
    config: VerticalConfig,
): Promise<string> {
    const displayConfig = config.display_config;

    if (entityType === 'deal') {
        return buildDealContext(supabase, entityId, displayConfig);
    }

    if (entityType === 'contact') {
        return buildContactContext(supabase, entityId, displayConfig);
    }

    return '';
}

async function buildDealContext(
    supabase: SupabaseClient,
    dealId: string,
    displayConfig: VerticalConfig['display_config'],
): Promise<string> {
    // Fetch deal + contact
    const { data: deal } = await supabase
        .from('deals')
        .select('*, contacts(name, email, phone)')
        .eq('id', dealId)
        .single();

    if (!deal) return '';

    // Fetch custom fields
    const customFields = await getCustomFields(supabase, 'deal', dealId);

    const label = displayConfig.deal_label ?? 'Deal';
    const contactLabel = displayConfig.contact_label ?? 'Contato';

    let context = `--- CONTEXTO: ${label.toUpperCase()} ---\n`;
    context += `Título: ${deal.title}\n`;
    context += `Valor: R$ ${Number(deal.value ?? 0).toLocaleString('pt-BR')}\n`;
    context += `Prioridade: ${deal.priority ?? 'N/A'}\n`;
    context += `Criado em: ${deal.created_at}\n`;
    context += `Última atualização: ${deal.updated_at}\n`;

    if (deal.contacts) {
        context += `\n${contactLabel}: ${deal.contacts.name} (${deal.contacts.email}, ${deal.contacts.phone})\n`;
    }

    // Custom fields
    const cfEntries = Object.entries(customFields);
    if (cfEntries.length > 0) {
        context += `\nCampos Específicos:\n`;
        for (const [key, value] of cfEntries) {
            context += `  - ${key}: ${formatValue(value)}\n`;
        }
    }

    return context;
}

async function buildContactContext(
    supabase: SupabaseClient,
    contactId: string,
    displayConfig: VerticalConfig['display_config'],
): Promise<string> {
    const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

    if (!contact) return '';

    const customFields = await getCustomFields(supabase, 'contact', contactId);

    const label = displayConfig.contact_label ?? 'Contato';

    let context = `--- CONTEXTO: ${label.toUpperCase()} ---\n`;
    context += `Nome: ${contact.name}\n`;
    context += `Email: ${contact.email}\n`;
    context += `Telefone: ${contact.phone}\n`;
    context += `Status: ${contact.status}\n`;

    if (contact.last_interaction) {
        context += `Última interação: ${contact.last_interaction}\n`;
    }

    const cfEntries = Object.entries(customFields);
    if (cfEntries.length > 0) {
        context += `\nCampos Específicos:\n`;
        for (const [key, value] of cfEntries) {
            context += `  - ${key}: ${formatValue(value)}\n`;
        }
    }

    return context;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'N/A';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    return String(value);
}
