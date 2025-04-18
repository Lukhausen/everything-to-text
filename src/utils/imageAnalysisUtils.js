import OpenAI from 'openai';
import { detectRefusal } from './refusalDetectionUtils';
import { withRetry } from './retryUtils';

// Storage keys for consistency
const STORAGE_KEYS = {
  MAX_REFUSAL_RETRIES: 'pdf_processor_max_refusal_retries'
};

/**
 * Analyzes an image using OpenAI's vision capabilities with automatic retries
 * and refusal detection
 * @param {string} base64Image - Base64-encoded image data (with or without the data URI prefix)
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Additional options
 * @param {string} options.model - OpenAI model to use, defaults to 'latest'
 * @param {number} options.temperature - Temperature for model generation, defaults to 0.7
 * @param {number} options.maxTokens - Maximum tokens to generate, defaults to 1000
 * @param {number} options.retryCount - Number of retries for API errors, defaults to 2
 * @param {string} options.analysisType - Type of analysis to perform: 'general' or 'page_description', defaults to 'general'
 * @param {boolean} options.isForcedScan - Flag indicating if this is a forced page scan, defaults to false
 * @returns {Promise<Object>} Analysis results including the response
 */
export async function analyzeImage(base64Image, apiKey, options = {}) {
  // Read maxRefusalRetries directly from localStorage (with fallback)
  const storedMaxRefusalRetries = localStorage.getItem(STORAGE_KEYS.MAX_REFUSAL_RETRIES);
  const defaultMaxRefusalRetries = storedMaxRefusalRetries ? parseInt(storedMaxRefusalRetries, 10) : 3;
  
  // Destructure options with defaults, removing maxRefusalRetries from expected options
  const {
    model = 'latest',
    temperature = 0.7,
    maxTokens = 1000,
    retryCount = 2,
    analysisType = 'general',
    isForcedScan = false, // Flag to indicate if this is a forced page scan
    // Use maxRefusalRetries from options only as fallback if localStorage value isn't available
    maxRefusalRetries = defaultMaxRefusalRetries,
    // ... other existing options
  } = options;

  // Log maxRefusalRetries source for debugging
  console.log(`Using maxRefusalRetries=${maxRefusalRetries} (localStorage value: ${storedMaxRefusalRetries})`);

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

  // Function to perform basic image analysis without refusal checking
  const performBasicAnalysis = async () => {
    try {
      // Determine prompt based ONLY on analysis type
      let prompt;
      
      // Check for custom prompts in localStorage first
      const customGeneralPrompt = localStorage.getItem('pdf_processor_general_image_prompt');
      const customPageScanPrompt = localStorage.getItem('pdf_processor_page_scan_prompt');
      
      // Use custom prompts if available, otherwise use defaults
      switch (analysisType) {
        case 'page_description':
          prompt = customPageScanPrompt || 
            "This is an image of a page from a PDF document. Make sure to extract ALL the visual information. First, extract and describe all the visible graphics, then transcribe all the text on the document.";
          break;
        case 'general':
        default:
          // Default to general image analysis if an unknown type is provided
          prompt = customGeneralPrompt }
      
      // Make API request to OpenAI with preset prompt
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: {
                  url: dataURI
                }
              }
            ]
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      });

      const responseText = response.choices[0]?.message?.content || '';
      
      return {
        success: true,
        text: responseText,
        response: response
      };
    } catch (error) {
      console.error(`Error during basic analysis: ${error.message}`);
      return {
        success: false,
        text: '',
        response: null
      };
    }
  };

  // Use withRetry for API call retries
  const result = await withRetry(performBasicAnalysis, {
    maxRetries: retryCount,
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