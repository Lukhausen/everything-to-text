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
  if (!images || images.length <= 1) {
    return images;
  }
  
  const uniqueImages = [];
  const processedIndices = new Set();
  
  for (let i = 0; i < images.length; i++) {
    if (processedIndices.has(i)) continue;
    
    const currentImage = images[i];
    const combinedIds = [currentImage.id];
    let representativeImage = { ...currentImage };
    
    // Compare with remaining images
    for (let j = i + 1; j < images.length; j++) {
      if (processedIndices.has(j)) continue;
      
      const otherImage = images[j];
      
      try {
        // Skip comparison if images are from different pages
        if (currentImage.pageNumber !== otherImage.pageNumber) {
          continue;
        }
        
        // Skip if sizes are too different
        const sizeRatio = Math.max(
          currentImage.width / otherImage.width,
          otherImage.width / currentImage.width
        );
        if (sizeRatio > 1.1) { // More than 10% size difference
          continue;
        }
        
        // Calculate similarity
        const similarity = await compareImages(
          currentImage.dataURL,
          otherImage.dataURL
        );
        
        // If similar enough, consider them duplicates
        if (similarity >= threshold) {
          combinedIds.push(otherImage.id);
          processedIndices.add(j);
        }
      } catch (error) {
        console.warn(`Error comparing images ${currentImage.id} and ${otherImage.id}:`, error);
      }
    }
    
    // Add combined ID information to the representative image
    representativeImage.originalId = representativeImage.id;
    representativeImage.id = combinedIds.join('_AND_');
    representativeImage.combinedImages = combinedIds.length;
    
    // Add to unique images list
    uniqueImages.push(representativeImage);
    processedIndices.add(i);
  }
  
  return uniqueImages;
} 