import React, { useState } from 'react';
import '../styles/AdvancedSettings.css';

/**
 * Advanced Settings component with collapsible interface
 * @param {Object} props
 * @param {Object} props.settings - Current settings object
 * @param {Function} props.onSettingsChange - Callback when settings are changed
 */
const AdvancedSettings = ({ settings, onSettingsChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle individual setting change
  const handleSettingChange = (key, value) => {
    // Convert numeric strings to numbers
    const processedValue = !isNaN(value) && value !== '' ? Number(value) : value;
    
    // Create a deep copy of the settings to avoid mutation
    const updatedSettings = {
      ...settings,
      processing: {
        ...settings.processing,
        [key]: processedValue
      }
    };

    // Call the callback with the updated settings
    onSettingsChange(updatedSettings);
  };

  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`advanced-settings ${isExpanded ? 'expanded' : ''}`}>
      <button 
        type="button" 
        className="settings-toggle" 
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
      >
        <span>Advanced Settings</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div className="settings-content">
        <div className="settings-group">
          <label className="setting-label">
            <span>Max Concurrent Requests</span>
            <input 
              type="number" 
              min="1" 
              max="100"
              value={settings.processing.maxConcurrentRequests} 
              onChange={(e) => handleSettingChange('maxConcurrentRequests', e.target.value)}
              className="setting-input"
            />
          </label>
          <p className="setting-help">Maximum number of images to process simultaneously (1-100)</p>
        </div>

        <div className="settings-group">
          <label className="setting-label">
            <span>Max Refusal Retries</span>
            <input 
              type="number" 
              min="0" 
              max="5"
              value={settings.processing.maxRefusalRetries} 
              onChange={(e) => handleSettingChange('maxRefusalRetries', e.target.value)}
              className="setting-input"
            />
          </label>
          <p className="setting-help">Number of retries if AI refuses to analyze an image (0-5)</p>
        </div>

        <div className="settings-group">
          <label className="setting-label">
            <span>Temperature</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1"
              value={settings.processing.temperature} 
              onChange={(e) => handleSettingChange('temperature', e.target.value)}
              className="setting-range"
            />
            <span className="range-value">{settings.processing.temperature}</span>
          </label>
          <p className="setting-help">AI response creativity (0 = deterministic, 1 = creative)</p>
        </div>

        <div className="settings-group">
          <label className="setting-label">
            <span>AI Model</span>
            <select 
              value={settings.processing.model} 
              onChange={(e) => handleSettingChange('model', e.target.value)}
              className="setting-select"
            >
              <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
              <option value="gpt-4o">GPT-4o (Higher Quality)</option>
            </select>
          </label>
          <p className="setting-help">Model used for image analysis</p>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettings; 