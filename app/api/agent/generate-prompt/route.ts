/**
 * POST /api/agent/generate-prompt
 *
 * Gera o system prompt final resolvendo a hierarquia:
 *   agent_stage_configs > agent_board_configs > agent_configs (global)
 *
 * Body: { stageId?: string; boardId?: string; preview?: boolean }
 *
 * Se preview=true, retorna o prompt sem salvar (útil para UI de preview).
 * Se preview=false (default), salva o prompt resolvido no agent_configs.system_prompt_override.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    resolveAgentConfigForConversation,
    getAgentPersonalization,
} from '@/lib/supabase/agent-methodology';
import { buildPersonalizedSystemPrompt } from '@/lib/ai/prompt-builder';

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
    return data?.organization_id ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { stageId, boardId, preview = true } = body;

        // 1. Resolve the effective config via hierarchy
        const resolved = await resolveAgentConfigForConversation(supabase, orgId, {
            stageId: stageId ?? undefined,
            boardId: boardId ?? undefined,
        });

        // 2. Load global personalization (tone, training, context) to enrich the prompt
        const personalization = await getAgentPersonalization(supabase, orgId);

        // 3. Build the final system prompt
        const systemPrompt = buildPersonalizedSystemPrompt({
            basePrompt: resolved.system_prompt,
            agentRole: resolved.agent_role,
            methodology: resolved.methodology,
            tone: resolved.tone,
            qualificationCriteria: resolved.qualification_criteria,
            personalization: personalization ?? undefined,
        });

        // 4. Persist if not preview
        if (!preview) {
            await supabase
                .from('agent_configs')
                .update({ system_prompt_override: systemPrompt })
                .eq('organization_id', orgId);
        }

        return NextResponse.json({
            prompt: systemPrompt,
            resolved: {
                agent_role: resolved.agent_role,
                methodology: resolved.methodology,
                tone: resolved.tone,
                source: stageId ? 'stage' : boardId ? 'board' : 'global',
            },
            saved: !preview,
        });
    } catch (err) {
        console.error('[generate-prompt] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
