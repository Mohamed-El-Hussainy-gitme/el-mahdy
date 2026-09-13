/**
 * Synthesizes a subtle, professional B2B notification chime using Web Audio API.
 * Requires no external audio files or network requests.
 */
export function playOrderChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two-tone rising chime (523Hz C5 -> 659Hz E5 -> 784Hz G5)
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.25);        // C5
    playTone(659.25, now + 0.12, 0.35); // E5
    playTone(783.99, now + 0.24, 0.55); // G5
  } catch (err) {
    // Non-critical audio warning
    console.warn('Audio notification notice:', err);
  }
}
