/**
 * @file AiApiClient.ts - Abstraction class for interacting with AI APIs.
 * Manages client initialization, API calls for chat completions (standard and MCP-enhanced),
 * and related helper functions.
 */

import OpenAI from 'openai-react-native';
import {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionContentPart,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';

import * as SystemStore from '../../store/ModelStore'; // Adjusted path
import { Message } from '../Interfaces'; // Adjusted path
import { AppError } from '../errorHandler'; // Adjusted path
import { t } from '@/config/i18n'; // Path might need checking based on project structure
import { SYSTEM_PROMPT } from '../../constants/system_prompt'; // Adjusted path
import { handleAppError } from '../errorHandler'; // Import handleAppError for user-facing error toasts

import { McpToolDefinition, OpenAIFunction } from './mcpInterfaces';
import { OpenAITool, convertMcpToolsToOpenAI } from './mcpToOpenAiConverter';
import { MCPClient } from './mcpClient';
import mcpConfigFromFile from './mcp.json'; // Import the JSON configuration
import { MCPManager } from './mcpManager'; // Added import
import { executeMcpTool, ToolCallRequest } from './mcpToolExecutor'; // Import new executor
import { feedbackTool } from './tools/FeedbackTool';

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

// Cast the imported JSON to our defined type for type safety
const mcpConfiguration = mcpConfigFromFile as McpConfigFile;

/**
 * Type definition for the callback function used in streaming.
 * @param chunk - A piece of the response text, or null.
 * @param error - An error object if an error occurred, otherwise undefined.
 * @param isFinished - Boolean indicating if the stream has finished (successfully or with error).
 */
export type StreamUpdateCallback = (chunk: string | null, error?: Error, isFinished?: boolean) => void;

export class AiApiClient {
  private openAIClient: OpenAI | null = null;
  private currentBaseURL: string | null = null;
  private currentApiKey: string | null = null;

  constructor() {
    // Constructor can be expanded later if initial configuration is needed.
  }

  /**
   * Retrieves API key from SystemStore for a specific provider.
   * @param providerId The ID of the AI provider.
   * @returns Credentials object { key: string } or null if not found.
   */
  private async _getCredentials(providerId: string): Promise<{ key: string; org?: string } | null> {
    // Logic from openaiService.getCredentials
    try {
      const apiKey = await SystemStore.getApiKey(providerId);
      if (!apiKey) {
        return null;
      }
      return { key: apiKey };
    } catch (error) {
      return null;
    }
  }

  /**
   * Finds the Provider ID for a given model ID from AI_PROVIDER_CONFIGS.
   * Uses SystemStore.getProviderConfigForModel(modelId)?.id
   * @param modelId - The ID of the model.
   * @returns The Provider ID string or null if not found.
   */
  private _getProviderIdForModel(modelId: string): string | null {
    const providerConfig = SystemStore.getProviderConfigForModel(modelId);
    return providerConfig ? providerConfig.id : null;
  }

  /**
   * Finds the API URL for a given model ID.
   * Uses SystemStore.getProviderConfigForModel(modelId)?.apiUrl
   * @param modelId - The ID of the model.
   * @returns The API URL string or null if not found.
   */
  private _getApiUrlForModel(modelId: string): string | null {
    const providerConfig = SystemStore.getProviderConfigForModel(modelId);
    return providerConfig ? providerConfig.apiUrl : null;
  }

  /**
   * Initializes or returns the existing OpenAI client instance.
   * @param modelId - The ID of the model to determine the API endpoint and credentials.
   * @returns Initialized OpenAI client or null on failure.
   */
  private async _initializeClient(modelId: string): Promise<OpenAI | null> {
    // Logic from openaiService.initializeOpenAIClient
    const apiUrl = this._getApiUrlForModel(modelId);
    if (!apiUrl) return null;

    const providerId = this._getProviderIdForModel(modelId);
    if (!providerId) return null;

    const credentials = await this._getCredentials(providerId);
    if (!credentials) return null;

    if (this.openAIClient && this.currentBaseURL === apiUrl && this.currentApiKey === credentials.key) {
      return this.openAIClient;
    }

    if (this.openAIClient) {
      this._invalidateClient();
    }

    try {
      this.openAIClient = new OpenAI({
        baseURL: apiUrl,
        apiKey: credentials.key,
      });
      this.currentBaseURL = apiUrl;
      this.currentApiKey = credentials.key;
      return this.openAIClient;
    } catch (error) {
      this._invalidateClient();
      return null;
    }
  }

  /**
   * Invalidates the current OpenAI client instance.
   */
  private _invalidateClient(): void {
    // Logic from openaiService.invalidateOpenAIClient
    this.openAIClient = null;
    this.currentBaseURL = null;
    this.currentApiKey = null;
  }

  /**
   * Creates a dynamic system prompt including user details and current time.
   * @returns A string containing the system prompt.
   */
  private async _createDynamicSystemPrompt(): Promise<string> {
    // Logic from openaiService.createDynamicSystemPrompt
    const userName = await SystemStore.getUserName();
    const userCountry = await SystemStore.getUserCountry();
    const userLanguage = await SystemStore.getUserLanguage();
    const currentTime = new Date().toLocaleString();

    let dynamicPrompt = SYSTEM_PROMPT;
    dynamicPrompt += "\n\n--- User & Session Context ---";
    if (userName) dynamicPrompt += `\nUser's name: ${userName}.`;
    if (userCountry) dynamicPrompt += `\nUser's country: ${userCountry}.`;
    dynamicPrompt += `\nCurrent time: ${currentTime}.`;
    dynamicPrompt += "\n--------------------------------";
    return dynamicPrompt;
  }

  /**
   * Maps an internal Message to an OpenAI API compatible ChatCompletionMessageParam.
   * @param message Our internal Message object.
   * @returns OpenAI API compatible message object or null if content is invalid.
   */
  private _mapMessageToOpenAIParam(message: Message): ChatCompletionMessageParam | null {
    const { role, content, name, tool_calls, tool_call_id } = message;
    let apiMessageContent: string | ChatCompletionContentPart[] | null = null;
    if (typeof content === 'string') {
      apiMessageContent = content;
    } else if (Array.isArray(content)) {
      apiMessageContent = content as ChatCompletionContentPart[];
    } else if (content === null) {
      apiMessageContent = null;
    }

    switch (role) {
      case 'system':
        if (typeof apiMessageContent !== 'string') return null;
        return { role: 'system', content: apiMessageContent, name } as ChatCompletionSystemMessageParam;
      case 'user':
        if (apiMessageContent === null) return null;
        return { role: 'user', content: apiMessageContent, name } as ChatCompletionUserMessageParam;
      case 'assistant':
        let assistantContentForAPI: string | null = null;
        if (typeof apiMessageContent === 'string') {
          assistantContentForAPI = apiMessageContent;
        } else if (apiMessageContent === null) {
          assistantContentForAPI = null;
        } else if (Array.isArray(apiMessageContent)){
          const textPart = apiMessageContent.find(p => p.type === 'text');
          assistantContentForAPI = textPart && 'text' in textPart ? textPart.text as string : null;
        }
        const assistantMsg: ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: assistantContentForAPI,
        };
        if (name) assistantMsg.name = name;
        if (tool_calls && tool_calls.length > 0) {
          assistantMsg.tool_calls = tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          } as ChatCompletionMessageToolCall));
        }
        return assistantMsg;
      case 'tool':
        if (!tool_call_id || typeof apiMessageContent !== 'string') return null;
        return { role: 'tool', content: apiMessageContent, tool_call_id } as ChatCompletionToolMessageParam;
      default:
        return null;
    }
  }

  /**
   * Initiates a streaming chat completion request.
   * @param messages - Array of messages in the conversation history.
   * @param callback - Function to call with stream updates.
   * @param modelId - The ID of the model to use.
   */
  public async streamChatCompletion(
    messages: Message[],
    callback: StreamUpdateCallback,
    modelId: string
  ): Promise<void> {
    const client = await this._initializeClient(modelId);
    if (!client) {
      const providerIdForError = this._getProviderIdForModel(modelId) || 'unknown_provider';
      const apiUrlForError = this._getApiUrlForModel(modelId) || 'unknown_url';
      const technicalMessage = `AI client failed to initialize for model ${modelId} (provider: ${providerIdForError}, URL: ${apiUrlForError}).`;
      const error = new AppError(technicalMessage, t('error.apiClientInitFailed'));
      handleAppError(error);
      callback(null, error, true);
      return;
    }

    const dynamicSystemPromptContent = await this._createDynamicSystemPrompt();
    const systemApiMessage: ChatCompletionSystemMessageParam = {
      role: 'system',
      content: dynamicSystemPromptContent,
    };

    const userMappedMessages: ChatCompletionMessageParam[] = messages
      .map(msg => this._mapMessageToOpenAIParam(msg))
      .filter((msg): msg is ChatCompletionMessageParam => msg !== null);

    const apiMessages: ChatCompletionMessageParam[] = [systemApiMessage, ...userMappedMessages];

    if (userMappedMessages.length === 0 && messages.length > 0) {
       const technicalMessage = `No valid user-provided messages could be mapped to OpenAI format for model ${modelId}.`;
       const error = new AppError(technicalMessage, t('error.messageMappingFailed'));
       handleAppError(error);
       callback(null, error, true);
       return;
    }
    
    const temperature = await SystemStore.getModelTemperature();
    const requestPayload: ChatCompletionCreateParams = {
      model: modelId,
      messages: apiMessages,
      temperature: temperature,
      stream: true,
    };

    try {
      client.chat.completions.stream(
        requestPayload as any, // Using 'as any' due to persistent type issues from previous steps
        (data: any) => { 
          const contentDelta = data.choices?.[0]?.delta?.content;
          if (contentDelta) {
            callback(contentDelta, undefined, false);
          } else if (data.choices?.[0]?.delta) {
             callback(null, undefined, false);
          }
        },
        {
          onOpen: () => { },
          onError: (error: any) => {
            const detailedErrorMessage = `SSE Error: ${error?.message || "Unknown SSE error"}. URL: ${client.baseURL}/chat/completions. Status: ${error?.status || 'N/A'}. Type: ${error?.error?.type || 'N/A'}`;
            const appError = new AppError(detailedErrorMessage, t('error.streamError'), error);
            handleAppError(appError);
            callback(null, appError, true);
          },
          onDone: () => {
            callback(null, undefined, true);
          },
        }
      );
    } catch (error: any) {
      const detailedErrorMessage = `Setup Stream Error: ${error?.message || "Unknown setup error"}. URL: ${client?.baseURL || 'unknown_url'}/chat/completions.`;
      const appError = new AppError(detailedErrorMessage, t('error.streamError'));
      handleAppError(appError);
      callback(null, appError, true);
    }
  }

  /**
   * Initiates a streaming chat completion request with MCP tool integration,
   * using a named server configuration from mcp.json.
   * @param messages - Array of messages in the conversation history.
   * @param callback - Function to call with stream updates.
   * @param modelId - The ID of the model to use.
   * @param mcpServerName - The name of the MCP server configuration (e.g., "Activepieces") from mcp.json.
   * @param onToolMessage - Optional callback to emit tool Message(s) after tool execution.
   */
  public async streamChatCompletionWithMcp(
    messages: Message[],
    callback: StreamUpdateCallback,
    modelId: string,
    mcpServerName: string,
    onToolMessage?: (toolMessages: Message[]) => void
  ): Promise<void> {
    const client = await this._initializeClient(modelId);
    if (!client) {
      const providerIdForError = this._getProviderIdForModel(modelId) || 'unknown_provider';
      const apiUrlForError = this._getApiUrlForModel(modelId) || 'unknown_url';
      const technicalMessage = `AI client failed to initialize for model ${modelId} (provider: ${providerIdForError}, URL: ${apiUrlForError}).`;
      const error = new AppError(technicalMessage, t('error.apiClientInitFailed'));
      handleAppError(error);
      callback(null, error, true);
      return;
    }

    let openAITools: OpenAITool[] = [feedbackTool];
    try {
      const mcpManager = MCPManager.getInstance();
      const toolsFromManager = await mcpManager.getTools(mcpServerName);
      // Only include active tools
      const activeTools = (toolsFromManager || []).filter(tool => tool.isActive);
      openAITools = [feedbackTool, ...convertMcpToolsToOpenAI(activeTools)];
      if (openAITools.length > 0) {
      } else if ((toolsFromManager || []).length > 0) {
      }
    } catch (mcpError: any) {
      if (mcpError && mcpError.stack) {
      }
      handleAppError(mcpError, `MCP Tool Error: ${mcpServerName}`);
    }

    const dynamicSystemPromptContent = await this._createDynamicSystemPrompt();
    const systemApiMessage: ChatCompletionSystemMessageParam = { role: 'system', content: dynamicSystemPromptContent };
    const userMappedMessages: ChatCompletionMessageParam[] = messages.map(msg => this._mapMessageToOpenAIParam(msg)).filter(Boolean) as ChatCompletionMessageParam[];
    const apiMessages: ChatCompletionMessageParam[] = [systemApiMessage, ...userMappedMessages];

    if (userMappedMessages.length === 0 && messages.length > 0) { 
        const technicalMessage = `No valid user-provided messages could be mapped for model ${modelId}.`;
        const error = new AppError(technicalMessage, t('error.messageMappingFailed'));
        handleAppError(error);
        callback(null, error, true);
        return;
    }
    
    const temperature = await SystemStore.getModelTemperature();
    const requestPayloadMcp: ChatCompletionCreateParams = {
      model: modelId, messages: apiMessages, temperature: temperature, stream: true,
    };
    if (openAITools.length > 0) {
      requestPayloadMcp.tools = openAITools;
      requestPayloadMcp.tool_choice = "auto";
    } else {
      // No tools to add
    }

    let accumulatedToolCalls: ChatCompletionMessageToolCall[] = [];
    let processingToolCalls = false; // Flag to manage tool call state for onDone
    let lastFinishReason: string | null = null;
    let assistantMessageContentForToolCall: string | null = null; // Buffer for assistant's text content from 1st stream

    try {
      client.chat.completions.stream(
        requestPayloadMcp as any, 
        async (data: any) => { // This is onDelta for the FIRST stream
          const choice = data.choices?.[0];
          const delta = choice?.delta;

          if (choice?.finish_reason) {
            lastFinishReason = choice.finish_reason;
          }

          if (delta?.content) {
            callback(delta.content, undefined, false);
            assistantMessageContentForToolCall = (assistantMessageContentForToolCall || '') + delta.content; // Still buffer it
          }
          
          if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = typeof toolCallDelta.index === 'number' ? toolCallDelta.index : accumulatedToolCalls.length;
              
              // Ensure the target index exists or is the next one to be added
              while (accumulatedToolCalls.length <= index) {
                accumulatedToolCalls.push({
                  id: '', // Placeholder, will be filled
                  type: 'function',
                  function: { name: '', arguments: '' }
                });
              }

              if (toolCallDelta.id) {
                accumulatedToolCalls[index].id = toolCallDelta.id;
              }
              if (toolCallDelta.type) {
                 accumulatedToolCalls[index].type = toolCallDelta.type as 'function';
              }
              if (toolCallDelta.function?.name) {
                accumulatedToolCalls[index].function.name = toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                accumulatedToolCalls[index].function.arguments += toolCallDelta.function.arguments;
              }
            }
          }

          if (lastFinishReason === 'tool_calls') {
            if (!processingToolCalls && accumulatedToolCalls.length > 0 && accumulatedToolCalls.every(tc => tc.id && tc.function.name)) { 
              processingToolCalls = true; // Prevent re-entry

              // 1. Construct the assistant's message that requested tools
              const assistantMessageWithToolRequest: ChatCompletionAssistantMessageParam = {
                role: 'assistant',
                content: assistantMessageContentForToolCall, // Use accumulated content from first stream
                tool_calls: accumulatedToolCalls,
              };

              // 2. Execute tools
              const toolRequests: ToolCallRequest[] = accumulatedToolCalls.map(tc => ({
                id: tc.id, name: tc.function.name, arguments: tc.function.arguments,
              }));
              const toolExecutionResults = await Promise.all(toolRequests.map(executeMcpTool));

              // 3. Construct tool messages for OpenAI
              const toolMessagesForApi: ChatCompletionToolMessageParam[] = toolExecutionResults.map(tr => ({
                tool_call_id: tr.tool_call_id,
                role: 'tool' as const,
                name: tr.name, // Ensure the name here matches the function name in tool_calls
                content: tr.content,
              }));
              // Emit local tool Message(s) for storage/UI if callback provided
              if (onToolMessage) {
                const now = new Date().toISOString();
                const toolMessagesForStore: Message[] = toolExecutionResults.map(tr => ({
                  id: tr.tool_call_id,
                  chat_id: 0, // Let the store fill in the correct chat_id
                  model: modelId,
                  role: 'tool',
                  tool_call_id: tr.tool_call_id,
                  name: tr.name,
                  content: tr.content,
                  timestamp: now,
                  raw_message: tr,
                }));
                onToolMessage(toolMessagesForStore);
              }
              // 4. Prepare messages for the follow-up AI call
              const messagesForFollowUp: ChatCompletionMessageParam[] = [
                ...requestPayloadMcp.messages,       // Original history (system, user, previous assistant messages)
                assistantMessageWithToolRequest,    // Assistant's message with tool_calls
                ...toolMessagesForApi,              // Tool results
              ];
              // 5. Make the second streaming call
              const followUpPayload: ChatCompletionCreateParams = {
                ...requestPayloadMcp, // model, temp, etc. from original request
                messages: messagesForFollowUp,
                tools: undefined,       // Typically, no tools are defined for the follow-up call,
                tool_choice: undefined, // as the AI should generate a text response.
              };
              client.chat.completions.stream(
                followUpPayload as any,
                (followUpData: any) => { // onDelta for the SECOND stream
                  const followUpChoice = followUpData.choices?.[0];
                  const followUpDelta = followUpChoice?.delta;
                  if (followUpDelta?.content) {
                    callback(followUpDelta.content, undefined, false);
                  }
                },
                { // onMeta for the SECOND stream
                  onOpen: () => {},
                  onError: (error: any) => {
                    const detailedFollowUpErrorMessage = `Follow-up SSE Error: ${error?.message || 'Unknown SSE error'}. Status: ${error?.status || 'N/A'}. Type: ${error?.error?.type || 'N/A'}`;
                    const appError = new AppError(detailedFollowUpErrorMessage, t('error.streamError'), error);
                    handleAppError(appError);
                    processingToolCalls = false; // Reset on error
                  },
                  onDone: () => {
                    callback(null, undefined, true); // Final completion of the whole interaction
                    processingToolCalls = false; // Reset after successful completion
                  },
                }
              );
            } else if (lastFinishReason === 'tool_calls' && accumulatedToolCalls.length === 0 && !processingToolCalls) {
            }
          }
        },
        { // onMeta for the FIRST stream
          onOpen: () => {},
          onError: (error: any) => {
            assistantMessageContentForToolCall = null;
            const detailedInitialErrorMessage = `Initial SSE Error: ${error?.message || 'Unknown SSE error'}. URL: ${client.baseURL}/chat/completions. Status: ${error?.status || 'N/A'}. Type: ${error?.error?.type || 'N/A'}`;
            const appError = new AppError(detailedInitialErrorMessage, t('error.streamError'), error);
            handleAppError(appError);
            processingToolCalls = false; // Reset on error
          },
          onDone: () => {
            if (!processingToolCalls) { 
              assistantMessageContentForToolCall = null;
              callback(null, undefined, true); // Signal completion of this interaction phase
            }
          },
        }
      );
    } catch (error: any) {
      const appError = new AppError(`Setup Stream Error: ${error?.message || 'Unknown setup error'}`, t('error.streamError'));
      handleAppError(appError);
      callback(null, appError, true);
    }
  }
} 