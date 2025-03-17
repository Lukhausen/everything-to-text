import React from 'react';

function ProcessingProgress({ 
  current, 
  total, 
  status = 'Processing', 
  showDetails = true,
  logs = [] 
}) {
  // Calculate progress percentage
  const progressPercentage = total > 0 ? (current / total) * 100 : 0;
  const formattedPercentage = Math.round(progressPercentage);
  
  // Calculate color based on progress
  const getProgressColor = () => {
    if (progressPercentage < 30) return 'var(--warning-color)';
    if (progressPercentage < 70) return 'var(--primary-light)';
    return 'var(--success-color)';
  };

  return (
    <div className="processing-progress">
      <div className="flex justify-between items-center">
        <span className="text-sm">
          <strong>{status}</strong> ({formattedPercentage}%)
        </span>
        <span className="text-sm">
          {current} of {total}
        </span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-bar-fill"
          style={{ 
            width: `${progressPercentage}%`,
            backgroundColor: getProgressColor() 
          }}
        ></div>
      </div>
      
      {showDetails && (
        <div className="text-sm" style={{ color: '#666' }}>
          {total - current > 0 ? (
            <div>{total - current} remaining</div>
          ) : (
            <div>Completing final processing...</div>
          )}
        </div>
      )}
      
      {logs.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm cursor-pointer">Process Log ({logs.length} entries)</summary>
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '12px',
            backgroundColor: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            marginTop: '8px'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{
                borderBottom: index < logs.length - 1 ? '1px solid #eee' : 'none',
                padding: '3px 0'
              }}>
                {log}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default ProcessingProgress; 