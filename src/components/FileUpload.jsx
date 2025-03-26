import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  Alert,
  Button,
  Collapse,
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PdfIcon,
  Delete as DeleteIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import Settings from './Settings'

const FileUpload = ({ onFileSelect, onDebugModeChange, onAutoProgressChange, hasNavigatedAway }) => {
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Effect to collapse advanced settings when navigating away
  useEffect(() => {
    if (hasNavigatedAway) {
      setShowAdvanced(false)
    }
  }, [hasNavigatedAway])
  
  // Effect to collapse settings when component mounts
  useEffect(() => {
    setShowAdvanced(false)
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile?.type !== 'application/pdf') {
      setError('Please upload a PDF file only')
      return
    }
    setFile(selectedFile)
    setError(null)
    onFileSelect?.(selectedFile)
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
  })

  const handleDelete = () => {
    setFile(null)
    onFileSelect?.(null)
  }

  const handleAdvancedToggle = () => {
    setShowAdvanced(prev => !prev)
  }

  return (
    <Box>
      <Stack spacing={3} width="100%">
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
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
          {...getRootProps()}
          sx={{
            p: { xs: 2, sm: 3 },
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.500',
            borderRadius: { xs: 1, sm: 2 },
            bgcolor: 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'background.default',
            },
          }}
        >
          <input {...getInputProps()} />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            {file ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PdfIcon sx={{ color: 'primary.main' }} />
                <Typography>{file.name}</Typography>
                <IconButton 
                  size="small"
                  aria-label="Remove selected file" 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete()
                  }}
                  sx={{
                    '&:hover': {
                      color: 'primary.main'
                    }
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ) : (
              <Typography align="center" color="text.secondary">
                {isDragActive
                  ? 'Release to upload your PDF file'
                  : 'Drag and drop a PDF file here, or click to browse files'}
              </Typography>
            )}
          </Box>
        </Paper>

        <Box sx={{ mt: 2 }}>
          <Button
            onClick={handleAdvancedToggle}
            startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              color: 'text.primary',
              fontWeight: 'medium',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            Settings
          </Button>
          <Collapse in={showAdvanced}>
            <Box sx={{ mt: 1 }}>
              <Settings
                onDebugModeChange={onDebugModeChange}
                onAutoProgressChange={onAutoProgressChange}
              />
            </Box>
          </Collapse>
        </Box>
      </Stack>
    </Box>
  )
}

export default FileUpload 