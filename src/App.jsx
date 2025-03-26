import { useState, useCallback, useMemo, useEffect } from 'react'
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  Typography,
  Box,
  Tooltip,
  Snackbar,
  Alert,
  useMediaQuery,
  CircularProgress
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as ReadyIcon,
} from '@mui/icons-material'
import FileUpload from './components/FileUpload'
import ExtractGraphics from './components/ExtractGraphics'
import AnalyzeGraphics from './components/AnalyzeGraphics'
import Results from './components/Results'
import Settings from './components/Settings'
import { Route, Routes } from 'react-router-dom'

// Define the steps for our process
const steps = [
  {
    label: 'Upload PDF',
    description: 'Select a document and set your API preferences',
  },
  {
    label: 'Extract Images',
    description: 'Identifies and separates all graphics from your document',
  },
  {
    label: 'Analyze Images',
    description: 'AI processes graphics to convert visual content into text',
  },
  {
    label: 'View Results',
    description: 'Download or copy the extracted content in your preferred format',
  },
]

function App() {
  // All state declarations should be at the top
  const [activeStep, setActiveStep] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileKey, setFileKey] = useState(null)
  const [pdfResult, setPdfResult] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [touched, setTouched] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [autoProgress, setAutoProgress] = useState(
    localStorage.getItem('pdf_processor_auto_progress') === 'true'
  )
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [hasNavigatedFromUpload, setHasNavigatedFromUpload] = useState(false)
  const [lastStepSelectionTime, setLastStepSelectionTime] = useState(0)
  // Add scanAllPages state here, at the top with other state
  const [scanAllPages, setScanAllPages] = useState(() => {
    // Get the value from localStorage and convert to boolean explicitly
    const storedValue = localStorage.getItem('scanAllPages');
    // Only return true if the value is explicitly "true"
    return storedValue === "true";
  })
  
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')

  // Create theme with dark mode support and orange primary color
  const theme = createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'dark', // Force dark mode
      primary: {
        main: '#ff9800', // Material-UI orange
        light: '#ffb74d',
        dark: '#f57c00',
        contrastText: '#000',
      },
      background: {
        paper: '#1e1e1e',
      },
    },
    components: {
      MuiStepper: {
        styleOverrides: {
          root: {
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
          },
        },
      },
      // Ensure buttons have good contrast with orange
      MuiButton: {
        styleOverrides: {
          contained: {
            color: '#000', // Black text on orange background
          },
        },
      },
    },
  })

  // Initialize default settings
  useEffect(() => {
    // Set default model if not already set
    if (!localStorage.getItem('pdf_processor_model')) {
      localStorage.setItem('pdf_processor_model', 'gpt-4o-mini')
    }
    
    // Set default concurrent requests if not already set
    if (!localStorage.getItem('pdf_processor_max_requests')) {
      localStorage.setItem('pdf_processor_max_requests', '100')
    }
  }, [])

  // Check if API key exists and is validated in localStorage
  useEffect(() => {
    const checkApiKey = () => {
      const apiKey = localStorage.getItem('pdf_processor_api_key');
      const apiKeyValidated = localStorage.getItem('pdf_processor_api_key_validated') === 'true';
      setApiKeySet(!!(apiKey && apiKey.trim() !== '' && apiKeyValidated));
    };
    
    // Check initially
    checkApiKey();
    
    // Set up an interval to check periodically (in case user adds API key in another tab)
    const interval = setInterval(checkApiKey, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) {
      // If file is cleared, reset all state
      setSelectedFile(null)
      setFileKey(null)
      setPdfResult(null)
      setAnalysisResult(null)
      setProcessingStep(0)
      return
    }
    
    // Generate a unique key for this file based on name, size, and last modified date
    const newFileKey = `${file.name}-${file.size}-${file.lastModified}`;
    
    // Only reset the state if this is a different file
    if (newFileKey !== fileKey) {
      // Reset all processing-related state
      setPdfResult(null);
      setAnalysisResult(null);
      setProcessingStep(0);
      setIsProcessing(false);
      
      // Set the new file
      setSelectedFile(file);
      setFileKey(newFileKey);
      
      // Reset navigation flags
      setTouched(false);
      
      // Reset to first step if auto-progress is enabled
      if (autoProgress) {
        setActiveStep(0);
      }
    }
  }, [fileKey, autoProgress]);

  // Handle debug mode change
  const handleDebugModeChange = useCallback((value) => {
    setDebugMode(value)
  }, [])

  const handleAutoProgressChange = useCallback((value) => {
    setAutoProgress(value)
  }, [])

  // Function to start the image analysis
  const startAnalysis = useCallback((pdfData) => {
    const pdfToAnalyze = pdfData || pdfResult
    if (pdfToAnalyze && !analysisResult && !isProcessing) {
      setIsProcessing(true)
      // Analysis will begin when AnalyzeGraphics component mounts
      setProcessingStep(Math.max(processingStep, 2))
      
      // If user hasn't manually navigated, take them to the processing step
      if (!touched) {
        setActiveStep(2);
      }
    }
  }, [pdfResult, analysisResult, isProcessing, processingStep, touched]);

  // Handle PDF processing completion
  const handlePdfProcessingComplete = useCallback((result) => {
    // Debug logging to help troubleshoot "Scan All Pages" issues
    const imageCount = result?.images?.length || 0;
    const forcedScans = result?.images?.filter(img => img.isForcedScan === true)?.length || 0;
    console.log(`PDF Processing complete. Images: ${imageCount}, Forced Scans: ${forcedScans}, Scan All Pages: ${scanAllPages} (${typeof scanAllPages})`);
    
    setPdfResult(result);
    setIsProcessing(false);
    
    // Update the processing step to indicate we've completed step 1
    setProcessingStep(Math.max(processingStep, 2));
    
    // Check if there are any images to analyze
    const hasImages = result && result.images && result.images.length > 0
    
    // If there are no images, we should skip the analysis step
    if (!hasImages) {
      // Set analysis result with empty images array to indicate completion
      const emptyAnalysisResult = {
        ...result,
        imageAnalysisResults: [],
        extractedText: 'No images found in the PDF to analyze.'
      }
      setAnalysisResult(emptyAnalysisResult)
      
      // Also update the processing step to indicate we've completed analysis
      setProcessingStep(Math.max(processingStep, 3))
      
      // If auto-progress is on and we're currently in step 1 or 2,
      // move directly to the Results step
      if (autoProgress && !touched && (activeStep === 1 || activeStep === 2)) {
        setActiveStep(3) // Jump to Results step
      }
    } else if (autoProgress) {
      // Normal flow - start analysis immediately if auto progress is on
      startAnalysis(result)
    }
  }, [processingStep, autoProgress, touched, activeStep, startAnalysis, scanAllPages]);

  // Function to start the PDF processing
  const startPdfProcessing = useCallback(() => {
    if (selectedFile && !pdfResult && !isProcessing) {
      setIsProcessing(true)
      // Processing will begin when ExtractGraphics component mounts
      setProcessingStep(Math.max(processingStep, 1))
      
      // If user hasn't manually navigated, take them to the processing step
      if (!touched) {
        setActiveStep(1);
      }
    }
  }, [selectedFile, pdfResult, isProcessing, processingStep, touched]);
  
  // Handle analysis completion
  const handleAnalysisComplete = useCallback((result) => {
    setAnalysisResult(result)
    setIsProcessing(false)
    
    // Update the processing step to indicate we've completed step 2
    setProcessingStep(Math.max(processingStep, 3))
  }, [processingStep]);
  
  // Determine if processing is needed
  const needsProcessing = useMemo(() => {
    return selectedFile && !pdfResult;
  }, [selectedFile, pdfResult]);
  
  // Determine if analysis is needed
  const needsAnalysis = useMemo(() => {
    return pdfResult && !analysisResult;
  }, [pdfResult, analysisResult]);

  // Start processing when component mounts or when file is selected if auto progress is on
  useEffect(() => {
    if (autoProgress) {
      if (needsProcessing) {
        startPdfProcessing();
      } else if (needsAnalysis) {
        startAnalysis();
      }
    }
  }, [autoProgress, needsProcessing, needsAnalysis, startPdfProcessing, startAnalysis]);

  // Auto progress to next step when conditions are met
  useEffect(() => {
    // Don't auto-progress if the setting is off
    if (!autoProgress) return;
    
    // Don't auto-progress if we're already at the last step
    if (activeStep >= steps.length - 1) return;
    
    // Don't auto-progress if we're currently processing something
    if (isProcessing) return;
    
    // If the user has manually navigated (touched = true), only progress
    // if they are on the current highest step
    if (touched && activeStep < processingStep - 1) return;
    
    // Prevent auto-progression for a short period after a manual step selection
    // This gives users time to interact with the current step before moving on
    const now = Date.now();
    if (now - lastStepSelectionTime < 1500) return;
    
    // If we've completed processing a step and we're viewing that step,
    // or if user hasn't manually navigated, we can auto-progress to the next step
    const nextStep = activeStep + 1;
    
    // Check if the next step is accessible and we've processed up to it
    if (isStepAccessible(nextStep) && processingStep >= nextStep) {
      handleNext();
    }
  }, [
    autoProgress, 
    activeStep, 
    processingStep,
    isProcessing,
    touched,
    lastStepSelectionTime
  ]);
  
  // Handle step click
  const handleStepClick = (step) => {
    // Only allow clicking on steps that are accessible
    if (isStepAccessible(step)) {
      // Set touched flag to true since user manually selected a step
      setTouched(true);
      
      // Track first navigation away from upload step
      if (activeStep === 0 && step !== 0 && !hasNavigatedFromUpload) {
        setHasNavigatedFromUpload(true);
      }
      
      // Record the time of this manual selection
      setLastStepSelectionTime(Date.now());
      
      // If we're moving to step 1 and need to process, start processing
      if (step === 1 && needsProcessing) {
        startPdfProcessing();
      }
      // If we're moving to step 2 and need to analyze, start analysis
      else if (step === 2 && needsAnalysis && processingStep >= 1) {
        startAnalysis();
      }
      
      // Allow navigating to the step
      setActiveStep(step);
    } else {
      // Show notification with reason why step can't be accessed
      setSnackbarMessage(getStepTooltip(step));
      setSnackbarOpen(true);
    }
  }
  
  // Update handleBack to also set the timestamp
  const handleBack = () => {
    // Set touched flag to true since user manually navigated
    setTouched(true);
    
    // Record the time of this manual selection
    setLastStepSelectionTime(Date.now());
    
    // Always allow going back one step, regardless of processing state
    // as long as the previous step exists
    if (activeStep > 0) {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
    }
  }
  
  // Update handleNext to also set the timestamp
  const handleNext = () => {
    // Set touched flag to true since user manually navigated
    setTouched(true);
    
    // Record the time of this manual selection
    setLastStepSelectionTime(Date.now());
    
    const nextStep = activeStep + 1;
    
    // Track first navigation away from upload step
    if (activeStep === 0 && !hasNavigatedFromUpload) {
      setHasNavigatedFromUpload(true);
    }
    
    // Check if API key is set before proceeding beyond first step
    if (nextStep > 0 && !apiKeySet) {
      setSnackbarMessage("Please add a valid OpenAI API key in the Settings section. Your key will be validated automatically when entered correctly.");
      setSnackbarOpen(true);
      return;
    }
    
    // Special case for moving from Extract to Analyze
    // Only skip analyze step if there are no images AND scanAllPages is disabled
    if (activeStep === 1 && nextStep === 2 && pdfResult && 
        (!pdfResult.images || pdfResult.images.length === 0) && !scanAllPages) {
      // We have PDF result but no images and scanAllPages is not enabled - skip to Results
      if (isStepAccessible(3)) {
        setActiveStep(3); // Jump to Results
        return;
      }
    }
    
    // If moving to extraction step, start processing if needed
    if (nextStep === 1 && needsProcessing) {
      startPdfProcessing();
    } 
    // If moving to analysis step, start analysis if needed
    else if (nextStep === 2 && needsAnalysis) {
      startAnalysis();
    }
    
    if (nextStep < steps.length && isStepAccessible(nextStep)) {
      setActiveStep(nextStep);
    } else if (nextStep < steps.length) {
      // If next step is not accessible, show notification
      setSnackbarMessage(getStepTooltip(nextStep));
      setSnackbarOpen(true);
    }
  }

  const handleReset = () => {
    // First reset all processing-related states
    setActiveStep(0)
    setSelectedFile(null)
    setFileKey(null)
    setPdfResult(null)
    setAnalysisResult(null)
    setIsProcessing(false)
    setProcessingStep(0) // Reset processing step to 0
    setTouched(false) // Reset touched state
    setHasNavigatedFromUpload(false)
  }

  // Helper to find the highest step the user has reached
  const getHighestAccessibleStep = () => {
    let highestStep = 0
    
    // Start from the highest step and work backwards
    for (let i = steps.length - 1; i >= 0; i--) {
      if (isStepAccessible(i)) {
        highestStep = i
        break
      }
    }
    
    return highestStep
  }

  // Effect to automatically move to the processing step when processing changes
  // if user hasn't manually navigated
  useEffect(() => {
    if (!touched) {
      // Don't immediately switch if the user just manually selected a step
      const now = Date.now();
      if (now - lastStepSelectionTime < 1500) return;
      
      if (processingStep === 1 && activeStep !== 1) {
        setActiveStep(1);
      } else if (processingStep === 2 && activeStep !== 2) {
        setActiveStep(2);
      } else if (processingStep === 3 && activeStep !== 3) {
        setActiveStep(3);
      }
    }
  }, [processingStep, touched, activeStep, lastStepSelectionTime]);

  // Get content for current step with processing capability
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <>
            {!apiKeySet && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mb: 3,
                  '& .MuiAlert-icon': {
                    color: 'primary.main'
                  }
                }}
              >
                Please add your OpenAI API key in the Settings section below before continuing. 
                Your API key will be validated automatically when entered correctly.
              </Alert>
            )}
            <FileUpload 
              onFileSelect={handleFileSelect} 
              onDebugModeChange={handleDebugModeChange}
              onAutoProgressChange={handleAutoProgressChange}
              hasNavigatedAway={hasNavigatedFromUpload}
            />
          </>
        )
      case 1:
        // Only show extraction component if we have a file to process
        return selectedFile ? (
          <ExtractGraphics 
            pdfFile={selectedFile} 
            onComplete={handlePdfProcessingComplete}
            skipProcessing={!needsProcessing || !!pdfResult}
            existingResults={pdfResult}
            debugMode={debugMode}
            scanAllPages={scanAllPages}
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography>Please upload a PDF file first</Typography>
          </Box>
        )
      case 2:
        // Only show analysis component if we have PDF results
        return pdfResult ? (
          <AnalyzeGraphics
            pdfResult={pdfResult}
            onComplete={handleAnalysisComplete}
            skipAnalysis={!needsAnalysis || !!analysisResult}
            existingResults={analysisResult}
            debugMode={debugMode}
            scanAllPages={scanAllPages}
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography>Please complete the extraction process first</Typography>
          </Box>
        )
      case 3:
        // Only show results if we have analysis results
        return analysisResult ? (
          <Results 
            pdfResult={pdfResult}
            analysisResult={analysisResult}
            debugMode={debugMode}
          />
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography>Please complete the analysis process first</Typography>
          </Box>
        )
      default:
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography>Unknown step</Typography>
          </Box>
        )
    }
  }

  // Determine if the Next button should be disabled
  const isNextDisabled = (step) => {
    // First, check if API key is set - required for all steps except the first one
    if (step > 0 && !apiKeySet) {
      return true;
    }
    
    switch(step) {
      case 0:
        return !selectedFile // Disabled if no file selected
      case 1:
        return !pdfResult    // Disabled if PDF processing not complete
      case 2:
        return !analysisResult // Disabled if image analysis not complete
      case 3:
        return false // Final step, no next button needed
      default:
        return false
    }
  }
  
  // Determine if a step is clickable/accessible
  const isStepAccessible = (stepIndex) => {
    // First step is always accessible
    if (stepIndex === 0) return true;
    
    // API key is required for all steps beyond the first
    if (!apiKeySet) return false;
    
    // Modified logic to allow accessing previous steps regardless of processing state
    // Current step and previous steps should always be accessible if their data is available
    if (stepIndex <= activeStep) {
      if (stepIndex === 1) return !!selectedFile;
      if (stepIndex === 2) {
        // Make Analyze step accessible if we have images to analyze OR if scanAllPages is enabled
        const hasImages = pdfResult && pdfResult.images && pdfResult.images.length > 0;
        return !!pdfResult && (hasImages || scanAllPages);
      }
      if (stepIndex === 3) return !!analysisResult;
    } else {
      // For future steps, keep the original logic but with image check
      if (stepIndex === 1) return !!selectedFile;
      if (stepIndex === 2) {
        // Make Analyze step accessible if we have images to analyze OR if scanAllPages is enabled
        const hasImages = pdfResult && pdfResult.images && pdfResult.images.length > 0;
        return !!pdfResult && (hasImages || scanAllPages);
      }
      if (stepIndex === 3) return !!analysisResult;
    }
    
    return false;
  }
  
  // Get tooltip message for inaccessible steps
  const getStepTooltip = (stepIndex) => {
    if (isStepAccessible(stepIndex)) return '';
    
    // API key check takes precedence
    if (stepIndex > 0 && !apiKeySet) return 'Please add a valid OpenAI API key in the Settings section';
    
    if (stepIndex === 1) return 'Please upload a PDF file first';
    
    if (stepIndex === 2) {
      if (pdfResult && (!pdfResult.images || pdfResult.images.length === 0)) {
        if (scanAllPages) {
          // If scanAllPages is enabled, the problem must be something else
          return 'Please complete the image extraction process first';
        }
        return 'No images found in the PDF - this step is skipped';
      }
      return 'Please complete the image extraction process first';
    }
    
    if (stepIndex === 3) return 'Please complete the image analysis process first';
    
    return '';
  }
  
  // Close snackbar
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // Add handler for settings changes
  const handleSettingsChange = (setting, value) => {
    if (setting === 'scanAllPages') {
      // First, ensure we have a clean boolean
      const boolValue = value === true;
      
      // Log detailed information about the change
      console.log(`App.jsx: Updating scanAllPages setting:
        - From: ${scanAllPages} (${typeof scanAllPages})
        - To: ${boolValue} (${typeof boolValue})
        - Original value: ${value} (${typeof value})
      `);
      
      // Update state first
      setScanAllPages(boolValue);
      
      // Then update localStorage with explicit string conversion
      const valueToStore = String(boolValue);
      localStorage.setItem('scanAllPages', valueToStore);
      console.log(`Updated localStorage['scanAllPages'] to "${valueToStore}"`);
      
      // If we already have results and changing this setting, show notice
      if (pdfResult) {
        setSnackbarMessage("This setting will take effect when you process another PDF.");
        setSnackbarOpen(true);
      }
    }
    // Handle other settings if needed
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* Hidden processing layer - components here stay mounted regardless of active step */}
      <Box sx={{ display: 'none' }}>
        {/* Only mount extraction component when we need it */}
        {processingStep >= 1 && needsProcessing && !pdfResult && (
          <ExtractGraphics 
            pdfFile={selectedFile} 
            onComplete={handlePdfProcessingComplete}
            skipProcessing={false}
            debugMode={false}
            scanAllPages={scanAllPages}
          />
        )}
        
        {/* Only mount analysis component when we need it */}
        {processingStep >= 2 && needsAnalysis && !analysisResult && (
          <AnalyzeGraphics
            pdfResult={pdfResult}
            onComplete={handleAnalysisComplete}
            skipAnalysis={false}
            debugMode={false}
            scanAllPages={scanAllPages}
          />
        )}
      </Box>
      
      <Box
        sx={{
          minHeight: '100vh',
          p: { xs: 0, sm: 2 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative', // Add this to help with footer positioning
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 3 },
            width: '100%',
            maxWidth: '800px',
            mb: 2,
            borderRadius: { xs: 0, sm: 2 },
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom align="center">
            AI PDF to Text Converter
          </Typography>
          <Stepper 
            activeStep={activeStep} 
            orientation="vertical"
            sx={{
              mt: { xs: 1, sm: 3 },
              '& .MuiStepLabel-root': {
                py: { xs: 0.5, sm: 1 },
              },
            }}
          >
            {steps.map((step, index) => {
              // Determine if this step is currently processing
              const isStepProcessing = (index === 1 && needsProcessing && isProcessing) || 
                                     (index === 2 && needsAnalysis && isProcessing);
              
              // Determine if this step is ready but not yet processed
              const isStepReady = isStepAccessible(index) && 
                                !isStepProcessing && 
                                index !== activeStep && 
                                processingStep < index;
                                
              // Determine if this step is complete (but not the active step)
              const isStepComplete = processingStep > index && index !== activeStep;
              
              // Determine if this step is active and complete
              const isActiveComplete = processingStep > index && index === activeStep;
              
              // Special case for Results tab when results are available
              const isResultsAvailable = index === 3 && !!analysisResult && index !== activeStep;
              
              return (
                <Step key={step.label}>
                  <Tooltip 
                    title={getStepTooltip(index)}
                    placement="right"
                    disableHoverListener={isStepAccessible(index)}
                  >
                    <StepLabel 
                      sx={{ 
                        cursor: isStepAccessible(index) ? 'pointer' : 'default',
                        opacity: isStepAccessible(index) ? 1 : 0.7,
                        '&:hover': isStepAccessible(index) ? {
                          '.MuiStepLabel-label': {
                            color: 'primary.main',
                          },
                          '.MuiStepIcon-root': {
                            color: 'primary.main',
                          }
                        } : {},
                        transition: 'all 0.2s ease-in-out',
                      }}
                      onClick={() => handleStepClick(index)}
                      optional={
                        isStepProcessing ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <CircularProgress size={16} sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="caption" color="primary.main">Processing...</Typography>
                          </Box>
                        ) : isResultsAvailable ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" color="primary.light" sx={{ fontWeight: 'medium' }}>Results Available</Typography>
                          </Box>
                        ) : isStepReady ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <ReadyIcon sx={{ mr: 0.5, fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">Available</Typography>
                          </Box>
                        ) : isStepComplete ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            {/* Show "Skipped: No images" for analyze step when there are no images */}
                            {index === 2 && pdfResult && (!pdfResult.images || pdfResult.images.length === 0) ? (
                              <Typography variant="caption" color="text.primary" sx={{ opacity: 0.7 }}>Skipped: No images</Typography>
                            ) : (
                              <Typography variant="caption" color="text.primary" sx={{ opacity: 0.7 }}>Complete</Typography>
                            )}
                          </Box>
                        ) : isActiveComplete ? (
                          // Don't show anything for active completed steps
                          null
                        ) : null
                      }
                    >
                      <Typography variant="subtitle1">{step.label}</Typography>
                    </StepLabel>
                  </Tooltip>
                  <StepContent>
                    <Typography color="text.secondary" paragraph>
                      {step.description}
                    </Typography>
                    {getStepContent(index)}
                    <Box sx={{ mb: 2, mt: 2 }}>
                      <div>
                        {index < steps.length - 1 && (
                          <Button
                            variant="contained"
                            onClick={handleNext}
                            sx={{ mt: 1, mr: 1 }}
                            disabled={isNextDisabled(index)}
                          >
                            Continue
                          </Button>
                        )}
                        <Button
                          disabled={index === 0}
                          onClick={handleBack}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Back
                        </Button>
                        {index === steps.length - 1 && (
                          <Button
                            onClick={handleReset}
                            sx={{ mt: 1, mr: 1 }}
                          >
                            Process Another PDF
                          </Button>
                        )}
                      </div>
                    </Box>
                  </StepContent>
                </Step>
              );
            })}
          </Stepper>
          {activeStep === steps.length && (
            <Paper square elevation={0} sx={{ p: 3 }}>
              <Typography>All steps completed - your text has been extracted</Typography>
              <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
                Process Another PDF
              </Button>
            </Paper>
          )}
        </Paper>
        
        {/* Notification for inaccessible steps */}
        <Snackbar 
          open={snackbarOpen} 
          autoHideDuration={4000} 
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleSnackbarClose} 
            severity="info" 
            sx={{ 
              width: '100%',
              '& .MuiAlert-icon': {
                color: 'primary.main'
              }
            }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            width: '100%',
            maxWidth: '800px',
            mt: 'auto',
            mb: 2,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box
            component="a"
            href="https://lukhausen.de"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              transition: 'all 0.3s ease',
              '&:hover': {
                color: 'primary.main',
                transform: 'translateY(-2px)',
                '& .comment': {
                  color: 'primary.main',
                },
              },
            }}
          >
            <Typography
              variant="body2"
              className="comment"
              sx={{
                fontFamily: 'monospace',
                transition: 'color 0.3s ease',
              }}
            >
              // Made by Lukas instead of learning for his exam 📚🤓
            </Typography>
          </Box>
        </Box>

        {/* Debug info component */}
        {debugMode && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 0,
              right: 0,
              bgcolor: 'rgba(0,0,0,0.9)',
              color: 'white',
              p: 1,
              borderTopLeftRadius: 8,
              fontSize: '10px',
              fontFamily: 'monospace',
              zIndex: 9999,
              maxWidth: '400px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '12px', display: 'block', fontWeight: 'bold', color: 'primary.main' }}>
              SCAN ALL PAGES DEBUG
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              scanAllPages: {String(scanAllPages)} ({typeof scanAllPages})
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              localStorage: "{localStorage.getItem('scanAllPages')}"
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              Step: {activeStep}/{steps.length-1} | ProcessingStep: {processingStep}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              isProcessing: {String(isProcessing)}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              File: {selectedFile ? selectedFile.name : 'none'}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              Total Images: {pdfResult?.images?.length || 0} 
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
              Forced Scans: {pdfResult?.images?.filter(img => img.isForcedScan === true).length || 0}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block', mt: 1, fontWeight: 'bold' }}>
              Image IDs:
            </Typography>
            {pdfResult?.images?.map((img, index) => (
              <Typography key={index} variant="caption" sx={{ 
                fontSize: '9px', 
                display: 'block',
                color: img.isForcedScan ? 'primary.main' : 'white'
              }}>
                {index+1}. {img.id} {img.isForcedScan ? '(FORCED)' : ''}
              </Typography>
            ))}
          </Box>
        )}
      </Box>

      {/* Wrap Route in Routes component */}
      <Routes>
        <Route path="/settings" element={
          <Settings 
            onDebugModeChange={handleDebugModeChange} 
            onAutoProgressChange={handleAutoProgressChange}
            onSettingsChange={handleSettingsChange}
          />
        } />
      </Routes>
    </ThemeProvider>
  )
}

export default App 