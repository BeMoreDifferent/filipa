import { AiApiClient, StreamUpdateCallback } from '../AiApiClient';
import { AppError } from '../../errorHandler';
import * as SystemStore from '../../../store/ModelStore';
import { Message, ToolCall } from '../../Interfaces';
import { SYSTEM_PROMPT } from '../../../constants/system_prompt';
import OpenAI from 'openai-react-native';

// Mock dependencies
jest.mock('openai-react-native');
jest.mock('../../../store/ModelStore');

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
const mockStream = jest.fn();
MockedOpenAI.prototype.chat = {
  completions: {
    stream: mockStream,
  },
} as any;

const createMockMessage = (overrides: Partial<Message>): Message => {
  const defaults: Message = {
    id: `msg-${Date.now()}-${Math.random()}`,
    chat_id: 123, // Corrected: number
    role: 'user', 
    content: 'Test content', 
    model: 'gpt-4', 
    timestamp: new Date().toISOString(), // Corrected: ISO string
    raw_message: { text: 'Test content' }, // Corrected: Record<string, any>
    // Optional fields from Message interface - can be overridden
    // name: undefined,
    // tool_calls: undefined,
    // tool_call_id: undefined,
    // data: undefined,
    // response: undefined,
    // seen: false, 
  };
  return { ...defaults, ...overrides };
};

describe('AiApiClient - Standard Chat Completion', () => {
  let apiClient: AiApiClient;
  let mockCallback: jest.Mock<StreamUpdateCallback>;

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new AiApiClient();
    mockCallback = jest.fn();

    (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValue({
      id: 'provider-1',
      apiUrl: 'https://api.openai.com/v1',
    });
    (SystemStore.getApiKey as jest.Mock).mockResolvedValue('test-api-key');
    (SystemStore.getUserName as jest.Mock).mockResolvedValue('Test User');
    (SystemStore.getUserCountry as jest.Mock).mockResolvedValue('US');
    (SystemStore.getUserLanguage as jest.Mock).mockResolvedValue('en');
    (SystemStore.getModelTemperature as jest.Mock).mockResolvedValue(0.7);
  });

  test('should successfully stream chat completion', async () => {
    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    const modelId = 'gpt-4';

    mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onDelta({ choices: [{ delta: { content: 'Hello ' } }] });
      onDelta({ choices: [{ delta: { content: 'World!' } }] });
      onMeta.onDone();
      return Promise.resolve(); 
    });

    await apiClient.streamChatCompletion(messages, mockCallback, modelId);

    expect(mockStream).toHaveBeenCalledTimes(1);
    const requestPayload = mockStream.mock.calls[0][0];
    expect(requestPayload.model).toBe(modelId);
    expect(requestPayload.messages.length).toBe(2); 
    expect(requestPayload.messages[0].role).toBe('system');
    expect(requestPayload.messages[1].role).toBe('user');
    expect(requestPayload.messages[1].content).toBe('Hello');
    expect(requestPayload.stream).toBe(true);
    expect(requestPayload.temperature).toBe(0.7);

    expect(mockCallback).toHaveBeenCalledWith('Hello ', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith('World!', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
    expect(mockCallback).toHaveBeenCalledTimes(3);
  });

  test('should handle client initialization failure', async () => {
    (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValue(null); 

    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');

    expect(mockStream).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(Error), true);
    const errorArg = mockCallback.mock.calls[0][1] as AppError;
    expect(errorArg.message).toContain('AI client failed to initialize for model gpt-4');
    expect((errorArg as any).userMessage).toBe('error.apiClientInitFailed');
  });

  test('should handle client initialization failure if providerId is not found', async () => {
     (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValue({
      id: null, 
      apiUrl: 'https://api.openai.com/v1',
    });

    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');

    expect(mockStream).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(Error),true);
    const errorArg = mockCallback.mock.calls[0][1] as AppError;
    expect(errorArg.message).toContain('AI client failed to initialize for model gpt-4');
    expect((errorArg as any).userMessage).toBe('error.apiClientInitFailed');
  });

  test('should handle client initialization failure if credentials are not found', async () => {
    (SystemStore.getApiKey as jest.Mock).mockResolvedValue(null); 

    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');

    expect(mockStream).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(Error), true );
    const errorArg = mockCallback.mock.calls[0][1] as AppError;
    expect(errorArg.message).toContain('AI client failed to initialize for model gpt-4');
    expect((errorArg as any).userMessage).toBe('error.apiClientInitFailed');
  });

  test('should handle message mapping failure when no valid messages', async () => {
    const messages: Message[] = [createMockMessage({ role: 'system', content: {} as any })]; 
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');

    expect(mockStream).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith( null, expect.any(Error), true );
    const errorArg = mockCallback.mock.calls[0][1] as AppError;
    expect(errorArg.message).toContain('No valid user-provided messages could be mapped');
    expect((errorArg as any).userMessage).toBe('error.messageMappingFailed');
  });

  test('should handle API error during streaming', async () => {
    mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onMeta.onError(new Error('Stream connection failed'));
      return Promise.resolve();
    });

    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(Error), true);
    const errorArg = mockCallback.mock.calls[0][1] as AppError;
    expect(errorArg.message).toContain('SSE Error: Stream connection failed');
    expect((errorArg as any).userMessage).toBe('error.streamError');
  });
  
  test('should invalidate and reinitialize client if apiUrl changes', async () => {
    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4-model-1');
    expect(MockedOpenAI).toHaveBeenCalledTimes(1); 
    expect(MockedOpenAI.mock.calls[0][0]?.baseURL).toBe('https://api.openai.com/v1');

    (SystemStore.getProviderConfigForModel as jest.Mock).mockImplementation((modelId) => {
        if (modelId === 'gpt-4-model-2') {
            return { id: 'provider-2', apiUrl: 'https://api.another.com/v1' };
        }
        return { id: 'provider-1', apiUrl: 'https://api.openai.com/v1' };
    });
    (SystemStore.getApiKey as jest.Mock).mockImplementation(async (providerId) => {
      if (providerId === 'provider-2') return 'test-api-key-2';
      return 'test-api-key';
    });
    
    mockCallback.mockClear(); 
    mockStream.mockClear(); 

    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4-model-2');
    expect(MockedOpenAI).toHaveBeenCalledTimes(2); 
    expect(MockedOpenAI.mock.calls[1][0]?.baseURL).toBe('https://api.another.com/v1');
    expect(MockedOpenAI.mock.calls[1][0]?.apiKey).toBe('test-api-key-2');
    expect(mockStream).toHaveBeenCalledTimes(1); 
  });

  test('should invalidate and reinitialize client if apiKey changes', async () => {
    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    expect(MockedOpenAI).toHaveBeenCalledTimes(1);
    expect(MockedOpenAI.mock.calls[0][0]?.apiKey).toBe('test-api-key');

    (SystemStore.getApiKey as jest.Mock).mockResolvedValue('new-test-api-key');
    
    mockCallback.mockClear();
    mockStream.mockClear();

    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    expect(MockedOpenAI).toHaveBeenCalledTimes(2); 
    expect(MockedOpenAI.mock.calls[1][0]?.apiKey).toBe('new-test-api-key');
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  test('should reuse existing client if configuration is unchanged', async () => {
    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    expect(MockedOpenAI).toHaveBeenCalledTimes(1);

    mockCallback.mockClear();
    mockStream.mockClear();

    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    expect(MockedOpenAI).toHaveBeenCalledTimes(1); 
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  test('should handle OpenAI client constructor throwing an error', async () => {
    MockedOpenAI.mockImplementationOnce(() => {
      throw new Error('Failed to construct OpenAI client');
    });

    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');

    expect(mockStream).not.toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith(null, expect.any(Error), true );
    const errorArg = mockCallback.mock.calls[0][1] as AppError;
    expect((errorArg as any).userMessage).toBe('error.apiClientInitFailed');
  });

   test('should correctly map assistant message with only content', async () => {
    const messages: Message[] = [
      createMockMessage({ role: 'user', content: 'User message' }),
      createMockMessage({ role: 'assistant', content: 'Assistant response' })
    ];
    mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onMeta.onDone();
      return Promise.resolve();
    });
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    
    const requestPayload = mockStream.mock.calls[0][0];
    expect(requestPayload.messages[2].role).toBe('assistant');
    expect(requestPayload.messages[2].content).toBe('Assistant response');
    expect(requestPayload.messages[2].tool_calls).toBeUndefined();
  });

  test('should correctly map assistant message with tool calls', async () => {
    const toolCalls: ToolCall[] = [{
      id: 'call_1',
      type: 'function',
      function: { name: 'get_weather', arguments: '{"location": "SF"}' }
    }]; 
    const messages: Message[] = [
      createMockMessage({ role: 'user', content: 'User message' }),
      createMockMessage({ 
        role: 'assistant', 
        content: null, 
        tool_calls: toolCalls
      })
    ];
     mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onMeta.onDone();
      return Promise.resolve();
    });
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    
    const requestPayload = mockStream.mock.calls[0][0];
    expect(requestPayload.messages[2].role).toBe('assistant');
    expect(requestPayload.messages[2].content).toBeNull();
    expect(requestPayload.messages[2].tool_calls).toEqual(toolCalls.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: {
            name: tc.function.name,
            arguments: tc.function.arguments
        }
    })));
  });

  test('should correctly map tool message', async () => {
    const messages: Message[] = [
      createMockMessage({ role: 'user', content: 'User message' }),
      createMockMessage({ 
        role: 'assistant', 
        content: null, 
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"location": "SF"}' }}]
      }),
      createMockMessage({
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"temperature": "70F"}'
      })
    ];
    mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onMeta.onDone();
      return Promise.resolve();
    });
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    
    const requestPayload = mockStream.mock.calls[0][0];
    expect(requestPayload.messages[3].role).toBe('tool');
    expect(requestPayload.messages[3].tool_call_id).toBe('call_1');
    expect(requestPayload.messages[3].content).toBe('{"temperature": "70F"}');
  });

  test('should filter out invalid messages during mapping', async () => {
    const messages: Message[] = [
      createMockMessage({ role: 'user', content: 'Valid user message' }),
      createMockMessage({ role: 'system', content: {} as any }), // Invalid system message content
      createMockMessage({ role: 'assistant', content: 'Valid assistant message'}),
      createMockMessage({ role: 'tool', tool_call_id: null as any, content: 'Invalid tool - no id'}), 
      createMockMessage({ role: 'user', content: null as any }), // Invalid user message content
    ];
     mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onMeta.onDone();
      return Promise.resolve();
    });
    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    
    const requestPayload = mockStream.mock.calls[0][0];
    expect(requestPayload.messages.length).toBe(3); 
    expect(requestPayload.messages[0].role).toBe('system'); 
    expect(requestPayload.messages[1].role).toBe('user');
    expect(requestPayload.messages[1].content).toBe('Valid user message');
    expect(requestPayload.messages[2].role).toBe('assistant');
    expect(requestPayload.messages[2].content).toBe('Valid assistant message');
  });

  test('should include user name, country, language, and current time in system prompt', async () => {
    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    const modelId = 'gpt-4';

    const mockDate = new Date('2023-10-27T10:00:00.000Z');
    const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    // Mock toLocaleString specifically if it's not behaving as expected with the simple Date mock
    const toLocaleStringSpy = jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('10/27/2023, 10:00:00 AM');

    (SystemStore.getUserName as jest.Mock).mockResolvedValue('Test User');
    (SystemStore.getUserCountry as jest.Mock).mockResolvedValue('Wonderland');
    (SystemStore.getUserLanguage as jest.Mock).mockResolvedValue('elvish');

    mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onMeta.onDone();
      return Promise.resolve();
    });

    await apiClient.streamChatCompletion(messages, mockCallback, modelId);

    expect(mockStream).toHaveBeenCalledTimes(1);
    const requestPayload = mockStream.mock.calls[0][0];
    const systemMessage = requestPayload.messages.find((m: any) => m.role === 'system');

    expect(systemMessage.content).toContain(SYSTEM_PROMPT);
    expect(systemMessage.content).toContain("User's name: Test User.");
    expect(systemMessage.content).toContain("User's country: Wonderland.");
    expect(systemMessage.content).toContain("User's language: elvish.");
    expect(systemMessage.content).toContain(`Current time: 10/27/2023, 10:00:00 AM`);
    
    dateSpy.mockRestore(); 
    toLocaleStringSpy.mockRestore();
  });
  
  test('should handle stream data with choices[0].delta but no content (e.g. only role)', async () => {
    const messages: Message[] = [createMockMessage({ role: 'user', content: 'Hello' })];
    mockStream.mockImplementation((payload: any, onDelta: any, onMeta: any) => {
      onDelta({ choices: [{ delta: { role: 'assistant' } }] }); 
      onDelta({ choices: [{ delta: { content: 'Response' } }] });
      onMeta.onDone();
      return Promise.resolve();
    });

    await apiClient.streamChatCompletion(messages, mockCallback, 'gpt-4');
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, false); 
    expect(mockCallback).toHaveBeenCalledWith('Response', undefined, false);
    expect(mockCallback).toHaveBeenCalledWith(null, undefined, true);
    expect(mockCallback).toHaveBeenCalledTimes(3);
  });
}); 