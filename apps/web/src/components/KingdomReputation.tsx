import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  kingdomReputationService,
  type ReviewType,
  type ReputationReview,
  type ReputationReviewWithVote,
  type ReputationSummary,
  type OfficialResponse,
  type VoteType,
  type ReportReason,
  getConfidenceLevel,
  getConfidenceLabel,
  getSignalDescriptor,
  generateSummarySentence,
} from '../services/kingdomReputationService';
import { logger } from '../utils/logger';

// ─── Sub-components ─────────────────────────────────────────

interface SignalCardProps {
  label: string;
  avg: number | null;
  reviewCount: number;
  color: string;
  isMobile: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ label, avg, reviewCount, color, isMobile }) => {
  const confidence = getConfidenceLevel(reviewCount);
  const hasData = avg !== null && avg > 0;

  return (
    <div style={{
      flex: 1,
      minWidth: isMobile ? '100%' : '140px',
      padding: isMobile ? '0.6rem' : '0.75rem',
      backgroundColor: '#1a1a22',
      borderRadius: '8px',
      border: `1px solid ${color}20`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: '500' }}>
        {label}
      </div>
      {hasData ? (
        <>
          <div style={{ fontSize: '1.3rem', fontWeight: '700', color }}>
            {avg!.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '0.1rem' }}>
            {getSignalDescriptor(avg!)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.8rem', color: '#4b5563', fontStyle: 'italic', padding: '0.25rem 0' }}>
          No data yet
        </div>
      )}
      {confidence === 'limited' && hasData && (
        <div style={{ fontSize: '0.55rem', color: '#6b7280', marginTop: '0.15rem' }}>
          ⚠ Limited data
        </div>
      )}
    </div>
  );
};

interface HeroSummaryProps {
  summary: ReputationSummary | null;
  reviewType: ReviewType;
  color: string;
  isMobile: boolean;
}

const HeroSummary: React.FC<HeroSummaryProps> = ({ summary, reviewType, color, isMobile }) => {
  const { t } = useTranslation();

  if (!summary || summary.review_count === 0) {
    return (
      <div style={{
        padding: isMobile ? '1.25rem 1rem' : '1.5rem',
        backgroundColor: '#131318',
        borderRadius: '12px',
        border: '1px solid #ffffff10',
        textAlign: 'center',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          {reviewType === 'citizen' ? '🏠' : '⚔️'}
        </div>
        <div style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>
          {reviewType === 'citizen'
            ? t('reputation.noCitizenReviews', 'No citizen reviews yet')
            : t('reputation.noRivalReviews', 'No rival reviews yet')}
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          {reviewType === 'citizen'
            ? t('reputation.citizenEmpty', 'Citizens of this kingdom can share their experience.')
            : t('reputation.rivalEmpty', 'Rival kingdoms that have battled this kingdom can rate it.')}
        </div>
      </div>
    );
  }

  const confidence = getConfidenceLevel(summary.review_count);
  const sentence = generateSummarySentence(summary, reviewType);

  const citizenSignals = [
    { label: t('reputation.signal.organization', 'Kingdom Organization'), avg: summary.avg_citizen_organization },
    { label: t('reputation.signal.leadership', 'Leadership Fairness'), avg: summary.avg_citizen_leadership },
    { label: t('reputation.signal.culture', 'Overall Culture'), avg: summary.avg_citizen_culture },
  ];

  const rivalSignals = [
    { label: t('reputation.signal.communication', 'Effective Communication'), avg: summary.avg_rival_communication },
    { label: t('reputation.signal.compliance', 'Rule Compliance'), avg: summary.avg_rival_compliance },
    { label: t('reputation.signal.sportsmanship', 'Good Sportsmanship'), avg: summary.avg_rival_sportsmanship },
  ];

  const signals = reviewType === 'citizen' ? citizenSignals : rivalSignals;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Hero Card */}
      <div style={{
        padding: isMobile ? '1rem' : '1.25rem',
        backgroundColor: '#131318',
        borderRadius: '12px',
        border: `1px solid ${color}30`,
        marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color,
            lineHeight: 1,
          }}>
            {summary.avg_overall.toFixed(1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '0.05rem', fontSize: '0.8rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} style={{ color: star <= Math.round(summary.avg_overall) ? '#fbbf24' : '#374151' }}>
                    ★
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                ({summary.review_count} {summary.review_count === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            <div style={{
              fontSize: '0.65rem',
              color: confidence === 'established' ? '#22c55e' : confidence === 'emerging' ? '#eab308' : '#6b7280',
              fontWeight: '500',
              marginTop: '0.15rem',
            }}>
              {getConfidenceLabel(confidence)}
            </div>
          </div>
        </div>
        {sentence && (
          <p style={{
            margin: 0,
            color: '#d1d5db',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            {sentence}
          </p>
        )}
      </div>

      {/* Signal Cards */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        {signals.map(s => (
          <SignalCard
            key={s.label}
            label={s.label}
            avg={s.avg}
            reviewCount={summary.review_count}
            color={color}
            isMobile={isMobile}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Review Card ────────────────────────────────────────────

interface ReviewCardProps {
  review: ReputationReviewWithVote;
  reviewType: ReviewType;
  response: OfficialResponse | null;
  isOwner: boolean;
  isAdmin: boolean;
  canVote: boolean;
  isMobile: boolean;
  onVote: (reviewId: string, voteType: VoteType) => void;
  onEdit: (review: ReputationReview) => void;
  onDelete: (reviewId: string) => void;
  onReport: (reviewId: string) => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  reviewType,
  response,
  isOwner,
  isAdmin,
  canVote,
  isMobile,
  onVote,
  onEdit,
  onDelete,
  onReport,
}) => {
  const { t } = useTranslation();

  const signals = reviewType === 'citizen'
    ? [
        { label: 'Organization', val: review.citizen_organization_rating },
        { label: 'Leadership', val: review.citizen_leadership_fairness_rating },
        { label: 'Culture', val: review.citizen_overall_culture_rating },
      ]
    : [
        { label: 'Communication', val: review.rival_communication_rating },
        { label: 'Compliance', val: review.rival_rule_compliance_rating },
        { label: 'Sportsmanship', val: review.rival_sportsmanship_rating },
      ];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  return (
    <div style={{
      padding: isMobile ? '0.75rem' : '1rem',
      backgroundColor: '#1a1a22',
      borderRadius: '10px',
      border: '1px solid #ffffff0a',
      marginBottom: '0.5rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ display: 'flex', gap: '0.05rem', fontSize: '0.75rem' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} style={{ color: star <= Math.round(review.overall_rating) ? '#fbbf24' : '#374151' }}>
                  ★
                </span>
              ))}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: '600' }}>
              {review.overall_rating.toFixed(1)}
            </span>
          </div>
          {/* Sub-signal chips */}
          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
            {signals.map(s => (
              <span key={s.label} style={{
                fontSize: '0.6rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                backgroundColor: '#ffffff08',
                color: '#9ca3af',
              }}>
                {s.label}: {s.val}/5
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '0.6rem', color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          {timeAgo(review.created_at)}
          {review.updated_at !== review.created_at && (
            <div style={{ fontSize: '0.55rem', color: '#4b5563' }}>(edited)</div>
          )}
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <p style={{
          margin: '0 0 0.5rem 0',
          color: '#e5e7eb',
          fontSize: '0.8rem',
          lineHeight: 1.5,
        }}>
          &ldquo;{review.comment}&rdquo;
        </p>
      )}

      {/* Official response */}
      {response && (
        <div style={{
          padding: '0.5rem 0.6rem',
          backgroundColor: '#0f172a',
          borderRadius: '6px',
          borderLeft: '3px solid #3b82f6',
          marginBottom: '0.5rem',
        }}>
          <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: '600', marginBottom: '0.2rem' }}>
            Official Response
          </div>
          <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.75rem', lineHeight: 1.4 }}>
            {response.response_text}
          </p>
        </div>
      )}

      {/* Actions bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Upvote/Downvote */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
          <button
            onClick={() => canVote && onVote(review.id, 'upvote')}
            disabled={!canVote}
            style={{
              background: 'none',
              border: 'none',
              cursor: canVote ? 'pointer' : 'default',
              padding: '0.25rem',
              fontSize: '0.75rem',
              color: review.user_vote === 'upvote' ? '#22c55e' : '#6b7280',
              opacity: canVote ? 1 : 0.5,
              minWidth: isMobile ? '44px' : '28px',
              minHeight: isMobile ? '44px' : '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Upvote"
          >
            ▲
          </button>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '600',
            color: review.vote_score > 0 ? '#22c55e' : review.vote_score < 0 ? '#ef4444' : '#6b7280',
            minWidth: '18px',
            textAlign: 'center',
          }}>
            {review.vote_score}
          </span>
          <button
            onClick={() => canVote && onVote(review.id, 'downvote')}
            disabled={!canVote}
            style={{
              background: 'none',
              border: 'none',
              cursor: canVote ? 'pointer' : 'default',
              padding: '0.25rem',
              fontSize: '0.75rem',
              color: review.user_vote === 'downvote' ? '#ef4444' : '#6b7280',
              opacity: canVote ? 1 : 0.5,
              minWidth: isMobile ? '44px' : '28px',
              minHeight: isMobile ? '44px' : '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Downvote"
          >
            ▼
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Owner actions */}
        {isOwner && (
          <>
            <button
              onClick={() => onEdit(review)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '0.65rem',
                padding: '0.25rem 0.4rem',
              }}
            >
              {t('common.edit', 'Edit')}
            </button>
            <button
              onClick={() => onDelete(review.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '0.65rem',
                padding: '0.25rem 0.4rem',
              }}
            >
              {t('common.delete', 'Delete')}
            </button>
          </>
        )}

        {/* Report */}
        {!isOwner && canVote && (
          <button
            onClick={() => onReport(review.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '0.6rem',
              padding: '0.25rem 0.4rem',
            }}
          >
            {t('reviews.report', 'Report')}
          </button>
        )}

        {/* Admin hide */}
        {isAdmin && !isOwner && (
          <button
            onClick={() => onDelete(review.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f59e0b',
              cursor: 'pointer',
              fontSize: '0.6rem',
              padding: '0.25rem 0.4rem',
            }}
          >
            Hide (Admin)
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Review Form ────────────────────────────────────────────

interface ReviewFormProps {
  reviewType: ReviewType;
  existingReview?: ReputationReview | null;
  isMobile: boolean;
  onSubmit: (ratings: { signal1: number; signal2: number; signal3: number }, comment: string) => void;
  onCancel?: () => void;
  submitting: boolean;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ reviewType, existingReview, isMobile, onSubmit, onCancel, submitting }) => {
  const { t } = useTranslation();

  const signalLabels = reviewType === 'citizen'
    ? [
        t('reputation.signal.organization', 'Kingdom Organization'),
        t('reputation.signal.leadership', 'Leadership Fairness'),
        t('reputation.signal.culture', 'Overall Culture'),
      ]
    : [
        t('reputation.signal.communication', 'Effective Communication'),
        t('reputation.signal.compliance', 'Rule Compliance'),
        t('reputation.signal.sportsmanship', 'Good Sportsmanship'),
      ];

  const getExistingRatings = () => {
    if (!existingReview) return [0, 0, 0];
    if (reviewType === 'citizen') {
      return [
        existingReview.citizen_organization_rating || 0,
        existingReview.citizen_leadership_fairness_rating || 0,
        existingReview.citizen_overall_culture_rating || 0,
      ];
    }
    return [
      existingReview.rival_communication_rating || 0,
      existingReview.rival_rule_compliance_rating || 0,
      existingReview.rival_sportsmanship_rating || 0,
    ];
  };

  const [ratings, setRatings] = useState<[number, number, number]>(getExistingRatings() as [number, number, number]);
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [hoveredStars, setHoveredStars] = useState<[number, number, number]>([0, 0, 0]);

  const setRating = (index: number, value: number) => {
    const newRatings = [...ratings] as [number, number, number];
    newRatings[index] = value;
    setRatings(newRatings);
  };

  const setHovered = (index: number, value: number) => {
    const newHovered = [...hoveredStars] as [number, number, number];
    newHovered[index] = value;
    setHoveredStars(newHovered);
  };

  const allRated = ratings.every(r => r >= 1 && r <= 5);
  const commentValid = comment.trim().length >= 10 && comment.trim().length <= 200;
  const canSubmit = allRated && commentValid && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ signal1: ratings[0], signal2: ratings[1], signal3: ratings[2] }, comment.trim());
  };

  const accentColor = reviewType === 'citizen' ? '#a855f7' : '#22d3ee';

  return (
    <form onSubmit={handleSubmit} style={{
      padding: isMobile ? '0.75rem' : '1rem',
      backgroundColor: '#131318',
      borderRadius: '10px',
      border: `1px solid ${accentColor}30`,
      marginBottom: '1rem',
    }}>
      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>
        {existingReview
          ? t('reputation.editReview', 'Edit Your Review')
          : t('reputation.writeReview', 'Write a Review')}
      </h4>

      {/* Signal ratings */}
      {signalLabels.map((label, idx) => (
        <div key={label} style={{ marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#d1d5db', marginBottom: '0.2rem', fontWeight: '500' }}>
            {label}
          </div>
          <div style={{ display: 'flex', gap: '0.15rem' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHovered(idx, star)}
                onMouseLeave={() => setHovered(idx, 0)}
                onClick={() => setRating(idx, star)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: star <= (hoveredStars[idx] ?? ratings[idx] ?? 0) ? '#fbbf24' : '#374151',
                  padding: '0.1rem',
                  transition: 'color 0.15s',
                  minWidth: isMobile ? '44px' : '32px',
                  minHeight: isMobile ? '44px' : '32px',
                }}
                aria-label={`${star} stars for ${label}`}
              >
                ★
              </button>
            ))}
            {(ratings[idx] ?? 0) > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', alignSelf: 'center', marginLeft: '0.3rem' }}>
                {ratings[idx]}/5
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Comment */}
      <div style={{ marginBottom: '0.75rem' }}>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('reputation.commentPlaceholder', 'Share your experience (10-200 characters)...')}
          maxLength={200}
          style={{
            width: '100%',
            minHeight: '70px',
            backgroundColor: '#0d0d12',
            color: '#e5e7eb',
            border: `1px solid ${comment.length > 0 && !commentValid ? '#ef4444' : '#ffffff15'}`,
            borderRadius: '8px',
            padding: '0.6rem',
            fontSize: '0.8rem',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.6rem',
          color: comment.length > 200 ? '#ef4444' : '#6b7280',
          marginTop: '0.15rem',
        }}>
          <span>{comment.length < 10 && comment.length > 0 ? `${10 - comment.length} more chars needed` : ''}</span>
          <span>{comment.length}/200</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #ffffff15',
              backgroundColor: 'transparent',
              color: '#9ca3af',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: '6px',
            border: 'none',
            background: canSubmit ? `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)` : '#374151',
            color: canSubmit ? '#fff' : '#6b7280',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting
            ? t('common.submitting', 'Submitting...')
            : existingReview
              ? t('common.update', 'Update')
              : t('common.submit', 'Submit')}
        </button>
      </div>
    </form>
  );
};

// ─── Report Modal ───────────────────────────────────────────

interface ReportModalProps {
  onSubmit: (reason: ReportReason, details: string) => void;
  onClose: () => void;
  submitting: boolean;
}

const ReportModal: React.FC<ReportModalProps> = ({ onSubmit, onClose, submitting }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');

  const reasons: { value: ReportReason; label: string }[] = [
    { value: 'spam', label: t('reviews.reportReasons.spam', 'Spam') },
    { value: 'inappropriate', label: t('reviews.reportReasons.inappropriate', 'Inappropriate') },
    { value: 'misleading', label: t('reviews.reportReasons.misleading', 'Misleading') },
    { value: 'harassment', label: t('reviews.reportReasons.harassment', 'Harassment') },
    { value: 'other', label: t('reviews.reportReasons.other', 'Other') },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#1a1a22',
          borderRadius: '12px',
          padding: '1.25rem',
          maxWidth: '400px',
          width: '90%',
          border: '1px solid #ffffff15',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#fff', fontSize: '0.95rem' }}>
          {t('reviews.reportReview', 'Report Review')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {reasons.map(r => (
            <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{ accentColor: '#ef4444' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#d1d5db' }}>{r.label}</span>
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={t('reviews.reportDetails', 'Additional details (optional)...')}
          maxLength={300}
          style={{
            width: '100%',
            minHeight: '50px',
            backgroundColor: '#0d0d12',
            color: '#e5e7eb',
            border: '1px solid #ffffff15',
            borderRadius: '6px',
            padding: '0.5rem',
            fontSize: '0.75rem',
            resize: 'vertical',
            outline: 'none',
            marginBottom: '0.75rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #ffffff15', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer' }}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={() => onSubmit(reason, details)}
            disabled={submitting}
            style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? t('common.submitting', 'Submitting...') : t('reviews.submitReport', 'Submit Report')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────

export interface KingdomReputationProps {
  kingdomNumber: number;
  reviewType: ReviewType;
  accentColor?: string;
}

const KingdomReputation: React.FC<KingdomReputationProps> = ({
  kingdomNumber,
  reviewType,
  accentColor,
}) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const color = accentColor || (reviewType === 'citizen' ? '#a855f7' : '#22d3ee');

  // State
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [reviews, setReviews] = useState<ReputationReviewWithVote[]>([]);
  const [responses, setResponses] = useState<Map<string, OfficialResponse>>(new Map());
  const [existingReview, setExistingReview] = useState<ReputationReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<ReputationReview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isAdmin = profile?.is_admin === true;

  // Check eligibility
  const eligibility = useMemo(() => {
    if (reviewType === 'citizen') {
      return kingdomReputationService.canCitizenReview(profile, kingdomNumber);
    }
    return { eligible: false, reason: 'checking' };
  }, [profile, kingdomNumber, reviewType]);

  const [rivalEligibility, setRivalEligibility] = useState<{ eligible: boolean; reason: string | null }>({ eligible: false, reason: 'checking' });

  useEffect(() => {
    if (reviewType === 'rival' && profile) {
      kingdomReputationService.canRivalReview(profile, kingdomNumber).then(setRivalEligibility);
    }
  }, [reviewType, profile, kingdomNumber]);

  const canReview = reviewType === 'citizen' ? eligibility.eligible : rivalEligibility.eligible;

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, reviewsData] = await Promise.all([
        kingdomReputationService.getSummary(kingdomNumber, reviewType),
        kingdomReputationService.getReviewsForKingdom(kingdomNumber, reviewType, user?.id),
      ]);

      setSummary(summaryData);
      setReviews(reviewsData);

      // Fetch responses
      if (reviewsData.length > 0) {
        const responsesMap = await kingdomReputationService.getResponsesForReviews(reviewsData.map(r => r.id));
        setResponses(responsesMap);
      }

      // Check if user has existing review
      if (user?.id) {
        const existing = await kingdomReputationService.getUserReviewForKingdom(kingdomNumber, user.id);
        if (existing && existing.review_type === reviewType) {
          setExistingReview(existing);
        }
      }
    } catch (err) {
      logger.error('Error fetching reputation data:', err);
    } finally {
      setLoading(false);
    }
  }, [kingdomNumber, reviewType, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleSubmitReview = async (ratings: { signal1: number; signal2: number; signal3: number }, comment: string) => {
    if (!profile || !user) return;
    setSubmitting(true);

    if (editingReview) {
      const result = await kingdomReputationService.updateReview(
        editingReview.id, reviewType, ratings, comment, user.id, editingReview.updated_at
      );
      if (result.success) {
        setToast({ message: t('reputation.reviewUpdated', 'Review updated!'), type: 'success' });
        setEditingReview(null);
        setShowForm(false);
        await fetchData();
      } else {
        setToast({ message: result.error || 'Failed to update', type: 'error' });
      }
    } else {
      const result = await kingdomReputationService.createReview(
        kingdomNumber, reviewType, ratings, comment, profile, user.id
      );
      if (result.success) {
        setToast({ message: t('reputation.reviewSubmitted', 'Review submitted!'), type: 'success' });
        setShowForm(false);
        await fetchData();
      } else {
        setToast({ message: result.error || 'Failed to submit', type: 'error' });
      }
    }

    setSubmitting(false);
  };

  const handleVote = async (reviewId: string, voteType: VoteType) => {
    if (!user) return;
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;

    const result = await kingdomReputationService.vote(reviewId, user.id, voteType, review.user_vote);
    if (result.success) {
      // Optimistic update
      setReviews(prev => prev.map(r => {
        if (r.id !== reviewId) return r;
        const oldVote = r.user_vote;
        const newVote = result.newVote;
        let upDelta = 0, downDelta = 0;

        if (oldVote === 'upvote') upDelta--;
        if (oldVote === 'downvote') downDelta--;
        if (newVote === 'upvote') upDelta++;
        if (newVote === 'downvote') downDelta++;

        return {
          ...r,
          user_vote: newVote,
          upvotes_count: r.upvotes_count + upDelta,
          downvotes_count: r.downvotes_count + downDelta,
          vote_score: r.vote_score + upDelta - downDelta,
        };
      }));
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm(t('reputation.confirmDelete', 'Are you sure you want to delete this review?'))) return;

    if (isAdmin) {
      const result = await kingdomReputationService.adminHideReview(reviewId, 'Admin moderation', user!.id);
      if (result.success) {
        setToast({ message: 'Review hidden', type: 'success' });
        await fetchData();
      }
    } else {
      const result = await kingdomReputationService.deleteReview(reviewId);
      if (result.success) {
        setToast({ message: t('reputation.reviewDeleted', 'Review deleted'), type: 'success' });
        setExistingReview(null);
        await fetchData();
      }
    }
  };

  const handleReport = async (reason: ReportReason, details: string) => {
    if (!user || !reportingReviewId) return;
    setReportSubmitting(true);

    const result = await kingdomReputationService.reportReview(reportingReviewId, user.id, reason, details);
    if (result.success) {
      setToast({ message: t('reviews.reportSubmitted', 'Report submitted'), type: 'success' });
    } else {
      setToast({ message: result.error || 'Failed to report', type: 'error' });
    }

    setReportSubmitting(false);
    setReportingReviewId(null);
  };

  // Render
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 5);
  const sectionTitle = reviewType === 'citizen'
    ? t('reputation.citizenReputation', 'Citizen Reputation')
    : t('reputation.rivalReputation', 'Rival Reputation');

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#6b7280',
        backgroundColor: '#131318',
        borderRadius: '12px',
        border: `1px solid ${color}15`,
      }}>
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 10000,
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          backgroundColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {toast.message}
        </div>
      )}

      {/* Section Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <h3 style={{
          margin: 0,
          fontSize: isMobile ? '0.9rem' : '1rem',
          fontWeight: '600',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
        }}>
          <span>{reviewType === 'citizen' ? '🏠' : '⚔️'}</span>
          {sectionTitle}
          <span>{reviewType === 'citizen' ? '🏠' : '⚔️'}</span>
        </h3>

        {canReview && !existingReview && !showForm && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: '0.3rem 0.7rem',
                borderRadius: '6px',
                border: `1px solid ${color}50`,
                backgroundColor: `${color}15`,
                color,
                fontSize: '0.72rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + {t('reputation.writeReview', 'Write a Review')}
            </button>
          </div>
        )}
      </div>

      {/* Summary Hero */}
      <HeroSummary summary={summary} reviewType={reviewType} color={color} isMobile={isMobile} />

      {/* Review Form */}
      {(showForm || editingReview) && (
        <ReviewForm
          reviewType={reviewType}
          existingReview={editingReview}
          isMobile={isMobile}
          onSubmit={handleSubmitReview}
          onCancel={() => { setShowForm(false); setEditingReview(null); }}
          submitting={submitting}
        />
      )}

      {/* Existing review notice */}
      {existingReview && !editingReview && !showForm && (
        <div style={{
          padding: '0.5rem 0.75rem',
          backgroundColor: `${color}10`,
          borderRadius: '8px',
          border: `1px solid ${color}20`,
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.72rem', color: '#d1d5db' }}>
            {t('reputation.youReviewed', 'You reviewed this kingdom')} ({existingReview.overall_rating.toFixed(1)} ★)
          </span>
          <button
            onClick={() => setEditingReview(existingReview)}
            style={{
              background: 'none',
              border: 'none',
              color,
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: '600',
            }}
          >
            {t('common.edit', 'Edit')}
          </button>
        </div>
      )}

      {/* Eligibility message */}
      {!canReview && user && !existingReview && (
        <div style={{
          padding: '0.5rem 0.75rem',
          backgroundColor: '#ffffff08',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.72rem',
          color: '#6b7280',
        }}>
          {reviewType === 'citizen' && eligibility.reason === 'not_same_kingdom' &&
            t('reputation.citizenOnly', 'Only citizens of this kingdom can leave citizen reviews.')}
          {reviewType === 'citizen' && eligibility.reason?.startsWith('tc_level_low') &&
            t('reputation.tcLevelRequired', 'TC Level 20+ required to leave reviews.')}
          {reviewType === 'rival' && rivalEligibility.reason === 'same_kingdom' &&
            t('reputation.rivalNotSelf', 'You cannot leave a rival review for your own kingdom.')}
          {reviewType === 'rival' && rivalEligibility.reason === 'no_rivalry_history' &&
            t('reputation.noRivalry', 'Your kingdom must have battled this kingdom in KvK to leave a rival review.')}
          {(eligibility.reason === 'not_linked' || rivalEligibility.reason === 'not_linked') &&
            t('reputation.linkRequired', 'Link your Kingshot account to leave reviews.')}
        </div>
      )}

      {/* Reviews List */}
      {visibleReviews.length > 0 && (
        <div>
          {visibleReviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              reviewType={reviewType}
              response={responses.get(review.id) || null}
              isOwner={review.reviewer_user_id === user?.id}
              isAdmin={isAdmin}
              canVote={!!user}
              isMobile={isMobile}
              onVote={handleVote}
              onEdit={(r) => setEditingReview(r)}
              onDelete={handleDelete}
              onReport={(id) => setReportingReviewId(id)}
            />
          ))}

          {reviews.length > 5 && !showAllReviews && (
            <button
              onClick={() => setShowAllReviews(true)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#ffffff08',
                border: '1px solid #ffffff10',
                borderRadius: '8px',
                color: '#9ca3af',
                fontSize: '0.75rem',
                cursor: 'pointer',
                marginTop: '0.25rem',
              }}
            >
              {t('reputation.showAll', 'Show all {{count}} reviews', { count: reviews.length })}
            </button>
          )}
        </div>
      )}

      {/* Report Modal */}
      {reportingReviewId && (
        <ReportModal
          onSubmit={handleReport}
          onClose={() => setReportingReviewId(null)}
          submitting={reportSubmitting}
        />
      )}
    </div>
  );
};

export default KingdomReputation;
