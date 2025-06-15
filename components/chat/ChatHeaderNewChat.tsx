import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useChatStore } from '@/store/chatStore';
import { useRouter } from 'expo-router';

/**
 * Header icon for starting a new chat session.
 * Calls the chat store's startNewChatSession on press and navigates to the new chat route.
 * @returns React element for new chat button
 * @example <ChatHeaderNewChat />
 */
export const ChatHeaderNewChat: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();

  const handleNewChat = async () => {
    const newChatUUID = await useChatStore.getState().startNewChatSession();
    console.log('newChatUUID', newChatUUID);
    if (newChatUUID) {
      router.replace({ pathname: '/', params: { chatId: newChatUUID } });
    }
  };

  return (
    <TouchableOpacity
      onPress={handleNewChat}
      style={{ marginRight: 8, width: 42, height: 22, borderRadius: 1, justifyContent: 'center', alignItems: 'center' }}
      accessibilityLabel="Start new chat"
      accessibilityRole="button"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.icon} />
    </TouchableOpacity>
  );
};

export default ChatHeaderNewChat; 