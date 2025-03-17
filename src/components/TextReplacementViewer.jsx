import React, { useState, useEffect } from 'react';
import { createTextReplacement } from '../utils/textReplacementUtils';

function TextReplacementViewer({ pdfData, analysisResults }) {
  const [replacementData, setReplacementData] = useState(null);
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
    // Use the utility to create replacements
    const replacement = createTextReplacement(pdfData, analysisResults);

    if (!replacement.success) {
      setError(replacement.error || "Failed to process text replacements");
      setIsLoading(false);
      return;
    }

    // Store the replacement data
    setReplacementData(replacement);
    setIsLoading(false);
  };

  // Function to count successful analyses
  const countSuccessfulAnalyses = () => {
    if (!analysisResults) return 0;
    return analysisResults.filter(r => r.success && !r.refusalDetected).length;
  };

  // Function to count refusals
  const countRefusals = () => {
    if (!analysisResults) return 0;
    return analysisResults.filter(r => r.refusalDetected).length;
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
                <strong>Analysis:</strong> {countSuccessfulAnalyses()} successful, 
                {countRefusals() > 0 && <span> {countRefusals()} refusals,</span>} 
                {analysisResults.length - countSuccessfulAnalyses() - countRefusals()} failed
              </p>
            )}
          </div>
          
          {/* Page-by-page view */}
          {replacementData && replacementData.pages.map((page) => (
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
                {page.content}
              </pre>
            </div>
          ))}
          
          {/* Raw data expandable section */}
          {replacementData && (
            <div style={{ marginTop: '30px', marginBottom: '20px' }}>
              <details>
                <summary style={{ 
                  cursor: 'pointer', 
                  padding: '10px', 
                  backgroundColor: '#f0f0f0',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}>
                  View Raw Replacement Data
                </summary>
                <div style={{ 
                  marginTop: '10px', 
                  backgroundColor: '#f5f5f5', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  maxHeight: '500px', 
                  overflowY: 'auto'
                }}>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    overflow: 'auto' 
                  }}>
                    {JSON.stringify(replacementData, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
          
          {!replacementData && !error && !isLoading && (
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