import React from 'react';

function ImageGrid({ 
  images, 
  onImageClick = null, 
  showAnalysisStatus = false, 
  analysisResults = [] 
}) {
  // Find the analysis result for a given image ID if available
  const getAnalysisResult = (imageId) => {
    if (!showAnalysisStatus || !analysisResults?.length) return null;
    return analysisResults.find(result => result.imageId === imageId);
  };

  // Determine status icon and color based on analysis status
  const getStatusIndicator = (imageId) => {
    const result = getAnalysisResult(imageId);
    
    if (!result) return null;
    
    if (!result.success) {
      return { icon: '❌', color: 'var(--danger-color)', text: 'Failed' };
    }
    
    if (result.refusalDetected) {
      return { icon: '⚠️', color: 'var(--warning-color)', text: 'Refused' };
    }
    
    return { icon: '✓', color: 'var(--success-color)', text: 'Analyzed' };
  };

  if (!images || images.length === 0) {
    return <p className="text-center text-sm">No images available.</p>;
  }

  return (
    <div className="image-grid">
      {images.map((image, index) => {
        const status = showAnalysisStatus ? getStatusIndicator(image.id) : null;
        
        return (
          <div 
            key={image.id} 
            className="image-item"
            onClick={() => onImageClick && onImageClick(image)}
            style={{ cursor: onImageClick ? 'pointer' : 'default' }}
          >
            <div style={{ position: 'relative' }}>
              <img 
                src={image.dataURL} 
                alt={`Image ${index + 1}`} 
              />
              
              {status && (
                <div style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: status.color,
                  fontWeight: 'bold',
                }}>
                  {status.icon}
                </div>
              )}
            </div>
            
            <div className="image-item-info">
              <div>Page: {image.pageNumber}</div>
              {status && (
                <div style={{ color: status.color, fontWeight: 'bold', fontSize: '11px' }}>
                  {status.text}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ImageGrid; 