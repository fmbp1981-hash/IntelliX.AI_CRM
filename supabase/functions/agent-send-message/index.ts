// supabase/functions/agent-send-message/index.ts
// Sends messages to leads via WhatsApp (Cloud API or Evolution API)
// Called internally by agent-engine — requires JWT (service role)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface SendMessageRequest {
    organization_id: string;
    to: string;
    message: string;
    provider: 'whatsapp_cloud_api' | 'evolution_api';
    config: Record<string, any>;
}

interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ============================================
// Cloud API sender
// ============================================

async function sendViaCloudApi(
    to: string,
    message: string,
    config: { phone_number_id: string; access_token: string }
): Promise<SendResult> {
    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'text',
                    text: { preview_url: false, body: message },
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data?.error?.message ?? `HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            messageId: data?.messages?.[0]?.id,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

// ============================================
// Evolution API sender
// ============================================

async function sendViaEvolution(
    to: string,
    message: string,
    config: { instance_name: string; api_url: string; api_key: string }
): Promise<SendResult> {
    try {
        // Ensure number is in correct format for Evolution
        const number = to.replace(/\D/g, '');

        const response = await fetch(
            `${config.api_url}/message/sendText/${config.instance_name}`,
            {
                method: 'POST',
                headers: {
                    apikey: config.api_key,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    number,
                    text: message,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data?.message ?? `HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            messageId: data?.key?.id ?? data?.messageId,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

// ============================================
// Main handler
// ============================================

serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { to, message, provider, config }: SendMessageRequest =
            await req.json();

        if (!to || !message || !provider || !config) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: to, message, provider, config' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let result: SendResult;

        if (provider === 'whatsapp_cloud_api') {
            result = await sendViaCloudApi(to, message, config as any);
        } else if (provider === 'evolution_api') {
            result = await sendViaEvolution(to, message, config as any);
        } else {
            return new Response(
                JSON.stringify({ error: `Unknown provider: ${provider}` }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const status = result.success ? 200 : 502;
        return new Response(JSON.stringify(result), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Send message error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Internal error',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});
