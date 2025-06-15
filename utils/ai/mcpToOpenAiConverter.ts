/**
 * @file mcpToOpenAiConverter.ts - Converts MCP Tool Definitions to OpenAI Tool Format.
 */

/**
 * Represents the structure of an MCP tool definition as received from the server.
 */
export interface McpToolDefinition {
  name: string;
  description?: string;
  input_schema: object; // This is the JSON schema for the tool's input parameters
  annotations?: object;
}

/**
 * Represents the structure of a function parameter for an OpenAI tool.
 * This is typically a JSON schema object.
 */
export interface OpenAIFunctionParameters {
  type: 'object';
  properties: { [key: string]: any };
  required?: string[];
  [key: string]: any; // Allow other schema properties like $schema, additionalProperties etc.
}

/**
 * Represents the structure of a function definition for an OpenAI tool.
 */
export interface OpenAIFunction {
  name: string;
  description?: string;
  parameters: OpenAIFunctionParameters;
}

/**
 * Represents an OpenAI tool, specifically for functions.
 */
export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

/**
 * Converts a single MCP tool definition to the OpenAI tool format.
 *
 * @param mcpTool - The MCP tool definition.
 * @returns The OpenAI tool object, or null if the inputSchema is not a valid object.
 */
export function convertMcpToolToOpenAI(mcpTool: McpToolDefinition): OpenAITool | null {
  if (typeof mcpTool.input_schema !== 'object' || mcpTool.input_schema === null) {
    // console.warn(`[McpToOpenAiConverter] MCP tool '${mcpTool.name}' has invalid or missing input_schema. Skipping.`);
    return null;
  }

  // Ensure input_schema has at least type: 'object' and properties if it's to be valid for OpenAI
  const parameters = mcpTool.input_schema as any;
  if (typeof parameters.properties !== 'object') {
      parameters.properties = {}; // Ensure properties object exists, even if empty
  }
  if (!parameters.type) {
      parameters.type = 'object'; // Default to object if type is missing
  }

  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: parameters as OpenAIFunctionParameters,
    },
  };
}

/**
 * Converts an array of MCP tool definitions to an array of OpenAI tool objects.
 *
 * @param mcpTools - An array of MCP tool definitions.
 * @returns An array of OpenAI tool objects, filtering out any that couldn't be converted.
 */
export function convertMcpToolsToOpenAI(mcpTools: McpToolDefinition[]): OpenAITool[] {
  if (!Array.isArray(mcpTools)) {
    return [];
  }
  return mcpTools
    .map(tool => convertMcpToolToOpenAI(tool))
    .filter(tool => tool !== null) as OpenAITool[];
} 