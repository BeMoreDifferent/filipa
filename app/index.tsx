import React, { useEffect, useRef } from 'react';
import ChatPage from '@/components/ChatPage';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useChatStore } from '@/store/chatStore'; // Import useChatStore
import { MCPManager } from '@/utils/ai/mcpManager';
import ModelSelector from '@/components/settings/ModelSelector';
import NewChat from '@/components/chat/NewChat';

const Page = () => {
  const { chatId: chatIdFromRoute } = useLocalSearchParams<{ chatId?: string }>();
  const setCurrentChatId = useChatStore((state) => state.setCurrentChatId);
  const modelSelectorRef = useRef<{ present: () => void }>(null);

  useEffect(() => {
    const initMcpConnections = async () => {
      try {
        await MCPManager.getInstance().initializeAllConnections();
      } catch (error) {
        console.error('[AppIndexPage] Unexpected error during MCPManager.initializeAllConnections() call:', error);
      }
    };
    initMcpConnections();
  }, []);

  useEffect(() => {
    if (chatIdFromRoute) {
      setCurrentChatId(chatIdFromRoute);
    }
  }, [chatIdFromRoute, setCurrentChatId]);

  return (
    <>
      <View style={styles.container}>
        <ChatPage key={chatIdFromRoute} />
      </View>
      <ModelSelector ref={modelSelectorRef} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default Page;
