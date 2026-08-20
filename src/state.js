// Waxout — stato globale di gioco e costanti condivise.
// Niente moduli ES: usiamo variabili globali (window.*) così tutto gira da file://.

window.CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  GRAVITY: 1100,
  // Accelerazione/decelerazione del movimento orizzontale (0..1, quota di avvicinamento alla
  // velocita' bersaglio ad ogni frame — piu' alto = piu' reattivo/"scattante", piu' basso =
  // piu' morbido/"pesante"). A terra piu' reattiva, in aria piu' "molle" (meno controllo
  // diretto da saltati, tipico dei platform). Il dash resta ISTANTANEO (non passa da qui).
  MOVE_ACCEL_GROUND: 0.3,
  MOVE_ACCEL_AIR: 0.15,
  // "Juice" procedurale: schiacciamento/allungamento del personaggio (jx/jy sono moltiplicatori
  // di scala che partono da un valore spostato da 1 e decadono verso 1 ogni frame). SPRING =
  // quanto in fretta torna a riposo (piu' alto = piu' veloce/scattante il rimbalzo); gli altri
  // sono l'ampiezza massima dello spostamento per ciascun evento.
  JUICE_SPRING: 0.2,
  JUICE_LAND: 0.22,
  JUICE_JUMP: 0.14,
  JUICE_TURN: 0.08,
  JUICE_HIT: 0.25,
  GROUND_H: 180,        // altezza del "pavimento" del condotto (alto: tiene l'azione
                        // sopra le dita sui comandi touch e riempie il canale)
  BLOCK: 32,            // lato di un blocco del muro (px display)
  PIXEL_SCALE_PLAYER: 3,
  PIXEL_SCALE_ENEMY: 3,
  // Manopola globale sul cerume guadagnato AUTOMATICAMENTE (pulizia del muro + raccolta
  // pickup, incluse le palline lasciate dai nemici morti): scala TUTTO il guadagno passivo,
  // cosi' l'economia si tara da un punto solo. Misurata 2026-07-22 (vedi ROADMAP A.4b): SANA,
  // non toccare i prezzi UNLOCKS/BLUEPRINTS, e' questa l'unica manopola da girare se mai servisse.
  // ⚠️ ABBASSATA da 0,55 a 0,385 (-30%) dopo il playtest del 2026-08-02, su richiesta
  // dell'utente. Conseguenza da tenere d'occhio: la misura dell'economia (ROADMAP A.4b)
  // diceva ~6-10 run normali per comprare tutto; con -30% diventano circa 9-14. Restano
  // dentro la finestra sana per il genere, ma se la progressione risultasse lenta questa
  // e' la prima manopola da rialzare (una sola, non i dodici prezzi).
  WAX_GAIN: 0.385,
  // ⚠️ INTERRUTTORE DEL PANNELLO DI PROVA. A `false` il pannello delle manopole sparisce dal
  // menu e dalla pausa, e TUTTE le manopole tornano al loro valore normale — compreso il
  // god-mode, che resta spento. E' l'unica riga da cambiare per la versione da pubblicare:
  // il pannello da' vita infinita e cerume gratis, non deve arrivare ai giocatori.
  // Si spegne QUI e non cancellando il pannello perche' serve ancora a tarare il gioco: i
  // numeri si giudicano solo giocando, e rifarlo da capo a ogni giro non avrebbe senso.
  PANNELLO_PROVA: true,
  // EFFETTO METABALL SUL CERUME: lo shader WebGL che fonde i globi in una massa liquida.
  // ⚠️ E' il principale sospettato del FREEZE allo Start Run sul PC dell'utente (aperto dal
  // 2026-07-18, mai riproducibile altrove). Si spegne in due modi:
  //   · da qui, mettendo `false` — vale per tutti;
  //   · aggiungendo `?nofx` all'indirizzo del gioco — vale per quella sola apertura, e serve
  //     a PROVARE in dieci secondi se e' lui il colpevole, senza ricompilare niente.
  // Senza l'effetto il cerume si vede a globi separati invece che come massa unica: piu'
  // brutto, ma il gioco funziona identico.
  EFFETTO_CERUME: true,
  // GIRO DI BILANCIAMENTO 2026-07-29 (playtest: "ai livelli alti diventa estenuante pulire il
  // cerume, ci vuole troppo tempo"). Tre manopole invece di ritoccare venti numeri sparsi:
  DANNO_PG: 1.5,          // quanto piu' forte picchia il giocatore (mischia e getto)
  VITA_CERUME: 0.8,       // quanto e' piu' fragile ogni blocco di cerume
  VITA_NEMICI: 0.8,       // quanto sono piu' fragili i nemici
  // GIRO DEL PLAYTEST ROUND 5 (2026-08-02), chiesto dall'utente.
  DANNO_NEMICI: 0.7,      // quanto meno male fanno i nemici (contatto e proiettili)
  // ECONOMIA (2026-08-18, scelta dell'utente): pulire il cerume NON da' piu' moneta — si
  // guadagna solo raccogliendo i pallini. Misurato prima del cambio: pulire un livello intero
  // valeva 54 (liv.1), 123 (liv.5), 175 (liv.10), mentre un nemico ne vale ~2: il cerume era la
  // quasi totalita' del guadagno, e senza compensare il negozio sarebbe diventato decorativo.
  // Di qui il moltiplicatore sul bottino dei nemici. ⚠️ Da rileggere col playtest: e' il numero
  // che decide quanto ci si mette a comprare il primo potenziamento.
  NEMICI_CERUME: 3,       // quanto vale il pallino lasciato da un nemico (1 = com'era prima)
  // RIMESCOLA le tre carte a fine livello: COSTO CHE CRESCE COL LIVELLO (base x livello).
  // ⚠️ LA PRIMA STIMA ERA SBAGLIATA E VA RACCONTATO PERCHE'. Avevo calcolato ~3.170 di cerume
  // fino al livello 10 e messo un costo fisso di 2.200; l'utente ha giudicato la cifra esagerata
  // e aveva ragione. Quel calcolo poggiava su due assunzioni non verificate: 50 secondi a livello
  // e soprattutto UCCIDERE OGNI NEMICO CHE COMPARE. La seconda e' irreale — molti nemici nascono
  // dietro, o li si supera — e da sola gonfia il totale di due o tre volte.
  // Ancoraggio migliore, preso dal gioco e non da un'ipotesi: in modo CORSA il gioco considera
  // 31-50 secondi (secondo il livello) sufficienti ad attraversare un condotto. Con una cadenza
  // di comparsa di 2-3 secondi fanno 20-30 nemici per livello, di cui se ne uccide forse due
  // terzi: ~110-360 di cerume a livello, cioe' 1.200-2.000 fino al livello 10, non 3.170.
  // Il costo cresce col livello perche' cresce il guadagno: cosi' "quanto costa" resta piu' o
  // meno costante in numero di livelli di gioco. A livello 1 costa meno di mezzo livello di
  // raccolto (le prime carte contano molto: giusto poterle rimescolare); al 10 ne costa due.
  RIMESCOLA_COSTO_BASE: 60,   // costo = questo x il livello attuale
  // RAFFICA RADIALE (abilita' impilabile, playtest round 5): ogni tot parte una corona di
  // palline tutt'attorno. Il danno e' RIDOTTO apposta: e' un'arma che spara da sola mentre
  // pensi ad altro, se picchiasse quanto il getto renderebbe inutile mirare.
  // BOMBA DI CERUME (leggendario): spazza lo schermo. ⚠️ Non toglie il colpo normale ne' la
  // cadenza — la lezione delle armi dice che toccare la cadenza rende tutto un malus. E' un
  // gesto A PARTE con una ricarica lunga, cosi' resta un momento e non un'abitudine.
  BOMBA_RICARICA: 30000,  // ms di GIOCO fra una bomba e l'altra (menu e pause non contano)
  BOMBA_DANNO: 4,         // quante volte il danno del corpo a corpo, su tutto lo schermo
  BOMBA_ONDA: 520,        // ms che l'onda impiega ad attraversare lo schermo
  RADIALE_OGNI: 2600,     // ms fra una raffica e l'altra
  RADIALE_DANNO: 0.55,    // quanto vale una pallina radiale rispetto a una del getto
  RADIALE_PER_PESCA: 4,   // quante direzioni aggiunge ogni carta pescata
  DURATA_CORSA: 0.9,      // -10% al tempo dei livelli CORSA
  // CORPO A CORPO (playtest 2026-08-03): l'animazione del colpo non si faceva in tempo a
  // vedere. Il colpo rallenta perche' il gesto abbia il tempo di leggersi, e in cambio
  // arriva un po' piu' lontano — cosi' il corpo a corpo non ci perde in resa.
  // ⚠️ RILEGGERE QUESTO NUMERO DOPO IL PROSSIMO PLAYTEST. Il 2026-08-09 si e' scoperto che
  // l'animazione del colpo NON ESISTEVA: il suo foglio (hero_melee) era il 33esimo file da
  // caricare e Phaser ne scaricava 32, quindi restava in coda per sempre senza dare errore.
  // Il gesto non "si faceva in tempo a vedere" perche' non c'era proprio. Il rallentamento qui
  // sotto e' nato per rimediare a un difetto che non era quello, e ora potrebbe far sembrare il
  // corpo a corpo fiacco senza motivo. Si prova da subito col cursore "mischia" del pannello.
  MISCHIA_CADENZA: 1.35,  // quanto piu' lento e' un colpo (piu' alto = piu' lento)
  MISCHIA_PORTATA: 1.15,  // quanto piu' lontano arriva, per compensare
  // Da questo livello in poi il cerume da pulire cala: un livello lungo il triplo non deve
  // chiedere il triplo del tempo di pulizia, o la parte finale della run diventa una corvee.
  // Quanta vita vale una "pallina" di cura: sia quelle raccolte a terra sia il recupero
  // automatico a fine livello (2026-07-29). Un numero solo, cosi' le due cose non divergono.
  // ASSEDIO (2026-07-31): tempo scaduto senza quota = una botta e un supplementare, non la
  // fine della partita. La penalita' e' una FRAZIONE della vita massima, non un numero fisso,
  // cosi' resta significativa anche a chi ha comprato tanti Cuori Extra.
  SIEGE_PENALITA: 0.2,
  SIEGE_SUPPLEMENTARE: 15000,
  CURA_PICKUP: 14,
  MENO_CERUME_DA: 8,
  MENO_CERUME_PASSO: 0.055,   // -5,5% di membrane per ogni livello oltre la soglia (min 60%)

  // Quanti livelli compongono una RUN COMPLETA (round A, A.1): raggiunto e superato questo
  // livello (che e' sempre un boss, essendo multiplo di 5) la run e' VINTA -> VictoryScene invece
  // che al livello successivo. Confermato dal playtest utente 2026-07-22: ~20 minuti a 15 livelli
  // quando si sopravvive, dentro la finestra 20-30 min indicata dalle fonti (vedi HANDOFF.md).
  RUN_LEVELS: 15,

  // DIFFICOLTA' CRESCENTE "Infezione" (round A, A.5): dopo aver vinto la run si sblocca il grado
  // successivo, opzionale, scelto nel menu prima di partire. Ogni grado rende i nemici piu' duri
  // E aumenta la ricompensa (rischio<->premio, il meccanismo di ritenzione piu' forte del genere:
  // "Calore" di Hades, Ascensioni di Slay the Spire). INFEZIONE_MAX = grado massimo raggiungibile.
  INFEZIONE_MAX: 5,
  // Fattori per GRADO di infezione (moltiplicati: al grado N valgono ^N... no: 1 + fattore*N).
  // Tenuti bassi apposta: 5 gradi devono essere DAVVERO difficili ma senza muri improvvisi.
  INFEZIONE: {
    enemyHp:   0.15,   // +15% vita nemici per grado
    enemySpeed: 0.07,  // +7% velocita' per grado
    enemyDmg:  0.10,   // +10% danno per grado
    waxReward: 0.20,   // +20% cerume per grado (l'incentivo a salire)
  },

  // Palette a tema "orecchio / cerume / sporco"
  COLORS: {
    bgTop: 0xe9b89a,
    bgBottom: 0xc6876a,
    canalShade: 0x9c5f48,
    eardrum: 0xd98a86,
    ground: 0xb87a5c,
    groundDark: 0x8f5a40,
    waxSoft: 0xdca842,
    waxSoftLight: 0xf2c861,
    waxSoftDark: 0xa9781f,
    waxHard: 0xb98322,
    waxHardLight: 0xd6a23c,
    waxHardDark: 0x7d5512,
    dirt: 0x7a5a3a,
    dirtLight: 0x9a7650,
    dirtDark: 0x4f3a24,
    outline: 0x14161f,
    hpGood: 0x4caf50,
    hpBad: 0xe74c3c,
  },
};

// Vero se l'effetto metaball sul cerume va acceso. Sta qui, e non dentro alla scena, perche' lo
// deve poter chiedere anche `game_livello.js`, che viene caricato prima.
// ⚠️ `?nofx` nell'indirizzo lo spegne per quella sola apertura: serve a capire in dieci secondi
// se e' lui la causa del freeze sul PC, senza ricompilare e senza toccare il codice.
window.effettoCerumeAcceso = function () {
  try {
    if (String(window.location.search).indexOf('nofx') !== -1) return false;
  } catch (e) { /* niente indirizzo (doppio clic sul file): si prosegue */ }
  return window.CONFIG.EFFETTO_CERUME !== false;
};

// Potenziamenti PERMANENTI del negozio (roguelike meta-progression).
// 'per' = bonus per ogni livello acquistato; base/step = costo (in cerume) del
// prossimo acquisto = base + step * livelloAttuale; max = quante volte si compra.
// ⚠️ TETTI CHE CRESCONO COL GRADO DI INFEZIONE SUPERATO (2026-08-19).
// `max` e' il tetto DI PARTENZA; `perInfezione` e' quanti livelli in piu' si sbloccano per ogni
// grado di infezione gia' battuto (vedi Meta.tettoSblocco). Chi non ha mai vinto compra fino al
// tetto base; chi ha battuto il grado 5 arriva al massimo assoluto.
// E' la richiesta dell'utente: il gioco diventa piu' difficile, quindi deve diventare possibile
// potenziarsi di piu' — ma quel margine te lo devi guadagnare, se no e' solo un numero piu' alto.
// ⚠️ Prima versione sbagliata: li avevo alzati e basta, disponibili da subito. L'utente se n'e'
// accorto chiedendo "devono sbloccarsi solo all'aumentare dell'infezione, e' cosi'?". Non lo era.
//
// L'UGELLO POTENZIATO fa eccezione e non e' legato all'infezione: non e' un premio per veterani,
// e' la CORREZIONE di uno squilibrio che c'e' fin dal primo giro (il danno del getto e' fisso a
// 24 mentre la vita dei nemici cresce col livello). Legarlo all'infezione vorrebbe dire lasciare
// il difetto in piedi proprio per chi non ha ancora vinto. Il suo tetto e' alto e basta.
window.UNLOCKS = {
  hp:    { per: 20, base: 45, step: 35, max: 10, perInfezione: 1, name: 'Cuore Extra',   effect: '+20 HP a inizio run' },
  dmg:   { per: 4,  base: 55, step: 45, max: 10, perInfezione: 1, name: 'Lama Affilata', effect: '+4 danno a inizio run' },
  speed: { per: 15, base: 40, step: 30, max: 8,  perInfezione: 1, name: 'Stivali Molla', effect: '+15 velocita a inizio run' },
  // ⚠️ `per` E' UNA FRAZIONE, non un numero fisso: +8% di danno del getto per livello comprato.
  // Prezzo piu' alto degli altri (base 70, passo 55) perche' l'effetto e' moltiplicativo e non
  // si spegne mai: a 12 livelli sono +96%, cioe' il getto quasi raddoppia.
  getto: { per: 0.08, base: 70, step: 55, max: 12, perInfezione: 0, name: 'Ugello Potenziato', effect: '+8% danno del getto per livello' },
  djump: { per: 1,  base: 200, step: 0, max: 1,  perInfezione: 0, name: 'Doppio Salto Innato', effect: 'Inizi ogni run col doppio salto' },
};

// PROGETTI (blueprint): sblocchi PERMANENTI una-tantum che aggiungono ABILITA' NUOVE al
// mazzo delle run (compaiono come carte all'UpgradeScene solo dopo essere state sbloccate
// qui, col cerume in banca). A differenza di UNLOCKS non danno bonus di statistica: danno
// CONTENUTO nuovo. 'ability' = id dell'abilità (deve combaciare con UpgradeScene.ALL).
window.BLUEPRINTS = {
  magnet:    { cost: 120, ability: 'magnet'    },
  blast:     { cost: 220, ability: 'blast'     },
  splash:    { cost: 320, ability: 'splash'    },
  companion: { cost: 500, ability: 'companion' },
  backshot:  { cost: 260, ability: 'backshot'  },
  rage:      { cost: 280, ability: 'rage'      },
  stunshot:  { cost: 300, ability: 'stunshot'  },
  slam:      { cost: 450, ability: 'slam'      },
};

// LEGGENDARI (2026-08-19, richiesta dell'utente): sblocchi carissimi che si comprano SOLO dopo
// aver battuto un certo grado di infezione. Finche' non lo si e' battuto la voce resta col punto
// interrogativo, e questo e' il punto di tutto il meccanismo: deve far venire voglia di salire di
// difficolta' per vedere cosa c'e' dietro.
// ⚠️ `infezione` = il grado da SUPERARE, non da sbloccare. Il negozio confronta con
// Meta.gradiSuperati(): con 0 gradi battuti si vede il primo leggendario ma non gli altri.
// ⚠️ IL PUNTO INTERROGATIVO DICE IL GRADO RICHIESTO, non solo che esiste qualcosa. Un mistero
// completo incuriosisce una volta; un obiettivo con un numero sopra si insegue.
// ⚠️ COSA DEVE ESSERE UN LEGGENDARIO, dopo la lezione delle armi (vedi HANDOFF §Lezioni di
// bilanciamento): un MODO DIVERSO di combattere, non "piu' danno". In questo gioco la cadenza
// domina, quindi un leggendario che tocca i numeri e' un potenziamento come gli altri; uno che
// cambia comportamento e' un giocattolo nuovo.
window.LEGGENDARI = {
  bomba: { cost: 1800, ability: 'bomba', infezione: 0 },
};

// ARSENALE (2026-07-27, richiesta dell'utente). Ogni "arma" e' in realta' un KIT COMPLETO:
// cambia INSIEME il colpo ravvicinato e il getto. Il motivo e' che il gioco ha UN SOLO tasto
// d'attacco, che sceglie da solo in base alla distanza (mazza da vicino, getto da lontano):
// due mezze armi separate non si sentirebbero, un kit invece cambia davvero come si gioca.
// Si SBLOCCANO col cerume in banca (ArmiScene) e si SCEGLIE quale portarsi a ogni run — non si
// sostituiscono a vicenda, altrimenti le vecchie diventerebbero spazzatura e si perderebbe la
// varieta' (e' il buco n.3 della ricerca sul genere: vedi HANDOFF.md §Principi di design).
//
// I numeri di danno sono MOLTIPLICATORI sulle statistiche di base (che gia' comprendono i
// potenziamenti comprati al negozio): cosi' un kit resta bilanciato a qualunque punto della
// progressione, invece di diventare inutile appena si compra "Lama Affilata".
// `blocca` = abilita' che il kit da' gia' di suo: vanno segnate come possedute a inizio run,
// se no la carta corrispondente continuerebbe a uscire all'UpgradeScene senza dare niente.
// `tex` sono ancora le texture VECCHIE (disegnate a codice): l'arte nuova e' il passo dopo,
// si e' deciso di provare prima le meccaniche per non disegnare armi che poi si buttano.
window.ARMI = [
  {
    id: 'fioc', cost: 0,
    mischia: { tex: 'swab',    portata: 50, altezza: 30, cadenza: 360, danno: 1.00 },
    getto:   { tex: 'sprayer', danno: 1.00, cadenza: 340, palline: 1, gittata: 850 },
  },
  {
    // Picchia duro da vicino, ma lo spruzzo e' fiacco: premia chi sta addosso ai nemici.
    id: 'martello', cost: 240,
    mischia: { tex: 'hammer',  portata: 64, altezza: 46, cadenza: 520, danno: 1.45, fermo: 95 },
    getto:   { tex: 'sprayer', danno: 0.70, cadenza: 430, palline: 1, gittata: 850 },
  },
  {
    // Colpetti rapidissimi a portata cortissima: piu' danno al secondo del coton fioc, ma devi
    // stare incollato al nemico — e incollarsi costa vita.
    id: 'pinzette', cost: 300,
    mischia: { tex: 'swab',    portata: 36, altezza: 26, cadenza: 165, danno: 0.58, fermo: 45 },
    getto:   { tex: 'sprayer', danno: 0.80, cadenza: 300, palline: 1, gittata: 850 },
  },
  {
    // Un colpo secco che fa molto male e PERFORA, ma lentissimo: arma da mira, non da panico.
    id: 'idro', cost: 380,
    mischia: { tex: 'swab',    portata: 46, altezza: 30, cadenza: 400, danno: 0.65 },
    getto:   { tex: 'sprayer', danno: 2.20, cadenza: 640, palline: 1, gittata: 950, perfora: true },
  },
  {
    // Sventaglia tre sbuffi deboli a raffica e ARRIVA POCO LONTANO (gittata dimezzata): pulisce
    // il cerume in fretta e attira i pickup, ma contro i nemici bisogna avvicinarsi.
    id: 'pompa', cost: 460,
    mischia: { tex: 'swab',    portata: 50, altezza: 30, cadenza: 330, danno: 0.85 },
    // 0.32 e non 0.42: a raffica di tre, da vicino le tre palline colpiscono LO STESSO nemico, e a
    // 0.42 il danno al secondo era piu' del doppio di ogni altro kit (misurato: 111 contro 47).
    getto:   { tex: 'sprayer', danno: 0.32, cadenza: 230, palline: 3, gittata: 380, calamita: true },
    blocca: ['magnet'],   // la calamita e' inclusa nel kit
  },
];

// Kit attualmente in mano (durante la run). Fuori dalla partita ripiega sul kit base.
window.armaCorrente = function () {
  const id = (window.GameState && window.GameState.player && window.GameState.player.arma) || 'fioc';
  return window.ARMI.find((a) => a.id === id) || window.ARMI[0];
};

// MODIFICATORI di livello (mutatori, stile Hades/Nuclear Throne): una regola casuale
// annunciata a inizio livello che cambia le regole di QUELLA partita. Danno varieta'
// combinatoria a costo minimo: ognuno regola solo parametri gia' esistenti (velocita'/HP/
// cerume dei nemici, gravita', HP del cerume). `apply(scene)` imposta i campi mut* letti
// dal gioco. `color` per il banner, `id` per la chiave i18n (mut_<id>).
window.MUTATORS = [
  { id: 'haste',    color: '#ff8f5a', apply(s) { s.mutEnemySpeed = 1.4; s.mutEnemyWax = 1.5; } },
  { id: 'horde',    color: '#9be870', apply(s) { s.mutMaxEnemies = 3; s.mutEnemyHp = 0.6; } },
  { id: 'armored',  color: '#8fd0ff', apply(s) { s.mutEnemyHp = 1.7; s.mutEnemyWax = 1.3; } },
  { id: 'lowgrav',  color: '#c9a0ff', apply(s) { s.physics.world.gravity.y = Math.round(window.CONFIG.GRAVITY * 0.55); } },
  { id: 'bonanza',  color: '#ffd166', apply(s) { s.mutWaxMult = 2; } },
  { id: 'thickwax', color: '#e0a83a', apply(s) { s.mutWaxHp = 1.7; } },
  { id: 'quake',    color: '#e0a83a', apply(s) { s.mutQuake = true; s.startWaxCollapseEvent(); } },
  // Nuovi (2026-07-26, richiesta varieta'): riusano i moltiplicatori mut* gia' esistenti.
  { id: 'glass',    color: '#7fe3ff', apply(s) { s.mutEnemyHp = 0.45; s.mutEnemyDmg = 1.5; } },   // fragili ma tosti
  { id: 'frenzy',   color: '#ff7bd5', apply(s) { s.mutMaxEnemies = 3; s.mutEnemyWax = 1.5; } },    // tanti + piu' cerume
  { id: 'berserk',  color: '#ff5a5a', apply(s) { s.mutEnemySpeed = 1.6; s.mutEnemyDmg = 1.4; s.mutMaxEnemies = -1; } },  // pochi ma feroci
  { id: 'ironwax',  color: '#b0b8c0', apply(s) { s.mutWaxHp = 2.3; s.mutWaxMult = 1.6; } },        // cerume durissimo ma prezioso
];

// EVENTI CASUALI di livello (indipendenti dai mutatori, possono capitare insieme): a
// differenza dei mutatori (regolano solo numeri) qui parte una MECCANICA a tempo, gestita da
// metodi dedicati in GameScene. `apply(scene)` avvia l'evento; `color` per il banner, `id`
// per la chiave i18n (usata dai singoli eventi per i propri messaggi).
window.EVENTS = [
  { id: 'goldfugitive', color: '#ffd700', apply(s) { s.startGoldFugitiveEvent(); } },
  { id: 'swarmrush', color: '#9be870', apply(s) { s.startSwarmRushEvent(); } },
];

// CARATTERE COMICO: battute brevi in un fumetto sopra il personaggio (vedi GameScene.maybeSpeech
// / showSpeech). Ogni voce e' una chiave i18n (speech_<categoria>_<n>, testo in EN+IT in i18n.js).
// Categorie: inizio livello, uccisione nemico, colpo subito, comparsa del boss.
window.SPEECH = {
  start: ['speech_start_1', 'speech_start_2', 'speech_start_3', 'speech_start_4'],
  kill: ['speech_kill_1', 'speech_kill_2', 'speech_kill_3', 'speech_kill_4'],
  hit: ['speech_hit_1', 'speech_hit_2', 'speech_hit_3', 'speech_hit_4'],
  boss: ['speech_boss_1', 'speech_boss_2', 'speech_boss_3', 'speech_boss_4'],
};

// EVOLUZIONI (stile Vampire Survivors): se possiedi ENTRAMBE le abilità di `needs`, tra le
// carte di fine livello può comparire l'EVOLUZIONE (`id`), che fonde le due in una versione
// potenziata. `id` funge anche da chiave i18n (up_<id>_name/_desc, ability_<id>) e da voce
// in ownedAbilities (una volta presa non ricompare). Meccaniche agganciate in GameScene.
window.EVOLUTIONS = [
  { id: 'evo_blade',  needs: ['pierce', 'spread'],       apply: (s) => { s.evoPierceAll = true; s.jetDamage += 6; } },
  { id: 'evo_toxic',  needs: ['splash', 'corrosive'],    apply: (s) => { s.evoToxic = true; } },
  { id: 'evo_magnet', needs: ['magnet', 'greed'],        apply: (s) => { s.evoMagnet = true; s.waxMult += 0.5; } },
  { id: 'evo_swarm',  needs: ['companion', 'homing'],    apply: (s) => { s.evoSwarm = true; } },
];

// Stato di progressione DELLA RUN corrente (azzerato a ogni nuova run).
window.GameState = {
  level: 1,
  // ⚠️ CRONOMETRO DEL TEMPO GIOCATO DAVVERO, in millesimi. Non si puo' usare `scene.time.now`
  // per le ricariche lunghe: quello si AZZERA a ogni livello (la scena si ricrea), quindi una
  // ricarica avviata al livello 3 sarebbe gia' scaduta al livello 4 — o non scadrebbe mai.
  // Qui si somma `delta` dentro update(), che gira SOLO mentre si gioca: i menu, la pausa e
  // le schermate fra un livello e l'altro non contano, che e' esattamente quello che serve.
  tempoDiGioco: 0,
  wax: 0,
  player: null,
  ownedAbilities: [],   // es. 'doublejump', 'dash', 'hammer'
  // Scelta del percorso (round A, A.3): scritta da DoorScene, letta e CONSUMATA (azzerata subito
  // dopo) da GameScene.create(). null/assente = comportamento a sorteggio di sempre (livello 1,
  // o livelli boss che non passano mai da una porta).
  prossimoLivello: null,
  // Istante di inizio RUN (Date.now(), non l'orologio di gioco: serve per il tempo REALE
  // trascorso, mostrato in VictoryScene). E' l'unico punto del codice di gameplay che tocca
  // l'orologio di sistema.
  runStartAt: 0,
  // Grado di INFEZIONE scelto per questa run (round A, A.5). NON viene azzerato da reset(): e' una
  // SCELTA di difficolta' che deve restare quando si fa "Nuova run" dopo morte/vittoria (si cambia
  // solo dal menu). 0 = base. Lo imposta MenuScene.begin().
  infezione: 0,

  newPlayer() {
    // Applica i potenziamenti permanenti acquistati al negozio.
    const u = window.Meta ? window.Meta.get().unlocks : {};
    const lv = (id) => u[id] || 0;
    const U = window.UNLOCKS;
    // MANOPOLE DI PROVA (src/taratura.js): a 1 (predefinito) non cambiano niente.
    const TP = window.Taratura ? window.Taratura.v('vitaPg') : 1;
    const TD = window.Taratura ? window.Taratura.v('dannoPg') : 1;
    const maxHp = Math.round((100 + lv('hp') * U.hp.per) * TP);
    // KIT scelto nell'Arsenale (window.ARMI). I moltiplicatori si applicano DOPO i potenziamenti
    // comprati al negozio, cosi' il carattere del kit si sente sempre allo stesso modo.
    // ARSENALE CHIUSO (2026-07-29): finche' il pulsante non c'e' nel menu, si gioca sempre col
    // kit base. La riga sotto e' l'unico interruttore da togliere per riaprirlo.
    const scelta = 'fioc';
    const arma = (window.ARMI || []).find((a) => a.id === scelta) || (window.ARMI || [{}])[0] || {};
    const M = arma.mischia || { cadenza: 360, danno: 1 };
    const G = arma.getto || { cadenza: 340, danno: 1, palline: 1, gittata: 850 };
    return {
      maxHp: maxHp,
      hp: maxHp,
      arma: arma.id || 'fioc',   // kit in mano: lo leggono meleeSwing/fireJet via armaCorrente()
      damage: Math.round((26 + lv('dmg') * U.dmg.per) * M.danno * TD * window.CONFIG.DANNO_PG),
      moveSpeed: 220 + lv('speed') * U.speed.per,
      jumpVelocity: 560,
      attackCooldown: Math.round(M.cadenza * window.CONFIG.MISCHIA_CADENZA),   // ms tra una bastonata e l'altra
      attackRange: 1,        // moltiplicatore portata corpo a corpo
      // Arma a distanza: getto di acqua e sapone (pulisce il cerume e colpisce i nemici)
      // Il moltiplicatore dell'Ugello Potenziato si applica DOPO la parte piatta: e' quello che
      // permette al getto di stare dietro alla vita dei nemici, che cresce in percentuale.
      jetDamage: Math.round((16 + lv('dmg') * U.dmg.per * 0.5) * (1 + lv('getto') * U.getto.per)
        * G.danno * TD * window.CONFIG.DANNO_PG),  // un po' sotto al corpo a corpo
      shotCooldown: G.cadenza,   // ms tra uno spruzzo e l'altro
      shotLife: G.gittata,       // ms di vita di una pallina = quanto lontano arriva il getto
      doubleJump: lv('djump') > 0,
      // LEGGENDARIO: la Bomba di Cerume. Comprata una volta, vale per tutte le run — come i
      // progetti. Il numero di usi non e' limitato: e' la ricarica a tenerla rara.
      bomba: window.Meta.unlockLevel('bomba') > 0,
      dash: false,
      weapon: 'swab',        // (storico) resta per compatibilita': la texture ora viene dal kit
      // Abilità di run (scelte all'UpgradeScene) che cambiano lo stile di gioco:
      jetPellets: G.palline || 1,   // n. palline sparate dal getto (Ventaglio: +1 a ogni pesca)
      jetPierce: !!G.perfora,       // palline perforanti (alcuni kit ce l'hanno di serie)
      lifesteal: false,      // curi vita uccidendo
      shield: false,         // para un colpo ogni tot
      homing: false,         // Mira Guidata: le palline curvano verso il nemico piu' vicino
      secondLife: false,     // Seconda Vita: sopravvivi a un colpo mortale, UNA SOLA VOLTA per run
      secondLifeUsed: false, // diventa true al primo uso; non si azzera finche' non riparte la run
      waxMult: 1,            // Cerume Extra: moltiplicatore del cerume raccolto (+0.5 a ogni pesca)
      dashStrike: false,     // Scatto Offensivo: lo scatto danneggia i nemici e pulisce il cerume
      corrosive: false,      // Sapone Corrosivo: le palline avvelenano il nemico (danno nel tempo)
      bounce: 0,             // Rimbalzo: le palline rimbalzano N volte (+1 a ogni pesca)
      radiale: 0,            // Raffica Radiale: quante DIREZIONI tutt'attorno (+4 a ogni pesca)
      // EVOLUZIONI (due abilità collegate si fondono in una versione potenziata):
      evoPierceAll: false,   // Perforante + Ventaglio  -> Lama d'Acqua (perfora tutto + danno)
      evoToxic: false,       // Scoppio + Corrosivo     -> Nube Tossica (lo scoppio avvelena)
      evoMagnet: false,      // Calamita + Cerume Extra  -> Buco Nero (raggio enorme + più cerume)
      evoSwarm: false,       // Bolla + Mira Guidata     -> Sciame (le bolle sparano a ricerca)
      // Abilità sbloccabili dai PROGETTI del negozio (window.BLUEPRINTS):
      magnet: !!G.calamita,  // attira il cerume/pickup vicino (la Pompa a Vuoto ce l'ha di serie)
      meleeBlast: false,     // la bastonata colpisce anche i nemici in un raggio (area)
      jetSplash: false,      // le palline del getto scoppiano all'impatto (piccola area)
      companions: 0,         // n. bolle-aiutante (+1 a ogni pesca della carta)
      backShot: false,       // Doppio Getto: una seconda bocca spara anche all'indietro
      rage: false,           // Rabbia: un colpo subito potenzia il prossimo attacco
      stunShot: false,       // Getto Stordente: i colpi a distanza stordiscono un attimo
      slam: false,           // Schianto: in aria, giu' per schiantarti a terra con un'onda d'urto
    };
  },

  reset() {
    this.level = 1;
    this.wax = 0;
    this.ownedAbilities = [];
    this.prossimoLivello = null;
    this.runStartAt = Date.now();
    this.player = this.newPlayer();
    // Lo sblocco permanente "Doppio Salto Innato" (UNLOCKS.djump) da' gia' l'abilita' da
    // subito (vedi newPlayer) ma non passa mai dalla carta 'doublejump' dell'UpgradeScene:
    // senza questo, la carta continuerebbe a essere proposta (e presa) inutilmente ogni run,
    // visto che il filtro li' guarda solo ownedAbilities. Segnarla gia' posseduta.
    if (this.player.doubleJump) this.ownedAbilities.push('doublejump');
    // Stessa ragione per le abilita' incluse nel KIT scelto (es. il Martello, la calamita della
    // Pompa): senza segnarle possedute, la loro carta continuerebbe a uscire e a non dare nulla.
    const arma = (window.ARMI || []).find((a) => a.id === this.player.arma);
    if (arma && arma.blocca) arma.blocca.forEach((id) => this.ownedAbilities.push(id));
  },
};
