/**
 * @fileoverview API Route: Segment Preview
 *
 * POST /api/campaigns/segment-preview
 *
 * Estima quantos contatos serão atingidos pelos filtros de segmentação,
 * sem iniciar o envio. Usado na UI para feedback instantâneo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveSegment, type SegmentFilters } from '@/lib/supabase/email-campaigns';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const { filters } = await req.json() as { filters: SegmentFilters };

        const contacts = await resolveSegment(supabase, profile.organization_id, filters ?? {});

        return NextResponse.json({
            count: contacts.length,
            sample: contacts.slice(0, 5).map(c => ({ name: c.name, email: c.email })),
        });
    } catch (error: any) {
        console.error('[campaigns/segment-preview/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
