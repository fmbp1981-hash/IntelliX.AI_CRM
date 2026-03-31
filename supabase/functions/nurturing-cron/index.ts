import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
    // This function should be called by pg_cron or Supabase Scheduler
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Fetch conversations that are 'active' but stagnant for > 3 days, and haven't had 3 followups yet
        // A standard approach is checking 'last_message_at' or 'last_ai_response_at'
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

        const { data: stagnantConversations, error } = await supabase
            .from('conversations')
            .select(`
                id, 
                organization_id, 
                whatsapp_number, 
                summary, 
                followup_count,
                contacts(name)
            `)
            .eq('status', 'active')
            .lt('last_message_at', threeDaysAgo)
            // If followup_count is null, treat as 0
            .or('followup_count.is.null,followup_count.lt.3')
            .limit(50); // Batch process

        if (error) {
            console.error('Error fetching stagnant conversations:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        if (!stagnantConversations || stagnantConversations.length === 0) {
            return new Response(JSON.stringify({ message: 'No stagnant conversations found' }), { headers: { 'Content-Type': 'application/json' } });
        }

        const { generateText } = await import('https://esm.sh/ai@4');
        const { createAnthropic } = await import('https://esm.sh/@ai-sdk/anthropic@1');
        const anthropic = createAnthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

        let processed = 0;

        for (const conv of stagnantConversations) {
            // Get agent config for this org
            const { data: agentConfig } = await supabase
                .from('agent_configs')
                .select('*')
                .eq('organization_id', conv.organization_id)
                .single();

            if (!agentConfig || !agentConfig.is_active || !agentConfig.whatsapp_provider) continue;

            const daysSince = 3 + ((conv.followup_count || 0) * 2); // 3 days, then 5, then 7 roughly

            const prompt = `Você é ${agentConfig.agent_name || 'um assistente'} de CRM. 
O cliente **${conv.contacts?.name || 'Lead'}** está sem responder há alguns dias.
Resumo da conversa até agora: ${conv.summary || 'Nenhum resumo.'}

Escreva UMA única mensagem curta, amigável e direta de follow-up (reengajamento). 
Apenas a mensagem, sem aspas, sem introduções. Máximo de 2 frases. Seja muito natural, como uma pessoa real no WhatsApp. Tente retomar o assunto.`;

            try {
                const result = await generateText({
                    model: anthropic(agentConfig.ai_model || 'claude-3-haiku-20240307'),
                    prompt,
                    temperature: 0.7,
                    maxTokens: 100,
                });

                const followupMessage = result.text.trim();

                // Send WhatsApp Message
                await fetch(`${SUPABASE_URL}/functions/v1/agent-send-message`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: conv.whatsapp_number,
                        message: followupMessage,
                        provider: agentConfig.whatsapp_provider,
                        config: agentConfig.whatsapp_config,
                    }),
                });

                // Log as AI message
                await supabase.from('messages').insert({
                    conversation_id: conv.id,
                    organization_id: conv.organization_id,
                    role: 'ai',
                    content: followupMessage,
                    ai_model: agentConfig.ai_model,
                    ai_tools_used: ['nurturing_cron']
                });

                // Update conversation
                const nextFollowupCount = (conv.followup_count || 0) + 1;
                await supabase.from('conversations').update({
                    followup_count: nextFollowupCount,
                    last_followup_at: new Date().toISOString(),
                    last_message_at: new Date().toISOString(),
                    // if it's the 3rd followup, maybe close or mark as inactive
                    status: nextFollowupCount >= 3 ? 'archived' : 'active'
                }).eq('id', conv.id);

                processed++;

            } catch (err) {
                console.error(`Failed to process followup for conv ${conv.id}:`, err);
            }
        }

        return new Response(JSON.stringify({ message: `Successfully processed ${processed} followups` }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
    }
});
