import * as FileSystem from 'expo-file-system';

const LOG_FILE_NAME = 'app_usage.log';
const LOG_FILE_PATH = `${FileSystem.documentDirectory}${LOG_FILE_NAME}`;
let isInitialized = false;

/**
 * @async
 * @description Initializes the logger. Creates the log file if it doesn't exist
 * or clears it if it's too large (optional, basic implementation for now).
 */
const initialize = async () => {
  try {
    // Optional: Check file size and clear if it's too big, or implement log rotation.
    // For now, we'll just ensure it exists by writing an initial entry or clearing.
    await FileSystem.writeAsStringAsync(LOG_FILE_PATH, `Log Initialized: ${new Date().toISOString()}\n`, { encoding: FileSystem.EncodingType.UTF8 });
    isInitialized = true;
    // Attempt to add a log entry using the logger itself to confirm it's working
    await addLog('INFO', 'LoggerService', 'Initialization successful. Logger is active.');
  } catch (error) {
    isInitialized = false;
    // Attempt a direct write for critical init failure info, as addLog might not work
    try {
      await FileSystem.writeAsStringAsync(LOG_FILE_PATH, `CRITICAL: Logger initialization failed at ${new Date().toISOString()}: ${error.message}\n`, { encoding: FileSystem.EncodingType.UTF8 });
    } catch (writeError) {
      // console.error('Failed to write critical initialization error to log file:', writeError);
    }
  }
};

/**
 * @async
 * @description Adds a log entry to the file.
 * @param {string} level - Log level (e.g., INFO, ERROR, LIFECYCLE).
 * @param {string} tag - A tag for the log entry (e.g., component name, service name).
 * @param {string} message - The log message.
 * @param {object} [data] - Optional additional data to stringify and log.
 */
const addLog = async (level, tag, message, data) => {
  if (!isInitialized) {
    // console.warn('Logger not initialized. Attempting to initialize now...');
    await initialize(); // Attempt to initialize if not already done.
    if (!isInitialized) {
      // console.error('Logger remains uninitialized after attempt. Cannot add log.');
      return;
    }
  }

  const timestamp = new Date().toISOString();
  let logEntry = `${timestamp} | ${level} | ${tag} | ${message}`;
  if (data) {
    try {
      logEntry += ` | ${JSON.stringify(data)}`;
    } catch (error) {
      logEntry += ` | [Unserializable data]`;
    }
  }
  logEntry += '\n';

  try {
    await FileSystem.appendAsStringAsync(LOG_FILE_PATH, logEntry, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    // console.error('Failed to write log entry:', error, 'Log details:', logEntry.trim());
  }
};

/**
 * @description Gets the path to the log file.
 * @returns {string} The absolute path to the log file.
 */
const getLogFilePath = () => {
  return LOG_FILE_PATH;
};

/**
 * @async
 * @description Deletes the current log file.
 */
const clearLogs = async () => {
  try {
    await FileSystem.deleteAsync(LOG_FILE_PATH, { idempotent: true });
    // console.log('Log file cleared.');
    // Re-initialize with a header
    await FileSystem.writeAsStringAsync(LOG_FILE_PATH, `Log Initialized (after clear): ${new Date().toISOString()}\n`, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    // console.error('Failed to clear log file:', error);
  }
}

export const LoggerService = {
  initialize,
  addLog,
  getLogFilePath,
  clearLogs,
}; 