'use client';

/**
 * @fileoverview CustomFieldsRenderer — Dynamic form renderer for vertical custom fields.
 *
 * Reads the `custom_fields_schema` from the vertical config and renders
 * the appropriate form controls. Handles read and edit modes.
 *
 * @module features/shared/components/CustomFieldsRenderer
 */

import { useMemo } from 'react';
import type { CustomFieldSchema, CustomFieldsSchemaMap } from '@/types/vertical';
import type { CustomFieldMap } from '@/lib/supabase/custom-fields';

// ─── Types ───────────────────────────────────────────────────────────

interface CustomFieldsRendererProps {
    /** The schema definition from vertical_configs.custom_fields_schema */
    schema: CustomFieldsSchemaMap;
    /** Which entity type to render fields for */
    entityType: 'contact' | 'deal';
    /** Current field values */
    values: CustomFieldMap;
    /** Called when a field value changes. Undefined = read-only mode. */
    onChange?: (fieldKey: string, value: unknown) => void;
    /** If true, renders in compact read-only mode (inline labels) */
    readOnly?: boolean;
    /** Extra CSS classes for the wrapper */
    className?: string;
}

// ─── Component ───────────────────────────────────────────────────────

export function CustomFieldsRenderer({
    schema,
    entityType,
    values,
    onChange,
    readOnly = false,
    className = '',
}: CustomFieldsRendererProps) {
    const fields = useMemo(() => schema[entityType] ?? [], [schema, entityType]);

    if (fields.length === 0) return null;

    return (
        <div className={`space-y-4 ${className}`}>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Campos Específicos
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((field) =>
                    readOnly ? (
                        <ReadOnlyField
                            key={field.key}
                            field={field}
                            value={values[field.key]}
                        />
                    ) : (
                        <EditableField
                            key={field.key}
                            field={field}
                            value={values[field.key]}
                            onChange={(v) => onChange?.(field.key, v)}
                        />
                    ),
                )}
            </div>
        </div>
    );
}

// ─── Read-Only Field ─────────────────────────────────────────────────

function ReadOnlyField({
    field,
    value,
}: {
    field: CustomFieldSchema;
    value: unknown;
}) {
    const displayValue = formatDisplayValue(field, value);

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-gray-500">{field.label}</span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
                {displayValue || '—'}
            </span>
        </div>
    );
}

// ─── Editable Field ──────────────────────────────────────────────────

function EditableField({
    field,
    value,
    onChange,
}: {
    field: CustomFieldSchema;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const baseInputClasses =
        'w-full rounded-md border border-gray-300 px-3 py-2 text-sm ' +
        'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
        'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';

    switch (field.type) {
        case 'text':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <input
                        type="text"
                        value={(value as string) ?? ''}
                        placeholder={field.placeholder}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                </FieldWrapper>
            );

        case 'textarea':
            return (
                <FieldWrapper label={field.label} required={field.required} fullWidth>
                    <textarea
                        value={(value as string) ?? ''}
                        placeholder={field.placeholder}
                        onChange={(e) => onChange(e.target.value)}
                        rows={3}
                        className={baseInputClasses}
                    />
                </FieldWrapper>
            );

        case 'number':
        case 'decimal':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <input
                        type="number"
                        value={(value as number) ?? ''}
                        min={field.min}
                        max={field.max}
                        step={field.type === 'decimal' ? 0.01 : 1}
                        onChange={(e) => onChange(e.target.valueAsNumber || null)}
                        className={baseInputClasses}
                    />
                </FieldWrapper>
            );

        case 'currency':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-gray-500">
                            R$
                        </span>
                        <input
                            type="number"
                            value={(value as number) ?? ''}
                            step={0.01}
                            onChange={(e) => onChange(e.target.valueAsNumber || null)}
                            className={`${baseInputClasses} pl-10`}
                        />
                    </div>
                </FieldWrapper>
            );

        case 'date':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <input
                        type="date"
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                </FieldWrapper>
            );

        case 'datetime':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <input
                        type="datetime-local"
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                </FieldWrapper>
            );

        case 'boolean':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Sim</span>
                    </label>
                </FieldWrapper>
            );

        case 'select':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <select
                        value={(value as string) ?? ''}
                        onChange={(e) => onChange(e.target.value || null)}
                        className={baseInputClasses}
                    >
                        <option value="">Selecione...</option>
                        {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </FieldWrapper>
            );

        case 'multi_select':
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <div className="flex flex-wrap gap-2">
                        {(field.options ?? []).map((opt) => {
                            const currentValues = (value as string[]) ?? [];
                            const isChecked = currentValues.includes(opt);
                            return (
                                <label
                                    key={opt}
                                    className={`
                    flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer
                    transition-colors duration-150
                    ${isChecked
                                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }
                  `}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                            const next = isChecked
                                                ? currentValues.filter((v) => v !== opt)
                                                : [...currentValues, opt];
                                            onChange(next);
                                        }}
                                        className="sr-only"
                                    />
                                    {opt}
                                </label>
                            );
                        })}
                    </div>
                </FieldWrapper>
            );

        case 'fk':
            // FK fields render as text for now; full FK resolution can be added later
            return (
                <FieldWrapper label={field.label} required={field.required}>
                    <input
                        type="text"
                        value={(value as string) ?? ''}
                        placeholder={`ID do ${field.references ?? 'registro'}`}
                        onChange={(e) => onChange(e.target.value)}
                        className={baseInputClasses}
                    />
                </FieldWrapper>
            );

        default:
            return null;
    }
}

// ─── Utilities ───────────────────────────────────────────────────────

function FieldWrapper({
    label,
    required,
    fullWidth,
    children,
}: {
    label: string;
    required?: boolean;
    fullWidth?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
                {required && <span className="ml-1 text-red-500">*</span>}
            </label>
            {children}
        </div>
    );
}

function formatDisplayValue(field: CustomFieldSchema, value: unknown): string {
    if (value === null || value === undefined) return '';

    switch (field.type) {
        case 'currency':
            return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        case 'boolean':
            return value ? 'Sim' : 'Não';
        case 'multi_select':
            return Array.isArray(value) ? (value as string[]).join(', ') : String(value);
        case 'date':
            try {
                return new Date(value as string).toLocaleDateString('pt-BR');
            } catch {
                return String(value);
            }
        case 'datetime':
            try {
                return new Date(value as string).toLocaleString('pt-BR');
            } catch {
                return String(value);
            }
        default:
            return String(value);
    }
}
