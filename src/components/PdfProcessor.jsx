import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { processPdfDocument } from '../utils/pdfUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function PdfProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setIsProcessing(true);
      
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        
        try {
          // Process the PDF with minimal options
          const result = await processPdfDocument(data);
          setPdfData(result);
        } catch (error) {
          console.error('Error processing PDF:', error);
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
      </div>
      
      {isProcessing && <p>Processing PDF...</p>}
      
      {pdfData && (
        <div>
          <h2>Results</h2>
          <div>
            <p><strong>Pages:</strong> {pdfData.totalPages}</p>
            <p><strong>Images:</strong> {pdfData.images?.length || 0}</p>
            <p><strong>Processing Time:</strong> {Math.round(pdfData.processingTime)}ms</p>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '400px', overflow: 'auto' }}>
            {formatContent(pdfData)}
          </pre>
          
          <details>
            <summary>Raw Data (Click to expand)</summary>
            <pre style={{ maxHeight: '200px', overflow: 'auto', fontSize: '12px' }}>
              {JSON.stringify(pdfData, (key, value) => {
                // Exclude dataURL from the output to make it readable
                if (key === 'dataURL' && typeof value === 'string') {
                  return value.substring(0, 50) + '... [truncated]';
                }
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