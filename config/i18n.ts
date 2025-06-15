import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

// Import your translation files
import en from '../locales/en.json';
// import de from '../locales/de.json'; // Example for another language

const i18n = new I18n({
  en,
  // de,
});

// Set the locale once at the beginning of your app.
i18n.locale = Localization.getLocales()[0].languageCode || 'en';

// When a value is missing from a language it'll fallback to another language with the key present.
i18n.enableFallback = true;
// To see the fallback mechanism uncomment the line below to force the app to use the fallback locale.
// i18n.locale = 'pt';

// Helper function for convenience
export const t = (scope: string, options?: any) => {
  try {
    const translation = i18n.t(scope, options);
    // Check if the translation is missing or is the key itself (i18n-js might return the key)
    if (translation === scope || !translation) {
      // Attempt to return a more generic fallback if the direct scope lookup failed.
      // This assumes a convention like 'error.generic' exists.
      // If you want to return the key itself as a final fallback:
      // return i18n.t('error.generic', { defaultValue: scope });
      // For now, let's return the key if specific translation not found, after trying generic.
      const genericFallback = i18n.t('error.generic');
      if (scope.startsWith('error.') && genericFallback !== 'error.generic') {
        return genericFallback;
      }
      return scope; // Return the key if specific translation is missing
    }
    return translation;
  } catch (e) {
    console.warn(`Translation error for scope "${scope}":`, e);
    // Fallback to the key itself or a predefined generic message
    return scope; // Or return a generic error message like "Translation missing"
  }
};

export default i18n; 