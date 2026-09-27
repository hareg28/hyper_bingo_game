/**
 * Universal Mobile-Ready Audio Manager for Hyper Bingo
 * 
 * Works seamlessly across:
 * - iOS Safari & iPhone WKWebView (Telegram Mini App)
 * - Android Chrome & Android WebViews
 * - Desktop Chrome / Edge / Firefox / Safari
 * 
 * Audio Delivery Hierarchy:
 * 1. Static pre-cached file: `/sounds/calls/${num}.mp3`
 * 2. Streaming Amharic female TTS: `/api/tts?num=${num}` (Auto-caches to disk)
 * 3. Client-side SpeechSynthesis fallback
 */

const SILENT_WAV_BASE64 =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class AudioManager {
  private unlocked = false;
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;

  /**
   * Unlocks mobile browser autoplay policies on iOS/Android.
   * Call this on any first click/touch interaction.
   */
  unlockAudio(): void {
    if (typeof window === 'undefined') return;

    // 1. Resume Web Audio Context
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      }
    } catch {}

    if (this.unlocked) return;

    // 2. Play silent audio to unlock HTMLMediaElement on mobile
    try {
      const silent = new Audio(SILENT_WAV_BASE64);
      silent.volume = 0.01;
      const playPromise = silent.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.unlocked = true;
          })
          .catch(() => {});
      }
    } catch {}
  }

  getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx && AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Plays real Amharic female voice call for ball 1..75.
   * Checks `/sounds/calls/${num}.mp3` -> `/api/tts?num=${num}` -> fallback
   */
  playCall(num: number, onFallback?: () => void): void {
    if (typeof window === 'undefined') return;

    this.unlockAudio();

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    // Direct endpoint: will return cached MP3 or generate & stream on the fly
    const primaryUrl = `/api/tts?num=${num}`;

    try {
      const audio = new Audio(primaryUrl);
      this.currentAudio = audio;
      audio.volume = 1.0;

      let fallbackHandled = false;
      const triggerFallback = () => {
        if (!fallbackHandled) {
          fallbackHandled = true;
          if (onFallback) onFallback();
        }
      };

      audio.onerror = () => {
        triggerFallback();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[AudioManager] Audio play failed for ${primaryUrl}:`, err);
          triggerFallback();
        });
      }
    } catch (e) {
      console.warn('[AudioManager] Play error:', e);
      if (onFallback) onFallback();
    }
  }

  /**
   * Built-in Web Audio Buzzer for false bingo or blocked attempts (100% mobile safe)
   */
  playErrorBuzzer(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  /**
   * Built-in Web Audio Victory Fanfare for Bingo winner
   */
  playFanfare(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const notes = [261.63, 329.63, 392.0, 523.25];
      const now = ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.25, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.3);
      });
    } catch {}
  }
}

export const audioManager = new AudioManager();
