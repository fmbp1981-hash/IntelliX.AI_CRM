'use client';

import React from 'react';
import { Contact } from '@/types';
import { useOrgBusinessType } from '@/hooks/useOrgBusinessType';
import { useVerticalConfig } from '@/hooks/useVerticalConfig';
import { useCustomFields, useSaveCustomFields } from '@/hooks/useCustomFields';
import { useAuth } from '@/context/AuthContext';
import { PatientRecordView } from './PatientRecordView';
import { Loader2 } from 'lucide-react';

interface PatientRecordContainerProps {
    contact: Contact;
}

export function PatientRecordContainer({ contact }: PatientRecordContainerProps) {
    const { businessType, isLoading: isOrgLoading } = useOrgBusinessType();
    const { data: config, isLoading: isConfigLoading } = useVerticalConfig(businessType);
    const { data: customFields, isLoading: isFieldsLoading } = useCustomFields('contact', contact.id);
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
            entityType: 'contact',
            entityId: contact.id,
            fields: { [key]: value },
        });
    };

    return (
        <PatientRecordView
            contact={contact}
            schema={config.custom_fields_schema || { contact: [], deal: [] }}
            customFields={customFields || {}}
            onFieldChange={handleUpdateField}
            isDental={isDental}
            readOnly={false}
        />
    );
}
