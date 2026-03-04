// lib/ai/agent-tools.ts
// NossoAgent tool definitions for CRM operations
// Each tool operates on the shared database with service role (no RLS for edge functions)
// Follows Vercel AI SDK tool() pattern with Zod schemas

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

// ============================================
// Tool context passed to each execute function
// ============================================
import {
    checkAvailability as gcCheckAvailability,
    scheduleAppointment as gcScheduleAppointment,
    cancelAppointment as gcCancelAppointment
} from '@/lib/integrations/google-calendar';

export interface ToolContext {
    supabase: SupabaseClient;
    organizationId: string;
    conversationId: string;
    agentConfig: {
        default_board_id: string | null;
        default_stage_id: string | null;
    };
}

// ============================================
// Tool response helper
// ============================================

async function logToolExecution(
    ctx: ToolContext,
    toolName: string,
    input: Record<string, unknown>,
    output: Record<string, unknown> | null,
    success: boolean,
    errorMessage?: string
): Promise<void> {
    await ctx.supabase.from('agent_tools_log').insert({
        organization_id: ctx.organizationId,
        conversation_id: ctx.conversationId,
        tool_name: toolName,
        tool_input: input,
        tool_output: output,
        success,
        error_message: errorMessage,
    });
}

// ============================================
// Tool definitions
// ============================================

export function buildAgentTools(ctx: ToolContext) {
    return {
        // ── CONTACTS ──────────────────────────────────

        create_contact: {
            description:
                'Cria um novo contato no CRM. Use quando tiver pelo menos o nome do lead.',
            parameters: z.object({
                name: z.string().describe('Nome completo do contato'),
                email: z.string().email().optional().describe('Email'),
                phone: z.string().optional().describe('Telefone no formato E.164'),
                company_name: z.string().optional().describe('Nome da empresa'),
                source: z.string().optional().default('whatsapp').describe('Origem do contato'),
                notes: z.string().optional().describe('Notas/observações'),
            }),
            execute: async (params: {
                name: string;
                email?: string;
                phone?: string;
                company_name?: string;
                source?: string;
                notes?: string;
            }) => {
                try {
                    const { data, error } = await ctx.supabase
                        .from('contacts')
                        .insert({
                            name: params.name,
                            email: params.email,
                            phone: params.phone,
                            company_name: params.company_name,
                            source: params.source ?? 'whatsapp',
                            notes: params.notes,
                            stage: 'LEAD',
                            organization_id: ctx.organizationId,
                        })
                        .select('id, name')
                        .single();

                    if (error) throw error;

                    // Link contact to conversation
                    await ctx.supabase
                        .from('conversations')
                        .update({ contact_id: data.id })
                        .eq('id', ctx.conversationId);

                    await logToolExecution(ctx, 'create_contact', params, data, true);

                    return { success: true, contact_id: data.id, name: data.name };
                } catch (err: any) {
                    await logToolExecution(ctx, 'create_contact', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        search_contacts: {
            description:
                'Busca contatos existentes por nome, email ou telefone. Use ANTES de criar um novo contato.',
            parameters: z.object({
                query: z.string().describe('Nome, email ou telefone para buscar'),
            }),
            execute: async (params: { query: string }) => {
                const { data } = await ctx.supabase
                    .from('contacts')
                    .select('id, name, email, phone, company_name')
                    .eq('organization_id', ctx.organizationId)
                    .or(
                        `name.ilike.%${params.query}%,email.ilike.%${params.query}%,phone.ilike.%${params.query}%`
                    )
                    .limit(5);

                await logToolExecution(ctx, 'search_contacts', params, { count: data?.length ?? 0 }, true);

                return { contacts: data ?? [], count: data?.length ?? 0 };
            },
        },

        update_contact: {
            description: 'Atualiza dados de um contato existente.',
            parameters: z.object({
                contact_id: z.string().uuid().describe('ID do contato'),
                name: z.string().optional(),
                email: z.string().email().optional(),
                phone: z.string().optional(),
                company_name: z.string().optional(),
                notes: z.string().optional(),
            }),
            execute: async (params: {
                contact_id: string;
                name?: string;
                email?: string;
                phone?: string;
                company_name?: string;
                notes?: string;
            }) => {
                const { contact_id, ...updates } = params;
                const cleanUpdates = Object.fromEntries(
                    Object.entries(updates).filter(([, v]) => v !== undefined)
                );

                try {
                    const { data, error } = await ctx.supabase
                        .from('contacts')
                        .update(cleanUpdates)
                        .eq('id', contact_id)
                        .eq('organization_id', ctx.organizationId)
                        .select('id, name')
                        .single();

                    if (error) throw error;
                    await logToolExecution(ctx, 'update_contact', params, data, true);
                    return { success: true, contact: data };
                } catch (err: any) {
                    await logToolExecution(ctx, 'update_contact', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },
        // ── KNOWLEDGE BASE (RAG) ─────────────────────────

        search_knowledge: {
            description:
                'Busca informações na base de conhecimento da empresa. Use quando o lead perguntar sobre serviços, preços, equipe, horários, convênios, procedimentos, imóveis ou qualquer informação interna do negócio.',
            parameters: z.object({
                query: z.string().describe('A pergunta ou o termo exato a ser pesquisado'),
                category: z.string().optional().describe('Opcional. Ex: servicos, precos, equipe, faq, convenios'),
            }),
            execute: async (params: { query: string; category?: string }) => {
                try {
                    // 1. Generate embedding for query
                    const { embedding } = await embed({
                        model: openai.embedding('text-embedding-3-small'),
                        value: params.query,
                    });

                    // 2. Search vector DB
                    const { data, error } = await ctx.supabase.rpc('match_knowledge', {
                        query_embedding: `[${embedding.join(',')}]`,
                        match_org_id: ctx.organizationId,
                        match_threshold: 0.65,
                        match_count: 5,
                    });

                    if (error) throw error;

                    // Filter by category if provided
                    let results = data || [];
                    if (params.category) {
                        results = results.filter((r: any) => r.category === params.category);
                    }

                    await logToolExecution(ctx, 'search_knowledge', params, { chunksFound: results.length }, true);

                    return {
                        results: results.map((r: any) => `[${r.category}] ${r.document_title}: ${r.content}`),
                        message: results.length
                            ? `Encontrei ${results.length} trechos relevantes na base de conhecimento.`
                            : 'Nenhuma informação específica encontrada na base de conhecimento para essa pergunta.'
                    };
                } catch (err: any) {
                    await logToolExecution(ctx, 'search_knowledge', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        // ── DEALS ─────────────────────────────────────

        create_deal: {
            description:
                'Cria uma nova oportunidade/negociação no pipeline. Use quando o lead demonstrar interesse claro.',
            parameters: z.object({
                title: z.string().describe('Título do deal (ex: "Implante - João Silva")'),
                value: z.number().optional().describe('Valor estimado em R$'),
                contact_id: z.string().uuid().describe('ID do contato vinculado'),
                board_id: z.string().uuid().optional().describe('Pipeline (usa padrão se omitido)'),
                stage_id: z.string().uuid().optional().describe('Stage inicial (usa padrão se omitido)'),
            }),
            execute: async (params: {
                title: string;
                value?: number;
                contact_id: string;
                board_id?: string;
                stage_id?: string;
            }) => {
                try {
                    const boardId = params.board_id ?? ctx.agentConfig.default_board_id;
                    const stageId = params.stage_id ?? ctx.agentConfig.default_stage_id;

                    if (!boardId) {
                        return { success: false, error: 'Nenhum pipeline configurado' };
                    }

                    // If no stage, get the first stage of the board
                    let finalStageId = stageId;
                    if (!finalStageId) {
                        const { data: firstStage } = await ctx.supabase
                            .from('board_stages')
                            .select('id')
                            .eq('board_id', boardId)
                            .order('order', { ascending: true })
                            .limit(1)
                            .single();

                        finalStageId = firstStage?.id;
                    }

                    const { data, error } = await ctx.supabase
                        .from('deals')
                        .insert({
                            title: params.title,
                            value: params.value ?? 0,
                            contact_id: params.contact_id,
                            board_id: boardId,
                            stage_id: finalStageId,
                            organization_id: ctx.organizationId,
                        })
                        .select('id, title')
                        .single();

                    if (error) throw error;

                    // Link deal to conversation
                    await ctx.supabase
                        .from('conversations')
                        .update({ deal_id: data.id })
                        .eq('id', ctx.conversationId);

                    await logToolExecution(ctx, 'create_deal', params, data, true);
                    return { success: true, deal_id: data.id, title: data.title };
                } catch (err: any) {
                    await logToolExecution(ctx, 'create_deal', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        move_deal: {
            description:
                'Move um deal para outro stage do pipeline. Use conforme a conversa evolui.',
            parameters: z.object({
                deal_id: z.string().uuid().describe('ID do deal'),
                stage_id: z.string().uuid().describe('ID do novo stage'),
                reason: z.string().optional().describe('Motivo da movimentação'),
            }),
            execute: async (params: { deal_id: string; stage_id: string; reason?: string }) => {
                try {
                    const { data, error } = await ctx.supabase
                        .from('deals')
                        .update({
                            stage_id: params.stage_id,
                            last_stage_change_date: new Date().toISOString(),
                        })
                        .eq('id', params.deal_id)
                        .eq('organization_id', ctx.organizationId)
                        .select('id, title, stage_id')
                        .single();

                    if (error) throw error;

                    // Log activity for the move
                    await ctx.supabase.from('activities').insert({
                        title: `Deal movido: ${params.reason ?? 'via NossoAgent'}`,
                        description: `Movido para stage ${params.stage_id}`,
                        type: 'note',
                        date: new Date().toISOString(),
                        deal_id: params.deal_id,
                        organization_id: ctx.organizationId,
                    });

                    await logToolExecution(ctx, 'move_deal', params, data, true);
                    return { success: true, deal: data };
                } catch (err: any) {
                    await logToolExecution(ctx, 'move_deal', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        search_deals: {
            description: 'Busca deals existentes vinculados a um contato ou por título.',
            parameters: z.object({
                contact_id: z.string().uuid().optional().describe('ID do contato'),
                query: z.string().optional().describe('Busca por título'),
            }),
            execute: async (params: { contact_id?: string; query?: string }) => {
                let q = ctx.supabase
                    .from('deals')
                    .select('id, title, value, stage_id, status, is_won, is_lost')
                    .eq('organization_id', ctx.organizationId)
                    .is('deleted_at', null)
                    .limit(5);

                if (params.contact_id) q = q.eq('contact_id', params.contact_id);
                if (params.query) q = q.ilike('title', `%${params.query}%`);

                const { data } = await q;
                await logToolExecution(ctx, 'search_deals', params, { count: data?.length ?? 0 }, true);
                return { deals: data ?? [], count: data?.length ?? 0 };
            },
        },

        // ── ACTIVITIES ────────────────────────────────

        create_activity: {
            description:
                'Registra uma atividade no CRM — follow-up, nota, reunião, etc.',
            parameters: z.object({
                title: z.string().describe('Título da atividade'),
                description: z.string().optional(),
                type: z
                    .enum(['call', 'meeting', 'task', 'note', 'whatsapp'])
                    .describe('Tipo da atividade'),
                contact_id: z.string().uuid().optional(),
                deal_id: z.string().uuid().optional(),
                date: z
                    .string()
                    .optional()
                    .describe('Data/hora (ISO 8601). Se omitido, usa agora.'),
            }),
            execute: async (params: {
                title: string;
                description?: string;
                type: string;
                contact_id?: string;
                deal_id?: string;
                date?: string;
            }) => {
                try {
                    const { data, error } = await ctx.supabase
                        .from('activities')
                        .insert({
                            title: params.title,
                            description: params.description,
                            type: params.type,
                            date: params.date ?? new Date().toISOString(),
                            contact_id: params.contact_id,
                            deal_id: params.deal_id,
                            organization_id: ctx.organizationId,
                        })
                        .select('id, title')
                        .single();

                    if (error) throw error;
                    await logToolExecution(ctx, 'create_activity', params, data, true);
                    return { success: true, activity_id: data.id };
                } catch (err: any) {
                    await logToolExecution(ctx, 'create_activity', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        // ── QUALIFICATION ────────────────────────────

        qualify_lead: {
            description:
                'Marca o lead como qualificado ou não qualificado com score e dados coletados.',
            parameters: z.object({
                qualified: z.boolean().describe('true = qualificado, false = não qualificado'),
                score: z.number().min(0).max(100).describe('Score 0-100'),
                reason: z.string().describe('Justificativa'),
                collected_data: z.record(z.string(), z.any()).describe('Dados coletados na qualificação'),
            }),
            execute: async (params: {
                qualified: boolean;
                score: number;
                reason: string;
                collected_data: Record<string, unknown>;
            }) => {
                try {
                    const { error } = await ctx.supabase
                        .from('conversations')
                        .update({
                            qualification_status: params.qualified ? 'qualified' : 'unqualified',
                            qualification_score: params.score,
                            qualification_data: params.collected_data,
                        })
                        .eq('id', ctx.conversationId);

                    if (error) throw error;

                    // Create action item for human follow-up
                    await ctx.supabase.from('inbox_action_items').insert({
                        organization_id: ctx.organizationId,
                        type: params.qualified ? 'follow_up' : 'review',
                        priority: params.qualified ? 'high' : 'low',
                        title: `Lead ${params.qualified ? 'qualificado' : 'desqualificado'}`,
                        description: `Motivo: ${params.reason}`,
                        status: 'pending',
                        metadata: params.collected_data
                    });

                    await logToolExecution(ctx, 'qualify_lead', params, { qualified: params.qualified }, true);
                    return { success: true, qualified: params.qualified, score: params.score };
                } catch (err: any) {
                    await logToolExecution(ctx, 'qualify_lead', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        // ── TRANSFER ──────────────────────────────────

        transfer_to_human: {
            description:
                'Transfere a conversa para um atendente humano. Use quando não resolver ou quando pedido.',
            parameters: z.object({
                reason: z.string().describe('Motivo da transferência'),
                summary: z.string().describe('Resumo completo para o humano'),
                transfer_to: z
                    .string()
                    .uuid()
                    .optional()
                    .describe('ID do usuário específico (opcional)'),
                priority: z
                    .enum(['low', 'medium', 'high', 'critical'])
                    .default('medium'),
            }),
            execute: async (params: {
                reason: string;
                summary: string;
                transfer_to?: string;
                priority: string;
            }) => {
                try {
                    await ctx.supabase
                        .from('conversations')
                        .update({
                            status: 'waiting_human',
                            assigned_agent: params.transfer_to ?? 'unassigned',
                            transferred_at: new Date().toISOString(),
                            summary: params.summary,
                        })
                        .eq('id', ctx.conversationId);

                    // System message
                    await ctx.supabase.from('messages').insert({
                        conversation_id: ctx.conversationId,
                        organization_id: ctx.organizationId,
                        role: 'system',
                        content: `🔄 Conversa transferida. Motivo: ${params.reason}`,
                        content_type: 'text',
                        is_internal_note: true,
                    });

                    // Action item for inbox
                    await ctx.supabase.from('inbox_action_items').insert({
                        organization_id: ctx.organizationId,
                        type: 'transfer',
                        priority: 'critical', // As per PRD, transfer is always critical
                        title: `Transferência Solicitada`,
                        description: `Motivo: ${params.reason}\n\nResumo: ${params.summary}`,
                        status: 'pending',
                        assigned_to: params.transfer_to ?? null,
                    });

                    await logToolExecution(ctx, 'transfer_to_human', params, { transferred: true }, true);
                    return { success: true, status: 'waiting_human' };
                } catch (err: any) {
                    await logToolExecution(ctx, 'transfer_to_human', params, null, false, err.message);
                    return { success: false, error: err.message };
                }
            },
        },

        // ── VERTICAL: REAL ESTATE ────────────────────

        property_match: {
            description:
                '[IMOBILIÁRIA] Busca imóveis compatíveis com preferências do cliente.',
            parameters: z.object({
                property_type: z.string().optional().describe('Tipo: casa, apartamento, terreno'),
                transaction_type: z
                    .enum(['venda', 'locacao'])
                    .optional()
                    .describe('Venda ou locação'),
                min_value: z.number().optional(),
                max_value: z.number().optional(),
                bedrooms: z.number().optional(),
                region: z.string().optional().describe('Bairro ou região'),
            }),
            execute: async (params: {
                property_type?: string;
                transaction_type?: string;
                min_value?: number;
                max_value?: number;
                bedrooms?: number;
                region?: string;
            }) => {
                let q = ctx.supabase
                    .from('vertical_properties')
                    .select('id, title, property_type, transaction_type, value, address, bedrooms, area_m2, features')
                    .eq('organization_id', ctx.organizationId)
                    .eq('status', 'available');

                if (params.property_type)
                    q = q.eq('property_type', params.property_type);
                if (params.transaction_type)
                    q = q.eq('transaction_type', params.transaction_type);
                if (params.min_value) q = q.gte('value', params.min_value);
                if (params.max_value) q = q.lte('value', params.max_value);
                if (params.bedrooms) q = q.gte('bedrooms', params.bedrooms);
                if (params.region) q = q.ilike('address', `%${params.region}%`);

                const { data } = await q.limit(5);

                await logToolExecution(ctx, 'property_match', params, { count: data?.length ?? 0 }, true);
                return {
                    properties: data ?? [],
                    count: data?.length ?? 0,
                    message:
                        data && data.length > 0
                            ? `Encontrei ${data.length} imóveis compatíveis.`
                            : 'Nenhum imóvel encontrado com esses critérios.',
                };
            },
        },

        // ── VERTICAL: CLINICS & REAL ESTATE (SCHEDULING) ──
        check_availability: {
            description: 'Verifica horários disponíveis na Agenda Principal usando o Google Calendar.',
            parameters: z.object({
                date: z.string().describe('Data desejada (YYYY-MM-DD)')
            }),
            execute: async (params: { date: string }) => {
                const timeMin = new Date(`${params.date}T00:00:00Z`).toISOString();
                const timeMax = new Date(`${params.date}T23:59:59Z`).toISOString();
                try {
                    const busySlots = await gcCheckAvailability(ctx.organizationId, timeMin, timeMax);
                    await logToolExecution(ctx, 'check_availability', params, { busySlots }, true);
                    return { requestedDate: params.date, busySlots, message: 'Horários ocupados retornados da agenda Google' };
                } catch (e: any) {
                    await logToolExecution(ctx, 'check_availability', params, null, false, e.message);
                    return { success: false, error: e.message };
                }
            }
        },
        schedule_appointment: {
            description: 'Agenda um compromisso na Agenda Principal do Google Calendar. Use após verificar a disponibilidade.',
            parameters: z.object({
                title: z.string().describe('Título ou Nome do Paciente/Cliente'),
                description: z.string().describe('Detalhes do agendamento'),
                start_time: z.string().describe('Data e hora de início no formato ISO (YYYY-MM-DDTHH:mm:ssZ)'),
                end_time: z.string().describe('Data e hora de término no formato ISO (YYYY-MM-DDTHH:mm:ssZ)'),
                professional_name: z.string().describe('Nome do Profissional (para salvar no Banco)')
            }),
            execute: async (params: { title: string, description: string, start_time: string, end_time: string, professional_name: string }) => {
                try {
                    const event = await gcScheduleAppointment(ctx.organizationId, params);
                    await ctx.supabase.from('appointments').insert({
                        organization_id: ctx.organizationId, professional_name: params.professional_name,
                        title: params.title, description: params.description,
                        start_time: params.start_time, end_time: params.end_time, google_event_id: event.id
                    });
                    await logToolExecution(ctx, 'schedule_appointment', params, { eventId: event.id }, true);
                    return { success: true, message: 'Agendamento confirmado no Google Calendar!', eventId: event.id };
                } catch (e: any) {
                    await logToolExecution(ctx, 'schedule_appointment', params, null, false, e.message);
                    return { success: false, error: e.message };
                }
            }
        },
        cancel_appointment: {
            description: 'Cancela um agendamento existente no Google Calendar e atualiza no banco de dados.',
            parameters: z.object({
                google_event_id: z.string().describe('O ID do evento no Google Calendar')
            }),
            execute: async (params: { google_event_id: string }) => {
                try {
                    await gcCancelAppointment(ctx.organizationId, params.google_event_id);
                    await ctx.supabase.from('appointments').update({ status: 'cancelled' }).eq('google_event_id', params.google_event_id);
                    await logToolExecution(ctx, 'cancel_appointment', params, { cancelled: true }, true);
                    return { success: true, message: 'Agendamento cancelado com sucesso.' };
                } catch (e: any) {
                    await logToolExecution(ctx, 'cancel_appointment', params, null, false, e.message);
                    return { success: false, error: e.message };
                }
            }
        },

        // ── CUSTOM FIELDS ────────────────────────────

        update_custom_field: {
            description: 'Atualiza um campo customizado da vertical em um contato ou deal.',
            parameters: z.object({
                entity_type: z.enum(['contact', 'deal']),
                entity_id: z.string().uuid(),
                field_key: z.string().describe('Chave do campo'),
                field_value: z.any().describe('Valor'),
            }),
            execute: async (params: {
                entity_type: string;
                entity_id: string;
                field_key: string;
                field_value: unknown;
            }) => {
                try {
                    const { error } = await ctx.supabase
                        .from('custom_field_values')
                        .upsert(
                            {
                                entity_type: params.entity_type,
                                entity_id: params.entity_id,
                                field_key: params.field_key,
                                field_value: params.field_value,
                                organization_id: ctx.organizationId,
                            },
                            { onConflict: 'entity_type,entity_id,field_key' }
                        );

                    if (error) throw error;
                    await logToolExecution(ctx, 'update_custom_field', params, { updated: true }, true);
                }),
                execute: async (params: {
                    entity_type: string;
                    entity_id: string;
                    field_key: string;
                    field_value: unknown;
                }) => {
                    try {
                        const { error } = await ctx.supabase
                            .from('custom_field_values')
                            .upsert(
                                {
                                    entity_type: params.entity_type,
                                    entity_id: params.entity_id,
                                    field_key: params.field_key,
                                    field_value: params.field_value,
                                    organization_id: ctx.organizationId,
                                },
                                { onConflict: 'entity_type,entity_id,field_key' }
                            );

                        if (error) throw error;
                        await logToolExecution(ctx, 'update_custom_field', params, { updated: true }, true);
                        return { success: true };
                    } catch (err: any) {
                        await logToolExecution(ctx, 'update_custom_field', params, null, false, err.message);
                        return { success: false, error: err.message };
                    }
                },
        },

            // ── FOLLOW-UPS & NURTURING ────────────────────

            schedule_followup: {
                description: 'Aciona uma régua/sequência de follow-up (mensagens automáticas) para um lead/contato. Use quando o lead não responder ou precisar de acompanhamento posterior.',
                parameters: z.object({
                    sequence_id: z.string().uuid().describe('ID da sequência de follow-up a ser iniciada'),
                    reason: z.string().optional().describe('Por que o lead está sendo colocado em follow-up'),
                }),
                execute: async (params: { sequence_id: string; reason?: string }) => {
                    try {
                        // Start follow-up execution
                        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/followups/executions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sequence_id: params.sequence_id,
                                conversation_id: ctx.conversationId,
                            }),
                        });

                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || 'Failed to start follow-up sequence');
                        }

                        const data = await res.json();

                        // Log activity
                        await ctx.supabase.from('activities').insert({
                            title: 'Follow-up Automático Iniciado',
                            description: `Sequência iniciada pelo NossoAgent. ${params.reason ? `Motivo: ${params.reason}` : ''}`,
                            type: 'task',
                            date: new Date().toISOString(),
                            organization_id: ctx.organizationId,
                        });

                        await logToolExecution(ctx, 'schedule_followup', params, data, true);
                        return { success: true, execution_id: data.id, message: 'Sequência de follow-up iniciada com sucesso.' };
                    } catch (err: any) {
                        await logToolExecution(ctx, 'schedule_followup', params, null, false, err.message);
                        return { success: false, error: err.message };
                    }
                }
            },

            cancel_followup: {
                description: 'Cancela acompanhamentos/follow-ups automáticos ativos deste lead. Use quando o lead responder de volta ou pedir para parar.',
                parameters: z.object({
                    reason: z.string().describe('Motivo do cancelamento (ex: lead respondeu, lead pediu para parar)')
                }),
                execute: async (params: { reason: string }) => {
                    try {
                        // Find active executions for this conversation
                        const { data: executions, error: fetchErr } = await ctx.supabase
                            .from('followup_executions')
                            .select('id')
                            .eq('conversation_id', ctx.conversationId)
                            .eq('status', 'active');

                        if (fetchErr) throw fetchErr;

                        if (!executions || executions.length === 0) {
                            return { success: true, message: 'Nenhum follow-up ativo encontrado para cancelar.' };
                        }

                        // Cancel them
                        const { error: cancelErr } = await ctx.supabase
                            .from('followup_executions')
                            .update({
                                status: 'cancelled',
                                result: params.reason,
                                result_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .in('id', executions.map(e => e.id));

                        if (cancelErr) throw cancelErr;

                        await logToolExecution(ctx, 'cancel_followup', params, { cancelledCount: executions.length }, true);
                        return { success: true, message: `${executions.length} sequências canceladas.` };
                    } catch (err: any) {
                        await logToolExecution(ctx, 'cancel_followup', params, null, false, err.message);
                        return { success: false, error: err.message };
                    }
                }
            },
        };
    }
