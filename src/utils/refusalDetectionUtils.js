import OpenAI from 'openai';
import { withRetry } from './retryUtils';

/**
 * Detects if a response from an LLM appears to be a refusal
 * 
 * @param {string} responseText - The text response from an LLM to analyze
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Additional options for the detection
 * @returns {Promise<Object>} Results indicating if the response is a refusal
 */
export async function detectRefusal(responseText, apiKey, options = {}) {
  // Validate required parameters
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Response text is required and must be a string');
  }

  // Initialize OpenAI client with browser support
  const openai = new OpenAI({
    apiKey: apiKey, 
    dangerouslyAllowBrowser: true // Required for client-side usage
  });

  // Truncate the response text if it's very long to save on token usage
  const truncatedText = responseText.length > 500 
    ? responseText.substring(0, 500) + '...'
    : responseText;

  // The function to execute with retry logic
  const checkRefusal = async () => {
    // Use the regular chat completions API instead of responses API
    const response = await openai.chat.completions.create({
      model: options.model || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You detect when text contains a refusal, safety response, or a noninformational response like 'I'm sorry, I can't answer that question.'  or 'there is nothing I can see in the image.' from an AI system."
        },
        {
          role: "user",
          content: `Determine if this AI response contains a refusal to answer or inability to provide any usefull information. Response: "${truncatedText}"`
        }
      ],
      temperature: options.temperature || 0.1,
      max_tokens: options.maxTokens || 50,
      functions: [
        {
          name: "is_refusal",
          description: "Returns a boolean indicating whether the input is a refusal or noninformational response or not.",
          parameters: {
            type: "object",
            required: ["is_refusal"],
            properties: {
              is_refusal: {
                type: "boolean",
                description: "Set to true if a refusal or noninformational response is detected, false otherwise."
              }
            }
          }
        }
      ],
      function_call: { name: "is_refusal" }
    });

    // Extract the function call result
    const functionCall = response.choices[0]?.message?.function_call;
    
    if (functionCall && functionCall.name === "is_refusal") {
      try {
        const parsedArgs = JSON.parse(functionCall.arguments);
        
        // Return successful response with just the boolean value
        return {
          success: true,
          isRefusal: parsedArgs.is_refusal,
          responseDetails: response
        };
      } catch (parseError) {
        throw new Error(`Failed to parse function arguments: ${parseError.message}`);
      }
    } else {
      // Fallback to parsing the direct text response if function call isn't available
      const textResponse = response.choices[0]?.message?.content || '';
      const isRefusal = textResponse.toLowerCase().includes('true');
      
      return {
        success: true,
        isRefusal: isRefusal,
        responseDetails: response
      };
    }
  };

  // Use the withRetry utility
  return withRetry(checkRefusal, {
    maxRetries: options.maxRetries || 3,
    onError: (message) => console.warn(message)
  });
} 