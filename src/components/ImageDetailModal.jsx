import React from 'react';
import {
  Box,
  Typography,
  Modal,
  Paper,
  IconButton,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Image as ImageIcon,
} from '@mui/icons-material';

export default function ImageDetailModal({ open, onClose, image, analysis }) {
  // Return null if no image is provided
  if (!image) {
    return null;
  }

  // Determine the status
  const isProcessed = analysis !== undefined;
  const isSuccessful = isProcessed && analysis.success && !analysis.refusalDetected;
  const isRefused = isProcessed && analysis.success && analysis.refusalDetected;
  const isFailed = isProcessed && !analysis.success;

  // Determine image type
  const getImageType = () => {
    if (image.isForcedScan) {
      return { label: 'Forced Page Scan', color: 'secondary' };
    } else if (image.isFullPage && image.isScanned) {
      return { label: 'Full Page Scan', color: 'info' };
    } else if (image.isFullPage) {
      return { label: 'Full Page Content', color: 'info' };
    } else {
      return { label: 'Regular Image', color: 'default' };
    }
  };

  const imageType = getImageType();

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="image-detail-modal-title"
    >
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: '80%', md: '70%' },
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          boxShadow: 24,
          borderRadius: 2,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2" id="image-detail-modal-title">
            Image Details
          </Typography>
          <IconButton onClick={onClose} aria-label="close" size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Image Metadata */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip 
              icon={<ImageIcon fontSize="small" />} 
              label={`Page ${image.pageNumber}`} 
              variant="outlined" 
              size="small"
            />
            
            <Chip 
              label={`${image.width}×${image.height}px`} 
              variant="outlined" 
              size="small"
            />

            {isSuccessful && (
              <Chip 
                icon={<CheckCircleIcon fontSize="small" />} 
                label="Successfully analyzed"
                color="success"
                size="small"
              />
            )}

            {isRefused && (
              <Chip 
                icon={<InfoIcon fontSize="small" />} 
                label="No Content Available"
                color="warning"
                size="small"
              />
            )}

            {isFailed && (
              <Chip 
                icon={<InfoIcon fontSize="small" />} 
                label="No Content Available"
                color="error"
                size="small"
              />
            )}

            {!isProcessed && (
              <Chip 
                label="Waiting for analysis"
                variant="outlined"
                size="small"
              />
            )}

            <Chip 
              label={imageType.label}
              color={imageType.color}
              variant="outlined"
              size="small"
            />

            {image.scanReason && (
              <Chip 
                label={`Reason: ${image.scanReason.replace(/_/g, ' ')}`}
                variant="outlined"
                size="small"
              />
            )}
          </Stack>
        </Box>

        {/* Content Area */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          gap: 3, 
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Image Section */}
          <Box sx={{ 
            width: { xs: '100%', sm: '50%' },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflow: 'hidden',
          }}>
            {/* Image Container */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 1,
              p: 1,
              bgcolor: 'rgba(0,0,0,0.2)',
              height: { xs: '25vh', sm: '50vh' },
              overflow: 'hidden',
            }}>
              <Box 
                component="img"
                src={image.dataURL}
                alt={`Image from page ${image.pageNumber}`}
                sx={{ 
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  filter: !isSuccessful ? 'saturate(0.3)' : 'none',
                }}
              />
            </Box>
            
            {/* Detailed Image Properties */}
            <Box sx={{
              p: 1,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 1,
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: '10vh',
            }}>
              <Typography variant="subtitle2" gutterBottom>
                Image Properties
              </Typography>
              <Box component="dl" sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'max-content 1fr',
                gap: '0.25rem 0.75rem',
                m: 0
              }}>
                <Box component="dt" sx={{ fontWeight: 'bold' }}>ID:</Box>
                <Box component="dd" sx={{ m: 0 }}>{image.id}</Box>
                
                <Box component="dt" sx={{ fontWeight: 'bold' }}>Type:</Box>
                <Box component="dd" sx={{ m: 0 }}>{imageType.label}</Box>
                
                <Box component="dt" sx={{ fontWeight: 'bold' }}>Full Page:</Box>
                <Box component="dd" sx={{ m: 0 }}>{image.isFullPage ? 'Yes' : 'No'}</Box>
                
                <Box component="dt" sx={{ fontWeight: 'bold' }}>Scanned:</Box>
                <Box component="dd" sx={{ m: 0 }}>{image.isScanned ? 'Yes' : 'No'}</Box>
                
                <Box component="dt" sx={{ fontWeight: 'bold' }}>Forced Scan:</Box>
                <Box component="dd" sx={{ m: 0 }}>{image.isForcedScan ? 'Yes' : 'No'}</Box>
                
                {image.scanReason && (
                  <>
                    <Box component="dt" sx={{ fontWeight: 'bold' }}>Scan Reason:</Box>
                    <Box component="dd" sx={{ m: 0 }}>{image.scanReason}</Box>
                  </>
                )}
              </Box>
            </Box>
          </Box>

          {/* Analysis Text Section */}
          <Box sx={{ 
            width: { xs: '100%', sm: '50%' },
            overflow: 'auto',
            maxHeight: { xs: '30vh', sm: '60vh' },
            px: 1,
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
            <Typography variant="subtitle1" gutterBottom>
              Analysis Results
            </Typography>

            {isSuccessful && analysis.text ? (
              <>
                {analysis.analysisType && (
                  <Chip 
                    label={`Analysis Type: ${analysis.analysisType === 'page_description' ? 'Page Description' : 'General Image'}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mb: 1 }}
                  />
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {analysis.text}
                </Typography>
              </>
            ) : isRefused ? (
              <Typography variant="body2" color="warning.main">
                No content could be extracted from this image.
              </Typography>
            ) : isFailed ? (
              <Typography variant="body2" color="error.main">
                No content could be extracted from this image.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                This image has not been analyzed yet.
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
    </Modal>
  );
} 