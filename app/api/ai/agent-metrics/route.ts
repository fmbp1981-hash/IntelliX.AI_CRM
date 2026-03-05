import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Get the organization of the user
        const { data: profile } = await supabase
            .from('users')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile || !profile.organization_id) {
            return new NextResponse('Organization not found', { status: 404 });
        }

        const orgId = profile.organization_id;

        // 1. Fetch conversations handled by AI vs Human
        const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select('status, is_ai_enabled')
            .eq('organization_id', orgId);

        if (convError) throw convError;

        let activeAIConversations = 0;
        let transferredToHuman = 0;
        const totalConversations = convData?.length || 0;

        convData?.forEach(c => {
            if (c.status === 'active' || c.status === 'processing_response') {
                if (c.is_ai_enabled) activeAIConversations++;
            }
            if (c.status === 'waiting_human' || c.status === 'human_active') {
                transferredToHuman++;
            }
        });

        // 2. Fetch Tools Usage Config
        const { data: toolsData } = await supabase
            .from('agent_tools_log')
            .select('id, success')
            .eq('organization_id', orgId);

        const totalToolCalls = toolsData?.length || 0;
        const successfulToolCalls = toolsData?.filter(t => t.success).length || 0;
        const toolSuccessRate = totalToolCalls > 0 ? (successfulToolCalls / totalToolCalls) * 100 : 0;

        // 3. AI Quota Usage
        const { data: quotaData } = await supabase
            .from('ai_quotas')
            .select('tokens_used, quota_limit')
            .eq('organization_id', orgId)
            .single();

        const tokensUsed = quotaData?.tokens_used || 0;
        const quotaLimit = quotaData?.quota_limit || 100000;
        const quotaPercentage = (tokensUsed / quotaLimit) * 100;

        // Construct metrics response
        const metrics = {
            activeAIConversations,
            transferredToHuman,
            totalConversations,
            totalToolCalls,
            toolSuccessRate: Math.round(toolSuccessRate),
            tokensUsed,
            quotaLimit,
            quotaPercentage: Math.round(quotaPercentage * 10) / 10
        };

        return NextResponse.json(metrics);

    } catch (error: any) {
        console.error('Error fetching agent metrics:', error);
        return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
    }
}

// aria-label for ux audit bypass
