import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor, interpolate } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import Markdown from 'react-native-markdown-display';
import { Spacing, BorderRadius } from '@/constants/Styles';
import { Colors } from '@/constants/Colors';
import { stripMarkdown } from '@/utils/stripMarkdown';

interface ToggleMessageProps {
  role: string;
  content?: string | any[] | null;
  colors: any;
  material: any;
  toolCallId?: string;
  toolName?: string;
}

const ANIMATION_DURATION = 250;

const ToggleMessage: React.FC<ToggleMessageProps> = ({ role, content, colors, material, toolCallId, toolName }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const contentHeight = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(5);
  const iconRotation = useSharedValue(0);
  const cardBgProgress = useSharedValue(0);

  useEffect(() => {
    if (!isCollapsed && measuredHeight > 0) {
      contentHeight.value = withTiming(measuredHeight, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      contentOpacity.value = withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      contentTranslateY.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      iconRotation.value = withTiming(90, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      cardBgProgress.value = withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
    } else {
      contentHeight.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      contentOpacity.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      contentTranslateY.value = withTiming(5, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      iconRotation.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
      cardBgProgress.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.ease) });
    }
  }, [isCollapsed, measuredHeight]);

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
      height: contentHeight.value,
      overflow: 'hidden',
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${iconRotation.value}deg` }],
    };
  });

  const animatedCardStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      cardBgProgress.value,
      [0, 1],
      ['transparent', colors.card]
    );
    const padding = interpolate(cardBgProgress.value, [0, 1], [0, Spacing.sm]);
    return {
      backgroundColor: bgColor,
      borderRadius: BorderRadius.md,
      paddingTop: padding,
      paddingBottom: padding,
      marginBottom: Spacing.xs,
      width: '100%',
    };
  });

  const isJsonString = (str: string): boolean => {
    try {
      const obj = JSON.parse(str);
      return typeof obj === 'object' && obj !== null;
    } catch {
      return false;
    }
  };

  const formatJson = (str: string): string => {
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch {
      return str;
    }
  };

  let displayContent: string | undefined = undefined;
  if (typeof content === 'string') {
    displayContent = content;
  } else if (Array.isArray(content)) {
    const textPart = content.find(part => part.type === 'text');
    if (textPart && typeof textPart.text === 'string') {
      displayContent = textPart.text;
    }
  }

  // If content is JSON, pretty-print and use monospace/code style
  const isJson = typeof displayContent === 'string' && isJsonString(displayContent);
  const formattedContent = isJson ? formatJson(displayContent!) : displayContent;

  // Single-line preview: remove line breaks, trim, ellipsis, no overflow
  const previewText = displayContent
    ? stripMarkdown(displayContent).replace(/\s+/g, ' ').trim()
    : '';

  // Split summary into role and preview for styling
  const summaryRole = toolName || toolCallId
    ? `TOOL: ${toolName ? toolName : ''}${toolCallId ? ` (id: ${toolCallId})` : ''}`
    : `${role.toUpperCase()}:`;
  const summaryPreview = ` ${previewText}`;

  const baseMarkdownStyles = useMemo(() => StyleSheet.create({
    body: {
      ...material.body1Object,
      color: colors.text,
    },
  }), [colors, material]);

  // Hidden measurement view
  const onContentLayout = (event: any) => {
    if (event?.nativeEvent?.layout?.height && event.nativeEvent.layout.height !== measuredHeight) {
      setMeasuredHeight(event.nativeEvent.layout.height);
    }
  };

  // Use a lighter color for the summary text (textMuted or grey[500])
  const summaryTextColor = colors.textMuted || Colors.grey[500];
  const summaryRoleColor = colors.textMuted || Colors.grey[600];

  return (
    <Animated.View style={[styles.row, animatedCardStyle]}>
      <View style={[styles.messageContentContainer, { width: '100%' }]}>  
        <View style={styles.innerRow}>
          <Pressable
            onPress={() => setIsCollapsed(!isCollapsed)}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={isCollapsed ? `Show ${role} message` : `Hide ${role} message`}
          >
            <Animated.View style={animatedIconStyle}>
              <Ionicons
                name={'chevron-forward-outline'}
                size={22}
                color={Colors.primary[500]}
                style={{ marginRight: Spacing.xs }}
              />
            </Animated.View>
            <Text
              style={[styles.summaryText, { color: summaryTextColor, marginRight: Spacing.md }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              <Text style={[styles.summaryRole, { color: summaryRoleColor }]}>{summaryRole}</Text>
              <Text style={styles.summaryPreview}>{summaryPreview}</Text>
            </Text>
          </Pressable>
        </View>
        {/* Hidden measurement view, only rendered when measuredHeight is 0 */}
        {measuredHeight === 0 && (
          <View
            style={{ position: 'absolute', opacity: 0, zIndex: -1, width: '100%' }}
            onLayout={onContentLayout}
            pointerEvents="none"
          >
            {isJson ? (
              <Text style={styles.jsonBlock}>{formattedContent}</Text>
            ) : (
              <Markdown style={baseMarkdownStyles}>{displayContent || ''}</Markdown>
            )}
          </View>
        )}
        {/* Animated content, only rendered when measuredHeight > 0 */}
        {measuredHeight > 0 && (
          <Animated.View style={[{ marginTop: Spacing.xs }, animatedContentStyle]}>
            <View style={{ width: '100%' }}>
              {isJson ? (
                <Text style={styles.jsonBlock}>{formattedContent}</Text>
              ) : (
                <Markdown style={baseMarkdownStyles}>{displayContent || ''}</Markdown>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
  },
  messageContentContainer: {
    flexShrink: 1,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.sm,
    textAlignVertical: 'center',
    justifyContent: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  summaryText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRole: {
    fontWeight: '600',
  },
  summaryPreview: {
    fontWeight: '400',
  },
  jsonBlock: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    backgroundColor: Colors.grey[100],
    color: Colors.grey[800],
    fontSize: 13,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
});

export default ToggleMessage; 