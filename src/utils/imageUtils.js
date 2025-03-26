/**
 * Utility functions for image processing and comparison
 */

/**
 * Compares two images and returns a similarity score (0-1)
 * where 1 means the images are identical
 * 
 * @param {string} dataURL1 - First image dataURL
 * @param {string} dataURL2 - Second image dataURL
 * @returns {Promise<number>} Similarity score (0-1)
 */
export async function compareImages(dataURL1, dataURL2) {
  return new Promise((resolve, reject) => {
    // Quick check for identical dataURLs
    if (dataURL1 === dataURL2) {
      return resolve(1);
    }
    
    // Load both images
    const img1 = new Image();
    const img2 = new Image();
    let imagesLoaded = 0;
    
    // Set up canvases for comparison
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    
    function processImages() {
      // If both images are not loaded yet, wait
      if (imagesLoaded < 2) return;
      
      // Check if dimensions are the same
      if (img1.width !== img2.width || img1.height !== img2.height) {
        return resolve(0); // Different dimensions = different images
      }
      
      // Set canvas dimensions
      canvas1.width = canvas2.width = img1.width;
      canvas1.height = canvas2.height = img1.height;
      
      // Draw images on canvas
      ctx1.drawImage(img1, 0, 0);
      ctx2.drawImage(img2, 0, 0);
      
      // Get image data for pixel comparison
      let imageData1, imageData2;
      try {
        imageData1 = ctx1.getImageData(0, 0, img1.width, img1.height);
        imageData2 = ctx2.getImageData(0, 0, img2.width, img2.height);
      } catch (e) {
        console.error('Error getting image data:', e);
        return resolve(0);
      }
      
      // Count identical pixels
      const data1 = imageData1.data;
      const data2 = imageData2.data;
      const totalPixels = data1.length / 4; // RGBA (4 values per pixel)
      
      // To speed up comparison, use a sampling approach for larger images
      const pixelStep = totalPixels > 100000 ? 4 : 1; // Sample every 4th pixel for large images
      
      let identicalPixels = 0;
      let sampledPixels = 0;
      
      for (let i = 0; i < data1.length; i += 4 * pixelStep) {
        sampledPixels++;
        
        // Compare RGBA values
        if (
          Math.abs(data1[i] - data2[i]) <= 3 && // R (allow slight differences due to compression)
          Math.abs(data1[i + 1] - data2[i + 1]) <= 3 && // G
          Math.abs(data1[i + 2] - data2[i + 2]) <= 3 && // B
          Math.abs(data1[i + 3] - data2[i + 3]) <= 3 // A
        ) {
          identicalPixels++;
        }
      }
      
      // Calculate similarity score
      const similarity = identicalPixels / sampledPixels;
      resolve(similarity);
    }
    
    // Event handlers for image loading
    img1.onload = () => {
      imagesLoaded++;
      processImages();
    };
    
    img2.onload = () => {
      imagesLoaded++;
      processImages();
    };
    
    img1.onerror = () => reject(new Error('Failed to load first image'));
    img2.onerror = () => reject(new Error('Failed to load second image'));
    
    // Start loading the images
    img1.src = dataURL1;
    img2.src = dataURL2;
  });
}

/**
 * Group similar images together based on similarity threshold
 * 
 * @param {Array} images - Array of image objects with dataURLs
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Promise<Array>} Array of unique images with combined IDs
 */
export async function groupSimilarImages(images, threshold = 0.99) {
  // Skip processing if no images or only one image
  if (!images || images.length <= 1) {
    return images;
  }
  
  try {
    // First, separate forced scans from regular images with explicit type checks
    // We NEVER want to group forced scans with other images or with each other
    const forcedScans = images.filter(img => {
      // Check all possible indicators that this is a forced scan
      return img.isForcedScan === true || 
             img.scanReason === 'forced_by_toggle' ||
             (img.isFullPage === true && img.hasValidContent === true);
    });
    
    // All regular images are those that are NOT forced scans
    const regularImages = images.filter(img => {
      // Exclude any image that might be a forced scan
      return img.isForcedScan !== true && 
             img.scanReason !== 'forced_by_toggle' &&
             !(img.isFullPage === true && img.hasValidContent === true);
    });
    
    // Log the breakdown for debugging with detailed information
    console.log(`Image grouping breakdown:
      - Total images: ${images.length}
      - Forced scans: ${forcedScans.length}
      - Regular images: ${regularImages.length}
      - Forced scan IDs: ${forcedScans.map(img => img.id).join(', ')}
    `);
    
    // Only perform similarity grouping on regular images
    const uniqueGroups = [];
    const processedIds = new Set();
    
    // Group similar regular images
    for (let i = 0; i < regularImages.length; i++) {
      const img1 = regularImages[i];
      
      // Skip if already processed
      if (processedIds.has(img1.id)) continue;
      
      const group = [img1];
      processedIds.add(img1.id);
      
      for (let j = i + 1; j < regularImages.length; j++) {
        const img2 = regularImages[j];
        
        // Skip if already processed
        if (processedIds.has(img2.id)) continue;
        
        // Skip comparison if images are from different pages
        if (img1.pageNumber !== img2.pageNumber) {
          continue;
        }
        
        try {
          // Compare images
          const similarity = await compareImages(img1.dataURL, img2.dataURL);
          
          if (similarity >= threshold) {
            group.push(img2);
            processedIds.add(img2.id);
          }
        } catch (e) {
          console.warn(`Error comparing images ${img1.id} and ${img2.id}: ${e.message}`);
          // Continue with other comparisons
        }
      }
      
      uniqueGroups.push(group);
    }
    
    // Create final results for regular images
    const regularResult = [];
    
    for (const group of uniqueGroups) {
      if (group.length === 1) {
        // Single image, just add it
        regularResult.push(group[0]);
      } else {
        // Multiple similar images, create combined entry
        const baseImage = group[0];
        const combinedId = group.map(img => img.id).join('_AND_');
        
        regularResult.push({
          ...baseImage,
          id: combinedId,
          originalId: baseImage.id,
          similarCount: group.length,
          components: group.map(img => ({
            id: img.id,
            pageNumber: img.pageNumber
          }))
        });
      }
    }
    
    // Combine results: first all forced scans, then regular images
    // This ensures forced scans have priority in the UI display
    const result = [...forcedScans, ...regularResult];
    
    console.log(`Image grouping complete: ${regularImages.length} regular images grouped into ${uniqueGroups.length} groups, ${forcedScans.length} forced scans kept separate. Total: ${result.length} images.`);
    
    return result;
  } catch (error) {
    console.error('Error grouping similar images:', error);
    // Fallback to original images
    return images;
  }
} 