import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { processPdfDocument } from '../utils/pdfUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function PdfProcessor({ onSendToImageAnalyzer, onPdfProcessed, navigateToBatch }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [processingLog, setProcessingLog] = useState([]);
  
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setIsProcessing(true);
      setPdfData(null);
      setProcessingProgress({ current: 0, total: 0 });
      setProcessingLog(['Starting PDF processing...']);
      
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        
        try {
          // Process the PDF with progress callbacks
          const result = await processPdfDocument(data, {
            onProgress: (progress) => {
              // Update progress state periodically
              if (progress > 0) {
                // Only update occasionally to avoid too many re-renders
                if (Math.floor(progress * 100) % 5 === 0) {
                  setProcessingProgress(prevState => {
                    if (prevState.total > 0) {
                      return {
                        ...prevState,
                        current: Math.ceil(progress * prevState.total)
                      };
                    }
                    return prevState;
                  });
                }
              }
            },
            onLog: (message) => {
              setProcessingLog(prev => [...prev, message]);
              
              // Try to extract progress information from the log message
              if (message.includes('Processing page')) {
                const match = message.match(/Processing page (\d+)\/(\d+)/);
                if (match && match.length === 3) {
                  const current = parseInt(match[1], 10);
                  const total = parseInt(match[2], 10);
                  setProcessingProgress({ current, total });
                }
              }
            }
          });
          
          setPdfData(result);
          setProcessingProgress(result.progress || { current: 0, total: 0 });
          
          // Call the onPdfProcessed callback to share the data with BatchImageAnalyzer
          if (onPdfProcessed) {
            onPdfProcessed(result);
          }
        } catch (error) {
          console.error('Error processing PDF:', error);
          setProcessingLog(prev => [...prev, `Error: ${error.message}`]);
          alert(`Error processing PDF: ${error.message}`);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else if (selectedFile) {
      alert('Please select a valid PDF file');
    }
  };
  
  // Calculate progress percentage
  const progressPercentage = processingProgress.total > 0 
    ? (processingProgress.current / processingProgress.total) * 100 
    : 0;
  
  // Calculate remaining pages
  const remainingPages = processingProgress.total - processingProgress.current;
  
  // Function to truncate base64 data in the raw data view
  const truncateDataURLReplacer = (key, value) => {
    // Check if the value is a string and looks like a data URL
    if (typeof value === 'string' && value.startsWith('data:') && value.length > 200) {
      // Truncate to just the beginning and end with an indicator in the middle
      const prefix = value.substring(0, 100); // First 100 chars
      const suffix = value.substring(value.length - 20); // Last 20 chars
      return `${prefix}...[truncated ${(value.length / 1024).toFixed(2)}KB]...${suffix}`;
    }
    return value;
  };
  
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>PDF Processor</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept="application/pdf" 
          onChange={handleFileChange} 
          style={{ marginBottom: '10px' }}
        />
        <p style={{ fontSize: '12px', color: '#666' }}>
          Select a PDF file to process
        </p>
      </div>
      
      {isProcessing && (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #e9ecef',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>
            Processing PDF...
          </h3>
          
          {processingProgress.total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div>
                  <strong>Page Progress:</strong> {processingProgress.current} of {processingProgress.total}
                </div>
                <div>
                  {Math.round(progressPercentage)}% complete
                </div>
              </div>
              
              <div style={{ 
                width: '100%', 
                height: '24px', 
                backgroundColor: '#e9ecef', 
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '10px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ 
                  width: `${progressPercentage}%`, 
                  height: '100%', 
                  backgroundColor: progressPercentage < 30 ? '#ffc107' : progressPercentage < 70 ? '#17a2b8' : '#28a745',
                  transition: 'width 0.3s ease, background-color 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: progressPercentage > 40 ? 'white' : 'transparent',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}>
                  {progressPercentage > 40 ? `${Math.round(progressPercentage)}%` : ''}
                </div>
              </div>
              
              <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '5px' }}>
                {remainingPages > 0 ? (
                  <p style={{ margin: '0' }}>
                    <strong>{remainingPages}</strong> page{remainingPages !== 1 ? 's' : ''} remaining
                  </p>
                ) : (
                  <p style={{ margin: '0' }}>Finalizing page analysis...</p>
                )}
              </div>
            </div>
          )}
          
          <details style={{ marginTop: '15px', fontSize: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#495057' }}>
              Processing log ({processingLog.length} entries)
            </summary>
            <div style={{ 
              maxHeight: '200px', 
              overflow: 'auto', 
              backgroundColor: '#fff', 
              padding: '10px',
              borderRadius: '4px',
              marginTop: '8px',
              border: '1px solid #dee2e6',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>
              {processingLog.map((log, index) => (
                <div key={index} style={{ 
                  marginBottom: '3px', 
                  padding: '2px 0',
                  borderBottom: index < processingLog.length - 1 ? '1px solid #f0f0f0' : 'none' 
                }}>
                  {log}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      
      {pdfData && (
        <div>
          <h2>Results</h2>
          <div style={{ marginBottom: '15px' }}>
            <p><strong>Pages:</strong> {pdfData.totalPages}</p>
            <p><strong>Images:</strong> {pdfData.images?.length || 0}</p>
            
            {pdfData.originalImageCount > (pdfData.images?.length || 0) && (
              <p>
                <strong>Deduplication:</strong> {pdfData.originalImageCount - (pdfData.images?.length || 0)} duplicate images removed 
                ({Math.round(((pdfData.originalImageCount - (pdfData.images?.length || 0)) / pdfData.originalImageCount) * 100)}% reduction)
              </p>
            )}
            
            {pdfData.images && pdfData.images.length > 0 && navigateToBatch && (
              <button
                onClick={navigateToBatch}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#4a90e2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Analyze All Images in Batch
              </button>
            )}
          </div>
          
          {pdfData.images && pdfData.images.length > 0 && (
            <div>
              <h3>Images</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {pdfData.images.map((image, index) => (
                  <div key={image.id} style={{ border: '1px solid #ccc', padding: '5px', maxWidth: '150px' }}>
                    <img 
                      src={image.dataURL} 
                      alt={`Image ${index+1}`} 
                      style={{ maxWidth: '100%' }} 
                    />
                    <div style={{ fontSize: '12px' }}>
                      <p>Page: {image.pageNumber}</p>
                      {onSendToImageAnalyzer && (
                        <button 
                          onClick={() => onSendToImageAnalyzer(image.dataURL)}
                          style={{
                            backgroundColor: '#4a90e2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            width: '100%'
                          }}
                        >
                          Analyze
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <details style={{ marginTop: '20px' }}>
            <summary>Raw Data</summary>
            <pre style={{ maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
              {JSON.stringify(pdfData, truncateDataURLReplacer, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default PdfProcessor; 