-- =============================================
-- KNOWLEDGE BASE & RAG SETUP
-- PRD Addendum 2: Knowledge Base, RAG & Catálogo
-- =============================================

-- 1. ENABLE PGVECTOR
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. CREATE knowledge_base_documents
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  source_file_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  word_count INT,
  chunk_count INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view docs" ON public.knowledge_base_documents
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage docs" ON public.knowledge_base_documents
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_kbd_org_cat ON public.knowledge_base_documents(organization_id, category);

-- 3. CREATE knowledge_base_chunks (1536 dims for openai)
CREATE TABLE IF NOT EXISTS public.knowledge_base_chunks (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  chunk_index INT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view chunks" ON public.knowledge_base_chunks
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage chunks" ON public.knowledge_base_chunks
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- HNSW INDEX for Fast Vector Search
CREATE INDEX IF NOT EXISTS idx_kbc_embedding ON public.knowledge_base_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_kbc_org ON public.knowledge_base_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_kbc_doc ON public.knowledge_base_chunks(document_id);

-- 4. MATCH_KNOWLEDGE FUNCTION
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding extensions.vector(1536),
  match_org_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  document_title TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kbc.id,
    kbc.content,
    kbd.title AS document_title,
    kbd.category,
    1 - (kbc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base_chunks kbc
  JOIN public.knowledge_base_documents kbd ON kbd.id = kbc.document_id
  WHERE kbc.organization_id = match_org_id
    AND kbd.is_active = true
    AND 1 - (kbc.embedding <=> query_embedding) > match_threshold
  ORDER BY kbc.embedding <=> query_embedding
  LIMIT match_count;
$$;
