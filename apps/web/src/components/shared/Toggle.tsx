import React from 'react';
import { colors, transition } from '../../utils/styles';
import { triggerHaptic } from '../../hooks/useHaptic';
import { useIsMobile } from '../../hooks/useMediaQuery';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const sizeConfig = {
  sm: {
    track: { width: 36, height: 20, padding: 2 },
    thumb: { size: 16 },
  },
  md: {
    track: { width: 44, height: 24, padding: 2 },
    thumb: { size: 20 },
  },
};

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}) => {
  const isMobile = useIsMobile();
  const config = sizeConfig[size];

  const handleClick = () => {
    if (disabled) return;
    if (isMobile) {
      triggerHaptic('light');
    }
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    width: `${config.track.width}px`,
    height: `${config.track.height}px`,
    backgroundColor: checked ? colors.primary : colors.border,
    borderRadius: `${config.track.height}px`,
    transition: transition.fast,
    flexShrink: 0,
  };

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${config.track.padding}px`,
    left: checked 
      ? `${config.track.width - config.thumb.size - config.track.padding}px` 
      : `${config.track.padding}px`,
    width: `${config.thumb.size}px`,
    height: `${config.thumb.size}px`,
    backgroundColor: '#fff',
    borderRadius: '50%',
    transition: transition.fast,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  };

  const labelContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  };

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
    >
      <div style={trackStyle}>
        <div style={thumbStyle} />
      </div>

      {(label || description) && (
        <div style={labelContainerStyle}>
          {label && (
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: colors.text }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: '0.8rem', color: colors.textMuted, lineHeight: 1.4 }}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  indeterminate = false,
}) => {
  const isMobile = useIsMobile();

  const handleClick = () => {
    if (disabled) return;
    if (isMobile) {
      triggerHaptic('light');
    }
    onChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  const boxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    minWidth: '20px',
    backgroundColor: checked || indeterminate ? colors.primary : 'transparent',
    border: `2px solid ${checked || indeterminate ? colors.primary : colors.border}`,
    borderRadius: '4px',
    transition: transition.fast,
    flexShrink: 0,
    marginTop: '2px',
  };

  const labelContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  };

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={disabled ? -1 : 0}
    >
      <div style={boxStyle}>
        {checked && !indeterminate && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {indeterminate && (
          <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
            <rect width="10" height="2" fill="#000" rx="1"/>
          </svg>
        )}
      </div>

      {(label || description) && (
        <div style={labelContainerStyle}>
          {label && (
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: colors.text }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: '0.8rem', color: colors.textMuted, lineHeight: 1.4 }}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Toggle;
