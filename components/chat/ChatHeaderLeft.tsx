import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useRouter } from 'expo-router';

/**
 * Header left component for chat history icon.
 */
export const ChatHeaderLeft: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/chat-history')}
      style={{ marginLeft: 0, width: 22, height: 22, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
      accessibilityLabel="View chat history"
      accessibilityRole="button"
    >
      <Ionicons name="menu-outline" size={18} color={colors.icon} />
    </TouchableOpacity>
  );
}; 