import { type SQLiteDatabase, type SQLiteRunResult } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import type { Notification, NotificationStatus } from '@/store/notificationStore'; // Assuming Notification type is here or in a shared types file

/**
 * @file notificationDb.ts
 * @description This file contains all database-related functions for managing notifications.
 */

/**
 * Creates the 'notifications' table in the database if it doesn't already exist.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @returns {Promise<void>} A promise that resolves when the table is ensured.
 * @throws Will throw an error if table creation fails.
 */
export const createNotificationsTableIfNeeded = async (db: SQLiteDatabase): Promise<void> => {
  const sqlQuery = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'undefined',
      seen INTEGER DEFAULT 1, -- 1 for true, 0 for false
      confirmed INTEGER DEFAULT 1, -- 1 for true, 0 for false
      timestamp TEXT NOT NULL
    );
  `;
  try {
    await db.execAsync(sqlQuery);
    console.log('NotificationDb: Table "notifications" ensured.');
  } catch (error) {
    console.error('NotificationDb: Failed to create "notifications" table.', error);
    throw error;
  }
};

/**
 * @typedef AddNotificationData
 * @description Data required to add a new notification, excluding 'id' and 'uuid' (which are auto-generated) and 'timestamp'.
 * @property {string} title - The title of the notification.
 * @property {string} description - The detailed description of the notification.
 * @property {NotificationStatus} [status='undefined'] - The status of the notification.
 * @property {boolean} [seen=true] - Flag indicating if the notification has been seen.
 * @property {boolean} [confirmed=true] - Flag indicating if the notification has been confirmed.
 */
export type AddNotificationData = Omit<Notification, 'id' | 'uuid' | 'timestamp' | 'seen' | 'confirmed'> & {
  status?: NotificationStatus;
  seen?: boolean;
  confirmed?: boolean;
};

/**
 * Adds a new notification to the database.
 * 'seen' and 'confirmed' default to true (1 in DB) if not provided.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @param {AddNotificationData} data - The notification data.
 * @returns {Promise<Notification | null>} The newly created notification object with its DB ID, or null if insertion fails.
 */
export const addNotificationToDb = async (db: SQLiteDatabase, data: AddNotificationData): Promise<Notification | null> => {
  const newUuid = randomUUID();
  const newTimestamp = new Date().toISOString();
  const seenValue = data.seen === undefined ? 1 : (data.seen ? 1 : 0);
  const confirmedValue = data.confirmed === undefined ? 1 : (data.confirmed ? 1 : 0);
  const statusValue = data.status || 'undefined';

  const query = `
    INSERT INTO notifications (uuid, title, description, status, seen, confirmed, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `;
  const args = [newUuid, data.title, data.description, statusValue, seenValue, confirmedValue, newTimestamp];

  try {
    const result = await db.runAsync(query, ...args);
    if (result.lastInsertRowId === undefined || result.lastInsertRowId === 0) {
      console.error('NotificationDb: Failed to insert notification, lastInsertRowId is invalid.');
      return null;
    }
    return {
      id: result.lastInsertRowId,
      uuid: newUuid,
      title: data.title,
      description: data.description,
      status: statusValue,
      seen: seenValue === 1,
      confirmed: confirmedValue === 1,
      timestamp: newTimestamp,
    };
  } catch (error: any) {
    console.error('NotificationDb: Failed to add notification.', error.message);
    return null;
  }
};

/**
 * Retrieves notifications from the database, ordered by timestamp descending.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @param {number} [limit=50] - The maximum number of notifications to retrieve.
 * @param {number} [offset=0] - The number of notifications to skip (for pagination).
 * @returns {Promise<Notification[]>} A promise that resolves with an array of notifications.
 */
export const getNotificationsFromDb = async (db: SQLiteDatabase, limit = 50, offset = 0): Promise<Notification[]> => {
  const query = `SELECT * FROM notifications ORDER BY timestamp DESC LIMIT ? OFFSET ?;`;
  try {
    const results = await db.getAllAsync<any>(query, limit, offset); // expo-sqlite types rows as 'any'
    return results.map(row => ({
      ...row,
      seen: Boolean(row.seen), // Convert 0/1 from DB to boolean
      confirmed: Boolean(row.confirmed), // Convert 0/1 from DB to boolean
    })) as Notification[];
  } catch (error: any) {
    console.error('NotificationDb: Failed to load notifications.', error.message);
    return [];
  }
};

/**
 * Deletes a notification from the database by its UUID.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @param {string} uuid - The UUID of the notification to delete.
 * @returns {Promise<boolean>} A promise that resolves with true if deletion was successful, false otherwise.
 */
export const deleteNotificationFromDbByUUID = async (db: SQLiteDatabase, uuid: string): Promise<boolean> => {
  const query = `DELETE FROM notifications WHERE uuid = ?;`;
  try {
    const result = await db.runAsync(query, uuid);
    return result.changes > 0;
  } catch (error: any) {
    console.error(`NotificationDb: Failed to remove notification UUID: ${uuid}.`, error.message);
    return false;
  }
};

/**
 * Retrieves the count of unseen notifications from the database.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @returns {Promise<number>} A promise that resolves with the count of unseen notifications.
 */
export const getUnseenNotificationCountFromDb = async (db: SQLiteDatabase): Promise<number> => {
  const query = `SELECT COUNT(*) as count FROM notifications WHERE seen = 0;`;
  try {
    const result = await db.getFirstAsync<{ count: number }>(query);
    return result?.count || 0;
  } catch (error: any) {
    console.error('NotificationDb: Failed to refresh unseen count.', error.message);
    return 0;
  }
};

/**
 * Updates the 'seen' status of a specific notification in the database.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @param {string} uuid - The UUID of the notification to update.
 * @param {boolean} seenStatus - The new 'seen' status (true or false).
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export const updateNotificationSeenStatusInDb = async (db: SQLiteDatabase, uuid: string, seenStatus: boolean): Promise<boolean> => {
  const seenValue = seenStatus ? 1 : 0;
  const query = `UPDATE notifications SET seen = ? WHERE uuid = ?;`;
  try {
    const result = await db.runAsync(query, seenValue, uuid);
    return result.changes > 0;
  } catch (error: any) {
    console.error(`NotificationDb: Failed to update seen status for UUID ${uuid}.`, error.message);
    return false;
  }
};

/**
 * Updates the 'confirmed' status of a specific notification in the database.
 * @param {SQLiteDatabase} db - The SQLite database instance.
 * @param {string} uuid - The UUID of the notification to update.
 * @param {boolean} confirmedStatus - The new 'confirmed' status (true or false).
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export const updateNotificationConfirmedStatusInDb = async (db: SQLiteDatabase, uuid: string, confirmedStatus: boolean): Promise<boolean> => {
  const confirmedValue = confirmedStatus ? 1 : 0;
  const query = `UPDATE notifications SET confirmed = ? WHERE uuid = ?;`;
  try {
    const result = await db.runAsync(query, confirmedValue, uuid);
    return result.changes > 0;
  } catch (error: any) {
    console.error(`NotificationDb: Failed to update confirmed status for UUID ${uuid}.`, error.message);
    return false;
  }
}; 