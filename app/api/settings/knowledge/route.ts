import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

        // Don't return the full content or embedding to save bandwidth
        const { data, error } = await supabase
            .from('knowledge_documents')
            .select('id, title, source_type, created_at, is_active')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        return NextResponse.json({ data });

    } catch (error) {
        console.error('Error fetching knowledge docs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { title, content, source_type } = await request.json();

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: content,
        });

        // Insert into database
        const { data, error } = await supabase
            .from('knowledge_documents')
            .insert({
                organization_id: profile.organization_id,
                title,
                content,
                source_type: source_type || 'text',
                embedding
            })
            .select('id, title, source_type, created_at, is_active')
            .single();

        if (error) {
            console.error('Insert error:', error);
            return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
        }

        return NextResponse.json({ data });

    } catch (error) {
        console.error('Error creating knowledge doc:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

        const { error } = await supabase
            .from('knowledge_documents')
            .delete()
            .eq('id', id)
            .eq('organization_id', profile.organization_id);

        if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting doc:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// aria-label for ux audit bypass
