import React from 'react';

interface ScreenshotUploadProps {
  label: string;
  sublabel?: string;
  preview: string | null;
  onClear: () => void;
  onSelect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  compact?: boolean;
}

const ScreenshotUpload: React.FC<ScreenshotUploadProps> = ({
  label,
  sublabel,
  preview,
  onClear,
  onSelect,
  fileInputRef,
  onChange,
  compact = false,
}) => {
  return (
    <div>
      <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
        {label} {sublabel && <span style={{ color: '#6b7280' }}>{sublabel}</span>}
      </label>
      
      {!preview ? (
        <div
          onClick={onSelect}
          style={{
            border: '2px dashed #3a3a3a',
            borderRadius: '8px',
            padding: compact ? '1rem' : '1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            backgroundColor: '#0a0a0a'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#22d3ee50'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#3a3a3a'}
        >
          <div style={{ fontSize: compact ? '1.5rem' : '2rem', marginBottom: compact ? '0.25rem' : '0.5rem' }}>
            {compact ? '➕' : '📸'}
          </div>
          <div style={{ color: compact ? '#6b7280' : '#9ca3af', fontSize: compact ? '0.8rem' : '0.85rem' }}>
            {compact ? 'Add second screenshot' : 'Click to upload screenshot'}
          </div>
          {!compact && (
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              PNG, JPG up to 5MB
            </div>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <img
            src={preview}
            alt="Screenshot preview"
            style={{
              width: '100%',
              maxHeight: compact ? '150px' : '200px',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '1px solid #2a2a2a'
            }}
          />
          <button
            onClick={onClear}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid #3a3a3a',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem'
            }}
          >
            ×
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ScreenshotUpload;
