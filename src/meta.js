// Progressione permanente (roguelike): salvata nel browser con localStorage.
// Persiste solo pochi dati: cerume in banca, miglior livello, n. run, sblocchi.
// Tutto in try/catch: se il salvataggio non e disponibile (es. apertura da
// file:// su alcuni browser) il gioco funziona lo stesso, semplicemente non
// ricorda tra un avvio e l'altro. Nell'app Android il salvataggio funziona.
window.Meta = (function () {
  const KEY = 'earwaxwar.meta.v1';

  function defaults() {
    return { bank: 0, bestLevel: 1, runs: 0, unlocks: {} };
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
