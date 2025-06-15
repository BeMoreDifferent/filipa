/**
 * @file Provides functionality to convert Model Context Protocol (MCP) tool definitions
 * into the format expected by OpenAI for function calling.
 */

import { McpToolDefinition, OpenAIFunction } from './mcpInterfaces';

/**
 * Converts an array of MCP tool definitions into an array of OpenAI-compatible
 * function tool definitions.
 *
 * @param mcpTools An array of {@link McpToolDefinition} objects to convert.
 * @returns An array of {@link OpenAIFunction} objects, ready to be used with the OpenAI API.
 *          Returns an empty array if the input is empty or null.
 */
export function convertToOpenAIFunctions(mcpTools: McpToolDefinition[]): OpenAIFunction[] {
  if (!mcpTools || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map(mcpTool => {
    // OpenAI function names must be a-z, A-Z, 0-9, or contain underscores and dashes, max length 64.
    const openAiFunctionName = mcpTool.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64);

    const openAIFunc: OpenAIFunction = {
      type: "function",
      function: {
        name: openAiFunctionName,
        description: mcpTool.description,
        parameters: {
          type: 'object',
          properties: {},
          required: mcpTool.input_schema.required || []
        }
      }
    };

    if (mcpTool.input_schema && mcpTool.input_schema.properties) {
      for (const paramName in mcpTool.input_schema.properties) {
        const mcpParam = mcpTool.input_schema.properties[paramName];
        openAIFunc.function.parameters.properties[paramName] = {
          type: mcpParam.type,
          description: mcpParam.description || `Parameter ${paramName}`,
        };
        // Include enum if present in MCP definition
        if (mcpParam.enum && mcpParam.enum.length > 0) {
          openAIFunc.function.parameters.properties[paramName].enum = mcpParam.enum;
        }
      }
    }
    return openAIFunc;
  });
} 