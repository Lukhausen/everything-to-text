import { useState } from 'react';
import PdfProcessor from './components/PdfProcessor';
import ImageAnalyzer from './components/ImageAnalyzer';
import BatchImageAnalyzer from './components/BatchImageAnalyzer';
import TextReplacementViewer from './components/TextReplacementViewer';

function App() {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf', 'image', 'batch', or 'text'
  const [sharedImageData, setSharedImageData] = useState('');
  const [pdfData, setPdfData] = useState(null);
  const [analysisResults, setAnalysisResults] = useState([]);
  
  // Function to handle sending an image from PDF Processor to Image Analyzer
  const handleSendToImageAnalyzer = (imageData) => {
    setSharedImageData(imageData);
    setActiveTab('image');
  };
  
  // Function to handle PDF data for batch processing
  const handlePdfProcessed = (data) => {
    setPdfData(data);
  };
  
  // Function to handle analysis results from BatchImageAnalyzer
  const handleAnalysisComplete = (results) => {
    setAnalysisResults(results);
  };
  
  // Function to navigate to the batch tab
  const navigateToBatch = () => {
    setActiveTab('batch');
  };
  
  // Function to navigate to the text replacement tab
  const navigateToTextReplacement = () => {
    setActiveTab('text');
  };
  
  // Check if we have both PDF data and analysis results to enable the text replacement tab
  const canShowTextReplacement = pdfData && analysisResults && analysisResults.length > 0;
  
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h1 style={{ margin: '0 0 15px 0' }}>Everything to Text</h1>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setActiveTab('pdf')}
            style={{
              padding: '8px 15px',
              backgroundColor: activeTab === 'pdf' ? '#4CAF50' : '#f1f1f1',
              color: activeTab === 'pdf' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            PDF Processor
          </button>
          <button 
            onClick={() => setActiveTab('image')}
            style={{
              padding: '8px 15px',
              backgroundColor: activeTab === 'image' ? '#4CAF50' : '#f1f1f1',
              color: activeTab === 'image' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Image Analyzer
          </button>
          <button 
            onClick={() => setActiveTab('batch')}
            style={{
              padding: '8px 15px',
              backgroundColor: activeTab === 'batch' ? '#4CAF50' : '#f1f1f1',
              color: activeTab === 'batch' ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            Batch Analyzer
            {pdfData && pdfData.images && pdfData.images.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: '#ff4081',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {pdfData.images.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('text')}
            disabled={!canShowTextReplacement}
            style={{
              padding: '8px 15px',
              backgroundColor: activeTab === 'text' ? '#4CAF50' : !canShowTextReplacement ? '#e0e0e0' : '#f1f1f1',
              color: activeTab === 'text' ? 'white' : !canShowTextReplacement ? '#999' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: canShowTextReplacement ? 'pointer' : 'not-allowed',
              position: 'relative'
            }}
          >
            Text Replacement
            {canShowTextReplacement && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: '#ff4081',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {analysisResults.filter(r => r.success).length}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {activeTab === 'pdf' && 
        <PdfProcessor 
          onSendToImageAnalyzer={handleSendToImageAnalyzer} 
          onPdfProcessed={handlePdfProcessed} 
          navigateToBatch={navigateToBatch} 
        />
      }
      
      {activeTab === 'image' && 
        <ImageAnalyzer 
          initialImageData={sharedImageData} 
        />
      }
      
      {activeTab === 'batch' && 
        <BatchImageAnalyzer 
          pdfData={pdfData} 
          onAnalysisComplete={handleAnalysisComplete}
          onNavigateToTextReplacement={navigateToTextReplacement}
        />
      }
      
      {activeTab === 'text' && 
        <TextReplacementViewer 
          pdfData={pdfData}
          analysisResults={analysisResults}
        />
      }
    </div>
  );
}

export default App;
