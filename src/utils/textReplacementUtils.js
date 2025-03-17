/**
 * Utilities for replacing placeholders with batch analysis results
 */

// Customizable replacement format settings
const REPLACEMENT_CONFIG = {
  // Full page scan replacement format
  pageScan: {
    prefix: '⟪ FULL PAGE SCAN: ',
    suffix: ' ⟫'
  },
  // Regular image replacement format
  image: {
    prefix: '⟪ IMAGE: ',
    suffix: ' ⟫'
  },
  // How to indicate an image with no analysis
  noAnalysis: 'No analysis available',
  // How to indicate when the model refused to analyze an image
  refusal: 'Image analysis refused by AI'
};

/**
 * Creates a replacement object that combines PDF data with batch analysis results
 * @param {Object} pdfData - The PDF data from processPdfDocument
 * @param {Array} batchResults - The batch analysis results for images
 * @returns {Object} An object with the replaced content
 */
export function createTextReplacement(pdfData, batchResults) {
  if (!pdfData || !pdfData.pages || !batchResults) {
    return {
      success: false,
      error: 'Missing required data for text replacement',
      pages: []
    };
  }

  // Create a map of image IDs to their analysis results for quick lookup
  const analysisMap = new Map();
  batchResults.forEach(result => {
    analysisMap.set(result.imageId, result);
  });

  // Process each page to apply replacements
  const replacedPages = pdfData.pages.map(page => {
    // Start with the original content
    let content = page.content.formattedText;
    
    // Get the image references for this page
    const imageRefs = page.imageReferences || [];
    
    // Apply replacements for each image on the page
    imageRefs.forEach(ref => {
      const analysis = analysisMap.get(ref.id);
      
      // Only process if we have a placeholder and analysis exists
      if (ref.placeholder && analysis) {
        let replacementText = '';
        
        // Determine the replacement text based on analysis result
        if (!analysis.success) {
          // If analysis failed
          replacementText = REPLACEMENT_CONFIG.noAnalysis;
        } else if (analysis.refusalDetected) {
          // If model refused to analyze
          replacementText = REPLACEMENT_CONFIG.refusal;
        } else if (analysis.text) {
          // If we have successful analysis text
          replacementText = analysis.text;
        } else {
          // Fallback for any other case
          replacementText = REPLACEMENT_CONFIG.noAnalysis;
        }
        
        // Format the replacement based on image type
        const format = ref.isFullPage ? REPLACEMENT_CONFIG.pageScan : REPLACEMENT_CONFIG.image;
        const formattedReplacement = `${format.prefix}${replacementText}${format.suffix}`;
        
        // Replace the placeholder with the formatted text
        content = content.replace(ref.placeholder, formattedReplacement);
      }
    });
    
    // Return the page with replaced content - simplified structure
    return {
      pageNumber: page.pageNumber,
      content: content
    };
  });
  
  return {
    success: true,
    totalPages: replacedPages.length,
    pages: replacedPages
  };
} 