import { useState, useEffect } from 'react';
import Stepper from './components/Stepper';
import FileUploader from './components/FileUploader';
import ImageGrid from './components/ImageGrid';
import ProgressBar from './components/ProgressBar';
import Button from './components/Button';
import TextResult from './components/TextResult';
import APIKeyInput from './components/ApiKeyInput';
import AdvancedSettings from './components/AdvancedSettings';
import { processPdfDocument } from './utils/pdfUtils';
import { processBatchImages, extractTextFromBatchResults } from './utils/batchImageAnalysisUtils';
import { createTextReplacement } from './utils/textReplacementUtils';
import './styles/global.css';
import './App.css';

// More detailed steps with sub-steps for processing
const STEPS = [
  { name: 'Upload' },
  { name: 'Extract Graphics' },
  { name: 'Analyze Graphics' },
  { name: 'Result' }
];

// Default advanced settings for image processing
const DEFAULT_ADVANCED_SETTINGS = {
  processing: {
    maxConcurrentRequests: 100,  // Process up to 100 images simultaneously
    maxRefusalRetries: 3,
    temperature: 0.7,
    model: "gpt-4o-mini",
  }
};

function App() {
  // Application state
  const [currentStep, setCurrentStep] = useState(1);
  const [maxCompletedStep, setMaxCompletedStep] = useState(1); // Track furthest step reached
  const [apiKey, setApiKey] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfData, setPdfData] = useState(null);
  const [extractedImages, setExtractedImages] = useState([]);
  const [processedImageIds, setProcessedImageIds] = useState([]);
  const [refusedImageIds, setRefusedImageIds] = useState([]);
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState(null);
  const [progressStage, setProgressStage] = useState(''); // To show which processing stage we're in
  const [currentPage, setCurrentPage] = useState(0); // Current page being processed
  const [totalPages, setTotalPages] = useState(0); // Total pages in the PDF
  const [advancedSettings, setAdvancedSettings] = useState(DEFAULT_ADVANCED_SETTINGS); // Advanced settings state
  
  // Effect to update maxCompletedStep whenever currentStep advances
  useEffect(() => {
    if (currentStep > maxCompletedStep) {
      setMaxCompletedStep(currentStep);
    }
  }, [currentStep, maxCompletedStep]);
  
  // Store API key in localStorage
  useEffect(() => {
    const storedApiKey = localStorage.getItem('openai_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
    
    // Also load saved settings if available
    const storedSettings = localStorage.getItem('advanced_settings');
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        setAdvancedSettings(parsedSettings);
      } catch (e) {
        console.error('Failed to parse stored settings:', e);
      }
    }
  }, []);
  
  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    }
  }, [apiKey]);
  
  // Save advanced settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('advanced_settings', JSON.stringify(advancedSettings));
  }, [advancedSettings]);
  
  // Handle settings changes
  const handleSettingsChange = (newSettings) => {
    setAdvancedSettings(newSettings);
  };
  
  // Handle file selection and automatically start processing
  const handleFileSelected = (file) => {
    setSelectedFile(file);
    // Reset state when a new file is selected
    setPdfData(null);
    setExtractedImages([]);
    setProcessedImageIds([]);
    setRefusedImageIds([]);
    setExtractedText('');
    setError(null);
    setCurrentPage(0);
    setTotalPages(0);
    setMaxCompletedStep(1); // Reset max completed step
    
    // If API key is already present, start processing automatically
    if (apiKey) {
      handleProcessPdf(file);
    }
  };
  
  // Reset the entire process
  const handleReset = () => {
    setCurrentStep(1);
    setMaxCompletedStep(1); // Reset max completed step
    setSelectedFile(null);
    setPdfData(null);
    setExtractedImages([]);
    setProcessedImageIds([]);
    setRefusedImageIds([]);
    setExtractedText('');
    setError(null);
    setIsProcessing(false);
    setProgress(0);
    setProgressStage('');
    setCurrentPage(0);
    setTotalPages(0);
  };
  
  // Handle API key change and start processing if file already selected
  const handleApiKeyChange = (newKey) => {
    setApiKey(newKey);
    
    // If file is already selected and this is a valid API key, start processing
    if (selectedFile && newKey && newKey.length > 10) {
      handleProcessPdf(selectedFile);
    }
  };
  
  // Process PDF to extract images
  const handleProcessPdf = async (fileToProcess) => {
    const fileToUse = fileToProcess || selectedFile;
    if (!fileToUse || !apiKey) return;
    
    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep(2); // Move to Extract Graphics step
    setProgressStage('Extracting images from PDF');
    
    try {
      // Read the file
      const fileArrayBuffer = await fileToUse.arrayBuffer();
      
      // Process PDF document
      const result = await processPdfDocument(fileArrayBuffer, {
        onProgress: (progress) => {
          setProgress(progress * 100);
        },
        onLog: (message) => {
          console.log(message);
          
          // Check for page processing messages to update the counter
          const pageMatch = message.match(/Processing page (\d+) of (\d+)/);
          if (pageMatch) {
            setCurrentPage(parseInt(pageMatch[1], 10));
            setTotalPages(parseInt(pageMatch[2], 10));
          }
        }
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process PDF');
      }
      
      // Store PDF data and extracted images
      setPdfData(result);
      setExtractedImages(result.images || []);
      
      // Update total pages if not set by log messages
      if (totalPages === 0 && result.totalPages) {
        setTotalPages(result.totalPages);
      }
      
      // Start image analysis automatically after a brief pause
      if (result.images && result.images.length > 0) {
        // Small delay to show the extracted images before starting analysis
        setTimeout(() => {
          setCurrentStep(3); // Move to Analyze Graphics step
          handleAnalyzeImages(result, result.images);
        }, 500);
      }
    } catch (err) {
      console.error('Error processing PDF:', err);
      setError(`Failed to process PDF: ${err.message}`);
      setIsProcessing(false);
    }
  };
  
  // Analyze extracted images
  const handleAnalyzeImages = async (pdfDataToUse, imagesToProcess) => {
    const pdfToUse = pdfDataToUse || pdfData;
    const imagesToUse = imagesToProcess || extractedImages;
    
    if (!pdfToUse || !imagesToUse.length || !apiKey) return;
    
    setProgressStage('Analyzing images with AI');
    setProgress(0);
    setProcessedImageIds([]);
    setRefusedImageIds([]);
    
    try {
      // Process batch images with user's advanced settings
      const result = await processBatchImages(
        { ...pdfToUse, images: imagesToUse },
        apiKey,
        advancedSettings.processing, // Use the user's settings here
        {
          onProgress: (status) => {
            setProgress(status.progressPercentage || 0);
          },
          onImageProcessed: (result) => {
            console.log('Image processed:', result);
            
            if (result.success) {
              if (result.refusalDetected) {
                setRefusedImageIds(prevIds => [...prevIds, result.imageId]);
                console.log(`Image ${result.imageId} was refused by AI`);
              } else {
                setProcessedImageIds(prevIds => [...prevIds, result.imageId]);
              }
            }
          },
          onError: (error) => {
            console.error('Image processing error:', error);
          },
          onComplete: (results) => {
            console.log('All images processed:', results);
            
            let extracted;
            if (pdfToUse.pages && pdfToUse.pages.length > 0) {
              const textReplacement = createTextReplacement(pdfToUse, results);
              console.log('Text replacement result:', textReplacement);
              
              if (textReplacement.success) {
                const combinedText = textReplacement.pages
                  .map(page => `--- PAGE ${page.pageNumber} ---\n\n${page.content}\n\n`)
                  .join('');
                
                setExtractedText(combinedText);
              } else {
                extracted = extractTextFromBatchResults(results, pdfToUse);
                setExtractedText(extracted.extractedText || '');
              }
            } else {
              extracted = extractTextFromBatchResults(results, pdfToUse);
              setExtractedText(extracted.extractedText || '');
            }
            
            setCurrentStep(4); // Move to Result step (now step 4)
            setIsProcessing(false);
          }
        }
      );
      
      console.log('Processing complete with result:', result);
    } catch (err) {
      console.error('Error analyzing images:', err);
      setError(`Failed to analyze images: ${err.message}`);
      setIsProcessing(false);
    }
  };
  
  // Handle cancel operation
  const handleCancel = () => {
    setIsProcessing(false);
    setProgress(0);
    setProgressStage('');
    
    // Go back to the upload step
    setCurrentStep(1);
  };
  
  // Handle step click for navigation
  const handleStepClick = (step) => {
    // If processing is in progress, don't allow navigation
    if (isProcessing) {
      return;
    }
    
    // Don't re-set the current step if we're already on it
    if (step === currentStep) {
      return;
    }

    // Handle setting appropriate UI state based on step
    if (step === 1) {
      // Going to Upload step
      setProgressStage('');
      setProgress(0);
    } else if (step === 2 && extractedImages.length > 0) {
      // Going to Extract Graphics (showing completed extraction)
      setProgressStage('Extraction complete');
      setProgress(100);
    } else if (step === 3) {
      // Going to Analyze Graphics
      if (processedImageIds.length > 0 || refusedImageIds.length > 0) {
        // If analysis was completed, show that
        setProgressStage('Analysis complete');
        setProgress(100);
      } else if (extractedImages.length > 0) {
        // If just extraction was completed
        setProgressStage('Ready to analyze images');
        setProgress(0);
      }
    } else if (step === 4 && extractedText) {
      // Going to Result (already have results)
      setProgressStage('');
      setProgress(100);
    }
    
    // Update current step
    setCurrentStep(step);
  };
  
  // Render step content based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Upload
  return (
          <>
            <FileUploader 
              onFileSelected={handleFileSelected} 
              isUploading={isProcessing}
              uploadProgress={progress}
            />
            
            {!isProcessing && (
              <>
                <APIKeyInput value={apiKey} onChange={handleApiKeyChange} />
                <AdvancedSettings
                  settings={advancedSettings}
                  onSettingsChange={handleSettingsChange}
                />
              </>
            )}
            
            {selectedFile && !apiKey && (
              <div className="step-actions">
                <Button 
                  variant="primary" 
                  onClick={() => handleProcessPdf()}
                  disabled={!selectedFile || !apiKey || isProcessing}
                  isLoading={isProcessing}
                  fullWidth
                >
                  {isProcessing ? 'Processing...' : 'Process PDF'}
                </Button>
              </div>
            )}
          </>
        );
        
      case 2: // Extract Graphics
        return (
          <>
            <div className="step-info">
              <p>{progressStage}</p>
              {totalPages > 0 && (
                <p className="page-counter">
                  {currentPage > 0 ? `Page ${currentPage}/${totalPages}` : totalPages > 1 ? `${totalPages} pages` : '1 page'}
                </p>
              )}
              <ProgressBar progress={progress} />
            </div>
            
            {extractedImages.length > 0 && (
              <ImageGrid 
                images={extractedImages} 
                processedImages={[]}
                refusedImages={[]}
                isProcessing={isProcessing}
              />
            )}
            
            <div className="step-actions">
              {isProcessing ? (
                <Button 
                  variant="danger" 
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              ) : (
                <>
                  <Button 
                    variant="secondary" 
                    onClick={() => handleStepClick(1)}
                  >
                    Back
                  </Button>
                  {maxCompletedStep >= 3 && (
                    <Button 
                      variant="primary" 
                      onClick={() => handleStepClick(3)}
                    >
                      Continue
                    </Button>
                  )}
                </>
              )}
        </div>
          </>
        );
        
      case 3: // Analyze Graphics
        return (
          <>
            <div className="step-info">
              <p>{progressStage}</p>
              <ProgressBar 
                progress={progress} 
                label={processedImageIds.length > 0 || refusedImageIds.length > 0 
                  ? `${processedImageIds.length + refusedImageIds.length} of ${extractedImages.length} images processed (${refusedImageIds.length} refused)` 
                  : undefined} 
              />
      </div>
      
            {extractedImages.length > 0 && (
              <ImageGrid 
                images={extractedImages} 
                processedImages={processedImageIds}
                refusedImages={refusedImageIds}
                isProcessing={isProcessing}
              />
            )}
            
            <div className="step-actions">
              {isProcessing ? (
                <Button 
                  variant="danger" 
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              ) : (
                <>
                  <Button 
                    variant="secondary" 
                    onClick={() => handleStepClick(2)}
                  >
                    Back
                  </Button>
                  {maxCompletedStep >= 4 && (
                    <Button 
                      variant="primary" 
                      onClick={() => handleStepClick(4)}
                    >
                      Continue
                    </Button>
                  )}
                  {maxCompletedStep < 4 && extractedImages.length > 0 && processedImageIds.length === 0 && refusedImageIds.length === 0 && (
                    <Button 
                      variant="primary" 
                      onClick={() => handleAnalyzeImages()}
                    >
                      Start Analysis
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        );
        
      case 4: // Result (now step 4)
        return (
          <>
            <TextResult 
              text={extractedText} 
              fileName={selectedFile?.name || 'document'}
            />
            
            <div className="step-actions">
              <Button 
                variant="secondary" 
                onClick={() => handleStepClick(3)}
              >
                Back
              </Button>
              <Button 
                variant="primary" 
                onClick={handleReset}
              >
                Process New File
              </Button>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Everything to Text</h1>
        <p>Extract and analyze text from any PDF</p>
      </header>
      
      <main className="content-card">
        <Stepper 
          currentStep={currentStep} 
          steps={STEPS} 
          onStepClick={handleStepClick}
          isProcessing={isProcessing}
          maxCompletedStep={maxCompletedStep}
        />
        
        {error && (
          <div className="error-message">
            {error}
            <button 
              className="clear-error" 
              onClick={() => setError(null)}
              aria-label="Clear error"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="step-content">
          {renderStepContent()}
        </div>
      </main>
      
      <footer className="app-footer">
        <p>Powered by OpenAI • All processing happens in your browser</p>
      </footer>
    </div>
  );
}

export default App;