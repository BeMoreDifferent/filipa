import 'openai/shims/web';
import { Stack } from 'expo-router';
import React, { Suspense, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { RootSiblingParent } from 'react-native-root-siblings';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toasts } from '@backpackapp-io/react-native-toast';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Colors } from '@/constants/Colors';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { ActivityIndicator, View, Appearance, TouchableOpacity, Text } from 'react-native';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import * as SystemStore from '@/store/ModelStore';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useChatStore } from '@/store/chatStore';
import * as ModelStore from '@/store/ModelStore';
import ModelSelector from '@/components/settings/ModelSelector';
import { FeedbackProvider } from '@/components/base/FeedbackProvider';
import { t } from '@/config/i18n';
import { ChatHeaderTitle, CHAT_HEADER_FONT_SIZE } from '@/components/chat/ChatHeaderTitle';
import { ChatHeaderRight } from '@/components/chat/ChatHeaderRight';
import { ChatHeaderLeft } from '@/components/chat/ChatHeaderLeft';
import ChatHeaderNewChat from '@/components/chat/ChatHeaderNewChat';
import { hydrateToolsFromStorage, useMcpStore } from '@/store/mcpStore';

const SQLiteLoadingFallback = () => {
  const { theme } = useTheme();
  const loadingBackgroundColor = theme === 'dark' ? Colors.dark.background : Colors.light.background;
  const loadingIndicatorColor = theme === 'dark' ? Colors.dark.primary : Colors.light.primary;
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: loadingBackgroundColor }}>
      <ActivityIndicator size="large" color={loadingIndicatorColor} />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
};

const getHeaderOptions = ({ theme, colors, title }: { theme: 'light' | 'dark'; colors: any; title: string }) => {
  if (Platform.OS === 'ios') {
    return {
      headerBlurEffect: (theme === 'dark' ? 'dark' : 'light') as 'regular' | 'light' | 'dark',
      headerTransparent: true,
      headerTitle: title,
      headerTitleStyle: { color: colors.text, fontSize: CHAT_HEADER_FONT_SIZE, fontWeight: 'bold' as const },
      headerBackTitleStyle: { fontSize: CHAT_HEADER_FONT_SIZE, fontWeight: 'normal' as const },
      headerTintColor: colors.primary,
    };
  }
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTitle: title,
    headerTitleStyle: { color: colors.text, fontSize: CHAT_HEADER_FONT_SIZE, fontWeight: 'bold' as const },
    headerTintColor: colors.primary,
    headerTransparent: false,
  };
};

const RootLayoutNav = () => {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const modelSelectorRef = React.useRef<{ present: () => void }>(null);
  const selectedModelId = useChatStore(state => state.selectedModelId);
  const model = ModelStore.getModelById(selectedModelId);

  return (
    <>
      <Stack
        screenOptions={{}}
      >
        <Stack.Screen
          name="index"
          options={({ navigation }) => {
            const baseOptions = getHeaderOptions({ theme, colors, title: t('chatHistory.chat', 'Chat') });
            return {
              ...baseOptions,
              headerTitle: () => <ChatHeaderTitle modelName={model?.name} onPress={() => modelSelectorRef.current?.present()} />,
              headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ChatHeaderNewChat />
                  <ChatHeaderRight navigation={navigation} />
                </View>
              ),
              headerLeft: () => <ChatHeaderLeft />,
            };
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerBackTitle: t('chatHistory.chat', 'Chat'),
            ...getHeaderOptions({ theme, colors, title: t('settings.title', 'Settings') }),
          }}
        />
        <Stack.Screen
          name="chat-history"
          options={{
            headerBackTitle: t('chatHistory.chat', 'Chat'),
            animation: 'slide_from_left',
            ...getHeaderOptions({ theme, colors, title: t('chatHistory.title', 'Chat History') }),
          }}
        />
        <Stack.Screen
          name="editTextSheet"
          options={{
            presentation: 'formSheet',
            headerTransparent: true,
            headerTitle: 'Edit Text',
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.primary,
          }}
        />
        <Stack.Screen
          name="editMcpConnectionSheet"
          options={{
            presentation: 'formSheet',
            headerTransparent: true,
            headerTitle: t('editMcpConnectionSheet.headerCreate', 'Add MCP Connection'),
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.primary,
          }}
        />
      </Stack>
      <ModelSelector ref={modelSelectorRef} />
    </>
  );
};

const AppContent = () => {
  const [isInitialSetupComplete, setIsInitialSetupComplete] = useState<boolean>(false);
  const [isMcpHydrated, setIsMcpHydrated] = useState<boolean>(false);
  const { setTheme, theme, colors } = useTheme();
  const setChatStoreDbInstance = useChatStore((state) => state.setDbInstance);
  const initializeChatStoreDatabase = useChatStore((state) => state.initializeDatabase);
  const chatStoreDbInstance = useChatStore((state) => state.dbInstance);
  const setTools = useMcpStore((s) => s.setTools);

  const db = useSQLiteContext();

  useEffect(() => {
    (async () => {
      const tools = await hydrateToolsFromStorage();
      if (tools.length > 0) {
        setTools(tools);
      }
      setIsMcpHydrated(true);
    })();
  }, [setTools]);

  useEffect(() => {
    if (db && !chatStoreDbInstance) {
      setChatStoreDbInstance(db);
      initializeChatStoreDatabase();
    }
  }, [db, setChatStoreDbInstance, initializeChatStoreDatabase, chatStoreDbInstance]);

  useEffect(() => {
    let isActive = true;
    const loadInitialTheme = async () => {
      try {
        if (setTheme) {
          const preference = await SystemStore.getThemePreference();
          let newTheme: 'light' | 'dark' = Appearance.getColorScheme() ?? 'light';
          if (preference && preference !== 'system') {
            newTheme = preference;
          } else if (preference === 'system') {
          }
          if (newTheme !== theme && isActive) {
            setTheme(newTheme);
          }
        }

      } catch (error) {
        console.error("Failed during initial theme setup:", error);
      } finally {
        if (isActive) {
          setIsInitialSetupComplete(true);
        }
      }
    };

    loadInitialTheme();
    return () => {
      isActive = false;
    };
  }, [setTheme, theme]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(async ({ colorScheme }) => {
      if (setTheme) {
        const preference = await SystemStore.getThemePreference();
        if (preference === 'system') {
          setTheme(colorScheme ?? 'light');
        }
      }
    });
    return () => subscription.remove();
  }, [setTheme]);

  if (!isInitialSetupComplete || !isMcpHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }} >
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex:1, backgroundColor: colors.background }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <BottomSheetModalProvider>
        <Suspense fallback={<SQLiteLoadingFallback />}>
          <ThemedRootLayoutNav />
        </Suspense>
      </BottomSheetModalProvider>
    </View>
  );
};

const ThemedRootLayoutNav = () => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RootLayoutNav />
    </View>
  );
};

export default function RootLayout() {
  return (
    <RootSiblingParent>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <SQLiteProvider databaseName="chat.db">
              <ThemeProvider>
                <FeedbackProvider>
                  <AppContent />
                </FeedbackProvider>
              </ThemeProvider>
            </SQLiteProvider>
          </KeyboardProvider>
          <Toasts />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </RootSiblingParent>
  );
}
