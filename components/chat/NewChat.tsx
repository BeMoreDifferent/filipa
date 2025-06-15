import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Alert, FlatList, Platform, KeyboardAvoidingView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/config/i18n';
import { useRouter } from 'expo-router';
import { useTextElementStore } from '../../store/textElementStore';
import { Spacing, BorderRadius, Typography } from '@/constants/Styles';
import { StyledButton } from '@/components/base/StyledButton';
import { useChatStore } from '@/store/chatStore';
import LoadingIndicator from './loadingIndicator';

/**
 * NewChat screen: shows a welcome and a horizontal row of prompt bubbles (from textElementStore),
 * with an Add Prompt button at the end. Prompts are styled as chat bubbles.
 * @returns {JSX.Element}
 */
const NewChat: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const elements = useTextElementStore((s) => s.elements);
  const hydrate = useTextElementStore((s) => s.hydrate);
  const startNewChatAndSendMessage = useChatStore((s) => s.startNewChatAndSendMessage);

  React.useEffect(() => { hydrate(); }, [hydrate]);

  const handleAdd = useCallback(() => {
    router.push('/editTextSheet');
  }, [router]);

  const handleEdit = useCallback((id: string) => {
    router.push({ pathname: '/editTextSheet', params: { id } });
  }, [router]);

  // When a prompt is clicked, start a new chat and send its text as a message
  const handlePromptClick = useCallback(async (text: string) => {
    await startNewChatAndSendMessage(text);
    // Optionally: router.push('/') if you want to navigate to the main chat view
  }, [startNewChatAndSendMessage]);

  // Render each prompt as an outline StyledButton
  const renderPrompt = ({ item }: any) => (
    <StyledButton
      key={item.id}
      title={item.title}
      style={styles.promptButton}
      color={item.color}
      textColor={colors.text}
      textStyle={[styles.promptTitle, { color: colors.text }]}
      accessibilityLabel={item.title}
      onPress={() => handlePromptClick(item.text)}
      onLongPress={() => handleEdit(item.id)}
    />
  );

  // Add Prompt button styled as an outline StyledButton
  const renderAddPrompt = () => (
    <StyledButton
      key="add-prompt"
      title={t('editTextSheet.addPrompt', 'Add Prompt')}
      variant="outline"
      icon={<Ionicons name="add" size={20} color={colors.primary} />}
      style={[styles.promptButton, styles.addPromptButton]}
      textStyle={[styles.promptTitle, { color: colors.primary }]}
      accessibilityLabel={t('editTextSheet.addPrompt', 'Add Prompt')}
      onPress={handleAdd}
    />
  );

  return (
    <Animated.View entering={FadeInUp} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.container}>
          <View style={styles.promptSection}>
            <View style={styles.promptListContainer}>
              {elements.length === 0 ? (
                renderAddPrompt()
              ) : (
                <>
                  {elements.map((item) => renderPrompt({ item }))}
                  {renderAddPrompt()}
                </>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  icon: {
    marginBottom: Spacing.md,
  },
  promptSection: {
    width: '100%',
    marginTop: Spacing.lg,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  promptListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    width: '100%',
  },
  promptButton: {
    marginRight: Spacing.sm,
    minHeight: 44,
    minWidth: 44,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addPromptButton: {
    marginRight: 0,
  },
  promptTitle: {
    ...Typography.material.buttonObject,
    flexShrink: 1,
  },
  emptyPrompt: {
    textAlign: 'center',
    color: '#888',
    marginTop: 24,
  },
});

export default NewChat; 