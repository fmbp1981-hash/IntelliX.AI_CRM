// app/api/conversations/[id]/actions/route.ts
// API route for conversation actions: take over, return to AI, close

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, name')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return NextResponse.json({ error: 'No organization' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body; // 'take_over' | 'return_to_ai' | 'close'

    // Verify conversation
    const { data: conversation } = await supabase
        .from('conversations')
        .select('id, status, whatsapp_name')
        .eq('id', params.id)
        .eq('organization_id', profile.organization_id)
        .single();

    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    let updates: Record<string, unknown> = {};
    let systemMessage = '';

    switch (action) {
        case 'take_over':
            updates = {
                status: 'human_active',
                assigned_agent: user.id,
            };
            systemMessage = `👤 ${profile.name ?? 'Atendente'} assumiu a conversa.`;
            break;

        case 'return_to_ai':
            updates = {
                status: 'active',
                assigned_agent: 'ai',
            };
            systemMessage = `🤖 Conversa devolvida ao NossoAgent.`;
            break;

        case 'close':
            updates = {
                status: 'closed',
                closed_at: new Date().toISOString(),
            };
            systemMessage = `🔒 Conversa encerrada por ${profile.name ?? 'atendente'}.`;
            break;

        default:
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update conversation
    const { error: updateError } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', params.id);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Add system message
    await supabase.from('messages').insert({
        conversation_id: params.id,
        organization_id: profile.organization_id,
        role: 'system',
        content: systemMessage,
        content_type: 'text',
        is_internal_note: false,
    });

    return NextResponse.json({
        success: true,
        action,
        newStatus: updates.status,
    });
}
