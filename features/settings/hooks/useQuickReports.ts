/**
 * @fileoverview React Hooks: Quick Reports
 * 
 * Hook para gerar relatórios sob demanda.
 */

'use client';

import { useMutation } from '@tanstack/react-query';
import type { ReportType, ReportFilters, ReportResult } from '@/lib/supabase/quick-reports';

/**
 * Hook para gerar relatório.
 */
export function useGenerateReport() {
    return useMutation<ReportResult, Error, { type: ReportType; filters: ReportFilters }>({
        mutationFn: async ({ type, filters }) => {
            const res = await fetch('/api/reports', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, filters }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || 'Failed to generate report');
            }

            const data = await res.json();
            return data.report;
        },
    });
}
