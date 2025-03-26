/**
 * Utilities for replacing placeholders with batch analysis results
 */

// Default replacement format settings
const DEFAULT_CONFIG = {
  // Page indicators and formatting
  pageIndicators: {
    includePageHeadings: true,
    pageHeadingFormat: '//PAGE {pageNumber}:',
  },
  
  // Content types with markers
  contentTypes: {
    // Full page scan replacement format
    pageScan: {
      prefix: '#FULL_PAGE_SCAN_START#',
      suffix: '#FULL_PAGE_SCAN_END#'
    },
    // Regular image replacement format
    image: {
      prefix: '#IMAGE_CONTENT_START#',
      suffix: '#IMAGE_CONTENT_END#'
    },
    // Text content format
    text: {
      prefix: '#TEXT_CONTENT_START#',
      suffix: '#TEXT_CONTENT_END#'
    }
  },
  
  // Simplified spacing configuration
  spacing: {
    betweenPages: 3,            // Spacing between pages
    markerToContent: 2,         // Spacing between a marker and its content
    betweenContentSections: 3    // Spacing between different content sections on the same page
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
 * Creates line breaks based on spacing value
 * @param {number} count - Number of line breaks to create
 * @returns {string} String with the specified number of line breaks
 */
const createSpacing = (count) => {
  return '\n'.repeat(Math.max(0, count));
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

  // Deep merge default config with custom config
  const config = { 
    pageIndicators: { ...DEFAULT_CONFIG.pageIndicators },
    contentTypes: {
      pageScan: { ...DEFAULT_CONFIG.contentTypes.pageScan },
      image: { ...DEFAULT_CONFIG.contentTypes.image },
      text: { ...DEFAULT_CONFIG.contentTypes.text }
    },
    spacing: { ...DEFAULT_CONFIG.spacing }
  };
  
  // Merge custom config
  if (customConfig.pageIndicators) {
    Object.assign(config.pageIndicators, customConfig.pageIndicators);
  }
  
  if (customConfig.contentTypes) {
    if (customConfig.contentTypes.pageScan) {
      Object.assign(config.contentTypes.pageScan, customConfig.contentTypes.pageScan);
    }
    if (customConfig.contentTypes.image) {
      Object.assign(config.contentTypes.image, customConfig.contentTypes.image);
    }
    if (customConfig.contentTypes.text) {
      Object.assign(config.contentTypes.text, customConfig.contentTypes.text);
    }
  }
  
  if (customConfig.spacing) {
    Object.assign(config.spacing, customConfig.spacing);
  }

  // Create a map of image IDs to their analysis results for quick lookup
  const analysisMap = new Map();
  batchResults.forEach(result => {
    analysisMap.set(result.imageId, result);
  });

  // Debug info for troubleshooting
  console.log(`Text replacement: Processing ${pdfData.pages.length} pages with ${batchResults.length} analysis results`);
  console.log(`Analysis IDs: ${batchResults.map(r => r.imageId).join(', ')}`);

  // Process each page to apply replacements
  const replacedPages = pdfData.pages.map(page => {
    // Start with the original content
    let content = page.content.formattedText;
    
    // Get the image references for this page
    const imageRefs = page.imageReferences || [];
    
    console.log(`Page ${page.pageNumber}: Found ${imageRefs.length} image references`);
    
    // Track page content types for proper spacing
    const contentBlocks = [];
    let hasPageScan = false;
    
    // First pass: Process all image references and create content blocks
    imageRefs.forEach(ref => {
      console.log(`Processing image ref: id=${ref.id}, isFullPage=${ref.isFullPage}, placeholder=${ref.placeholder}`);
      
      const analysis = analysisMap.get(ref.id);
      
      if (!analysis) {
        console.warn(`No analysis found for image ${ref.id}`);
        return;
      }
      
      // Only process if we have a placeholder and analysis exists
      if (ref.placeholder && analysis) {
        // Skip completely if the analysis was refused or failed
        if (analysis.refusalDetected || !analysis.success || !analysis.text) {
          console.warn(`Skipping replacement for ${ref.id}: refusal=${analysis.refusalDetected}, success=${analysis.success}, hasText=${!!analysis.text}`);
          // Remove the placeholder entirely
          content = content.replace(ref.placeholder, '');
          return;
        }
        
        // Format the replacement based on image type
        const format = ref.isFullPage ? config.contentTypes.pageScan : config.contentTypes.image;
        
        // Track if this page has a full-page scan
        if (ref.isFullPage) {
          hasPageScan = true;
        }
        
        // Replace {pageNumber} in prefix and suffix
        const pageNumberRegex = /\{pageNumber\}/g;
        const prefix = format.prefix.replace(pageNumberRegex, page.pageNumber);
        const suffix = format.suffix.replace(pageNumberRegex, page.pageNumber);
        
        // Create properly spaced content with markers
        const markerToContentSpacing = createSpacing(config.spacing.markerToContent);
        
        // The formatted replacement includes spacing between marker and content
        const formattedText = `${prefix}${markerToContentSpacing}${analysis.text}${markerToContentSpacing}${suffix}`;
        
        // Store this as a content block for later arrangement
        contentBlocks.push({
          type: ref.isFullPage ? 'pageScan' : 'image',
          text: formattedText,
          placeholder: ref.placeholder
        });
      }
    });
    
    // Second pass: Check if there's any actual text content to mark
    const rawText = page.content.rawText?.trim() || '';
    
    if (rawText.length > 0) {
      // Process the content to find text that's not part of image/scan placeholders
      let textOnlyContent = content;
      
      // Remove all placeholder patterns
      imageRefs.forEach(ref => {
        if (ref.placeholder) {
          textOnlyContent = textOnlyContent.replace(ref.placeholder, '');
        }
      });
      
      // If there's any text content left after removing placeholders, add it as a content block
      textOnlyContent = textOnlyContent.trim();
      if (textOnlyContent.length > 0) {
        const markerToContentSpacing = createSpacing(config.spacing.markerToContent);
        const textFormat = config.contentTypes.text;
        const formattedText = `${textFormat.prefix}${markerToContentSpacing}${textOnlyContent}${markerToContentSpacing}${textFormat.suffix}`;
        
        contentBlocks.push({
          type: 'text',
          text: formattedText,
          placeholder: null // No placeholder for general text content
        });
      }
    }
    
    // Third pass: Replace content with properly arranged blocks
    if (contentBlocks.length > 0) {
      // Clear original content first if we're rebuilding it entirely
      if (hasPageScan) {
        // If there's a page scan, we'll start fresh
        content = '';
      } else {
        // For non-page-scan pages, we need to preserve the structure but replace placeholders
        // First handle the placeholder replacements
        contentBlocks.forEach(block => {
          if (block.placeholder) {
            content = content.replace(block.placeholder, block.text);
          }
        });
        
        // Then add text content (which doesn't have a placeholder) at the end if it exists
        const textBlock = contentBlocks.find(block => block.type === 'text' && !block.placeholder);
        if (textBlock) {
          content = content.trim() + (content.length > 0 ? createSpacing(config.spacing.betweenContentSections) : '') + textBlock.text;
        }
      }
      
      // For page scan pages, we need to build content from scratch with proper spacing
      if (hasPageScan && content === '') {
        // Start with page scan
        const pageScanBlock = contentBlocks.find(block => block.type === 'pageScan');
        if (pageScanBlock) {
          content += pageScanBlock.text;
        }
        
        // Add image blocks with spacing between content sections
        const imageBlocks = contentBlocks.filter(block => block.type === 'image');
        if (imageBlocks.length > 0 && pageScanBlock) {
          content += createSpacing(config.spacing.betweenContentSections);
        }
        
        imageBlocks.forEach((block, index) => {
          content += block.text;
          if (index < imageBlocks.length - 1) {
            content += createSpacing(config.spacing.betweenContentSections);
          }
        });
        
        // Add text block at the end if it exists
        const textBlock = contentBlocks.find(block => block.type === 'text');
        if (textBlock && (pageScanBlock || imageBlocks.length > 0)) {
          content += createSpacing(config.spacing.betweenContentSections);
          content += textBlock.text;
        } else if (textBlock) {
          content += textBlock.text;
        }
      }
    }
    
    // Return the page with replaced content
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
  
  // Deep merge default config with custom config
  const config = { 
    pageIndicators: { ...DEFAULT_CONFIG.pageIndicators },
    contentTypes: {
      pageScan: { ...DEFAULT_CONFIG.contentTypes.pageScan },
      image: { ...DEFAULT_CONFIG.contentTypes.image },
      text: { ...DEFAULT_CONFIG.contentTypes.text }
    },
    spacing: { ...DEFAULT_CONFIG.spacing }
  };
  
  // Merge custom config
  if (customConfig.pageIndicators) {
    Object.assign(config.pageIndicators, customConfig.pageIndicators);
  }
  
  if (customConfig.contentTypes) {
    if (customConfig.contentTypes.pageScan) {
      Object.assign(config.contentTypes.pageScan, customConfig.contentTypes.pageScan);
    }
    if (customConfig.contentTypes.image) {
      Object.assign(config.contentTypes.image, customConfig.contentTypes.image);
    }
    if (customConfig.contentTypes.text) {
      Object.assign(config.contentTypes.text, customConfig.contentTypes.text);
    }
  }
  
  if (customConfig.spacing) {
    Object.assign(config.spacing, customConfig.spacing);
  }
  
  // Define regex for replacing all occurrences of {pageNumber}
  const pageNumberRegex = /\{pageNumber\}/g;
  
  // Build the text with appropriate spacing
  return replacementResult.pages.map((page, index, pages) => {
    // Generate page heading if enabled
    let result = '';
    
    if (config.pageIndicators.includePageHeadings) {
      // Add spacing before page heading
      result += createSpacing(config.spacing.betweenContentSections);
      
      // Add the heading
      result += config.pageIndicators.pageHeadingFormat.replace(pageNumberRegex, page.pageNumber);
      
      // Add spacing after heading
      result += createSpacing(config.spacing.betweenContentSections);
    }
    
    // Add the page content
    result += page.content;
    
    // Add spacing between pages (except for the last page)
    if (index < pages.length - 1) {
      result += createSpacing(config.spacing.betweenPages);
    }
    
    return result;
  }).join('');
} 