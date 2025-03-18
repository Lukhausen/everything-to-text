import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  Alert,
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PdfIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import Settings from './Settings'

export default function FileUpload({ onFileSelect, onDebugModeChange }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile?.type !== 'application/pdf') {
      setError('Please upload a PDF file')
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

  return (
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
          p: 3,
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.500',
          borderRadius: 2,
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
                ? 'Drop your PDF file here'
                : 'Drag and drop your PDF file here, or click to select'}
            </Typography>
          )}
        </Box>
      </Paper>

      <Settings onDebugModeChange={onDebugModeChange} />
    </Stack>
  )
} 