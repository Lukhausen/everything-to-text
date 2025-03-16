import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Analyzes PDF page content to determine its characteristics
 * @param {Object} operatorList - The operator list from PDF.js
 * @param {Object} textContent - The text content from PDF.js
 * @returns {Object} Analysis results
 */
const analyzePageContent = (operatorList, textContent) => {
  let result = {
    hasSignificantGraphics: false,
    hasScannedContent: false,
    hasFewTextItems: textContent.items.length < 5,
    imageOperations: 0,
    graphicsOperations: 0,
    textOperations: 0,
    totalOperations: operatorList.fnArray.length
  };
  
  // Count different operation types
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const op = operatorList.fnArray[i];
    
    // Image operations
    if (op === pdfjsLib.OPS.paintImageXObject || 
        op === pdfjsLib.OPS.paintImageMaskXObject || 
        op === pdfjsLib.OPS.paintJpegXObject) {
      result.imageOperations++;
    }
    // Path and drawing operations that likely represent graphics
    else if (op === pdfjsLib.OPS.fill || 
            op === pdfjsLib.OPS.stroke || 
            op === pdfjsLib.OPS.fillStroke || 
            op === pdfjsLib.OPS.closePath || 
            op === pdfjsLib.OPS.curveTo ||
            op === pdfjsLib.OPS.rectangle) {
      result.graphicsOperations++;
    }
    // Text operations
    else if (op === pdfjsLib.OPS.showText || 
            op === pdfjsLib.OPS.showSpacedText ||
            op === pdfjsLib.OPS.nextLine) {
      result.textOperations++;
    }
  }
  
  // Calculate percentages
  const nonTextPercentage = (result.imageOperations + result.graphicsOperations) / result.totalOperations;
  
  // Determine if page has significant graphics/images
  result.hasSignificantGraphics = (nonTextPercentage > 0.2) || (result.imageOperations > 0);
  
  // Determine if page might be scanned 
  // (few text elements but many operations, or very high graphics percentage)
  result.hasScannedContent = (result.hasFewTextItems && result.totalOperations > 100) || 
                            (nonTextPercentage > 0.7);
  
  return result;
};

/**
 * Extracts a page as an image
 * @param {Object} page - PDF.js page object
 * @param {number} pageNum - Page number
 * @param {Object} analysis - Analysis results from analyzePageContent
 * @returns {Promise<Object>} The extracted image object
 */
const extractPageAsImage = async (page, pageNum, analysis) => {
  try {
    // Choose appropriate scale based on page content
    const scale = analysis?.hasScannedContent ? 2.0 : 1.5;
    
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render the page to canvas
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;
    
    // Return the page as an image
    return {
      id: `page_${pageNum}`,
      placeholder: `[PAGE_IMAGE_${pageNum}]`,
      dataURL: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
      isFullPage: true,
      isScanned: analysis?.hasScannedContent || false
    };
  } catch (e) {
    console.error(`Error rendering page ${pageNum} as image:`, e);
    return null;
  }
};

/**
 * Extracts an image from a PDF object
 * @param {Object} img - PDF.js image object
 * @param {number} id - Image identifier
 * @param {number} pageNum - Page number
 * @param {string} placeholder - Text placeholder for the image
 * @returns {Promise<Object>} The extracted image object
 */
const extractImage = async (img, id, pageNum, placeholder) => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    // Handle different image formats
    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0);
    } else if (img.data) {
      // Ensure we have the right data format
      if (img.data instanceof Uint8ClampedArray || 
          img.data instanceof Uint8Array) {
        const imageData = ctx.createImageData(img.width, img.height);
        imageData.data.set(img.data);
        ctx.putImageData(imageData, 0, 0);
      } else {
        return null;
      }
    } else {
      return null;
    }
    
    return {
      id,
      placeholder,
      dataURL: canvas.toDataURL('image/png'),
      width: img.width,
      height: img.height
    };
  } catch (e) {
    console.error(`Error extracting image ${id} from page ${pageNum}:`, e);
    return null;
  }
};

/**
 * Extracts organized text with proper line breaks from PDF content and inserts image placeholders
 * @param {Object} textContent - The text content from PDF.js
 * @param {Object} viewport - The viewport from PDF.js
 * @param {Array} imageItems - Array of image items with positioning data
 * @returns {string} Formatted text with line breaks and image placeholders
 */
const extractFormattedTextWithPlaceholders = (textContent, viewport, imageItems) => {
  if (!textContent.items.length) return '';
  
  // Sort all text and image items by position (y first, then x)
  const textItems = textContent.items.map(item => {
    const y = viewport.height - item.transform[5];
    return {
      type: 'text',
      y,
      x: item.transform[4],
      text: item.str
    };
  });
  
  // Create combined list of text and images
  const combinedItems = [...textItems, ...imageItems].sort((a, b) => {
    // First sort by y position
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    
    // If y positions are very close, sort by x position for text items
    if (a.type === 'text' && b.type === 'text') {
      return a.x - b.x;
    }
    
    // For images at similar y positions, preserve their position
    return 0;
  });
  
  // Group items by approximate line (y position)
  const yTolerance = 3;
  let currentLine = [];
  let currentY = null;
  const lines = [];
  
  combinedItems.forEach(item => {
    const roundedY = Math.round(item.y / yTolerance) * yTolerance;
    
    if (currentY === null) {
      currentY = roundedY;
    } else if (Math.abs(roundedY - currentY) > yTolerance) {
      // New line
      lines.push(currentLine);
      currentLine = [];
      currentY = roundedY;
    }
    
    currentLine.push(item);
  });
  
  // Add the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  // Build the text with proper line breaks and image placeholders
  let formattedText = '';
  for (const line of lines) {
    // Sort items on this line by x position
    line.sort((a, b) => a.x - b.x);
    
    for (const item of line) {
      if (item.type === 'text') {
        formattedText += item.text + ' ';
      } else if (item.type === 'image') {
        formattedText += ` ${item.placeholder} `;
      }
    }
    
    formattedText += '\n';
  }
  
  return formattedText;
};

/**
 * Processes a PDF file and extracts all content including text, images, and scanned pages
 * @param {ArrayBuffer|Uint8Array} pdfData - The PDF data as ArrayBuffer or Uint8Array
 * @param {Object} options - Processing options
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onLog - Callback for logging
 * @returns {Promise<Object>} Comprehensive PDF content object
 */
export async function processPdfDocument(pdfData, options = {}) {
  const { onProgress = () => {}, onLog = () => {} } = options;
  
  try {
    // Ensure we have Uint8Array
    const data = pdfData instanceof ArrayBuffer ? new Uint8Array(pdfData) : pdfData;
    
    // Result object with simplified structure
    const result = {
      success: true,
      totalPages: 0,
      pages: [],     // Array of page objects
      processingTime: 0
    };
    
    const startTime = performance.now();
    onLog('Loading PDF document...');
    
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    result.totalPages = pdf.numPages;
    
    onLog(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    
    // Process each page
    let imageCounter = 0;
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress(pageNum / pdf.numPages);
      onLog(`Processing page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      
      // Create simplified page object
      const pageObj = {
        pageNumber: pageNum,
        hasImages: false,
        isScanned: false,
        images: [],
        text: '',
        scan: null
      };
      
      // Extract text content with positions
      const textContent = await page.getTextContent();
      const hasText = textContent.items.length > 0;
      
      // Get the viewport for positioning information
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Extract images and their positions
      const operatorList = await page.getOperatorList();
      
      // Analyze the page content
      const contentAnalysis = analyzePageContent(operatorList, textContent);
      
      // Image placeholders to insert in text
      const imageItems = [];
      
      // Process embedded images in the page
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        // Check for different types of image operations
        const isImageOp = operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.paintImageMaskXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.paintJpegXObject;
        
        if (isImageOp) {
          imageCounter++;
          const imgName = operatorList.argsArray[i][0];
          
          // Get image transform (position) from nearby transform operations
          let transform = null;
          for (let j = i - 1; j >= 0 && j >= i - 10; j--) {
            if (operatorList.fnArray[j] === pdfjsLib.OPS.transform) {
              transform = operatorList.argsArray[j];
              break;
            }
          }
          
          // If transform found, extract the y position
          let yPosition = 0;
          let xPosition = 0;
          if (transform) {
            // PDF coordinates start from bottom, so invert y
            yPosition = viewport.height - transform[5];
            xPosition = transform[4];
          }
          
          const placeholderName = `[IMAGE_${imageCounter}]`;
          
          // Add to image items array for text insertion
          imageItems.push({
            type: 'image',
            y: yPosition,
            x: xPosition,
            placeholder: placeholderName,
            id: imageCounter
          });
          
          // Extract image
          const img = page.objs.get(imgName);
          if (img) {
            const extractedImage = await extractImage(img, imageCounter, pageNum, placeholderName);
            if (extractedImage) {
              pageObj.hasImages = true;
              pageObj.images.push(extractedImage);
            }
          }
        }
      }
      
      // Decide whether to render full page as image based on content analysis
      const shouldRenderFullPage = 
        contentAnalysis.hasSignificantGraphics || 
        contentAnalysis.hasScannedContent ||
        (contentAnalysis.hasFewTextItems && contentAnalysis.totalOperations > 50);
      
      // If needed, render the whole page as an image
      if (shouldRenderFullPage) {
        const pageImage = await extractPageAsImage(page, pageNum, contentAnalysis);
        if (pageImage) {
          pageObj.isScanned = contentAnalysis.hasScannedContent;
          pageObj.scan = pageImage;
          
          // If this is a scanned page, add a placeholder at the beginning
          if (pageObj.isScanned) {
            imageItems.unshift({
              type: 'image',
              y: 0, // Put at the top of the text flow
              x: 0,
              placeholder: pageImage.placeholder,
              id: pageImage.id
            });
          }
        }
      }
      
      // Handle text extraction with properly positioned image placeholders
      if (hasText) {
        pageObj.text = extractFormattedTextWithPlaceholders(textContent, viewport, imageItems);
      } else if (pageObj.isScanned) {
        pageObj.text = `${pageObj.scan.placeholder}\n[SCANNED PAGE - This page appears to be a scanned image with no extractable text]`;
      }
      
      // Add the page to results
      result.pages.push(pageObj);
    }
    
    // Calculate total number of images across all pages
    const totalImages = result.pages.reduce((count, page) => {
      return count + page.images.length + (page.scan ? 1 : 0);
    }, 0);
    
    // Update processing time
    result.processingTime = performance.now() - startTime;
    
    onLog(`Processing complete. Found ${totalImages} images across ${result.totalPages} pages.`);
    onProgress(1);
    
    return result;
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      pages: [],
      totalPages: 0,
      processingTime: 0
    };
  }
}

/**
 * Extracts a comprehensive text representation of the PDF content
 * @param {Object} pdfResult - Result from processPdfDocument
 * @returns {string} Human-readable text representation
 */
export function generateTextRepresentation(pdfResult) {
  if (!pdfResult.success || !pdfResult.pages.length) {
    return 'Failed to process PDF or PDF contains no pages.';
  }
  
  let fullText = '';
  
  pdfResult.pages.forEach(page => {
    fullText += `--- PAGE ${page.pageNumber} ---\n\n`;
    
    if (page.isScanned && !page.text) {
      // Scanned page with no text
      fullText += `${page.scan.placeholder}\n[SCANNED PAGE - This page appears to be a scanned image with no extractable text]\n\n`;
    } else {
      // The text already includes properly positioned image placeholders
      fullText += page.text + '\n\n';
    }
  });
  
  return fullText;
}

export default {
  processPdfDocument,
  generateTextRepresentation
}; 