import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Collapse,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import {
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
  DataObject as DataObjectIcon,
} from '@mui/icons-material'
import { createTextReplacement, generateFormattedText } from '../utils/textReplacementUtils'

// Text normalization utilities
const normalizeText = (text, context = 'display') => {
  if (!text) return '';
  
  // Trim leading/trailing whitespace and newlines
  let normalized = text.replace(/^[\s\n]+|[\s\n]+$/g, '');
  
  // We no longer normalize internal newlines to preserve formatting
  // This allows for multiple consecutive newlines (5+ breaks etc.)
  
  return normalized;
};

// Default format settings
const DEFAULT_FORMAT_SETTINGS = {
  includePageHeadings: true,
  pageHeadingFormat: '\\n\\n\\n\\n//PAGE {pageNumber}: \\n\\n\\n',
  pageScan: {
    prefix: '#Full Page Scan of Page {pageNumber}: \\n\\n',
    suffix: '\\n\\nEnd of Full Page Scan of Page {pageNumber}'
  },
  image: {
    prefix: '\\n\\n\\n##Content of an Image appearing on Page {pageNumber}:\\n\\n',
    suffix: '\\n\\n\\nEnd of Content of image appearing on Page {pageNumber}'
  }
};

export default function Results({ 
  pdfResult, 
  analysisResult,
  debugMode = false
}) {
  // Content state
  const [formattedText, setFormattedText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Copy state
  const [copied, setCopied] = useState(false)
  
  // View states
  const [showRawData, setShowRawData] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Format settings - load from localStorage if available
  const [formatSettings, setFormatSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('textFormatSettings');
      return savedSettings ? JSON.parse(savedSettings) : DEFAULT_FORMAT_SETTINGS;
    } catch (error) {
      console.error('Error loading format settings from localStorage:', error);
      return DEFAULT_FORMAT_SETTINGS;
    }
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('textFormatSettings', JSON.stringify(formatSettings));
    } catch (error) {
      console.error('Error saving format settings to localStorage:', error);
    }
  }, [formatSettings]);

  // Initialize the formatted text when results change
  useEffect(() => {
    if (!pdfResult || !analysisResult) {
      setIsLoading(false)
      setError('No results available')
      return
    }

    try {
      setIsLoading(true)
      
      // Create text replacement with current format settings
      const replacementResult = createTextReplacement(
        pdfResult, 
        analysisResult.imageAnalysisResults || [],
        formatSettings
      )
      
      // Generate formatted text
      const text = generateFormattedText(replacementResult, formatSettings)
      
      setFormattedText(text)
      setError(null)
    } catch (err) {
      console.error('Error formatting results:', err)
      setError('Error formatting results: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [pdfResult, analysisResult, formatSettings])

  // Handle format setting changes
  const handleFormatChange = (path, value) => {
    const newSettings = { ...formatSettings }
    
    // Handle nested paths (e.g., 'pageScan.prefix')
    if (path.includes('.')) {
      const [parent, child] = path.split('.')
      newSettings[parent] = {
        ...newSettings[parent],
        [child]: value
      }
    } else {
      newSettings[path] = value
    }
    
    setFormatSettings(newSettings)
  }
  
  // Reset format settings to defaults
  const handleResetSettings = () => {
    setFormatSettings(DEFAULT_FORMAT_SETTINGS);
  }

  // Handle copy to clipboard
  const handleCopy = () => {
    // Use normalized text for copying, same as download
    const textToCopy = normalizeText(formattedText || analysisResult?.extractedText || '', 'download');
    
    navigator.clipboard.writeText(textToCopy).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (err) => {
        console.error('Error copying text:', err)
      }
    )
  }

  // Handle download with normalized text
  const handleDownload = () => {
    if (!analysisResult) return;
    
    // Use formatted text with normalization applied
    const textToDownload = normalizeText(formattedText || analysisResult.extractedText, 'download');
    
    // Determine filename
    let fileName = 'extracted-text.txt'
    
    if (pdfResult) {
      // First try the specific originalFilename property we've added
      if (pdfResult.originalFilename) {
        fileName = pdfResult.originalFilename.replace(/\.pdf$/i, '') + '.txt'
      }
      // Fallback to other possible name properties
      else if (pdfResult.name) {
        fileName = pdfResult.name.replace(/\.pdf$/i, '') + '.txt'
      } 
      else if (pdfResult.filename) {
        fileName = pdfResult.filename.replace(/\.pdf$/i, '') + '.txt'
      } 
      else if (pdfResult.file && pdfResult.file.name) {
        fileName = pdfResult.file.name.replace(/\.pdf$/i, '') + '.txt'
      }
    }
    
    // Create and trigger download
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Get the text to display based on whether formatted text is available or not
  const getDisplayText = () => {
    if (isLoading) return '';
    
    // If we have formatted text from the complex formatting process, use that
    if (formattedText) {
      return normalizeText(formattedText, 'display');
    }
    
    // Otherwise use the direct analysis results
    return !analysisResult || !analysisResult.extractedText 
      ? 'No extracted text available'
      : normalizeText(analysisResult.extractedText, 'display');
  };

  // Toggle raw data view
  const toggleRawData = () => {
    setShowRawData(!showRawData)
  }

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
          <Typography variant="h6">Analysis Results</Typography>
          
          <Box>
            {debugMode && (
              <Tooltip title="View raw data">
                <IconButton onClick={toggleRawData} sx={{ mr: 1 }}>
                  <DataObjectIcon color={showRawData ? "primary" : "inherit"} />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title={copied ? "Copied to clipboard!" : "Copy to clipboard"}>
              <IconButton onClick={handleCopy} sx={{ mr: 1 }}>
                {copied ? <CheckIcon /> : <ContentCopyIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Download as text file">
              <IconButton onClick={handleDownload}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mt: 2, position: 'relative' }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ 
              backgroundColor: 'background.default', 
              p: 2, 
              borderRadius: 1,
              maxHeight: '500px',
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'grey.500',
                borderRadius: '4px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'background.paper',
                borderRadius: '4px'
              }
            }}>
              {showRawData && debugMode ? (
                <Box component="pre" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify({pdfResult, analysisResult}, null, 2)}
                </Box>
              ) : (
                <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                  {getDisplayText()}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        
        {/* Format Settings Button - Now below the output */}
        <Box sx={{ mt: 3 }}>
          <Button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            startIcon={showAdvancedSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              alignSelf: 'flex-start',
              color: 'text.primary',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            Text Format Settings
          </Button>
              
          <Collapse in={showAdvancedSettings}>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Customize how the text output is formatted. All fields support {"{pageNumber}"} for page numbers and \n for line breaks.
                </Typography>
                
                <Button 
                  onClick={handleResetSettings}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ ml: 2, minWidth: '120px' }}
                >
                  Reset Defaults
                </Button>
              </Box>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={formatSettings.includePageHeadings}
                    onChange={(e) => handleFormatChange('includePageHeadings', e.target.checked)}
                    color="primary"
                  />
                }
                label="Include page headings"
              />
              
              {formatSettings.includePageHeadings && (
                <TextField
                  fullWidth
                  size="small"
                  label="Page Heading Format"
                  value={formatSettings.pageHeadingFormat}
                  onChange={(e) => handleFormatChange('pageHeadingFormat', e.target.value)}
                />
              )}
              
              <Divider />
              
              <Typography variant="subtitle2">Page Content Formatting</Typography>
              
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Page Content Prefix"
                  value={formatSettings.pageScan.prefix}
                  onChange={(e) => handleFormatChange('pageScan.prefix', e.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Page Content Suffix"
                  value={formatSettings.pageScan.suffix}
                  onChange={(e) => handleFormatChange('pageScan.suffix', e.target.value)}
                />
              </Stack>
              
              <Divider />
              
              <Typography variant="subtitle2">Image Content Formatting</Typography>
              
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Image Content Prefix"
                  value={formatSettings.image.prefix}
                  onChange={(e) => handleFormatChange('image.prefix', e.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Image Content Suffix"
                  value={formatSettings.image.suffix}
                  onChange={(e) => handleFormatChange('image.suffix', e.target.value)}
                />
              </Stack>
            </Stack>
          </Collapse>
        </Box>
      </Paper>
    </Stack>
  )
} 