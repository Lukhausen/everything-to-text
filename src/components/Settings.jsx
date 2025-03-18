import { useState, useEffect, useRef } from 'react'
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Stack,
  IconButton,
  Collapse,
  Button,
  InputAdornment,
  FormHelperText,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import OpenAI from 'openai'

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'pdf_processor_api_key',
  API_KEY_VALIDATED: 'pdf_processor_api_key_validated',
  MODEL: 'pdf_processor_model',
  MAX_REQUESTS: 'pdf_processor_max_requests',
  SHOW_ADVANCED: 'pdf_processor_show_advanced',
  DEBUG_MODE: 'pdf_processor_debug_mode'
}

// Helper function to safely parse stored numbers
const safeParseInt = (value, defaultValue) => {
  const parsed = parseInt(value)
  return isNaN(parsed) ? defaultValue : parsed
}

// Helper function to safely parse stored booleans
const safeParseBoolean = (value, defaultValue) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return defaultValue
}

// Function to mask API key
const maskApiKey = (key) => {
  if (!key) return ''
  if (key.length < 8) return '•'.repeat(key.length)
  return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4)
}

export default function Settings({ onDebugModeChange }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.API_KEY) || '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [model, setModel] = useState(() => localStorage.getItem(STORAGE_KEYS.MODEL) || 'gpt-4o-mini')
  const [maxConcurrentRequests, setMaxConcurrentRequests] = useState(() => 
    safeParseInt(localStorage.getItem(STORAGE_KEYS.MAX_REQUESTS), 100)
  )
  const [showAdvanced, setShowAdvanced] = useState(() => 
    safeParseBoolean(localStorage.getItem(STORAGE_KEYS.SHOW_ADVANCED), false)
  )
  const [debugMode, setDebugMode] = useState(() => 
    safeParseBoolean(localStorage.getItem(STORAGE_KEYS.DEBUG_MODE), false)
  )
  
  // API key validation states
  const [validationStatus, setValidationStatus] = useState('idle') // 'idle', 'validating', 'valid', 'invalid'
  const [validationError, setValidationError] = useState('')
  const [isKeyValidated, setIsKeyValidated] = useState(() => 
    safeParseBoolean(localStorage.getItem(STORAGE_KEYS.API_KEY_VALIDATED), false)
  )
  
  // Ref to track original API key to detect changes
  const originalApiKeyRef = useRef(apiKey)
  
  // Debounce timer ref
  const debounceTimerRef = useRef(null)

  // Initialize model if not already set in localStorage
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEYS.MODEL)) {
      localStorage.setItem(STORAGE_KEYS.MODEL, 'gpt-4o-mini')
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
  }, [apiKey])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODEL, model)
  }, [model])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MAX_REQUESTS, maxConcurrentRequests.toString())
  }, [maxConcurrentRequests])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOW_ADVANCED, showAdvanced.toString())
  }, [showAdvanced])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEBUG_MODE, debugMode.toString())
    if (onDebugModeChange) {
      onDebugModeChange(debugMode)
    }
  }, [debugMode, onDebugModeChange])

  // Save API key validation status to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_KEY_VALIDATED, isKeyValidated.toString())
  }, [isKeyValidated])
  
  // Handle API key validation
  const validateApiKey = async (key) => {
    if (!key || key.trim() === '') {
      setValidationStatus('idle')
      setIsKeyValidated(false)
      return
    }
    
    setValidationStatus('validating')
    setValidationError('')
    
    try {
      // Create OpenAI client with browser support
      const openai = new OpenAI({
        apiKey: key,
        dangerouslyAllowBrowser: true
      })
      
      // Send a minimal test message to verify the API key
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: "Hi there, just testing my API key. Please respond with 'valid' if you receive this message." }
        ],
        max_tokens: 10
      })
      
      // Check response
      if (response && response.choices && response.choices.length > 0) {
        setValidationStatus('valid')
        setIsKeyValidated(true)
      } else {
        throw new Error('Invalid response from OpenAI API')
      }
    } catch (error) {
      console.error('API key validation error:', error)
      setValidationStatus('invalid')
      setIsKeyValidated(false)
      setValidationError(error.message || 'The API key appears to be invalid')
    }
  }
  
  // Handle API key change with debounce
  const handleApiKeyChange = (newKey) => {
    setApiKey(newKey)
    
    // Reset validation if key changes
    if (newKey !== originalApiKeyRef.current) {
      setValidationStatus('idle')
      setIsKeyValidated(false)
      
      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      
      // Set new debounce timer for validation
      if (newKey && newKey.trim() !== '') {
        debounceTimerRef.current = setTimeout(() => {
          validateApiKey(newKey)
        }, 1000) // Validate after 1 second of inactivity
      }
    }
  }
  
  // Update original API key ref when saving to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
    originalApiKeyRef.current = apiKey
  }, [apiKey])

  return (
    <Stack spacing={3} width="100%">
      <TextField
        fullWidth
        label="API Key"
        value={showApiKey ? apiKey : maskApiKey(apiKey)}
        onChange={(e) => handleApiKeyChange(e.target.value)}
        type={showApiKey ? 'text' : 'password'}
        variant="outlined"
        error={validationStatus === 'invalid'}
        helperText={
          validationStatus === 'invalid' 
            ? validationError 
            : "Your API key is stored locally in your browser and never sent to any external server"
        }
        FormHelperTextProps={{
          sx: {
            color: validationStatus === 'invalid' ? 'error.main' : 'text.secondary',
            fontStyle: validationStatus === 'invalid' ? 'normal' : 'italic',
            mt: 1
          }
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {validationStatus === 'validating' && (
                <CircularProgress size={20} thickness={5} sx={{ mr: 1 }} />
              )}
              {validationStatus === 'valid' && (
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              )}
              <IconButton
                aria-label="toggle api key visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                edge="end"
                sx={{
                  '&:hover': {
                    color: 'primary.main'
                  }
                }}
              >
                {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      {validationStatus === 'invalid' && (
        <Alert severity="error" sx={{ mt: 1 }}>
          The API key you entered appears to be invalid. Please check your key and try again.
        </Alert>
      )}
      
      {validationStatus === 'valid' && (
        <Alert severity="success" sx={{ mt: 1 }}>
          API key validated successfully!
        </Alert>
      )}

      <Button
        onClick={() => setShowAdvanced(!showAdvanced)}
        startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ 
          alignSelf: 'flex-start',
          color: 'text.primary',
          '&:hover': {
            color: 'primary.main'
          }
        }}
      >
        Advanced Settings
      </Button>

      <Collapse in={showAdvanced}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Model</InputLabel>
            <Select
              value={model}
              label="Model"
              onChange={(e) => setModel(e.target.value)}
              sx={{
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main'
                }
              }}
            >
              <MenuItem value="gpt-4o-mini">GPT-4o Mini (Default, Faster)</MenuItem>
              <MenuItem value="gpt-4o">GPT-4o (More Accurate)</MenuItem>
            </Select>
            <FormHelperText>
              GPT-4o Mini is recommended for most images. Use GPT-4o for complex images or detailed analysis.
            </FormHelperText>
          </FormControl>

          <Box>
            <Typography gutterBottom>
              Max Concurrent Requests: {maxConcurrentRequests}
            </Typography>
            <Slider
              value={maxConcurrentRequests}
              onChange={(_, value) => setMaxConcurrentRequests(value)}
              min={0}
              max={1000}
              step={10}
              marks={[
                { value: 0, label: '0' },
                { value: 100, label: '100' },
                { value: 500, label: '500' },
                { value: 1000, label: '1000' },
              ]}
              valueLabelDisplay="auto"
              sx={{
                '& .MuiSlider-thumb': {
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: `0 0 0 8px alpha('primary.main', 0.16)`
                  }
                },
                '& .MuiSlider-track': {
                  backgroundColor: 'primary.main'
                },
                '& .MuiSlider-rail': {
                  opacity: 0.28
                }
              }}
            />
          </Box>
          
          <FormControl component="fieldset" variant="standard">
            <FormControlLabel
              control={
                <Switch
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Show Debug Info</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enables processing logs and raw data inspection
                  </Typography>
                </Box>
              }
            />
          </FormControl>
        </Stack>
      </Collapse>
    </Stack>
  )
} 