import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFavoritesContext } from '../contexts/FavoritesContext';

const FavoritesBadge: React.FC = () => {
  const { favoritesCount } = useFavoritesContext();
  const location = useLocation();
  const navigate = useNavigate();

  if (favoritesCount === 0) return null;

  const isFilterActive = location.pathname === '/' && new URLSearchParams(location.search).get('favorites') === 'true';

  const handleClick = () => {
    if (isFilterActive) {
      navigate('/');
    } else {
      navigate('/?favorites=true');
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={isFilterActive ? 'Show all kingdoms' : `Show ${favoritesCount} favorited kingdom${favoritesCount !== 1 ? 's' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        color: isFilterActive ? '#fff' : '#ef4444',
        backgroundColor: isFilterActive ? '#ef4444' : 'transparent',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!isFilterActive) e.currentTarget.style.backgroundColor = '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        if (!isFilterActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </button>
  );
};

export default FavoritesBadge;
