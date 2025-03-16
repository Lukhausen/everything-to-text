# Everything to Text - PDF Processor

A client-side PDF processor built with React and PDF.js that extracts text and images from PDFs and displays them with interactive placeholders.

## Features

- Upload and process PDF files entirely in the browser (no server interaction)
- Extract text content from PDF documents
- Detect and extract images from PDF files
- Display text with interactive image placeholders
- Show image previews when hovering over placeholders
- Browse extracted images in a gallery view
- Download individual extracted images

## How it Works

This application uses PDF.js to process PDF files directly in the browser. When you upload a PDF, the app:

1. Reads the file and converts it to a format PDF.js can process
2. Extracts all text content from each page
3. Identifies images by examining the PDF's operator list
4. Extracts image data using canvas rendering
5. Places unique placeholders in the text where images appear
6. Displays the processed text with interactive placeholders
7. Shows image previews on hover and in a gallery view

## Technology Stack

- React 19
- Vite
- PDF.js (Mozilla's JavaScript PDF library)
- HTML5 Canvas API for image extraction

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/everything-to-text.git
cd everything-to-text

# Install dependencies
npm install
# or
yarn

# Start the development server
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173/` by default.

## Usage

1. Click the "Choose PDF file" button to select a PDF file
2. The application will process the PDF and extract text and images
3. The extracted text will be displayed with image placeholders (e.g. [IMAGE_1])
4. Hover over a placeholder to see a preview of the corresponding image
5. Browse the image gallery to see all extracted images
6. Click on any image in the gallery to see it in full size and download it

## Limitations

- Not all image types in PDFs can be extracted (depends on how they're encoded)
- Image positioning in the text may not exactly match the original PDF layout
- Very large PDFs may take time to process and may consume significant memory
- Complex PDF structures with layered elements may not be processed correctly

## License

MIT
