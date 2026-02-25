/**
 * @fileoverview Service for vertical property management (Real Estate vertical)
 *
 * CRUD operations for the `vertical_properties` table.
 * Only active when feature flag `property_management` is enabled.
 *
 * @module lib/supabase/vertical-properties
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────────

export interface VerticalProperty {
    id: string;
    organization_id: string;
    property_type: 'apartamento' | 'casa' | 'comercial' | 'terreno';
    transaction_type: 'venda' | 'locacao' | 'venda_e_locacao';
    address_json: {
        rua?: string;
        numero?: string;
        bairro?: string;
        cidade?: string;
        estado?: string;
        cep?: string;
    };
    value: number | null;
    area_m2: number | null;
    bedrooms: number | null;
    status: 'disponivel' | 'reservado' | 'vendido' | 'locado';
    owner_contact_id: string | null;
    assigned_broker_id: string | null;
    features_json: string[];
    photos_urls: string[];
    created_at: string;
    updated_at: string;
}

export interface CreatePropertyInput {
    property_type: string;
    transaction_type: string;
    address_json?: Record<string, string>;
    value?: number;
    area_m2?: number;
    bedrooms?: number;
    status?: string;
    owner_contact_id?: string;
    assigned_broker_id?: string;
    features_json?: string[];
    photos_urls?: string[];
}

export interface PropertyFilters {
    status?: string;
    property_type?: string;
    transaction_type?: string;
    assigned_broker_id?: string;
    min_value?: number;
    max_value?: number;
    min_bedrooms?: number;
    bairro?: string;
}

export interface PropertyMatchScore {
    property: VerticalProperty;
    score: number;
    matchReasons: string[];
}

// ─── CRUD Operations ─────────────────────────────────────────────────

export async function listProperties(
    supabase: SupabaseClient,
    organizationId: string,
    filters?: PropertyFilters
): Promise<VerticalProperty[]> {
    let query = supabase
        .from('vertical_properties')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.property_type) query = query.eq('property_type', filters.property_type);
    if (filters?.transaction_type) query = query.eq('transaction_type', filters.transaction_type);
    if (filters?.assigned_broker_id) query = query.eq('assigned_broker_id', filters.assigned_broker_id);
    if (filters?.min_value) query = query.gte('value', filters.min_value);
    if (filters?.max_value) query = query.lte('value', filters.max_value);
    if (filters?.min_bedrooms) query = query.gte('bedrooms', filters.min_bedrooms);

    const { data, error } = await query;
    if (error) throw error;

    let results = (data ?? []) as VerticalProperty[];

    if (filters?.bairro) {
        results = results.filter(p =>
            p.address_json?.bairro?.toLowerCase().includes(filters.bairro!.toLowerCase())
        );
    }

    return results;
}

export async function getProperty(
    supabase: SupabaseClient,
    propertyId: string
): Promise<VerticalProperty> {
    const { data, error } = await supabase
        .from('vertical_properties')
        .select('*')
        .eq('id', propertyId)
        .single();

    if (error) throw error;
    return data as VerticalProperty;
}

export async function createProperty(
    supabase: SupabaseClient,
    organizationId: string,
    input: CreatePropertyInput
): Promise<VerticalProperty> {
    const { data, error } = await supabase
        .from('vertical_properties')
        .insert({
            organization_id: organizationId,
            ...input,
        })
        .select()
        .single();

    if (error) throw error;
    return data as VerticalProperty;
}

export async function updateProperty(
    supabase: SupabaseClient,
    propertyId: string,
    updates: Partial<CreatePropertyInput>
): Promise<VerticalProperty> {
    const { data, error } = await supabase
        .from('vertical_properties')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', propertyId)
        .select()
        .single();

    if (error) throw error;
    return data as VerticalProperty;
}

export async function deleteProperty(
    supabase: SupabaseClient,
    propertyId: string
): Promise<void> {
    const { error } = await supabase
        .from('vertical_properties')
        .delete()
        .eq('id', propertyId);

    if (error) throw error;
}

// ─── Property Matching ───────────────────────────────────────────────

export async function matchPropertiesForClient(
    supabase: SupabaseClient,
    organizationId: string,
    contactId: string
): Promise<PropertyMatchScore[]> {
    // Get client preferences
    const { data: cfValues } = await supabase
        .from('custom_field_values')
        .select('field_key, field_value')
        .eq('entity_type', 'contact')
        .eq('entity_id', contactId);

    const prefs: Record<string, any> = {};
    (cfValues ?? []).forEach(cf => {
        prefs[cf.field_key] = cf.field_value;
    });

    const budgetMin = Number(prefs.faixa_orcamento_min) || 0;
    const budgetMax = Number(prefs.faixa_orcamento_max) || Infinity;
    const minBedrooms = Number(prefs.quartos_minimo) || 0;

    let desiredTypes: string[] = [];
    try {
        const raw = prefs.tipo_imovel_desejado;
        if (Array.isArray(raw)) desiredTypes = raw.map((t: string) => t.toLowerCase());
        else if (typeof raw === 'string') desiredTypes = [raw.toLowerCase().replace(/"/g, '')];
    } catch { /* ignore */ }

    // Fetch available properties
    const properties = await listProperties(supabase, organizationId, { status: 'disponivel' });

    // Score each property
    const scored: PropertyMatchScore[] = properties.map(property => {
        let score = 0;
        const matchReasons: string[] = [];

        // Budget match (40 points)
        const pValue = Number(property.value) || 0;
        if (pValue >= budgetMin && pValue <= budgetMax) {
            score += 40;
            matchReasons.push('Dentro do orçamento');
        } else if (pValue > budgetMax) {
            const overBudget = ((pValue - budgetMax) / budgetMax) * 100;
            if (overBudget <= 10) {
                score += 20;
                matchReasons.push('Ligeiramente acima do orçamento');
            }
        }

        // Property type match (25 points)
        if (desiredTypes.length === 0 || desiredTypes.includes(property.property_type.toLowerCase())) {
            score += 25;
            matchReasons.push(`Tipo: ${property.property_type}`);
        }

        // Bedrooms match (20 points)
        if (minBedrooms > 0 && property.bedrooms && property.bedrooms >= minBedrooms) {
            score += 20;
            matchReasons.push(`${property.bedrooms} quartos (mín: ${minBedrooms})`);
        } else if (minBedrooms === 0) {
            score += 10;
        }

        // Region match (15 points)
        let desiredRegions: string[] = [];
        try {
            const raw = prefs.regiao_interesse;
            if (Array.isArray(raw)) desiredRegions = raw.map((r: string) => r.toLowerCase().replace(/"/g, ''));
        } catch { /* ignore */ }

        if (desiredRegions.length > 0 && property.address_json?.bairro) {
            const bairro = property.address_json.bairro.toLowerCase();
            if (desiredRegions.some(r => bairro.includes(r))) {
                score += 15;
                matchReasons.push(`Região: ${property.address_json.bairro}`);
            }
        } else if (desiredRegions.length === 0) {
            score += 5;
        }

        return { property, score, matchReasons };
    });

    // Sort by score descending, return top 10
    return scored
        .filter(s => s.score > 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}
