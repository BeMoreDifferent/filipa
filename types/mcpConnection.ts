/**
 * Represents a Model Context Protocol (MCP) server connection.
 * @property url - The base URL of the MCP server (required).
 * @property authToken - Optional bearer token for authentication.
 * @example
 * const conn: McpConnection = { url: 'https://host.com/mcp/server-id', authToken: 'secret' };
 */
export type McpConnection = {
  url: string;
  authToken?: string;
}; 