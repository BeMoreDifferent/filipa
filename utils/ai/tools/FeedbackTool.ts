import { Alert } from 'react-native';
import type { OpenAITool } from '../mcpToOpenAiConverter';
import { SwiperCardFeedback } from '../../../components/base/SwiperCardFeedback';

/**
 * OpenAI Tool definition for simple yes/no feedback.
 * This tool can be called by the model to ask the user a yes/no question.
 */
export const feedbackTool: OpenAITool = {
  type: 'function',
  function: {
    name: 'feedback_yes_no',
    description: `Ask clearifying questions to make the response individual. 
Ensure to always ask simple yes, no questions. 
You MUST ALWAYS ask at least three questions.`,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The yes/no question to ask the user.'
        }
      },
      required: ['question']
    }
  }
};

/**
 * Handles the feedback tool call by showing a SwiperCardFeedback and resolving the user's answer.
 * @param question The yes/no question to ask the user.
 * @returns Promise resolving to { answer: 'yes' | 'no', question: string }
 * @example
 *   await handleFeedbackTool('Do you like this app?');
 */
export function handleFeedbackTool(question: string): Promise<{ answer: 'yes' | 'no', question: string }> {
  return SwiperCardFeedback.show([{ id: 'feedback', question }])
    .then((results) => {
      const result = results[0];
      if (result && (result.answer === 'yes' || result.answer === 'no')) {
        return { answer: result.answer, question };
      }
      return { answer: 'no', question };
    });
} 