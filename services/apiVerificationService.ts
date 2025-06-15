import { AiProviderConfig } from '@/constants/AiProviderModels';

export type ApiKeyVerificationStatus = 'idle' | 'loading' | 'valid' | 'invalid' | 'verifying_on_load';

export interface VerificationResult {
  isValid: boolean;
  models?: any[];
  error?: string;
}

/**
 * Verifies an API key with the provider and fetches available models.
 * @param providerConfig Configuration for the AI provider.
 * @param apiKey The API key to verify.
 * @returns A promise that resolves with the verification result.
 */
export const verifyApiKey = async (
  providerConfig: AiProviderConfig,
  apiKey: string
): Promise<VerificationResult> => {
  let endpoint = '';
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  let method = 'GET';

  // Determine endpoint and auth based on provider ID.
  // This should ideally be driven by more explicit fields in AiProviderConfig.
  switch (providerConfig.id) {
    case 'openai':
      endpoint = 'https://api.openai.com/v1/models';
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'gemini': // Changed from 'google' to 'gemini' to match AiProviderConfig['id'] type
      // Example: https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      // For Gemini, API key is in URL, no specific auth header needed beyond this.
      break;
    case 'groq':
      endpoint = 'https://api.groq.com/openai/v1/models'; // Groq uses an OpenAI-compatible endpoint
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    // TODO: Add configurations for other providers if they have model listing endpoints
    default:
      console.warn(`API Key verification not implemented for provider: ${providerConfig.id} (${providerConfig.name})`);
      // For providers without a models endpoint, we might consider them 'valid' if a key is entered,
      // or have a different verification strategy. For now, mark as not implemented.
      return { isValid: false, error: 'Verification not supported for this provider.' };
  }

  if (!endpoint) {
    // This case should ideally not be hit if the switch is comprehensive or config-driven
    return { isValid: false, error: 'Verification endpoint not configured for this provider.' };
  }

  try {
    const response = await fetch(endpoint, { method, headers });

    if (response.ok) {
      const data = await response.json();
      // Normalize model list access: OpenAI/Groq use 'data', Gemini uses 'models'
      const modelsList = data.data || data.models;
      if (modelsList === undefined) {
        console.warn(`Models list not found in response for ${providerConfig.name}, though request was OK. Data:`, data);
         // Consider this a soft failure or an issue with response structure assumption
        return { isValid: true, models: [], error: 'Models list not found in response.'};
      }
      return { isValid: true, models: modelsList };
    } else {
      const errorText = await response.text();
      console.error(`API Key verification failed for ${providerConfig.name}: ${response.status} - ${errorText.substring(0, 200)}`);
      return { isValid: false, error: `API returned ${response.status}` };
    }
  } catch (error: any) {
    console.error(`Network error during API Key verification for ${providerConfig.name}:`, error);
    return { isValid: false, error: 'Network or CORS error during verification.' };
  }
}; 