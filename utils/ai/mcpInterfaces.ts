/**
 * @file Defines TypeScript interfaces for Model Context Protocol (MCP) interactions
 * and for converting MCP tool definitions to the OpenAI function calling format.
 */

/**
 * Represents a JSON-RPC request object, commonly used for communication
 * with MCP servers.
 */
export interface JsonRpcRequest {
  /** The JSON-RPC version string, typically "2.0". */
  jsonrpc: "2.0";
  /** A unique identifier for the request, can be a string or number. */
  id: string | number;
  /** The name of the method to be invoked on the server. */
  method: string;
  /**
   * An optional structured value that holds the parameters to be used
   * during the invocation of the method.
   */
  params?: any;
}

/**
 * Describes the structure of a tool definition as provided by an MCP server.
 * This interface is based on common patterns and may need adjustment
 * to match a specific MCP server's output.
 */
export interface McpToolDefinition {
  /** The name of the tool, which should be unique. */
  name: string;
  /** A human-readable description of what the tool does. */
  description: string;
  /**
   * Defines the input schema for the tool, often using a JSON Schema-like structure.
   */
  input_schema: {
    /** Specifies the type of the schema, typically 'object'. */
    type: 'object';
    /**
     * An object where each key is a parameter name and the value defines
     * the parameter's type and other properties.
     */
    properties: {
      [key: string]: {
        /** The data type of the parameter (e.g., 'string', 'number', 'boolean'). */
        type: string;
        /** An optional description of the parameter. */
        description?: string;
        /** For 'string' type, an optional array of allowed enum values. */
        enum?: string[];
        // ... other JSON schema properties like 'items' for arrays, etc.
      };
    };
    /** An optional array of parameter names that are required by the tool. */
    required?: string[];
  };
  // Potentially other fields relevant to the MCP tool definition.
}

/**
 * Represents the structure of a function tool in the OpenAI API format.
 * This is used when informing the AI model about available client-side functions.
 */
export interface OpenAIFunction {
  /** The type of the tool, currently only "function" is supported by OpenAI. */
  type: "function";
  /**
   * Describes the function itself.
   */
  function: {
    /**
     * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain
     * underscores and dashes, with a maximum length of 64.
     */
    name: string;
    /**
     * A description of what the function does, used by the model to decide when and
     * how to call the function.
     */
    description: string;
    /**
     * The parameters the functions accepts, described as a JSON Schema object.
     * See the [OpenAI guide](https://platform.openai.com/docs/guides/gpt/function-calling)
     * for more details.
     */
    parameters: {
      /** Specifies the type of the schema, typically 'object'. */
      type: 'object';
      /**
       * An object where each key is a parameter name and the value defines
       * the parameter's type, description, and other properties according to JSON Schema.
       */
      properties: {
        [key: string]: {
          /** The data type of the parameter (e.g., 'string', 'number', 'boolean'). */
          type: string;
          /** An optional description of the parameter. */
          description?: string;
          /** For 'string' type, an optional array of allowed enum values. */
          enum?: string[];
          // ... other JSON schema properties
        };
      };
      /** An optional array of parameter names that are required by the function. */
      required?: string[];
    };
  };
} 