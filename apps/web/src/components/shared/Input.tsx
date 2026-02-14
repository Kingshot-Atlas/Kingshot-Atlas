import React, { forwardRef, useState } from 'react';
import { colors, radius, transition } from '../../utils/styles';
import { useIsMobile } from '../../hooks/useMediaQuery';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeStyles: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
  sm: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    minHeight: '36px',
  },
  md: {
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    minHeight: '44px',
  },
  lg: {
    padding: '0.875rem 1.25rem',
    fontSize: '1rem',
    minHeight: '52px',
  },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      fullWidth = true,
      leftIcon,
      rightIcon,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile();
    const [isFocused, setIsFocused] = useState(false);

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      width: fullWidth ? '100%' : 'auto',
    };

    const inputWrapperStyle: React.CSSProperties = {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      borderRadius: radius.md,
      border: `1px solid ${error ? colors.error : isFocused ? colors.primary : colors.border}`,
      backgroundColor: colors.surface,
      color: colors.text,
      outline: 'none',
      transition: transition.fast,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
      boxShadow: isFocused && !error ? `0 0 0 2px ${colors.primary}30` : 'none',
      paddingLeft: leftIcon ? '2.5rem' : sizeStyles[size].padding,
      paddingRight: rightIcon ? '2.5rem' : sizeStyles[size].padding,
      ...sizeStyles[size],
      ...style,
    };

    // Mobile touch target adjustment
    if (isMobile) {
      inputStyle.fontSize = '16px'; // Prevents iOS zoom on all sizes
      if (size === 'sm') {
        inputStyle.minHeight = '44px';
      }
    }

    const iconStyle: React.CSSProperties = {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.textMuted,
      pointerEvents: 'none',
    };

    return (
      <div style={containerStyle}>
        {label && (
          <label
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: colors.textSecondary,
            }}
          >
            {label}
          </label>
        )}

        <div style={inputWrapperStyle}>
          {leftIcon && (
            <span style={{ ...iconStyle, left: '0.75rem' }}>{leftIcon}</span>
          )}

          <input
            ref={ref}
            disabled={disabled}
            style={inputStyle}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightIcon && (
            <span style={{ ...iconStyle, right: '0.75rem' }}>{rightIcon}</span>
          )}
        </div>

        {(error || hint) && (
          <span
            style={{
              fontSize: '0.75rem',
              color: error ? colors.error : colors.textMuted,
            }}
          >
            {error || hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
