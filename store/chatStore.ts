import { create } from 'zustand';
import { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { Message, ToolCall, Chat } from '@/utils/Interfaces';
import {
  migrateDbIfNeeded,
  getMessages as dbGetMessages,
  addMessage as dbAddMessage,
  addChat as dbAddChat,
  isDatabaseOpen,
  getChatIntegerIdByUUID,
  deleteChatAndMessagesByUUID as dbDeleteChatAndMessagesByUUID,
} from '@/utils/Database';
import * as ModelStore from '@/store/ModelStore';
import { AiApiClient } from '@/utils/ai/AiApiClient';

const aiApiClientInstance = new AiApiClient();
  
import { StreamUpdateCallback } from '@/utils/ai/AiApiClient';
import { handleAppError, AppError, showToast } from '@/utils/errorHandler';
import { t } from '@/config/i18n';
import { useChatHistoryStore } from '@/store/chatHistoryStore'; // Import chatHistoryStore
import { SYSTEM_PROMPT } from '@/constants/system_prompt';

// Define the state structure
export interface ChatState {
  messages: Message[];
  currentChatId: string | null; // UUID of the current chat
  isStreaming: boolean;
  isDbInitialized: boolean;
  dbInstance: SQLiteDatabase | null;
  selectedModelId: string;
  defaultSystemPrompt: string; // New: For default system message
  setDbInstance: (db: SQLiteDatabase) => void;
  initializeDatabase: () => Promise<void>;
  startNewChatSession: (initialSystemPrompt?: string) => Promise<string | null>; // Modified
  loadMessages: (chatUUID: string, requestId: string) => Promise<boolean>;
  addMessageOptimistic: (message: Message) => void;
  addToolResponseMessage: (toolCallId: string, toolName: string, toolResult: any) => Promise<void>; // New
  appendStreamChunk: (chunk: string, isToolCall?: boolean) => void;
  updateLastMessageToolCalls: (toolCalls: ToolCall[]) => void;
  handleStreamEnd: () => Promise<void>;
  handleStreamError: (error: Error) => void;
  sendMessage: (contentValue: string | any[], options?: { name?: string }) => Promise<void>;
  setCurrentChatId: (uuid: string | null) => Promise<boolean>;
  setSelectedModelId: (modelId: string) => void;
  deleteChatSession: (chatUUID: string) => Promise<boolean>;
  startNewChatAndSendMessage: (contentValue: string | any[], options?: { name?: string }) => Promise<void>;
}

// Add to the top-level scope of the store (outside the Zustand store definition):
let latestChatRequestId: string | null = null;

/**
 * Retrieves a valid and open SQLite database instance from the store's state.
 * @param getFn - The Zustand store's get function.
 * @returns The SQLiteDatabase instance if valid and open, otherwise null.
 */
const getValidDbInstance = (getFn: () => ChatState): SQLiteDatabase | null => {
  const db = getFn().dbInstance;
  if (!db || !isDatabaseOpen(db)) {
    if (!getFn().isDbInitialized && db) {
      // Attempt to log or handle the case where db instance exists but isDbInitialized is false
      // console.warn('getValidDbInstance: DB instance exists but isDbInitialized is false.');
    } else if (!db) {
      // console.warn('getValidDbInstance: DB instance is null.');
    }
    return null;
  }
  return db;
};

// Create the Zustand store
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentChatId: null,
  isStreaming: false,
  isDbInitialized: false,
  dbInstance: null,
  selectedModelId: 'gpt-4o-mini', 
  defaultSystemPrompt: SYSTEM_PROMPT, // Default system prompt

  setDbInstance: (db) => {
    set({ dbInstance: db });
  },

  /**
   * Initializes the database by migrating if needed and then ensures an active chat session exists.
   */
  initializeDatabase: async () => {
    const currentDb = get().dbInstance;
    if (!currentDb) {
      handleAppError(new AppError('DB_NOT_SET_UP', t('error.dbConnection')), t('error.dbInitFailed'));
      return;
    }
    if (get().isDbInitialized && get().currentChatId) return; // Already initialized and has a chat

    try {
      if (!isDatabaseOpen(currentDb)) throw new AppError('DB_NOT_OPEN', t('error.dbConnection'));
      await migrateDbIfNeeded(currentDb);
      set({ isDbInitialized: true });
      // Always start a new chat session on fresh load (no persistence)
      await get().startNewChatSession();
    } catch (error) {
      handleAppError(error, t('error.dbInitFailed'));
      set({ isDbInitialized: false, currentChatId: null, messages: [] }); // Reset on failure
    }
  },

  /**
   * Creates a new chat session in the database, sets it as the current active chat
   * in both the store and persistent storage (ModelStore), and clears current messages.
   * @returns A promise that resolves with the UUID of the newly created chat, or null if an error occurred.
   */
  startNewChatSession: async (initialSystemPrompt?: string): Promise<string | null> => {
    try {
      const newChatUUID = randomUUID();
      const systemPrompt = initialSystemPrompt || get().defaultSystemPrompt;
      const systemMessage: Message = {
        id: randomUUID(),
        chat_id: 0,
        model: get().selectedModelId,
        role: 'system',
        content: systemPrompt,
        timestamp: new Date().toISOString(),
        raw_message: { type: 'system_instruction' },
      };
      set({
        currentChatId: newChatUUID,
        messages: [systemMessage],
        isStreaming: false,
      });
      return newChatUUID;
    } catch (error) {
      handleAppError(error, t('error.createChatFailed'));
      return null;
    }
  },

  /**
   * Loads messages for a given chat UUID from the database into the store.
   * @param chatUUID - The UUID of the chat whose messages are to be loaded.
   * @returns A promise that resolves with true if messages were loaded successfully, false otherwise.
   */
  loadMessages: async (chatUUID, requestId) => {
    const truncate = (id?: string | null) => id ? id.slice(0, 6) + '...' : 'null';
    // Removed: console.log(`[ChatStore][LOG] loadMessages called for UUID: ${truncate(chatUUID)}, requestId: ${requestId}, at: ${new Date().toISOString()}`);
    const db = getValidDbInstance(get);
    if (!db || !get().isDbInitialized) {
      if (!get().isDbInitialized) {
        handleAppError(new AppError('DB_NOT_INIT_FOR_LOAD', t('error.dbConnection')), t('error.loadFailed'));
      }
      if (latestChatRequestId === requestId) {
        set({ messages: [] });
      }
      return false;
    }
    try {
      const chatIntegerId = await getChatIntegerIdByUUID(db, chatUUID);
      if (chatIntegerId !== null) {
        const messagesFromDb = await dbGetMessages(db, chatIntegerId);
        // Removed: console.log(`[ChatStore][LOG] loadMessages: Found ${messagesFromDb.length} messages for UUID: ${truncate(chatUUID)}, requestId: ${requestId}`);
        let finalMessages = messagesFromDb;
        if (messagesFromDb.length > 0 && messagesFromDb[0].role !== 'system') {
          const defaultSystemMessage: Message = {
            id: randomUUID(),
            chat_id: chatIntegerId,
            model: get().selectedModelId,
            role: 'system',
            content: get().defaultSystemPrompt,
            timestamp: new Date(new Date(messagesFromDb[0].timestamp).getTime() - 1).toISOString(),
            raw_message: { type: 'system_instruction_fallback' },
          };
          finalMessages = [defaultSystemMessage, ...messagesFromDb];
        } else if (messagesFromDb.length === 0) {
          const defaultSystemMessage: Message = {
            id: randomUUID(),
            chat_id: chatIntegerId,
            model: get().selectedModelId,
            role: 'system',
            content: get().defaultSystemPrompt,
            timestamp: new Date().toISOString(),
            raw_message: { type: 'system_instruction_empty_chat' },
          };
          finalMessages = [defaultSystemMessage];
        }
        if (latestChatRequestId === requestId) {
          // Removed: console.log(`[ChatStore][LOG] loadMessages: Setting messages for UUID: ${truncate(chatUUID)}, requestId: ${requestId}, messages count: ${finalMessages.length}`);
          set({ messages: finalMessages }); // Only set messages
        }
        return true;
      } else {
        if (latestChatRequestId === requestId) {
          set({ messages: [] }); // Only set messages
        }
        return false;
      }
    } catch (error) {
      handleAppError(error, t('error.loadFailed'));
      if (latestChatRequestId === requestId) {
        set({ messages: [] }); // Only set messages
      }
      return false;
    }
  },

  addMessageOptimistic: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  // New function to add a tool response message
  addToolResponseMessage: async (toolCallId: string, toolName: string, toolResult: any) => {
    const db = getValidDbInstance(get);
    const { currentChatId, selectedModelId, messages } = get();

    if (!currentChatId || !db) {
      handleAppError(new AppError('DB_OR_CHATID_MISSING_TOOL_RSP', t('error.dbConnection')), t('error.saveFailed'));
      return;
    }

    const chatIntegerId = await getChatIntegerIdByUUID(db, currentChatId);
    if (chatIntegerId === null) {
      handleAppError(new Error(`Chat session error: UUID ${currentChatId} not found for tool response.`), t('error.saveFailed'));
      return;
    }
    
    const contentString = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);

    const toolMessage: Message = {
      id: randomUUID(),
      chat_id: chatIntegerId,
      model: selectedModelId, // Or a specific identifier for tool messages
      role: 'tool',
      tool_call_id: toolCallId,
      name: toolName,
      content: contentString,
      timestamp: new Date().toISOString(),
      raw_message: { original_tool_result: toolResult },
    };

    try {
      await dbAddMessage(db, chatIntegerId, toolMessage);
      set({ messages: [...messages, toolMessage] }); // Add to local state
      
      // After adding tool message, immediately send all messages (including this tool response)
      // back to the assistant for it to continue.
      // This re-uses parts of the sendMessage logic but without creating a new user message.
      // It effectively says "here's the tool result, what's next?"

      // Prepare messages for the API, ensuring the latest (including the tool message) are present
      const messagesForApi = get().messages; // Get the most current messages array

      set({isStreaming: true}); // Indicate that we expect a response

      const botPlaceholder: Message = {
        id: randomUUID(),
        chat_id: chatIntegerId,
        model: selectedModelId,
        role: 'assistant',
        content: null,
        timestamp: new Date().toISOString(),
        raw_message: { status: 'placeholder_after_tool' },
      };
      set((state) => ({ messages: [...state.messages, botPlaceholder] }));


      const streamCallback: StreamUpdateCallback = (chunk: string | null, error?: Error, isFinished?: boolean) => {
        if (error) { get().handleStreamError(error); return; }
        if (chunk !== null && chunk !== undefined) { get().appendStreamChunk(chunk); }
        if (isFinished) { get().handleStreamEnd(); }
      };
      
      await aiApiClientInstance.streamChatCompletionWithMcp(
        messagesForApi.filter(m => m.id !== botPlaceholder.id), // Send history up to and including tool response
        streamCallback, 
        selectedModelId, 
        "Activepieces", // Or determine interacting component dynamically
        (toolMessages) => {
          const db = getValidDbInstance(get);
          if (!db) return;
          toolMessages.forEach(async (msg) => {
            const toolMsg = { ...msg, chat_id: chatIntegerId };
            await dbAddMessage(db, chatIntegerId, toolMsg);
            set((state) => ({ messages: [...state.messages, toolMsg] }));
          });
        }
      );

    } catch (error) {
      handleAppError(error, t('error.sendMessageFailed'));
      set((state) => {
        // Attempt to find the bot placeholder that was added in this function scope
        const currentBotPlaceholder = state.messages.find(m => 
          m.role === 'assistant' && 
          m.raw_message?.status === 'placeholder_after_tool' &&
          m.content === null
        );
        return {
          isStreaming: false,
          // Clean up the tool message and placeholder if API call failed immediately
          messages: state.messages.filter(m => 
            m.id !== toolMessage.id && 
            (currentBotPlaceholder ? m.id !== currentBotPlaceholder.id : true)
          ),
        };
      });
    }
  },

  appendStreamChunk: (chunk, _isToolCall) => {
    set((state) => {
      if (state.messages.length === 0 || state.messages[state.messages.length - 1].role !== 'assistant') {
        // This can happen if streaming starts before placeholder is set, or if messages were cleared.
        // Create a placeholder assistant message if one doesn't exist.
        const assistantPlaceholder: Message = {
          id: randomUUID(),
          chat_id: state.currentChatId ? 0 : 0, // Will be updated correctly in handleStreamEnd or if chat_id is known
          model: state.selectedModelId,
          role: 'assistant',
          content: chunk || '',
          timestamp: new Date().toISOString(),
          raw_message: { status: 'streaming_placeholder' },
        };
        return { messages: [...state.messages, assistantPlaceholder], isStreaming: true };
      }
      const lastMessageIndex = state.messages.length - 1;
      const lastMessage = { ...state.messages[lastMessageIndex] };
      
      if (Array.isArray(lastMessage.content)) {
        let textPartFound = false;
        const newContent = lastMessage.content.map((part, index) => {
          if (index === lastMessage.content!.length - 1 && part.type === 'text') {
            textPartFound = true;
            return { ...part, text: (part.text || '') + (chunk || '') };
          }
          return part;
        });
        if (!textPartFound) {
          newContent.push({ type: 'text', text: chunk || '' });
        }
        lastMessage.content = newContent;
      } else {
        lastMessage.content = (typeof lastMessage.content === 'string' ? lastMessage.content : '') + (chunk || '');
      }
      const newMessages = [...state.messages];
      newMessages[lastMessageIndex] = lastMessage;
      return { messages: newMessages };
    });
  },

  updateLastMessageToolCalls: (toolCalls) => {
    set((state) => {
        if (state.messages.length === 0 || state.messages[state.messages.length - 1].role !== 'assistant') {
            return {};
        }
        const lastMessage = { ...state.messages[state.messages.length - 1] };
        lastMessage.tool_calls = [...(lastMessage.tool_calls || []), ...toolCalls];
        return { messages: [...state.messages.slice(0, -1), lastMessage] };
    });
  },

  /**
   * Finalizes a streamed message by saving it to the database.
   * Ensures the message has the correct chat_id and model information.
   */
  handleStreamEnd: async () => {
    const db = getValidDbInstance(get);
    const { messages, currentChatId: currentChatUUID, selectedModelId } = get();
    set({ isStreaming: false });

    if (!currentChatUUID || !db) {
        if(!db) {
          handleAppError(new AppError('DB_INVALID_STREAM_END', t('error.dbConnection')), t('error.saveFailed'));
        }
        if(!currentChatUUID) {
          handleAppError(new AppError('CHAT_ID_MISSING_STREAM_END', t('error.generic')), t('error.saveFailed'));
        }
        return;
    }

    const chatIntegerId = await getChatIntegerIdByUUID(db, currentChatUUID);
    if (chatIntegerId === null) {
      handleAppError(new Error(`Chat session error: UUID ${currentChatUUID} not found in DB during stream end.`), t('error.saveFailed'));
      // Potentially try to re-establish chat or clear state
      await get().startNewChatSession(); // Attempt to recover by starting a new session
      return;
    }

    const finalBotMessage = messages[messages.length - 1];
    if (finalBotMessage && finalBotMessage.role === 'assistant' && finalBotMessage.content !== null) {
      try {
        const messageToSave: Message = {
            ...finalBotMessage,
            chat_id: chatIntegerId, // Ensure correct integer chat_id
            model: finalBotMessage.model || selectedModelId,
            timestamp: finalBotMessage.timestamp || new Date().toISOString(),
            raw_message: finalBotMessage.raw_message?.status === 'placeholder' || finalBotMessage.raw_message?.status === 'streaming_placeholder' 
                         ? { streamed_content: finalBotMessage.content } 
                         : (finalBotMessage.raw_message || { streamed_content: finalBotMessage.content }),
        };
        await dbAddMessage(db, chatIntegerId, messageToSave);
      } catch (err) {
        handleAppError(err, t('error.saveFailed'));
      }
    }
  },

  handleStreamError: (error) => {
    handleAppError(error, t('error.streamError'));
    set((state) => {
      // Remove the potentially incomplete assistant message placeholder
      const newMessages = state.messages.length > 0 && 
                          (state.messages[state.messages.length - 1].role === 'assistant' && 
                           (state.messages[state.messages.length - 1].raw_message?.status === 'placeholder' || 
                            state.messages[state.messages.length - 1].raw_message?.status === 'streaming_placeholder'))
        ? state.messages.slice(0, -1) : state.messages;
      return {
        isStreaming: false,
        messages: newMessages,
      };
    });
  },

  /**
   * Sets the current active chat ID and loads its messages.
   * Also persists this ID as the last active chat in ModelStore.
   * If the provided UUID is not found, the store reflects this attempt,
   * and the UI should handle displaying an appropriate message (e.g., "chat not found").
   * If uuid is null, a new chat session is started.
   * @param uuid - The UUID of the chat to set as current, or null to start a new session.
   * @returns boolean - true if chat was found and set, false if not found
   */
  setCurrentChatId: async (uuid: string | null): Promise<boolean> => {
    const requestId = randomUUID();
    latestChatRequestId = requestId;
    const truncate = (id?: string | null) => id ? id.slice(0, 6) + '...' : 'null';
    // Removed: console.log(`[ChatStore][LOG] setCurrentChatId called with UUID: ${truncate(uuid)}, requestId: ${requestId}, currentChatId: ${truncate(get().currentChatId)}, messages count: ${get().messages.length}, at: ${new Date().toISOString()}`);
    if (uuid) {
      const loadSuccess = await get().loadMessages(uuid, requestId);
      // Removed: console.log(`[ChatStore][LOG] setCurrentChatId after loadMessages for UUID: ${truncate(uuid)}, requestId: ${requestId}, loadSuccess: ${loadSuccess}, at: ${new Date().toISOString()}`);
      if (latestChatRequestId !== requestId) {
        return false;
      }
      if (loadSuccess) {
        return true;
      } else {
        return false;
      }
    } else {
      const newChatId = await get().startNewChatSession();
      // Removed: console.log(`[ChatStore][LOG] setCurrentChatId started new chat session with UUID: ${truncate(newChatId)}, at: ${new Date().toISOString()}`);
      return true;
    }
  },

  setSelectedModelId: (modelId) => {
    set({ selectedModelId: modelId });
    ModelStore.setLastSelectedModelId(modelId); // Persist selection
  },

  /**
   * Deletes a chat session and all its associated messages from the database.
   * If the deleted chat is the current active chat, it starts a new chat session.
   * @param chatUUID - The UUID of the chat to delete.
   * @returns A promise that resolves with true if deletion was successful, false otherwise.
   */
  deleteChatSession: async (chatUUID: string): Promise<boolean> => {
    const db = getValidDbInstance(get);
    if (!db) {
      // console.error('[ChatStore] deleteChatSession: DB instance is not valid.');
      handleAppError(new AppError('DB_INVALID_FOR_DELETE', t('error.dbConnection')), t('error.deleteChatFailed'));
      return false;
    }

    const { currentChatId, startNewChatSession } = get();
    // console.log(`[ChatStore] deleteChatSession: Attempting to delete chat with UUID: ${chatUUID}`);

    try {
      const deleted = await dbDeleteChatAndMessagesByUUID(db, chatUUID);
      // console.log(`[ChatStore] deleteChatSession: dbDeleteChatAndMessagesByUUID returned: ${deleted} for UUID: ${chatUUID}`);

      if (deleted) {
        // Remove from chatHistoryStore
        useChatHistoryStore.getState().removeChatFromView(chatUUID);
        // console.log(`[ChatStore] deleteChatSession: Successfully marked as deleted for UUID: ${chatUUID}. Showing toast.`);
        showToast(t('chat.chatDeletedSuccess'), 'success');
        if (currentChatId === chatUUID) {
          // console.log(`[ChatStore] deleteChatSession: Deleted chat was the current chat (UUID: ${chatUUID}). Starting a new session.`);
          await get().startNewChatSession();
        }
        return true;
      } else {
        // console.warn(`[ChatStore] deleteChatSession: Deletion reported as failed by dbDeleteChatAndMessagesByUUID for UUID: ${chatUUID}.`);
        handleAppError(new AppError('DB_DELETE_CHAT_FAILED', t('error.deleteChatFailed')), t('error.deleteChatFailed'));
        return false;
      }
    } catch (error) {
      // console.error(`[ChatStore] deleteChatSession: Error during deletion process for UUID: ${chatUUID}:`, error);
      handleAppError(error, t('error.deleteChatFailed'));
      return false;
    }
  },

  /**
   * Sends a message from the user, handles streaming response, and saves messages to the database.
   * Ensures an active chat session exists, creating one if necessary (though ideally initialized before).
   */
  sendMessage: async (contentValue, options) => {
    const { isStreaming, selectedModelId, appendStreamChunk, updateLastMessageToolCalls, handleStreamEnd: performStreamEnd, handleStreamError: generalStreamError } = get();
    let db = getValidDbInstance(get);
    let currentChatUUID = get().currentChatId;
    let chatIntegerId: number | null = null;

    if (isStreaming) {
      showToast(t('chat.alreadyStreaming'), 'info');
      return;
    }

    if (!db || !get().isDbInitialized) {
      // console.warn('sendMessage: DB not ready. Attempting to initialize.');
      await get().initializeDatabase();
      db = getValidDbInstance(get);
      if (!db || !get().isDbInitialized) {
        handleAppError(new AppError('DB_INIT_FAILED_SEND', t('error.sendMessageFailed')), t('error.sendMessageFailed'));
        return;
      }
    }

    if (!currentChatUUID) {
      // console.warn('sendMessage: No currentChatUUID. Attempting to start new session.');
      // startNewChatSession now adds a system message to the store's messages array
      const newSessionUUID = await get().startNewChatSession(); 
      if (!newSessionUUID) {
        handleAppError(new AppError('NEW_SESSION_FAILED_SEND_NO_UUID', t('error.sendMessageFailed')), t('error.sendMessageFailed'));
        return;
      }
      currentChatUUID = newSessionUUID;
      // The messages array in store already has the system message from startNewChatSession
    }
    
    chatIntegerId = await getChatIntegerIdByUUID(db, currentChatUUID);

    if (chatIntegerId === null && currentChatUUID && db) {
      try {
        // The first message in the store's messages array should be our system message.
        const systemMessageFromStore = get().messages.find(m => m.role === 'system');
        if (!systemMessageFromStore || !systemMessageFromStore.content) {
          // This should not happen if startNewChatSession worked correctly
          throw new AppError('SYSTEM_MSG_MISSING_NEW_CHAT_SEND', 'System message is missing for new chat.');
        }

        // Save the system message to DB first for this new chat
        // Note: dbAddChat will be called next, which is fine. Or dbAddChat first, then system message.
        // Let's ensure chat record exists before message.

        const firstUserMessageContent = Array.isArray(contentValue) 
          ? contentValue.find(part => part.type === 'text')?.text || t('chat.newChatTitle') 
          : (typeof contentValue === 'string' ? contentValue : t('chat.newChatTitle'));
        const newChatTitle = firstUserMessageContent.substring(0, 50);
        
        // console.log(`sendMessage: Creating new chat in DB with UUID: ${currentChatUUID}, Title: ${newChatTitle}`);
        const newChatResult = await dbAddChat(db, newChatTitle, currentChatUUID);
        chatIntegerId = newChatResult.lastInsertRowId;

        if (!chatIntegerId || !newChatResult.uuid) {
          throw new AppError('DB_ADD_CHAT_FAILED_SEND', t('error.createChatFailed'));
        }

        // Now save the initial system message to the DB with the correct chat_id
        const systemMessageToSave: Message = {
          ...systemMessageFromStore,
          chat_id: chatIntegerId, 
        };
        await dbAddMessage(db, chatIntegerId, systemMessageToSave);
        // console.log(`sendMessage: Initial system message saved for new chat ${currentChatUUID} (DB ID: ${chatIntegerId})`);

        useChatHistoryStore.getState().addChatToView({
          id: chatIntegerId,
          uuid: newChatResult.uuid,
          title: newChatTitle,
        });
        // console.log(`[ChatStore] sendMessage: New chat ${newChatResult.uuid} added to chatHistoryStore.`);

      } catch (error) {
        handleAppError(error, t('error.createChatFailed'));
        set({isStreaming: false});
        return;
      }
    }

    if (chatIntegerId === null) { 
        handleAppError(new AppError('CHAT_INT_ID_MISSING_FINAL', t('error.sendMessageFailed')), t('error.sendMessageFailed'));
        set({isStreaming: false});
        return;
    }

    set({ isStreaming: true });
    
    const userMessage: Message = {
      id: randomUUID(),
      chat_id: chatIntegerId, // Now guaranteed to be a valid integer ID
      model: selectedModelId, 
      role: 'user',
      content: contentValue,
      name: options?.name,
      timestamp: new Date().toISOString(),
      raw_message: { original_content: contentValue, sender_name: options?.name },
    };

    // Get current messages from store (which includes system message for new chats)
    const currentMessagesInStore = get().messages;
    // Ensure user message is not duplicated if already added by optimistic update elsewhere (should not be the case here)
    const messagesForApi = currentMessagesInStore.find(m => m.id === userMessage.id) 
      ? [...currentMessagesInStore] 
      : [...currentMessagesInStore, userMessage];
    
    const botPlaceholder: Message = {
      id: randomUUID(),
      chat_id: chatIntegerId,
      model: selectedModelId,
      role: 'assistant',
      content: null,
      timestamp: new Date().toISOString(),
      raw_message: { status: 'placeholder' },
    };

    set((state) => ({
      // Add user message if not already present, then bot placeholder
      messages: messagesForApi.find(m => m.id === userMessage.id) 
                ? [...messagesForApi, botPlaceholder] 
                : [...state.messages, userMessage, botPlaceholder]
    }));

    try {
      await dbAddMessage(db, chatIntegerId, userMessage);
      
      const streamCallback: StreamUpdateCallback = (chunk: string | null, error?: Error, isFinished?: boolean) => {
        if (error) { generalStreamError(error); return; }
        if (chunk !== null && chunk !== undefined) { appendStreamChunk(chunk); }
        if (isFinished) { performStreamEnd(); }
      };
      
      // Filter out botPlaceholder before sending to API
      const actualHistoryForApi = get().messages.filter(m => m.id !== botPlaceholder.id);
      await aiApiClientInstance.streamChatCompletionWithMcp(actualHistoryForApi, streamCallback, selectedModelId, "Activepieces");

    } catch (dbOrApiError) {
      handleAppError(dbOrApiError, t('error.sendMessageFailed'));
      set((state) => ({
        isStreaming: false,
        // Clean up the user message and placeholder if API call failed immediately
        messages: state.messages.filter(m => m.id !== userMessage.id && m.id !== botPlaceholder.id),
      }));
    }
  },

  /**
   * Starts a new chat session and immediately sends a message as the first user message.
   * This ensures consistent new chat behavior from any UI entry point.
   * @param contentValue - The message content to send as the first user message
   * @param options - Optional message options (e.g., name)
   * @returns Promise<void>
   */
  startNewChatAndSendMessage: async (contentValue: string | any[], options?: { name?: string }): Promise<void> => {
    const newChatUUID = await get().startNewChatSession();
    if (!newChatUUID) return; // Error already handled in startNewChatSession
    await get().sendMessage(contentValue, options);
  },
}));

// Remove invalidateOpenAIClient export if it was here, as it's handled internally by AiApiClient
// export { invalidateOpenAIClient }; 