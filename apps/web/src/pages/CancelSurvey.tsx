import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { FONT_DISPLAY, neonGlow } from '../utils/styles';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const CANCEL_REASONS = [
  { id: 'too_expensive', label: 'Too expensive for what I get' },
  { id: 'not_using', label: "I'm not using the premium features enough" },
  { id: 'missing_features', label: "Missing features I need" },
  { id: 'switching_game', label: "Switching to a different game" },
  { id: 'temporary', label: "Just need a break — might come back" },
  { id: 'other', label: 'Other reason' },
];

const CancelSurvey: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('cancelSurvey.title', 'We\'re sorry to see you go'));
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      if (supabase) {
        await supabase.from('churn_surveys').insert({
          user_id: user?.id || null,
          reason: selectedReason,
          feedback: additionalFeedback.trim() || null,
        });
      }
    } catch (err) {
      logger.error('Failed to save churn survey:', err);
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💜</div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>
            {t('cancelSurvey.thankYou', 'Thank you for your feedback')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('cancelSurvey.thankYouDesc', 'Your input helps us make Atlas better. Your free account stays active — all your data, favorites, and history are still here whenever you want to come back.')}
          </p>
          <Link to="/" style={{
            display: 'inline-block', padding: '0.6rem 1.5rem',
            backgroundColor: '#22d3ee', borderRadius: '8px',
            color: '#000', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem',
          }}>
            {t('cancelSurvey.backToAtlas', 'Back to Atlas')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem' }}>
            <span style={neonGlow('#FF6B8A')}>
              {t('cancelSurvey.heading', "We're sorry to see you go")}
            </span>
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.5 }}>
            {t('cancelSurvey.subheading', 'Help us improve — what made you cancel?')}
          </p>
        </div>

        {/* Pause offer */}
        <div style={{
          backgroundColor: '#111111',
          border: '1px solid #22d3ee30',
          borderRadius: '12px',
          padding: isMobile ? '1rem' : '1.25rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <p style={{ color: '#d1d5db', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {t('cancelSurvey.pauseOffer', 'Not ready to leave? You can pause your subscription for up to 3 months instead.')}
          </p>
          <Link to="/support?action=manage" style={{
            display: 'inline-block', padding: '0.45rem 1rem',
            backgroundColor: '#22d3ee20', border: '1px solid #22d3ee40', borderRadius: '6px',
            color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '600',
          }}>
            {t('cancelSurvey.pauseButton', 'Pause Instead')}
          </Link>
        </div>

        {/* Annual offer for monthly subscribers */}
        <div style={{
          backgroundColor: '#111111',
          border: '1px solid #FF6B8A30',
          borderRadius: '12px',
          padding: isMobile ? '1rem' : '1.25rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #FF6B8A08 100%)',
        }}>
          <p style={{ color: '#d1d5db', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {t('cancelSurvey.annualOffer', 'Switch to annual billing and save 17%')}
          </p>
          <p style={{ color: '#FF6B8A', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem' }}>
            $49.99/yr <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: '400', textDecoration: 'line-through' }}>$59.88/yr</span>
          </p>
          <Link to="/support" style={{
            display: 'inline-block', padding: '0.45rem 1rem',
            backgroundColor: '#FF6B8A', borderRadius: '6px',
            color: '#fff', textDecoration: 'none', fontSize: '0.8rem', fontWeight: '600',
          }}>
            {t('cancelSurvey.switchAnnual', 'Switch to Annual')}
          </Link>
        </div>

        {/* Survey reasons */}
        <div style={{
          backgroundColor: '#111111',
          borderRadius: '12px',
          padding: isMobile ? '1rem' : '1.25rem',
          border: '1px solid #2a2a2a',
        }}>
          <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1rem' }}>
            {t('cancelSurvey.reasonTitle', 'What was the main reason?')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {CANCEL_REASONS.map(reason => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: selectedReason === reason.id ? '#22d3ee15' : '#0a0a0a',
                  border: `1px solid ${selectedReason === reason.id ? '#22d3ee' : '#2a2a2a'}`,
                  borderRadius: '8px',
                  color: selectedReason === reason.id ? '#22d3ee' : '#d1d5db',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                {t(`cancelSurvey.reason_${reason.id}`, reason.label)}
              </button>
            ))}
          </div>

          {selectedReason && (
            <>
              <textarea
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
                placeholder={t('cancelSurvey.feedbackPlaceholder', 'Anything else you want us to know? (optional)')}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                  marginBottom: '1rem',
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  backgroundColor: '#22d3ee',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting
                  ? t('cancelSurvey.submitting', 'Submitting...')
                  : t('cancelSurvey.submit', 'Submit Feedback')}
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('cancelSurvey.skip', 'Skip — take me back to Atlas')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CancelSurvey;
