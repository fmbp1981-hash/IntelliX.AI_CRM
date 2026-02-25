/**
 * @fileoverview API Route: Properties CRUD
 *
 * GET  /api/properties       — List properties (with filters)
 * POST /api/properties       — Create property
 *
 * Only active for organizations with `property_management` feature flag.
 *
 * @module app/api/properties/route
 */

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    listProperties,
    createProperty,
    type PropertyFilters,
} from '@/lib/supabase/vertical-properties';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        const url = new URL(req.url);
        const filters: PropertyFilters = {};
        if (url.searchParams.get('status')) filters.status = url.searchParams.get('status')!;
        if (url.searchParams.get('property_type')) filters.property_type = url.searchParams.get('property_type')!;
        if (url.searchParams.get('transaction_type')) filters.transaction_type = url.searchParams.get('transaction_type')!;
        if (url.searchParams.get('assigned_broker_id')) filters.assigned_broker_id = url.searchParams.get('assigned_broker_id')!;
        if (url.searchParams.get('min_value')) filters.min_value = Number(url.searchParams.get('min_value'));
        if (url.searchParams.get('max_value')) filters.max_value = Number(url.searchParams.get('max_value'));
        if (url.searchParams.get('min_bedrooms')) filters.min_bedrooms = Number(url.searchParams.get('min_bedrooms'));
        if (url.searchParams.get('bairro')) filters.bairro = url.searchParams.get('bairro')!;

        const properties = await listProperties(supabase, profile.organization_id, filters);

        return NextResponse.json({ properties });
    } catch (error) {
        console.error('[properties GET] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        const body = await req.json();
        const property = await createProperty(supabase, profile.organization_id, body);

        return NextResponse.json({ property }, { status: 201 });
    } catch (error) {
        console.error('[properties POST] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
