import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import { BattleRegistry } from './types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface BattleRegistryListProps {
  isMobile: boolean;
  user: { id: string } | null;
  profile: { linked_kingdom?: number; linked_player_id?: string; is_admin?: boolean } | null;
  goldKingdoms: Set<number>;
  hasPromoAccess: (kingdomNumber: number) => boolean;
  isPromoActive: boolean;
  promoMsRemaining: number;
  myRegistries: BattleRegistry[];
  kingdomRegistries: BattleRegistry[];
  submittedRegistries: BattleRegistry[];
  navigate: (path: string) => void;
  isEditorOrCoEditor: boolean;
  isManager: boolean;
  createKingdom: number;
  setCreateKingdom: (v: number) => void;
  createKvkNumber: number;
  setCreateKvkNumber: (v: number) => void;
  createNotes: string;
  setCreateNotes: (v: string) => void;
  createWebhookUrl: string;
  setCreateWebhookUrl: (v: string) => void;
  duplicateWarningRegistries: BattleRegistry[];
  createRegistry: () => Promise<void>;
  saving: boolean;
}

const BattleRegistryList: React.FC<BattleRegistryListProps> = ({
  isMobile, user, profile, goldKingdoms, hasPromoAccess, isPromoActive, promoMsRemaining,
  myRegistries, kingdomRegistries, submittedRegistries, navigate,
  isEditorOrCoEditor, isManager,
  createKingdom, setCreateKingdom, createKvkNumber, setCreateKvkNumber,
  createNotes, setCreateNotes, createWebhookUrl, setCreateWebhookUrl,
  duplicateWarningRegistries, createRegistry, saving,
}) => {
  const { t } = useTranslation();

  const hasQualifyingTier = (kn: number) => goldKingdoms.has(kn) || hasPromoAccess(kn);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
    fontSize: isMobile ? '1rem' : '0.85rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem',
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface, borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem',
    border: `1px solid ${colors.border}`,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            <span style={{ color: '#fff' }}>KvK</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.5rem' }}>BATTLE REGISTRY</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.95rem', lineHeight: 1.6 }}>
            {t('battleRegistry.subtitle', 'Report your availability and troop strength for KvK Castle Battles. Your kingdom needs to know who\'s showing up — and what they\'re bringing.')}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', padding: '0.2rem 0.6rem', backgroundColor: '#ffc30b15', border: '1px solid #ffc30b30', borderRadius: '20px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ffc30b' }}>{t('battleRegistry.goldTierKingdoms', 'GOLD TIER KINGDOMS')}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {/* Silver Promo Countdown */}
        {user && profile?.linked_kingdom && isPromoActive && hasPromoAccess(profile.linked_kingdom) && !goldKingdoms.has(profile.linked_kingdom) && (
          <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#c0c0c030', backgroundColor: '#c0c0c008', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🥈</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#c0c0c0', fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                {t('battleRegistry.silverPromoActive', 'Silver Tier Promo — You have temporary access!')}
              </p>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                {(() => {
                  const days = Math.floor(promoMsRemaining / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((promoMsRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  if (days > 0) return t('battleRegistry.silverPromoCountdown', 'Access expires in {{days}}d {{hours}}h.', { days, hours });
                  return t('battleRegistry.silverPromoCountdownHours', 'Access expires in {{hours}}h.', { hours });
                })()}
              </p>
            </div>
          </div>
        )}

        {/* Kingdom Registries CTA */}
        {kingdomRegistries.length > 0 && user && profile?.linked_kingdom && hasQualifyingTier(profile.linked_kingdom) && (() => {
          const activeKR = kingdomRegistries.filter(s => s.status === 'active');
          const closedKR = kingdomRegistries.filter(s => s.status === 'closed');
          return (
            <>
              {activeKR.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#ef444430', backgroundColor: '#ef444408' }}>
                  <h3 style={{ color: '#ef4444', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 700 }}>⚔️ {t('battleRegistry.activeRegistry', 'Your Kingdom Has an Active Battle Registry')}</h3>
                  <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {t('battleRegistry.activeRegistryDesc', 'Kingdom {{kingdom}} has {{count}} active registry(ies). Submit your availability and troop info so your leadership can plan the castle hit.', { kingdom: profile.linked_kingdom, count: activeKR.length })}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeKR.map(kr => (
                      <button key={kr.id} onClick={() => navigate(`/tools/battle-registry/${kr.id}`)}
                        style={{ padding: isMobile ? '0.75rem 1rem' : '0.6rem 1rem', backgroundColor: '#ef444420', border: '1px solid #ef444450', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', width: isMobile ? '100%' : 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '44px' }}>
                        📝 {t('battleRegistry.fillForm', 'Register Now')}{kr.kvk_number ? ` — KvK #${kr.kvk_number}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {closedKR.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#6b728030', backgroundColor: '#6b728008' }}>
                  <h3 style={{ color: colors.textSecondary, fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 700 }}>🔒 {t('battleRegistry.closedRegistry', 'Closed Registry')}</h3>
                  <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {t('battleRegistry.closedRegistryDesc', 'The registration window has ended. View the registry to check the summary.')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {closedKR.map(kr => (
                      <button key={kr.id} onClick={() => navigate(`/tools/battle-registry/${kr.id}`)}
                        style={{ padding: isMobile ? '0.75rem 1rem' : '0.6rem 1rem', backgroundColor: `${colors.textMuted}10`, border: `1px solid ${colors.textMuted}30`, borderRadius: '8px', color: colors.textSecondary, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', width: isMobile ? '100%' : 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '44px' }}>
                        👁️ {t('battleRegistry.viewRegistry', 'View Registry')}{kr.kvk_number ? ` — KvK #${kr.kvk_number}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Submitted Registries */}
        {submittedRegistries.length > 0 && user && (() => {
          const uniqueSubmitted = submittedRegistries.filter(s => !myRegistries.some(ms => ms.id === s.id) && !kingdomRegistries.some(ks => ks.id === s.id));
          if (uniqueSubmitted.length === 0) return null;
          return (
            <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#22c55e30', backgroundColor: '#22c55e08' }}>
              <h3 style={{ color: '#22c55e', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 700 }}>📬 {t('battleRegistry.yourSubmissions', 'Your Submissions')}</h3>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                {t('battleRegistry.yourSubmissionsDesc', 'Registries you\'ve submitted your info to.')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {uniqueSubmitted.map(s => (
                  <button key={s.id} onClick={() => navigate(`/tools/battle-registry/${s.id}`)}
                    style={{ padding: '0.6rem 1rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🗓️ {t('battleRegistry.kingdom', 'Kingdom')} {s.kingdom_number}{s.kvk_number ? ` — KvK #${s.kvk_number}` : ''}
                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: s.status === 'active' ? `${colors.success}20` : `${colors.textMuted}20`, color: s.status === 'active' ? colors.success : colors.textMuted, fontWeight: 600 }}>{s.status}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Tier Required notice */}
        {user && profile?.linked_kingdom && !hasQualifyingTier(profile.linked_kingdom) && !kingdomRegistries.length && myRegistries.length === 0 && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#ffc30b30', backgroundColor: '#ffc30b08' }}>
            <h3 style={{ color: '#d1d5db', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('battleRegistry.goldTierRequired', 'Gold Tier Required')}</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.5 }}>
              {t('battleRegistry.goldTierRequiredDesc', 'The KvK Battle Registry is available for Gold Tier ($100+) kingdoms. Contribute to the Kingdom Fund to reach Gold and unlock this tool!')}
            </p>
          </div>
        )}

        {/* Permission info banner */}
        {user && profile?.linked_kingdom && hasQualifyingTier(profile.linked_kingdom) && !profile?.is_admin && !isEditorOrCoEditor && !isManager && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#ef444430', backgroundColor: '#ef444408', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
              {t('battleRegistry.noPermissionBanner', 'Only Editors, Co-Editors, and Battle Managers can create registries. Ask your kingdom leadership for access.')}
            </p>
          </div>
        )}

        {/* Create New Registry */}
        {user && (profile?.is_admin || ((isEditorOrCoEditor || isManager) && profile?.linked_kingdom && hasQualifyingTier(profile.linked_kingdom))) && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h3 style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>⚔️ {t('battleRegistry.createRegistry', 'Create New Battle Registry')}</h3>
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              {t('battleRegistry.createRegistryDesc', 'Create a Battle Registry for your Gold Tier kingdom. Share the link with players so they can register their availability and troop levels for the upcoming castle battle.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>{t('battleRegistry.kingdomNumber', 'Kingdom Number')} *</label>
                <input type="number" value={createKingdom || ''} readOnly={!!profile?.linked_kingdom}
                  style={{ ...inputStyle, ...(profile?.linked_kingdom ? { opacity: 0.7, cursor: 'not-allowed', backgroundColor: '#1a1a1a' } : {}) }}
                  onChange={(e) => { if (!profile?.linked_kingdom) setCreateKingdom(parseInt(e.target.value) || 0); }} placeholder="e.g. 172" />
                {profile?.linked_kingdom && <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>{t('battleRegistry.autoFilled', 'Auto-filled from your linked kingdom.')}</p>}
                {createKingdom > 0 && !hasQualifyingTier(createKingdom) && (
                  <p style={{ color: colors.error, fontSize: '0.7rem', marginTop: '0.25rem' }}>⚠️ {t('battleRegistry.notQualifyingTier', 'Kingdom {{kingdom}} does not have Gold tier.', { kingdom: createKingdom })}</p>
                )}
              </div>
              <div>
                <label style={labelStyle}>{t('battleRegistry.kvkNumber', 'KvK Number (optional)')}</label>
                <input type="number" value={createKvkNumber || ''} onChange={(e) => setCreateKvkNumber(parseInt(e.target.value) || 0)} placeholder="e.g. 11" style={inputStyle} />
              </div>
              {/* Duplicate Kingdom+KvK Warning */}
              {duplicateWarningRegistries.length > 0 && (
                <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#f9731610', border: '1px solid #f9731630', borderRadius: '8px' }}>
                  <p style={{ color: '#f97316', fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.3rem' }}>⚠️ {t('battleRegistry.duplicateKvkWarning', 'A registry already exists for K{{kingdom}} KvK #{{kvk}}', { kingdom: createKingdom, kvk: createKvkNumber })}</p>
                  {duplicateWarningRegistries.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.15rem' }}>
                      <span style={{ padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600, backgroundColor: r.status === 'active' ? `${colors.success}20` : r.status === 'archived' ? '#a855f720' : `${colors.textMuted}20`, color: r.status === 'active' ? colors.success : r.status === 'archived' ? '#a855f7' : colors.textMuted }}>{r.status}</span>
                      <span>{t('battleRegistry.createdOn', 'Created {{date}}', { date: formatDate(r.created_at) })}</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label style={labelStyle}>{t('battleRegistry.notesForPlayers', 'Notes for Players (optional)')}</label>
                <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder={t('battleRegistry.notesPlaceholder', 'Any instructions or reminders...')} rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              </div>
              <div>
                <label style={labelStyle}>🔔 {t('battleRegistry.discordWebhook', 'Discord Webhook URL (optional)')}</label>
                <input type="url" value={createWebhookUrl} onChange={(e) => setCreateWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  style={inputStyle} />
                <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>{t('battleRegistry.discordWebhookDesc', 'Get notified in Discord when players register, registry is locked, etc.')}</p>
              </div>
              <button onClick={createRegistry} disabled={saving || !createKingdom || !hasQualifyingTier(createKingdom)}
                style={{ padding: isMobile ? '0.75rem 1.25rem' : '0.6rem 1.25rem', backgroundColor: createKingdom && hasQualifyingTier(createKingdom) ? '#ef444420' : `${colors.textMuted}10`, border: `1px solid ${createKingdom && hasQualifyingTier(createKingdom) ? '#ef444450' : colors.border}`, borderRadius: '8px', color: createKingdom && hasQualifyingTier(createKingdom) ? '#ef4444' : colors.textMuted, fontSize: '0.85rem', fontWeight: 600, cursor: createKingdom && hasQualifyingTier(createKingdom) ? 'pointer' : 'not-allowed', width: isMobile ? '100%' : 'fit-content', opacity: saving ? 0.6 : 1, minHeight: '44px' }}>
                {saving ? t('battleRegistry.creating', 'Creating...') : `⚔️ ${t('battleRegistry.createRegistryBtn', 'Create Registry')}`}
              </button>
            </div>
          </div>
        )}

        {/* My Registries */}
        {myRegistries.length > 0 && (() => {
          const activeOrClosed = myRegistries.filter(s => s.status !== 'archived');
          const archived = myRegistries.filter(s => s.status === 'archived');
          return (
            <>
              {activeOrClosed.length > 0 && (
                <div style={cardStyle}>
                  <h3 style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>📁 {t('battleRegistry.myRegistries', 'My Registries')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeOrClosed.map(s => (
                      <div key={s.id} onClick={() => navigate(`/tools/battle-registry/${s.id}`)}
                        style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', backgroundColor: colors.bg, border: `1px solid ${colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>{t('battleRegistry.kingdom', 'Kingdom')} {s.kingdom_number}</span>
                          {s.kvk_number && <span style={{ color: colors.textMuted, fontSize: '0.75rem', marginLeft: '0.5rem' }}>KvK #{s.kvk_number}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {s.locked_at && <span style={{ fontSize: '0.7rem' }}>🔒</span>}
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: s.status === 'active' ? `${colors.success}20` : `${colors.textMuted}20`, color: s.status === 'active' ? colors.success : colors.textMuted }}>{s.status}</span>
                          <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {archived.length > 0 && (
                <div style={{ ...cardStyle, marginTop: '1rem', borderColor: '#a855f720' }}>
                  <h3 style={{ color: '#a855f7', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>📦 {t('battleRegistry.archivedRegistries', 'Archived Registries')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {archived.map(s => (
                      <div key={s.id} onClick={() => navigate(`/tools/battle-registry/${s.id}`)}
                        style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', backgroundColor: colors.bg, border: `1px solid ${colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                        <div>
                          <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>{t('battleRegistry.kingdom', 'Kingdom')} {s.kingdom_number}</span>
                          {s.kvk_number && <span style={{ color: colors.textMuted, fontSize: '0.75rem', marginLeft: '0.5rem' }}>KvK #{s.kvk_number}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: '#a855f720', color: '#a855f7' }}>archived</span>
                          <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Empty State */}
        {myRegistries.length === 0 && kingdomRegistries.length === 0 && submittedRegistries.length === 0 && user && (
          <div style={{ ...cardStyle, marginTop: '1rem', textAlign: 'center', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚔️</div>
            <h3 style={{ color: colors.text, fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {t('battleRegistry.noRegistriesYet', 'No Registries Yet')}
            </h3>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.6 }}>
              {profile?.linked_kingdom && hasQualifyingTier(profile.linked_kingdom)
                ? t('battleRegistry.noRegistriesGold', 'Create your first Battle Registry above to collect player availability for castle battles.')
                : t('battleRegistry.noRegistriesGeneral', 'When your kingdom has an active Battle Registry, it will appear here. Ask your leadership to share the form link.')}
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingBottom: isMobile ? '1.5rem' : '0' }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>← {t('battleRegistry.backToTools', 'Back to Tools')}</Link>
        </div>
      </div>
    </div>
  );
};

export default BattleRegistryList;
