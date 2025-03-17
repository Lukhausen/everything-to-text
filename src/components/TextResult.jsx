import React, { useRef } from 'react';
import Button from './Button';
import '../styles/TextResult.css';

/**
 * Text result component for displaying extracted text
 * @param {Object} props
 * @param {string} props.text - Extracted text content
 * @param {string} props.fileName - Original file name for download
 */
const TextResult = ({ text = '', fileName = 'document' }) => {
  const textRef = useRef(null);
  
  // Format file name for download (remove extension)
  const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
  
  const handleCopy = () => {
    if (navigator.clipboard && text) {
      navigator.clipboard.writeText(text)
        .then(() => {
          // Flash the button or show notification
          const copyBtn = document.getElementById('copy-btn');
          if (copyBtn) {
            copyBtn.classList.add('flash-success');
            setTimeout(() => {
              copyBtn.classList.remove('flash-success');
            }, 1000);
          }
        })
        .catch((err) => {
          console.error('Could not copy text: ', err);
        });
    }
  };
  
  const handleDownload = () => {
    if (text) {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanFileName}_extracted.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="text-result">
      <div className="text-container">
        {text ? (
          <pre ref={textRef} className="text-content">{text}</pre>
        ) : (
          <div className="text-empty">No text content available</div>
        )}
      </div>
      
      <div className="text-actions">
        <Button 
          id="copy-btn"
          variant="secondary" 
          onClick={handleCopy} 
          disabled={!text}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </Button>
        
        <Button 
          variant="secondary" 
          onClick={handleDownload} 
          disabled={!text}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download
        </Button>
      </div>
    </div>
  );
};

export default TextResult; 