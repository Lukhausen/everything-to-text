import React from 'react';
import '../styles/Button.css';

/**
 * Button component with multiple variants
 * @param {Object} props
 * @param {string} props.variant - Button variant ('primary', 'secondary', 'text', 'success', 'danger')
 * @param {boolean} props.fullWidth - Whether button should take full width
 * @param {boolean} props.isLoading - Whether button is in loading state
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {Function} props.onClick - Click handler
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.type - Button type attribute
 */
const Button = ({
  variant = 'primary',
  fullWidth = false,
  isLoading = false,
  disabled = false,
  onClick,
  children,
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${fullWidth ? 'full-width' : ''}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...rest}
    >
      {isLoading ? (
        <div className="btn-loader">
          <div className="loader-dot"></div>
          <div className="loader-dot"></div>
          <div className="loader-dot"></div>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button; 