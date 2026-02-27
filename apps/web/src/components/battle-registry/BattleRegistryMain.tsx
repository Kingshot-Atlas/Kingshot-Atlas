// ─── KvK Battle Registry — Main Component ──────────────────────────────
import React from 'react';
import { useBattleRegistry } from './useBattleRegistry';
import BattleRegistryList from './BattleRegistryList';
import BattleRegistryForm from './BattleRegistryForm';
import BattleRegistryDashboard from './BattleRegistryDashboard';
import { colors } from '../../utils/styles';

const BattleRegistryMain: React.FC = () => {
  const hook = useBattleRegistry();

  if (hook.loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: colors.textMuted }}>
        Loading...
      </div>
    );
  }

  // Gate view: not authenticated or no linked player
  if (hook.view === 'gate') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {hook.t('battleRegistry.loginRequired', 'Login Required')}
        </h2>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem', maxWidth: '400px', lineHeight: 1.6 }}>
          {!hook.user
            ? hook.t('battleRegistry.loginRequiredDesc', 'You need to be logged in to access the Battle Registry. Sign in with Discord to continue.')
            : hook.t('battleRegistry.linkPlayerRequired', 'You need to link your Kingshot player profile before registering. Go to your Profile to link your account.')}
        </p>
      </div>
    );
  }

  // Landing view (no registryId)
  if (hook.view === 'landing') {
    return (
      <BattleRegistryList
        isMobile={hook.isMobile}
        user={hook.user}
        profile={hook.profile}
        goldKingdoms={hook.goldKingdoms}
        hasPromoAccess={hook.hasPromoAccess}
        isPromoActive={hook.isPromoActive}
        promoMsRemaining={hook.promoMsRemaining}
        myRegistries={hook.myRegistries}
        kingdomRegistries={hook.kingdomRegistries}
        submittedRegistries={hook.submittedRegistries}
        navigate={hook.navigate}
        isEditorOrCoEditor={hook.isEditorOrCoEditor}
        isManager={hook.isManager}
        createKingdom={hook.createKingdom}
        setCreateKingdom={hook.setCreateKingdom}
        createKvkNumber={hook.createKvkNumber}
        setCreateKvkNumber={hook.setCreateKvkNumber}
        createNotes={hook.createNotes}
        setCreateNotes={hook.setCreateNotes}
        createRegistry={hook.createRegistry}
        saving={hook.saving}
      />
    );
  }

  // Manager dashboard view
  if (hook.view === 'manage' && hook.registry) {
    return (
      <BattleRegistryDashboard
        isMobile={hook.isMobile}
        registry={hook.registry}
        entries={hook.entries}
        managers={hook.managers}
        isEditorOrCoEditor={hook.isEditorOrCoEditor}
        isManager={hook.isManager}
        assignManagerInput={hook.assignManagerInput}
        setAssignManagerInput={hook.setAssignManagerInput}
        managerSearchResults={hook.managerSearchResults}
        showManagerDropdown={hook.showManagerDropdown}
        setShowManagerDropdown={hook.setShowManagerDropdown}
        managerSearchRef={hook.managerSearchRef}
        addManager={hook.addManager}
        removeManager={hook.removeManager}
        closeRegistry={hook.closeRegistry}
        reopenRegistry={hook.reopenRegistry}
        navigate={hook.navigate}
        setView={hook.setView}
        submitManualEntry={hook.submitManualEntry}
        updateManualEntry={hook.updateManualEntry}
        deleteEntry={hook.deleteEntry}
        saving={hook.saving}
      />
    );
  }

  // Form view (player registration)
  if (hook.view === 'form' && hook.registry) {
    return (
      <BattleRegistryForm
        isMobile={hook.isMobile}
        registry={hook.registry}
        existingEntry={hook.existingEntry}
        saving={hook.saving}
        formUsername={hook.formUsername}
        formAlliance={hook.formAlliance}
        setFormAlliance={hook.setFormAlliance}
        formTimeSlots={hook.formTimeSlots}
        setFormTimeSlots={hook.setFormTimeSlots}
        formInfantryTier={hook.formInfantryTier}
        setFormInfantryTier={hook.setFormInfantryTier}
        formInfantryTg={hook.formInfantryTg}
        setFormInfantryTg={hook.setFormInfantryTg}
        formCavalryTier={hook.formCavalryTier}
        setFormCavalryTier={hook.setFormCavalryTier}
        formCavalryTg={hook.formCavalryTg}
        setFormCavalryTg={hook.setFormCavalryTg}
        formArchersTier={hook.formArchersTier}
        setFormArchersTier={hook.setFormArchersTier}
        formArchersTg={hook.formArchersTg}
        setFormArchersTg={hook.setFormArchersTg}
        submitEntry={hook.submitEntry}
        navigate={hook.navigate}
        isManager={hook.isManager}
        setView={hook.setView}
      />
    );
  }

  return null;
};

export default BattleRegistryMain;
