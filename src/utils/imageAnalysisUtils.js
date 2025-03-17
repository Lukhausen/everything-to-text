import OpenAI from 'openai';
import { detectRefusal } from './refusalDetectionUtils';
import { withRetry } from './retryUtils';

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

  // Track refusal retries separately
  let refusalRetryCount = 0;
  const maxRefusalRetries = options.maxRefusalRetries || 3;

  // The preset prompt that will be used for all image analysis
  const PRESET_PROMPT = "Describe everything in great detail. Transcribe all visible text word for word.";

  // Function to perform basic image analysis without refusal checking
  const performBasicAnalysis = async () => {
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
    
    return {
      success: true,
      text: responseText,
      response: response
    };
  };

  // Use withRetry for API call retries
  const result = await withRetry(performBasicAnalysis, {
    maxRetries: options.maxRetries || 3,
    onError: (message) => console.warn(message),
    retryOnResult: async (result) => {
      // If the API call was successful, check for refusal
      if (result.success && result.text) {
        try {
          // Check if the response is a refusal
          const refusalCheck = await detectRefusal(result.text, apiKey, { 
            temperature: 0.1,
            model: "gpt-4o-mini",
            maxRetries: 2
          });
          
          // If refusal detected and we still have refusal retries left, retry
          if (refusalCheck.success && refusalCheck.isRefusal && refusalRetryCount < maxRefusalRetries) {
            refusalRetryCount++;
            console.log(`Retrying after refusal detection (attempt ${refusalRetryCount}/${maxRefusalRetries})`);
            return true;
          }
          
          // If refusal detected but we've used all retries, return result with refusal flag
          if (refusalCheck.success && refusalCheck.isRefusal) {
            result.refusalDetected = true;
            result.text = ''; // Clear text when refusal detected
          }
        } catch (refusalError) {
          // If refusal detection fails, log but continue
          console.warn(`Refusal detection failed: ${refusalError.message}`);
        }
      }
      
      // No more retries needed
      return false;
    },
    onRetry: (info) => {
      if (info.type === 'result-based') {
        console.log(`Retrying after refusal detection (attempt ${refusalRetryCount}/${maxRefusalRetries})`);
      }
    }
  });

  // Return the final result with additional metadata
  return {
    ...result,
    refusalRetries: refusalRetryCount,
    refusalDetected: result.refusalDetected || false
  };
} 