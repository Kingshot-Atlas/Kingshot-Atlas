import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PostKvKSubmission from './PostKvKSubmission';
import { Button } from './shared';
import { useTranslation } from 'react-i18next';
import { getKvKSchedule } from '../constants';

interface MissingKvKPromptProps {
  kingdomNumber: number;
  kvkNumber: number;
  existingKvkNumbers: number[];
}

const MissingKvKPrompt: React.FC<MissingKvKPromptProps> = ({
  kingdomNumber,
  kvkNumber,
  existingKvkNumbers
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Check if this KvK already exists
  const hasKvK = existingKvkNumbers.includes(kvkNumber);
  if (hasKvK) return null;

  // Don't show submit prompt until Castle Battle has ended
  const schedule = getKvKSchedule(kvkNumber);
  if (new Date() < schedule.castleBattleEnd) return null;

  // Determine user state
  const isLoggedIn = !!user;
  const isLinked = !!profile?.linked_kingdom;
  const isTheirKingdom = profile?.linked_kingdom === kingdomNumber || profile?.home_kingdom === kingdomNumber;

  // Common styles
  const containerStyle: React.CSSProperties = {
    backgroundColor: '#1a1a1f',
    border: '1px dashed #3b3b45',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    textAlign: 'center'
  };

  // Case 1: Not logged in
  if (!isLoggedIn) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {t('missingKvk.dataMissing', '⚠️ KvK #{{num}} data missing', { num: kvkNumber })}
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {t('missingKvk.signInToHelp', "Help complete this kingdom's history! Sign in to submit results.")}
        </p>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <Button size="sm">
            {t('missingKvk.signInToSubmit', 'Sign In to Submit')}
          </Button>
        </Link>
      </div>
    );
  }

  // Case 2: Logged in but not linked
  if (!isLinked) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {t('missingKvk.dataMissing', '⚠️ KvK #{{num}} data missing', { num: kvkNumber })}
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {t('missingKvk.linkToSubmit', 'Link your Kingshot account to submit KvK results.')}
        </p>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <Button size="sm">
            {t('missingKvk.linkAccount', 'Link Kingshot Account')}
          </Button>
        </Link>
      </div>
    );
  }

  // Case 3: Logged in and linked but TC too low
  const tcLevel = profile?.linked_tc_level || 0;
  if (tcLevel < 20) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {t('missingKvk.dataMissing', '⚠️ KvK #{{num}} data missing', { num: kvkNumber })}
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {t('missingKvk.tcRequired', 'TC20+ required to submit KvK results (you\'re TC{{level}}).', { level: tcLevel || '?' })}
        </p>
      </div>
    );
  }

  // Case 4: Logged in, linked, and TC20+ - can submit
  return (
    <>
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {t('missingKvk.dataMissing', '⚠️ KvK #{{num}} data missing', { num: kvkNumber })}
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {isTheirKingdom 
            ? t('missingKvk.yourKingdomMissing', 'Your kingdom is missing this KvK! Submit your results.')
            : t('missingKvk.knowResult', "Know this kingdom's KvK result? Help complete the data.")
          }
        </p>
        <Button size="sm" onClick={() => setShowSubmitModal(true)}>
          {t('missingKvk.submitResult', '📊 Submit KvK #{{num}} Result', { num: kvkNumber })}
        </Button>
      </div>

      <PostKvKSubmission
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        defaultKingdom={kingdomNumber}
        defaultKvkNumber={kvkNumber}
      />
    </>
  );
};

export default MissingKvKPrompt;
