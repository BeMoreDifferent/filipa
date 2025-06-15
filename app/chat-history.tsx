import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ScrollView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useChatHistoryStore, ChatHistoryListItem } from '@/store/chatHistoryStore';
import { useTheme } from '@/providers/ThemeProvider';
import { defaultStyles, Spacing, BorderRadius } from '@/constants/Styles';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '@/store/chatStore';
import { t } from '@/config/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { deleteAllChats } from '@/utils/Database';
import { StyledButton } from '@/components/base/StyledButton';

// Helper: get relative time string
function getRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t('chatHistory.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('chatHistory.minutesAgo', { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('chatHistory.hoursAgo', { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return t('chatHistory.yesterday');
  if (diffDay < 7) return t('chatHistory.daysAgo', { count: diffDay });
  return date.toLocaleDateString();
}

// At the top, after imports:
type ChatHistoryListItemWithExtras = ChatHistoryListItem & {
  lastMessageTimestamp?: string;
  tags?: string[];
};

// Helper: group chats by day
function groupChatsByDay(chats: ChatHistoryListItem[]) {
  const groups: Record<string, ChatHistoryListItem[]> = {};
  chats.forEach(chat => {
    const item = chat as ChatHistoryListItemWithExtras;
    const ts = item.lastMessageTimestamp || undefined;
    if (!ts) {
      groups['noDate'] = groups['noDate'] || [];
      groups['noDate'].push(chat);
      return;
    }
    const date = new Date(ts);
    const now = new Date();
    // Remove time from both dates for accurate day diff
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = nowOnly.getTime() - dateOnly.getTime();
    const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let key = '';
    if (diffDay === 0) key = t('chatHistory.today', 'Today');
    else if (diffDay === 1) key = t('chatHistory.yesterday', 'Yesterday');
    else if (diffDay < 7) key = t('chatHistory.thisWeek', 'This week');
    else key = t('chatHistory.older', 'Older');
    groups[key] = groups[key] || [];
    groups[key].push(chat);
  });
  return groups;
}

const ChatHistoryScreen = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const dbInstance = useChatStore((state) => state.dbInstance);
  const { chatHistories, loadChatHistories, setActiveChatInView } = useChatHistoryStore();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const { query: search = '' } = useLocalSearchParams<{ query?: string }>();
  const currentChatId = useChatStore((state) => state.currentChatId);
  const deleteChatSession = useChatStore((state) => state.deleteChatSession);

  useEffect(() => {
    if (dbInstance) {
      console.log('[ChatHistoryScreen] DB instance from ChatStore available, loading histories.');
      loadChatHistories(dbInstance);
    } else {
      console.warn('[ChatHistoryScreen] DB instance from ChatStore not yet available.');
    }
  }, [dbInstance, loadChatHistories]);

  // Collect all tags (future-proof, currently always empty)
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    chatHistories.forEach(chat => (chat as ChatHistoryListItemWithExtras).tags?.forEach((tag: string) => tags.add(tag)));
    return Array.from(tags);
  }, [chatHistories]);

  // Filter and search
  const filteredChats = useMemo(() => {
    let filtered = chatHistories;
    if (selectedTag) {
      filtered = filtered.filter(chat => (chat as ChatHistoryListItemWithExtras).tags?.includes(selectedTag));
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(chat => chat.title.toLowerCase().includes(s));
    }
    return filtered;
  }, [chatHistories, search, selectedTag]);

  // Group by day
  const grouped = useMemo(() => groupChatsByDay(filteredChats), [filteredChats]);
  const groupKeys = Object.keys(grouped);

  const handleChatPress = (item: ChatHistoryListItem) => {
    setActiveChatInView(item.uuid);
    router.replace({ pathname: '/', params: { chatId: item.uuid } });
  };

  const handleDeleteChat = (chat: ChatHistoryListItemWithExtras) => {
    if (!dbInstance) return;
    Alert.alert(
      t('chatHistory.deleteTitle', 'Delete Chat'),
      t('chatHistory.deleteConfirm', 'Are you sure you want to delete this chat? This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await deleteChatSession(chat.uuid);
            if (success) {
              await loadChatHistories(dbInstance); // Reload chat list from DB
              if (chat.isActive) {
                setActiveChatInView(null);
                router.replace('/');
              }
              // Optionally show a toast/snackbar here
            } else {
              // Optionally show a toast/snackbar for error
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllChats = async () => {
    if (!dbInstance) return;
    Alert.alert(
      t('settings.deleteAllChatsTitle', 'Delete All Chats?'),
      t('settings.deleteAllChatsConfirm', 'Are you sure you want to delete all chat history? This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await deleteAllChats(dbInstance);
            if (success) {
              useChatHistoryStore.getState().clearChatHistories();
              await loadChatHistories(dbInstance);
              setActiveChatInView(null);
              // Optionally navigate to root if needed
              // router.replace('/');
              // Show toast/snackbar for success
              // You can use a Toast library or Alert.alert for now
              Alert.alert(t('common.success', 'Success'), t('settings.deleteAllChatsSuccess', 'All chat history deleted.'));
            } else {
              Alert.alert(t('common.error', 'Error'), t('chatHistory.deleteError', 'Failed to delete chat. Please try again.'));
            }
          },
        },
      ]
    );
  };

  const renderChatItem = (item: ChatHistoryListItem, idx?: number, arrLen?: number) => {
    const chat = item as ChatHistoryListItemWithExtras;
    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          { backgroundColor: colors.card },
          chat.isActive ? { backgroundColor: colors.primary } : undefined,
          idx === 0 ? { borderTopLeftRadius: BorderRadius.md, borderTopRightRadius: BorderRadius.md } : undefined,
          arrLen && idx === arrLen - 1 ? { borderBottomLeftRadius: BorderRadius.md, borderBottomRightRadius: BorderRadius.md } : undefined,
          idx !== 0 ? { borderTopWidth: 0 } : undefined,
        ]}
        onPress={() => handleChatPress(chat)}
      >
        <View style={styles.chatInfo}>
          <Text
            style={[
              defaultStyles.textBody,
              styles.chatTitle,
              { color: chat.isActive ? Colors.dark.text : colors.text }
            ]}
            numberOfLines={1}
          >
            {chat.title || t('drawer.untitledChat')}
          </Text>
          <Text style={[styles.timestamp, { color: colors.secondary }]}> {getRelativeTime(chat.lastMessageTimestamp)} </Text>
          {/* Tags (future-proof) */}
          {chat.tags && chat.tags.length > 0 && (
            <View style={styles.tagRow}>
              {chat.tags.map((tag: string) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.border }]}> 
                  <Text style={[styles.tagText, { color: colors.secondary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {chat.unseenMessagesCount > 0 && (
          <View style={[styles.unseenBadge, { backgroundColor: colors.primary }]}> 
            <Text style={[styles.unseenText, { color: Colors.dark.text }]}>{chat.unseenMessagesCount}</Text>
          </View>
        )}
        {/* Delete button */}
        <TouchableOpacity
          onPress={() => handleDeleteChat(chat)}
          style={styles.deleteButton}
          accessibilityLabel={t('chatHistory.deleteChat', 'Delete chat')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color="#B0B0B0" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: headerHeight }]}> 
      {/* Tag filter bar (future-proof) */}
      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilterBar}>
          <TouchableOpacity
            style={[styles.tag, !selectedTag && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedTag(null)}
          >
            <Text style={[styles.tagText, !selectedTag && { color: Colors.dark.text }]}>{t('chatHistory.allTags', 'All')}</Text>
          </TouchableOpacity>
          {allTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, selectedTag === tag && { backgroundColor: colors.primary }]}
              onPress={() => setSelectedTag(tag)}
            >
              <Text style={[styles.tagText, selectedTag === tag && { color: Colors.dark.text }]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {/* Grouped chat list */}
      {groupKeys.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.icon} />
          <Text style={[defaultStyles.textBody, { color: colors.text, marginTop: Spacing.md }]}> {t('chatHistory.noResults', 'No chat history found.')}</Text>
        </View>
      ) : (
        <FlatList
          data={groupKeys}
          keyExtractor={k => k}
          renderItem={({ item: groupKey }) => (
            <View>
              <Text style={[styles.groupHeader, { color: colors.secondary }]}>{groupKey}</Text>
              {grouped[groupKey].map((chat, idx, arr) => (
                <View key={chat.uuid}>
                  {renderChatItem(chat, idx, arr.length)}
                  {idx < arr.length - 1 && (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={[styles.listContentContainer, { paddingBottom: insets.bottom + 64 }]}
          ListFooterComponent={
            <View style={{ marginTop: Spacing.lg, marginHorizontal: Spacing.sm, marginBottom: Spacing.xl }}>
              <StyledButton
                title={t('settings.deleteAllChatsButton', 'Delete All Chat History')}
                variant="outline"
                color={colors.error}
                onPress={handleDeleteAllChats}
                accessibilityLabel={t('settings.deleteAllChatsButton', 'Delete All Chat History')}
              />
            </View>
          }
        />
      )}
    </View>
  );
};

const Colors = {
  dark: {
    text: '#FFFFFF',
  },
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 ,
    padding: Spacing.sm
  },
  listContentContainer: { paddingVertical: 0, paddingBottom: 0 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    marginHorizontal: 0,
    minHeight: 44,
    backgroundColor: 'transparent',
  },
  chatInfo: { flex: 1, marginRight: 4 },
  chatTitle: { 
    fontSize: defaultStyles.textBody.fontSize, 
    fontWeight: '500' 
  },
  timestamp: { fontSize: 12, marginTop: 0 },
  separator: { height: 1, marginHorizontal: 0 },
  unseenBadge: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unseenText: { fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: BorderRadius.sm,
    margin: Spacing.sm,
    paddingHorizontal: 8,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16, height: 44 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  tag: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
    backgroundColor: '#E0E0E0',
    minHeight: 28,
    justifyContent: 'center',
  },
  tagText: { fontSize: 12, fontWeight: '500' },
  tagFilterBar: { flexDirection: 'row', marginHorizontal: Spacing.sm, marginBottom: 2 },
  groupHeader: { 
    fontSize: 13, fontWeight: 'bold', 
    marginLeft: Spacing.sm,
    marginTop: Spacing.md, 
    marginBottom: Spacing.sm },
  deleteButton: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatHistoryScreen; 