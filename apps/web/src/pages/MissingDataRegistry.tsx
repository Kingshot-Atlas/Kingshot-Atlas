import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Kingdom } from '../types';
import PostKvKSubmission from '../components/PostKvKSubmission';
import { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useMediaQuery';
import { logger } from '../utils/logger';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { Button } from '../components/shared/Button';
import { CURRENT_KVK, HIGHEST_KINGDOM_IN_KVK } from '../constants';
import { FONT_DISPLAY, colors } from '../utils/styles';


interface MissingKingdom {
  kingdom_number: number;
  kingdom_name?: string;
  missingKvks: number[];
  lastKvk: number;
  totalKvks: number;
  firstEligibleKvk?: number; // First KvK this kingdom was eligible for
  incompleteMatchup?: boolean; // Has KvK entry but missing prep/battle/opponent
}


const MissingDataRegistry: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('Contribute Data');
  useMetaTags(PAGE_META_TAGS.contributeData);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.contributeData });
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKingdom, setSelectedKingdom] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isLoggedIn = !!user;
  const isLinked = !!profile?.linked_kingdom;

  useEffect(() => {
    const loadKingdoms = async () => {
      try {
        const data = await apiService.getKingdoms();
        setKingdoms(data);
      } catch (err) {
        logger.error('Failed to load kingdoms:', err);
      } finally {
        setLoading(false);
      }
    };
    loadKingdoms();
  }, []);

  // Only show kingdoms missing data for the CURRENT KvK (latest),
  // including those with incomplete matchup data (missing prep/battle/opponent)
  const missingKingdoms = useMemo(() => {
    const result: MissingKingdom[] = [];
    
    for (const kingdom of kingdoms) {
      const recentKvks = kingdom.recent_kvks || [];
      const existingKvks = recentKvks.map(k => k.kvk_number);
      
      // Skip fresh kingdoms that have never participated in any KvK
      if (existingKvks.length === 0 && kingdom.kingdom_number > HIGHEST_KINGDOM_IN_KVK) {
        continue;
      }

      const firstEligibleKvk = existingKvks.length > 0 ? Math.min(...existingKvks) : CURRENT_KVK;
      
      // Check if this kingdom is missing the current KvK entirely
      const missingCurrentKvk = !existingKvks.includes(CURRENT_KVK) && firstEligibleKvk <= CURRENT_KVK;
      
      // Check if this kingdom has an incomplete matchup for the current KvK
      // (has entry but missing prep_result, battle_result, or opponent_kingdom)
      const currentKvkRecord = recentKvks.find(k => k.kvk_number === CURRENT_KVK);
      const isBye = currentKvkRecord && (
        currentKvkRecord.prep_result === 'B' || currentKvkRecord.battle_result === 'B' ||
        currentKvkRecord.overall_result?.toLowerCase() === 'bye' || currentKvkRecord.opponent_kingdom === 0
      );
      const incompleteMatchup = !!(currentKvkRecord && !isBye && (
        !currentKvkRecord.prep_result || !currentKvkRecord.battle_result || !currentKvkRecord.opponent_kingdom
      ));
      
      if (missingCurrentKvk || incompleteMatchup) {
        result.push({
          kingdom_number: kingdom.kingdom_number,
          missingKvks: missingCurrentKvk ? [CURRENT_KVK] : [],
          lastKvk: Math.max(...existingKvks, 0),
          totalKvks: kingdom.total_kvks || existingKvks.length,
          firstEligibleKvk,
          incompleteMatchup
        });
      }
    }
    
    // Sort by kingdom number ascending
    return result.sort((a, b) => a.kingdom_number - b.kingdom_number);
  }, [kingdoms]);

  const filteredKingdoms = useMemo(() => {
    if (!searchQuery.trim()) return missingKingdoms;
    const query = searchQuery.trim();
    return missingKingdoms.filter(k => k.kingdom_number.toString().includes(query));
  }, [missingKingdoms, searchQuery]);

  const handleSubmitClick = (kingdomNumber: number) => {
    if (!isLoggedIn) {
      showToast('Please sign in to submit data', 'info');
      return;
    }
    if (!isLinked) {
      showToast('Please link your Kingshot account to submit data', 'info');
      return;
    }
    setSelectedKingdom(kingdomNumber);
    setShowSubmitModal(true);
  };


  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.bg, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: colors.text
      }}>
        Loading registry...
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: colors.bg, 
      padding: '2rem 1rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ 
          color: colors.text, 
          fontSize: '1.75rem', 
          fontWeight: '700',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontFamily: FONT_DISPLAY
        }}>
          {t('missingData.contributeTitle')} <span style={{ color: '#22d3ee', textShadow: '0 0 8px #22d3ee40, 0 0 12px #22d3ee20' }}>{t('missingData.contributeTitleAccent')}</span>
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: '0.95rem', maxWidth: '650px', margin: '0 auto', lineHeight: 1.6 }}>
          {t('missingData.subtitle')}
          <br />
          <span style={{ color: '#fbbf24' }}>{t('missingData.linkedEarn')}</span>
        </p>
      </div>

      {/* User Status Banner */}
      {!isLoggedIn && (
        <div style={{
          backgroundColor: '#fbbf2410',
          border: '1px solid #fbbf2430',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: '600', marginBottom: '0.25rem' }}>
              {t('missingData.signInPrompt')}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
              {t('missingData.signInDesc')}
            </div>
          </div>
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="md" style={{ backgroundColor: '#fbbf24', color: '#0a0a0a' }}>
              {t('missingData.signIn')}
            </Button>
          </Link>
        </div>
      )}

      {isLoggedIn && !isLinked && (
        <div style={{
          backgroundColor: '#22d3ee10',
          border: '1px solid #22d3ee30',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ color: '#22d3ee', fontWeight: '600', marginBottom: '0.25rem' }}>
              {t('missingData.linkPrompt')}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>
              {t('missingData.linkDesc')}
            </div>
          </div>
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="md" style={{ backgroundColor: '#22d3ee', color: '#0a0a0a' }}>
              {t('missingData.linkAccount')}
            </Button>
          </Link>
        </div>
      )}

      {/* Search Bar + Count */}
      <div style={{ 
        display: 'flex', 
        gap: '0.75rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ 
          flex: isMobile ? '1 1 100%' : '0 0 240px',
          position: 'relative'
        }}>
          <input
            type="text"
            placeholder="Search kingdom #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem 0.6rem 2.25rem',
              backgroundColor: '#1a1a1f',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#6b7280" 
            strokeWidth="2"
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <span style={{ color: '#f97316', fontSize: '0.85rem', fontWeight: '500' }}>
          {missingKingdoms.length} {t('missingData.kingdomsMissingKvk', 'kingdoms missing KvK')} #{CURRENT_KVK} {t('missingData.data', 'data')}
        </span>
      </div>

      {/* Kingdom List */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '1rem' 
      }}>
        {filteredKingdoms.map((kingdom) => (
          <div
            key={kingdom.kingdom_number}
            style={{
              backgroundColor: '#1a1a1f',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '1px solid #2a2a2a',
              transition: 'border-color 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <Link 
                  to={`/kingdom/${kingdom.kingdom_number}`}
                  style={{ textDecoration: 'none' }}
                >
                  <h3 style={{ 
                    color: '#fff', 
                    fontSize: '1.1rem', 
                    fontWeight: '600',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    Kingdom {kingdom.kingdom_number}
                  </h3>
                </Link>
                <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {kingdom.totalKvks} KvKs recorded • Eligible since KvK #{kingdom.firstEligibleKvk || 1}
                </div>
              </div>
              <div style={{
                backgroundColor: kingdom.incompleteMatchup ? '#fbbf2420' : '#f9731620',
                color: kingdom.incompleteMatchup ? '#fbbf24' : '#f97316',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {kingdom.incompleteMatchup
                  ? t('missingData.incomplete', 'Incomplete')
                  : t('missingData.missingLabel', 'Missing')}
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: colors.textMuted, fontSize: '0.8rem' }}>
                {kingdom.incompleteMatchup
                  ? t('missingData.incompleteDesc', 'KvK #{{kvk}} matchup data is incomplete (missing prep/battle/opponent)', { kvk: CURRENT_KVK })
                  : t('missingData.missingDesc', 'Missing KvK #{{kvk}} results', { kvk: CURRENT_KVK })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => handleSubmitClick(kingdom.kingdom_number)}
              disabled={!isLinked}
              style={{
                width: '100%',
                backgroundColor: isLinked ? '#22d3ee' : '#2a2a2a',
                color: isLinked ? '#0a0a0a' : '#6b7280',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: isLinked ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {isLinked ? (
                <>{t('missingData.submitData')}</>
              ) : isLoggedIn ? (
                <>{t('missingData.linkToSubmit')}</>
              ) : (
                <>{t('missingData.signInToSubmit')}</>
              )}
            </button>
          </div>
        ))}
      </div>

      {filteredKingdoms.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: colors.textMuted
        }}>
          <div style={{ color: '#22d3ee', fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{t('missingData.allClear')}</div>
          <div>{t('missingData.noMatch')}</div>
        </div>
      )}

      {/* Achievements Section */}
      <div style={{
        marginTop: '3rem',
        backgroundColor: '#1a1a1f',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #2a2a2a'
      }}>
        <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', fontFamily: FONT_DISPLAY }}>
          {t('missingData.contributorRanks')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥉</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.dataScout')}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{t('missingData.dataScoutDesc')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥈</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.dataHunter')}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{t('missingData.dataHunterDesc')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥇</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.dataMaster')}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{t('missingData.dataMasterDesc')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>💎</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.atlasLegend')}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{t('missingData.atlasLegendDesc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && selectedKingdom && (
        <PostKvKSubmission
          isOpen={showSubmitModal}
          onClose={() => {
            setShowSubmitModal(false);
            setSelectedKingdom(null);
          }}
          defaultKingdom={selectedKingdom}
          defaultKvkNumber={CURRENT_KVK}
        />
      )}

    </div>
  );
};

export default MissingDataRegistry;
