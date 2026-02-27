/**
 * @fileoverview Deal Templates Service
 * 
 * Módulo 5 do PRD Complementar — Templates de Deal.
 * Permite criar templates com valores padrão para criação rápida de deals.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export interface DealTemplate {
    id: string;
    organization_id: string;
    board_id: string | null;
    name: string;
    description: string | null;
    defaults: DealDefaults;
    created_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DealDefaults {
    title_prefix?: string;
    value?: number;
    stage_id?: string;
    owner_id?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
}

export interface CreateTemplatePayload {
    name: string;
    description?: string;
    board_id?: string;
    defaults: DealDefaults;
    is_active?: boolean;
}

// =============================================
// Templates CRUD
// =============================================

/**
 * Busca todos os templates da organização.
 */
export async function getDealTemplates(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { boardId?: string; activeOnly?: boolean }
): Promise<DealTemplate[]> {
    let query = supabase
        .from('deal_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

    if (options?.boardId) {
        query = query.eq('board_id', options.boardId);
    }
    if (options?.activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Cria um novo template.
 */
export async function createDealTemplate(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    payload: CreateTemplatePayload
): Promise<DealTemplate> {
    const { data, error } = await supabase
        .from('deal_templates')
        .insert({
            organization_id: organizationId,
            name: payload.name,
            description: payload.description || null,
            board_id: payload.board_id || null,
            defaults: payload.defaults,
            is_active: payload.is_active ?? true,
            created_by: userId,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Atualiza um template.
 */
export async function updateDealTemplate(
    supabase: SupabaseClient,
    templateId: string,
    payload: Partial<CreateTemplatePayload>
): Promise<DealTemplate> {
    const { data, error } = await supabase
        .from('deal_templates')
        .update({
            ...payload,
            updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Deleta um template.
 */
export async function deleteDealTemplate(
    supabase: SupabaseClient,
    templateId: string
): Promise<void> {
    const { error } = await supabase
        .from('deal_templates')
        .delete()
        .eq('id', templateId);

    if (error) throw error;
}

/**
 * Aplica um template para criar deal com valores padrão.
 * Retorna o deal criado.
 */
export async function applyTemplate(
    supabase: SupabaseClient,
    organizationId: string,
    templateId: string,
    overrides?: Partial<{
        title: string;
        value: number;
        stage_id: string;
        owner_id: string;
        contact_id: string;
        board_id: string;
    }>
): Promise<any> {
    // Get template
    const { data: template, error: tplErr } = await supabase
        .from('deal_templates')
        .select('*')
        .eq('id', templateId)
        .single();

    if (tplErr || !template) throw new Error('Template not found');

    const defaults = template.defaults as DealDefaults;

    // Create deal with defaults + overrides
    const dealData = {
        organization_id: organizationId,
        title: overrides?.title || `${defaults.title_prefix || template.name} - ${new Date().toLocaleDateString('pt-BR')}`,
        value: overrides?.value ?? defaults.value ?? 0,
        stage_id: overrides?.stage_id || defaults.stage_id,
        owner_id: overrides?.owner_id || defaults.owner_id,
        contact_id: overrides?.contact_id,
        board_id: overrides?.board_id || template.board_id,
        status: 'open',
        custom_fields: defaults.custom_fields || {},
    };

    const { data: deal, error: dealErr } = await supabase
        .from('deals')
        .insert(dealData)
        .select()
        .single();

    if (dealErr) throw dealErr;

    // Apply tags if any
    if (defaults.tags?.length && deal) {
        const tagInserts = defaults.tags.map(tagId => ({
            deal_id: deal.id,
            tag_id: tagId,
        }));
        await supabase
            .from('deal_tags')
            .upsert(tagInserts, { onConflict: 'deal_id,tag_id', ignoreDuplicates: true });
    }

    return deal;
}
