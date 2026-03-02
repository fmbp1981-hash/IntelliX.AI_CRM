import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.organization_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Get agent config or create if it doesn't exist
        const agentConfigResult = await supabase
            .from('agent_configs')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .single();

        let config = agentConfigResult.data;
        const configError = agentConfigResult.error;

        if (configError && configError.code === 'PGRST116') {
            // Create default config
            const { data: newConfig, error: insertError } = await supabase
                .from('agent_configs')
                .insert([{ organization_id: profile.organization_id }])
                .select()
                .single();

            if (insertError) {
                return NextResponse.json({ error: 'Failed to create agent configuration' }, { status: 500 });
            }
            config = newConfig;
        } else if (configError) {
            return NextResponse.json({ error: 'Failed to fetch agent configuration' }, { status: 500 });
        }

        return NextResponse.json({ data: config });
    } catch (error) {
        console.error('Error in GET /api/settings/agent:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const supabase = await createClient();

        // Quick auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Must be admin
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.organization_id || profile.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        const updates = await request.json();

        // Prevent updating restricted fields
        delete updates.id;
        delete updates.organization_id;
        delete updates.created_at;
        delete updates.updated_at;

        const { data, error } = await supabase
            .from('agent_configs')
            .update(updates)
            .eq('organization_id', profile.organization_id)
            .select()
            .single();

        if (error) {
            console.error('Update agent_configs error:', error);
            return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error in PUT /api/settings/agent:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
