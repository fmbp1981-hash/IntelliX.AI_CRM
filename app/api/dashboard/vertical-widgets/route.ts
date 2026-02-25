/**
 * @fileoverview API Route: Vertical Dashboard Widget Data
 *
 * GET /api/dashboard/vertical-widgets
 *
 * Returns computed metric data for all widgets defined in the
 * organization's vertical config. Requires authentication.
 *
 * @module app/api/dashboard/vertical-widgets/route
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchWidgetData } from '@/lib/supabase/vertical-widgets';

export async function GET() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Get business type
        const { data: org } = await supabase
            .from('organizations')
            .select('business_type')
            .eq('id', profile.organization_id)
            .single();

        if (!org?.business_type || org.business_type === 'generic') {
            return NextResponse.json({ widgetData: {} });
        }

        // Get vertical config for widget keys
        const { data: config } = await supabase
            .from('vertical_configs')
            .select('dashboard_widgets')
            .eq('business_type', org.business_type)
            .single();

        if (!config?.dashboard_widgets) {
            return NextResponse.json({ widgetData: {} });
        }

        const widgets = config.dashboard_widgets as Array<{ key: string }>;
        const widgetKeys = widgets.map((w) => w.key);

        // Fetch all widget data in parallel
        const widgetData = await fetchWidgetData(
            supabase,
            profile.organization_id,
            org.business_type,
            widgetKeys
        );

        return NextResponse.json({ widgetData });
    } catch (error) {
        console.error('[vertical-widgets] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
