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
  
  // Determine if page is scanned
  result.isScanned = 
    (result.isEmpty && totalOps > 50) ||               // Empty page with operations
    (result.textElementCount < 10 && totalOps > 80) || // Few text items with many operations
    (nonTextPercentage > 0.6) ||                       // Mostly non-text content
    (imageOps === 1 && textOps < 5 && totalOps > 40);  // Single large image with minimal text
  
  return result;
};

/**
 * Extracts and renders an image from a PDF page or object
 * @param {Object} params - Parameters for extraction
 * @returns {Promise<Object>} The extracted image data
 */
const extractImage = async ({ page, imgObj, pageNum, id, isFullPage = false, isScanned = false }) => {
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
    
    // Check if image has actual content (not just white)
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
  let allItems = [...textItems, ...imageItems];
  
  // If there's a full page scan and it's important, add it at the beginning
  if (pageScan) {
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
 * Processes a PDF document and extracts text with positioned image placeholders
 * @param {ArrayBuffer|Uint8Array} pdfData - The binary PDF data
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed PDF content
 */
async function processPdfDocument(pdfData, options = {}) {
  const { onProgress = () => {}, onLog = () => {} } = options;
  
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
      originalImageCount: 0 // Track the original number of images before deduplication
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
        processingTime: 0
      };
    }
    
    result.totalPages = pdf.numPages;
    
    onLog(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    
    // Process each page
    let globalImageCounter = 0;
    const allExtractedImages = []; // Store all images before deduplication
    const pageImageRef = new Map(); // To update references after deduplication
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress(pageNum / pdf.numPages);
      onLog(`Processing page ${pageNum}/${pdf.numPages}`);
      
      const page = await pdf.getPage(pageNum);
      
      // Initialize page object with logical structure
      const pageObj = {
        pageNumber: pageNum,
        isScanned: false,
        content: {
          rawText: '',    // Plain text without placeholders
          formattedText: '' // Text with image placeholders
        },
        imageReferences: [] // References to images on this page
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
      
      onLog(`Page ${pageNum} analysis: ${analysis.imageCount} images, ${analysis.textElementCount} text elements, isScanned: ${analysis.isScanned}`);
      if (analysis.uniqueImageOperations.size > 0) {
        onLog(`Image operation types: ${Array.from(analysis.uniqueImageOperations).join(', ')}`);
      }
      
      // STEP 1: Extract embedded images
      // Track processed image names to avoid duplicates
      const processedImageNames = new Set();
      
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const isImageOp = operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.paintImageMaskXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.paintJpegXObject ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.constructImage ||
                        operatorList.fnArray[i] === pdfjsLib.OPS.beginImageData;
        
        if (isImageOp) {
          try {
            // Skip if no arguments
            if (!operatorList.argsArray[i] || !operatorList.argsArray[i][0]) {
              continue;
            }
            
            const imgName = operatorList.argsArray[i][0];
            
            // Skip if we've already processed this image name in the current page
            if (processedImageNames.has(imgName)) {
              continue;
            }
            
            processedImageNames.add(imgName);
            globalImageCounter++;
            
            // Safely get the image object with retry
            const imgObj = await safeGetImageObject(page, imgName, 3);
            
            // Skip if no image object could be retrieved
            if (!imgObj) {
              // Track skipped objects for diagnostics
              result.skippedObjects.push({
                page: pageNum,
                objectName: imgName,
                reason: "Object not resolved"
              });
              continue;
            }
            
            // Locate image position from transform operations
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
              isFullPage: false
            });
            
            if (extractedImage) {
              // Add position to the extracted image
              extractedImage.position = { x, y };
              
              // Store extracted image for later deduplication
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
      
      // STEP 2: Render full page as image if needed
      if (analysis.isScanned || (analysis.textElementCount < 10 && analysis.imageCount > 0)) {
        try {
          const pageImageId = `page_${pageNum}`;
          const pagePlaceholder = `[PAGE_IMAGE_${pageNum}]`;
          
          const fullPageImage = await extractImage({
            page,
            pageNum,
            id: pageImageId,
            isFullPage: true,
            isScanned: analysis.isScanned
          });
          
          if (fullPageImage) {
            // Add position (top of page)
            fullPageImage.position = { x: 0, y: 0 };
            
            // Store extracted image for later deduplication
            allExtractedImages.push(fullPageImage);
            
            // Set page scan reference
            pageScan = {
              id: pageImageId,
              placeholder: pagePlaceholder
            };
            
            // Store reference for this page
            pageImageRef.set(pageImageId, {
              pageNum,
              placeholder: pagePlaceholder,
              x: 0,
              y: 0,
              isFullPage: true,
              pageScan,
              pageObj
            });
            
            onLog(`Created full page image for page ${pageNum} (isScanned: ${analysis.isScanned})`);
          }
        } catch (error) {
          console.warn(`Error creating full page image for page ${pageNum}: ${error.message}`);
          // Continue without the full page image
        }
      }
      
      // Add page object to results for now (we'll build content after deduplication)
      result.pages.push(pageObj);
    }
    
    // Store original count before deduplication
    result.originalImageCount = allExtractedImages.length;
    onLog(`Found ${allExtractedImages.length} original images before deduplication`);
    
    // STEP 3: Group similar images
    onLog('Analyzing image similarity...');
    const uniqueImages = await groupSimilarImages(allExtractedImages);
    
    // Store final images in result
    result.images = uniqueImages;
    
    // Map original IDs to new combined IDs
    const idMapping = new Map();
    
    for (const image of uniqueImages) {
      if (image.originalId && image.id !== image.originalId) {
        // This is a combined image, map all component IDs to this one
        const componentIds = image.id.split('_AND_');
        componentIds.forEach(id => {
          idMapping.set(id, {
            newId: image.id,
            index: result.images.indexOf(image)
          });
        });
      } else {
        // This is a unique image
        idMapping.set(image.id, {
          newId: image.id,
          index: result.images.indexOf(image)
        });
      }
    }
    
    // STEP 4: Update all page references and create content
    // Keep track of image references that have already been added to each page
    const pageImageTracker = new Map(); // Map of pageNumber -> Set of image IDs already added
    
    for (const [originalId, refInfo] of pageImageRef.entries()) {
      const { pageNum, placeholder, x, y, isFullPage, pageScan, pageObj, imageItems } = refInfo;
      
      // Get the new ID and index for this image
      const imageInfo = idMapping.get(originalId);
      if (!imageInfo) continue;
      
      const { newId, index } = imageInfo;
      
      // Check if this image (by newId) has already been added to this page
      if (!pageImageTracker.has(pageNum)) {
        pageImageTracker.set(pageNum, new Set());
      }
      
      const pageImages = pageImageTracker.get(pageNum);
      
      // If this combined image already exists on this page, skip adding another reference
      if (pageImages.has(newId)) {
        continue;
      }
      
      // Mark this image as added to this page
      pageImages.add(newId);
      
      // Add reference to the page
      pageObj.imageReferences.push({
        id: newId, // Use new ID (might be combined)
        placeholder,
        index,
        isFullPage: !!isFullPage
      });
      
      // Update page scan if needed
      if (pageScan) {
        pageScan.id = newId;
      }
      
      // Add to image items for content organization if not a page scan
      if (!isFullPage && imageItems) {
        imageItems.push(createContentItem({
          type: 'image',
          id: newId,
          x,
          y,
          placeholder
        }));
      }
    }
    
    // STEP 5: Organize content for each page
    for (const pageObj of result.pages) {
      const pageNum = pageObj.pageNumber;
      
      // Find all image items for this page
      const imageItems = [];
      
      // Find the page scan if any
      let pageScan = null;
      
      for (const ref of pageObj.imageReferences) {
        if (ref.isFullPage) {
          // This is a page scan
          pageScan = {
            id: ref.id,
            placeholder: ref.placeholder
          };
        } else {
          // Find the image to get its position
          const image = result.images[ref.index];
          if (image && image.position) {
            imageItems.push(createContentItem({
              type: 'image',
              id: ref.id,
              x: image.position.x,
              y: image.position.y,
              placeholder: ref.placeholder
            }));
          }
        }
      }
      
      // Get the viewport and text content objects from the page number
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Organize the content
      const content = organizeContent({
        textContent,
        viewport,
        imageItems,
        pageScan: (pageObj.isScanned && pageScan) ? pageScan : null
      });
      
      // Update the page content
      pageObj.content = content;
      
      // Special case: empty page with scan - just use the image placeholder without explanatory text
      if (content.rawText === '' && pageScan) {
        pageObj.content.formattedText = pageScan.placeholder;
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
    result.processingTime = performance.now() - startTime;
    result.imageCount = result.images.length;
    
    onLog(`Processing complete. Found ${result.images.length} unique images across ${result.totalPages} pages.`);
    onProgress(1);
    
    return result;
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      pages: [],
      images: [],
      totalPages: 0,
      processingTime: 0
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

export {
  processPdfDocument,
  generateTextRepresentation
}; 