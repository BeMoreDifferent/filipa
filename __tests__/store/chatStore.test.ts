import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { useChatStore } from '../../store/chatStore';
import * as Database from '../../utils/Database';
import * as ModelStore from '../../store/ModelStore';
import { randomUUID } from 'expo-crypto';
import { AppError, handleAppError, showToast } from '../../utils/errorHandler';
import { t } from '../../config/i18n';
import { SQLiteDatabase } from 'expo-sqlite';
import { AiApiClient } from '../../utils/ai/AiApiClient';
import { Message } from '../../utils/Interfaces';
import { useChatHistoryStore } from '@/store/chatHistoryStore';

// Mocking a dummy SQLiteDatabase object
const mockDb = {
  transactionAsync: jest.fn(),
} as unknown as SQLiteDatabase;

// #region Mocks
jest.mock('@/utils/Database', () => ({
  migrateDbIfNeeded: jest.fn(),
  getMessages: jest.fn(),
  addMessage: jest.fn(),
  addChat: jest.fn(),
  isDatabaseOpen: jest.fn().mockReturnValue(true),
  getChatIntegerIdByUUID: jest.fn(),
  deleteChatAndMessagesByUUID: jest.fn(),
}));

jest.mock('@/store/ModelStore', () => ({
  setLastSelectedModelId: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('@/utils/errorHandler', () => ({
  handleAppError: jest.fn(),
  showToast: jest.fn(),
  AppError: jest.fn((code: any, message: any) => ({ code, message, name: 'AppError' })),
}));

jest.mock('@/config/i18n', () => ({
  t: jest.fn((key: any) => key),
}));

const mockChatHistoryStore = {
  addChatToView: jest.fn(),
  removeChatFromView: jest.fn(),
};
jest.mock('@/store/chatHistoryStore', () => ({
  useChatHistoryStore: {
    getState: jest.fn(() => mockChatHistoryStore),
  },
}));

// Create a stable mock function for the stream method
const mockStreamChatCompletionWithMcp = jest.fn(async () => {
  return Promise.resolve();
});

jest.mock('@/utils/ai/AiApiClient', () => {
  return {
    AiApiClient: jest.fn().mockImplementation(() => {
      return {
        streamChatCompletionWithMcp: mockStreamChatCompletionWithMcp,
      };
    }),
  };
});
// #endregion

describe('chatStore', () => {
  const mockInitialState = useChatStore.getState();
  const mockAiApiClientInstance = new (AiApiClient as jest.MockedClass<typeof AiApiClient>)();

  beforeEach(() => {
    // Reset Zustand store to its initial state before each test
    useChatStore.setState(mockInitialState);
    // Set a mock DB instance for all tests
    useChatStore.getState().setDbInstance(mockDb);
    // Clear all mock function call histories
    jest.clearAllMocks();
    mockStreamChatCompletionWithMcp.mockClear();

    // Default mock implementations for dependencies
    (Database.isDatabaseOpen as jest.Mock).mockReturnValue(true);
    (Database.migrateDbIfNeeded as any).mockResolvedValue(undefined);
    (randomUUID as jest.Mock).mockReturnValue('mock-uuid-string');
  });

  // #region Initialization
  describe('initializeDatabase', () => {
    it('should handle error if dbInstance is null', async () => {
      useChatStore.getState().setDbInstance(null as any);
      await useChatStore.getState().initializeDatabase();
      expect(handleAppError).toHaveBeenCalledWith(expect.any(Object), t('error.dbInitFailed'));
      expect(Database.migrateDbIfNeeded).not.toHaveBeenCalled();
    });

    it('should skip if already initialized', async () => {
      useChatStore.setState({ isDbInitialized: true, currentChatId: 'some-chat' });
      await useChatStore.getState().initializeDatabase();
      expect(Database.migrateDbIfNeeded).not.toHaveBeenCalled();
    });

    it('should handle error if database is not open', async () => {
      (Database.isDatabaseOpen as jest.Mock).mockReturnValue(false);
      await useChatStore.getState().initializeDatabase();
      expect(handleAppError).toHaveBeenCalledWith(expect.any(Object), t('error.dbInitFailed'));
      expect(Database.migrateDbIfNeeded).not.toHaveBeenCalled();
    });

    it('should migrate db and start a new chat session on successful initialization', async () => {
      const startNewChatSessionSpy = jest.spyOn(useChatStore.getState(), 'startNewChatSession').mockResolvedValue('new-chat-id');
      await useChatStore.getState().initializeDatabase();
      expect(Database.migrateDbIfNeeded).toHaveBeenCalledWith(mockDb);
      expect(useChatStore.getState().isDbInitialized).toBe(true);
      expect(startNewChatSessionSpy).toHaveBeenCalled();
      startNewChatSessionSpy.mockRestore();
    });

    it('should reset state on migration failure', async () => {
      const migrationError = new Error('Migration failed');
      (Database.migrateDbIfNeeded as any).mockRejectedValue(migrationError);
      await useChatStore.getState().initializeDatabase();
      expect(handleAppError).toHaveBeenCalledWith(migrationError, t('error.dbInitFailed'));
      expect(useChatStore.getState().isDbInitialized).toBe(false);
      expect(useChatStore.getState().currentChatId).toBeNull();
    });
  });
  // #endregion

  // #region Chat Session Management
  describe('startNewChatSession', () => {
    it('should create a new chat session with a system message', async () => {
      (randomUUID as jest.Mock).mockReturnValueOnce('new-chat-uuid').mockReturnValueOnce('system-message-uuid');
      const newChatId = await useChatStore.getState().startNewChatSession();
      const state = useChatStore.getState();
      expect(newChatId).toBe('new-chat-uuid');
      expect(state.currentChatId).toBe('new-chat-uuid');
      expect(state.messages.length).toBe(1);
      expect(state.messages[0].role).toBe('system');
      expect(state.messages[0].id).toBe('system-message-uuid');
    });

    it('should handle errors during new session creation', async () => {
      const uuidError = new Error('UUID generation failed');
      (randomUUID as jest.Mock).mockImplementation(() => {
        throw uuidError;
      });
      const newChatId = await useChatStore.getState().startNewChatSession();
      expect(newChatId).toBeNull();
      expect(handleAppError).toHaveBeenCalledWith(uuidError, t('error.createChatFailed'));
    });
  });

  describe('setCurrentChatId', () => {
    it('should load messages if UUID is provided', async () => {
      const loadMessagesSpy = jest.spyOn(useChatStore.getState(), 'loadMessages').mockResolvedValue(true);
      const result = await useChatStore.getState().setCurrentChatId('existing-chat-uuid');
      expect(loadMessagesSpy).toHaveBeenCalledWith('existing-chat-uuid', expect.any(String));
      expect(result).toBe(true);
      loadMessagesSpy.mockRestore();
    });

    it('should start a new session if UUID is null', async () => {
      const startNewChatSessionSpy = jest.spyOn(useChatStore.getState(), 'startNewChatSession').mockResolvedValue('new-chat-id');
      await useChatStore.getState().setCurrentChatId(null);
      expect(startNewChatSessionSpy).toHaveBeenCalled();
      startNewChatSessionSpy.mockRestore();
    });
  });

  describe('deleteChatSession', () => {
    it('should delete chat and start new session if it was the current one', async () => {
      const chatUUID = 'chat-to-delete';
      useChatStore.setState({ currentChatId: chatUUID });
      (Database.deleteChatAndMessagesByUUID as any).mockResolvedValue(true);
      const startNewChatSessionSpy = jest.spyOn(useChatStore.getState(), 'startNewChatSession').mockResolvedValue('new-chat-id');
      
      const result = await useChatStore.getState().deleteChatSession(chatUUID);

      expect(Database.deleteChatAndMessagesByUUID).toHaveBeenCalledWith(mockDb, chatUUID);
      expect(mockChatHistoryStore.removeChatFromView).toHaveBeenCalledWith(chatUUID);
      expect(showToast).toHaveBeenCalledWith(t('chat.chatDeletedSuccess'), 'success');
      expect(startNewChatSessionSpy).toHaveBeenCalled();
      expect(result).toBe(true);
      startNewChatSessionSpy.mockRestore();
    });
  });
  // #endregion

  // #region Message Handling
  describe('sendMessage', () => {
    const userInput = 'Hello, world!';

    it('should do nothing if already streaming', async () => {
      useChatStore.setState({ isStreaming: true });
      await useChatStore.getState().sendMessage(userInput);
      expect(showToast).toHaveBeenCalledWith(t('chat.alreadyStreaming'), 'info');
      expect(Database.addMessage).not.toHaveBeenCalled();
    });
/*
    it('should create a new chat record in DB if sending first message', async () => {
      const newChatUUID = 'new-chat-uuid';
      const systemMessageUUID = 'system-message-uuid';
      const newUserMessageUUID = 'user-message-uuid';
      const botPlaceholderUUID = 'bot-placeholder-uuid';
      
      // Setup for a brand new chat
      useChatStore.setState({ currentChatId: newChatUUID, messages: [
        // The initial system message from startNewChatSession
        { id: systemMessageUUID, role: 'system', content: 'System Prompt', model: 'gpt-4o-mini', chat_id: 0, timestamp: '', raw_message: {} }
      ]});
      (Database.getChatIntegerIdByUUID as any).mockResolvedValue(null); // Simulate chat not in DB yet
      (Database.addChat as any).mockResolvedValue({ lastInsertRowId: 1, uuid: newChatUUID });
      
      // Reset and configure UUID mock for this specific test
      (randomUUID as jest.Mock).mockClear()
        .mockReturnValueOnce(newUserMessageUUID)
        .mockReturnValueOnce(botPlaceholderUUID);

      await useChatStore.getState().sendMessage(userInput);

      // Verify a new chat was created in the DB
      expect(Database.addChat).toHaveBeenCalledWith(mockDb, userInput.substring(0, 50), newChatUUID);
      
      // Verify the system message was updated and saved
      const addMessageCalls = (Database.addMessage as jest.Mock).mock.calls;
      expect(addMessageCalls).toHaveLength(2);
      expect(addMessageCalls[0][2]).toEqual(expect.objectContaining({ role: 'system' }));
      // Verify the new user message was saved
      expect(addMessageCalls[1][2]).toEqual(expect.objectContaining({ id: newUserMessageUUID, role: 'user' }));
    });
/*
    it('should add optimistic messages and call AI stream', async () => {
      const chatUUID = 'existing-chat-uuid';
      const chatIntId = 123;
      // Start with a system message, as a real chat would have
      const systemMessage: Message = { id: 'system-uuid', role: 'system', content: 'System Prompt', model: 'gpt-4o-mini', chat_id: chatIntId, timestamp: '', raw_message: {} };
      useChatStore.setState({ currentChatId: chatUUID, messages: [systemMessage], isStreaming: false }); // Ensure isStreaming is false initially
      (Database.getChatIntegerIdByUUID as any).mockResolvedValue(chatIntId);
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('user-message-uuid')
        .mockReturnValueOnce('bot-placeholder-uuid');
      
      await useChatStore.getState().sendMessage(userInput);

      const state = useChatStore.getState();

      console.log('[RESULT TEST]should add optimistic messages and call AI stream', JSON.stringify(state.messages, null, 2));
      // We start with 1 message (system), add 1 (user) + 1 (bot placeholder) = 3
      expect(state.messages.length).toBe(3);
      expect(state.messages[1].role).toBe('user');
      expect(state.messages[2].role).toBe('assistant');
      expect(state.messages[2].content).toBeNull();
      expect(state.isStreaming).toBe(true);
      
      expect(Database.addMessage).toHaveBeenCalledWith(mockDb, chatIntId, expect.objectContaining({ role: 'user' }));
      expect(mockStreamChatCompletionWithMcp).toHaveBeenCalled();
    });*/
  });
  // #endregion
}); 