import React from 'react';
import type { AnalyticsData } from './types';

interface PlausibleTabProps {
  analytics: AnalyticsData | null;
}

const PlausibleTab: React.FC<PlausibleTabProps> = ({ analytics }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: '#fff', margin: 0 }}>📈 Plausible Analytics - Live Dashboard</h3>
        <a 
          href="https://plausible.io/ks-atlas.com" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#22d3ee20',
            border: '1px solid #22d3ee50',
            borderRadius: '6px',
            color: '#22d3ee',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: '500'
          }}
        >
          Open Full Dashboard ↗
        </a>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Real-time, privacy-friendly analytics powered by Plausible. No cookies, GDPR compliant.
      </p>
      <div style={{ 
        backgroundColor: '#0a0a0a', 
        borderRadius: '8px', 
        overflow: 'hidden',
        border: '1px solid #1a1a1f'
      }}>
        <iframe
          data-plausible-embed="true"
          src="https://plausible.io/share/ks-atlas.com?auth=C7E_v7N68QzEmvXVyTiHj&embed=true&theme=dark"
          loading="lazy"
          style={{ 
            width: '100%', 
            height: '600px', 
            border: 'none',
            backgroundColor: '#0a0a0a'
          }}
          title="Plausible Analytics"
        />
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '1rem', fontStyle: 'italic' }}>
        Tip: Click &quot;Full Dashboard&quot; to see detailed breakdowns, goals, and custom reports.
      </p>
    </div>

    {/* Quick Stats from Plausible */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {[
        { label: 'Bounce Rate', value: `${analytics?.bounceRate || 42}%`, color: '#f97316', icon: '↩️', desc: 'Single page visits' },
        { label: 'Avg. Visit Duration', value: `${Math.floor((analytics?.visitDuration || 187) / 60)}m ${(analytics?.visitDuration || 187) % 60}s`, color: '#22c55e', icon: '⏱️', desc: 'Time on site' },
      ].map((metric, i) => (
        <div key={i} style={{
          backgroundColor: '#111116',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span>{metric.icon}</span>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{metric.label}</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: metric.color }}>
            {metric.value}
          </div>
          <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {metric.desc}
          </div>
        </div>
      ))}
    </div>

    {/* Top Traffic Sources */}
    <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
      <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🔗 Top Traffic Sources</h3>
      {(analytics?.topSources || []).map((source, i) => (
        <div key={i} style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0.5rem 0',
          borderBottom: i < (analytics?.topSources?.length || 0) - 1 ? '1px solid #1a1a1f' : 'none'
        }}>
          <span style={{ color: '#fff' }}>{source.source}</span>
          <span style={{ color: '#22d3ee', fontWeight: '600' }}>{source.visitors.toLocaleString()}</span>
        </div>
      ))}
    </div>

    {/* Top Countries */}
    <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
      <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🌍 Top Countries</h3>
      {(analytics?.topCountries || []).map((country, i) => (
        <div key={i} style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0.5rem 0',
          borderBottom: i < (analytics?.topCountries?.length || 0) - 1 ? '1px solid #1a1a1f' : 'none'
        }}>
          <span style={{ color: '#fff' }}>{country.country}</span>
          <span style={{ color: '#a855f7', fontWeight: '600' }}>{country.visitors.toLocaleString()}</span>
        </div>
      ))}
    </div>

  </div>
);

export default PlausibleTab;
