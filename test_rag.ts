import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function runRAGTest() {
    console.log('🔄 Iniciando teste isolado de RAG (Knowledge Base)...\n');

    try {
        // 1. Pegar uma organization_id válida (qualquer uma existente)
        const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .limit(1)
            .single();

        if (orgError || !orgData) {
            console.error('❌ Nenhuma organização encontrada no banco para testes.');
            process.exit(1);
        }
        const orgId = orgData.id;
        console.log(`✅ Usando Organização: ${orgId}`);

        // 2. Ingerir um documento falso de teste
        const faqs = [
            "A clínica odontológica DenteFeliz funciona apenas em dias úteis, das 08h às 18h.",
            "Não fazemos clareamento dental em menores de 18 anos.",
            "Aceitamos os convênios Unimed, SulAmérica e Bradesco Saúde."
        ];

        console.log('📝 Gerando embeddings para os chunks de teste via OpenAI...');

        // Create Document
        const { data: doc, error: docError } = await supabase
            .from('knowledge_base_documents')
            .insert({
                organization_id: orgId,
                title: 'Manual Clínico DenteFeliz (TESTE)',
                category: 'faq',
                content: faqs.join(' '),
                word_count: 24,
                chunk_count: 3
            })
            .select('id')
            .single();

        if (docError) throw docError;

        // Generate and Insert Chunks
        for (let i = 0; i < faqs.length; i++) {
            const text = faqs[i];
            const { embedding } = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: text,
            });

            const { error: chunkError } = await supabase
                .from('knowledge_base_chunks')
                .insert({
                    organization_id: orgId,
                    document_id: doc.id,
                    content: text,
                    embedding: `[${embedding.join(',')}]`,
                    chunk_index: i,
                });

            if (chunkError) throw chunkError;
        }

        console.log('✅ Base de teste populada com 3 chunks.');

        // 3. Testar a Busca (Cosine Similarity)
        const question = 'Quais planos de saúde vocês aceitam na clínica?';
        console.log(`\n🔍 Pergunta teste: "${question}"`);
        console.log('🧠 Gerando embedding da pergunta...');

        const { embedding: queryEmbedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: question,
        });

        console.log('🔍 Executando RPC match_knowledge no Supabase...');
        const { data: matchData, error: matchError } = await supabase.rpc('match_knowledge', {
            query_embedding: `[${queryEmbedding.join(',')}]`,
            match_org_id: orgId,
            match_threshold: 0.5,
            match_count: 2
        });

        if (matchError) throw matchError;

        console.log(`✅ A busca retornou ${matchData?.length || 0} resultado(s):\n`);

        if (matchData && matchData.length > 0) {
            matchData.forEach((res: any, idx: number) => {
                console.log(`[Resultado ${idx + 1}] (Similaridade: ${res.similarity.toFixed(4)})`);
                console.log(`Documento: ${res.document_title}`);
                console.log(`Trecho: ${res.content}\n`);
            });
        } else {
            console.log('Nenhum dado encontrado =/ Algo deu errado com a similaridade.');
        }

        // 4. Limpeza (Omitir se quiser manter no DB para testar a UI)
        console.log('🧹 Limpando dados de teste do banco...');
        await supabase.from('knowledge_base_documents').delete().eq('id', doc.id);
        console.log('✅ Base limpa.');

    } catch (err: any) {
        console.error('❌ ERRO NO TESTE DE RAG:', err.message || err);
    }
}

runRAGTest();
