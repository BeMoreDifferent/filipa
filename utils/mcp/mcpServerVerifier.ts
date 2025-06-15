/**
 * MCP Server Verifier Utility
 * Provides a function to verify MCP server connectivity and status.
 */
import { Colors } from '@/constants/Colors';

/**
 * Enum representing the MCP server connection status.
 */
export enum McpServerStatus {
  InvalidUrl = 'invalid_url',
  Connecting = 'connecting',
  AuthTokenMissing = 'auth_token_missing',
  NotFound = 'not_found',
  Success = 'success',
}

/**
 * Sends a JSON RPC message to an MCP server and returns the response or throws an error.
 * @param url The URL of the MCP server.
 * @param message The JSON RPC message to send.
 * @param apiToken Optional API token for authorization (Bearer token).
 * @returns A Promise that resolves with the server's JSON response data.
 * @throws An Error if the network request fails, the server responds with a non-OK status,
 * or the response cannot be parsed as JSON.
 */
export async function getMcpServerState(
  url: string,
  message: any,
  apiToken?: string
): Promise<any> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (apiToken) {
      headers['Authorization'] = `Bearer ${apiToken}`;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(message),
    });
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    // Log the full rawBody for list and initialize calls to debug SSE data
    if (message.method && ['tools/list', 'resources/list', 'prompts/list', 'initialize'].includes(message.method)) {
    }
    if (!response.ok) {
      let errorBody = rawBody;
      try {
        const jsonError = JSON.parse(errorBody);
        errorBody = `JSON Error: ${JSON.stringify(jsonError, null, 2)}`;
      } catch (e) {}
      throw new Error(`HTTP Error: ${response.status} - ${response.statusText}. Response body: ${errorBody}`);
    }
    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(rawBody);
        return data;
      } catch (e: any) {
        throw new Error('JSON Parse error: ' + e.message);
      }
    } else if (contentType.includes('text/event-stream')) {
      // Parse SSE: extract all data: lines, parse as JSON, return array of all events
      const events = rawBody.split(/\r?\n/).filter(line => line.startsWith('data:'));
      const parsedEvents: any[] = [];
      for (const event of events) {
        const jsonStr = event.replace(/^data:\s*/, '');
        try {
          const parsed = JSON.parse(jsonStr);
          parsedEvents.push(parsed);
        } catch (err) {
        }
      }
      if (parsedEvents.length === 1) return parsedEvents[0];
      if (parsedEvents.length > 1) return parsedEvents;
      return { result: 'success' };
    } else {
      return { error: 'Unexpected content-type: ' + contentType };
    }
  } catch (error: any) {
    throw new Error(`Failed to get MCP server state: ${error.message}`);
  }
}

/**
 * Verifies the MCP server connection and returns the status.
 * @param url - The MCP server URL.
 * @param authToken - The authentication token.
 * @returns Promise<McpServerStatus>
 * @example
 * const status = await verifyMcpServer('http://localhost:8000', 'token');
 */
export async function verifyMcpServer(url: string, authToken: string): Promise<McpServerStatus> {
  if (!url || !/^https?:\/\//.test(url)) {
    return McpServerStatus.InvalidUrl;
  }
  try {
    const response = await getMcpServerState(
      url,
      { jsonrpc: '2.0', method: 'ping', id: 1 },
      authToken
    );
    if (
      response &&
      (
        response.result === 'pong' ||
        response.result === 'success' ||
        (typeof response.result === 'object' && response.result && Object.keys(response.result).length === 0)
      )
    ) {
      return McpServerStatus.Success;
    }
    return McpServerStatus.NotFound;
  } catch (error: any) {
    if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
      return McpServerStatus.AuthTokenMissing;
    }
    return McpServerStatus.NotFound;
  }
} 