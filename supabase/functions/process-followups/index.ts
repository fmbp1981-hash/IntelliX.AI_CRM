import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // --- 1. Advance executions & send scheduled messages ---

        // Find due active executions
        const { data: dueExecutions, error: fetchErr } = await supabase
            .from('followup_executions')
            .select('*, sequence:followup_sequences(*)')
            .eq('status', 'active')
            .lte('next_scheduled_at', new Date().toISOString())
            .order('next_scheduled_at')
            .limit(100);

        if (fetchErr) throw fetchErr;

        if (!dueExecutions || dueExecutions.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhuma execução de follow-up pendente." }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            });
        }

        let processed = 0;
        let errors = 0;

        for (const execution of dueExecutions) {
            try {
                const sequence = execution.sequence;

                // Simple business hours check (adjust timezone according to your needs)
                if (sequence.respect_business_hours) {
                    const now = new Date();
                    const hour = now.getUTCHours() - 3; // roughly BRT
                    const day = now.getUTCDay(); // 0 is Sunday
                    if (!(day >= 1 && day <= 5 && hour >= 8 && hour < 18)) {
                        continue; // skip
                    }
                }

                // Check daily limit mapping
                if (execution.messages_sent >= sequence.max_messages_per_day) {
                    continue;
                }

                // Check interval
                if (execution.last_sent_at) {
                    const hoursSinceLastSent = (Date.now() - new Date(execution.last_sent_at).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceLastSent < sequence.min_hours_between_messages) {
                        continue;
                    }
                }

                const steps = sequence.steps;
                const nextStepIndex = execution.current_step + 1;

                if (nextStepIndex >= steps.length) {
                    // Sequence completed - close it
                    await supabase
                        .from('followup_executions')
                        .update({
                            status: 'completed',
                            current_step: nextStepIndex,
                            result: 'max_attempts',
                            result_at: new Date().toISOString(),
                            next_scheduled_at: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', execution.id);
                    processed++;
                    continue;
                }

                // --- Execute step: Send Message! ---
                const step = steps[nextStepIndex];

                // Get the conversation to send the message to
                if (execution.conversation_id) {
                    const { data: conv } = await supabase
                        .from('conversations')
                        .select('*')
                        .eq('id', execution.conversation_id)
                        .single();

                    if (conv) {
                        // Internal call to evolution/whatsapp send mechanism
                        // Assuming you have an API route or edge function `agent-send-message` you can invoke
                        // For this environment, we'll invoke the agent-send-message function securely

                        let messageContent = step.message_prompt; // basic implementation

                        const { error: invokeErr } = await supabase.functions.invoke('agent-send-message', {
                            body: {
                                instanceId: 'default-instance', // Adjust based on your setup
                                contactId: conv.contact_id,
                                organizationId: execution.organization_id,
                                message: messageContent,
                                messageId: `followup_${execution.id}_${nextStepIndex}`
                            }
                        });

                        // We will advance the step even if trigger fails (though ideally we should handle properly) 
                        if (invokeErr) {
                            console.error(`Error invoking agent-send-message for execution ${execution.id}:`, invokeErr);
                            // We don't advance step on failure so it can retry later
                            errors++;
                            continue;
                        }
                    }
                }

                // Advance the execution
                const nextScheduledAt = new Date(Date.now() + step.delay_minutes * 60 * 1000).toISOString();
                await supabase
                    .from('followup_executions')
                    .update({
                        current_step: nextStepIndex,
                        messages_sent: execution.messages_sent + 1,
                        last_sent_at: new Date().toISOString(),
                        next_scheduled_at: nextScheduledAt,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', execution.id);

                // Log Activity
                await supabase.from('activities').insert({
                    title: `Follow-up enviado (${sequence.name})`,
                    description: `Step ${nextStepIndex} da sequência enviado com sucesso.`,
                    type: 'whatsapp',
                    date: new Date().toISOString(),
                    organization_id: execution.organization_id,
                    contact_id: execution.contact_id,
                    deal_id: execution.deal_id
                });

                processed++;
            } catch (err) {
                console.error(`[followups] Error processing execution ${execution.id}:`, err);
                errors++;
            }
        }

        return new Response(JSON.stringify({ processed, errors, message: "Execuções de follow-up processadas." }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
