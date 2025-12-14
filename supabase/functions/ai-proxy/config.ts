import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

export interface ProviderConfig {
    provider: 'google' | 'openai' | 'anthropic';
    apiKey: string;
    model: string;
}

export interface UserAISettings {
    providers: ProviderConfig[];
}

export async function getUserAISettings(userId: string): Promise<UserAISettings> {
    const availableProviders: ProviderConfig[] = [];

    // 1. Load SYSTEM-LEVEL keys from Environment Variables
    const sysGemini = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const sysOpenAI = Deno.env.get("OPENAI_API_KEY");
    const sysAnthropic = Deno.env.get("ANTHROPIC_API_KEY");

    // 2. Fetch ORGANIZATION-LEVEL settings from Database
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    let settings: any = null;

    if (profile?.organization_id) {
        const { data: orgSettings, error } = await supabaseAdmin
            .from('organization_settings')
            .select('ai_provider, ai_model, ai_google_key, ai_openai_key, ai_anthropic_key')
            .eq('organization_id', profile.organization_id)
            .single();

        if (!error) {
            settings = orgSettings;
        } else if (error.code !== 'PGRST116') {
            console.warn('Error fetching organization_settings:', error.message);
        }
    }

    // 3. Merge Logic: Org Keys > System Keys
    const primaryProvider = settings?.ai_provider || (sysGemini ? 'google' : sysOpenAI ? 'openai' : sysAnthropic ? 'anthropic' : 'google');

    const addProvider = (prov: 'google' | 'openai' | 'anthropic') => {
        let key: string | null = null;
        let model = 'gemini-1.5-flash'; // Fallback default

        if (prov === 'google') {
            key = settings?.ai_google_key || sysGemini || null;
            model = (prov === primaryProvider ? settings?.ai_model : null) || 'gemini-2.0-flash-exp';
        } else if (prov === 'openai') {
            key = settings?.ai_openai_key || sysOpenAI || null;
            model = (prov === primaryProvider ? settings?.ai_model : null) || 'gpt-4o';
        } else if (prov === 'anthropic') {
            key = settings?.ai_anthropic_key || sysAnthropic || null;
            model = (prov === primaryProvider ? settings?.ai_model : null) || 'claude-3-5-sonnet-latest';
        }

        if (key) {
            availableProviders.push({ provider: prov, apiKey: key, model });
        }
    };

    addProvider(primaryProvider as any);
    ['google', 'openai', 'anthropic'].forEach(p => {
        if (p !== primaryProvider) addProvider(p as any);
    });

    if (availableProviders.length === 0) {
        throw new Error(`Configuration Error: No AI API keys found. Please set keys in Supabase Secrets or Organization Settings.`);
    }

    return { providers: availableProviders };
}

export function createModel(config: ProviderConfig) {
    const { apiKey, provider, model: modelId } = config;
    switch (provider) {
        case 'google':
            const google = createGoogleGenerativeAI({ apiKey });
            return google(modelId);
        case 'openai':
            const openai = createOpenAI({ apiKey });
            return openai(modelId);
        case 'anthropic':
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelId);
        default:
            const defaultGoogle = createGoogleGenerativeAI({ apiKey });
            return defaultGoogle(modelId || 'gemini-2.0-flash-exp');
    }
}

/**
 * Executes an AI operation with automatic fallback to secondary providers.
 */
export async function executeWithFallback<T>(
    providers: ProviderConfig[],
    operation: (model: any) => Promise<T>
): Promise<T> {
    if (providers.length === 0) {
        throw new Error("No AI providers configured.");
    }

    let lastError: any;

    for (const config of providers) {
        try {
            const model = createModel(config);
            return await operation(model);
        } catch (error: any) {
            console.warn(`AI Provider ${config.provider} (${config.model}) failed:`, error.message);
            lastError = error;
        }
    }

    throw lastError;
}
