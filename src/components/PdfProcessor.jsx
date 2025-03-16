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
  
  return (
    <div>
      <h1>PDF to Object</h1>
      
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
          <h2>PDF Object</h2>
          <pre>
            {JSON.stringify(pdfData, (key, value) => {
              // Exclude dataURL from the output to make it readable
              if (key === 'dataURL' && typeof value === 'string') {
                return value.substring(0, 50) + '... [truncated]';
              }
              return value;
            }, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default PdfProcessor; 