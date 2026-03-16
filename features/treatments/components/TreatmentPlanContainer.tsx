'use client';

import React from 'react';
import { DealView } from '@/types';
import { useOrgBusinessType } from '@/hooks/useOrgBusinessType';
import { useVerticalConfig } from '@/hooks/useVerticalConfig';
import { useCustomFields, useSaveCustomFields } from '@/hooks/useCustomFields';
import { useAuth } from '@/context/AuthContext';
import { TreatmentPlanEditor } from './TreatmentPlanEditor';
import { Loader2 } from 'lucide-react';

interface TreatmentPlanContainerProps {
    deal: DealView | { id: string; title: string; value: number };
}

export function TreatmentPlanContainer({ deal }: TreatmentPlanContainerProps) {
    const { businessType, isLoading: isOrgLoading } = useOrgBusinessType();
    const { data: config, isLoading: isConfigLoading } = useVerticalConfig(businessType);
    const { data: customFields, isLoading: isFieldsLoading } = useCustomFields('deal', deal.id);
    const { mutateAsync: saveCustomFields } = useSaveCustomFields();
    const { organizationId } = useAuth();

    if (isConfigLoading || isFieldsLoading || isOrgLoading) {
        return (
            <div className="flex items-center justify-center p-8 bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10">
                <Loader2 size={24} className="text-slate-500 animate-spin" />
            </div>
        );
    }

    if (!config || !organizationId) return null;

    const isDental = businessType === 'dental_clinic';

    const handleUpdateField = async (key: string, value: unknown) => {
        await saveCustomFields({
            organizationId,
            entityType: 'deal',
            entityId: deal.id,
            fields: { [key]: value },
        });
    };

    return (
        <TreatmentPlanEditor
            dealTitle={deal.title}
            dealValue={deal.value}
            customFields={customFields || {}}
            onFieldChange={handleUpdateField}
            isDental={isDental}
            readOnly={false}
        />
    );
}
