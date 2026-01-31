import React, { forwardRef, useState } from 'react';
import { colors, radius, transition } from '../../utils/styles';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  showCharCount?: boolean;
  maxLength?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      hint,
      fullWidth = true,
      showCharCount = false,
      maxLength,
      disabled,
      value,
      style,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const charCount = typeof value === 'string' ? value.length : 0;

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      width: fullWidth ? '100%' : 'auto',
    };

    const textareaStyle: React.CSSProperties = {
      width: '100%',
      minHeight: '100px',
      padding: '0.75rem 1rem',
      borderRadius: radius.md,
      border: `1px solid ${error ? colors.error : isFocused ? colors.primary : colors.border}`,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: '0.9rem',
      lineHeight: 1.5,
      outline: 'none',
      transition: transition.fast,
      resize: 'vertical',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
      boxShadow: isFocused && !error ? `0 0 0 2px ${colors.primary}30` : 'none',
      fontFamily: 'inherit',
      ...style,
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

        <textarea
          ref={ref}
          disabled={disabled}
          value={value}
          maxLength={maxLength}
          style={textareaStyle}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          
          {showCharCount && maxLength && (
            <span
              style={{
                fontSize: '0.7rem',
                color: charCount >= maxLength ? colors.error : colors.textMuted,
                marginLeft: 'auto',
              }}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default TextArea;
