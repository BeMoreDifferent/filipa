// ChatPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Animated as RNAnimated } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import { shallow } from 'zustand/shallow';

import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput, { ChatInputRef } from './chat/ChatInput';
import NewChat from '@/components/chat/NewChat';
import { useChatStore } from '@/store/chatStore';
import { BorderRadius, Spacing } from '@/constants/Styles';
import { t } from '@/config/i18n';
import { toast } from '@backpackapp-io/react-native-toast';
import { useTheme } from '@/providers/ThemeProvider';
import type { Message } from '@/utils/Interfaces';

/**
 * ChatPageInternal renders the main chat UI, including chat history and input.
 * It is optimized for minimal re-renders and smooth user experience.
 */
const ChatPageInternal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { colors } = useTheme();

  // ---------- store selectors ----------
  const messages = useChatStore<Message[]>(s => s.messages);
  const isStreaming = useChatStore(s => s.isStreaming);
  const isDbInitialized = useChatStore(s => s.isDbInitialized);
  const initializeDatabase = useChatStore(s => s.initializeDatabase);
  const sendMessage = useChatStore(s => s.sendMessage);
  const startNewChatAndSendMessage = useChatStore(s => s.startNewChatAndSendMessage);
  const currentChatId = useChatStore(s => s.currentChatId);

  // ---------- refs / local state ----------
  const listRef = useRef<FlashList<Message>>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [chatInputHeight] = useState(Spacing.lg); // ChatInput controls its own height
  const chatInputRef = useRef<ChatInputRef>(null);

  // ----- keyboard height (Reanimated) -----
  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler({
    onMove: e => {
      'worklet';
      keyboardHeight.value = e.height;
    },
    onEnd: e => {
      'worklet';
      keyboardHeight.value = e.height;
    },
  });
  const spacerStyle = useAnimatedStyle(() => ({
    height: Math.max(keyboardHeight.value, insets.bottom),
  }));

  // ----- fade-ins (RN Animated) -----
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const listFadeAnim = useRef(new RNAnimated.Value(0)).current;

  // ---------- db init ----------
  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  // ---------- API-key presence ----------
  useEffect(() => {
    if (!isDbInitialized) return;
    let mounted = true;
    (async () => {
      const cfg = await import('@/store/ModelStore').then(m => m.getAllProviderConfigs());
      const providerIds = Object.keys(cfg);
      const found = await Promise.all(
        providerIds.map(id => import('@/store/ModelStore').then(m => m.getApiKey(id))),
      ).then(list => list.some(Boolean));
      if (mounted) setHasApiKey(found);
    })();
    return () => {
      mounted = false;
    };
  }, [isDbInitialized]);

  const isReady = isDbInitialized && hasApiKey && currentChatId;

  // screen fade
  useEffect(() => {
    RNAnimated.timing(fadeAnim, {
      toValue: isReady ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isReady, fadeAnim]);

  // list fade
  const hasUserMsg = useMemo(() => messages.some((m: Message) => m.role === 'user'), [messages]);
  const showList = currentChatId && hasUserMsg;

  useEffect(() => {
    RNAnimated.timing(listFadeAnim, {
      toValue: showList ? 1 : 0,
      duration: showList ? 300 : 200,
      useNativeDriver: true,
    }).start();
  }, [showList, listFadeAnim]);

  useEffect(() => {
    if (isReady && !showList) {
      // Focus the ChatInput to open the keyboard
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 250); // Delay to ensure mount/animation
    }
  }, [isReady, showList]);

  const handleSend = useCallback(
    (txt: string) => {
      if (!hasApiKey) {
        toast.error(t('chat.sendFailedNoKeyToast'));
        return;
      }
      if (!isStreaming && txt.trim().length) {
        // If there is no current chat or no user messages, start a new chat and send
        const hasUserMsg = messages.some((m: Message) => m.role === 'user');
        if (!currentChatId || !hasUserMsg) {
          startNewChatAndSendMessage(txt.trim());
        } else {
          sendMessage(txt.trim());
        }
      }
    },
    [hasApiKey, isStreaming, sendMessage, startNewChatAndSendMessage, currentChatId, messages],
  );

  useEffect(() => {
    if (messages && messages.length > 0) {
      console.debug('[ChatPage] Current message history:');
      messages.forEach((msg, idx) => {
        const msgStr = JSON.stringify(msg);
        if (msgStr.length > 2000) {
          console.dir({ [`[${idx}]`]: JSON.parse(msgStr.slice(0, 2000)) }, { depth: null });
          console.debug(`[${idx}] ... [truncated, full object > 2000 chars]`);
        } else {
          console.dir({ [`[${idx}]`]: msg }, { depth: null });
        }
      });
    } else {
      console.debug('[ChatPage] No messages in history.');
    }
  }, [messages]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <RNAnimated.View style={{ flex: 1, opacity: fadeAnim }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.contentArea}>
          {!hasApiKey ? (
            <View style={[styles.flexOne, styles.centered]}>
              <Text>API Key missing. Please configure one.</Text>
            </View>
          ) : (
            <>
              {!showList && <NewChat />}
              {showList && (
                <RNAnimated.View
                  style={{
                    flex: 1,
                    opacity: listFadeAnim,
                    position: !showList ? 'absolute' : 'relative',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <FlashList
                    ref={listRef}
                    data={messages as Message[]}
                    renderItem={({ item }) => <ChatMessage {...item} />}
                    keyExtractor={item => item.id}
                    estimatedItemSize={100}
                    contentContainerStyle={{
                      paddingTop: headerHeight + 10,
                      paddingBottom: chatInputHeight + insets.bottom + 20,
                    }}
                    keyboardDismissMode="interactive"
                    ListEmptyComponent={
                      messages.length === 0 ? (
                        <View style={[styles.flexOne, styles.centered]}>
                          <Text>No messages yet. Start typing!</Text>
                        </View>
                      ) : null
                    }
                  />
                </RNAnimated.View>
              )}
            </>
          )}
        </View>

        {/* fixed ChatInput */}
        <View
          style={[styles.ChatInput, {
            paddingBottom: Spacing.sm,//bottomInset + 10,
            backgroundColor: colors.card,
            borderColor: colors.border,
          }]}
          pointerEvents="box-none"
        >
          <ChatInput ref={chatInputRef} isStreaming={isStreaming} onSendMessage={handleSend} />
          {/* animated spacer */}
          <ReAnimated.View style={spacerStyle} />
        </View>
      </View>
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  contentArea: { flex: 1 },
  ChatInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
});

export default React.memo(ChatPageInternal);