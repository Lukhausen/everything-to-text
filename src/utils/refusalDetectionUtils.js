import OpenAI from 'openai';
import { withRetry } from './retryUtils';

// Lightweight regex pre-filter for the most common refusal phrases. When this
// matches we save a network round-trip to the LLM. Anything ambiguous is still
// escalated to the model for verification.
const REFUSAL_PATTERNS = [
  /\bi(?:'m| am)\s+(?:sorry|unable|not able)\b/i,
  /\bi can(?:not|'t)\s+(?:help|assist|provide|process|analyze|see)\b/i,
  /\b(?:there is|there's)\s+nothing\s+(?:to\s+)?(?:see|describe|extract)\b/i,
  /\bno (?:visible )?(?:content|text|information)\s+(?:is\s+)?(?:available|present|visible)\b/i,
  /\bi (?:do not|don't)\s+(?:see|recognize|have)\b/i,
];

const looksLikeRefusal = (text) => REFUSAL_PATTERNS.some((re) => re.test(text));

/**
 * Detects if a response from an LLM appears to be a refusal.
 *
 * Uses a cheap regex pre-filter first; only falls back to the LLM with a
 * strict structured-output schema for the ambiguous cases. This replaces the
 * deprecated `functions` / `function_call` API that the previous
 * implementation relied on.
 *
 * @param {string} responseText The text response from an LLM to analyze.
 * @param {string} apiKey OpenAI API key.
 * @param {Object} options Additional options for the detection.
 * @returns {Promise<Object>} Result with `isRefusal` boolean and metadata.
 */
export async function detectRefusal(responseText, apiKey, options = {}) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Response text is required and must be a string');
  }

  // Cheap, deterministic local short-circuit. If a clearly-informative
  // sentence (>= 200 chars or many words) does not match any refusal regex,
  // we accept it without burning an API call.
  const trimmed = responseText.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (!looksLikeRefusal(trimmed) && (trimmed.length >= 200 || wordCount >= 30)) {
    return { success: true, isRefusal: false, source: 'heuristic' };
  }
  if (looksLikeRefusal(trimmed) && trimmed.length < 200) {
    return { success: true, isRefusal: true, source: 'heuristic' };
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage.
  });

  // Truncate to keep token usage minimal.
  const truncatedText =
    trimmed.length > 500 ? `${trimmed.substring(0, 500)}...` : trimmed;

  const checkRefusal = async () => {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "You classify whether an AI assistant's reply is a refusal, " +
            "safety response, or otherwise non-informational " +
            "(e.g. \"I'm sorry, I can't help with that\" or " +
            "\"there is nothing I can see in the image\"). " +
            'Always reply with the structured JSON schema you are given.',
        },
        {
          role: 'user',
          content: `Determine whether this AI response refuses to answer or fails to provide useful information.\nResponse: "${truncatedText}"`,
        },
      ],
      temperature: options.temperature ?? 0.1,
      max_completion_tokens: options.maxTokens || 50,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'is_refusal',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['is_refusal'],
            properties: {
              is_refusal: {
                type: 'boolean',
                description:
                  'true if the response is a refusal or non-informational, false otherwise.',
              },
            },
          },
        },
      },
    });

    const message = response.choices[0]?.message;

    // Newer models surface explicit refusals via `message.refusal`.
    if (message?.refusal) {
      return { success: true, isRefusal: true, responseDetails: response, source: 'native_refusal' };
    }

    const content = message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Empty response from refusal detector');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to parse refusal-detector JSON: ${err.message}`);
    }

    return {
      success: true,
      isRefusal: !!parsed.is_refusal,
      responseDetails: response,
      source: 'llm',
    };
  };

  return withRetry(checkRefusal, {
    maxRetries: options.maxRetries || 3,
    onError: (message) => console.warn(message),
  });
}
