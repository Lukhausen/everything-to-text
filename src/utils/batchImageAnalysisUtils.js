import { analyzeImage } from './imageAnalysisUtils';

/**
 * Process a batch of images from PDF data
 * @param {Object} pdfData - PDF data object containing images
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Options for processing
 * @param {Object} callbacks - Callback functions for status updates
 * @returns {Promise<Object>} - The updated PDF data with image descriptions
 */
export async function processBatchImages(
  pdfData, 
  apiKey, 
  options = {}, 
  callbacks = {}
) {
  // Validate inputs
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!pdfData || !pdfData.images || pdfData.images.length === 0) {
    throw new Error('No images available in PDF data');
  }
  
  // Set up default options
  const processingOptions = {
    maxConcurrentRequests: options.maxConcurrentRequests || 100,
    maxRefusalRetries: options.maxRefusalRetries || 3,
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 1000,
    ...options
  };
  
  // Set up default callbacks
  const statusCallbacks = {
    onProgress: callbacks.onProgress || (() => {}),
    onError: callbacks.onError || (() => {}),
    onComplete: callbacks.onComplete || (() => {}),
    onImageProcessed: callbacks.onImageProcessed || (() => {})
  };
  
  // Initialize counters and results
  const images = pdfData.images;
  const totalImages = images.length;
  let processedCount = 0;
  let errorCount = 0;
  
  // Create a results array upfront instead of a Map to avoid constant rebuilding
  const results = new Array(images.length);
  
  // Update the status for callbacks
  const updateStatus = () => {
    return {
      processedCount,
      totalImages,
      errorCount,
      progressPercentage: totalImages > 0 ? (processedCount / totalImages) * 100 : 0,
      isComplete: processedCount >= totalImages
    };
  };
  
  // Get current results array (filtered for completed items)
  const getCurrentResults = () => {
    return results.filter(result => result !== undefined);
  };
  
  // Process a single image
  const processImage = async (image, index) => {
    try {
      // Set options for image analysis
      const analysisOptions = {
        maxRefusalRetries: processingOptions.maxRefusalRetries,
        temperature: processingOptions.temperature,
        maxTokens: processingOptions.maxTokens,
        model: processingOptions.model
      };
      
      // Call the analyzeImage function with the image data and API key
      const response = await analyzeImage(image.dataURL, apiKey, analysisOptions);
      
      // Create result object with only the essential data
      const result = {
        imageId: image.id,
        success: response.success,
        // If refusal was detected, don't include any text
        text: response.refusalDetected ? '' : response.text,
        refusalDetected: response.refusalDetected || false,
        refusalRetries: response.refusalRetries || 0,
        retries: response.retries || 0
      };
      
      // Store directly in results array by index position
      results[index] = result;
      
      // Update processed count
      processedCount++;
      
      // Update progress immediately after each image is processed
      const status = updateStatus();
      statusCallbacks.onProgress(status);
      
      // Call image processed callback with current results
      statusCallbacks.onImageProcessed(result, getCurrentResults(), status);
      
      return result;
    } catch (error) {
      console.error(`Error processing image ${image.id}:`, error);
      
      // Create error result with minimal data
      const errorResult = {
        imageId: image.id,
        success: false,
        error: error.message || 'An unknown error occurred'
      };
      
      // Store directly in results array
      results[index] = errorResult;
      
      // Update processed count and error count
      processedCount++;
      errorCount++;
      
      // Update progress immediately after each error
      const status = updateStatus();
      statusCallbacks.onProgress(status);
      
      // Call image processed callback with error
      statusCallbacks.onError(errorResult, getCurrentResults(), status);
      
      return errorResult;
    }
  };
  
  // Process images in batches with a maximum number of concurrent requests
  const processBatches = async () => {
    const { maxConcurrentRequests } = processingOptions;
    
    // Create a minimal copy of the PDF data instead of a complete deep clone
    // This avoids duplicating large image data unnecessarily
    const updatedPdfData = {
      name: pdfData.name,
      totalPages: pdfData.totalPages,
      metadata: pdfData.metadata,
      processingTime: pdfData.processingTime,
      // Reference the original images array instead of copying all image data
      images: pdfData.images
    };
    
    // Process in batches to limit concurrent requests
    for (let i = 0; i < images.length; i += maxConcurrentRequests) {
      const batch = images.slice(i, i + maxConcurrentRequests);
      
      // Process each image in the batch with its index
      await Promise.all(batch.map((image, batchIndex) => {
        const globalIndex = i + batchIndex;
        return processImage(image, globalIndex);
      }));
      
      // This is now redundant since we're updating progress after each image
      // But we'll keep it as a safety measure in case an image misses an update
      statusCallbacks.onProgress(updateStatus());
    }
    
    // Filter out any undefined elements (should not happen, but just in case)
    const finalResults = results.filter(result => result !== undefined);
    
    // Don't add extra analysis information directly to the images
    // This removes redundancy since we have imageAnalysisResults
    
    // Use finalResults directly instead of remapping them since they're already in the correct format
    updatedPdfData.imageAnalysisResults = finalResults;
    
    // Final callback for completion
    statusCallbacks.onComplete(finalResults, updateStatus(), updatedPdfData);
    
    return {
      results: finalResults,
      status: updateStatus(),
      updatedPdfData
    };
  };
  
  // Start processing and return promise
  return processBatches();
}

/**
 * Extracts useful text content from batch analysis results
 * @param {Array} results - Array of image analysis results
 * @param {Object} pdfData - The PDF data containing image information
 * @returns {Object} - Extracted text and statistics
 */
export function extractTextFromBatchResults(results, pdfData = null) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return {
      extractedText: '',
      totalImages: 0,
      successfulImages: 0,
      failedImages: 0,
      refusalCount: 0
    };
  }
  
  // Calculate statistics only once
  const refusalCount = results.filter(r => r.success && r.refusalDetected).length;
  const successfulResults = results.filter(r => r.success && !r.refusalDetected);
  const failedCount = results.length - successfulResults.length - refusalCount;
  
  // Early return if no successful results
  if (successfulResults.length === 0) {
    return {
      extractedText: '',
      totalImages: results.length,
      successfulImages: 0,
      refusalCount,
      failedImages: failedCount
    };
  }
  
  // Create a more efficient mapping lookup
  const imageIdToPageMap = new Map();
  if (pdfData && pdfData.images) {
    pdfData.images.forEach(image => {
      imageIdToPageMap.set(image.id, image.pageNumber || 0);
    });
  }
  
  // Build text by page number with a single loop
  const textByPage = {};
  
  for (const result of successfulResults) {
    // Skip empty text
    if (!result.text) continue;
    
    // Get page number from map or default to 0
    const pageNumber = imageIdToPageMap.get(result.imageId) || 0;
    
    // Initialize the array if needed (more efficient than checking existence each time)
    if (!textByPage[pageNumber]) {
      textByPage[pageNumber] = [];
    }
    
    textByPage[pageNumber].push(`[Image ${result.imageId}]: ${result.text}`);
  }
  
  // Combine into a single string sorted by page - use array for better string concatenation
  const textParts = [];
  const pageNumbers = Object.keys(textByPage).sort((a, b) => Number(a) - Number(b));
  
  for (const pageNumber of pageNumbers) {
    textParts.push(`\n--- PAGE ${pageNumber} ---\n\n`);
    textParts.push(textByPage[pageNumber].join('\n\n'));
    textParts.push('\n');
  }
  
  return {
    extractedText: textParts.join('').trim(),
    totalImages: results.length,
    successfulImages: successfulResults.length,
    refusalCount,
    failedImages: failedCount
  };
} 