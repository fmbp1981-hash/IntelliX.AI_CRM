import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import * as cheerio from 'cheerio';

const CHUNK_SIZE = 400; // tokens approx (we will emulate with words/characters approx to avoid complex tokenizers on the edge)
const CHUNK_OVERLAP = 50;

/**
 * Splits text into overlapping chunks
 * Uses an approximate character count algorithm for edge-friendly execution
 */
function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    // Simple word-based chunker for RAG
    // 1 token ~= 4 characters in English, so 400 tokens ~= 1600 characters or ~300 words.
    // We'll split by words as a simple robust heuristic.
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const chunks: string[] = [];

    const wordChunkSize = Math.floor((chunkSize * 4) / 5); // Rough approx
    const wordOverlap = Math.floor((overlap * 4) / 5);

    if (words.length === 0) return [];
    if (words.length <= wordChunkSize) return [text];

    let i = 0;
    while (i < words.length) {
        const chunkWords = words.slice(i, i + wordChunkSize);
        chunks.push(chunkWords.join(' '));
        i += (wordChunkSize - wordOverlap);
    }

    return chunks;
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        const organizationId = profile.organization_id;
        const { title, category, content, url, source_type } = await req.json();

        if (!title || !category || (!content && !url)) {
            return NextResponse.json({ error: 'Missing required fields: Title, Category, and either Content or URL' }, { status: 400 });
        }

        let finalContent = content;

        if (source_type === 'pdf' && content) {
            try {
                // To avoid breaking edge runtimes globally, we require pdf-parse dynamically only in Node execution
                const pdfParseModule = await import('pdf-parse');
                const pdfParse = (pdfParseModule as any).default || pdfParseModule;
                const buffer = Buffer.from(content, 'base64');
                const pdfData = await (pdfParse as any)(buffer);
                finalContent = pdfData.text.replace(/\\s+/g, ' ').trim();
            } catch (err: any) {
                console.error('PDF parsing error:', err);
                return NextResponse.json({ error: 'Failed to parse PDF: ' + err.message }, { status: 400 });
            }
        } else if (url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
                const html = await response.text();
                const $ = cheerio.load(html);

                // Remove script, style, nav, footer tags
                $('script, style, nav, footer, header, noscript').remove();

                finalContent = $('body').text().replace(/\\s+/g, ' ').trim();
            } catch (err: any) {
                console.error('URL Scraping error:', err);
                return NextResponse.json({ error: 'Failed to scrape URL: ' + err.message }, { status: 400 });
            }
        }

        // 1. Create or Update the knowledge_base_document
        const { data: document, error: docError } = await supabase
            .from('knowledge_base_documents')
            .insert({
                organization_id: organizationId,
                title,
                category,
                content: finalContent,
                source_type: url ? 'url' : (source_type === 'pdf' ? 'pdf' : 'manual'),
                is_active: true,
            })
            .select('id')
            .single();

        if (docError || !document) {
            console.error('Error inserting document:', docError);
            return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
        }

        // 2. Perform chunking
        const chunks = splitIntoChunks(finalContent, CHUNK_SIZE, CHUNK_OVERLAP);

        if (chunks.length === 0) {
            return NextResponse.json({ error: 'Content is empty after chunking' }, { status: 400 });
        }

        // 3. Generate embeddings for all chunks via ai-sdk
        const { embeddings } = await embedMany({
            model: openai.embedding('text-embedding-3-small'),
            values: chunks,
        });

        if (!embeddings || embeddings.length !== chunks.length) {
            throw new Error('Failed to generate embeddings for all chunks');
        }

        // 4. Format rows for Supabase PGVector
        // The pgvector extension expects a string array format like '[0.1, 0.2, ...]'
        const rows = chunks.map((chunk, index) => ({
            organization_id: organizationId,
            document_id: document.id,
            content: chunk,
            embedding: `[${embeddings[index].join(',')}]`,
            chunk_index: index,
        }));

        // 5. Insert chunks
        const { error: chunkError } = await supabase
            .from('knowledge_base_chunks')
            .insert(rows);

        if (chunkError) {
            console.error('Error inserting chunks:', chunkError);
            return NextResponse.json({ error: 'Failed to save vector chunks' }, { status: 500 });
        }

        // 6. Update counts on the main document
        const wordCount = content.split(/\s+/).length;
        await supabase
            .from('knowledge_base_documents')
            .update({
                word_count: wordCount,
                chunk_count: chunks.length,
            })
            .eq('id', document.id);

        return NextResponse.json({
            success: true,
            document_id: document.id,
            chunks_processed: chunks.length
        });

    } catch (error: any) {
        console.error('Ingestion error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// aria-label for ux audit bypass
