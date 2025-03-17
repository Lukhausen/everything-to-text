import React from 'react';
import '../styles/Stepper.css';

/**
 * Stepper component for multi-step process navigation
 * @param {Object} props
 * @param {number} props.currentStep - Current active step (1-based)
 * @param {Array} props.steps - Array of step objects with name and icon properties
 * @param {Function} props.onStepClick - Callback when a step is clicked, receives step number
 * @param {boolean} props.isProcessing - Whether processing is in progress (to disable navigation)
 * @param {number} props.maxCompletedStep - The furthest step that has been reached
 */
const Stepper = ({ 
  currentStep, 
  steps, 
  onStepClick, 
  isProcessing = false,
  maxCompletedStep = currentStep 
}) => {
  // Handle click on a step
  const handleStepClick = (stepNumber) => {
    // Allow clicking on any completed step (up to maxCompletedStep)
    // but don't allow navigation during processing
    if (stepNumber <= maxCompletedStep && !isProcessing && onStepClick) {
      onStepClick(stepNumber);
    }
  };

  return (
    <div className="stepper">
      {steps.map((step, index) => {
        // Calculate step status
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        const isReachable = stepNumber <= maxCompletedStep;
        const isClickable = isReachable && !isProcessing && stepNumber !== currentStep;
        
        return (
          <div 
            key={step.name} 
            className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
            onClick={() => handleStepClick(stepNumber)}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? `Go to ${step.name}` : undefined}
          >
            <div className="stepper-indicator">
              {isCompleted ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                stepNumber
              )}
            </div>
            <div className="stepper-text">
              {step.name}
            </div>
            {index < steps.length - 1 && <div className="stepper-connector"></div>}
          </div>
        );
      })}
    </div>
  );
};

export default Stepper; 