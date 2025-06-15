/**
 * @file mcpToolExecutor.ts - Handles executing tool calls requested by the AI via an MCP server.
 */

import { MCPManager } from './mcpManager';
import { useMcpStore } from '../../store/mcpStore'; // Path from utils/ai to store
import { handleFeedbackTool } from './tools/FeedbackTool';

export interface ToolCallRequest {
  id: string; // The ID from the AI's tool_call request (e.g., "call_abc")
  name: string; // The name of the function/tool to call (e.g., "gmail-send_email")
  arguments: string; // JSON string of arguments from the AI
}

export interface ToolCallResult {
  tool_call_id: string; // Matches the id from the ToolCallRequest
  role: 'tool';
  name: string; // Matches the name from the ToolCallRequest
  content: string; // JSON string of the result from the tool execution, or an error message
}

// Add a static tools map for direct execution
const staticTools: Record<string, (args: any) => Promise<any>> = {
  feedback_yes_no: async (args) => {
    // args: { question: string }
    if (!args || typeof args.question !== 'string') {
      return { error: 'Missing or invalid question parameter.' };
    }
    return handleFeedbackTool(args.question);
  },
};

/**
 * Finds which MCP server provides a given tool and executes it.
 *
 * @param toolCall - The tool call request details from the AI.
 * @returns A Promise resolving to a ToolCallResult to be sent back to the AI.
 */
export async function executeMcpTool(toolCall: ToolCallRequest): Promise<ToolCallResult> {
  const { id: toolCallId, name: toolName, arguments: toolArgsString } = toolCall;
  let parsedArgs: object;
  try {
    parsedArgs = JSON.parse(toolArgsString);
  } catch (e: any) {
    console.error(`[McpToolExecutor] Failed to parse arguments for tool ${toolName}:`, toolArgsString, e);
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: toolName,
      content: JSON.stringify({ error: 'Failed to parse arguments', details: e.message }),
    };
  }

  // Handle static tools directly
  if (toolName in staticTools) {
    try {
      const result = await staticTools[toolName](parsedArgs);
      return {
        tool_call_id: toolCallId,
        role: 'tool',
        name: toolName,
        content: JSON.stringify(result),
      };
    } catch (err: any) {
      return {
        tool_call_id: toolCallId,
        role: 'tool',
        name: toolName,
        content: JSON.stringify({ error: err?.message || 'Static tool execution failed.' }),
      };
    }
  }

  const mcpStoreState = useMcpStore.getState();
  let targetServerName: string | undefined;
  let mcpClient;

  // Find which server has this tool
  for (const [serverName, toolsOnServer] of mcpStoreState.serverTools.entries()) {
    if (toolsOnServer.some(tool => tool.name === toolName && tool.isActive)) {
      targetServerName = serverName;
      break;
    }
  }

  if (!targetServerName) {
    console.warn(`[McpToolExecutor] Tool '${toolName}' not found or not active on any configured MCP server.`);
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: toolName,
      content: JSON.stringify({ error: `Tool '${toolName}' not found or is not active.` }),
    };
  }

  try {
    const manager = MCPManager.getInstance();
    mcpClient = await manager.getClient(targetServerName);

    if (!mcpClient) {
      throw new Error(`Failed to get MCP client for server '${targetServerName}'.`);
    }

    const result = await mcpClient.callTool(toolName, parsedArgs);
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: toolName,
      content: typeof result === 'string' ? result : JSON.stringify(result), // Ensure content is a string
    };
  } catch (error: any) {
    console.error(`[McpToolExecutor] Error executing tool '${toolName}' on server '${targetServerName}':`, error);
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      name: toolName,
      content: JSON.stringify({ error: `Execution failed for tool '${toolName}'`, details: error.message }),
    };
  }
} 