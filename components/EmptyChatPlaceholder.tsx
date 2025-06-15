import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { Spacing, defaultStyles } from '@/constants/Styles';
import { t } from '@/config/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Props for the EmptyChatPlaceholder component.
 */
interface EmptyChatPlaceholderProps {
  // Props if needed in the future, e.g., for different messages or icons
}

/**
 * A component to display when a chat is empty but an API key is configured,
 * prompting the user to start the conversation.
 */
const EmptyChatPlaceholder: React.FC<EmptyChatPlaceholderProps> = () => {
  const { colors } = useTheme();

  const insets = useSafeAreaInsets();
  
  const styles = StyleSheet.create({
    container: {
      flex: 1, 
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg + insets.top + 50,
    },
    icon: {
      marginBottom: Spacing.lg,
    },
    text: {
      ...defaultStyles.textHeading,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    // Add subTextStyle here if you plan to add sub-text
  });

  return (
    <View style={styles.container}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.primary} style={styles.icon} />
      <Text style={styles.text}>
        {t('chat.startConversationPrompt')}
      </Text>
    </View>
  );
};

export default EmptyChatPlaceholder; 