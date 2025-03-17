import React, { useState, useEffect } from 'react';

function TextReplacementViewer({ pdfData, analysisResults }) {
  const [combinedText, setCombinedText] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Process data when both pdfData and analysisResults are available
    if (pdfData && analysisResults && analysisResults.length > 0) {
      try {
        setIsLoading(true);
        processData();
      } catch (err) {
        console.error("Error processing text replacements:", err);
        setError("Failed to process text replacements: " + err.message);
        setIsLoading(false);
      }
    } else if (pdfData && (!analysisResults || analysisResults.length === 0)) {
      setIsLoading(false);
      setError("No image analysis results available. Please process images in the Batch Analyzer tab first.");
    } else if (!pdfData) {
      setIsLoading(false);
      setError("No PDF data available. Please process a PDF in the PDF Processor tab first.");
    }
  }, [pdfData, analysisResults]);

  const processData = () => {
    // Create a map of image ID to analysis result for quick lookup
    const imageAnalysisMap = new Map();
    analysisResults.forEach(result => {
      if (result.success) {
        imageAnalysisMap.set(result.imageId, result.text);
      }
    });

    // Also create a map for matching image IDs even if they're combined (with _AND_)
    const combinedImageMap = new Map();
    analysisResults.forEach(result => {
      if (result.success) {
        // For combined IDs (from deduplication), also map component IDs to the analysis
        if (result.imageId.includes('_AND_')) {
          const idParts = result.imageId.split('_AND_');
          idParts.forEach(id => {
            combinedImageMap.set(id, result.text);
          });
        }
        combinedImageMap.set(result.imageId, result.text);
      }
    });

    // Process each page
    const processedPages = pdfData.pages.map(page => {
      // Get the original formatted text with placeholders
      let pageText = page.content?.formattedText || '';
      
      // 1. Process through image references in the page
      if (page.imageReferences && page.imageReferences.length > 0) {
        page.imageReferences.forEach(ref => {
          const imageId = ref.id;
          const placeholder = ref.placeholder;
          const isFullPage = ref.isFullPage;
          
          if (!placeholder) return;
          
          // Find analysis text from either map
          const analysisText = imageAnalysisMap.get(imageId) || combinedImageMap.get(imageId);
          
          if (analysisText && pageText.includes(placeholder)) {
            // Create a replacement with appropriate header based on image type
            const headerText = isFullPage 
              ? `\n==== FULL PAGE SCAN ANALYSIS ====\n` 
              : `\n---- IMAGE ANALYSIS START ----\n`;
            
            const footerText = isFullPage 
              ? `\n==== END OF PAGE SCAN ANALYSIS ====\n` 
              : `\n---- IMAGE ANALYSIS END ----\n`;
            
            const replacement = `${headerText}${analysisText}${footerText}`;
            
            // Replace all occurrences of the placeholder
            pageText = pageText.replaceAll(placeholder, replacement);
          }
        });
      }
      
      // 2. Process imageItems if available
      const imageItems = page.imageItems || [];
      imageItems.forEach(imageItem => {
        if (!imageItem.placeholder) return;
        
        // Skip if already processed through imageReferences
        if (!pageText.includes(imageItem.placeholder)) return;
        
        // Find the analysis result for this image
        const analysisText = imageAnalysisMap.get(imageItem.id) || combinedImageMap.get(imageItem.id);
        
        // Determine if this is a full page scan
        const isFullPage = imageItem.placeholder.includes('PAGE_IMAGE_');
        
        if (analysisText) {
          // Create a replacement with appropriate header based on image type
          const headerText = isFullPage 
            ? `\n==== FULL PAGE SCAN ANALYSIS ====\n` 
            : `\n---- IMAGE ANALYSIS START ----\n`;
          
          const footerText = isFullPage 
            ? `\n==== END OF PAGE SCAN ANALYSIS ====\n` 
            : `\n---- IMAGE ANALYSIS END ----\n`;
          
          const replacement = `${headerText}${analysisText}${footerText}`;
          
          // Replace all occurrences of the placeholder
          pageText = pageText.replaceAll(imageItem.placeholder, replacement);
        }
      });
      
      // 3. Search for standard placeholder patterns from pdfUtils.js
      // For regular images: [IMAGE_{number}] 
      // For page scans: [PAGE_IMAGE_{number}]
      if (pdfData.images) {
        // Find images belonging to this page
        const pageImages = pdfData.images.filter(img => img.pageNumber === page.pageNumber);
        
        pageImages.forEach(image => {
          const imageId = image.id;
          const analysisText = imageAnalysisMap.get(imageId) || combinedImageMap.get(imageId);
          
          if (!analysisText) return;
          
          // Try to match regular image placeholder pattern
          if (image.id.startsWith('img_')) {
            // Parse the counter number from img_{page}_{counter}
            const parts = image.id.split('_');
            if (parts.length >= 3) {
              const counter = parts[2];
              const standardPattern = `[IMAGE_${counter}]`;
              
              if (pageText.includes(standardPattern)) {
                // Create a replacement for standard image
                const replacement = `\n---- IMAGE ANALYSIS START ----\n${analysisText}\n---- IMAGE ANALYSIS END ----\n`;
                
                // Replace all occurrences of the placeholder
                pageText = pageText.replaceAll(standardPattern, replacement);
              }
            }
          }
          
          // Try to match page scan placeholder pattern
          if (image.id.startsWith('page_')) {
            // Parse the page number from page_{number}
            const parts = image.id.split('_');
            if (parts.length >= 2) {
              const pageNum = parts[1];
              const scanPattern = `[PAGE_IMAGE_${pageNum}]`;
              
              if (pageText.includes(scanPattern)) {
                // Create a distinctive replacement for full page scans
                const replacement = `\n==== FULL PAGE SCAN ANALYSIS ====\n${analysisText}\n==== END OF PAGE SCAN ANALYSIS ====\n`;
                
                // Replace all occurrences of the placeholder
                pageText = pageText.replaceAll(scanPattern, replacement);
              }
            }
          }
          
          // Last attempt: try a generic pattern with the full ID
          const genericPattern = `[IMAGE: ${imageId}]`;
          if (pageText.includes(genericPattern)) {
            // Determine if this is a full page scan based on ID
            const isFullPage = imageId.startsWith('page_');
            
            // Create appropriate replacement
            const headerText = isFullPage 
              ? `\n==== FULL PAGE SCAN ANALYSIS ====\n` 
              : `\n---- IMAGE ANALYSIS START ----\n`;
            
            const footerText = isFullPage 
              ? `\n==== END OF PAGE SCAN ANALYSIS ====\n` 
              : `\n---- IMAGE ANALYSIS END ----\n`;
            
            const replacement = `${headerText}${analysisText}${footerText}`;
            
            // Replace all occurrences of the placeholder
            pageText = pageText.replaceAll(genericPattern, replacement);
          }
        });
      }
      
      return {
        pageNumber: page.pageNumber,
        text: pageText || "No text content available for this page."
      };
    });
    
    setCombinedText(processedPages);
    setIsLoading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Text with Image Replacements</h1>
      
      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px' 
        }}>
          <p style={{ margin: '0' }}><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      {isLoading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Processing text replacements...</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '15px' }}>
            {pdfData && (
              <p>
                <strong>Document:</strong> {pdfData.totalPages} pages with {pdfData.images?.length || 0} images
              </p>
            )}
            {analysisResults && (
              <p>
                <strong>Analysis:</strong> {analysisResults.filter(r => r.success).length} of {analysisResults.length} images analyzed
              </p>
            )}
          </div>
          
          {combinedText.map((page) => (
            <div 
              key={page.pageNumber} 
              style={{ 
                marginBottom: '30px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                padding: '15px'
              }}
            >
              <h3>Page {page.pageNumber}</h3>
              <pre 
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  backgroundColor: '#f9f9f9',
                  padding: '10px',
                  borderRadius: '4px',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}
              >
                {page.text}
              </pre>
            </div>
          ))}
          
          {combinedText.length === 0 && !error && !isLoading && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              <p>No text content available to display.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TextReplacementViewer; 