import OpenAI from 'openai';

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

  // Set up retry parameters
  const maxRetries = options.maxRetries || 3;
  let retryCount = 0;
  let lastError = null;

  // Retry logic with exponential backoff
  while (retryCount <= maxRetries) {
    try {
      // Use the regular chat completions API instead of responses API
      // since the responses API format is causing errors
      const response = await openai.chat.completions.create({
        model: options.model || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant that detects when text contains a refusal or safety response from an AI system. Your task is to identify whether the user's message is an AI refusal."
          },
          {
            role: "user",
            content: `Please analyze the following AI response and determine if it contains a refusal to answer. Only respond with 'true' if it's a refusal, or 'false' if it's not a refusal.\n\nAI response: "${responseText}"`
          }
        ],
        temperature: options.temperature || 0.1,
        max_tokens: options.maxTokens || 50,
        functions: [
          {
            name: "is_refusal",
            description: "Returns a boolean indicating whether the input is a refusal or not.",
            parameters: {
              type: "object",
              required: ["is_refusal"],
              properties: {
                is_refusal: {
                  type: "boolean",
                  description: "Set to true if a refusal is detected, false otherwise."
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
            retries: retryCount,
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
          retries: retryCount,
          responseDetails: response
        };
      }
    } catch (error) {
      lastError = error;
      retryCount++;

      // If we've reached max retries, break out of the loop
      if (retryCount > maxRetries) {
        break;
      }

      // Log retry information
      console.warn(`OpenAI API request failed (attempt ${retryCount}/${maxRetries}): ${error.message}`);
      
      // Calculate exponential backoff delay: 2^retry * 500ms (0.5s, 1s, 2s)
      const delay = Math.min(2 ** retryCount * 500, 8000); // Cap at 8 seconds
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  console.error("All retry attempts failed:", lastError);
  
  // Return structured error response
  return {
    success: false,
    error: lastError?.message || 'Failed after multiple retry attempts',
    details: lastError?.response?.data || lastError,
    retries: retryCount - 1
  };
} 