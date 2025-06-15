import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius, defaultStyles } from '@/constants/Styles';
import { copyImageToClipboard, downloadAndSaveImage, shareImage } from '@/utils/Image';
import { Message } from '@/utils/Interfaces';
import { Link } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import Markdown, { RenderRules, type ASTNode } from 'react-native-markdown-display';
import { material, systemWeights } from 'react-native-typography';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import ThinkSection from './ThinkSection';
import MarkdownImageRenderer from '../common/MarkdownImageRenderer';
import Ionicons from '@expo/vector-icons/Ionicons';
import ToggleMessage from './ToggleMessage';
import LoadingIndicator from './loadingIndicator';

const ChatMessage = ({
  id,
  chat_id,
  model,
  role,
  content,
  name,
  tool_calls,
  tool_call_id,
  timestamp,
  data,
  response,
  raw_message,
  loading,
}: Message & { loading?: boolean }) => {
  const { colors, theme } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const [imageLoading, setImageLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(role !== 'user' && role !== 'assistant');

  const imageUrl = data?.imageUrl as string | undefined;

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  const copyToClipboard = async () => {
    if (typeof content === 'string') {
      await Clipboard.setStringAsync(content);
    } else if (Array.isArray(content)){
      const textPart = content.find(part => part.type === 'text');
      if (textPart && typeof textPart.text === 'string') {
        await Clipboard.setStringAsync(textPart.text);
      }
    }
  };

  const baseMarkdownStyles = useMemo(() => StyleSheet.create({
    body: {
      ...material.body1Object,
      color: colors.text,
    },
    strong: {
      ...systemWeights.bold,
    },
    em: {
      fontStyle: 'italic',
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    code_block: {
      fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
      backgroundColor: colors.card,
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      color: colors.text,
    },
    code_inline: {
      fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
      backgroundColor: colors.card,
      paddingHorizontal: 4,
      borderRadius: BorderRadius.xs,
      color: colors.text,
      ...material.captionObject,
    },
    heading1: {
      ...material.display1Object,
      ...systemWeights.bold,
      color: colors.text,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    heading2: {
      ...material.headlineObject,
      ...systemWeights.semibold,
      color: colors.text,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    heading3: {
      ...material.titleObject,
      ...systemWeights.semibold,
      color: colors.text,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    heading4: {
      ...material.subheadingObject,
      ...systemWeights.bold,
      color: colors.text,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    heading5: {
      ...material.body2Object,
      ...systemWeights.bold,
      color: colors.text,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    heading6: {
      ...material.captionObject,
      ...systemWeights.bold,
      color: colors.text,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    bullet_list: {
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    ordered_list: {
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    list_item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: Spacing.xs,
      ...material.body1Object,
      color: colors.text,
    },
  }), [colors, theme, Spacing, BorderRadius, material]);

  const userMarkdownStyles = useMemo(() => ({
    ...baseMarkdownStyles,
    body: {
      ...baseMarkdownStyles.body,
      color: colors.background,
    },
    link: {
      ...baseMarkdownStyles.link,
      color: colors.background,
    }
  }), [baseMarkdownStyles, colors, theme]);

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.md,
      marginVertical: Spacing.sm,
    },
    messageContentContainer: {
      flexShrink: 1,
    },
    userBubble: {
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: 0,
      borderRadius: BorderRadius.lg,
      maxWidth: '80%',
      alignSelf: 'flex-end',
    },
    botBubble: {
      //backgroundColor: colors.background,
      borderRadius: 0,
      width: '100%',
      alignSelf: 'flex-start',
    },
    markdownContainer: {
    },
    previewImageContainer: {
      width: 240,
      height: 240,
      borderRadius: BorderRadius.md,
      marginVertical: Spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      borderRadius: BorderRadius.md,
    },
    imageLoadingSpinner: {
      position: 'absolute',
    },
    loading: {
      justifyContent: 'center',
      height: 26,
      padding: Spacing.sm,
    },
  });

  const isUserMessage = role === 'user';
  const isAssistantMessage = role === 'assistant';
  const isToolMessage = role === 'tool';
  const isOtherMessage = !isUserMessage && !isAssistantMessage && !isToolMessage;
  let activeMarkdownStyles = isUserMessage ? userMarkdownStyles : baseMarkdownStyles;

  let displayContent: string | undefined = undefined;
  if (typeof content === 'string') {
    displayContent = content;
  } else if (Array.isArray(content)) {
    const textPart = content.find(part => part.type === 'text');
    if (textPart && typeof textPart.text === 'string') {
      displayContent = textPart.text;
    }
  }

  // For tool messages, always display content (pretty-printed if JSON), and pass tool_call_id and name for summary
  if (isToolMessage) {
    let toolContent: string = '';
    if (typeof content === 'string') {
      toolContent = content;
    } else if (Array.isArray(content)) {
      // If content is an array, try to find a text part
      const textPart = content.find(part => part.type === 'text');
      if (textPart && typeof textPart.text === 'string') {
        toolContent = textPart.text;
      } else {
        toolContent = JSON.stringify(content, null, 2);
      }
    } else if (content !== null && content !== undefined) {
      toolContent = JSON.stringify(content, null, 2);
    }
    return (
      <ToggleMessage
        role={role}
        content={toolContent}
        toolCallId={tool_call_id}
        toolName={name}
        colors={colors}
        material={material}
      />
    );
  }

  const thinkTagOpen = '<think>';
  const thinkTagClose = '</think>';
  let contentBeforeThink: string | undefined;
  let thinkContent: string | undefined;
  let contentAfterThink: string | undefined;

  if (displayContent && displayContent.includes(thinkTagOpen) && displayContent.includes(thinkTagClose)) {
    const parts = displayContent.split(thinkTagOpen);
    contentBeforeThink = parts[0];
    if (parts[1]) {
      const subParts = parts[1].split(thinkTagClose);
      thinkContent = subParts[0];
      contentAfterThink = subParts[1];
    }
  } else {
    contentBeforeThink = displayContent;
  }
  
  const initialThinkCollapsed = role === 'assistant' && (loading === false || loading === undefined);

  const markdownRules: RenderRules = useMemo(() => ({
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
  }), [colors]);

  // Custom markdown container style for botBubble
  const botMarkdownContainerStyle = {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  };

  // Custom markdown rules for botBubble to remove padding for image blocks
  const botMarkdownRules: RenderRules = useMemo(() => ({
    ...markdownRules,
    image: (node, children, parent, styles) => (
      <View style={{ paddingHorizontal: 0, paddingVertical: Spacing.sm }}>
        <MarkdownImageRenderer key={node.key} src={node.attributes.src} alt={node.attributes.alt} />
      </View>
    ),
  }), [activeMarkdownStyles, markdownRules]);

  if (isOtherMessage) {
    return <ToggleMessage role={role} content={content} colors={colors} material={material} />;
  }

  return (
    <Animated.View style={[
      styles.row,
      isUserMessage && { justifyContent: 'flex-end', paddingHorizontal: Spacing.md },
      !isUserMessage && { paddingHorizontal: 0 },
      animatedStyle
    ]}>
      <View style={[
        styles.messageContentContainer,
        isUserMessage ? styles.userBubble : styles.botBubble
      ]}>
        {loading ? (
          <View style={styles.loading}>
            <LoadingIndicator color={isUserMessage ? colors.background : colors.primary} size={6} />
          </View>
        ) : (
          <>
            {imageUrl && (
              <View style={styles.previewImageContainer}>
                <Image 
                  source={{ uri: imageUrl }} 
                  style={styles.previewImage} 
                  onLoadEnd={() => setImageLoading(false)}
                />
                {imageLoading && (
                  <LoadingIndicator 
                    style={styles.imageLoadingSpinner}
                    color={colors.primary}
                    size={6} 
                  />
                )}
              </View>
            )}
            {contentBeforeThink && contentBeforeThink.trim() !== '' && (
              <Pressable
                onPress={copyToClipboard}
                style={
                  isUserMessage
                    ? styles.markdownContainer
                    : botMarkdownContainerStyle
                }
              >
                <Markdown
                  style={activeMarkdownStyles}
                  rules={isUserMessage ? markdownRules : botMarkdownRules}
                >
                  {contentBeforeThink}
                </Markdown>
              </Pressable>
            )}

            {thinkContent && thinkContent.trim() !== '' && (
              <ThinkSection 
                thinkContent={thinkContent} 
                initialCollapsed={initialThinkCollapsed} 
              />
            )}

            {contentAfterThink && contentAfterThink.trim() !== '' && (
              <Pressable
                onPress={copyToClipboard}
                style={
                  isUserMessage
                    ? styles.markdownContainer
                    : botMarkdownContainerStyle
                }
              >
                <Markdown
                  style={activeMarkdownStyles}
                  rules={isUserMessage ? markdownRules : botMarkdownRules}
                >
                  {contentAfterThink}
                </Markdown>
              </Pressable>
            )}
            
            {/* Fallback for empty space if no image and no text parts rendered for non-user, non-assistant messages */}
            {!imageUrl &&
             !(contentBeforeThink && contentBeforeThink.trim() !== '') &&
             !(thinkContent !== undefined && thinkContent.trim() !== '') && // Also check if thinkContent is not just empty
             !(contentAfterThink && contentAfterThink.trim() !== '') &&
             !isUserMessage && role !== 'assistant' && (
              <View style={{height: 10}} />
            )}
          </>
        )}
        {role === 'assistant' && !content && !imageUrl && loading === undefined && (
          <LoadingIndicator color={colors.primary} style={{ alignSelf: 'flex-start', padding: Spacing.sm }} size={6} />
        )}
      </View>
    </Animated.View>
  );
};

export default ChatMessage;
