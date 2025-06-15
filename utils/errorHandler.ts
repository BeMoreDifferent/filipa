import { toast } from '@backpackapp-io/react-native-toast';
import { t } from '@/config/i18n';
import { createErrorNotification, storeNotification } from './notificationManager';
import { type NotificationStatus } from '@/store/notificationStore';

/**
 * Represents a custom application error with an optional user-friendly message.
 */
export class AppError extends Error {
  userMessage: string;
  originalError?: unknown;
  isOperational: boolean; // Added to distinguish user-facing errors from system errors

  /**
   * Creates an instance of AppError.
   * @param {string} technicalMessage - The technical error message for logging.
   * @param {string} [userMessage] - A user-friendly message. If not provided, a generic one is used or derived.
   * @param {unknown} [originalError] - The original error object, if any.
   * @param {boolean} [isOperational=true] - Whether this error is considered operational (user-facing).
   */
  constructor(technicalMessage: string, userMessage?: string, originalError?: unknown, isOperational: boolean = true) {
    super(technicalMessage);
    this.name = 'AppError';
    this.originalError = originalError;
    this.isOperational = isOperational;

    if (userMessage) {
      this.userMessage = userMessage;
    } else if (this.originalError instanceof Error && this.originalError.message) {
      this.userMessage = this.originalError.message;
    } else if (typeof this.originalError === 'string' && this.originalError.length > 0) {
      this.userMessage = this.originalError;
    } else {
      this.userMessage = t('error.generic');
    }
    
    // Ensure the prototype chain is correctly set for Error subclasses when targeting ES5+
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Simple in-memory cache for toast messages to prevent rapid duplicates
const recentToastMessages = new Map<string, number>();
const TOAST_DUPLICATE_THRESHOLD_MS = 3000; // 3 seconds

/**
 * Handles application errors by logging them, storing them as notifications, and showing a user-friendly toast notification.
 * @param {unknown} error - The error object. Can be an instance of Error, AppError, or any other type.
 * @param {string} [customTitle] - A custom title for the notification (optional).
 * @param {string} [defaultUserMessageKey='error.generic'] - Key for a default user-friendly message to show if the error object doesn't provide one.
 */
export const handleAppError = async (
  error: unknown,
  customTitle?: string,
  defaultUserMessageKey: string = 'error.generic'
): Promise<void> => {
  const defaultUserMessage = t(defaultUserMessageKey);
  const notification = createErrorNotification(error, customTitle, defaultUserMessage);

  // Log to console
  let consoleMessage = `[ErrorHandler] ${notification.title}: ${notification.message}`;
  if (notification.originalError) {
    consoleMessage += ` | Original: ${String(notification.originalError)}`;
  }
  if (notification.details) {
    consoleMessage += `\nStack / Details: ${notification.details}`;
  }
  // console.error(consoleMessage);

  // Store the notification
  await storeNotification(notification);

  // Show toast for operational errors or if it's an AppError explicitly marked as operational
  const shouldShowToast = (error instanceof AppError && error.isOperational) || !(error instanceof AppError);
  
  if (shouldShowToast) {
    const now = Date.now();
    const lastShown = recentToastMessages.get(notification.message);
    if (!lastShown || (now - lastShown > TOAST_DUPLICATE_THRESHOLD_MS)) {
      showToast(notification.message, notification.type as 'error' | 'success' | 'info');
      recentToastMessages.set(notification.message, now);
      // Clean up old toast messages from cache
      if (recentToastMessages.size > 20) {
        for (const [key, value] of recentToastMessages.entries()) {
            if (now - value > TOAST_DUPLICATE_THRESHOLD_MS * 10) { 
                recentToastMessages.delete(key);
            }
        }
      }
    } else {
      // console.log(`[ErrorHandler] Duplicate toast suppressed: "${notification.message}"`);
    }
  }
};

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {NotificationStatus} [type='info'] - The type of toast.
 */
export const showToast = (
  message: string,
  type: NotificationStatus = 'info'
): void => {
  // Filter out 'undefined' or 'warning' for toast types, default to 'info'
  const toastType = (type === 'error' || type === 'success' || type === 'info') ? type : 'info';

  switch (toastType) {
    case 'error':
      toast.error(message);
      break;
    case 'success':
      toast.success(message);
      break;
    case 'info':
    default:
      toast(message); // Default toast (often info style)
      break;
  }
};

// It's good practice to add some default error messages to your i18n files.
// For example, in locales/en.json:
// {
//   "error": {
//     "generic": "An unexpected error occurred. Please try again.",
//     "defaultTitle": "An Error Occurred", // Added for notificationManager
//     "dbConnection": "Database connection issue. Please restart the app.",
//     "network": "Network error. Please check your connection.",
//     "saveFailed": "Failed to save data. Please try again.",
//     "loadFailed": "Failed to load data. Please try again.",
//     "apiKeyMissingTitle": "API Key Required",
//     "streamError": "An error occurred while streaming the response."
//   },
//   "chat": {
//      "sendFailedNoKeyToast": "Cannot send message. API key is missing. Please add it in settings."
//   }
// }
// Make sure t('error.generic') and other keys are defined in your i18n files. 