import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import AI_PROVIDER_CONFIGS, { AiProviderConfig, AiModel, ThemePreference } from '../constants/AiProviderModels';

// Storage Keys with new prefix
const THEME_PREFERENCE_KEY = 'systemStore_themePreference'; // New key for theme
const LAST_SELECTED_MODEL_ID_KEY = 'systemStore_lastSelectedModelId';
const FAVORITE_MODELS_KEY = 'systemStore_favoriteModelIds';
const USER_NAME_KEY = 'systemStore_userName';
const USER_LANGUAGE_ISO_KEY = 'systemStore_userLanguageIso';
const USER_COUNTRY_ISO_KEY = 'systemStore_userCountryIso';
const MODEL_TEMPERATURE_KEY = 'systemStore_modelTemperature';
const LAST_ACTIVE_CHAT_UUID_KEY = 'systemStore_lastActiveChatUUID';
const getApiKeySecureStoreKey = (providerId: string) => `modelStore_apiKey_${providerId}`;
const getProviderModelsStoreKey = (providerId: AiProviderConfig['id']) => `modelStore_models_${providerId}`;
// const getOrgIdSecureStoreKey = (providerId: string) => `modelStore_orgId_${providerId}`; // If storing org IDs per provider

/**
 * Represents the structure for a stored API key.
 * Currently, only the key itself is stored. Organization ID could be added if needed.
 */
export interface StoredApiKey {
  key: string;
  // org?: string;
}

/**
 * Retrieves the user's theme preference (light, dark, or system) from AsyncStorage.
 * @returns A promise that resolves to the ThemePreference string, or null if not set or an error occurs.
 */
export async function getThemePreference(): Promise<ThemePreference | null> {
  try {
    const preference = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return preference as ThemePreference | null;
  } catch (error) {
    console.error('Failed to get theme preference from AsyncStorage:', error);
    return null;
  }
}

/**
 * Stores the user's theme preference in AsyncStorage.
 * @param preference - The theme preference ('light', 'dark', or 'system') to store.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setThemePreference(preference: ThemePreference): Promise<void> {
  if (!['light', 'dark', 'system'].includes(preference)) {
    console.error('setThemePreference: Invalid preference value.');
    throw new Error('Invalid theme preference value.');
  }
  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch (error) {
    console.error('Failed to set theme preference in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Sets the API key for a specific provider in SecureStore.
 * @param providerId - The ID of the AI provider (e.g., 'openai', 'groq').
 * @param apiKey - The API key to store.
 * @throws Will re-throw errors from SecureStore.
 */
export async function setApiKey(providerId: string, apiKey: string): Promise<void> {
  if (!providerId || !apiKey) {
    console.error('setApiKey: providerId and apiKey must be provided.');
    throw new Error('Provider ID and API key are required.');
  }
  try {
    await SecureStore.setItemAsync(getApiKeySecureStoreKey(providerId), apiKey);
  } catch (error) {
    console.error(`Failed to set API key for provider ${providerId} in SecureStore:`, error);
    throw error;
  }
}

/**
 * Retrieves the API key for a specific provider from SecureStore.
 * @param providerId - The ID of the AI provider.
 * @returns The API key string, or null if not found or an error occurs.
 */
export async function getApiKey(providerId: string): Promise<string | null> {
  if (!providerId) {
    console.error('getApiKey: providerId must be provided.');
    return null;
  }
  try {
    return await SecureStore.getItemAsync(getApiKeySecureStoreKey(providerId));
  } catch (error) {
    console.error(`Failed to get API key for provider ${providerId} from SecureStore:`, error);
    return null;
  }
}

/**
 * Removes the API key for a specific provider from SecureStore.
 * @param providerId - The ID of the AI provider.
 * @throws Will re-throw errors from SecureStore on failure.
 */
export async function removeApiKey(providerId: string): Promise<void> {
  if (!providerId) {
    console.error('removeApiKey: providerId must be provided.');
    throw new Error('Provider ID is required.');
  }
  try {
    await SecureStore.deleteItemAsync(getApiKeySecureStoreKey(providerId));
  } catch (error) {
    console.error(`Failed to remove API key for provider ${providerId} from SecureStore:`, error);
    throw error;
  }
}

/**
 * Sets the ID of the last selected model in AsyncStorage.
 * @param modelId - The ID of the model.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setLastSelectedModelId(modelId: string): Promise<void> {
  if (!modelId) {
    console.error('setLastSelectedModelId: modelId must be provided.');
    throw new Error('Model ID is required.');
  }
  try {
    await AsyncStorage.setItem(LAST_SELECTED_MODEL_ID_KEY, modelId);
  } catch (error) {
    console.error('Failed to set last selected model ID in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves the ID of the last selected model from AsyncStorage.
 * @returns The model ID string, or null if not set or an error occurs.
 */
export async function getLastSelectedModelId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SELECTED_MODEL_ID_KEY);
  } catch (error) {
    console.error('Failed to get last selected model ID from AsyncStorage:', error);
    return null;
  }
}

/**
 * Retrieves the list of favorite model IDs from AsyncStorage.
 * @returns A promise that resolves to an array of model IDs, or an empty array if none are found or an error occurs.
 */
export async function getFavoriteModelIds(): Promise<string[]> {
  try {
    const storedFavorites = await AsyncStorage.getItem(FAVORITE_MODELS_KEY);
    return storedFavorites ? JSON.parse(storedFavorites) : [];
  } catch (error) {
    console.error('Failed to get favorite model IDs from AsyncStorage:', error);
    return []; // Return empty array on error
  }
}

/**
 * Stores the list of favorite model IDs in AsyncStorage.
 * @param modelIds - An array of model IDs to store as favorites.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setFavoriteModelIds(modelIds: string[]): Promise<void> {
  if (!Array.isArray(modelIds)) {
    console.error('setFavoriteModelIds: modelIds must be an array.');
    throw new Error('Invalid argument: modelIds must be an array.');
  }
  try {
    await AsyncStorage.setItem(FAVORITE_MODELS_KEY, JSON.stringify(modelIds));
  } catch (error) {
    console.error('Failed to set favorite model IDs in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves all available AI provider configurations.
 * This currently returns the constant from AiProviderModels.
 * @returns An object mapping provider IDs to their configurations.
 */
export function getAllProviderConfigs(): typeof AI_PROVIDER_CONFIGS {
  return AI_PROVIDER_CONFIGS;
}

/**
 * Retrieves a specific AI model by its ID from the configurations.
 * @param modelId - The ID of the model.
 * @returns The AiModel object or undefined if not found.
 */
export function getModelById(modelId: string): AiModel | undefined {
  if (!modelId) return undefined;
  for (const providerKey in AI_PROVIDER_CONFIGS) {
    const provider = AI_PROVIDER_CONFIGS[providerKey as keyof typeof AI_PROVIDER_CONFIGS];
    const foundModel = provider.models.find(m => m.id === modelId);
    if (foundModel) {
      return foundModel;
    }
  }
  return undefined;
}

/**
 * Retrieves the provider configuration for a given model ID.
 * @param modelId - The ID of the model.
 * @returns The AiProviderConfig object or undefined if not found.
 */
export function getProviderConfigForModel(modelId: string): AiProviderConfig | undefined {
  if (!modelId) return undefined;
  for (const providerKey in AI_PROVIDER_CONFIGS) {
    const provider = AI_PROVIDER_CONFIGS[providerKey as keyof typeof AI_PROVIDER_CONFIGS];
    if (provider.models.some(m => m.id === modelId)) {
      return provider;
    }
  }
  return undefined;
}

/**
 * Retrieves all models from all providers, augmenting them with their providerId.
 * @returns An array of AiModel objects, each augmented with its providerId.
 */
export function getAllModels(): (AiModel & { providerId: string })[] {
  const allModels: (AiModel & { providerId: string })[] = [];
  for (const providerKey in AI_PROVIDER_CONFIGS) {
    const provider = AI_PROVIDER_CONFIGS[providerKey as keyof typeof AI_PROVIDER_CONFIGS];
    provider.models.forEach(model => {
      allModels.push({ ...model, providerId: provider.id });
    });
  }
  return allModels;
}

/**
 * Determines the initial default model ID based on the first available provider with an API key.
 * The order of provider preference is OpenAI, Groq, then Gemini.
 * @param apiKeyStatus - An object indicating which providers have an API key set (e.g., { openai: true, groq: false }).
 * @returns The model ID string for the default model, or null if no suitable provider has an API key.
 */
export function getInitialDefaultModelId(
  apiKeyStatus: Record<AiProviderConfig['id'], boolean | undefined>
): string | null {
  const providerPreferenceOrder: AiProviderConfig['id'][] = ['openai', 'groq', 'gemini'];

  for (const providerId of providerPreferenceOrder) {
    if (apiKeyStatus[providerId]) {
      const providerConfig = AI_PROVIDER_CONFIGS[providerId];
      if (providerConfig && providerConfig.defaultModelId) {
        if (getModelById(providerConfig.defaultModelId)) {
          return providerConfig.defaultModelId;
        } else {
          // console.warn(`Default model ${providerConfig.defaultModelId} for provider ${providerId} not found in configs.`);
          // Fallback to the first model of that provider if the defined default is missing/invalid
          if (providerConfig.models.length > 0) {
            // console.warn(`Falling back to first model of provider ${providerId}: ${providerConfig.models[0].id}`);
            return providerConfig.models[0].id;
          }
        }
      } else if (providerConfig && providerConfig.models.length > 0) {
        // Fallback if defaultModelId is not even defined on the provider config
        // console.warn(`No defaultModelId defined for provider ${providerId}. Falling back to first model: ${providerConfig.models[0].id}`);
        return providerConfig.models[0].id;
      }
    }
  }
  return null;
}

/**
 * Sets the user's name in AsyncStorage.
 * @param name - The user's name to store, or null to clear it.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setUserName(name: string | null): Promise<void> {
  try {
    if (name !== null) {
      await AsyncStorage.setItem(USER_NAME_KEY, name);
    } else {
      await AsyncStorage.removeItem(USER_NAME_KEY);
    }
  } catch (error) {
    console.error('Failed to set user name in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves the user's name from AsyncStorage.
 * @returns A promise that resolves to the user's name string, or null if not set or an error occurs.
 */
export async function getUserName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_NAME_KEY);
  } catch (error) {
    console.error('Failed to get user name from AsyncStorage:', error);
    return null;
  }
}

/**
 * Sets the user's selected language ISO code in AsyncStorage.
 * @param languageIsoCode - The ISO 639-1 code of the language, or null to clear it.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setUserLanguage(languageIsoCode: string | null): Promise<void> {
  try {
    if (languageIsoCode) {
      await AsyncStorage.setItem(USER_LANGUAGE_ISO_KEY, languageIsoCode);
    } else {
      await AsyncStorage.removeItem(USER_LANGUAGE_ISO_KEY);
    }
  } catch (error) {
    console.error('Failed to set user language in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves the user's selected language ISO code from AsyncStorage.
 * @returns A promise that resolves to the language ISO code string, or null if not set or an error occurs.
 */
export async function getUserLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_LANGUAGE_ISO_KEY);
  } catch (error) {
    console.error('Failed to get user language from AsyncStorage:', error);
    return null;
  }
}

/**
 * Sets the user's selected country ISO code in AsyncStorage.
 * @param countryIsoCode - The ISO 3166-1 alpha-2 code of the country, or null to clear it.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setUserCountry(countryIsoCode: string | null): Promise<void> {
  try {
    if (countryIsoCode) {
      await AsyncStorage.setItem(USER_COUNTRY_ISO_KEY, countryIsoCode);
    } else {
      await AsyncStorage.removeItem(USER_COUNTRY_ISO_KEY);
    }
  } catch (error) {
    console.error('Failed to set user country in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves the user's selected country ISO code from AsyncStorage.
 * @returns A promise that resolves to the country ISO code string, or null if not set or an error occurs.
 */
export async function getUserCountry(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_COUNTRY_ISO_KEY);
  } catch (error) {
    console.error('Failed to get user country from AsyncStorage:', error);
    return null;
  }
}

/**
 * Sets the model temperature in AsyncStorage.
 * @param temperature - The model temperature (a number between 0 and 1).
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setModelTemperature(temperature: number): Promise<void> {
  if (temperature < 0 || temperature > 1) {
    console.error('setModelTemperature: Invalid temperature value. Must be between 0 and 1.');
    throw new Error('Invalid temperature value.');
  }
  try {
    await AsyncStorage.setItem(MODEL_TEMPERATURE_KEY, temperature.toString());
  } catch (error) {
    console.error('Failed to set model temperature in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves the model temperature from AsyncStorage.
 * @returns A promise that resolves to the model temperature (number), or 0.7 (default) if not set or an error occurs.
 */
export async function getModelTemperature(): Promise<number> {
  try {
    const tempStr = await AsyncStorage.getItem(MODEL_TEMPERATURE_KEY);
    if (tempStr !== null) {
      const tempNum = parseFloat(tempStr);
      if (!isNaN(tempNum) && tempNum >= 0 && tempNum <= 1) {
        return tempNum;
      }
    }
    return 0.7; // Default temperature
  } catch (error) {
    console.error('Failed to get model temperature from AsyncStorage:', error);
    return 0.7; // Default temperature on error
  }
}

/**
 * Stores the list of models for a specific provider in AsyncStorage.
 * @param providerId - The ID of the AI provider.
 * @param models - An array of AiModel objects to store.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setProviderModels(providerId: AiProviderConfig['id'], models: AiModel[]): Promise<void> {
  if (!providerId || !models) {
    console.error('setProviderModels: providerId and models must be provided.');
    throw new Error('Provider ID and models are required.');
  }
  try {
    await AsyncStorage.setItem(getProviderModelsStoreKey(providerId), JSON.stringify(models));
  } catch (error) {
    console.error(`Failed to set models for provider ${providerId} in AsyncStorage:`, error);
    throw error;
  }
}

/**
 * Retrieves the list of models for a specific provider from AsyncStorage.
 * @param providerId - The ID of the AI provider.
 * @returns A promise that resolves to an array of AiModel objects, or null if not found or an error occurs.
 */
export async function getProviderModels(providerId: AiProviderConfig['id']): Promise<AiModel[] | null> {
  if (!providerId) {
    console.error('getProviderModels: providerId must be provided.');
    return null;
  }
  try {
    const storedModels = await AsyncStorage.getItem(getProviderModelsStoreKey(providerId));
    return storedModels ? JSON.parse(storedModels) : null;
  } catch (error) {
    console.error(`Failed to get models for provider ${providerId} from AsyncStorage:`, error);
    return null;
  }
}

/**
 * Removes the stored models for a specific provider from AsyncStorage.
 * @param providerId - The ID of the AI provider.
 * @throws Will re-throw errors from AsyncStorage on failure.
 */
export async function removeProviderModels(providerId: AiProviderConfig['id']): Promise<void> {
  if (!providerId) {
    console.error('removeProviderModels: providerId must be provided.');
    throw new Error('Provider ID is required.');
  }
  try {
    await AsyncStorage.removeItem(getProviderModelsStoreKey(providerId));
  } catch (error) {
    console.error(`Failed to remove models for provider ${providerId} from AsyncStorage:`, error);
    throw error;
  }
}

/**
 * Stores the UUID of the last active chat session in AsyncStorage.
 * @param uuid The UUID of the chat session.
 * @throws Will re-throw errors from AsyncStorage.
 */
export async function setLastActiveChatUUID(uuid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ACTIVE_CHAT_UUID_KEY, uuid);
  } catch (error) {
    console.error('Failed to set last active chat UUID in AsyncStorage:', error);
    throw error;
  }
}

/**
 * Retrieves the UUID of the last active chat session from AsyncStorage.
 * @returns The chat session UUID string, or null if not set or an error occurs.
 */
export async function getLastActiveChatUUID(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_ACTIVE_CHAT_UUID_KEY);
  } catch (error) {
    console.error('Failed to get last active chat UUID from AsyncStorage:', error);
    return null;
  }
} 