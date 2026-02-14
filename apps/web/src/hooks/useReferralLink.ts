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
    if (!refCode) return null;
    const url = new URL(location.pathname, 'https://ks-atlas.com');
    // Preserve existing search params (e.g., ?kingdom=231)
    const currentParams = new URLSearchParams(location.search);
    currentParams.forEach((value, key) => {
      if (key !== 'ref' && key !== 'src') {
        url.searchParams.set(key, value);
      }
    });
    url.searchParams.set('ref', profile!.linked_username!);
    return url.toString();
  }, [refCode, location.pathname, location.search, profile]);

  const getReferralUrl = useCallback((path: string, extraParams?: Record<string, string>): string | null => {
    if (!refCode || !profile?.linked_username) return null;
    const url = new URL(path, 'https://ks-atlas.com');
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    url.searchParams.set('ref', profile.linked_username);
    return url.toString();
  }, [refCode, profile?.linked_username]);

  const copyCurrentPageLink = useCallback(async (): Promise<boolean> => {
    if (!referralUrl) return false;
    return copyToClipboard(referralUrl);
  }, [referralUrl]);

  return { eligible, referralUrl, refCode, copyCurrentPageLink, getReferralUrl };
};
