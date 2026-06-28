// Audio del gioco — interamente PROCEDURALE via WebAudio: nessun file audio da
// caricare (gira anche da file://). Comprende effetti sonori, musica di sottofondo
// in loop e controlli di volume/muto/musica salvati in localStorage.
//
// API pubblica (compatibile con le scene):
//   unlock()                          -> sblocca l'audio al primo gesto + avvia musica
//   hit/crack/smash/jump/dash/hurt/enemyDie/spit/pick/win/lose/emerge(big)
//   cycleVolume() / volLevel() / setVolume(v) / getVolume()
//   toggleMusic() / musicEnabled() / startMusic() / stopMusic()
//   addAudioButton(scene, x, y) / addMusicButton(scene, x, y)  -> pulsanti a schermo
window.Sfx = (function () {
  let ctx = null;
  let master = null, sfxBus = null, musicBus = null;

  // ---- Impostazioni salvate ----
  const VOL_KEY = 'earwaxwar.vol';
  const MUSIC_KEY = 'earwaxwar.music';
  const VOL_LEVELS = [0, 0.35, 0.7];          // muto, basso, pieno
  let volume = loadNum(VOL_KEY, 0.7);
  let musicOn = loadBool(MUSIC_KEY, true);

  function loadNum(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : parseFloat(v); } catch (e) { return d; } }
  function loadBool(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.connect(master);
      applyMix();
    }
    return ctx;
  }

  function applyMix() {
    if (!master) return;
    master.gain.value = volume;                 // volume generale (0 = muto)
    musicBus.gain.value = musicOn ? 0.5 : 0;    // musica un filo sotto agli effetti
  }

  // ---------- Mattoni sonori ----------

  // Tono a frequenza fissa con piccola busta (attacco/rilascio morbidi).
  function tone(freq, dur, type, vol, when, bus) {
    try {
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      const t = (when || c.currentTime);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || sfxBus);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* audio non disponibile */ }
  }

  // Tono che "scivola" da una frequenza all'altra (boing, whoosh, sgonfiamento).
  function slide(f0, f1, dur, type, vol) {
    try {
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      const t = c.currentTime;
      o.frequency.setValueAtTime(Math.max(1, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(sfxBus);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* ignora */ }
  }

  // Sbuffo di rumore filtrato: ottimo per gli "splat" gommosi e i whoosh.
  function noise(dur, vol, cutoff) {
    try {
      const c = ensure(); if (!c) return;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain();
      const t = c.currentTime;
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = src;
      if (cutoff) {
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
        src.connect(f); node = f;
      }
      node.connect(g); g.connect(sfxBus);
      src.start(t); src.stop(t + dur);
    } catch (e) { /* ignora */ }
  }

  // ---------- Musica di sottofondo (loop procedurale) ----------
  // Sequencer semplice a 16 passi: basso + melodia pentatonica saltellante + tick.
  let musicTimer = null, musicStep = 0;
  const STEP_MS = 165;
  // 0 = pausa. Frequenze in Hz.
  const LEAD = [440, 0, 330, 0, 262, 330, 0, 294, 262, 0, 220, 262, 294, 0, 330, 0];
  const BASS = [110, 0, 0, 0, 87.31, 0, 0, 0, 130.81, 0, 0, 0, 98, 0, 0, 0];

  function playMusicStep() {
    const c = ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.02;
    const lead = LEAD[musicStep];
    if (lead) tone(lead, 0.16, 'triangle', 0.06, t, musicBus);
    const bass = BASS[musicStep];
    if (bass) tone(bass, 0.34, 'triangle', 0.10, t, musicBus);
    if (musicStep % 2 === 0) tone(880, 0.03, 'square', 0.012, t, musicBus); // tick leggero
    musicStep = (musicStep + 1) % 16;
  }

  function startMusic() {
    const c = ensure();
    if (!c || musicTimer || !musicOn) return;
    if (c.state !== 'running') return;          // si avvia solo ad audio sbloccato
    musicStep = 0;
    musicTimer = setInterval(playMusicStep, STEP_MS);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  // ---------- Controlli volume / musica ----------

  function volLevel() { return volume <= 0 ? 0 : (volume < 0.55 ? 1 : 2); } // 0 muto,1 basso,2 pieno
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); save(VOL_KEY, String(volume)); applyMix(); }
  function getVolume() { return volume; }
  function cycleVolume() {
    // pieno(2) -> basso(1) -> muto(0) -> pieno(2)
    const next = (volLevel() + 2) % 3;
    setVolume(VOL_LEVELS[next]);
  }
  function musicEnabled() { return musicOn; }
  function toggleMusic() {
    musicOn = !musicOn;
    save(MUSIC_KEY, musicOn ? '1' : '0');
    applyMix();
    if (musicOn) startMusic(); else stopMusic();
  }

  // ---------- Pulsanti audio a schermo (riusabili da qualunque scena) ----------

  function makeBtnBg(scene, x, y) {
    const bg = scene.add.circle(x, y, 17, 0x000000, 0.35)
      .setScrollFactor(0).setDepth(110).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(2, 0xfff7e8, 0.6);
    return bg;
  }

  // Pulsante VOLUME: tocco = cicla pieno -> basso -> muto. Disegna un altoparlante.
  function addAudioButton(scene, x, y) {
    const bg = makeBtnBg(scene, x, y);
    const g = scene.add.graphics().setScrollFactor(0).setDepth(111);
    function redraw() {
      g.clear();
      const lvl = volLevel();
      g.fillStyle(0xfff7e8, 0.92);
      g.fillRect(x - 9, y - 4, 4, 8);                                   // corpo
      g.fillTriangle(x - 5, y - 4, x - 5, y + 4, x + 1, y + 8);          // cono (parte bassa)
      g.fillTriangle(x - 5, y - 4, x + 1, y + 8, x + 1, y - 8);          // cono (parte alta)
      if (lvl === 0) {
        g.lineStyle(2.5, 0xe74c3c, 1);                                   // muto: barra rossa
        g.beginPath(); g.moveTo(x + 4, y - 7); g.lineTo(x + 12, y + 7); g.strokePath();
      } else {
        g.lineStyle(2, 0xfff7e8, 0.9);
        g.beginPath(); g.arc(x + 2, y, 6, -0.6, 0.6); g.strokePath();    // onda vicina
        if (lvl === 2) { g.beginPath(); g.arc(x + 2, y, 10, -0.6, 0.6); g.strokePath(); } // onda lontana
      }
    }
    redraw();
    bg.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); unlock(); cycleVolume(); redraw(); });
    return { bg, redraw };
  }

  // Pulsante MUSICA: tocco = on/off. Disegna una nota musicale (barrata se spenta).
  function addMusicButton(scene, x, y) {
    const bg = makeBtnBg(scene, x, y);
    const g = scene.add.graphics().setScrollFactor(0).setDepth(111);
    function redraw() {
      g.clear();
      const on = musicOn;
      g.fillStyle(on ? 0xfff7e8 : 0x9a8f80, 0.92);
      g.fillCircle(x - 3, y + 5, 3.4);              // testa nota
      g.fillRect(x - 0.5, y - 7, 2, 12);            // gambo
      g.fillRect(x - 0.5, y - 7, 7, 2.4);           // bandierina
      if (!on) {
        g.lineStyle(2.5, 0xe74c3c, 1);              // barra rossa = musica spenta
        g.beginPath(); g.moveTo(x - 10, y - 9); g.lineTo(x + 10, y + 9); g.strokePath();
      }
    }
    redraw();
    bg.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); unlock(); toggleMusic(); redraw(); });
    return { bg, redraw };
  }

  // ---------- Sblocco audio ----------

  // Da chiamare dopo il primo input dell'utente (gli autoplay sono bloccati).
  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().then(startMusic, function () {});
    else startMusic();
  }

  // ---------- Effetti sonori (tono scherzoso/gommoso) ----------

  return {
    unlock,
    // volume / musica
    cycleVolume, volLevel, setVolume, getVolume,
    toggleMusic, musicEnabled, startMusic, stopMusic,
    addAudioButton, addMusicButton,

    // colpo dello swab: un "whiff" leggero
    hit() { slide(720, 320, 0.06, 'triangle', 0.035); },
    // cerume scheggiato: piccolo "tok" umido
    crack() { slide(200, 110, 0.08, 'square', 0.05); },
    // blocco distrutto: "splat" succoso
    smash() { noise(0.22, 0.11, 1100); slide(170, 60, 0.2, 'sawtooth', 0.06); },
    // salto: "boing" comico verso l'alto
    jump() { slide(300, 660, 0.12, 'square', 0.045); },
    // scatto: whoosh d'aria
    dash() { noise(0.16, 0.05, 2600); slide(520, 900, 0.12, 'triangle', 0.03); },
    // colpito: "ahi" discendente
    hurt() { slide(380, 120, 0.22, 'sawtooth', 0.07); },
    // nemico eliminato: si sgonfia con uno splat
    enemyDie() { slide(230, 50, 0.24, 'sawtooth', 0.06); noise(0.12, 0.05, 800); },
    // sputo: "ptu!"
    spit() { slide(600, 260, 0.06, 'triangle', 0.045); noise(0.06, 0.035, 1500); },
    // getto di acqua e sapone: "pfff" pulito e arioso
    spray() { noise(0.1, 0.045, 3200); slide(760, 520, 0.07, 'triangle', 0.02); },
    // cerume raccolto: "bloop" allegro
    pick() { slide(500, 860, 0.1, 'sine', 0.05); },
    // livello completato: piccola fanfara
    win() {
      const c = ensure(); const t = c ? c.currentTime : 0;
      tone(523, 0.12, 'square', 0.06, t);
      tone(659, 0.12, 'square', 0.06, t + 0.12);
      tone(784, 0.2, 'square', 0.07, t + 0.24);
    },
    // game over: trombetta triste discendente
    lose() {
      const c = ensure(); const t = c ? c.currentTime : 0;
      tone(330, 0.18, 'sawtooth', 0.07, t);
      tone(262, 0.18, 'sawtooth', 0.07, t + 0.16);
      slide(247, 120, 0.4, 'sawtooth', 0.07);
    },
    // nemico che emerge dal terreno o cala dal soffitto: "splorch" gommoso che sale
    emerge(big) {
      slide(70, big ? 150 : 240, 0.18, 'sawtooth', big ? 0.08 : 0.05);
      noise(0.1, 0.04, 600);
    },
  };
})();
