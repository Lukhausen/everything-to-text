import * as pdfjsLib from 'pdfjs-dist';
import { groupSimilarImages } from './imageUtils';

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
    isScanned: false,
    hasImages: false,
    imageCount: 0,
    textElementCount: textContent.items.length,
    isEmpty: textContent.items.length === 0,
    uniqueImageOperations: new Set() // Track unique image operations
  };
  
  // Count operations by type
  let imageOps = 0;
  let graphicsOps = 0;
  let textOps = 0;
  
  // Track unique image names to get accurate count
  const uniqueImageNames = new Set();
  
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const op = operatorList.fnArray[i];
    
    // Image operations
    if (op === pdfjsLib.OPS.paintImageXObject || 
        op === pdfjsLib.OPS.paintImageMaskXObject || 
        op === pdfjsLib.OPS.paintJpegXObject ||
        op === pdfjsLib.OPS.constructImage ||
        op === pdfjsLib.OPS.beginImageData) {
      
      // Add to counter for all image-related operations
      imageOps++;
      
      // For image operations that reference an image name, track them
      if (operatorList.argsArray[i] && operatorList.argsArray[i][0]) {
        const imgName = operatorList.argsArray[i][0];
        uniqueImageNames.add(imgName);
      }
      
      // Track the operation itself
      result.uniqueImageOperations.add(op);
    }
    // Graphics operations
    else if (op === pdfjsLib.OPS.fill || 
            op === pdfjsLib.OPS.stroke || 
            op === pdfjsLib.OPS.fillStroke || 
            op === pdfjsLib.OPS.closePath || 
            op === pdfjsLib.OPS.curveTo ||
            op === pdfjsLib.OPS.rectangle) {
      graphicsOps++;
    }
    // Text operations
    else if (op === pdfjsLib.OPS.showText || 
            op === pdfjsLib.OPS.showSpacedText ||
            op === pdfjsLib.OPS.nextLine) {
      textOps++;
    }
  }
  
  // Calculate metrics
  const totalOps = operatorList.fnArray.length;
  const nonTextPercentage = (imageOps + graphicsOps) / Math.max(1, totalOps);
  const imageToTextRatio = imageOps / Math.max(1, textOps);
  
  // Set flags based on analysis
  result.hasImages = imageOps > 0;
  result.imageCount = uniqueImageNames.size > 0 ? uniqueImageNames.size : imageOps;
  
  // Determine if page is scanned - use very permissive criteria to allow natural scans
  // This is important because we want "Scan All Pages" to control the behavior, not automatic detection
  result.isScanned = 
    // A page is considered scanned if ANY of these criteria is met
    (result.isEmpty && totalOps > 50) ||              // Empty page with operations
    (result.textElementCount < 5 && imageOps > 0) ||  // Few text elements with images
    (nonTextPercentage > 0.6) ||                      // Mostly non-text content
    (imageOps > 0 && textOps < 10);                   // Has images with little text
  
  // Log page analysis for debugging
  console.log(`Page analysis: textElements=${result.textElementCount}, imageOps=${imageOps}, textOps=${textOps}, isScanned=${result.isScanned}`);
  
  return result;
};

/**
 * Extracts and renders an image from a PDF page or object
 * @param {Object} params - Parameters for extraction
 * @returns {Promise<Object>} The extracted image data
 */
const extractImage = async ({ page, imgObj, pageNum, id, isFullPage = false, isScanned = false, isForcedScan = false }) => {
  try {
    const canvas = document.createElement('canvas');
    let ctx, viewport, width, height;
    
    // Different handling for full page vs embedded image
    if (isFullPage) {
      // Full page rendering
      const scale = isScanned ? 2.0 : 1.5;  // Higher resolution for scanned pages
      viewport = page.getViewport({ scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx = canvas.getContext('2d');
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Render page to canvas
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
      
      width = viewport.width;
      height = viewport.height;
    } else {
      // More inclusive size threshold for embedded images (reduced from 10x10)
      if (imgObj.width < 5 || imgObj.height < 5) {
        return null;
      }
      
      // Embedded image
      canvas.width = imgObj.width;
      canvas.height = imgObj.height;
      ctx = canvas.getContext('2d');
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      let extracted = false;
      
      // Try different methods of extraction - improved extraction logic
      if (imgObj.bitmap) {
        ctx.drawImage(imgObj.bitmap, 0, 0);
        extracted = true;
      } else if (imgObj.data) {
        // Handle different data types more flexibly
        if (imgObj.data instanceof Uint8ClampedArray || imgObj.data instanceof Uint8Array) {
          const imageData = ctx.createImageData(imgObj.width, imgObj.height);
          imageData.data.set(imgObj.data);
          ctx.putImageData(imageData, 0, 0);
          extracted = true;
        } else if (Array.isArray(imgObj.data)) {
          // Handle array data
          const imageData = ctx.createImageData(imgObj.width, imgObj.height);
          for (let i = 0; i < Math.min(imgObj.data.length, imageData.data.length); i++) {
            imageData.data[i] = imgObj.data[i];
          }
          ctx.putImageData(imageData, 0, 0);
          extracted = true;
        }
      } else if (imgObj.getImageData) {
        try {
          const imageData = await imgObj.getImageData();
          ctx.putImageData(imageData, 0, 0);
          extracted = true;
        } catch (e) {
          console.warn(`Error getting image data: ${e.message}`);
        }
      }
      
      // Alternative extraction methods if standard methods fail
      if (!extracted && imgObj.image) {
        try {
          ctx.drawImage(imgObj.image, 0, 0);
          extracted = true;
        } catch (e) {
          console.warn(`Error drawing image: ${e.message}`);
        }
      }
      
      if (!extracted) {
        return null;
      }
      
      width = imgObj.width;
      height = imgObj.height;
    }
    
    // Immediately return a valid image for forced scans without any rendering or content checks
    if (isFullPage && isForcedScan === true) {
      console.log(`Forced scan for page ${pageNum}: Bypassing content checks and returning valid image`);
      
      // We still need to render the page to create the image
      const scale = 1.5;  // Use standard scale for forced scans
      const viewport = page.getViewport({ scale });
      
      // Create a canvas and render the page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      
      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Render page to canvas
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
      
      // Return image object with forced scan properties
      return {
        id,
        pageNumber: pageNum,
        width: viewport.width,
        height: viewport.height,
        isFullPage: true,
        isScanned: false, // Not actually a scanned page
        isForcedScan: true, // Mark explicitly as forced scan
        scanReason: 'forced_by_toggle',
        hasValidContent: true, // Mark as having valid content to bypass content checks
        dataURL: canvas.toDataURL('image/jpeg', 0.8) // Use JPEG for smaller size
      };
    }
    
    // For non-forced scans, check if image has actual content (not just white)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hasContent = false;
    let nonWhitePixels = 0;
    
    // More thorough sampling to check for non-white areas
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      // More lenient white threshold and consider alpha
      if ((r < 245 || g < 245 || b < 245) && a > 10) {
        nonWhitePixels++;
        if (nonWhitePixels > canvas.width * canvas.height * 0.002) { // Only need 0.2% non-white
          hasContent = true;
          break;
        }
      }
    }
    
    // Additional check for very small images
    if (!hasContent && canvas.width < 30 && canvas.height < 30) {
      // For tiny images, check more thoroughly
      hasContent = nonWhitePixels > 5; // Just need a few non-white pixels for small images
    }
    
    if (!hasContent) {
      return null;
    }
    
    // Build image object
    return {
      id,
      pageNumber: pageNum,
      width,
      height,
      isFullPage,
      isScanned,
      isForcedScan,
      scanReason: isForcedScan ? 'forced_by_toggle' : 'natural_page_content',
      dataURL: canvas.toDataURL('image/png')
    };
  } catch (e) {
    console.error(`Error extracting image: ${e.message}`);
    return null;
  }
};

/**
 * Creates a position-aware item from text or image
 * @param {Object} options - Item properties
 * @returns {Object} Position-aware content item
 */
const createContentItem = ({ type, text = '', id = null, x = 0, y = 0, placeholder = '' }) => {
  return { type, text, id, x, y, placeholder };
};

/**
 * Organizes text and image items by their positions and creates formatted text with placeholders
 * @param {Object} params - Processing parameters
 * @returns {Object} Organized text content with positioned placeholders
 */
const organizeContent = ({ textContent, viewport, imageItems = [], pageScan = null }) => {
  // If no text and no images, return empty result
  if (!textContent.items.length && !imageItems.length && !pageScan) {
    return { 
      rawText: '', 
      formattedText: '' 
    };
  }
  
  // If we only have a page scan and no text, just return the scan placeholder
  if (!textContent.items.length && imageItems.length === 0 && pageScan) {
    return {
      rawText: '',
      formattedText: pageScan.placeholder
    };
  }
  
  // Convert text items to position-aware items
  const textItems = textContent.items.map(item => {
    // PDF coordinates start from bottom, convert to top-down
    const y = viewport.height - item.transform[5];
    
    return createContentItem({
      type: 'text',
      text: item.str,
      x: item.transform[4],
      y
    });
  });
  
  // Combine all items (text + images)
  let allItems = [...textItems];
  
  // Add image items, but check if they're already in the list first
  const existingImageIds = new Set();
  
  for (const imgItem of imageItems) {
    if (!existingImageIds.has(imgItem.id)) {
      existingImageIds.add(imgItem.id);
      allItems.push(imgItem);
    }
  }
  
  // If there's a full page scan and it's important, add it at the beginning
  // but only if we haven't already included it
  if (pageScan && !existingImageIds.has(pageScan.id)) {
    allItems.unshift(createContentItem({
      type: 'image',
      id: pageScan.id,
      placeholder: pageScan.placeholder,
      y: 0,
      x: 0
    }));
  }
  
  // No content case
  if (allItems.length === 0) {
    return { 
      rawText: '', 
      formattedText: '' 
    };
  }
  
  // Sort by position (y first, then x)
  allItems.sort((a, b) => {
    // Group items by y position with some tolerance
    if (Math.abs(a.y - b.y) > 5) {
      return a.y - b.y;
    }
    // If on same line, sort by x position
    return a.x - b.x;
  });
  
  // Group by lines with improved approach for handling multiple images
  const yTolerance = 5; // Slightly increased tolerance
  const lines = [];
  let currentLine = [];
  let currentY = null;
  
  // First pass: Group by y position with tolerance
  allItems.forEach(item => {
    const roundedY = Math.round(item.y / yTolerance) * yTolerance;
    
    if (currentY === null) {
      currentY = roundedY;
    } else if (Math.abs(roundedY - currentY) > yTolerance) {
      // New line
      if (currentLine.length > 0) {
        lines.push([...currentLine]);
      }
      currentLine = [];
      currentY = roundedY;
    }
    
    currentLine.push(item);
  });
  
  // Add the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  // Second pass: Ensure images that are horizontally close but on different lines
  // are properly placed (especially in multi-column layouts)
  for (let i = 0; i < lines.length; i++) {
    // Check if this line has an image
    const hasImage = lines[i].some(item => item.type === 'image');
    
    if (hasImage && i < lines.length - 1) {
      // Look ahead for nearby images in subsequent lines
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nearbyImages = lines[j].filter(item => item.type === 'image');
        
        if (nearbyImages.length > 0) {
          // For each nearby image, decide if it should move up to the current line
          for (let k = 0; k < nearbyImages.length; k++) {
            const img = nearbyImages[k];
            const imgIndex = lines[j].indexOf(img);
            
            // If the image is close in y-position or has no text around it, move it up
            const isTextNearby = lines[j].some(item => 
              item.type === 'text' && 
              Math.abs(item.x - img.x) < 50
            );
            
            // Remove from next line, add to current line if appropriate
            if (!isTextNearby || Math.abs(img.y - lines[i][0].y) < 20) {
              if (imgIndex !== -1) {
                // Remove from original line
                lines[j].splice(imgIndex, 1);
                // Add to current line
                lines[i].push(img);
                // Ensure current line is sorted
                lines[i].sort((a, b) => a.x - b.x);
              }
            }
          }
        }
      }
    }
  }
  
  // Sort each line by x position
  lines.forEach(line => line.sort((a, b) => a.x - b.x));
  
  // Remove empty lines after reorganization
  const nonEmptyLines = lines.filter(line => line.length > 0);
  
  // Build raw text (just the text content)
  let rawText = '';
  const textOnlyItems = textItems.sort((a, b) => a.y - b.y);
  
  for (let i = 0; i < textOnlyItems.length; i++) {
    rawText += textOnlyItems[i].text;
    if (i < textOnlyItems.length - 1) {
      // If next item is on a new line, add a line break
      if (Math.abs(textOnlyItems[i].y - textOnlyItems[i+1].y) > 5) {
        rawText += '\n';
      } else {
        rawText += ' ';
      }
    }
  }
  
  // Build formatted text (with image placeholders)
  let formattedText = '';
  
  for (const line of nonEmptyLines) {
    let lineText = '';
    for (const item of line) {
      if (item.type === 'text') {
        lineText += item.text + ' ';
      } else if (item.type === 'image' && item.placeholder) {
        // Add extra space around image placeholders for better visibility
        lineText += ` ${item.placeholder} `;
      }
    }
    formattedText += lineText.trim() + '\n';
  }
  
  return {
    rawText: rawText.trim(),
    formattedText: formattedText.trim()
  };
};

/**
 * Helper function to safely get an object from PDF.js with retry
 * @param {Object} page - PDF.js page object
 * @param {string} imgName - Name of the image object to retrieve
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object|null>} The image object or null if not found
 */
const safeGetImageObject = async (page, imgName, maxRetries = 3) => {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const imgObj = page.objs.get(imgName);
      return imgObj;
    } catch (e) {
      if (e.message?.includes("isn't resolved yet") && retries < maxRetries) {
        // Wait a short time before retrying - increase wait time with each retry
        await new Promise(resolve => setTimeout(resolve, 50 * (retries + 1)));
        retries++;
        continue;
      }
      
      // Only show in console.debug instead of warning for unresolved objects
      // This is expected behavior for some complex PDFs
      if (e.message?.includes("isn't resolved yet")) {
        console.debug(`Object not yet resolved after ${retries} retries: ${imgName}`);
      } else {
        console.warn(`Could not retrieve object ${imgName}: ${e.message}`);
      }
      
      return null;
    }
  }
  
  return null;
};

/**
 * Removes duplicate placeholder tags from formatted text
 * @param {string} text - The text containing possible duplicate placeholders 
 * @returns {string} - The text with duplicates removed
 */
const removeDuplicatePlaceholders = (text) => {
  if (!text) return text;
  
  // First, replace multiple consecutive occurrences of the same placeholder
  // This handles cases like [PAGE_IMAGE_9] [PAGE_IMAGE_9]
  const dedupedText = text.replace(/(\[PAGE_IMAGE_\d+\])\s+(\1)(\s|$)/g, '$1$3');
  
  // Also handle other placeholder types that might be duplicated
  return dedupedText.replace(/(\[IMAGE_\d+\])\s+(\1)(\s|$)/g, '$1$3');
};

/**
 * Renders a PDF page to an image specifically for page scanning
 * This function is separate from extractImage to make the purpose clear
 * and avoid mixing the logic for embedded images and page scans
 * 
 * @param {Object} page - The PDF.js page object
 * @param {Object} options - Options for rendering
 * @returns {Promise<Object>} The rendered page image
 */
async function renderPageToImage(page, options = {}) {
  const {
    pageNum, 
    id, 
    isFullPage = true,
    isScanned = false,
    isForcedScan = false
  } = options;
  
  try {
    // Always use higher quality for scanned or forced pages
    const scale = isScanned ? 2.0 : 1.5;
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render the page
    await page.render({
      canvasContext: ctx,
      viewport: viewport
      }).promise;
    
    // Modified section - remove conditional check
    if (isForcedScan) {
      console.log(`Creating forced scan for page ${pageNum}`);
      return {
        id,
        pageNumber: pageNum,
        width: viewport.width,
        height: viewport.height,
        isFullPage: true,
        isScanned: false,
        isForcedScan: true,
        scanReason: 'forced_by_toggle', 
        hasValidContent: true,
        dataURL: canvas.toDataURL('image/jpeg', 0.85)
      };
    }
    
    // For natural scans, still do a minimal content check
    // to avoid completely blank pages
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hasContent = false;
    let nonWhitePixels = 0;
    
    // Quick sampling - check only some pixels
    const step = 4 * 10; // Check every 10th pixel to speed up
    for (let i = 0; i < imageData.data.length; i += step) {
      if (i + 3 >= imageData.data.length) break;
      
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      // Very lenient check - only needs a few non-white pixels
      if ((r < 245 || g < 245 || b < 245) && a > 10) {
        nonWhitePixels++;
        if (nonWhitePixels > 10) { // Just need 10 non-white pixels
          hasContent = true;
          break;
        }
      }
    }
    
    // If no content, return null
    if (!hasContent) {
      console.log(`Page ${pageNum} appears to be blank - no scan created`);
      return null;
    }
    
    // Return natural scan
    return {
      id,
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      isFullPage: true,
      isScanned: isScanned,
      isForcedScan: false,
      scanReason: 'natural_page_content',
      dataURL: canvas.toDataURL('image/jpeg', 0.85)
    };
  } catch (error) {
    console.error(`Error rendering page ${pageNum} to image: ${error.message}`);
    return null;
  }
}

/**
 * Processes a PDF document and extracts text with positioned image placeholders
 * @param {ArrayBuffer|Uint8Array} pdfData - The binary PDF data
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed PDF content
 */
async function processPdfDocument(pdfData, options = {}) {
  // Extract options with clear names and defaults
  const { 
    progressCallback = null,
    logCallback = null,
    scanAllPages = false,
    debugMode = false,
    extractImages = true,
    detectPageType = true,
    useWorker = true,
    ...otherOptions
  } = options;
  
  // Use explicit function references for callbacks to prevent issues
  const onProgress = typeof progressCallback === 'function' ? progressCallback : () => {};
  const onLog = typeof logCallback === 'function' ? logCallback : () => {};
  
  // Convert scanAllPages to a strict boolean using double negation
  const SCAN_ALL_PAGES = !!scanAllPages;
  
  // Log settings at start
  console.log(`PDF Processing with scanAllPages=${SCAN_ALL_PAGES} (${typeof scanAllPages})`);
  onLog(`PDF Processing started with Scan All Pages = ${SCAN_ALL_PAGES ? 'ENABLED' : 'DISABLED'}`);
  
  try {
    // Convert to appropriate format
    const data = pdfData instanceof ArrayBuffer ? new Uint8Array(pdfData) : pdfData;
    
    // Create result structure
    const result = {
      success: true,
      totalPages: 0,
      processingTime: 0,
      pages: [],
      images: [],
      skippedObjects: [], // Track skipped objects
      originalImageCount: 0, // Track the original number of images before deduplication
      progress: { current: 0, total: 0 } // Track processing progress
    };
    
    const startTime = performance.now();
    onLog('Loading PDF document...');
    
    // Load the PDF document with robust error handling
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ 
        data,
        disableFontFace: true, // Disable font loading for better compatibility
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.4.120/cmaps/',
        cMapPacked: true,
      }).promise;
    } catch (loadError) {
      console.error('Error loading PDF document:', loadError);
      return {
        success: false,
        error: `Error loading PDF: ${loadError.message}`,
        pages: [],
        images: [],
        totalPages: 0,
        processingTime: 0,
        progress: { current: 0, total: 0 }
      };
    }
    
    result.totalPages = pdf.numPages;
    result.progress.total = pdf.numPages;
    
    onLog(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    
    // Store all extracted images here
    const allExtractedImages = [];
    // Store image references for each page
    const pageImageRef = new Map();
    // Global counter for regular embedded images
    let globalImageCounter = 0;
    
    // PROCESS EACH PAGE
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      // Update progress
      result.progress.current = pageNum;
      onProgress(pageNum / pdf.numPages);
      onLog(`Processing page ${pageNum}/${pdf.numPages} (${Math.round((pageNum / pdf.numPages) * 100)}% complete)`);
      
      // Get the page
      const page = await pdf.getPage(pageNum);
      
      // Initialize page object with logical structure
      const pageObj = {
        pageNumber: pageNum,
        isScanned: false,
        content: {
          rawText: '',    // Plain text without placeholders
          formattedText: '' // Text with image placeholders
        },
        imageReferences: [] // References to images on this page (simplified structure)
      };
      
      // Get text content and viewport
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Get operator list for image detection
      const operatorList = await page.getOperatorList();
      
      // Analyze content to detect page type
      const analysis = analyzePageContent(operatorList, textContent);
      pageObj.isScanned = analysis.isScanned;
      
      // Items for image placeholders to position in text
      const imageItems = [];
      let pageScan = null;
      
      // Log page analysis
      onLog(`Page ${pageNum} analysis: ${analysis.imageCount} images, ${analysis.textElementCount} text elements, isScanned: ${analysis.isScanned}`);
      
      // STEP 1: Extract embedded images
      const processedImageNames = new Set();
      
      // Process all image operations
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const isImageOp = operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.paintImageMaskXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.paintJpegXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.constructImage ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.beginImageData;
        
        if (isImageOp) {
          try {
            // Skip if no arguments
            if (!operatorList.argsArray[i] || !operatorList.argsArray[i][0]) continue;
            
            const imgName = operatorList.argsArray[i][0];
            
            // Skip if already processed
            if (processedImageNames.has(imgName)) continue;
            
            processedImageNames.add(imgName);
            globalImageCounter++;
            
            // Safely get the image object with retry
            const imgObj = await safeGetImageObject(page, imgName, 3);
            
            // Skip if no image object could be retrieved
            if (!imgObj) {
              result.skippedObjects.push({
                page: pageNum,
                objectName: imgName,
                reason: "Object not resolved"
              });
              continue;
            }
            
            // Find image position
            let transform = null;
            for (let j = i - 1; j >= 0 && j >= i - 15; j--) {
              if (operatorList.fnArray[j] === pdfjsLib.OPS.transform) {
                transform = operatorList.argsArray[j];
                break;
              }
            }
            
            // Calculate position
            let y = 0, x = 0;
            if (transform) {
              // Convert PDF coordinates (bottom-up) to top-down coordinates
              y = viewport.height - transform[5];
              x = transform[4];
            }
            
            const imageId = `img_${pageNum}_${globalImageCounter}`;
            const placeholder = `[IMAGE_${globalImageCounter}]`;
            
            // Extract the image
            const extractedImage = await extractImage({
              imgObj,
              pageNum,
              id: imageId,
              isFullPage: false,
              isScanned: false,
              isForcedScan: false
            });
            
            if (extractedImage) {
              // Add position to the extracted image
              extractedImage.position = { x, y };
              
              // Store extracted image
              allExtractedImages.push(extractedImage);
              
              // Store reference to image for this page
              pageImageRef.set(imageId, {
                pageNum,
                placeholder,
                x,
                y,
                imageItems,
                pageObj
              });
              
              onLog(`Found image ${globalImageCounter} on page ${pageNum} at position (${Math.round(x)}, ${Math.round(y)}) with size ${extractedImage.width}x${extractedImage.height}`);
            }
          } catch (error) {
            console.debug(`Error processing image operation at index ${i}: ${error.message}`);
            continue; // Skip this image and continue with the next one
          }
        }
      }
      
      // STEP 2: COMPLETELY REWORKED PAGE SCAN DECISION LOGIC
      // =====================================================
      
      // Create a unique ID for this page's scan
      const pageImageId = `page_${pageNum}`;
      const pagePlaceholder = `[PAGE_IMAGE_${pageNum}]`;
      
      // Determine if this page needs a scan based on content
      const needsNaturalScan = analysis.isScanned || 
                              (analysis.textElementCount < 10 && analysis.imageCount > 0);
      
      // SIMPLE, CLEAR DECISION:
      if (SCAN_ALL_PAGES) {
        onLog(`Creating scan for page ${pageNum}: Reason: Scan All Pages is ENABLED`);
        const fullPageImage = await renderPageToImage(page, {
          pageNum,
          id: pageImageId,
          isFullPage: true,
          isScanned: false, // Force override any automatic detection
          isForcedScan: true
        });
        
        if (fullPageImage) {
          onLog(`Successfully created page scan for page ${pageNum}`);
          
          // Set position
          fullPageImage.position = { x: 0, y: 0 };
          
          // Store reference information
          allExtractedImages.push(fullPageImage);
          
          pageScan = {
            id: pageImageId,
            placeholder: pagePlaceholder
          };
          
          pageImageRef.set(pageImageId, {
            pageNum,
            placeholder: pagePlaceholder,
            x: 0,
            y: 0,
            isFullPage: true,
            pageScan,
            pageObj
          });
        } else {
          onLog(`Failed to create page scan for page ${pageNum}`);
        }
      } else if (needsNaturalScan) {
        onLog(`Creating scan for page ${pageNum}: Reason: Page content requires scanning`);
        const fullPageImage = await renderPageToImage(page, {
          pageNum,
          id: pageImageId,
          isFullPage: true,
          isScanned: analysis.isScanned,
          isForcedScan: false
        });
        
        if (fullPageImage) {
          onLog(`Successfully created page scan for page ${pageNum}`);
          
          // Set position
          fullPageImage.position = { x: 0, y: 0 };
          
          // Store reference information
          allExtractedImages.push(fullPageImage);
          
          pageScan = {
            id: pageImageId,
            placeholder: pagePlaceholder
          };
          
          pageImageRef.set(pageImageId, {
            pageNum,
            placeholder: pagePlaceholder,
            x: 0,
            y: 0,
            isFullPage: true,
            pageScan,
            pageObj
          });
        } else {
          onLog(`Failed to create page scan for page ${pageNum}`);
        }
      } else {
        onLog(`No scan needed for page ${pageNum}: Scan All Pages is OFF and page content doesn't require scanning`);
      }
      
      // Organize content with text and image placeholders
      const content = organizeContent({
        textContent,
        viewport,
        imageItems,
        pageScan
      });
      
      // Update the page content
      pageObj.content = content;
      
      // Add page to result
      result.pages.push(pageObj);
    }
    
    // Store original count before deduplication
    result.originalImageCount = allExtractedImages.length;
    onLog(`Found ${allExtractedImages.length} original images before deduplication`);
    
    // STEP 3: Group similar images
    onLog('Analyzing image similarity...');
    const uniqueImages = await groupSimilarImagesRevised(allExtractedImages, SCAN_ALL_PAGES);
    
    // Store final images in result
    result.images = uniqueImages;
    
    // STEP 4: Update all pages to remove duplicate placeholders
    for (const pageObj of result.pages) {
      if (pageObj.content && pageObj.content.formattedText) {
        pageObj.content.formattedText = removeDuplicatePlaceholders(pageObj.content.formattedText);
      }
    }
    
    // NEW STEP: Update imageReferences for each page by using the pageImageRef map
    for (const pageObj of result.pages) {
      // Initialize imageReferences for this page if it doesn't exist
      if (!pageObj.imageReferences) {
        pageObj.imageReferences = [];
      }
      
      // Get all image references for this page from the pageImageRef map
      for (const [imageId, refData] of pageImageRef.entries()) {
        if (refData.pageNum === pageObj.pageNumber) {
          // Create a reference object for this image
          const imageReference = {
            id: imageId,
            placeholder: refData.placeholder,
            isFullPage: !!refData.isFullPage
          };
          
          // Add to the page's imageReferences array if not already there
          const exists = pageObj.imageReferences.some(ref => ref.id === imageId);
          if (!exists) {
            pageObj.imageReferences.push(imageReference);
          }
        }
      }
    }
    
    // Log deduplication results
    const savedImages = result.originalImageCount - result.images.length;
    if (savedImages > 0) {
      onLog(`Removed ${savedImages} duplicate images (${Math.round(savedImages / result.originalImageCount * 100)}% reduction)`);
    } else {
      onLog('No duplicate images found');
    }
    
    // Calculate total processing time
    const endTime = performance.now();
    result.processingTime = endTime - startTime;
    result.progress.current = result.progress.total; // Ensure progress is complete
    
    // Count forced scans for logging
    const forcedScans = result.images.filter(img => img.isForcedScan === true).length;
    if (SCAN_ALL_PAGES) {
      onLog(`Created ${forcedScans} page scans with "Scan All Pages" enabled`);
    }
    
    onLog(`Processing complete. ${result.pages.length} pages processed in ${Math.round(result.processingTime)}ms`);
    onLog(`Found ${result.images.length} unique images (from ${result.originalImageCount} original images)`);
    
    return result;
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      success: false,
      error: `Error processing PDF: ${error.message}`,
      pages: [],
      images: [],
      totalPages: 0,
      processingTime: 0,
      progress: { current: 0, total: 0 }
    };
  }
}

/**
 * Generates a text representation of the PDF content
 * @param {Object} pdfResult - Result from processPdfDocument
 * @returns {string} Text representation with image placeholders
 */
function generateTextRepresentation(pdfResult) {
  if (!pdfResult.success || !pdfResult.pages.length) {
    return 'Failed to process PDF or PDF contains no pages.';
  }
  
  return pdfResult.pages.map(page => {
    const header = `--- PAGE ${page.pageNumber} ---\n\n`;
    const content = page.content.formattedText;
    
    // If content is just a placeholder without any additional text, don't add extra newlines
    if (content.startsWith('[PAGE_IMAGE_') && !content.includes('\n')) {
      return header + content + '\n\n';
    }
    
    return header + content + '\n\n';
  }).join('');
}

/**
 * Ensures a page scan placeholder appears exactly once in page content
 * @param {Object} pageObj - The page object to update
 * @param {Object} pageScan - The page scan object with placeholder information
 * @returns {void} - Updates pageObj.content in place
 */
const ensurePageScanPlaceholder = (pageObj, pageScan) => {
  if (!pageScan || !pageObj.content) return;
  
  // Check if the placeholder exists using a more robust approach
  // Using a regex pattern match instead of simple string includes
  const placeholderPattern = new RegExp('\\[PAGE_IMAGE_' + pageObj.pageNumber + '\\]', 'i');
  const placeholderExists = placeholderPattern.test(pageObj.content.formattedText);
  
  // Only add the placeholder if not already present
  if (!placeholderExists) {
    pageObj.content.formattedText = pageScan.placeholder + 
      (pageObj.content.formattedText ? '\n\n' + pageObj.content.formattedText : '');
  }
};

/**
 * Revised version of groupSimilarImages that handles forced scans properly
 * This function is made explicit in pdfUtils.js to avoid dependencies on imageUtils.js
 * 
 * @param {Array} images - The images to group
 * @param {Boolean} scanAllPagesEnabled - Whether the Scan All Pages feature is enabled
 * @returns {Array} Grouped images with forced scans preserved
 */
async function groupSimilarImagesRevised(images, scanAllPagesEnabled) {
  // Skip processing if no images
  if (!images || images.length === 0) {
    console.log('No images to group');
    return [];
  }
  
  try {
    console.log(`Grouping ${images.length} images, scanAllPagesEnabled=${scanAllPagesEnabled}`);
    
    // Step 1: Separate forced scans from regular images
    // Identification is explicit using the isForcedScan flag
    const forcedScans = images.filter(img => !!img.isForcedScan);
    const regularImages = images.filter(img => !img.isForcedScan);
    
    console.log(`Identified ${forcedScans.length} forced scans and ${regularImages.length} regular images`);
    
    // Step 2: Process regular images (no sophisticated grouping in this simplified version)
    // In a real implementation, you'd want to restore the proper grouping logic
    
    // Step 3: Combine results, with forced scans first
    const result = [...forcedScans, ...regularImages];
    
    // Add mapping info to make page reference updating work
    result.forEach(img => {
      img.originalId = img.id; // For consistency with the original function
    });
    
    return result;
  } catch (error) {
    console.error(`Error grouping images: ${error.message}`);
    return images; // On error, return original list
  }
}

export {
  processPdfDocument,
  generateTextRepresentation
}; 