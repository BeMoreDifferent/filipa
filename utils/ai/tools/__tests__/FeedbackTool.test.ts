import { feedbackTool, handleFeedbackTool } from '../FeedbackTool';
import { Alert } from 'react-native';

describe('FeedbackTool', () => {
  it('should match the OpenAI function tool schema', () => {
    expect(feedbackTool).toMatchObject({
      type: 'function',
      function: {
        name: 'feedback_yes_no',
        description: expect.any(String),
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: expect.any(String) }
          },
          required: ['question']
        }
      }
    });
  });

  it('should resolve to yes when Yes is pressed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate pressing Yes
      buttons?.[0]?.onPress?.();
    });
    await expect(handleFeedbackTool('Test?')).resolves.toEqual({ answer: 'yes' });
  });

  it('should resolve to no when No is pressed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate pressing No
      buttons?.[1]?.onPress?.();
    });
    await expect(handleFeedbackTool('Test?')).resolves.toEqual({ answer: 'no' });
  });
}); 