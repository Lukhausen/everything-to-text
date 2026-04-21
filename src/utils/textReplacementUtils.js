/**
 * Utilities for replacing placeholders with batch analysis results
 */

// Helper function to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Default replacement format settings
//
// Markers are emitted as XML-style tags with self-documenting attribute names
// so the resulting text is unambiguous for downstream LLM consumers and
// trivial to parse. Each block is a matching
// `<tag page_number="N">` … `</tag>` pair where N is the 1-based page number.
const DEFAULT_CONFIG = {
  // Content types with markers
  contentTypes: {
    // Wraps the entire page (text + image blocks).
    pageHeading: {
      prefix: '<page page_number="{pageNumber}">',
      suffix: '</page>'
    },
    // Full-page rasterized scan analyzed by the vision model.
    pageScan: {
      prefix: '<page_scan page_number="{pageNumber}">',
      suffix: '</page_scan>'
    },
    // A single embedded image analyzed by the vision model.
    image: {
      prefix: '<image page_number="{pageNumber}">',
      suffix: '</image>'
    },
    // Plain text extracted from the PDF text layer.
    text: {
      prefix: '<text page_number="{pageNumber}">',
      suffix: '</text>'
    }
  },
  
  // Simplified spacing configuration. Counts are *newline* characters, so
  // value 1 = a line break with no blank line, value 2 = one blank line, etc.
  spacing: {
    betweenPages: 2,            // 1 blank line between pages
    markerToContent: 1,         // No blank line between a tag and its content
    betweenContentSections: 2   // 1 blank line between content blocks on the same page
  }
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
    contentTypes: {
      pageHeading: { ...DEFAULT_CONFIG.contentTypes.pageHeading },
      pageScan: { ...DEFAULT_CONFIG.contentTypes.pageScan },
      image: { ...DEFAULT_CONFIG.contentTypes.image },
      text: { ...DEFAULT_CONFIG.contentTypes.text }
    },
    spacing: { ...DEFAULT_CONFIG.spacing }
  };

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
        
        // Replace {pageNumber} in prefix and suffix to include proper page number
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
      
      // Check if the content already contains text content markers for this page
      const textPrefix = config.contentTypes.text.prefix.replace(/\{pageNumber\}/g, page.pageNumber);
      const textSuffix = config.contentTypes.text.suffix.replace(/\{pageNumber\}/g, page.pageNumber);
      const hasTextMarkers = content.includes(textPrefix) || content.includes(textSuffix);
      
      // Only proceed if there are no text markers already
      if (!hasTextMarkers) {
        // Remove all placeholder patterns
        imageRefs.forEach(ref => {
          if (ref.placeholder) {
            // Use a global regex to ensure all instances are replaced
            const placeholderRegex = new RegExp(escapeRegExp(ref.placeholder), 'g');
            textOnlyContent = textOnlyContent.replace(placeholderRegex, '');
          }
        });
        
        // If there's any text content left after removing placeholders, add it as a content block
        textOnlyContent = textOnlyContent.trim();
        if (textOnlyContent.length > 0) {
          const markerToContentSpacing = createSpacing(config.spacing.markerToContent);
          
          // Get text format with page number
          const textFormat = {
            prefix: textPrefix,
            suffix: textSuffix
          };
          
          const formattedText = `${textFormat.prefix}${markerToContentSpacing}${textOnlyContent}${markerToContentSpacing}${textFormat.suffix}`;
          
          contentBlocks.push({
            type: 'text',
            text: formattedText,
            placeholder: null // No placeholder for general text content
          });
        }
      }
    } else if (content.trim().length === 0 && imageRefs.length === 0) {
      // Handle case of empty page - mark it with text content tags anyway
      const markerToContentSpacing = createSpacing(config.spacing.markerToContent);
      
      // Get text format with page number
      const textFormat = {
        prefix: config.contentTypes.text.prefix.replace(/\{pageNumber\}/g, page.pageNumber),
        suffix: config.contentTypes.text.suffix.replace(/\{pageNumber\}/g, page.pageNumber)
      };
      
      // Even for empty pages, provide clear text markers
      const formattedText = `${textFormat.prefix}${markerToContentSpacing}[Empty page]${markerToContentSpacing}${textFormat.suffix}`;
      
      contentBlocks.push({
        type: 'text',
        text: formattedText,
        placeholder: null
      });
    }
    
    // Third pass: Replace content with properly arranged blocks
    if (contentBlocks.length > 0) {
      // Clear original content first if we're rebuilding it entirely
      if (hasPageScan) {
        // If there's a page scan, we'll start fresh
        content = '';
      } else {
        // For non-page-scan pages, we need to check if it's text-only content
        const hasImageBlocks = contentBlocks.some(block => block.type === 'image' && block.placeholder);
        const hasTextBlock = contentBlocks.some(block => block.type === 'text' && !block.placeholder);
        
        // If there are only text blocks (no image blocks with placeholders), clear content
        if (!hasImageBlocks && hasTextBlock) {
          // This is a text-only page, so we should start fresh
          content = '';
          
          // Add the text content block directly
          const textBlock = contentBlocks.find(block => block.type === 'text');
          if (textBlock) {
            content = textBlock.text;
          }
        } else {
          // For pages with image placeholders, replace them first
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
    } else {
      // If no content blocks were created, create a default text block
      const markerToContentSpacing = createSpacing(config.spacing.markerToContent);
      
      // Get text format with page number
      const textFormat = {
        prefix: config.contentTypes.text.prefix.replace(/\{pageNumber\}/g, page.pageNumber),
        suffix: config.contentTypes.text.suffix.replace(/\{pageNumber\}/g, page.pageNumber)
      };
      
      // Default text for empty page
      let textContent = '[Empty page]';
      if (rawText) {
        textContent = rawText;
      } else if (content.trim()) {
        textContent = content.trim();
      }
      
      content = `${textFormat.prefix}${markerToContentSpacing}${textContent}${markerToContentSpacing}${textFormat.suffix}`;
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
    contentTypes: {
      pageHeading: { ...DEFAULT_CONFIG.contentTypes.pageHeading },
      pageScan: { ...DEFAULT_CONFIG.contentTypes.pageScan },
      image: { ...DEFAULT_CONFIG.contentTypes.image },
      text: { ...DEFAULT_CONFIG.contentTypes.text }
    },
    spacing: { ...DEFAULT_CONFIG.spacing }
  };

  if (customConfig.contentTypes) {
    if (customConfig.contentTypes.pageHeading) {
      Object.assign(config.contentTypes.pageHeading, customConfig.contentTypes.pageHeading);
    }
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

  return replacementResult.pages.map((page, index, pages) => {
    const pageNumberRegex = /\{pageNumber\}/g;

    // Per-page wrapping markers (e.g. `<page page_number="2">` … `</page>`).
    const headingPrefix = config.contentTypes.pageHeading.prefix.replace(pageNumberRegex, page.pageNumber);
    const headingSuffix = config.contentTypes.pageHeading.suffix.replace(pageNumberRegex, page.pageNumber);

    // The page body is just the rendered content blocks.
    const pageContent = page.content;
    
    // Final result with proper wrapping of the entire page
    let result = '';
    
    // Only wrap with page markers if we have valid markers
    if (headingPrefix && headingPrefix.trim() !== '') {
      // Add marker-to-content spacing
      const markerToContentSpacing = createSpacing(config.spacing.markerToContent);
      
      // Wrap everything with page markers
      result = `${headingPrefix}${markerToContentSpacing}${pageContent}${markerToContentSpacing}${headingSuffix}`;
    } else {
      // No page markers, just use the content directly
      result = pageContent;
    }
    
    // Add spacing between pages (except for the last page)
    if (index < pages.length - 1) {
      result += createSpacing(config.spacing.betweenPages);
    }
    
    return result;
  }).join('');
} 