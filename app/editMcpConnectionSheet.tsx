/**
 * EditMcpConnectionSheet provides a formSheet screen for creating or editing an MCP connection (url, authToken) with a blurred background.
 * Should be used as a screen in a stack navigator with presentation: 'formSheet'.
 * @returns {JSX.Element} The EditMcpConnectionSheet screen component.
 * @example
 * // To open:
 * router.push('/editMcpConnectionSheet');
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMcpConnectionStore } from '@/store/mcpStore';
import { useMcpStore } from '@/store/mcpStore';
import { t } from '@/config/i18n';
import { Spacing, BorderRadius, defaultStyles } from '@/constants/Styles';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { verifyMcpServer } from '../utils/mcp/mcpServerVerifier';
import { verifyMcpServerExtended, ServerInfo, McpServerDefinitions } from '../utils/mcp/extended';
import { McpServerStatus } from '../utils/mcp/mcpServerVerifier';

const EditMcpConnectionSheet = (): JSX.Element => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hydrate = useMcpConnectionStore((s) => s.hydrate);
  const add = useMcpConnectionStore((s) => s.addConnection);
  const update = useMcpConnectionStore((s) => s.updateConnection);
  const remove = useMcpConnectionStore((s) => s.removeConnection);
  const connections = useMcpConnectionStore((s) => s.connections);
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const urlInputRef = useRef<TextInput>(null);
  const setTools = useMcpStore((s) => s.setTools);

  const isEditing = typeof params.url === 'string';
  const initial = isEditing ? connections.find((c) => c.url === params.url) : undefined;
  const [url, setUrl] = useState<string>(initial?.url || (typeof params.url === 'string' ? params.url : ''));
  const [authToken, setAuthToken] = useState<string>(initial?.authToken || (typeof params.authToken === 'string' ? params.authToken : ''));

  // Feedback states (UI only, logic not implemented)
  const [isUrlInvalid, setIsUrlInvalid] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnectionSuccess, setIsConnectionSuccess] = useState<boolean>(false);
  const [isAuthTokenMissing, setIsAuthTokenMissing] = useState<boolean>(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverDefs, setServerDefs] = useState<McpServerDefinitions | null>(null);

  const iconOpacity = useRef(new Animated.Value(url ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(iconOpacity, {
      toValue: url ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [url]);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (urlInputRef.current) urlInputRef.current.focus(); }, []);
  useEffect(() => {
    if (isEditing && initial) {
      setUrl(initial.url);
      setAuthToken(initial.authToken || '');
    }
  }, [connections, params.url]);

  // Debounced MCP server verification
  useEffect(() => {
    if (!url && !authToken) {
      setIsUrlInvalid(false);
      setIsAuthTokenMissing(false);
      setIsConnectionSuccess(false);
      setIsConnecting(false);
      setServerInfo(null);
      setServerDefs(null);
      return;
    }
    let isActive = true;
    setIsConnecting(true);
    setIsUrlInvalid(false);
    setIsAuthTokenMissing(false);
    setIsConnectionSuccess(false);
    setServerInfo(null);
    setServerDefs(null);
    const handler = setTimeout(async () => {
      try {
        const { verifyMcpServerExtended } = await import('../utils/mcp/extended');
        const result = await verifyMcpServerExtended(url, authToken);
        console.log('[MCP] result', JSON.stringify(result, null, 2));
        if (!isActive) return;
        setIsConnecting(false);
        setIsUrlInvalid(result.status === McpServerStatus.InvalidUrl);
        setIsAuthTokenMissing(result.status === McpServerStatus.AuthTokenMissing);
        setIsConnectionSuccess(result.status === McpServerStatus.Success);
        setServerInfo(result.serverInfo ?? null);
        setServerDefs(result.definitions ?? null);
      } catch (e) {
        if (!isActive) return;
        setIsConnecting(false);
        setIsUrlInvalid(true);
        setIsAuthTokenMissing(false);
        setIsConnectionSuccess(false);
        setServerInfo(null);
        setServerDefs(null);
      }
    }, 400);
    return () => {
      isActive = false;
      clearTimeout(handler);
    };
  }, [url, authToken]);

  const handleSave = async () => {
    if (!url.trim()) return;
    const conn = { url: url.trim(), authToken: authToken.trim() || undefined };
    if (isEditing && initial) {
      await update(initial.url, conn);
    } else {
      await add(conn);
    }
    // Fetch tools for the new/updated connection and update global tools array
    try {
      const result = await verifyMcpServerExtended(conn.url, conn.authToken || '');
      if (result.status === McpServerStatus.Success && result.definitions?.tools) {
        setTools(result.definitions.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema || {},
          annotations: {},
          isActive: true,
        })));
        console.log('[EditMcpConnectionSheet] Tools updated in store:', result.definitions.tools);
      } else {
        setTools([]);
        console.log('[EditMcpConnectionSheet] No tools found or server not verified.');
      }
    } catch (err) {
      setTools([]);
      console.error('[EditMcpConnectionSheet] Error fetching tools for MCP connection:', err);
    }
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.delete', 'Delete'),
      t('editMcpConnectionSheet.deleteConfirm', 'Are you sure you want to delete this MCP connection?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (isEditing && initial) {
              await remove(initial.url);
              router.back();
            }
          },
        },
      ]
    );
  };

  // Icon logic for URL input
  let urlIcon = null;
  let urlIconColor = colors.icon;
  const isUrlFormatInvalid = url && !/^https?:\/\//.test(url);
  if (!url) {
    urlIcon = <Ionicons name="ellipse-outline" size={22} color={colors.icon} />;
    urlIconColor = 'transparent';
  } else if (isUrlFormatInvalid) {
    urlIcon = <Ionicons name="close-circle" size={22} color={colors.error} />;
    urlIconColor = colors.error;
  } else if (isConnecting) {
    urlIcon = <ActivityIndicator size="small" color={colors.primary} />;
    urlIconColor = colors.primary;
  } else if (isUrlInvalid) {
    urlIcon = <Ionicons name="close-circle" size={22} color={colors.error} />;
    urlIconColor = colors.error;
  } else if (isAuthTokenMissing) {
    urlIcon = <Ionicons name="alert-circle" size={22} color={colors.warning} />;
    urlIconColor = colors.warning;
  } else if (isConnectionSuccess) {
    urlIcon = <Ionicons name="checkmark-circle" size={22} color={colors.success} />;
    urlIconColor = colors.success;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Spacing.xl}
      >
        <Stack.Screen
          options={{
            presentation: 'formSheet',
            contentStyle: { backgroundColor: colors.background },
            headerTransparent: true,
            headerTitle: isEditing
              ? t('editMcpConnectionSheet.headerEdit', 'Edit MCP Connection')
              : t('editMcpConnectionSheet.headerCreate', 'Add MCP Connection'),
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
            headerRight: () => (
              <Text
                style={[defaultStyles.textButton, { color: colors.primary, marginRight: Spacing.md }]}
                onPress={handleSave}
              >
                {t('common.save', 'Save')}
              </Text>
            ),
          }}
        />
        <View style={[styles.sheetContainer, { paddingTop: Spacing.md, flex: 1 }]}>  
          <View style={styles.inputRow}>
            <TextInput
              ref={urlInputRef}
              style={[defaultStyles.input, styles.inputNoBorder, { color: colors.text, flex: 1 }]}
              placeholder={t('editMcpConnectionSheet.urlPlaceholder', 'MCP Server URL (required)')}
              value={url}
              onChangeText={setUrl}
              autoFocus
              placeholderTextColor={colors.disabledInputText}
              returnKeyType="next"
              numberOfLines={1}
              multiline={false}
            />
            <Animated.View
              style={[
                styles.rightCircleIcon,
                { backgroundColor: url ? urlIconColor + '22' : 'transparent', opacity: iconOpacity },
              ]}
              pointerEvents="none"
              accessible={false}
            >
              {urlIcon}
            </Animated.View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TextInput
            style={[defaultStyles.input, styles.inputNoBorder, { color: colors.text }]}
            placeholder={t('editMcpConnectionSheet.tokenPlaceholder', 'Auth Token (required)')}
            value={authToken}
            onChangeText={setAuthToken}
            placeholderTextColor={colors.disabledInputText}
            returnKeyType="done"
            numberOfLines={1}
            multiline={false}
          />
          <View style={styles.inputHelperRow}>
            {!url && (
              <Text style={[styles.helperText, { color: colors.icon }]}>
                {t('editMcpConnectionSheet.urlHelper', 'Enter the full MCP server URL (e.g. https://your-server.com/mcp).')}
              </Text>
            )}
            {isUrlInvalid && !!url && (
              <Text style={[styles.helperText, { color: colors.error }]}>
                {t('editMcpConnectionSheet.urlInvalid', 'Please enter a valid MCP server URL (must start with http:// or https://).')}
              </Text>
            )}
            {isConnecting && !!url && (
              <Text style={[styles.helperText, { color: colors.primary }]}>
                {t('editMcpConnectionSheet.connecting', 'Checking server connection...')}
              </Text>
            )}
            {isConnectionSuccess && !!url && (
              <Text style={[styles.helperText, { color: colors.success }]}>
                {t('editMcpConnectionSheet.connectionSuccess', 'Connection successful! This server is ready to use.')}
              </Text>
            )}
            {!isConnectionSuccess && !isConnecting && !isUrlInvalid && !!url && (
              <Text style={[styles.helperText, { color: colors.error }]}>
                {t('editMcpConnectionSheet.connectionFailed', 'Could not connect to the server. Please check the URL and try again.')}
              </Text>
            )}
          </View>
          {isConnectionSuccess && serverInfo && (
            <View style={styles.serverInfoBox}>
              <Text style={[styles.serverInfoTitle, { color: colors.text }]}> 
                {serverInfo.name} <Text style={styles.serverInfoVersion}>v{serverInfo.version}</Text>
              </Text>
              {!!serverInfo.description && (
                <Text style={[styles.serverInfoDesc, { color: colors.icon }]}>{serverInfo.description}</Text>
              )}
              <Text style={[styles.serverInfoMeta, { color: colors.icon }]}> 
                {t('editMcpConnectionSheet.toolsCount', { count: serverDefs?.tools.length ?? 0 })} ·
                {t('editMcpConnectionSheet.promptsCount', { count: serverDefs?.prompts.length ?? 0 })}
              </Text>
            </View>
          )}
        </View>
        {isEditing && initial && (
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.error + '22' }]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteBtnText, { color: colors.error }]}> 
              {t('editMcpConnectionSheet.delete', 'Delete this connection')}
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'flex-start',
  },
  inputNoBorder: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    marginBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 0,
  },
  feedbackText: {
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  rightCircleIcon: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 36,
    width: 36,
    borderRadius: 18,
  },
  inputHelperRow: {
    minHeight: 24,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  helperText: {
    fontSize: 13,
    marginTop: 0,
    marginBottom: 0,
  },
  serverInfoBox: {
    backgroundColor: Colors.grey[100],
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serverInfoTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  serverInfoVersion: {
    fontWeight: 'normal',
    fontSize: 13,
  },
  serverInfoDesc: {
    fontSize: 13,
    marginBottom: 2,
  },
  serverInfoMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default EditMcpConnectionSheet; 