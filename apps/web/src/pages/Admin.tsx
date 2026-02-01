import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { logger } from '../utils/logger';

interface Submission {
  id: number;
  submitter_id: string;
  submitter_name: string | null;
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: string;
  battle_result: string;
  date_or_order_index: string | null;
  screenshot_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Claim {
  id: number;
  kingdom_number: number;
  user_id: string;
  status: string;
  verification_code: string | null;
  created_at: string;
}

interface DataCorrection {
  id: string;
  kingdom_number: number;
  field: string;
  current_value: string;
  suggested_value: string;
  reason: string;
  submitter_id: string;
  submitter_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CORRECTIONS_KEY = 'kingshot_data_corrections';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'submissions' | 'claims' | 'corrections' | 'import'>('submissions');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [corrections, setCorrections] = useState<DataCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [importData, setImportData] = useState<string>('');
  const [pendingCounts, setPendingCounts] = useState<{ submissions: number; claims: number; corrections: number }>({ submissions: 0, claims: 0, corrections: 0 });

  // Fetch pending counts on mount
  useEffect(() => {
    fetchPendingCounts();
  }, []);

  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions();
    } else if (activeTab === 'claims') {
      fetchClaims();
    } else if (activeTab === 'corrections') {
      fetchCorrections();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filter]);

  const fetchPendingCounts = async () => {
    // Fetch corrections count from localStorage
    try {
      const stored = localStorage.getItem(CORRECTIONS_KEY);
      const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
      const pendingCorrections = all.filter(c => c.status === 'pending').length;
      
      // Fetch submissions and claims counts from API
      let pendingSubmissions = 0;
      let pendingClaims = 0;
      
      try {
        const submissionsRes = await fetch(`${API_URL}/api/v1/submissions?status=pending`, {
          headers: { 'X-User-Id': user?.id || '' }
        });
        if (submissionsRes.ok) {
          const data = await submissionsRes.json();
          pendingSubmissions = Array.isArray(data) ? data.length : 0;
        }
      } catch { /* API might not be available */ }
      
      try {
        const claimsRes = await fetch(`${API_URL}/api/v1/claims?status=pending`, {
          headers: { 'X-User-Id': user?.id || '' }
        });
        if (claimsRes.ok) {
          const data = await claimsRes.json();
          pendingClaims = Array.isArray(data) ? data.length : 0;
        }
      } catch { /* API might not be available */ }
      
      setPendingCounts({
        submissions: pendingSubmissions,
        claims: pendingClaims,
        corrections: pendingCorrections
      });
    } catch (error) {
      console.error('Failed to fetch pending counts:', error);
    }
  };

  const fetchCorrections = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(CORRECTIONS_KEY);
      const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
      const filtered = filter === 'all' ? all : all.filter(c => c.status === filter);
      setCorrections(filtered);
    } catch (error) {
      console.error('Failed to fetch corrections:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewCorrection = (id: string, status: 'approved' | 'rejected') => {
    const stored = localStorage.getItem(CORRECTIONS_KEY);
    const all: DataCorrection[] = stored ? JSON.parse(stored) : [];
    const updated = all.map(c => c.id === id ? { ...c, status } : c);
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(updated));
    showToast(`Correction ${status}`, 'success');
    fetchCorrections();
    fetchPendingCounts(); // Update badge counts
  };

  const handleBulkImport = () => {
    if (!importData.trim()) {
      showToast('Please paste CSV data', 'error');
      return;
    }
    try {
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        showToast('CSV must have header and at least one data row', 'error');
        return;
      }
      const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];
      const records = lines.slice(1).map(line => {
        const values = line.split(',');
        const record: Record<string, string> = {};
        headers.forEach((h, i) => record[h] = values[i]?.trim() || '');
        return record;
      });
      // Store for processing
      localStorage.setItem('kingshot_bulk_import', JSON.stringify({
        records,
        imported_at: new Date().toISOString(),
        imported_by: user?.id
      }));
      showToast(`Imported ${records.length} records for processing`, 'success');
      setImportData('');
    } catch (error) {
      showToast('Invalid CSV format', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    logger.log('[Admin] Fetching submissions with filter:', filter);
    try {
      const url = `${API_URL}/api/v1/submissions?status=${filter}`;
      logger.log('[Admin] Fetch URL:', url);
      const response = await fetch(url, {
        headers: { 'X-User-Id': user?.id || '' }
      });
      logger.log('[Admin] Response status:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        logger.log('[Admin] Submissions received:', data.length, data);
        setSubmissions(data);
      } else {
        const errorText = await response.text();
        console.error('[Admin] Error response:', errorText);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/claims?status=${filter}`, {
        headers: { 'X-User-Id': user?.id || '' }
      });
      if (response.ok) {
        setClaims(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewSubmission = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`${API_URL}/api/v1/submissions/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || ''
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        showToast(`Submission ${status}`, 'success');
        fetchSubmissions();
      } else {
        showToast('Failed to review submission', 'error');
      }
    } catch (error) {
      showToast('Error reviewing submission', 'error');
    }
  };

  const verifyClaim = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/claims/${id}/verify`, {
        method: 'POST',
        headers: { 'X-User-Id': user?.id || '' }
      });
      if (response.ok) {
        showToast('Claim verified', 'success');
        fetchClaims();
      } else {
        showToast('Failed to verify claim', 'error');
      }
    } catch (error) {
      showToast('Error verifying claim', 'error');
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
        Please sign in to access the admin panel.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ 
        fontSize: '2rem', 
        fontWeight: 700, 
        marginBottom: '1.5rem',
        color: '#ffffff'
      }}>
        Admin Panel
      </h1>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '1px solid #2a2a2a',
        paddingBottom: '0.5rem',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'submissions', label: 'KvK Results', icon: '⚔️', countKey: 'submissions' as const },
          { id: 'claims', label: 'Kingdom Claims', icon: '👑', countKey: 'claims' as const },
          { id: 'corrections', label: 'Data Corrections', icon: '📝', countKey: 'corrections' as const },
          { id: 'import', label: 'Bulk Import', icon: '📤', countKey: null }
        ].map(tab => {
          const count = tab.countKey ? pendingCounts[tab.countKey] : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeTab === tab.id ? '#22d3ee' : 'transparent',
                color: activeTab === tab.id ? '#0a0a0a' : '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.9rem'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
              {count > 0 && (
                <span style={{
                  backgroundColor: activeTab === tab.id ? '#0a0a0a' : '#fbbf24',
                  color: activeTab === tab.id ? '#22d3ee' : '#0a0a0a',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '9999px',
                  minWidth: '1.2rem',
                  textAlign: 'center'
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '1rem' }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#111116',
            color: '#ffffff',
            border: '1px solid #2a2a2a',
            borderRadius: '6px'
          }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          {activeTab === 'claims' && <option value="verified">Verified</option>}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          Loading...
        </div>
      ) : activeTab === 'submissions' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} submissions
            </div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  backgroundColor: '#111116',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid #2a2a2a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#22d3ee', fontWeight: 600 }}>
                      K{sub.kingdom_number}
                    </span>
                    <span style={{ color: '#6b7280' }}> vs </span>
                    <span style={{ color: '#f97316', fontWeight: 600 }}>
                      K{sub.opponent_kingdom}
                    </span>
                    <span style={{ color: '#6b7280', marginLeft: '1rem' }}>
                      KvK #{sub.kvk_number}
                    </span>
                  </div>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    backgroundColor: sub.status === 'pending' ? '#fbbf2420' : sub.status === 'approved' ? '#22c55e20' : '#ef444420',
                    color: sub.status === 'pending' ? '#fbbf24' : sub.status === 'approved' ? '#22c55e' : '#ef4444',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {sub.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Prep: </span>
                    <span style={{ color: sub.prep_result === 'W' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {sub.prep_result === 'W' ? 'Win' : 'Loss'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Battle: </span>
                    <span style={{ color: sub.battle_result === 'W' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {sub.battle_result === 'W' ? 'Win' : 'Loss'}
                    </span>
                  </div>
                </div>

                {sub.notes && (
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Notes: {sub.notes}
                  </div>
                )}

                {/* Screenshot Proof */}
                {sub.screenshot_url && !sub.screenshot_url.startsWith('base64:') && !sub.screenshot_url.startsWith('pending_upload:') && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>📸 Screenshot Proof:</div>
                    <a 
                      href={sub.screenshot_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ display: 'block' }}
                    >
                      <img 
                        src={sub.screenshot_url} 
                        alt="KvK Result Screenshot"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '200px',
                          borderRadius: '8px',
                          border: '1px solid #2a2a2a',
                          objectFit: 'contain',
                          cursor: 'pointer'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </a>
                  </div>
                )}
                
                {sub.screenshot_url && (sub.screenshot_url.startsWith('base64:') || sub.screenshot_url.startsWith('pending_upload:')) && (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '0.5rem', 
                    backgroundColor: '#fbbf2420', 
                    border: '1px solid #fbbf24', 
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#fbbf24'
                  }}>
                    ⚠️ Screenshot uploaded but storage pending. Contact admin if persists.
                  </div>
                )}

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderTop: '1px solid #2a2a2a',
                  paddingTop: '1rem',
                  marginTop: '0.5rem'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    By {sub.submitter_name || 'Anonymous'} • {new Date(sub.created_at).toLocaleDateString()}
                  </div>
                  
                  {sub.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => reviewSubmission(sub.id, 'approved')}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#22c55e',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewSubmission(sub.id, 'rejected')}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'claims' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {claims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} claims
            </div>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.id}
                style={{
                  backgroundColor: '#111116',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid #2a2a2a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '1.25rem' }}>
                    Kingdom {claim.kingdom_number}
                  </span>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    backgroundColor: claim.status === 'pending' ? '#fbbf2420' : '#22c55e20',
                    color: claim.status === 'pending' ? '#fbbf24' : '#22c55e',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {claim.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Verification Code: <code style={{ color: '#fbbf24', backgroundColor: '#1a1a1f', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{claim.verification_code}</code>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderTop: '1px solid #2a2a2a',
                  paddingTop: '1rem'
                }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    Claimed {new Date(claim.created_at).toLocaleDateString()}
                  </div>
                  
                  {claim.status === 'pending' && (
                    <button
                      onClick={() => verifyClaim(claim.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#22c55e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Verify Claim
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'corrections' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {corrections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No {filter} data corrections
            </div>
          ) : (
            corrections.map((correction) => (
              <div
                key={correction.id}
                style={{
                  backgroundColor: '#111116',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid #2a2a2a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 600 }}>
                    K{correction.kingdom_number} - {correction.field}
                  </span>
                  <div style={{ 
                    padding: '0.25rem 0.75rem',
                    backgroundColor: correction.status === 'pending' ? '#fbbf2420' : correction.status === 'approved' ? '#22c55e20' : '#ef444420',
                    color: correction.status === 'pending' ? '#fbbf24' : correction.status === 'approved' ? '#22c55e' : '#ef4444',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {correction.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Current: </span>
                    <span style={{ color: '#ef4444' }}>{correction.current_value}</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Suggested: </span>
                    <span style={{ color: '#22c55e' }}>{correction.suggested_value}</span>
                  </div>
                </div>

                {correction.reason && (
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Reason: {correction.reason}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    By {correction.submitter_name} • {new Date(correction.created_at).toLocaleDateString()}
                  </div>
                  
                  {correction.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => reviewCorrection(correction.id, 'approved')}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewCorrection(correction.id, 'rejected')}
                        style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'import' ? (
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Bulk Import KvK Results</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Upload a CSV file or paste data directly. Required columns: kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result
          </p>
          
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#22d3ee20',
                border: '1px solid #22d3ee50',
                borderRadius: '8px',
                color: '#22d3ee',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              📁 Choose CSV File
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Or paste CSV data:
            </label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="kingdom_number,kvk_number,opponent_kingdom,prep_result,battle_result&#10;1234,5,5678,W,L&#10;1234,6,9012,W,W"
              style={{
                width: '100%',
                height: '200px',
                padding: '1rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
            />
          </div>

          <button
            onClick={handleBulkImport}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#22c55e',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Import Data
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Admin;
