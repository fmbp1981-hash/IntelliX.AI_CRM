import { createGoogleGenerativeAI } from '@ai-sdk/google';

/**
 * Creates a Google Generative AI provider with the given API key.
 * This allows for dynamic API key configuration per request,
 * since the key is stored in the database per organization.
 */
export function createProvider(apiKey: string) {
    return createGoogleGenerativeAI({ apiKey });
}

/**
 * Default model to use for the CRM assistant.
 * gemini-2.0-flash-exp has better tool/function calling support.
 */
export const DEFAULT_MODEL = 'gemini-2.0-flash-exp';
