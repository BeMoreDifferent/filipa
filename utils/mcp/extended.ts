import { getMcpServerState, verifyMcpServer, McpServerStatus } from './mcpServerVerifier';

/** Core info sent by the server during initialization */
export interface ServerInfo {
  /** Human-readable server name */
  name: string;
  /** Semantic version (e.g. 1.0.0) */
  version: string;
  /** Optional description supplied by the server */
  description?: string;
  /** Optional additional instructions */
  instructions?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

export interface McpServerDefinitions {
  tools: ToolDefinition[];
  resources: ResourceDefinition[];
  prompts: PromptDefinition[];
}

export interface VerifyMcpServerResult {
  status: McpServerStatus;
  serverInfo?: ServerInfo;
  definitions?: McpServerDefinitions;
}

/**
 * Internal helper to drain any paginated list call.
 */
async function fetchPaginated<T>(
  baseUrl: string,
  method: string,
  resultKey: string,
  token: string
): Promise<T[]> {
  let cursor: string | undefined;
  const out: T[] = [];
  /* eslint-disable no-await-in-loop */
  do {
    const resp = await getMcpServerState(
      baseUrl,
      {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: cursor ? { cursor } : {},
      },
      token
    );
    const events = Array.isArray(resp) ? resp : [resp];
    let nextCursor: string | undefined = undefined;
    for (const event of events) {
      if (event?.result) {
      }
      if (event.error) continue;
      const page: T[] | undefined = event?.result?.[resultKey];
      if (page?.length) out.push(...page);
      if (event?.result?.nextCursor) nextCursor = event.result.nextCursor;
    }
    cursor = nextCursor;
  } while (cursor);
  /* eslint-enable no-await-in-loop */
  return out;
}

/**
 * Full verification + discovery (tools, resources, prompts + serverInfo).
 * @param url MCP server root URL
 * @param authToken Bearer auth token
 */
export async function verifyMcpServerExtended(
  url: string,
  authToken: string
): Promise<VerifyMcpServerResult> {
  const basicStatus = await verifyMcpServer(url, authToken);
  if (basicStatus !== McpServerStatus.Success) {
    return { status: basicStatus };
  }

  // 1. initialize handshake
  const initMsg = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'ReactNativeMcpClient', version: '1.0.0' },
    },
  } as const;

  const initResp = await getMcpServerState(url, initMsg, authToken);
  let serverInfo: ServerInfo | undefined;
  if (Array.isArray(initResp)) {
    for (const event of initResp) {
      if (event?.result?.serverInfo) {
        serverInfo = event.result.serverInfo;
        break;
      }
    }

  } else {
    serverInfo = initResp?.result?.serverInfo;
  }
  // 2. send initialized notification (no response expected)
  await getMcpServerState(
    url,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    authToken
  ).catch(() => undefined); // ignore transport errors for fire-and-forget

  // 3. concurrent discovery
  let tools: ToolDefinition[] = [];
  let resources: ResourceDefinition[] = [];
  let prompts: PromptDefinition[] = [];
  try {
    tools = await fetchPaginated<ToolDefinition>(url, 'tools/list', 'tools', authToken);
  } catch {}
  try {
    resources = await fetchPaginated<ResourceDefinition>(url, 'resources/list', 'resources', authToken);
  } catch {}
  try {
    prompts = await fetchPaginated<PromptDefinition>(url, 'prompts/list', 'prompts', authToken);
  } catch {}
  const result = {
    status: basicStatus,
    serverInfo,
    definitions: { tools, resources, prompts },
  };
  return result;
} 