import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';

/**
 * Renders nothing visible — listens for kingdom transfer detection from AuthContext
 * and shows a persistent toast notification when a transfer is detected.
 */
const TransferDetectionToast: React.FC = () => {
  const { detectedTransfer, clearDetectedTransfer } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (detectedTransfer) {
      showToast(
        t('profile.kingdomTransferDetected', 'Kingdom transfer detected! You moved from K{{from}} to K{{to}}. Your profile has been updated.', {
          from: detectedTransfer.fromKingdom,
          to: detectedTransfer.toKingdom,
        }),
        'info',
        8000
      );
      clearDetectedTransfer();
    }
  }, [detectedTransfer, clearDetectedTransfer, showToast, t]);

  return null;
};

export default TransferDetectionToast;
