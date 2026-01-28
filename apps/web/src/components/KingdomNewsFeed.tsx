import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface NewsItem {
  id: string;
  kingdomNumber: number;
  type: 'status_change' | 'tier_change' | 'achievement' | 'review';
  message: string;
  timestamp: number;
}

const NEWS_KEY = 'kingshot_news_feed';

const KingdomNewsFeed: React.FC = () => {
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(NEWS_KEY);
    if (stored) {
      setNews(JSON.parse(stored));
    }
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'status_change': return '🔄';
      case 'tier_change': return '📈';
      case 'achievement': return '🏆';
      case 'review': return '💬';
      default: return '📢';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'status_change': return '#22d3ee';
      case 'tier_change': return '#fbbf24';
      case 'achievement': return '#22c55e';
      case 'review': return '#a855f7';
      default: return '#6b7280';
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  const displayNews = expanded ? news : news.slice(0, 5);

  if (news.length === 0) {
    return (
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid #2a2a2a'
      }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📰</span> Kingdom News
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          No recent activity. Check back later for kingdom updates!
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a'
    }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>📰</span> Kingdom News
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {displayNews.map(item => (
          <div
            key={item.id}
            onClick={() => navigate(`/kingdom/${item.kingdomNumber}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#151515'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0a0a0a'}
          >
            <span style={{ fontSize: '1rem' }}>{getIcon(item.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: getColor(item.type), fontWeight: '600' }}>Kingdom {item.kingdomNumber}</span>
                {' '}{item.message}
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#4a4a4a', whiteSpace: 'nowrap' }}>
              {formatTime(item.timestamp)}
            </span>
          </div>
        ))}
      </div>

      {news.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginTop: '0.75rem',
            backgroundColor: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#6b7280',
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          {expanded ? 'Show less' : `Show ${news.length - 5} more`}
        </button>
      )}
    </div>
  );
};

export const addNewsItem = (kingdomNumber: number, type: NewsItem['type'], message: string) => {
  const stored = localStorage.getItem(NEWS_KEY);
  const news = stored ? JSON.parse(stored) : [];
  const item: NewsItem = {
    id: Date.now().toString(),
    kingdomNumber,
    type,
    message,
    timestamp: Date.now()
  };
  news.unshift(item);
  localStorage.setItem(NEWS_KEY, JSON.stringify(news.slice(0, 50)));
};

export default KingdomNewsFeed;
