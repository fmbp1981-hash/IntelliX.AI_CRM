-- =============================================================================
-- Migration: Vertical Infrastructure (Business Profile Layer)
-- Date: 2026-02-24
-- Description: Creates the foundation for multi-niche verticalization.
--   1. business_type_enum on organizations
--   2. vertical_configs table (one row per niche)
--   3. custom_field_values (EAV pattern)
--   4. vertical_properties (real estate only)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM: business_type
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE business_type_enum AS ENUM (
    'generic',
    'medical_clinic',
    'dental_clinic',
    'real_estate'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_type business_type_enum NOT NULL DEFAULT 'generic';

-- ---------------------------------------------------------------------------
-- 2. TABLE: vertical_configs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vertical_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type business_type_enum UNIQUE NOT NULL,
  display_config JSONB NOT NULL DEFAULT '{}',
  custom_fields_schema JSONB NOT NULL DEFAULT '{}',
  default_pipeline_template JSONB NOT NULL DEFAULT '[]',
  default_automations JSONB NOT NULL DEFAULT '{}',
  ai_context JSONB NOT NULL DEFAULT '{}',
  dashboard_widgets JSONB NOT NULL DEFAULT '[]',
  inbox_rules JSONB NOT NULL DEFAULT '{}',
  feature_flags JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vertical_configs ENABLE ROW LEVEL SECURITY;

-- Vertical configs are read-only reference data (not tenant-specific)
CREATE POLICY "vertical_configs_read" ON vertical_configs
  FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- 3. TABLE: custom_field_values (EAV)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL,        -- 'contact', 'deal', 'activity'
  entity_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  field_value JSONB,                -- Supports string, number, boolean, array
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, entity_type, entity_id, field_key)
);

ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfv_tenant_isolation" ON custom_field_values
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_cfv_entity
  ON custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cfv_field
  ON custom_field_values(organization_id, field_key);
CREATE INDEX IF NOT EXISTS idx_cfv_lookup
  ON custom_field_values(organization_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 4. TABLE: vertical_properties (Real Estate vertical)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vertical_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  property_type TEXT NOT NULL,        -- apartamento, casa, comercial, terreno
  transaction_type TEXT NOT NULL,     -- venda, locacao, venda_e_locacao
  address_json JSONB NOT NULL DEFAULT '{}',
  value DECIMAL(12,2),
  area_m2 DECIMAL(8,2),
  bedrooms INT,
  status TEXT NOT NULL DEFAULT 'disponivel',
  owner_contact_id UUID REFERENCES contacts(id),
  assigned_broker_id UUID REFERENCES profiles(id),
  features_json JSONB DEFAULT '[]',
  photos_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vertical_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vp_tenant_isolation" ON vertical_properties
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_vp_org_status
  ON vertical_properties(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_vp_type
  ON vertical_properties(organization_id, property_type, transaction_type);
CREATE INDEX IF NOT EXISTS idx_vp_broker
  ON vertical_properties(assigned_broker_id);
