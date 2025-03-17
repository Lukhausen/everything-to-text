# Everything to Text - Utility Modules Documentation

Everything to Text is a client-side PDF processor that extracts text and images from PDFs, analyzes images using AI, and displays the results with interactive placeholders. This documentation focuses on the utility modules that power the application.

## Utility Modules Overview

The application is structured around several utility modules, each responsible for a specific aspect of the PDF processing and image analysis pipeline:

1. **PDF Processing**: `pdfUtils.js`
2. **Image Utilities**: `imageUtils.js`
3. **Image Analysis**: `imageAnalysisUtils.js`
4. **Batch Image Analysis**: `batchImageAnalysisUtils.js`
5. **Text Replacement**: `textReplacementUtils.js`
6. **Refusal Detection**: `refusalDetectionUtils.js`
7. **Retry Logic**: `retryUtils.js`

## PDF Processing (`pdfUtils.js`)

This module handles extracting text and images from PDF documents using PDF.js.

### Main Functions

- **`processPdfDocument(pdfData, options)`**: Processes a PDF document and extracts text with positioned image placeholders.
  - **Parameters**:
    - `pdfData`: ArrayBuffer or Uint8Array containing the PDF data
    - `options`: Object with processing options (onProgress, onLog callbacks)
  - **Returns**: Promise resolving to an object containing:
    - `success`: Boolean indicating success
    - `totalPages`: Number of pages processed
    - `pages`: Array of page objects with text content and image references
    - `images`: Array of extracted images
    
- **`generateTextRepresentation(pdfResult)`**: Generates a text representation of the PDF content.
  - **Parameters**:
    - `pdfResult`: The result object from processPdfDocument
  - **Returns**: String containing text with image placeholders

### Usage Example

```javascript
import { processPdfDocument, generateTextRepresentation } from './utils/pdfUtils';

// Process a PDF file
const fileArrayBuffer = await pdfFile.arrayBuffer();
const pdfResult = await processPdfDocument(fileArrayBuffer, {
  onProgress: (progress) => console.log(`Processing: ${Math.round(progress * 100)}%`),
  onLog: (message) => console.log(message)
});

// Generate text representation
const textContent = generateTextRepresentation(pdfResult);
console.log(textContent);
```

## Image Utilities (`imageUtils.js`)

This module provides utilities for image processing and comparison.

### Main Functions

- **`compareImages(dataURL1, dataURL2)`**: Compares two images and returns a similarity score.
  - **Parameters**:
    - `dataURL1`: Data URL of the first image
    - `dataURL2`: Data URL of the second image
  - **Returns**: Promise resolving to a similarity score (0-1)

- **`groupSimilarImages(images, threshold)`**: Groups similar images together based on similarity.
  - **Parameters**:
    - `images`: Array of image objects with dataURLs
    - `threshold`: Similarity threshold (0-1, default: 0.99)
  - **Returns**: Promise resolving to an array of unique images with combined IDs

### Usage Example

```javascript
import { compareImages, groupSimilarImages } from './utils/imageUtils';

// Compare two images
const similarity = await compareImages(image1DataURL, image2DataURL);
console.log(`Images are ${similarity * 100}% similar`);

// Group similar images
const uniqueImages = await groupSimilarImages(allImages, 0.95);
console.log(`Found ${uniqueImages.length} unique images out of ${allImages.length}`);
```

## Image Analysis (`imageAnalysisUtils.js`)

This module handles analyzing images using OpenAI's vision capabilities.

### Main Functions

- **`analyzeImage(base64Image, apiKey, options)`**: Analyzes an image using OpenAI's API.
  - **Parameters**:
    - `base64Image`: Base64-encoded image data
    - `apiKey`: OpenAI API key
    - `options`: Object with analysis options:
      - `model`: OpenAI model to use (default: "gpt-4o-mini")
      - `maxTokens`: Maximum tokens for response (default: 1000)
      - `temperature`: Temperature parameter (default: 0.7)
      - `maxRetries`: Maximum number of retries on failure (default: 3)
      - `maxRefusalRetries`: Maximum retries for refusal detection (default: 3)
  - **Returns**: Promise resolving to an object containing:
    - `success`: Boolean indicating success
    - `text`: Analysis text
    - `refusalDetected`: Boolean indicating if refusal was detected
    - `refusalRetries`: Number of refusal retries attempted

### Usage Example

```javascript
import { analyzeImage } from './utils/imageAnalysisUtils';

const result = await analyzeImage(imageBase64, 'your-openai-api-key', {
  model: 'gpt-4o-mini',
  temperature: 0.5,
  maxTokens: 500
});

if (result.success && !result.refusalDetected) {
  console.log('Image analysis:', result.text);
} else if (result.refusalDetected) {
  console.log('Analysis refused by AI');
} else {
  console.error('Analysis failed');
}
```

## Batch Image Analysis (`batchImageAnalysisUtils.js`)

This module handles batch processing of multiple images from PDF data.

### Main Functions

- **`processBatchImages(pdfData, apiKey, options, callbacks)`**: Process a batch of images from PDF data.
  - **Parameters**:
    - `pdfData`: PDF data object containing images
    - `apiKey`: OpenAI API key
    - `options`: Object with processing options:
      - `maxConcurrentRequests`: Maximum concurrent requests (default: 100)
      - `maxRefusalRetries`: Maximum refusal retries (default: 3)
      - `temperature`: Temperature parameter (default: 0.7)
      - `maxTokens`: Maximum tokens for response (default: 1000)
      - `model`: OpenAI model to use
    - `callbacks`: Object with callback functions:
      - `onProgress`: Called with progress updates
      - `onError`: Called on errors
      - `onComplete`: Called when processing completes
      - `onImageProcessed`: Called when an image is processed
  - **Returns**: Promise resolving to an object containing analysis results

- **`extractTextFromBatchResults(results, pdfData)`**: Extracts useful text content from batch results.
  - **Parameters**:
    - `results`: Array of image analysis results
    - `pdfData`: PDF data containing image information
  - **Returns**: Object with extracted text and statistics

### Usage Example

```javascript
import { processBatchImages, extractTextFromBatchResults } from './utils/batchImageAnalysisUtils';

// Process batch of images
const batchResults = await processBatchImages(pdfData, 'your-openai-api-key', {
  maxConcurrentRequests: 5,
  temperature: 0.5,
  model: 'gpt-4o-mini'
}, {
  onProgress: (status) => {
    console.log(`Processed ${status.processedCount}/${status.totalImages} images`);
  },
  onComplete: (results) => {
    console.log('Batch processing complete');
  }
});

// Extract text from results
const extracted = extractTextFromBatchResults(batchResults.results, pdfData);
console.log(`Extracted text from ${extracted.successfulImages} images`);
console.log(extracted.extractedText);
```

## Text Replacement (`textReplacementUtils.js`)

This module handles replacing placeholders with batch analysis results.

### Main Functions

- **`createTextReplacement(pdfData, batchResults)`**: Creates a replacement object that combines PDF data with batch analysis results.
  - **Parameters**:
    - `pdfData`: PDF data from processPdfDocument
    - `batchResults`: Batch analysis results for images
  - **Returns**: Object with the replaced content

### Usage Example

```javascript
import { createTextReplacement } from './utils/textReplacementUtils';

// Create text replacement
const replacementResult = createTextReplacement(pdfData, batchResults);

if (replacementResult.success) {
  console.log(`Replaced content for ${replacementResult.totalPages} pages`);
  console.log(replacementResult.pages[0].content); // First page content with replacements
}
```

## Refusal Detection (`refusalDetectionUtils.js`)

This module handles detecting if an AI response indicates a refusal to analyze content.

### Main Functions

- **`detectRefusal(responseText, apiKey, options)`**: Detects if a response from an LLM appears to be a refusal.
  - **Parameters**:
    - `responseText`: Text response from an LLM to analyze
    - `apiKey`: OpenAI API key
    - `options`: Object with detection options:
      - `temperature`: Temperature parameter (default: 0.1)
      - `model`: OpenAI model to use (default: "gpt-4o-mini")
      - `maxRetries`: Maximum retries (default: 3)
  - **Returns**: Promise resolving to an object containing:
    - `success`: Boolean indicating success
    - `isRefusal`: Boolean indicating if the response is a refusal

### Usage Example

```javascript
import { detectRefusal } from './utils/refusalDetectionUtils';

const analysisResponse = await llmAnalyzeImage(imageBase64);
const refusalCheck = await detectRefusal(analysisResponse, 'your-openai-api-key');

if (refusalCheck.success && refusalCheck.isRefusal) {
  console.log('The AI refused to analyze this image');
} else {
  console.log('Analysis accepted');
}
```

## Retry Logic (`retryUtils.js`)

This module provides utilities for handling retries with exponential backoff.

### Main Functions

- **`withRetry(fn, options)`**: Executes a function with retry logic and exponential backoff.
  - **Parameters**:
    - `fn`: The async function to execute and retry
    - `options`: Options for retry behavior:
      - `maxRetries`: Maximum number of retries (default: 3)
      - `baseDelay`: Base delay in ms (default: 500)
      - `maxDelay`: Maximum delay cap in ms (default: 8000)
      - `retryOnResult`: Function to check if result should trigger retry
      - `onRetry`: Callback when a retry occurs
      - `onError`: Error logging callback
  - **Returns**: Promise resolving to the result of the function or error details

### Usage Example

```javascript
import { withRetry } from './utils/retryUtils';

const fetchData = async () => {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) throw new Error('Failed to fetch');
  return await response.json();
};

const result = await withRetry(fetchData, {
  maxRetries: 5,
  baseDelay: 1000,
  onError: (message) => console.warn(`Retry error: ${message}`),
  retryOnResult: (result) => {
    // Retry if result is empty
    return result.data?.length === 0;
  }
});

console.log('Data retrieved:', result);
```

## Integration Example

Here's how to use these utilities together in a complete workflow:

```javascript
import { processPdfDocument } from './utils/pdfUtils';
import { processBatchImages } from './utils/batchImageAnalysisUtils';
import { createTextReplacement } from './utils/textReplacementUtils';

async function processPdfWithImageAnalysis(pdfFile, apiKey) {
  // Step 1: Process the PDF to extract text and images
  const pdfData = await processPdfDocument(await pdfFile.arrayBuffer(), {
    onProgress: (progress) => console.log(`PDF processing: ${Math.round(progress * 100)}%`)
  });
  
  // Step 2: Analyze all images in the PDF
  const batchResults = await processBatchImages(pdfData, apiKey, {
    maxConcurrentRequests: 3,
    model: 'gpt-4o-mini'
  }, {
    onProgress: (status) => console.log(`Image analysis: ${Math.round(status.progressPercentage)}%`)
  });
  
  // Step 3: Replace image placeholders with analysis results
  const textReplacement = createTextReplacement(pdfData, batchResults.results);
  
  return {
    originalPdfData: pdfData,
    analysisResults: batchResults.results,
    textWithAnalysis: textReplacement
  };
}

// Usage
const result = await processPdfWithImageAnalysis(pdfFile, 'your-openai-api-key');
console.log('Pages with image analysis:', result.textWithAnalysis.pages);
```

## Dependencies

- **PDF.js**: Mozilla's PDF parsing and rendering library
- **OpenAI**: API client for image analysis and refusal detection
- **Browser APIs**: Canvas API for image manipulation and extraction

## Limitations

- Image analysis requires a valid OpenAI API key with access to vision models
- Processing large PDFs may consume significant memory and processing power
- Accurate image extraction depends on the PDF structure and encoding format
- Refusal detection is based on heuristics and may not be 100% accurate
