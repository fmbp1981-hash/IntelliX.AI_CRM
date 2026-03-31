/**
 * @fileoverview Email Campaigns Service
 *
 * Módulo de Email Marketing — Campanhas segmentadas com templates,
 * segmentação por contatos/tags/lifecycle, envio via Resend e tracking.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';

export type SendStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'failed';

export interface SegmentFilters {
    tags?: string[];
    lifecycle_stage?: string[];
    vertical?: string;
    has_email?: boolean;
    // Customer Intelligence segments
    pipeline_stage?: { board_id: string; stage_ids: string[] };
    reactivation?: { inactive_days: number };
    ready_for_proposal?: { min_probability: number };
}

export interface EmailTemplate {
    id: string;
    organization_id: string;
    name: string;
    subject: string;
    html_body: string;
    text_body: string | null;
    preview_text: string | null;
    ai_generated: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface EmailCampaign {
    id: string;
    organization_id: string;
    name: string;
    status: CampaignStatus;
    template_id: string | null;
    segment_filters: SegmentFilters;
    estimated_recipients: number;
    scheduled_at: string | null;
    sent_at: string | null;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Joined
    template?: EmailTemplate;
}

export interface EmailCampaignSend {
    id: string;
    campaign_id: string;
    contact_id: string;
    email: string;
    resend_message_id: string | null;
    status: SendStatus;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    error_message: string | null;
    created_at: string;
}

export interface CreateTemplatePayload {
    name: string;
    subject: string;
    html_body: string;
    text_body?: string;
    preview_text?: string;
    ai_generated?: boolean;
}

export interface CreateCampaignPayload {
    name: string;
    template_id?: string;
    segment_filters?: SegmentFilters;
    scheduled_at?: string;
}

export interface CampaignMetrics {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
}

// =============================================
// Email Templates CRUD
// =============================================

export async function getEmailTemplates(
    supabase: SupabaseClient,
    organizationId: string
): Promise<EmailTemplate[]> {
    const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

export async function createEmailTemplate(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    payload: CreateTemplatePayload
): Promise<EmailTemplate> {
    const { data, error } = await supabase
        .from('email_templates')
        .insert({
            organization_id: organizationId,
            created_by: userId,
            ...payload,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateEmailTemplate(
    supabase: SupabaseClient,
    templateId: string,
    updates: Partial<CreateTemplatePayload>
): Promise<EmailTemplate> {
    const { data, error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteEmailTemplate(
    supabase: SupabaseClient,
    templateId: string
): Promise<void> {
    const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

    if (error) throw error;
}

// =============================================
// Campaigns CRUD
// =============================================

export async function getEmailCampaigns(
    supabase: SupabaseClient,
    organizationId: string,
    options?: { status?: CampaignStatus }
): Promise<EmailCampaign[]> {
    let query = supabase
        .from('email_campaigns')
        .select('*, template:email_templates(*)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (options?.status) {
        query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
}

export async function getEmailCampaignById(
    supabase: SupabaseClient,
    campaignId: string
): Promise<EmailCampaign | null> {
    const { data, error } = await supabase
        .from('email_campaigns')
        .select('*, template:email_templates(*)')
        .eq('id', campaignId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
}

export async function createEmailCampaign(
    supabase: SupabaseClient,
    organizationId: string,
    userId: string,
    payload: CreateCampaignPayload
): Promise<EmailCampaign> {
    const { data, error } = await supabase
        .from('email_campaigns')
        .insert({
            organization_id: organizationId,
            created_by: userId,
            name: payload.name,
            template_id: payload.template_id ?? null,
            segment_filters: payload.segment_filters ?? {},
            scheduled_at: payload.scheduled_at ?? null,
            status: 'draft',
        })
        .select('*, template:email_templates(*)')
        .single();

    if (error) throw error;
    return data;
}

export async function updateEmailCampaign(
    supabase: SupabaseClient,
    campaignId: string,
    updates: Partial<CreateCampaignPayload> & { status?: CampaignStatus; estimated_recipients?: number }
): Promise<EmailCampaign> {
    const { data, error } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', campaignId)
        .select('*, template:email_templates(*)')
        .single();

    if (error) throw error;
    return data;
}

export async function deleteEmailCampaign(
    supabase: SupabaseClient,
    campaignId: string
): Promise<void> {
    const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId);

    if (error) throw error;
}

// =============================================
// Segment Resolution
// Resolve filtros → lista de contatos elegíveis
// =============================================

export async function resolveSegment(
    supabase: SupabaseClient,
    organizationId: string,
    filters: SegmentFilters
): Promise<{ id: string; name: string; email: string }[]> {
    let query = supabase
        .from('contacts')
        .select('id, name, email')
        .eq('organization_id', organizationId)
        .not('email', 'is', null)
        .neq('email', '');

    if (filters.lifecycle_stage?.length) {
        query = query.in('lifecycle_stage', filters.lifecycle_stage);
    }

    if (filters.tags?.length) {
        // Contatos que têm qualquer uma das tags (overlap com array Postgres)
        query = query.overlaps('tags', filters.tags);
    }

    // Pipeline stage segment — contacts with active deals in specific stages
    if (filters.pipeline_stage) {
        const { board_id, stage_ids } = filters.pipeline_stage;
        const { data: dealContacts } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('board_id', board_id)
            .in('status', stage_ids)
            .eq('is_won', false)
            .eq('is_lost', false);
        if (!dealContacts?.length) return [];
        const contactIds = [...new Set(dealContacts.map((d: { contact_id: string }) => d.contact_id))];
        query = query.in('id', contactIds);
    }

    // Reactivation segment — contacts whose last purchase/deal was before cutoff
    if (filters.reactivation) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filters.reactivation.inactive_days);
        const cutoffISO = cutoff.toISOString();
        // Get contacts that have deals, but last deal was before cutoff
        const { data: recentDeals } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('organization_id', organizationId)
            .gte('updated_at', cutoffISO);
        const recentContactIds = new Set((recentDeals ?? []).map((d: { contact_id: string }) => d.contact_id));
        const { data: anyDeals } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('organization_id', organizationId);
        const inactiveIds = (anyDeals ?? [])
            .map((d: { contact_id: string }) => d.contact_id)
            .filter((id: string) => !recentContactIds.has(id));
        if (!inactiveIds.length) return [];
        query = query.in('id', [...new Set(inactiveIds)]);
    }

    // Ready for proposal segment — contacts with deals having high closing probability
    if (filters.ready_for_proposal) {
        const { data: highProbDeals } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('organization_id', organizationId)
            .gte('closing_probability', filters.ready_for_proposal.min_probability)
            .eq('is_won', false)
            .eq('is_lost', false);
        if (!highProbDeals?.length) return [];
        const contactIds = [...new Set(highProbDeals.map((d: { contact_id: string }) => d.contact_id))];
        query = query.in('id', contactIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    const contacts = data ?? [];

    // Filtrar emails que já desativaram recebimento (unsubscribes)
    if (contacts.length === 0) return [];

    const emails = contacts.map(c => c.email);
    const { data: unsubs } = await supabase
        .from('email_unsubscribes')
        .select('email')
        .eq('organization_id', organizationId)
        .in('email', emails);

    const unsubSet = new Set((unsubs ?? []).map((u: { email: string }) => u.email));

    return contacts.filter(c => c.email && !unsubSet.has(c.email)) as { id: string; name: string; email: string }[];
}

// =============================================
// Template Variable Interpolation
// Substitui {{contact.name}}, {{contact.email}}, {{deal.title}}
// =============================================

export function renderTemplate(
    template: Pick<EmailTemplate, 'subject' | 'html_body' | 'text_body'>,
    contact: { name?: string | null; email?: string | null },
    unsubscribeUrl: string
): { subject: string; html: string; text: string } {
    const vars: Record<string, string> = {
        'contact.name': contact.name ?? 'Cliente',
        'contact.email': contact.email ?? '',
        'unsubscribe_url': unsubscribeUrl,
    };

    const interpolate = (str: string) =>
        str.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? '');

    return {
        subject: interpolate(template.subject),
        html: interpolate(template.html_body).replace(
            /<\/body>/i,
            `<p style="font-size:12px;color:#999;text-align:center;margin-top:32px;">
                <a href="${unsubscribeUrl}" style="color:#999;">Cancelar inscrição</a>
             </p></body>`
        ),
        text: interpolate(template.text_body ?? template.html_body.replace(/<[^>]+>/g, ' ')),
    };
}

// =============================================
// Send Campaign (via Resend REST API)
// =============================================

export async function sendCampaignEmail(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
    fromEmail: string;
    fromName: string;
    resendApiKey: string;
    replyTo?: string;
}): Promise<{ id: string } | null> {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${opts.resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${opts.fromName} <${opts.fromEmail}>`,
            to: [opts.to],
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
            reply_to: opts.replyTo,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend error ${res.status}: ${err}`);
    }

    return res.json();
}

// =============================================
// Campaign Metrics
// =============================================

export function computeMetrics(campaign: EmailCampaign): CampaignMetrics {
    const sent = campaign.total_sent || 0;
    return {
        total_sent: sent,
        total_delivered: campaign.total_delivered,
        total_opened: campaign.total_opened,
        total_clicked: campaign.total_clicked,
        total_bounced: campaign.total_bounced,
        total_unsubscribed: campaign.total_unsubscribed,
        open_rate: sent > 0 ? (campaign.total_opened / sent) * 100 : 0,
        click_rate: sent > 0 ? (campaign.total_clicked / sent) * 100 : 0,
        bounce_rate: sent > 0 ? (campaign.total_bounced / sent) * 100 : 0,
    };
}
