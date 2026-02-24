/**
 * @fileoverview API Route: Quick Reports
 * 
 * POST /api/reports
 * body: { type: ReportType, filters: ReportFilters }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReport, type ReportType, type ReportFilters } from '@/lib/supabase/quick-reports';

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
        const { type, filters } = body as { type: ReportType; filters: ReportFilters };

        if (!type || !filters?.start_date || !filters?.end_date) {
            return NextResponse.json(
                { error: 'type, filters.start_date and filters.end_date required' },
                { status: 400 }
            );
        }

        const report = await generateReport(supabase, profile.organization_id, type, filters);
        return NextResponse.json({ report });
    } catch (error: any) {
        console.error('[reports/POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
