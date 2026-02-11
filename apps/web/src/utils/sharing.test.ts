import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTransferListingDiscordMessage, generateTransferListingCard } from './sharing';

describe('generateTransferListingDiscordMessage', () => {
  it('generates basic message with required fields', () => {
    const msg = generateTransferListingDiscordMessage(172, 54.32, 'A', true);
    expect(msg).toContain('**Kingdom #172**');
    expect(msg).toContain('Transfer Listing');
    expect(msg).toContain('🟢 Recruiting');
    expect(msg).toContain('A-Tier');
    expect(msg).toContain('**54.32**');
    expect(msg).toContain('https://ks-atlas.com/transfer-hub?kingdom=172');
  });

  it('shows not recruiting status', () => {
    const msg = generateTransferListingDiscordMessage(231, 82.39, 'S', false);
    expect(msg).toContain('⚪ Not Recruiting');
    expect(msg).not.toContain('🟢 Recruiting');
  });

  it('includes language tag when provided', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.0, 'B', true, 'English');
    expect(msg).toContain('🌐 English');
  });

  it('excludes language tag when not provided', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.0, 'B', true);
    expect(msg).not.toContain('🌐');
  });

  it('includes gold fund tier badge', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.0, 'B', true, undefined, 'gold');
    expect(msg).toContain('🥇');
    expect(msg).toContain('Gold Fund');
  });

  it('includes silver fund tier badge', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.0, 'B', true, undefined, 'silver');
    expect(msg).toContain('🥈');
    expect(msg).toContain('Silver Fund');
  });

  it('includes bronze fund tier badge', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.0, 'B', true, undefined, 'bronze');
    expect(msg).toContain('🥉');
    expect(msg).toContain('Bronze Fund');
  });

  it('excludes fund tier for standard tier', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.0, 'B', true, undefined, 'standard');
    expect(msg).not.toContain('Fund');
    expect(msg).not.toContain('🥇');
    expect(msg).not.toContain('🥈');
    expect(msg).not.toContain('🥉');
  });

  it('formats score to two decimal places', () => {
    const msg = generateTransferListingDiscordMessage(100, 45.1, 'B', true);
    expect(msg).toContain('**45.10**');
  });

  it('includes all optional fields together', () => {
    const msg = generateTransferListingDiscordMessage(172, 54.32, 'A', true, 'English', 'gold');
    expect(msg).toContain('🟢 Recruiting');
    expect(msg).toContain('A-Tier');
    expect(msg).toContain('**54.32**');
    expect(msg).toContain('🌐 English');
    expect(msg).toContain('🥇');
    expect(msg).toContain('Gold Fund');
    expect(msg).toContain('https://ks-atlas.com/transfer-hub?kingdom=172');
  });
});

describe('generateTransferListingCard', () => {
  let mockCtx: Record<string, unknown>;
  let mockCanvas: Record<string, unknown>;

  beforeEach(() => {
    mockCtx = {
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      roundRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
    };

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
        callback(new Blob(['mock-png'], { type: 'image/png' }));
      }),
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });
  });

  it('creates a canvas with correct dimensions (2x scale)', async () => {
    await generateTransferListingCard(172, 54.32, 'A', true);
    expect(mockCanvas.width).toBe(1200); // 600 * 2
    expect(mockCanvas.height).toBe(630); // 315 * 2
  });

  it('returns a PNG blob', async () => {
    const blob = await generateTransferListingCard(172, 54.32, 'A', true);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('renders kingdom number on canvas', async () => {
    await generateTransferListingCard(172, 54.32, 'A', true);
    expect(mockCtx.fillText).toHaveBeenCalledWith('#172', expect.any(Number), expect.any(Number));
  });

  it('renders recruiting status', async () => {
    await generateTransferListingCard(100, 45.0, 'B', true);
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      expect.stringContaining('Recruiting'),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('renders not recruiting status', async () => {
    await generateTransferListingCard(100, 45.0, 'B', false);
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      expect.stringContaining('Not Recruiting'),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('renders atlas score', async () => {
    await generateTransferListingCard(172, 54.32, 'A', true);
    expect(mockCtx.fillText).toHaveBeenCalledWith('54.32', expect.any(Number), expect.any(Number));
  });

  it('renders language when provided', async () => {
    await generateTransferListingCard(172, 54.32, 'A', true, 'English');
    expect(mockCtx.fillText).toHaveBeenCalledWith('English', expect.any(Number), expect.any(Number));
  });

  it('renders fund tier when provided (non-standard)', async () => {
    await generateTransferListingCard(172, 54.32, 'A', true, undefined, 'gold');
    expect(mockCtx.fillText).toHaveBeenCalledWith('Gold', expect.any(Number), expect.any(Number));
  });

  it('rejects when canvas context unavailable', async () => {
    (mockCanvas.getContext as ReturnType<typeof vi.fn>).mockReturnValue(null);
    await expect(generateTransferListingCard(172, 54.32, 'A', true)).rejects.toThrow('Could not get canvas context');
  });

  it('rejects when toBlob returns null', async () => {
    (mockCanvas.toBlob as ReturnType<typeof vi.fn>).mockImplementation(
      (callback: (blob: Blob | null) => void) => callback(null)
    );
    await expect(generateTransferListingCard(172, 54.32, 'A', true)).rejects.toThrow('Failed to create blob');
  });
});
