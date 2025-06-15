/**
 * @file Minimal MCP SSE client for Expo React Native: tool discovery and invocation only.
 * Follows official MCP SSE transport: dynamically receives messages endpoint via SSE.
 * No third-party libraries. Uses fetch and XMLHttpRequest.
 */

import 'react-native-url-polyfill/auto';

/**
 * Type for JSON-RPC request.
 */
type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
};

/**
 * Type for JSON-RPC response.
 */
type JsonRpcResponse = {
  jsonrpc: '2.0';
  id?: number | string;
  result?: any;
  error?: any;
  method?: string;
  params?: any;
};

export type McpToolDefinition = {
  name: string;
  description?: string;
  input_schema: object;
  annotations?: object;
};

/**
 * Minimal MCP SSE client for tool discovery and invocation, following official SSE transport.
 */
export class MCPClient {
  private baseUrl: string;
  private sseUrl: string;
  private msgUrl?: string; // Dynamically set via 'endpoint' SSE event
  private authToken?: string;
  private xhr?: XMLHttpRequest;
  private nextId = 1;
  private pending = new Map<number | string, (result: any) => void>();
  private buffer = '';
  private tools: McpToolDefinition[] = [];
  private lastProcessedSSELength = 0; // Tracks processed part of responseText

  private msgUrlReadyPromise: Promise<void>;
  private resolveMsgUrlReady!: () => void;
  private rejectMsgUrlReady!: (reason?: any) => void;

  /**
   * @param url Base MCP server URL (e.g., https://host.com/mcp/server-id). No trailing slash.
   * @param authToken Optional bearer token for Authorization header.
   */
  constructor(url: string, authToken?: string) {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash if any
    this.sseUrl = `${this.baseUrl}/sse`;
    this.authToken = authToken;
    this.msgUrlReadyPromise = new Promise((resolve, reject) => {
      this.resolveMsgUrlReady = resolve;
      this.rejectMsgUrlReady = reject;
    });
  }

  /**
   * Connects to the SSE stream, waits for the dynamic messages endpoint, and performs MCP handshake.
   * @returns Resolves when handshake is complete.
   */
  async connect(): Promise<void> {
    this.msgUrlReadyPromise = new Promise((resolve, reject) => { // Reset for potential reconnects
        this.resolveMsgUrlReady = resolve;
        this.rejectMsgUrlReady = reject;
    });
    this.openSSE(); // Initiates SSE connection

    const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('[MCPClient] Timeout: Did not receive endpoint event within 10s')), 10000)
    );

    try {
      await Promise.race([this.msgUrlReadyPromise, timeoutPromise]);
    } catch (error) {
      this.close();
      throw error;
    }

    const initId = this.nextId++;

    // 1. Create a promise that will resolve when the 'initialize' response is processed
    const initializeResponsePromise = new Promise<void>((resolveInitializeResponse, rejectInitializeResponse) => {
      this.pending.set(initId, (resultOrError) => { // 2. SET THE RESOLVER for initId
        if (resultOrError && typeof resultOrError === 'object' && 'code' in resultOrError && 'message' in resultOrError && !('result' in resultOrError)) { // Check if it's a JSON-RPC error structure
          rejectInitializeResponse(new Error(`Initialize failed: ${resultOrError.message} (code: ${resultOrError.code})`));
        } else {
          resolveInitializeResponse();
        }
      });
    });

    const initReq: JsonRpcRequest = {
      jsonrpc: '2.0', id: initId, method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, clientInfo: { name: 'ExpoMCPClient', version: '0.1.0' } },
    };
    
    try {
      // 3. SEND THE REQUEST (POST)
      await this.postJSON(initReq);
      // 4. WAIT FOR THE RESPONSE to be processed via the resolver set above
      await initializeResponsePromise;
    } catch (error) {
      this.pending.delete(initId); 
      this.close(); // Close SSE connection as handshake failed
      throw error; // Rethrow to ensure connect() fails clearly and MCPManager can see this failure
    }

    const notif = { jsonrpc: '2.0' as const, method: 'notifications/initialized' };
    await this.postJSON(notif);
  }

  /**
   * Discovers available tools by sending 'tools/list' to the dynamic messages endpoint.
   * @returns Resolves with an array of tool definitions.
   */
  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.msgUrl) {
      throw new Error('[MCPClient] Not connected or msgUrl not received.');
    }
    const reqId = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: reqId, method: 'tools/list' };

    const listToolsResponsePromise = new Promise<McpToolDefinition[]>((resolve, reject) => {
      this.pending.set(reqId, (resultOrError) => {
        if (resultOrError && typeof resultOrError === 'object' && 'code' in resultOrError && 'message' in resultOrError && !('result' in resultOrError)) {
          reject(new Error(`tools/list failed: ${resultOrError.message} (code: ${resultOrError.code})`));
        } else if (resultOrError && Array.isArray((resultOrError as any).tools)) {
          const validatedTools = ((resultOrError as any).tools as any[]).map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema || t.input_schema || {}, // Prefer input_schema, fallback to inputSchema, then empty object
            annotations: t.annotations
          }));
          this.tools = validatedTools;
          resolve(this.tools);
        } else {
          reject(new Error('Invalid response format for tools/list'));
        }
      });
    });

    try {
      await this.postJSON(req); // Send request AFTER resolver is set
      return await listToolsResponsePromise; // Wait for the response to be processed
    } catch (error) {
      this.pending.delete(reqId); // Clean up resolver if postJSON failed or promise rejected
      throw error; // Rethrow to ensure the caller (MCPManager) sees this failure
    }
  }

  /**
   * Invokes a tool by name and arguments via the dynamic messages endpoint.
   * @param name Tool name.
   * @param args Arguments object for the tool.
   * @returns Resolves with the tool call result.
   */
  async callTool(name: string, args: object): Promise<any> {
    if (!this.msgUrl) throw new Error('[MCPClient] Not connected or msgUrl not received.');
    const reqId = this.nextId++;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: reqId, method: 'tools/call', params: { name, arguments: args } };
    await this.postJSON(req);
    return new Promise((resolve) => {
      this.pending.set(reqId, (result) => {
        resolve(result);
      });
    });
  }

  /** Closes the SSE connection. */
  close(): void {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = undefined;
      this.lastProcessedSSELength = 0; // Reset on close
      this.buffer = ''; // Clear buffer on close
    }
  }

  private openSSE(): void {
    this.xhr = new XMLHttpRequest();
    this.lastProcessedSSELength = 0; // Reset for new connection
    this.buffer = ''; // Reset for new connection
    this.xhr.open('GET', this.sseUrl, true);
    if (this.authToken) this.xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
    this.xhr.onreadystatechange = () => {
      if (!this.xhr || this.xhr.readyState < 3) return; // Not yet receiving or already closed
      
      const newChunk = this.xhr.responseText.substring(this.lastProcessedSSELength);
      this.lastProcessedSSELength = this.xhr.responseText.length;
      if (newChunk) {
        this.handleSSEChunk(newChunk); // Process only the new part
      }

      if (this.xhr.readyState === 4) { // DONE
        this.close(); // Ensure cleanup if connection ends abruptly
      }
    };
    this.xhr.onerror = (e) => { 
      if (!this.msgUrl) this.rejectMsgUrlReady(new Error('SSE connection error before endpoint received'));
      this.close(); 
    };
    this.xhr.onload = () => { 
      if (!this.msgUrl && this.xhr && this.xhr.readyState === 4 && this.lastProcessedSSELength === 0) {
         // If onload fires, connection is done, but we never got data or an endpoint
         this.rejectMsgUrlReady(new Error('SSE stream closed without receiving endpoint event.'));
      }
      this.close(); 
    }; 
    this.xhr.send();
  }

  private async postJSON(payload: JsonRpcRequest): Promise<void> {
    if (!this.msgUrl) throw new Error('[MCPClient] msgUrl not set. Cannot send POST.');
    const res = await fetch(this.msgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST failed: ${res.status} ${text}`);
    }
  }

  private handleSSEChunk(newChunk: string): void {
    this.buffer += newChunk;
    let eventEndIndex;
    while ((eventEndIndex = this.buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = this.buffer.substring(0, eventEndIndex);
      this.buffer = this.buffer.substring(eventEndIndex + 2);
      let eventType = 'message'; let eventData = '';
      rawEvent.split('\n').forEach(line => {
        if (line.startsWith('event:')) eventType = line.substring(6).trim();
        else if (line.startsWith('data:')) eventData += (eventData ? '\n' : '') + line.substring(5).trim();
      });
      if (eventData) this._processSSEEvent(eventType, eventData);
    }
  }

  private _processSSEEvent(type: string, data: string): void {
    if (type === 'endpoint') {
      try {
        const endpointUrl = new URL(data, this.baseUrl); // data can be relative or absolute
        if (endpointUrl.origin !== new URL(this.baseUrl).origin) {
          const errorMsg = `Endpoint origin (${endpointUrl.origin}) forbidden, does not match base URL origin (${new URL(this.baseUrl).origin}).`;
          this.rejectMsgUrlReady(new Error(errorMsg)); 
          this.close(); 
          return;
        }
        if (!this.msgUrl) { // Set msgUrl only once
            this.msgUrl = endpointUrl.toString();
            this.resolveMsgUrlReady();
        } else {
        }
      } catch (error) {
        if (!this.msgUrl) this.rejectMsgUrlReady(error);
        this.close();
      }
    } else if (type === 'message' || !type) { // !type handles cases where event line is missing
      try {
        const msg: JsonRpcResponse = JSON.parse(data);
        this.handleJSONMessage(msg);
      } catch (e) { }
    } else {
    }
  }

  private handleJSONMessage(msg: JsonRpcResponse): void {
    if (msg.id !== undefined) {
      const resolver = this.pending.get(msg.id);
      if (resolver) { resolver(msg.result ?? msg.error); this.pending.delete(msg.id); }
    }
    // Notifications (msg.method without id) can be handled here if needed in future.
  }
} 