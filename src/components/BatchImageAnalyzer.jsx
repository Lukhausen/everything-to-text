import { useState, useEffect } from 'react';
import { analyzeImage } from '../utils/imageAnalysisUtils';

function BatchImageAnalyzer({ pdfData, onAnalysisComplete, onNavigateToTextReplacement }) {
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [errors, setErrors] = useState(0);
  
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
    
    const images = pdfData.images;
    const resultsMap = new Map(); // Store results by image ID for ordering later
    
    // Process images concurrently with a limit on max concurrent requests
    const processImage = async (image) => {
      try {
        // Set options for image analysis
        const options = {
          maxRefusalRetries: 3,
          temperature: 0.7,
          maxTokens: 1000
        };
        
        // Call the analyzeImage function with the image data and API key
        const response = await analyzeImage(image.dataURL, apiKey, options);
        
        // Create result object with image metadata
        const result = {
          imageId: image.id,
          pageNumber: image.pageNumber,
          dataURL: image.dataURL,
          ...response
        };
        
        // Store in map by image ID
        resultsMap.set(image.id, result);
        
        // Update processed count and results
        setProcessedCount(prevCount => prevCount + 1);
        
        // Recreate results array in original image order
        const updatedResults = [];
        for (const img of images) {
          if (resultsMap.has(img.id)) {
            updatedResults.push(resultsMap.get(img.id));
          }
        }
        
        setResults(updatedResults);
        
        return result;
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error);
        
        // Create error result
        const errorResult = {
          imageId: image.id,
          pageNumber: image.pageNumber,
          dataURL: image.dataURL,
          success: false,
          error: error.message || 'An unknown error occurred'
        };
        
        // Store in map
        resultsMap.set(image.id, errorResult);
        
        // Update processed count, error count, and results
        setProcessedCount(prevCount => prevCount + 1);
        setErrors(prevCount => prevCount + 1);
        
        // Recreate results array in original image order
        const updatedResults = [];
        for (const img of images) {
          if (resultsMap.has(img.id)) {
            updatedResults.push(resultsMap.get(img.id));
          }
        }
        
        setResults(updatedResults);
        
        return errorResult;
      }
    };
    
    // Process images in batches with a maximum number of concurrent requests
    const processBatches = async () => {
      for (let i = 0; i < images.length; i += MAX_CONCURRENT_REQUESTS) {
        const batch = images.slice(i, i + MAX_CONCURRENT_REQUESTS);
        await Promise.all(batch.map(image => processImage(image)));
      }
    };
    
    try {
      await processBatches();
    } finally {
      setIsProcessing(false);
      
      // Explicitly call onAnalysisComplete with final results when processing is complete
      if (onAnalysisComplete && results.length > 0) {
        onAnalysisComplete(results);
      }
    }
  };
  
  // Calculate progress percentage
  const progressPercentage = totalImages > 0 ? (processedCount / totalImages) * 100 : 0;
  
  // Determine if we can navigate to text replacement view
  const canNavigateToText = results.length > 0 && results.some(r => r.success) && !isProcessing;
  
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
            {results.filter(r => r.success).length < results.length && (
              <span style={{ color: 'red', marginLeft: '10px' }}>
                ({results.length - results.filter(r => r.success).length} failed)
              </span>
            )}
          </p>
          
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
                    src={result.dataURL} 
                    alt={`Image ${index+1}`} 
                    style={{ 
                      maxWidth: '100%', 
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }} 
                  />
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>Page: {result.pageNumber}</p>
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
                      
                      {(result.retries > 0 || result.refusalDetected) && (
                        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                          {result.retries > 0 && (
                            <div>Network retries: {result.retries}</div>
                          )}
                          {result.refusalDetected && (
                            <div>Refusal detected: {result.refusalRetries} retries needed</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          
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