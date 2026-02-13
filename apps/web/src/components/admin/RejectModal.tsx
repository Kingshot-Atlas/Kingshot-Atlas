import React from 'react';

interface RejectModalProps {
  rejectModalOpen: { type: string; id: string };
  rejectReason: string;
  onRejectReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const RejectModal: React.FC<RejectModalProps> = ({
  rejectReason,
  onRejectReasonChange,
  onClose,
  onConfirm,
}) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}
    onClick={onClose}
  >
    <div
      style={{
        backgroundColor: '#131318',
        borderRadius: '16px',
        border: '1px solid #2a2a2a',
        padding: '1.5rem',
        maxWidth: '400px',
        width: '100%'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
        Reject with Reason
      </h2>
      <textarea
        value={rejectReason}
        onChange={(e) => onRejectReasonChange(e.target.value)}
        placeholder="Explain why this submission is being rejected..."
        rows={4}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          border: '1px solid #2a2a2a',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '0.9rem',
          resize: 'vertical',
          marginBottom: '1rem'
        }}
      />
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '0.6rem 1rem',
            backgroundColor: 'transparent',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '0.6rem 1rem',
            backgroundColor: '#ef4444',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}
        >
          Reject
        </button>
      </div>
    </div>
  </div>
);

export default RejectModal;
