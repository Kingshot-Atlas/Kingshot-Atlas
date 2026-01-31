import React, { forwardRef } from 'react';
import { colors, radius, transition } from '../../utils/styles';
import { triggerHaptic } from '../../hooks/useHaptic';
import { useIsMobile } from '../../hooks/useMediaQuery';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  haptic?: boolean;
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.75rem',
    minHeight: '32px',
  },
  md: {
    padding: '0.6rem 1.25rem',
    fontSize: '0.85rem',
    minHeight: '40px',
  },
  lg: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.95rem',
    minHeight: '48px',
  },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: colors.primary,
    color: '#000',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: colors.primary,
    border: `1px solid ${colors.primary}40`,
  },
  danger: {
    backgroundColor: 'transparent',
    color: colors.error,
    border: `1px solid ${colors.error}40`,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  },
  success: {
    backgroundColor: colors.success,
    color: '#000',
    border: 'none',
  },
};

const Spinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
  const spinnerSize = size === 'sm' ? '12px' : size === 'md' ? '14px' : '16px';
  return (
    <span
      style={{
        display: 'inline-block',
        width: spinnerSize,
        height: spinnerSize,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'button-spin 0.6s linear infinite',
      }}
    />
  );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      haptic = true,
      disabled,
      children,
      onClick,
      style,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return;
      
      if (haptic && isMobile) {
        triggerHaptic('light');
      }
      
      onClick?.(e);
    };

    const baseStyles: React.CSSProperties = {
      display: fullWidth ? 'flex' : 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      borderRadius: radius.md,
      fontWeight: 600,
      cursor: loading || disabled ? 'not-allowed' : 'pointer',
      opacity: loading || disabled ? 0.6 : 1,
      transition: transition.fast,
      width: fullWidth ? '100%' : 'auto',
      minWidth: isMobile ? '44px' : 'auto',
      ...sizeStyles[size],
      ...variantStyles[variant],
    };

    // Mobile touch target adjustment
    if (isMobile && size === 'sm') {
      baseStyles.minHeight = '44px';
    }

    return (
      <>
        <button
          ref={ref}
          disabled={disabled || loading}
          onClick={handleClick}
          style={{ ...baseStyles, ...style }}
          {...props}
        >
          {loading ? (
            <>
              <Spinner size={size} />
              {children && <span>Loading...</span>}
            </>
          ) : (
            <>
              {icon && iconPosition === 'left' && icon}
              {children}
              {icon && iconPosition === 'right' && icon}
            </>
          )}
        </button>
        <style>{`
          @keyframes button-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }
);

Button.displayName = 'Button';

export default Button;
