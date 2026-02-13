import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Submission } from './types';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';

interface SubmissionsTabProps {
  submissions: Submission[];
  filter: string;
  onReview: (id: number, status: 'approved' | 'rejected') => void;
}

// Image modal for viewing screenshots
const ImageModal: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      cursor: 'zoom-out'
    }}
  >
    <img
      src={src}
      alt="Screenshot"
      style={{
        maxWidth: '90vw',
        maxHeight: '90vh',
        objectFit: 'contain',
        borderRadius: '8px'
      }}
    />
    <button
      onClick={onClose}
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        background: 'rgba(0,0,0,0.8)',
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        color: colors.text,
        cursor: 'pointer',
        fontSize: '1.5rem'
      }}
    >
      ×
    </button>
  </div>
);

export const SubmissionsTab: React.FC<SubmissionsTabProps> = ({
  submissions,
  filter,
  onReview
}) => {
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const { t } = useTranslation();

  if (submissions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
        No {filter} submissions
      </div>
    );
  }

  // Check if URL is a valid image URL (not a storage error marker)
  const isValidImageUrl = (url: string | null): boolean => {
    if (!url) return false;
    // Reject storage error markers
    if (url.startsWith('base64:') || url.startsWith('pending_upload:') || 
        url.startsWith('storage_unavailable:') || url.startsWith('storage_error:')) return false;
    return url.startsWith('http') || url.startsWith('data:image');
  };

  return (
    <>
      {viewingImage && <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {submissions.map((sub) => (
          <div key={sub.id} style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: colors.primary, fontWeight: 600 }}>K{sub.kingdom_number}</span>
                <span style={{ color: colors.textMuted }}> vs </span>
                <span style={{ color: colors.orange, fontWeight: 600 }}>K{sub.opponent_kingdom}</span>
                <span style={{ color: colors.textMuted, marginLeft: '1rem' }}>KvK #{sub.kvk_number}</span>
              </div>
              <div style={{ 
                padding: '0.25rem 0.75rem',
                backgroundColor: sub.status === 'pending' ? `${colors.gold}20` : sub.status === 'approved' ? `${colors.success}20` : `${colors.error}20`,
                color: sub.status === 'pending' ? colors.gold : sub.status === 'approved' ? colors.success : colors.error,
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {sub.status.toUpperCase()}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '0.875rem' }}>Prep: </span>
                <span style={{ color: sub.prep_result === 'W' ? colors.success : colors.error, fontWeight: 600 }}>
                  {sub.prep_result === 'W' ? 'Win' : 'Loss'}
                </span>
              </div>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '0.875rem' }}>Battle: </span>
                <span style={{ color: sub.battle_result === 'W' ? colors.success : colors.error, fontWeight: 600 }}>
                  {sub.battle_result === 'W' ? 'Win' : 'Loss'}
                </span>
              </div>
            </div>

            {/* Screenshot Previews */}
            {/* Show info message if screenshot upload failed - submission can still be reviewed */}
            {sub.screenshot_url && !isValidImageUrl(sub.screenshot_url) && (
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: `${colors.blue}10`, 
                border: `1px solid ${colors.blue}30`,
                borderRadius: '8px',
                marginBottom: '1rem',
                color: colors.blue,
                fontSize: '0.8rem'
              }}>
                📷 Screenshot was submitted but storage was unavailable. You can still review this submission based on the KvK data provided.
              </div>
            )}
            {(isValidImageUrl(sub.screenshot_url) || isValidImageUrl(sub.screenshot2_url)) && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {isValidImageUrl(sub.screenshot_url) && (
                  <div
                    onClick={() => setViewingImage(sub.screenshot_url!)}
                    style={{
                      cursor: 'zoom-in',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={sub.screenshot_url!}
                      alt="Screenshot 1"
                      style={{
                        width: '120px',
                        height: '80px',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: colors.textSecondary,
                      fontSize: '0.6rem',
                      padding: '0.15rem 0.25rem',
                      textAlign: 'center'
                    }}>
                      📷 Click to view
                    </div>
                  </div>
                )}
                {isValidImageUrl(sub.screenshot2_url) && (
                  <div
                    onClick={() => setViewingImage(sub.screenshot2_url!)}
                    style={{
                      cursor: 'zoom-in',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={sub.screenshot2_url!}
                      alt="Screenshot 2"
                      style={{
                        width: '120px',
                        height: '80px',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: colors.textSecondary,
                      fontSize: '0.6rem',
                      padding: '0.15rem 0.25rem',
                      textAlign: 'center'
                    }}>
                      📷 Click to view
                    </div>
                  </div>
                )}
              </div>
            )}

            {sub.notes && (
              <div style={{ color: colors.textSecondary, fontSize: '0.875rem', marginBottom: '1rem' }}>
                Notes: {sub.notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.border}`, paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                By{' '}
                {sub.submitter_name ? (
                  <Link 
                    to={`/players?search=${encodeURIComponent(sub.submitter_name)}`}
                    style={{ color: colors.primary, textDecoration: 'none' }}
                  >
                    {sub.submitter_name}
                  </Link>
                ) : (
                  <span style={{ color: colors.error }}>{t('admin.anonymous', 'Anonymous')}</span>
                )}
                {' '}• {new Date(sub.created_at).toLocaleDateString()}
              </div>
              
              {sub.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => onReview(sub.id, 'approved')} style={{ padding: '0.5rem 1rem', backgroundColor: colors.success, color: colors.text, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Approve
                  </button>
                  <button onClick={() => onReview(sub.id, 'rejected')} style={{ padding: '0.5rem 1rem', backgroundColor: colors.error, color: colors.text, border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default SubmissionsTab;
