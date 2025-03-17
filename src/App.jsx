import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import FileUploader from './components/FileUploader';
import ApiKeyInput from './components/ApiKeyInput';
import ProcessingProgress from './components/ProcessingProgress';
import ImageGrid from './components/ImageGrid';
import TextOutput from './components/TextOutput';
import { processPdfDocument } from './utils/pdfUtils';
import { processBatchImages } from './utils/batchImageAnalysisUtils';
import { createTextReplacement } from './utils/textReplacementUtils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function App() {
  // State management
  const [apiKey, setApiKey] = useState('');
  const [currentStep, setCurrentStep] = useState('upload'); // 'upload', 'processing', 'processing-analysis', 'analysis', 'results'
  const [pdfData, setPdfData] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState({ processedCount: 0, totalImages: 0, errorCount: 0 });
  const [textReplacementData, setTextReplacementData] = useState(null);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  
  // Handler for API key changes
  const handleApiKeyChange = (key) => {
    setApiKey(key);
    
    // If we're in the analysis step waiting for an API key, and now we have one,
    // automatically start processing
    if (currentStep === 'analysis' && key && pdfData?.images?.length > 0) {
      processBatchImagesHandler(pdfData);
    }
  };
  
  // Handler for file upload
  const handleFileUpload = useCallback(async (file) => {
    setCurrentStep('processing');
    setPdfData(null);
    setProcessingProgress({ current: 0, total: 0 });
    setLogs(['Starting PDF processing...']);
    setAnalysisResults([]);
    setTextReplacementData(null);
    
    try {
      // Read file as ArrayBuffer
      const data = await file.arrayBuffer();
      
      // Process the PDF
      const result = await processPdfDocument(new Uint8Array(data), {
        onProgress: (progress) => {
          if (progress > 0 && Math.floor(progress * 100) % 5 === 0) {
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
        },
        onLog: (message) => {
          setLogs(prev => [...prev, message]);
          
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
      
      // If PDF has images
      if (result.images?.length > 0) {
        if (apiKey) {
          // If we have an API key, start analyzing immediately
          setCurrentStep('processing-analysis');
          processBatchImagesHandler(result);
        } else {
          // No API key, move to analysis step to prompt for it
          setCurrentStep('analysis');
        }
      } else {
        // No images to analyze, skip to results
        setCurrentStep('results');
        generateTextReplacement(result, []);
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      setLogs(prev => [...prev, `Error: ${error.message}`]);
      alert(`Error processing PDF: ${error.message}`);
      setCurrentStep('upload');
    }
  }, [apiKey]);
  
  // Handler for batch image processing
  const processBatchImagesHandler = useCallback(async (pdfDataToProcess = null) => {
    const dataToUse = pdfDataToProcess || pdfData;
    
    if (!dataToUse || !dataToUse.images || dataToUse.images.length === 0) {
      alert('No images available to analyze.');
      return;
    }
    
    if (!apiKey) {
      alert('Please enter your OpenAI API key.');
      return;
    }
    
    try {
      // Set to processing-analysis step if not already there
      if (currentStep !== 'processing-analysis') {
        setCurrentStep('processing-analysis');
      }
      
      setAnalysisProgress({
        processedCount: 0,
        totalImages: dataToUse.images.length,
        errorCount: 0
      });
      setAnalysisResults([]);
      
      // Process batch images
      await processBatchImages(dataToUse, apiKey, {
        maxConcurrentRequests: 100,
        maxRefusalRetries: 3,
        temperature: 0.7,
        maxTokens: 1000
      }, {
        onProgress: (status) => {
          setAnalysisProgress(status);
        },
        onImageProcessed: (result, updatedResults) => {
          setAnalysisResults(updatedResults);
        },
        onComplete: (results, status) => {
          setAnalysisResults(results);
          setAnalysisProgress(status);
          
          // Move to results step
          setCurrentStep('results');
          
          // Generate text replacement
          generateTextReplacement(dataToUse, results);
        }
      });
    } catch (error) {
      console.error('Error analyzing images:', error);
      alert(`Error analyzing images: ${error.message}`);
      // If error occurs, go back to analysis step to allow retry
      setCurrentStep('analysis');
    }
  }, [apiKey, pdfData, currentStep]);
  
  // Handler for generating text replacement
  const generateTextReplacement = useCallback(async (pdfDataToUse, resultsToUse) => {
    setIsGeneratingText(true);
    
    try {
      // Generate text replacement
      const replacementData = createTextReplacement(pdfDataToUse, resultsToUse);
      
      // Count successful, refused and error analysis
      const successCount = resultsToUse.filter(r => r.success && !r.refusalDetected).length;
      const refusalCount = resultsToUse.filter(r => r.refusalDetected).length;
      const errorCount = resultsToUse.filter(r => !r.success).length;
      
      // Add counts to the data
      setTextReplacementData({
        ...replacementData,
        successCount,
        refusalCount,
        errorCount
      });
    } catch (error) {
      console.error('Error generating text replacement:', error);
      alert(`Error generating text replacement: ${error.message}`);
    } finally {
      setIsGeneratingText(false);
    }
  }, []);
  
  // Restart the entire process
  const handleRestart = () => {
    setCurrentStep('upload');
    setPdfData(null);
    setProcessingProgress({ current: 0, total: 0 });
    setLogs([]);
    setAnalysisResults([]);
    setAnalysisProgress({ processedCount: 0, totalImages: 0, errorCount: 0 });
    setTextReplacementData(null);
  };
  
  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1 className="app-title">Everything to Text</h1>
          <p className="app-subtitle">Convert PDFs to text with AI-powered image analysis</p>
        </div>
      </header>
      
      <main className="container">
        {/* API Key Input - Always visible but collapsible */}
        <ApiKeyInput onApiKeyChange={handleApiKeyChange} />
        
        {/* Step 1: Upload PDF */}
        {currentStep === 'upload' && (
          <div className="card">
            <h2>Upload PDF Document</h2>
            <p className="text-sm" style={{ marginBottom: '16px' }}>
              Upload a PDF to extract both text and images. All processing happens in your browser - nothing is sent to a server.
            </p>
            
            <FileUploader onFileUpload={handleFileUpload} />
          </div>
        )}
        
        {/* Step 2: Processing PDF */}
        {currentStep === 'processing' && (
          <div className="card">
            <h2>Processing PDF</h2>
            <p className="text-sm" style={{ marginBottom: '16px' }}>
              Extracting text and images from your PDF...
            </p>
            
            <ProcessingProgress 
              current={processingProgress.current} 
              total={processingProgress.total}
              status="Processing PDF"
              logs={logs}
            />
          </div>
        )}
        
        {/* Step 2.5: Processing Analysis */}
        {currentStep === 'processing-analysis' && (
          <div className="card">
            <h2>Analyzing Images</h2>
            <p className="text-sm" style={{ marginBottom: '16px' }}>
              AI is analyzing {pdfData?.images?.length} images from your PDF...
            </p>
            
            <ProcessingProgress 
              current={analysisProgress.processedCount} 
              total={analysisProgress.totalImages}
              status="Analyzing Images"
            />
            
            <ImageGrid 
              images={pdfData?.images || []} 
              showAnalysisStatus={analysisResults.length > 0}
              analysisResults={analysisResults}
            />
          </div>
        )}
        
        {/* Step 3: Image Analysis (only shown when API key is missing) */}
        {currentStep === 'analysis' && (
          <div className="card">
            <h2>Image Analysis</h2>
            
            <div className="alert alert-warning">
              <strong>API Key Required</strong>
              <p>Please enter your OpenAI API key above to analyze the images.</p>
            </div>
            
            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <p className="text-sm">
                {pdfData?.images?.length} images extracted from {pdfData?.totalPages} pages
                {pdfData?.originalImageCount > pdfData?.images?.length && (
                  <span> ({pdfData.originalImageCount - pdfData.images.length} duplicates removed)</span>
                )}
              </p>
              
              <button 
                className="btn btn-primary"
                onClick={() => processBatchImagesHandler()}
                disabled={!apiKey || analysisProgress.processedCount > 0}
              >
                Analyze All Images
              </button>
            </div>
            
            <ImageGrid 
              images={pdfData?.images || []} 
              showAnalysisStatus={analysisResults.length > 0}
              analysisResults={analysisResults}
            />
          </div>
        )}
        
        {/* Step 4: Results */}
        {currentStep === 'results' && (
          <>
            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <h2>Results</h2>
              <button 
                className="btn btn-secondary"
                onClick={handleRestart}
              >
                Process Another PDF
              </button>
            </div>
            
            <TextOutput 
              textData={textReplacementData} 
              isLoading={isGeneratingText}
            />
            
            {pdfData?.images?.length > 0 && (
              <div className="card">
                <h3>Images from PDF</h3>
                <ImageGrid 
                  images={pdfData.images} 
                  showAnalysisStatus={analysisResults.length > 0}
                  analysisResults={analysisResults}
                />
                
                {analysisResults.length > 0 && (
                  <div className="text-center mt-4">
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        // Download JSON results
                        const dataStr = JSON.stringify(analysisResults, null, 2);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'image_analysis_results.json';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download Analysis Results (JSON)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      
      <footer style={{ textAlign: 'center', padding: '20px 0', marginTop: '32px', borderTop: '1px solid var(--border-color)', fontSize: '14px', color: '#666' }}>
        <div className="container">
          <p>Everything to Text - PDF to Text Conversion with AI-Powered Image Analysis</p>
          <p className="text-xs" style={{ marginTop: '4px' }}>All processing happens in your browser. Your files are never uploaded to a server.</p>
        </div>
      </footer>
    </div>
  );
}

export default App; 