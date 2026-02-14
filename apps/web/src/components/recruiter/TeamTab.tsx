import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import type { TeamMember } from './types';

interface TeamTabProps {
  team: TeamMember[];
}

const TeamTab: React.FC<TeamTabProps> = ({ team }) => {
  const { t } = useTranslation();

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {team.map((member) => (
          <div key={member.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem',
            backgroundColor: colors.bg,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link
                to={`/profile/${member.user_id}`}
                style={{ color: colors.text, textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}
              >
                {member.linked_username || member.username || 'User'}
              </Link>
              <span style={{
                padding: '0.1rem 0.4rem',
                backgroundColor: member.role === 'editor' ? '#22d3ee15' : '#a855f715',
                border: `1px solid ${member.role === 'editor' ? '#22d3ee30' : '#a855f730'}`,
                borderRadius: '4px',
                fontSize: '0.6rem',
                color: member.role === 'editor' ? '#22d3ee' : '#a855f7',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                {member.role === 'editor' ? t('recruiter.editor', 'Editor') : t('recruiter.coEditor', 'Co-Editor')}
              </span>
            </div>
            <span style={{
              color: member.status === 'active' ? '#22c55e' : '#6b7280',
              fontSize: '0.7rem',
              textTransform: 'capitalize',
            }}>
              {member.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamTab;
