import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  Paper,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
} from '@mui/material'
import {
  DataObject as DataObjectIcon,
} from '@mui/icons-material'
import { processPdfDocument } from '../utils/pdfUtils'
import RawDataViewer from './RawDataViewer'

export default function ExtractGraphics({ 
  pdfFile, 
  onComplete, 
  skipProcessing = false, 
  existingResults = null,
  debugMode = false,
  scanAllPages = false
}) {
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [error, setError] = useState(null)
  
  // Progress tracking
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [imagesFound, setImagesFound] = useState(0)
  const [logMessages, setLogMessages] = useState([])
  
  // Modal state
  const [rawDataModalOpen, setRawDataModalOpen] = useState(false)
  
  // Use a ref to track if processing is already in progress
  const processingRef = useRef(false)
  // Use a ref to store seen log messages to prevent duplicates
  const seenMessages = useRef(new Set())

  // Results
  const [pdfResult, setPdfResult] = useState(null)

  // Add debugging log for scanAllPages prop
  useEffect(() => {
    if (debugMode) {
      console.log(`ExtractGraphics: scanAllPages=${scanAllPages} (${typeof scanAllPages})`);
    }
  }, [scanAllPages, debugMode]);

  // Handle case when we have existing results
  useEffect(() => {
    if (skipProcessing && existingResults) {
      // Use existing results instead of reprocessing
      setPdfResult(existingResults)
      setProcessingComplete(true)
      setTotalPages(existingResults.totalPages)
      setImagesFound(existingResults.images.length)
      setProgress(100)
      setCurrentPage(existingResults.totalPages)
      
      // Add a summary message to the log
      setLogMessages([
        "Using existing results - processing skipped",
        `PDF has ${existingResults.totalPages} pages`,
        `Found ${existingResults.images.length} unique images`
      ]);
    }
  }, [skipProcessing, existingResults]);

  // Add a clear log message when component mounts to show the current scanAllPages value
  useEffect(() => {
    console.log(`ExtractGraphics mounted with scanAllPages=${scanAllPages} (${typeof scanAllPages})`);
    
    // Add localStorage check for debugging
    const storedValue = localStorage.getItem('scanAllPages');
    console.log(`localStorage['scanAllPages'] = "${storedValue}" (${typeof storedValue})`);
  }, []);

  // Process the PDF when the component mounts or file changes
  useEffect(() => {
    // Skip if no file, or if processing is already complete, or if already processing,
    // or if we have existing results to use
    if (!pdfFile || processingComplete || processingRef.current || (skipProcessing && existingResults)) return;
    
    const processPdf = async () => {
      // Set processing flag to prevent duplicate calls
      processingRef.current = true;
      
      setIsProcessing(true);
      setError(null);
      setLogMessages([]);
      setProgress(0);
      setImagesFound(0);
      setCurrentPage(0);
      setTotalPages(0);
      
      // Reset seen messages
      seenMessages.current = new Set();
      
      // Track the highest image number seen
      let highestImageNumber = 0;
      
      // Important: Convert scanAllPages to boolean explicitly
      const scanAllPagesValue = scanAllPages === true;
      console.log(`Starting PDF processing with scanAllPages=${scanAllPagesValue} (${typeof scanAllPagesValue})`);
      
      // Add explicit log about scanAllPages
      setLogMessages(prev => [...prev, 
        `Scan All Pages: ${scanAllPagesValue ? 'ENABLED' : 'DISABLED'}`,
        `localStorage['scanAllPages']: "${localStorage.getItem('scanAllPages')}"`
      ]);
      
      try {
        // Convert file to ArrayBuffer
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
          try {
            const pdfData = new Uint8Array(this.result);
            
            // Create options object simply and clearly
            const options = {
              // Core setting - make this explicit and first 
              scanAllPages: scanAllPagesValue,
              
              // Progress tracking
              progressCallback: (progressRatio) => setProgress(progressRatio * 100),
              logCallback: (message) => {
                if (!seenMessages.current.has(message)) {
                  seenMessages.current.add(message);
                  setLogMessages(prev => [...prev, message]);
                  
                  // Parse progress messages
                  if (message.includes('Processing page')) {
                    const match = message.match(/Processing page (\d+)\/(\d+)/);
                    if (match) {
                      setCurrentPage(parseInt(match[1]));
                      setTotalPages(parseInt(match[2]));
                    }
                  }
                  
                  // Extract image count from log messages by parsing the image number
                  if (message.includes('Found image')) {
                    const match = message.match(/Found image (\d+)/);
                    if (match) {
                      const imageNumber = parseInt(match[1]);
                      highestImageNumber = Math.max(highestImageNumber, imageNumber);
                      setImagesFound(highestImageNumber);
                    }
                  }
                  
                  // Update total images count when available
                  if (message.includes('Found') && message.includes('original images')) {
                    const match = message.match(/Found (\d+) original images/);
                    if (match) {
                      const totalImages = parseInt(match[1]);
                      setImagesFound(totalImages);
                    }
                  }
                  
                  // Count unique images at the end of processing
                  if (message.includes('Found') && message.includes('unique images')) {
                    const match = message.match(/Found (\d+) unique images/);
                    if (match) {
                      const uniqueImages = parseInt(match[1]);
                      setImagesFound(uniqueImages);
                    }
                  }
                }
              },
              
              // Debug flags
              debugMode: true
            };
            
            // Process the PDF with these options
            const result = await processPdfDocument(pdfData, options);
            
            if (result.success) {
              // Preserve the original filename from the uploaded file
              const enrichedResult = {
                ...result,
                originalFilename: pdfFile.name,  // Store the original filename
                name: pdfFile.name,              // Compatibility with existing code
                file: {                          // Add file info for compatibility
                  name: pdfFile.name,
                  type: pdfFile.type,
                  size: pdfFile.size
                }
              };
              
              setPdfResult(enrichedResult);
              setTotalPages(result.totalPages);
              
              // Set the final image count based on the result
              setImagesFound(result.images.length);
              setProcessingComplete(true);
              
              // Notify parent component of completion
              onComplete(enrichedResult);
            } else {
              setError(result.error || 'An error occurred while processing the PDF');
            }
          } catch (err) {
            console.error('Error processing PDF:', err);
            setError(err.message || 'An error occurred while processing the PDF');
          } finally {
            setIsProcessing(false);
            // Reset processing flag
            processingRef.current = false;
          }
        };
        
        fileReader.onerror = function() {
          setError('Could not read the file');
          setIsProcessing(false);
          // Reset processing flag
          processingRef.current = false;
        };
        
        fileReader.readAsArrayBuffer(pdfFile);
      } catch (err) {
        console.error('Error setting up PDF processing:', err);
        setError(err.message || 'Failed to set up PDF processing');
        setIsProcessing(false);
        // Reset processing flag
        processingRef.current = false;
      }
    };
    
    processPdf();
  }, [pdfFile, onComplete, processingComplete, skipProcessing, existingResults, scanAllPages]);

  return (
    <Stack spacing={3} width="100%">
      {error && (
        <Alert 
          severity="error" 
          sx={{
            '& .MuiAlert-icon': {
              color: 'primary.main'
            }
          }}
        >
          {error}
        </Alert>
      )}
      
      <Paper
        sx={{
          p: { xs: 2, sm: 3 },
          bgcolor: 'background.paper',
          borderRadius: { xs: 1, sm: 2 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {skipProcessing && existingResults 
              ? "Graphics Already Extracted" 
              : "Extracting Images from PDF"}
          </Typography>
          
          {/* Debug button - only show when in debug mode */}
          {debugMode && (processingComplete || (skipProcessing && existingResults)) && (
            <Button 
              variant="outlined" 
              size="small"
              startIcon={<DataObjectIcon />}
              onClick={() => setRawDataModalOpen(true)}
              sx={{ 
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  backgroundColor: 'rgba(255, 152, 0, 0.08)'
                }
              }}
            >
              View Raw Data
            </Button>
          )}
        </Box>
        
        <Box sx={{ my: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography>Progress:</Typography>
            <Typography color="primary.main" fontWeight="bold">
              {progress.toFixed(0)}%
            </Typography>
            {isProcessing && (
              <CircularProgress 
                size={24} 
                thickness={5}
                sx={{ ml: 'auto' }}
              />
            )}
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 10, 
              borderRadius: 5,
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'primary.main'
              }
            }}
          />
        </Box>
        
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          divider={<Divider orientation="vertical" flexItem />}
          sx={{ 
            justifyContent: 'space-around',
            textAlign: 'center',
            py: 2 
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              Pages Processed
            </Typography>
            <Typography variant="h6">
              {currentPage} / {totalPages || '?'}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Images Detected
            </Typography>
            <Typography variant="h6">
              {imagesFound}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Status
            </Typography>
            <Typography variant="h6" color={
              error ? 'error.main' : 
              processingComplete || (skipProcessing && existingResults) ? 'success.main' : 
              'primary.main'
            }>
              {error ? 'Error' : 
               processingComplete || (skipProcessing && existingResults) ? 'Complete' : 
               isProcessing ? 'Processing' : 'Ready'}
            </Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* Log messages panel - only show when in debug mode */}
      {debugMode && (
        <Paper 
          sx={{ 
            p: 2,
            maxHeight: '200px',
            overflow: 'auto',
            bgcolor: 'background.paper',
            borderRadius: 2
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Processing Log
          </Typography>
          <List dense>
            {logMessages.length > 0 ? (
              logMessages.map((msg, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={msg}
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      sx: { 
                        fontFamily: 'monospace',
                        fontSize: '0.8rem'
                      }
                    }}
                  />
                </ListItem>
              ))
            ) : (
              <ListItem>
                <ListItemText 
                  primary="Waiting for processing to begin..." 
                  primaryTypographyProps={{ 
                    variant: 'body2',
                    sx: { fontStyle: 'italic' }
                  }}
                />
              </ListItem>
            )}
          </List>
        </Paper>
      )}
      
      {/* Raw Data Modal */}
      <RawDataViewer
        data={pdfResult || existingResults}
        title="PDF Processing Data"
        isModal={true}
        open={rawDataModalOpen}
        onClose={() => setRawDataModalOpen(false)}
      />
    </Stack>
  )
} 