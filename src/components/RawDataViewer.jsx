import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import {
  Box,
  Typography,
  Modal,
  IconButton,
  Paper,
  Collapse,
  Button,
  Stack,
  Tooltip,
  CircularProgress
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as ContentCopyIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material'

// Maximum length for string values before truncation
const STRING_TRUNCATE_LENGTH = 500

// Helper function to get the type of a value in a user-friendly format
const getValueType = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// Helper function to truncate long strings (base64, etc.)
const truncateString = (str) => {
  if (!str || str.length <= STRING_TRUNCATE_LENGTH) return str
  
  const halfLength = Math.floor(STRING_TRUNCATE_LENGTH / 2)
  return `${str.substring(0, halfLength)} ... [${str.length - STRING_TRUNCATE_LENGTH} more characters] ... ${str.substring(str.length - halfLength)}`
}

// Memoized value renderer component
const ValueRenderer = memo(({ value }) => {
  const type = getValueType(value)
  
  switch (type) {
    case 'string':
      const displayValue = value.length > STRING_TRUNCATE_LENGTH 
        ? truncateString(value) 
        : value
      return <span style={{ color: '#ce9178' }}>{`"${displayValue}"`}</span>
    case 'number':
      return <span style={{ color: '#b5cea8' }}>{value}</span>
    case 'boolean':
      return <span style={{ color: '#569cd6' }}>{String(value)}</span>
    case 'null':
      return <span style={{ color: '#569cd6' }}>null</span>
    case 'undefined':
      return <span style={{ color: '#569cd6' }}>undefined</span>
    default:
      return <span>{String(value)}</span>
  }
})

// Memoized recursive tree node component
const TreeNode = memo(({ 
  data, 
  path, 
  name, 
  isLast,
  expandedPaths,
  togglePath
}) => {
  const type = getValueType(data)
  const isExpandable = type === 'object' || type === 'array'
  const isExpanded = isExpandable && expandedPaths.has(path)
  const isEmpty = isExpandable && (
    type === 'array' ? data.length === 0 : Object.keys(data).length === 0
  )
  
  // Calculate indentation based on nesting level
  const depth = path === 'root' ? 0 : path.split('.').length - 1
  
  // Handle click on expand/collapse icon - useMemo to prevent recreation
  const handleToggle = useCallback(() => {
    togglePath(path)
  }, [togglePath, path])
  
  // Render leaf nodes (not expandable)
  if (!isExpandable) {
    return (
      <Box sx={{ 
        display: 'flex', 
        ml: depth * 1.5, 
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        py: 0.25
      }}>
        {name !== null && (
          <Typography component="span" color="primary.light">
            {name}: 
          </Typography>
        )}
        <ValueRenderer value={data} />
        {!isLast && <Typography component="span">,</Typography>}
      </Box>
    )
  }
  
  // Handle arrays and objects
  const isArray = type === 'array'
  
  // Only compute children if expanded - huge performance win
  const children = useMemo(() => {
    if (!isExpanded || isEmpty) return null
    
    if (isArray) {
      return data.map((item, index) => {
        const itemPath = `${path}.${index}`
        return (
          <TreeNode
            key={itemPath}
            data={item}
            path={itemPath}
            name={null}
            isLast={index === data.length - 1}
            expandedPaths={expandedPaths}
            togglePath={togglePath}
          />
        )
      })
    } else {
      const entries = Object.entries(data)
      return entries.map(([key, value], index) => {
        const propPath = `${path}.${key}`
        return (
          <TreeNode
            key={propPath}
            data={value}
            path={propPath}
            name={key}
            isLast={index === entries.length - 1}
            expandedPaths={expandedPaths}
            togglePath={togglePath}
          />
        )
      })
    }
  }, [data, isArray, isExpanded, isEmpty, path, expandedPaths, togglePath])
  
  return (
    <Box sx={{ ml: depth * 1.5, fontFamily: 'monospace', fontSize: '0.85rem' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {!isEmpty && (
          <IconButton 
            size="small" 
            onClick={handleToggle}
            sx={{ p: 0.25, mr: 0.5, color: 'primary.main' }}
          >
            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        )}
        
        {name !== null && (
          <Typography component="span" color="primary.light">
            {name}: 
          </Typography>
        )}
        
        <Typography component="span">
          {isArray ? '[' : '{'}
          {isEmpty ? (isArray ? ']' : '}') : ''}
        </Typography>
        
        {!isEmpty && !isExpanded && (
          <Typography 
            component="span" 
            sx={{ color: 'text.secondary', fontStyle: 'italic', ml: 0.5 }}
          >
            {isArray 
              ? `${data.length} item${data.length !== 1 ? 's' : ''}` 
              : `${Object.keys(data).length} propert${Object.keys(data).length !== 1 ? 'ies' : 'y'}`}
          </Typography>
        )}
        
        {!isEmpty && !isExpanded && (
          <Typography component="span" sx={{ ml: 0.5 }}>
            {isArray ? ']' : '}'}
            {!isLast && ','}
          </Typography>
        )}
      </Box>
      
      <Collapse in={isExpanded}>
        {!isEmpty && (
          <Box sx={{ ml: 1.5 }}>
            {children}
          </Box>
        )}
        
        {!isEmpty && isExpanded && (
          <Box sx={{ ml: depth * 1.5 }}>
            <Typography component="span">
              {isArray ? ']' : '}'}
              {!isLast && ','}
            </Typography>
          </Box>
        )}
      </Collapse>
    </Box>
  )
})

// Main RawDataViewer component
export default function RawDataViewer({ 
  data, 
  title = "Raw Data", 
  isModal = true,
  open = false,
  onClose = () => {},
  maxHeight = '80vh',
  width = { xs: '90%', sm: '80%', md: '70%' }
}) {
  // State to track which paths in the data structure are expanded
  const [expandedPaths, setExpandedPaths] = useState(new Set(['root']))
  const [copied, setCopied] = useState(false)
  const [isExpanding, setIsExpanding] = useState(false)
  
  // Refs for scrolling container and handling render batching
  const scrollContainerRef = useRef(null)
  const batchingTimeoutRef = useRef(null)
  
  // Reset expansion state when data changes
  useEffect(() => {
    setExpandedPaths(new Set(['root']))
  }, [data])
  
  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    try {
      const formattedData = JSON.stringify(data, null, 2)
      navigator.clipboard.writeText(formattedData)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(err => {
          console.error('Failed to copy: ', err)
        })
    } catch (error) {
      console.error('Error formatting data for copy: ', error)
    }
  }, [data])
  
  // Function to expand or collapse a specific path - stable reference
  const togglePath = useCallback((path) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])
  
  // Optimized and progressive expand all function using Web Workers or requestIdleCallback
  const expandAll = useCallback(() => {
    if (!data || typeof data !== 'object') return
    
    // Set loading state
    setIsExpanding(true)
    
    // Clear any existing timeout
    if (batchingTimeoutRef.current) {
      clearTimeout(batchingTimeoutRef.current)
    }
    
    // Use setTimeout with 0 to allow UI to update first
    setTimeout(() => {
      // Use a non-recursive approach with batched updates
      const allPaths = new Set(['root'])
      const queue = [{ obj: data, path: 'root' }]
      const BATCH_SIZE = 100 // Process this many at once
      
      const processQueue = () => {
        if (queue.length === 0) {
          setExpandedPaths(allPaths)
          setIsExpanding(false)
          return
        }
        
        // Process a batch
        let count = 0
        while (queue.length > 0 && count < BATCH_SIZE) {
          const { obj, path } = queue.shift()
          count++
          
          // Skip non-objects
          if (obj === null || typeof obj !== 'object') continue
          
          // Add the current path
          allPaths.add(path)
          
          // Add children to the queue
          if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
              if (item !== null && typeof item === 'object') {
                const childPath = `${path}.${index}`
                allPaths.add(childPath)
                queue.push({ obj: item, path: childPath })
              }
            })
          } else {
            Object.entries(obj).forEach(([key, value]) => {
              if (value !== null && typeof value === 'object') {
                const childPath = `${path}.${key}`
                allPaths.add(childPath)
                queue.push({ obj: value, path: childPath })
              }
            })
          }
        }
        
        // Update the UI with current progress
        setExpandedPaths(new Set(allPaths))
        
        // Continue processing with next batch
        batchingTimeoutRef.current = setTimeout(processQueue, 0)
      }
      
      // Start processing
      processQueue()
    }, 0)
  }, [data])
  
  // Collapse all nodes but keep root expanded
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['root'])) 
  }, [])
  
  // Ensure scroll container is properly set up
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.overflow = 'auto'
    }
    
    // Clean up any pending batching operation on unmount
    return () => {
      if (batchingTimeoutRef.current) {
        clearTimeout(batchingTimeoutRef.current)
      }
    }
  }, [])
  
  // Determine if we have valid data to display
  const hasData = data !== null && data !== undefined
  
  // Content of the data viewer
  const content = (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      bgcolor: 'background.paper',
      p: isModal ? 3 : 0,
      borderRadius: 2
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2 
      }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <Button 
            size="small" 
            onClick={expandAll}
            disabled={isExpanding}
            sx={{ 
              color: 'primary.main',
              '&:hover': { bgcolor: 'rgba(255, 152, 0, 0.08)' },
              minWidth: '80px'
            }}
          >
            {isExpanding ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1, color: 'primary.main' }} />
                Expanding...
              </>
            ) : (
              'Expand All'
            )}
          </Button>
          
          <Button 
            size="small" 
            onClick={collapseAll}
            disabled={isExpanding}
            sx={{ 
              color: 'primary.main',
              '&:hover': { bgcolor: 'rgba(255, 152, 0, 0.08)' }
            }}
          >
            Collapse All
          </Button>
          
          <Tooltip title={copied ? "Copied to clipboard!" : "Copy to clipboard"}>
            <IconButton 
              size="small" 
              onClick={handleCopy}
              sx={{ color: copied ? 'success.main' : 'inherit' }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          
          {isModal && (
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Box>
      
      <Paper 
        ref={scrollContainerRef}
        sx={{ 
          overflow: 'auto', 
          flex: 1,
          bgcolor: 'background.default',
          p: 2,
          borderRadius: 1,
          maxHeight: isModal ? 'calc(80vh - 100px)' : maxHeight,
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
        {hasData ? (
          <TreeNode 
            data={data} 
            path="root" 
            name={null}
            isLast={true}
            expandedPaths={expandedPaths}
            togglePath={togglePath}
          />
        ) : (
          <Typography 
            variant="body2" 
            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
          >
            No data available to display
          </Typography>
        )}
      </Paper>
    </Box>
  )
  
  // If used as a modal, wrap in Modal component
  if (isModal) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        aria-labelledby="raw-data-viewer-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: width,
          maxHeight: maxHeight,
          bgcolor: 'background.paper',
          boxShadow: 24,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {content}
        </Box>
      </Modal>
    )
  }
  
  // Otherwise, just return the content
  return content
} 