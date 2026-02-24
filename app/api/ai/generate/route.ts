/**
 * @fileoverview Unified AI Generate Endpoint (Verticalized)
 *
 * POST /api/ai/generate
 *
 * Automatically composes prompts based on the organization's vertical,
 * the target entity, and the requested action. Streams the response.
 *
 * Body:
 *   action:        string  — action key (e.g. 'follow_up', 'analysis')
 *   entity_type?:  'deal' | 'contact'
 *   entity_id?:    string (UUID)
 *   user_message?: string
 *
 * @module app/api/ai/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { composePrompt } from '@/lib/ai/prompt-composer';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServer();

        // Auth
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Profile → org
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json(
                { error: 'No organization found' },
                { status: 404 },
            );
        }

        // Parse body
        const body = await req.json();
        const {
            action,
            entity_type,
            entity_id,
            user_message,
        } = body as {
            action?: string;
            entity_type?: string;
            entity_id?: string;
            user_message?: string;
        };

        if (!action && !user_message) {
            return NextResponse.json(
                { error: 'Either action or user_message is required' },
                { status: 400 },
            );
        }

        // Compose verticalized prompt
        const { systemPrompt, entityContext, verticalConfig } =
            await composePrompt(
                supabase,
                profile.organization_id,
                entity_type,
                entity_id,
                action,
            );

        // Build messages array
        const userContent = [
            entityContext,
            user_message ?? `Execute a ação: ${action}`,
        ]
            .filter(Boolean)
            .join('\n\n');

        // Return composed prompt for the frontend to use with the AI SDK
        // The actual streaming is handled by the existing AI Central infrastructure
        return NextResponse.json({
            systemPrompt,
            userContent,
            verticalType: verticalConfig.business_type ?? 'generic',
            displayConfig: verticalConfig.display_config ?? {},
        });
    } catch (error) {
        console.error('[ai/generate]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 },
        );
    }
}
