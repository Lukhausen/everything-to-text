import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { processPdfDocument } from '../utils/pdfUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function PdfProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [processingLog, setProcessingLog] = useState([]);
  
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setIsProcessing(true);
      setPdfData(null);
      setProcessingLog([`Processing ${selectedFile.name}...`]);
      
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        
        try {
          // Process the PDF with logging
          const result = await processPdfDocument(data, {
            onLog: (message) => {
              setProcessingLog(prev => [...prev, message]);
            }
          });
          setPdfData(result);
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
  
  // Format content for plain display
  const formatContent = (pdfData) => {
    if (!pdfData || !pdfData.pages) return '';
    
    return pdfData.pages.map(page => {
      const header = `--- PAGE ${page.pageNumber} ---\n\n`;
      const content = page.content.formattedText;
      return header + content + '\n\n';
    }).join('');
  };
  
  return (
    <div>
      <h1>PDF to Text</h1>
      
      <div>
        <input 
          type="file" 
          accept="application/pdf" 
          onChange={handleFileChange} 
        />
        <p style={{ fontSize: '12px', color: '#666' }}>
          Select a PDF file to process its content and extract images
        </p>
      </div>
      
      {isProcessing && (
        <div>
          <p>Processing PDF...</p>
          <ul style={{ fontSize: '12px', color: '#666', maxHeight: '200px', overflow: 'auto' }}>
            {processingLog.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </div>
      )}
      
      {pdfData && (
        <div>
          <h2>Results</h2>
          <div>
            <p><strong>Pages:</strong> {pdfData.totalPages}</p>
            <p>
              <strong>Images:</strong> {pdfData.images?.length || 0}
              {pdfData.originalImageCount > 0 && pdfData.originalImageCount > pdfData.images?.length && (
                <span style={{ color: 'green', marginLeft: '5px' }}>
                  (Deduplicated from {pdfData.originalImageCount} images, saved {Math.round((pdfData.originalImageCount - pdfData.images.length) / pdfData.originalImageCount * 100)}%)
                </span>
              )}
            </p>
            <p><strong>Processing Time:</strong> {Math.round(pdfData.processingTime)}ms</p>
            {pdfData.skippedObjects && pdfData.skippedObjects.length > 0 && (
              <p><strong>Skipped Objects:</strong> {pdfData.skippedObjects.length} (Some images couldn't be processed)</p>
            )}
            {!pdfData.success && (
              <p style={{ color: 'red' }}><strong>Error:</strong> {pdfData.error}</p>
            )}
            
            {pdfData.originalImageCount > 0 && pdfData.originalImageCount > pdfData.images?.length && (
              <div style={{ backgroundColor: '#f0fff0', padding: '10px', borderRadius: '5px', marginTop: '10px' }}>
                <p style={{ margin: '0 0 5px 0' }}><strong>Deduplication Summary:</strong></p>
                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                  <li>Original images: {pdfData.originalImageCount}</li>
                  <li>After deduplication: {pdfData.images?.length}</li>
                  <li>Identical images removed: {pdfData.originalImageCount - pdfData.images?.length}</li>
                  <li>Space saved: {Math.round((pdfData.originalImageCount - pdfData.images.length) / pdfData.originalImageCount * 100)}%</li>
                </ul>
              </div>
            )}
          </div>
          
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '400px', overflow: 'auto' }}>
            {formatContent(pdfData)}
          </pre>
          
          <details>
            <summary>Processing Log</summary>
            <ul style={{ fontSize: '12px', color: '#666', maxHeight: '200px', overflow: 'auto' }}>
              {processingLog.map((log, index) => (
                <li key={index}>{log}</li>
              ))}
            </ul>
          </details>
          
          <details>
            <summary>Raw Data (Click to expand)</summary>
            <pre style={{ maxHeight: '200px', overflow: 'auto', fontSize: '12px' }}>
              {JSON.stringify(pdfData, (key, value) => {
                // No longer truncating dataURL values as requested
                return value;
              }, 2)}
            </pre>
          </details>
          
          <div>
            <h3>Images ({pdfData.images?.length || 0})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {pdfData.images?.map((image, index) => (
                <div key={image.id} style={{ border: '1px solid #ccc', padding: '5px', maxWidth: '200px' }}>
                  <img 
                    src={image.dataURL} 
                    alt={`Image ${index+1}`} 
                    style={{ maxWidth: '100%' }} 
                  />
                  <div style={{ fontSize: '12px' }}>
                    <p>Page: {image.pageNumber}</p>
                    <p>{image.isFullPage ? 'Full page scan' : 'Embedded image'}</p>
                    {image.combinedImages && image.combinedImages > 1 && (
                      <p style={{ color: 'green', fontWeight: 'bold' }}>
                        Combined from {image.combinedImages} identical images
                      </p>
                    )}
                    <p style={{ fontSize: '10px', color: '#999', wordBreak: 'break-all' }}>
                      ID: {image.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfProcessor; 