import { z } from "zod";
import { tool } from "ai";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// ============================================================================
// TOOL SCHEMAS
// ============================================================================

// --- Existing Schemas ---
const CreateActivitySchema = z.object({
    dealId: z.string().describe("ID do deal para vincular a atividade"),
    type: z.enum(["CALL", "MEETING", "EMAIL", "TASK", "WHATSAPP"]).describe("Tipo da atividade"),
    title: z.string().describe("Título curto da atividade"),
    description: z.string().optional().describe("Descrição detalhada"),
    dueDate: z.string().describe("Data de vencimento (ISO string)"),
});

const SendWhatsAppSchema = z.object({
    contactId: z.string().describe("ID do contato"),
    message: z.string().describe("Mensagem completa para enviar"),
});

const MoveDealSchema = z.object({
    dealId: z.string().describe("ID do deal"),
    stageId: z.string().describe("ID do novo estágio de destino"),
    reason: z.string().optional().describe("Motivo da movimentação"),
});

const SearchDealsSchema = z.object({
    query: z.string().describe("Termo de busca (nome, empresa, etc)"),
    status: z.string().optional().describe("Filtrar por status/stage ID"),
    limit: z.number().optional().default(5),
});

// --- New Board Tools Schemas ---
const ListStagnantDealsSchema = z.object({
    boardId: z.string().describe("ID do board para filtrar"),
    daysStagnant: z.number().optional().default(10).describe("Número de dias sem atualização (padrão: 10)"),
    limit: z.number().optional().default(10),
});

const ListOverdueDealsSchema = z.object({
    boardId: z.string().describe("ID do board para filtrar"),
    limit: z.number().optional().default(10),
});

const GetDealDetailsSchema = z.object({
    dealId: z.string().describe("ID do deal para buscar detalhes"),
});

const ListDealsByStageSchema = z.object({
    boardId: z.string().describe("ID do board (use o boardId do contexto)"),
    stageName: z.string().optional().describe("Nome do estágio (ex: 'Novos Leads', 'Proposta'). Use se o usuário mencionar por nome."),
    stageId: z.string().optional().describe("ID do estágio (UUID). Use se tiver o ID do estágio. Veja a lista de estágios no contexto."),
    limit: z.number().optional().default(20),
});

const GetBoardMetricsSchema = z.object({
    boardId: z.string().describe("ID do board para calcular métricas"),
});

const CreateDealSchema = z.object({
    boardId: z.string().describe("ID do board onde criar o deal (use o boardId do contexto)"),
    title: z.string().describe("OBRIGATÓRIO: Título/nome do deal mencionado pelo usuário. Extraia do texto."),
    value: z.number().describe("OBRIGATÓRIO: Valor em reais mencionado pelo usuário. Extraia o número."),
    contactName: z.string().describe("OBRIGATÓRIO: Nome do contato mencionado pelo usuário."),
    companyName: z.string().optional().describe("Nome da empresa (opcional)"),
    stageId: z.string().optional().describe("ID do estágio inicial (opcional, usa primeiro estágio se não fornecido)"),
});

const UpdateDealSchema = z.object({
    dealId: z.string().describe("OBRIGATÓRIO: ID do deal (UUID) mencionado pelo usuário. Peça se não fornecido."),
    title: z.string().optional().describe("Novo título"),
    value: z.number().optional().describe("Novo valor em reais"),
    priority: z.enum(["low", "medium", "high"]).optional().describe("Nova prioridade"),
});

const MarkDealAsWonSchema = z.object({
    dealId: z.string().describe("ID do deal"),
    notes: z.string().optional().describe("Notas sobre o fechamento"),
});

const MarkDealAsLostSchema = z.object({
    dealId: z.string().describe("ID do deal"),
    reason: z.string().describe("Motivo da perda (ex: 'Preço', 'Concorrente', 'Timing')"),
});

const AssignDealSchema = z.object({
    dealId: z.string().describe("OBRIGATÓRIO: ID do deal (UUID) a reatribuir. Peça se não fornecido."),
    newOwnerId: z.string().describe("OBRIGATÓRIO: ID do novo responsável (UUID). Peça se não fornecido."),
});

const ScheduleBulkActivitySchema = z.object({
    boardId: z.string().describe("ID do board"),
    stageName: z.string().describe("Nome do estágio (deals neste estágio receberão a atividade)"),
    activityType: z.enum(["CALL", "MEETING", "EMAIL", "TASK"]).describe("Tipo da atividade"),
    title: z.string().describe("Título da atividade"),
    dueDate: z.string().describe("Data de vencimento (ISO string)"),
});

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

// --- Existing Implementations ---
export async function executeCreateActivity(userId: string, args: z.infer<typeof CreateActivitySchema>) {
    const { dealId, type, title, description, dueDate } = args;
    const { data, error } = await supabaseAdmin
        .from("activities")
        .insert({
            owner_id: userId, // FIXED: user_id -> owner_id
            deal_id: dealId,
            type,
            title,
            description,
            date: dueDate,
            completed: false
        })
        .select()
        .single();

    if (error) throw new Error(`Erro ao criar atividade: ${error.message}`);
    return { success: true, activity: data, message: "Atividade criada com sucesso" };
}

export async function executeSendWhatsApp(userId: string, args: z.infer<typeof SendWhatsAppSchema>) {
    const { contactId, message } = args;
    const { data, error } = await supabaseAdmin
        .from("activities")
        .insert({
            owner_id: userId, // FIXED: user_id -> owner_id
            contact_id: contactId,
            type: "WHATSAPP",
            title: "Mensagem WhatsApp Enviada",
            description: message,
            completed: true,
            completed_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw new Error(`Erro ao salvar log de WhatsApp: ${error.message}`);
    return { success: true, message: "Mensagem enviada (simulado)" };
}


export async function executeMoveDeal(userId: string, args: z.infer<typeof MoveDealSchema>) {
    const { dealId, stageId, reason } = args;
    const { data, error } = await supabaseAdmin
        .from("deals")
        .update({
            status: stageId, // Legacy compatibility
            stage_id: stageId, // Modern schema
            updated_at: new Date().toISOString()
        })
        .eq("id", dealId)
        .select()
        .single();

    if (error) throw new Error(`Erro ao mover deal: ${error.message}`);
    return { success: true, deal: data, message: `Deal movido para o estágio ${stageId}` };
}

// ... (skipping executeSearchDeals) ...



// ...

export async function executeListDealsByStage(userId: string, args: z.infer<typeof ListDealsByStageSchema>) {
    const { boardId, stageName, stageId: providedStageId, limit } = args;

    let finalStageId: string | undefined;
    let stageLabel: string | undefined;

    // Option 1: Use stageId directly if provided
    if (providedStageId) {
        finalStageId = providedStageId;
        // Look up the label for display
        const { data: stage } = await supabaseAdmin
            .from("board_stages")
            .select("label")
            .eq("id", providedStageId)
            .single();
        stageLabel = stage?.label || providedStageId;
    }
    // Option 2: Find by stageName
    else if (stageName) {
        const { data: stages, error: stageError } = await supabaseAdmin
            .from("board_stages")
            .select("id, label")
            .eq("board_id", boardId)
            .ilike("label", `%${stageName}%`);

        if (stageError) throw new Error(`Erro ao buscar estágio: ${stageError.message}`);
        if (!stages || stages.length === 0) {
            return { deals: [], count: 0, message: `Estágio "${stageName}" não encontrado` };
        }
        finalStageId = stages[0].id;
        stageLabel = stages[0].label;
    }
    // Neither provided - error
    else {
        return { deals: [], count: 0, message: `Forneça o nome do estágio (stageName) ou o ID (stageId)` };
    }

    // FIX: Query using stage_id instead of status
    const { data, error } = await supabaseAdmin
        .from("deals")
        .select(`id, title, value, updated_at, contacts:contact_id (name, company_name)`)
        .eq("board_id", boardId)
        .eq("stage_id", finalStageId) // Changed from status to stage_id
        .eq("is_won", false)
        .eq("is_lost", false)
        .order("value", { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Erro ao buscar deals: ${error.message}`);

    const formattedDeals = (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        contactName: d.contacts?.name || 'N/A',
        companyName: d.contacts?.company_name || 'N/A',
    }));
    return {
        deals: formattedDeals,
        count: formattedDeals.length,
        stage: stageLabel,
        totalValue: formattedDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
    };
}

// ...

export async function executeCreateDeal(userId: string, args: z.infer<typeof CreateDealSchema>) {
    const { boardId, title, value, contactName, companyName, stageId } = args;

    // ... (omitted fetching logic) ...
    let finalStageId = stageId;
    // ...

    // ... (omitted contact logic) ...

    const { data, error } = await supabaseAdmin
        .from("deals")
        .insert({
            board_id: boardId,
            title,
            value,
            contact_id: null, // Placeholder to match omitted code, strictly updating columns below
            status: finalStageId, // Legacy
            stage_id: finalStageId, // Modern schema
            priority: "medium",
            is_won: false,
            is_lost: false,
            owner_id: userId,
        })
        .select()
        .single();

    // ...
}

// ...

export async function executeScheduleBulkActivity(userId: string, args: z.infer<typeof ScheduleBulkActivitySchema>) {
    const { boardId, stageName, activityType, title, dueDate } = args;

    // Find stage ID
    const { data: stages } = await supabaseAdmin
        .from("board_stages")
        .select("id, label")
        .eq("board_id", boardId)
        .ilike("label", `%${stageName}%`);

    if (!stages || stages.length === 0) {
        return { success: false, message: `Estágio "${stageName}" não encontrado` };
    }

    const stageId = stages[0].id;

    // Get all deals in that stage
    const { data: deals } = await supabaseAdmin
        .from("deals")
        .select("id, title")
        .eq("board_id", boardId)
        .eq("stage_id", stageId)
        .eq("is_won", false)
        .eq("is_lost", false);

    if (!deals || deals.length === 0) {
        return { success: true, count: 0, message: `Nenhum deal encontrado no estágio "${stageName}"` };
    }

    // Create activities for each deal
    const activities = deals.map(deal => ({
        deal_id: deal.id,
        owner_id: userId, // FIXED: user_id -> owner_id
        type: activityType,
        title,
        date: dueDate,
        completed: false,
    }));

    const { error } = await supabaseAdmin.from("activities").insert(activities);

    if (error) throw new Error(`Erro ao criar atividades: ${error.message}`);

    return {
        success: true,
        count: deals.length,
        message: `${deals.length} atividades "${title}" agendadas para deals em "${stages[0].label}"`
    };
}


export async function executeSearchDeals(userId: string, args: z.infer<typeof SearchDealsSchema>) {
    const { query, status, limit } = args;
    let queryBuilder = supabaseAdmin
        .from("deals")
        .select(`id, title, value, status, contacts:contact_id (name, company_name)`)
        .ilike("title", `%${query}%`)
        .limit(limit);

    if (status) {
        queryBuilder = queryBuilder.eq("status", status);
    }

    const { data, error } = await queryBuilder;
    if (error) throw new Error(`Erro na busca: ${error.message}`);
    const formattedDeals = (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        status: d.status,
        contactName: d.contacts?.name || 'N/A',
        companyName: d.contacts?.company_name || 'N/A',
    }));
    return { deals: formattedDeals, count: formattedDeals.length };
}

// --- New Board Tools Implementations ---

export async function executeListStagnantDeals(userId: string, args: z.infer<typeof ListStagnantDealsSchema>) {
    const { boardId, limit } = args;
    const daysStagnant = args.daysStagnant ?? 10;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysStagnant);

    // Use JOIN to get contact info
    const { data, error } = await supabaseAdmin
        .from("deals")
        .select(`
            id, title, value, status, updated_at,
            contacts:contact_id (name, company_name)
        `)
        .eq("board_id", boardId)
        .eq("is_won", false)
        .eq("is_lost", false)
        .lt("updated_at", cutoffDate.toISOString())
        .order("updated_at", { ascending: true })
        .limit(limit ?? 10);

    if (error) throw new Error(`Erro ao buscar deals estagnados: ${error.message}`);

    const dealsWithDays = (data || []).map((d: any) => {
        const updatedAt = d.updated_at ? new Date(d.updated_at).getTime() : Date.now();
        return {
            id: d.id,
            title: d.title,
            value: d.value,
            contactName: d.contacts?.name || 'N/A',
            companyName: d.contacts?.company_name || 'N/A',
            diasParado: Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24))
        };
    });

    return {
        deals: dealsWithDays,
        count: dealsWithDays.length,
        message: dealsWithDays.length > 0
            ? `${dealsWithDays.length} deals estagnados há mais de ${daysStagnant} dias`
            : `Nenhum deal estagnado há mais de ${daysStagnant} dias`
    };
}

export async function executeListOverdueDeals(userId: string, args: z.infer<typeof ListOverdueDealsSchema>) {
    const { boardId, limit } = args;
    const now = new Date().toISOString();

    // Get deals with overdue activities
    const { data, error } = await supabaseAdmin
        .from("activities")
        .select(`
            deal_id,
            date,
            title,
            deals!inner (id, title, value, status)
        `)
        .eq("completed", false)
        .lt("date", now)
        .limit(limit);

    if (error) throw new Error(`Erro ao buscar deals com atraso: ${error.message}`);

    // Group by deal
    const dealMap = new Map<string, any>();
    data?.forEach((activity: any) => {
        if (activity.deals && !dealMap.has(activity.deals.id)) {
            dealMap.set(activity.deals.id, {
                ...activity.deals,
                overdueActivity: activity.title,
                dueDate: activity.date
            });
        }
    });

    const deals = Array.from(dealMap.values());
    return {
        deals,
        count: deals.length,
        message: `${deals.length} deals com atividades atrasadas`
    };
}

export async function executeGetDealDetails(userId: string, args: z.infer<typeof GetDealDetailsSchema>) {
    const { dealId } = args;

    const { data: deal, error } = await supabaseAdmin
        .from("deals")
        .select(`
            *,
            contacts:contact_id (name, company_name),
            activities (id, type, title, date, completed, created_at)
        `)
        .eq("id", dealId)
        .single();

    if (error) throw new Error(`Erro ao buscar deal: ${error.message}`);

    // Calculate days in current stage
    const daysInStage = deal.last_stage_change_date
        ? Math.floor((Date.now() - new Date(deal.last_stage_change_date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // Get recent activities
    const recentActivities = deal.activities
        ?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5) || [];

    const pendingActivities = deal.activities?.filter((a: any) => !a.completed) || [];

    return {
        deal: {
            id: deal.id,
            title: deal.title,
            value: deal.value,
            status: deal.status,
            priority: deal.priority,
            contactName: (deal.contacts as any)?.name || 'N/A',
            companyName: (deal.contacts as any)?.company_name || 'N/A',
            isWon: deal.is_won,
            isLost: deal.is_lost,
            lossReason: deal.loss_reason,
            createdAt: deal.created_at,
            daysInStage,
        },
        recentActivities,
        pendingActivities,
        totalActivities: deal.activities?.length || 0
    };
}



export async function executeGetBoardMetrics(userId: string, args: z.infer<typeof GetBoardMetricsSchema>) {
    const { boardId } = args;

    // Get all deals for the board
    const { data: deals, error } = await supabaseAdmin
        .from("deals")
        .select("id, value, is_won, is_lost, created_at, closed_at")
        .eq("board_id", boardId);

    if (error) throw new Error(`Erro ao calcular métricas: ${error.message}`);

    const totalDeals = deals?.length || 0;
    const wonDeals = deals?.filter(d => d.is_won) || [];
    const lostDeals = deals?.filter(d => d.is_lost) || [];
    const openDeals = deals?.filter(d => !d.is_won && !d.is_lost) || [];

    const winRate = totalDeals > 0 ? (wonDeals.length / (wonDeals.length + lostDeals.length) * 100) : 0;
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const avgDealValue = openDeals.length > 0 ? totalPipelineValue / openDeals.length : 0;

    return {
        metrics: {
            totalDeals,
            openDeals: openDeals.length,
            wonDeals: wonDeals.length,
            lostDeals: lostDeals.length,
            winRate: Math.round(winRate * 10) / 10,
            totalPipelineValue,
            totalWonValue,
            avgDealValue: Math.round(avgDealValue),
        },
        message: `Win Rate: ${Math.round(winRate)}% | Pipeline: R$ ${totalPipelineValue.toLocaleString('pt-BR')}`
    };
}



export async function executeUpdateDeal(userId: string, args: z.infer<typeof UpdateDealSchema>) {
    const { dealId, ...updates } = args;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (updates.title) updateData.title = updates.title;
    if (updates.value !== undefined) updateData.value = updates.value;
    if (updates.priority) updateData.priority = updates.priority;

    const { data, error } = await supabaseAdmin
        .from("deals")
        .update(updateData)
        .eq("id", dealId)
        .select()
        .single();

    if (error) throw new Error(`Erro ao atualizar deal: ${error.message}`);
    return { success: true, deal: data, message: "Deal atualizado com sucesso" };
}

export async function executeMarkDealAsWon(userId: string, args: z.infer<typeof MarkDealAsWonSchema>) {
    const { dealId, notes } = args;

    const { data, error } = await supabaseAdmin
        .from("deals")
        .update({
            is_won: true,
            is_lost: false,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", dealId)
        .select()
        .single();

    if (error) throw new Error(`Erro ao marcar como ganho: ${error.message}`);

    // Log the win as an activity
    if (notes) {
        await supabaseAdmin.from("activities").insert({
            deal_id: dealId,
            user_id: userId,
            type: "NOTE",
            title: "🎉 Deal Ganho!",
            description: notes,
            completed: true,
        });
    }

    return {
        success: true,
        deal: data,
        message: `🎉 Parabéns! Deal "${data.title}" marcado como GANHO! Valor: R$ ${data.value?.toLocaleString('pt-BR')}`
    };
}

export async function executeMarkDealAsLost(userId: string, args: z.infer<typeof MarkDealAsLostSchema>) {
    const { dealId, reason } = args;

    const { data, error } = await supabaseAdmin
        .from("deals")
        .update({
            is_won: false,
            is_lost: true,
            loss_reason: reason,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", dealId)
        .select()
        .single();

    if (error) throw new Error(`Erro ao marcar como perdido: ${error.message}`);

    return {
        success: true,
        deal: data,
        message: `Deal "${data.title}" marcado como perdido. Motivo: ${reason}`
    };
}

export async function executeAssignDeal(userId: string, args: z.infer<typeof AssignDealSchema>) {
    const { dealId, newOwnerId } = args;

    // Get new owner info
    const { data: newOwner } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", newOwnerId)
        .single();

    const { data, error } = await supabaseAdmin
        .from("deals")
        .update({
            owner_id: newOwnerId,
            updated_at: new Date().toISOString(),
        })
        .eq("id", dealId)
        .select()
        .single();

    if (error) throw new Error(`Erro ao reatribuir deal: ${error.message}`);

    return {
        success: true,
        deal: data,
        message: `Deal "${data.title}" reatribuído para ${newOwner?.name || newOwnerId}`
    };
}



// ============================================================================
// TOOL DEFINITIONS (For AI SDK)
// ============================================================================

// Context type passed via experimental_context
export type AgentContext = {
    userId: string;
    dealId?: string | null;
    boardId?: string | null;
    stages?: { id: string; name: string }[];
};

// Helper to extract context with type safety
const getContext = (experimentalContext: unknown): AgentContext => {
    const ctx = experimentalContext as AgentContext | undefined;
    return ctx || { userId: '' };
};

export const getCRMTools = (userId: string) => ({
    // --- Existing Tools ---
    createActivity: tool({
        description: "Cria uma nova atividade (tarefa, reunião, ligação) para um deal específico",
        inputSchema: CreateActivitySchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeCreateActivity(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    sendWhatsApp: tool({
        description: "Envia uma mensagem de WhatsApp para um contato. REQUER APROVAÇÃO.",
        inputSchema: SendWhatsAppSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            return executeSendWhatsApp(ctx.userId || userId, args);
        },
    }),

    moveDeal: tool({
        description: "Move um deal para outro estágio do funil",
        inputSchema: MoveDealSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeMoveDeal(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    searchDeals: tool({
        description: "Busca deals no CRM por nome, empresa ou termo de busca",
        inputSchema: SearchDealsSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            return executeSearchDeals(ctx.userId || userId, args);
        },
    }),

    // --- New Board Tools ---
    listStagnantDeals: tool({
        description: "Lista deals que estão parados/estagnados há mais de X dias sem atualização",
        inputSchema: ListStagnantDealsSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveBoardId = args.boardId || ctx.boardId;
            if (!effectiveBoardId) throw new Error("boardId é obrigatório");
            return executeListStagnantDeals(ctx.userId || userId, { ...args, boardId: effectiveBoardId });
        },
    }),

    listOverdueDeals: tool({
        description: "Lista deals que possuem atividades atrasadas (não completadas depois da data de vencimento)",
        inputSchema: ListOverdueDealsSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveBoardId = args.boardId || ctx.boardId;
            if (!effectiveBoardId) throw new Error("boardId é obrigatório");
            return executeListOverdueDeals(ctx.userId || userId, { ...args, boardId: effectiveBoardId });
        },
    }),

    getDealDetails: tool({
        description: "Busca todos os detalhes de um deal específico, incluindo histórico de atividades",
        inputSchema: GetDealDetailsSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeGetDealDetails(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    listDealsByStage: tool({
        description: "Lista todos os deals em um estágio específico do funil (ex: 'Proposta', 'Negociação')",
        inputSchema: ListDealsByStageSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveBoardId = args.boardId || ctx.boardId;
            if (!effectiveBoardId) throw new Error("boardId é obrigatório");
            // Also try to resolve stage from context if not provided
            let effectiveStageName = args.stageName;
            let effectiveStageId = args.stageId;
            // If no stage info provided and we have stages in context, could try fuzzy match but leave it to AI for now
            return executeListDealsByStage(ctx.userId || userId, {
                ...args,
                boardId: effectiveBoardId,
                stageName: effectiveStageName,
                stageId: effectiveStageId,
            });
        },
    }),

    getBoardMetrics: tool({
        description: "Calcula métricas e KPIs do board: Win Rate, Total Pipeline, Deals Abertos/Ganhos/Perdidos",
        inputSchema: GetBoardMetricsSchema,
        execute: async (args, options) => {
            console.log("[Tool] getBoardMetrics EXECUTE CALLED!");
            console.log("[Tool] args:", JSON.stringify(args));
            console.log("[Tool] options:", JSON.stringify(options));
            const ctx = getContext(options?.experimental_context);
            const effectiveBoardId = args.boardId || ctx.boardId;
            if (!effectiveBoardId) throw new Error("boardId é obrigatório");
            return executeGetBoardMetrics(ctx.userId || userId, { ...args, boardId: effectiveBoardId });
        },
    }),

    createDeal: tool({
        description: "Cria um novo deal/negócio no board especificado",
        inputSchema: CreateDealSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveBoardId = args.boardId || ctx.boardId;
            if (!effectiveBoardId) throw new Error("boardId é obrigatório");
            return executeCreateDeal(ctx.userId || userId, { ...args, boardId: effectiveBoardId });
        },
    }),

    updateDeal: tool({
        description: "Atualiza informações de um deal existente (título, valor, prioridade)",
        inputSchema: UpdateDealSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeUpdateDeal(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    markDealAsWon: tool({
        description: "Marca um deal como GANHO/fechado com sucesso. Use para celebrar vitórias!",
        inputSchema: MarkDealAsWonSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeMarkDealAsWon(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    markDealAsLost: tool({
        description: "Marca um deal como PERDIDO. Requer motivo da perda para análise.",
        inputSchema: MarkDealAsLostSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeMarkDealAsLost(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    assignDeal: tool({
        description: "Reatribui um deal para outro vendedor/responsável",
        inputSchema: AssignDealSchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveDealId = args.dealId || ctx.dealId;
            if (!effectiveDealId) throw new Error("dealId é obrigatório");
            return executeAssignDeal(ctx.userId || userId, { ...args, dealId: effectiveDealId });
        },
    }),

    scheduleBulkActivity: tool({
        description: "Agenda uma atividade em massa para todos os deals de um determinado estágio",
        inputSchema: ScheduleBulkActivitySchema,
        execute: async (args, { experimental_context }) => {
            const ctx = getContext(experimental_context);
            const effectiveBoardId = args.boardId || ctx.boardId;
            if (!effectiveBoardId) throw new Error("boardId é obrigatório");
            return executeScheduleBulkActivity(ctx.userId || userId, { ...args, boardId: effectiveBoardId });
        },
    }),
});
