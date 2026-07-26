// Audio del gioco — interamente PROCEDURALE via WebAudio: nessun file audio da
// caricare (gira anche da file://). Comprende effetti sonori (stratificati, con
// variazione a ogni colpo), musica di sottofondo a piu' voci che CAMBIA in base
// alla situazione (menu / livello / boss), e controlli volume/muto/musica salvati
// in localStorage.
//
// Rifatto 2026-07-17 (round 3 "Audio"): sintesi piu' ricca (busta ADSR, filtri,
// detune, una mandata "spazio" con delay+riverbero), effetti a piu' strati, e un
// vero motore musicale con scheduler a lookahead. Restano PROCEDURALI per scelta
// dell'utente (peso zero, niente abbonamenti). Il preview verifica la LOGICA; il
// GUSTO del suono lo giudica l'utente ascoltando sul telefono.
//
// API pubblica (compatibile con le scene):
//   unlock()                          -> sblocca l'audio al primo gesto + avvia musica
//   hit/crack/smash/jump/dash/hurt/enemyDie/spit/spray/pick/win/lose/emerge(big)
//   cycleVolume() / volLevel() / setVolume(v) / getVolume()
//   toggleMusic() / musicEnabled() / startMusic() / stopMusic()
//   setMusic(nome)                    -> 'menu' | 'level' | 'boss' (dissolvenza)
//   addAudioButton(scene, x, y) / addMusicButton(scene, x, y)  -> pulsanti a schermo
window.Sfx = (function () {
  let ctx = null;
  let master = null, sfxBus = null, musicBus = null, musicFade = null;
  let fxBus = null, fxReturn = null;                 // mandata "spazio" (delay + riverbero)

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
      musicFade = ctx.createGain();       // dissolvenza tra brani (setMusic), 0..1
      musicFade.gain.value = 1;
      musicFade.connect(musicBus);
      buildFx();
      applyMix();
      attachWakeListeners();
    }
    return ctx;
  }

  // AUDIO IN BACKGROUND (2026-07-25): sul telefono dell'utente l'AudioContext NON si sospende da
  // solo quando lo schermo si spegne -> la musica continua (indesiderato) E il browser rallenta lo
  // scheduler in background (throttling di setInterval), che la fa sballare/"crashare". Quindi la
  // SOSPENDIAMO noi quando la pagina va in background e la riprendiamo al ritorno (in sospensione
  // l'orologio dell'audio si ferma, quindi non serve risincronizzare). Un tocco/tasto la riprende
  // comunque, come rete di sicurezza.
  let wakeAttached = false;
  function suspendAudio() {
    const c = ctx; if (!c) return;
    if (c.state === 'running') c.suspend().catch(function () {});
  }
  function resumeAudio() {
    const c = ctx; if (!c) return;
    if (c.state === 'suspended') c.resume().then(function () { if (musicOn) startMusic(); }, function () {});
    else if (c.state === 'running' && musicOn && !schedTimer) startMusic();
  }
  function attachWakeListeners() {
    if (wakeAttached) return;
    wakeAttached = true;
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) suspendAudio();
        else resumeAudio();
      });
      window.addEventListener('pointerdown', function () { resumeAudio(); }, { passive: true });
      window.addEventListener('touchstart', function () { resumeAudio(); }, { passive: true });
      window.addEventListener('keydown', function () { resumeAudio(); });
    } catch (e) { /* ambienti senza DOM: ignora */ }
  }

  // Mandata "spazio" condivisa: un feedback-delay corto + un riverbero a
  // convoluzione (impulso sintetico). Toglie il "secco da beep". Leggera (CPU mobile).
  function buildFx() {
    fxBus = ctx.createGain();           // qui mandano i suoni che vogliono coda
    fxReturn = ctx.createGain();
    fxReturn.gain.value = 0.9;
    fxReturn.connect(master);
    // delay con smorzamento nel feedback
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.17;
    const fb = ctx.createGain(); fb.gain.value = 0.26;
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2000;
    delay.connect(damp); damp.connect(fb); fb.connect(delay);
    fxBus.connect(delay); delay.connect(fxReturn);
    // riverbero corto
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(0.45, 2.4);
    const revGain = ctx.createGain(); revGain.gain.value = 0.8;
    fxBus.connect(conv); conv.connect(revGain); revGain.connect(fxReturn);
  }

  function makeImpulse(dur, decay) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function applyMix() {
    if (!master) return;
    master.gain.value = volume;                 // volume generale (0 = muto)
    musicBus.gain.value = musicOn ? 0.5 : 0;    // musica un filo sotto agli effetti
  }

  // ---------- Mattoni sonori ----------

  // Piccola variazione casuale (per non far suonare identici i colpi ripetuti).
  function jit(v, a) { return v * (1 + (Math.random() * 2 - 1) * (a == null ? 0.04 : a)); }

  // Busta ADSR su un GainNode. Ritorna il tempo di fine (release inclusa).
  function adsr(g, t, dur, a, d, s, r, peak) {
    peak = peak == null ? 0.08 : peak;
    a = a == null ? 0.008 : a; d = d == null ? 0.05 : d;
    s = s == null ? 0.5 : s; r = r == null ? 0.06 : r;
    const sl = Math.max(0.0001, peak * s);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(sl, t + a + d);
    const relStart = Math.max(t + a + d, t + dur - r);
    g.gain.setValueAtTime(sl, relStart);
    g.gain.exponentialRampToValueAtTime(0.0001, relStart + r);
    return relStart + r;
  }

  // Voce tonale: 1+ oscillatori (detune) → filtro opzionale → ADSR → bus (+ mandata spazio).
  function synth(o) {
    try {
      const c = ensure(); if (!c) return;
      const t = o.when || c.currentTime;
      const bus = o.bus || sfxBus;
      const dur = o.dur || 0.2;
      const g = c.createGain();
      const nodes = [g];                 // nodi da SCOLLEGARE a fine nota (vedi cleanup sotto)
      const dets = o.detune || [0];
      const oscs = dets.map(dt => {
        const osc = c.createOscillator();
        osc.type = o.type || 'triangle';
        osc.frequency.setValueAtTime(Math.max(1, o.freq), t);
        if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t + dur);
        if (dt) osc.detune.value = dt;
        return osc;
      });
      // catena: oscillatori → [filtro] → [distorsione] → gain
      let dest = g;
      if (o.dist) {
        const ws = c.createWaveShaper();
        ws.curve = getDistCurve();
        ws.oversample = '2x';
        ws.connect(g);
        dest = ws; nodes.push(ws);
      }
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter.type || 'lowpass';
        f.frequency.setValueAtTime(o.filter.freq || 1200, t);
        if (o.filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(1, o.filter.to), t + dur);
        if (o.filter.q != null) f.Q.value = o.filter.q;
        oscs.forEach(osc => osc.connect(f)); f.connect(dest); nodes.push(f);
      } else {
        oscs.forEach(osc => osc.connect(dest));
      }
      const end = adsr(g, t, dur, o.a, o.d, o.s, o.r, o.peak);
      g.connect(bus);
      if (o.send && fxBus) { const s = c.createGain(); s.gain.value = o.send; g.connect(s); s.connect(fxBus); nodes.push(s); }
      oscs.forEach(osc => { osc.start(t); osc.stop(end + 0.03); });
      // CLEANUP (fix crash audio mobile 2026-07-25): a nota finita SCOLLEGA i nodi persistenti
      // (gain/filtro/distorsione/mandata) — restano attaccati al bus/fx e su alcuni browser mobile
      // NON vengono raccolti dal GC, accumulandosi finche' l'audio si impianta dopo qualche minuto.
      // Gli oscillatori si autoscollegano a fine suono. `onended` scatta allo stop dell'ultimo osc.
      const last = oscs[oscs.length - 1];
      if (last) last.onended = function () { for (let k = 0; k < nodes.length; k++) { try { nodes[k].disconnect(); } catch (e) {} } };
    } catch (e) { /* audio non disponibile */ }
  }

  // Sbuffo di rumore filtrato (splat, aria, whoosh) con ADSR.
  function noiseBurst(o) {
    try {
      const c = ensure(); if (!c) return;
      const t = o.when || c.currentTime;
      const dur = o.dur || 0.2;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain();
      const nodes = [g];
      let node = src;
      if (o.freq) {
        const f = c.createBiquadFilter();
        f.type = o.type || 'lowpass';
        f.frequency.setValueAtTime(o.freq, t);
        if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur);
        if (o.q != null) f.Q.value = o.q;
        src.connect(f); node = f; nodes.push(f);
      }
      node.connect(g);
      adsr(g, t, dur, o.a, o.d, o.s == null ? 0.25 : o.s, o.r, o.peak);
      g.connect(o.bus || sfxBus);
      if (o.send && fxBus) { const s = c.createGain(); s.gain.value = o.send; g.connect(s); s.connect(fxBus); nodes.push(s); }
      src.start(t); src.stop(t + dur + 0.02);
      // CLEANUP: scollega i nodi persistenti a fine sbuffo (vedi nota in synth()).
      src.onended = function () { for (let k = 0; k < nodes.length; k++) { try { nodes[k].disconnect(); } catch (e) {} } };
    } catch (e) { /* ignora */ }
  }

  // ---------- Nomi delle note → frequenza (per la musica) ----------
  const NOTE_IDX = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
  function noteToFreq(n) {
    if (typeof n !== 'string') return 0;
    const m = n.match(/^([A-G]#?)(\d)$/);
    if (!m) return 0;
    const midi = NOTE_IDX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Curva di distorsione (waveshaper) per il timbro "punk" del boss: chitarra grezza/satura.
  let distCurve = null;
  function getDistCurve() {
    if (distCurve) return distCurve;
    const n = 1024, c = new Float32Array(n), k = 16;
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    distCurve = c;
    return c;
  }

  // ---------- Batteria sintetica (per la musica) ----------
  // NB: la musica gira di CONTINUO, quindi la batteria e' la fonte principale di accumulo di nodi.
  // `cleanupOnEnd(src, [nodi])` scollega i nodi persistenti quando la sorgente finisce (vedi synth).
  function cleanupOnEnd(src, nodes) {
    src.onended = function () { for (let k = 0; k < nodes.length; k++) { try { nodes[k].disconnect(); } catch (e) {} } };
  }
  function drumKick(t, bus, vol) {
    const c = ctx; const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.22);
    cleanupOnEnd(o, [g]);
  }
  function drumSnare(t, bus, vol) {
    const c = ctx;
    const len = Math.floor(c.sampleRate * 0.2);
    const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(hp); hp.connect(g); g.connect(bus); src.start(t); src.stop(t + 0.18);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t);
    const g2 = c.createGain(); g2.gain.setValueAtTime((vol || 0.12) * 0.55, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g2); g2.connect(bus); o.start(t); o.stop(t + 0.12);
    cleanupOnEnd(src, [hp, g]); cleanupOnEnd(o, [g2]);
  }
  function drumHat(t, bus, vol, open) {
    const c = ctx; const dur = open ? 0.14 : 0.045;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = c.createGain(); g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.02);
    cleanupOnEnd(src, [hp, g]);
  }

  // ---------- Musica: i 3 brani (dati) ----------
  // Ogni voce e' un pattern di passi da 1/16; 0 = pausa. Gli accordi sono array di note.
  // Le voci possono avere lunghezze diverse (si ripetono in modo indipendente). Batteria:
  // 'K' kick, 'S' snare, 'h' hat chiuso, 'H' hat aperto.
  // Per ridurre la ripetitivita' (feedback utente 2026-07-18): melodie di 4 battute (64 passi) con
  // frasi diverse, mentre basso/accordi/batteria sono di 2 battute (32) — lunghezze DIVERSE = le
  // combinazioni si spostano invece di ripetersi identiche ogni battuta. Batteria con fill a fine
  // frase. Restano bozze da tarare col gusto dell'utente.
  const SONGS = {
    // Menu: rilassato, giocoso, maggiore.
    menu: {
      bpm: 92, swing: 0.16,
      bass: ['C2', 0, 0, 0, 'G2', 0, 0, 0, 'A2', 0, 0, 0, 'F2', 0, 0, 0,
             'C2', 0, 0, 0, 'E2', 0, 0, 0, 'F2', 0, 0, 0, 'G2', 0, 'G2', 0],
      chords: [['C3', 'E3', 'G3'], 0, 0, 0, ['G2', 'B2', 'D3'], 0, 0, 0, ['A2', 'C3', 'E3'], 0, 0, 0, ['F2', 'A2', 'C3'], 0, 0, 0,
               ['C3', 'E3', 'G3'], 0, 0, 0, ['E2', 'G2', 'B2'], 0, 0, 0, ['F2', 'A2', 'C3'], 0, 0, 0, ['G2', 'B2', 'D3'], 0, 0, 0],
      lead: ['G4', 0, 'E4', 0, 'C4', 0, 'E4', 'G4', 'A4', 0, 'G4', 0, 'E4', 0, 'D4', 0,
             'C4', 0, 'D4', 0, 'E4', 0, 'G4', 0, 'A4', 0, 'G4', 'E4', 'D4', 0, 0, 0,
             'E4', 0, 'G4', 0, 'A4', 0, 'C5', 0, 'B4', 0, 'A4', 0, 'G4', 0, 'E4', 0,
             'D4', 0, 'E4', 'G4', 'A4', 0, 'G4', 0, 'E4', 0, 'D4', 0, 'C4', 0, 0, 0],
      drums: ['K', 0, 'h', 0, 'S', 0, 'h', 0, 'K', 0, 'h', 0, 'S', 0, 'h', 'h',
              'K', 0, 'h', 0, 'S', 0, 'h', 0, 'K', 0, 'h', 'K', 'S', 0, 'h', 'H'],
      bassVol: 0.13, chordVol: 0.038, leadVol: 0.06, drumVol: 0.6,
      bassType: 'triangle', leadType: 'triangle'
    },
    // Livello (normale + corsa): spinto, ritmato, "missione di pulizia".
    level: {
      bpm: 130, swing: 0.09,
      bass: ['C2', 'C2', 'G2', 0, 'C2', 0, 'A1', 'A1', 'F2', 'F2', 'C2', 0, 'G2', 0, 'G2', 'B1',
             'C2', 'C2', 'G2', 0, 'C2', 0, 'E2', 0, 'F2', 'F2', 'A2', 0, 'G2', 'G2', 'F2', 'D2'],
      chords: [['C3', 'E3', 'G3'], 0, 0, 0, 0, 0, ['A2', 'C3', 'E3'], 0, 0, 0, 0, 0, ['F2', 'A2', 'C3'], 0, ['G2', 'B2', 'D3'], 0,
               ['C3', 'E3', 'G3'], 0, 0, 0, ['E3', 'G3', 'B3'], 0, 0, 0, ['F2', 'A2', 'C3'], 0, ['G2', 'B2', 'D3'], 0, ['G2', 'B2', 'D3'], 0],
      lead: ['C5', 0, 'G4', 'E4', 'G4', 0, 'C5', 0, 'A4', 0, 'E4', 0, 'G4', 'A4', 'G4', 'E4',
             'F4', 0, 'A4', 'C5', 'A4', 0, 'F4', 0, 'G4', 0, 'B4', 'D5', 'G4', 0, 0, 0,
             'E5', 0, 'C5', 'G4', 'C5', 0, 'E5', 0, 'D5', 0, 'B4', 0, 'G4', 'B4', 'D5', 0,
             'C5', 0, 'A4', 'F4', 'A4', 0, 'C5', 0, 'G4', 0, 'E4', 'G4', 'C5', 0, 'D5', 0],
      drums: ['K', 0, 'h', 'h', 'S', 0, 'h', 0, 'K', 'K', 'h', 0, 'S', 0, 'h', 'h',
              'K', 0, 'h', 'h', 'S', 0, 'h', 0, 'K', 'K', 'h', 'K', 'S', 'S', 'h', 'H'],
      bassVol: 0.14, chordVol: 0.044, leadVol: 0.056, drumVol: 0.82,
      bassType: 'triangle', leadType: 'triangle', chordType: 'triangle'
    },
    // Boss / assedio: PUNK — power chord distorti, basso a crome martellanti, batteria veloce e tirata.
    boss: {
      bpm: 168, swing: 0.0, punk: true,
      // basso a crome martellanti (drive punk): stessa nota ribattuta
      bass: ['A1', 'A1', 'A1', 'A1', 'A1', 'A1', 'A1', 'A1', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'G1', 'G1',
             'A1', 'A1', 'A1', 'A1', 'C2', 'C2', 'C2', 'C2', 'F1', 'F1', 'F1', 'F1', 'G1', 'G1', 'A1', 'B1'],
      // POWER CHORD (fondamentale + quinta + ottava), il marchio del punk
      chords: [['A2', 'E3', 'A3'], 0, 0, 0, ['A2', 'E3', 'A3'], 0, 0, 0, ['F2', 'C3', 'F3'], 0, 0, 0, ['G2', 'D3', 'G3'], 0, ['G2', 'D3', 'G3'], 0,
               ['A2', 'E3', 'A3'], 0, 0, 0, ['C3', 'G3', 'C4'], 0, 0, 0, ['F2', 'C3', 'F3'], 0, ['G2', 'D3', 'G3'], 0, ['E2', 'B2', 'E3'], 0],
      // riff grezzo e aggressivo (pentatonica di La minore)
      lead: ['A4', 0, 0, 'A4', 'C5', 0, 'A4', 0, 'E5', 0, 0, 'D5', 'C5', 0, 'A4', 0,
             'A4', 0, 0, 'A4', 'C5', 0, 'D5', 0, 'E5', 0, 'D5', 0, 'C5', 0, 'A4', 0,
             'A4', 0, 'A4', 0, 'C5', 0, 'A4', 0, 'G4', 0, 'A4', 0, 'E4', 0, 'A4', 0,
             'A4', 'C5', 'D5', 'E5', 'D5', 'C5', 'A4', 0, 'E5', 0, 'D5', 'C5', 'A4', 0, 0, 0],
      // batteria punk: crome tirate su kick, rullante su 2 e 4, fill + crash a fine frase
      drums: ['K', 0, 'K', 0, 'S', 0, 'K', 0, 'K', 0, 'K', 0, 'S', 0, 'K', 'H',
              'K', 0, 'K', 0, 'S', 0, 'K', 0, 'K', 0, 'S', 0, 'S', 'S', 'K', 'H'],
      bassVol: 0.12, chordVol: 0.042, leadVol: 0.05, drumVol: 0.9,
      bassType: 'sawtooth', leadType: 'sawtooth', chordType: 'sawtooth'
    }
  };

  function scheduleStep(track, step, when) {
    const punk = !!track.punk;
    // basso
    const bn = track.bass[step % track.bass.length];
    if (bn) synth({ freq: noteToFreq(bn), type: track.bassType || 'sawtooth', dur: 0.22, peak: track.bassVol, dist: punk, filter: { type: 'lowpass', freq: track.bassCut || 850, q: punk ? 1.5 : 4 }, bus: musicFade, when: when, a: 0.006, d: 0.07, s: 0.5, r: 0.08 });
    // accordi — STRUMMATI (note sfasate di ~18ms) per un feel piu' acustico, meno "stab" di synth
    const ch = track.chords[step % track.chords.length];
    if (ch) ch.forEach((nn, i) => synth({ freq: noteToFreq(nn), type: track.chordType || 'triangle', dur: punk ? 0.26 : 0.55, peak: track.chordVol, detune: [-6, 7], dist: punk, filter: { type: 'lowpass', freq: punk ? 2600 : 1700 }, bus: musicFade, when: when + i * 0.018, a: punk ? 0.004 : 0.05, d: punk ? 0.08 : 0.22, s: 0.55, r: punk ? 0.1 : 0.22, send: punk ? 0.08 : 0.12 }));
    // lead — lieve detune (calore/coro) + volume umanizzato; distorto e "gridato" nel punk
    const ln = track.lead[step % track.lead.length];
    if (ln) synth({ freq: noteToFreq(ln), type: track.leadType || 'triangle', dur: 0.2, peak: jit(track.leadVol, 0.15), detune: punk ? [-3, 4] : [-4, 5], dist: punk, filter: { type: 'lowpass', freq: punk ? 4400 : 3200, to: punk ? 1800 : 900, q: 2 }, bus: musicFade, when: when, a: 0.004, d: 0.07, s: punk ? 0.35 : 0.2, r: punk ? 0.09 : 0.07, send: 0.1 });
    // batteria (hi-hat con volume leggermente variabile per un groove meno rigido)
    const dr = track.drums[step % track.drums.length];
    if (dr === 'K') drumKick(when, musicFade, 0.17 * track.drumVol);
    else if (dr === 'S') drumSnare(when, musicFade, 0.12 * track.drumVol);
    else if (dr === 'h') drumHat(when, musicFade, jit(0.045, 0.25) * track.drumVol, false);
    else if (dr === 'H') drumHat(when, musicFade, 0.06 * track.drumVol, true);
  }

  // ---------- Motore musicale: scheduler a lookahead ----------
  let schedTimer = null, swapTimer = null;
  let curStep = 0, nextStepTime = 0;
  let desiredTrack = 'menu';       // cosa ha chiesto la scena
  let currentTrackName = null;     // cosa sta effettivamente suonando

  function schedTick() {
    const c = ctx; if (!c || c.state !== 'running') return;   // sospeso (background): non schedulare
    const track = SONGS[currentTrackName]; if (!track) return;
    const stepDur = 60 / track.bpm / 4;
    if (!(stepDur > 0)) return;                       // sicurezza: mai un passo nullo/negativo
    // Se siamo rimasti MOLTO indietro (il thread si e' bloccato mentre caricava il livello, o
    // un PC lento) RISINCRONIZZA saltando i passi persi, invece di rincorrerli uno a uno:
    // schedularli tutti puo' far avanzare `currentTime` piu' in fretta della schedulazione →
    // il while non finisce mai → PAGINA CONGELATA. Era il freeze allo "Start Run" (2026-07-18).
    if (nextStepTime < c.currentTime - 0.25) {
      const missed = Math.floor((c.currentTime - nextStepTime) / stepDur);
      curStep += missed;
      nextStepTime += missed * stepDur;
    }
    // Tetto rigido di passi per giro: rete di sicurezza contro qualsiasi rincorsa infinita.
    let guard = 0;
    while (nextStepTime < c.currentTime + 0.1 && guard++ < 32) {
      let when = nextStepTime;
      if ((curStep % 2) === 1) when += stepDur * (track.swing || 0);   // swing sui passi dispari
      scheduleStep(track, curStep, when);
      curStep++;
      nextStepTime += stepDur;
    }
  }

  function startMusic() {
    const c = ensure();
    if (!c || !musicOn || c.state !== 'running') return;   // si avvia solo ad audio sbloccato
    if (!currentTrackName) currentTrackName = desiredTrack || 'menu';
    if (schedTimer) return;                                // gia' in esecuzione
    curStep = 0; nextStepTime = c.currentTime + 0.08;
    musicFade.gain.cancelScheduledValues(c.currentTime);
    musicFade.gain.setValueAtTime(0.0001, c.currentTime);
    musicFade.gain.linearRampToValueAtTime(1, c.currentTime + 0.35);
    schedTimer = setInterval(schedTick, 25);
  }
  function stopMusic() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    if (swapTimer) { clearTimeout(swapTimer); swapTimer = null; }
  }

  // Cambia atmosfera con una dissolvenza (fade-out → cambio → fade-in).
  function setMusic(name) {
    if (!name || !SONGS[name]) return;
    desiredTrack = name;
    const c = ensure(); if (!c) return;
    if (!musicOn || c.state !== 'running' || !schedTimer) { currentTrackName = name; startMusic(); return; }
    if (name === currentTrackName) return;
    const t = c.currentTime;
    musicFade.gain.cancelScheduledValues(t);
    musicFade.gain.setValueAtTime(Math.max(0.0001, musicFade.gain.value), t);
    musicFade.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    if (swapTimer) clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      swapTimer = null;
      if (!ctx) return;
      currentTrackName = name; curStep = 0; nextStepTime = ctx.currentTime + 0.06;
      const t2 = ctx.currentTime;
      musicFade.gain.cancelScheduledValues(t2);
      musicFade.gain.setValueAtTime(0.0001, t2);
      musicFade.gain.linearRampToValueAtTime(1, t2 + 0.35);
    }, 370);
  }

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

  // ---------- Effetti sonori (tono scherzoso/gommoso, stratificati) ----------

  return {
    unlock,
    // volume / musica
    cycleVolume, volLevel, setVolume, getVolume,
    toggleMusic, musicEnabled, startMusic, stopMusic, setMusic,
    addAudioButton, addMusicButton,

    // colpo dello swab: un "whiff" leggero e arioso
    hit() {
      synth({ freq: jit(760), glideTo: 300, type: 'triangle', dur: 0.07, peak: 0.03, a: 0.003, d: 0.03, s: 0.2, r: 0.03 });
      noiseBurst({ dur: 0.05, peak: 0.02, type: 'highpass', freq: 2600 });
    },
    // cerume scheggiato: piccolo "tok" umido
    crack() {
      synth({ freq: jit(210, 0.06), glideTo: 105, type: 'square', dur: 0.08, peak: 0.05, a: 0.002, d: 0.05, s: 0.15, r: 0.03, filter: { type: 'lowpass', freq: 1800 } });
      noiseBurst({ dur: 0.04, peak: 0.02, type: 'lowpass', freq: 1200 });
    },
    // blocco distrutto: "splat" succoso a piu' strati
    smash() {
      noiseBurst({ dur: 0.24, peak: 0.1, type: 'lowpass', freq: 1400, to: 300, send: 0.18 });
      synth({ freq: jit(175, 0.05), glideTo: 55, type: 'sawtooth', dur: 0.22, peak: 0.06, a: 0.003, d: 0.08, s: 0.3, r: 0.08, filter: { type: 'lowpass', freq: 900 } });
      synth({ freq: jit(360, 0.06), glideTo: 150, type: 'triangle', dur: 0.12, peak: 0.03, a: 0.002, d: 0.05, s: 0.2, r: 0.05 });
    },
    // salto: "boing" comico verso l'alto
    jump() {
      synth({ freq: jit(300, 0.05), glideTo: jit(680, 0.05), type: 'square', dur: 0.13, peak: 0.045, detune: [-5, 6], a: 0.004, d: 0.05, s: 0.4, r: 0.05, filter: { type: 'lowpass', freq: 2400 } });
    },
    // scatto: whoosh d'aria
    dash() {
      noiseBurst({ dur: 0.17, peak: 0.05, type: 'highpass', freq: 1400, to: 3600, send: 0.15 });
      synth({ freq: 520, glideTo: 920, type: 'triangle', dur: 0.12, peak: 0.02, a: 0.004, d: 0.05, s: 0.3, r: 0.05 });
    },
    // colpito: "ahi" discendente
    hurt() {
      synth({ freq: jit(400, 0.04), glideTo: 120, type: 'sawtooth', dur: 0.22, peak: 0.07, a: 0.004, d: 0.06, s: 0.5, r: 0.08, filter: { type: 'lowpass', freq: 1600 }, send: 0.12 });
      noiseBurst({ dur: 0.08, peak: 0.02, type: 'lowpass', freq: 900 });
    },
    // nemico eliminato: si sgonfia con uno splat
    enemyDie() {
      synth({ freq: jit(240, 0.06), glideTo: 50, type: 'sawtooth', dur: 0.26, peak: 0.06, a: 0.003, d: 0.08, s: 0.35, r: 0.09, filter: { type: 'lowpass', freq: 1100 }, send: 0.12 });
      noiseBurst({ dur: 0.13, peak: 0.04, type: 'lowpass', freq: 800, to: 300 });
    },
    // sputo: "ptu!"
    spit() {
      synth({ freq: jit(620, 0.06), glideTo: 250, type: 'triangle', dur: 0.06, peak: 0.045, a: 0.002, d: 0.03, s: 0.2, r: 0.03 });
      noiseBurst({ dur: 0.06, peak: 0.03, type: 'bandpass', freq: 1500, q: 1.5 });
    },
    // getto di acqua e sapone: "pfff" pulito e arioso
    spray() {
      noiseBurst({ dur: 0.1, peak: 0.04, type: 'highpass', freq: 2400, to: 3600 });
      synth({ freq: 760, glideTo: 520, type: 'triangle', dur: 0.07, peak: 0.018, a: 0.003, d: 0.03, s: 0.2, r: 0.03 });
    },
    // cerume raccolto: "bloop" allegro
    pick() {
      synth({ freq: jit(500, 0.05), glideTo: jit(880, 0.05), type: 'sine', dur: 0.1, peak: 0.05, a: 0.004, d: 0.04, s: 0.4, r: 0.05, send: 0.1 });
      synth({ freq: jit(1000, 0.05), type: 'sine', dur: 0.05, peak: 0.02, a: 0.003, d: 0.03, s: 0.1, r: 0.02, when: (ctx ? ctx.currentTime + 0.05 : 0) });
    },
    // livello completato: piccola fanfara allegra (con un tocco di batteria)
    win() {
      const c = ensure(); const t = c ? c.currentTime : 0;
      const notes = ['C4', 'E4', 'G4', 'C5'];
      notes.forEach((n, i) => {
        synth({ freq: noteToFreq(n), type: 'square', dur: 0.2, peak: 0.06, detune: [-5, 6], a: 0.005, d: 0.05, s: 0.6, r: 0.1, when: t + i * 0.11, send: 0.14 });
      });
      if (c) { drumKick(t, sfxBus, 0.12); drumKick(t + 0.22, sfxBus, 0.12); drumSnare(t + 0.44, sfxBus, 0.1); }
    },
    // game over: trombetta triste discendente
    lose() {
      const c = ensure(); const t = c ? c.currentTime : 0;
      const notes = ['G3', 'F3', 'D3'];
      notes.forEach((n, i) => {
        synth({ freq: noteToFreq(n), type: 'sawtooth', dur: 0.24, peak: 0.07, detune: [-6, 5], a: 0.006, d: 0.06, s: 0.6, r: 0.12, when: t + i * 0.18, filter: { type: 'lowpass', freq: 1400 }, send: 0.16 });
      });
      synth({ freq: noteToFreq('C3'), glideTo: 90, type: 'sawtooth', dur: 0.5, peak: 0.06, a: 0.01, d: 0.1, s: 0.6, r: 0.2, when: t + 0.54, filter: { type: 'lowpass', freq: 1000 }, send: 0.16 });
    },
    // nemico che emerge dal terreno o cala dal soffitto: "splorch" gommoso che sale
    emerge(big) {
      synth({ freq: 70, glideTo: big ? 150 : 240, type: 'sawtooth', dur: 0.18, peak: big ? 0.08 : 0.05, a: 0.005, d: 0.06, s: 0.5, r: 0.07, filter: { type: 'lowpass', freq: big ? 700 : 1100 }, send: 0.12 });
      noiseBurst({ dur: 0.1, peak: 0.035, type: 'lowpass', freq: 600 });
    },
  };
})();
