import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

serve(async (req: Request) => {
  // Only allow POST (or internal triggers)
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch conversations that need summarization.
    // We look for conversations where `updated_at` is more recent than `summarized_at` (we'll assume a custom field or simply summarize active conversations periodically).
    // For efficiency, we just grab conversations that had activity in the last 2 hours.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, summary, updated_at')
      .gte('updated_at', twoHoursAgo)
      .limit(100);

    if (convError) throw convError;

    console.log(`Found ${conversations?.length || 0} conversations to summarize.`);

    const results = [];

    for (const conv of (conversations || [])) {
      // Fetch last 50 messages for this conversation
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (!messages || messages.length === 0) continue;

      // Prepare for LLM
      const transcript = messages.map(m => `[${m.role.toUpperCase()}] (${m.created_at}): ${m.content}`).join('\n');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Cost efficient for summaries
          messages: [
            {
              role: "system",
              content: `Você é um assistente de CRM analisando o histórico de um atendimento via agente AI e/ou humano limitando-se às últimas mensagens. 
Sintetize a conversa atual. Se já houver um resumo anterior, mescle as informações.
Resumo anterior: ${conv.summary || 'Nenhum'}`
            },
            {
              role: "user",
              content: `Transcrição recente:\n\n${transcript}\n\nGere um novo resumo conciso da situação geral deste lead, dores, o que ele procura e qual o status aparente.`
            }
          ],
          max_tokens: 300,
          temperature: 0.3
        })
      });

      if (!res.ok) {
        console.error(`Failed to summarize conv ${conv.id}`, await res.text());
        continue;
      }

      const data = await res.json();
      const newSummary = data.choices[0].message.content;

      // Save back to DB
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ summary: newSummary }) // You could also set `summarized_at: new Date().toISOString()` if column exists
        .eq('id', conv.id);

      if (updateError) {
        console.error(`Failed to save summary for ${conv.id}`, updateError);
      } else {
        results.push({ id: conv.id, summary: newSummary });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      summarized_count: results.length,
      results
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Summary Handler Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
