/**
 * Utilities for replacing placeholders with batch analysis results
 */

// Default replacement format settings
const DEFAULT_CONFIG = {
  // Whether to include page headings
  includePageHeadings: true,
  // Format for page headings (supports {pageNumber} placeholder)
  pageHeadingFormat: '\\n\\n\\n\\n//PAGE {pageNumber}: \\n\\n\\n',
  
  // Full page scan replacement format
  pageScan: {
    prefix: '#Full Page Scan of Page {pageNumber}: \\n\\n',
    suffix: '\\n\\nEnd of Full Page Scan of Page {pageNumber}'
  },
  // Regular image replacement format
  image: {
    prefix: '\\n\\n\\n##Content of an Image appearing on Page {pageNumber}:\\n\\n',
    suffix: '\\n\\n\\nEnd of Content of image appearing on Page {pageNumber}'
  }
};

/**
 * Helper function to process escape sequences in strings
 * @param {string} text - The text to process
 * @returns {string} Processed text with escape sequences converted
 */
const processEscapeSequences = (text) => {
  return text.replace(/\\n/g, '\n');
};

/**
 * Creates a replacement object that combines PDF data with batch analysis results
 * @param {Object} pdfData - The PDF data from processPdfDocument
 * @param {Array} batchResults - The batch analysis results for images
 * @param {Object} customConfig - Optional custom configuration for replacement formatting
 * @returns {Object} An object with the replaced content
 */
export function createTextReplacement(pdfData, batchResults, customConfig = {}) {
  if (!pdfData || !pdfData.pages || !batchResults) {
    return {
      success: false,
      error: 'Missing required data for text replacement',
      pages: []
    };
  }

  // Merge default config with custom config
  const config = { ...DEFAULT_CONFIG, ...customConfig };
  
  // Merge nested objects properly and process escape sequences
  if (customConfig.pageScan) {
    config.pageScan = {
      prefix: processEscapeSequences(customConfig.pageScan.prefix || DEFAULT_CONFIG.pageScan.prefix),
      suffix: processEscapeSequences(customConfig.pageScan.suffix || DEFAULT_CONFIG.pageScan.suffix)
    };
  }
  if (customConfig.image) {
    config.image = {
      prefix: processEscapeSequences(customConfig.image.prefix || DEFAULT_CONFIG.image.prefix),
      suffix: processEscapeSequences(customConfig.image.suffix || DEFAULT_CONFIG.image.suffix)
    };
  }
  
  // Process escape sequences in other text fields
  config.pageHeadingFormat = processEscapeSequences(config.pageHeadingFormat);

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
        // Skip completely if the analysis was refused or failed
        if (analysis.refusalDetected || !analysis.success || !analysis.text) {
          // Remove the placeholder entirely
          content = content.replace(ref.placeholder, '');
          return;
        }
        
        // Format the replacement based on image type
        const format = ref.isFullPage ? config.pageScan : config.image;
        
        // Replace ALL occurrences of {pageNumber} in prefix and suffix
        const pageNumberRegex = /\{pageNumber\}/g;
        const prefix = format.prefix.replace(pageNumberRegex, page.pageNumber);
        const suffix = format.suffix.replace(pageNumberRegex, page.pageNumber);
        
        const formattedReplacement = `${prefix}${analysis.text}${suffix}`;
        
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

/**
 * Generates a text representation of the replaced content
 * @param {Object} replacementResult - Result from createTextReplacement
 * @param {Object} customConfig - Optional custom configuration for formatting
 * @returns {string} Formatted text with replacements
 */
export function generateFormattedText(replacementResult, customConfig = {}) {
  if (!replacementResult?.success || !replacementResult.pages?.length) {
    return 'No content available';
  }
  
  // Merge default config with custom config
  const config = { ...DEFAULT_CONFIG, ...customConfig };
  
  // Process escape sequences in config
  if (typeof config.pageHeadingFormat === 'string') {
    config.pageHeadingFormat = processEscapeSequences(config.pageHeadingFormat);
  }
  
  // Define regex for replacing all occurrences of {pageNumber}
  const pageNumberRegex = /\{pageNumber\}/g;
  
  return replacementResult.pages.map(page => {
    // Generate page heading if enabled
    const pageHeading = config.includePageHeadings 
      ? config.pageHeadingFormat.replace(pageNumberRegex, page.pageNumber)
      : '';
      
    return pageHeading + page.content;
  }).join('\n\n');
} 