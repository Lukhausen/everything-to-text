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
  useMediaQuery
} from '@mui/material'
import FileUpload from './components/FileUpload'
import ExtractGraphics from './components/ExtractGraphics'
import AnalyzeGraphics from './components/AnalyzeGraphics'
import Results from './components/Results'

// Define the steps for our process
const steps = [
  {
    label: 'Select File',
    description: 'Upload a PDF file and configure settings',
  },
  {
    label: 'Extract Graphics',
    description: 'Extracting and processing graphics from your PDF',
  },
  {
    label: 'Analyze Graphics',
    description: 'Analyzing extracted graphics with AI',
  },
  {
    label: 'Results',
    description: 'View the analysis results',
  },
]

function App() {
  const [activeStep, setActiveStep] = useState(0)
  
  // File state
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileKey, setFileKey] = useState(null) // Unique identifier for the current file
  
  // Processing state and results
  const [pdfResult, setPdfResult] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Debug mode
  const [debugMode, setDebugMode] = useState(false)
  
  // Notification state
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  
  // API key checking
  const [apiKeySet, setApiKeySet] = useState(false)
  
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
        default: '#121212',
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
      return
    }
    
    // Generate a unique key for this file based on name, size, and last modified date
    const newFileKey = `${file.name}-${file.size}-${file.lastModified}`;
    
    // Only reset the pdfResult if this is a different file
    if (newFileKey !== fileKey) {
      setPdfResult(null);
      setSelectedFile(file);
      setFileKey(newFileKey);
    }
  }, [fileKey]);

  // Handle debug mode change
  const handleDebugModeChange = useCallback((isDebugMode) => {
    setDebugMode(isDebugMode);
  }, []);

  // Handle PDF processing completion
  const handlePdfProcessingComplete = useCallback((result) => {
    setPdfResult(result)
    setIsProcessing(false)
  }, []);
  
  // Handle analysis completion
  const handleAnalysisComplete = useCallback((result) => {
    setAnalysisResult(result)
    setIsProcessing(false)
  }, []);
  
  // Determine if processing is needed
  const needsProcessing = useMemo(() => {
    return selectedFile && !pdfResult && activeStep === 1;
  }, [selectedFile, pdfResult, activeStep]);
  
  // Determine if analysis is needed
  const needsAnalysis = useMemo(() => {
    return pdfResult && !analysisResult && activeStep === 2;
  }, [pdfResult, analysisResult, activeStep]);

  const handleNext = () => {
    const nextStep = activeStep + 1;
    
    // Check if API key is set before proceeding beyond first step
    if (nextStep > 0 && !apiKeySet) {
      setSnackbarMessage("Please add a valid API key in the Settings section. Your key will be validated automatically when entered correctly.");
      setSnackbarOpen(true);
      return;
    }
    
    if (nextStep < steps.length && isStepAccessible(nextStep)) {
      setActiveStep(nextStep);
    } else if (nextStep < steps.length) {
      // If next step is not accessible, show notification
      setSnackbarMessage(getStepTooltip(nextStep));
      setSnackbarOpen(true);
    }
  }

  const handleBack = () => {
    // Always allow going back one step
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  }

  const handleReset = () => {
    setActiveStep(0)
    setSelectedFile(null)
    setFileKey(null)
    setPdfResult(null)
    setAnalysisResult(null)
    setIsProcessing(false)
  }

  // Get content for current step
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
                Please add a valid API key in the Settings section below before continuing. 
                Your API key will be validated automatically when entered correctly.
              </Alert>
            )}
            <FileUpload 
              onFileSelect={handleFileSelect} 
              onDebugModeChange={handleDebugModeChange}
            />
          </>
        )
      case 1:
        return <ExtractGraphics 
                 pdfFile={selectedFile} 
                 onComplete={handlePdfProcessingComplete}
                 skipProcessing={!needsProcessing && pdfResult}
                 existingResults={pdfResult}
                 debugMode={debugMode}
               />
      case 2:
        return <AnalyzeGraphics
                 pdfResult={pdfResult}
                 onComplete={handleAnalysisComplete}
                 skipAnalysis={!needsAnalysis && analysisResult}
                 existingResults={analysisResult}
                 debugMode={debugMode}
               />
      case 3:
        return <Results 
                 pdfResult={pdfResult}
                 analysisResult={analysisResult}
                 debugMode={debugMode}
               />
      default:
        return 'Unknown step'
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
    
    // Steps in sequence
    if (stepIndex === 1) return !!selectedFile;
    if (stepIndex === 2) return !!pdfResult;
    if (stepIndex === 3) return !!analysisResult;
    
    return false;
  }
  
  // Handle step click
  const handleStepClick = (step) => {
    // Only allow clicking on steps that are accessible
    if (isStepAccessible(step)) {
      setActiveStep(step);
    } else {
      // Show notification with reason why step can't be accessed
      setSnackbarMessage(getStepTooltip(step));
      setSnackbarOpen(true);
    }
  }
  
  // Get tooltip message for inaccessible steps
  const getStepTooltip = (stepIndex) => {
    if (isStepAccessible(stepIndex)) return '';
    
    // API key check takes precedence
    if (stepIndex > 0 && !apiKeySet) return 'Please add a valid API key in the Settings section';
    
    if (stepIndex === 1) return 'Please select a file first';
    if (stepIndex === 2) return 'Please complete the extraction process first';
    if (stepIndex === 3) return 'Please complete the analysis process first';
    
    return '';
  }
  
  // Close snackbar
  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 3,
            width: '100%',
            maxWidth: '800px',
            mb: 2,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom align="center">
            AI PDF to Text
          </Typography>
          <Stepper 
            activeStep={activeStep} 
            orientation="vertical"
            sx={{
              mt: 3,
              '& .MuiStepLabel-root': {
                py: 1,
              },
            }}
          >
            {steps.map((step, index) => (
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
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        sx={{ mt: 1, mr: 1 }}
                        disabled={isNextDisabled(index)}
                      >
                        {index === steps.length - 1 ? 'Finish' : 'Continue'}
                      </Button>
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
                          Start Over
                        </Button>
                      )}
                    </div>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
          {activeStep === steps.length && (
            <Paper square elevation={0} sx={{ p: 3 }}>
              <Typography>All steps completed - you&apos;re finished</Typography>
              <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
                Start Over
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
      </Box>
    </ThemeProvider>
  )
}

export default App 