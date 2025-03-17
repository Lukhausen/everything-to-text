import { useState } from 'react';
import PdfProcessor from './components/PdfProcessor';
import ImageAnalyzer from './components/ImageAnalyzer';

function App() {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' or 'image'
  const [sharedImageData, setSharedImageData] = useState('');
  
  // Function to handle sending an image from PDF Processor to Image Analyzer
  const handleSendToImageAnalyzer = (imageData) => {
    setSharedImageData(imageData);
    setActiveTab('image');
  };
  
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
        </div>
      </div>
      
      {activeTab === 'pdf' && <PdfProcessor onSendToImageAnalyzer={handleSendToImageAnalyzer} />}
      {activeTab === 'image' && <ImageAnalyzer initialImageData={sharedImageData} />}
    </div>
  );
}

export default App;
