import React, { forwardRef, useState } from 'react';
import { colors, radius, transition } from '../../utils/styles';
import { useIsMobile } from '../../hooks/useMediaQuery';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const sizeStyles: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
  sm: {
    padding: '0.5rem 2rem 0.5rem 0.75rem',
    fontSize: '0.8rem',
    minHeight: '36px',
  },
  md: {
    padding: '0.75rem 2.5rem 0.75rem 1rem',
    fontSize: '0.9rem',
    minHeight: '44px',
  },
  lg: {
    padding: '0.875rem 2.5rem 0.875rem 1.25rem',
    fontSize: '1rem',
    minHeight: '52px',
  },
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      size = 'md',
      fullWidth = true,
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

    const selectWrapperStyle: React.CSSProperties = {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    };

    const selectStyle: React.CSSProperties = {
      width: '100%',
      borderRadius: radius.md,
      border: `1px solid ${error ? colors.error : isFocused ? colors.primary : colors.border}`,
      backgroundColor: colors.surface,
      color: colors.text,
      outline: 'none',
      transition: transition.fast,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: isFocused && !error ? `0 0 0 2px ${colors.primary}30` : 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      ...sizeStyles[size],
      ...style,
    };

    // Mobile touch target adjustment
    if (isMobile && size === 'sm') {
      selectStyle.minHeight = '44px';
      selectStyle.fontSize = '16px';
    }

    const chevronStyle: React.CSSProperties = {
      position: 'absolute',
      right: '0.75rem',
      pointerEvents: 'none',
      color: colors.textMuted,
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

        <div style={selectWrapperStyle}>
          <select
            ref={ref}
            disabled={disabled}
            style={selectStyle}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          <span style={chevronStyle}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
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

Select.displayName = 'Select';

export default Select;
