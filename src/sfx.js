// Effetti sonori procedurali via WebAudio: nessun file audio da caricare.
window.Sfx = (function () {
  let ctx = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  // Da chiamare dopo il primo input dell'utente (gli autoplay sono bloccati).
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function beep(freq, dur, type, vol) {
    try {
      const c = ensure();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol || 0.05;
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.stop(t + dur);
    } catch (e) { /* audio non disponibile: ignora */ }
  }

  return {
    unlock,
    hit() { beep(190, 0.06, 'square', 0.04); },
    crack() { beep(110, 0.09, 'square', 0.05); },
    smash() { beep(80, 0.2, 'sawtooth', 0.07); },
    jump() { beep(460, 0.09, 'square', 0.04); },
    dash() { beep(300, 0.12, 'triangle', 0.05); },
    hurt() { beep(120, 0.22, 'sawtooth', 0.07); },
    enemyDie() { beep(70, 0.22, 'square', 0.06); },
    spit() { beep(520, 0.05, 'triangle', 0.04); setTimeout(() => beep(300, 0.08, 'sawtooth', 0.04), 40); },
    pick() { beep(680, 0.1, 'triangle', 0.05); },
    win() { beep(523, 0.12, 'square', 0.06); setTimeout(() => beep(784, 0.18, 'square', 0.06), 130); },
    lose() { beep(220, 0.2, 'sawtooth', 0.07); setTimeout(() => beep(140, 0.3, 'sawtooth', 0.07), 160); },
  };
})();
