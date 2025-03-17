import { useState, useEffect } from 'react';
import { analyzeImage } from '../utils/imageAnalysisUtils';

function ImageAnalyzer({ initialImageData = '' }) {
  const [apiKey, setApiKey] = useState('');
  const [base64Image, setBase64Image] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  
  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);
  
  // Set initial image data when provided from PDF Processor
  useEffect(() => {
    if (initialImageData) {
      setBase64Image(initialImageData);
      setPreviewImage(initialImageData);
    }
  }, [initialImageData]);
  
  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    }
  }, [apiKey]);
  
  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
  };
  
  const handleBase64Change = (e) => {
    const value = e.target.value;
    setBase64Image(value);
    
    // Update preview if valid base64
    try {
      if (value.trim()) {
        const dataURI = value.startsWith('data:') 
          ? value 
          : `data:image/png;base64,${value}`;
        setPreviewImage(dataURI);
      } else {
        setPreviewImage('');
      }
    } catch (error) {
      setPreviewImage('');
    }
  };
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setBase64Image(base64);
      setPreviewImage(base64);
    };
    reader.readAsDataURL(file);
  };
  
  const processImage = async () => {
    if (!apiKey) {
      alert('Please enter your OpenAI API key');
      return;
    }
    
    if (!base64Image) {
      alert('Please enter or upload a base64 image');
      return;
    }
    
    setIsProcessing(true);
    setResult(null);
    
    try {
      // Set basic options for the image analysis
      const options = {
        maxRefusalRetries: 3,
        temperature: 0.7,
        maxTokens: 1000
      };
      
      // Call the analyzeImage function with the image data and API key
      const response = await analyzeImage(base64Image, apiKey, options);
      
      setResult(response);
    } catch (error) {
      console.error('Error processing image:', error);
      setResult({
        success: false,
        error: error.message || 'An unknown error occurred'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>OpenAI Image Analyzer</h1>
      
      {initialImageData && (
        <div style={{ 
          backgroundColor: '#e3f2fd', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px' 
        }}>
          <p style={{ margin: '0' }}>
            <strong>Image received from PDF Processor!</strong> You can now analyze it using the controls below.
          </p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="api-key" style={{ display: 'block', marginBottom: '5px' }}>
          OpenAI API Key:
        </label>
        <input
          id="api-key"
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
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Upload Image:
        </label>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileUpload}
          style={{ marginBottom: '10px' }}
        />
        
        <p style={{ margin: '10px 0 5px' }}>Or paste base64 image data:</p>
        <textarea
          value={base64Image}
          onChange={handleBase64Change}
          placeholder="Paste base64 image data (with or without data URI prefix)"
          style={{ 
            width: '100%', 
            padding: '8px', 
            borderRadius: '4px', 
            border: '1px solid #ccc',
            minHeight: '80px'
          }}
        />
      </div>
      
      {previewImage && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Image Preview:</p>
          <img 
            src={previewImage} 
            alt="Preview" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '300px', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }} 
          />
        </div>
      )}
      
      <button
        onClick={processImage}
        disabled={isProcessing || !apiKey || !base64Image}
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
        {isProcessing ? 'Processing...' : 'Process Image'}
      </button>
      
      {isProcessing && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px', 
          textAlign: 'center' 
        }}>
          <p style={{ margin: '0' }}>Processing image with OpenAI... This may take a moment.</p>
        </div>
      )}
      
      {result && (
        <div style={{ marginTop: '25px', border: '1px solid #ddd', borderRadius: '4px', padding: '15px' }}>
          <h2 style={{ marginTop: '0' }}>Analysis Results</h2>
          
          {!result.success && (
            <div style={{ 
              color: 'white', 
              backgroundColor: '#d9534f', 
              padding: '10px', 
              borderRadius: '4px', 
              marginBottom: '10px' 
            }}>
              <strong>Error:</strong> {result.error}
            </div>
          )}
          
          {result.success && (
            <div>
              <h3>Response from OpenAI:</h3>
              <pre 
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  backgroundColor: '#f5f5f5', 
                  padding: '15px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '300px',
                  fontSize: '14px',
                  border: '1px solid #e1e4e8'
                }}
              >
                {result.text}
              </pre>
              
              {result.retries > 0 && (
                <div style={{ 
                  backgroundColor: '#fff3cd', 
                  color: '#856404', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  marginTop: '10px', 
                  fontSize: '14px' 
                }}>
                  <strong>Note:</strong> Request succeeded after {result.retries} {result.retries === 1 ? 'retry' : 'retries'} due to network/API issues.
                </div>
              )}
              
              {result.refusalDetected && (
                <div style={{ 
                  backgroundColor: '#f8d7da', 
                  color: '#721c24', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  marginTop: '10px', 
                  fontSize: '14px' 
                }}>
                  <strong>Refusal Handling:</strong> AI initially refused to respond, but we automatically retried.
                  {result.refusalRetries > 0 && (
                    <span> Successfully handled after {result.refusalRetries} {result.refusalRetries === 1 ? 'retry' : 'retries'}.</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {result.success && (
            <div style={{ marginTop: '20px' }}>
              <details>
                <summary style={{ cursor: 'pointer', padding: '5px 0' }}>View Response Details</summary>
                <div style={{ fontSize: '14px', marginTop: '10px' }}>
                  <ul style={{ paddingLeft: '20px' }}>
                    {result.retries > 0 && (
                      <li>Network/API retries: {result.retries}</li>
                    )}
                    {result.refusalRetries > 0 && (
                      <li>Refusal handling retries: {result.refusalRetries}</li>
                    )}
                    {result.refusalDetected && (
                      <li>AI initially refused but was successfully prompted to provide an appropriate response</li>
                    )}
                  </ul>
                </div>
                <pre 
                  style={{ 
                    whiteSpace: 'pre-wrap', 
                    backgroundColor: '#f5f5f5', 
                    padding: '10px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '12px',
                    marginTop: '10px'
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageAnalyzer; 