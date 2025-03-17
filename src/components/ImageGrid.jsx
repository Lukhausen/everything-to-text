import React from 'react';
import '../styles/ImageGrid.css';

/**
 * Grid display for extracted images with processing status
 * @param {Object} props
 * @param {Array} props.images - Array of image objects
 * @param {Array} props.processedImages - Array of processed image IDs
 * @param {Array} props.refusedImages - Array of refused image IDs
 * @param {boolean} props.isProcessing - Whether images are currently being processed
 */
const ImageGrid = ({ 
  images = [], 
  processedImages = [], 
  refusedImages = [], 
  isProcessing = false 
}) => {
  if (!images || images.length === 0) {
    return (
      <div className="image-grid-empty">
        <p>No images available</p>
      </div>
    );
  }

  // Show only a subset of images if there are too many
  const displayLimit = 50;
  const displayImages = images.length > displayLimit 
    ? [...images.slice(0, displayLimit), { id: 'more', isMore: true, count: images.length - displayLimit }] 
    : images;

  return (
    <div className="image-grid-container">
      <div className="image-grid">
        {displayImages.map((image) => {
          if (image.isMore) {
            return (
              <div key="more" className="image-grid-more">
                <span>+{image.count} more</span>
              </div>
            );
          }
          
          const isProcessed = processedImages.includes(image.id);
          const isRefused = refusedImages.includes(image.id);
          
          return (
            <div 
              key={image.id} 
              className={`image-grid-item ${isProcessed ? 'processed' : ''} ${isRefused ? 'refused' : ''} ${isProcessing ? 'processing' : ''}`}
            >
              <div className="image-container">
                <img src={image.dataURL || image.url} alt={`Image ${image.id}`} loading="lazy" />
                
                {isProcessing && !isProcessed && !isRefused && (
                  <div className="image-processing-overlay">
                    <div className="image-processing-spinner"></div>
                  </div>
                )}
                
                {isProcessed && !isRefused && (
                  <div className="image-processed-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                )}
                
                {isRefused && (
                  <div className="image-refused-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageGrid; 