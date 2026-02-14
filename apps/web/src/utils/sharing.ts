/**
 * Sharing utilities for Kingshot Atlas
 * Handles PNG export, link generation, and clipboard operations
 */

import { colors } from './styles';
import { logger } from './logger';

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/**
 * Copy text to clipboard with fallback for older browsers
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    logger.error('Failed to copy:', err);
    return false;
  }
};

/**
 * Check if device is mobile
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Copy image to clipboard (for PNG export)
 * On mobile, uses Web Share API with file if available
 * Returns: { success: boolean, method: 'clipboard' | 'share' | 'none' }
 */
export const copyImageToClipboard = async (blob: Blob, filename?: string): Promise<boolean> => {
  // Try clipboard API first (works on desktop browsers)
  try {
    if (navigator.clipboard && 'write' in navigator.clipboard && !isMobileDevice()) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    }
  } catch (err) {
    logger.warn('Clipboard API not available, trying alternatives:', err);
  }

  // On mobile, try Web Share API with file support
  if (isMobileDevice() && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename || 'image.png', { type: 'image/png' });
      const shareData = { files: [file] };
      
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch (err) {
      // User cancelled or share failed - this is expected sometimes
      if ((err as Error).name !== 'AbortError') {
        logger.warn('Web Share with file not available:', err);
      }
    }
  }

  return false;
};

/**
 * Share image on mobile using Web Share API
 * Returns true if share was initiated, false if not supported
 */
export const shareImageOnMobile = async (blob: Blob, filename: string, title?: string): Promise<boolean> => {
  if (!navigator.share || !navigator.canShare) {
    return false;
  }

  try {
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = {
      files: [file],
      title: title || 'Kingshot Atlas',
    };

    if (navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      logger.error('Share failed:', err);
    }
  }
  return false;
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Convert SVG element to PNG blob
 */
export const svgToPng = async (
  svgElement: SVGElement,
  width: number,
  height: number,
  backgroundColor = '#0a0a0a'
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Scale for high DPI displays
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Clone SVG and serialize
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));
    
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Draw background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      
      // Draw SVG
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('Failed to load SVG'));
    };
    img.src = svgUrl;
  });
};

/**
 * Generate a shareable kingdom profile card as PNG
 */
export const generateKingdomCard = async (
  kingdomNumber: number,
  atlasScore: number,
  tier: string,
  rank: number,
  prepWinRate: number,
  battleWinRate: number,
  totalKvks: number
): Promise<Blob> => {
  const width = 600;
  const height = 315; // Discord embed ratio
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Scale for high DPI
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(1, '#131318');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#22d3ee40';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Logo/Brand
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('KINGSHOT ATLAS', 24, 32);

  // Kingdom number (large)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.fillText(`#${kingdomNumber}`, 24, 120);

  // Tier badge
  const tierColors: Record<string, string> = {
    'S': '#fbbf24',
    'A': '#a855f7',
    'B': '#22d3ee',
    'C': '#22c55e',
    'D': '#6b7280',
    'F': '#ef4444'
  };
  const tierKey: string = tier && tier.length > 0 ? tier.charAt(0) : 'D';
  const tierColor = tierColors[tierKey] || '#6b7280';
  
  ctx.fillStyle = tierColor + '30';
  ctx.beginPath();
  ctx.roundRect(24, 140, 60, 32, 6);
  ctx.fill();
  ctx.fillStyle = tierColor;
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(tier, 40, 163);

  // Atlas Score
  ctx.fillStyle = '#9ca3af';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('Atlas Score', 24, 200);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(atlasScore.toFixed(2), 24, 240);
  
  // Rank
  ctx.fillStyle = '#6b7280';
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Rank #${rank}`, 130, 240);

  // Stats section (right side)
  const statsX = 350;
  
  // Prep Win Rate
  ctx.fillStyle = '#eab308';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${prepWinRate}%`, statsX, 80);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Prep Win Rate', statsX, 98);

  // Battle Win Rate
  ctx.fillStyle = '#a855f7';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${battleWinRate}%`, statsX + 120, 80);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Battle Win Rate', statsX + 120, 98);

  // Total KvKs
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${totalKvks}`, statsX, 150);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('KvKs Played', statsX, 168);

  // URL footer
  ctx.fillStyle = '#4a4a4a';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('ks-atlas.com', 24, height - 20);

  // Tagline
  ctx.fillStyle = '#6b7280';
  ctx.font = 'italic 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Data-driven dominance', width - 24, height - 20);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob'));
    }, 'image/png');
  });
};

/**
 * Generate comparison card as PNG
 */
export const generateComparisonCard = async (
  kingdom1: { number: number; score: number; tier: string },
  kingdom2: { number: number; score: number; tier: string },
  winner: 'kingdom1' | 'kingdom2' | 'tie'
): Promise<Blob> => {
  const width = 600;
  const height = 315;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(1, '#131318');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#22d3ee40';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Brand
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KINGSHOT ATLAS', width / 2, 28);

  // VS text
  ctx.fillStyle = '#4a4a4a';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('VS', width / 2, height / 2 + 10);

  // Kingdom 1 (left)
  const k1Color = winner === 'kingdom1' ? '#22c55e' : '#9ca3af';
  ctx.fillStyle = k1Color;
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`#${kingdom1.number}`, 150, 130);
  
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(kingdom1.score.toFixed(2), 150, 180);
  
  ctx.fillStyle = '#6b7280';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(kingdom1.tier, 150, 205);

  if (winner === 'kingdom1') {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('✓ WINNER', 150, 240);
  }

  // Kingdom 2 (right)
  const k2Color = winner === 'kingdom2' ? '#22c55e' : '#9ca3af';
  ctx.fillStyle = k2Color;
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(`#${kingdom2.number}`, 450, 130);
  
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(kingdom2.score.toFixed(2), 450, 180);
  
  ctx.fillStyle = '#6b7280';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(kingdom2.tier, 450, 205);

  if (winner === 'kingdom2') {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('✓ WINNER', 450, 240);
  }

  // URL footer
  ctx.fillStyle = '#4a4a4a';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ks-atlas.com/compare', 24, height - 20);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob'));
    }, 'image/png');
  });
};

/**
 * Use Web Share API if available
 */
export const shareNative = async (data: ShareData): Promise<boolean> => {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        logger.error('Share failed:', err);
      }
      return false;
    }
  }
  return false;
};

/**
 * Generate shareable URL with optional parameters
 */
export const generateShareUrl = (
  path: string,
  params?: Record<string, string | number | boolean>
): string => {
  const baseUrl = 'https://ks-atlas.com';
  const url = new URL(path, baseUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }
  
  return url.toString();
};

/**
 * Generate Discord-formatted message for kingdom
 */
export const generateDiscordMessage = (
  kingdomNumber: number,
  atlasScore: number,
  tier: string,
  rank: number
): string => {
  return `**Kingdom #${kingdomNumber}** | Atlas Score: **${atlasScore.toFixed(2)}** | ${tier} | Rank #${rank}
🔗 https://ks-atlas.com/kingdom/${kingdomNumber}`;
};

/**
 * Generate Discord-formatted message for a transfer listing
 */
export const generateTransferListingDiscordMessage = (
  kingdomNumber: number,
  atlasScore: number,
  tier: string,
  isRecruiting: boolean,
  mainLanguage?: string,
  fundTier?: string
): string => {
  const recruitingTag = isRecruiting ? '🟢 Recruiting' : '⚪ Not Recruiting';
  const langTag = mainLanguage ? ` | 🌐 ${mainLanguage}` : '';
  const fundTag = fundTier && fundTier !== 'standard' ? ` | ${fundTier === 'gold' ? '🥇' : fundTier === 'silver' ? '🥈' : '🥉'} ${fundTier.charAt(0).toUpperCase() + fundTier.slice(1)} Fund` : '';
  return `**Kingdom #${kingdomNumber}** — Transfer Listing
${recruitingTag} | ${tier}-Tier | Score: **${atlasScore.toFixed(2)}**${langTag}${fundTag}
🔗 https://ks-atlas.com/transfer-hub?kingdom=${kingdomNumber}`;
};

/**
 * Generate a shareable transfer listing card as PNG
 */
export const generateTransferListingCard = async (
  kingdomNumber: number,
  atlasScore: number,
  tier: string,
  isRecruiting: boolean,
  mainLanguage?: string,
  fundTier?: string
): Promise<Blob> => {
  const width = 600;
  const height = 315;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(1, '#131318');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Border with recruiting accent
  ctx.strokeStyle = isRecruiting ? '#22c55e40' : '#22d3ee40';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Brand
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KINGSHOT ATLAS — TRANSFER HUB', 24, 32);

  // Kingdom number
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(`#${kingdomNumber}`, 24, 110);

  // Tier badge
  const tierColors: Record<string, string> = {
    'S': '#fbbf24', 'A': '#a855f7', 'B': '#22d3ee', 'C': '#22c55e', 'D': '#6b7280', 'F': '#ef4444'
  };
  const tierKey = tier && tier.length > 0 ? tier.charAt(0) : 'D';
  const tierColor = tierColors[tierKey] || '#6b7280';

  ctx.fillStyle = tierColor + '30';
  ctx.beginPath();
  ctx.roundRect(24, 125, 55, 28, 6);
  ctx.fill();
  ctx.fillStyle = tierColor;
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(tier, 38, 145);

  // Recruiting status badge
  const recruitColor = isRecruiting ? '#22c55e' : '#6b7280';
  ctx.fillStyle = recruitColor + '20';
  ctx.beginPath();
  ctx.roundRect(90, 125, isRecruiting ? 110 : 120, 28, 6);
  ctx.fill();
  ctx.fillStyle = recruitColor;
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(isRecruiting ? '● Recruiting' : '○ Not Recruiting', 100, 144);

  // Atlas Score
  ctx.fillStyle = '#9ca3af';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('Atlas Score', 24, 190);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(atlasScore.toFixed(2), 24, 225);

  // Right side info
  const infoX = 350;
  if (mainLanguage) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Language', infoX, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(mainLanguage, infoX, 108);
  }

  if (fundTier && fundTier !== 'standard') {
    const fundColors: Record<string, string> = { gold: colors.gold, silver: colors.textSecondary, bronze: colors.bronze };
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Fund Tier', infoX, 140);
    ctx.fillStyle = fundColors[fundTier] || '#6b7280';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(fundTier.charAt(0).toUpperCase() + fundTier.slice(1), infoX, 168);
  }

  // CTA
  ctx.fillStyle = isRecruiting ? '#22c55e' : '#22d3ee';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(isRecruiting ? 'Apply to Transfer →' : 'View Listing →', infoX, 225);

  // URL footer
  ctx.fillStyle = '#4a4a4a';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ks-atlas.com/transfer-hub', 24, height - 20);

  ctx.fillStyle = '#6b7280';
  ctx.font = 'italic 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Data-driven dominance', width - 24, height - 20);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob'));
    }, 'image/png');
  });
};

/**
 * Generate embed code for external sites
 */
export const generateEmbedCode = (
  kingdomNumber: number,
  width = 400,
  height = 300
): string => {
  return `<iframe src="https://ks-atlas.com/embed/kingdom/${kingdomNumber}" width="${width}" height="${height}" frameborder="0" style="border-radius: 8px;"></iframe>`;
};
