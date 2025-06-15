import { create } from 'zustand';
import { type SQLiteDatabase } from 'expo-sqlite';

import {
  createNotificationsTableIfNeeded,
  addNotificationToDb,
  getNotificationsFromDb,
  deleteNotificationFromDbByUUID,
  getUnseenNotificationCountFromDb,
  updateNotificationSeenStatusInDb,
  updateNotificationConfirmedStatusInDb,
  type AddNotificationData as AddNotificationDataFromDbUtil
} from '@/utils/notificationDb';

/**
 * @enum {string}
 * @description Represents the possible statuses of a notification.
 */
export type NotificationStatus = 'undefined' | 'success' | 'error' | 'info' | 'warning';

/**
 * @interface AddNotificationData
 * @description Defines the data structure needed to add a new notification.
 * @property {string} uuid - A unique string identifier (UUID) for the notification.
 * @property {string} title - The title of the notification.
 * @property {string} description - The detailed description of the notification.
 * @property {NotificationStatus} status - The status of the notification.
 * @property {string} [timestamp] - Optional ISO string for when the notification occurred; defaults to now.
 * @property {boolean} [seen] - Optional flag if notification is seen; defaults to false.
 * @property {boolean} [confirmed] - Optional flag if notification is confirmed; defaults to false.
 */
export interface AddNotificationData {
    uuid: string;
    title: string;
    description: string;
    status: NotificationStatus;
    timestamp?: string;
    seen?: boolean;
    confirmed?: boolean;
}

/**
 * @interface Notification
 * @description Defines the structure for a notification object.
 * @property {number} id - The unique auto-incremented integer identifier for the notification (Primary Key).
 * @property {string} uuid - A unique string identifier (UUID) for the notification.
 * @property {string} title - The title of the notification.
 * @property {string} description - The detailed description of the notification.
 * @property {NotificationStatus} status - The status of the notification.
 * @property {boolean} seen - Flag indicating if the notification has been seen by the user.
 * @property {boolean} confirmed - Flag indicating if the notification has been confirmed by the user.
 * @property {string} timestamp - ISO string representing when the notification was created.
 */
export interface Notification {
  id: number;
  uuid: string;
  title: string;
  description: string;
  status: NotificationStatus;
  seen: boolean;
  confirmed: boolean;
  timestamp: string;
}

/**
 * @interface NotificationState
 * @description Defines the state structure for the notification store.
 * @property {Notification[]} notifications - An array of current notifications.
 * @property {number} unseenCount - The number of notifications marked as unseen.
 * @property {boolean} isDbInitialized - Flag indicating if the database for notifications has been initialized.
 * @property {SQLiteDatabase | null} dbInstance - The SQLite database instance.
 * @property {(db: SQLiteDatabase) => void} setDbInstance - Function to set the database instance.
 * @property {() => Promise<void>} initializeDatabase - Function to initialize the database and create the notifications table.
 * @property {(data: AddNotificationData) => Promise<Notification | null>} addNotification - Function to add a new notification.
 * @property {(limit?: number, offset?: number) => Promise<void>} loadNotifications - Function to load notifications from the database.
 * @property {(uuid: string) => Promise<boolean>} removeNotification - Function to remove a notification by its UUID.
 * @property {(uuid: string, seenStatus: boolean) => Promise<boolean>} markNotificationAsSeen - Function to mark a notification as seen or unseen.
 * @property {(uuid: string, confirmedStatus: boolean) => Promise<boolean>} markNotificationAsConfirmed - Function to mark a notification as confirmed or unconfirmed.
 * @property {() => Promise<void>} refreshUnseenCount - Function to refresh the count of unseen notifications.
 */
export interface NotificationState {
  notifications: Notification[];
  unseenCount: number;
  isDbInitialized: boolean;
  dbInstance: SQLiteDatabase | null;
  setDbInstance: (db: SQLiteDatabase) => void;
  initializeDatabase: () => Promise<void>;
  addNotification: (data: AddNotificationData) => Promise<Notification | null>;
  loadNotifications: (limit?: number, offset?: number) => Promise<void>;
  removeNotification: (uuid: string) => Promise<boolean>;
  markNotificationAsSeen: (uuid: string, seenStatus: boolean) => Promise<boolean>;
  markNotificationAsConfirmed: (uuid: string, confirmedStatus: boolean) => Promise<boolean>;
  refreshUnseenCount: () => Promise<void>;
}

const getValidDbInstance = (getFn: () => NotificationState): SQLiteDatabase | null => {
  const db = getFn().dbInstance;
  if (!db) {
    return null;
  }
  return db;
};

/**
 * @function useNotificationStore
 * @description Zustand store for managing notifications.
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unseenCount: 0,
  isDbInitialized: false,
  dbInstance: null,

  setDbInstance: (db) => {
    set({ dbInstance: db });
  },

  initializeDatabase: async () => {
    const db = get().dbInstance;
    if (!db) {
      set({ isDbInitialized: false });
      return;
    }
    if (get().isDbInitialized) return;

    try {
      await createNotificationsTableIfNeeded(db);
      set({ isDbInitialized: true });
      await get().refreshUnseenCount();
      await get().loadNotifications(20);
    } catch (error) {
      set({ isDbInitialized: false });
    }
  },

  addNotification: async (data: AddNotificationData) => {
    const db = getValidDbInstance(get);
    if (!db) return null;

    try {
      const newNotification = await addNotificationToDb(db, data);
      if (newNotification) {
        set((state) => ({ notifications: [newNotification, ...state.notifications.slice(0, 49)] }));
        if (!newNotification.seen) {
            await get().refreshUnseenCount();
        }
        return newNotification;
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  loadNotifications: async (limit = 50, offset = 0) => {
    const db = getValidDbInstance(get);
    if (!db) return;

    try {
      const loadedNotifications = await getNotificationsFromDb(db, limit, offset);
      if (offset === 0) {
        set({ notifications: loadedNotifications });
      } else {
        set(state => ({ 
          notifications: [...state.notifications, ...loadedNotifications].slice(0, 100)
        }));
      }
    } catch (error) {
    }
  },

  removeNotification: async (uuid) => {
    const db = getValidDbInstance(get);
    if (!db) return false;

    try {
      const success = await deleteNotificationFromDbByUUID(db, uuid);
      if (success) {
        let wasUnseen = false;
        set((state) => {
          const newNotifications = state.notifications.filter((n) => {
            if (n.uuid === uuid) {
              if (!n.seen) wasUnseen = true;
              return false;
            }
            return true;
          });
          return { notifications: newNotifications };
        });
        if (wasUnseen) {
            await get().refreshUnseenCount();
        }
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  refreshUnseenCount: async () => {
    const db = getValidDbInstance(get);
    if (!db) return;

    try {
      const count = await getUnseenNotificationCountFromDb(db);
      set({ unseenCount: count });
    } catch (error) {
    }
  },

  markNotificationAsSeen: async (uuid, seenStatus) => {
    const db = getValidDbInstance(get);
    if (!db) return false;

    try {
      const success = await updateNotificationSeenStatusInDb(db, uuid, seenStatus);
      if (success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.uuid === uuid ? { ...n, seen: seenStatus } : n
          ),
        }));
        await get().refreshUnseenCount();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  markNotificationAsConfirmed: async (uuid, confirmedStatus) => {
    const db = getValidDbInstance(get);
    if (!db) return false;
    
    try {
      const success = await updateNotificationConfirmedStatusInDb(db, uuid, confirmedStatus);
      if (success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.uuid === uuid ? { ...n, confirmed: confirmedStatus } : n
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },
}));

// Example usage comment from previous version removed for brevity during refactoring.
// It would be similar to:
// import { useNotificationStore } from './notificationStore';
// import { getDatabaseInstance } from './yourDbSetupFile'; // Example
// const db = await getDatabaseInstance(); // Ensure DB is initialized
// if (db) { 
//   useNotificationStore.getState().setDbInstance(db);
//   useNotificationStore.getState().initializeDatabase();
// }
// useNotificationStore.getState().addNotification({ title: "Test", description: "This is a test notification", status: 'info', seen: false }); 