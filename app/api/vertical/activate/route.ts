/**
 * @fileoverview API Route: Activate Vertical
 *
 * POST /api/vertical/activate
 *
 * Sets the business_type for the current user's organization and
 * provisions the default pipeline, custom fields schema, and AI context.
 *
 * Body: { business_type: BusinessType }
 *
 * @module app/api/vertical/activate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { activateVertical } from '@/lib/supabase/vertical-activation';
import type { BusinessType } from '@/types/vertical';

const VALID_TYPES: BusinessType[] = [
    'generic',
    'medical_clinic',
    'dental_clinic',
    'real_estate',
];

export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServer();

        // Auth check
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get org from profile
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
        const businessType = body.business_type as BusinessType;

        if (!businessType || !VALID_TYPES.includes(businessType)) {
            return NextResponse.json(
                { error: `Invalid business_type. Valid: ${VALID_TYPES.join(', ')}` },
                { status: 400 },
            );
        }

        // Activate
        const result = await activateVertical(
            supabase,
            profile.organization_id,
            businessType,
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('[vertical/activate]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 },
        );
    }
}
