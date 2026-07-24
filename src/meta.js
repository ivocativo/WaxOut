// Progressione permanente (roguelike): salvata nel browser con localStorage.
// Persiste solo pochi dati: cerume in banca, miglior livello, n. run, sblocchi.
// Tutto in try/catch: se il salvataggio non e disponibile (es. apertura da
// file:// su alcuni browser) il gioco funziona lo stesso, semplicemente non
// ricorda tra un avvio e l'altro. Nell'app Android il salvataggio funziona.
window.Meta = (function () {
  const KEY = 'earwaxwar.meta.v1';

  function defaults() {
    // infezioneMax = grado di infezione PIU' ALTO superato (round A, A.5). -1 = mai vinto: si puo'
    // giocare solo al grado 0; vincere al grado N lo porta a max(N, attuale), sbloccando N+1.
    return { bank: 0, bestLevel: 1, runs: 0, wins: 0, infezioneMax: -1, unlocks: {} };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      const d = defaults();
      return {
        bank: data.bank || 0,
        bestLevel: data.bestLevel || 1,
        runs: data.runs || 0,
        wins: data.wins || 0,   // round A, A.1: run PORTATE A TERMINE (non solo giocate)
        infezioneMax: (typeof data.infezioneMax === 'number') ? data.infezioneMax : -1,
        unlocks: Object.assign({}, data.unlocks || {}),
      };
    } catch (e) { return defaults(); }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* niente */ }
  }

  let state = load();

  return {
    get() { return state; },
    reload() { state = load(); return state; },

    // A fine run: incassa il cerume raccolto e aggiorna i record.
    bankRun(wax, levelReached) {
      state.bank += Math.max(0, wax | 0);
      state.runs += 1;
      if (levelReached > state.bestLevel) state.bestLevel = levelReached;
      save();
      return state;
    },

    unlockLevel(id) { return state.unlocks[id] || 0; },

    // Vittoria della run (round A, A.1): separato da bankRun perche' una run puo' finire per
    // morte (bankRun da solo) o per vittoria (bankRun + recordWin). clearedTier = grado di
    // infezione a cui si e' vinto (round A, A.5): se supera il record, sblocca il grado dopo.
    recordWin(clearedTier) {
      state.wins += 1;
      const tier = clearedTier | 0;
      if (tier > state.infezioneMax) state.infezioneMax = tier;
      save();
      return state;
    },

    // Grado di infezione PIU' ALTO selezionabile: uno sopra il record superato, con tetto a
    // INFEZIONE_MAX. Prima della prima vittoria (infezioneMax = -1) si puo' solo il grado 0.
    infezioneUnlocked() {
      return Math.min((state.infezioneMax | 0) + 1, window.CONFIG.INFEZIONE_MAX);
    },

    spend(amount) {
      if (state.bank < amount) return false;
      state.bank -= amount;
      save();
      return true;
    },

    setUnlock(id, level) { state.unlocks[id] = level; save(); },

    // Solo per test/debug: azzera tutto.
    resetAll() { state = defaults(); save(); return state; },
  };
})();
