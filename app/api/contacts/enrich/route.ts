/**
 * @fileoverview API Route: Contact Enrichment
 * 
 * POST /api/contacts/enrich
 * body: { contactId } — Enrich single contact
 * body: { batch: true, limit? } — Batch enrichment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enrichContact, enrichContactsBatch } from '@/lib/supabase/contact-enrichment';

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

        const body = await req.json();

        if (body.batch) {
            const result = await enrichContactsBatch(
                supabase,
                profile.organization_id,
                { limit: body.limit }
            );
            return NextResponse.json({ success: true, ...result });
        }

        if (!body.contactId) {
            return NextResponse.json({ error: 'contactId required' }, { status: 400 });
        }

        const result = await enrichContact(supabase, body.contactId, profile.organization_id);
        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('[contacts/enrich/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
