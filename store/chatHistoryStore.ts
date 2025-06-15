import { create } from 'zustand';
import { type SQLiteDatabase } from 'expo-sqlite';
import { getChats, getChatIntegerIdByUUID, markChatMessagesAsSeen as dbMarkChatMessagesAsSeen, getLastMessageTimestampForChat, deleteChatAndMessagesByUUID } from '@/utils/Database';
import { Chat } from '@/utils/Interfaces'; // Assuming Chat interface has id, uuid, title

/**
 * Represents an item in the chat history list for the drawer.
 */
export interface ChatHistoryListItem {
  uuid: string;
  id: number; // The integer ID from the chats table
  title: string;
  unseenMessagesCount: number;
  isActive: boolean; // New field
  lastMessageTimestamp?: string; // Add this field
  // lastMessagePreview?: string; // Future enhancement
}

/**
 * Defines the state and actions for the chat history store.
 */
interface ChatHistoryState {
  chatHistories: ChatHistoryListItem[];
  /** Loads chat histories from the database and populates the store. */
  loadChatHistories: (db: SQLiteDatabase | null) => Promise<void>;
  /** Adds a newly created chat to the history list. */
  addChatToView: (chat: { id: number; uuid: string; title: string }) => void;
  /** Removes a chat from the history list by its UUID. */
  removeChatFromView: (uuid: string) => void;
  /** Updates the title of an existing chat in the history list. */
  updateChatTitleInView: (uuid: string, newTitle: string) => void;
  /** Sets the unseen messages count for a specific chat. */
  setUnseenCount: (uuid: string, count: number) => void;
  /** Clears the unseen messages count for a chat and marks messages as seen in DB. */
  markChatAsReadAndViewed: (db: SQLiteDatabase, uuid: string) => Promise<void>; 
  /** Sets a specific chat as active in the view, and others as inactive. */
  setActiveChatInView: (uuid: string | null) => void; // New action
  // Internal or for specific updates if needed
  _updateChatHistoryItem: (uuid: string, updates: Partial<ChatHistoryListItem>) => void;
  /**
   * Clears all chat histories from the store (used after deleting all chats)
   */
  clearChatHistories: () => void;
  /**
   * Deletes a chat and its associated messages from the database and removes it from the store.
   * @param db The SQLite database instance.
   * @param uuid The UUID of the chat to delete.
   * @returns Promise<boolean> indicating success.
   */
  deleteChat: (db: SQLiteDatabase, uuid: string) => Promise<boolean>;
}

export const useChatHistoryStore = create<ChatHistoryState>((set, get) => ({
  chatHistories: [],

  loadChatHistories: async (db: SQLiteDatabase | null) => {
    if (!db) {
      console.error('[ChatHistoryStore] Failed to load chat histories: Database instance is null.');
      set({ chatHistories: [] });
      return;
    }
    try {
      const fetchedChats: Chat[] = await getChats(db);
      // Fetch last message timestamp for each chat
      const historyItems: ChatHistoryListItem[] = await Promise.all(
        fetchedChats.map(async chat => {
          const lastMessageTimestampRaw = await getLastMessageTimestampForChat(db, chat.id);
          const lastMessageTimestamp = lastMessageTimestampRaw ?? undefined;
          return {
            id: chat.id,
            uuid: chat.uuid,
            title: chat.title || 'Untitled Chat',
            unseenMessagesCount: 0, // Placeholder: Actual unseen count logic TBD
            isActive: false, // Initialize isActive
            lastMessageTimestamp,
          };
        })
      );
      // Sort by lastMessageTimestamp descending (newest first), fallback to id if missing
      historyItems.sort((a, b) => {
        if (a.lastMessageTimestamp && b.lastMessageTimestamp) {
          return b.lastMessageTimestamp.localeCompare(a.lastMessageTimestamp);
        } else if (a.lastMessageTimestamp) {
          return -1;
        } else if (b.lastMessageTimestamp) {
          return 1;
        } else {
          return b.id - a.id;
        }
      });
      console.log(`[ChatHistoryStore][DEBUG] Loaded ${historyItems.length} chat histories.`);
      set({ chatHistories: historyItems });
    } catch (error) {
      console.error('[ChatHistoryStore] Failed to load chat histories:', error);
      set({ chatHistories: [] });
    }
  },

  addChatToView: (chat) => {
    set((state) => ({
      chatHistories: [
        { ...chat, unseenMessagesCount: 0, isActive: false }, // Initialize isActive
        ...state.chatHistories
      ].slice(0, 15), // Maintain max 15 items
    }));
  },

  removeChatFromView: (uuid) => {
    set((state) => ({
      chatHistories: state.chatHistories.filter(chat => chat.uuid !== uuid),
    }));
  },

  updateChatTitleInView: (uuid, newTitle) => {
    set((state) => ({
      chatHistories: state.chatHistories.map(chat =>
        chat.uuid === uuid ? { ...chat, title: newTitle } : chat
      ),
    }));
  },
  
  setUnseenCount: (uuid, count) => {
    get()._updateChatHistoryItem(uuid, { unseenMessagesCount: count });
  },

  markChatAsReadAndViewed: async (db, uuid) => {
    const chatIntegerId = await getChatIntegerIdByUUID(db, uuid);
    if (chatIntegerId !== null) {
      try {
        await dbMarkChatMessagesAsSeen(db, chatIntegerId);
        get()._updateChatHistoryItem(uuid, { unseenMessagesCount: 0 });
      } catch (error) {
        console.error(`[ChatHistoryStore] Failed to mark chat ${uuid} as read:`, error);
      }
    } else {
      console.warn(`[ChatHistoryStore] Chat with UUID ${uuid} not found for marking as read.`);
    }
  },

  setActiveChatInView: (uuid) => {
    console.log(`[ChatHistoryStore][DEBUG] setActiveChatInView called with UUID: ${uuid}`);
    set((state) => ({
      chatHistories: state.chatHistories.map(chat => ({
        ...chat,
        isActive: chat.uuid === uuid,
      })),
    }));
  },

  _updateChatHistoryItem: (uuid, updates) => {
    set((state) => ({
      chatHistories: state.chatHistories.map(chat =>
        chat.uuid === uuid ? { ...chat, ...updates } : chat
      ),
    }));
  },

  /**
   * Clears all chat histories from the store (used after deleting all chats)
   */
  clearChatHistories: () => {
    set({ chatHistories: [] });
  },

  /**
   * Deletes a chat and its associated messages from the database and removes it from the store.
   * @param db The SQLite database instance.
   * @param uuid The UUID of the chat to delete.
   * @returns Promise<boolean> indicating success.
   */
  deleteChat: async (db: SQLiteDatabase, uuid: string): Promise<boolean> => {
    try {
      // Dynamically import to avoid circular deps
      const { deleteChatAndMessagesByUUID } = await import('@/utils/Database');
      const deleted = await deleteChatAndMessagesByUUID(db, uuid);
      if (deleted) {
        // Remove from store
        set((state) => ({
          chatHistories: state.chatHistories.filter(chat => chat.uuid !== uuid).map(chat => ({ ...chat, isActive: false })),
        }));
      }
      return deleted;
    } catch (error) {
      console.error(`[ChatHistoryStore] Failed to delete chat ${uuid}:`, error);
      return false;
    }
  },
})); 