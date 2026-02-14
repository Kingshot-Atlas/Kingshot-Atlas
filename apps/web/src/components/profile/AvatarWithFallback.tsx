import React, { useState } from 'react';
import { getCacheBustedAvatarUrl } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';

// Globe icon SVG for unlinked users (matches Atlas logo)
const GlobeIcon: React.FC<{ size: number; pulse?: boolean }> = ({ size, pulse = false }) => (
  <div style={{ 
    animation: pulse ? 'globePulse 2s ease-in-out infinite' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    <style>{`
      @keyframes globePulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    `}</style>
    <svg 
      width={size * 0.5} 
      height={size * 0.5} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  </div>
);

const AvatarWithFallback: React.FC<{
  avatarUrl?: string;
  username?: string;
  size: number;
  themeColor: string;
  badgeStyle?: string;
  showGlobeDefault?: boolean;
  onClick?: () => void;
}> = ({ avatarUrl, username, size, themeColor, badgeStyle = 'default', showGlobeDefault = false, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getBadgeStyle = (style: string, color: string) => {
    switch (style) {
      case 'gradient':
        return { background: `linear-gradient(135deg, ${color} 0%, ${color}80 100%)` };
      case 'outline':
        return { backgroundColor: 'transparent', border: `2px solid ${color}` };
      case 'glow':
        return { backgroundColor: color, boxShadow: `0 0 20px ${color}60` };
      default:
        return { backgroundColor: color };
    }
  };

  // Show globe icon for unlinked users, or letter fallback if linked but image failed
  if (!avatarUrl || imgError || avatarUrl === '') {
    return (
      <div style={{ position: 'relative' }}>
        <div 
          onClick={onClick}
          onMouseEnter={() => onClick && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.4}px`,
            color: showGlobeDefault ? '#22d3ee' : '#000',
            fontWeight: 'bold',
            cursor: onClick ? 'pointer' : 'default',
            backgroundColor: showGlobeDefault ? '#0a0a0a' : undefined,
            border: showGlobeDefault ? '2px solid #22d3ee' : undefined,
            transform: isHovered && onClick ? 'scale(1.05)' : 'scale(1)',
            boxShadow: isHovered && onClick ? '0 0 20px rgba(34, 211, 238, 0.5)' : 'none',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            ...(!showGlobeDefault ? getBadgeStyle(badgeStyle, themeColor) : {})
          }}>
          {showGlobeDefault ? <GlobeIcon size={size} pulse={true} /> : (username?.[0]?.toUpperCase() ?? '?')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
      {!imgLoaded && (
        <div style={{
          position: 'absolute',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#1a1a1a',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <img 
        src={getCacheBustedAvatarUrl(avatarUrl)} 
        alt="Avatar"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2px solid ${themeColor}`,
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out'
        }}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          logger.error('Avatar failed to load:', avatarUrl);
          setImgError(true);
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default AvatarWithFallback;
