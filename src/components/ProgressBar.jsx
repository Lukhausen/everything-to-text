import React from 'react';
import '../styles/ProgressBar.css';

/**
 * Progress bar component with optional label
 * @param {Object} props
 * @param {number} props.progress - Progress value (0-100)
 * @param {string} props.label - Optional progress label
 * @param {boolean} props.showPercentage - Whether to show percentage text
 * @param {string} props.size - Size of progress bar ('small', 'medium', 'large')
 */
const ProgressBar = ({ progress = 0, label, showPercentage = true, size = 'medium' }) => {
  // Ensure progress is between 0-100
  const safeProgress = Math.min(Math.max(0, progress), 100);
  const roundedProgress = Math.round(safeProgress);
  
  return (
    <div className="progress-container">
      {label && <div className="progress-label">{label}</div>}
      <div className={`progress-track ${size}`}>
        <div 
          className="progress-fill"
          style={{ width: `${safeProgress}%` }}
          aria-valuenow={roundedProgress}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
      {showPercentage && (
        <div className="progress-percentage">{roundedProgress}%</div>
      )}
    </div>
  );
};

export default ProgressBar; 