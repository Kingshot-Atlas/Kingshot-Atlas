import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SmartTooltip from '../components/shared/SmartTooltip';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Kingdom } from '../types';
import PostKvKSubmission from '../components/PostKvKSubmission';
import { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { supabase } from '../lib/supabase';
import { CURRENT_KVK, KVK_CONFIG } from '../constants';
import { FONT_DISPLAY } from '../utils/styles';

const TOTAL_KINGDOMS = KVK_CONFIG.TOTAL_KINGDOMS;

// KvK dates calculated from KvK #10 = Jan 31, 2026 (every 4 weeks)
const KVK_DATES: Record<number, string> = {
  1: 'May 24, 2025',
  2: 'Jun 21, 2025',
  3: 'Jul 19, 2025',
  4: 'Aug 16, 2025',
  5: 'Sep 13, 2025',
  6: 'Oct 11, 2025',
  7: 'Nov 8, 2025',
  8: 'Dec 6, 2025',
  9: 'Jan 3, 2026',
  10: 'Jan 31, 2026',
};

interface MissingKingdom {
  kingdom_number: number;
  kingdom_name?: string;
  missingKvks: number[];
  lastKvk: number;
  totalKvks: number;
  firstEligibleKvk?: number; // First KvK this kingdom was eligible for
}

// KvK Badge with tooltip
const KvKBadge: React.FC<{ kvk: number; isLatest?: boolean }> = ({ kvk, isLatest }) => {
  const date = KVK_DATES[kvk] || 'Unknown';
  
  return (
    <SmartTooltip
      accentColor="#22d3ee"
      content={
        <div style={{ fontSize: '0.7rem' }}>
          <div style={{ fontWeight: '600', color: '#22d3ee' }}>KvK #{kvk}</div>
          <div style={{ color: '#9ca3af' }}>{date}</div>
        </div>
      }
    >
      <span
        style={{
          backgroundColor: isLatest ? '#22d3ee20' : '#2a2a2a',
          color: isLatest ? '#22d3ee' : '#9ca3af',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '500',
          border: isLatest ? '1px solid #22d3ee40' : 'none',
          cursor: 'help',
          display: 'inline-block'
        }}
      >
        #{kvk}
      </span>
    </SmartTooltip>
  );
};

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
  const [showAddKingdomModal, setShowAddKingdomModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent'>('all');

  const isLoggedIn = !!user;
  const isLinked = !!profile?.linked_kingdom;

  useEffect(() => {
    const loadKingdoms = async () => {
      try {
        const data = await apiService.getKingdoms();
        setKingdoms(data);
      } catch (err) {
        console.error('Failed to load kingdoms:', err);
      } finally {
        setLoading(false);
      }
    };
    loadKingdoms();
  }, []);

  const missingKingdoms = useMemo(() => {
    const result: MissingKingdom[] = [];
    
    for (const kingdom of kingdoms) {
      const existingKvks = kingdom.recent_kvks?.map(k => k.kvk_number) || [];
      const missingKvks: number[] = [];
      
      // Determine the first KvK this kingdom was eligible for
      // A kingdom's first recorded KvK indicates when it became eligible
      // KvKs before that aren't "missing" - the kingdom didn't exist yet
      const firstEligibleKvk = existingKvks.length > 0 ? Math.min(...existingKvks) : CURRENT_KVK;
      
      // Only check for missing KvKs from their first eligible KvK to current
      for (let i = firstEligibleKvk; i <= CURRENT_KVK; i++) {
        if (!existingKvks.includes(i)) {
          missingKvks.push(i);
        }
      }
      
      if (missingKvks.length > 0) {
        result.push({
          kingdom_number: kingdom.kingdom_number,
          missingKvks,
          lastKvk: Math.max(...existingKvks, 0),
          totalKvks: kingdom.total_kvks || existingKvks.length,
          firstEligibleKvk // Track when they became eligible
        });
      }
    }
    
    // Sort by kingdom number ascending
    return result.sort((a, b) => a.kingdom_number - b.kingdom_number);
  }, [kingdoms]);

  const filteredKingdoms = useMemo(() => {
    let filtered = missingKingdoms;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      filtered = filtered.filter(k => 
        k.kingdom_number.toString().includes(query)
      );
    }
    
    // Apply tab filter
    if (filter === 'recent') {
      filtered = filtered.filter(k => k.missingKvks.includes(CURRENT_KVK));
    }
    
    return filtered;
  }, [missingKingdoms, filter, searchQuery]);

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

  const stats = useMemo(() => ({
    totalMissing: missingKingdoms.length,
    missingKvk10: missingKingdoms.filter(k => k.missingKvks.includes(CURRENT_KVK)).length,
    totalKingdoms: TOTAL_KINGDOMS,
    withData: kingdoms.length
  }), [missingKingdoms, kingdoms.length]);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#0a0a0a', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#fff'
      }}>
        Loading registry...
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0a0a0a', 
      padding: '2rem 1rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ 
          color: '#fff', 
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
        <p style={{ color: '#9ca3af', fontSize: '0.95rem', maxWidth: '650px', margin: '0 auto', lineHeight: 1.6 }}>
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
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              {t('missingData.signInDesc')}
            </div>
          </div>
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <button style={{
              backgroundColor: '#fbbf24',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}>
              {t('missingData.signIn')}
            </button>
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
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              {t('missingData.linkDesc')}
            </div>
          </div>
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <button style={{
              backgroundColor: '#22d3ee',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}>
              {t('missingData.linkAccount')}
            </button>
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', 
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#22c55e', fontSize: '1.5rem', fontWeight: '700' }}>
            {stats.withData}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{t('missingData.kingdomsTracked')}</div>
        </div>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#f97316', fontSize: '1.5rem', fontWeight: '700' }}>
            {stats.totalMissing}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{t('missingData.needData')}</div>
        </div>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#22d3ee', fontSize: '1.5rem', fontWeight: '700' }}>
            {stats.missingKvk10}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Missing KvK #{CURRENT_KVK}</div>
        </div>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#a855f7', fontSize: '1.5rem', fontWeight: '700' }}>
            {stats.totalKingdoms - stats.withData}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{t('missingData.notInAtlas')}</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '0.75rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search Input */}
        <div style={{ 
          flex: isMobile ? '1 1 100%' : '0 0 200px',
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

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All (${missingKingdoms.length})` },
            { key: 'recent', label: `KvK #${CURRENT_KVK} (${stats.missingKvk10})` }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              style={{
                backgroundColor: filter === key ? '#22d3ee' : '#1a1a1f',
                color: filter === key ? '#0a0a0a' : '#9ca3af',
                border: `1px solid ${filter === key ? '#22d3ee' : '#2a2a2a'}`,
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Add New Kingdom Button */}
        {isLinked && (
          <button
            onClick={() => setShowAddKingdomModal(true)}
            style={{
              marginLeft: 'auto',
              backgroundColor: '#22c55e20',
              color: '#22c55e',
              border: '1px solid #22c55e40',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('missingData.addKingdom')}
          </button>
        )}
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
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {kingdom.totalKvks} KvKs recorded • Eligible since KvK #{kingdom.firstEligibleKvk || 1}
                </div>
              </div>
              <div style={{
                backgroundColor: kingdom.missingKvks.length >= 3 ? '#ef444420' : '#f9731620',
                color: kingdom.missingKvks.length >= 3 ? '#ef4444' : '#f97316',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {t('missingData.missing', { count: kingdom.missingKvks.length })}
              </div>
            </div>

            {/* Missing KvKs */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                {t('missingData.missingKvksLabel')}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {kingdom.missingKvks.slice(0, 8).map(kvk => (
                  <KvKBadge key={kvk} kvk={kvk} isLatest={kvk === CURRENT_KVK} />
                ))}
                {kingdom.missingKvks.length > 8 && (
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    +{kingdom.missingKvks.length - 8} more
                  </span>
                )}
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
          color: '#6b7280'
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
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t('missingData.dataScoutDesc')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥈</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.dataHunter')}</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t('missingData.dataHunterDesc')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥇</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.dataMaster')}</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t('missingData.dataMasterDesc')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>💎</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>{t('missingData.atlasLegend')}</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t('missingData.atlasLegendDesc')}</div>
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

      {/* Add New Kingdom Modal */}
      {showAddKingdomModal && (
        <AddKingdomModal
          onClose={() => setShowAddKingdomModal(false)}
          onSuccess={() => {
            setShowAddKingdomModal(false);
            showToast('Kingdom submission sent for review!', 'success');
          }}
        />
      )}
    </div>
  );
};

// Add Kingdom Modal Component
const AddKingdomModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [kingdomNumber, setKingdomNumber] = useState('');
  const [firstKvkId, setFirstKvkId] = useState<number | null>(null); // null = hasn't had first KvK yet
  const [kvkData, setKvkData] = useState<Array<{ kvk: number; prep: 'W' | 'L'; battle: 'W' | 'L' }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // When first KvK changes, reset KvK data to only include valid entries
  const handleFirstKvkChange = (value: string) => {
    if (value === 'none') {
      setFirstKvkId(null);
      setKvkData([]); // No KvK history if kingdom hasn't had first KvK
    } else {
      const kvkNum = parseInt(value);
      setFirstKvkId(kvkNum);
      // Filter out any KvK entries before the first KvK
      setKvkData(prev => prev.filter(k => k.kvk >= kvkNum));
    }
  };

  const addKvkEntry = () => {
    const startKvk = firstKvkId || 1;
    const nextKvk = kvkData.length > 0 ? Math.max(...kvkData.map(k => k.kvk)) + 1 : startKvk;
    if (nextKvk <= CURRENT_KVK && (firstKvkId === null || nextKvk >= firstKvkId)) {
      setKvkData([...kvkData, { kvk: nextKvk, prep: 'W', battle: 'W' }]);
    }
  };

  const updateKvkEntry = (index: number, field: 'prep' | 'battle', value: 'W' | 'L') => {
    setKvkData(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const removeKvkEntry = (index: number) => {
    setKvkData(kvkData.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validate kingdom number
    const kNum = parseInt(kingdomNumber);
    if (!kingdomNumber || isNaN(kNum) || kNum < 1 || kNum > 9999) {
      showToast('Please enter a valid kingdom number (1-9999)', 'error');
      return;
    }

    // If kingdom has had their first KvK, require at least one KvK entry
    if (firstKvkId !== null && kvkData.length === 0) {
      showToast('Please add at least one KvK result', 'error');
      return;
    }

    // Validate that KvK entries start from first KvK
    if (firstKvkId !== null && kvkData.length > 0) {
      const minKvk = Math.min(...kvkData.map(k => k.kvk));
      if (minKvk < firstKvkId) {
        showToast(`KvK history cannot include entries before first KvK #${firstKvkId}`, 'error');
        return;
      }
    }

    if (!supabase) {
      showToast('Database not configured', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Insert directly to Supabase with first_kvk_id
      const { error } = await supabase
        .from('new_kingdom_submissions')
        .insert({
          kingdom_number: kNum,
          first_kvk_id: firstKvkId, // null if hasn't had first KvK yet
          kvk_history: kvkData,
          submitted_by: profile?.username || 'Anonymous',
          submitted_by_user_id: user?.id,
          submitted_by_kingdom: profile?.linked_kingdom,
          status: 'pending'
        });

      if (error) {
        console.error('Submission error:', error);
        if (error.code === '23505') {
          showToast('A submission for this kingdom is already pending', 'error');
        } else {
          showToast(error.message || 'Submission failed', 'error');
        }
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error('Submission failed:', err);
      showToast('Failed to submit. Try again later.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }} onClick={onClose}>
      <div 
        style={{
          backgroundColor: '#111116',
          borderRadius: '16px',
          padding: '1.5rem',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          border: '1px solid #2a2a2a'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
            Add New Kingdom
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Submit a new kingdom not yet tracked in the Atlas. Select their first KvK to determine relevant history.
        </p>

        {/* Kingdom Number Input */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Kingdom Number
          </label>
          <input
            type="number"
            value={kingdomNumber}
            onChange={e => setKingdomNumber(e.target.value)}
            placeholder="e.g., 1622"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#1a1a1f',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* First KvK Selection - CRITICAL for determining relevant history */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            First KvK <span style={{ color: '#22d3ee' }}>*</span>
          </label>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            When did this kingdom have their first KvK? Earlier KvKs won&apos;t appear in their history.
          </p>
          <select
            value={firstKvkId === null ? 'none' : firstKvkId.toString()}
            onChange={e => handleFirstKvkChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#1a1a1f',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <option value="" disabled>Select first KvK...</option>
            <option value="none" style={{ color: '#fbbf24' }}>
              Has not had first KvK yet
            </option>
            {Array.from({ length: CURRENT_KVK }, (_, i) => i + 1).map(kvk => (
              <option key={kvk} value={kvk}>
                KvK #{kvk} — {KVK_DATES[kvk] || 'Unknown date'}
              </option>
            ))}
          </select>
          {firstKvkId === null && (
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem 0.75rem',
              backgroundColor: '#fbbf2410',
              border: '1px solid #fbbf2430',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#fbbf24'
            }}>
              This kingdom will be added with no KvK history. Once they participate in a KvK, you can submit their results.
            </div>
          )}
        </div>

        {/* KvK History - Only show if kingdom has had their first KvK */}
        {firstKvkId !== null && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
              KvK History (from KvK #{firstKvkId})
            </label>
            <button
              onClick={addKvkEntry}
              disabled={kvkData.length >= (CURRENT_KVK - firstKvkId + 1)}
              style={{
                backgroundColor: '#22d3ee20',
                color: '#22d3ee',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                cursor: kvkData.length >= (CURRENT_KVK - firstKvkId + 1) ? 'not-allowed' : 'pointer',
                opacity: kvkData.length >= (CURRENT_KVK - firstKvkId + 1) ? 0.5 : 1
              }}
            >
              + Add KvK
            </button>
          </div>

          {kvkData.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
              Click &quot;+ Add KvK&quot; to add results starting from KvK #{firstKvkId}
            </div>
          )}

          {kvkData.map((entry, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              backgroundColor: '#1a1a1f',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem', minWidth: '50px' }}>
                KvK #{entry.kvk}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                {KVK_DATES[entry.kvk] || ''}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                <select
                  value={entry.prep}
                  onChange={e => updateKvkEntry(index, 'prep', e.target.value as 'W' | 'L')}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: entry.prep === 'W' ? '#22c55e20' : '#ef444420',
                    border: 'none',
                    borderRadius: '4px',
                    color: entry.prep === 'W' ? '#22c55e' : '#ef4444',
                    fontSize: '0.75rem'
                  }}
                >
                  <option value="W">Prep W</option>
                  <option value="L">Prep L</option>
                </select>
                <select
                  value={entry.battle}
                  onChange={e => updateKvkEntry(index, 'battle', e.target.value as 'W' | 'L')}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: entry.battle === 'W' ? '#22c55e20' : '#ef444420',
                    border: 'none',
                    borderRadius: '4px',
                    color: entry.battle === 'W' ? '#22c55e' : '#ef4444',
                    fontSize: '0.75rem'
                  }}
                >
                  <option value="W">Battle W</option>
                  <option value="L">Battle L</option>
                </select>
                <button
                  onClick={() => removeKvkEntry(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0 0.25rem'
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !kingdomNumber || (firstKvkId !== null && kvkData.length === 0)}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting || !kingdomNumber || (firstKvkId !== null && kvkData.length === 0) ? 0.6 : 1
          }}
        >
          {submitting ? 'Submitting...' : firstKvkId === null ? 'Submit Kingdom (No KvK Yet)' : 'Submit for Review'}
        </button>

        <p style={{ color: '#6b7280', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem' }}>
          Submissions are reviewed by admins before being added to the Atlas.
        </p>
      </div>
    </div>
  );
};

export default MissingDataRegistry;
