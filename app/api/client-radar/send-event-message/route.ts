/**
 * POST /api/client-radar/send-event-message
 *
 * Dispara uma mensagem de evento para um contato via NossoAgent/WhatsApp.
 *
 * Body: {
 *   contactId: string;
 *   eventType: EventType;
 *   messageOverride?: string;   // usa DEFAULT_MESSAGE_TEMPLATES se não fornecido
 *   channel?: 'whatsapp' | 'email';
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    interpolateTemplate,
    DEFAULT_MESSAGE_TEMPLATES,
    logEventSend,
    hasEventBeenSent,
    type EventType,
} from '@/lib/supabase/client-radar';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();
        if (!profile?.organization_id) return NextResponse.json({ error: 'No org' }, { status: 404 });

        const orgId = profile.organization_id;

        const body = await req.json();
        const {
            contactId,
            eventType,
            messageOverride,
            channel = 'whatsapp',
        }: {
            contactId: string;
            eventType: EventType;
            messageOverride?: string;
            channel?: 'whatsapp' | 'email';
        } = body;

        if (!contactId || !eventType) {
            return NextResponse.json({ error: 'contactId e eventType são obrigatórios' }, { status: 400 });
        }

        // Buscar dados do contato
        const { data: contact } = await supabase
            .from('contacts')
            .select('id, name, phone, email, organization_id')
            .eq('id', contactId)
            .eq('organization_id', orgId)
            .single();

        if (!contact) return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
        if (!contact.phone && channel === 'whatsapp') {
            return NextResponse.json({ error: 'Contato sem telefone para WhatsApp' }, { status: 422 });
        }

        // Buscar nome da organização
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .single();

        // Verificar se já enviou hoje
        const today = new Date().toISOString().split('T')[0];
        const alreadySent = await hasEventBeenSent(supabase, contactId, eventType, today);
        if (alreadySent) {
            return NextResponse.json({
                error: 'Mensagem já enviada para este contato hoje',
                already_sent: true,
            }, { status: 409 });
        }

        // Montar mensagem final
        const template = messageOverride ?? DEFAULT_MESSAGE_TEMPLATES[eventType] ?? '';
        const message = interpolateTemplate(
            template,
            { name: contact.name },
            { name: org?.name ?? 'Nossa Equipe' }
        );

        if (!message.trim()) {
            return NextResponse.json({ error: 'Template de mensagem vazio' }, { status: 400 });
        }

        // Buscar configuração do agente para encontrar a instância WhatsApp
        const { data: agentConfig } = await supabase
            .from('agent_configs')
            .select('whatsapp_config, is_active')
            .eq('organization_id', orgId)
            .single();

        let sendResult: { success: boolean; error?: string } = { success: false };

        if (channel === 'whatsapp' && agentConfig?.is_active && agentConfig.whatsapp_config) {
            // Enviar via Evolution API (agent-send-message Edge Function)
            const config = agentConfig.whatsapp_config as Record<string, string>;
            const evolutionUrl = config.api_url;
            const evolutionKey = config.api_key;
            const instanceName = config.instance_name;

            if (evolutionUrl && evolutionKey && instanceName) {
                const phone = contact.phone?.replace(/\D/g, '');
                const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': evolutionKey,
                    },
                    body: JSON.stringify({
                        number: phone,
                        text: message,
                        delay: 1200,
                    }),
                });
                sendResult = { success: res.ok, error: res.ok ? undefined : await res.text() };
            }
        }

        // Registrar o envio no log
        await logEventSend(
            supabase,
            orgId,
            contactId,
            eventType,
            today,
            channel,
            message,
            sendResult.success ? 'sent' : 'failed',
            sendResult.error
        );

        return NextResponse.json({
            success: sendResult.success,
            message_sent: message,
            contact_name: contact.name,
            channel,
        });

    } catch (err) {
        console.error('[send-event-message] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
