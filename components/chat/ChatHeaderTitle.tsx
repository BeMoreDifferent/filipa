import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { cleanAndTruncateModelName } from '@/utils/cleanAndTruncateModelName';
import { defaultStyles } from '@/constants/Styles';

/**
 * Props for ChatHeaderTitle.
 */
export interface ChatHeaderTitleProps {
  modelName?: string;
  onPress: () => void;
}

/**
 * Font size for chat header title and back title for consistency.
 */
export const CHAT_HEADER_FONT_SIZE = defaultStyles.textBody.fontSize ?? 17;

/**
 * Header title component for displaying the model name, truncated and cleaned.
 * @param modelName The model name to display
 * @param onPress Callback when the title is pressed
 */
export const ChatHeaderTitle: React.FC<ChatHeaderTitleProps> = ({ modelName, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessibilityLabel="Change model"
      accessibilityRole="button"
    >
      <Text style={{ color: colors.primary, fontWeight: 'bold', marginRight: 6, fontSize: CHAT_HEADER_FONT_SIZE }} numberOfLines={1} ellipsizeMode="tail">
        {modelName ? cleanAndTruncateModelName(modelName) : 'Select Model'}
      </Text>
      <Ionicons name="chevron-down" size={18} color={colors.primary} />
    </TouchableOpacity>
  );
}; 