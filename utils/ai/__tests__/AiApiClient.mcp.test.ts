import { AiApiClient, StreamUpdateCallback } from '../AiApiClient';
import { AppError } from '../../errorHandler';
import * as SystemStore from '../../../store/ModelStore';
import { Message, ToolCall } from '../../Interfaces';
import { MCPManager } from '../mcpManager';
import { executeMcpTool } from '../mcpToolExecutor';
import { convertMcpToolsToOpenAI, OpenAITool } from '../mcpToOpenAiConverter';
import OpenAI from 'openai-react-native';
import { McpToolDefinition, OpenAIFunction } from '../mcpInterfaces';

// Mock external dependencies
jest.mock('openai-react-native');
jest.mock('../../../store/ModelStore');

// Mock for MCPManager with private constructor
const mockGetTools = jest.fn();
jest.mock('../mcpManager', () => ({
  MCPManager: {
    getInstance: jest.fn(() => ({
      getTools: mockGetTools,
    })),
  },
}));

jest.mock('../mcpToolExecutor');
jest.mock('../mcpToOpenAiConverter');
jest.mock('../../errorHandler', () => ({
  AppError: jest.fn().mockImplementation((message, userMessage, originalError) => {
    const err = new Error(message);
    (err as any).userMessage = userMessage;
    (err as any).originalError = originalError;
    return err;
  }),
}));
jest.mock('@/config/i18n', () => ({
  t: jest.fn((key) => key),
}));

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockMcpStream = jest.fn();
MockedOpenAI.prototype.chat = {
  completions: {
    stream: mockMcpStream,
  },
} as any;

// We get the mocked instance via MCPManager.getInstance() in tests now
const mockExecuteMcpTool = executeMcpTool as jest.Mock;
const mockConvertMcpToolsToOpenAI = convertMcpToolsToOpenAI as jest.Mock;

// Helper to create a valid Message object with defaults
const createMockMessage = (overrides: Partial<Message>): Message => {
  const defaults: Message = {
    id: `msg-${Date.now()}-${Math.random()}`,
    chat_id: 123,
    role: 'user',
    content: 'Test content',
    model: 'gpt-4',
    timestamp: new Date().toISOString(),
    raw_message: { text: 'Test content' },
  };
  return { ...defaults, ...overrides };
};

const validOpenAIParams: OpenAIFunction['function']['parameters'] = {
    type: 'object',
    properties: {},
    // No required fields for this default valid schema
};

describe('AiApiClient - MCP Chat Completion', () => {
  let apiClient: AiApiClient;
  let mockCallback: jest.Mock<StreamUpdateCallback>;
  let mcpManagerInstance: any; // To hold the mocked instance

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new AiApiClient();
    mockCallback = jest.fn();
    mcpManagerInstance = MCPManager.getInstance(); // Get the mocked instance

    (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValue({
      id: 'provider-mcp',
      apiUrl: 'https://mcp.api.openai.com/v1',
    });
    (SystemStore.getApiKey as jest.Mock).mockResolvedValue('test-mcp-api-key');
    (SystemStore.getUserName as jest.Mock).mockResolvedValue('MCP User');
    (SystemStore.getUserCountry as jest.Mock).mockResolvedValue('MC');
    (SystemStore.getUserLanguage as jest.Mock).mockResolvedValue('mcp-lang');
    (SystemStore.getModelTemperature as jest.Mock).mockResolvedValue(0.5);

    mockGetTools.mockResolvedValue([]);
    mockConvertMcpToolsToOpenAI.mockReturnValue([]);
    mockExecuteMcpTool.mockImplementation(async (toolCall) => ({
      tool_call_id: toolCall.id,
      name: toolCall.name,
      content: JSON.stringify({ result: `mocked result for ${toolCall.name}` }),
    }));
  });

  test('should stream chat completion with MCP tools successfully (no tool call)', async () => {
    const messages = [createMockMessage({ content: 'Hello MCP world' })];
    const modelId = 'gpt-mcp';
    const mcpServerName = 'TestServer';

    const mcpTools: McpToolDefinition[] = [
      { 
        name: 'get_weather', 
        description: 'Get weather', 
        input_schema: { type: 'object', properties: { location: { type: 'string'} } } 
      },
    ];
    const openAITools: OpenAITool[] = [
      { type: 'function', function: { name: 'get_weather', description: 'Get weather', parameters: {type: 'object', properties: { location: {type: 'string'}}} } },
    ];
    // mcpManagerInstance.getTools will be mockGetTools due to the module mock
    (mcpManagerInstance.getTools as jest.Mock).mockResolvedValue(mcpTools);
    mockConvertMcpToolsToOpenAI.mockReturnValue(openAITools);

    mockMcpStream.mockImplementation((payload, onDelta, onMeta) => {
      onDelta({ choices: [{ delta: { content: 'Response without tools' } }] });
      onMeta.onDone();
      return Promise.resolve();
    });

    await apiClient.streamChatCompletionWithMcp(messages, mockCallback, modelId, mcpServerName);

    expect(mcpManagerInstance.getTools).toHaveBeenCalledWith(mcpServerName);
    expect(mockConvertMcpToolsToOpenAI).toHaveBeenCalledWith(mcpTools);
    expect(mockMcpStream).toHaveBeenCalledTimes(1);
    const requestPayload = mockMcpStream.mock.calls[0][0];
    expect(requestPayload.tools).toEqual(openAITools);
    expect(requestPayload.tool_choice).toBe('auto');
    expect(mockCallback).toHaveBeenCalledWith('Response without tools', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
    expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  test('should handle MCP tool call and follow-up stream', async () => {
    const messages = [createMockMessage({ content: 'Call a tool' })];
    const modelId = 'gpt-mcp-tool';
    const mcpServerName = 'ToolServer';

    const mcpToolsFromManager: McpToolDefinition[] = [
        { name: 'test_tool', description: 'A test tool', input_schema: { type: 'object', properties: { param: { type: 'string' } } } }
    ];
    const openAIToolsForRequest: OpenAITool[] = [
        { type: 'function', function: { name: 'test_tool', description: 'A test tool', parameters: { type: 'object', properties: { param: { type: 'string'} } } } }
    ];
    (mcpManagerInstance.getTools as jest.Mock).mockResolvedValue(mcpToolsFromManager);
    mockConvertMcpToolsToOpenAI.mockReturnValue(openAIToolsForRequest);

    const assistantInitialContent = 'Okay, I will use the tool. ';
    const toolCallId = 'tool_abc123';
    const toolName = 'test_tool';
    const toolArgs = '{"param": "value"}';
    const toolResultContent = JSON.stringify({ success: true, data: 'tool used' });
    const finalResponseContent = 'The tool said: processed.';

    mockMcpStream
      .mockImplementationOnce((payload, onDelta, onMeta) => { 
        onDelta({ choices: [{ delta: { content: assistantInitialContent } }] });
        onDelta({ choices: [{ delta: {
          tool_calls: [
            { index: 0, id: toolCallId, type: 'function', function: { name: toolName, arguments: ''}},
            { index: 0, id: toolCallId, type: 'function', function: { arguments: toolArgs } },
          ]
        }}]
        });
        onDelta({ choices: [{ finish_reason: 'tool_calls' }] });
      })
      .mockImplementationOnce((payload, onDelta, onMeta) => { 
        expect(payload.messages.some((m:any) => m.role === 'tool' && m.tool_call_id === toolCallId && m.content === toolResultContent)).toBe(true);
        onDelta({ choices: [{ delta: { content: finalResponseContent } }] });
        onMeta.onDone();
      });
      
    mockExecuteMcpTool.mockResolvedValue({
        tool_call_id: toolCallId,
        name: toolName,
        content: toolResultContent
    });

    await apiClient.streamChatCompletionWithMcp(messages, mockCallback, modelId, mcpServerName);

    expect(mcpManagerInstance.getTools).toHaveBeenCalledWith(mcpServerName);
    expect(mockConvertMcpToolsToOpenAI).toHaveBeenCalledWith(mcpToolsFromManager);
    expect(mockExecuteMcpTool).toHaveBeenCalledWith({ id: toolCallId, name: toolName, arguments: toolArgs });
    expect(mockMcpStream).toHaveBeenCalledTimes(2);

    const firstStreamPayload = mockMcpStream.mock.calls[0][0];
    expect(firstStreamPayload.tools).toEqual(openAIToolsForRequest);
    expect(firstStreamPayload.tool_choice).toBe('auto');

    const secondStreamPayload = mockMcpStream.mock.calls[1][0];
    expect(secondStreamPayload.tools).toBeUndefined();
    expect(secondStreamPayload.tool_choice).toBeUndefined();
    const assistantMessageWithToolRequest = secondStreamPayload.messages.find((m:any) => m.role === 'assistant' && m.tool_calls);
    expect(assistantMessageWithToolRequest).toBeDefined();
    expect(assistantMessageWithToolRequest.content).toBe(assistantInitialContent);
    expect(assistantMessageWithToolRequest.tool_calls[0].id).toBe(toolCallId);
    expect(assistantMessageWithToolRequest.tool_calls[0].function.name).toBe(toolName);
    expect(assistantMessageWithToolRequest.tool_calls[0].function.arguments).toBe(toolArgs);

    const toolMessage = secondStreamPayload.messages.find((m:any) => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    expect(toolMessage.tool_call_id).toBe(toolCallId);
    expect(toolMessage.content).toBe(toolResultContent);

    expect(mockCallback).toHaveBeenCalledWith(assistantInitialContent, undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(finalResponseContent, undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
    expect(mockCallback).toHaveBeenCalledTimes(3);
  });

 test('should handle MCP client initialization failure', async () => {
    (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValue(null); 

    await apiClient.streamChatCompletionWithMcp([], mockCallback, 'test-model', 'TestServer');

    expect(mockMcpStream).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(AppError), true);
    const error = mockCallback.mock.calls[0][1] as AppError;
    expect(error.message).toContain('AI client failed to initialize');
    expect((error as any).userMessage).toBe('error.apiClientInitFailed');
  });

  test('should handle error when MCPManager fails to get tools', async () => {
    (mcpManagerInstance.getTools as jest.Mock).mockRejectedValue(new Error('MCP tool fetch failed'));
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    mockMcpStream.mockImplementation((payload, onDelta, onMeta) => {
      onDelta({ choices: [{ delta: { content: 'No tools today' } }] });
      onMeta.onDone();
      return Promise.resolve();
    });

    await apiClient.streamChatCompletionWithMcp([], mockCallback, 'test-model', 'NoToolServer');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AiApiClient] Error obtaining/converting MCP tools for NoToolServer:'),
      expect.any(Error)
    );
    expect(mockMcpStream).toHaveBeenCalledTimes(1);
    const requestPayload = mockMcpStream.mock.calls[0][0];
    expect(requestPayload.tools).toBeUndefined(); 
    expect(mockCallback).toHaveBeenCalledWith('No tools today', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
    
    consoleWarnSpy.mockRestore();
  });

  test('should handle error when tool execution fails', async () => {
    const messages = [createMockMessage({ content: 'Call a failing tool' })];
    const mcpServerName = 'FailingToolServer';
    const toolCallId = 'fail_tool_123';
    const toolName = 'failing_tool';

    (mcpManagerInstance.getTools as jest.Mock).mockResolvedValue([
      { name: toolName, description: 'This tool will fail', input_schema: { type: 'object', properties: {} } }
    ]);
    mockConvertMcpToolsToOpenAI.mockReturnValue([
      { type: 'function', function: { name: toolName, description: 'This tool will fail', parameters: validOpenAIParams } }
    ]);

    mockMcpStream
      .mockImplementationOnce((payload, onDelta, onMeta) => { 
        onDelta({ choices: [{ delta: { tool_calls: [
          { index: 0, id: toolCallId, type: 'function', function: { name: toolName, arguments: '{}'}}
        ]}}]
        });
        onDelta({ choices: [{ finish_reason: 'tool_calls' }] });
      })
      .mockImplementationOnce((payload, onDelta, onMeta) => { 
        expect(payload.messages.some((m:any) => m.role === 'tool' && m.tool_call_id === toolCallId && m.content.includes('Execution failed'))).toBe(true);
        onDelta({ choices: [{ delta: { content: 'Tool execution failed, cannot proceed.' } }] });
        onMeta.onDone();
      });

    mockExecuteMcpTool.mockResolvedValue({
        tool_call_id: toolCallId,
        name: toolName,
        content: JSON.stringify({ error: 'Execution failed for test_tool' }) 
    });

    await apiClient.streamChatCompletionWithMcp(messages, mockCallback, 'gpt-mcp-fail', mcpServerName);
    
    expect(mockExecuteMcpTool).toHaveBeenCalled();
    expect(mockMcpStream).toHaveBeenCalledTimes(2);
    expect(mockCallback).toHaveBeenCalledWith('Tool execution failed, cannot proceed.', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
  });

  test('should proceed without tools if MCPManager returns empty tools array', async () => {
    (mcpManagerInstance.getTools as jest.Mock).mockResolvedValue([]); 
    mockConvertMcpToolsToOpenAI.mockReturnValue([]); 

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    mockMcpStream.mockImplementation((payload, onDelta, onMeta) => {
      onDelta({ choices: [{ delta: { content: 'No tools configured.' } }] });
      onMeta.onDone();
      return Promise.resolve();
    });

    await apiClient.streamChatCompletionWithMcp([], mockCallback, 'test-model', 'EmptyToolServer');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AiApiClient] No tools found by MCPManager for EmptyToolServer.')
    );
    const requestPayload = mockMcpStream.mock.calls[0][0];
    expect(requestPayload.tools).toBeUndefined();
    expect(mockCallback).toHaveBeenCalledWith('No tools configured.', undefined, false);
    consoleLogSpy.mockRestore();
  });

  test('should handle first stream onError from OpenAI', async () => {
    mockMcpStream.mockImplementationOnce((payload, onDelta, onMeta) => {
        onMeta.onError(new Error('First stream SSE error'));
    });

    await apiClient.streamChatCompletionWithMcp([], mockCallback, 'error-model', 'ErrorServer');

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(AppError), true);
    const error = mockCallback.mock.calls[0][1] as AppError;
    expect(error.message).toContain('SSE Error: First stream SSE error');
    expect((error as any).userMessage).toBe('error.streamError');
  });

  test('should handle second stream (follow-up) onError from OpenAI', async () => {
    (mcpManagerInstance.getTools as jest.Mock).mockResolvedValue([
      { name: 'some_tool', description: 'desc', input_schema: { type: 'object', properties: { p: {type: 'string'}}} }
    ]);
    mockConvertMcpToolsToOpenAI.mockReturnValue([
      { type: 'function', function: { name: 'some_tool', description: 'desc', parameters: {type: 'object', properties: {p: {type: 'string'}}} } }
    ]);

    mockMcpStream
      .mockImplementationOnce((payload, onDelta, onMeta) => { 
        onDelta({ choices: [{ delta: { tool_calls: [
          { index: 0, id: 'tool_id_err', type: 'function', function: { name: 'some_tool', arguments: '{}'}}
        ]}}]
        });
        onDelta({ choices: [{ finish_reason: 'tool_calls' }] });
      })
      .mockImplementationOnce((payload, onDelta, onMeta) => { 
        onMeta.onError(new Error('Follow-up SSE Error'));
      });
    
    mockExecuteMcpTool.mockResolvedValue({ tool_call_id: 'tool_id_err', name: 'some_tool', content: '{"ok": true}'});

    await apiClient.streamChatCompletionWithMcp([], mockCallback, 'error-model-followup', 'ErrorFollowUpServer');
    
    expect(mockMcpStream).toHaveBeenCalledTimes(2); 
    expect(mockCallback).toHaveBeenCalledTimes(1); 
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(AppError), true);
    const error = mockCallback.mock.calls[0][1] as AppError;
    expect(error.message).toContain('Follow-up SSE Error');
    expect((error as any).userMessage).toBe('error.streamError');
  });

  test('should handle finish_reason tool_calls with no accumulated tools', async () => {
    (mcpManagerInstance.getTools as jest.Mock).mockResolvedValue([
      { name: 'a_tool', description: 'a_tool_desc', input_schema: { type: 'object', properties: {}} }
    ]);
    mockConvertMcpToolsToOpenAI.mockReturnValue([
      { type: 'function', function: { name: 'a_tool', description: 'a_tool_desc', parameters: validOpenAIParams} }
    ]);
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    mockMcpStream.mockImplementationOnce((payload, onDelta, onMeta) => {
      onDelta({ choices: [{ delta: { content: 'Assistant says something. '}} ]});
      onDelta({ choices: [{ finish_reason: 'tool_calls' }] }); 
      onMeta.onDone(); 
    });

    const messages = [createMockMessage({ content: 'Try to call a tool badly' })];
    await apiClient.streamChatCompletionWithMcp(messages, mockCallback, 'mcp-bad-tool-call', 'BadToolServer');

    expect(mockMcpStream).toHaveBeenCalledTimes(1); 
    expect(mockExecuteMcpTool).not.toHaveBeenCalled(); 
    expect(consoleWarnSpy).toHaveBeenCalledWith('[AiApiClient] Finish reason was tool_calls, but no valid tools to process. Ending stream.');
    
    expect(mockCallback).toHaveBeenCalledWith('Assistant says something. ', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
    expect(mockCallback).toHaveBeenCalledTimes(2);

    consoleWarnSpy.mockRestore();
  });

}); 