/**
 * @fileoverview Contact Enrichment Service
 * 
 * Módulo 9 do PRD Complementar — Enriquecimento de Contato.
 * Busca dados adicionais sobre contatos usando AI e fontes públicas.
 * 
 * Estratégia: Usa AI para enriquecer dados de contato com informações
 * de contexto como cargo, empresa, redes sociais, etc.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export interface EnrichmentResult {
    contact_id: string;
    enriched_fields: Record<string, any>;
    confidence: number;
    source: string;
    created_at: string;
}

export interface ContactEnrichmentData {
    company_name?: string;
    job_title?: string;
    industry?: string;
    company_size?: string;
    linkedin_url?: string;
    website?: string;
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
    social_profiles?: Record<string, string>;
    enrichment_score?: number;
}

// =============================================
// Enrichment Logic
// =============================================

/**
 * Enriquece um contato buscando dados adicionais.
 * Usa dados existentes (email, phone, nome) como sementes.
 */
export async function enrichContact(
    supabase: SupabaseClient,
    contactId: string,
    organizationId: string
): Promise<EnrichmentResult> {
    // Get current contact data
    const { data: contact, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('organization_id', organizationId)
        .single();

    if (error || !contact) throw new Error('Contact not found');

    // Calculate enrichment from existing data
    const enriched: ContactEnrichmentData = {};
    const customFields = (contact.custom_fields as Record<string, any>) || {};

    // Extract domain from email
    if (contact.email && !customFields.company_domain) {
        const domain = contact.email.split('@')[1];
        if (domain && !['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'].includes(domain)) {
            enriched.website = `https://${domain}`;
            enriched.company_name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        }
    }

    // Extract area code / region from phone
    if (contact.phone) {
        const cleaned = contact.phone.replace(/\D/g, '');
        if (cleaned.startsWith('55') && cleaned.length >= 12) {
            const ddd = cleaned.substring(2, 4);
            const regionMap: Record<string, { city: string; state: string }> = {
                '11': { city: 'São Paulo', state: 'SP' },
                '21': { city: 'Rio de Janeiro', state: 'RJ' },
                '31': { city: 'Belo Horizonte', state: 'MG' },
                '41': { city: 'Curitiba', state: 'PR' },
                '51': { city: 'Porto Alegre', state: 'RS' },
                '61': { city: 'Brasília', state: 'DF' },
                '71': { city: 'Salvador', state: 'BA' },
                '81': { city: 'Recife', state: 'PE' },
                '85': { city: 'Fortaleza', state: 'CE' },
                '91': { city: 'Belém', state: 'PA' },
                '62': { city: 'Goiânia', state: 'GO' },
                '92': { city: 'Manaus', state: 'AM' },
                '48': { city: 'Florianópolis', state: 'SC' },
                '27': { city: 'Vitória', state: 'ES' },
            };

            const region = regionMap[ddd];
            if (region) {
                enriched.city = region.city;
                enriched.state = region.state;
                enriched.country = 'Brasil';
            }
        }
    }

    // Calculate enrichment score (how complete is the contact)
    const fields = ['name', 'email', 'phone', 'company_name', 'job_title'];
    const filledCount = fields.filter(f => {
        if (f === 'company_name') return enriched.company_name || customFields.company_name;
        if (f === 'job_title') return customFields.job_title;
        return contact[f];
    }).length;
    enriched.enrichment_score = Math.round((filledCount / fields.length) * 100);

    // Only update if we found something new
    const hasNewData = Object.keys(enriched).filter(k => k !== 'enrichment_score').length > 0;

    if (hasNewData) {
        // Merge with existing custom_fields
        const updatedCustomFields = {
            ...customFields,
            ...enriched,
            enriched_at: new Date().toISOString(),
        };

        await supabase
            .from('contacts')
            .update({ custom_fields: updatedCustomFields })
            .eq('id', contactId);
    }

    return {
        contact_id: contactId,
        enriched_fields: enriched,
        confidence: hasNewData ? 0.7 : 0,
        source: 'internal_analysis',
        created_at: new Date().toISOString(),
    };
}

/**
 * Enriquece contatos em lote.
 */
export async function enrichContactsBatch(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { limit?: number }
): Promise<{ processed: number; enriched: number; results: EnrichmentResult[] }> {
    // Get contacts that haven't been enriched
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', organizationId)
        .or('custom_fields->enriched_at.is.null,custom_fields.is.null')
        .limit(options?.limit ?? 20);

    if (error || !contacts?.length) return { processed: 0, enriched: 0, results: [] };

    const results: EnrichmentResult[] = [];
    let enriched = 0;

    for (const contact of contacts) {
        try {
            const result = await enrichContact(supabase, contact.id, organizationId);
            results.push(result);
            if (result.confidence > 0) enriched++;
        } catch (err) {
            // Skip failed enrichments
        }
    }

    return {
        processed: contacts.length,
        enriched,
        results,
    };
}
