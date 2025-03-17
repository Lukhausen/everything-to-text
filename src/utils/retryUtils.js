/**
 * Utility for handling retries with exponential backoff
 */

/**
 * Executes a function with retry logic and exponential backoff
 * @param {Function} fn - The async function to execute and retry
 * @param {Object} options - Options for retry behavior
 * @returns {Promise<any>} - The result of the function or error details
 */
export async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 500; // Base delay in ms
  const maxDelay = options.maxDelay || 8000; // Maximum delay cap in ms
  const retryOnResult = options.retryOnResult || (() => false); // Function to check if result should trigger retry
  const onRetry = options.onRetry || (() => {}); // Callback when a retry occurs
  const onError = options.onError || console.warn; // Error logging callback
  
  let retryCount = 0;
  let lastError = null;
  let lastResult = null;
  
  // Helper for calculating delay with exponential backoff
  const getBackoffDelay = (attempt) => Math.min(2 ** attempt * baseDelay, maxDelay);
  
  // Helper for waiting between retries
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  while (retryCount <= maxRetries) {
    try {
      // Call the function
      const result = await fn(retryCount);
      lastResult = result;
      
      // Check if we should retry based on the result
      const shouldRetry = await retryOnResult(result, retryCount);
      if (shouldRetry) {
        if (retryCount >= maxRetries) {
          // If we've hit max retries, add a flag to the result
          return { ...result, retriesExhausted: true, retries: retryCount };
        }
        
        retryCount++;
        
        // Calculate delay
        const delay = getBackoffDelay(retryCount);
        
        // Notify about the retry
        onRetry({
          retryCount,
          maxRetries,
          delay,
          result,
          type: 'result-based'
        });
        
        // Wait before retrying
        await sleep(delay);
        continue;
      }
      
      // No retry needed, return the result with retry count
      return { ...result, retries: retryCount };
      
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // If we've reached max retries, break out of the loop
      if (retryCount > maxRetries) break;
      
      // Calculate delay
      const delay = getBackoffDelay(retryCount);
      
      // Log retry information
      onError(`Request failed (attempt ${retryCount}/${maxRetries}): ${error.message}`);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // All retries failed
  return {
    success: false,
    error: lastError?.message || 'Failed after multiple retry attempts',
    details: lastError?.response?.data || lastError,
    retries: retryCount - 1
  };
} 