-- =============================================
-- Phase 3: RAG Infrastructure & Media
-- Migration: enable_pgvector_and_knowledge
-- Date: 2026-02-27
-- =============================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Documents Table
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- pgvector embedding column (1536 dimensions for text-embedding-ada-002 or text-embedding-3-small)
  embedding vector(1536),
  
  -- Metadata
  source_type TEXT NOT NULL DEFAULT 'text', -- 'pdf', 'text', 'url'
  source_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_documents_tenant_isolation" ON knowledge_documents
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Create IVFFlat index or HNSW for vector search performance
CREATE INDEX IF NOT EXISTS knowledge_documents_embedding_idx 
ON public.knowledge_documents 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS knowledge_documents_org_idx 
ON public.knowledge_documents(organization_id);

-- Match Documents Function (Similarity Search)
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id,
    kd.title,
    kd.content,
    1 - (kd.embedding <=> query_embedding) AS similarity
  FROM knowledge_documents kd
  WHERE 
    kd.organization_id = p_organization_id
    AND kd.is_active = true
    AND 1 - (kd.embedding <=> query_embedding) > match_threshold
  ORDER BY kd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
