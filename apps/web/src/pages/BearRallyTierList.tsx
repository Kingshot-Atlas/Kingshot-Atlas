import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import {
  EG_BONUS_BY_LEVEL,
  getHeroesByTroopType,
  calculateBearScore,
  assignBearTier,
  BEAR_TIER_COLORS,
  BEAR_STORAGE_KEY,
  BEAR_DISCLAIMER_KEY,
  BEAR_DISCLAIMER_DEFAULT,
  type BearPlayerEntry,
  type BearTier,
  type TroopType,
} from '../data/bearHuntData';
import { useAllianceCenter } from '../hooks/useAllianceCenter';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT = '#3b82f6'; // Blue theme for alliance tools
const ACCENT_LIGHT = '#60a5fa';

const EG_LEVELS = Array.from({ length: 11 }, (_, i) => i);

const infantryHeroes = getHeroesByTroopType('infantry');
const cavalryHeroes = getHeroesByTroopType('cavalry');
const archerHeroes = getHeroesByTroopType('archer');

// ─── Helper: generate unique ID ─────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── Helper: load/save localStorage ─────────────────────────────────────────

function loadPlayers(): BearPlayerEntry[] {
  try {
    const raw = localStorage.getItem(BEAR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function savePlayers(players: BearPlayerEntry[]) {
  localStorage.setItem(BEAR_STORAGE_KEY, JSON.stringify(players));
}

// ─── Empty Form State ───────────────────────────────────────────────────────

interface FormState {
  playerName: string;
  infantryHero: string;
  infantryEGLevel: number;
  infantryAttack: string;
  infantryLethality: string;
  cavalryHero: string;
  cavalryEGLevel: number;
  cavalryAttack: string;
  cavalryLethality: string;
  archerHero: string;
  archerEGLevel: number;
  archerAttack: string;
  archerLethality: string;
}

const emptyForm: FormState = {
  playerName: '',
  infantryHero: infantryHeroes[0]?.name ?? '',
  infantryEGLevel: 0,
  infantryAttack: '',
  infantryLethality: '',
  cavalryHero: cavalryHeroes[0]?.name ?? '',
  cavalryEGLevel: 0,
  cavalryAttack: '',
  cavalryLethality: '',
  archerHero: archerHeroes[0]?.name ?? '',
  archerEGLevel: 0,
  archerAttack: '',
  archerLethality: '',
};

// ─── Tier Badge Component ───────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: BearTier; size?: 'sm' | 'md' }> = ({ tier, size = 'md' }) => {
  const color = BEAR_TIER_COLORS[tier];
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: isSm ? '28px' : '36px',
      height: isSm ? '22px' : '28px',
      padding: `0 ${isSm ? '0.35rem' : '0.5rem'}`,
      backgroundColor: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: '6px',
      color,
      fontSize: isSm ? '0.65rem' : '0.75rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
      fontFamily: FONT_DISPLAY,
    }}>
      {tier}
    </span>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const BearRallyTierList: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('bearRally.pageTitle', 'Bear Rally Tier List'));
  useMetaTags({
    title: 'Bear Rally Tier List — Kingshot Atlas',
    description: 'Rank your alliance players by Bear Hunt rally power. Input hero stats, get Bear Scores, see who hits hardest.',
  });
  const isMobile = useIsMobile();

  // ── Alliance Roster (optional — works without auth) ──
  const ac = useAllianceCenter();
  const rosterNames = useMemo(() =>
    ac.members.map(m => m.player_name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [ac.members]
  );

  // ── State ──
  const [players, setPlayers] = useState<BearPlayerEntry[]>(loadPlayers);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filtered roster suggestions based on current input
  const nameSuggestions = useMemo(() => {
    if (!form.playerName.trim() || rosterNames.length === 0) return [];
    const q = form.playerName.trim().toLowerCase();
    return rosterNames.filter(n =>
      n.toLowerCase().includes(q) && n.toLowerCase() !== q
    ).slice(0, 8);
  }, [form.playerName, rosterNames]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        nameInputRef.current && !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Persist to localStorage
  useEffect(() => { savePlayers(players); }, [players]);

  // ── Sorted & ranked players ──
  const rankedPlayers = useMemo(() =>
    [...players].sort((a, b) => b.bearScore - a.bearScore).map((p, i) => ({ ...p, rank: i + 1 })),
    [players]
  );

  // ── Form Handlers ──
  const updateForm = useCallback((field: keyof FormState, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.playerName.trim()) {
      setFormError(t('bearRally.errorName', 'Player name is required.'));
      return;
    }

    const infAtk = parseFloat(form.infantryAttack) || 0;
    const infLeth = parseFloat(form.infantryLethality) || 0;
    const cavAtk = parseFloat(form.cavalryAttack) || 0;
    const cavLeth = parseFloat(form.cavalryLethality) || 0;
    const archAtk = parseFloat(form.archerAttack) || 0;
    const archLeth = parseFloat(form.archerLethality) || 0;

    const bearScore = calculateBearScore(
      form.infantryHero, form.infantryEGLevel, infAtk, infLeth,
      form.cavalryHero, form.cavalryEGLevel, cavAtk, cavLeth,
      form.archerHero, form.archerEGLevel, archAtk, archLeth,
    );

    const entry: Omit<BearPlayerEntry, 'tier'> & { tier: BearTier } = {
      id: editingId || genId(),
      playerName: form.playerName.trim(),
      infantryHero: form.infantryHero,
      infantryEGLevel: form.infantryEGLevel,
      infantryAttack: infAtk,
      infantryLethality: infLeth,
      cavalryHero: form.cavalryHero,
      cavalryEGLevel: form.cavalryEGLevel,
      cavalryAttack: cavAtk,
      cavalryLethality: cavLeth,
      archerHero: form.archerHero,
      archerEGLevel: form.archerEGLevel,
      archerAttack: archAtk,
      archerLethality: archLeth,
      bearScore,
      tier: 'D', // placeholder — recalculated below with all scores
    };

    setPlayers(prev => {
      let updated: BearPlayerEntry[];
      if (editingId) {
        updated = prev.map(p => p.id === editingId ? entry : p);
      } else {
        updated = [...prev, entry];
      }
      // Recalculate tiers for ALL players using percentile-based assignment
      const allScores = updated.map(p => p.bearScore);
      return updated.map(p => ({ ...p, tier: assignBearTier(p.bearScore, allScores) }));
    });

    // Sync new name to alliance roster if not already there
    const trimmedName = form.playerName.trim();
    if (
      !editingId &&
      ac.alliance &&
      ac.canManage &&
      trimmedName &&
      !rosterNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())
    ) {
      ac.addMember({ player_name: trimmedName }).catch(() => { /* silent — roster sync is best-effort */ });
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFormError('');
  }, [form, editingId, t, ac, rosterNames]);

  const handleEdit = useCallback((player: BearPlayerEntry) => {
    setForm({
      playerName: player.playerName,
      infantryHero: player.infantryHero,
      infantryEGLevel: player.infantryEGLevel,
      infantryAttack: player.infantryAttack.toString(),
      infantryLethality: player.infantryLethality.toString(),
      cavalryHero: player.cavalryHero,
      cavalryEGLevel: player.cavalryEGLevel,
      cavalryAttack: player.cavalryAttack.toString(),
      cavalryLethality: player.cavalryLethality.toString(),
      archerHero: player.archerHero,
      archerEGLevel: player.archerEGLevel,
      archerAttack: player.archerAttack.toString(),
      archerLethality: player.archerLethality.toString(),
    });
    setEditingId(player.id);
    setShowForm(true);
    setFormError('');
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPlayers(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (remaining.length === 0) return remaining;
      const allScores = remaining.map(p => p.bearScore);
      return remaining.map(p => ({ ...p, tier: assignBearTier(p.bearScore, allScores) }));
    });
    setDeleteConfirm(null);
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(false);
    }
  }, [editingId]);

  const handleCancelForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFormError('');
  }, []);

  // ── Styles ──
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '0.3rem',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  // ── Hero Section Renderer ──
  const renderHeroSection = (
    _troopType: TroopType,
    label: string,
    emoji: string,
    heroList: { name: string }[],
    heroKey: 'infantryHero' | 'cavalryHero' | 'archerHero',
    egKey: 'infantryEGLevel' | 'cavalryEGLevel' | 'archerEGLevel',
    atkKey: 'infantryAttack' | 'cavalryAttack' | 'archerAttack',
    lethKey: 'infantryLethality' | 'cavalryLethality' | 'archerLethality',
    accentHex: string,
  ) => (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      border: `1px solid ${accentHex}25`,
      padding: isMobile ? '0.85rem' : '1rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '0.75rem',
        fontSize: isMobile ? '0.85rem' : '0.9rem',
        fontWeight: 700, color: accentHex,
      }}>
        <span>{emoji}</span> {label}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
        gap: '0.6rem',
      }}>
        <div>
          <label style={labelStyle}>{t('bearRally.hero', 'Hero')}</label>
          <select
            value={form[heroKey]}
            onChange={(e) => updateForm(heroKey, e.target.value)}
            style={selectStyle}
          >
            {heroList.map(h => (
              <option key={h.name} value={h.name}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t('bearRally.egLevel', 'EG Level')}</label>
          <select
            value={form[egKey]}
            onChange={(e) => updateForm(egKey, parseInt(e.target.value))}
            style={selectStyle}
          >
            {EG_LEVELS.map(lvl => (
              <option key={lvl} value={lvl}>
                Lv {lvl} ({EG_BONUS_BY_LEVEL[lvl]}%)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t('bearRally.attack', 'Attack %')}</label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 250"
            value={form[atkKey]}
            onChange={(e) => updateForm(atkKey, e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('bearRally.lethality', 'Lethality %')}</label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 180"
            value={form[lethKey]}
            onChange={(e) => updateForm(lethKey, e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('bearRally.title1', 'BEAR RALLY')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.5rem' }}>{t('bearRally.title2', 'TIER LIST')}</span>
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            maxWidth: '450px',
            margin: '0 auto',
          }}>
            {t('bearRally.subtitle', 'Rank your alliance by Bear Hunt rally power. Input scouted stats — Atlas handles the math.')}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0.75rem' : '1.5rem' }}>

        {/* Add Player Button */}
        {!showForm && (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.7rem 1.5rem',
                backgroundColor: ACCENT,
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
                fontSize: isMobile ? '0.9rem' : '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: `0 4px 20px ${ACCENT}35`,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t('bearRally.addPlayer', 'Add Player')}
            </button>
          </div>
        )}

        {/* Player Form */}
        {showForm && (
          <div style={{
            marginBottom: '1.5rem',
            backgroundColor: '#0d0d0d',
            borderRadius: '16px',
            border: `1px solid ${ACCENT}30`,
            padding: isMobile ? '1rem' : '1.5rem',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}>
              <h2 style={{
                fontSize: isMobile ? '1rem' : '1.1rem',
                fontWeight: 700,
                color: '#fff',
              }}>
                {editingId
                  ? t('bearRally.editPlayer', 'Edit Player')
                  : t('bearRally.addNewPlayer', 'Add New Player')}
              </h2>
              <button
                onClick={handleCancelForm}
                style={{
                  background: 'none', border: 'none', color: '#6b7280',
                  cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem',
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>

            {/* Player Name (with roster autocomplete) */}
            <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
              <label style={labelStyle}>
                {t('bearRally.playerName', 'Player Name')}
                {rosterNames.length > 0 && (
                  <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.65rem', marginLeft: '0.5rem', textTransform: 'none' }}>
                    {t('bearRally.rosterHint', '(suggestions from alliance roster)')}
                  </span>
                )}
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder={t('bearRally.playerNamePlaceholder', 'e.g. LordCommander')}
                value={form.playerName}
                onChange={(e) => { updateForm('playerName', e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                style={inputStyle}
                autoFocus
                autoComplete="off"
              />
              {showSuggestions && nameSuggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                    marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {nameSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        updateForm('playerName', name);
                        setShowSuggestions(false);
                      }}
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left',
                        background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
                        color: '#d1d5db', fontSize: '0.85rem', cursor: 'pointer',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hero Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {renderHeroSection('infantry', t('bearRally.infantry', 'Infantry'), '🛡️', infantryHeroes, 'infantryHero', 'infantryEGLevel', 'infantryAttack', 'infantryLethality', '#3b82f6')}
              {renderHeroSection('cavalry', t('bearRally.cavalry', 'Cavalry'), '🐎', cavalryHeroes, 'cavalryHero', 'cavalryEGLevel', 'cavalryAttack', 'cavalryLethality', '#f97316')}
              {renderHeroSection('archer', t('bearRally.archer', 'Archer'), '🏹', archerHeroes, 'archerHero', 'archerEGLevel', 'archerAttack', 'archerLethality', '#ef4444')}
            </div>

            {/* Error */}
            {formError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {formError}
              </p>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1,
                  padding: '0.7rem',
                  backgroundColor: ACCENT,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                {editingId
                  ? t('bearRally.updatePlayer', 'Update Player')
                  : t('bearRally.savePlayer', 'Save Player')}
              </button>
            </div>
          </div>
        )}

        {/* Tier List / Rankings Table */}
        {rankedPlayers.length > 0 ? (
          <div style={{
            backgroundColor: '#111111',
            borderRadius: '16px',
            border: '1px solid #2a2a2a',
            overflow: 'hidden',
          }}>
            {/* Table Header */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 100px 100px 60px',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#0d0d0d',
                borderBottom: '1px solid #2a2a2a',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <div>{t('bearRally.rank', 'Rank')}</div>
                <div>{t('bearRally.player', 'Player')}</div>
                <div style={{ textAlign: 'center' }}>{t('bearRally.bearScore', 'Bear Score')}</div>
                <div style={{ textAlign: 'center' }}>{t('bearRally.tierLabel', 'Tier')}</div>
                <div style={{ textAlign: 'center' }}>{t('bearRally.actions', 'Actions')}</div>
              </div>
            )}

            {/* Player Rows */}
            {rankedPlayers.map((player) => {
              const tierColor = BEAR_TIER_COLORS[player.tier];
              return (
                <div
                  key={player.id}
                  style={{
                    borderBottom: '1px solid #1a1a1a',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {isMobile ? (
                    /* Mobile Card Layout */
                    <div style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            color: player.rank <= 3 ? ACCENT_LIGHT : '#6b7280',
                            fontFamily: FONT_DISPLAY,
                            minWidth: '24px',
                          }}>
                            #{player.rank}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                            {player.playerName}
                          </span>
                        </div>
                        <TierBadge tier={player.tier} size="sm" />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            {player.infantryHero} · {player.cavalryHero} · {player.archerHero}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            color: tierColor,
                            fontFamily: FONT_DISPLAY,
                          }}>
                            {player.bearScore.toFixed(1)}
                          </span>
                          <button
                            onClick={() => handleEdit(player)}
                            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.25rem' }}
                            title="Edit"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          {deleteConfirm === player.id ? (
                            <button
                              onClick={() => handleDelete(player.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', fontSize: '0.65rem', fontWeight: 700 }}
                            >
                              {t('common.confirm', 'Confirm')}
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(player.id)}
                              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.25rem' }}
                              title="Delete"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Desktop Row Layout */
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1fr 100px 100px 60px',
                      gap: '0.5rem',
                      padding: '0.65rem 1rem',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        color: player.rank <= 3 ? ACCENT_LIGHT : '#6b7280',
                        fontFamily: FONT_DISPLAY,
                      }}>
                        #{player.rank}
                      </span>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                          {player.playerName}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#4b5563', marginLeft: '0.75rem' }}>
                          {player.infantryHero} · {player.cavalryHero} · {player.archerHero}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: tierColor,
                          fontFamily: FONT_DISPLAY,
                        }}>
                          {player.bearScore.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <TierBadge tier={player.tier} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleEdit(player)}
                          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.3rem' }}
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {deleteConfirm === player.id ? (
                          <button
                            onClick={() => handleDelete(player.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem', fontSize: '0.6rem', fontWeight: 700 }}
                          >
                            {t('common.confirm', 'Confirm')}
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(player.id)}
                            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.3rem' }}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary Footer */}
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#0d0d0d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {t('bearRally.totalPlayers', '{{count}} players', { count: players.length })}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['SS', 'S', 'A', 'B', 'C', 'D'] as BearTier[]).map(tier => {
                  const count = players.filter(p => p.tier === tier).length;
                  if (count === 0) return null;
                  return (
                    <span key={tier} style={{
                      fontSize: '0.65rem',
                      color: BEAR_TIER_COLORS[tier],
                      fontWeight: 700,
                    }}>
                      {tier}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          !showForm && (
            <div style={{
              textAlign: 'center',
              padding: isMobile ? '2rem 1rem' : '3rem 2rem',
              backgroundColor: '#111111',
              borderRadius: '16px',
              border: '1px solid #2a2a2a',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                backgroundColor: `${ACCENT}12`, border: `2px solid ${ACCENT}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <span style={{ fontSize: '1.5rem' }}>🐻</span>
              </div>
              <h3 style={{
                fontSize: isMobile ? '1rem' : '1.15rem',
                fontWeight: 700, color: '#fff',
                marginBottom: '0.5rem',
              }}>
                {t('bearRally.emptyTitle', 'No players yet')}
              </h3>
              <p style={{
                color: '#6b7280',
                fontSize: isMobile ? '0.8rem' : '0.85rem',
                maxWidth: '400px', margin: '0 auto 1.25rem',
                lineHeight: 1.5,
              }}>
                {t('bearRally.emptyDesc', 'Scout your alliance members with their best Bear Hunt team in the Guard Station, then add them here.')}
              </p>
              <button
                onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.7rem 1.5rem',
                  backgroundColor: ACCENT, border: 'none', borderRadius: '10px',
                  color: '#fff', fontWeight: 700,
                  fontSize: isMobile ? '0.9rem' : '0.95rem', cursor: 'pointer',
                  boxShadow: `0 4px 20px ${ACCENT}35`,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {t('bearRally.addFirstPlayer', 'Add First Player')}
              </button>
            </div>
          )
        )}

        {/* Info Card */}
        <div style={{
          marginTop: '1.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: `1px solid ${ACCENT}15`,
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT}05 100%)`,
        }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: ACCENT, marginBottom: '0.5rem' }}>
            💡 {t('bearRally.howItWorksTitle', 'How it works')}
          </h4>
          <ul style={{
            color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem',
            lineHeight: 1.7, paddingLeft: '1.25rem', margin: 0,
          }}>
            <li>{t('bearRally.tip1', 'Scout each alliance member with their best Bear Hunt team in the Guard Station (heroes must be in city).')}</li>
            <li>{t('bearRally.tip2', 'Input the 3 heroes (Infantry, Cavalry, Archer), their Exclusive Gear levels, and the Attack/Lethality percentages from the scout report.')}</li>
            <li>{t('bearRally.tip3', 'Atlas automatically adjusts for defensive EG bonuses (inflated in scout) and applies offensive EG bonuses (active in rally).')}</li>
            <li>{t('bearRally.tip4', 'Players are ranked by Bear Score and assigned tiers from SS (highest) to D (lowest).')}</li>
          </ul>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: '1rem',
          padding: isMobile ? '0.75rem' : '0.85rem 1rem',
          backgroundColor: '#f59e0b08',
          border: '1px solid #f59e0b20',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.8rem', flexShrink: 0, lineHeight: 1.6 }}>⚠️</span>
          <p style={{ color: '#d1a054', fontSize: isMobile ? '0.7rem' : '0.75rem', lineHeight: 1.6, margin: 0 }}>
            {t(BEAR_DISCLAIMER_KEY, BEAR_DISCLAIMER_DEFAULT)}
          </p>
        </div>

        {/* Back Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools/bear-rally-tier-list/about" style={{ color: ACCENT, textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('bearRally.aboutTool', 'About this tool')}
          </Link>
          <Link to="/alliance-center" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('bearRally.allianceCenter', '← Alliance Center')}
          </Link>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.allTools', '← All Tools')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BearRallyTierList;
