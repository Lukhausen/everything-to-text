import { useState, useEffect } from 'react';
import { processBatchImages, extractTextFromBatchResults } from '../utils/batchImageAnalysisUtils';

function BatchImageAnalyzer({ pdfData, onAnalysisComplete, onNavigateToTextReplacement }) {
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [errors, setErrors] = useState(0);
  const [rawData, setRawData] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  
  // Maximum number of concurrent requests
  const MAX_CONCURRENT_REQUESTS = 100;
  
  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);
  
  // Update total images count when pdfData changes
  useEffect(() => {
    if (pdfData && pdfData.images) {
      setTotalImages(pdfData.images.length);
    } else {
      setTotalImages(0);
    }
  }, [pdfData]);
  
  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    }
  }, [apiKey]);

  // Call onAnalysisComplete whenever results change and processing is complete
  useEffect(() => {
    if (results.length > 0 && !isProcessing && onAnalysisComplete) {
      onAnalysisComplete(results);
    }
  }, [results, isProcessing, onAnalysisComplete]);
  
  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
  };
  
  const processBatch = async () => {
    if (!apiKey) {
      alert('Please enter your OpenAI API key');
      return;
    }
    
    if (!pdfData || !pdfData.images || pdfData.images.length === 0) {
      alert('No images available. Please process a PDF first.');
      return;
    }
    
    setIsProcessing(true);
    setResults([]);
    setProcessedCount(0);
    setErrors(0);
    setRawData(null);
    setExtractedText('');
    
    try {
      // Set options for batch processing
      const options = {
        maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
        maxRefusalRetries: 3,
        temperature: 0.7,
        maxTokens: 1000
      };
      
      // Set up callbacks for status updates
      const callbacks = {
        onProgress: (status) => {
          // Use functional updates to ensure we're working with the latest state
          setProcessedCount(status.processedCount);
          setErrors(status.errorCount);
        },
        onImageProcessed: (result, updatedResults, status) => {
          // Update both results and progress tracking
          setResults(updatedResults);
          setProcessedCount(status.processedCount);
          setErrors(status.errorCount);
        },
        onError: (error, updatedResults, status) => {
          // Update results and progress tracking on errors too
          setResults(updatedResults);
          setProcessedCount(status.processedCount);
          setErrors(status.errorCount);
        },
        onComplete: (results, status, updatedPdfData) => {
          // Final updates when processing is complete
          setResults(results);
          setProcessedCount(status.processedCount);
          setErrors(status.errorCount);
          setRawData(updatedPdfData);
          
          // Generate extracted text summary
          const textData = extractTextFromBatchResults(results, pdfData);
          setExtractedText(textData.extractedText);
          
          // Call the onAnalysisComplete callback with the results
          if (onAnalysisComplete) {
            onAnalysisComplete(results);
          }
        }
      };
      
      // Call the batch processing utility
      await processBatchImages(pdfData, apiKey, options, callbacks);
    } catch (error) {
      console.error('Error processing batch:', error);
      alert(`Error processing images: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Calculate progress percentage - use a memoized value to reduce calculations
  const progressPercentage = totalImages > 0 ? (processedCount / totalImages) * 100 : 0;
  
  // Determine if we can navigate to text replacement view
  const canNavigateToText = results.length > 0 && results.some(r => r.success) && !isProcessing;
  
  const getImageByIdFromPdfData = (imageId) => {
    return pdfData.images.find(image => image.id === imageId) || {};
  };
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Batch Image Analyzer</h1>
      
      {!pdfData || !pdfData.images || pdfData.images.length === 0 ? (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px' 
        }}>
          <p style={{ margin: '0' }}>
            <strong>No PDF data available!</strong> Please process a PDF in the PDF Processor tab first.
          </p>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: '#e3f2fd', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px' 
        }}>
          <p style={{ margin: '0' }}>
            <strong>PDF loaded with {pdfData.images.length} images</strong> from {pdfData.totalPages} pages. You can analyze all images at once.
          </p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="batch-api-key" style={{ display: 'block', marginBottom: '5px' }}>
          OpenAI API Key:
        </label>
        <input
          id="batch-api-key"
          type="password"
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="Enter your OpenAI API key"
          style={{ 
            width: '100%', 
            padding: '8px', 
            borderRadius: '4px', 
            border: '1px solid #ccc' 
          }}
        />
        <p style={{ fontSize: '12px', color: '#666' }}>
          Your API key is stored in your browser's local storage.
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={processBatch}
          disabled={isProcessing || !apiKey || !pdfData || !pdfData.images || pdfData.images.length === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.7 : 1,
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {isProcessing ? 'Processing Images...' : 'Process All Images'}
        </button>
        
        {canNavigateToText && onNavigateToTextReplacement && (
          <button
            onClick={onNavigateToTextReplacement}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            View Text with Replacements
          </button>
        )}
      </div>
      
      {isProcessing && (
        <div style={{ marginTop: '20px' }}>
          <p>Processing images: {processedCount} of {totalImages} completed ({errors > 0 ? `${errors} errors` : 'no errors'})</p>
          <div style={{ 
            width: '100%', 
            height: '20px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '10px',
            overflow: 'hidden',
            marginTop: '10px'
          }}>
            <div style={{ 
              width: `${progressPercentage}%`, 
              height: '100%', 
              backgroundColor: '#4CAF50',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Processing up to {MAX_CONCURRENT_REQUESTS} images concurrently
          </p>
        </div>
      )}
      
      {results.length > 0 && (
        <div style={{ marginTop: '25px' }}>
          <h2>Analysis Results</h2>
          
          <p>
            <strong>Processed:</strong> {results.length} of {totalImages} images
            {results.filter(r => r.success && !r.refusalDetected).length < results.length && (
              <>
                <span style={{ color: '#1976d2', marginLeft: '10px' }}>
                  ({results.filter(r => r.success && !r.refusalDetected).length} successful)
                </span>
                {results.filter(r => r.refusalDetected).length > 0 && (
                  <span style={{ color: '#ff9800', marginLeft: '10px' }}>
                    ({results.filter(r => r.refusalDetected).length} refusals)
                  </span>
                )}
                {results.filter(r => !r.success).length > 0 && (
                  <span style={{ color: '#f44336', marginLeft: '10px' }}>
                    ({results.filter(r => !r.success).length} errors)
                  </span>
                )}
              </>
            )}
          </p>
          
          {extractedText && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Extracted Text by Page</h3>
              <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '15px', 
                borderRadius: '4px', 
                maxHeight: '300px', 
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}>
                {extractedText}
              </div>
            </div>
          )}
          
          <div style={{ marginBottom: '20px' }}>
            <h3>Individual Results</h3>
            {results.map((result, index) => (
              <div 
                key={result.imageId} 
                style={{ 
                  marginBottom: '20px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  padding: '15px',
                  backgroundColor: result.success ? 'white' : '#fff5f5'
                }}
              >
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ width: '150px', flexShrink: 0 }}>
                    <img 
                      src={getImageByIdFromPdfData(result.imageId)?.dataURL || ''} 
                      alt={`Image ${index+1}`} 
                      style={{ 
                        maxWidth: '100%', 
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }} 
                    />
                    <p style={{ fontSize: '12px', marginTop: '5px' }}>
                      Page: {getImageByIdFromPdfData(result.imageId)?.pageNumber || 'Unknown'}
                    </p>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    {!result.success ? (
                      <div style={{ 
                        color: '#721c24', 
                        backgroundColor: '#f8d7da', 
                        padding: '10px', 
                        borderRadius: '4px'
                      }}>
                        <strong>Error:</strong> {result.error}
                      </div>
                    ) : result.refusalDetected ? (
                      <div style={{ 
                        color: '#856404', 
                        backgroundColor: '#fff3cd', 
                        padding: '10px', 
                        borderRadius: '4px'
                      }}>
                        <strong>Content Filtered:</strong> The AI model refused to analyze this image after {result.refusalRetries} retry attempts.
                      </div>
                    ) : (
                      <>
                        <h4 style={{ marginTop: 0 }}>Analysis:</h4>
                        <pre 
                          style={{ 
                            whiteSpace: 'pre-wrap', 
                            backgroundColor: '#f5f5f5', 
                            padding: '10px', 
                            borderRadius: '4px',
                            overflow: 'auto',
                            maxHeight: '200px',
                            fontSize: '14px'
                          }}
                        >
                          {result.text}
                        </pre>
                        
                        {result.retries > 0 && (
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                            <div>Network retries: {result.retries}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Raw Data Section */}
          {rawData && (
            <div style={{ marginTop: '25px', marginBottom: '20px' }}>
              <details>
                <summary style={{ cursor: 'pointer', padding: '5px 0', fontWeight: 'bold' }}>
                  View Raw Data
                </summary>
                <div style={{ 
                  marginTop: '10px', 
                  backgroundColor: '#f5f5f5', 
                  padding: '15px', 
                  borderRadius: '4px', 
                  maxHeight: '400px', 
                  overflowY: 'auto'
                }}>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    overflow: 'auto' 
                  }}>
                    {JSON.stringify(rawData, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
          
          {/* Download results button */}
          <button
            onClick={() => {
              // Create a downloadable JSON file
              const dataStr = JSON.stringify(results, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              
              // Create a link and click it
              const a = document.createElement('a');
              a.href = url;
              a.download = 'batch_image_analysis_results.json';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              // Clean up
              URL.revokeObjectURL(url);
            }}
            style={{
              padding: '10px 15px',
              backgroundColor: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginTop: '10px'
            }}
          >
            Download Results as JSON
          </button>
        </div>
      )}
    </div>
  );
}

export default BatchImageAnalyzer; 