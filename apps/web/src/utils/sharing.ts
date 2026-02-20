/**
 * Sharing utilities for Kingshot Atlas
 * Handles PNG export, link generation, and clipboard operations
 */

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
    'A': '#22c55e',
    'B': '#3b82f6',
    'C': '#f97316',
    'D': '#ef4444',
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
 * Full kingdom listing data for image generation
 */
export interface ListingImageData {
  kingdomNumber: number;
  atlasScore: number;
  tier: string;
  rank: number;
  isRecruiting: boolean;
  totalKvks: number;
  prepWinRate: number;
  battleWinRate: number;
  dominations: number;
  comebacks: number;
  reversals: number;
  invasions: number;
  mainLanguage?: string;
  secondaryLanguage?: string;
  fundTier?: string;
  minPower?: string;
  minTcLevel?: number;
  transferStatus?: string;
  kingdomVibe?: string[];
  recruitmentPitch?: string;
  allianceNames?: string[];
  allianceSchedule?: Record<string, string[][]>;
  napPolicy?: boolean;
  sanctuaryDistribution?: boolean;
  castleRotation?: boolean;
}

/**
 * Helper: draw rounded rect with fill
 */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * Helper: draw a stat cell (label + value)
 */
function drawStatCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, emoji: string, label: string, value: string, valueColor: string) {
  drawRoundedRect(ctx, x, y, w, h, 6, '#0d0d0d');
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.stroke();
  
  const cx = x + w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${emoji} ${label} ${emoji}`, cx, y + 14);
  ctx.fillStyle = valueColor;
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(value, cx, y + 34);
  ctx.textAlign = 'left';
}

/**
 * Generate a comprehensive shareable transfer listing card as PNG
 * Matches the full kingdom profile layout from the website
 */
export const generateTransferListingCard = async (
  kingdomNumber: number,
  atlasScore: number,
  tier: string,
  isRecruiting: boolean,
  mainLanguage?: string,
  fundTier?: string,
  extraData?: Partial<ListingImageData>
): Promise<Blob> => {
  const data: ListingImageData = {
    kingdomNumber,
    atlasScore,
    tier,
    rank: extraData?.rank || 0,
    isRecruiting,
    totalKvks: extraData?.totalKvks || 0,
    prepWinRate: extraData?.prepWinRate || 0,
    battleWinRate: extraData?.battleWinRate || 0,
    dominations: extraData?.dominations || 0,
    comebacks: extraData?.comebacks || 0,
    reversals: extraData?.reversals || 0,
    invasions: extraData?.invasions || 0,
    mainLanguage,
    secondaryLanguage: extraData?.secondaryLanguage,
    fundTier,
    minPower: extraData?.minPower,
    minTcLevel: extraData?.minTcLevel,
    transferStatus: extraData?.transferStatus,
    kingdomVibe: extraData?.kingdomVibe,
    recruitmentPitch: extraData?.recruitmentPitch,
    allianceNames: extraData?.allianceNames,
    allianceSchedule: extraData?.allianceSchedule,
    napPolicy: extraData?.napPolicy,
    sanctuaryDistribution: extraData?.sanctuaryDistribution,
    castleRotation: extraData?.castleRotation,
  };

  const hasAlliances = data.allianceNames && data.allianceNames.length > 0 && data.allianceSchedule;
  const hasBio = !!data.recruitmentPitch;
  const hasPolicies = data.napPolicy || data.sanctuaryDistribution || data.castleRotation;

  // Dynamic height based on content
  let height = 340; // base: header + performance + characteristics
  if (hasBio) height += 60;
  if (hasPolicies) height += 25;
  if (hasAlliances) height += 30 + (Object.keys(data.allianceSchedule!).length * 22);
  height = Math.max(height, 400);
  height = Math.min(height, 700);
  
  const width = 620;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Fund tier accent color
  const fundColors: Record<string, string> = { gold: '#ffc30b', silver: '#c0c0c0', bronze: '#cd7f32' };
  const accentColor = fundTier && fundTier !== 'standard' ? (fundColors[fundTier] || '#22d3ee') : '#22d3ee';

  // Dark background
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0a0a0a');
  bg.addColorStop(0.3, '#0d0d0f');
  bg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Top accent line
  const topGrad = ctx.createLinearGradient(0, 0, width, 0);
  topGrad.addColorStop(0, 'transparent');
  topGrad.addColorStop(0.3, accentColor + '80');
  topGrad.addColorStop(0.7, accentColor + '80');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 2);

  // Border
  ctx.strokeStyle = accentColor + '25';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  let y = 16;

  // ─── HEADER ROW ───────────────────────────────────
  // Kingdom number + fund tier badge
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Kingdom ${data.kingdomNumber}`, 16, y + 22);

  // Fund tier badge next to kingdom name
  if (fundTier && fundTier !== 'standard') {
    const nameWidth = ctx.measureText(`Kingdom ${data.kingdomNumber}`).width;
    const fColor = fundColors[fundTier] || '#6b7280';
    const badgeX = 16 + nameWidth + 8;
    drawRoundedRect(ctx, badgeX, y + 5, 50, 22, 11, fColor + '25');
    ctx.fillStyle = fColor;
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillText(fundTier.charAt(0).toUpperCase() + fundTier.slice(1), badgeX + 10, y + 20);
  }

  // Recruiting badge (right side)
  if (data.isRecruiting) {
    ctx.textAlign = 'right';
    drawRoundedRect(ctx, width - 120, y + 2, 105, 26, 13, '#22c55e20');
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('● RECRUITING', width - 67, y + 19);
  }

  y += 32;

  // Transfer status + freshness
  ctx.textAlign = 'left';
  if (data.transferStatus) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Transfer Status: `, 16, y + 10);
    const statusW = ctx.measureText('Transfer Status: ').width;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(data.transferStatus, 16 + statusW, y + 10);
  }
  y += 20;

  // ─── TWO-COLUMN LAYOUT: PERFORMANCE | CHARACTERISTICS ───
  const colW = (width - 48) / 2;
  const leftX = 16;
  const rightX = leftX + colW + 16;
  const sectionTop = y;

  // PERFORMANCE SECTION (left)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PERFORMANCE', leftX + colW / 2, sectionTop + 12);
  
  const perfY = sectionTop + 22;
  const cellW = (colW - 8) / 2;
  const cellH = 44;
  const gap = 4;

  // Atlas Score + KvKs
  drawStatCell(ctx, leftX, perfY, cellW, cellH, '💎', 'ATLAS SCORE', `${data.atlasScore.toFixed(2)} (#${data.rank})`, '#22d3ee');
  drawStatCell(ctx, leftX + cellW + gap, perfY, cellW, cellH, '⚡', 'KVKS', String(data.totalKvks), '#ffffff');

  // Prep Win Rate + Battle Win Rate
  drawStatCell(ctx, leftX, perfY + cellH + gap, cellW, cellH, '🛡️', 'PREP WIN RATE', `${data.prepWinRate}%`, '#eab308');
  drawStatCell(ctx, leftX + cellW + gap, perfY + cellH + gap, cellW, cellH, '⚔️', 'BATTLE WIN RATE', `${data.battleWinRate}%`, '#a855f7');

  // Dominations + Comebacks
  drawStatCell(ctx, leftX, perfY + (cellH + gap) * 2, cellW, cellH, '👑', 'DOMINATIONS', String(data.dominations), '#22c55e');
  drawStatCell(ctx, leftX + cellW + gap, perfY + (cellH + gap) * 2, cellW, cellH, '💪', 'COMEBACKS', String(data.comebacks), '#3b82f6');

  // Reversals + Invasions
  drawStatCell(ctx, leftX, perfY + (cellH + gap) * 3, cellW, cellH, '🔄', 'REVERSALS', String(data.reversals), '#a855f7');
  drawStatCell(ctx, leftX + cellW + gap, perfY + (cellH + gap) * 3, cellW, cellH, '💀', 'INVASIONS', String(data.invasions), '#ef4444');

  // CHARACTERISTICS SECTION (right)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CHARACTERISTICS', rightX + colW / 2, sectionTop + 12);

  const charY = sectionTop + 22;

  // Min Power + Min TC Level
  drawStatCell(ctx, rightX, charY, cellW, cellH, '🔥', 'MINIMUM POWER', data.minPower || '—', '#ffffff');
  drawStatCell(ctx, rightX + cellW + gap, charY, cellW, cellH, '🏰', 'MIN TC LEVEL', data.minTcLevel ? `TG${data.minTcLevel}` : '—', '#ffffff');

  // Main Language + Secondary Language
  drawStatCell(ctx, rightX, charY + cellH + gap, cellW, cellH, '🌐', 'MAIN LANGUAGE', data.mainLanguage || '—', '#ffffff');
  drawStatCell(ctx, rightX + cellW + gap, charY + cellH + gap, cellW, cellH, '🌍', 'SECONDARY LANG', data.secondaryLanguage || '—', '#ffffff');

  // Kingdom Vibe
  if (data.kingdomVibe && data.kingdomVibe.length > 0) {
    const vibeY = charY + (cellH + gap) * 2;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ KINGDOM VIBE ✨', rightX + colW / 2, vibeY + 12);
    
    let vibeTextX = rightX + 4;
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    const vibeLabels = data.kingdomVibe.map(v => v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    vibeTextX = rightX + (colW - vibeLabels.reduce((acc, v) => acc + ctx.measureText(v).width + 16, -8)) / 2;
    vibeLabels.forEach(label => {
      const lw = ctx.measureText(label).width + 12;
      drawRoundedRect(ctx, vibeTextX, vibeY + 17, lw, 18, 9, '#22d3ee15');
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, vibeTextX + 6, vibeY + 30);
      vibeTextX += lw + 4;
    });
  }

  // Kingdom Bio
  if (hasBio && data.recruitmentPitch) {
    const bioY = charY + (cellH + gap) * 2 + (data.kingdomVibe?.length ? 42 : 0);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📋 KINGDOM BIO 📋', rightX + colW / 2, bioY + 10);
    
    ctx.fillStyle = '#d1d5db';
    ctx.font = 'italic 9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    // Word-wrap the bio
    const maxW = colW - 8;
    const words = data.recruitmentPitch.split(' ');
    let line = '"';
    let lineY = bioY + 22;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxW && line.length > 1) {
        ctx.fillText(line, rightX + 4, lineY);
        line = word + ' ';
        lineY += 12;
        if (lineY > bioY + 50) { line += '...'; break; }
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trimEnd() + '"', rightX + 4, lineY);
  }

  // ─── BOTTOM: Policies ───────────────────────────
  y = sectionTop + 22 + (cellH + gap) * 4 + 8;

  if (hasPolicies) {
    let px = 16;
    const policies = [
      { label: 'NAP', active: data.napPolicy },
      { label: 'Sanctuary Distribution', active: data.sanctuaryDistribution },
      { label: 'Castle Rotation', active: data.castleRotation },
    ].filter(p => p.active);
    
    policies.forEach(p => {
      const tw = ctx.measureText(`✓ ${p.label}`).width + 14;
      drawRoundedRect(ctx, px, y, tw, 20, 10, '#22c55e15');
      ctx.strokeStyle = '#22c55e40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px, y, tw, 20, 10);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`✓ ${p.label}`, px + 7, y + 14);
      px += tw + 6;
    });
    y += 28;
  }

  // ─── ALLIANCE SCHEDULE TABLE ───────────────────
  if (hasAlliances && data.allianceNames && data.allianceSchedule) {
    const alliances = data.allianceNames;
    const schedule = data.allianceSchedule;
    const eventNames: Record<string, string> = {
      bear_hunt: 'Bear Hunt',
      viking_vengeance: 'Viking Vengeance',
      swordland_showdown: 'Swordland Showdown',
      tri_alliance_clash: 'Tri-Alliance Clash',
    };
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALLIANCE INFORMATION', 16, y + 10);
    y += 18;

    // Table header
    const eventColW = 110;
    const alliColW = Math.min(100, (width - 32 - eventColW) / alliances.length);
    
    // Alliance name headers
    alliances.forEach((name, i) => {
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, 16 + eventColW + i * alliColW + alliColW / 2, y + 10);
    });
    y += 16;

    // Rows
    Object.entries(schedule).forEach(([event, times]) => {
      if (!times || times.length === 0) return;
      ctx.fillStyle = '#6b7280';
      ctx.font = '9px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(eventNames[event] || event, 16, y + 10);
      
      times.forEach((alliTimes, i) => {
        if (i >= alliances.length) return;
        ctx.fillStyle = '#d1d5db';
        ctx.font = '9px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const timeStr = alliTimes.filter(t => t).join(' & ') || '—';
        ctx.fillText(timeStr, 16 + eventColW + i * alliColW + alliColW / 2, y + 10);
      });
      y += 16;
    });
  }

  // ─── FOOTER ───────────────────────────────────
  ctx.fillStyle = '#333333';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ks-atlas.com/kingdom/${data.kingdomNumber}`, 16, height - 10);
  ctx.fillStyle = '#4a4a4a';
  ctx.font = 'italic 10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Kingshot Atlas — Data-driven dominance', width - 16, height - 10);

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
