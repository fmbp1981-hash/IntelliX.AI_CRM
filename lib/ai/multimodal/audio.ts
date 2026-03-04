// lib/ai/multimodal/audio.ts

/**
 * Transcreve um arquivo de áudio usando a API OpenAI Whisper via Fetch nativo.
 * Útil para processar áudios do WhatsApp/Evolution no Pipeline Webhook antes do Agent SDK.
 * 
 * @param audioBlob Blob ou Buffer convertido com o conteúdo do áudio (ex: .ogg do WhatsApp)
 * @param apiKey A chave da OpenAI (da organização ou global)
 * @param filename Nome do arquivo para enviar no FormData (padrão 'audio.ogg')
 * @returns O texto transcrito
 */
export async function transcribeAudio(
    audioBlob: Blob | Buffer,
    apiKey: string,
    filename: string = 'audio.ogg'
): Promise<string> {
    if (!apiKey) {
        throw new Error('Missing OpenAI API Key for transcription');
    }

    const formData = new FormData();

    // Se for Buffer do Node, converte para Blob p/ adequar ao padrão Fetch FormData
    const blob = audioBlob instanceof Buffer ? new Blob([audioBlob], { type: 'audio/ogg' }) : audioBlob;
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            // NOTA: Ao usar FormData nativo com fetch, o Content-Type é definido automaticamente 
            // incuindo o boundary correto. NÃO definir Content-Type manualmente.
        },
        body: formData
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Whisper error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.text;
}
