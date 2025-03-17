import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { processPdfDocument } from '../utils/pdfUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function PdfProcessor({ onSendToImageAnalyzer }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setIsProcessing(true);
      setPdfData(null);
      
      // Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        
        try {
          // Process the PDF
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
        <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '20px' }}>
          <p>Processing PDF...</p>
        </div>
      )}
      
      {pdfData && (
        <div>
          <h2>Results</h2>
          <div style={{ marginBottom: '15px' }}>
            <p><strong>Pages:</strong> {pdfData.totalPages}</p>
            <p><strong>Images:</strong> {pdfData.images?.length || 0}</p>
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
              {JSON.stringify(pdfData, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default PdfProcessor; 