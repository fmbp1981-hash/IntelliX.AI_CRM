# NossoCRM — PRD Addendum 2: Knowledge Base, RAG & Catálogo de Empreendimentos

> **Versão:** 1.0 — 24 de Fevereiro de 2026
> **Status:** Draft — Para Implementação
> **Tipo:** Addendum ao PRD NossoAgent (estende Seções 2, 3, 6 do PRD Principal e Seção 2.2.4 do Addendum 1)
> **Confidencialidade:** Interno — IntelliX.AI

---

## IMPORTANTE: Contexto

Este documento adiciona três capacidades críticas ao NossoAgent:

1. **Knowledge Base Nativa (RAG):** Sistema de treinamento do agente com informações do negócio usando Retrieval-Augmented Generation via Supabase pgvector. O agente responde perguntas sobre a clínica, imobiliária ou empresa com precisão, sem alucinar.

2. **Business Profile Editor:** Interface de configuração onde o usuário fornece todas as informações sobre seu negócio (serviços, preços, horários, equipe, políticas, FAQs) que o agente usa como contexto base.

3. **Catálogo de Empreendimentos (Imobiliárias):** Sistema nativo de cadastro de imóveis com suporte a fotos, fichas técnicas e integração com fontes externas (Google Drive, planilhas, APIs de portais) para atendimento completo.

**Correção incluída:** Lembrete de consulta 1h antes adicionado à jornada do paciente.

---

## 1. Knowledge Base Nativa com RAG

### 1.1 Por Que RAG e Não Apenas Prompt

Um system prompt tem limite de tokens (~4.000 palavras úteis). Para uma clínica com 20 procedimentos, 5 médicos, tabela de convênios, FAQ com 50 perguntas, e políticas de cancelamento, isso não cabe no prompt. O RAG resolve: a IA busca apenas as informações relevantes à pergunta do lead no momento, injeta no contexto, e responde com precisão.

```
LEAD: "Vocês aceitam Unimed? Quanto custa uma consulta?"
         │
         ▼
   ┌─────────────────────────────────────────┐
   │  1. Gera embedding da pergunta          │
   │  2. Busca similares no pgvector         │
   │     → "Convênios aceitos: Unimed,       │
   │        Bradesco Saúde, SulAmérica..."   │
   │     → "Tabela de preços: Consulta       │
   │        particular R$250, retorno R$150" │
   │  3. Injeta no contexto da IA            │
   │  4. IA responde com dados reais         │
   └─────────────────────────────────────────┘
         │
         ▼
AGENTE: "Sim, aceitamos Unimed! Com convênio a consulta 
         não tem custo adicional. Consultas particulares 
         são R$250, com retorno em 30 dias por R$150."
```

### 1.2 Arquitetura Técnica

#### 1.2.1 Habilitar pgvector no Supabase

```sql
-- Migration: enable_pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

#### 1.2.2 Tabela: knowledge_base_documents

Armazena os documentos originais da knowledge base.

```sql
-- Migration: create_knowledge_base
CREATE TABLE knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Identificação
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  -- 'servicos' | 'precos' | 'equipe' | 'politicas' | 'faq' | 'procedimentos' |
  -- 'convenios' | 'localizacao' | 'horarios' | 'empreendimentos' | 'geral'
  
  -- Conteúdo Original
  content TEXT NOT NULL,
  -- Texto completo do documento
  
  -- Fonte
  source_type TEXT NOT NULL DEFAULT 'manual',
  -- 'manual' | 'file_upload' | 'google_drive' | 'url_crawl' | 'spreadsheet'
  source_url TEXT,
  -- URL de origem (se importado)
  source_file_name TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  -- Para fontes externas: quando foi sincronizado pela última vez
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- Tags, idioma, versão, etc.
  word_count INT,
  chunk_count INT,
  -- Quantos chunks foram gerados deste documento
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON knowledge_base_documents
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
CREATE INDEX idx_kbd_org_cat ON knowledge_base_documents(organization_id, category);
```

#### 1.2.3 Tabela: knowledge_base_chunks

Armazena os chunks vetorizados para busca semântica.

```sql
-- Migration: create_knowledge_base_chunks
CREATE TABLE knowledge_base_chunks (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  document_id UUID NOT NULL REFERENCES knowledge_base_documents(id) ON DELETE CASCADE,
  
  -- Conteúdo
  content TEXT NOT NULL,
  -- Chunk de texto (300-500 tokens ideal)
  
  -- Embedding
  embedding extensions.vector(1536) NOT NULL,
  -- Dimensão 1536 = OpenAI text-embedding-3-small
  -- Alternativa: 768 = Gemini text-embedding-004
  
  -- Metadata
  chunk_index INT NOT NULL,
  -- Ordem do chunk dentro do documento
  metadata JSONB DEFAULT '{}',
  -- Categoria herdada do documento, tags adicionais
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON knowledge_base_chunks
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Índice HNSW para busca vetorial rápida
CREATE INDEX idx_kbc_embedding ON knowledge_base_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_kbc_org ON knowledge_base_chunks(organization_id);
CREATE INDEX idx_kbc_doc ON knowledge_base_chunks(document_id);
```

#### 1.2.4 Função: match_knowledge

Função SQL para busca de similaridade usada pelo agente.

```sql
-- Migration: create_match_knowledge_function
CREATE OR REPLACE FUNCTION match_knowledge(
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
  FROM knowledge_base_chunks kbc
  JOIN knowledge_base_documents kbd ON kbd.id = kbc.document_id
  WHERE kbc.organization_id = match_org_id
    AND kbd.is_active = true
    AND 1 - (kbc.embedding <=> query_embedding) > match_threshold
  ORDER BY kbc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 1.3 Pipeline de Ingestão

Quando o usuário adiciona ou atualiza conteúdo na Knowledge Base:

```
CONTEÚDO ORIGINAL (texto, arquivo, URL)
         │
         ▼
   ┌─────────────────────────────────┐
   │ 1. Salvar em knowledge_base_    │
   │    documents (conteúdo bruto)   │
   │                                 │
   │ 2. Chunking: dividir em trechos │
   │    de 300-500 tokens com        │
   │    overlap de 50 tokens         │
   │                                 │
   │ 3. Para cada chunk:             │
   │    a. Gerar embedding via       │
   │       OpenAI text-embedding-    │
   │       3-small (ou Gemini)       │
   │    b. Salvar em knowledge_base_ │
   │       chunks com vetor          │
   │                                 │
   │ 4. Atualizar contadores no      │
   │    documento (word_count,       │
   │    chunk_count)                 │
   └─────────────────────────────────┘
```

```typescript
// lib/ai/knowledge-ingestion.ts
import { openai } from '@ai-sdk/openai';

const CHUNK_SIZE = 400; // tokens
const CHUNK_OVERLAP = 50; // tokens

export async function ingestDocument(
  supabase: any,
  organizationId: string,
  documentId: string,
  content: string
) {
  // 1. Chunking
  const chunks = splitIntoChunks(content, CHUNK_SIZE, CHUNK_OVERLAP);

  // 2. Gerar embeddings em batch
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks,
  });

  // 3. Deletar chunks antigos (se re-ingestão)
  await supabase
    .from('knowledge_base_chunks')
    .delete()
    .eq('document_id', documentId);

  // 4. Inserir novos chunks com embeddings
  const rows = chunks.map((chunk, index) => ({
    organization_id: organizationId,
    document_id: documentId,
    content: chunk,
    embedding: response.data[index].embedding,
    chunk_index: index,
  }));

  await supabase.from('knowledge_base_chunks').insert(rows);

  // 5. Atualizar contadores
  await supabase
    .from('knowledge_base_documents')
    .update({
      word_count: content.split(/\s+/).length,
      chunk_count: chunks.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);
}
```

### 1.4 Integração com o Agent Engine

O NossoAgent Engine (PRD principal, Seção 3) é estendido para consultar a Knowledge Base antes de responder:

```typescript
// Extensão do fluxo do agent-engine (Seção 3.2 do PRD principal)
// Inserir entre o passo 5 (COMPOSIÇÃO DE CONTEXTO) e passo 6 (CHAMADA AO MODELO)

// 5.5 BUSCA NA KNOWLEDGE BASE (RAG)
const queryEmbedding = await generateEmbedding(message_content);

const { data: knowledgeResults } = await supabase.rpc('match_knowledge', {
  query_embedding: queryEmbedding,
  match_org_id: organization_id,
  match_threshold: 0.7,
  match_count: 5,
});

// Compor contexto de knowledge
const knowledgeContext = knowledgeResults?.length
  ? `\n\n--- INFORMAÇÕES DA EMPRESA (use para responder com precisão) ---\n${
      knowledgeResults
        .map((r: any) => `[${r.category}] ${r.content}`)
        .join('\n\n')
    }\n--- FIM DAS INFORMAÇÕES ---`
  : '';

// O knowledgeContext é adicionado ao entity_context antes de enviar ao modelo
```

### 1.5 Novo Tool: search_knowledge

```typescript
search_knowledge: tool({
  description: 'Busca informações na base de conhecimento da empresa. Use quando o lead perguntar sobre serviços, preços, equipe, horários, convênios, procedimentos, imóveis ou qualquer informação do negócio.',
  parameters: z.object({
    query: z.string().describe('Pergunta ou termos de busca'),
    category: z.string().optional().describe('Filtro por categoria: servicos, precos, equipe, faq, etc.'),
  }),
  execute: async (params, { organizationId }) => {
    const embedding = await generateEmbedding(params.query);
    const { data } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_org_id: organizationId,
      match_threshold: 0.65,
      match_count: 5,
    });
    return data;
  },
}),
```

---

## 2. Business Profile Editor

### 2.1 Visão Geral

O Business Profile Editor é a interface onde o usuário configura tudo que o agente precisa saber sobre o negócio. É dividido em duas camadas:

1. **Business Profile (prompt direto):** Informações essenciais que vão diretamente no system prompt (~500 tokens). Dados que o agente precisa em TODA conversa.
2. **Knowledge Base (RAG):** Informações detalhadas buscadas sob demanda via busca semântica. Dados que o agente precisa apenas quando perguntado.

### 2.2 Modelo de Dados

#### Extensão da tabela agent_configs

```sql
-- Migration: extend_agent_configs_business_profile
ALTER TABLE agent_configs ADD COLUMN business_profile JSONB NOT NULL DEFAULT '{}';
-- Estrutura:
-- {
--   "company_name": "Clínica Sorriso",
--   "company_description": "Clínica odontológica especializada em implantes e estética dental",
--   "address": "Rua das Flores, 123 - Centro - São Paulo/SP",
--   "phone": "+5511999999999",
--   "email": "contato@clinicasorriso.com.br",
--   "website": "https://clinicasorriso.com.br",
--   "business_hours_description": "Segunda a sexta das 8h às 18h, sábados das 9h às 13h",
--   "team_members": [
--     { "name": "Dr. João Silva", "role": "Implantodontista", "crm": "CRO-SP 12345" },
--     { "name": "Dra. Maria Santos", "role": "Ortodontista", "crm": "CRO-SP 67890" }
--   ],
--   "main_services": ["Implantes", "Ortodontia", "Clareamento", "Prótese"],
--   "payment_methods": ["Cartão", "PIX", "Boleto", "Parcelamento 12x"],
--   "insurance_accepted": ["Unimed", "Bradesco Saúde", "Amil"],
--   "differentials": ["20 anos de experiência", "Tecnologia 3D", "Sala VIP"],
--   "cancellation_policy": "Cancelamentos com menos de 24h de antecedência estão sujeitos a taxa.",
--   "tone_instructions": "Tom acolhedor e profissional. Use português informal mas respeitoso. Nunca seja comercial agressivo.",
--   "forbidden_topics": ["Não fale sobre procedimentos que não oferecemos", "Não dê diagnósticos"]
-- }
```

### 2.3 System Prompt Gerado a Partir do Business Profile

O Business Profile é automaticamente convertido em system prompt:

```typescript
// lib/ai/business-profile-prompt.ts
export function buildBusinessProfilePrompt(profile: BusinessProfile): string {
  return `
## SOBRE A EMPRESA
Você representa a ${profile.company_name}. ${profile.company_description}.
Endereço: ${profile.address}
Horário: ${profile.business_hours_description}
Contato: ${profile.phone} | ${profile.email}${profile.website ? ` | ${profile.website}` : ''}

## EQUIPE
${profile.team_members?.map(m => `- ${m.name}: ${m.role}${m.crm ? ` (${m.crm})` : ''}`).join('\n') || 'Não especificada'}

## SERVIÇOS PRINCIPAIS
${profile.main_services?.join(', ') || 'Não especificados'}

## FORMAS DE PAGAMENTO
${profile.payment_methods?.join(', ') || 'Não especificadas'}

## CONVÊNIOS / PLANOS ACEITOS
${profile.insurance_accepted?.join(', ') || 'Nenhum especificado'}

## DIFERENCIAIS
${profile.differentials?.join('. ') || 'Não especificados'}

## POLÍTICA DE CANCELAMENTO
${profile.cancellation_policy || 'Não especificada'}

## TOM E ESTILO
${profile.tone_instructions || 'Profissional e acolhedor.'}

## RESTRIÇÕES
${profile.forbidden_topics?.map(t => `- ${t}`).join('\n') || 'Nenhuma restrição específica'}

## REGRA IMPORTANTE
Quando perguntado sobre informações que NÃO estão no seu conhecimento, use a ferramenta search_knowledge para buscar na base de dados da empresa. NUNCA invente preços, procedimentos ou informações que não foram fornecidos.
`.trim();
}
```

### 2.4 Composição Final do Prompt do Agente

A hierarquia completa do prompt do NossoAgent agora é:

```
NÍVEL 1: AGENT_SYSTEM_PROMPT_BASE (~200 tokens)
  Identidade, regras de ouro, formato
         +
NÍVEL 2: VERTICAL_CONTEXT (~300 tokens)
  ai_context.system_prompt_vertical da vertical_configs
         +
NÍVEL 3: BUSINESS_PROFILE (~500 tokens)
  Gerado a partir de agent_configs.business_profile
         +
NÍVEL 4: AGENT_VERTICAL_PROMPT (~200 tokens)
  Comportamento específico do agente por vertical
         +
NÍVEL 5: KNOWLEDGE_CONTEXT (dinâmico, ~300-500 tokens)
  Resultados do RAG relevantes à pergunta atual
         +
NÍVEL 6: CONVERSATION_HISTORY (últimas N mensagens)
         +
NÍVEL 7: ENTITY_CONTEXT (dados do contato/deal vinculado)
         +
NÍVEL 8: USER_MESSAGE (mensagem do lead)
```

### 2.5 Interface do Business Profile Editor

Nova seção na página `/configuracoes/agente`:

#### Tab "Perfil do Negócio"

**Seção 1 — Informações Básicas**
- Nome da empresa (text)
- Descrição curta (textarea, max 300 chars)
- Endereço completo (text)
- Telefone principal (text)
- Email de contato (text)
- Website (text)
- Descrição de horário de funcionamento (text)

**Seção 2 — Equipe** (lista dinâmica add/remove)
- Nome do profissional
- Cargo / Especialidade
- Registro profissional (CRM, CRO, CRECI) — opcional
- Dias de atendimento — opcional

**Seção 3 — Serviços / Produtos** (lista dinâmica)
- Nome do serviço
- Descrição curta — opcional
- Faixa de preço — opcional

**Seção 4 — Pagamento e Convênios**
- Formas de pagamento (multi-select + custom)
- Convênios / Planos aceitos (lista dinâmica)

**Seção 5 — Diferenciais** (lista dinâmica)
- Texto livre por diferencial

**Seção 6 — Políticas**
- Política de cancelamento (textarea)
- Política de privacidade / LGPD (textarea)
- Outras políticas (textarea)

**Seção 7 — Comportamento do Agente**
- Tom e estilo (textarea com dicas: "ex: acolhedor, formal, descontraído")
- Tópicos proibidos (lista dinâmica: "ex: não dê diagnósticos por WhatsApp")
- Palavras-chave de transferência imediata (lista: "ex: reclamação, advogado, processo")

#### Tab "Base de Conhecimento"

**Seção 1 — Documentos** (lista com cards)

Cada documento exibe: título, categoria, fonte, data de atualização, quantidade de chunks, toggle ativo/inativo.

**Ações:**
- **Adicionar Manualmente:** Título + categoria + textarea com conteúdo
- **Upload de Arquivo:** Arraste PDF, DOCX, TXT, CSV → Extrai texto → Ingesta automaticamente
- **Importar de URL:** Cola URL → Crawl da página → Extrai texto → Ingesta
- **Importar do Google Drive:** Conecta Google Drive → Seleciona arquivo/pasta → Sincroniza
- **Importar de Planilha:** Upload de XLSX/CSV → Cada linha vira um chunk categorizado

**Seção 2 — Categorias Sugeridas por Vertical**

| Vertical | Categorias Sugeridas |
|---|---|
| **Médica** | Procedimentos, Convênios e Tabela de Preços, Equipe Médica, Preparação para Exames, Pós-Operatório, FAQ Pacientes, Políticas |
| **Odonto** | Tratamentos, Tabela de Preços e Parcelamento, Equipe, Cuidados Pós-Procedimento, FAQ Pacientes, Materiais Utilizados |
| **Imobiliária** | Empreendimentos, Bairros e Regiões, Processo de Compra, Financiamento, Documentação Necessária, FAQ Compradores/Locatários |
| **Genérico** | Produtos/Serviços, Preços, Equipe, FAQ, Políticas |

**Seção 3 — Teste do Agente**

Campo de teste inline: "Pergunte algo ao agente para testar se ele responde corretamente."
Mostra: resposta gerada + chunks recuperados do RAG + score de similaridade.

---

## 3. Catálogo de Empreendimentos (Imobiliárias)

### 3.1 Análise da Melhor Abordagem

Após análise de 3 alternativas, a recomendação é uma **abordagem híbrida**: cadastro nativo no CRM (fonte primária) + integração com Google Drive/planilhas (fonte complementar para fotos e fichas técnicas em massa).

| Abordagem | Vantagens | Desvantagens | Veredicto |
|---|---|---|---|
| **100% Nativo** | Controle total, RLS, busca rápida, sem dependências | Usuário precisa cadastrar tudo manualmente | Bom para dados estruturados |
| **100% Externo (Drive/API)** | Usuário mantém dados onde já usa | Latência, dependência, sync complexo | Frágil demais |
| **Híbrido (recomendado)** | Dados estruturados nativos + import de Drive/planilhas + sync | Melhor dos dois mundos | **ESCOLHIDO** |

**Justificativa:** Imobiliárias já possuem fichas de imóveis em planilhas Excel, pastas no Google Drive com fotos, e às vezes portais como ZAP/VivaReal. O sistema nativo armazena a verdade (dados estruturados, busca vetorial), mas o import facilita a migração e atualização em massa.

### 3.2 Extensão da Tabela vertical_properties

A tabela `vertical_properties` do PRD de Verticalização é estendida para suportar fichas técnicas completas:

```sql
-- Migration: extend_vertical_properties_catalog
ALTER TABLE vertical_properties
  ADD COLUMN description TEXT,
  -- Descrição comercial do imóvel (gerada por IA ou manual)
  ADD COLUMN technical_sheet JSONB DEFAULT '{}',
  -- Ficha técnica completa:
  -- {
  --   "tipo_piso": "Porcelanato",
  --   "aquecimento": "Solar",
  --   "ar_condicionado": true,
  --   "mobiliado": "Semi-mobiliado",
  --   "andar": 12,
  --   "face": "Norte",
  --   "condominio_valor": 850.00,
  --   "iptu_anual": 3200.00,
  --   "ano_construcao": 2019,
  --   "construtora": "MRV",
  --   "nome_empreendimento": "Residencial Jardins",
  --   "vagas_garagem": 2,
  --   "suites": 1,
  --   "banheiros": 2,
  --   "aceita_pets": true,
  --   "portaria_24h": true,
  --   "lazer": ["piscina", "academia", "salão de festas", "playground"]
  -- }
  ADD COLUMN neighborhood_data JSONB DEFAULT '{}',
  -- Dados do bairro:
  -- {
  --   "bairro": "Vila Mariana",
  --   "cidade": "São Paulo",
  --   "escolas": [{ "nome": "Colégio X", "distancia_m": 500, "tipo": "particular" }],
  --   "supermercados": [{ "nome": "Pão de Açúcar", "distancia_m": 200 }],
  --   "transporte": [{ "tipo": "metrô", "nome": "Estação Vila Mariana", "distancia_m": 300 }],
  --   "hospitais": [{ "nome": "Hospital São Paulo", "distancia_m": 1500 }],
  --   "score_seguranca": 8,
  --   "score_infraestrutura": 9
  -- }
  ADD COLUMN virtual_tour_url TEXT,
  -- Link para tour virtual (Matterport, etc.)
  ADD COLUMN video_url TEXT,
  -- Link para vídeo do imóvel
  ADD COLUMN floor_plan_urls JSONB DEFAULT '[]',
  -- URLs das plantas do imóvel
  ADD COLUMN documents_urls JSONB DEFAULT '[]',
  -- URLs de documentos (matrícula, IPTU, etc.)
  ADD COLUMN source TEXT DEFAULT 'manual',
  -- 'manual' | 'spreadsheet_import' | 'google_drive' | 'portal_api'
  ADD COLUMN external_id TEXT,
  -- ID externo (se importado de portal)
  ADD COLUMN last_synced_at TIMESTAMPTZ;
```

### 3.3 Vetorização de Imóveis para RAG

Cada imóvel cadastrado gera automaticamente chunks vetorizados na Knowledge Base para que o agente possa buscá-los semanticamente:

```typescript
// lib/ai/property-indexer.ts
export async function indexProperty(
  supabase: any,
  organizationId: string,
  property: VerticalProperty
) {
  // 1. Gerar texto descritivo do imóvel
  const propertyText = buildPropertyDescription(property);

  // 2. Criar ou atualizar documento na Knowledge Base
  const { data: doc } = await supabase
    .from('knowledge_base_documents')
    .upsert({
      organization_id: organizationId,
      title: `Imóvel: ${property.property_type} em ${property.address_json.bairro}`,
      category: 'empreendimentos',
      content: propertyText,
      source_type: 'auto_generated',
      metadata: { property_id: property.id },
    }, { onConflict: 'organization_id,metadata->>property_id' })
    .select()
    .single();

  // 3. Ingestar (chunking + embedding)
  await ingestDocument(supabase, organizationId, doc.id, propertyText);
}

function buildPropertyDescription(p: VerticalProperty): string {
  const ts = p.technical_sheet || {};
  const addr = p.address_json || {};
  const nb = p.neighborhood_data || {};

  return `
IMÓVEL: ${p.property_type} para ${p.transaction_type} em ${addr.bairro}, ${addr.cidade}
Endereço: ${addr.rua}, ${addr.numero} - ${addr.bairro}, ${addr.cidade}/${addr.estado}
Valor: R$ ${p.value?.toLocaleString('pt-BR')}
Área: ${p.area_m2}m²
Quartos: ${p.bedrooms} ${ts.suites ? `(${ts.suites} suíte${ts.suites > 1 ? 's' : ''})` : ''}
Banheiros: ${ts.banheiros || 'N/I'}
Vagas: ${ts.vagas_garagem || 'N/I'}
${ts.nome_empreendimento ? `Empreendimento: ${ts.nome_empreendimento}` : ''}
${ts.construtora ? `Construtora: ${ts.construtora}` : ''}
${ts.ano_construcao ? `Ano: ${ts.ano_construcao}` : ''}
Condomínio: ${ts.condominio_valor ? `R$ ${ts.condominio_valor}/mês` : 'N/I'}
IPTU: ${ts.iptu_anual ? `R$ ${ts.iptu_anual}/ano` : 'N/I'}

Características: ${(p.features_json || []).join(', ')}
${ts.lazer?.length ? `Lazer: ${ts.lazer.join(', ')}` : ''}
${ts.aceita_pets !== undefined ? `Aceita pets: ${ts.aceita_pets ? 'Sim' : 'Não'}` : ''}
${ts.portaria_24h ? 'Portaria 24h' : ''}
${ts.mobiliado ? `Mobiliado: ${ts.mobiliado}` : ''}

${p.description || ''}

${nb.bairro ? `BAIRRO: ${nb.bairro}` : ''}
${nb.escolas?.length ? `Escolas próximas: ${nb.escolas.map((e: any) => `${e.nome} (${e.distancia_m}m)`).join(', ')}` : ''}
${nb.supermercados?.length ? `Supermercados: ${nb.supermercados.map((s: any) => `${s.nome} (${s.distancia_m}m)`).join(', ')}` : ''}
${nb.transporte?.length ? `Transporte: ${nb.transporte.map((t: any) => `${t.tipo} ${t.nome} (${t.distancia_m}m)`).join(', ')}` : ''}

Status: ${p.status}
Corretor: ${p.assigned_broker_id || 'Não atribuído'}
Fotos: ${(p.photos_urls || []).length} foto(s)
${p.virtual_tour_url ? `Tour virtual: ${p.virtual_tour_url}` : ''}
  `.trim();
}
```

### 3.4 Importação de Fontes Externas

#### 3.4.1 Import de Planilha (XLSX/CSV)

O usuário faz upload de planilha com imóveis. O sistema mapeia colunas e importa:

```
┌──────────────────────────────────────────┐
│  IMPORT DE PLANILHA                      │
│                                          │
│  1. Upload do arquivo (.xlsx ou .csv)    │
│  2. Preview das primeiras 5 linhas       │
│  3. Mapeamento de colunas:               │
│     Coluna A "Tipo"    → property_type   │
│     Coluna B "Endereço"→ address_json    │
│     Coluna C "Valor"   → value           │
│     Coluna D "Área"    → area_m2         │
│     Coluna E "Quartos" → bedrooms        │
│     ...                                  │
│  4. Validação + preview                  │
│  5. Import (cria registros em            │
│     vertical_properties + indexa RAG)    │
└──────────────────────────────────────────┘
```

#### 3.4.2 Integração Google Drive

O usuário conecta uma pasta do Google Drive com fichas/fotos de imóveis:

```
┌──────────────────────────────────────────┐
│  INTEGRAÇÃO GOOGLE DRIVE                 │
│                                          │
│  1. Conectar Google Drive (OAuth2)       │
│  2. Selecionar pasta de imóveis          │
│  3. Sistema detecta estrutura:           │
│     📁 Imóveis/                          │
│       📁 Apt Vila Mariana/               │
│         📄 ficha_tecnica.pdf             │
│         🖼️ foto_sala.jpg                │
│         🖼️ foto_quarto.jpg              │
│         📄 planta.pdf                    │
│       📁 Casa Morumbi/                   │
│         📄 ficha_tecnica.pdf             │
│         🖼️ foto_fachada.jpg             │
│  4. Para cada subpasta:                  │
│     - Extrai texto dos PDFs/Docs         │
│     - URLs das fotos → photos_urls       │
│     - Indexa no RAG automaticamente      │
│  5. Sync periódico (pg_cron diário)      │
│     para detectar novos arquivos         │
└──────────────────────────────────────────┘
```

Implementação via Google Drive API (já disponível no projeto como MCP connector):

```typescript
// Edge Function: agent-drive-sync
// Chamado por pg_cron ou manualmente pelo usuário

// 1. Listar arquivos na pasta configurada
// 2. Para cada arquivo novo/modificado:
//    a. Se PDF/DOCX: extrair texto → knowledge_base_documents
//    b. Se imagem: armazenar URL → vertical_properties.photos_urls
//    c. Se planilha: processar como import de planilha
// 3. Re-indexar no RAG
// 4. Atualizar last_synced_at
```

#### 3.4.3 Configuração na UI

Nova seção em `/configuracoes/agente` → Tab "Catálogo de Imóveis" (visível apenas para business_type = 'real_estate'):

**Seção 1 — Cadastro Manual**
- Formulário completo de imóvel com todos os campos da vertical_properties estendida
- Upload de fotos (Supabase Storage)
- Geração automática de descrição comercial via IA ("Gerar descrição" button)

**Seção 2 — Import em Massa**
- Upload de planilha com mapeamento de colunas
- Preview + validação antes de importar

**Seção 3 — Google Drive Sync**
- Conectar conta Google Drive
- Selecionar pasta raiz dos imóveis
- Toggle: sync automático (diário) ou manual
- Status da última sincronização

**Seção 4 — Informações de Bairros**
- Editor de dados de bairros (escolas, transporte, supermercados, etc.)
- Pode ser preenchido manualmente ou importado de planilha
- Usado automaticamente nas mensagens pré-visita e no match

---

## 4. Correção: Lembrete 1h Antes da Consulta

Atualização na tabela `appointment_reminders` e na jornada do paciente (Addendum 1, Seção 2.2.4):

### 4.1 Novo reminders_config padrão

```sql
-- O DEFAULT do campo reminders_config passa a incluir lembrete de 1h:
-- Atualizar migration create_appointment_reminders

ALTER TABLE appointment_reminders
  ALTER COLUMN reminders_config SET DEFAULT '[
    { "type": "7d", "days_before": 7, "sent": false, "sent_at": null },
    { "type": "2d", "days_before": 2, "sent": false, "sent_at": null },
    { "type": "1d", "days_before": 1, "sent": false, "sent_at": null },
    { "type": "1h", "days_before": 0, "hours_before": 1, "sent": false, "sent_at": null },
    { "type": "day", "days_before": 0, "hours_before": 3, "sent": false, "sent_at": null }
  ]';
```

### 4.2 Cadência Atualizada de Lembretes

| Momento | Mensagem | Objetivo |
|---|---|---|
| **7 dias antes** | Instruções de preparo + confirmação | Antecedência para providenciar exames |
| **2 dias antes** | "Sua consulta é em 2 dias! Exames prontos?" | Verificação de preparo |
| **1 dia antes** | "Amanhã! Consulta às [hora] com Dr. [nome]. Lembrete: jejum de 8h." | Confirmação final |
| **3 horas antes** | "Sua consulta é HOJE às [hora]! Estamos esperando você!" | Check-in do dia |
| **1 hora antes** | "Falta 1 hora! Está a caminho? Endereço: [local]. Se precisar de ajuda para chegar, me avise!" | Última confirmação + suporte logístico |

O lembrete de 1 hora é particularmente importante porque:
- É o último momento para detectar possível no-show e tentar encaixar outro paciente
- Pode fornecer orientações de última hora (estacionamento, andar, sala)
- O paciente pode reportar atraso e a clínica se organizar

---

## 5. Migrations Adicionais

| # | Migration | Descrição |
|---|---|---|
| 13 | `enable_pgvector` | Habilitar extensão pgvector no Supabase |
| 14 | `create_knowledge_base_documents` | Tabela de documentos + RLS + índices |
| 15 | `create_knowledge_base_chunks` | Tabela de chunks vetorizados + RLS + índice HNSW |
| 16 | `create_match_knowledge_function` | Função SQL de busca por similaridade |
| 17 | `extend_agent_configs_business_profile` | Adicionar campo business_profile ao agent_configs |
| 18 | `extend_vertical_properties_catalog` | Estender vertical_properties com ficha técnica, bairro, fotos, etc. |
| 19 | `update_appointment_reminders_1h` | Atualizar DEFAULT do reminders_config para incluir lembrete de 1h |

*Numeração continua de onde o Addendum 1 parou (12 migrations).*

---

## 6. Edge Functions Adicionais

| Função | Path | JWT | Descrição |
|---|---|---|---|
| `agent-knowledge-ingest` | `functions/agent-knowledge-ingest/` | true | Processa documento: chunking + embedding + storage |
| `agent-knowledge-file-parser` | `functions/agent-knowledge-file-parser/` | true | Extrai texto de PDF, DOCX, TXT uploads |
| `agent-drive-sync` | `functions/agent-drive-sync/` | true | Sincroniza pasta do Google Drive com catálogo de imóveis |
| `agent-property-indexer` | `functions/agent-property-indexer/` | true | Gera descrição + indexa imóvel no RAG ao criar/atualizar |
| `agent-spreadsheet-import` | `functions/agent-spreadsheet-import/` | true | Processa planilha de imóveis: mapeamento + import + indexação |

---

## 7. Plano de Implementação — Fases Adicionais

| Fase | Escopo | Duração Est. | Dependências |
|---|---|---|---|
| **H — pgvector + Knowledge Base** | Habilitar pgvector, tabelas knowledge_base, função match_knowledge, pipeline de ingestão, integração com agent-engine | 1.5 semanas | PRD Principal Fases 1-3 |
| **I — Business Profile Editor** | Campo business_profile no agent_configs, UI completa do editor, geração automática de system prompt | 1 semana | Fase H |
| **J — Knowledge Base UI** | Interface de gerenciamento: adicionar manual, upload arquivo, import URL, teste do agente, categorias | 1.5 semanas | Fase H |
| **K — Catálogo de Imóveis** | Extensão vertical_properties, indexação RAG automática, cadastro manual com fotos, import planilha | 1.5 semanas | Fases H, J |
| **L — Google Drive Sync** | OAuth2 Drive, parser de pasta, sync automático, pg_cron | 1 semana | Fases H, K |
| **M — Polish + QA** | Testes de qualidade RAG, tuning de threshold, edge cases, performance, documentação | 1 semana | Todas |

**Estimativa total das fases adicionais:** ~7.5 semanas (~2 meses)

**Estimativa total geral (todos os PRDs do NossoAgent):**
- PRD Principal: ~11.5 semanas
- Addendum 1 (Follow-ups): ~9.5 semanas (parcialmente paralelo)
- Addendum 2 (Knowledge Base): ~7.5 semanas (parcialmente paralelo)
- **Com paralelismo: ~16-20 semanas (~4-5 meses)** para entrega completa de todas as funcionalidades.

---

## 8. Métricas de Sucesso Adicionais

| Métrica | Meta | Como Medir |
|---|---|---|
| Taxa de respostas com RAG | > 40% | Respostas que usaram search_knowledge / total respostas |
| Precisão do RAG | > 90% | Amostra manual: respostas corretas com base no conhecimento / total |
| Taxa de "não sei" | < 10% | Respostas onde agente não encontrou informação / total perguntas sobre negócio |
| Documentos na Knowledge Base | > 10 por org | Média de documentos ativos por organização |
| Imóveis indexados (imobiliárias) | > 80% | Imóveis com indexação RAG / total imóveis cadastrados |
| Tempo de ingestão | < 30s | Tempo entre upload de documento e disponibilidade no RAG |

---

## 9. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| RAG retorna informação desatualizada | Alta | Timestamp de atualização visível no dashboard. Alerta quando documento > 90 dias sem atualização. Re-sync automático de fontes externas. |
| Custo de embeddings alto em volume | Média | text-embedding-3-small é 5x mais barato que ada-002. Batch processing. Cache de embeddings (documento não muda = não re-gera). |
| Knowledge base vazia → agente alucina | Alta | Detecção de knowledge base vazia no onboarding. Wizard de preenchimento guiado. Se RAG retorna 0 resultados com score > threshold: agente diz "Vou verificar essa informação e retorno." + gera action item. |
| Import de planilha com dados sujos | Média | Validação rigorosa: campos obrigatórios, formatos, duplicatas. Preview antes de confirmar. Rollback em caso de erro. |
| Google Drive sync quebra | Baixa | Retry automático. Alerta no dashboard se sync falhar 3x. Dados nativos são a fonte primária (Drive é complementar). |
| Fotos de imóveis pesadas | Baixa | Compressão automática no upload. Thumbnails gerados. Supabase Storage com CDN. Limite de 20 fotos por imóvel. |

---

*NossoCRM — PRD Addendum 2: Knowledge Base, RAG & Catálogo de Empreendimentos v1.0*
*IntelliX.AI — Documento gerado em 24 de Fevereiro de 2026*
