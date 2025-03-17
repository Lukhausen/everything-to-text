import React from 'react';

function TextOutput({ textData, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="card text-center">
        <p>Generating text output...</p>
        <div className="progress-bar" style={{ margin: '16px auto', maxWidth: '300px' }}>
          <div 
            className="progress-bar-fill"
            style={{ width: '100%', animation: 'pulse 1.5s infinite' }}
          ></div>
        </div>
      </div>
    );
  }
  
  if (!textData || !textData.pages || textData.pages.length === 0) {
    return (
      <div className="card text-center">
        <p>No text content available yet. Process a PDF to extract text.</p>
      </div>
    );
  }
  
  return (
    <div className="text-output">
      <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Extracted Text with Image Analysis</h3>
        
        <div className="text-sm">
          <span className="text-success" style={{ marginRight: '12px' }}>
            ✓ {textData.successCount || 0} analyzed
          </span>
          {textData.refusalCount > 0 && (
            <span className="text-warning" style={{ marginRight: '12px' }}>
              ⚠️ {textData.refusalCount} refused
            </span>
          )}
          {textData.errorCount > 0 && (
            <span className="text-danger">
              ❌ {textData.errorCount} failed
            </span>
          )}
        </div>
      </div>
      
      {textData.pages.map((page) => (
        <div key={page.pageNumber} className="pdf-page">
          <div className="pdf-page-header">
            Page {page.pageNumber}
          </div>
          <pre className="pdf-content">
            {page.content}
          </pre>
        </div>
      ))}
      
      <div className="text-center mt-4">
        <button 
          className="btn btn-primary"
          onClick={() => {
            // Create downloadable text file
            const textContent = textData.pages.map(page => 
              `--- PAGE ${page.pageNumber} ---\n\n${page.content}\n\n`
            ).join('');
            
            const blob = new Blob([textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'extracted_text.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          Download as Text File
        </button>
      </div>
    </div>
  );
}

export default TextOutput; 