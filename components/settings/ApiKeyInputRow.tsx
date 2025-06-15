import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SettingsRow from '@/components/settings/SettingsRow';
import { defaultStyles, Spacing } from '@/constants/Styles';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/config/i18n';
import { AiProviderConfig } from '@/constants/AiProviderModels';
import { ApiKeyVerificationStatus } from '@/services/apiVerificationService';

interface ApiKeyInputRowProps {
  providerConfig: AiProviderConfig;
  apiKey: string | null | undefined;
  verificationStatus: ApiKeyVerificationStatus;
  onApiKeyChange: (providerId: AiProviderConfig['id'], newKey: string) => void;
  onTriggerVerify: (providerId: AiProviderConfig['id'], keyToVerify: string) => Promise<void>;
  isLast?: boolean;
}

/**
 * A settings row component for inputting and verifying an API key for a specific provider.
 */
const ApiKeyInputRow: React.FC<ApiKeyInputRowProps> = ({
  providerConfig,
  apiKey,
  verificationStatus,
  onApiKeyChange,
  onTriggerVerify,
  isLast,
}) => {
  const { colors } = useTheme();
  // Internal state for responsive input, synced with prop for externally saved value
  const [currentInputValue, setCurrentInputValue] = useState(apiKey || '');

  useEffect(() => {
    // Sync when the persisted apiKey prop changes from parent (e.g., after save or load)
    if (apiKey !== currentInputValue) {
      setCurrentInputValue(apiKey || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // Only re-sync if the prop `apiKey` changes

  const handleInputChange = (text: string) => {
    setCurrentInputValue(text); // Update local input immediately
    onApiKeyChange(providerConfig.id, text); // Notify parent for debounce & save
  };

  const styles = StyleSheet.create({
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    input: {
      ...defaultStyles.textBody,
      color: colors.text,
      flex: 1, // Take available space before icon
      textAlign: 'right',
      paddingVertical: Spacing.xs, // Consistent with existing textInput style
      marginRight: Spacing.sm, // Space before icon
      minHeight: 44, // Consistent with existing textInput style
    },
    iconContainer: {
      paddingLeft: Spacing.xs, // Reduced from sm to xs
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 22 + Spacing.xs, // Icon size (22) + padding
      height: 44, // Match minHeight of input
    },
    errorText: {
        ...defaultStyles.textCaption,
        color: colors.error,
        textAlign: 'right',
        flex: 1,
        marginRight: Spacing.sm + 22 + Spacing.xs, // Align with where input ends
        marginTop: 4, // Replaced Spacing.xxs with a small pixel value
    },
  });

  const renderVerificationIcon = () => {
    let iconElement = null;

    switch (verificationStatus) {
      case 'loading':
      case 'verifying_on_load':
        iconElement = <ActivityIndicator size="small" color={colors.primary} />;
        break;
      case 'valid':
        iconElement = <Ionicons name="checkmark-circle" size={22} color={colors.success} />;
        break;
      case 'invalid':
        iconElement = <Ionicons name="warning" size={22} color={colors.error} />;
        break;
      case 'idle':
      default:
        if (currentInputValue && verificationStatus === 'idle') {
          // Show a refresh/retry icon if idle but key exists (e.g., to manually re-verify)
          iconElement = (
            <TouchableOpacity onPress={() => onTriggerVerify(providerConfig.id, currentInputValue)}>
              <Ionicons name="refresh-circle-outline" size={24} color={colors.secondary} />
            </TouchableOpacity>
          );
        } else {
            iconElement = <View style={{width: 22}} />; // Placeholder for alignment when no icon
        }
        break;
    }
    return <View style={styles.iconContainer}>{iconElement}</View>; 
  };

  return (
    <View>
        <SettingsRow label={providerConfig.name} isLast={isLast}>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={currentInputValue}
                    onChangeText={handleInputChange}
                    placeholder={t('settings.apiKeyPlaceholder')}
                    placeholderTextColor={colors.secondary}
                    secureTextEntry={!!currentInputValue} // Show dots if there's any text
                    autoCapitalize="none"
                    autoCorrect={false}
                    // textContentType={currentInputValue ? 'password' : 'none'} // Causes issues on some androids
                    accessibilityLabel={`${providerConfig.name} API Key`}
                />
                {renderVerificationIcon()}
            </View>
        </SettingsRow>
        {/* {verificationStatus === 'invalid' && 
            <Text style={styles.errorText}>{t('settings.apiKeyInvalidError')}</Text> 
        } */} 
        {/* Commented out direct error text, icon is primary feedback. Can be added if needed. */}
    </View>
  );
};

export default ApiKeyInputRow; 