/**
 * Represents the pricing structure for AI model tokens.
 * All pricing is assumed to be in USD per 1 Million tokens unless otherwise specified.
 */
export interface TokenPricing {
  input: number; // Cost per 1,000 input tokens (or a relevant unit)
  output: number; // Cost per 1,000 output tokens (or a relevant unit)
  unit: string; // e.g., 'USD per 1k tokens'
}

/**
 * Represents an AI model offered by a provider.
 */
export interface AiModel {
  id: string; // Unique identifier for the model (e.g., 'gpt-4o')
  name: string; // User-friendly name (e.g., 'GPT-4 Omni')
  pricing?: TokenPricing; // Optional: Model-specific pricing overrides provider default
  contextWindow?: number; // Optional: Maximum context window size
  label?: string; // Optional label (e.g., 'Preview', 'Beta')
  labelColor?: string; // Optional color for the label background
}

/**
 * Represents the configuration for an AI API provider.
 */
export interface AiProviderConfig {
  id: 'openai' | 'groq' | 'gemini';
  name: string; // User-friendly name (e.g., 'OpenAI')
  apiUrl: string; // Base API URL for the provider
  models: AiModel[]; // List of models offered by the provider
  defaultPricing?: TokenPricing; // Default pricing if not specified per model
  defaultModelId?: string; // Added defaultModelId field
}

/** Defines the possible theme preference values */
export type ThemePreference = 'light' | 'dark' | 'system';

// Define the provider configurations
// Note: Pricing is illustrative and may vary. Check official provider documentation for current rates.
// Using placeholder pricing like $0.00 is common when actual costs are complex or variable.

// Define potential label colors (can be moved to Colors.ts if preferred)
const LabelColors = {
  PREVIEW: '#0ea5e9', // Blue (primary.500)
  BETA: '#f97316',    // Orange-500
  NEW: '#16a34a',     // Green-600
};

const AI_PROVIDER_CONFIGS: { [key in AiProviderConfig['id']]: AiProviderConfig } = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1', // Standard OpenAI API endpoint
    defaultModelId: 'gpt-4o-mini', // Added default OpenAI model
    models: [
      // Prices per 1 Million tokens
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', pricing: { input: 0.10, output: 0.40, unit: 'USD per 1M tokens' }, label: 'New', labelColor: LabelColors.NEW },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', pricing: { input: 0.15, output: 0.60, unit: 'USD per 1M tokens' } },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', pricing: { input: 0.40, output: 1.60, unit: 'USD per 1M tokens' } },
      { id: 'gpt-4.1', name: 'GPT-4.1', pricing: { input: 2.00, output: 8.00, unit: 'USD per 1M tokens' } },
      { id: 'gpt-4o', name: 'GPT-4o', pricing: { input: 2.50, output: 10.00, unit: 'USD per 1M tokens' } },
      { id: 'o3', name: 'OpenAI o3', pricing: { input: 10.00, output: 40.00, unit: 'USD per 1M tokens' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
    ],
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1', // Groq uses an OpenAI-compatible API
    defaultModelId: 'llama-3.3-70b-versatile', // Added default Groq model
    models: [
      // Production Models
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8192, pricing: { input: 0.20, output: 0.20, unit: 'USD per 1M tokens' } },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', contextWindow: 128000, pricing: { input: 0.59, output: 0.79, unit: 'USD per 1M tokens' }, label: 'New', labelColor: LabelColors.NEW },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, pricing: { input: 0.05, output: 0.08, unit: 'USD per 1M tokens' } },
      { id: 'llama-guard-3-8b', name: 'Llama Guard 3 8B', contextWindow: 8192, pricing: { input: 0.20, output: 0.20, unit: 'USD per 1M tokens' } },
      { id: 'llama3-70b-8192', name: 'Llama 3 70B', contextWindow: 8192, pricing: { input: 0.59, output: 0.79, unit: 'USD per 1M tokens' } },
      { id: 'llama3-8b-8192', name: 'Llama 3 8B', contextWindow: 8192, pricing: { input: 0.05, output: 0.08, unit: 'USD per 1M tokens' } },
      // Preview Models (Pricing often estimates or may change)
      { id: 'allam-2-7b', name: 'Allam 2 7B', contextWindow: 4096 }, // Pricing not listed on main page
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B', contextWindow: 128000, pricing: { input: 0.75, output: 0.99, unit: 'USD per 1M tokens' } },
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick (17Bx128E)', contextWindow: 131072, pricing: { input: 0.20, output: 0.60, unit: 'USD per 1M tokens' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (17Bx16E)', contextWindow: 131072, pricing: { input: 0.11, output: 0.34, unit: 'USD per 1M tokens' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
      { id: 'mistral-saba-24b', name: 'Mistral Saba 24B', contextWindow: 32000, pricing: { input: 0.79, output: 0.79, unit: 'USD per 1M tokens' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B (Preview)', contextWindow: 128000, pricing: { input: 0.29, output: 0.39, unit: 'USD per 1M tokens' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', //  Gemini OpenAI compatible API endpoint
    defaultModelId: 'gemini-2.0-flash', // Added default Gemini model
    models: [
      // Note: Pricing below uses the base paid tier (e.g., <=128k tokens) where applicable.
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash Preview', pricing: { input: 0.15, output: 0.60, unit: 'USD per 1M tokens (non-thinking)' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
      { id: 'gemini-2.5-pro-preview-03-25', name: 'Gemini 2.5 Pro Preview', pricing: { input: 1.25, output: 10.00, unit: 'USD per 1M tokens (<=200k prompt)' }, label: 'Preview', labelColor: LabelColors.PREVIEW },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', pricing: { input: 0.10, output: 0.40, unit: 'USD per 1M tokens' } },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', pricing: { input: 0.075, output: 0.30, unit: 'USD per 1M tokens' } },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', pricing: { input: 0.075, output: 0.30, unit: 'USD per 1M tokens (<=128k prompt)' } },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', pricing: { input: 0.0375, output: 0.15, unit: 'USD per 1M tokens (<=128k prompt)' } },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', pricing: { input: 1.25, output: 5.00, unit: 'USD per 1M tokens (<=128k prompt)' } },
    ],
  },
};

export default AI_PROVIDER_CONFIGS; 