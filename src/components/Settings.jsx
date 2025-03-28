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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  DEBUG_MODE: 'pdf_processor_debug_mode',
  AUTO_PROGRESS: 'pdf_processor_auto_progress',
  GENERAL_IMAGE_PROMPT: 'pdf_processor_general_image_prompt',
  PAGE_SCAN_PROMPT: 'pdf_processor_page_scan_prompt',
  MAX_REFUSAL_RETRIES: 'pdf_processor_max_refusal_retries'
}

// Default prompts
const DEFAULT_PROMPTS = {
  GENERAL_IMAGE: "This is an image or a visual within a PDF document. Describe it fully. Transcribe any text visible in the image. Describe it, focusing on the meaning and information it is trying to convey.",
  PAGE_SCAN: "This is an image of a page from a PDF document. Make sure you extract ALL the visual information. First extract and describe all the visible graphics, then transcribe all the text on the document. Then describe the connections and relationships visible on the page."
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

export default function Settings({ onDebugModeChange, onAutoProgressChange, onSettingsChange }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEYS.API_KEY) || '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [model, setModel] = useState(() => localStorage.getItem(STORAGE_KEYS.MODEL) || 'gpt-4o-mini')
  const [maxConcurrentRequests, setMaxConcurrentRequests] = useState(() => 
    safeParseInt(localStorage.getItem(STORAGE_KEYS.MAX_REQUESTS), 100)
  )
  const [maxRefusalRetries, setMaxRefusalRetries] = useState(() => 
    safeParseInt(localStorage.getItem(STORAGE_KEYS.MAX_REFUSAL_RETRIES), 3)
  )
  const [showAdvanced, setShowAdvanced] = useState(() => 
    safeParseBoolean(localStorage.getItem(STORAGE_KEYS.SHOW_ADVANCED), false)
  )
  const [debugMode, setDebugMode] = useState(() => 
    safeParseBoolean(localStorage.getItem(STORAGE_KEYS.DEBUG_MODE), false)
  )
  const [autoProgress, setAutoProgress] = useState(() => 
    safeParseBoolean(localStorage.getItem(STORAGE_KEYS.AUTO_PROGRESS), true)
  )
  const [scanAllPages, setScanAllPages] = useState(() => {
    return localStorage.getItem('scanAllPages') === "true";
  });
  
  // Custom prompts state
  const [generalImagePrompt, setGeneralImagePrompt] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.GENERAL_IMAGE_PROMPT) || DEFAULT_PROMPTS.GENERAL_IMAGE
  )
  const [pageScanPrompt, setPageScanPrompt] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.PAGE_SCAN_PROMPT) || DEFAULT_PROMPTS.PAGE_SCAN
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

  // Save auto progress setting to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTO_PROGRESS, autoProgress.toString())
    if (onAutoProgressChange) {
      onAutoProgressChange(autoProgress)
    }
  }, [autoProgress, onAutoProgressChange])
  
  // Save custom prompts to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GENERAL_IMAGE_PROMPT, generalImagePrompt)
  }, [generalImagePrompt])
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAGE_SCAN_PROMPT, pageScanPrompt)
  }, [pageScanPrompt])
  
  // Save max refusal retries to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MAX_REFUSAL_RETRIES, maxRefusalRetries.toString())
    if (onSettingsChange) {
      onSettingsChange('maxRefusalRetries', maxRefusalRetries)
    }
  }, [maxRefusalRetries, onSettingsChange])
  
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

  // Track initial mount for debugging
  useEffect(() => {
    console.log(`Settings component mounted with scanAllPages=${scanAllPages} (${typeof scanAllPages})`);
    console.log(`localStorage['scanAllPages'] = "${localStorage.getItem('scanAllPages')}"`);
  }, []);

  // Improved toggle handler for scan all pages
  const handleScanAllPagesToggle = (event) => {
    // Get boolean value directly from checkbox
    const newValue = !!event.target.checked;
    
    console.log(`Settings: Toggle scanAllPages from ${scanAllPages} to ${newValue}`);
    
    // Update local state
    setScanAllPages(newValue);
    
    // Update localStorage with explicit string
    const valueToStore = String(newValue);
    localStorage.setItem('scanAllPages', valueToStore);
    console.log(`Updated localStorage['scanAllPages'] to "${valueToStore}"`);
    
    // Notify parent component
    if (typeof onSettingsChange === 'function') {
      console.log(`Calling onSettingsChange with 'scanAllPages', ${newValue}`);
      onSettingsChange('scanAllPages', newValue);
    } else {
      console.warn('onSettingsChange is not a function', onSettingsChange);
    }
  };

  return (
    <Stack spacing={3} width="100%">
      <TextField
        fullWidth
        label="OpenAI API Key"
        value={showApiKey ? apiKey : maskApiKey(apiKey)}
        onChange={(e) => handleApiKeyChange(e.target.value)}
        type={showApiKey ? 'text' : 'password'}
        variant="outlined"
        error={validationStatus === 'invalid'}
        helperText={
          !validationStatus || validationStatus === 'idle' || validationStatus === 'validating'
            ? "Your API key is stored locally and never sent to any server"
            : null // We'll use Alert component instead for error/success messages
        }
        FormHelperTextProps={{
          sx: {
            color: 'text.secondary',
            fontStyle: 'italic',
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
        <Alert 
          severity="error" 
          variant="outlined"
          sx={{ 
            mt: 1,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Stack spacing={1} width="100%">
            <Typography variant="body2" fontWeight="medium">
              Invalid API key. Please check your key and try again.
            </Typography>
            
            {validationError && (
              <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                Error details: {validationError}
              </Typography>
            )}
            
            <Button 
              component="a" 
              href="https://platform.openai.com/account/api-keys" 
              target="_blank"
              rel="noopener noreferrer"
              variant="text" 
              size="small"
              startIcon={<CheckCircleIcon fontSize="small" />}
              sx={{ 
                alignSelf: 'flex-start',
                mt: 0.5,
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(255, 152, 0, 0.1)'
                }
              }}
            >
              Get an OpenAI API key
            </Button>
          </Stack>
        </Alert>
      )}
      
      {validationStatus === 'valid' && (
        <Alert 
          severity="success"
          variant="outlined" 
          sx={{ mt: 1 }}
          icon={<CheckCircleIcon fontSize="inherit" />}
        >
          API key validated successfully!
        </Alert>
      )}

      <Button
        onClick={() => setShowAdvanced(!showAdvanced)}
        startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ 
          alignSelf: 'flex-start',
          color: 'text.primary',
          fontWeight: 'medium',
          '&:hover': {
            color: 'primary.main'
          }
        }}
      >
        Advanced Options
      </Button>

      <Collapse in={showAdvanced}>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>AI Model</InputLabel>
            <Select
              value={model}
              label="AI Model"
              onChange={(e) => setModel(e.target.value)}
              sx={{
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main'
                }
              }}
            >
              <MenuItem value="gpt-4o-mini">GPT-4o Mini (Faster, Less Costly)</MenuItem>
              <MenuItem value="gpt-4o">GPT-4o (Higher Quality Analysis)</MenuItem>
            </Select>
            <FormHelperText>
              Mini is recommended for most documents. Use full GPT-4o for complex images.
            </FormHelperText>
          </FormControl>

          <Box>
            <Typography gutterBottom variant="body2" sx={{ fontWeight: 'medium' }}>
              Processing Speed: {maxConcurrentRequests} concurrent requests
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
                  checked={autoProgress}
                  onChange={(e) => setAutoProgress(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Auto-Progress Through Steps</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically move to next step when current step completes
                  </Typography>
                </Box>
              }
            />
          </FormControl>
          
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
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Developer Mode</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Show technical logs and access raw data viewer
                  </Typography>
                </Box>
              }
            />
          </FormControl>
          
          {/* Scan All Pages toggle */}
          <FormControl component="fieldset" variant="standard">
            <FormControlLabel
              control={
                <Switch
                  checked={scanAllPages}
                  onChange={handleScanAllPagesToggle}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Scan All Pages</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Generates descriptions for pages without images
                  </Typography>
                </Box>
              }
            />
          </FormControl>
          
          <Box>
            <Typography gutterBottom variant="body2" sx={{ fontWeight: 'medium' }}>
              Maximum Refusal Retries: {maxRefusalRetries}
            </Typography>
            <Slider
              value={maxRefusalRetries}
              onChange={(_, value) => setMaxRefusalRetries(value)}
              min={0}
              max={5}
              step={1}
              marks={[
                { value: 0, label: '0' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
                { value: 5, label: '5' },
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
            <FormHelperText>
              Number of times to retry when the AI refuses to analyze an image. Higher values may improve results but increase processing time.
            </FormHelperText>
          </Box>
          
          {/* Custom Prompts Section */}
          <Accordion 
            elevation={0}
            sx={{ 
              '&:before': { display: 'none' },
              border: '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '4px',
              mt: 2
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="custom-prompts-content"
              id="custom-prompts-header"
            >
              <Typography variant="subtitle1">Custom AI Prompts</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={3}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      General Image Analysis Prompt
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => setGeneralImagePrompt(DEFAULT_PROMPTS.GENERAL_IMAGE)}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      Reset to Default
                    </Button>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={generalImagePrompt}
                    onChange={(e) => setGeneralImagePrompt(e.target.value)}
                    variant="outlined"
                    size="small"
                    placeholder="Enter custom prompt for general image analysis"
                    helperText="This prompt is used when analyzing regular images"
                  />
                </Box>
                
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      Page Scan Analysis Prompt
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => setPageScanPrompt(DEFAULT_PROMPTS.PAGE_SCAN)}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      Reset to Default
                    </Button>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={pageScanPrompt}
                    onChange={(e) => setPageScanPrompt(e.target.value)}
                    variant="outlined"
                    size="small"
                    placeholder="Enter custom prompt for page scan analysis"
                    helperText="This prompt is used when analyzing full pages or forced page scans"
                  />
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Collapse>
    </Stack>
  )
} 