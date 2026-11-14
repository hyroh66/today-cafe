export function playCafeChime(type: 'customer_ready' | 'admin_new_order'): boolean {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes =
      type === 'customer_ready'
        ? [587.33, 880.0] // D5 -> A5 warm bell
        : [523.25, 659.25, 783.99]; // C5 -> E5 -> G5 counter chime

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.14);

      gain.gain.setValueAtTime(0.0001, now + index * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + index * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.14 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * 0.14);
      osc.stop(now + index * 0.14 + 0.48);
    });

    return true;
  } catch {
    return false;
  }
}
