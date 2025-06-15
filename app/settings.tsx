import { Colors } from '@/constants/Colors';
import { defaultStyles, Spacing, BorderRadius } from '@/constants/Styles';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform,
  Appearance,
} from 'react-native';
import { t } from '@/config/i18n';
import * as SystemStore from '@/store/ModelStore';
import { AiProviderConfig, ThemePreference } from '@/constants/AiProviderModels';
import { useTheme } from '@/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { toast } from '@backpackapp-io/react-native-toast';
import { SelectList } from 'react-native-dropdown-select-list';
import Slider from '@react-native-community/slider';
import * as CONST from '@/constants/LanguagesAndCountries';
import * as Localization from 'expo-localization';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

// Import new components and services
import ApiKeyInputRow from '@/components/settings/ApiKeyInputRow';
import { verifyApiKey, ApiKeyVerificationStatus, VerificationResult } from '@/services/apiVerificationService';

// Import reusable components
import SettingsGroup from '@/components/settings/SettingsGroup';
import SettingsRow from '@/components/settings/SettingsRow';
import SettingsSegmentedControl from '@/components/settings/SettingsSegmentedControl';
import SheetSelectBox, { SheetSelectOption } from '@/components/common/SheetSelectBox';

// Import chat store and history store
import { useChatStore } from '@/store/chatStore';
import { useChatHistoryStore } from '@/store/chatHistoryStore';

// Define types
type ThemeValue = 'light' | 'dark';

// Use AiProviderConfig['id'] directly for provider IDs
type ProviderId = AiProviderConfig['id'];

// Function to generate styles based on theme colors
const getStyles = (colors: any, defaultStyles: any, Spacing: any, BorderRadius: any) => StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  textInput: {
    ...defaultStyles.textBody,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    minHeight: 44,
  },
  selectedProviderText: {
    ...defaultStyles.textBody,
    color: colors.secondary,
    textAlign: 'right',
    marginRight: Spacing.xs,
  },
  disabledLabel: {
      color: colors.secondary,
  },
  selectListBoxStyles: {
    height: 44,
    alignItems: 'center',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  selectListInputStyles: {
    color: colors.text,
    fontSize: defaultStyles.textBody.fontSize,
    textAlign: 'left',
    flex: 1,
    paddingHorizontal: 0,
  },
  selectListDropdownStyles: {
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: BorderRadius.sm,
    position: 'absolute',
    top: '100%',
    width: '100%',
    zIndex: 1000,
  },
  selectListDropdownItemStyles: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  selectListDropdownTextStyles: {
    color: colors.text,
    fontSize: defaultStyles.textBody.fontSize,
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValueText: {
    ...defaultStyles.textBody,
    color: colors.text,
    minWidth: 40,
    textAlign: 'right',
    marginLeft: Spacing.sm,
  },
  userNameTextInput: {
    ...defaultStyles.textBody,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    minHeight: 44,
  },
});

const SettingsScreen = () => {
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string | null | undefined }>({});
  const [apiKeyVerificationStatus, setApiKeyVerificationStatus] = useState<{ [key: string]: ApiKeyVerificationStatus | undefined }>({});
  const [verifiedKeysCache, setVerifiedKeysCache] = useState<Set<string>>(new Set());

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [providerConfigs] = useState<Record<AiProviderConfig['id'], AiProviderConfig>>(SystemStore.getAllProviderConfigs());

  // New state for additional settings
  const [userName, setUserName] = useState<string | null>(null);
  const [userLanguage, setUserLanguage] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [modelTemperature, setModelTemperature] = useState<number>(0.7); // Default temperature

  const { colors, theme, setTheme } = useTheme();
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout | number | null }>({});
  const headerHeight = useHeaderHeight();

  // Chat history deletion logic
  const { chatHistories, loadChatHistories, clearChatHistories } = useChatHistoryStore();
  const deleteChatSession = useChatStore((state) => state.deleteChatSession);
  const dbInstance = useChatStore((state) => state.dbInstance);

  // Memoize styles so they only update when colors change
  const styles = useMemo(() => getStyles(colors, defaultStyles, Spacing, BorderRadius), [colors]);

  const applyThemePreference = useCallback((preference: ThemePreference) => {
    let newTheme: ThemeValue = 'light';
    if (preference === 'system') {
      newTheme = Appearance.getColorScheme() ?? 'light';
    } else {
      newTheme = preference;
    }
    if (setTheme) {
      setTheme(newTheme);
    } else {
      console.error("[applyThemePreference] setTheme function not available from context.");
    }
  }, [setTheme]);

  const handleVerifyApiKey = useCallback(async (providerId: AiProviderConfig['id'], keyToVerify: string, isInitialLoad: boolean = false) => {
    const providerConfig = providerConfigs[providerId];
    if (!providerConfig || !keyToVerify) {
      setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: 'idle' }));
      return;
    }

    const cacheKey = `${providerId}:${keyToVerify}`;
    if (verifiedKeysCache.has(cacheKey) && !isInitialLoad) {
      setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: 'valid' }));
      return;
    }

    setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: isInitialLoad ? 'verifying_on_load' : 'loading' }));

    // Attempt to load models from AsyncStorage first
    try {
      const storedModels = await SystemStore.getProviderModels(providerId);
      if (storedModels && storedModels.length > 0) {
        // Check if the key associated with these stored models is the current key being verified.
        // This requires storing the API key alongside models or having a way to validate it.
        // For now, we'll assume if models are present for this providerId, they are for the current key context.
        // A more robust solution would involve storing a hash of the API key with the models.
        // Or, if the API key itself is the *only* thing that gates model access for that provider.

        // For simplification, if we have stored models for this provider, AND the key is the one currently saved,
        // we assume validity without hitting the network for this specific verification attempt.
        const currentlySavedKey = await SystemStore.getApiKey(providerId);
        if (currentlySavedKey === keyToVerify) {
            console.log(`Using stored models for ${providerConfig.name} with key ${keyToVerify.substring(0,4)}...`);
            setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: 'valid' }));
            setVerifiedKeysCache(prev => new Set(prev).add(cacheKey)); 
            toast.success(t('settings.apiKeyVerifiedFromCache', { providerName: providerConfig.name }));
            // Models are already in store, no need to set them again here unless fetched fresh
            return;
        }
      }
    } catch (e) {
      console.error(`Error checking stored models for ${providerId}:`, e);
      // Proceed to network verification if checking storage fails
    }
    
    const result: VerificationResult = await verifyApiKey(providerConfig, keyToVerify);

    if (result.isValid) {
      setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: 'valid' }));
      setVerifiedKeysCache(prev => new Set(prev).add(cacheKey));
      toast.success(t('settings.apiKeyVerified', { providerName: providerConfig.name }));
      if (result.models && result.models.length > 0) {
        console.log(`Models for ${providerConfig.name}:`, result.models.length, result.models.slice(0,3));
        try {
          await SystemStore.setProviderModels(providerId, result.models);
        } catch (e) {
          console.error(`Failed to store models for ${providerId}:`, e);
        }
      } else if (result.models === undefined || result.models.length === 0) {
        // If API key is valid but no models returned, or models array is empty
        // Clear any potentially stale stored models for this provider
        try {
            await SystemStore.removeProviderModels(providerId);
        } catch (e) {
            console.error(`Failed to remove stale models for ${providerId}:`, e);
        }
      }
    } else {
      setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: 'invalid' }));
      setVerifiedKeysCache(prev => {
        const newCache = new Set(prev);
        newCache.delete(cacheKey);
        return newCache;
      });
      toast.error(t('settings.apiKeyInvalid', { providerName: providerConfig.name, error: result.error || 'Unknown error' }));
      // If key becomes invalid, clear stored models for this provider
      try {
        await SystemStore.removeProviderModels(providerId);
      } catch (e) {
        console.error(`Failed to remove models for invalid key on ${providerId}:`, e);
      }
    }
  }, [providerConfigs, verifiedKeysCache, t]);

  useEffect(() => {
    const loadPreferences = async () => {
      const loadedApiKeys: { [key: string]: string | null | undefined } = {};
      let loadedThemePref: ThemePreference = 'system';
      let loadedUserName: string | null = null;
      let loadedUserLanguage: string | null = null;
      let loadedUserCountry: string | null = null;
      let loadedModelTemperature: number = 0.7;
      const initialVerificationStatus: { [key: string]: ApiKeyVerificationStatus | undefined } = {};
      const providerIdsToVerifyInitially: Array<{id: AiProviderConfig['id'], key: string}> = [];

      const providerIdKeys = Object.keys(providerConfigs) as Array<AiProviderConfig['id']>;
      const cacheKeysToAdd: string[] = [];

      for (const providerId of providerIdKeys) {
        try {
          const key = await SystemStore.getApiKey(providerId);
          loadedApiKeys[providerId] = key;
          if (key) {
            // Check if we have stored models for this key already
            const storedModels = await SystemStore.getProviderModels(providerId);
            if (storedModels && storedModels.length > 0) {
              initialVerificationStatus[providerId] = 'valid'; // Optimistically valid if models are stored
              cacheKeysToAdd.push(`${providerId}:${key}`);
            } else {
              initialVerificationStatus[providerId] = 'idle';
              providerIdsToVerifyInitially.push({ id: providerId, key });
            }
          } else {
            initialVerificationStatus[providerId] = 'idle';
          }
        } catch (modelStoreError) {
          console.error(`Error loading API key/models for ${providerId} via SystemStore:`, modelStoreError);
          loadedApiKeys[providerId] = null;
          initialVerificationStatus[providerId] = 'idle';
        }
      }
      // After the loop, update the cache state ONCE
      if (cacheKeysToAdd.length > 0) {
        setVerifiedKeysCache(prev => {
          const newSet = new Set(prev);
          cacheKeysToAdd.forEach(key => newSet.add(key));
          return newSet;
        });
      }

      try {
        const storedTheme = await SystemStore.getThemePreference();
        loadedThemePref = storedTheme || 'system';
        loadedUserName = await SystemStore.getUserName();
        loadedUserLanguage = await SystemStore.getUserLanguage();
        loadedUserCountry = await SystemStore.getUserCountry();
        loadedModelTemperature = await SystemStore.getModelTemperature();

        if (!loadedUserLanguage || !loadedUserCountry) {
          const deviceLocales = Localization.getLocales();
          if (deviceLocales && deviceLocales.length > 0) {
            const deviceLocale = deviceLocales[0];
            if (!loadedUserLanguage && deviceLocale.languageCode) {
              const isSupportedLanguage = CONST.LANGUAGES.some(lang => lang.code === deviceLocale.languageCode);
              if (isSupportedLanguage) {
                loadedUserLanguage = deviceLocale.languageCode;
                await SystemStore.setUserLanguage(loadedUserLanguage);
              }
            }
            if (!loadedUserCountry && deviceLocale.regionCode) {
              const isSupportedCountry = CONST.COUNTRIES.some(country => country.code === deviceLocale.regionCode);
              if (isSupportedCountry) {
                loadedUserCountry = deviceLocale.regionCode;
                await SystemStore.setUserCountry(loadedUserCountry);
              }
            }
          }
        }

      } catch (asyncError) {
        console.error("Error loading preferences via SystemStore:", asyncError);
      }

      setApiKeys(loadedApiKeys);
      setApiKeyVerificationStatus(initialVerificationStatus);
      setThemePreferenceState(loadedThemePref);
      applyThemePreference(loadedThemePref);
      setUserName(loadedUserName);
      setUserLanguage(loadedUserLanguage || "");
      setUserCountry(loadedUserCountry || "");
      setModelTemperature(loadedModelTemperature);

      // After all initial states are set, trigger network verification for keys without stored models
      for (const item of providerIdsToVerifyInitially) {
        handleVerifyApiKey(item.id, item.key, true);
      }
    };
    if (Object.keys(providerConfigs).length > 0) {
      loadPreferences();
    }
  }, [applyThemePreference, providerConfigs, setTheme, handleVerifyApiKey, t]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themePreference === 'system') {
        const newSystemTheme = colorScheme ?? 'light';
        if (setTheme) {
            setTheme(newSystemTheme);
        } else {
            console.error("[Appearance Listener] setTheme function not available from context.");
        }
      }
    });
    return () => subscription.remove();
  }, [themePreference, setTheme]);

  const performSaveApiKey = useCallback(async (providerId: AiProviderConfig['id'], keyToSave: string) => {
    const finalApiKey = keyToSave.trim();
    const currentSavedKey = await SystemStore.getApiKey(providerId); 

    try {
      if (finalApiKey) {
        await SystemStore.setApiKey(providerId, finalApiKey);
      } else {
        await SystemStore.removeApiKey(providerId);
        await SystemStore.removeProviderModels(providerId);
      }
      setApiKeys(prevKeys => ({ ...prevKeys, [providerId]: finalApiKey || null }));

      if (finalApiKey) {
        const keyActuallyChanged = finalApiKey !== currentSavedKey;
        const needsVerification = keyActuallyChanged || 
                                (apiKeyVerificationStatus[providerId] !== 'valid' && 
                                 apiKeyVerificationStatus[providerId] !== 'loading' && 
                                 apiKeyVerificationStatus[providerId] !== 'verifying_on_load');

        if (keyActuallyChanged && currentSavedKey) {
             verifiedKeysCache.delete(`${providerId}:${currentSavedKey}`);
             await SystemStore.removeProviderModels(providerId); 
        }

        if (needsVerification) {
          await handleVerifyApiKey(providerId, finalApiKey);
        }
      } else {
        setApiKeyVerificationStatus(prev => ({ ...prev, [providerId]: 'idle' }));
        if (currentSavedKey) verifiedKeysCache.delete(`${providerId}:${currentSavedKey}`);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.errorFailedToSaveApiKey'));
    }
  }, [apiKeyVerificationStatus, handleVerifyApiKey, verifiedKeysCache, t, providerConfigs]);

  const debouncedSaveApiKey = useCallback(
    (providerId: ProviderId, keyToSave: string) => {
      if (debounceTimers.current[providerId]) {
        clearTimeout(debounceTimers.current[providerId] as any);
      }
      debounceTimers.current[providerId] = setTimeout(() => {
        performSaveApiKey(providerId, keyToSave);
        debounceTimers.current[providerId] = null;
      }, 1000);
    },
    [performSaveApiKey]
  );

  // This function is passed to ApiKeyInputRow as `onApiKeyChange`
  const handleApiKeyRawInputChange = (providerId: ProviderId, text: string) => {
    // The ApiKeyInputRow updates its internal state for responsiveness.
    // This callback triggers the debounced save & verify logic in the parent.
    debouncedSaveApiKey(providerId, text);
  };

  // On mount, load the initial value from the store
  useEffect(() => {
    SystemStore.getUserName()
      .then((storedName) => setUserName(storedName))
      .catch(() => setUserName(null));
  }, []);

  /**
   * Handles changes to the user name input field.
   * Updates local state and the store immediately for instant UI feedback.
   */
  const handleUserNameChange = (text: string) => {
    const newName = text.trim() === '' ? null : text;
    setUserName(newName); // Instant UI update
    SystemStore.setUserName(newName)
      .then(() => toast.success(t('settings.userNameSaved')))
      .catch(() => Alert.alert(t('common.error'), t('settings.errorFailedToSaveUserName')));
  };

  const handleUserLanguageChange = (value: string | number | (string | number)[] | null): void => {
    console.log('User Language Changed:', value);
    // Ensure value is string or null, not an array, as SheetSelectBox for single select should provide this
    const langValue = (Array.isArray(value) || value === "" || value === null) ? null : String(value);
    setUserLanguage(String(value || "")); // Keep UI update immediate
    SystemStore.setUserLanguage(langValue)
      .then(() => {
        toast.success(t('settings.userLanguageSaved'));
      })
      .catch((error: any) => {
        Alert.alert(t('common.error'), t('settings.errorFailedToSaveUserLanguage'));
      });
  };

  const handleUserCountryChange = (value: string | number | (string | number)[] | null): void => {
    console.log('User Country Changed:', value);
    // Ensure value is string or null
    const countryValue = (Array.isArray(value) || value === "" || value === null) ? null : String(value);
    setUserCountry(String(value || "")); // Keep UI update immediate
    SystemStore.setUserCountry(countryValue)
      .then(() => {
        toast.success(t('settings.userCountrySaved'));
      })
      .catch((error: any) => {
        Alert.alert(t('common.error'), t('settings.errorFailedToSaveUserCountry'));
      });
  };

  // New function for live UI updates of model temperature
  const liveUpdateModelTemperature = (value: number) => {
    const temp = Math.round(value * 10) / 10; // Ensure one decimal place
    setModelTemperature(temp);
  };

  const handleModelTemperatureChange = async (value: number) => {
    const temp = Math.round(value * 10) / 10; // Ensure one decimal place
    setModelTemperature(temp); // Optimistically update UI
    try {
      await SystemStore.setModelTemperature(temp);
      // No toast for slider usually, unless explicitly needed.
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.errorFailedToSaveModelTemperature'));
    }
  };

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer as any);
      });
    };
  }, []);

  const handleThemeChange = async (value: ThemePreference) => {
    setThemePreferenceState(value);
    applyThemePreference(value);

    try {
      await SystemStore.setThemePreference(value);
      toast.success(t('settings.themeChangedToast', { theme: value }));
    } catch (error) {
      console.error("[handleThemeChange] Failed to save theme preference via SystemStore:", error);
      Alert.alert(t('common.error'), t('settings.errorFailedToSaveTheme'));
    }
  };

  const themeOptions: Array<{ label: string; value: ThemePreference, icon: React.ReactNode }> = [
    {
        label: t('settings.themeLight'),
        value: 'light',
        icon: <Ionicons name="sunny-outline" size={18} color={themePreference === 'light' ? colors.primary : colors.icon} />,
    },
    {
        label: t('settings.themeDark'),
        value: 'dark',
        icon: <Ionicons name="moon-outline" size={18} color={themePreference === 'dark' ? colors.primary : colors.icon} />,
    },
    {
        label: t('settings.themeSystem'),
        value: 'system',
        icon: <Ionicons name="settings-outline" size={18} color={themePreference === 'system' ? colors.primary : colors.icon} />,
    },
  ];

  const allProviderIds = Object.keys(providerConfigs) as ProviderId[];

  // Prepare data for SelectList
  const languageOptions: SheetSelectOption[] = [
    { value: "", label: t('settings.selectLanguagePlaceholder') },
    ...CONST.LANGUAGES.map(lang => ({ value: lang.code, label: lang.name, searchTerms: lang.name })),
  ];
  const countryOptions: SheetSelectOption[] = [
    { value: "", label: t('settings.selectCountryPlaceholder') },
    ...CONST.COUNTRIES.map(country => ({ value: country.code, label: country.name, searchTerms: country.name })),
  ];

  // Chat history deletion logic
  const handleDeleteAllChats = useCallback(() => {
    Alert.alert(
      t('settings.deleteAllChatsTitle', 'Delete All Chats?'),
      t('settings.deleteAllChatsConfirm', 'Are you sure you want to delete all chat history? This cannot be undone.'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            for (const chat of chatHistories) {
              await deleteChatSession(chat.uuid);
            }
            clearChatHistories();
            if (dbInstance) {
              await loadChatHistories(dbInstance);
            }
            toast.success(t('settings.deleteAllChatsSuccess', 'All chat history deleted.'));
          },
        },
      ]
    );
  }, [chatHistories, deleteChatSession, dbInstance, loadChatHistories, clearChatHistories, t]);

  return (
    <KeyboardAwareScrollView
      style={[
        defaultStyles.pageContainer,
        { backgroundColor: colors.background, paddingHorizontal: 0, paddingBottom: 40 }
      ]}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsGroup title={t('settings.appearanceHeader')}>
         <SettingsSegmentedControl
            options={themeOptions}
            selectedValue={themePreference}
            onValueChange={handleThemeChange}
         />
      </SettingsGroup>

      <SettingsGroup 
        title={t('settings.userProfileHeader')}
      >
        <SettingsRow label={t('settings.userNameLabel')}>
          <TextInput
            style={styles.userNameTextInput}
            value={userName || ''}
            onChangeText={handleUserNameChange}
            placeholder={t('settings.userNamePlaceholder')}
            placeholderTextColor={colors.secondary}
            accessibilityLabel={t('settings.userNameAccessibilityLabel')}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </SettingsRow>
        <SettingsRow label={t('settings.userLanguageLabel')}>
          <SheetSelectBox
            options={languageOptions}
            selectedValue={userLanguage}
            onValueChange={handleUserLanguageChange}
            placeholder={t('settings.selectLanguagePlaceholder')}
            modalTitle={t('settings.selectLanguageModalTitle', 'Select Language')}
            showClearButton={true}
          />
        </SettingsRow>
        <SettingsRow label={t('settings.userCountryLabel')}>
          <SheetSelectBox
            options={countryOptions}
            selectedValue={userCountry}
            onValueChange={handleUserCountryChange}
            placeholder={t('settings.selectCountryPlaceholder')}
            modalTitle={t('settings.selectCountryModalTitle', 'Select Country')}
            showClearButton={true}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t('settings.apiConfigHeader')}>
        {allProviderIds.map((providerId, index) => {
          const config = providerConfigs[providerId];
          if (!config) return null;
          return (
            <ApiKeyInputRow
              key={providerId}
              providerConfig={config}
              apiKey={apiKeys[providerId]}
              verificationStatus={apiKeyVerificationStatus[providerId] || 'idle'}
              onApiKeyChange={handleApiKeyRawInputChange}
              onTriggerVerify={(id, key) => handleVerifyApiKey(id, key, false)}
              isLast={index === allProviderIds.length - 1}
            />
          );
        })}
      </SettingsGroup>

      <SettingsGroup title={t('settings.modelSettingsHeader')}>
        <View style={{ 
          paddingTop: Spacing.sm, 
          paddingBottom: Spacing.md,
        }}>
          <Text style={[defaultStyles.textBody, { color: colors.text, marginBottom: Spacing.md, paddingHorizontal: Spacing.md }]}>
            {t('settings.modelTemperatureLabel')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md }}>
              <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.1}
                  value={modelTemperature}
                  onValueChange={liveUpdateModelTemperature}
                  onSlidingComplete={handleModelTemperatureChange}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={Platform.OS === 'android' ? colors.primary : undefined}
              />
              <Text style={styles.sliderValueText}>{modelTemperature.toFixed(1)}</Text>
          </View>
        </View>
      </SettingsGroup>

    </KeyboardAwareScrollView>
  );
};

export default React.memo(SettingsScreen);