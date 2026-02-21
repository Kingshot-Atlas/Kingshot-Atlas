import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors } from '../utils/styles';
import {
  usePrepScheduler,
  PrepSchedulerGate,
  PrepSchedulerList,
  PrepSchedulerForm,
  PrepSchedulerManager,
  ConfirmDialog,
} from '../components/prep-scheduler';

const PrepScheduler: React.FC = () => {
  const { t } = useTranslation();
  const hook = usePrepScheduler();

  // Loading state
  if (hook.loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.textMuted }}>{t('prepScheduler.loading', 'Loading...')}</p>
      </div>
    );
  }

  // Gate: login or account linking required
  if (hook.view === 'gate') {
    return <PrepSchedulerGate needsLogin={!hook.user} scheduleId={hook.scheduleId} />;
  }

  // Landing: schedule list + create
  if (hook.view === 'landing') {
    return (
      <PrepSchedulerList
        isMobile={hook.isMobile}
        user={hook.user}
        profile={hook.profile}
        goldKingdoms={hook.goldKingdoms}
        hasPromoAccess={hook.hasPromoAccess}
        isPromoActive={hook.isPromoActive}
        promoMsRemaining={hook.promoMsRemaining}
        mySchedules={hook.mySchedules}
        kingdomSchedules={hook.kingdomSchedules}
        navigate={hook.navigate}
        isEditorOrCoEditor={hook.isEditorOrCoEditor}
        isManager={hook.isManager}
        createKingdom={hook.createKingdom}
        setCreateKingdom={hook.setCreateKingdom}
        createKvkNumber={hook.createKvkNumber}
        setCreateKvkNumber={hook.setCreateKvkNumber}
        createNotes={hook.createNotes}
        setCreateNotes={hook.setCreateNotes}
        createDeadline={hook.createDeadline}
        setCreateDeadline={hook.setCreateDeadline}
        createSchedule={hook.createSchedule}
        saving={hook.saving}
      />
    );
  }

  // Player form view
  if (hook.view === 'form' && hook.schedule) {
    return (
      <>
        <PrepSchedulerForm
          isMobile={hook.isMobile}
          schedule={hook.schedule}
          existingSubmission={hook.existingSubmission}
          mySubmissions={hook.mySubmissions}
          assignments={hook.assignments}
          formUsername={hook.formUsername} setFormUsername={hook.setFormUsername}
          formAlliance={hook.formAlliance} setFormAlliance={hook.setFormAlliance}
          mondayAvail={hook.mondayAvail} setMondayAvail={hook.setMondayAvail}
          tuesdayAvail={hook.tuesdayAvail} setTuesdayAvail={hook.setTuesdayAvail}
          thursdayAvail={hook.thursdayAvail} setThursdayAvail={hook.setThursdayAvail}
          generalSpeedups={hook.generalSpeedups} setGeneralSpeedups={hook.setGeneralSpeedups}
          trainingSpeedups={hook.trainingSpeedups} setTrainingSpeedups={hook.setTrainingSpeedups}
          constructionSpeedups={hook.constructionSpeedups} setConstructionSpeedups={hook.setConstructionSpeedups}
          researchSpeedups={hook.researchSpeedups} setResearchSpeedups={hook.setResearchSpeedups}
          generalTarget={hook.generalTarget} setGeneralTarget={hook.setGeneralTarget}
          generalAllocation={hook.generalAllocation} setGeneralAllocation={hook.setGeneralAllocation}
          skipMonday={hook.skipMonday} setSkipMonday={hook.setSkipMonday}
          skipTuesday={hook.skipTuesday} setSkipTuesday={hook.setSkipTuesday}
          skipThursday={hook.skipThursday} setSkipThursday={hook.setSkipThursday}
          screenshotPreview={hook.screenshotPreview}
          fileInputRef={hook.fileInputRef}
          handleScreenshotChange={hook.handleScreenshotChange}
          saving={hook.saving}
          submitForm={hook.submitForm}
          showChangeRequestForm={hook.showChangeRequestForm} setShowChangeRequestForm={hook.setShowChangeRequestForm}
          changeRequestDay={hook.changeRequestDay} setChangeRequestDay={hook.setChangeRequestDay}
          changeRequestType={hook.changeRequestType} setChangeRequestType={hook.setChangeRequestType}
          changeRequestMessage={hook.changeRequestMessage} setChangeRequestMessage={hook.setChangeRequestMessage}
          submitChangeRequest={hook.submitChangeRequest}
          showNonQualifyingPopup={hook.showNonQualifyingPopup} setShowNonQualifyingPopup={hook.setShowNonQualifyingPopup}
          startAltSubmission={hook.startAltSubmission}
          editSubmission={hook.editSubmission}
          isRefilling={hook.isRefilling}
          setIsRefilling={hook.setIsRefilling}
          updateSubmissionOptOuts={hook.updateSubmissionOptOuts}
        />
        {hook.pendingConfirm && <ConfirmDialog confirm={hook.pendingConfirm} onDismiss={() => hook.setPendingConfirm(null)} />}
      </>
    );
  }

  // Manager view
  if (hook.view === 'manage' && hook.schedule) {
    return (
      <>
        <PrepSchedulerManager
          isMobile={hook.isMobile}
          schedule={hook.schedule}
          submissions={hook.submissions}
          assignments={hook.assignments}
          isManager={hook.isManager}
          isEditorOrCoEditor={hook.isEditorOrCoEditor}
          activeDay={hook.activeDay}
          setActiveDay={hook.setActiveDay}
          saving={hook.saving}
          managerUsername={hook.managerUsername}
          changeRequests={hook.changeRequests}
          dayAssignments={hook.dayAssignments}
          daySubmissions={hook.daySubmissions}
          unassignedPlayers={hook.unassignedPlayers}
          availabilityGaps={hook.availabilityGaps}
          managers={hook.managers}
          assignManagerInput={hook.assignManagerInput}
          setAssignManagerInput={hook.setAssignManagerInput}
          managerSearchResults={hook.managerSearchResults}
          showManagerDropdown={hook.showManagerDropdown}
          setShowManagerDropdown={hook.setShowManagerDropdown}
          managerSearchRef={hook.managerSearchRef}
          copyShareLink={hook.copyShareLink}
          exportScheduleCSV={hook.exportScheduleCSV}
          exportOptedOut={hook.exportOptedOut}
          setView={hook.setView}
          closeOrReopenForm={hook.closeOrReopenForm}
          toggleLock={hook.toggleLock}
          archiveSchedule={hook.archiveSchedule}
          deleteSchedule={hook.deleteSchedule}
          runAutoAssign={hook.runAutoAssign}
          assignSlot={hook.assignSlot}
          removeAssignment={hook.removeAssignment}
          clearDayAssignments={hook.clearDayAssignments}
          acknowledgeChangeRequest={hook.acknowledgeChangeRequest}
          addManager={hook.addManager}
          removeManagerById={hook.removeManagerById}
          updateDeadline={hook.updateDeadline}
          toggleStagger={hook.toggleStagger}
          removingIds={hook.removingIds}
          effectiveSlots={hook.effectiveSlots}
          maxSlots={hook.maxSlots}
          updateSubmissionOptOuts={hook.updateSubmissionOptOuts}
          updateAnySubmission={hook.updateAnySubmission}
        />
        {hook.pendingConfirm && <ConfirmDialog confirm={hook.pendingConfirm} onDismiss={() => hook.setPendingConfirm(null)} />}
      </>
    );
  }

  // Fallback
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: colors.textMuted }}>{t('prepScheduler.scheduleNotFound', 'Schedule not found.')}</p>
      <Link to="/tools/prep-scheduler" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← {t('prepScheduler.back', 'Back')}</Link>
    </div>
  );
};

export default PrepScheduler;
