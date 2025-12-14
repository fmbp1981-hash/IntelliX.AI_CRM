import { generateText } from "ai";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { ProviderConfig, executeWithFallback } from "./config.ts";
import { getCRMTools, AgentContext } from "./tools.ts";
import { AgentOptions, AgentOptionsSchema } from "./types.ts";

/**
 * Sanitizes frontend messages to simple CoreMessage format.
 */
function sanitizeMessages(messages: any[]): any[] {
    if (!messages || !Array.isArray(messages)) {
        console.log("[Agent] sanitizeMessages: No messages array provided");
        return [];
    }

    console.log(`[Agent] sanitizeMessages: Processing ${messages.length} messages`);

    const coreMessages: any[] = [];
    for (const m of messages) {
        if (!m || !m.role) continue;

        // Simplify complex tool invocations from frontend history into text
        if (m.toolInvocations && Array.isArray(m.toolInvocations) && m.toolInvocations.length > 0) {
            const toolSummaries = m.toolInvocations
                .filter((ti: any) => ti.state === 'result' || 'result' in ti)
                .map((ti: any) => {
                    const result = ti.result;
                    if (!result) return `[${ti.toolName}] executado`;
                    if (result.deals && Array.isArray(result.deals)) return result.message || `${result.deals.length} deals encontrados.`;
                    if (result.metrics) return `Win Rate: ${result.metrics.winRate}%`;
                    if (result.message) return result.message;
                    return `[${ti.toolName}] concluído`;
                }).join('\n');

            if (toolSummaries) {
                const content = m.content ? `${m.content}\n\n${toolSummaries}` : toolSummaries;
                coreMessages.push({ role: 'assistant', content });
            }
            continue;
        }

        // Handle various content types
        if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
            let contentStr = '';
            if (typeof m.content === 'string') {
                contentStr = m.content.trim();
            } else if (Array.isArray(m.content)) {
                // Handle array content (e.g., from multi-modal messages)
                contentStr = m.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text || '')
                    .join('\n')
                    .trim();
            }

            if (contentStr) {
                coreMessages.push({ role: m.role, content: contentStr });
            }
        }
    }

    console.log(`[Agent] sanitizeMessages: Output ${coreMessages.length} messages`);
    return coreMessages;
}


/**
 * Handles the Agent Chat Request using Native AI SDK v6 experimental_context
 */
export async function processAgentRequest(req: Request, user: any, providers: any, body: any) {
    let { messages, model: modelId, context: rawContext } = body;

    // Validate context
    const contextValidation = AgentOptionsSchema.safeParse(rawContext);
    let context: AgentOptions | any = rawContext;
    if (contextValidation.success) context = contextValidation.data;

    // 1. System Prompt Construction
    const systemBase = `
    VOCÊ É O "NOSSOCRM PILOT", copiloto de vendas. 🚀
    
    DIRETRIZES:
    - Seja proativo, amigável e analítico.
    - Respostas naturais (evite listas robóticas).
    - Use dados para dar insights.
    - Se usar uma tool, LEIA o resultado e explique para o usuário.
    - MÁXIMO 2 parágrafos.
    
    CONTEXTO TÉCNICO:
    - User ID: "${user.id}"
    - Data: ${new Date().toLocaleDateString('pt-BR')}
    
    CRÍTICO:
    - Os IDs (dealId, boardId) são injetados automaticamente via contexto.
    - Se a tool funcionar, NÃO pergunte "qual o ID?".
    - Se falhar, aí sim pergunte.
    `;

    // Build context string for prompt
    let contextStr = "";
    if (context?.view) contextStr += `TELA: ${context.view.name}\n`;
    if (context?.activeObject) {
        const obj = context.activeObject;
        contextStr += `OBJETO ATIVO: ${obj.name} (${obj.type})\nID: ${obj.id}\n`;
        if (obj.metadata) {
            if (obj.metadata.boardId) contextStr += `BOARD_ID: ${obj.metadata.boardId}\n`;
            if (obj.metadata.stages) {
                contextStr += `ESTÁGIOS:\n${obj.metadata.stages.map((s: any) => `- ${s.name} (${s.id})`).join('\n')}\n`;
            }
        }
    }

    const effectiveSystem = contextStr ? `${systemBase}\n====== CONTEXTO ======\n${contextStr}` : systemBase;

    // 2. Build experimental_context for tool injection (AI SDK v6 Native)
    const agentContext: AgentContext = {
        userId: user.id,
        dealId: context?.activeObject?.type === 'deal' ? context.activeObject.id : null,
        boardId: context?.activeObject?.metadata?.boardId ||
            (context?.activeObject?.type === 'board' ? context.activeObject.id : null),
        stages: context?.activeObject?.metadata?.stages?.map((s: any) => ({ id: s.id, name: s.name })) || [],
    };

    // 3. Get tools (they now read from experimental_context internally)
    const tools = getCRMTools(user.id);

    // 4. Execute with Native MaxSteps and experimental_context
    const result = await executeWithFallback(providers, async (model: any) => {
        const coreMessages = sanitizeMessages(messages);

        console.log(`[Agent] Starting Native Loop (maxSteps: 5) with experimental_context...`);
        console.log(`[Agent] Context: dealId=${agentContext.dealId}, boardId=${agentContext.boardId}`);

        const response = await generateText({
            model: model,
            messages: coreMessages,
            system: effectiveSystem,
            tools: tools,
            maxSteps: 5,
            // experimental_context: agentContext, // <--- TEMPORARILY DISABLED FOR TESTING
        });

        console.log(`[Agent] Finished. Rounds: ${response.steps?.length || 1}, FinishReason: ${response.finishReason}`);

        // Extract tool calls for frontend
        const allToolCalls: any[] = [];
        if (response.steps) {
            for (const step of response.steps) {
                if (step.toolCalls) {
                    allToolCalls.push(...step.toolCalls);
                }
            }
        }

        return {
            text: response.text,
            toolCalls: allToolCalls,
            toolResults: [],
            usage: response.usage,
            finishReason: response.finishReason,
        };
    });

    return jsonResponse(result, req, 200);
}
