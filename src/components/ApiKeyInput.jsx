import React, { useState } from 'react';
import '../styles/APIKeyInput.css';

/**
 * API Key input component
 * @param {Object} props
 * @param {string} props.value - Current API key value
 * @param {Function} props.onChange - Change handler function
 */
const APIKeyInput = ({ value = '', onChange }) => {
  const [showKey, setShowKey] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const handleToggleVisibility = () => {
    setShowKey(!showKey);
  };
  
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
  };
  
  // Display a simplified view if a key is already present
  const hasKey = value && value.length > 10;
  
  return (
    <div className={`api-key-input ${hasKey && !isFocused ? 'compact' : ''}`}>
      {(!hasKey || isFocused) && (
        <label htmlFor="openai-api-key" className="api-key-label">
          OpenAI API Key
        </label>
      )}
      
      <div className="api-key-field">
        {hasKey && !isFocused ? (
          // Compact view when key exists and not focused
          <>
            <div className="api-key-compact" onClick={() => setIsFocused(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              <span>API Key: ••••••••{value.slice(-4)}</span>
              <button 
                type="button" 
                className="edit-key"
                onClick={() => setIsFocused(true)}
              >
                Edit
              </button>
            </div>
          </>
        ) : (
          // Full input view
          <>
            <input
              id="openai-api-key"
              type={showKey ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="api-key-input-field"
              spellCheck="false"
              autoComplete="off"
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            
            <button 
              type="button"
              className="toggle-visibility"
              onClick={handleToggleVisibility}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </>
        )}
      </div>
      
      {(!hasKey || isFocused) && (
        <div className="api-key-help">
          Your API key is used locally and never stored on our servers.
        </div>
      )}
    </div>
  );
};

export default APIKeyInput; 