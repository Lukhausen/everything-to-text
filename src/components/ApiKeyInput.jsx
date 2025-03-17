import { useState, useEffect } from 'react';

function ApiKeyInput({ onApiKeyChange, isCollapsible = true }) {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      if (onApiKeyChange) {
        onApiKeyChange(savedApiKey);
      }
    }
  }, [onApiKeyChange]);

  const handleApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    
    // Save to localStorage and notify parent
    localStorage.setItem('openai_api_key', newApiKey);
    if (onApiKeyChange) {
      onApiKeyChange(newApiKey);
    }
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // If key exists and component is collapsible, start collapsed
  useEffect(() => {
    if (apiKey && isCollapsible) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
    }
  }, [apiKey, isCollapsible]);

  // If not collapsible, always show the input
  if (!isCollapsible) {
    return (
      <div className="api-key-form">
        <div className="form-control">
          <label htmlFor="api-key">OpenAI API Key:</label>
          <div style={{ position: 'relative' }}>
            <input
              id="api-key"
              type={isVisible ? "text" : "password"}
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your OpenAI API key"
            />
            <button 
              type="button"
              className="api-key-toggle"
              onClick={toggleVisibility}
            >
              {isVisible ? "Hide" : "Show"}
            </button>
          </div>
          <p className="api-key-instructions">
            Your API key is stored in your browser's local storage.
          </p>
        </div>
      </div>
    );
  }

  // Collapsible version
  return (
    <div className="collapsible">
      <div 
        className="collapsible-header" 
        onClick={toggleExpanded}
      >
        <span>
          {apiKey ? 'API Key ✓' : 'API Key Required'}
        </span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </div>
      
      {isExpanded && (
        <div className="collapsible-content">
          <div className="form-control">
            <label htmlFor="api-key">OpenAI API Key:</label>
            <div style={{ position: 'relative' }}>
              <input
                id="api-key"
                type={isVisible ? "text" : "password"}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter your OpenAI API key"
              />
              <button 
                type="button"
                className="api-key-toggle"
                onClick={toggleVisibility}
              >
                {isVisible ? "Hide" : "Show"}
              </button>
            </div>
            <p className="api-key-instructions">
              Your API key is stored in your browser's local storage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiKeyInput; 