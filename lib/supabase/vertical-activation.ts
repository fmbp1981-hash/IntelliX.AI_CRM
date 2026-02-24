/**
 * @fileoverview Vertical Activation Service
 *
 * Handles the activation of a business vertical for an organization.
 * Called during onboarding when the user selects their business type.
 *
 * The process:
 *  1. Updates org.business_type
 *  2. Loads the vertical_configs row
 *  3. Creates a default pipeline with niche-specific stages
 *
 * @module lib/supabase/vertical-activation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
    BusinessType,
    VerticalConfig,
    PipelineStageTemplate,
} from '@/types/vertical';

// ─── Types ───────────────────────────────────────────────────────────

export interface ActivationResult {
    success: boolean;
    businessType: BusinessType;
    pipelineId?: string;
    stagesCreated: number;
    config: VerticalConfig;
}

// ─── Main Activation Function ────────────────────────────────────────

/**
 * Activates a vertical for the given organization.
 *
 * 1. Sets `business_type` on the organization.
 * 2. Loads the matching `vertical_configs` row.
 * 3. If the org has no pipelines yet, creates a default pipeline
 *    using the vertical's `default_pipeline_template`.
 *
 * @throws Error if the business type is invalid or the config is missing.
 */
export async function activateVertical(
    supabase: SupabaseClient,
    organizationId: string,
    businessType: BusinessType,
): Promise<ActivationResult> {
    // 1. Update org business_type
    const { error: updateError } = await supabase
        .from('organizations')
        .update({ business_type: businessType })
        .eq('id', organizationId);

    if (updateError) throw new Error(`Failed to set business_type: ${updateError.message}`);

    // 2. Load vertical config
    const { data: config, error: configError } = await supabase
        .from('vertical_configs')
        .select('*')
        .eq('business_type', businessType)
        .single();

    if (configError || !config) {
        throw new Error(`Vertical config not found for type: ${businessType}`);
    }

    const verticalConfig = config as VerticalConfig;

    // 3. Create default pipeline if not already present
    let pipelineId: string | undefined;
    let stagesCreated = 0;

    const pipelineTemplate = verticalConfig.default_pipeline_template;
    if (pipelineTemplate && pipelineTemplate.length > 0) {
        const result = await createDefaultPipeline(
            supabase,
            organizationId,
            verticalConfig.display_config.pipeline_label ?? 'Pipeline',
            pipelineTemplate,
        );
        pipelineId = result.pipelineId;
        stagesCreated = result.stagesCreated;
    }

    return {
        success: true,
        businessType,
        pipelineId,
        stagesCreated,
        config: verticalConfig,
    };
}

// ─── Pipeline Creation ───────────────────────────────────────────────

/**
 * Creates a default pipeline (board) with stages from the vertical template.
 * Skips creation if the org already has at least one board.
 */
async function createDefaultPipeline(
    supabase: SupabaseClient,
    organizationId: string,
    pipelineName: string,
    stages: PipelineStageTemplate[],
): Promise<{ pipelineId: string; stagesCreated: number }> {
    // Check if org already has boards
    const { count } = await supabase
        .from('boards')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

    if (count && count > 0) {
        // Org already has pipelines, skip creation to avoid duplicates
        return { pipelineId: '', stagesCreated: 0 };
    }

    // Create the board
    const { data: board, error: boardError } = await supabase
        .from('boards')
        .insert({
            organization_id: organizationId,
            name: pipelineName,
            is_default: true,
        })
        .select('id')
        .single();

    if (boardError || !board) {
        throw new Error(`Failed to create pipeline: ${boardError?.message}`);
    }

    // Create stages
    const stageInserts = stages.map((stage) => ({
        organization_id: organizationId,
        board_id: board.id,
        label: stage.name,
        color: stage.color,
        order: stage.order,
    }));

    const { error: stagesError } = await supabase
        .from('pipeline_stages')
        .insert(stageInserts);

    if (stagesError) {
        throw new Error(`Failed to create stages: ${stagesError.message}`);
    }

    return { pipelineId: board.id, stagesCreated: stages.length };
}

/**
 * Gets the current vertical config for an organization by looking up its business_type.
 */
export async function getOrgVerticalConfig(
    supabase: SupabaseClient,
    organizationId: string,
): Promise<VerticalConfig | null> {
    const { data: org } = await supabase
        .from('organizations')
        .select('business_type')
        .eq('id', organizationId)
        .single();

    if (!org?.business_type) return null;

    const { data: config } = await supabase
        .from('vertical_configs')
        .select('*')
        .eq('business_type', org.business_type)
        .single();

    return (config as VerticalConfig) ?? null;
}
