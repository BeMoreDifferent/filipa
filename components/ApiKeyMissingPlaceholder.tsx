import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { Spacing, defaultStyles } from '@/constants/Styles';
import { t } from '@/config/i18n';

/**
 * A component to display when no API key is configured,
 * prompting the user to go to settings.
 */
const ApiKeyMissingPlaceholder: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.background, // Ensure background matches theme
    },
    icon: {
      marginBottom: Spacing.lg,
    },
    titleText: {
      ...defaultStyles.textHeading,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    messageText: {
      ...defaultStyles.textBody,
      color: colors.secondary, // Using secondary for less emphasis as per original
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
    button: {
      ...defaultStyles.button,
      backgroundColor: colors.primary,
    },
    buttonText: {
      ...defaultStyles.buttonText,
      color: colors.background, // Text color for primary button
    },
  });

  return (
    <View style={styles.container}>
      <Ionicons name="key-outline" size={64} color={colors.secondary} style={styles.icon} />
      <Text style={styles.titleText}>
        {t('error.apiKeyMissingTitle')}
      </Text>
      <Text style={styles.messageText}>
        {t('chat.noApiKeyMessage')}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/settings')}
      >
        <Text style={styles.buttonText}>{t('chat.goToSettingsButton')}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ApiKeyMissingPlaceholder; 