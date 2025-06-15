import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Props for ChatHeaderRight.
 */
export interface ChatHeaderRightProps {
  navigation: any;
}

/**
 * Header right component for settings icon.
 * @param navigation Navigation object for routing
 */
export const ChatHeaderRight: React.FC<ChatHeaderRightProps> = ({ navigation }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('settings')}
      style={{ marginRight: 16, width: 22, height: 22, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}
      accessibilityLabel="Open settings"
      accessibilityRole="button"
    >
      <Ionicons name="settings-outline" size={18} color={colors.icon} />
    </TouchableOpacity>
  );
}; 