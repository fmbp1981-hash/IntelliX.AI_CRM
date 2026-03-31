import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

interface MediaRequest {
  organization_id: string;
  whatsapp_number: string;
  whatsapp_name?: string;
  media_url: string;
  media_type: 'audio' | 'image' | 'video' | 'document';
  mime_type: string;
  whatsapp_message_id?: string;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload: MediaRequest = await req.json();
    const { organization_id, whatsapp_number, whatsapp_name, media_url, media_type, mime_type, whatsapp_message_id } = payload;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Download Media from Provider URL
    // In Evolution API or Cloud API, the media_url is usually a direct link or requires specific auth
    // For this handler, we assume public URL or pre-signed URL is passed
    const mediaResponse = await fetch(media_url);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.statusText}`);
    }

    const mediaBlob = await mediaResponse.blob();
    let extractedText = "";

    // 2. Process based on type
    if (media_type === 'audio') {
      // WHISPER API
      const formData = new FormData();
      formData.append('file', mediaBlob, 'audio.ogg'); // Default to ogg for WA audio
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt'); // Default to PT-BR

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        console.error("Whisper Error:", err);
        throw new Error("Failed to transcribe audio");
      }

      const whisperData = await whisperRes.json();
      extractedText = `[Áudio Transcrito]: ${whisperData.text}`;

    } else if (media_type === 'image') {
      // VISION API
      const buffer = await mediaBlob.arrayBuffer();
      const base64Image = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      const dataUrl = `data:${mime_type};base64,${base64Image}`;

      const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Descreva de forma detalhada o que há nesta imagem, focando em informações relevantes para um CRM de vendas (ex: faturas, comprovantes, documentos de identificação, fotos de imóveis/produtos). Seja direto, sem introduções." },
                { type: "image_url", image_url: { url: dataUrl } }
              ]
            }
          ],
          max_tokens: 300
        })
      });

      if (!visionRes.ok) {
        const err = await visionRes.text();
        console.error("Vision Error:", err);
        throw new Error("Failed to analyze image");
      }

      const visionData = await visionRes.json();
      const description = visionData.choices[0]?.message?.content || 'Imagem recebida sem descrição legível.';
      extractedText = `[Imagem Recebida. Descrição da IA]: ${description}`;
    } else {
      extractedText = `[Arquivo recebido: ${media_type}] (Tipo não processado pela IA)`;
    }

    console.log(`Media extracted text for ${whatsapp_number}:`, extractedText);

    // Save to storage (optional, but good practice for CRM)
    const fileName = `${organization_id}/${whatsapp_number}/${Date.now()}.${mime_type.split('/')[1] || 'bin'}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('conversation_media')
      .upload(fileName, mediaBlob, {
        contentType: mime_type,
        upsert: false
      });

    if (storageError) {
      console.warn("Media storage warning:", storageError.message);
    }

    // Get public URL to pass it to the engine
    const publicUrl = storageData ? supabase.storage.from('conversation_media').getPublicUrl(fileName).data.publicUrl : media_url;

    // 3. Forward the extracted text to agent-engine
    const engineRes = await fetch(`${SUPABASE_URL}/functions/v1/agent-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` // Calling internal API securely
      },
      body: JSON.stringify({
        organization_id,
        whatsapp_number,
        whatsapp_name,
        message_content: extractedText,
        content_type: 'text', // Injecting it as standard text for the AI to reason about
        whatsapp_message_id,
        media_url: publicUrl // Include the public URL if saved
      })
    });

    if (!engineRes.ok) {
      console.error("Agent Engine failed to process forwarded media text:", await engineRes.text());
      throw new Error("Engine rejected the forwarded text");
    }

    return new Response(JSON.stringify({ success: true, extracted_text: extractedText, target_url: publicUrl }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Media Handler Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
