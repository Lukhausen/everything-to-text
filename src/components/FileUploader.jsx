import { useState, useRef } from 'react';

function FileUploader({ onFileUpload, acceptedFileTypes = 'application/pdf', fileTypeDescription = 'PDF' }) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (file && file.type === acceptedFileTypes) {
      setFileName(file.name);
      onFileUpload(file);
    } else {
      alert(`Please select a valid ${fileTypeDescription} file.`);
    }
  };

  return (
    <div className="file-uploader">
      <div 
        className={`file-drop-area ${isDragging ? 'file-drop-area-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="drop-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <div className="drop-text">
          <p>Drag & Drop your {fileTypeDescription} file here</p>
          <p className="text-sm">or <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>click to browse</span></p>
        </div>
        <input 
          ref={fileInputRef}
          type="file" 
          accept={acceptedFileTypes} 
          onChange={handleFileChange} 
          className="file-input"
        />
      </div>
      {fileName && (
        <div className="file-info">
          <span>Selected file: </span>
          <strong>{fileName}</strong>
        </div>
      )}
    </div>
  );
}

export default FileUploader; 