/**
 * Hook for generating referral-aware URLs for the current page.
 * Any referral-eligible user (TC25+ linked account) can share any page
 * with their referral code automatically appended.
 */

import { useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isReferralEligible } from '../utils/constants';
import { copyToClipboard } from '../utils/sharing';

interface UseReferralLinkReturn {
  /** Whether the current user is eligible for referral links */
  eligible: boolean;
  /** The current page URL with ?ref= appended (null if not eligible) */
  referralUrl: string | null;
  /** The user's referral code (linked_username, URL-encoded) */
  refCode: string | null;
  /** Copy the referral link for the current page to clipboard */
  copyCurrentPageLink: () => Promise<boolean>;
  /** Generate a referral URL for any given path */
  getReferralUrl: (path: string, extraParams?: Record<string, string>) => string | null;
}

export const useReferralLink = (): UseReferralLinkReturn => {
  const { profile } = useAuth();
  const location = useLocation();

  const eligible = useMemo(
    () => !!profile && isReferralEligible(profile) && !!profile.linked_username,
    [profile]
  );

  const refCode = useMemo(
    () => (eligible && profile?.linked_username) ? encodeURIComponent(profile.linked_username) : null,
    [eligible, profile?.linked_username]
  );

  const referralUrl = useMemo(() => {
    if (!refCode || !profile?.linked_username) return null;
    // Build URL manually to keep Unicode characters readable (not percent-encoded)
    const currentParams = new URLSearchParams(location.search);
    const preserved: string[] = [];
    currentParams.forEach((value, key) => {
      if (key !== 'ref' && key !== 'src') {
        preserved.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });
    preserved.push(`ref=${encodeURIComponent(profile.linked_username)}`);
    return `https://ks-atlas.com${location.pathname}?${preserved.join('&')}`;
  }, [refCode, location.pathname, location.search, profile]);

  const getReferralUrl = useCallback((path: string, extraParams?: Record<string, string>): string | null => {
    if (!refCode || !profile?.linked_username) return null;
    // Build URL manually to keep Unicode characters readable
    const parts: string[] = [];
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
    }
    parts.push(`ref=${encodeURIComponent(profile.linked_username)}`);
    return `https://ks-atlas.com${path}?${parts.join('&')}`;
  }, [refCode, profile?.linked_username]);

  const copyCurrentPageLink = useCallback(async (): Promise<boolean> => {
    if (!referralUrl) return false;
    return copyToClipboard(referralUrl);
  }, [referralUrl]);

  return { eligible, referralUrl, refCode, copyCurrentPageLink, getReferralUrl };
};
