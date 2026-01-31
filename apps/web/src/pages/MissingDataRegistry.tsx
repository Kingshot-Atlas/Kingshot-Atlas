import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Kingdom } from '../types';
import PostKvKSubmission from '../components/PostKvKSubmission';
import { useToast } from '../components/Toast';

const CURRENT_KVK = 10;

interface MissingKingdom {
  kingdom_number: number;
  kingdom_name?: string;
  missingKvks: number[];
  lastKvk: number;
  totalKvks: number;
}

const MissingDataRegistry: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKingdom, setSelectedKingdom] = useState<number | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'recent' | 'critical'>('all');

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
      
      // Check for missing KvKs from 1 to CURRENT_KVK
      for (let i = 1; i <= CURRENT_KVK; i++) {
        if (!existingKvks.includes(i)) {
          missingKvks.push(i);
        }
      }
      
      if (missingKvks.length > 0) {
        result.push({
          kingdom_number: kingdom.kingdom_number,
          missingKvks,
          lastKvk: Math.max(...existingKvks, 0),
          totalKvks: kingdom.total_kvks || existingKvks.length
        });
      }
    }
    
    // Sort by most missing data first
    return result.sort((a, b) => b.missingKvks.length - a.missingKvks.length);
  }, [kingdoms]);

  const filteredKingdoms = useMemo(() => {
    switch (filter) {
      case 'recent':
        // Only show kingdoms missing KvK #10
        return missingKingdoms.filter(k => k.missingKvks.includes(CURRENT_KVK));
      case 'critical':
        // Kingdoms missing 3+ KvKs
        return missingKingdoms.filter(k => k.missingKvks.length >= 3);
      default:
        return missingKingdoms;
    }
  }, [missingKingdoms, filter]);

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
    critical: missingKingdoms.filter(k => k.missingKvks.length >= 3).length
  }), [missingKingdoms]);

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
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          📋 Missing Data Registry
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto' }}>
          Help complete the Atlas! These kingdoms are missing KvK history data. 
          Linked Kingshot users earn achievements for submitting accurate data.
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
              🔒 Sign in to contribute
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              Create an account and link your Kingshot profile to submit data and earn achievements.
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
              Sign In
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
              🔗 Link your Kingshot account
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
              Connect your in-game account to unlock data submission and earn contributor achievements.
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
              Link Account
            </button>
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#f97316', fontSize: '1.75rem', fontWeight: '700' }}>
            {stats.totalMissing}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Kingdoms with gaps</div>
        </div>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#22d3ee', fontSize: '1.75rem', fontWeight: '700' }}>
            {stats.missingKvk10}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Missing KvK #{CURRENT_KVK}</div>
        </div>
        <div style={{
          backgroundColor: '#1a1a1f',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ color: '#ef4444', fontSize: '1.75rem', fontWeight: '700' }}>
            {stats.critical}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Critical (3+ missing)</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        {[
          { key: 'all', label: `All (${missingKingdoms.length})` },
          { key: 'recent', label: `Missing KvK #${CURRENT_KVK} (${stats.missingKvk10})` },
          { key: 'critical', label: `Critical (${stats.critical})` }
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
                    🏰 Kingdom {kingdom.kingdom_number}
                  </h3>
                </Link>
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {kingdom.totalKvks} KvKs recorded • Last: KvK #{kingdom.lastKvk}
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
                {kingdom.missingKvks.length} missing
              </div>
            </div>

            {/* Missing KvKs */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                Missing KvKs:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {kingdom.missingKvks.slice(0, 8).map(kvk => (
                  <span
                    key={kvk}
                    style={{
                      backgroundColor: kvk === CURRENT_KVK ? '#22d3ee20' : '#2a2a2a',
                      color: kvk === CURRENT_KVK ? '#22d3ee' : '#9ca3af',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      border: kvk === CURRENT_KVK ? '1px solid #22d3ee40' : 'none'
                    }}
                  >
                    #{kvk}
                  </span>
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
                <>📊 Submit Data</>
              ) : isLoggedIn ? (
                <>🔗 Link Account to Submit</>
              ) : (
                <>🔒 Sign In to Submit</>
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
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
          <div>No kingdoms match this filter!</div>
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
        <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏆 Contributor Achievements
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥉</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>Data Scout</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Submit 1 approved correction</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥈</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>Data Hunter</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Submit 5 approved corrections</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🥇</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>Data Master</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Submit 10 approved corrections</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>💎</div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>Atlas Legend</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>Submit 25 approved corrections</div>
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
