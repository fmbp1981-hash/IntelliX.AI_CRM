// lib/evolution/client.ts — Evolution API HTTP client
// Handles sending messages and managing WhatsApp connections via Evolution API

export interface EvolutionTextMessage {
    number: string;       // recipient in format 5511999999999
    text: string;
    delay?: number;       // optional typing simulation delay in ms
}

export interface EvolutionSendResult {
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
    };
    status: string;
    message: {
        conversation?: string;
    };
}

/**
 * Sends a text message via Evolution API.
 * @param apiUrl  - Evolution API base URL (e.g. https://evo.example.com)
 * @param apiKey  - Evolution API key
 * @param instanceName - Evolution instance name
 * @param to      - recipient number (e.g. 5511999999999)
 * @param text    - message content
 */
export async function sendEvolutionTextMessage(
    apiUrl: string,
    apiKey: string,
    instanceName: string,
    to: string,
    text: string
): Promise<EvolutionSendResult> {
    // Normalize: strip non-digits, ensure country code
    const normalizedTo = to.replace(/\D/g, '');

    const url = `${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

    const body: EvolutionTextMessage = {
        number: normalizedTo,
        text,
        delay: 1000, // 1s typing simulation
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => 'unknown error');
        throw new Error(
            `Evolution API error ${res.status} sending message: ${errorText}`
        );
    }

    return res.json() as Promise<EvolutionSendResult>;
}

/**
 * Checks if an Evolution API instance is connected.
 */
export async function checkEvolutionInstanceStatus(
    apiUrl: string,
    apiKey: string,
    instanceName: string
): Promise<{ connected: boolean; state?: string }> {
    const url = `${apiUrl.replace(/\/$/, '')}/instance/connectionState/${instanceName}`;

    try {
        const res = await fetch(url, {
            headers: { apikey: apiKey },
        });

        if (!res.ok) return { connected: false };

        const data = await res.json() as { instance?: { state?: string } };
        const state = data?.instance?.state;
        return {
            connected: state === 'open',
            state,
        };
    } catch {
        return { connected: false };
    }
}
