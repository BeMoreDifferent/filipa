import { useNotificationStore, type AddNotificationData, type NotificationStatus } from '@/store/notificationStore';
import { AppError } from './errorHandler';
import { t } from '@/config/i18n';
import { randomUUID } from 'expo-crypto'; // For uuid

/**
 * @interface StoredNotification
 * @description Represents a notification that has been processed and is ready for storage or display.
 * @property {string} id - A unique ID for the notification, typically a UUID.
 * @property {string} title - The title of the notification.
 * @property {string} message - The main message content of the notification.
 * @property {NotificationStatus} type - The type/status of the notification (e.g., 'error', 'success').
 * @property {Date} timestamp - When the notification was generated.
 * @property {unknown} [originalError] - The original error object, if applicable.
 * @property {string} [details] - Additional details, like a stack trace.
 */
export interface StoredNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationStatus;
  timestamp: Date;
  originalError?: unknown;
  details?: string;
}

// Simple in-memory cache to track recently added error messages to avoid immediate duplicates.
// Key: message content, Value: timestamp of last addition
const recentErrorCache = new Map<string, number>();
const DUPLICATE_THRESHOLD_MS = 5000; // 5 seconds

/**
 * Creates a notification object from an error.
 * @param {unknown} error - The error object.
 * @param {string} [customTitle] - A custom title for the notification.
 * @param {string} [defaultUserMessage] - A default user-friendly message.
 * @returns {StoredNotification} The processed notification object.
 */
export function createErrorNotification(
  error: unknown,
  customTitle?: string,
  defaultUserMessage?: string
): StoredNotification {
  let title: string;
  let message: string;
  let details: string | undefined;
  let originalErrorObj: unknown | undefined;
  let type: NotificationStatus = 'error';

  if (error instanceof AppError) {
    title = customTitle || t('error.defaultTitle') || 'Application Error';
    message = error.userMessage || defaultUserMessage || t('error.generic');
    if (error.originalError instanceof Error) {
        details = error.originalError.stack;
        originalErrorObj = error.originalError;
    } else if (typeof error.originalError === 'string') {
        details = error.originalError;
        originalErrorObj = error.originalError;
    } else {
        originalErrorObj = error.originalError;
    }
    if (error.stack) {
        details = details ? `${details}
--- AppError Stack ---
${error.stack}` : error.stack;
    }
  } else if (error instanceof Error) {
    title = customTitle || t('error.defaultTitle') || 'System Error';
    message = defaultUserMessage || t('error.generic');
    details = error.stack;
    originalErrorObj = error;
  } else {
    title = customTitle || t('error.defaultTitle') || 'Unknown Error';
    message = defaultUserMessage || t('error.generic');
    originalErrorObj = error;
    try {
      message = String(error);
    } catch (e) {
      message = 'An unknown error occurred, and it could not be converted to a string.';
    }
  }
  
  // If the message is still the generic key, and originalErrorObj exists, use its message.
  if (message === t('error.generic') || message === 'error.generic') {
    if (originalErrorObj instanceof Error) {
      message = originalErrorObj.message;
    } else if (typeof originalErrorObj === 'string' && originalErrorObj.length > 0) {
      message = originalErrorObj;
    } else if (typeof originalErrorObj === 'object' && originalErrorObj !== null && 'message' in originalErrorObj && typeof originalErrorObj.message === 'string') {
      message = originalErrorObj.message;
    }
  }


  return {
    id: randomUUID(),
    title,
    message,
    type,
    timestamp: new Date(),
    originalError: originalErrorObj,
    details,
  };
}

/**
 * Adds a notification to the store if it's not a recent duplicate.
 * @param {StoredNotification} notification - The notification to add.
 * @returns {Promise<void>}
 */
export async function storeNotification(notification: StoredNotification): Promise<void> {
  const now = Date.now();
  const lastOccurrence = recentErrorCache.get(notification.message);

  if (lastOccurrence && (now - lastOccurrence < DUPLICATE_THRESHOLD_MS)) {
    return;
  }
  recentErrorCache.set(notification.message, now);
  // Clear old entries from cache occasionally
  if (recentErrorCache.size > 100) {
      for (const [key, value] of recentErrorCache.entries()) {
          if (now - value > DUPLICATE_THRESHOLD_MS * 10) { // Clear if older than 10x threshold
              recentErrorCache.delete(key);
          }
      }
  }


  const notificationData: AddNotificationData = {
    uuid: notification.id,
    title: notification.title,
    description: notification.message + (notification.details ? `

Details:
${notification.details}` : ''),
    status: notification.type,
    timestamp: notification.timestamp.toISOString(),
  };

  try {
    const addedNotification = await useNotificationStore.getState().addNotification(notificationData);
    if (addedNotification) {
    } else {
    }
  } catch (e) {
  }
}

/**
 * Displays a toast notification. This is a separate concern from storing.
 * @param {StoredNotification} notification - The notification to display.
 */
export function displayToastNotification(notification: StoredNotification): void {
    // The actual toast display logic is now in errorHandler.ts showToast function.
    // This function could be used if we want to centralize how toasts are triggered from StoredNotification objects.
    // For now, we'll let handleAppError call showToast directly.
    // showToast(notification.message, notification.type); // Example if we used it here.
    // Actual display happens in handleAppError via its own showToast call
}

// Example: Add to locales/en.json:
// "error": {
//   "defaultTitle": "Error Occurred",
//   ...
// } 