import { MCPClient, McpToolDefinition } from './mcpClient';
import mcpConfigFromFile from './mcp.json';
import { useMcpStore, StoredMcpTool } from '../../store/mcpStore'; // Adjusted path and added StoredMcpTool

// Define a type for the server configuration within the JSON
interface McpServerJsonConfig {
  url: string;
}

// Define a type for the overall structure of mcp.json
interface McpConfigFile {
  mcpServers: {
    [serverName: string]: McpServerJsonConfig;
  };
}

const mcpConfiguration = mcpConfigFromFile as McpConfigFile;

interface McpConnection {
  client: MCPClient;
  tools: StoredMcpTool[];
  connectionPromise: Promise<void>;
  isConnecting: boolean;
  error?: any;
}

/**
 * Manages connections to multiple MCP servers.
 */
export class MCPManager {
  private static instance: MCPManager;
  private connections = new Map<string, McpConnection>();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Gets the singleton instance of MCPManager.
   */
  public static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Initializes and connects to all configured MCP servers.
   * Call this early in the app lifecycle.
   */
  public async initializeAllConnections(): Promise<void> {
    const serverNames = Object.keys(mcpConfiguration.mcpServers);
    const promises = serverNames.map(name => this.connectToServer(name).catch(e => {
        // Log error during initial batch connection but don't let one failure stop others.
        // Individual connection errors are stored on the McpConnection object.
        // console.error(`[MCPManager] Failed to connect to ${name} during initial setup:`, e);
    }));
    await Promise.all(promises);
    // console.log('[MCPManager] Finished initializing all MCP connections.');
  }

  /**
   * Connects to a specific MCP server by its configuration name.
   * If already connected or connecting, returns the existing connection promise.
   * @param serverName The name of the server as defined in mcp.json.
   */
  public async connectToServer(serverName: string): Promise<void> {
    if (this.connections.has(serverName)) {
      const existingConnection = this.connections.get(serverName)!;
      if (existingConnection.isConnecting || existingConnection.tools.length > 0 || !existingConnection.error) {
        // console.log(`[MCPManager] Already connected or connecting to ${serverName}.`);
        return existingConnection.connectionPromise;
      }
      // If there was a previous error and we are trying to connect again, reset error and allow retry.
      // console.log(`[MCPManager] Retrying connection to ${serverName} after previous error.`);
      existingConnection.error = undefined; 
    }

    const serverConfig = mcpConfiguration.mcpServers[serverName];
    if (!serverConfig || !serverConfig.url) {
      const error = new Error(`[MCPManager] MCP server configuration for '${serverName}' not found or invalid.`);
      // console.error(error.message);
      // Store a failed connection attempt state
      this.connections.set(serverName, {
        client: null as any, // No client if config is missing
        tools: [],
        connectionPromise: Promise.reject(error),
        isConnecting: false,
        error: error,
      });
      throw error;
    }

    const baseUrl = serverConfig.url.replace(/\/sse$/, ''); // Remove trailing /sse if present
    const client = new MCPClient(baseUrl);
    
    // Initialize with empty StoredMcpTool array
    const connectionEntry: McpConnection = {
      client,
      tools: [], 
      connectionPromise: Promise.resolve(),
      isConnecting: true,
      error: undefined,
    };
    this.connections.set(serverName, connectionEntry);
    
    // console.log(`[MCPManager] Connecting to MCP server: ${serverName} at ${baseUrl}`);

    const connectAndFetchTools = async () => {
      try {
        await client.connect();
        // console.log(`[MCPManager] Successfully connected to ${serverName}. Fetching tools...`);
        const rawTools: McpToolDefinition[] = await client.listTools();
        
        // Convert raw tools to StoredMcpTool, defaulting isActive to true
        // Ensure that the rawTool actually has input_schema (snake_case) as defined in McpToolDefinition
        const storedTools: StoredMcpTool[] = rawTools.map(tool => {
          // Log the individual tool structure as received from client.listTools()
          // console.log(`[MCPManager] Raw tool from client.listTools() for ${tool.name}:`, JSON.stringify(tool, null, 2));
          return {
            name: tool.name,
            description: tool.description,
            // Ensure we are using the correct property name based on McpToolDefinition
            input_schema: tool.input_schema || (tool as any).inputSchema || {}, // Prioritize input_schema, fallback to inputSchema if needed, then empty object
            annotations: tool.annotations,
            isActive: true, // Default to active
          };
        });
        
        connectionEntry.tools = storedTools; // Update local cache
        useMcpStore.getState().setServerTools(serverName, storedTools); // Update Zustand store
      } catch (error) {
        // console.error(`[MCPManager] Error connecting or fetching tools for ${serverName}:`, error);
        connectionEntry.error = error;
        // Optionally clear from store on error or leave stale:
        // useMcpStore.getState().clearServerTools(serverName);
        throw error; 
      } finally {
        connectionEntry.isConnecting = false;
      }
    };

    connectionEntry.connectionPromise = connectAndFetchTools();
    return connectionEntry.connectionPromise;
  }

  /**
   * Gets the discovered (and potentially stateful) tools for a specific MCP server.
   * Will attempt to connect if not already connected. Fetches from store if populated.
   * @param serverName The name of the server.
   * @returns Array of StoredMcpTool or undefined if connection failed or no tools.
   */
  public async getTools(serverName: string): Promise<StoredMcpTool[] | undefined> {
    const toolsFromStore = useMcpStore.getState().getServerTools(serverName);
    if (toolsFromStore) {
      // console.log(`[MCPManager] Returning tools for ${serverName} from Zustand store.`);
      return toolsFromStore;
    }

    // If not in store, proceed with connection logic (which will populate the store)
    let connection = this.connections.get(serverName);
    if (!connection || connection.error) {
      // ... (rest of the connection attempt logic from previous version of getTools)
      // This part will eventually call connectToServer, which now populates the store.
      if (connection && connection.error) {
        // console.log(`[MCPManager] Previous connection attempt to ${serverName} failed. Retrying...`);
      } else {
        // console.log(`[MCPManager] No active connection to ${serverName}. Attempting to connect to populate store...`);
      }
      try {
        await this.connectToServer(serverName); // This will now populate the store
        connection = this.connections.get(serverName); 
      } catch (connectError) {
        // console.error(`[MCPManager] Initial connectToServer call failed for ${serverName} in getTools:`, connectError);
        if (connection && !connection.error) connection.error = connectError;
        return undefined;
      }
    }

    if (!connection) {
      // console.warn(`[MCPManager] Connection object for ${serverName} still not found after connection attempt.`);
      return undefined;
    }

    // console.log(`[MCPManager] Awaiting connection promise for ${serverName} to get tools (expecting store to be populated).`);
    try {
      await connection.connectionPromise; 
      // After promise resolves, tools should be in the store.
      const finalToolsFromStore = useMcpStore.getState().getServerTools(serverName);
      if (connection.error && !finalToolsFromStore) {
        // console.warn(`[MCPManager] Connection to ${serverName} completed but with an error, and no tools in store:`, connection.error);
        return undefined;
      }
      if (!finalToolsFromStore) {
         // console.warn(`[MCPManager] Connection to ${serverName} seemed successful, but no tools found in store.`);
      }
      return finalToolsFromStore;
    } catch (error) {
      // console.error(`[MCPManager] Error awaiting connection promise for ${serverName} in getTools:`, error);
      if (!connection.error) connection.error = error;
      return undefined;
    }
  }

  /**
   * Gets a specific MCPClient instance.
   * Useful if direct client access is needed after connection.
   * @param serverName The name of the server.
   * @returns MCPClient instance or undefined.
   */
  public async getClient(serverName: string): Promise<MCPClient | undefined> {
    if (!this.connections.has(serverName) || this.connections.get(serverName)?.error) {
      try {
        await this.connectToServer(serverName);
      } catch (connectError) {
        return undefined;
      }
    }
    const connection = this.connections.get(serverName);
    // Wait for connection to complete if it's in progress
    if (connection?.isConnecting) await connection.connectionPromise.catch(() => {});
    return connection?.client;
  }
} 