import { useRef, useCallback } from 'react';

/**
 * Custom hook that encapsulates all audio/sound logic for the campaign draw page.
 * Returns playSound, startSpinSound, stopSpinSound, and playJackpotSound functions.
 */
export function useCampaignAudio(soundEnabled: boolean, rollDuration: number) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spinSoundRef = useRef<GainNode | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'square', volume = 0.15) => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available
    }
  }, [soundEnabled, getAudioCtx]);

  // Realistic slot machine sound - discrete clicks synced to reel easing
  const startSpinSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const totalClicks = 40; // matches reel sequence length
      const totalSec = rollDuration;

      // Create reusable noise buffer for mechanical click sound
      const clickLen = 128;
      const noiseBuffer = ctx.createBuffer(1, clickLen, ctx.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let j = 0; j < clickLen; j++) {
        noise[j] = (Math.random() * 2 - 1) * Math.exp(-j / 18);
      }

      // Schedule clicks matching the cubic ease-out reel animation
      for (let i = 0; i < totalClicks; i++) {
        const easedPos = (i + 1) / totalClicks;
        // Invert cubic ease-out to get real time: progress = 1 - (1 - eased)^(1/3)
        const progress = 1 - Math.pow(1 - easedPos, 1 / 3);
        const clickTime = ctx.currentTime + progress * totalSec;

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;

        const clickGain = ctx.createGain();
        const slowFactor = i / totalClicks;
        // Clicks get louder and punchier as the reel slows down
        const intensity = 0.06 + slowFactor * 0.14;
        clickGain.gain.setValueAtTime(intensity, clickTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.04);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        // Higher pitch when fast, lower/chunkier when slow
        filter.frequency.setValueAtTime(900 + (1 - slowFactor) * 2200, clickTime);

        source.connect(filter);
        filter.connect(clickGain);
        clickGain.connect(masterGain);
        source.start(clickTime);
        source.stop(clickTime + 0.05);
      }

      spinSoundRef.current = masterGain;
    } catch {
      // Audio not available
    }
  }, [soundEnabled, getAudioCtx, rollDuration]);

  const stopSpinSound = useCallback(() => {
    if (spinSoundRef.current) {
      try {
        const ctx = getAudioCtx();
        spinSoundRef.current.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      } catch { /* ignore */ }
      spinSoundRef.current = null;
    }
  }, [getAudioCtx]);

  const playJackpotSound = useCallback((prizeAmount: number) => {
    if (!soundEnabled) return;
    // Jackpot cascade: rapid ascending notes then sustained chord
    if (prizeAmount >= 100) {
      // Grand jackpot: epic ascending fanfare + sustained shimmer
      setTimeout(() => playSound(523, 0.3, 'triangle', 0.2), 0);
      setTimeout(() => playSound(659, 0.3, 'triangle', 0.2), 80);
      setTimeout(() => playSound(784, 0.3, 'triangle', 0.22), 160);
      setTimeout(() => playSound(1047, 1.0, 'triangle', 0.25), 260);
      setTimeout(() => playSound(1319, 0.8, 'sine', 0.1), 350);
      setTimeout(() => playSound(1568, 0.7, 'sine', 0.08), 440);
      // Sustained power chord
      setTimeout(() => playSound(523, 1.5, 'sine', 0.12), 550);
      setTimeout(() => playSound(784, 1.5, 'sine', 0.1), 550);
      setTimeout(() => playSound(1047, 1.5, 'sine', 0.08), 550);
    } else if (prizeAmount >= 50) {
      // High prize: bright cascade
      setTimeout(() => playSound(440, 0.3, 'triangle', 0.18), 0);
      setTimeout(() => playSound(554, 0.3, 'triangle', 0.18), 100);
      setTimeout(() => playSound(659, 0.4, 'triangle', 0.2), 200);
      setTimeout(() => playSound(880, 0.8, 'triangle', 0.18), 340);
      setTimeout(() => playSound(1100, 0.6, 'sine', 0.06), 440);
    } else if (prizeAmount >= 25) {
      // Medium prize: warm triad
      setTimeout(() => playSound(392, 0.3, 'triangle', 0.16), 0);
      setTimeout(() => playSound(494, 0.3, 'triangle', 0.16), 120);
      setTimeout(() => playSound(587, 0.5, 'triangle', 0.18), 240);
      setTimeout(() => playSound(784, 0.4, 'sine', 0.06), 380);
    } else {
      // Standard prize: simple ascending
      setTimeout(() => playSound(262, 0.3, 'triangle', 0.14), 0);
      setTimeout(() => playSound(330, 0.4, 'triangle', 0.16), 140);
    }
  }, [soundEnabled, playSound]);

  return { playSound, startSpinSound, stopSpinSound, playJackpotSound };
}
