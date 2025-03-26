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
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  ButtonGroup,
  Chip,
  Grid,
  Badge,
  Slider,
} from '@mui/material'
import {
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
  DataObject as DataObjectIcon,
  FormatIndentIncrease as FormatIcon,
  TextSnippet as TextIcon,
  Description as DocumentIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  ZoomIn as ZoomInIcon,
} from '@mui/icons-material'
import { createTextReplacement, generateFormattedText } from '../utils/textReplacementUtils'
import ImageDetailModal from './ImageDetailModal'

// Helper function to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Text normalization utilities
const normalizeText = (text, context = 'display') => {
  if (!text) return '';
  // Trim leading/trailing whitespace and newlines
  return text.replace(/^[\s\n]+|[\s\n]+$/g, '');
};

// Default format settings
const DEFAULT_FORMAT_SETTINGS = {
  pageIndicators: {
    includePageHeadings: true,
    pageHeadingFormat: '//PAGE {pageNumber}:',
  },
  contentTypes: {
    pageHeading: {
      prefix: '#PAGE_{pageNumber}_START#',
      suffix: '#PAGE_{pageNumber}_END#'
    },
    pageScan: {
      prefix: '#FULL_PAGE_SCAN_PAGE_{pageNumber}_START#',
      suffix: '#FULL_PAGE_SCAN_PAGE_{pageNumber}_END#'
    },
    image: {
      prefix: '#IMAGE_CONTENT_PAGE_{pageNumber}_START#',
      suffix: '#IMAGE_CONTENT_PAGE_{pageNumber}_END#'
    },
    text: {
      prefix: '#TEXT_CONTENT_PAGE_{pageNumber}_START#',
      suffix: '#TEXT_CONTENT_PAGE_{pageNumber}_END#'
    }
  },
  spacing: {
    betweenPages: 3,            // Spacing between pages
    markerToContent: 2,         // Spacing between a marker and its content
    betweenContentSections: 3    // Spacing between different content sections on the same page
  }
};

// Helper function to format a slider label with the current value
const formatSliderLabel = (label, value) => `${label} (${value})`;

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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  
  // Image detail modal state
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageModalOpen, setImageModalOpen] = useState(false)

  // Format settings - load from localStorage if available
  const [formatSettings, setFormatSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('textFormatSettings');
      if (!savedSettings) return DEFAULT_FORMAT_SETTINGS;
      
      let parsedSettings = JSON.parse(savedSettings);
      
      // Clear localStorage if the format has changed to prevent errors
      if (parsedSettings && typeof parsedSettings === 'object' && !parsedSettings.pageIndicators) {
        console.log('Clearing old format settings from localStorage');
        localStorage.removeItem('textFormatSettings');
        return DEFAULT_FORMAT_SETTINGS;
      }
      
      // Ensure all required sections exist
      if (!parsedSettings.pageIndicators) parsedSettings.pageIndicators = DEFAULT_FORMAT_SETTINGS.pageIndicators;
      if (!parsedSettings.contentTypes) parsedSettings.contentTypes = DEFAULT_FORMAT_SETTINGS.contentTypes;
      if (!parsedSettings.spacing) parsedSettings.spacing = DEFAULT_FORMAT_SETTINGS.spacing;
      
      return parsedSettings;
    } catch (error) {
      console.error('Error loading format settings from localStorage:', error);
      // Clear potentially corrupted settings
      localStorage.removeItem('textFormatSettings');
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

  // Handle format setting change
  const handleFormatChange = (path, value) => {
    setFormatSettings(prevSettings => {
      // For nested paths (e.g., 'contentTypes.pageScan.prefix')
      if (path.includes('.')) {
        const parts = path.split('.');
        
        // For two-level nesting (e.g., 'spacing.beforePageHeading')
        if (parts.length === 2) {
          const [section, field] = parts;
          return {
            ...prevSettings,
            [section]: {
              ...prevSettings[section],
              [field]: value
            }
          };
        }
        
        // For three-level nesting (e.g., 'contentTypes.pageScan.prefix')
        if (parts.length === 3) {
          const [topSection, midSection, field] = parts;
          return {
            ...prevSettings,
            [topSection]: {
              ...prevSettings[topSection],
              [midSection]: {
                ...prevSettings[topSection]?.[midSection],
                [field]: value
              }
            }
          };
        }
      }
      
      // For top-level paths
      return {
        ...prevSettings,
        [path]: value
      };
    });
  };
  
  // Reset to default format settings
  const handleResetSettings = () => {
    setFormatSettings(DEFAULT_FORMAT_SETTINGS)
  }

  // Handle copy to clipboard
  const handleCopy = () => {
    if (!analysisResult) return;
    
    // Use the formatted text or fall back to basic extracted text
    const textToCopy = normalizeText(formattedText || analysisResult.extractedText, 'copy');
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(err => {
        console.error('Failed to copy text:', err)
      })
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
    
    // Get the formatted text
    let displayText = '';
    if (formattedText) {
      displayText = normalizeText(formattedText, 'display');
    } else if (analysisResult && analysisResult.extractedText) {
      displayText = normalizeText(analysisResult.extractedText, 'display');
    } else {
      return 'No extracted text available';
    }
    
    // Enable this flag to see all marker debugging info
    const DEBUG_MARKERS = debugMode && false; // Set to true to enable debug output
    
    // Remove duplicate placeholders as a final safety check
    displayText = displayText
      .replace(/(\[PAGE_IMAGE_\d+\])\s+(\1)(\s|$)/g, '$1$3')
      .replace(/(\[IMAGE_\d+\])\s+(\1)(\s|$)/g, '$1$3');
      
    // Escape the HTML to prevent injection
    const escapedText = displayText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    
    // Helper function to escape regex special characters in marker patterns
    const escapeRegexSpecialChars = (str) => {
      if (!str) return '';
      
      // First escape all regex special characters
      let escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Then replace {pageNumber} with the pattern for digits
      // Using a more specific replacement to avoid issues with partial matches
      escaped = escaped.replace(/\\\{pageNumber\\\}/g, '\\d+');
      
      // Add word boundary assertions for more precise matching
      // This helps with partial matches like "PAGE" vs "PAGE_"
      if (escaped.includes('PAGE') || escaped.includes('SCAN') || 
          escaped.includes('IMAGE') || escaped.includes('TEXT')) {
        // Make sure we're precisely matching these keywords
        escaped = escaped
          .replace(/PAGE/g, '(?:PAGE)')
          .replace(/SCAN/g, '(?:SCAN)')
          .replace(/IMAGE/g, '(?:IMAGE)')
          .replace(/TEXT/g, '(?:TEXT)');
      }
      
      return escaped;
    };
    
    // Get marker patterns from format settings or use defaults
    const pageHeadingPrefix = escapeRegexSpecialChars(formatSettings?.contentTypes?.pageHeading?.prefix || DEFAULT_FORMAT_SETTINGS.contentTypes.pageHeading.prefix);
    const pageHeadingSuffix = escapeRegexSpecialChars(formatSettings?.contentTypes?.pageHeading?.suffix || DEFAULT_FORMAT_SETTINGS.contentTypes.pageHeading.suffix);
    
    const pageScanPrefix = escapeRegexSpecialChars(formatSettings?.contentTypes?.pageScan?.prefix || DEFAULT_FORMAT_SETTINGS.contentTypes.pageScan.prefix);
    const pageScanSuffix = escapeRegexSpecialChars(formatSettings?.contentTypes?.pageScan?.suffix || DEFAULT_FORMAT_SETTINGS.contentTypes.pageScan.suffix);
    
    const imageContentPrefix = escapeRegexSpecialChars(formatSettings?.contentTypes?.image?.prefix || DEFAULT_FORMAT_SETTINGS.contentTypes.image.prefix);
    const imageContentSuffix = escapeRegexSpecialChars(formatSettings?.contentTypes?.image?.suffix || DEFAULT_FORMAT_SETTINGS.contentTypes.image.suffix);
    
    const textContentPrefix = escapeRegexSpecialChars(formatSettings?.contentTypes?.text?.prefix || DEFAULT_FORMAT_SETTINGS.contentTypes.text.prefix);
    const textContentSuffix = escapeRegexSpecialChars(formatSettings?.contentTypes?.text?.suffix || DEFAULT_FORMAT_SETTINGS.contentTypes.text.suffix);
    
    if (DEBUG_MARKERS) {
      console.log('Marker patterns:', {
        pageHeadingPrefix, pageHeadingSuffix,
        pageScanPrefix, pageScanSuffix,
        imageContentPrefix, imageContentSuffix,
        textContentPrefix, textContentSuffix
      });
      
      // Log actual marker occurrences in the text
      console.log('Page heading markers in text:',
        escapedText.match(new RegExp(pageHeadingPrefix, 'g')) || [], 
        escapedText.match(new RegExp(pageHeadingSuffix, 'g')) || []);
      console.log('Page scan markers in text:',
        escapedText.match(new RegExp(pageScanPrefix, 'g')) || [], 
        escapedText.match(new RegExp(pageScanSuffix, 'g')) || []);
    }
    
    // Replace the markers with styled spans - preserve exact marker text
    let formattedDisplayText = escapedText;
    
    // Apply replacements for each marker type
    // Page heading markers
    formattedDisplayText = formattedDisplayText
      .replace(new RegExp(`(${pageHeadingPrefix})`, 'g'), '<span class="marker page-heading-marker start-marker">$1</span>')
      .replace(new RegExp(`(${pageHeadingSuffix})`, 'g'), '<span class="marker page-heading-marker end-marker">$1</span>');
    
    // Full page scan markers - ensure these are properly styled as page-marker class
    formattedDisplayText = formattedDisplayText
      .replace(new RegExp(`(${pageScanPrefix})`, 'g'), '<span class="marker page-marker start-marker">$1</span>')
      .replace(new RegExp(`(${pageScanSuffix})`, 'g'), '<span class="marker page-marker end-marker">$1</span>');
    
    // Image content markers
    formattedDisplayText = formattedDisplayText
      .replace(new RegExp(`(${imageContentPrefix})`, 'g'), '<span class="marker image-marker start-marker">$1</span>')
      .replace(new RegExp(`(${imageContentSuffix})`, 'g'), '<span class="marker image-marker end-marker">$1</span>');
    
    // Text content markers
    formattedDisplayText = formattedDisplayText
      .replace(new RegExp(`(${textContentPrefix})`, 'g'), '<span class="marker text-marker start-marker">$1</span>')
      .replace(new RegExp(`(${textContentSuffix})`, 'g'), '<span class="marker text-marker end-marker">$1</span>');
    
    // Handle any exact patterns that might have been missed by the dynamic approach
    // This ensures backward compatibility with any hardcoded markers
    formattedDisplayText = formattedDisplayText
      // Page markers (fallback for any that weren't caught by the dynamic regex)
      .replace(/(#PAGE_\d+_START#)(?!<\/span>)/g, '<span class="marker page-heading-marker start-marker">$1</span>')
      .replace(/(#PAGE_\d+_END#)(?!<\/span>)/g, '<span class="marker page-heading-marker end-marker">$1</span>')
      // Full page scan markers (fallback)
      .replace(/(#FULL_PAGE_SCAN_PAGE_\d+_START#)(?!<\/span>)/g, '<span class="marker page-marker start-marker">$1</span>')
      .replace(/(#FULL_PAGE_SCAN_PAGE_\d+_END#)(?!<\/span>)/g, '<span class="marker page-marker end-marker">$1</span>')
      // Image content markers (fallback)
      .replace(/(#IMAGE_CONTENT_PAGE_\d+_START#)(?!<\/span>)/g, '<span class="marker image-marker start-marker">$1</span>')
      .replace(/(#IMAGE_CONTENT_PAGE_\d+_END#)(?!<\/span>)/g, '<span class="marker image-marker end-marker">$1</span>')
      // Text content markers (fallback)
      .replace(/(#TEXT_CONTENT_PAGE_\d+_START#)(?!<\/span>)/g, '<span class="marker text-marker start-marker">$1</span>')
      .replace(/(#TEXT_CONTENT_PAGE_\d+_END#)(?!<\/span>)/g, '<span class="marker text-marker end-marker">$1</span>');
    
    return formattedDisplayText;
  };

  // Get stats on the extraction results 
  const getStats = () => {
    if (!pdfResult || !analysisResult) return {};
    
    const pageCount = pdfResult.totalPages || 0;
    const imageCount = pdfResult.images?.length || 0;
    const analyzedCount = analysisResult.imageAnalysisResults?.length || 0;
    const successCount = analysisResult.imageAnalysisResults?.filter(r => r.success && !r.refusalDetected)?.length || 0;
    
    return { pageCount, imageCount, analyzedCount, successCount };
  }
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Get content for active tab
  const getActiveTabContent = () => {
    // Always show loading indicator if processing
    if (isLoading) {
      return (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      );
    }
    
    // For Raw Data tab (debug mode only)
    if (activeTab === 2 && debugMode) {
  return (
        <Box sx={{ 
          fontSize: '0.8rem',
          overflow: 'auto',
          height: '100%',
          bgcolor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          p: 2,
          borderRadius: 1
        }}>
          <Box 
            component="pre" 
          sx={{
              m: 0,
              whiteSpace: 'pre-wrap',
              overflowX: 'auto'
            }}
            dangerouslySetInnerHTML={{
              __html: (() => {
                try {
                  // Format the data for display with proper highlighting
                  const jsonStr = JSON.stringify({ pdfResult, analysisResult }, null, 2);
                  
                  // Basic syntax highlighting
                  return jsonStr
                    .replace(/"([^"]+)":/g, '<span style="color: #9cdcfe;">\"$1\"</span>:')
                    .replace(/: "([^"]+)"/g, ': <span style="color: #ce9178;">\"$1\"</span>')
                    .replace(/: ([0-9]+),/g, ': <span style="color: #b5cea8;">$1</span>,')
                    .replace(/: (true|false)/g, ': <span style="color: #569cd6;">$1</span>')
                    .replace(/null/g, '<span style="color: #569cd6;">null</span>');
                } catch (error) {
                  return `Error formatting JSON: ${error.message}`;
                }
              })()
            }}
          />
        </Box>
      );
    }
    
    // For the main text content tab
    if (activeTab === 0) {
      return (
        <>
          <style>
            {`
              .marker {
                display: inline-block;
                padding: 4px 8px;
                margin: 3px 1px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
                font-weight: bold;
                color: #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                letter-spacing: 0.7px;
                transition: all 0.2s ease;
                white-space: nowrap;
                user-select: none;
              }
              /* Page heading markers - dark gray */
              .page-heading-marker {
                background-color: #424242;
                border: 1px solid #212121;
                color: #ffffff;
              }
              /* Page scan markers - green */
              .page-marker {
                background-color: #2e7d32;
                border: 1px solid #1b5e20;
                color: #ffffff;
              }
              /* Image content markers - blue */
              .image-marker {
                background-color: #1976d2;
                border: 1px solid #0d47a1;
                color: #ffffff;
              }
              /* Text content markers - purple */
              .text-marker {
                background-color: #6a1b9a;
                border: 1px solid #4a148c;
                color: #ffffff;
              }
              /* Start markers with left border indicator */
              .start-marker {
                border-left: 4px solid rgba(255, 255, 255, 0.8);
              }
              /* End markers with right border indicator */
              .end-marker {
                border-right: 4px solid rgba(255, 255, 255, 0.8);
              }
              /* Add arrow indicator for start markers */
              .start-marker:before {
                content: "▶ ";
                opacity: 0.9;
              }
              /* Add arrow indicator for end markers */
              .end-marker:after {
                content: " ◀";
                opacity: 0.9;
              }
              /* Add hover effects for better user experience */
              .marker:hover {
                filter: brightness(110%);
                box-shadow: 0 3px 6px rgba(0,0,0,0.2);
                transform: translateY(-1px);
                cursor: default;
              }
              /* Ensure all markers are treated as inline blocks */
              span.marker {
                display: inline-block !important;
              }
            `}
          </style>
          <Box
            sx={{ 
              whiteSpace: 'pre-wrap', 
              overflowWrap: 'break-word',
              lineHeight: 1.6,
              fontFamily: 'monospace',
              fontSize: '0.95rem'
            }}
            dangerouslySetInnerHTML={{ __html: getDisplayText() }}
          />
        </>
      );
    }
    
    // For Document Overview tab (now tab index 1)
    if (activeTab === 1) {
      const stats = getStats();
      
      // Create a mapping of images by page number
      const imagesByPage = {};
      if (pdfResult && pdfResult.images) {
        pdfResult.images.forEach(image => {
          const pageNum = image.pageNumber;
          if (!imagesByPage[pageNum]) {
            imagesByPage[pageNum] = [];
          }
          imagesByPage[pageNum].push(image);
        });
      }

      // Create a mapping of analyzed images by ID
      const analyzedImagesMap = {};
      if (analysisResult && analysisResult.imageAnalysisResults) {
        analysisResult.imageAnalysisResults.forEach(result => {
          analyzedImagesMap[result.imageId] = result;
        });
      }
      
      return (
        <Stack spacing={2}>
          <Box sx={{ 
            p: 2, 
            bgcolor: 'background.paper', 
            borderRadius: 1 
          }}>
            <Typography variant="subtitle1" gutterBottom>Document Summary</Typography>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={2} 
              divider={<Divider orientation="vertical" flexItem />}
              sx={{ justifyContent: 'space-around', textAlign: 'center', my: 1 }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">Pages</Typography>
                <Typography variant="h6">{stats.pageCount}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Images</Typography>
                <Typography variant="h6">{stats.imageCount}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Analyzed</Typography>
                <Typography variant="h6" color="success.main">{stats.successCount}</Typography>
              </Box>
            </Stack>
          </Box>
          
          {pdfResult && pdfResult.pages && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Pages Overview</Typography>
              <Grid container spacing={1.5}>
                {pdfResult.pages.map((page, index) => {
                  // Get page number (1-based)
                  const pageNumber = page.pageNumber || (index + 1);
                  
                  // Get images for this page
                  const pageImages = imagesByPage[pageNumber] || [];
                  
                  // Get image references for this page
                  const imageRefs = page.imageReferences || [];
                  
                  // Separate full-page scans from embedded images
                  const pageScanImages = pageImages.filter(img => img.isFullPage);
                  const embeddedImages = pageImages.filter(img => !img.isFullPage);
                  
                  // Use embedded images for display if available, otherwise use all images
                  const displayImages = embeddedImages.length > 0 ? embeddedImages : pageImages;
                  
                  // Count analyzed images on this page
                  const analyzedImages = displayImages.filter(img => 
                    analyzedImagesMap[img.id] && 
                    analyzedImagesMap[img.id].success &&
                    !analyzedImagesMap[img.id].refusalDetected
                  );
                  
                  // Get page text content
                  const pageContent = page.content || {};
                  const pageText = pageContent.formattedText || pageContent.rawText || '';
                  const hasText = pageText && pageText.trim().length > 0;
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={pageNumber}>
                      <Paper
                        sx={{
                          height: '280px',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 1,
                          border: '1px solid rgba(0,0,0,0.1)',
                          position: 'relative',
                          overflow: 'hidden',
                          bgcolor: '#ffffff',
                          '&:hover': {
                            boxShadow: 1
                          }
                        }}
                      >
                        <Box 
                          sx={{ 
                            p: 0.75, 
                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                            bgcolor: 'background.default',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <Typography variant="subtitle2">Page {pageNumber}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {pageScanImages.length > 0 && (
                              <Chip
                                icon={<DocumentIcon style={{ fontSize: '0.9rem' }} />}
                                label={pageScanImages.length}
                                size="small"
                                color="info"
                                variant="outlined"
                                sx={{ height: '22px', '& .MuiChip-label': { px: 0.5 } }}
                              />
                            )}
                            {embeddedImages.length > 0 && (
                              <Chip
                                icon={<ImageIcon style={{ fontSize: '0.9rem' }} />}
                                label={embeddedImages.length}
                                size="small"
                                color="default"
                                variant="outlined"
                                sx={{ height: '22px', '& .MuiChip-label': { px: 0.5 } }}
                              />
                            )}
                          </Box>
                        </Box>
                        
                        <Box 
                          sx={{ 
                            p: 1, 
                            flex: 1, 
                            overflow: 'auto',
                            bgcolor: '#ffffff',
                            color: '#000000',
                            '&::-webkit-scrollbar': {
                              width: '4px',
                              height: '4px'
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              borderRadius: '2px'
                            }
                          }}
                        >
                          {hasText ? (
                            <Typography 
                              variant="body2" 
                              component="div"
                              sx={{ 
                                fontSize: '0.7rem',
                                lineHeight: 1.4,
                                whiteSpace: 'pre-wrap',
                                fontFamily: "'Roboto Mono', monospace"
                              }}
                            >
                              {(() => {
                                // Create a React fragment with text and image thumbnails
                                let content = pageText;
                                
                                // Replace image placeholders with actual thumbnails
                                if (displayImages.length > 0 || pageScanImages.length > 0) {
                                  const allImagesOnPage = [...pageScanImages, ...embeddedImages];
                                  
                                  // Replace each placeholder with a thumbnail
                                  allImagesOnPage.forEach(img => {
                                    // Extract image number from id (handling different ID formats)
                                    let imageNumber = null;
                                    
                                    if (img.id.includes('_')) {
                                      // Try to get the last part after underscore (typical format img_1_2)
                                      const parts = img.id.split('_');
                                      imageNumber = parts[parts.length - 1];
                                    } else if (/\d+/.test(img.id)) {
                                      // Extract any number in the ID
                                      const match = img.id.match(/\d+/);
                                      if (match) imageNumber = match[0];
                                    }
                                    
                                    if (!imageNumber) return;
                                    
                                    const placeholder = `[IMAGE_${imageNumber}]`;
                                    const pageScanPlaceholder = `[PAGE_IMAGE_${pageNumber}]`;
                                    
                                    // Prepare thumbnail URL
                                    const thumbnailUrl = img.dataURL;
                                    
                                    if (!thumbnailUrl) return;
                                    
                                    // Find any OCR text for this image
                                    let imageText = '';
                                    if (analysisResult && analysisResult.imageAnalysisResults) {
                                      const analysis = analysisResult.imageAnalysisResults.find(
                                        result => result.imageId === img.id
                                      );
                                      if (analysis && analysis.success && analysis.text) {
                                        // Use full text instead of truncating
                                        imageText = analysis.text;
                                          
                                        // Escape HTML to prevent injection
                                        imageText = imageText
                                          .replace(/&/g, '&amp;')
                                          .replace(/</g, '&lt;')
                                          .replace(/>/g, '&gt;')
                                          .replace(/"/g, '&quot;')
                                          .replace(/'/g, '&#039;');
                                          
                                        // Replace newlines with <br> for proper display
                                        imageText = imageText.replace(/\n/g, '<br>');
                                      }
                                    }
                                    
                                    // Create HTML for the image with text below
                                    const createImageWithText = (width, height) => {
                                      // Check if text is available
                                      const hasText = imageText && imageText.trim().length > 0;
                                      
                                      // Full width container
                                      let html = `
                                        <div class="image-with-text" style="display:block; width:100%; margin:8px 0; border:1px solid #eee; border-radius:4px; padding:0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); cursor:pointer;" onclick="window.openImageDetail('${img.id}')">
                                          <div style="position:relative; background:#f5f5f5; width:100%;">
                                            <img src="${thumbnailUrl}" alt="Image" style="display:block; width:100%; height:auto; max-height:180px; object-fit:contain;" />
                                            <div style="position:absolute; top:6px; right:6px; background:rgba(255,255,255,0.85); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">
                                              <svg style="width:18px; height:18px;" viewBox="0 0 24 24">
                                                <path fill="#666" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,4.5C7,4.5 5,6.5 5,9C5,11.5 7,13.5 9.5,13.5C12,13.5 14,11.5 14,9C14,6.5 12,4.5 9.5,4.5Z" />
                                              </svg>
                                            </div>
                                          </div>
                                      `;
                                      
                                      if (hasText) {
                                        html += `<div style="
                                          display: block; 
                                          font-size: 0.7rem; 
                                          line-height: 1.4; 
                                          color: #444; 
                                          background: #fff; 
                                          padding: 8px 12px; 
                                          border-top: 1px solid #eee;
                                          text-align: left;
                                          max-height: 120px;
                                          overflow-y: auto;
                                          scrollbar-width: thin;
                                          scrollbar-color: rgba(0,0,0,0.2) transparent;
                                        ">${imageText}</div>`;
                                      }
                                      
                                      html += '</div>';
                                      return html;
                                    };
                                    
                                    // Replace placeholders with image elements
                                    if (img.isFullPage && content.includes(pageScanPlaceholder)) {
                                      const regex = new RegExp(escapeRegExp(pageScanPlaceholder), 'g');
                                      const imgHtml = createImageWithText(54, 54);
                                      content = content.replace(regex, imgHtml);
                                    } else if (content.includes(placeholder)) {
                                      const regex = new RegExp(escapeRegExp(placeholder), 'g');
                                      const imgHtml = createImageWithText(40, 40);
                                      content = content.replace(regex, imgHtml);
                                    }
                                  });
                                  
                                  // Return as HTML
                                  return <div dangerouslySetInnerHTML={{ 
                                    __html: content,
                                    
                                  }} ref={el => {
                                    // Add a global function to handle image click
                                    if (el) {
                                      window.openImageDetail = (imageId) => {
                                        const img = allImagesOnPage.find(img => img.id === imageId);
                                        if (img) {
                                          handleOpenImageModal(img);
                                        }
                                      };
                                    }
                                  }} />;
                                }
                                
                                // No image placeholders, just return text
                                return content;
                              })()}
                            </Typography>
                          ) : (
                            <Box 
                              sx={{ 
                                height: '100%', 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Typography color="text.secondary" variant="body2">
                                No text content
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        
                        <Box 
                          sx={{ 
                            p: 0.75, 
                            borderTop: '1px solid rgba(0,0,0,0.08)',
                            bgcolor: 'background.default',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.75rem'
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {hasText ? 
                              `${pageText.trim().split(/\s+/).filter(Boolean).length} words` : 
                              "No text"
                            }
                          </Typography>
                          
                          <Typography variant="caption" color="text.secondary">
                            {pageScanImages.length > 0 ? "Page scan" : ""}
                            {pageScanImages.length > 0 && embeddedImages.length > 0 ? " + " : ""}
                            {embeddedImages.length > 0 ? `${embeddedImages.length} image${embeddedImages.length !== 1 ? "s" : ""}` : ""}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Stack>
      );
    }
    
    // Fallback
    return <Typography>No content available</Typography>;
  };

  // Handle opening the image detail modal
  const handleOpenImageModal = (image) => {
    setSelectedImage(image)
    setImageModalOpen(true)
  }
  
  // Handle closing the image detail modal
  const handleCloseImageModal = () => {
    setImageModalOpen(false)
  }

  return (
    <Stack spacing={2} width="100%">
      {error && (
        <Alert severity="error">{error}</Alert>
      )}
      
      <Paper
        sx={{
          p: { xs: 1.5, sm: 2 },
          bgcolor: 'background.paper',
          borderRadius: 1,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">Analysis Results</Typography>
          
          <ButtonGroup variant="outlined" size="small">
            <Button 
              variant="contained" 
              disableElevation
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              color={copied ? "success" : "primary"}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
            >
              Download
            </Button>
          </ButtonGroup>
        </Box>

        <Divider sx={{ my: 1 }} />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ '& .MuiTab-root': { minWidth: 'auto', py: 1, px: 2 } }}
          >
            <Tab icon={<TextIcon />} iconPosition="start" label="Full Text" />
            <Tab icon={<DocumentIcon />} iconPosition="start" label="Overview" />
            {debugMode && <Tab icon={<DataObjectIcon />} iconPosition="start" label="Raw Data" />}
          </Tabs>
            </Box>
        
            <Box sx={{ 
          position: 'relative',
          bgcolor: 'background.default', 
          p: 1.5, 
              borderRadius: 1,
          height: '500px',
              overflow: 'auto',
              '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'grey.500',
            borderRadius: '3px'
          }
        }}>
          {getActiveTabContent()}
        </Box>
        
        <Box mt={1.5}>
          <Button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            startIcon={showAdvancedSettings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            endIcon={<FormatIcon />}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            Text Format Settings
          </Button>
              
          <Collapse in={showAdvancedSettings}>
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Customize text output format
                </Typography>
                <Button 
                  onClick={handleResetSettings}
                  size="small"
                  color="primary"
                >
                  Reset Defaults
                </Button>
              </Box>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={formatSettings?.pageIndicators?.includePageHeadings ?? DEFAULT_FORMAT_SETTINGS.pageIndicators.includePageHeadings}
                    onChange={(e) => handleFormatChange('pageIndicators.includePageHeadings', e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="body2">Include page headings</Typography>}
              />
              
              {(formatSettings?.pageIndicators?.includePageHeadings ?? DEFAULT_FORMAT_SETTINGS.pageIndicators.includePageHeadings) && (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    label="Page Heading Format"
                    value={formatSettings?.pageIndicators?.pageHeadingFormat ?? DEFAULT_FORMAT_SETTINGS.pageIndicators.pageHeadingFormat}
                    onChange={(e) => handleFormatChange('pageIndicators.pageHeadingFormat', e.target.value)}
                    helperText="Use {pageNumber} for page numbers and \n for line breaks"
                    margin="dense"
                  />
                  
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Page Heading Prefix Marker"
                      value={formatSettings?.contentTypes?.pageHeading?.prefix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.pageHeading.prefix}
                      onChange={(e) => handleFormatChange('contentTypes.pageHeading.prefix', e.target.value)}
                      margin="dense"
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Page Heading Suffix Marker"
                      value={formatSettings?.contentTypes?.pageHeading?.suffix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.pageHeading.suffix}
                      onChange={(e) => handleFormatChange('contentTypes.pageHeading.suffix', e.target.value)}
                      margin="dense"
                    />
                  </Stack>
                </>
              )}
              
            <Divider sx={{ my: 1 }} />
              
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Page Content Formatting</Typography>
              
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Page Content Prefix"
                  value={formatSettings?.contentTypes?.pageScan?.prefix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.pageScan.prefix}
                  onChange={(e) => handleFormatChange('contentTypes.pageScan.prefix', e.target.value)}
                  margin="dense"
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Page Content Suffix"
                  value={formatSettings?.contentTypes?.pageScan?.suffix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.pageScan.suffix}
                  onChange={(e) => handleFormatChange('contentTypes.pageScan.suffix', e.target.value)}
                  margin="dense"
                />
              </Stack>
              
            <Divider sx={{ my: 1 }} />
              
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Image Content Formatting</Typography>
              
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Image Content Prefix"
                  value={formatSettings?.contentTypes?.image?.prefix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.image.prefix}
                  onChange={(e) => handleFormatChange('contentTypes.image.prefix', e.target.value)}
                  margin="dense"
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Image Content Suffix"
                  value={formatSettings?.contentTypes?.image?.suffix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.image.suffix}
                  onChange={(e) => handleFormatChange('contentTypes.image.suffix', e.target.value)}
                  margin="dense"
                />
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Text Content Formatting</Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
              <TextField
                fullWidth
                size="small"
                label="Text Content Prefix"
                value={formatSettings?.contentTypes?.text?.prefix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.text.prefix}
                onChange={(e) => handleFormatChange('contentTypes.text.prefix', e.target.value)}
                margin="dense"
              />
              <TextField
                fullWidth
                size="small"
                label="Text Content Suffix"
                value={formatSettings?.contentTypes?.text?.suffix ?? DEFAULT_FORMAT_SETTINGS.contentTypes.text.suffix}
                onChange={(e) => handleFormatChange('contentTypes.text.suffix', e.target.value)}
                margin="dense"
              />
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Spacing Controls</Typography>

            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {formatSliderLabel('Space between pages', formatSettings?.spacing?.betweenPages ?? DEFAULT_FORMAT_SETTINGS.spacing.betweenPages)}
              </Typography>
              <Slider
                value={formatSettings?.spacing?.betweenPages ?? DEFAULT_FORMAT_SETTINGS.spacing.betweenPages}
                onChange={(_, value) => handleFormatChange('spacing.betweenPages', value)}
                step={1}
                marks
                min={0}
                max={10}
                valueLabelDisplay="auto"
                size="small"
              />
              
              <Typography variant="caption" color="text.secondary" gutterBottom sx={{ mt: 2, display: 'block' }}>
                {formatSliderLabel('Space between a marker and its content', formatSettings?.spacing?.markerToContent ?? DEFAULT_FORMAT_SETTINGS.spacing.markerToContent)}
              </Typography>
              <Slider
                value={formatSettings?.spacing?.markerToContent ?? DEFAULT_FORMAT_SETTINGS.spacing.markerToContent}
                onChange={(_, value) => handleFormatChange('spacing.markerToContent', value)}
                step={1}
                marks
                min={0}
                max={10}
                valueLabelDisplay="auto"
                size="small"
              />
              
              <Typography variant="caption" color="text.secondary" gutterBottom sx={{ mt: 2, display: 'block' }}>
                {formatSliderLabel('Space between different content sections on the same page', formatSettings?.spacing?.betweenContentSections ?? DEFAULT_FORMAT_SETTINGS.spacing.betweenContentSections)}
              </Typography>
              <Slider
                value={formatSettings?.spacing?.betweenContentSections ?? DEFAULT_FORMAT_SETTINGS.spacing.betweenContentSections}
                onChange={(_, value) => handleFormatChange('spacing.betweenContentSections', value)}
                step={1}
                marks
                min={0}
                max={10}
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>
          </Collapse>
        </Box>
      </Paper>
      
      {/* Image Detail Modal */}
      {selectedImage && (
        <ImageDetailModal 
          open={imageModalOpen}
          onClose={handleCloseImageModal}
          image={selectedImage}
          analysis={
            analysisResult?.imageAnalysisResults?.find(
              item => item.imageId === selectedImage.id
            )
          }
        />
      )}
    </Stack>
  )
} 