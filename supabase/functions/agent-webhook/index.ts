// supabase/functions/agent-webhook/index.ts
// Receives WhatsApp webhooks from both Cloud API and Evolution API
// JWT disabled — external providers send without auth. Validated by verify_token.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface NormalizedMessage {
    from: string;
    pushName: string | null;
    message: string;
    type: string;
    mediaUrl: string | null;
    messageId: string;
    timestamp: string;
}

// ============================================
// Normalize webhook payloads from different providers
// ============================================

function normalizeCloudApiPayload(body: any): NormalizedMessage | null {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null;

    // Skip status updates (delivery receipts)
    if (!msg.type || msg.type === 'reaction') return null;

    const mediaId =
        msg.image?.id ?? msg.audio?.id ?? msg.video?.id ?? msg.document?.id ?? null;

    return {
        from: msg.from,
        pushName: value?.contacts?.[0]?.profile?.name ?? null,
        message: msg.text?.body ?? msg.caption ?? '[mídia]',
        type: msg.type,
        mediaUrl: mediaId,
        messageId: msg.id,
        timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
    };
}

function normalizeEvolutionPayload(body: any): NormalizedMessage | null {
    const data = body?.data;
    if (!data?.message) return null;

    // Skip group messages and status broadcasts
    const remoteJid = data.key?.remoteJid ?? '';
    if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
        return null;
    }

    const messageContent =
        data.message?.conversation ??
        data.message?.extendedTextMessage?.text ??
        data.message?.imageMessage?.caption ??
        data.message?.videoMessage?.caption ??
        data.message?.documentMessage?.caption ??
        '[mídia]';

    const mediaUrl =
        data.message?.imageMessage?.url ??
        data.message?.audioMessage?.url ??
        data.message?.videoMessage?.url ??
        data.message?.documentMessage?.url ??
        null;

    const msgType = data.messageType ?? 'text';

    return {
        from: remoteJid.replace('@s.whatsapp.net', ''),
        pushName: data.pushName ?? null,
        message: messageContent,
        type: msgType,
        mediaUrl,
        messageId: data.key?.id ?? crypto.randomUUID(),
        timestamp: data.messageTimestamp
            ? new Date(data.messageTimestamp * 1000).toISOString()
            : new Date().toISOString(),
    };
}

// ============================================
// Main handler
// ============================================

serve(async (req: Request) => {
    try {
        const url = new URL(req.url);
        const orgId = url.searchParams.get('org');
        const provider = url.searchParams.get('provider');

        if (!orgId || !provider) {
            return new Response(
                JSON.stringify({ error: 'Missing org or provider query params' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // ── GET: Webhook verification (Cloud API only) ──
        if (req.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            if (mode !== 'subscribe' || !token || !challenge) {
                return new Response('Bad Request', { status: 400 });
            }

            const { data: config } = await supabase
                .from('agent_configs')
                .select('whatsapp_config')
                .eq('organization_id', orgId)
                .single();

            const storedToken =
                (config?.whatsapp_config as any)?.webhook_verify_token;

            if (token === storedToken) {
                return new Response(challenge, { status: 200 });
            }

            return new Response('Forbidden', { status: 403 });
        }

        // ── POST: Incoming message ──
        if (req.method === 'POST') {
            const body = await req.json();

            // Normalize based on provider
            let normalized: NormalizedMessage | null = null;

            if (provider === 'cloud_api') {
                normalized = normalizeCloudApiPayload(body);
            } else if (provider === 'evolution') {
                normalized = normalizeEvolutionPayload(body);
            }

            // If no message extracted (status update, group msg, etc.), acknowledge
            if (!normalized) {
                return new Response('OK', { status: 200 });
            }

            // Check that agent is active for this org
            const { data: agentConfig } = await supabase
                .from('agent_configs')
                .select('is_active')
                .eq('organization_id', orgId)
                .single();

            if (!agentConfig?.is_active) {
                return new Response('Agent not active', { status: 200 });
            }

            // Forward to agent-engine (async, don't block webhook response)
            const enginePayload = {
                organization_id: orgId,
                whatsapp_number: normalized.from,
                whatsapp_name: normalized.pushName,
                message_content: normalized.message,
                content_type: normalized.type,
                media_url: normalized.mediaUrl,
                whatsapp_message_id: normalized.messageId,
                whatsapp_timestamp: normalized.timestamp,
            };

            // Fire-and-forget to agent-engine
            fetch(`${SUPABASE_URL}/functions/v1/agent-engine`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(enginePayload),
            }).catch((err) => {
                console.error('Failed to call agent-engine:', err);
            });

            // Respond immediately to WhatsApp (they require fast 200 OK)
            return new Response('OK', { status: 200 });
        }

        return new Response('Method Not Allowed', { status: 405 });
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
});
