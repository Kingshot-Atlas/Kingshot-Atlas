import React from 'react';
import { useTranslation } from 'react-i18next';
import NotificationPreferences from '../NotificationPreferences';
import { UserProfile } from '../../contexts/AuthContext';

const LANGUAGES = [
  'English', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Turkish',
  'Vietnamese', 'Thai', 'Indonesian', 'Polish', 'Dutch', 'Other'
];

const REGIONS = ['Americas', 'Europe', 'Asia', 'Oceania'];

export interface EditForm {
  alliance_tag: string;
  language: string;
  region: string;
  bio: string;
  show_coordinates: boolean;
  coordinates: string;
}

interface ProfileEditFormProps {
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  profileCoordKingdom: string;
  setProfileCoordKingdom: (val: string) => void;
  profileCoordX: string;
  setProfileCoordX: (val: string) => void;
  profileCoordY: string;
  setProfileCoordY: (val: string) => void;
  viewedProfile: UserProfile | null;
  themeColor: string;
  isMobile: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  editForm, setEditForm,
  profileCoordKingdom, setProfileCoordKingdom,
  profileCoordX, setProfileCoordX,
  profileCoordY, setProfileCoordY,
  viewedProfile, themeColor, isMobile,
  onSave, onCancel
}) => {
  const { t } = useTranslation();

  const selectStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem'
  };

  const handleAllianceTagChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3);
    setEditForm(prev => ({ ...prev, alliance_tag: cleaned }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Alliance Tag, Language, Region — 3-column row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
        <div>
          <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>{t('profile.allianceTagLabel', 'Alliance Tag (3 chars)')}</label>
          <input
            type="text"
            value={editForm.alliance_tag}
            onChange={(e) => handleAllianceTagChange(e.target.value)}
            placeholder="e.g. TWs"
            maxLength={3}
            style={{ ...inputStyle, letterSpacing: '0.1em' }}
          />
        </div>
        <div>
          <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>{t('profile.mainLanguageLabel', 'Main Language')}</label>
          <select
            value={editForm.language}
            onChange={(e) => setEditForm(prev => ({ ...prev, language: e.target.value }))}
            style={selectStyle}
          >
            <option value="">{t('profile.selectLanguage', 'Select language')}</option>
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>{t('profile.regionLabel', 'Region')}</label>
          <select
            value={editForm.region}
            onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
            style={selectStyle}
          >
            <option value="">{t('profile.selectRegion', 'Select region')}</option>
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bio */}
      <div>
        <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>{t('profile.bioLabel', 'Bio')}</label>
        <textarea
          value={editForm.bio}
          onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
          placeholder={t('profile.bioPlaceholder', 'Tell us about yourself...')}
          rows={3}
          style={{
            ...inputStyle,
            resize: 'vertical'
          }}
        />
      </div>

      {/* In-Game Coordinates Toggle */}
      <div>
        <div
          onClick={() => setEditForm(prev => ({ ...prev, show_coordinates: !prev.show_coordinates }))}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            backgroundColor: editForm.show_coordinates ? `${themeColor}10` : '#0a0a0a',
            border: `1px solid ${editForm.show_coordinates ? `${themeColor}40` : '#2a2a2a'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: '48px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '500' }}>{t('profile.showCoordinates', 'Show In-Game Coordinates')}</div>
              <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>{t('profile.showCoordinatesDesc', 'Let other Atlas users find you in-game')}</div>
            </div>
          </div>
          <div style={{
            width: '36px',
            height: '20px',
            borderRadius: '10px',
            backgroundColor: editForm.show_coordinates ? themeColor : '#3a3a3a',
            position: 'relative',
            transition: 'background-color 0.2s',
            flexShrink: 0,
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              position: 'absolute',
              top: '2px',
              left: editForm.show_coordinates ? '18px' : '2px',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {editForm.show_coordinates && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Kingdom:</span>
              <input
                type="number"
                min="1"
                max="9999"
                value={profileCoordKingdom}
                onChange={(e) => setProfileCoordKingdom(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="—"
                style={{
                  ...inputStyle,
                  width: '5rem',
                  textAlign: 'center',
                  padding: '0.6rem 0.4rem',
                  backgroundColor: profileCoordKingdom && viewedProfile?.linked_kingdom ? `${themeColor}08` : '#0a0a0a',
                }}
                readOnly={!!viewedProfile?.linked_kingdom}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>X:</span>
              <input
                type="number"
                min="0"
                max="1199"
                value={profileCoordX}
                onChange={(e) => setProfileCoordX(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0-1199"
                style={{
                  ...inputStyle,
                  width: '5.5rem',
                  textAlign: 'center',
                  padding: '0.6rem 0.4rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Y:</span>
              <input
                type="number"
                min="0"
                max="1199"
                value={profileCoordY}
                onChange={(e) => setProfileCoordY(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0-1199"
                style={{
                  ...inputStyle,
                  width: '5.5rem',
                  textAlign: 'center',
                  padding: '0.6rem 0.4rem',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences - inside edit mode */}
      <NotificationPreferences />

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button
          onClick={onSave}
          style={{
            padding: '0.75rem 1.5rem',
            background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer',
            minHeight: '48px',
          }}
        >
          {t('profile.saveProfile', 'Save Profile')}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'transparent',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#9ca3af',
            cursor: 'pointer',
            minHeight: '48px',
          }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
    </div>
  );
};

export default ProfileEditForm;
