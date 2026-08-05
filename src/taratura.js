// taratura.js — MANOPOLE DI PROVA (2026-07-27, richiesta dell'utente).
//
// A cosa serve: i numeri del gioco (quanti nemici insieme, quanto fanno male, quanto dura la
// Corsa...) si giudicano solo giocando, e finora il giro era "l'utente prova sul telefono ->
// lo scrive -> io cambio il numero -> ricompilo l'APK -> lui riprova": mezz'ora buona per un
// singolo valore. Con questo pannello i numeri li gira LUI, sul telefono, mentre gioca.
//
// Come funziona: qui ci sono solo MOLTIPLICATORI (1 = gioco normale), salvati nel browser. Il
// gioco li legge nei pochi punti dove servono. Un giocatore che non apre mai il pannello ha
// tutti i valori a 1 e non si accorge di niente.
//
// ⚠️ PRIMA DI PUBBLICARE: basta mettere `CONFIG.PANNELLO_PROVA = false` in src/state.js. Da li'
// il pulsante sparisce da menu e pausa, e tutte le manopole tornano al valore normale — god-mode
// compreso — anche se nel telefono era rimasto salvato qualcosa da una prova precedente.
// Fatto cosi' invece di cancellare il pannello perche' serve ancora: i numeri del gioco si
// giudicano solo giocando, e rifarlo da capo a ogni giro di taratura non avrebbe senso.
window.Taratura = (function () {
  const KEY = 'earwaxwar.taratura.v1';

  // id: [predefinito, minimo, massimo, passo]  — l'ordine e' quello mostrato nel pannello.
  const CAMPI = {
    densita:      [1, 0.2, 3, 0.1],    // quanti nemici insieme
    velNemici:    [1, 0.3, 2.5, 0.1],  // velocita' dei nemici
    dannoNemici:  [1, 0.1, 3, 0.1],    // quanto fanno male
    vitaNemici:   [1, 0.2, 3, 0.1],    // quanta vita hanno
    vitaPg:       [1, 0.5, 5, 0.25],   // vita del personaggio
    dannoPg:      [1, 0.5, 5, 0.25],   // danno del personaggio (mischia e getto)
    durataCorsa:  [1, 0.5, 3, 0.1],    // tempo concesso nei livelli a Corsa
    cerume:       [1, 0.2, 4, 0.1],    // cerume raccolto
    rimbalzo:     [1, 0.5, 2, 0.1],    // spinta del salto sui nemici
    fpsCerumino:  [8, 2, 20, 1],       // fotogrammi al secondo della strisciata (NON e' un moltiplicatore)
  };

  // ⚠️ Si legge CONFIG QUI DENTRO e non una volta sola all'avvio: taratura.js viene caricato
  // PRIMA di state.js (vedi index.html), quindi al momento in cui questo file viene letto
  // `window.CONFIG` non esiste ancora. Al primo uso vero si', perche' il gioco parte dopo.
  function acceso() {
    return !window.CONFIG || window.CONFIG.PANNELLO_PROVA !== false;
  }

  function defaults() {
    const d = {};
    Object.keys(CAMPI).forEach((k) => { d[k] = CAMPI[k][0]; });
    d.godmode = false;
    return d;
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      const d = defaults();
      Object.keys(d).forEach((k) => { if (typeof data[k] === typeof d[k]) d[k] = data[k]; });
      return d;
    } catch (e) { return defaults(); }
  }

  let stato = load();

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(stato)); } catch (e) { /* niente */ }
  }

  return {
    CAMPI: CAMPI,
    get() { return stato; },
    // Valore di una manopola. Il gioco chiama SEMPRE questo, mai stato.x: se un giorno una
    // manopola sparisce, qui torna il predefinito invece di far diventare NaN mezzo gioco.
    v(id) {
      const c = CAMPI[id];
      if (!c) return 1;
      // Pannello spento (versione da pubblicare): vale il valore normale, qualunque cosa sia
      // rimasta salvata nel telefono da una prova precedente. Cosi' spegnere l'interruttore
      // basta davvero: non serve anche ricordarsi di rimettere le manopole a posto.
      if (!acceso()) return c[0];
      const x = stato[id];
      return (typeof x === 'number' && isFinite(x)) ? x : c[0];
    },
    set(id, valore) {
      const c = CAMPI[id]; if (!c) return;
      stato[id] = Math.round(Phaser.Math.Clamp(valore, c[1], c[2]) * 100) / 100;
      save();
      return stato[id];
    },
    passo(id) { return CAMPI[id] ? CAMPI[id][3] : 0.1; },
    godmode() { return acceso() && !!stato.godmode; },
    setGodmode(on) { stato.godmode = !!on; save(); },
    // Vero se qualcosa e' stato toccato: serve solo a mostrare l'avviso "taratura attiva".
    modificata() {
      return acceso() && (Object.keys(CAMPI).some((k) => this.v(k) !== CAMPI[k][0]) || !!stato.godmode);
    },
    // Lo leggono menu e pausa per decidere se mostrare il pulsante.
    acceso,
    reset() { stato = defaults(); save(); },
  };
})();
