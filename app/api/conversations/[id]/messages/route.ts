// app/api/conversations/[id]/messages/route.ts
// API route for getting messages + sending internal notes

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return NextResponse.json({ error: 'No organization' }, { status: 403 });
    }

    // Verify conversation belongs to org
    const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', params.id)
        .eq('organization_id', profile.organization_id)
        .single();

    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '100');
    const before = searchParams.get('before'); // cursor-based pagination

    let query = supabase
        .from('messages')
        .select('id, role, content, content_type, is_internal_note, ai_tools_used, tokens_used, created_at')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ messages: data ?? [] });
}

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
    const { content, role = 'system', isInternalNote = true } = body;

    if (!content?.trim()) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify conversation belongs to org
    const { data: conversation } = await supabase
        .from('conversations')
        .select('id, organization_id')
        .eq('id', params.id)
        .eq('organization_id', profile.organization_id)
        .single();

    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: message, error } = await supabase
        .from('messages')
        .insert({
            conversation_id: params.id,
            organization_id: profile.organization_id,
            role,
            content: content.trim(),
            content_type: 'text',
            is_internal_note: isInternalNote,
        })
        .select('id, role, content, created_at, is_internal_note')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message }, { status: 201 });
}
