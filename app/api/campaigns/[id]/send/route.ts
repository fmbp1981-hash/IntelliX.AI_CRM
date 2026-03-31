/**
 * @fileoverview API Route: Send Campaign
 *
 * POST /api/campaigns/[id]/send
 *
 * Dispara a campanha: resolve segmento, renderiza template por contato,
 * envia via Resend e registra cada envio em email_campaign_sends.
 *
 * Envio em lote com rate limiting gentil (50ms entre envios) para
 * não estourar limites do Resend em planos free.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    getEmailCampaignById,
    updateEmailCampaign,
    resolveSegment,
    renderTemplate,
    sendCampaignEmail,
} from '@/lib/supabase/email-campaigns';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@nossoscrm.com.br';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'NossoCRM';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://localhost:3000';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: campaignId } = await params;

        if (!RESEND_API_KEY) {
            return NextResponse.json(
                { error: 'RESEND_API_KEY não configurada. Acesse Configurações → Integrações para configurar.' },
                { status: 503 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        if (profile.role !== 'admin') {
            return NextResponse.json({ error: 'Somente admins podem disparar campanhas.' }, { status: 403 });
        }

        // Busca campanha e valida estado
        const campaign = await getEmailCampaignById(supabase, campaignId);
        if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        if (campaign.organization_id !== profile.organization_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!campaign.template) {
            return NextResponse.json({ error: 'Campanha sem template. Associe um template antes de enviar.' }, { status: 400 });
        }
        if (['sending', 'sent'].includes(campaign.status)) {
            return NextResponse.json({ error: `Campanha já está em status "${campaign.status}".` }, { status: 409 });
        }

        // Resolve segmento de contatos
        const contacts = await resolveSegment(supabase, profile.organization_id, campaign.segment_filters);
        if (contacts.length === 0) {
            return NextResponse.json({ error: 'Nenhum contato encontrado para o segmento configurado.' }, { status: 400 });
        }

        // Marca campanha como "sending"
        await updateEmailCampaign(supabase, campaignId, {
            status: 'sending',
            estimated_recipients: contacts.length,
        });

        // Disparo individual por contato
        let sent = 0;
        let failed = 0;

        for (const contact of contacts) {
            const unsubscribeUrl = `${BASE_URL}/unsubscribe/${btoa(`${profile.organization_id}:${contact.email}`)}`;
            const rendered = renderTemplate(campaign.template!, contact, unsubscribeUrl);

            try {
                const result = await sendCampaignEmail({
                    to: contact.email,
                    subject: rendered.subject,
                    html: rendered.html,
                    text: rendered.text,
                    fromEmail: EMAIL_FROM,
                    fromName: EMAIL_FROM_NAME,
                    resendApiKey: RESEND_API_KEY,
                });

                await supabase.from('email_campaign_sends').insert({
                    campaign_id: campaignId,
                    contact_id: contact.id,
                    email: contact.email,
                    resend_message_id: result?.id ?? null,
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                });

                sent++;
            } catch (err: any) {
                await supabase.from('email_campaign_sends').insert({
                    campaign_id: campaignId,
                    contact_id: contact.id,
                    email: contact.email,
                    status: 'failed',
                    error_message: err.message,
                });
                failed++;
                console.error(`[campaigns/send] Failed to send to ${contact.email}:`, err.message);
            }

            // Rate limiting gentil: 50ms entre envios
            await new Promise(r => setTimeout(r, 50));
        }

        // Atualiza métricas e status final
        await updateEmailCampaign(supabase, campaignId, {
            status: 'sent',
            total_sent: sent,
        } as any);

        // Atualiza sent_at diretamente (campo extra não no tipo genérico de update)
        await supabase
            .from('email_campaigns')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', campaignId);

        return NextResponse.json({ sent, failed, total: contacts.length });
    } catch (error: any) {
        console.error('[campaigns/send/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
