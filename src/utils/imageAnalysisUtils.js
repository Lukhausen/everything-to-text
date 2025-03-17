import OpenAI from 'openai';
import { detectRefusal } from './refusalDetectionUtils';

/**
 * Analyzes an image using OpenAI's vision capabilities with automatic retries
 * and refusal detection
 * @param {string} base64Image - Base64-encoded image data (with or without the data URI prefix)
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Analysis results including the response
 */
export async function analyzeImage(base64Image, apiKey, options = {}) {
  // Validate required parameters
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!base64Image) {
    throw new Error('Image data is required');
  }

  // Initialize OpenAI client with browser support
  const openai = new OpenAI({
    apiKey: apiKey, 
    dangerouslyAllowBrowser: true // Required for client-side usage
  });

  // Ensure the base64 string has the correct data URI prefix
  const dataURI = base64Image.startsWith('data:') 
    ? base64Image 
    : `data:image/png;base64,${base64Image}`;

  // Set up retry parameters
  const maxRetries = options.maxRetries || 3;
  const maxRefusalRetries = options.maxRefusalRetries || 3;
  let retryCount = 0;
  let refusalRetryCount = 0;
  let lastError = null;
  let refusalDetected = false;

  // The preset prompt that will be used for all image analysis
  const PRESET_PROMPT = "Describe everything in great detail. Transcribe all visible text word for word.";

  // Retry logic with exponential backoff
  while (retryCount <= maxRetries) {
    try {
      // Make API request to OpenAI with preset prompt
      const response = await openai.chat.completions.create({
        model: options.model || "gpt-4o-mini",
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: PRESET_PROMPT },
              { 
                type: "image_url", 
                image_url: {
                  url: dataURI
                }
              }
            ]
          }
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      });

      const responseText = response.choices[0]?.message?.content || '';
      
      // Check if the response is a refusal using the simplified refusal detection
      if (responseText) {
        try {
          const refusalCheck = await detectRefusal(responseText, apiKey, { 
            temperature: 0.1,
            model: "gpt-4o-mini",
            maxRetries: 2
          });
          
          if (refusalCheck.success && refusalCheck.isRefusal) {
            console.warn(`Refusal detected in response`);
            
            // If we still have refusal retries left, retry with the original prompt
            if (refusalRetryCount < maxRefusalRetries) {
              refusalRetryCount++;
              refusalDetected = true;
              
              // Log the retry
              console.log(`Retrying after refusal detection (attempt ${refusalRetryCount}/${maxRefusalRetries})`);
              
              // Calculate exponential backoff delay for refusal retries
              const refusalDelay = Math.min(2 ** refusalRetryCount * 1000, 8000); // Cap at 8 seconds
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, refusalDelay));
              
              // Try again with the same preset prompt
              continue;
            }
          }
        } catch (refusalError) {
          // If refusal detection fails, log but continue with the original response
          console.warn(`Refusal detection failed: ${refusalError.message}`);
        }
      }
      
      // Return successful response
      return {
        success: true,
        text: responseText,
        response: response,
        retries: retryCount,
        refusalRetries: refusalRetryCount,
        refusalDetected: refusalDetected
      };
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
    retries: retryCount - 1,
    refusalRetries: refusalRetryCount,
    refusalDetected: refusalDetected
  };
} 