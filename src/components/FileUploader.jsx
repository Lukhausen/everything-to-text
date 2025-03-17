import React, { useState, useRef, useEffect } from 'react';
import ProgressBar from './ProgressBar';
import '../styles/FileUploader.css';

/**
 * File uploader component with drag and drop and auto-progress
 * @param {Object} props
 * @param {Function} props.onFileSelected - Callback when file is selected
 * @param {boolean} props.isUploading - Whether upload is in progress
 * @param {number} props.uploadProgress - Upload progress (0-100)
 */
const FileUploader = ({ onFileSelected, isUploading = false, uploadProgress = 0 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const dropzoneRef = useRef(null);

  // Highlight dropzone effect on drag over the entire document
  useEffect(() => {
    const handleDocumentDragOver = (e) => {
      e.preventDefault();
      if (!isUploading && !selectedFile) {
        setIsDragging(true);
      }
    };

    const handleDocumentDragLeave = (e) => {
      e.preventDefault();
      // Only set dragging to false if we're leaving the document
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDocumentDrop = (e) => {
      // Prevent browser from opening the file
      e.preventDefault();
      setIsDragging(false);
      
      // Process the drop if it's not being handled by the dropzone itself
      if (e.target !== dropzoneRef.current && !dropzoneRef.current?.contains(e.target)) {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelection(e.dataTransfer.files[0]);
        }
      }
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('dragleave', handleDocumentDragLeave);
    document.addEventListener('drop', handleDocumentDrop);

    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('dragleave', handleDocumentDragLeave);
      document.removeEventListener('drop', handleDocumentDrop);
    };
  }, [isUploading, selectedFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isUploading && !selectedFile) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Handle dropped files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    // Validate file type
    if (!file.type.includes('pdf')) {
      alert('Please select a PDF file.');
      return;
    }
    
    setSelectedFile(file);
    if (onFileSelected) {
      onFileSelected(file);
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // If we're uploading, show the progress view
  if (isUploading) {
    return (
      <div className="file-uploader">
        <div className="upload-progress">
          <div className="selected-file">
            <div className="file-info">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <div className="file-details">
                <p className="file-name">{selectedFile?.name}</p>
                <p className="file-size">{selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</p>
              </div>
            </div>
          </div>
          <ProgressBar progress={uploadProgress} />
        </div>
      </div>
    );
  }

  // If we have a file but aren't processing, show the selected file
  if (selectedFile && !isUploading) {
    return (
      <div className="file-uploader">
        <div className="selected-file">
          <div className="file-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <div className="file-details">
              <p className="file-name">{selectedFile.name}</p>
              <p className="file-size">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button className="remove-file" onClick={handleRemoveFile}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Default view - dropzone for file selection
  return (
    <div className="file-uploader">
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf"
        style={{ display: 'none' }}
      />
      
      <div 
        ref={dropzoneRef}
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <div className="dropzone-content">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <p>Click or drop PDF here</p>
        </div>
      </div>
    </div>
  );
};

export default FileUploader; 