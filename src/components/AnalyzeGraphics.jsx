import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  Paper,
  Stack,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  DataObject as DataObjectIcon,
} from '@mui/icons-material'
import { processBatchImages, extractTextFromBatchResults } from '../utils/batchImageAnalysisUtils'
import RawDataViewer from './RawDataViewer'
import ImageDetailModal from './ImageDetailModal'

export default function AnalyzeGraphics({ 
  pdfResult, 
  onComplete, 
  skipAnalysis = false, 
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
  const [processedImages, setProcessedImages] = useState(0)
  const [totalImages, setTotalImages] = useState(0)
  const [successfulImages, setSuccessfulImages] = useState(0)
  const [failedImages, setFailedImages] = useState(0)
  const [refusalCount, setRefusalCount] = useState(0)
  const [logMessages, setLogMessages] = useState([])
  
  // Image analysis results
  const [imageResults, setImageResults] = useState([])
  const [analysisResult, setAnalysisResult] = useState(null)
  
  // Modal state
  const [rawDataModalOpen, setRawDataModalOpen] = useState(false)
  
  // State for the image detail modal
  const [selectedImage, setSelectedImage] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  
  // Use a ref to track if processing is already in progress
  const processingRef = useRef(false)
  // Use a ref to store seen log messages to prevent duplicates
  const seenMessages = useRef(new Set())

  // Get API key from localStorage (set in Settings component)
  const apiKey = localStorage.getItem('pdf_processor_api_key')
  // Get model from localStorage (set in Settings component)
  const model = localStorage.getItem('pdf_processor_model') || 'gpt-4o-mini'
  // Get max concurrent requests from localStorage (set in Settings component)
  const maxConcurrentRequests = parseInt(
    localStorage.getItem('pdf_processor_max_requests') || '100', 
    10
  )

  // Make sure model is initialized on component mount
  useEffect(() => {
    if (!localStorage.getItem('pdf_processor_model')) {
      localStorage.setItem('pdf_processor_model', 'gpt-4o-mini')
    }
  }, [])

  // Add debugging log for scanAllPages prop
  useEffect(() => {
    if (debugMode) {
      console.log(`AnalyzeGraphics: scanAllPages=${scanAllPages} (${typeof scanAllPages}), Images:`, 
        pdfResult?.images?.length || 0, 
        "ForcedScans:", 
        pdfResult?.images?.filter(img => img.isForcedScan === true).length || 0
      );
    }
  }, [scanAllPages, debugMode, pdfResult]);

  // Add more robust debugging for scanAllPages
  useEffect(() => {
    // Log scanAllPages value and any forced scans when component mounts or updates
    if (pdfResult && pdfResult.images) {
      const forcedScans = pdfResult.images.filter(img => img.isForcedScan === true);
      
      console.log(`AnalyzeGraphics:
        - scanAllPages: ${scanAllPages} (${typeof scanAllPages})
        - Total images: ${pdfResult.images.length}
        - Forced scans: ${forcedScans.length}
        - Forced scan IDs: ${forcedScans.map(img => img.id).join(', ')}
      `);
      
      // Add to log messages
      if (forcedScans.length > 0) {
        addLogMessage(`Found ${forcedScans.length} page scans from "Scan All Pages" feature to analyze`);
      }
    }
  }, [pdfResult, scanAllPages]);

  // Handle case when we have existing results
  useEffect(() => {
    if (skipAnalysis && existingResults) {
      // Use existing results instead of reprocessing
      setAnalysisResult(existingResults)
      setProcessingComplete(true)
      setProgress(100)
      
      if (existingResults.imageAnalysisResults) {
        setImageResults(existingResults.imageAnalysisResults)
        setTotalImages(existingResults.imageAnalysisResults.length)
        setProcessedImages(existingResults.imageAnalysisResults.length)
        
        // Count successful and failed images
        const successful = existingResults.imageAnalysisResults.filter(
          r => r.success && !r.refusalDetected
        ).length
        const refused = existingResults.imageAnalysisResults.filter(
          r => r.success && r.refusalDetected
        ).length
        const failed = existingResults.imageAnalysisResults.length - successful - refused
        
        setSuccessfulImages(successful)
        setRefusalCount(refused)
        setFailedImages(failed)
      }
      
      // Add a summary message to the log
      setLogMessages([
        "Using existing results - analysis skipped",
        `Found ${existingResults.imageAnalysisResults?.length || 0} analyzed images`,
        `${successfulImages} successful, ${refusalCount} refused, ${failedImages} failed`
      ]);
    }
  }, [skipAnalysis, existingResults, successfulImages, refusalCount, failedImages]);

  // Start analysis when component mounts
  useEffect(() => {
    // Skip if no PDF result, or if processing is already complete, or if already processing,
    // or if we have existing results to use
    if (!pdfResult || processingComplete || processingRef.current || (skipAnalysis && existingResults)) return;
    
    // Skip if no API key
    if (!apiKey) {
      setError("API key is required for image analysis. Please set it in the Settings tab.");
      return;
    }
    
    // Skip if there are no images to analyze
    if (!pdfResult.images || pdfResult.images.length === 0) {
      setError("No images found in the PDF to analyze.");
      // Set processing as complete with empty results
      const emptyResult = {
        ...pdfResult,
        imageAnalysisResults: [],
        extractedText: "No images found in the PDF to analyze."
      };
      setAnalysisResult(emptyResult);
      setProcessingComplete(true);
      onComplete(emptyResult);
      return;
    }
    
    const analyzeImages = async () => {
      try {
        // Set processing flag
        processingRef.current = true;
        
        // Reset state
        setIsProcessing(true);
        setError(null);
        setLogMessages([]);
        setProgress(0);
        setProcessedImages(0);
        setSuccessfulImages(0);
        setFailedImages(0);
        setRefusalCount(0);
        
        // Reset seen messages
        seenMessages.current.clear();
        
        // Check if we have images to analyze
        if (!pdfResult || !pdfResult.images || pdfResult.images.length === 0) {
          addLogMessage('No images to analyze');
          setError('No images found in the PDF to analyze');
          setIsProcessing(false);
          processingRef.current = false;
          return;
        }
        
        // Get images to analyze
        const imagesToAnalyze = pdfResult.images;
        const totalImageCount = imagesToAnalyze.length;
        setTotalImages(totalImageCount);
        
        // Log start of analysis
        addLogMessage(`Starting analysis of ${totalImageCount} images...`);
        addLogMessage(`Using model: ${model}`);
        
        // Check for forced scans
        const forcedScans = imagesToAnalyze.filter(img => img.isForcedScan === true);
        if (forcedScans.length > 0) {
          addLogMessage(`Processing ${forcedScans.length} forced scans from "Scan All Pages" feature`);
        }
        
        // Prepare each image for analysis, adding custom properties as needed
        for (const image of imagesToAnalyze) {
          // Special handling for forced scans
          if (image.isForcedScan === true) {
            // Add property to use special prompt
            image.isPageDescription = true;
          }
        }
        
        // Set up batch processing options
        const batchOptions = {
          maxConcurrentRequests,
          model,
          temperature: 0.7,
          maxTokens: 1000,
          maxRefusalRetries: 2,
          
          // Define custom instructions for different image types
          getCustomInstructions: (image) => {
            if (image.isPageDescription || image.isForcedScan) {
              return "This is a complete page from a PDF document. Describe the overall layout and content of this page, including text organization, any tables, forms, or visual elements you can see.";
            }
            // Default to null for regular images (use default prompt)
            return null;
          }
        };
        
        // Set up callbacks for batch processing
        const callbacks = {
          onProgress: (status) => {
            setProgress(status.progressPercentage);
            setProcessedImages(status.processedCount);
          },
          onImageProcessed: (result, currentResults) => {
            // Update the results array
            setImageResults([...currentResults]);
            
            // Log processing
            addLogMessage(`Processed image ${result.imageId}: ${
              result.success 
                ? result.refusalDetected 
                  ? 'No content available'
                  : 'Success'
                : 'No content available'
            }`);
            
            // Update success/failure counts
            const successful = currentResults.filter(r => r.success && !r.refusalDetected).length;
            const refused = currentResults.filter(r => r.success && r.refusalDetected).length;
            const failed = currentResults.filter(r => !r.success).length;
            
            setSuccessfulImages(successful);
            setRefusalCount(refused);
            setFailedImages(failed);
          },
          onError: (errorResult) => {
            addLogMessage(`Error processing image ${errorResult.imageId}: ${errorResult.error}`);
          },
          onComplete: (results, status, updatedPdfData) => {
            // Process is complete
            setProcessingComplete(true);
            setIsProcessing(false);
            
            // Store final results
            setAnalysisResult(updatedPdfData);
            
            // Extract text content from results
            const extractedText = extractTextFromBatchResults(results, pdfResult);
            addLogMessage(`Analysis complete. Extracted text from ${extractedText.successfulImages} images.`);
            
            // Notify parent component
            onComplete({ 
              ...updatedPdfData,
              extractedText: extractedText.extractedText 
            });
            
            // Reset processing flag
            processingRef.current = false;
          }
        };
        
        // Start batch processing
        await processBatchImages(pdfResult, apiKey, batchOptions, callbacks);
      } catch (err) {
        console.error('Error processing images:', err);
        setError(err.message || 'An error occurred while analyzing images');
        setIsProcessing(false);
        processingRef.current = false;
      }
    };
    
    analyzeImages();
  }, [pdfResult, apiKey, model, maxConcurrentRequests, onComplete, processingComplete, skipAnalysis, existingResults]);

  // Helper function to add log messages with deduplication
  const addLogMessage = (message) => {
    if (!seenMessages.current.has(message)) {
      seenMessages.current.add(message);
      setLogMessages(prev => [...prev, message]);
    }
  };

  // Function to handle image click
  const handleImageClick = (image) => {
    setSelectedImage(image)
    setModalOpen(true)
  }
  
  // Function to handle modal close
  const handleModalClose = () => {
    setModalOpen(false)
  }
  
  // Find the analysis result for the selected image
  const selectedImageAnalysis = selectedImage 
    ? imageResults.find(r => r.imageId === selectedImage.id)
    : null

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
            {skipAnalysis && existingResults 
              ? "Images Already Analyzed" 
              : "Analyzing Images with AI"}
          </Typography>
          
          {/* Debug button - only show when in debug mode */}
          {debugMode && (processingComplete || (skipAnalysis && existingResults)) && (
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
              Images
            </Typography>
            <Typography variant="h6">
              {processedImages} / {totalImages || '?'}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Successfully Analyzed
            </Typography>
            <Typography variant="h6" color="success.main">
              {successfulImages}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              No Content Available
            </Typography>
            <Typography variant="h6" color="warning.main">
              {failedImages + refusalCount}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Status
            </Typography>
            <Typography variant="h6" color={
              error ? 'error.main' : 
              processingComplete || (skipAnalysis && existingResults) ? 'success.main' : 
              'primary.main'
            }>
              {error ? 'Error' : 
               processingComplete || (skipAnalysis && existingResults) ? 'Complete' : 
               isProcessing ? 'Processing' : 'Ready'}
            </Typography>
          </Box>
        </Stack>
      </Paper>
      
      {/* Image Gallery */}
      <Paper
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Image Gallery</Typography>
        </Box>
        
        <Box sx={{ 
          maxHeight: '400px', 
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 152, 0, 0.3)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(255, 152, 0, 0.5)'
            }
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px'
          }
        }}>
          <Grid container spacing={2}>
            {pdfResult && pdfResult.images && pdfResult.images.map((image, index) => {
              // Find the corresponding analysis result
              const analysis = imageResults.find(r => r.imageId === image.id);
              
              // Determine status
              const isProcessed = analysis !== undefined;
              const isSuccessful = isProcessed && analysis.success && !analysis.refusalDetected;
              const isRefused = isProcessed && analysis.success && analysis.refusalDetected;
              const isFailed = isProcessed && !analysis.success;
              
              return (
                <Grid item xs={6} sm={4} md={3} key={image.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4
                      }
                    }}
                    onClick={() => handleImageClick(image)}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        height="120"
                        image={image.dataURL}
                        alt={`Image ${index + 1}`}
                        sx={{ 
                          objectFit: 'contain',
                          filter: !isSuccessful ? 'saturate(0.3)' : 'none',
                          transition: 'filter 0.5s ease-in-out',
                        }}
                      />
                      
                      {/* Processing overlay */}
                      {isProcessing && !isProcessed && (
                        <Box 
                          sx={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          <CircularProgress size={30} sx={{ color: 'primary.light' }} />
                        </Box>
                      )}
                      
                      {/* Status indicator */}
                      {isProcessed && (
                        <Box 
                          sx={{ 
                            position: 'absolute',
                            top: 8,
                            right: 8,
                          }}
                        >
                          {isSuccessful && (
                            <Tooltip title="Successfully analyzed">
                              <CheckCircleIcon 
                                sx={{ 
                                  color: 'success.main',
                                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                  borderRadius: '50%',
                                  padding: '2px'
                                }} 
                              />
                            </Tooltip>
                          )}
                          
                          {isRefused && (
                            <Tooltip title="No content could be extracted">
                              <InfoIcon 
                                sx={{ 
                                  color: 'warning.main',
                                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                  borderRadius: '50%',
                                  padding: '2px'
                                }} 
                              />
                            </Tooltip>
                          )}
                          
                          {isFailed && (
                            <Tooltip title="No content could be extracted">
                              <InfoIcon 
                                sx={{ 
                                  color: 'warning.main',
                                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                  borderRadius: '50%',
                                  padding: '2px'
                                }} 
                              />
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    </Box>
                    
                    <CardContent sx={{ flexGrow: 1, pt: 1, pb: 1, px: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
                        Pg {image.pageNumber}, ID: {image.id.substring(0, 6)}...
                      </Typography>
                      
                      {isSuccessful && analysis.text && (
                        <Typography variant="body2" sx={{ 
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {analysis.text}
                        </Typography>
                      )}
                      
                      {isRefused && (
                        <Typography variant="body2" color="warning.main" sx={{ fontSize: '0.75rem' }}>
                          No Content Available
                        </Typography>
                      )}
                      
                      {isFailed && (
                        <Typography variant="body2" color="error.main" sx={{ fontSize: '0.75rem' }}>
                          No Content Available
                        </Typography>
                      )}
                      
                      {!isProcessed && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                          Waiting for analysis...
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
            
            {(!pdfResult || !pdfResult.images || pdfResult.images.length === 0) && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" align="center">
                  No images found in the PDF
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>
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
        data={analysisResult || existingResults}
        title="Image Analysis Data"
        isModal={true}
        open={rawDataModalOpen}
        onClose={() => setRawDataModalOpen(false)}
      />
      
      {/* Image Detail Modal */}
      <ImageDetailModal 
        open={modalOpen}
        onClose={handleModalClose}
        image={selectedImage}
        analysis={selectedImageAnalysis}
      />
    </Stack>
  )
} 