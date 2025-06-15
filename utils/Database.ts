import { Message, ToolCall } from '@/utils/Interfaces';
import { type SQLiteDatabase, type SQLiteRunResult } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { randomUUID } from 'expo-crypto'; // For generating chat UUIDs

// Local interface for old message structure during migration
interface OldMessageV1 {
  id: number;
  chat_id: number;
  content: string;
  imageUrl?: string;
  role: string; // In old schema, role was text 'bot' or 'user'
  prompt?: string;
}

interface OldMessageV2 { // Structure after DB_VERSION = 2 migration
  id: string;
  chat_id: number;
  model: string;
  role: string;
  content?: string | null;
  tool_use?: string | null; // Stored as JSON string of Record<string, any>
  "timestamp": string;
  data?: string | null; // Stored as JSON string of Record<string, any>
  response?: string | null; // Stored as JSON string of Record<string, any>
  raw_message: string; // Stored as JSON string
}

interface OldChatV3 { id: number; title: string; /* No uuid yet */ }

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Log DB path for debugging
  // console.log(FileSystem.documentDirectory);
  const DATABASE_VERSION = 5;
  let result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

  let currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }
  if (currentDbVersion === 0) {
    const result = await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE chats (
  id INTEGER PRIMARY KEY NOT NULL, 
  title TEXT NOT NULL
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY NOT NULL, 
  chat_id INTEGER NOT NULL, 
  content TEXT NOT NULL, 
  imageUrl TEXT, 
  role TEXT, 
  prompt TEXT, 
  FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
);
`);

    currentDbVersion = 1;
  }
  if (currentDbVersion === 1) {
    // Migration from version 1 to version 2: Update messages table schema
    await db.execAsync('ALTER TABLE messages RENAME TO messages_old_v1;');
    await db.execAsync(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        chat_id INTEGER NOT NULL,
        model TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_use TEXT, 
        "timestamp" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        data TEXT,
        response TEXT,
        raw_message TEXT NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      );
    `);

    const oldMessagesV1 = await db.getAllAsync<OldMessageV1>('SELECT * FROM messages_old_v1');
    for (const oldMsg of oldMessagesV1) {
      const newId = randomUUID();
      const rawMsg = {
        original_id: oldMsg.id,
        original_content: oldMsg.content,
        original_role: oldMsg.role,
        original_prompt: oldMsg.prompt,
        original_imageUrl: oldMsg.imageUrl,
      };
      const migratedData = oldMsg.imageUrl ? { imageUrl: oldMsg.imageUrl } : null;
      const migratedContent = oldMsg.content !== undefined ? oldMsg.content : null;

      await db.runAsync(
        `INSERT INTO messages (id, chat_id, model, role, content, tool_use, "timestamp", data, response, raw_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        newId,
        oldMsg.chat_id,
        'unknown_migrated_model',
        oldMsg.role === 'bot' ? 'assistant' : (oldMsg.role === 'user' ? 'user' : 'unknown'),
        migratedContent,
        null,
        new Date().toISOString(),
        migratedData ? JSON.stringify(migratedData) : null,
        null,
        JSON.stringify(rawMsg)
      );
    }
    
    await db.execAsync('DROP TABLE messages_old_v1;');
    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    // Add name, rename tool_use to tool_calls, add tool_call_id
    // SQLite doesn't support RENAME COLUMN directly in older versions or some contexts without workarounds.
    // It also doesn't support ADD COLUMN IF NOT EXISTS. So we check for column existence or recreate.
    // For simplicity in this migration, we assume if one new column is missing, others are too from this version step.
    // A more robust migration might check each column or use a temporary table for schema changes.
    
    // Check if 'name' column exists. If not, perform alterations.
    const firstMessage = await db.getFirstAsync<any>('SELECT * FROM messages LIMIT 1');
    const columns = firstMessage ? Object.keys(firstMessage) : [];

    if (!columns.includes('name')) {
        await db.runAsync('ALTER TABLE messages ADD COLUMN name TEXT;');
    }
    if (!columns.includes('tool_call_id')) {
        await db.runAsync('ALTER TABLE messages ADD COLUMN tool_call_id TEXT;');
    }
    if (columns.includes('tool_use') && !columns.includes('tool_calls')) {
        // If tool_use exists and tool_calls doesn't, rename. Otherwise, just ensure tool_calls exists.
        await db.runAsync('ALTER TABLE messages RENAME COLUMN tool_use TO tool_calls;');
    } else if (!columns.includes('tool_calls')) {
        await db.runAsync('ALTER TABLE messages ADD COLUMN tool_calls TEXT;');
    }
    currentDbVersion = 3;
  }

  if (currentDbVersion === 3) {
    // V3 to V4: Add uuid to chats table
    await db.runAsync('ALTER TABLE chats ADD COLUMN uuid TEXT;');
    const existingChats = await db.getAllAsync<OldChatV3>('SELECT id, title FROM chats');
    for (const chat of existingChats) {
      const newUuid = randomUUID();
      await db.runAsync('UPDATE chats SET uuid = ? WHERE id = ?', newUuid, chat.id);
    }
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_uuid ON chats (uuid);');
    currentDbVersion = 4;
  }

  if (currentDbVersion === 4) {
    // V4 to V5: Add seen column to messages table
    await db.runAsync('ALTER TABLE messages ADD COLUMN seen BOOLEAN DEFAULT 0 NOT NULL;');
    currentDbVersion = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export const addChat = async (db: SQLiteDatabase, title: string, uuid: string): Promise<{lastInsertRowId: number, uuid: string}> => {
  const result = await db.runAsync('INSERT INTO chats (title, uuid) VALUES (?, ?)', title, uuid);
  return { lastInsertRowId: result.lastInsertRowId, uuid: uuid };
};

export const getChats = async (db: SQLiteDatabase) => {
  // Explicitly select id, title, uuid to match the Chat interface from Interfaces.ts
  return await db.getAllAsync<{ id: number; title: string; uuid: string; }>('SELECT id, title, uuid FROM chats');
};

export const getChatIntegerIdByUUID = async (db: SQLiteDatabase, uuid: string): Promise<number | null> => {
  const result = await db.getFirstAsync<{ id: number }>('SELECT id FROM chats WHERE uuid = ?', uuid);
  return result?.id ?? null;
};

export const getMessages = async (db: SQLiteDatabase, chatIntegerId: number): Promise<Message[]> => {
  const results = await db.getAllAsync<any>('SELECT * FROM messages WHERE chat_id = ? ORDER BY "timestamp" ASC', chatIntegerId);
  return results.map((row: any): Message => {
    let parsedContent: string | any[] | null = row.content;
    if (typeof row.content === 'string') {
      try {
        // Attempt to parse if it might be a JSON array/object (e.g. for multimodal)
        const potentialJson = JSON.parse(row.content);
        if (Array.isArray(potentialJson) || typeof potentialJson === 'object') {
          parsedContent = potentialJson;
        }
      } catch (e) {
        // Was not JSON, treat as plain string, do nothing to parsedContent
      }
    }

    return {
      id: row.id,
      chat_id: row.chat_id,
      model: row.model,
      role: row.role,
      content: parsedContent,
      name: row.name === null ? undefined : row.name,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_call_id: row.tool_call_id === null ? undefined : row.tool_call_id,
      timestamp: row.timestamp,
      data: row.data ? JSON.parse(row.data) : undefined,
      response: row.response ? JSON.parse(row.response) : undefined,
      raw_message: row.raw_message ? JSON.parse(row.raw_message) : {},
      seen: !!row.seen, // Convert 0/1 to boolean
    };
  });
};

export const addMessage = async (
  db: SQLiteDatabase,
  chatIntegerId: number,
  message: Message
) => {
  let contentToStore: string | null = null;
  if (typeof message.content === 'string') {
    contentToStore = message.content;
  } else if (Array.isArray(message.content)) {
    contentToStore = JSON.stringify(message.content);
  } else if (message.content === null || message.content === undefined) {
    contentToStore = null;
  }

  // New messages are unseen by default
  const seenValue = message.seen === true ? 1 : 0;

  return await db.runAsync(
    'INSERT INTO messages (id, chat_id, model, role, content, name, tool_calls, tool_call_id, "timestamp", data, response, raw_message, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    message.id,
    chatIntegerId,
    message.model,
    message.role,
    contentToStore,
    message.name === undefined ? null : message.name,
    message.tool_calls ? JSON.stringify(message.tool_calls) : null,
    message.tool_call_id === undefined ? null : message.tool_call_id,
    message.timestamp,
    message.data ? JSON.stringify(message.data) : null,
    message.response ? JSON.stringify(message.response) : null,
    JSON.stringify(message.raw_message),
    seenValue
  );
};

export const deleteChat = async (db: SQLiteDatabase, chatUUID: string): Promise<SQLiteRunResult> => {
  const chatIntegerId = await getChatIntegerIdByUUID(db, chatUUID);
  if (chatIntegerId === null) {
    // Removed: console.warn(`deleteChat: Chat with UUID ${chatUUID} not found.`);
    // Consider throwing an error or returning a specific result indicating failure
    return { lastInsertRowId: 0, changes: 0 }; // Mimic no changes
  }
  return await db.runAsync('DELETE FROM chats WHERE id = ?', chatIntegerId);
};

export const renameChat = async (db: SQLiteDatabase, chatUUID: string, title: string): Promise<SQLiteRunResult> => {
  const chatIntegerId = await getChatIntegerIdByUUID(db, chatUUID);
  if (chatIntegerId === null) {
    // Removed: console.warn(`renameChat: Chat with UUID ${chatUUID} not found.`);
    return { lastInsertRowId: 0, changes: 0 }; 
  }
  return await db.runAsync('UPDATE chats SET title = ? WHERE id = ?', title, chatIntegerId);
};

/**
 * Deletes a chat and its associated messages from the database using the chat UUID.
 * Relies on "ON DELETE CASCADE" for messages.
 * @param db The SQLite database instance.
 * @param chatUUID The UUID of the chat to delete.
 * @returns A promise that resolves with true if the chat was deleted, false otherwise.
 */
export const deleteChatAndMessagesByUUID = async (db: SQLiteDatabase, chatUUID: string): Promise<boolean> => {
  try {
    // First, verify the chat exists and get its integer ID (optional, but good for logging or pre-checks if needed)
    // const chatIntegerId = await getChatIntegerIdByUUID(db, chatUUID);
    // if (chatIntegerId === null) {
    //   console.warn(`[Database] Attempted to delete non-existent chat with UUID: ${chatUUID}`);
    //   return false; // Chat not found
    // }

    // The ON DELETE CASCADE constraint on messages.chat_id should handle message deletion.
    const result = await db.runAsync('DELETE FROM chats WHERE uuid = ?', chatUUID);
    
    if (result.changes > 0) {
      return true;
    } else {
      return false; // No rows affected, chat might not have existed
    }
  } catch (error) {
    console.error(`[Database] Error deleting chat with UUID ${chatUUID}:`, error);
    // Consider re-throwing or specific error handling if needed by the caller
    return false; // Deletion failed
  }
};

/**
 * Checks if the SQLite database instance appears to be open and usable.
 * This is a basic check and might not cover all edge cases of a closed database.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @returns {boolean} True if the database instance seems open, false otherwise.
 */
export const isDatabaseOpen = (db: SQLiteDatabase): boolean => {
  // Check for the existence of some key methods that should be present on an open DB instance
  if (db && typeof db.execAsync === 'function' && typeof db.runAsync === 'function' && typeof db.getFirstAsync === 'function' && typeof db.getAllAsync === 'function') {
    // Further checks could involve trying a very simple PRAGMA statement if errors persist,
    // but that would make this function asynchronous.
    // For now, relying on method existence and the caller to handle exceptions from DB operations.
    return true;
  }
  return false;
};

/**
 * Marks all unseen messages in a specific chat as seen.
 * @param db The SQLite database instance.
 * @param chatIntegerId The integer ID of the chat whose messages are to be marked as seen.
 * @returns A promise that resolves with the SQLiteRunResult.
 */
export const markChatMessagesAsSeen = async (db: SQLiteDatabase, chatIntegerId: number): Promise<SQLiteRunResult> => {
  return await db.runAsync('UPDATE messages SET seen = 1 WHERE chat_id = ? AND seen = 0', chatIntegerId);
};

/**
 * Returns the timestamp of the latest message for a given chat integer ID.
 */
export const getLastMessageTimestampForChat = async (db: SQLiteDatabase, chatIntegerId: number): Promise<string | null> => {
  const result = await db.getFirstAsync<{ timestamp: string }>(
    'SELECT timestamp FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 1',
    chatIntegerId
  );
  return result?.timestamp ?? null;
};

/**
 * Deletes all chats and all messages from the database.
 * @param db The SQLite database instance.
 * @returns Promise<boolean> indicating success.
 * @example
 *   await deleteAllChats(db);
 */
export const deleteAllChats = async (db: SQLiteDatabase): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM messages');
    await db.runAsync('DELETE FROM chats');
    return true;
  } catch (error) {
    console.error('[Database] Error deleting all chats and messages:', error);
    return false;
  }
};
