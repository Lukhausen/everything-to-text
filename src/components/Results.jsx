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

  // Format settings
  const [formatSettings, setFormatSettings] = useState({
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
  })

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

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (err) => {
        console.error('Error copying text:', err)
      }
    )
  }

  // Handle download
  const handleDownload = () => {
    const blob = new Blob([formattedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    // Get the original filename from the PDF result
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
    
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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

        {showRawData && debugMode ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Analysis Data</Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                overflowX: 'auto',
                fontSize: '0.8rem',
                maxHeight: '400px',
                '&::-webkit-scrollbar': {
                  width: '8px',
                  height: '8px'
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(255, 152, 0, 0.3)',
                  borderRadius: '4px'
                }
              }}
            >
              {JSON.stringify(analysisResult, null, 2)}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              mt: 2,
              p: 2,
              minHeight: '300px',
              maxHeight: '500px',
              bgcolor: 'background.default',
              borderRadius: 1,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
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
            }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress color="primary" />
              </Box>
            ) : (
              formattedText || 'No extracted text available'
            )}
          </Box>
        )}
        
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
              <Typography variant="subtitle2" color="text.secondary">
                Customize how the text output is formatted. All fields support {"{pageNumber}"} for page numbers and \n for line breaks.
              </Typography>
              
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