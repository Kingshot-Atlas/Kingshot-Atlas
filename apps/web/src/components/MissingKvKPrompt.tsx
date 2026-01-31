import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PostKvKSubmission from './PostKvKSubmission';

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
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Check if this KvK already exists
  const hasKvK = existingKvkNumbers.includes(kvkNumber);
  if (hasKvK) return null;

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

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none'
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#22d3ee',
    color: '#0a0a0a'
  };

  // Case 1: Not logged in
  if (!isLoggedIn) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          ⚠️ KvK #{kvkNumber} data missing
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Help complete this kingdom's history! Sign in to submit results.
        </p>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <button style={primaryButtonStyle}>
            Sign In to Submit
          </button>
        </Link>
      </div>
    );
  }

  // Case 2: Logged in but not linked
  if (!isLinked) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          ⚠️ KvK #{kvkNumber} data missing
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Link your Kingshot account to submit KvK results.
        </p>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <button style={primaryButtonStyle}>
            Link Kingshot Account
          </button>
        </Link>
      </div>
    );
  }

  // Case 3: Logged in and linked - can submit
  return (
    <>
      <div style={containerStyle}>
        <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          ⚠️ KvK #{kvkNumber} data missing
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          {isTheirKingdom 
            ? "Your kingdom is missing this KvK! Submit your results."
            : "Know this kingdom's KvK result? Help complete the data."
          }
        </p>
        <button 
          style={primaryButtonStyle}
          onClick={() => setShowSubmitModal(true)}
        >
          📊 Submit KvK #{kvkNumber} Result
        </button>
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
