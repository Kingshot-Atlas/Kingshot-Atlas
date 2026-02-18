import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { FONT_DISPLAY, colors } from '../utils/styles';
import {
  BrowseTransfereesTab,
  CoEditorsTab,
  FundTab,
  KingdomProfileTab,
  RecruiterOnboarding,
  RecruiterSkeleton,
  NoEditorState,
  InboxTab,
  TeamTab,
  WatchlistTab,
  SentInvitesPanel,
  RecruiterAnalyticsTab,
  useRecruiterDashboard,
  BrowseTabSkeleton,
  ProfileTabSkeleton,
  TeamTabSkeleton,
  WatchlistTabSkeleton,
  FundTabSkeleton,
} from './recruiter';

// =============================================
// RECRUITER DASHBOARD
// =============================================

const RecruiterDashboard: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();

  const dashboard = useRecruiterDashboard();
  const {
    editorInfo, team, fund, loading,
    activeTab, setActiveTab, filterStatus, setFilterStatus,
    pendingInvite, showOnboarding, setShowOnboarding,
    handleStatusChange, handleToggleRecruiting,
    handleAcceptInvite, handleDeclineInvite,
    loadDashboard, setFund, getInviteBudget,
    pendingCoEditorRequests, activeApps, approvedApps, closedApps,
    filteredApps, pendingCount, updating, listingViews, unreadMessageCount, perAppUnreadCounts,
  } = dashboard;

  // Track previous tab to detect tab switches and show skeletons
  const [prevTab, setPrevTab] = React.useState(activeTab);
  const [tabReady, setTabReady] = React.useState<Record<string, boolean>>({ inbox: true });

  React.useEffect(() => {
    if (activeTab !== prevTab) {
      setPrevTab(activeTab);
      if (!tabReady[activeTab]) {
        // Show skeleton briefly while tab mounts
        setTabReady(prev => ({ ...prev, [activeTab]: false }));
        const timer = setTimeout(() => setTabReady(prev => ({ ...prev, [activeTab]: true })), 150);
        return () => clearTimeout(timer);
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: isMobile ? '1rem' : '2rem 1rem',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}>
          <div>
            <h2 style={{
              fontFamily: FONT_DISPLAY,
              fontSize: '1.2rem',
              color: colors.text,
              margin: 0,
            }}>
              Recruiter Dashboard
            </h2>
            {editorInfo && (
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                Kingdom {editorInfo.kingdom_number} • {editorInfo.role === 'editor' ? 'Primary Editor' : 'Co-Editor'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.textSecondary,
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Close
          </button>
        </div>

        {/* Onboarding Tour for First-Time Recruiters */}
        {showOnboarding && editorInfo && !loading && (
          <RecruiterOnboarding
            fund={fund}
            team={team}
            onDismiss={() => {
              setShowOnboarding(false);
              localStorage.setItem('atlas_recruiter_onboarded', 'true');
            }}
            onNavigateTab={setActiveTab}
          />
        )}

        {loading ? (
          <RecruiterSkeleton />
        ) : !editorInfo ? (
          <NoEditorState
            pendingInvite={pendingInvite}
            onAcceptInvite={handleAcceptInvite}
            onDeclineInvite={handleDeclineInvite}
          />
        ) : (
          <>
            {/* Stats Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              {[
                { label: t('recruiter.pending', 'Pending'), value: pendingCount, color: '#eab308' },
                { label: t('recruiter.invites', 'Invites'), value: `${getInviteBudget().total - getInviteBudget().used}/${getInviteBudget().total}`, color: '#22d3ee' },
                { label: t('recruiter.team', 'Team'), value: team.filter((t) => t.status === 'active').length, color: '#a855f7' },
                { label: t('recruiter.fund', 'Fund'), value: fund ? `$${Number(fund.balance).toFixed(0)}` : '$0', color: '#22c55e' },
              ].map((stat) => (
                <div key={stat.label} style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '0.6rem',
                  textAlign: 'center',
                }}>
                  <div style={{ color: stat.color, fontWeight: 'bold', fontSize: '1.1rem' }}>{stat.value}</div>
                  <div style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.15rem' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recruiting Toggle */}
            {fund && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: fund.is_recruiting ? '#22c55e08' : '#111111',
                border: `1px solid ${fund.is_recruiting ? '#22c55e25' : '#2a2a2a'}`,
                borderRadius: '10px',
                padding: '0.6rem 0.75rem',
                marginBottom: '1rem',
              }}>
                <div>
                  <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: '600' }}>
                    {fund.is_recruiting ? t('recruiter.activelyRecruiting', 'Actively Recruiting') : t('recruiter.notRecruiting', 'Not Recruiting')}
                  </span>
                  <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.1rem 0 0 0' }}>
                    {fund.is_recruiting ? t('recruiter.appearsInSearches', 'Your kingdom appears in transfer searches') : t('recruiter.toggleToAppear', 'Toggle on to appear in transfer searches')}
                  </p>
                </div>
                <button
                  onClick={handleToggleRecruiting}
                  style={{
                    width: '44px', height: '24px',
                    borderRadius: '12px',
                    backgroundColor: fund.is_recruiting ? '#22c55e' : '#333',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: fund.is_recruiting ? '23px' : '3px',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            <div style={{
              display: 'flex', gap: '0.25rem',
              backgroundColor: colors.surface,
              borderRadius: '10px',
              padding: '0.25rem',
              marginBottom: '1rem',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>
              {(['inbox', 'browse', 'profile', 'team', 'watchlist', 'fund', 'analytics'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    trackFeature('Recruiter Tab Switch', { tab });
                  }}
                  style={{
                    flex: isMobile ? 'none' : 1,
                    padding: isMobile ? '0.4rem 0.5rem' : '0.4rem 0.25rem',
                    backgroundColor: activeTab === tab ? '#22d3ee15' : 'transparent',
                    border: activeTab === tab ? '1px solid #22d3ee30' : '1px solid transparent',
                    borderRadius: '8px',
                    color: activeTab === tab ? '#22d3ee' : '#6b7280',
                    fontSize: isMobile ? '0.6rem' : '0.7rem',
                    fontWeight: activeTab === tab ? '600' : '400',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab === 'inbox' ? (<>{t('recruiter.inbox', 'Inbox')}{pendingCount > 0 ? ` (${pendingCount})` : ''}{unreadMessageCount > 0 && <span style={{ marginLeft: '0.25rem', backgroundColor: '#ef4444', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 'bold' }}>{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</span>}</>) :
                   tab === 'browse' ? t('recruiter.candidates', 'Candidates') :
                   tab === 'profile' ? t('recruiter.profile', 'Profile') :
                   tab === 'team' ? (<>{t('recruiter.team', 'Team')}{pendingCoEditorRequests.length > 0 && <span style={{ marginLeft: '0.3rem', backgroundColor: '#eab308', color: '#000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 'bold' }}>{pendingCoEditorRequests.length}</span>}</>) :
                   tab === 'watchlist' ? t('recruiter.watchlist', 'Watchlist') :
                   tab === 'fund' ? t('recruiter.fund', 'Fund') :
                   t('recruiter.analytics', 'Analytics')}
                </button>
              ))}
            </div>

            {/* TAB: Inbox */}
            {activeTab === 'inbox' && (
              <InboxTab
                listingViews={listingViews}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                activeApps={activeApps}
                approvedApps={approvedApps}
                closedApps={closedApps}
                filteredApps={filteredApps}
                handleStatusChange={handleStatusChange}
                updating={updating}
                fundTier={fund?.tier}
                perAppUnreadCounts={perAppUnreadCounts}
                kingdomNumber={editorInfo?.kingdom_number}
              />
            )}

            {/* TAB: Browse Transferees */}
            {activeTab === 'browse' && (
              tabReady['browse'] === false ? <BrowseTabSkeleton /> :
              <>
                <SentInvitesPanel editorInfo={editorInfo} />
                <BrowseTransfereesTab fund={fund} editorInfo={editorInfo} initialUsedInvites={getInviteBudget().used} />
              </>
            )}

            {/* TAB: Profile - Kingdom Listing Editor */}
            {activeTab === 'profile' && (
              tabReady['profile'] === false ? <ProfileTabSkeleton /> :
              <KingdomProfileTab fund={fund} editorInfo={editorInfo} onFundUpdate={setFund} />
            )}

            {/* TAB: Team (merged Team + Co-Editors) */}
            {activeTab === 'team' && (
              tabReady['team'] === false ? <TeamTabSkeleton /> :
              <>
                <TeamTab team={team} />
                <div style={{ marginTop: '1rem' }}>
                  <CoEditorsTab editorInfo={editorInfo} team={team} onReloadDashboard={loadDashboard} />
                </div>
              </>
            )}

            {/* TAB: Watchlist */}
            {activeTab === 'watchlist' && (
              tabReady['watchlist'] === false ? <WatchlistTabSkeleton /> :
              <WatchlistTab editorInfo={editorInfo} />
            )}

            {/* TAB: Fund */}
            {activeTab === 'fund' && (
              tabReady['fund'] === false ? <FundTabSkeleton /> :
              <FundTab fund={fund} editorInfo={editorInfo} />
            )}

            {/* TAB: Analytics */}
            {activeTab === 'analytics' && (
              <RecruiterAnalyticsTab editorInfo={editorInfo} applications={dashboard.applications} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecruiterDashboard;
