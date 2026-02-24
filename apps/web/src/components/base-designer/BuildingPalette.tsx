import React from 'react';
import { useTranslation } from 'react-i18next';
import { BUILDING_TYPES, BUILDING_CATEGORIES } from '../../config/allianceBuildings';

interface BuildingPaletteProps {
  selectedToolType: string | null;
  buildingCounts: Record<string, number>;
  onSelectTool: (toolId: string | null) => void;
  hasTerritory: boolean;
  compact?: boolean;
}

const BuildingPalette: React.FC<BuildingPaletteProps> = ({
  selectedToolType, buildingCounts, onSelectTool, hasTerritory, compact = false,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      {!hasTerritory && (
        <div style={{
          marginBottom: '0.5rem', padding: compact ? '0.4rem' : '0.5rem',
          backgroundColor: '#22c55e08', border: '1px solid #22c55e25',
          borderRadius: '6px',
        }}>
          <div style={{ color: '#22c55e', fontSize: compact ? '0.6rem' : '0.65rem', fontWeight: '600' }}>
            🏳 {t('baseDesigner.startWithBanners', 'Place Banners or HQ First')}
          </div>
          <div style={{ color: '#6b7280', fontSize: compact ? '0.55rem' : '0.6rem', lineHeight: compact ? 1.4 : 1.5, marginTop: '0.15rem' }}>
            {compact
              ? t('baseDesigner.territoryPromptShort', 'Define territory with Banners/HQ. Other buildings must be placed within territory zones.')
              : t('baseDesigner.territoryPrompt', 'Define your alliance territory by placing Banners or HQ. Cities, Traps, and Special buildings can only be placed within territory zones (shown in green).')
            }
          </div>
        </div>
      )}
      {BUILDING_CATEGORIES.map((cat) => (
        <div key={cat.key} style={{ marginBottom: compact ? '0.4rem' : '0.5rem' }}>
          <div style={{ fontSize: compact ? '0.55rem' : '0.6rem', fontWeight: '600', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: compact ? '0.2rem' : '0.3rem' }}>
            {cat.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {BUILDING_TYPES.filter((b) => b.category === cat.key).map((building) => {
              const isSelected = selectedToolType === building.id;
              const count = buildingCounts[building.id] || 0;
              return (
                <button
                  key={building.id}
                  onClick={() => onSelectTool(isSelected ? null : building.id)}
                  title={`${building.name} (${building.size}×${building.size})\n${building.description}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                    padding: compact ? '0.3rem 0.4rem' : '0.25rem 0.4rem',
                    backgroundColor: isSelected ? building.color + '25' : '#0a0a0a',
                    border: `1px solid ${isSelected ? building.color : '#1e2a35'}`,
                    borderRadius: '4px', color: isSelected ? building.color : '#9ca3af',
                    cursor: 'pointer', fontSize: '0.65rem', fontWeight: isSelected ? '600' : '400',
                    transition: 'all 0.1s', whiteSpace: 'nowrap',
                  }}
                >
                  <span>{building.icon}</span>
                  <span>{building.shortName}</span>
                  {!compact && <span style={{ fontSize: '0.5rem', color: '#4b5563' }}>{building.size}²</span>}
                  {count > 0 && <span style={{ fontSize: '0.5rem', color: building.color, fontWeight: '700' }}>×{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BuildingPalette;
