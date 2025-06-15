import { AiApiClient } from '../AiApiClient';
import * as SystemStore from '../../../store/ModelStore';
import { Message, ToolCall } from '../../Interfaces';
import { SYSTEM_PROMPT } from '../../../constants/system_prompt';
import OpenAI from 'openai-react-native';
import {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions';

// Mock dependencies
jest.mock('../../../store/ModelStore');
jest.mock('openai-react-native'); // Mock OpenAI if _initializeClient is tested more directly

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

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

describe('AiApiClient - Helper Methods', () => {
  let apiClient: AiApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new AiApiClient();

    // Default SystemStore mocks for helpers
    (SystemStore.getProviderConfigForModel as jest.Mock).mockImplementation((modelId) => {
      if (modelId === 'test-model') {
        return { id: 'provider-1', apiUrl: 'https://api.example.com/v1', name: 'Test Provider' };
      }
      if (modelId === 'no-provider-model') {
        return null;
      }
      return { id: 'default-provider', apiUrl: 'https://api.default.com/v1', name: 'Default Provider' };
    });

    (SystemStore.getApiKey as jest.Mock).mockImplementation(async (providerId) => {
      if (providerId === 'provider-1') return 'key-for-provider-1';
      if (providerId === 'no-key-provider') return null;
      return 'default-api-key';
    });

    (SystemStore.getUserName as jest.Mock).mockResolvedValue('Helper User');
    (SystemStore.getUserCountry as jest.Mock).mockResolvedValue('HX');
    (SystemStore.getUserLanguage as jest.Mock).mockResolvedValue('hlp');
  });

  describe('_getCredentials', () => {
    test('should return API key for a valid providerId', async () => {
      const credentials = await (apiClient as any)._getCredentials('provider-1');
      expect(credentials).toEqual({ key: 'key-for-provider-1' });
      expect(SystemStore.getApiKey).toHaveBeenCalledWith('provider-1');
    });

    test('should return null if API key is not found for providerId', async () => {
      const credentials = await (apiClient as any)._getCredentials('no-key-provider');
      expect(credentials).toBeNull();
      expect(SystemStore.getApiKey).toHaveBeenCalledWith('no-key-provider');
    });

    test('should return null if SystemStore.getApiKey throws', async () => {
        (SystemStore.getApiKey as jest.Mock).mockRejectedValueOnce(new Error('Store error'));
        const credentials = await (apiClient as any)._getCredentials('provider-error');
        expect(credentials).toBeNull();
    });
  });

  describe('_getProviderIdForModel', () => {
    test('should return providerId for a valid modelId', () => {
      const providerId = (apiClient as any)._getProviderIdForModel('test-model');
      expect(providerId).toBe('provider-1');
      expect(SystemStore.getProviderConfigForModel).toHaveBeenCalledWith('test-model');
    });

    test('should return null if no provider config found for modelId', () => {
      const providerId = (apiClient as any)._getProviderIdForModel('no-provider-model');
      expect(providerId).toBeNull();
    });
  });

  describe('_getApiUrlForModel', () => {
    test('should return apiUrl for a valid modelId', () => {
      const apiUrl = (apiClient as any)._getApiUrlForModel('test-model');
      expect(apiUrl).toBe('https://api.example.com/v1');
      expect(SystemStore.getProviderConfigForModel).toHaveBeenCalledWith('test-model');
    });

    test('should return null if no provider config found for modelId', () => {
      const apiUrl = (apiClient as any)._getApiUrlForModel('no-provider-model');
      expect(apiUrl).toBeNull();
    });
  });

  describe('_createDynamicSystemPrompt', () => {
    test('should create a system prompt with user details and current time', async () => {
      const mockDate = new Date('2024-01-15T12:00:00.000Z');
      const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      const toLocaleStringSpy = jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('1/15/2024, 12:00:00 PM');

      const prompt = await (apiClient as any)._createDynamicSystemPrompt();

      expect(prompt).toContain(SYSTEM_PROMPT);
      expect(prompt).toContain("User's name: Helper User");
      expect(prompt).toContain("User's country: HX");
      expect(prompt).toContain("User's language: hlp");
      expect(prompt).toContain('Current time: 1/15/2024, 12:00:00 PM');
      expect(prompt).toContain("Ensure to respond in the language of the last message. If you are unsure use the User's language defined above.");

      dateSpy.mockRestore();
      toLocaleStringSpy.mockRestore();
    });

    test('should create prompt even if some user details are missing', async () => {
      (SystemStore.getUserName as jest.Mock).mockResolvedValue(null);
      (SystemStore.getUserCountry as jest.Mock).mockResolvedValue(null);
      const prompt = await (apiClient as any)._createDynamicSystemPrompt();
      expect(prompt).not.toContain("User's name:");
      expect(prompt).not.toContain("User's country:");
      expect(prompt).toContain("User's language: hlp"); 
    });
  });

  describe('_mapMessageToOpenAIParam', () => {
    test('should map system message correctly', () => {
      const message = createMockMessage({ role: 'system', content: 'System instruction' });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionSystemMessageParam;
      expect(mapped.role).toBe('system');
      expect(mapped.content).toBe('System instruction');
    });

    test('should return null for system message with non-string content', () => {
      const message = createMockMessage({ role: 'system', content: [{"type": "text", "text": "Hi"}] as any });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message);
      expect(mapped).toBeNull();
    });

    test('should map user message with string content', () => {
      const message = createMockMessage({ role: 'user', content: 'User query' });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionUserMessageParam;
      expect(mapped.role).toBe('user');
      expect(mapped.content).toBe('User query');
    });

    test('should map user message with array content (e.g., multimodal)', () => {
      const contentParts: ChatCompletionContentPart[] = [{ type: 'text', text: 'Describe this image' }];
      const message = createMockMessage({ role: 'user', content: contentParts });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionUserMessageParam;
      expect(mapped.role).toBe('user');
      expect(mapped.content).toEqual(contentParts);
    });
    
    test('should return null for user message with null content', () => {
      const message = createMockMessage({ role: 'user', content: null });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message);
      expect(mapped).toBeNull();
    });

    test('should map assistant message with string content', () => {
      const message = createMockMessage({ role: 'assistant', content: 'Assistant reply' });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionAssistantMessageParam;
      expect(mapped.role).toBe('assistant');
      expect(mapped.content).toBe('Assistant reply');
      expect(mapped.tool_calls).toBeUndefined();
    });
    
    test('should map assistant message with array content (extracting text part)', () => {
      const message = createMockMessage({ role: 'assistant', content: [{type: 'text', text: 'Assistant text part'}] as any });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionAssistantMessageParam;
      expect(mapped.role).toBe('assistant');
      expect(mapped.content).toBe('Assistant text part');
    });

    test('should map assistant message with null content (e.g. only tool_calls)', () => {
      const toolCalls: ToolCall[] = [{id: 'tc1', type:'function', function: {name: 'f1', arguments: '{}'}}];
      const message = createMockMessage({ role: 'assistant', content: null, tool_calls: toolCalls });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionAssistantMessageParam;
      expect(mapped.role).toBe('assistant');
      expect(mapped.content).toBeNull();
      expect(mapped.tool_calls).toBeDefined();
      expect(mapped.tool_calls![0].id).toBe('tc1');
    });

    test('should map assistant message with tool calls correctly', () => {
      const toolCalls: ToolCall[] = [
        { id: 'call_123', type: 'function', function: { name: 'get_weather', arguments: '{"location": "SF"}' } }
      ];
      const message = createMockMessage({ role: 'assistant', content: 'Thinking...', tool_calls: toolCalls });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionAssistantMessageParam;
      expect(mapped.role).toBe('assistant');
      expect(mapped.content).toBe('Thinking...');
      expect(mapped.tool_calls).toBeDefined();
      expect(mapped.tool_calls!.length).toBe(1);
      const mappedToolCall = mapped.tool_calls![0] as ChatCompletionMessageToolCall;
      expect(mappedToolCall.id).toBe('call_123');
      expect(mappedToolCall.type).toBe('function');
      expect(mappedToolCall.function.name).toBe('get_weather');
      expect(mappedToolCall.function.arguments).toBe('{"location": "SF"}');
    });

    test('should map tool message correctly', () => {
      const message = createMockMessage({ role: 'tool', tool_call_id: 'call_123', content: '{"temp": 70}' });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message) as ChatCompletionToolMessageParam;
      expect(mapped.role).toBe('tool');
      expect(mapped.tool_call_id).toBe('call_123');
      expect(mapped.content).toBe('{"temp": 70}');
    });

    test('should return null for tool message without tool_call_id', () => {
      const message = createMockMessage({ role: 'tool', content: 'some content' });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message);
      expect(mapped).toBeNull();
    });

    test('should return null for tool message with non-string content', () => {
      const message = createMockMessage({ role: 'tool', tool_call_id: 'tc1', content: [{"type": "text"}] as any });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message);
      expect(mapped).toBeNull();
    });

    test('should return null for unknown role', () => {
      const message = createMockMessage({ role: 'unknown_role' as any, content: 'abc' });
      const mapped = (apiClient as any)._mapMessageToOpenAIParam(message);
      expect(mapped).toBeNull();
    });
  });
  
  describe('_initializeClient & _invalidateClient', () => {
    test('should initialize OpenAI client if not already initialized or config changed', async () => {
      await (apiClient as any)._initializeClient('test-model');
      expect(MockedOpenAI).toHaveBeenCalledTimes(1);
      expect(MockedOpenAI).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com/v1',
        apiKey: 'key-for-provider-1',
      });
      expect((apiClient as any).openAIClient).toBeInstanceOf(MockedOpenAI);
      expect((apiClient as any).currentBaseURL).toBe('https://api.example.com/v1');
      expect((apiClient as any).currentApiKey).toBe('key-for-provider-1');

      // Call again with same model, should not re-initialize
      await (apiClient as any)._initializeClient('test-model');
      expect(MockedOpenAI).toHaveBeenCalledTimes(1); 

      // Call with different model (different API URL)
      (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValueOnce({ id: 'provider-2', apiUrl: 'https://api.new.com/v1' });
      (SystemStore.getApiKey as jest.Mock).mockResolvedValueOnce('key-for-provider-2');
      await (apiClient as any)._initializeClient('new-model');
      expect(MockedOpenAI).toHaveBeenCalledTimes(2);
      expect(MockedOpenAI).toHaveBeenLastCalledWith({
        baseURL: 'https://api.new.com/v1',
        apiKey: 'key-for-provider-2',
      });
    });

    test('_initializeClient should return null if apiUrl is not found', async () => {
      const client = await (apiClient as any)._initializeClient('no-provider-model');
      expect(client).toBeNull();
      expect(MockedOpenAI).not.toHaveBeenCalled();
    });

    test('_initializeClient should return null if providerId is not found for model', async () => {
      (SystemStore.getProviderConfigForModel as jest.Mock).mockImplementationOnce((modelId) => {
          if (modelId === 'model-no-id') return { apiUrl: 'https://api.url.com', id: null }; // No providerId
          return null;
      });
      const client = await (apiClient as any)._initializeClient('model-no-id');
      expect(client).toBeNull();
    });

    test('_initializeClient should return null if credentials are not found', async () => {
        (SystemStore.getProviderConfigForModel as jest.Mock).mockReturnValueOnce({ id: 'no-key-provider', apiUrl: 'https://api.url.com' });
        const client = await (apiClient as any)._initializeClient('model-with-no-key-provider');
        expect(client).toBeNull();
    });

    test('_initializeClient should handle OpenAI constructor error', async () => {
      MockedOpenAI.mockImplementationOnce(() => {
        throw new Error('OpenAI constructor failed');
      });
      const client = await (apiClient as any)._initializeClient('test-model');
      expect(client).toBeNull();
      expect((apiClient as any).openAIClient).toBeNull();
    });

    test('_invalidateClient should clear client and config', async () => {
      // Initialize first
      await (apiClient as any)._initializeClient('test-model');
      expect((apiClient as any).openAIClient).not.toBeNull();

      (apiClient as any)._invalidateClient();
      expect((apiClient as any).openAIClient).toBeNull();
      expect((apiClient as any).currentBaseURL).toBeNull();
      expect((apiClient as any).currentApiKey).toBeNull();
    });
  });

}); 