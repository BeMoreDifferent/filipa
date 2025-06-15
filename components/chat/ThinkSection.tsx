import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import Markdown, { type ASTNode, type RenderRules } from 'react-native-markdown-display';
import { useTheme } from '@/providers/ThemeProvider';
import { Spacing, BorderRadius } from '@/constants/Styles';
import { material, systemWeights } from 'react-native-typography';
import { t } from '@/config/i18n';
import MarkdownImageRenderer from '../common/MarkdownImageRenderer';
import { Colors as GlobalColors } from '@/constants/Colors';

interface ThinkSectionProps {
  thinkContent: string;
  initialCollapsed: boolean;
}

const ThinkSection: React.FC<ThinkSectionProps> = ({ thinkContent, initialCollapsed }) => {
  const { colors, theme } = useTheme();
  const [isThinkContentVisible, setIsThinkContentVisible] = useState(!initialCollapsed);

  const thinkContentOpacity = useSharedValue(0);
  const thinkContentTranslateY = useSharedValue(5);
  

  useEffect(() => {
    thinkContentOpacity.value = withTiming(isThinkContentVisible ? 1 : 0, { duration: 200, easing: Easing.out(Easing.ease) });
    thinkContentTranslateY.value = withTiming(isThinkContentVisible ? 0 : 5, { duration: 200, easing: Easing.out(Easing.ease) });
    
  }, [isThinkContentVisible]);

  const animatedThinkContentStyle = useAnimatedStyle(() => {
    return {
      opacity: thinkContentOpacity.value,
      transform: [{ translateY: thinkContentTranslateY.value }],
      
      overflow: 'hidden',
    };
  });

  const baseMarkdownStyles = useMemo(() => StyleSheet.create({
    body: { ...material.body1Object, color: colors.text },
    strong: { ...systemWeights.bold },
    em: { fontStyle: 'italic' },
    link: { color: colors.primary, textDecorationLine: 'underline' },
    code_block: {
      fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
      backgroundColor: theme === 'dark' ? GlobalColors.grey[800] : GlobalColors.grey[200],
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      color: theme === 'dark' ? GlobalColors.grey[200] : GlobalColors.grey[800],
      ...material.captionObject,
    },
    code_inline: {
      fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
      backgroundColor: theme === 'dark' ? GlobalColors.grey[700] : GlobalColors.grey[200],
      paddingHorizontal: 4,
      borderRadius: BorderRadius.xs,
      color: theme === 'dark' ? GlobalColors.grey[200] : GlobalColors.grey[700],
      ...material.captionObject,
    },
    heading1: { ...material.display1Object, ...systemWeights.bold, color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
    heading2: { ...material.headlineObject, ...systemWeights.semibold, color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.xs },
    heading3: { ...material.titleObject, ...systemWeights.semibold, color: colors.text, marginTop: Spacing.sm, marginBottom: Spacing.xs },
    heading4: { ...material.subheadingObject, ...systemWeights.bold, color: colors.text, marginTop: Spacing.sm, marginBottom: Spacing.xs },
    heading5: { ...material.body2Object, ...systemWeights.bold, color: colors.text, marginTop: Spacing.sm, marginBottom: Spacing.xs },
    heading6: { ...material.captionObject, ...systemWeights.bold, color: colors.text, marginTop: Spacing.sm, marginBottom: Spacing.xs },
    bullet_list: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
    ordered_list: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
    list_item: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.xs, ...material.body1Object, color: colors.text },
  }), [colors, material, systemWeights, Spacing, BorderRadius, theme, GlobalColors]);

  const thinkMarkdownStyles = useMemo(() => ({
    ...baseMarkdownStyles,
    body: {
      ...baseMarkdownStyles.body,
      fontSize: material.captionObject.fontSize,
      color: colors.text,
    },
    code_block: {
      ...baseMarkdownStyles.code_block,
      fontSize: material.captionObject.fontSize ? material.captionObject.fontSize * 0.9 : 10,
      padding: Spacing.xs,
    },
    code_inline: {
      ...baseMarkdownStyles.code_inline,
      fontSize: material.captionObject.fontSize ? material.captionObject.fontSize * 0.9 : 10,
    },
  }), [baseMarkdownStyles, colors, material.captionObject.fontSize, Spacing]);
  
  const thinkMarkdownRules: RenderRules = useMemo(() => ({
    image: (node, children, parent, styles) => {
      const { src, alt } = node.attributes;
      return (
        <MarkdownImageRenderer 
          key={node.key} 
          src={src} 
          alt={alt} 
        />
      );
    },
  }), []);

  const styles = StyleSheet.create({
    container: {
      marginBottom: isThinkContentVisible ? Spacing.xs : 0, 
      marginHorizontal: Spacing.md,
    },
    thinkTogglePressable: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    thinkToggleText: {
      ...material.captionObject,
      color: colors.icon,
      ...systemWeights.semibold,
    },
    thinkContentWrapper: {
      marginTop: Spacing.xs,
    },
  });

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setIsThinkContentVisible(!isThinkContentVisible)}
        style={styles.thinkTogglePressable}
        accessibilityRole="button"
        accessibilityLabel={isThinkContentVisible ? t('chat.hideThoughtProcess') : t('chat.showThoughtProcess')}
      >
        <Ionicons
          name={isThinkContentVisible ? 'chevron-down-outline' : 'chevron-forward-outline'}
          size={material.captionObject.fontSize ? material.captionObject.fontSize * 1.2 : 14}
          color={colors.icon}
        />
        <Text style={styles.thinkToggleText}>{t('chat.thoughtProcess')}</Text>
      </Pressable>
      <Animated.View style={[styles.thinkContentWrapper, animatedThinkContentStyle]}>
        {isThinkContentVisible && (
            <Markdown style={thinkMarkdownStyles} rules={thinkMarkdownRules}>
                {thinkContent}
            </Markdown>
        )}
      </Animated.View>
    </View>
  );
};

export default ThinkSection; 