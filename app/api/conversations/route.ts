// app/api/conversations/route.ts
// API route for listing and creating NossoAgent conversations

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    let query = supabase
        .from('conversations')
        .select(`
      id, whatsapp_number, whatsapp_name, status, assigned_agent,
      last_message_at, qualification_status, qualification_score,
      qualification_data, summary, detected_intent, detected_sentiment,
      contact:contacts(id, name, email, phone, company_name),
      deal:deals(id, title, value, stage_id)
    `)
        .eq('organization_id', profile.organization_id)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status && status !== 'all') query = query.eq('status', status);
    if (search) {
        query = query.or(`whatsapp_name.ilike.%${search}%,whatsapp_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ conversations: data ?? [], total: count });
}
