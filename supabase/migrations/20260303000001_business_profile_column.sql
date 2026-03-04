-- =============================================
-- Business Profile Column for Agent Configs
-- Adds structured business information that informs the agent's system prompt
-- =============================================

ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS business_profile JSONB NOT NULL DEFAULT '{}';

-- Structure of business_profile:
-- {
--   "company_name": "string",
--   "niche": "string",
--   "description": "string",
--   "address": "string",
--   "phone": "string",
--   "email": "string",
--   "website": "string",
--   "team": [{ "name": "string", "role": "string", "specialties": ["string"] }],
--   "services": [{ "name": "string", "description": "string", "price": "string", "duration": "string" }],
--   "payment_methods": ["string"],
--   "differentials": ["string"],
--   "policies": { "cancellation": "string", "refund": "string", "warranty": "string" },
--   "faq": [{ "question": "string", "answer": "string" }],
--   "custom_instructions": "string"
-- }

COMMENT ON COLUMN public.agent_configs.business_profile IS 'Structured business profile that is injected into the agent system prompt for contextualized responses';
