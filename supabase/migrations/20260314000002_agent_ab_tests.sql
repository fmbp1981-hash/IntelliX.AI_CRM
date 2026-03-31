-- ── Migration: Agent A/B Tests (Aprender Mode) ─────────────────────
-- Phase 6: Learn mode A/B testing infrastructure

CREATE TABLE IF NOT EXISTS agent_ab_tests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  board_id            uuid,
  name                text NOT NULL,
  description         text,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'running', 'paused', 'completed')),

  -- Variants (exactly 2)
  variant_a_methodology   text NOT NULL,   -- e.g. 'spin'
  variant_a_label         text NOT NULL DEFAULT 'Variante A',
  variant_b_methodology   text NOT NULL,   -- e.g. 'bant'
  variant_b_label         text NOT NULL DEFAULT 'Variante B',

  -- Traffic split (0..100, A gets this %, B gets 100-%)
  traffic_split_a     int NOT NULL DEFAULT 50 CHECK (traffic_split_a BETWEEN 1 AND 99),

  -- Results (updated by agent-engine)
  variant_a_conversations int DEFAULT 0,
  variant_b_conversations int DEFAULT 0,
  variant_a_conversions   int DEFAULT 0,
  variant_b_conversions   int DEFAULT 0,
  variant_a_avg_msgs      int DEFAULT 0,
  variant_b_avg_msgs      int DEFAULT 0,

  -- Winner declared automatically when confidence reached
  winner              text CHECK (winner IN ('a', 'b', 'tie')),
  confidence_pct      numeric(5,2),

  started_at          timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_ab_tests_org_idx
  ON agent_ab_tests(organization_id, status);

ALTER TABLE agent_ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage their AB tests"
  ON agent_ab_tests USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_ab_tests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ab_tests_updated_at
  BEFORE UPDATE ON agent_ab_tests
  FOR EACH ROW EXECUTE FUNCTION update_ab_tests_updated_at();
