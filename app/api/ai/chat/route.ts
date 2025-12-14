// Route Handler for AI Chat - /api/ai/chat
// Full integration with AI SDK v6 ToolLoopAgent + createAgentUIStreamResponse

import { createAgentUIStreamResponse, UIMessage } from 'ai';
import { createCRMAgent } from '@/lib/ai/crmAgent';
import { createClient } from '@/lib/supabase/server';
import type { CRMCallOptions } from '@/types/ai';

export const maxDuration = 60;

export async function POST(req: Request) {
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    // 2. Get profile with organization
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, first_name, nickname')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return new Response('Profile not found', { status: 404 });
    }

    const organizationId = profile.organization_id;

    // 3. Get API key from organization_settings
    const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('ai_google_key, ai_model')
        .eq('organization_id', organizationId)
        .single();

    if (!orgSettings?.ai_google_key) {
        return new Response('API key not configured', { status: 400 });
    }

    const apiKey = orgSettings.ai_google_key;
    const modelId = orgSettings.ai_model || 'gemini-2.0-flash-exp';

    // 4. Parse request with context
    const body = await req.json();
    const messages: UIMessage[] = body.messages;
    const rawContext = body.context || {};

    // 5. Build type-safe context for agent
    const context: CRMCallOptions = {
        organizationId,
        boardId: rawContext.boardId,
        dealId: rawContext.dealId,
        contactId: rawContext.contactId,
        boardName: rawContext.boardName,
        stages: rawContext.stages,
        dealCount: rawContext.dealCount,
        pipelineValue: rawContext.pipelineValue,
        stagnantDeals: rawContext.stagnantDeals,
        overdueDeals: rawContext.overdueDeals,
        wonStage: rawContext.wonStage,
        lostStage: rawContext.lostStage,
        userId: user.id,
        userName: profile.nickname || profile.first_name || user.email,
    };

    console.log('[AI Chat] 📨 Request received:', {
        messagesCount: messages?.length,
        rawContext,
        context: {
            organizationId: context.organizationId,
            boardId: context.boardId,
            dealId: context.dealId,
            boardName: context.boardName,
            stagesCount: context.stages?.length,
            userName: context.userName,
        },
    });

    // 6. Create agent with API key and context
    const agent = await createCRMAgent(context, user.id, apiKey, modelId);

    // 7. Return streaming response using AI SDK v6 createAgentUIStreamResponse
    return createAgentUIStreamResponse({
        agent,
        messages,
        options: context,
    });
}
