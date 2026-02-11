import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const FEEDBACK_HIDDEN_KEY = 'atlas_feedback_hidden';
const FEEDBACK_HIDDEN_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface FeedbackWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
}

type FeedbackType = 'bug' | 'feature' | 'general';

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ position = 'bottom-right' }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isHidden, setIsHidden] = useState(() => {
    try {
      const hiddenUntil = localStorage.getItem(FEEDBACK_HIDDEN_KEY);
      if (hiddenUntil && Date.now() < Number(hiddenUntil)) return true;
      if (hiddenUntil) localStorage.removeItem(FEEDBACK_HIDDEN_KEY);
    } catch { /* ignore */ }
    return false;
  });
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter your feedback');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://kingshot-atlas.onrender.com'}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          message: message.trim(),
          email: email.trim() || (user?.email ?? null),
          user_id: user?.id ?? null,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      setSubmitted(true);
      setMessage('');
      setEmail('');
      
      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
      }, 2000);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const positionStyles = position === 'bottom-right' 
    ? { right: '1rem', bottom: '1rem' }
    : { left: '1rem', bottom: '1rem' };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.setItem(FEEDBACK_HIDDEN_KEY, String(Date.now() + FEEDBACK_HIDDEN_DURATION));
    } catch { /* ignore */ }
    setIsHidden(true);
  };

  if (isHidden) return null;

  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          ...positionStyles,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0',
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          data-testid="feedback-trigger"
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#22d3ee',
            color: '#000',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#06b6d4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#22d3ee';
          }}
        >
          💬 {t('feedback.title', 'Feedback')}
        </button>
        <button
          onClick={handleDismiss}
          data-testid="feedback-dismiss"
          aria-label={t('feedback.hide', 'Hide feedback button')}
          style={{
            padding: '0.75rem 0.5rem',
            backgroundColor: '#1aa3b8',
            color: '#000',
            border: 'none',
            borderRadius: '0 8px 8px 0',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'background-color 0.2s',
            minWidth: '28px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0e7490';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1aa3b8';
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="feedback-widget"
      style={{
        position: 'fixed',
        ...positionStyles,
        zIndex: 1000,
        width: '320px',
        backgroundColor: '#111111',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderBottom: '1px solid #2a2a2a',
        backgroundColor: '#0a0a0a',
      }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '600' }}>
          {t('feedback.sendFeedback', 'Send Feedback')}
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: 1,
            padding: '0.25rem',
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ color: '#22c55e', fontWeight: '500', margin: 0 }}>
              {t('feedback.thanks', 'Thanks for your feedback!')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Feedback Type */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                {t('feedback.type', 'Type')}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['bug', 'feature', 'general'] as FeedbackType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFeedbackType(type)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: feedbackType === type ? '#22d3ee20' : '#1a1a1a',
                      border: `1px solid ${feedbackType === type ? '#22d3ee' : '#333'}`,
                      borderRadius: '6px',
                      color: feedbackType === type ? '#22d3ee' : '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type === 'bug' && '🐛 '}
                    {type === 'feature' && '✨ '}
                    {type === 'general' && '💭 '}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                {t('feedback.yourFeedback', 'Your feedback')}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  feedbackType === 'bug' ? "What's not working? Steps to reproduce help us fix it faster..."
                  : feedbackType === 'feature' ? "What would make Atlas better for you?"
                  : "Share your thoughts with us..."
                }
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Email (optional for non-logged in users) */}
            {!user && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  {t('feedback.emailOptional', 'Email (optional, for follow-up)')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: isSubmitting ? '#666' : '#22d3ee',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
              }}
            >
              {isSubmitting ? t('feedback.sending', 'Sending...') : t('feedback.sendFeedback', 'Send Feedback')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackWidget;
