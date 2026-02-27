/**
 * @fileoverview Custom Fields Service (EAV Pattern)
 *
 * CRUD operations for custom field values stored in the `custom_field_values` table.
 * Uses the Entity-Attribute-Value (EAV) pattern to support flexible, schema-driven
 * fields per vertical without altering core tables.
 *
 * @module lib/supabase/custom-fields
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { CustomFieldValue } from '@/types/vertical';

// ─── Types ───────────────────────────────────────────────────────────

export type EntityType = 'contact' | 'deal' | 'activity';

export interface CustomFieldMap {
    [fieldKey: string]: unknown;
}

// ─── Read ────────────────────────────────────────────────────────────

/**
 * Fetches all custom field values for a given entity.
 * Returns a flat key-value map for easy consumption.
 *
 * @example
 * ```ts
 * const fields = await getCustomFields(supabase, 'contact', contactId);
 * // { convenio: "Unimed", especialidade: "Cardiologia", ... }
 * ```
 */
export async function getCustomFields(
    supabase: SupabaseClient,
    entityType: EntityType,
    entityId: string,
): Promise<CustomFieldMap> {
    const { data, error } = await supabase
        .from('custom_field_values')
        .select('field_key, field_value')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

    if (error) throw error;

    const map: CustomFieldMap = {};
    for (const row of data ?? []) {
        map[row.field_key] = row.field_value;
    }
    return map;
}

/**
 * Fetches custom fields for multiple entities at once (batch).
 * Returns a map of entityId → CustomFieldMap.
 *
 * @example
 * ```ts
 * const fieldsMap = await getCustomFieldsBatch(supabase, 'deal', [id1, id2]);
 * // { [id1]: { tipo_procedimento: "Consulta" }, [id2]: { ... } }
 * ```
 */
export async function getCustomFieldsBatch(
    supabase: SupabaseClient,
    entityType: EntityType,
    entityIds: string[],
): Promise<Record<string, CustomFieldMap>> {
    if (entityIds.length === 0) return {};

    const { data, error } = await supabase
        .from('custom_field_values')
        .select('entity_id, field_key, field_value')
        .eq('entity_type', entityType)
        .in('entity_id', entityIds);

    if (error) throw error;

    const result: Record<string, CustomFieldMap> = {};
    for (const row of data ?? []) {
        if (!result[row.entity_id]) result[row.entity_id] = {};
        result[row.entity_id][row.field_key] = row.field_value;
    }
    return result;
}

// ─── Write ───────────────────────────────────────────────────────────

/**
 * Upserts custom field values for an entity.
 * Uses the UNIQUE constraint on (organization_id, entity_type, entity_id, field_key)
 * to perform insert-or-update atomically.
 *
 * @param fields - Key-value map of fields to save (only non-undefined values are persisted).
 *
 * @example
 * ```ts
 * await saveCustomFields(supabase, orgId, 'contact', contactId, {
 *   convenio: "Unimed",
 *   especialidade: "Cardiologia",
 * });
 * ```
 */
export async function saveCustomFields(
    supabase: SupabaseClient,
    organizationId: string,
    entityType: EntityType,
    entityId: string,
    fields: CustomFieldMap,
): Promise<void> {
    const entries = Object.entries(fields).filter(
        ([, value]) => value !== undefined,
    );

    if (entries.length === 0) return;

    const upserts = entries.map(([key, value]) => ({
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        field_key: key,
        field_value: value,
        updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
        .from('custom_field_values')
        .upsert(upserts, {
            onConflict: 'organization_id,entity_type,entity_id,field_key',
        });

    if (error) throw error;
}

// ─── Delete ──────────────────────────────────────────────────────────

/**
 * Deletes a specific custom field value.
 */
export async function deleteCustomField(
    supabase: SupabaseClient,
    entityType: EntityType,
    entityId: string,
    fieldKey: string,
): Promise<void> {
    const { error } = await supabase
        .from('custom_field_values')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('field_key', fieldKey);

    if (error) throw error;
}

/**
 * Deletes all custom fields for a given entity.
 * Typically called when an entity (contact/deal) is deleted.
 */
export async function deleteAllCustomFields(
    supabase: SupabaseClient,
    entityType: EntityType,
    entityId: string,
): Promise<void> {
    const { error } = await supabase
        .from('custom_field_values')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

    if (error) throw error;
}
