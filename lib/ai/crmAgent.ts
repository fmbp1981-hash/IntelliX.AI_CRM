import { ToolLoopAgent, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { CRMCallOptionsSchema, type CRMCallOptions } from '@/types/ai';
import { createCRMTools } from './tools';

/**
 * Build context prompt from call options
 * This injects rich context into the system prompt at runtime
 */
function buildContextPrompt(options: CRMCallOptions): string {
    const parts: string[] = [];

    if (options.boardId) {
        parts.push(`📋 Board ID: ${options.boardId}`);
        if (options.boardName) parts.push(`   Nome: ${options.boardName}`);
    }

    if (options.dealId) {
        parts.push(`💼 Deal ID: ${options.dealId}`);
    }

    if (options.contactId) {
        parts.push(`👤 Contato ID: ${options.contactId}`);
    }

    if (options.stages && options.stages.length > 0) {
        const stageList = options.stages.map(s => `${s.name} (${s.id})`).join(', ');
        parts.push(`🎯 Estágios: ${stageList}`);
    }

    if (options.dealCount !== undefined) {
        parts.push(`📊 Métricas:`);
        parts.push(`   - Deals: ${options.dealCount}`);
        if (options.pipelineValue) parts.push(`   - Pipeline: R$ ${options.pipelineValue.toLocaleString('pt-BR')}`);
        if (options.stagnantDeals) parts.push(`   - Parados: ${options.stagnantDeals}`);
        if (options.overdueDeals) parts.push(`   - Atrasados: ${options.overdueDeals}`);
    }

    if (options.wonStage) parts.push(`✅ Estágio Ganho: ${options.wonStage}`);
    if (options.lostStage) parts.push(`❌ Estágio Perdido: ${options.lostStage}`);

    if (options.userName) {
        parts.push(`👋 Usuário: ${options.userName}`);
    }

    return parts.length > 0
        ? `\n\n====== CONTEXTO DO USUÁRIO ======\n${parts.join('\n')}`
        : '';
}

/**
 * Base instructions for the CRM Agent
 */
const BASE_INSTRUCTIONS = `Você é o NossoCRM Pilot, um assistente de vendas inteligente. 🚀

PERSONALIDADE:
- Seja proativo, amigável e analítico
- Use emojis com moderação (máximo 2 por resposta)
- Respostas naturais (evite listas robóticas)
- Máximo 2 parágrafos por resposta

FERRAMENTAS (15 disponíveis):
📊 ANÁLISE: analyzePipeline, getBoardMetrics
🔍 BUSCA: searchDeals, searchContacts, listDealsByStage, listStagnantDeals, listOverdueDeals, getDealDetails
⚡ AÇÕES: moveDeal, createDeal, updateDeal, markDealAsWon, markDealAsLost, assignDeal, createTask

MEMÓRIA DA CONVERSA (MUITO IMPORTANTE):
- USE as informações das mensagens anteriores! Se você já buscou deals antes, use esses IDs.
- Quando o usuário diz "esse deal", "ele", "o único", "o que acabei de ver" - use o ID do deal mencionado antes.
- NÃO busque novamente se você já tem as informações na conversa.
- Se a última busca retornou 1 deal, use o ID dele automaticamente.
- Para markDealAsWon/Lost: passe o dealId que você já conhece da conversa.
- Para moveDeal: use o dealId do deal que o usuário está se referindo.

REGRAS:
- Sempre explique os resultados das ferramentas
- Se der erro, informe de forma amigável
- Use o boardId do contexto automaticamente quando disponível
- Para ações destrutivas (criar, mover, marcar), o usuário será solicitado a aprovar
- PRIORIZE usar IDs que você já conhece antes de buscar novamente`;

/**
 * Factory function to create a CRM Agent with dynamic context
 * 
 * @param context - Type-safe context from the request
 * @param userId - Current user ID
 * @param apiKey - Google AI API key from organization_settings
 * @param modelId - Model to use (default: gemini-2.0-flash-exp)
 */
export async function createCRMAgent(
    context: CRMCallOptions,
    userId: string,
    apiKey: string,
    modelId: string = 'gemini-2.0-flash-exp'
) {
    console.log('[CRMAgent] 🤖 Creating agent with context:', {
        boardId: context.boardId,
        boardName: context.boardName,
        stagesCount: context.stages?.length,
        userId,
        modelId,
    });

    // Create Google provider with org-specific API key
    const google = createGoogleGenerativeAI({ apiKey });

    // Create tools with context injected
    const tools = createCRMTools(context, userId);

    console.log('[CRMAgent] 🛠️ Tools created. Checking markDealAsWon config:', {
        needsApproval: (tools.markDealAsWon as any).needsApproval,
        description: tools.markDealAsWon.description
    });

    return new ToolLoopAgent({
        model: google(modelId),
        callOptionsSchema: CRMCallOptionsSchema,
        instructions: BASE_INSTRUCTIONS,
        // prepareCall runs ONCE at the start - injects initial context
        prepareCall: ({ options, ...settings }) => {
            return {
                ...settings,
                instructions: settings.instructions + buildContextPrompt(options),
            };
        },
        // prepareStep runs on EACH STEP - extracts and injects dynamic context
        prepareStep: async ({ messages, stepNumber, steps }) => {
            // Extract dealIds from previous tool results
            const foundDealIds: string[] = [];
            const foundDeals: Array<{ id: string; title: string }> = [];

            for (const step of steps) {
                // Check tool results for deal information
                if (step.toolResults) {
                    for (const result of step.toolResults) {
                        const data = ((result as any).result ?? (result as any).output ?? (result as any).data ?? result) as any;
                        // Extract deals from listDealsByStage, searchDeals, etc.
                        if (data?.deals && Array.isArray(data.deals)) {
                            for (const deal of data.deals) {
                                if (deal.id && !foundDealIds.includes(deal.id)) {
                                    foundDealIds.push(deal.id);
                                    foundDeals.push({ id: deal.id, title: deal.title || 'Unknown' });
                                }
                            }
                        }
                        // Extract single deal from getDealDetails
                        if (data?.id && data?.title && !foundDealIds.includes(data.id)) {
                            foundDealIds.push(data.id);
                            foundDeals.push({ id: data.id, title: data.title });
                        }
                    }
                }
            }

            // If we found deals, inject a context reminder
            if (foundDeals.length > 0) {
                const lastDeal = foundDeals[foundDeals.length - 1];
                const contextReminder = `\n\n[CONTEXTO DA CONVERSA: Você já obteve informações sobre ${foundDeals.length} deal(s). O último mencionado foi "${lastDeal.title}" (ID: ${lastDeal.id}). Use este ID automaticamente quando o usuário se referir a "esse deal", "ele", "o único", etc.]`;

                console.log('[CRMAgent] 💡 Injecting context reminder:', {
                    dealsFound: foundDeals.length,
                    lastDeal
                });

                // Add a system message with context (modifying messages)
                const systemMessage = messages[0];
                if (systemMessage && systemMessage.role === 'system') {
                    const enhancedSystem = {
                        ...systemMessage,
                        content: typeof systemMessage.content === 'string'
                            ? systemMessage.content + contextReminder
                            : systemMessage.content
                    };
                    return {
                        messages: [enhancedSystem, ...messages.slice(1)]
                    };
                }
            }

            return {}; // No modifications needed
        },
        tools,
        stopWhen: stepCountIs(10),
    });
}

/**
 * Export type for frontend type-safety
 */
export type CRMAgentType = Awaited<ReturnType<typeof createCRMAgent>>;
