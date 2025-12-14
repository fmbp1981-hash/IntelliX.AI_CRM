import { tool } from 'ai';
import { z } from 'zod';
import { createStaticAdminClient } from '@/lib/supabase/server';
import type { CRMCallOptions } from '@/types/ai';

/**
 * Creates all CRM tools with context injection
 * Context is provided at runtime via the agent's callOptionsSchema
 * 
 * NOTE: Uses createStaticAdminClient (service role, no cookies) to bypass RLS
 * because async AI agent context doesn't have access to request cookies.
 */
export function createCRMTools(context: CRMCallOptions, userId: string) {
    // Initialize supabase admin client directly (no async, no cookies needed)
    const supabase = createStaticAdminClient();
    const organizationId = context.organizationId;

    return {
        // ============= ANÁLISE =============
        analyzePipeline: tool({
            description: 'Analisa o pipeline de vendas completo com métricas e breakdown por estágio',
            inputSchema: z.object({
                boardId: z.string().optional().describe('ID do board (usa contexto se não fornecido)'),
            }),
            execute: async ({ boardId }) => {
                // supabase is already initialized
                const targetBoardId = boardId || context.boardId;
                console.log('[AI] 🚀 analyzePipeline EXECUTED!', { targetBoardId });

                if (!targetBoardId) {
                    return { error: 'Nenhum board selecionado. Vá para um board ou especifique qual.' };
                }

                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, value, is_won, is_lost, stage:board_stages(name, label)')
                    .eq('organization_id', organizationId)
                    .eq('board_id', targetBoardId);

                const openDeals = deals?.filter(d => !d.is_won && !d.is_lost) || [];
                const wonDeals = deals?.filter(d => d.is_won) || [];
                const lostDeals = deals?.filter(d => d.is_lost) || [];

                const totalValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                const winRate = wonDeals.length + lostDeals.length > 0
                    ? Math.round(wonDeals.length / (wonDeals.length + lostDeals.length) * 100)
                    : 0;

                // Agrupar por estágio
                const stageMap = new Map<string, { count: number; value: number }>();
                openDeals.forEach((deal: any) => {
                    const stageName = deal.stage?.name || deal.stage?.label || 'Sem estágio';
                    const existing = stageMap.get(stageName) || { count: 0, value: 0 };
                    stageMap.set(stageName, {
                        count: existing.count + 1,
                        value: existing.value + (deal.value || 0)
                    });
                });

                return {
                    totalDeals: deals?.length || 0,
                    openDeals: openDeals.length,
                    wonDeals: wonDeals.length,
                    lostDeals: lostDeals.length,
                    winRate: `${winRate}%`,
                    pipelineValue: `R$ ${totalValue.toLocaleString('pt-BR')}`,
                    wonValue: `R$ ${wonValue.toLocaleString('pt-BR')}`,
                    stageBreakdown: Object.fromEntries(stageMap)
                };
            },
        }),

        getBoardMetrics: tool({
            description: 'Calcula métricas e KPIs do board: Win Rate, Total Pipeline, contagem de deals',
            inputSchema: z.object({
                boardId: z.string().optional(),
            }),
            execute: async ({ boardId }) => {
                // supabase is already initialized
                const targetBoardId = boardId || context.boardId;
                console.log('[AI] 📊 getBoardMetrics EXECUTED!');

                if (!targetBoardId) {
                    return { error: 'Nenhum board selecionado.' };
                }

                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, value, is_won, is_lost, created_at')
                    .eq('organization_id', organizationId)
                    .eq('board_id', targetBoardId);

                const total = deals?.length || 0;
                const won = deals?.filter(d => d.is_won) || [];
                const lost = deals?.filter(d => d.is_lost) || [];
                const open = deals?.filter(d => !d.is_won && !d.is_lost) || [];

                const winRate = won.length + lost.length > 0
                    ? Math.round(won.length / (won.length + lost.length) * 100)
                    : 0;

                return {
                    totalDeals: total,
                    openDeals: open.length,
                    wonDeals: won.length,
                    lostDeals: lost.length,
                    winRate: `${winRate}%`,
                    pipelineValue: `R$ ${open.reduce((s, d) => s + (d.value || 0), 0).toLocaleString('pt-BR')}`,
                    closedValue: `R$ ${won.reduce((s, d) => s + (d.value || 0), 0).toLocaleString('pt-BR')}`
                };
            },
        }),

        // ============= BUSCA =============
        searchDeals: tool({
            description: 'Busca deals por título',
            inputSchema: z.object({
                query: z.string().describe('Termo de busca'),
                limit: z.number().optional().default(5),
            }),
            execute: async ({ query, limit }) => {
                // supabase is already initialized
                console.log('[AI] 🔍 searchDeals EXECUTED!', query);

                let queryBuilder = supabase
                    .from('deals')
                    .select('id, title, value, is_won, is_lost, stage:board_stages(name, label), contact:contacts(name)')
                    .eq('organization_id', organizationId)
                    .ilike('title', `%${query}%`)
                    .limit(limit);

                if (context.boardId) {
                    queryBuilder = queryBuilder.eq('board_id', context.boardId);
                }

                const { data: deals } = await queryBuilder;

                return {
                    count: deals?.length || 0,
                    deals: deals?.map((d: any) => ({
                        id: d.id,
                        title: d.title,
                        value: `R$ ${(d.value || 0).toLocaleString('pt-BR')}`,
                        stage: d.stage?.name || d.stage?.label || 'N/A',
                        contact: d.contact?.name || 'N/A',
                        status: d.is_won ? '✅ Ganho' : d.is_lost ? '❌ Perdido' : '🔄 Aberto'
                    })) || []
                };
            },
        }),

        searchContacts: tool({
            description: 'Busca contatos por nome ou email',
            inputSchema: z.object({
                query: z.string().describe('Termo de busca'),
                limit: z.number().optional().default(5),
            }),
            execute: async ({ query, limit }) => {
                // supabase is already initialized
                console.log('[AI] 🔍 searchContacts EXECUTED!', query);

                const { data: contacts } = await supabase
                    .from('contacts')
                    .select('id, name, email, phone, company_name')
                    .eq('organization_id', organizationId)
                    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
                    .limit(limit);

                return {
                    count: contacts?.length || 0,
                    contacts: contacts?.map(c => ({
                        id: c.id,
                        name: c.name,
                        email: c.email || 'N/A',
                        phone: c.phone || 'N/A',
                        company: c.company_name || 'N/A'
                    })) || []
                };
            },
        }),

        listDealsByStage: tool({
            description: 'Lista todos os deals em um estágio específico do funil',
            inputSchema: z.object({
                stageName: z.string().optional().describe('Nome do estágio (ex: Proposta, Negociação)'),
                stageId: z.string().optional().describe('ID do estágio'),
                boardId: z.string().optional(),
                limit: z.number().optional().default(10),
            }),
            execute: async ({ stageName, stageId, boardId, limit }) => {
                // supabase is already initialized
                const targetBoardId = boardId || context.boardId;

                console.log('[AI] 📋 listDealsByStage EXECUTING:', {
                    stageName,
                    stageId,
                    boardId,
                    targetBoardId,
                    contextBoardId: context.boardId
                });

                if (!targetBoardId) {
                    return { error: 'Nenhum board selecionado.' };
                }

                // UUID regex for validation (full or prefix)
                const isValidUuid = (str: string) =>
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
                const isUuidPrefix = (str: string) =>
                    /^[0-9a-f]{8}$/i.test(str) || /^[0-9a-f]{8}-[0-9a-f]{1,4}$/i.test(str);

                // Find stage by ID, partial ID, or name
                let finalStageId = stageId;
                let effectiveStageName = stageName;

                // If stageId looks like a stage NAME (not hex), treat it as stageName
                if (finalStageId && !isValidUuid(finalStageId) && !isUuidPrefix(finalStageId)) {
                    // This is a stage name, not a UUID
                    console.log('[AI] ⚠️ stageId is a name, converting to stageName:', finalStageId);
                    effectiveStageName = finalStageId;
                    finalStageId = undefined;
                }

                // If stageId is a partial UUID, search by prefix
                if (finalStageId && !isValidUuid(finalStageId) && isUuidPrefix(finalStageId)) {
                    console.log('[AI] ⚠️ Partial UUID, searching by prefix:', finalStageId);
                    const { data: stages } = await supabase
                        .from('board_stages')
                        .select('id, name')
                        .eq('organization_id', organizationId)
                        .eq('board_id', targetBoardId)
                        .ilike('id', `${finalStageId}%`);

                    if (stages && stages.length > 0) {
                        finalStageId = stages[0].id;
                        console.log('[AI] ✅ Found stage by prefix:', stages[0].name, finalStageId);
                    } else {
                        finalStageId = undefined;
                    }
                }

                // If no valid stageId, search by name
                if (!finalStageId && effectiveStageName) {
                    const { data: stages, error: stageError } = await supabase
                        .from('board_stages')
                        .select('id, name, label')
                        .eq('organization_id', organizationId)
                        .eq('board_id', targetBoardId)
                        .or(`name.ilike.%${effectiveStageName}%,label.ilike.%${effectiveStageName}%`);

                    console.log('[AI] 📋 Stage search by name:', {
                        stageName: effectiveStageName,
                        foundStages: stages,
                        stageError
                    });

                    if (stages && stages.length > 0) {
                        finalStageId = stages[0].id;
                    } else {
                        const { data: allStages } = await supabase
                            .from('board_stages')
                            .select('name, label')
                            .eq('organization_id', organizationId)
                            .eq('board_id', targetBoardId);

                        const stageNames = allStages?.map(s => s.name || s.label).join(', ') || 'nenhum';
                        return { error: `Estágio "${effectiveStageName}" não encontrado. Estágios disponíveis: ${stageNames}` };
                    }
                }

                if (!finalStageId) {
                    return { error: 'Estágio não identificado. Informe o nome do estágio (ex: "Proposta", "Descoberta").' };
                }

                console.log('[AI] 📋 Querying deals with stageId:', finalStageId);

                const { data: deals, error: dealsError } = await supabase
                    .from('deals')
                    .select('id, title, value, updated_at, contact:contacts(name)')
                    .eq('organization_id', organizationId)
                    .eq('board_id', targetBoardId)
                    .eq('stage_id', finalStageId)
                    .eq('is_won', false)
                    .eq('is_lost', false)
                    .order('value', { ascending: false })
                    .limit(limit);

                console.log('[AI] 📋 Deals query result:', {
                    dealsCount: deals?.length,
                    deals,
                    dealsError
                });

                const totalValue = deals?.reduce((s, d) => s + (d.value || 0), 0) || 0;

                return {
                    count: deals?.length || 0,
                    totalValue: `R$ ${totalValue.toLocaleString('pt-BR')}`,
                    deals: deals?.map((d: any) => ({
                        id: d.id,
                        title: d.title,
                        value: `R$ ${(d.value || 0).toLocaleString('pt-BR')}`,
                        contact: d.contact?.name || 'N/A'
                    })) || []
                };
            },
        }),
        listStagnantDeals: tool({
            description: 'Lista deals parados/estagnados há mais de X dias sem atualização',
            inputSchema: z.object({
                boardId: z.string().optional(),
                daysStagnant: z.number().int().positive().optional().default(7).describe('Dias sem atualização'),
                limit: z.number().int().positive().optional().default(10),
            }),
            execute: async ({ boardId, daysStagnant, limit }) => {
                const targetBoardId = boardId || context.boardId;
                console.log('[AI] ⏰ listStagnantDeals EXECUTED!');

                if (!targetBoardId) {
                    return { error: 'Nenhum board selecionado.' };
                }

                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysStagnant);

                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, value, updated_at, contact:contacts(name)')
                    .eq('organization_id', organizationId)
                    .eq('board_id', targetBoardId)
                    .eq('is_won', false)
                    .eq('is_lost', false)
                    .lt('updated_at', cutoffDate.toISOString())
                    .order('updated_at', { ascending: true })
                    .limit(limit);

                return {
                    count: deals?.length || 0,
                    message: `${deals?.length || 0} deals parados há mais de ${daysStagnant} dias`,
                    deals: deals?.map((d: any) => {
                        const days = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                        return {
                            id: d.id,
                            title: d.title,
                            diasParado: days,
                            value: `R$ ${(d.value || 0).toLocaleString('pt-BR')}`,
                            contact: d.contact?.name || 'N/A'
                        };
                    }) || []
                };
            },
        }),

        listOverdueDeals: tool({
            description: 'Lista deals que possuem atividades atrasadas',
            inputSchema: z.object({
                boardId: z.string().optional(),
                limit: z.number().int().positive().optional().default(10),
            }),
            execute: async ({ boardId, limit }) => {
                const targetBoardId = boardId || context.boardId;

                if (!targetBoardId) {
                    return { error: 'Nenhum board selecionado.' };
                }

                const now = new Date().toISOString();

                const { data: overdueActivities } = await supabase
                    .from('activities')
                    .select('deal_id, date, title')
                    .eq('organization_id', organizationId)
                    .lt('date', now)
                    .eq('completed', false)
                    .order('date', { ascending: true });

                if (!overdueActivities || overdueActivities.length === 0) {
                    return { count: 0, message: 'Nenhuma atividade atrasada encontrada! 🎉', deals: [] };
                }

                const dealIds = [...new Set(overdueActivities.map(a => a.deal_id).filter(Boolean))];

                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, value, contact:contacts(name)')
                    .eq('organization_id', organizationId)
                    .eq('board_id', targetBoardId)
                    .in('id', dealIds)
                    .limit(limit);

                return {
                    count: deals?.length || 0,
                    message: `⚠️ ${deals?.length || 0} deals com atividades atrasadas`,
                    deals: deals?.map((d: any) => ({
                        id: d.id,
                        title: d.title,
                        value: `R$ ${(d.value || 0).toLocaleString('pt-BR')}`,
                        contact: d.contact?.name || 'N/A',
                        overdueCount: overdueActivities.filter(a => a.deal_id === d.id).length
                    })) || []
                };
            },
        }),

        getDealDetails: tool({
            description: 'Mostra os detalhes completos de um deal específico',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal (usa contexto se não fornecido)'),
            }),
            execute: async ({ dealId }) => {
                const targetDealId = dealId || context.dealId;
                console.log('[AI] 🔎 getDealDetails EXECUTED!');

                if (!targetDealId) {
                    return { error: 'Nenhum deal especificado.' };
                }

                const { data: deal, error } = await supabase
                    .from('deals')
                    .select(`
                        *,
                        contact:contacts(name, email, phone),
                        stage:board_stages(name, label),
                        activities(id, type, title, completed, date)
                    `)
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId)
                    .single();

                if (error || !deal) {
                    return { error: 'Deal não encontrado.' };
                }

                const pendingActivities = deal.activities?.filter((a: any) => !a.completed) || [];

                return {
                    id: deal.id,
                    title: deal.title,
                    value: `R$ ${(deal.value || 0).toLocaleString('pt-BR')}`,
                    status: deal.is_won ? '✅ Ganho' : deal.is_lost ? '❌ Perdido' : '🔄 Aberto',
                    stage: (deal.stage as any)?.name || (deal.stage as any)?.label || 'N/A',
                    priority: deal.priority || 'medium',
                    contact: (deal.contact as any)?.name || 'N/A',
                    contactEmail: (deal.contact as any)?.email || 'N/A',
                    pendingActivities: pendingActivities.length,
                    createdAt: deal.created_at
                };
            },
        }),

        // ============= AÇÕES (COM APROVAÇÃO) =============
        moveDeal: tool({
            description: 'Move um deal para outro estágio do funil',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal (usa contexto se não fornecido)'),
                stageName: z.string().optional().describe('Nome do estágio destino'),
                stageId: z.string().optional().describe('ID do estágio destino'),
            }),
            needsApproval: true,
            execute: async ({ dealId, stageName, stageId }) => {
                const targetDealId = dealId || context.dealId;
                console.log('[AI] 🔄 moveDeal EXECUTED!');

                if (!targetDealId) {
                    return { error: 'Nenhum deal especificado.' };
                }

                const { data: deal } = await supabase
                    .from('deals')
                    .select('board_id, title')
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId)
                    .single();

                if (!deal) {
                    return { error: 'Deal não encontrado.' };
                }

                let targetStageId = stageId;
                if (!targetStageId && stageName) {
                    const { data: stages } = await supabase
                        .from('board_stages')
                        .select('id, name, label')
                        .eq('organization_id', organizationId)
                        .eq('board_id', deal.board_id)
                        .or(`name.ilike.%${stageName}%,label.ilike.%${stageName}%`);

                    if (stages && stages.length > 0) {
                        targetStageId = stages[0].id;
                    } else {
                        return { error: `Estágio "${stageName}" não encontrado.` };
                    }
                }

                if (!targetStageId) {
                    return { error: 'Especifique o estágio destino.' };
                }

                const { error } = await supabase
                    .from('deals')
                    .update({
                        stage_id: targetStageId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId);

                if (error) {
                    return { success: false, error: error.message };
                }

                return { success: true, message: `Deal "${deal.title}" movido com sucesso!` };
            },
        }),

        createDeal: tool({
            description: 'Cria um novo deal no board atual (ou informado)',
            inputSchema: z.object({
                title: z.string().min(1).describe('Título do deal'),
                value: z.number().optional().default(0).describe('Valor do deal em reais'),
                contactName: z.string().optional().describe('Nome do contato'),
                boardId: z.string().optional(),
            }),
            needsApproval: true,
            execute: async ({ title, value, contactName, boardId }) => {
                const targetBoardId = boardId || context.boardId;
                console.log('[AI] ➕ createDeal EXECUTED!', title);

                if (!targetBoardId) {
                    return { error: 'Nenhum board selecionado.' };
                }

                const { data: stages } = await supabase
                    .from('board_stages')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .eq('board_id', targetBoardId)
                    .order('order', { ascending: true })
                    .limit(1);

                const firstStageId = stages?.[0]?.id;
                if (!firstStageId) {
                    return { error: 'Board não tem estágios configurados.' };
                }

                let contactId: string | null = null;
                if (contactName) {
                    const { data: existing } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('organization_id', organizationId)
                        .ilike('name', contactName)
                        .limit(1);

                    if (existing && existing.length > 0) {
                        contactId = existing[0].id;
                    } else {
                        const { data: newContact } = await supabase
                            .from('contacts')
                            .insert({
                                organization_id: organizationId,
                                name: contactName,
                                owner_id: userId,
                            })
                            .select('id')
                            .single();

                        contactId = newContact?.id ?? null;
                    }
                }

                const { data: deal, error } = await supabase
                    .from('deals')
                    .insert({
                        organization_id: organizationId,
                        board_id: targetBoardId,
                        title,
                        value,
                        contact_id: contactId,
                        stage_id: firstStageId,
                        priority: 'medium',
                        is_won: false,
                        is_lost: false,
                        owner_id: userId,
                    })
                    .select('id, title, value')
                    .single();

                if (error || !deal) {
                    return { success: false, error: error?.message ?? 'Falha ao criar deal' };
                }

                return {
                    success: true,
                    deal: {
                        id: deal.id,
                        title: deal.title,
                        value: `R$ ${(deal.value || 0).toLocaleString('pt-BR')}`
                    },
                    message: `Deal "${title}" criado com sucesso!`
                };
            },
        }),

        updateDeal: tool({
            description: 'Atualiza campos de um deal existente',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal (usa contexto se não fornecido)'),
                title: z.string().optional().describe('Novo título'),
                value: z.number().optional().describe('Novo valor'),
                priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
            }),
            needsApproval: true,
            execute: async ({ dealId, title, value, priority }) => {
                const targetDealId = dealId || context.dealId;
                console.log('[AI] ✏️ updateDeal EXECUTED!');

                if (!targetDealId) {
                    return { error: 'Nenhum deal especificado.' };
                }

                const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
                if (title) updateData.title = title;
                if (value !== undefined) updateData.value = value;
                if (priority) updateData.priority = priority;

                const { error } = await supabase
                    .from('deals')
                    .update(updateData)
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId);

                if (error) {
                    return { success: false, error: error.message };
                }

                return { success: true, message: 'Deal atualizado com sucesso!' };
            },
        }),

        markDealAsWon: tool({
            description: 'Marca um deal como GANHO/fechado com sucesso! 🎉 Pode encontrar o deal por ID, título, ou estágio.',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal (opcional se fornecer outros identificadores)'),
                dealTitle: z.string().optional().describe('Título/nome do deal para buscar'),
                stageName: z.string().optional().describe('Nome do estágio onde o deal está (ex: "Proposta")'),
                wonValue: z.number().optional().describe('Valor final do fechamento'),
            }),
            needsApproval: true,
            execute: async ({ dealId, dealTitle, stageName, wonValue }) => {
                // supabase is already initialized
                let targetDealId = dealId || context.dealId;
                const targetBoardId = context.boardId;

                console.log('[AI] 🎉 markDealAsWon EXECUTING:', { dealId, dealTitle, stageName, targetBoardId });

                // Smart lookup: find deal by title or stage if no dealId
                if (!targetDealId && targetBoardId) {
                    let query = supabase
                        .from('deals')
                        .select('id, title, value, stage:board_stages(name)')
                        .eq('organization_id', organizationId)
                        .eq('board_id', targetBoardId)
                        .eq('is_won', false)
                        .eq('is_lost', false);

                    // Find by title
                    if (dealTitle) {
                        query = query.ilike('title', `%${dealTitle}%`);
                    }

                    const { data: foundDeals } = await query.limit(5);
                    console.log('[AI] 🔍 Found deals:', foundDeals);

                    // If looking for stage, filter by stage name
                    if (stageName && foundDeals) {
                        const filtered = foundDeals.filter((d: any) =>
                            d.stage?.name?.toLowerCase().includes(stageName.toLowerCase())
                        );
                        if (filtered.length === 1) {
                            targetDealId = filtered[0].id;
                        } else if (filtered.length > 1) {
                            return {
                                error: `Encontrei ${filtered.length} deals em "${stageName}". Especifique qual: ${filtered.map((d: any) => d.title).join(', ')}`
                            };
                        }
                    } else if (foundDeals?.length === 1) {
                        targetDealId = foundDeals[0].id;
                    } else if (dealTitle && foundDeals && foundDeals.length > 0) {
                        // Multiple matches by title
                        return {
                            error: `Encontrei ${foundDeals.length} deals com "${dealTitle}". Especifique qual: ${foundDeals.map((d: any) => d.title).join(', ')}`
                        };
                    }
                }

                if (!targetDealId) {
                    return { error: 'Não consegui identificar o deal. Forneça o ID, título ou nome do estágio.' };
                }

                const updateData: any = {
                    is_won: true,
                    is_lost: false,
                    closed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                if (wonValue !== undefined) updateData.value = wonValue;

                const { data: deal, error } = await supabase
                    .from('deals')
                    .update(updateData)
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId)
                    .select('title, value')
                    .single();

                if (error || !deal) {
                    return { success: false, error: error?.message || 'Deal não encontrado' };
                }

                return {
                    success: true,
                    message: `🎉 Parabéns! Deal "${deal.title}" marcado como GANHO!`,
                    value: `R$ ${(deal.value || 0).toLocaleString('pt-BR')}`
                };
            },
        }),

        markDealAsLost: tool({
            description: 'Marca um deal como PERDIDO. Requer motivo da perda.',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal'),
                reason: z.string().describe('Motivo da perda (ex: Preço, Concorrente, Timing)'),
            }),
            needsApproval: true, // ✅ Requer aprovação
            execute: async ({ dealId, reason }) => {
                // supabase is already initialized
                const targetDealId = dealId || context.dealId;
                console.log('[AI] ❌ markDealAsLost EXECUTED!');

                if (!targetDealId) {
                    return { error: 'Nenhum deal especificado.' };
                }

                const { data: deal, error } = await supabase
                    .from('deals')
                    .update({
                        is_won: false,
                        is_lost: true,
                        loss_reason: reason,
                        closed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId)
                    .select('title')
                    .single();

                if (error || !deal) {
                    return { success: false, error: error?.message || 'Deal não encontrado' };
                }

                return {
                    success: true,
                    message: `Deal "${deal.title}" marcado como perdido. Motivo: ${reason}`
                };
            },
        }),

        assignDeal: tool({
            description: 'Reatribui um deal para outro vendedor/responsável',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal'),
                newOwnerId: z.string().describe('ID do novo responsável (UUID)'),
            }),
            needsApproval: true, // ✅ Requer aprovação
            execute: async ({ dealId, newOwnerId }) => {
                // supabase is already initialized
                const targetDealId = dealId || context.dealId;
                console.log('[AI] 👤 assignDeal EXECUTED!');

                if (!targetDealId) {
                    return { error: 'Nenhum deal especificado.' };
                }

                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('first_name, nickname')
                    .eq('organization_id', organizationId)
                    .eq('id', newOwnerId)
                    .single();

                const ownerName = ownerProfile?.nickname || ownerProfile?.first_name || 'Novo responsável';

                const { data: deal, error } = await supabase
                    .from('deals')
                    .update({
                        owner_id: newOwnerId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('organization_id', organizationId)
                    .eq('id', targetDealId)
                    .select('title')
                    .single();

                if (error || !deal) {
                    return { success: false, error: error?.message || 'Deal não encontrado' };
                }

                return {
                    success: true,
                    message: `Deal "${deal.title}" reatribuído para ${ownerName}`
                };
            },
        }),

        createTask: tool({
            description: 'Cria uma nova tarefa ou atividade para acompanhamento',
            inputSchema: z.object({
                title: z.string().describe('Título da tarefa'),
                description: z.string().optional(),
                dueDate: z.string().optional().describe('Data de vencimento ISO'),
                dealId: z.string().optional(),
                type: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK']).optional().default('TASK'),
            }),
            needsApproval: true,
            execute: async ({ title, description, dueDate, dealId, type }) => {
                // supabase is already initialized
                const targetDealId = dealId || context.dealId;
                console.log('[AI] ✏️ createTask EXECUTED!', title);

                const date = dueDate || new Date().toISOString();

                const { data, error } = await supabase
                    .from('activities')
                    .insert({
                        organization_id: organizationId,
                        title,
                        description,
                        date,
                        deal_id: targetDealId,
                        type,
                        owner_id: userId,
                        completed: false,
                    })
                    .select()
                    .single();

                if (error) {
                    return { success: false, error: error.message };
                }

                return {
                    success: true,
                    activity: { id: data.id, title: data.title, type: data.type },
                    message: `Atividade "${title}" criada com sucesso!`
                };
            },
        }),
    };
}
