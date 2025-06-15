import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { McpConnection } from '@/types/mcpConnection';

export interface StoredMcpTool {
  name: string;
  description?: string;
  input_schema: object;
  annotations?: object;
  isActive: boolean;
}

const TOOLS_STORAGE_KEY = 'mcpStore_tools';

/**
 * Persists the tools array to AsyncStorage.
 * @param tools Array of StoredMcpTool to persist
 * @returns Promise<void>
 */
export async function persistToolsToStorage(tools: StoredMcpTool[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(tools));
  } catch (error) {
    console.error('Failed to persist tools to AsyncStorage:', error);
  }
}

/**
 * Hydrates the tools array from AsyncStorage.
 * @returns Promise<StoredMcpTool[]>
 */
export async function hydrateToolsFromStorage(): Promise<StoredMcpTool[]> {
  try {
    const stored = await AsyncStorage.getItem(TOOLS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to hydrate tools from AsyncStorage:', error);
    return [];
  }
}

interface McpStoreState {
  tools: StoredMcpTool[];
  setTools: (tools: StoredMcpTool[]) => void;
  toggleToolActive: (toolName: string) => void;
  clearTools: () => void;
  // Per-server tools
  serverTools: Record<string, StoredMcpTool[]>;
  setServerTools: (serverUrl: string, tools: StoredMcpTool[]) => void;
  getServerTools: (serverUrl: string) => StoredMcpTool[] | undefined;
  removeServerTools: (serverUrl: string) => void;
}

export const useMcpStore = create<McpStoreState>((set, get) => ({
  tools: [],
  setTools: (tools) => {
    persistToolsToStorage(tools);
    set({ tools });
  },
  toggleToolActive: (toolName) => {
    const updated = get().tools.map(tool =>
      tool.name === toolName ? { ...tool, isActive: !tool.isActive } : tool
    );
    persistToolsToStorage(updated);
    set({ tools: updated });
  },
  clearTools: () => {
    persistToolsToStorage([]);
    set({ tools: [] });
  },
  // Per-server tools state and actions
  serverTools: {},
  setServerTools: (serverUrl, tools) => {
    set((state) => {
      const updated = { ...state.serverTools, [serverUrl]: tools };
      return { serverTools: updated };
    });
  },
  getServerTools: (serverUrl) => {
    const tools = get().serverTools[serverUrl];
    return tools;
  },
  removeServerTools: (serverUrl) => {
    set((state) => {
      const updated = { ...state.serverTools };
      delete updated[serverUrl];
      return { serverTools: updated };
    });
  },
}));

/**
 * Hook to get all tools.
 */
export const useStoredTools = (): StoredMcpTool[] => {
  return useMcpStore((state) => state.tools);
};

const CONNECTIONS_STORAGE_KEY = 'mcpStore_connections';
const ACTIVE_CONNECTION_STORAGE_KEY = 'mcpStore_activeConnectionUrl';

/**
 * Persists the MCP connections array to AsyncStorage.
 * @param connections Array of McpConnection to persist
 * @returns Promise<void>
 */
export async function persistConnectionsToStorage(connections: McpConnection[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  } catch (error) {
    console.error('Failed to persist MCP connections to AsyncStorage:', error);
  }
}

/**
 * Hydrates the MCP connections array from AsyncStorage.
 * @returns Promise<McpConnection[]>
 */
export async function hydrateConnectionsFromStorage(): Promise<McpConnection[]> {
  try {
    const stored = await AsyncStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed;
  } catch (error) {
    console.error('Failed to hydrate MCP connections from AsyncStorage:', error);
    return [];
  }
}

/**
 * Persists the active MCP connection URL to SecureStore (with size check).
 * @param url The URL string to persist
 * @returns Promise<void>
 */
export async function persistActiveConnectionUrlToStorage(url: string | undefined): Promise<void> {
  try {
    if (url) {
      if (url.length > 2048) {
        throw new Error('URL too large for SecureStore (max 2048 bytes)');
      }
      await SecureStore.setItemAsync(ACTIVE_CONNECTION_STORAGE_KEY, url);
    } else {
      await SecureStore.deleteItemAsync(ACTIVE_CONNECTION_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to persist active MCP connection URL to SecureStore:', error);
  }
}

/**
 * Hydrates the active MCP connection URL from SecureStore.
 */
export async function hydrateActiveConnectionUrlFromStorage(): Promise<string | undefined> {
  try {
    const stored = await SecureStore.getItemAsync(ACTIVE_CONNECTION_STORAGE_KEY);
    return stored || undefined;
  } catch (error) {
    console.error('Failed to hydrate active MCP connection URL from SecureStore:', error);
    return undefined;
  }
}

interface McpConnectionStoreState {
  connections: McpConnection[];
  setConnections: (connections: McpConnection[]) => void;
  addConnection: (conn: McpConnection) => void;
  updateConnection: (oldUrl: string, conn: McpConnection) => void;
  removeConnection: (url: string) => void;
  hydrate: () => Promise<void>;
  activeConnectionUrl?: string;
  setActiveConnectionUrl: (url: string | undefined) => void;
  getActiveConnection: () => McpConnection | undefined;
}

/**
 * Zustand store for managing MCP server connections and the active connection.
 */
export const useMcpConnectionStore = create<McpConnectionStoreState>((set, get) => ({
  connections: [],
  setConnections: (connections) => {
    persistConnectionsToStorage(connections);
    set({ connections });
    // If the active connection was deleted, update activeConnectionUrl
    const { activeConnectionUrl } = get();
    if (activeConnectionUrl && !connections.some(c => c.url === activeConnectionUrl)) {
      const newActive = connections[0]?.url;
      persistActiveConnectionUrlToStorage(newActive);
      set({ activeConnectionUrl: newActive });
    }
  },
  addConnection: (conn) => {
    const updated = [...get().connections, conn];
    persistConnectionsToStorage(updated);
    set({ connections: updated });
  },
  updateConnection: (oldUrl, conn) => {
    const updated = get().connections.map(c => c.url === oldUrl ? conn : c);
    persistConnectionsToStorage(updated);
    set({ connections: updated });
    // If updating the active connection, update the URL
    const { activeConnectionUrl } = get();
    if (activeConnectionUrl === oldUrl) {
      persistActiveConnectionUrlToStorage(conn.url);
      set({ activeConnectionUrl: conn.url });
    }
  },
  removeConnection: (url) => {
    const updated = get().connections.filter(c => c.url !== url);
    persistConnectionsToStorage(updated);
    set({ connections: updated });
    // If removing the active connection, pick another or clear
    const { activeConnectionUrl } = get();
    if (activeConnectionUrl === url) {
      const newActive = updated[0]?.url;
      persistActiveConnectionUrlToStorage(newActive);
      set({ activeConnectionUrl: newActive });
    }
  },
  hydrate: async () => {
    const hydrated = await hydrateConnectionsFromStorage();
    set({ connections: hydrated });
    const activeUrl = await hydrateActiveConnectionUrlFromStorage();
    set({ activeConnectionUrl: activeUrl });
  },
  activeConnectionUrl: undefined,
  setActiveConnectionUrl: (url) => {
    persistActiveConnectionUrlToStorage(url);
    set({ activeConnectionUrl: url });
  },
  getActiveConnection: () => {
    const { connections, activeConnectionUrl } = get();
    const found = connections.find(c => c.url === activeConnectionUrl);
    return found;
  },
}));

/**
 * Hook to get the active MCP connection.
 * @returns {McpConnection | undefined}
 */
export const useActiveMcpConnection = (): McpConnection | undefined => {
  return useMcpConnectionStore((state) => {
    const { connections, activeConnectionUrl } = state;
    return connections.find(c => c.url === activeConnectionUrl);
  });
}; 