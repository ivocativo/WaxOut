// Effetto "METABALL" per il cerume: preso il livello dei globi, ne sfoca l'alpha su un
// intorno e applica una SOGLIA netta (smoothstep) -> i globi vicini si fondono in una
// massa liquida con bordo pulito, e i contorni interni si ammorbidiscono. La rgb viene
// mediata sull'intorno (cosi' i "buchi" tra i globi prendono il colore vicino). Soglia e
// raggio regolabili al volo via window.__WAX_THRESH / window.__WAX_SPREAD.
const WAX_METABALL_FRAG = [
  'precision mediump float;',
  'uniform sampler2D uMainSampler;',
  'uniform vec2 uSize;',
  'uniform float uThresh;',
  'uniform float uSpread;',
  'uniform float uPix;',
  'varying vec2 outTexCoord;',
  'void main(){',
  '  vec2 grid = max(uPix, 1.0) / uSize;',
  '  vec2 uv = (floor(outTexCoord / grid) + 0.5) * grid;',   // centro "pixelato"
  '  vec2 px = uSpread / uSize;',
  '  float a = 0.0; vec3 col = vec3(0.0); float cw = 0.0;',
  '  for(int y=-2;y<=2;y++){',
  '    for(int x=-2;x<=2;x++){',
  '      vec2 o = vec2(float(x), float(y)) * px;',
  '      vec4 t = texture2D(uMainSampler, uv + o);',
  '      a += t.a; col += t.rgb * t.a; cw += t.a;',
  '    }',
  '  }',
  '  a /= 25.0;',
  '  vec3 c = cw > 0.001 ? col / cw : vec3(0.85, 0.6, 0.15);',
  '  float edge = smoothstep(uThresh - 0.09, uThresh + 0.09, a);',
  '  gl_FragColor = vec4(c * edge, edge);',   // alpha PREMOLTIPLICATO (Phaser): trasparente = rgb 0
  '}',
].join('\n');

const WaxMetaballFX = (Phaser.Renderer && Phaser.Renderer.WebGL) ? class extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) { super({ game: game, name: 'WaxMeta', fragShader: WAX_METABALL_FRAG }); }
  onPreRender() {
    this.set2f('uSize', this.renderer.width, this.renderer.height);
    this.set1f('uThresh', window.__WAX_THRESH || 0.42);
    this.set1f('uSpread', window.__WAX_SPREAD || 1.6);   // meno sfocatura (raggio fusione ridotto)
    this.set1f('uPix', window.__WAX_PIX || 3.0);          // più pixellosità
  }
} : null;

// GameScene: gameplay principale di un livello.
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // Azzera lo stato che vale per UN livello e decide che livello e' questo: normale, sciame,
  // assedio, corsa o boss. La scelta puo' arrivare dalla PORTA (DoorScene), e in quel caso la
  // si CONSUMA qui — se restasse scritta varrebbe anche per il livello dopo.
  // ⚠️ Va per prima: da `levelKind` dipendono la larghezza del mondo, i cronometri, i nemici e
  // perfino la musica.
  preparaStatoDelLivello() {
    // Stato del livello
    this.locked = false;
    this.facing = 1;
    this.lastAttack = 0;
    this.lastShot = 0;
    this.invulnUntil = 0;
    this.dashReady = 0;
    this.dashUntil = 0;
    this.jumpsLeft = 1;
    // "Game feel" del salto: buffer (salto premuto poco prima di atterrare), coyote
    // (salto ancora valido un attimo dopo esser usciti da un bordo) e taglio (rilascio
    // presto = salto piu' basso). Vedi update().
    this.jumpBufferedAt = -9999;
    this.lastGroundAt = -9999;
    this.canCutJump = false;
    this.companions = [];   // bolle-aiutante (create sotto, una per punto di companions)
    this.shieldAura = null; // alone dello scudo (creato al volo se l'abilità è posseduta)
    // Seconda Vita: stato su window.GameState.player (secondLifeUsed), NON qui — this.* si
    // azzererebbe ad ogni livello (create() gira ad ogni scene.start), mentre deve valere una
    // sola volta per l'intera RUN (si azzera solo su GameState.reset()).
    this.speechCooldownUntil = 0;  // CARATTERE COMICO: azzerato ad ogni livello (vedi maybeSpeech)
    this.cleanGoal = 0.8;   // frazione di cerume da pulire per poter completare il livello

    // La vita NON si ricarica a ogni livello: si porta dietro tra un livello e l'altro (a
    // inizio RUN è piena, la imposta newPlayer). Ci si cura raccogliendo i pickup-cura.
    window.GameState.player.hp = Phaser.Math.Clamp(window.GameState.player.hp, 1, window.GameState.player.maxHp);

    // Tipo di questo livello: boss ogni 5 (FISSO, mai una porta — round A, A.3). Per tutti gli
    // altri, se DoorScene ha lasciato una scelta del giocatore la si usa (window.GameState.
    // prossimoLivello, scritta da DoorScene e CONSUMATA qui, subito azzerata cosi' non resta per
    // il livello dopo); altrimenti comportamento a sorteggio di sempre (livello 1: non passa mai
    // da una porta, perche' UpgradeScene/DoorScene non sono ancora girate).
    const levelNum = window.GameState.level;
    const porta = window.GameState.prossimoLivello;
    window.GameState.prossimoLivello = null;
    let kind, mutatoreForzato, waxMultPorta;
    if (levelNum % 5 === 0) {
      kind = 'boss';
    } else if (porta) {
      kind = porta.kind;
      mutatoreForzato = (porta.mutator === undefined) ? null : porta.mutator;   // null = "nessun modificatore", scelto apposta
      waxMultPorta = porta.waxMult;
    } else {
      kind = (levelNum % 5 === 3) ? 'swarm' : 'normal';
      if (kind === 'normal' && levelNum >= 2) {
        // Corsa MENO frequente (playtest utente 2026-07-25: le missioni a tempo erano troppe).
        const r = Math.random();
        if (r < 0.18) kind = 'rush';
        else if (r < 0.44) kind = 'siege';
      }
    }
    this.levelKind = kind;
    // Letti da chooseMutator() (chiamata piu' sotto, dopo buildCeilingProfile/drawBackground):
    // undefined = nessuna porta per questo livello (comportamento a sorteggio attuale).
    this._doorMutatorId = mutatoreForzato;
    this._doorWaxMult = waxMultPorta;
    // BOSS FINALE (round A, A.2): l'ultimo livello e' sempre un boss (RUN_LEVELS e' multiplo di 5),
    // ma quello e' il GRAN TAPPO — piu' vita e una TERZA fase (vedi spawnEnemy/bossAI). I boss
    // intermedi (liv. 5, 10) restano quelli di sempre a 2 fasi.
    this.isFinale = (levelNum === window.CONFIG.RUN_LEVELS);
    // Soglia di pulizia per completare: default 0.8; la CORSA non chiede pulizia (basta
    // arrivare al timpano). L'ASSEDIO non usa il timpano (vince a tempo).
    if (this.levelKind === 'rush') this.cleanGoal = 0;
    // CRONOMETRI (assedio e corsa): si tiene il tempo che MANCA e lo si scala di `delta` a ogni
    // frame, invece di una scadenza assoluta. Prima erano scadenze calcolate su `this.time.now`
    // (orologio della SCENA, che si ferma in pausa) mentre update() confronta con `time`
    // (orologio del GIOCO, che non si ferma): mettendo in pausa i due si sfasavano e alla ripresa
    // il conto alla rovescia faceva un salto in avanti pari alla pausa (segnalato 2026-07-29).
    // Contando il tempo residuo il problema non puo' ripresentarsi, con qualunque orologio.
    this.siegeLeftMs = 0;  // ms mancanti alla fine dell'assedio (0 = non assedio)
    this.siegeQuota = 0;   // quanti nemici bisogna eliminare (0 = non assedio)
    this.siegeKills = 0;   // quanti ne hai eliminati finora
    this.rushLeftMs = 0;   // ms mancanti alla fine della corsa (0 = non corsa)
    this.bigTimerText = null;
  }

  // Il posto in cui si gioca: quanto e' largo il mondo, dove sta il soffitto, lo sfondo, il
  // pavimento, i gruppi fisici, e infine il livello vero (`buildLevel`).
  // ⚠️ L'ORDINE QUI DENTRO E' SIGNIFICATIVO: il profilo del soffitto va calcolato PRIMA di
  // disegnarlo e prima di costruire il livello (pedane, stalattiti e gocce si agganciano al
  // soffitto locale); i gruppi fisici vanno creati prima dei collider che li usano; e il
  // modificatore va scelto prima di costruire, perche' cambia cosa si costruisce.
  costruisciIlCondotto() {
    const H = window.CONFIG.HEIGHT;
    const levelNum = window.GameState.level;
    // Mondo LARGO da attraversare (cresce un po' col livello): la telecamera segue
    // il giocatore mentre cammina verso il timpano (a destra). W/H restano la
    // dimensione della "finestra" visibile; il mondo fisico e' molto piu' ampio.
    this.worldW = Phaser.Math.Clamp(2400 + levelNum * 220, 2400, 5200);
    if (this.levelKind === 'swarm') this.worldW += 300;
    const gh = window.CONFIG.GROUND_H;
    // Soffitto TANGIBILE (round 2, B.1): fascia piu' SOTTILE di quella del round 1 (28% del
    // pavimento, era 45%) e stavolta il bordo ALTO del mondo fisico coincide col suo fondo
    // (CEIL_Y), non piu' y=0 — cosi' il giocatore/nemici (collideWorldBounds) sbattono la
    // testa invece di sparire nel vuoto sopra. `CEIL_Y` e' salvato sulla scena: lo riusa anche
    // `buildPlatforms` (B.2) per non far salire le pedane oltre lo spazio per testa+salto.
    this.CEIL_Y = Math.round(gh * 0.28);
    // Il "fondo" del mondo fisico sta alla quota del collider di SICUREZZA (H-gh+48 = 408), non
    // alla vecchia linea del pavimento piatto (H-gh = 360).
    // ⚠️ PERCHE' (bug corretto 2026-07-20): col terreno del round 4 le CUNETTE scendono fino a
    // 396, cioe' SOTTO 360. Con il fondo a 360 il giocatore dentro una cunetta era fuori dal
    // mondo, e ogni frame il motore lo rispingeva dentro AZZERANDOGLI la velocita' verticale:
    // l'impulso del salto veniva cancellato all'istante e il PG restava incollato al fondo della
    // cunetta. Misurato: apice del salto 0px nelle cunette contro un salto normale sul piano.
    // Il fondo a 408 sta sotto la cunetta piu' profonda, quindi non interferisce mai, e la rete
    // di sicurezza resta: chi cade oltre trova il collider `this.ground` proprio li'.
    // Bordo alto del mondo a 0: il soffitto (ondulato) lo fanno i collider a scaletta di
    // `buildCeilingColliders`, cosi' nelle zone AMPIE il giocatore puo' salire in alto davvero.
    this.physics.world.setBounds(0, 0, this.worldW, H - gh + 48);

    // CONDOTTO A LARGHEZZA VARIABILE (round 4): il soffitto ondeggia e scende (pinch) in alcuni
    // tratti → passaggi stretti/ampi. Il profilo va calcolato PRIMA di disegnare il soffitto e di
    // costruire il livello (pedane/stalattiti/gocce si agganciano al soffitto locale via ceilingYAt).
    this.buildCeilingProfile();

    this.drawBackground();

    // Il PAVIMENTO (terreno) vero lo disegna `buildTerrain()` seguendo il profilo `terrainTopAt`
    // (colline + cunette). Qui creiamo solo il collider di SICUREZZA (backstop) ben SOTTO il
    // terreno: la superficie d'appoggio vera la fa la "mappa di altezze" nel player/enemy update.
    this.ground = this.add.rectangle(this.worldW / 2, (H - gh + 48) + gh / 2, this.worldW, gh).setVisible(false);
    this.physics.add.existing(this.ground, true);

    // Soffitto VISIBILE ondulato (round 4): segue il profilo `ceilingYAt(x)`. Nei pinch scende
    // dentro il condotto (passaggi stretti). Il collider vero dei pinch lo aggiunge il gruppo VC-B.
    // L'ASPETTO lo fa GameGfx.paintOrganicMass (massa di tessuto disegnata via codice); la FORMA
    // resta questa, che e' gameplay.
    window.GameGfx.paintOrganicMass(this, (x) => this.ceilingYAt(x), { verso: -1, lontano: -220, depth: 4 });

    // Gruppi
    this.blocks = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();  // pedane sospese (verticalita')
    this.ceilBlocks = this.physics.add.staticGroup();  // collider a scaletta del soffitto ondulato
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();  // palline sputate dai nemici
    this.collapseChunks = this.physics.add.group({ allowGravity: false });  // EVENTO frana

    this.buildCeilingColliders();   // il "soffitto solido" che segue il profilo (dopo i gruppi)

    this.chooseMutator();   // regola casuale (o della porta) di questo livello (prima di costruirlo)
    // Ricompensa promessa dalla PORTA (round A, A.3), SEPARATA dall'eventuale mutatore: si
    // moltiplica sopra a quanto chooseMutator() ha gia' impostato (di norma 1, salvo mutatori che
    // toccano il cerume — 'bonanza' e' escluso dal pool delle porte apposta per non sovrapporsi).
    if (this._doorWaxMult) this.mutWaxMult = (this.mutWaxMult || 1) * this._doorWaxMult;
    this.applyInfezione();  // difficolta' crescente scelta per la run (round A, A.5): sopra a tutto
    // Manopola di prova "fpsCerumino": la velocita' della strisciata si giudica solo a schermo.
    // L'animazione e' globale (registrata da BootScene), quindi basta cambiarle il passo qui.
    if (window.Taratura && this.anims.exists('blob_crawl')) {
      this.anims.get('blob_crawl').msPerFrame = 1000 / Math.max(1, window.Taratura.v('fpsCerumino'));
    }
    this.chooseEvent();     // evento a tempo indipendente (puo' capitare insieme a un mutatore)
    this.buildLevel();
  }

  // Il personaggio: il corpo INVISIBILE che fa la fisica, il "vestito" animato che lo segue,
  // le animazioni e l'arma che tiene in mano.
  // ⚠️ Sono due oggetti separati e devono restarlo: la fisica su un rettangolo semplice, il
  // disegno su uno sprite che puo' essere schiacciato, allungato e sporcato senza che nulla
  // di tutto cio' tocchi le collisioni.
  creaIlGiocatore() {
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    // Giocatore (sprite PNG: scala per portarlo alla dimensione di gioco; hitbox invariato)
    this.player = this.physics.add.sprite(80, H - gh - 60, 'player_a').setDepth(10).setScale(1.5);
    this.player.body.setSize(18, 40, true);
    this.player.setCollideWorldBounds(true);
    // "Juice" procedurale (schiacciamento/allungamento): jx/jy = moltiplicatori di scala che
    // decadono verso 1 ogni frame (vedi update()). _wasOnGround/_prevVelY per rilevare
    // l'atterraggio; _lastFacing per rilevare l'inversione di corsa.
    this.jx = 1; this.jy = 1;
    this._wasOnGround = true; this._prevVelY = 0; this._lastFacing = 1;
    this._prevBottom = this.player.body.bottom;   // 0 farebbe leggere "arrivo dall'alto" al 1o frame
    // Abilità SCHIANTO: this.slamming = caduta veloce in corso (l'onda scatta all'atterraggio,
    // vedi 'landed' in update()); _slamPrevDown per rilevare la pressione FRESCA di giu' (non
    // tenuta) mentre sei in aria.
    this.slamming = false; this._slamPrevDown = false;

    // ---- Personaggio ANIMATO (sprite sheet AutoSprite) ----
    // La FISICA resta su this.player, reso INVISIBILE: hitbox/collisioni/scala-juice invariati.
    // Il "vestito" animato e' un secondo sprite (this.heroVisual) che ogni frame SEGUE il player
    // e ha scala PROPRIA (indipendente dal corpo fisico), cosi' non altera le collisioni.
    this.player.setVisible(false);
    this.HERO_SCALE = 1.0;        // dimensione a schermo del vestito (frame 84; si tara guardando)
    this.HERO_ORIGIN_Y = 0.86;    // altezza dei piedi nel fotogramma (si tara)
    this.heroVisual = this.add.sprite(this.player.x, this.player.body.bottom, 'hero_walk', 0)
      .setDepth(10).setOrigin(0.5, this.HERO_ORIGIN_Y);
    // Macchie di cerume addosso (vedi sporcati()). Si azzerano qui, quindi a ogni livello si
    // riparte puliti: il livello nuovo e' gia' il momento in cui si tira il fiato e si recupera
    // un po' di vita, ed e' il posto naturale anche per ripulirsi.
    this.macchie = [];
    this.misuraAltezzeDisegnate();   // quanto e' alto ogni fotogramma: serve alle macchie
    if (!this.anims.exists('hero_walk_a')) this.anims.create({ key: 'hero_walk_a', frames: this.anims.generateFrameNumbers('hero_walk', { start: 0, end: 24 }), frameRate: 18, repeat: -1 });
    if (!this.anims.exists('hero_run_a'))  this.anims.create({ key: 'hero_run_a',  frames: this.anims.generateFrameNumbers('hero_run',  { start: 0, end: 24 }), frameRate: 22, repeat: -1 });
    if (!this.anims.exists('hero_idle_a')) this.anims.create({ key: 'hero_idle_a', frames: this.anims.generateFrameNumbers('hero_idle', { start: 0, end: 24 }), frameRate: 10, repeat: -1 });
    if (!this.anims.exists('hero_jump_a')) this.anims.create({ key: 'hero_jump_a', frames: this.anims.generateFrameNumbers('hero_jump', { start: 0, end: 24 }), frameRate: 18, repeat: -1 });
    // L'accovacciamento NON si ripete e si ferma sull'ultimo frame (la posa tenuta): vedi BootScene.
    if (!this.anims.exists('hero_crouch_a')) this.anims.create({ key: 'hero_crouch_a', frames: this.anims.generateFrameNumbers('hero_crouch', { start: 0, end: 5 }), frameRate: 33, repeat: 0 });
    if (!this.anims.exists('hero_crouchwalk_a')) this.anims.create({ key: 'hero_crouchwalk_a', frames: this.anims.generateFrameNumbers('hero_crouchwalk', { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
    if (!this.anims.exists('hero_runaim_a')) this.anims.create({ key: 'hero_runaim_a', frames: this.anims.generateFrameNumbers('hero_runaim', { start: 0, end: 5 }), frameRate: 11, repeat: -1 });

    // ---- ARMA IN MANO (layer separato, INTERCAMBIABILE) ----
    // L'arma e' un "adesivo" distinto sopra il personaggio: a distanza RUOTA verso la mira,
    // nel corpo a corpo ROTEA col colpo. Cambiare arma = cambiare voce nella tabella WEAPONS
    // (nessuna ri-generazione del personaggio). Compare durante l'attacco (poi si nasconde).
    // hand = offset [x,y] della mano dal centro fisico (x va specchiato col facing); origin =
    // perno di rotazione dentro la texture (grip). Tutti valori da tarare a occhio.
    // `origin` = dove sta la MANO dentro l'immagine (e quindi il perno della rotazione).
    // `scale` porta il disegno alla dimensione a schermo: le immagini nuove sono baked a doppia
    // risoluzione (80x12 e 39x24) e vengono rimpicciolite a meta', cosi' restano nitide.
    // `bocca` = dove sta la PUNTA che spara, in pixel dell'immagine e rispetto al perno
    // (misurata sul disegno: l'ultima colonna con pixel opachi). Serve per far partire i
    // proiettili da li' invece che dalla pancia del personaggio — vedi boccaArma().
    this.WEAPONS = {
      // Spruzzino: la mano e' sull'impugnatura, in basso a sinistra del corpo; l'ugello sta
      // in alto a destra (immagine 39x24, perno a 9,19 → ugello a 38,10).
      sprayer: { tex: 'sprayer', origin: [0.23, 0.78], scale: 0.5, hand: [8, -2], bocca: [29, -9] },
      // Coton fioc a una punta: la mano e' all'estremita' NUDA del bastoncino, il batuffolo
      // sporco di cerume e' la parte che colpisce (immagine 80x12, perno a 5,6 → punta a 79,3).
      // ⚠️ Scala alzata da 0,5 a 0,72 dopo il playtest: a 0,5 era un filo di 40x6 pixel e il
      // giocatore non capiva cosa avesse in mano.
      // ⚠️ `spessore` ingrossa SOLO in altezza (moltiplica la scala verticale). Alzare `scale`
      // avrebbe reso il bastoncino anche piu' LUNGO, cambiando la portata percepita del colpo:
      // il playtest chiedeva un coton fioc meno sottile, non uno piu' lungo.
      swab:    { tex: 'swab',    origin: [0.06, 0.5],  scale: 0.72, spessore: 1.7, hand: [6, -2], bocca: [74, -3] },
      hammer:  { tex: 'hammer',  origin: [0.22, 0.5],  scale: 0.9, hand: [6, -6] },
    };
    this.heroWeapon = this.add.sprite(this.player.x, this.player.y, 'sprayer').setDepth(11).setVisible(false);
    this._weaponHideAt = 0;   // istante fino a cui l'arma resta visibile dopo un attacco
    this._weaponMode = null;  // 'ranged' | 'melee'
    this._posaMira = null;    // posa di mira attiva: 'avanti' | 'su' | 'accovacciato' | 'corsa' | 'crouchaim'
    this._mischiaFinoA = 0;   // istante fino a cui gira l'animazione del colpo (ha la precedenza)
    this._weaponAim = 0;      // angolo di mira corrente (per il posizionamento in update)
  }

  // Contro cosa sbatte il giocatore, e la telecamera che lo insegue dentro al mondo largo.
  collegaGiocatoreETelecamera() {
    const H = window.CONFIG.HEIGHT;
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.blocks);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.ceilBlocks);   // soffitto ondulato solido

    // La telecamera segue il giocatore dentro al mondo largo.
    this.cameras.main.setBounds(0, 0, this.worldW, H);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(160, 120);
  }

  // Chi tocca chi: nemici contro terreno e muri, raccolte, gocce, frana.
  // ⚠️ Con `collider(gruppo, oggettoSingolo)` Phaser INVERTE l'ordine degli argomenti nella
  // callback. E' gia' costato un bug vero (spariva il pavimento invece del proiettile), per
  // questo qui dentro l'oggetto giusto si riconosce sempre chiedendo al gruppo se gli
  // appartiene, mai fidandosi della posizione.
  agganciaLeCollisioni() {
    // I nemici a terra collidono col pavimento e col muro; i Moscerini volano sopra a tutto.
    // NB: con collider(gruppo, oggettoSingolo) Phaser INVERTE l'ordine degli argomenti
    // nella callback (passa l'oggetto singolo per primo), percio' individuiamo il nemico
    // controllando quale dei due appartiene al gruppo enemies.
    const notFlyer = (a, b) => (this.enemies.contains(a) ? a : b).kind !== 'fly';
    this.physics.add.collider(this.enemies, this.ground, null, notFlyer);   // i volanti non toccano terra (corretto)
    // Il cerume invece NESSUN nemico dovrebbe poterlo attraversare (era un bug: i moscerini
    // ci passavano attraverso, esattamente come le pedane prima del fix in 00ec955). L'UNICA
    // eccezione voluta e' il Fuggitivo Dorato (evento "acchiappalo"): resta un blob a terra
    // (non diventa volante, che dopo QUESTO fix si incastrerebbe comunque nel cerume), ma
    // attraversa la massa per non restarci bloccato durante la fuga a tempo.
    const notFugitive = (a, b) => (this.enemies.contains(a) ? a : b).fugitive !== true;
    this.physics.add.collider(this.enemies, this.blocks, null, notFugitive);
    // Le PEDANE sono solide anche per i moscerini (cosi' la loro picchiata non le attraversa).
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.enemies, this.ceilBlocks);   // niente nemici sopra il soffitto locale

    // Bonus di cerume raccoglibili sulle pedane.
    this.physics.add.overlap(this.player, this.pickups, (pl, pk) => this.grabPickup(pk));

    // Gocce dal soffitto: fanno danno da contatto col giocatore (come un nemico).
    this.physics.add.overlap(this.player, this.movers, (pl, mv) => this.hurtPlayer(12 + Math.floor(window.GameState.level / 2), mv.x));
    // e SCHIZZANO quando incontrano il cerume O una pedana nella caduta (niente attraversamenti).
    // Le gocce dal soffitto si spappolano su cerume e pedane. Le SCHEGGE della Regina no: corrono
    // rasoterra e devono arrivare fino al giocatore, se no un ciuffo di cerume qualsiasi
    // annullerebbe l'attacco del boss.
    const dripSplash = (mv) => {
      if (mv && mv.active && !mv.scheggia) { this.splat(mv.x, mv.y, 'soft'); mv.destroy(); }
    };
    this.physics.add.overlap(this.movers, this.blocks, dripSplash);
    this.physics.add.overlap(this.movers, this.platforms, dripSplash);

    // EVENTO Frana di cerume: i blocchi caduti fanno danno da contatto E aprono un piccolo
    // varco nel cerume vicino a dove atterrano (a differenza delle gocce, che schizzano e basta).
    this.physics.add.overlap(this.player, this.collapseChunks, (pl, c) => {
      this.hurtPlayer(14 + Math.floor(window.GameState.level / 2), c.x);
      this.collapseImpact(c);
    });
    this.physics.add.overlap(this.collapseChunks, this.blocks, (c) => this.collapseImpact(c));
    this.physics.add.overlap(this.collapseChunks, this.platforms, (c) => this.collapseImpact(c));
  }

  // Le due cose che nascono col livello e non dallo spawner: i guardiani che presidiano le
  // membrane, e le bolle-aiutante di chi ha quell'abilita'.
  mettiInCampoGuardianiEBolle() {
    // Guardiani fermi a presidiare le membrane piene.
    this.spawnGuardians();

    // Aiutante (abilità COMPANION, impilabile): N bolle che ti orbitano e sparano da sole.
    const nc = window.GameState.player.companions | 0;
    for (let i = 0; i < nc; i++) this.spawnCompanion(i, nc);
  }

  // Le palline: quelle sputate dai nemici e il getto del giocatore, con tutte le abilita' che
  // ne cambiano il comportamento all'impatto (perforante, rimbalzo, corrosivo, stordente).
  agganciaProiettiliEGetto() {
    // Le palline sputate feriscono il giocatore e si spappolano contro muro/pavimento.
    this.physics.add.overlap(this.player, this.projectiles, (pl, proj) => {
      this.hurtPlayer(proj.dmg, proj.x);
      this.popProjectile(proj);
    });
    // Quando una pallina tocca muro/pedana/pavimento si spappola. ATTENZIONE: con
    // collider(gruppo, oggettoSingolo) Phaser inverte gli argomenti, percio' col
    // pavimento la callback riceveva (pavimento, proiettile) e il codice DISTRUGGEVA
    // IL PAVIMENTO invece del proiettile (il pavimento "spariva" quando una pallina
    // a parabola lunga cadeva a terra). Individuiamo sempre il proiettile dal gruppo.
    const popProj = (a, b) => this.popProjectile(this.projectiles.contains(a) ? a : b);
    this.physics.add.collider(this.projectiles, this.blocks, popProj);
    this.physics.add.collider(this.projectiles, this.platforms, popProj);
    this.physics.add.collider(this.projectiles, this.ground, popProj);
    this.physics.add.collider(this.projectiles, this.ceilBlocks, popProj);

    // Getto di acqua e sapone del giocatore: pulisce il cerume e colpisce i nemici a
    // distanza. (Con overlap(gruppo, oggetto) Phaser puo' invertire gli argomenti:
    // individuiamo sempre il proiettile-getto dal gruppo this.shots.)
    this.makeSoapTexture();
    this.shots = this.physics.add.group({ allowGravity: false });
    // Abilità PERFORANTE: la pallina non si spappola al primo colpo ma ne attraversa
    // alcuni (pierceLeft). pierceGrace evita di ri-colpire lo stesso bersaglio mentre esce.
    const consumeShot = (sh) => {
      sh.pierceLeft = (sh.pierceLeft || 1) - 1;
      if (sh.pierceLeft <= 0) this.popShot(sh);
      else sh.pierceGrace = this.time.now + 80;
    };
    const hitWax = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, bl = (sh === a) ? b : a;
      if (this.time.now < (sh.pierceGrace || 0)) return;
      this.damageBlock(bl, sh.dmg); consumeShot(sh);
    };
    const hitFoe = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, en = (sh === a) ? b : a;
      if (en.spawning || this.time.now < (sh.pierceGrace || 0)) return;
      this.damageEnemy(en, sh.dmg);
      if (sh.corrosive) this.applyCorrosion(en);   // abilità SAPONE CORROSIVO: danno nel tempo
      if (sh.stun) this.applyStun(en);             // abilità GETTO STORDENTE
      consumeShot(sh);
    };
    const hitSolid = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, solid = (sh === a) ? b : a;
      if (sh.bounceLeft > 0) this.bounceShot(sh, solid);   // abilità RIMBALZO
      else this.popShot(sh);                               // altrimenti i muri fermano
    };
    this.physics.add.overlap(this.shots, this.blocks, hitWax);
    this.physics.add.overlap(this.shots, this.enemies, hitFoe);
    this.physics.add.overlap(this.shots, this.platforms, hitSolid);
    this.physics.add.overlap(this.shots, this.ground, hitSolid);
    this.physics.add.overlap(this.shots, this.ceilBlocks, hitSolid);
  }

  // Tastiera, comandi a schermo per telefono, e il clic del mouse su PC.
  preparaComandi() {
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: [{ key: 'player_a' }, { key: 'player_b' }],
        frameRate: 8, repeat: -1,
      });
    }

    // Input
    this.keys = this.input.keyboard.addKeys('W,A,S,D,J,SPACE,SHIFT,R,UP,DOWN,LEFT,RIGHT');

    // Comandi a schermo per telefono/tablet (vuoti su PC).
    this.touch = window.TouchControls.attach(this);

    // Tempi di ricarica di getto (a distanza) e coton fioc (corpo a corpo).
    this.lastShot = 0;
    this.pcFiring = false;

    // Su PC (mouse, niente touch): tieni premuto il clic per spruzzare il getto.
    // Su mobile si usa il pulsante "Spruzza" dedicato.
    if (!this.touch.enabled) {
      this.input.on('pointerdown', () => { window.Sfx.unlock(); this.pcFiring = true; });
      this.input.on('pointerup', () => { this.pcFiring = false; });
    }
  }

  // Quanti nemici, ogni quanto, e le regole speciali del tipo di livello (quota dell'assedio,
  // conto alla rovescia della corsa). Qui sta anche il RESPIRO d'apertura: finche' c'e' il
  // banner non entra nient'altro (vedi `avvioAl`).
  popolaDiNemici() {
    // Nemici iniziali + spawner periodico (variano col tipo di livello)
    const lvl = window.GameState.level;
    let spawnDelay;
    if (this.levelKind === 'boss') {
      this.maxEnemies = Math.min(2 + Math.floor(lvl / 3), 3);  // il boss + pochi sgherri
      spawnDelay = Math.max(2000, 3200 - lvl * 120);
      this._nasciteIniziali = [['boss'], []];
      // Un banner per ogni boss: e' il primo segnale che questo non e' quello di prima.
      const chiave = this.isFinale ? 'game_boss_finale_in' : (lvl >= 10 ? 'game_boss_regina_in' : 'game_boss_in');
      const colore = this.isFinale ? '#ff5252' : (lvl >= 10 ? '#8fd0ff' : '#ffb04a');
      // Il banner della Regina e' su DUE righe (nome + come si batte): piu' in basso, o la
      // seconda riga finirebbe sotto la barra della vita del boss.
      this.showBanner(window.I18n.t(chiave), colore, (!this.isFinale && lvl >= 10) ? 140 : undefined);
    } else if (this.levelKind === 'swarm') {
      // Densita' ridotta (giro difficolta' 2026-07-25): l'utente trovava "impossibile fuggire".
      this.maxEnemies = Math.min(3 + Math.floor(lvl * 0.5), 6);
      spawnDelay = Math.max(1050, 1900 - lvl * 100);
      this._nasciteIniziali = new Array(Math.min(3, this.maxEnemies)).fill([]);
      this.showBanner(window.I18n.t('game_swarm_in'), '#9be870');
    } else if (this.levelKind === 'siege') {
      // ASSEDIO: non serve raggiungere il timpano, bisogna ELIMINARE UNA QUOTA di nemici prima
      // che scada il cronometro (vedi update).
      //
      // PERCHE' LA QUOTA (idea dell'utente, 2026-07-31). Prima si vinceva solo SOPRAVVIVENDO
      // fino allo scadere del tempo, e questo rendeva la tattica migliore l'opposto
      // dell'obiettivo del gioco: conveniva arrampicarsi su un cumulo di cerume e stare fermi,
      // cioe' CONSERVARE il cerume in un gioco che ti chiede di pulirlo. Con una quota di
      // uccisioni il rifugio non serve piu' a niente: fermo non uccidi, e non completi.
      // (La vecchia proposta era far sgretolare il cumulo sotto i piedi: una toppa che rendeva
      // il rifugio scomodo invece di togliergli il senso. Questa e' meglio, ed e' stata buttata.)
      //
      // LA QUOTA STA SOTTO LA META' DEI NEMICI DISPONIBILI, e non e' un numero a caso: misurato
      // con un giocatore perfetto (che elimina ogni nemico appena compare, cosi' il tetto a
      // schermo non blocca mai le nuove comparse), al livello 13 il gioco riesce a mandarne ~52
      // in 56 secondi. Se la quota si avvicinasse a quel soffitto il gioco si rovescerebbe:
      // finiresti ad ASPETTARE che i nemici compaiano, che e' l'opposto di un assedio.
      this.maxEnemies = Math.min(3 + Math.floor(lvl * 0.45), 6);
      spawnDelay = Math.max(1000, 1750 - lvl * 90);
      this.siegeLeftMs = 30000 + lvl * 2000;
      this.siegeQuota = 10 + lvl;
      this.siegeKills = 0;
      this._nasciteIniziali = new Array(Math.min(3, this.maxEnemies)).fill([]);
      this.showBanner(window.I18n.t('game_siege_in', { q: this.siegeQuota }), '#ff8f5a');
    } else {
      // normal / rush: attraversa fino al timpano (la corsa non chiede pulizia).
      this.maxEnemies = Math.min(2 + Math.floor(lvl / 3), 4);
      spawnDelay = Math.max(1900, 3200 - lvl * 140);
      if (this.levelKind === 'rush') {
        this.maxEnemies = Math.min(this.maxEnemies + 1, 5); spawnDelay = Math.round(spawnDelay * 0.8);
        // CORSA A TEMPO: countdown 3-2-1-VIA (annuncio lampante, il cronometro parte a "VIA") +
        // tempo piu' generoso. Da tarare col playtest.
        this.startRushCountdown();
      }
      this._nasciteIniziali = new Array(Math.min(2, this.maxEnemies)).fill([]);
      // Quanto bisogna pulire va DETTO all'inizio: prima lo si scopriva solo sbattendo contro
      // il timpano chiuso a fine livello (segnalato nel playtest).
      if (this.levelKind !== 'rush') {
        this.showBanner(window.I18n.t('game_goal', { pct: Math.round(this.cleanGoal * 100) }), '#ffd9a0');
      }
    }
    this.maxEnemies = Phaser.Math.Clamp(this.maxEnemies + (this.mutMaxEnemies || 0), 1, 12);   // MODIFICATORE "orda"
    // MANOPOLA DI PROVA "densita'" (src/taratura.js): moltiplica il tetto di nemici contemporanei.
    if (window.Taratura) {
      this.maxEnemies = Phaser.Math.Clamp(Math.round(this.maxEnemies * window.Taratura.v('densita')), 1, 14);
    }

    // PROTEZIONE ALLO SPAWN: breve invulnerabilita' a inizio livello, cosi' se un nemico
    // nasce vicino al punto di partenza (sezioni strette) non uccide il giocatore prima che
    // possa reagire. Il god-mode dei test nascondeva proprio questo caso — scoperto 2026-07-18
    // (l'utente moriva all'istante cliccando "Start Run"). Vedi anche pickGroundX (spawn piu' lontani).
    this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 1400);

    // ==========================================================================================
    // UN RESPIRO PRIMA CHE COMINCI (playtest round 5). REGOLA GENERALE: finche' c'e' un banner
    // a schermo non deve entrare nient'altro — il giocatore deve avere il tempo di leggere che
    // livello e'. Prima arrivavano nello stesso istante due banner, il contatore, il cronometro
    // e i nemici, e in assedio non si capiva niente.
    // L'attesa NON e' la durata intera del banner (3,1s: troppo, il livello sembrerebbe rotto):
    // e' il tempo perche' il banner finisca di entrare e si legga. Col modificatore ce n'e' un
    // secondo che compare a 700ms, e l'attesa slitta di altrettanto.
    // In questa finestra: niente nemici, cronometro dell'assedio fermo, contatore e cronometro
    // non ancora a schermo (vedi updateHud).
    // La CORSA ha gia' il suo annuncio, il 3-2-1: li' l'attesa e' esattamente quella.
    const attesa = (this.levelKind === 'rush') ? 2600 : 1200 + (this.mutator ? 700 : 0);
    this.avvioAl = this.time.now + attesa;
    this.time.delayedCall(attesa, () => {
      if (this.locked || !this.scene.isActive()) return;
      (this._nasciteIniziali || []).forEach((args) => this.spawnEnemy.apply(this, args));
      this._nasciteIniziali = null;
    });

    this.spawnTimer = this.time.addEvent({
      delay: spawnDelay, loop: true,
      // Il controllo sull'orario si fa QUI dentro e non con `startAt` negativo: quello dipende
      // da un dettaglio interno di Phaser, questo si legge e non puo' sorprendere.
      callback: () => {
        if (this.time.now < this.avvioAl) return;
        if (!this.locked && this.nemiciVicini() < this.maxEnemies) this.spawnEnemy();
      },
    });
  }

  // I due annunci ritardati: il modificatore e la battuta d'inizio livello.
  annunciaIlLivello() {
    // Annuncio del MODIFICATORE di livello (piu' in basso del banner del tipo, cosi' si vedono
    // entrambi senza sovrapporsi).
    if (this.mutator) {
      this.time.delayedCall(700, () => { if (!this.locked) this.showBanner(window.I18n.t('mut_' + this.mutator.id), this.mutator.color, 210); });
    }

    // CARATTERE COMICO: battuta di inizio livello (boss a parte: taunt dedicato). Ritardata
    // per non accavallarsi coi banner di tipo/mutatore appena mostrati. `force`: deve comparire
    // SEMPRE, anche se nel frattempo un'uccisione/colpo precoce ha gia' consumato il cooldown.
    this.time.delayedCall(1400, () => {
      if (this.locked) return;
      this.maybeSpeech(this.levelKind === 'boss' ? 'boss' : 'start', undefined, true);
    });
  }

  // Interfaccia: barra della vita, cronometro grande, musica, pausa, elenco delle abilita'.
  mostraInterfaccia() {
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    this.buildHud();

    // Timer grande e centrato (round 2, F.1/F.2a): condiviso da Assedio (sopravvivi) e Corsa
    // (tempo per arrivare) — prima l'assedio aveva un testo minuscolo (`siegeText`, 20px) e la
    // corsa non aveva nessun timer. Vedi `buildBigTimer`/`updateBigTimer`.
    if (this.levelKind === 'siege' || this.levelKind === 'rush') this.buildBigTimer();

    // Atmosfera musicale in base al tipo di livello (round 3 audio): boss/assedio = teso,
    // gli altri = ritmo "missione di pulizia". Cambia con una dissolvenza rispetto al menu.
    const musicKind = (this.levelKind === 'boss' || this.levelKind === 'siege') ? 'boss' : 'level';
    window.Sfx.setMusic(musicKind);

    // Pausa: tasti ESC/P + pulsante a schermo (in alto a destra)
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard.on('keydown-P', () => this.pauseGame());
    this.buildPauseButton();

    // Suggerimento abilita di questo livello
    if (window.GameState.ownedAbilities.length > 0) {
      const names = window.GameState.ownedAbilities.map((id) => window.I18n.t('ability_' + id));
      const txt = window.I18n.t('hud_abilities', { list: names.join(', ') });
      const t = this.add.text(W / 2, H - gh - 8, txt, {
        fontFamily: 'monospace', fontSize: '13px', color: '#fff7e8',
        stroke: '#14161f', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(40).setScrollFactor(0);
      this.tweens.add({ targets: t, alpha: 0, delay: 2500, duration: 800, onComplete: () => t.destroy() });
    }
  }

  // ==========================================================================================
  // COSTRUZIONE DI UN LIVELLO. Gira una volta ogni volta che si entra in un livello, ed e'
  // l'INDICE di come nasce: qui sotto non c'e' logica, solo l'elenco ordinato dei passi. Ogni
  // riga porta a un metodo che ha in testa il commento di cosa fa.
  // ⚠️ L'ORDINE NON E' ARBITRARIO — i vincoli noti, in ordine di apparizione:
  //   · lo STATO viene per primo perche' decide che livello e' questo (normale, sciame, assedio,
  //     corsa, boss), e da quella scelta dipendono larghezza del mondo, cronometri, nemici e musica;
  //   · il CONDOTTO prima del GIOCATORE: il personaggio nasce appoggiato a un pavimento che deve
  //     gia' esistere;
  //   · le COLLISIONI dopo entrambi, ovviamente, perche' collegano cose che devono esserci;
  //   · i NEMICI per ultimi fra le cose vive, cosi' il respiro d'apertura (vedi `avvioAl`) puo'
  //     tenerli fuori finche' il giocatore non ha letto il banner;
  //   · l'INTERFACCIA in fondo perche' legge valori decisi da tutti i passi precedenti.
  // ==========================================================================================
  create() {
    this.preparaStatoDelLivello();

    this.costruisciIlCondotto();

    this.creaIlGiocatore();

    this.collegaGiocatoreETelecamera();

    this.agganciaLeCollisioni();

    this.mettiInCampoGuardianiEBolle();

    this.agganciaProiettiliEGetto();

    this.preparaComandi();

    this.popolaDiNemici();

    this.annunciaIlLivello();

    this.mostraInterfaccia();
  }

  // ---------- Costruzione livello ----------










  // Interpolazione lineare del profilo (spezzata) al punto x.
  _sampleProfile(pts, x, fallback) {
    if (!pts || !pts.length) return fallback;
    if (x <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i].x) {
        const a = pts[i - 1], b = pts[i];
        const t = (x - a.x) / Math.max(1, b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return pts[pts.length - 1].y;
  }


  // Azzera i modificatori ai valori "neutri" (nessun effetto) + rimette la gravita' di default.
  resetMutators() {
    this.mutEnemySpeed = 1; this.mutEnemyHp = 1; this.mutEnemyWax = 1; this.mutEnemyDmg = 1;
    this.mutMaxEnemies = 0; this.mutWaxMult = 1; this.mutWaxHp = 1; this.mutQuake = false;
    this.physics.world.gravity.y = window.CONFIG.GRAVITY;
    this.mutator = null;
  }

  // DIFFICOLTA' "Infezione" (round A, A.5): al grado scelto per la run alza le manopole gia'
  // esistenti (nemici piu' duri/veloci/dannosi) e la ricompensa. Composta MOLTIPLICATIVAMENTE
  // sopra a mutatore + porta, quindi va chiamata DOPO chooseMutator() e il waxMult della porta.
  applyInfezione() {
    const g = window.GameState.infezione || 0;
    const F = window.CONFIG.INFEZIONE;
    if (g > 0) {
      this.mutEnemyHp = (this.mutEnemyHp || 1) * (1 + F.enemyHp * g);
      this.mutEnemySpeed = (this.mutEnemySpeed || 1) * (1 + F.enemySpeed * g);
      this.mutEnemyDmg = (this.mutEnemyDmg || 1) * (1 + F.enemyDmg * g);
      this.mutWaxMult = (this.mutWaxMult || 1) * (1 + F.waxReward * g);
    }
    // MANOPOLE DI PROVA (src/taratura.js): sopra a tutto il resto, cosi' quello che si gira nel
    // pannello si sente qualunque sia il modificatore, la porta o il grado di infezione. A 1
    // (predefinito) queste moltiplicazioni non cambiano niente.
    const T = window.Taratura;
    if (T) {
      this.mutEnemyHp = (this.mutEnemyHp || 1) * T.v('vitaNemici');
      this.mutEnemySpeed = (this.mutEnemySpeed || 1) * T.v('velNemici');
      this.mutEnemyDmg = (this.mutEnemyDmg || 1) * T.v('dannoNemici');
      this.mutWaxMult = (this.mutWaxMult || 1) * T.v('cerume');
    }
  }

  // Sceglie un MODIFICATORE per questo livello e lo applica. Niente mutatori nei livelli boss.
  // Round A, A.3: se una PORTA ha deciso per questo livello (this._doorMutatorId, letto in
  // create()), il modificatore non e' piu' un sorteggio ma la scelta del giocatore — forzato al
  // 100% (o esplicitamente NESSUNO, se la porta prescelta prometteva "nessun modificatore": non
  // deve uscirne uno a sorpresa, o l'anteprima mostrata nella porta diventerebbe bugiarda).
  // undefined = nessuna porta per questo livello (livello 1): comportamento a sorteggio di sempre.
  chooseMutator() {
    this.resetMutators();
    if (this.levelKind === 'boss') return;
    if (this._doorMutatorId !== undefined) {
      if (this._doorMutatorId === null) return;
      this.mutator = window.MUTATORS.find((m) => m.id === this._doorMutatorId) || null;
      if (this.mutator) this.mutator.apply(this);
      return;
    }
    if (window.GameState.level < 2) return;
    if (Math.random() > 0.55) return;   // ~55% dei livelli ha un mutatore
    this.mutator = Phaser.Utils.Array.GetRandom(window.MUTATORS);
    this.mutator.apply(this);
  }

  // Sceglie (a volte) un EVENTO CASUALE per questo livello: indipendente dai mutatori (puo'
  // capitare insieme), niente numeri da regolare ma una MECCANICA a tempo (vedi i metodi
  // dedicati per ciascun evento, es. startGoldFugitiveEvent). Niente eventi nei primissimi
  // livelli, nei boss (gia' un evento a se') o nell'assedio (gia' abbastanza intenso).
  chooseEvent() {
    this.activeEvent = null;
    if (window.GameState.level < 2 || this.levelKind === 'boss' || this.levelKind === 'siege') return;
    if (Math.random() > 0.25) return;   // ~25% dei livelli ha un evento
    this.activeEvent = Phaser.Utils.Array.GetRandom(window.EVENTS);
    this.activeEvent.apply(this);
  }

  // EVENTO "Fuggitivo Dorato": dopo un breve ritardo (il giocatore si e' gia' orientato nel
  // livello) compare un nemico dorato che NON attacca ma scappa dritto verso il timpano.
  // Ucciderlo in tempo da' un bottino grosso; se scappa (raggiunge il fondo o scade il
  // tempo) sparisce senza ricompensa — l'imprevisto e' doverlo rincorrere SUBITO.
  startGoldFugitiveEvent() {
    const delay = Phaser.Math.Between(4000, 7000);
    this.time.delayedCall(delay, () => { if (!this.locked) this.spawnGoldFugitive(); });
  }

  spawnGoldFugitive() {
    const lvl = window.GameState.level;
    // pickGroundX() (non un offset fisso) tiene il punto DENTRO la sezione attuale (tra le
    // membrane), altrimenti il fuggitivo rischierebbe di comparire oltre una membrana ancora
    // intera e restare bloccato contro il muro per tutta la durata dell'evento.
    const e = this.spawnEnemy('blob', { x: this.pickGroundX(), fugitive: true });
    e.fugitive = true;
    e.contactDamage = 0;                          // e' preda, non minaccia: non fa danno da contatto
    e.speed = Math.round(e.speed * 1.7);
    e.waxValue = Math.round(45 + lvl * 4);
    // FIRMA VISIVA. Il vecchio oro (0xffd700) non si distingueva piu': da quando i nemici sono
    // immagini vere, il cerumino e' GIA' ambra-dorato e una tinta dorata su ambra non cambia
    // niente (segnalato dall'utente 2026-07-27). Ora e' oro QUASI BIANCO — cioe' molto piu'
    // luminoso di qualunque altra cosa a schermo — e soprattutto lascia una SCIA di scintille:
    // il movimento e' la cosa che si nota davvero con la coda dell'occhio.
    e.setTint(0xfff0a8);
    e.setScale((e.scaleX || 1) * 1.3);            // piu' grosso del cerumino normale: si nota
    // Alone dorato pulsante. Sulle varianti elite gli aloni sono stati tolti apposta, ma qui e'
    // un EVENTO che dura pochi secondi e deve saltare all'occhio: la sola tinta non bastava
    // (segnalato due volte dall'utente).
    e.aloneOro = this.add.circle(e.x, e.y, 30, 0xffe98a, 0.22).setStrokeStyle(3, 0xfff3b0, 0.95).setDepth(7);
    this.tweens.add({ targets: e.aloneOro, scale: 1.35, alpha: 0.5, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    e.once('destroy', () => { if (e.aloneOro) { e.aloneOro.destroy(); e.aloneOro = null; } });
    this.fugitiveEscapeAt = this.time.now + 14000; // tempo limite per catturarlo
    this.showBanner(window.I18n.t('event_goldfugitive_in'), '#ffd700');
  }

  // Scintilla della scia del Fuggitivo: puntino dorato che resta indietro e svanisce.
  fugitiveSparkle(e) {
    const s = this.add.circle(
      e.x + Phaser.Math.Between(-10, 10),
      e.y + Phaser.Math.Between(-12, 10),
      Phaser.Math.Between(2, 4), 0xffe98a, 0.95,
    ).setDepth(7);
    this.tweens.add({
      targets: s, alpha: 0, scale: 0.2,
      x: s.x - Phaser.Math.Between(14, 30), y: s.y - Phaser.Math.Between(2, 14),
      duration: Phaser.Math.Between(320, 520), ease: 'Quad.out',
      onComplete: () => s.destroy(),
    });
  }

  // IA del Fuggitivo Dorato: ignora del tutto il giocatore, corre sempre verso il timpano.
  // Scaduto il tempo o raggiunto il fondo, sparisce (nessuna ricompensa per averlo lasciato fuggire).
  fugitiveAI(e, now) {
    if (now >= (this.fugitiveEscapeAt || 0) || e.x >= this.goalX - 40) {
      this.showBanner(window.I18n.t('event_goldfugitive_escaped'), '#c9a0ff');
      e.destroy();
      return;
    }
    // ATTRAVERSA il cerume, ma RALLENTATO: cosi' una membrana intatta non e' un muro che lo
    // ferma (ci si incastrava) ne' un'autostrada — chiesto dall'utente 2026-07-29.
    let v = e.speed;
    const dentroCerume = this.blocks.getChildren().some((b) => b.active
      && Math.abs(b.x - e.x) < 22 && Math.abs(b.y - e.y) < 26);
    if (dentroCerume) v = Math.round(v * 0.45);
    e.setVelocityX(v);
    e.setFlipX(false);
    if (e.aloneOro) { e.aloneOro.x = e.x; e.aloneOro.y = e.y; }
    // Scia di scintille: e' quello che lo fa notare mentre scappa, molto piu' della tinta.
    if (now >= (e._scintillaAt || 0)) {
      e._scintillaAt = now + 70;
      this.fugitiveSparkle(e);
    }
  }

  // MUTATORE "Terremoto" (`this.mutQuake`), RIDISEGNATO nel round 2 (E.1): il cerume PENDE
  // GIA' dal soffitto tangibile (B.1) — scenografia inerte (`this.stalactites`) — e a ogni
  // SCOSSA periodica (shake della camera + rombo) qualcuna si stacca e cade, riusando
  // l'infrastruttura `collapseChunks` gia' esistente (gravita', danno da contatto, impatto sul
  // cerume). Prima (round 1) i chunk comparivano dal nulla con un telegrafo lampeggiante e una
  // pioggia continua — la scossa non si percepiva. Dura finche' dura il livello, si ferma da
  // solo quando la scena finisce/riparte (il guard `this.locked` interrompe la catena).
  startWaxCollapseEvent() {
    const delay = Phaser.Math.Between(2000, 4000);
    this.time.delayedCall(delay, () => {
      if (this.locked) return;
      this.placeStalactites();
      this.scheduleQuakePulse();
    });
  }

  // Fila di stalattiti di cerume duro appese al soffitto (sprite VERI, `wax_a/b/c/d` come il
  // muro, tinti come il cerume duro) in punti sparsi lungo il livello — quantita' scalata alla
  // larghezza. Restano inerti finche' `quakePulse` non ne stacca qualcuna.
  placeStalactites() {
    this.stalactites = [];
    const n = Phaser.Math.Clamp(Math.round(this.worldW / 480), 5, 12);
    for (let i = 0; i < n; i++) this.addStalactite();
  }

  addStalactite() {
    const x = this.pickHazardX(36, 20);
    if (x == null) return;
    const cx = x + 18;
    const key = Phaser.Utils.Array.GetRandom(['wax_a', 'wax_b', 'wax_c', 'wax_d']);
    const sprite = this.add.image(cx, this.ceilingYAt(cx), key).setOrigin(0.5, 0).setDepth(6);
    const src = this.textures.get(key).getSourceImage();
    sprite.setScale((window.CONFIG.BLOCK * 1.5) / src.width);
    sprite.setTint(this._waxTint('hard', 1));
    if (Math.random() < 0.5) sprite.setFlipX(true);
    this.stalactites.push({ x: cx, sprite });
  }

  // Si richiama da sola con un intervallo diverso ogni volta (2.5-3.5s): cosi' le scosse non
  // hanno un ritmo prevedibile/meccanico.
  scheduleQuakePulse() {
    this.quakeTimer = this.time.delayedCall(Phaser.Math.Between(2500, 3500), () => {
      if (this.locked) return;
      this.quakePulse();
      this.scheduleQuakePulse();
    });
  }

  // La SCOSSA vera e propria: si deve PERCEPIRE (shake deciso + rombo) — poi stacca 1-3
  // stalattiti, preferendo quelle piu' vicine al giocatore (piu' probabile che le veda cadere).
  // Se sono finite, ogni tanto ne ripiazza una nuova (si ripopolano piano, non restano vuote
  // per il resto del livello).
  quakePulse() {
    this.cameras.main.shake(400, 0.014);
    window.Sfx.smash();
    if (!this.stalactites.length) {
      if (Math.random() < 0.4) this.addStalactite();
      return;
    }
    const sorted = this.stalactites.slice().sort((a, b) =>
      Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x));
    const n = Math.min(Phaser.Math.Between(1, 3), sorted.length);
    for (let i = 0; i < n; i++) this.detachStalactite(sorted[i]);
  }

  // Stacca UNA stalattite: distrugge lo sprite appeso e fa nascere al suo posto un chunk VERO
  // (stesso gruppo/sprite/tinta del round 1, solo velocita' iniziale leggermente maggiore —
  // parte gia' "smossa" dalla scossa, non da ferma) che cade con la fisica/danno gia' esistenti.
  detachStalactite(s) {
    const idx = this.stalactites.indexOf(s);
    if (idx === -1) return;
    this.stalactites.splice(idx, 1);
    const cx = s.x;
    const key = s.sprite.texture.key;
    s.sprite.destroy();
    const chunk = this.collapseChunks.create(cx, this.ceilingYAt(cx) + 4, key).setDepth(8);
    const src = this.textures.get(key).getSourceImage();
    chunk.setScale((window.CONFIG.BLOCK * 1.3) / src.width);
    chunk.setAngle(Phaser.Math.Between(-20, 20));
    if (Math.random() < 0.5) chunk.setFlipX(true);
    chunk.setTint(this._waxTint('hard', 1));
    chunk.body.setAllowGravity(true);
    chunk.body.setSize(24, 24, true);
    chunk.setVelocityY(60);
    this.time.delayedCall(5000, () => { if (chunk.active) chunk.destroy(); });   // rete di sicurezza
  }

  // Impatto della frana: danno ad area al cerume vicino (puo' aprire un varco), effetto
  // visivo, poi si distrugge. Guardia anti-doppio-impatto (piu' overlap nello stesso frame,
  // es. urta un blocco e una pedana insieme).
  collapseImpact(c) {
    if (!c.active) return;
    const R = 46;
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - c.x, b.y - c.y) < R) this.damageBlock(b, 26);
    });
    this.splat(c.x, c.y, 'hard');
    this.burst('bit_hard', c.x, c.y, 10);
    window.Sfx.smash();
    c.destroy();
  }

  // I blocchi che non incontrano cerume/pedane nella caduta atterrano a terra (come le gocce).
  updateCollapseChunks() {
    this.collapseChunks.getChildren().forEach((c) => {
      const surf = this.terrainTopAt(c.x);   // superficie LOCALE del terreno
      if (c.active && c.y >= surf - 6) {
        this.splat(c.x, surf - 8, 'hard');
        this.burst('bit_hard', c.x, surf - 8, 6);
        c.destroy();
      }
    });
  }

  // EVENTO "Sciame Improvviso": invece del solito flusso regolare, un'ondata unica di nemici
  // deboli arriva tutta insieme da un lato — un picco di caos concentrato. Rispetto a
  // spawnSplitChildren i "figli" qui sono nemici normali (niente comparsa istantanea, emergono
  // dal suolo come sempre) solo con statistiche ridotte, e usano l'IA normale del blob.
  startSwarmRushEvent() {
    const delay = Phaser.Math.Between(3000, 6000);
    this.time.delayedCall(delay, () => { if (!this.locked) this.spawnSwarmRush(); });
  }

  spawnSwarmRush() {
    const lvl = window.GameState.level;
    const side = Math.random() < 0.5 ? 1 : -1;
    // Centro del gruppo scelto con pickGroundX(side): resta DENTRO la sezione raggiungibile
    // (tra le membrane), cosi' il gruppo non rischia di comparire oltre un muro intero e
    // restare bloccato (lo stesso problema gia' corretto per il Fuggitivo Dorato).
    const baseX = this.pickGroundX(side);
    const count = Phaser.Math.Between(5, Math.min(8, 5 + Math.floor(lvl / 3)));
    this.showBanner(window.I18n.t('event_swarmrush_in'), '#9be870');
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Clamp(baseX + Phaser.Math.Between(-70, 70), 60, this.worldW - 60);
      const e = this.spawnEnemy('blob', { x, swarmling: true });
      e.swarmling = true;
      // Individualmente deboli (il picco di minaccia e' il NUMERO, non la singola unita').
      e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * 0.55));
      e.speed = Math.round(e.speed * 1.15);
      e.waxValue = Math.round(e.waxValue * 0.7);
    }
  }

  // Garantisce un minimo di pickup-CURA per livello (la vita non si ricarica piu' a fine
  // livello): se le pedane non ne hanno prodotti abbastanza a caso, ne aggiunge su pedane
  // libere. Cosi' ci si cura esplorando, ma senza restare mai a secco di cure.
  ensureHealPickups() {
    const want = 2 + Math.floor(window.GameState.level / 4);
    let have = this.pickups.getChildren().filter((p) => p.active && p.isHeal).length;
    const plats = this.platforms ? this.platforms.getChildren().filter((p) => p.active).slice() : [];
    Phaser.Utils.Array.Shuffle(plats);
    for (let i = 0; i < plats.length && have < want; i++) {
      this.addWaxPickup(plats[i].x, plats[i].y - 26, true);
      have++;
    }
  }


  // Trova una fascia orizzontale libera (lontana da membrane e da altre pozze/ostacoli
  // gia' piazzati) per un nuovo elemento largo `w`. Ritorna null se non trova posto.
  pickHazardX(w, margin) {
    margin = margin || 0;
    for (let tries = 0; tries < 20; tries++) {
      const x = Phaser.Math.Between(280, this.worldW - 320 - w);
      const cx = x + w / 2;
      const nearMembrane = this.membraneXs.some((mx) => Math.abs(mx - cx) < 150 + margin);
      const nearZone = (this.slimeZones || []).some((z) => x < z.x2 + 60 && x + w > z.x1 - 60);
      if (!nearMembrane && !nearZone) return x;
    }
    return null;
  }


  addSlimeZone() {
    const w = Phaser.Math.Between(90, 170);
    // Cerca un tratto abbastanza piatto: la pozza su un terreno ripido si deforma male. Fino a
    // 8 tentativi; se non lo trova, salta (meglio una pozza in meno che una brutta).
    let x = null;
    for (let tries = 0; tries < 8; tries++) {
      const cand = this.pickHazardX(w);
      if (cand == null) return;
      if (this.terrainFlatEnough(cand, w, 22)) { x = cand; break; }
    }
    if (x == null) return;
    // La patina SEGUE il profilo del terreno (prima era una barra dritta: su una pendenza
    // restava staccata dal suolo). Aspetto e luccichii: GameGfx.paintSlick.
    window.GameGfx.paintSlick(this, x, x + w, (px) => this.terrainTopAt(px));
    this.slimeZones.push({ x1: x, x2: x + w });
  }

  // Texture "goccia" a lacrima (punta in alto, pancia rotonda in basso). Segnaposto finche'
  // non avremo uno sprite dedicato per la goccia/l'emettitore.
  makeDripTexture() {
    if (this.textures.exists('drip')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xe8a32a, 1);
    g.fillCircle(7, 15, 6);                       // pancia rotonda (basso)
    g.fillTriangle(7, 1, 2.5, 14, 11.5, 14);      // punta (alto)
    g.fillStyle(0xffd98a, 0.85); g.fillCircle(5, 12, 1.8);   // riflesso
    g.generateTexture('drip', 14, 22);
    g.destroy();
  }

  // Emettitore di GOCCE ATTACCATO AL SOFFITTO: una "radice" di cerume incollata al bordo alto,
  // sotto cui una goccia (a lacrima) si GONFIA (telegrafo) e poi CADE. La caduta ferisce il
  // giocatore (overlap in this.movers). Verticale e leggibile: si schiva leggendo il ritmo.
  addDripHazard() {
    this.makeDripTexture();
    const x = this.pickHazardX(40, 20);
    if (x == null) return;
    const cx = x + 20, topY = Math.max(0, this.ceilingYAt(x + 20) - 6);   // attaccato al soffitto LOCALE
    // radice: macchia di cerume larga e piatta incollata al soffitto
    const root = this.add.ellipse(cx, topY + 5, 30, 16, 0xcf9524, 0.96).setDepth(8);
    root.setStrokeStyle(1.5, 0xffd98a, 0.6);
    // goccia che pende sotto la radice (cresce durante il gonfiore)
    const bead = this.add.image(cx, topY + 15, 'drip').setDepth(8).setScale(0.5);
    this.drips.push({ x: cx, topY, root, bead, state: 'idle', nextAt: this.time.now + Phaser.Math.Between(500, 2200), swellUntil: 0 });
  }

  // Rilascia una goccia (a lacrima) che cade con la gravita' del mondo. Entra in this.movers.
  releaseDrip(d) {
    const drop = this.movers.create(d.x, d.topY + 22, 'drip').setDepth(8).setScale(1.1);
    drop.body.setAllowGravity(true);
    drop.body.setSize(10, 16, true);
    drop.setVelocityY(30);
    this.time.delayedCall(4000, () => { if (drop.active) drop.destroy(); });
  }

  // Ciclo degli emettitori (attesa -> gonfiore/telegrafo -> rilascio) + splash delle gocce a terra.
  updateDrips(now) {
    if (this.drips) {
      this.drips.forEach((d) => {
        if (d.state === 'idle') {
          if (now >= d.nextAt) { d.state = 'swell'; d.swellUntil = now + 640; }
        } else {
          const t = Phaser.Math.Clamp(1 - (d.swellUntil - now) / 640, 0, 1);   // 0..1 gonfiore
          d.bead.setScale(0.5 + t * 0.7);           // la goccia pende e si gonfia (telegrafo)
          d.bead.y = d.topY + 15 + t * 8;           // si allunga verso il basso
          if (now >= d.swellUntil) {
            this.releaseDrip(d);
            d.bead.setScale(0.5); d.bead.y = d.topY + 15;
            d.state = 'idle';
            d.nextAt = now + Phaser.Math.Between(1500, 2800);
          }
        }
      });
    }
    if (this.movers) {
      this.movers.getChildren().forEach((m) => {
        const surf = this.terrainTopAt(m.x);   // superficie LOCALE del terreno
        if (m.active && m.y >= surf - 4) { this.splat(m.x, surf - 6, 'soft'); m.destroy(); }
      });
    }
  }

  // Pallina di cerume da raccogliere (premia chi sale sulle pedane). Ondeggia leggera.
  // heal=true: pallina rosata che invece di cerume cura un po' di vita (rara, negli scrigni).
  addWaxPickup(x, y, heal) {
    // ⚠️ LA TEXTURE SI CREA QUI, NON IN UN PASSO DELL'AVVIO. Prima stava dentro
    // agganciaProiettiliEGetto, che e' il SETTIMO passo di create(); ma le cure nascono nel
    // SECONDO (costruisciIlCondotto costruisce il livello e ci mette dentro i pickup). Alla
    // prima run dell'app la texture non esisteva ancora e la croce non si vedeva; dalla seconda
    // in poi sì, perche' le texture sopravvivono al cambio di scena. Da qui il difetto
    // segnalato: "all'avvio non si vede, ma se faccio un'altra run senza riavviare l'app sì".
    // Chiamandola nel punto in cui SERVE il problema non puo' tornare riordinando create():
    // makeCuraTexture esce subito se la texture c'e' gia', quindi costa una verifica e basta.
    if (heal) this.makeCuraTexture();
    // La cura ha una texture SUA (croce bianca su rosso), non il cerume ritinto: vedi
    // makeCuraTexture per il perche' la tinta non poteva funzionare.
    const p = this.pickups.create(x, y, heal ? 'cura' : 'wax_glob').setDepth(7);
    p.body.setAllowGravity(false);
    p.body.setSize(14, 14, true);
    if (heal) { p.isHeal = true; p.waxValue = 2; p.healValue = window.CONFIG.CURA_PICKUP; }
    else p.waxValue = 5;
    this.tweens.add({ targets: p, y: y - 6, yoyo: true, repeat: -1, duration: 750, ease: 'Sine.inOut' });
  }

  // Pallina di cerume lasciata da un nemico alla morte (F.1b): come addWaxPickup ma con
  // valore VARIABILE (quello del nemico, non il fisso 5 delle pedane) + un piccolo "pop" di
  // comparsa (parte piu' piccola e cresce), per segnalare che e' appena spuntata dal nemico.
  dropWaxPellet(x, y, value) {
    const p = this.pickups.create(x, y, 'wax_glob').setDepth(7).setScale(0.4);
    p.body.setAllowGravity(false);
    p.body.setSize(14, 14, true);
    p.waxValue = value;
    this.tweens.add({ targets: p, scale: 1, duration: 160, ease: 'Back.out' });
    this.tweens.add({ targets: p, y: y - 6, yoyo: true, repeat: -1, duration: 750, ease: 'Sine.inOut', delay: 160 });
  }

  grabPickup(pk) {
    if (!pk || !pk.active) return;
    window.GameState.wax += Math.round(pk.waxValue * (window.GameState.player.waxMult || 1) * (this.mutWaxMult || 1) * window.CONFIG.WAX_GAIN);   // Cerume Extra + mutatore + manopola globale
    if (pk.isHeal) {
      const pl = window.GameState.player;
      pl.hp = Math.min(pl.maxHp, pl.hp + pk.healValue);
      this.healFx(pk.x, pk.y);
    }
    window.Sfx.crack();
    this.burst('bit_wax', pk.x, pk.y, 6);
    pk.destroy();
  }







  // Animazione "fluida" del cerume: la superficie ONDEGGIA dolcemente (sinusoidi sfasate per
  // pezzo) e le gocce COLANO (si allungano/ritirano). Con la fusione del waxLayer la massa
  // sembra un liquido vivo invece di un blocco fermo. Chiamata da update().
  // Ondeggio del cerume SOLO QUANDO COLPITO: ogni pezzo colpito (e i vicini, vedi
  // wobbleWaxNear) riceve un impulso che oscilla e DECADE, poi torna fermo. Niente
  // movimento costante. Chiamata in update().
  animateWax(time) {
    if (!this.blocks) return;
    const now = time, DUR = 520;
    const kids = this.blocks.getChildren();
    for (let i = 0; i < kids.length; i++) {
      const b = kids[i];
      if (!b.active || !b.waxImg) continue;
      const img = b.waxImg;
      if (b.waxHitAt) {
        const e = now - b.waxHitAt;
        if (e < DUR) {
          const amp = 1 - e / DUR;                       // decade a zero
          const w = Math.sin(e * 0.045 + b.waxSeed) * amp;
          img.x = b.waxBaseX + w * 3.0;
          img.y = b.waxBaseY + Math.cos(e * 0.038 + b.waxSeed) * amp * 4.0;
          img.scaleX = b.waxBaseS * (1 + w * 0.07);
          img.scaleY = b.waxBaseS * (1 - w * 0.07);
          if (b.waxDrip) b.waxDrip.scaleY = b.waxDripBaseS * (1 + amp * 0.3);
          continue;
        }
        b.waxHitAt = 0;                                  // finito -> riposo
        img.x = b.waxBaseX; img.y = b.waxBaseY; img.scaleX = b.waxBaseS; img.scaleY = b.waxBaseS;
        if (b.waxDrip) b.waxDrip.scaleY = b.waxDripBaseS;
      }
    }
  }

  // Dà l'impulso di ondeggio ai pezzi di cerume vicini al punto colpito (onda d'urto locale).
  wobbleWaxNear(x, y) {
    if (!this.blocks) return;
    const now = this.time.now, R = 74;
    this.blocks.getChildren().forEach((o) => {
      if (!o.active || !o.waxImg) return;
      if (Math.abs(o.x - x) < R && Math.abs(o.y - y) < R) o.waxHitAt = now;
    });
  }

  // GRAVITÀ A CELLE: dopo aver pulito un blocco, i blocchi della colonna che stanno sopra
  // SCENDONO a riempire i vuoti (verso il pavimento), così una membrana pulita alla base
  // COLLASSA in un cumulo. I blocchi "da soffitto" (ceiling) NON cadono (restano appesi).
  settleWaxColumn(col) {
    const B = window.CONFIG.BLOCK;
    // La riga 0 di QUESTA colonna poggia sulla superficie LOCALE del terreno (come in
    // addWaxBlock): senza questo il cerume che collassa tornava alla vecchia quota piatta 360.
    const colBase = this.terrainTopAt(col * B + B / 2);
    const inCol = this.blocks.getChildren()
      .filter((b) => b.active && b.col === col && !b.ceiling)
      .sort((a, b) => a.row - b.row);
    let target = 0, moved = false;
    inCol.forEach((b) => {
      if (b.row !== target) {                          // c'è un vuoto sotto: cade
        b.row = target;
        const newY = colBase - target * B - B / 2;
        b.y = newY; b.refreshBody();                   // fisica (collider) subito alla nuova quota
        const newBaseY = newY + (b.waxOY || 0);
        b.waxBaseY = newBaseY;
        if (b.waxImg && !b.waxHitAt) this.tweens.add({ targets: b.waxImg, y: newBaseY, duration: 170, ease: 'Quad.in' });
        else if (b.waxImg) b.waxImg.y = newBaseY;
        if (b.waxDrip) this.tweens.add({ targets: b.waxDrip, y: newY + B * 0.3, duration: 170, ease: 'Quad.in' });
        moved = true;
      }
      target++;
    });
    if (moved) this.drawWaxBase();
  }

  splat(x, y, type) { window.GameGfx.splat(this, x, y, type); }

  // Sceglie a caso un tipo di nemico tra quelli sbloccati al livello attuale.
  chooseEnemyKind() {
    const lvl = window.GameState.level;
    const pool = [['blob', 5]];
    if (lvl >= 2) pool.push(['crust', 3]);
    if (lvl >= 2) pool.push(['flea', 3]);    // presto in partita: fastidiosa, poco minacciosa
    if (lvl >= 3) pool.push(['spit', 2]);
    if (lvl >= 3) pool.push(['hopper', 2]);  // dal lvl 3: minaccia seria, balzo enorme
    if (lvl >= 4) pool.push(['fly', 2]);
    let total = 0;
    pool.forEach((p) => { total += p[1]; });
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i][1];
      if (r < 0) return pool[i][0];
    }
    return 'blob';
  }

  // LA SCHEDA DI UN NEMICO: statistiche di partenza per tipo, scalate col livello, poi adattate
  // dal modificatore del livello e dal grado di infezione scelto per la run.
  // ⚠️ Le manopole globali (`VITA_NEMICI`, `DANNO_NEMICI`) si applicano QUI e in un punto solo:
  // se venissero applicate piu' avanti si moltiplicherebbero anche sui bonus delle varianti.
  schedaDelNemico(kind, lvl) {
    // Tabella dei tipi di nemico (statistiche scalate col livello).
    let cfg;
    if (kind === 'crust') {
      // ⚠️ TRE BASTONATE COL COLPO BASE (scelta dell'utente, 2026-08-19). Il danno base e' 39
      // (26 x DANNO_PG 1,5, senza acquisti al negozio), quindi servono PIU' DI 78 punti vita.
      // Con i vecchi 60+lvl*6 la crosta ne aveva 53 al livello 1 e cadeva in due colpi.
      // La crescita per livello e' stata abbassata da 6 a 4 apposta: con 6 sarebbe passata a
      // quattro bastonate gia' a meta' run, e la scelta era "tre", non "sempre di piu'".
      // Misurato dopo: 3 colpi dal livello 1 al 12, 4 dal 13 in poi (quando il giocatore ha
      // gia' pescato carte di danno).
      // ⚠️ Vale anche per il GETTO: la crosta e' piu' dura in assoluto, non solo di mazza.
      cfg = { tex: 'enemy_crust', hp: 96 + lvl * 4, speed: 46, dmg: 16 + lvl * 2, wax: 8, bit: 'bit_dirt', body: [26, 22], scale: 1.6 };
    } else if (kind === 'fly') {
      cfg = { tex: 'enemy_fly', hp: 24 + lvl * 3, speed: 88 + lvl * 4, dmg: 10 + lvl * 2, wax: 7, bit: 'bit_wax', body: [24, 18], fly: true };
    } else if (kind === 'spit') {
      cfg = { tex: 'enemy_spit', hp: 45 + lvl * 5, speed: 28, dmg: 12 + lvl, wax: 9, bit: 'bit_dirt', body: [26, 24], spit: true, projDmg: 9 + lvl * 2, spitEvery: 2200 };
    } else if (kind === 'boss') {
      cfg = { tex: 'enemy_boss', hp: 420 + lvl * 40, speed: 34, dmg: 20 + lvl * 2, wax: 60 + lvl * 6, bit: 'bit_hard', body: [60, 54], spit: true, projDmg: 12 + lvl * 2, spitEvery: 1500, boss: true };
      // UN BOSS DIVERSO PER OGNI TRATTO DI 5 LIVELLI (richiesta dell'utente 2026-07-27). Prima
      // era sempre lo stesso Tappo con piu' vita: dal secondo incontro in poi non c'era piu'
      // niente da imparare. Ora ognuno chiede una cosa diversa al giocatore.
      cfg.bossKind = (lvl >= window.CONFIG.RUN_LEVELS) ? 'gran' : (lvl >= 10 ? 'regina' : 'tappo');
      if (cfg.bossKind === 'regina') {
        cfg.tex = 'enemy_boss_regina';          // disegno dedicato (2026-07-28)
        // REGINA DELLE CROSTE: corazzata contro il GETTO, va affrontata da vicino. Non salta:
        // CARICA in orizzontale. Piu' veloce e meno grossa, cosi' la carica si legge come tale.
        cfg.hp = Math.round(cfg.hp * 0.85);      // meno vita: il corpo a corpo fa meno danno al secondo
        cfg.speed = 46;
        cfg.spitEvery = 2100;
        cfg.bossArmor = true;
      }
      if (this.isFinale) { cfg.hp = Math.round(cfg.hp * 1.7); cfg.wax = Math.round(cfg.wax * 1.5); }   // A.2: il GRAN TAPPO
    } else if (kind === 'flea') {
      // Pulce: piccola, debole, salta di CONTINUO verso il giocatore (non un singolo affondo
      // come il cerumino) - fastidiosa piu' che pericolosa, presto in partita per varieta'.
      cfg = { tex: 'enemy_flea', hp: 14 + lvl * 2, speed: 40, dmg: 6 + lvl, wax: 3, bit: 'bit_wax', body: [16, 14] };
    } else if (kind === 'hopper') {
      // Saltatore: un balzo enorme e telegrafato (molto piu' del cerumino), atterraggio ad
      // onda d'urto - minaccia seria, dal livello 3.
      cfg = { tex: 'enemy_hopper', hp: 55 + lvl * 6, speed: 30, dmg: 16 + lvl * 2, wax: 10, bit: 'bit_dirt', body: [30, 24], scale: 1.3 };
    } else {
      cfg = { tex: 'enemy_blob', hp: 30 + lvl * 4, speed: 72 + lvl * 3, dmg: 11 + lvl * 2, wax: 5, bit: 'bit_wax', body: [26, 22], scale: 1.6 };
    }

    // MODIFICATORE di livello (+ INFEZIONE, round A A.5): adatta le statistiche del nemico appena
    // create. mutEnemyDmg tocca sia il contatto sia il proiettile (di norma 1: lo alza l'infezione).
    cfg.speed = Math.round(cfg.speed * (this.mutEnemySpeed || 1));
    cfg.hp = Math.max(1, Math.round(cfg.hp * (this.mutEnemyHp || 1) * window.CONFIG.VITA_NEMICI));
    cfg.wax = Math.round(cfg.wax * (this.mutEnemyWax || 1));
    const dannoNem = (this.mutEnemyDmg || 1) * window.CONFIG.DANNO_NEMICI;
    cfg.dmg = Math.max(1, Math.round(cfg.dmg * dannoNem));
    if (cfg.projDmg) cfg.projDmg = Math.max(1, Math.round(cfg.projDmg * dannoNem));
    return cfg;
  }

  // Da quanto e' GRANDE il disegno ricava scala e hitbox. Le due cose sono separate apposta:
  // `dispH` e' quanto si vede a schermo, `hbW/hbH` e' quanto si tocca — cosi' l'immagine si puo'
  // cambiare senza toccare il gioco, ed e' esattamente quello che e' servito quando cerumino e
  // crosta sono stati alzati perche' i colpi in piedi li prendessero.
  misuraDallArte(cfg) {
    // ART (round B.2): gli sprite nemici sono immagini AI, di dimensioni diverse dalle vecchie
    // texture pixel. Ricalcolo scala e hitbox dalla TEXTURE caricata: `dispH` = altezza a schermo
    // voluta (~come prima), `hbW/hbH` = hitbox nel MONDO (invariata rispetto a prima). Cosi' fisica
    // e feel restano quelli, cambia solo l'immagine. `_artW/_artH` servono ad ancorare il corpo in
    // BASSO (i piedi a terra): le nuove immagini sono RITAGLIATE, senza il bordo trasparente che
    // sui vecchi sprite assorbiva l'offset. NB: cfg.scale qui e' la scala RISULTANTE, usata da
    // targetScale/elite-tank/split come prima.
    const ART = {
      // ⚠️ CERUMINO E CROSTA SONO PIU' ALTI DEGLI ALTRI, e non e' un capriccio: sono gli unici due
      // che si devono poter colpire STANDO IN PIEDI. Dal 2026-08-03 i colpi partono dall'ugello
      // dell'arma invece che dal centro del corpo, quindi volano a 51px dal suolo invece che a 26:
      // con i 34px di corpo che avevano prima ci passavano sopra di 12px (segnalato nel playtest).
      // Alzati quel tanto che basta perche' il colpo prenda, non di piu'. Per tutti gli ALTRI
      // nemici restare bassi e' voluto: doversi abbassare per colpirli e' parte del gioco
      // (scelta dell'utente).
      enemy_blob:   { dispH: 52, hbW: 40, hbH: 46 },
      enemy_crust:  { dispH: 52, hbW: 40, hbH: 46 },
      // GORGOGLIANTE ALZATO (playtest 2026-08-18: "i colpi passano sopra la testa").
      // ⚠️ MISURATO, non stimato: il colpo accovacciato occupa da 37 a 51 sopra il suolo,
      // quello in piedi da 44 a 58. Con la testa a 26 il getto gli passava sopra in TUTTE
      // e due le pose: contro di lui il getto non serviva a niente, restava solo il coton
      // fioc. Portandolo a 40 lo prende il colpo accovacciato (40 > 37) e continua a NON
      // prenderlo quello in piedi (40 < 44), che e' il senso del nemico basso: per colpirlo
      // ti devi abbassare. Il disegno cresce in proporzione, se no la sagoma che si tocca
      // sarebbe piu' grande di quella che si vede.
      enemy_spit:   { dispH: 48, hbW: 30, hbH: 40 },
      // Moscerino: hitbox allargata (26x20 -> 34x28) e sagoma un filo piu' grande. Erano
      // "troppo difficili da colpire" (playtest 2026-07-29): un bersaglio che vola, ondeggia e
      // ha anche il corpo piccolo diventa frustrante invece che impegnativo.
      enemy_fly:    { dispH: 44, hbW: 34, hbH: 28 },
      enemy_flea:   { dispH: 34, hbW: 20, hbH: 16 },
      enemy_hopper: { dispH: 52, hbW: 40, hbH: 30 },
      enemy_boss:   { dispH: 96, hbW: 64, hbH: 56 },
      // La Regina e' larga e bassa (carica in orizzontale): stessa altezza a schermo del Tappo
      // ma corpo piu' largo e piu' schiacciato, come dice la sua silhouette.
      enemy_boss_regina: { dispH: 96, hbW: 78, hbH: 50 },
    };
    const art = ART[cfg.tex];
    if (art && this.textures.exists(cfg.tex)) {
      // Frame 0 e non l'immagine sorgente: per uno SPRITE SHEET (il cerumino, dal 2026-07-27)
      // l'immagine e' larga 12 celle, e prendere la sua larghezza sballerebbe l'ancoraggio della
      // hitbox. Per uno sprite singolo il frame 0 E' l'immagine intera, quindi non cambia nulla.
      const fr = this.textures.get(cfg.tex).get(0);
      const sc = art.dispH / fr.height;
      cfg.scale = sc;
      cfg.body = [Math.max(4, Math.round(art.hbW / sc)), Math.max(4, Math.round(art.hbH / sc))];
      cfg._artW = fr.width; cfg._artH = fr.height;
    }
  }

  // Le due cose che cambiano un nemico normale: essere FIGLIO di uno sdoppiamento (piu' debole)
  // o essere una variante ELITE (corazzato, esplosivo, si sdoppia).
  // ⚠️ Vanno DOPO la scheda e DOPO le misure, perche' toccano anche la scala: farlo prima
  // significherebbe che il calcolo della hitbox se le mangia.
  applicaVarianti(cfg, kind, opts, lvl) {
    // FIGLIO DELLO SPLIT: piu' piccolo, debole E MENO DANNOSO del genitore (due figli ~= un
    // genitore anche come minaccia: senza ridurre anche il danno, due figli farebbero insieme
    // il doppio del danno del genitore invece che l'equivalente).
    if (opts.splitChild) {
      cfg.hp = Math.max(1, Math.round(cfg.hp * 0.4));
      cfg.dmg = Math.max(1, Math.round(cfg.dmg * 0.4));
      if (cfg.projDmg) cfg.projDmg = Math.max(1, Math.round(cfg.projDmg * 0.4));
      cfg.wax = Math.max(1, Math.round(cfg.wax * 0.5));
      cfg.scale = (cfg.scale || 1) * 0.7;
    }

    // VARIANTE ELITE (dal lvl 3): a volte un nemico normale e' potenziato. Modifica cfg PRIMA
    // del calcolo scala/posizione; l'aura e i comportamenti di morte si agganciano dopo (sotto).
    // I volanti restano fuori dallo SPLIT (la comparsa "sul posto" dei figli non si presta al
    // calo dal soffitto).
    // Dal livello 6 e non piu' dal 3 (richiesta dell'utente 2026-07-27): i nemici potenziati
    // entrano in scena nel SECONDO tratto della run, dopo il primo boss. Il primo tratto resta
    // pulito e serve a imparare i nemici base.
    let elite = null;
    if (!cfg.boss && !opts.splitChild && !opts.fugitive && !opts.swarmling && lvl >= 6 &&
        Math.random() < Phaser.Math.Clamp(0.08 + lvl * 0.02, 0, 0.34)) {
      const pool = (kind === 'fly') ? ['tank', 'boom'] : ['tank', 'boom', 'split'];
      elite = Phaser.Utils.Array.GetRandom(pool);
      if (elite === 'tank') {          // CORAZZATO: grosso, tanta vita, lento, piu' cerume
        cfg.hp = Math.round(cfg.hp * 2.2);
        cfg.speed = Math.round(cfg.speed * 0.82);
        cfg.dmg = Math.round(cfg.dmg * 1.2);
        cfg.wax = Math.round(cfg.wax * 1.9);
        cfg.scale = (cfg.scale || 1) * 1.25;
      } else if (elite === 'boom') {   // ESPLOSIVO: scoppia morendo (vedi enemyExplode)
        cfg.hp = Math.round(cfg.hp * 1.25);
        cfg.wax = Math.round(cfg.wax * 1.5);
      } else {                         // SPLIT: leggero bonus, il premio vero e' sdoppiarsi alla morte
        cfg.hp = Math.round(cfg.hp * 1.15);
        cfg.wax = Math.round(cfg.wax * 1.3);
      }
    }
    return elite;
  }

  // DOVE nasce: i volanti calano dal soffitto, gli altri escono dal terreno lontano dal
  // giocatore, il boss verso il timpano. Restituisce anche `surfY` (la quota del terreno IN
  // QUEL PUNTO, che con le colline non e' una costante) e la scala finale, che servono
  // all'animazione di comparsa.
  posizioneDiNascita(cfg, opts) {
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    // Posizione di comparsa: i volanti calano dal soffitto, gli altri emergono dal
    // terreno in punti lontani dal giocatore (il boss esce verso destra).
    const groundTop = H - gh;
    const targetScale = cfg.scale || 1;
    let x, y, surfY = groundTop;                 // surfY = superficie LOCALE del terreno sotto lo spawn
    if (cfg.fly) {
      // Cala dal soffitto a distanza onesta dal giocatore (mai addosso alla partenza),
      // di solito davanti a lui verso il timpano.
      const camW = this.cameras.main.width;
      const ahead = Math.random() < 0.7 ? 1 : -1;
      x = Phaser.Math.Clamp(this.player.x + ahead * Phaser.Math.Between(camW * 0.30, camW * 0.5), 60, this.worldW - 60);
      y = -24;                                   // parte sopra lo schermo
    } else {
      // A terra: il boss fa la guardia al timpano in fondo; gli altri in posizione fissa
      // (guardiano di una membrana) o scelta automatica lontano dal giocatore.
      if (cfg.boss) x = Phaser.Math.Clamp(this.goalX - 260, 700, this.worldW - 200);
      else x = (opts.x !== undefined) ? Phaser.Math.Clamp(opts.x, 60, this.worldW - 60) : this.pickGroundX();
      // Qui passano TUTTI i nemici di terra, compresi quelli con la posizione imposta: e' l'unico
      // punto in cui la garanzia "non dentro il cerume" vale per tutti. Il boss e' escluso perche'
      // la sua posizione e' il presidio del timpano e non va spostata.
      if (!cfg.boss) x = this.scostaDalCerume(x);
      // L'hitbox scala con lo sprite: la quota di riposo usa l'altezza GIA' scalata sulla
      // superficie LOCALE del terreno (terrainTopAt), cosi' il corpo e lo sbuffo di comparsa
      // appoggiano sul terreno sotto x, non sulla vecchia linea piatta 360.
      surfY = this.terrainTopAt(x);
      // corpo ancorato in basso: la quota di riposo usa l'ALTEZZA A SCHERMO dello sprite (frame x
      // scala), non l'altezza della hitbox, cosi' i piedi appoggiano sul terreno.
      y = surfY - ((cfg._artH || cfg.body[1]) * targetScale) / 2;
    }
    return { x, y, surfY, targetScale };
  }

  // Fa nascere un nemico. E' una catena di passi, ognuno con un nome: la scheda del tipo, le
  // misure ricavate dal disegno, le varianti, la posizione. Poi si crea lo sprite, gli si
  // attaccano i valori decisi e parte l'animazione di comparsa.
  spawnEnemy(kind, opts) {
    opts = opts || {};
    const lvl = window.GameState.level;
    kind = kind || this.chooseEnemyKind();

    const cfg = this.schedaDelNemico(kind, lvl);
    this.misuraDallArte(cfg);
    const elite = this.applicaVarianti(cfg, kind, opts, lvl);
    const { x, y, surfY, targetScale } = this.posizioneDiNascita(cfg, opts);

    const e = this.enemies.create(x, y, cfg.tex).setDepth(cfg.boss ? 9 : 8);
    e.kind = kind;
    // Nemici ANIMATI: ognuno parte da un frame a caso, altrimenti un gruppo che compare insieme
    // si muove all'unisono e si vede che sono copie della stessa creatura.
    // Il boss ha due cicli diversi a seconda di CHI e' (Tappo o Regina): la tabella li tiene
    // separati, cosi' aggiungere il prossimo nemico animato resta una riga.
    const CICLO = {
      blob: 'blob_crawl', crust: 'crust_crawl', fly: 'fly_flap',
      flea: 'flea_walk', spit: 'spit_crawl',
      boss: (cfg.bossKind === 'regina') ? 'regina_walk' : 'boss_walk',
    };
    if (CICLO[kind] && this.anims.exists(CICLO[kind])) {
      e.play(CICLO[kind]);
      e.anims.setProgress(Math.random());
    }
    if (opts.guard !== undefined) { e.guard = true; e.homeX = opts.guard; e.guardRange = 430; }
    e.spawning = true;                            // ancora in fase di comparsa: inerte
    e.setCollideWorldBounds(true);
    if (!cfg.fly) e.setBounce(0.1);
    // GRAVITA' SPENTA finche' sta comparendo. Durante l'emersione il nemico e' `spawning`, e lo
    // snap al terreno lo SALTA apposta: se pero' la gravita' resta accesa il corpo CADE attraverso
    // il suolo e lo si vede sprofondare per qualche istante, per poi essere riacchiappato a fine
    // animazione (misurato fino a 24px sotto la superficie; segnalato dall'utente 2026-07-22).
    // La rimette this.endSpawn().
    e.body.setAllowGravity(false);
    if (cfg._artW) {
      // Hitbox ANCORATA IN BASSO nel fotogramma (i piedi del nemico a terra): le immagini AI sono
      // ritagliate, senza il bordo trasparente che sui vecchi sprite centrava il corpo.
      e.body.setSize(cfg.body[0], cfg.body[1]);
      e.body.setOffset((cfg._artW - cfg.body[0]) / 2, cfg._artH - cfg.body[1]);
    } else {
      e.body.setSize(cfg.body[0], cfg.body[1], true);
    }
    e.hp = cfg.hp; e.maxHp = cfg.hp;
    e.speed = cfg.speed;
    e.contactDamage = cfg.dmg;
    // ⚠️ Il cerume che lascia cadere un nemico passa da CONFIG.NEMICI_CERUME, che vale 3 da
    // quando pulire non paga piu' (vedi damageBlock): senza quel moltiplicatore il negozio
    // sarebbe diventato quasi irraggiungibile. Il FUGGITIVO dorato non passa di qui — il suo
    // valore e' scritto a parte ed e' gia' un premio grosso, triplicarlo lo renderebbe l'unica
    // fonte di guadagno che conta.
    e.waxValue = Math.round(cfg.wax * (window.CONFIG.NEMICI_CERUME || 1));
    e.bitKey = cfg.bit;
    e.knockUntil = 0;
    if (cfg.spit) {
      e.projDamage = cfg.projDmg;
      e.spitEvery = cfg.spitEvery;
      e.nextSpit = this.time.now + Phaser.Math.Between(700, cfg.spitEvery);
    }
    if (cfg.fly) {
      e.diveState = 'hover';                                    // stato IA volo (vedi flyAI)
      e.diveReadyAt = this.time.now + Phaser.Math.Between(1000, 1800);
      e.bobPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);    // sfasa l'ondeggio tra i moscerini
    }
    if (cfg.boss) {
      e.bossAtk = null;                                         // stato attacco balzo+schiacciata (vedi bossAI)
      e.slamReadyAt = this.time.now + Phaser.Math.Between(2500, 4000);   // niente slam nei primissimi istanti
      e.slamShadow = null;                                      // ombra a terra durante il balzo (round 2, D.1)
      e.finale = !!this.isFinale;                               // A.2: il GRAN TAPPO ha una terza fase (vedi bossAI)
      e.bossKind = cfg.bossKind || 'tappo';
      e._dannoBase = cfg.dmg;                                   // la carica lo alza e poi lo rimette
      e.bossArmor = !!cfg.bossArmor;                            // corazzata contro il getto (Regina)
      // (la Regina aveva una tinta azzurra come SEGNAPOSTO finche' condivideva il disegno del
      // Tappo: ora ha il suo, corazzato e scuro di suo, e la tinta non serve piu')
      e.once('destroy', () => { if (e.slamShadow) { e.slamShadow.destroy(); e.slamShadow = null; } });
    }

    // ELITE: il nemico CAMBIA COLORE. Prima era un cerchio colorato dietro di lui — un ripiego di
    // quando tutti i nemici erano identici, e a schermo sembrava un'interfaccia appiccicata sopra
    // al gioco (tolto su richiesta dell'utente, 2026-07-27). La tinta si moltiplica sull'immagine,
    // quindi la creatura resta riconoscibile ma vira: il Corazzato diventa freddo e metallico,
    // l'Esplosivo rosso acceso, quello che si sdoppia violaceo.
    // ⚠️ La tinta va anche RIMESSA dopo ogni lampo da colpo: vedi restoreTint in damageEnemy.
    if (elite) {
      e.elite = elite;
      e.eliteTint = window.GameScene.ELITE_TINT[elite];
      e.setTint(e.eliteTint);
      this.creaLavaggioElite(e);
    }

    // Comparsa animata (la scala finale dipende dal tipo: i PNG nativi vanno ingranditi).
    // I figli dello SPLIT compaiono con un "pop" istantaneo sul posto (il genitore e' appena
    // morto li': emergere da lontano non avrebbe senso).
    if (opts.splitChild) this.splitPop(e, targetScale);
    else if (cfg.fly) this.dropFromCeiling(e, targetScale);
    else this.emergeFromGround(e, targetScale, y, x, surfY, !!cfg.boss);
    return e;
  }

  // Quanti nemici "contano" per il tetto: solo quelli abbastanza vicini da poter dare fastidio.
  // Quelli rimasti indietro (tipicamente bloccati dietro una membrana ancora intera) non devono
  // impedire la comparsa di nuovi, o l'assedio si spegne da solo — succedeva davvero.
  nemiciVicini() {
    const raggio = this.cameras.main.width * 1.25;
    let n = 0;
    this.enemies.getChildren().forEach((e) => {
      if (e.active && Math.abs(e.x - this.player.x) <= raggio) n++;
    });
    return n;
  }

  // Nome del boss in campo, per i cartelli (furia, sconfitta, "batti il boss per passare").
  nomeBoss(e) {
    return window.I18n.t('boss_nome_' + this.tipoBoss(e));
  }

  // Quale boss e' in campo. Estratto da nomeBoss perche' serve anche al GENERE: la stessa
  // scelta fatta in due posti diversi prima o poi diverge.
  tipoBoss(e) {
    return (e && e.bossKind) || (window.GameState.level >= window.CONFIG.RUN_LEVELS ? 'gran'
      : (window.GameState.level >= 10 ? 'regina' : 'tappo'));
  }

  // Il cartello giusto per il boss in campo, accordato al suo genere. In italiano il participio
  // si accorda ("REGINA DELLE CROSTE: DISTRUTTA", non DISTRUTTO); in inglese le due varianti
  // sono identiche. Si chiede sempre quella col genere, cosi' il gioco non deve sapere in che
  // lingua sta parlando.
  cartelloBoss(chiave, e) {
    const g = window.I18n.t('boss_genere_' + this.tipoBoss(e));
    return window.I18n.t(chiave + '_' + (g === 'f' ? 'f' : 'm'), { nome: this.nomeBoss(e) });
  }

  // LAVAGGIO DI COLORE DELLE ELITE (playtest round 5: "poco riconoscibili, saturazione
  // disomogenea"). ⚠️ PERCHE' LA SOLA TINTA NON BASTAVA, E NON POTEVA BASTARE: `setTint` in
  // Phaser MOLTIPLICA il colore dell'immagine, e l'arte dei nemici e' AMBRA — tanto rosso, poco
  // blu. Moltiplicando non si puo' aggiungere colore che nel disegno non c'e': il "corazzato
  // azzurro" usciva marroncino. E ogni tipo di nemico partiva da un'ambra diversa, quindi
  // assorbiva la tinta in modo diverso: ecco da dove veniva la disomogeneita'.
  // (Provata anche la somma in modalita' ADD, e non risolve: anche li' il colore aggiunto e'
  // proporzionale ai pixel di partenza, quindi il blu resta quello che non c'era.)
  // LA SOLUZIONE: una COPIA della creatura resa in tinta piatta (`setTintFill`, cioe' la sua
  // sagoma riempita di un colore solo) e posata sopra a meta' trasparenza. Il colore cosi' non
  // dipende piu' da cosa c'era sotto — e' identico su tutti i nemici — e la creatura resta
  // leggibile perche' il disegno vero traspare comunque.
  creaLavaggioElite(e) {
    const col = window.GameScene.ELITE_LAVAGGIO[e.elite];
    if (!col) return;
    const a = this.add.sprite(e.x, e.y, e.texture.key, e.frame.name)
      .setOrigin(e.originX, e.originY)
      .setDepth(e.depth + 1);
    a.setTintFill(col);
    a.setAlpha(GameScene.ELITE_FORZA);
    e.eliteLavaggio = a;
    e.once('destroy', () => { if (e.eliteLavaggio) { e.eliteLavaggio.destroy(); e.eliteLavaggio = null; } });
    this.sincronizzaLavaggioElite(e);
  }

  // Il lavaggio e' uno sprite a se': deve ricalcare la creatura fotogramma per fotogramma,
  // altrimenti resta indietro appena il nemico si muove, si ribalta o cambia disegno.
  sincronizzaLavaggioElite(e) {
    const a = e.eliteLavaggio;
    if (!a) return;
    if (!e.active) { a.setVisible(false); return; }
    if (a.texture.key !== e.texture.key || a.frame.name !== e.frame.name) {
      a.setTexture(e.texture.key, e.frame.name);
      a.setTintFill(window.GameScene.ELITE_LAVAGGIO[e.elite]);   // cambiare texture azzera la tinta
    }
    a.setPosition(e.x, e.y);
    a.setScale(e.scaleX, e.scaleY);
    a.setFlipX(e.flipX);
    a.setAngle(e.angle);
    a.setVisible(e.visible);
    a.setAlpha(e.alpha * GameScene.ELITE_FORZA);
  }

  // Colore "di riposo" di un nemico: dorato se e' il Fuggitivo, il colore della variante se e'
  // elite, altrimenti nessuna tinta. Da chiamare al posto di clearTint() alla fine di OGNI
  // telegrafo lampeggiante, o le varianti colorate perdono il colore per sempre.
  ripristinaTinta(e) {
    if (!e || !e.active) return;
    e.clearTint();
    if (e.fugitive) e.setTint(0xfff0a8);
    else if (e.eliteTint) e.setTint(e.eliteTint);
  }

  // Fine della comparsa: da qui il nemico e' "vivo" e torna soggetto a gravita' e snap al terreno.
  // Va chiamata da OGNI animazione di comparsa (emersione, caduta dal soffitto, pop dello split).
  endSpawn(e) {
    if (!e || !e.body) return;
    e.spawning = false;
    if (e.kind !== 'fly') e.body.setAllowGravity(true);   // i volanti restano senza gravita'
  }

  // Comparsa istantanea per i figli dello SPLIT: pop rapido sul posto, niente emersione dal
  // terreno. Resta "spawning" (inerte) per una manciata di ms, come le altre comparse.
  splitPop(e, targetScale) {
    e.setScale(targetScale * 0.3);
    e.setAlpha(0.85);
    this.tweens.add({
      targets: e, scaleX: targetScale, scaleY: targetScale, alpha: 1,
      duration: 150, ease: 'Back.out',
      onComplete: () => this.endSpawn(e),
    });
  }

  // ESPLOSIVO: alla morte, un breve telegrafo poi uno scoppio ad area nel punto del corpo
  // (chi ha ucciso il nemico da vicino deve scansarsi). Fa danno solo al giocatore.
  enemyExplode(x, y) {
    const warn = this.add.circle(x, y, 12, 0xff6b3d, 0.5).setDepth(11);
    this.tweens.add({ targets: warn, scale: 5.5, alpha: 0.12, duration: 280, ease: 'Quad.in' });
    this.time.delayedCall(280, () => {
      if (warn.active) warn.destroy();
      const R = 74;
      const dmg = 14 + Math.floor(window.GameState.level / 2);
      const ring = this.add.circle(x, y, R, 0xff8a4a, 0.35).setDepth(12).setScale(0.3);
      this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => ring.destroy() });
      window.Sfx.smash();
      this.cameras.main.shake(180, 0.012);
      if (Math.hypot(this.player.x - x, this.player.y - y) < R) {
        this.hurtPlayer(dmg, x);
      }
      // Danno ad area anche a nemici e cerume vicini (prima colpiva SOLO il giocatore).
      // Se un altro Esplosivo muore nel raggio, scoppia a sua volta (reazione a catena voluta:
      // tema "esplosivo", niente da smorzare — il numero di nemici per livello e' comunque finito).
      this.enemies.getChildren().forEach((e) => {
        if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg);
      });
      this.blocks.getChildren().forEach((b) => {
        if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, dmg);
      });
    });
  }

  // Mette un nemico di guardia davanti ad alcune membrane piene: resta a presidiare
  // la membrana finche' il giocatore non si avvicina (vedi la logica "guard" in update).
  spawnGuardians() {
    const lvl = window.GameState.level;
    const ground = ['blob'];
    if (lvl >= 2) ground.push('crust');
    if (lvl >= 3) ground.push('spit');
    (this.membranes || []).forEach((m) => {
      if (m.type !== 'full') return;
      if (Math.random() < 0.25) return;            // non tutte ne hanno una
      const gx = m.x - 70;                         // appena prima della membrana
      const kind = Phaser.Utils.Array.GetRandom(ground);
      this.spawnEnemy(kind, { x: gx, guard: gx });
    });
  }

  // Sceglie un punto di spawn a terra DENTRO la "sezione" attuale del giocatore: cioe'
  // tra la membrana subito dietro e quella subito davanti. Cosi' i nemici possono
  // davvero raggiungerlo (non restano bloccati e ammucchiati contro una membrana) e
  // non compaiono mai addosso al giocatore.
  // preferSide: 1 = preferisci DAVANTI, -1 = preferisci DIETRO, omesso = peso normale 70/30
  // (usato dall'evento Sciame per far arrivare il gruppo "da un lato" restando comunque
  // dentro la sezione raggiungibile — vedi spawnSwarmRush).
  pickGroundX(preferSide) {
    const px = this.player.x;
    let left = 40, right = this.worldW - 40;
    (this.membraneXs || []).forEach((mx) => {
      if (mx <= px) { if (mx + 80 > left) left = mx + 80; }     // appena dopo la membrana dietro
      else { if (mx - 80 < right) right = mx - 80; }            // appena prima della membrana davanti
    });
    // Bordo raggiungibile PIU' LONTANO dal giocatore: il ripiego sicuro quando non c'e'
    // spazio per la distanza piena (mai piazzare un nemico ADDOSSO allo spawn).
    const farthestEdge = () => (Math.abs(left - px) >= Math.abs(right - px)) ? left : right;
    if (right <= left) return Math.round(Phaser.Math.Clamp(farthestEdge(), 40, this.worldW - 40));

    const gap = 200;                                            // distanza minima dal giocatore
    const aLo = Math.min(px + gap, right), aHi = right;         // davanti
    const bLo = left, bHi = Math.max(px - gap, left);           // dietro
    const aOk = aHi - aLo > 20, bOk = bHi - bLo > 20;
    const wantAhead = preferSide === 1 ? true : preferSide === -1 ? false : (Math.random() < 0.7);
    const scegli = () => {
      let x;
      if (aOk && (wantAhead || !bOk)) x = Phaser.Math.Between(aLo, aHi);
      else if (bOk) x = Phaser.Math.Between(bLo, bHi);
      else x = farthestEdge();                                  // sezione stretta: il punto piu' lontano, mai addosso
      // Rete di sicurezza: mai piu' vicino di 130px al giocatore, se la sezione lo consente
      // (prima il ripiego poteva far nascere un nemico sopra lo spawn → morte istantanea).
      if (Math.abs(x - px) < 130) x = farthestEdge();
      return x;
    };
    // Un nemico non deve nascere DENTRO un cumulo di cerume: ci resta incastrato a spingere
    // senza avanzare. Qui si scarta il punto occupato e se ne prova un altro; la garanzia vera
    // per TUTTI i nemici sta pero' in posizioneDiNascita (vedi scostaDalCerume), perche' questa
    // funzione non viene nemmeno chiamata quando la posizione e' imposta da fuori.
    let x = scegli();
    for (let tent = 0; tent < 8 && this.puntoOccupatoDalCerume(x); tent++) x = scegli();
    return Math.round(Phaser.Math.Clamp(x, left, right));
  }

  // C'e' un cumulo di cerume proprio dove appoggerebbe un nemico che nasce in `cx`?
  // ⚠️ REGOLA IN UN POSTO SOLO: prima questa condizione era scritta dentro pickGroundX e da li'
  // non poteva proteggere nessun altro. La stessa regola in due punti prima o poi diverge.
  puntoOccupatoDalCerume(cx) {
    return this.blocks.getChildren().some((b) => b.active
      && Math.abs(b.x - cx) < 30 && Math.abs(b.y - (this.terrainTopAt(cx) - 20)) < 46);
  }

  // Sposta il punto di nascita al primo posto libero vicino, se quello scelto e' dentro il cerume.
  // ⚠️ SERVE PERCHE' META' DEI NEMICI NON PASSA DA pickGroundX. Nascono a una posizione IMPOSTA
  // gli sciami (disposti attorno a un centro), i guardiani delle membrane, i nemici che si
  // sdoppiano morendo e il fuggitivo dorato: per tutti loro il controllo sul cerume non veniva
  // fatto, e finivano incastrati a spingere contro un cumulo senza avanzare (segnalato dai
  // tester il 2026-08-18).
  // Si SPOSTA invece di riprovare a caso: quelle posizioni vogliono dire qualcosa (il guardiano
  // sta davanti alla sua membrana, lo sciame sta insieme), e buttarle via le tradirebbe. Si
  // cerca alternandosi a destra e a sinistra, cosi' il nemico resta il piu' vicino possibile a
  // dove doveva stare. Se e' pieno dappertutto si tiene il punto originale: mai stare peggio.
  scostaDalCerume(x) {
    if (!this.puntoOccupatoDalCerume(x)) return x;
    for (let d = 26; d <= 260; d += 26) {
      for (const verso of [1, -1]) {
        const c = Phaser.Math.Clamp(x + verso * d, 60, this.worldW - 60);
        if (!this.puntoOccupatoDalCerume(c)) return c;
      }
    }
    return x;
  }

  // Il nemico sbuca dal pavimento: parte schiacciato a terra e "cresce" in altezza.
  // La gravità resta ATTIVA: il collider tiene il corpo appoggiato al pavimento mentre
  // lo sprite si allunga verso l'alto (così non sprofonda mai sotto la linea del terreno).
  emergeFromGround(e, targetScale, restY, x, groundTop, big) {
    // COMPARSA IN DUE TEMPI (rifatta 2026-07-31: "deve capirsi che escono dal suolo"). Prima
    // durava 380ms e il nemico si limitava ad allungarsi: sembrava comparso dal nulla, e per il
    // giocatore era un nemico che si materializzava addosso senza preavviso.
    // 1) il TERRENO SI GONFIA nel punto: una bolla di carne che cresce, con sbuffi di terra.
    //    Il nemico non c'e' ancora. E' anche un telegrafo onesto: dice DOVE sta per uscire.
    // 2) il nemico spinge fuori dalla bolla e si allunga fino alla sua statura.
    // In tutto ~1 secondo (1,5 per il boss) contro i 380ms di prima. Resta inerte per tutto il
    // tempo (e.spawning), quindi allungarla non rende il gioco piu' difficile: piu' facile.
    const GONFIO = big ? 520 : 380;
    const USCITA = big ? 980 : 620;

    e.setVisible(false);
    e.setScale(targetScale, targetScale * 0.08);
    e.setAlpha(0.9);
    // I PIEDI RESTANO A TERRA mentre cresce. L'immagine ha l'origine al centro: schiacciarla e
    // basta (com'era prima) lasciava il nemico a mezz'aria, all'altezza della sua vita, e a
    // schermo non sembrava che uscisse dal terreno ma che si srotolasse per aria. Alzando la y
    // insieme alla scala, il bordo inferiore resta appoggiato al suolo per tutta la salita.
    const mezzo = groundTop - restY;                 // meta' altezza a schermo, da spawnEnemy
    const quotaPer = (s) => groundTop - mezzo * s;   // s = frazione di statura raggiunta
    e.y = quotaPer(0.08);

    // ==========================================================================================
    // IL BUCO NEL TERRENO (rifatto al playtest round 5: "compare un ovale sopra il terreno, io
    // vorrei una forma che dia l'idea di qualcosa che esce dal sottosuolo").
    // Prima era una cupola che si GONFIAVA verso l'alto, e disegnata dietro a tutto: l'occhio la
    // leggeva come una bolla appoggiata sopra al pavimento, con la creatura che ci cresceva
    // davanti. Adesso ci sono due pezzi, e sono due pezzi diversi apposta:
    //   · il BUCO, scuro come il fondo della massa, che si allarga in ORIZZONTALE. Un'apertura
    //     che si dilata si legge come un varco; una cupola che si alza no.
    //   · il LABBRO, il bordo sollevato del buco, disegnato DAVANTI ALLA CREATURA (profondita'
    //     9,6 contro l'8 dei nemici). ⚠️ E' questo il pezzo che fa tutto il lavoro: finche' un
    //     pezzo di terreno COPRE la parte bassa del nemico, l'occhio conclude da solo che sta
    //     salendo da sotto. Sta sotto al giocatore (profondita' 10), quindi non lo nasconde mai.
    // Il labbro e' spostato in giu' di poco rispetto al buco: cosi' del buco resta scoperta la
    // falce superiore, che e' l'ombra dentro l'apertura.
    const C = window.GameGfx.CARNE;
    // larghezza presa dalla creatura stessa: il buco e' il varco da cui esce, quindi deve
    // starle attorno. Un valore fisso andava bene per la zanzara e diventava un francobollo
    // sotto al boss.
    const largo = e.displayWidth * 0.86;
    const rx = largo / 2, ry = largo * 0.30;
    // ⚠️ LE PROPORZIONI SONO IL PUNTO, e al primo tentativo erano sbagliate: il labbro era alto
    // quasi quanto il buco e centrato piu' in basso, quindi lo copriva quasi tutto e a schermo
    // restava un disco CHIARO sul pavimento invece di un'apertura scura (visto in una schermata
    // di prova). Adesso il labbro e' basso e spostato in giu': sporge sopra la linea del terreno
    // quel tanto che basta a coprire i piedi della creatura (e' quello che vende l'uscita da
    // sotto), e lascia scoperta la falce scura del buco, che e' il buio dentro l'apertura.
    const buco = this.add.ellipse(x, groundTop + 1, rx * 2, ry * 2, C.profondo, 1)
      .setDepth(4.4).setScale(0.12, 0.5);
    const labbro = this.add.ellipse(x, groundTop + 1 + ry * 0.5, rx * 2.04, ry * 1.5, C.crosta, 1)
      .setDepth(9.6).setStrokeStyle(2, C.bordo, 0.85).setScale(0.12, 0.5);
    this.tweens.add({ targets: [buco, labbro], scaleX: 1, scaleY: 1, duration: GONFIO, ease: 'Quad.out' });
    this.groundPuff(x, groundTop, big);
    this.schizzoDalBuco(x, groundTop, big);
    if (big) this.cameras.main.shake(260, 0.010);

    this.time.delayedCall(GONFIO, () => {
      if (!e.active) { buco.destroy(); labbro.destroy(); return; }
      e.setVisible(true);
      this.groundPuff(x, groundTop, big);
      if (big) this.cameras.main.shake(200, 0.008);
      // IL SUONO STA QUI, non all'inizio: e' uno "whoop" che sale, cioe' il verso di qualcosa che
      // SPUNTA. Suonarlo mentre il pavimento si sta ancora gonfiando lo faceva finire 800ms prima
      // che la creatura uscisse, e poi silenzio (difetto nato allungando la comparsa il 30/07).
      window.Sfx.emerge(big);
      this.schizzoDalBuco(x, groundTop, big);
      // Il buco si richiude DOPO che la creatura e' uscita, non mentre esce: se si chiudesse
      // subito, la parte bassa del nemico resterebbe scoperta a meta' salita e si tornerebbe a
      // vedere un nemico che cresce davanti al pavimento.
      this.tweens.add({ targets: [buco, labbro], scaleX: 0.1, scaleY: 0.35, alpha: 0,
        delay: USCITA * 0.72, duration: USCITA * 0.45, ease: 'Quad.in',
        onComplete: () => { buco.destroy(); labbro.destroy(); } });
      // qualche sbuffo lungo la salita, se no il movimento sembra un semplice ingrandimento
      [0.3, 0.62].forEach((q) => this.time.delayedCall(USCITA * q, () => {
        if (e.active) this.groundPuff(e.x, groundTop, false);
      }));
      this.tweens.add({
        targets: e, scaleY: targetScale, y: restY, alpha: 1,
        duration: USCITA, ease: 'Back.out',
        onComplete: () => {
          e.y = restY;                    // Back.out sfora: rimette i piedi esattamente a terra
          this.endSpawn(e);
          // assestamento gommoso
          this.tweens.add({ targets: e, scaleX: targetScale * 1.1, scaleY: targetScale * 0.9, yoyo: true, duration: 90 });
        },
      });
    });
  }

  // Il volante cala dal soffitto con un piccolo rimbalzo elastico.
  dropFromCeiling(e, targetScale) {
    const restY = Phaser.Math.Between(90, 170);
    e.setScale(targetScale * 0.5);
    e.setVelocity(0, 0);
    this.ceilingDrip(e.x, restY);
    window.Sfx.emerge(false);
    this.tweens.add({ targets: e, scaleX: targetScale, scaleY: targetScale, duration: 420, ease: 'Quad.out' });
    this.tweens.add({
      targets: e, y: restY, duration: 560, ease: 'Bounce.out',
      onComplete: () => this.endSpawn(e),
    });
  }

  // Sbuffo dal pavimento e filo di cerume dal soffitto: vedi GameGfx in src/gfx.js.
  groundPuff(x, groundTop, big) { window.GameGfx.groundPuff(this, x, groundTop, big); }

  // Schizzo di terriccio SCAGLIATO IN ALTO dal buco (playtest round 5: "aggiungerei effetti
  // particellari minimi"). Diverso dallo sbuffo tondo di groundPuff, che si allarga in tutte le
  // direzioni come una nuvola: qui i pezzi partono verso l'alto a ventaglio e ricadono, cioe' si
  // muovono come si muoverebbe della materia spinta fuori da sotto. Sono le due cose insieme a
  // vendere il colpo: la nuvola dice "qualcosa ha smosso il pavimento", lo schizzo dice "da sotto".
  schizzoDalBuco(x, groundTop, big) {
    const em = this.add.particles(x, groundTop - 2, 'bit_dirt', {
      speed: { min: 90, max: 240 },
      angle: { min: -150, max: -30 },   // ventaglio verso l'alto (in Phaser -90 e' dritto in su)
      lifespan: 620, scale: { start: 1, end: 0 }, gravityY: 900, emitting: false,
    }).setDepth(9.4);
    em.explode(big ? 16 : 8);
    this.time.delayedCall(900, () => em.destroy());
  }
  ceilingDrip(x, restY) { window.GameGfx.ceilingDrip(this, x, restY); }

  // Una pallina di cerume sputata da un nemico: vola in PARABOLA (cade per gravità)
  // mirando alla posizione attuale del giocatore. Curva = più realistica e schivabile.
  spitAt(e, aimOff) {
    // Gravita' REALE del mondo (non la costante CONFIG): il mutatore "poca gravita'" la cambia
    // a runtime, e la parabola deve tenerne conto o il proiettile sbaglia completamente mira.
    const g = this.physics.world.gravity.y;
    const dir = Math.sign(this.player.x - e.x) || 1;
    const sx = e.x + dir * 12, sy = e.y - 6;
    const dx = (this.player.x + (aimOff || 0)) - sx;
    const dy = (this.player.y - 8) - sy;
    const dist = Math.hypot(dx, dy);
    const T = Phaser.Math.Clamp(dist / 230, 0.65, 1.25);  // tempo di volo (piu' lungo = pallina piu' lenta)
    const vx = dx / T;
    const vy = (dy - 0.5 * g * T * T) / T;               // soluzione balistica
    const proj = this.projectiles.create(sx, sy, 'proj_poison').setDepth(9);
    proj.body.setAllowGravity(true);                     // cade in parabola
    proj.body.setSize(10, 10, true);
    proj.setVelocity(vx, vy);
    proj.setAngularVelocity(Phaser.Math.Between(-360, 360));  // rotea mentre vola
    proj.dmg = e.projDamage;
    window.Sfx.spit();
    this.time.delayedCall(3200, () => { if (proj.active) proj.destroy(); });
  }

  popProjectile(proj) {
    if (!proj || !proj.active) return;
    this.burst('bit_wax', proj.x, proj.y, 4);
    proj.destroy();
  }

  // Cartello a schermo per annunciare i livelli speciali: vedi GameGfx in src/gfx.js.
  showBanner(text, color, y) { window.GameGfx.showBanner(this, text, color, y); }

  showSpeech(text) { window.GameGfx.showSpeech(this, this.player.x, this.player.y - 46, text); }

  // CARATTERE COMICO: sceglie una battuta a caso dalla categoria e la mostra, rispettando un
  // cooldown GLOBALE (altrimenti spammerebbe, es. ad ogni uccisione) + una probabilita'
  // opzionale (`chance`) per le categorie che capitano spesso (uccisione, colpo subito) cosi'
  // non commenta OGNI singolo evento. `force` salta il cooldown (solo per inizio livello/boss:
  // altrimenti un'uccisione o un colpo nei primi istanti del livello gli "ruberebbe il turno"
  // prima che scatti, facendola sparire silenziosamente).
  maybeSpeech(category, chance, force) {
    const now = this.time.now;
    if (!force && now < (this.speechCooldownUntil || 0)) return;
    if (chance !== undefined && Math.random() > chance) return;
    const pool = window.SPEECH[category];
    if (!pool || !pool.length) return;
    this.speechCooldownUntil = now + 4500;
    this.showSpeech(window.I18n.t(Phaser.Utils.Array.GetRandom(pool)));
  }

  // ---------- Combattimento ----------

  // Texture procedurale della PALLINA CURA: nessun file, come quella del getto.
  // ⚠️ PERCHE' NON BASTA UNA TINTA. Prima la cura era la stessa immagine del cerume
  // (`wax_glob`) con `setTint(0xff8fae)` sopra, ed era "poco distinguibile" (playtest
  // 2026-08-16). Il motivo e' lo stesso gia' incontrato con le elite: setTint MOLTIPLICA i
  // colori, e su un disegno ambrato il rosa non si aggiunge, si spegne — restava una pallina
  // di cerume appena piu' scura in mezzo ad altre palline di cerume.
  // Qui la cura ha una FORMA sua: croce bianca su fondo rosso. Il colore da solo non basterebbe
  // comunque per chi distingue male i colori; la forma si legge sempre.
  makeCuraTexture() {
    if (this.textures.exists('cura')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const S = 18, c = S / 2;
    g.fillStyle(0x7a1226, 1); g.fillCircle(c, c, c);            // bordo scuro: stacca dal fondo
    g.fillStyle(0xe8304f, 1); g.fillCircle(c, c, c - 1.6);      // rosso pieno
    g.fillStyle(0xff8fa3, 0.85); g.fillCircle(c - 2.2, c - 2.4, 2.1);   // luce in alto a sinistra
    g.fillStyle(0xffffff, 1);                                    // croce
    g.fillRect(c - 1.6, c - 5, 3.2, 10);
    g.fillRect(c - 5, c - 1.6, 10, 3.2);
    g.generateTexture('cura', S, S);
    g.destroy();
  }

  // Texture procedurale per la pallina del getto (acqua e sapone): nessun file.
  makeSoapTexture() {
    if (this.textures.exists('soap')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x9fd8ff, 1); g.fillCircle(7, 7, 6);
    g.fillStyle(0xffffff, 0.85); g.fillCircle(5, 5, 2.4);
    g.generateTexture('soap', 14, 14);
    g.destroy();
  }

  // Spruzza un getto di acqua e sapone nella direzione di mira (8 direzioni):
  // pulisce il cerume e colpisce i nemici a distanza.
  fireJet(adx, ady) {
    const now = this.time.now;
    const p = window.GameState.player;
    if (now - this.lastShot < p.shotCooldown) return;
    this.lastShot = now;
    const d = Math.hypot(adx, ady) || 1;
    const nx = adx / d, ny = ady / d;
    this.showRangedWeapon(nx, ny);          // arma in mano puntata verso la mira
    const oy = this.crouching ? 14 : -6;   // accovacciato: il getto parte all'altezza dei piedi
    // Abilità RABBIA: se armata, TUTTE le palline di questo colpo (anche il ventaglio) fanno
    // piu' danno — un solo colpo "vale" da attacco unico, si consuma qui una volta sola.
    const rageMult = this.consumeRage();
    // Abilità VENTAGLIO (impilabile): spara N palline a ventaglio (N = p.jetPellets).
    const n = Math.max(1, p.jetPellets | 0);
    const a0 = Math.atan2(ny, nx);
    const step = 0.16;   // apertura tra una pallina e l'altra
    for (let i = 0; i < n; i++) {
      const da = (i - (n - 1) / 2) * step;   // simmetrico attorno alla direzione di mira
      this.spawnPellet(Math.cos(a0 + da), Math.sin(a0 + da), oy, p, rageMult);
    }
    // Abilità DOPPIO GETTO: una seconda bocca spara ANCHE all'indietro, sempre 1 pallina sola
    // (non moltiplicata dal Ventaglio — e' una bocca in piu', non un altro ventaglio).
    if (p.backShot) this.spawnPellet(-nx, -ny, oy, p, rageMult);
    window.Sfx.spray();
  }

  // Crea una singola pallina di getto (usata da fireJet, anche a ventaglio/doppio getto).
  spawnPellet(nx, ny, oy, p, rageMult, origine) {
    const sp = 580;
    // Il colpo nasce dall'UGELLO dell'arma disegnata (vedi boccaArma). Se per qualche motivo
    // l'arma non e' a schermo si ricade sul vecchio calcolo attorno al corpo, cosi' il getto
    // parte comunque.
    // `origine` la passa la raffica radiale: quelle palline nascono dal PERSONAGGIO, non
    // dall'ugello, perche' partono tutt'attorno e non da dove sta puntando l'arma.
    const b = origine || this.boccaArma();
    const ox = b ? b.x : this.player.x + nx * 18;
    const oyy = b ? b.y : this.player.y + oy + ny * 14;
    const s = this.shots.create(ox, oyy, 'soap').setDepth(9);
    s.body.setAllowGravity(false);
    // Il corpo della pallina e' piu' ALTO di quanto si vede (10x14 contro un disegno di 10):
    // e' una tolleranza invisibile che fa perdonare qualche pixel di mira in verticale. Serve
    // insieme all'altezza di cerumino e crosta (vedi ART in spawnEnemy): da sole, o l'una o
    // l'altra, avrebbero dovuto essere esagerate per far combaciare colpo e bersaglio.
    s.body.setSize(10, 14, true);
    s.setVelocity(nx * sp, ny * sp);
    s.dmg = Math.round(p.jetDamage * (rageMult || 1));
    // EVOLUZIONE "Lama d'Acqua": perfora TUTTO; altrimenti abilità PERFORANTE normale.
    s.pierceLeft = p.evoPierceAll ? 999 : (p.jetPierce ? 3 : 1);
    s.splash = p.jetSplash;                // abilità SCOPPIO DI SAPONE (area all'impatto)
    s.homing = p.homing;                   // abilità MIRA GUIDATA (curva verso il nemico)
    s.corrosive = p.corrosive;             // abilità SAPONE CORROSIVO (avvelena all'impatto)
    s.stun = p.stunShot;                   // abilità GETTO STORDENTE (stordisce all'impatto)
    s.bounceLeft = p.bounce | 0;           // abilità RIMBALZO (rimbalza N volte sui muri/suolo)
    s.bounceGrace = 0;
    if (p.corrosive) s.setTint(0x9be86b);  // pallina verde = corrosiva
    const flash = this.add.circle(ox + nx * 4, oyy + ny * 4, 7, 0xdff3ff, 0.9).setDepth(11);
    this.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 120, ease: 'Quad.out', onComplete: () => flash.destroy() });
    // Quanto vive la pallina = quanto LONTANO arriva il getto: e' una manopola del kit (la Pompa
    // a Vuoto ha gittata corta apposta). Vive di piu' se rimbalza.
    this.time.delayedCall((p.shotLife || 850) + (p.bounce | 0) * 300, () => { if (s.active) s.destroy(); });
  }

  popShot(s) {
    if (!s || !s.active) return;
    this.splat(s.x, s.y, 'soft');
    if (s.splash) this.soapSplash(s.x, s.y);   // abilità: scoppio ad area all'impatto
    s.destroy();
  }

  // Abilità RIMBALZO: la pallina rimbalza sulla superficie invece di spappolarsi. Deduce l'asse
  // dell'urto (orizzontale/verticale) confrontando la distanza dal centro della superficie
  // normalizzata sui semilati, poi inverte la velocità su quell'asse. Consuma un rimbalzo.
  bounceShot(sh, solid) {
    if (!sh || !sh.active) return;
    const now = this.time.now;
    if (now < (sh.bounceGrace || 0)) return;   // evita doppi rimbalzi nello stesso istante
    sh.bounceGrace = now + 60;
    const sb = solid.getBounds();
    const dx = sh.x - (sb.x + sb.width / 2);
    const dy = sh.y - (sb.y + sb.height / 2);
    const halfW = sb.width / 2 + 6, halfH = sb.height / 2 + 6;
    if (Math.abs(dx) / halfW > Math.abs(dy) / halfH) {
      sh.setVelocity(-sh.body.velocity.x, sh.body.velocity.y);   // urto laterale: inverti X
      sh.x += Math.sign(dx) * 5;
    } else {
      sh.setVelocity(sh.body.velocity.x, -sh.body.velocity.y);   // urto sopra/sotto: inverti Y
      sh.y += Math.sign(dy) * 5;
    }
    sh.bounceLeft -= 1;
    window.Sfx.crack();
    const f = this.add.circle(sh.x, sh.y, 5, 0xdff3ff, 0.85).setDepth(11);
    this.tweens.add({ targets: f, scale: 0.2, alpha: 0, duration: 140, ease: 'Quad.out', onComplete: () => f.destroy() });
  }

  // Scoppio di sapone (abilità SPLASH): quando una pallina finisce, fa un piccolo scoppio
  // che pulisce il cerume e danneggia i nemici in un raggio ridotto. Danno = frazione del getto.
  soapSplash(x, y) {
    const R = 48;
    const dmg = Math.max(4, Math.round(window.GameState.player.jetDamage * 0.6));
    const ring = this.add.circle(x, y, R, 0xdff3ff, 0.35).setDepth(11).setScale(0.25);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 220, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.spray();
    const toxic = window.GameState.player.evoToxic;   // EVOLUZIONE Nube Tossica: lo scoppio avvelena
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) { this.damageEnemy(e, dmg); if (toxic && e.active) this.applyCorrosion(e); }
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, dmg);
    });
  }

  // ---------- Aiutante (abilità COMPANION) ----------

  // Texture della bolla-aiutante: una bolla di sapone azzurra con un occhietto.
  makeBuddyTexture() {
    if (this.textures.exists('buddy')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x8fd0ff, 0.95); g.fillCircle(9, 9, 8);      // corpo bolla
    g.fillStyle(0xffffff, 0.9); g.fillCircle(6, 6, 2.6);     // riflesso
    g.lineStyle(1, 0xffffff, 0.6); g.strokeCircle(9, 9, 8);
    g.fillStyle(0x14161f, 1); g.fillCircle(11, 9, 1.8);      // occhietto
    g.generateTexture('buddy', 18, 18);
    g.destroy();
  }

  // Crea una bolla-aiutante (index-esima di `total`): segue il giocatore orbitando e spara
  // da sola. Le bolle sono sfasate sull'orbita (phase) così restano equidistanti.
  spawnCompanion(index, total) {
    this.makeBuddyTexture();
    const c = this.add.image(this.player.x, this.player.y - 30, 'buddy').setDepth(11);
    c._baseScale = 1.4;
    c.setScale(c._baseScale);
    c.phase = (index / Math.max(1, total)) * Math.PI * 2;   // posizione sull'anello
    c.nextFire = index * 250;                               // fuoco sfalsato tra le bolle
    this.companions.push(c);
  }

  // Ogni frame: tutte le bolle orbitano (equidistanti) e sparano al nemico più vicino.
  updateCompanions(now) {
    const R = 46 + Math.min(14, this.companions.length * 2);   // anello un filo più largo con più bolle
    this.companions.forEach((c) => {
      if (!c || !c.active) return;
      const ang = now * 0.004 + c.phase;
      const tx = this.player.x + Math.cos(ang) * R;
      const ty = this.player.y - 26 + Math.sin(ang) * (R * 0.45);   // orbita ellittica, sopra la spalla
      c.x += (tx - c.x) * 0.2;   // inseguimento morbido (lerp)
      c.y += (ty - c.y) * 0.2;
      if (now >= c.nextFire) {
        const target = this.nearestEnemyInRange(c.x, c.y, 320);
        if (target) { this.companionFire(c, target); c.nextFire = now + 750; }
        else c.nextFire = now + 200;   // niente bersagli: ricontrolla presto
      }
    });
  }

  // Abilità MIRA GUIDATA: le palline curvano dolcemente verso un nemico DAVANTI a loro. È un
  // aiuto di mira, non un cerca-bersagli: aggancia solo nemici entro un cono in avanti (~55°),
  // così sparando dalla parte opposta i colpi NON fanno inversioni a U per andare a segno.
  updateHomingShots(now) {
    const CONE = 0.95;   // ~55°: oltre questo scarto angolare il bersaglio è "fuori tiro"
    const TURN = 0.08;   // virata per frame (dolce: niente giri a U)
    const RANGE = 230;
    this.shots.getChildren().forEach((s) => {
      if (!s.active || !s.homing) return;
      const cur = Math.atan2(s.body.velocity.y, s.body.velocity.x);
      // nemico più vicino ENTRO il cono davanti alla pallina
      let best = null, bd = RANGE;
      this.enemies.getChildren().forEach((e) => {
        if (!e.active || e.spawning) return;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d >= bd) return;
        const ang = Math.atan2(e.y - s.y, e.x - s.x);
        if (Math.abs(Phaser.Math.Angle.Wrap(ang - cur)) > CONE) return;   // dietro/di lato: ignora
        bd = d; best = e;
      });
      if (!best) return;
      const sp = Math.hypot(s.body.velocity.x, s.body.velocity.y) || 580;
      const want = Math.atan2(best.y - s.y, best.x - s.x);
      const na = cur + Phaser.Math.Angle.Wrap(want - cur) * TURN;
      s.setVelocity(Math.cos(na) * sp, Math.sin(na) * sp);
    });
  }

  // Abilità SAPONE CORROSIVO: marca il nemico perché perda vita nel tempo (~2s).
  applyCorrosion(e) {
    const now = this.time.now;
    e.corrodeUntil = now + 2200;
    e.corrodeNext = now + 350;
    e.corrodeDmg = Math.max(2, Math.round(window.GameState.player.jetDamage * 0.22));
  }

  // Abilità GETTO STORDENTE: il nemico colpito resta fermo un attimo (si somma all'eventuale
  // knockback, non lo sostituisce — vedi il gate in update()).
  applyStun(e) {
    if (!e.active) return;
    e.stunnedUntil = Math.max(e.stunnedUntil || 0, this.time.now + 500);
  }

  // Abilità RABBIA: dopo un colpo subito, il PROSSIMO attacco (corpo a corpo o a distanza) fa
  // danno maggiorato; si consuma con quel singolo attacco, o scade da solo se non attacchi in
  // tempo (armata da hurtPlayer). Ritorna il moltiplicatore da applicare a QUESTO attacco.
  consumeRage() {
    if (this.rageReadyUntil && this.time.now < this.rageReadyUntil) {
      this.rageReadyUntil = 0;
      return 1.6;
    }
    return 1;
  }

  // Scia dello scatto: copie "fantasma" dell'aspetto ATTUALE del personaggio (stessa texture/
  // frame/flip di this.heroVisual) che si dissolvono. DIFFERENZIATA forte tra i due scatti
  // (round 2, C.1): quello normale resta sobrio (azzurro, pochi fantasmi); quello OFFENSIVO e'
  // vistosamente piu' denso/luminoso (arancio, piu' fantasmi, scintille lungo il tragitto) cosi'
  // "questo scatto fa male" si legge a colpo d'occhio, non solo dal colore. Throttle piu' basso
  // (20ms, era 40ms) per lasciare piu' copie nella scia dei ~160ms di scatto.
  spawnDashGhost(damaging) {
    const now = this.time.now;
    if (this._lastDashGhostAt && now - this._lastDashGhostAt < 20) return;
    this._lastDashGhostAt = now;
    const hv = this.heroVisual;
    const ghost = this.add.sprite(hv.x, hv.y, hv.texture.key, hv.frame.name)
      .setOrigin(hv.originX, hv.originY).setScale(hv.scaleX, hv.scaleY)
      .setFlipX(hv.flipX).setDepth(hv.depth - 1).setAlpha(damaging ? 0.85 : 0.65)
      .setTintFill(damaging ? 0xff6b3d : 0x8fe0ff);
    this.tweens.add({
      targets: ghost, alpha: 0, scaleX: ghost.scaleX * 1.1, scaleY: ghost.scaleY * 1.1,
      duration: 220, ease: 'Quad.out', onComplete: () => ghost.destroy(),
    });
    // Scintille lungo il tragitto: SOLO nello scatto offensivo, throttle piu' largo del
    // fantasma (60ms) cosi' non affoga la scia in particelle.
    if (damaging && (!this._lastDashSparkAt || now - this._lastDashSparkAt >= 60)) {
      this._lastDashSparkAt = now;
      this.burst('bit_hard', hv.x, hv.y, 2);
    }
  }

  // Lampo UNA TANTUM all'inizio dello scatto offensivo (oltre alla scia arancio sopra): marca
  // bene il momento "questo scatto fa danno", lo scatto normale non ce l'ha.
  dashStrikeFx() {
    const ring = this.add.circle(this.player.x, this.player.y, 30, 0xff6b3d, 0.28).setDepth(11).setScale(0.4);
    this.tweens.add({ targets: ring, scale: 1.7, alpha: 0, duration: 220, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

  // Abilità SCATTO OFFENSIVO: durante lo scatto, i nemici e il cerume attraversati vengono
  // colpiti (il giocatore è già invulnerabile mentre scatta, quindi ci passa attraverso).
  updateDashStrike(now) {
    if (now >= (this.dashUntil || 0)) return;
    const p = window.GameState.player;
    // Mentre carichi attraverso i nemici resti invulnerabile con un MARGINE oltre la fine
    // dello scatto: cosi' non subisci il loro danno da contatto mentre ti stacchi da loro.
    this.invulnUntil = Math.max(this.invulnUntil, now + 240);
    const pb = this.player.getBounds();
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e.spawning) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(pb, e.getBounds())) {
        if (!e._dashHitAt || now - e._dashHitAt > 300) { e._dashHitAt = now; this.damageEnemy(e, Math.round(p.damage * 0.9), true); }
      }
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(pb, b.getBounds())) {
        // Stesso cooldown per-bersaglio dei nemici sopra: senza, un blocco (o piu' in fila)
        // prendeva danno a OGNI frame per tutta la durata dello scatto e spariva di colpo,
        // saltando l'animazione di cedimento/caduta della massa di cerume.
        if (!b._dashHitAt || now - b._dashHitAt > 300) { b._dashHitAt = now; this.damageBlock(b, p.damage); }
      }
    });
  }

  // Nemico attivo più vicino a (x,y) entro `range`, o null.
  nearestEnemyInRange(x, y, range) {
    let best = null, bd = range;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e.spawning) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }

  // L'aiutante spara una pallina verso il bersaglio (riusa il gruppo this.shots: colpisce
  // nemici e pulisce il cerume come il getto, ma con danno ridotto e senza perfora/scoppio).
  companionFire(c, target) {
    const p = window.GameState.player;
    const dx = target.x - c.x, dy = target.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const sp = 520;
    const s = this.shots.create(c.x + nx * 10, c.y + ny * 10, 'soap').setDepth(9).setScale(0.85);
    s.body.setAllowGravity(false);
    s.body.setSize(9, 9, true);
    s.setVelocity(nx * sp, ny * sp);
    s.dmg = Math.max(5, Math.round(p.jetDamage * 0.5));
    s.pierceLeft = 1;
    s.splash = false;
    s.homing = p.evoSwarm || false;   // EVOLUZIONE Sciame: anche le bolle sparano a ricerca
    s.bounceLeft = 0;
    window.Sfx.spray();
    this.time.delayedCall(900, () => { if (s.active) s.destroy(); });
    // piccolo "scatto" del compagno quando spara
    this.tweens.add({ targets: c, scale: c._baseScale * 0.82, duration: 60, yoyo: true });
  }

  // Cerca un nemico a distanza da bastonata (per l'attacco "intelligente": se c'e' un
  // nemico vicino il tasto attacco fa la mazzata invece del getto). Ritorna il nemico o null.
  meleeTargetNear() {
    const px = this.player.x, py = this.player.y;
    // ⚠️ IL RAGGIO SEGUE LA PORTATA. Era 58 fisso, scritto a mano e mai collegato al
    // potenziamento: con la portata a 81 o 127 si continuava a iniziare il colpo solo a 58, e i
    // pixel in piu' servivano solo se un secondo nemico capitava dentro l'arco per caso. Era un
    // potenziamento che allungava il braccio lasciando il grilletto dov'era — da qui il "non si
    // percepisce" dei tester. In verticale NON si scala: quello dice se il nemico e' alla tua
    // altezza, non quanto lontano arrivi.
    const portata = window.GameState.player.attackRange || 1;
    let target = null;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e.spawning) return;
      if (Math.abs(e.x - px) < 58 * portata && Math.abs(e.y - py) < 56) target = e;
    });
    return target;
  }

  // Cerca un BLOCCO di cerume a portata di mazza (per bastonarlo e ripulirlo più in fretta
  // che col getto quando gli sei addosso). Ritorna il blocco più vicino davanti a te, o null.
  meleeWaxNear() {
    const px = this.player.x, py = this.player.y;
    const portata = window.GameState.player.attackRange || 1;   // come per i nemici: segue la portata
    let best = null, bd = 1e9;
    this.blocks.getChildren().forEach((b) => {
      if (!b.active) return;
      const dx = Math.abs(b.x - px), dy = Math.abs(b.y - py);
      if (dx < 46 * portata && dy < 44) { const d = dx + dy; if (d < bd) { bd = d; best = b; } }
    });
    return best;
  }

  // Bastonata verso il bersaglio vicino (nemico O blocco di cerume). Rispetta la cadenza.
  doMelee(now, target) {
    const p = window.GameState.player;
    if (now - this.lastAttack < p.attackCooldown) return;
    this.lastAttack = now;
    this.facing = Math.sign(target.x - this.player.x) || this.facing;
    this.meleeSwing();
  }

  // Il colpo corpo a corpo vero e proprio (coton fioc, o martello se sbloccato).
  meleeSwing() {
    const p = window.GameState.player;
    window.Sfx.hit();
    // Forma del colpo dal KIT scelto nell'Arsenale (window.ARMI): portata, altezza dell'arco e
    // fermo-immagine sono il carattere dell'arma (martello largo e lento, pinzette corte e rapide).
    const M = window.armaCorrente().mischia;
    // IL CORPO MENA, non solo l'arma (2026-08-03). Prima il personaggio restava nella posa di
    // riposo e ruotava solo il bastoncino disegnato: sembrava un'arma che si muoveva da sola.
    // L'animazione parte solo A TERRA e non accovacciato — in aria deve restare il salto e
    // accovacciato la posa bassa, se no il personaggio si rialzerebbe di colpo per menare.
    // La DURATA la decide la cadenza dell'arma: col coton fioc rapido (165ms) un'animazione di
    // durata fissa sarebbe ancora a meta' quando parte gia' il colpo dopo.
    const aTerra = this.time.now - this.lastGroundAt < 120;
    this._mischiaFinoA = 0;
    if (aTerra && !this.crouching) {
      // Si prende quasi tutto l'intervallo fra un colpo e l'altro, e il tetto e' alto: l'animazione
      // deve avere il tempo di VEDERSI (playtest: "non la si riesce a vedere"). Il minimo resta
      // perche' con la cadenza piu' rapida del gioco non c'e' spazio per fare di meglio.
      const durata = Phaser.Math.Clamp((p.attackCooldown || 360) * 0.85, 180, 460);
      this._mischiaFinoA = this.time.now + durata;
      this.heroVisual.anims.play({ key: 'hero_melee_a', duration: durata });
    }
    this.showMeleeWeapon(M.tex);            // arma in mano, agganciata alla mano disegnata
    // IL COLPO ARRIVA QUANDO IL BRACCIO E' AVANTI, non quando premi (playtest: "alle volte il
    // colpo arriva prima che l'animazione sia ripartita"). Il danno era immediato mentre il
    // disegno era ancora nella fase di carica: si vedeva il nemico incassare prima che il
    // bastoncino si muovesse. L'attesa e' mezza animazione, cioe' il fotogramma in cui il braccio
    // passa in avanti (MISCHIA_ANGOLO: i primi due sono alto-indietro, il terzo e' gia' teso).
    // Senza animazione — in aria o accovacciato — resta l'arco disegnato dal tween, 150ms: si usa
    // la sua meta'. ⚠️ Il ritardo e' sempre meno di meta' cadenza, quindi non puo' accavallarsi
    // col colpo successivo.
    const ritardo = this._mischiaFinoA ? Math.round((this._mischiaFinoA - this.time.now) * 0.5) : 75;
    this._colpoNumero = (this._colpoNumero || 0) + 1;
    const mio = this._colpoNumero;
    this.time.delayedCall(ritardo, () => {
      // Se nel frattempo e' partita un'altra bastonata, o il livello e' finito, questo colpo
      // non esiste piu'.
      if (this._colpoNumero !== mio || !this.scene.isActive() || !this.player || !this.player.active) return;
      this.meleeImpatto(M);
    });
  }

  // La parte che FA MALE della bastonata, staccata dal gesto: rettangolo di danno, onda d'urto,
  // fermo-immagine e schizzo. Sta a se' perche' arriva mezza animazione dopo il gesto (vedi
  // meleeSwing) — e perche' cosi' portata e direzione si leggono nell'istante in cui il braccio
  // e' davvero avanti, non in quello in cui hai premuto.
  // SCIA DELLA BASTONATA: un arco disegnato dove il colpo arriva DAVVERO.
  // ⚠️ Il raggio e' la portata vera, non un numero deciso a occhio: e' quello che rende visibile
  // il potenziamento. Con la portata base l'arco e' corto, con tre carte e' vistoso — e siccome
  // e' lo stesso numero che decide il danno, non puo' mentire su dove colpisci.
  arcoMischia(range, cy) {
    const verso = this.facing < 0 ? -1 : 1;
    const g = this.add.graphics().setDepth(11.5).setScrollFactor(1);
    g.lineStyle(5, 0xfff2c4, 0.85);
    // L'arco copre il gesto: da alto-dietro a basso-avanti, specchiato col verso.
    const da = verso > 0 ? -1.15 : Math.PI + 1.15;
    const a2 = verso > 0 ? 0.45 : Math.PI - 0.45;
    // ⚠️ NIENTE min/max SUGLI ANGOLI. Ordinandoli si perde l'informazione che conta — da dove
    // A dove — e l'arco viene percorso DALLA PARTE LUNGA: verso sinistra si disegnavano 268
    // gradi invece di 92, cioe' tre quarti di cerchio attorno al personaggio (segnalato dal
    // playtest 2026-08-19). Gli angoli vanno passati NELL'ORDINE del gesto, e il verso di
    // percorrenza dice se si va avanti o indietro: specchiare un arco vuol dire mandarlo
    // all'indietro, non riordinarne gli estremi.
    g.beginPath();
    g.arc(this.player.x, this.player.y + cy, range, da, a2, verso < 0);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 220, ease: 'Quad.out',
      onComplete: () => g.destroy() });
  }

  meleeImpatto(M) {
    const p = window.GameState.player;
    const range = M.portata * p.attackRange * window.CONFIG.MISCHIA_PORTATA;
    const halfH = M.altezza;
    const cy = this.crouching ? 16 : 0;   // accovacciato: colpo più in basso (nemici bassi)
    const ax = this.facing > 0 ? this.player.x + 4 : this.player.x - range - 4;
    const rect = new Phaser.Geom.Rectangle(ax, this.player.y - halfH + cy, range, halfH * 2);
    // Abilità RABBIA: se armata (colpo subito di recente), QUESTO colpo fa piu' danno.
    const dmg = Math.round(p.damage * this.consumeRage());
    let hitEnemy = false, hitAny = false;
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, b.getBounds())) { this.damageBlock(b, dmg); hitAny = true; }
    });
    const hitSet = new Set();
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) { this.damageEnemy(e, dmg, true); hitEnemy = true; hitAny = true; hitSet.add(e); }
    });
    // Abilità ONDA D'URTO: la bastonata colpisce ANCHE i nemici in un raggio attorno a te
    // (danno ridotto), non solo quelli davanti. Ottima contro i gruppi.
    if (p.meleeBlast) {
      const R = 84, bd = Math.max(6, Math.round(dmg * 0.55));
      let blasted = false;
      this.enemies.getChildren().forEach((e) => {
        if (e.active && !e.spawning && !hitSet.has(e) && Math.hypot(e.x - this.player.x, e.y - this.player.y) < R) {
          this.damageEnemy(e, bd, true); hitEnemy = true; hitAny = true; blasted = true;
        }
      });
      if (hitAny) this.blastFx(R);   // anello d'urto quando la mazzata connette
    }
    // IMPATTO: quando la mazzata CONNETTE, micro-pausa (hit-stop) + tremolio -> peso.
    // Piu' forte sui nemici e col martello; leggero sul solo cerume.
    if (hitAny) {
      this.arcoMischia(range, cy);
      this.cameras.main.shake(hitEnemy ? 130 : 60, hitEnemy ? 0.010 : 0.004);
      this.hitStop(M.fermo || (hitEnemy ? 78 : 40));
      this.sporcati(hitEnemy);          // lo schizzo torna addosso: ci si sporca di cerume
    }
  }

  // ---- SPORCARSI DI CERUME (2026-07-31) ----
  // Idea dell'utente: nel corpo a corpo lo schizzo torna addosso. E' SOLO ESTETICA — non tocca
  // velocita', mira o danno: sporcarsi che peggiora il gioco sarebbe un'altra meccanica, da
  // pensare a parte.
  // Non serve ridisegnare il personaggio sporco: le macchie sono "adesivi" che si ricordano dove
  // stanno RISPETTO AL CORPO e lo seguono ogni fotogramma, come gia' fanno il vestito animato e
  // l'arma in mano. I colori sono quelli del cerume, mai verso il rosso: quando il PG prende una
  // botta lampeggia, e le macchie non devono confondersi con quel segnale.
  sporcati(daNemico) {
    if (this.macchie.length >= GameScene.MACCHIE_MAX) return;
    // Non a ogni colpo, se no col tetto a 10 ci si insozza in tre secondi: cosi' ci vogliono
    // una ventina di colpi andati a segno, che e' un livello intero.
    if (Math.random() > 0.5) return;

    const C = window.CONFIG.COLORS;
    const col = daNemico ? C.waxSoftLight : C.waxHardLight;
    // DOVE. Serve un punto che stia DAVVERO sul corpo. Tirare a indovinare un rettangolo non
    // basta: la sagoma e' stretta in cima (la testa) e larga in mezzo (zaino + braccia), quindi
    // le macchie finivano per aria di fianco al personaggio. Qui si sorteggia un punto e si
    // CHIEDE ALLA TEXTURE se e' pieno, ripetendo finche' non si trova. Il fotogramma corrente
    // basta come stampo: la sagoma cambia poco fra un fotogramma e l'altro.
    // La cella e' 84x84 e il punto d'appoggio (i piedi) sta a (42, 72), vedi HERO_ORIGIN_Y.
    let ox = 0, oy = 0, trovato = false;
    for (let tent = 0; tent < 10 && !trovato; tent++) {
      ox = Phaser.Math.Between(-8, 12);
      oy = Phaser.Math.Between(-46, -18);        // busto e testa: lo schizzo arriva dalle mani
      const a = this.textures.getPixelAlpha(Math.round(42 + ox), Math.round(72 + oy),
        this.heroVisual.texture.key, this.heroVisual.frame.name);
      trovato = a > 40;
    }
    if (!trovato) return;

    // Piccole e un po' schiacciate, non bollini tondi: a 62px di statura una macchia di 3px si
    // legge come schizzo, una di 8px sembra un adesivo.
    const rx = Phaser.Math.FloatBetween(1.1, 2.4);
    const m = this.add.ellipse(this.heroVisual.x, this.heroVisual.y,
      rx * 2, rx * Phaser.Math.FloatBetween(1.1, 1.7), col, 0.82)
      .setDepth(10.5)                      // sopra il vestito (10), sotto l'arma in mano (11)
      .setRotation(Phaser.Math.FloatBetween(-0.7, 0.7));
    m.ox = ox; m.oy = oy;
    this.macchie.push(m);
    this.posizionaMacchie();
  }

  // ALTEZZA DAVVERO DISEGNATA di ogni fotogramma del personaggio, misurata una volta sola
  // all'avvio leggendo i pixel dei fogli: per ogni fotogramma, quanto sta sopra i piedi la riga
  // piu' alta che non e' trasparente. Serve alle macchie di cerume (vedi posizionaMacchie).
  // ⚠️ MISURATA, NON SCRITTA A MANO. Una tabella di numeri andrebbe rifatta a ogni ri-bake dei
  // fogli e prima o poi resterebbe indietro in silenzio — come gia' avvisa il commento di MANO.
  // Costa una lettura per foglio all'avvio (nove in tutto) e niente durante il gioco.
  misuraAltezzeDisegnate() {
    this.ALTEZZE = {};
    const cv = document.createElement('canvas');
    const g = cv.getContext('2d', { willReadFrequently: true });
    const piedi = Math.round(84 * this.HERO_ORIGIN_Y);   // riga dei piedi dentro la cella
    for (const key of GameScene.FOGLI_PG) {
      const tex = this.textures.get(key);
      if (!tex || !tex.source[0] || !tex.source[0].image) continue;
      const img = tex.source[0].image;
      cv.width = img.width; cv.height = img.height;
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0);
      let dati;
      try { dati = g.getImageData(0, 0, cv.width, cv.height).data; } catch (e) { continue; }
      // ⚠️ I FOTOGRAMMI SI CHIEDONO A PHASER, non si deducono dalla larghezza: i fogli grandi
      // sono griglie 5x5 (420x420, 25 fotogrammi), non una riga sola. Dedurli dalla larghezza
      // ne faceva leggere 5 su 25, e solo quelli della prima riga.
      const nomi = tex.getFrameNames().sort((a, b) => (+a) - (+b));
      const alt = [];
      for (const nome of nomi) {
        const fr = tex.frames[nome];
        let cima = fr.cutY + fr.height;
        for (let y = fr.cutY; y < fr.cutY + fr.height && cima > fr.cutY + fr.height - 1; y++) {
          for (let x = fr.cutX; x < fr.cutX + fr.width; x++) {
            if (dati[((y * img.width) + x) * 4 + 3] > 40) { cima = y; break; }
          }
        }
        alt.push(Math.max(1, (fr.cutY + piedi) - cima));
      }
      this.ALTEZZE[key] = alt;
    }
    // Statura di riferimento: il personaggio in piedi fermo. Tutto il resto si misura rispetto a lui.
    const idle = this.ALTEZZE.hero_idle;
    this.ALTEZZA_BASE = (idle && idle[0]) || 62;
  }

  // Quanto e' alto ADESSO il personaggio disegnato, rispetto a quando sta in piedi (1 = in piedi).
  compressionePG() {
    const a = this.ALTEZZE && this.ALTEZZE[this.heroVisual.texture.key];
    if (!a) return 1;
    return (a[this.fotogrammaCorrente() % a.length] || this.ALTEZZA_BASE) / this.ALTEZZA_BASE;
  }

  // Le macchie seguono il corpo. Due accorgimenti: si specchiano col verso (una macchia sul petto
  // resta sul petto anche girandosi) e si SCHIACCIANO insieme al disegno.
  // ⚠️ Prima lo schiacciamento era un unico numero (0,82) acceso dal solo accovacciarsi. Da li'
  // veniva il "lo sporco fluttua quando il personaggio cambia posizione" del playtest, per due
  // motivi insieme: valeva SOLO per l'accovacciarsi (non per il salto, la bastonata o il cammino
  // accovacciato, che pure cambiano statura), e scattava di colpo mentre il disegno ci mette sei
  // fotogrammi a scendere — le macchie arrivavano giu' prima del corpo. Ora segue il fotogramma
  // che c'e' davvero a schermo, quindi non puo' sfasarsi.
  posizionaMacchie() {
    if (!this.macchie.length) return;
    const v = this.facing < 0 ? -1 : 1;
    const compressione = this.compressionePG();
    for (let i = 0; i < this.macchie.length; i++) {
      const m = this.macchie[i];
      m.setPosition(this.heroVisual.x + m.ox * v, this.heroVisual.y + m.oy * compressione);
      m.setScale(this.jx, this.jy);
    }
  }

  // SCHEGGIA DELLA REGINA: corre a terra SEGUENDO il profilo del terreno (per questo le colline
  // non la fanno saltellare) e ferisce al contatto. Si scavalca col salto.
  lanciaScheggia(e, verso) {
    const sc = this.movers.create(e.x + verso * 40, this.terrainTopAt(e.x + verso * 40) - 10, 'wax_glob')
      .setDepth(8).setScale(0.85);
    sc.setTint(0xc98a5a);
    sc.body.setAllowGravity(false);
    sc.setVelocityX(verso * 240);
    sc.scheggia = true;
    sc.setAngularVelocity(verso * 420);
    // vive qualche secondo, poi sparisce: non deve accumularsi per tutto il livello
    this.time.delayedCall(2600, () => { if (sc.active) sc.destroy(); });
    window.Sfx.crack();
  }

  // NUMERO DI DANNO che sale e sfuma sopra il nemico colpito.
  // Serve a rendere visibile una cosa che altrimenti non si vede: quanto fa male un colpo.
  // Colori diversi per i tre casi, perche' il numero da solo non spiega PERCHE' e' basso:
  //   forte (corpo a corpo) = ambra piena · normale (getto) = bianco · scalfito (armatura) = grigio.
  // Il grigio sulla crosta e' didattico: dice "qui il getto non morde, cambia arma".
  numeroDanno(x, y, dmg, tipo) {
    const col = tipo === 'forte' ? '#ffd166' : (tipo === 'scalfito' ? '#9fb0c4' : '#fff7e8');
    const t = this.add.text(x, y, String(Math.max(1, Math.round(dmg))), {
      fontFamily: 'monospace', fontSize: tipo === 'forte' ? '17px' : '14px', color: col,
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(122);
    // Sale poco e sfuma in fretta: deve informare senza coprire il gioco.
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 520, ease: 'Quad.out',
      onComplete: () => t.destroy() });
  }

  // Anello dell'ONDA D'URTO: cerchio giallo che si espande attorno al giocatore.
  blastFx(R) {
    const ring = this.add.circle(this.player.x, this.player.y, R || 84, 0xffe08a, 0.18).setDepth(11).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 240, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

  // "Hit-stop": congela brevemente la fisica all'impatto per dare peso ai colpi. Non si
  // accumula (se gia' in pausa, ignora) e riprende sempre dopo ms.
  hitStop(ms) {
    if (this._hitStopUntil && this.time.now < this._hitStopUntil) return;
    this._hitStopUntil = this.time.now + ms;
    this.physics.world.pause();
    this.time.delayedCall(ms, () => this.physics.world.resume());
  }

  // ---- LAYER ARMA: arma in mano durante l'attacco (intercambiabile via this.WEAPONS) ----
  // A distanza: la punta verso la direzione di mira (nx,ny). Resta visibile un attimo dopo
  // lo sparo (rinnovato a ogni colpo mentre spari).
  showRangedWeapon(nx, ny) {
    const cfg = this.WEAPONS[window.armaCorrente().getto.tex] || this.WEAPONS.sprayer;
    const w = this.heroWeapon;
    this.tweens.killTweensOf(w);
    w.setTexture(cfg.tex).setOrigin(cfg.origin[0], cfg.origin[1])
      .setScale(cfg.scale, cfg.scale * (cfg.spessore || 1)).setVisible(true);
    this._weaponMode = 'ranged'; this._weaponCfg = cfg;
    this._weaponAim = Math.atan2(ny, nx);
    // ⚠️ Il verso NON si deduce da nx: mirando dritto in su nx vale 0 e verrebbe sempre "destra"
    // anche mirando da sinistra. Si prende da dove GUARDA il personaggio, che e' l'unica cosa
    // sempre definita (bug del playtest: arma rivolta dalla parte opposta al colpo).
    this._weaponFlip = this.facing < 0;
    // Quanto resta in mano dopo il colpo. ⚠️ DEVE coprire l'intervallo tra un colpo e l'altro:
    // era fisso a 220ms mentre le armi sparano ogni 230-640ms, quindi tra un colpo e il
    // successivo l'arma SPARIVA — e con lei la posa di mira, che ricadeva su idle/corsa. Ecco
    // da dove venivano i tre difetti segnalati insieme nel playtest: arma che lampeggia,
    // corsa+sparo a scatti, idle+sparo a scatti.
    this._weaponHideAt = this.time.now + Math.max(240, (window.GameState.player.shotCooldown || 340) + 90);
    this.positionWeapon();
  }

  // Corpo a corpo: arma in mano che ROTEA nell'arco del colpo (texture dal kit scelto).
  showMeleeWeapon(tex) {
    const cfg = this.WEAPONS[tex] || this.WEAPONS.swab;
    const w = this.heroWeapon;
    this.tweens.killTweensOf(w);
    // Abilità BRACCIO LUNGO (round 2, G.1): prima la portata extra era invisibile (allungava
    // solo il rettangolo di danno, non l'arma disegnata) — ora l'arma stessa si ingrandisce con
    // `p.attackRange`, smorzato a meta' (altrimenti dopo tante pescate diventerebbe assurda:
    // e' una carta "comune" ripescabile all'infinito).
    // ⚠️ L'ARMA SI ALLUNGA ESATTAMENTE QUANTO LA PORTATA, e solo in LUNGHEZZA.
    // Prima l'ingrandimento era smorzato a meta' e valeva su tutti e due i lati: il coton fioc
    // diventava piu' grosso invece che piu' lungo, e soprattutto MENTIVA. Misurato: con 5 carte
    // la portata del colpo e' 173px e il bastoncino disegnato ne era 115 — si colpiva 58 pixel
    // oltre la punta visibile. Un'arma che colpisce dove non arriva e' peggio di un'arma grande.
    // Se un giorno la lunghezza risultasse assurda, il numero da tagliare e' la PORTATA (cioe' la
    // meccanica), non il disegno: il disegno deve dire la verita' su dove si colpisce.
    const allungo = window.GameState.player.attackRange;
    w.setTexture(cfg.tex).setOrigin(cfg.origin[0], cfg.origin[1])
      .setScale(cfg.scale * allungo, cfg.scale * (cfg.spessore || 1)).setVisible(true);
    this._weaponMode = 'melee'; this._weaponCfg = cfg; this._weaponFlip = this.facing < 0;
    // Come per il getto: deve coprire l'intervallo tra una bastonata e l'altra, se no il coton
    // fioc lampeggia tra un colpo e il successivo (segnalato nel playtest).
    this._weaponHideAt = this.time.now + Math.max(240, (window.GameState.player.attackCooldown || 360) + 60);
    // FlipX (non FlipY, il bug originale) per l'orientamento dei pixel + rotazione "π - θ"
    // (NON la semplice negazione -θ, che sposta l'arco anche in verticale — verificato con
    // getBounds(): solo π-θ da' un mirror pulito, stessa Y, X specchiata attorno al giocatore).
    // ⚠️ Ribaltamento e angolo vanno messi PRIMA di posizionare: da quando la posizione compensa
    // lo scarto del ribaltamento (vedi armaAlPunto) dipende da tutti e due, e nell'ordine
    // sbagliato il primo fotogramma del colpo usciva agganciato male.
    w.setFlipX(this._weaponFlip);
    w.setFlipY(false);
    const mirror = (theta) => this._weaponFlip ? (Math.PI - theta) : theta;
    w.rotation = mirror(-1.1);                                  // parte alto-indietro
    this.positionWeapon();
    this.tweens.add({ targets: w, rotation: mirror(0.7), duration: 150, ease: 'Quad.out' });  // fino a basso-avanti
  }

  // Aggancia l'arma a un punto del mondo, ruotata di `a` e (se serve) specchiata.
  // ⚠️ IL RIBALTAMENTO DI PHASER NON GIRA ATTORNO AL PERNO, MA ATTORNO ALLA META' DELL'IMMAGINE.
  // Se il perno non sta in mezzo — e non ci sta mai, e' l'IMPUGNATURA e sta in un angolo — l'arma
  // ribaltata scivola di DUE VOLTE la distanza fra il perno e il centro. Sullo spruzzino sono
  // 6,8 pixel verso il basso su 12 di altezza disegnata: piu' di mezz'arma. E' la causa dei due
  // difetti segnalati insieme nel playtest ("verso sinistra la pistola e' troppo in basso" e
  // "ogni tanto compare rivolta male"): l'arma si stacca dalla mano solo in un verso, e ruotando
  // la mira lo scarto gira con lei, quindi a volte esce di lato e a volte sopra.
  // ⚠️ Misurato con getBounds() di Phaser, non con i propri conti: il calcolo della posizione era
  // gia' specchiato in modo esatto (perno a -31/+31, stessa altezza), lo scarto nasceva DOPO,
  // nel disegno. Un controllo che rifa' i conti a mano non lo puo' vedere.
  armaAlPunto(x, y, a, fY, fX) {
    const w = this.heroWeapon;
    w.setFlipY(!!fY); w.setFlipX(!!fX); w.setRotation(a);
    // Distanza perno->centro dell'immagine, raddoppiata (e' di la' che il ribaltamento la manda).
    const cx = fX ? (0.5 - w.originX) * w.width * w.scaleX * 2 : 0;
    const cy = fY ? (0.5 - w.originY) * w.height * w.scaleY * 2 : 0;
    // Va tolta nel verso in cui l'arma e' ruotata, non in quello dello schermo.
    const c = Math.cos(a), s = Math.sin(a);
    w.setPosition(x - (cx * c - cy * s), y - (cx * s + cy * c));
    // Dove sta il PERNO adesso. Non coincide piu' con w.x/w.y (li' c'e' la compensazione), e
    // boccaArma deve partire da qui: se leggesse w.x i colpi nascerebbero spostati dello stesso
    // scarto che abbiamo appena tolto al disegno.
    this._armaPerno = { x, y };
  }

  // Posiziona l'arma alla mano (la segue ogni frame finche' visibile). L'angolo lo impostano
  // showRangedWeapon (mira) o il tween di showMeleeWeapon (arco); qui solo la posizione + mira.
  positionWeapon() {
    const w = this.heroWeapon; if (!w || !w.visible) return;
    const cfg = this._weaponCfg || this.WEAPONS.sprayer;
    if (this._weaponMode === 'ranged') {
      // L'arma sta su un ARCO attorno alla spalla, non a un'altezza fissa: si sposta nella
      // direzione in cui miri, come farebbe un braccio che si alza o si abbassa.
      // Non e' solo estetica — a mira ORIZZONTALE l'arma finiva dentro la sagoma del torso ed
      // era di fatto invisibile (verificato a schermo il 2026-07-31): sulla direzione che si usa
      // il 90% del tempo non si vedeva cosa avevi in mano.
      // ⚠️ Resta il limite noto: il BRACCIO disegnato non segue, quindi mirando dritto in su
      // l'arma sembra ancora sospesa. Si chiude ridisegnando le due armi CON l'avambraccio
      // attaccato e il perno alla spalla — vedi HANDOFF §Posa d'attacco.
      // ⚠️ IL VERSO SI RILEGGE OGNI FOTOGRAMMA, non si usa quello congelato allo sparo.
      // L'arma resta in mano per qualche decimo dopo il colpo, e in quel tempo il giocatore
      // puo' girarsi: prima la MANO si specchiava (usa `this.facing`) ma il PUNTAMENTO no, e
      // si vedeva l'arma dal lato sbagliato rivolta dove non stava sparando. Ora se il corpo
      // si e' girato l'arma lo segue, specchiando l'angolo attorno alla verticale (π - θ:
      // stessa altezza, direzione ribaltata). Il colpo gia' partito continua per la sua strada,
      // che e' giusto — quello che si e' girato e' il personaggio.
      const flipOra = this.facing < 0;
      const a = (flipOra !== this._weaponFlip) ? (Math.PI - this._weaponAim) : this._weaponAim;
      // Se il corpo ha preso una POSA DI MIRA, l'arma va nella MANO disegnata. L'arco della
      // spalla resta per gli altri casi (in aria, o nei fotogrammi in cui la posa non c'e').
      const posa = this._posaMira;
      if (posa) {
        // Alcune pose sono un CICLO e hanno una mano per fotogramma (corsa, sparo accovacciato);
        // le altre sono ferme e ne hanno una sola. Si distinguono da sole: basta guardare se
        // la voce e' un elenco, invece di tenere due strade separate che possono divergere.
        const voce = GameScene.MANO[posa];
        const t = Array.isArray(voce[0]) ? voce[this.fotogrammaCorrente() % voce.length] : voce;
        const verso = flipOra ? -1 : 1;
        this.armaAlPunto(this.heroVisual.x + t[0] * verso, this.heroVisual.y + t[1], a, flipOra, false);
        return;
      }
      const raccorcia = this.crouching ? 0.6 : 1;
      // Spostamento in AVANTI costante oltre all'arco: mirando dritto in su o in giu' il coseno
      // e' zero, e senza questo l'arma finirebbe sull'asse del corpo — anzi un filo dietro, per
      // via del perno dentro l'immagine — invece che dal lato in cui stai guardando.
      const avanti = (flipOra ? -1 : 1) * GameScene.BRACCIO_AVANTI;
      this.armaAlPunto(this.player.x + avanti + Math.cos(a) * GameScene.BRACCIO_RAGGIO,
        this.player.y + GameScene.BRACCIO_SPALLA * raccorcia + Math.sin(a) * GameScene.BRACCIO_RAGGIO,
        a, flipOra, false);
      return;
    }
    // CORPO A CORPO. Se sta girando l'animazione del colpo, l'arma sta nella MANO DISEGNATA e
    // punta come punta il braccio: mano e angolo vengono dal fotogramma corrente, quindi non
    // possono sfasarsi rispetto al corpo. Se l'animazione non c'e' (in aria, accovacciato) resta
    // il vecchio comportamento: appesa a un punto fisso, con l'arco disegnato dal tween.
    if (this.heroVisual.texture.key === 'hero_melee') {
      const i = this.fotogrammaCorrente() % GameScene.MANO.mischia.length;
      const t = GameScene.MANO.mischia[i];
      const verso = this.facing < 0 ? -1 : 1;
      this.tweens.killTweensOf(w);
      const a = GameScene.MISCHIA_ANGOLO[i];
      this.armaAlPunto(this.heroVisual.x + t[0] * verso, this.heroVisual.y + t[1],
        verso < 0 ? Math.PI - a : a, verso < 0, false);
      return;
    }
    const hx = cfg.hand[0] * (this.facing < 0 ? -1 : 1);
    // Anche qui l'aggancio passa da armaAlPunto: la rotazione la sta muovendo il tween dell'arco,
    // e lo scarto del ribaltamento gira con lei, quindi va ricalcolato a ogni fotogramma.
    this.armaAlPunto(this.player.x + hx, this.player.y + cfg.hand[1], w.rotation, w.flipY, w.flipX);
  }

  // Numero del fotogramma mostrato adesso dal personaggio (0 se non sta girando nessun ciclo).
  // Phaser conta i fotogrammi da 1, qui servono da 0.
  fotogrammaCorrente() {
    const f = this.heroVisual.anims.currentFrame;
    return f ? f.index - 1 : 0;
  }

  // DOVE STA LA PUNTA CHE SPARA, in coordinate del mondo. Serve per far nascere i proiettili
  // dall'ugello dello spruzzino: prima partivano da un cerchietto attorno al CORPO e si vedevano
  // uscire dalla pancia, mentre l'arma era disegnata in mano da tutt'altra parte (playtest).
  // Si parte dall'offset misurato sul disegno (`cfg.bocca`, in pixel dell'immagine), lo si
  // scala, lo si specchia se l'arma e' ribaltata, e infine lo si RUOTA come l'arma: cosi' la
  // bocca resta la bocca in tutte e otto le direzioni di mira.
  boccaArma() {
    const w = this.heroWeapon;
    const cfg = this._weaponCfg;
    if (!w || !w.visible || !cfg || !cfg.bocca) return null;
    // ⚠️ La bocca si scala con la stessa deformazione dell'arma (`spessore` in verticale), se no
    // ingrossando il coton fioc il colpo smetterebbe di partire dalla punta.
    const s = cfg.scale;
    const dx = cfg.bocca[0] * s * (w.flipX ? -1 : 1);
    const dy = cfg.bocca[1] * s * (cfg.spessore || 1) * (w.flipY ? -1 : 1);
    const c = Math.cos(w.rotation), sn = Math.sin(w.rotation);
    // ⚠️ Si parte dal PERNO (vedi armaAlPunto), non da w.x: quello e' spostato apposta per
    // annullare lo scarto del ribaltamento di Phaser.
    const p = this._armaPerno || { x: w.x, y: w.y };
    return { x: p.x + dx * c - dy * sn, y: p.y + dx * sn + dy * c };
  }

  damageBlock(b, dmg) {
    b.hp -= dmg;
    this.wobbleWaxNear(b.x, b.y);   // ondeggio locale al punto colpito
    if (b.hp <= 0) {
      window.Sfx.smash();
      this.burst(b.bitKey, b.x, b.y, 14);
      this.splat(b.x, b.y, b.waxType);
      // ⚠️ PULIRE IL CERUME NON DA' PIU' MONETA (scelta dell'utente, 2026-08-18: "si ottiene
      // troppo facilmente moneta spendibile allo shop"). La moneta si guadagna SOLO raccogliendo
      // i pallini: quelli lasciati dai nemici e quelli sulle pedane e negli scrigni. Pulire
      // serve ad aprirsi la strada e a completare il livello, non a far cassa.
      // ⚠️ `cleanedWax` RESTA: e' un'altra cosa. Conta quanto condotto hai pulito e decide se il
      // livello e' completo (l'80% richiesto). Toglierlo renderebbe il gioco infinibile — sono
      // due numeri che sembrano lo stesso e non lo sono.
      this.cleanedWax = (this.cleanedWax || 0) + b.waxValue;   // per la % "pulito" (valore GREZZO, il moltiplicatore non conta)
      const dcol = b.col;
      if (b.waxImg) b.waxImg.destroy();
      if (b.waxDrip) b.waxDrip.destroy();
      b.destroy();
      this.blocksLeft = this.blocks.countActive(true);
      this.settleWaxColumn(dcol);   // i pezzi sopra scendono (collasso a cumulo)
      this.drawWaxBase();           // la massa si ritira/ricompatta dove hai pulito
    } else {
      window.Sfx.crack();
      this.burst(b.bitKey, b.x, b.y, 3);
      // Il pezzo si scurisce man mano che lo consumi.
      if (b.waxImg) b.waxImg.setTint(this._waxTint(b.waxType, Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1)));
    }
  }

  // heavy = colpo PESANTE (bastonata corpo a corpo): flash piu' lungo, "pop" di reazione
  // piu' marcato e rinculo maggiore. Senza heavy (es. pallina del getto) l'impatto c'e'
  // ma piu' contenuto, cosi' il corpo a corpo "pesa" piu' del getto.
  damageEnemy(e, dmg, heavy, dot) {
    // Guardia: un nemico gia' morto in questo stesso istante (es. due palline del ventaglio
    // che lo colpiscono nello stesso frame) non va rielaborato — altrimenti cerume/scossa/SPLIT
    // scatterebbero due volte per una sola morte.
    if (!e.active) return;
    // CROSTA = corazzata anti-getto: il GETTO (non heavy) la scalfisce appena e rimbalza
    // con un "clang"; solo il CORPO A CORPO (heavy) la abbatte come si deve. Il CORROSIVO (dot)
    // ignora l'armatura (il sapone la mangia) e non fa rinculo/pop (e' un danno "silenzioso").
    // Corazzati contro il GETTO: la crosta e la Regina delle Croste (boss del 2o tratto). Il
    // corpo a corpo fa danno pieno: e' il modo in cui il gioco insegna a cambiare arma.
    const armored = ((e.kind === 'crust' || e.bossArmor) && !heavy && !dot);
    // ⚠️ ARMATURA DELLA CROSTA AMMORBIDITA da 0,3 a 0,4 (2026-08-19). Non e' una taratura a
    // sensazione: alzandole la vita a 96+lvl*4 (tre bastonate col colpo base) col vecchio 0,3
    // servivano da 7 a 11 palline per abbatterla col getto, contro le 3 di mazza — la crosta
    // era diventata quasi immune a distanza invece che semplicemente scomoda. Con 0,4 tornano
    // 5 palline al livello 1, come prima del cambio di vita, e la mazza resta la scelta
    // migliore: 3 colpi in 1,5 secondi contro 5 palline in 1,7. La lezione ("qui cambia arma")
    // si impara lo stesso, senza punire chi preferisce sparare.
    // Il boss corazzato resta a 0,35: li' il tempo lungo e' voluto, e' uno scontro a se'.
    if (armored) dmg = Math.max(2, Math.round(dmg * (e.bossArmor ? 0.35 : 0.4)));   // lo scalfisce: poco ma visibile
    e.hp -= dmg;
    // ⚠️ IL NUMERO SI MOSTRA DOPO L'ARMATURA, cioe' il danno DAVVERO inflitto. Mostrare quello
    // "teorico" sarebbe peggio di non mostrarlo: sulla crosta si leggerebbe 39 mentre gliene
    // togli 12, e il giocatore concluderebbe che il gioco e' rotto invece di capire che li' serve
    // la mazza. E' anche il motivo per cui i numeri servono: il potenziamento del danno cambia
    // il conto delle bastonate solo ogni tanto (misurato: da 39 a 47 non cambia NIENTE contro la
    // crosta), e senza numeri quell'aumento e' invisibile.
    this.numeroDanno(e.x, e.y - 18, dmg, heavy ? 'forte' : (armored ? 'scalfito' : 'normale'));

    // Fuggitivo Dorato ed ELITE hanno una tinta permanente (e' la loro firma visiva): il lampo
    // del colpo la sovrascrive, va rimessa quando il lampo finisce, altrimenti resterebbero del
    // colore normale per il resto della vita. Il fuggitivo ha la precedenza (e' un evento).
    const restoreTint = () => {
      if (!e.active) return;
      e.clearTint();
      if (e.fugitive) e.setTint(0xfff0a8);
      else if (e.eliteTint) e.setTint(e.eliteTint);
    };
    if (dot) {
      e.setTintFill(0x9be86b);   // lampo verde = corrosione
      this.time.delayedCall(70, restoreTint);
    } else {
      e.setTintFill(armored ? 0xbfe0ff : 0xffffff);
      this.time.delayedCall(armored ? 55 : (heavy ? 95 : 75), restoreTint);

      if (armored) {
        // Guscio che respinge: scintilla + "clang", niente pop nè rinculo (sembra invulnerabile davanti).
        window.Sfx.crack();
        this.splat(e.x + (this.player.x < e.x ? -12 : 12), e.y - 4, 'hard');
      } else {
        // Pop di reazione: il nemico "sussulta" quando viene colpito (impatto visibile).
        if (e.kind !== 'boss') {
          const bs = e._baseScale || (e._baseScale = e.scaleX);
          e.setScale(bs * (heavy ? 1.22 : 1.13));
          this.time.delayedCall(85, () => { if (e.active && e._baseScale) e.setScale(e._baseScale); });
        }
        const dir = Math.sign(e.x - this.player.x) || 1;
        // Il Boss è massiccio: subisce molta meno spinta. La bastonata (heavy) spinge di piu' del getto.
        const boss = e.kind === 'boss';
        const kbX = boss ? (heavy ? 100 : 70) : (heavy ? 300 : 215);
        const kbY = boss ? (heavy ? -70 : -60) : (heavy ? -205 : -150);
        e.setVelocity(dir * kbX, kbY);
        e.knockUntil = this.time.now + (heavy ? 260 : 190);
        // Un colpo INTERROMPE l'attacco in carica/affondo del nemico (ricompensa il colpire per primo).
        if (e.atkState && e.atkState !== 'idle') { e.atkState = 'idle'; e.atkReadyAt = this.time.now + 500; if (e._baseScale) e.setScale(e._baseScale); }
        // Idem per il moscerino: un colpo lo butta fuori dalla carica/picchiata.
        if (e.kind === 'fly' && e.diveState && e.diveState !== 'hover') { e.diveState = 'recover'; e.diveReadyAt = this.time.now + 900; this.ripristinaTinta(e); }
      }
    }
    if (e.hp <= 0) {
      window.Sfx.enemyDie();
      const pl = window.GameState.player;
      // ASSEDIO: ogni nemico eliminato conta per la quota, e appena la raggiungi hai finito —
      // anche se avanza tempo. Cosi' essere aggressivi ti fa uscire prima, invece di lasciarti
      // ad aspettare che il cronometro finisca.
      if (this.levelKind === 'siege' && !this.locked) {
        this.siegeKills += 1;
        // ⚠️ L'interfaccia va ridisegnata QUI, non al fotogramma dopo: `levelComplete()` mette
        // `locked` e da quel momento update() esce subito, quindi il contatore resterebbe
        // fermo a uno in meno e l'ultimo nemico sembrerebbe non essere mai stato contato
        // (segnalato nel playtest: "si vede il counter al nemico n-1").
        this.updateHud();
        if (this.siegeKills >= this.siegeQuota) { this.levelComplete(); return; }
      }
      // Il cerume dei nemici ora si RACCOGLIE (pallina, come le pedane) invece di accreditarsi
      // da solo — l'economia passa quasi tutta da qui (F.1b). ECCEZIONE Fuggitivo Dorato:
      // ricompensa EVENTO, accredito istantaneo come prima (niente pallina da rincorrere).
      if (e.fugitive) window.GameState.wax += Math.round(e.waxValue * (pl.waxMult || 1) * (this.mutWaxMult || 1));
      else this.dropWaxPellet(e.x, e.y - 8, e.waxValue);
      // Abilità VITA RUBATA: uccidere cura un po' (piu' col boss).
      if (pl.lifesteal) {
        const heal = e.kind === 'boss' ? 25 : 3;
        pl.hp = Math.min(pl.maxHp, pl.hp + heal);
        this.healFx(this.player.x, this.player.y);
      }
      if (e.kind === 'boss') {
        this.cameras.main.shake(260, 0.014);
        this.burst(e.bitKey, e.x, e.y, 28);
        this.showBanner(this.cartelloBoss('game_boss_dead', e), '#ffd166');
        this.addWaxPickup(e.x - 22, e.y - 8, true);
        this.addWaxPickup(e.x + 22, e.y - 8, true);
      } else {
        this.cameras.main.shake(110, 0.009);
        this.hitStop(this._rimbalzoInCorso ? 30 : 85);   // vedi stompEnemy: non deve frenare il rimbalzo
        this.burst(e.bitKey, e.x, e.y, 18);
        this.maybeSpeech('kill', 0.18);   // CARATTERE COMICO: commento occasionale (non su OGNI uccisione)
      }
      if (e.elite === 'boom') this.enemyExplode(e.x, e.y);   // ESPLOSIVO: scoppio ritardato ad area
      if (e.elite === 'split') this.spawnSplitChildren(e);   // SPLIT: si sdoppia sul posto
      if (e.fugitive) this.showBanner(window.I18n.t('event_goldfugitive_caught', { wax: e.waxValue }), '#ffd700');
      e.destroy();
    }
  }

  // SPLIT: alla morte, genera fino a 2 nemici piu' piccoli sul posto (mai a loro volta elite:
  // vedi il filtro opts.splitChild in spawnEnemy, che li esclude anche dal ri-sdoppiarsi).
  // Rispetta il tetto di nemici del livello: il genitore e' ancora "active" in questo istante,
  // va tolto dal conteggio per capire quanto spazio si libera.
  spawnSplitChildren(e) {
    const activeAfterParent = this.enemies.countActive(true) - 1;
    const room = Math.max(0, this.maxEnemies - activeAfterParent);
    const count = Math.min(2, room);
    for (let i = 0; i < count; i++) {
      const ox = (i === 0 ? -1 : 1) * Phaser.Math.Between(16, 26);
      this.spawnEnemy(e.kind, { splitChild: true, x: e.x + ox });
    }
  }

  // IA dei nemici a terra "melee" (cerumino, crosta): oltre a camminare verso il
  // giocatore, quando gli e' vicino esegue un AFFONDO TELEGRAFATO:
  //   idle (cammina) -> windup (si accovaccia + lampeggia ~0,42s = telegrafo) ->
  //   lunge (balzo verso il giocatore ~0,32s) -> recupero prima del prossimo affondo.
  // Cosi' lo scontro diventa "leggi e reagisci": puoi schivare (salto/scatto) o
  // colpirlo durante la carica per interromperlo (vedi damageEnemy).
  // Verso in cui muoversi per raggiungere il giocatore, con una ZONA MORTA attorno allo zero.
  // ⚠️ SENZA LA ZONA MORTA IL NEMICO VIBRA. Succede ogni volta che il giocatore e' esattamente
  // sopra la sua testa — tipico quando sei su una rampa o una pedana: la differenza di posizione
  // orizzontale oscilla attorno allo zero, il segno si ribalta a ogni fotogramma e il nemico
  // sfarfalla a destra e sinistra invece di fermarsi (segnalato nel playtest).
  // Restituisce 0 = "sei praticamente sopra di me, sto fermo", che e' uno stato STABILE: da
  // fermo il nemico non si sposta piu', quindi non puo' rientrare in oscillazione da solo.
  versoIlGiocatore(e) {
    const dx = this.player.x - e.x;
    return (Math.abs(dx) < GameScene.ZONA_MORTA) ? 0 : Math.sign(dx);
  }

  groundEnemyAI(e, now) {
    const dx = this.player.x - e.x;
    const verso = this.versoIlGiocatore(e);
    // Per il TELEGRAFO dell'affondo serve comunque un verso: se sei sopra la testa si tiene
    // quello dell'ultimo balzo invece di sceglierne uno a caso.
    const dir = verso || (e.lungeDir || 1);

    if (e.atkState === 'windup') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 90) % 2) ? 0xffe066 : (e.eliteTint || 0xffffff));  // lampeggia = "sta per saltare"
      if (now >= e.windupUntil) {                       // fine carica -> parte l'affondo
        e.atkState = 'lunge';
        e.lungeUntil = now + 320;
        this.ripristinaTinta(e);
        if (e._baseScale) e.setScale(e._baseScale);
        e.setVelocity(e.lungeDir * (e.speed * 3.0 + 120), -190);
      }
      return;
    }
    if (e.atkState === 'lunge') {
      e.setFlipX(e.lungeDir < 0);
      if (now >= e.lungeUntil) {                         // atterrato/finito -> recupero
        e.atkState = 'idle';
        e.atkReadyAt = now + 750;
        e.setVelocityX(0);
      }
      return;                                            // durante il balzo mantiene lo slancio
    }

    // idle: se il giocatore e' vicino ed e' pronto, inizia la carica; altrimenti cammina.
    const near = Math.abs(dx) < 155 && Math.abs(this.player.y - e.y) < 72;
    if (near && now >= (e.atkReadyAt || 0) && e._grounded) {
      e.atkState = 'windup';
      e.windupUntil = now + 420;
      e.lungeDir = dir;
      e.setVelocityX(0);
      e.setTint(0xffe066);                               // telegrafo: lampeggia caldo
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      e.setScale(bs * 1.22, bs * 0.8);                   // si accovaccia (carica il balzo)
      e.setFlipX(dir < 0);
      return;
    }
    // Camminando resta nella posa in piedi: il saltatore non ha un ciclo di passo (l'animazione
    // che ha e' un SALTO), e a schermo si muove cosi' poco fra un balzo e l'altro che una posa
    // ferma non si nota — mentre un ciclo inventato si noterebbe eccome.
    if (e.anims && !e.anims.isPlaying) e.setFrame(0);
    if (verso === 0) {
      e.setVelocityX(0);   // sei sopra di me: mi fermo (e NON tocco il verso in cui guardo,
      return;              // se no sfarfallerebbe quello al posto del movimento)
    }
    e.setVelocityX(verso * e.speed);
    e.setFlipX(verso < 0);
  }

  // IA della PULCE: a differenza del cerumino (un affondo telegrafato solo quando sei vicino),
  // la Pulce saltella SEMPRE verso il giocatore, un balzo BASSO e frequente dopo l'altro -
  // nessun telegrafo, non e' un'imboscata: e' solo fastidiosa e imprevedibile da colpire mentre
  // e' in aria. Riparte da terra appena atterra e il cooldown e' scaduto.
  fleaAI(e, now) {
    const dir = Math.sign(this.player.x - e.x) || (e.hopDir || 1);
    const onGround = e._grounded;
    if (onGround && now >= (e.hopReadyAt || 0)) {
      e.hopDir = dir;
      e.setVelocity(dir * e.speed * 2.2, -480);   // balzo ancora piu' alto (era -380, prima -260)
      e.hopReadyAt = now + 950;                    // invariato: l'aria in volo (~870ms) resta sotto al cooldown
    }
    e.setFlipX(dir < 0);
  }

  // IA del SALTATORE: stesso schema a stati del cerumino (carica telegrafata -> balzo ->
  // recupero) ma ESAGERATO - carica piu' lunga (piu' tempo per reagire, il balzo e' pericoloso),
  // balzo molto piu' alto/lungo (puo' scavalcarti o atterrarti sopra), e all'atterraggio una
  // piccola onda d'urto (danno se sei troppo vicino, oltre al contatto diretto).
  hopperAI(e, now) {
    const dx = this.player.x - e.x;
    const dir = Math.sign(dx) || (e.lungeDir || 1);

    if (e.atkState === 'windup') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 90) % 2) ? 0xffb066 : (e.eliteTint || 0xffffff));
      if (now >= e.windupUntil) {
        e.atkState = 'lunge';
        e.lungeUntil = now + 520;
        this.ripristinaTinta(e);
        if (e._baseScale) e.setScale(e._baseScale);
        e.play('hopper_volo', true);
        e.setVelocity(e.lungeDir * (e.speed * 2.4 + 160), -420);
      }
      return;
    }
    if (e.atkState === 'lunge') {
      e.setFlipX(e.lungeDir < 0);
      // Atterrato per davvero (non nel primo istante del balzo, dove il corpo tocca ancora
      // terra per un frame): stesso accorgimento gia' usato altrove per l'accovacciamento.
      const landed = e._grounded && now - e.lungeStartAt > 200;
      if (now >= e.lungeUntil || landed) {
        e.atkState = 'idle';
        e.atkReadyAt = now + 900;
        e.setVelocityX(0);
        e.play('hopper_atterra', true);
        this.hopperLandFx(e.x, e.y);
      }
      return;
    }

    const near = Math.abs(dx) < 260 && Math.abs(this.player.y - e.y) < 90;
    if (near && now >= (e.atkReadyAt || 0) && e._grounded) {
      e.atkState = 'windup';
      e.windupUntil = now + 550;   // carica piu' lunga del cerumino: il balzo e' molto piu' grosso
      e.lungeDir = dir;
      e.lungeStartAt = now;
      e.setVelocityX(0);
      e.setTint(0xffb066);
      // Lo schiacciamento ora lo fa il DISEGNO (animazione 'hopper_carica'): quello finto a
      // scala che c'era prima lo raddoppiava e faceva sembrare il saltatore di gomma.
      e.play('hopper_carica', true);
      e.setFlipX(dir < 0);
      return;
    }
    e.setVelocityX(dir * e.speed);
    e.setFlipX(dir < 0);
  }

  // Onda d'urto all'atterraggio del Saltatore: danno ad area se sei troppo vicino (oltre
  // all'eventuale contatto diretto, gia' gestito centralmente per tutti i nemici).
  hopperLandFx(x, y) {
    const R = 60;
    const ring = this.add.circle(x, y, R, 0xff8a4a, 0.3).setDepth(11).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
    this.cameras.main.shake(90, 0.006);
    if (Math.hypot(this.player.x - x, this.player.y - y) < R) {
      this.hurtPlayer(Math.round(6 + window.GameState.level * 1.5), x);
    }
  }

  // REGINA DELLE CROSTE: sbatte il guscio a terra e lancia tre schegge che corrono lungo il
  // profilo del terreno. Restituisce TRUE se ha gestito lei il fotogramma: durante un attacco
  // il boss non fa nient'altro.
  bossOnda(e, now) {
    // --- REGINA DELLE CROSTE (boss del 2o tratto): ONDATA DI SCHEGGE.
    // Prima caricava in orizzontale, ma il terreno e' a colline e la carica ci andava a SCATTI
    // (il corpo veniva riagganciato al profilo a ogni dislivello) — bocciata dall'utente
    // 2026-07-29. Ora resta ferma e sbatte il guscio a terra: partono tre schegge che CORRONO
    // LUNGO IL PROFILO del terreno, quindi le colline non le disturbano, anzi le seguono. Si
    // schivano col salto, esattamente come si sarebbe schivata la carica.
    if (e.bossAtk === 'ondatawind') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 80) % 2) ? 0xff6b5a : (e.eliteTint || 0xffffff));
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      e.setScale(bs * 0.94, bs * 1.14);            // si solleva sulle zampe
      if (now >= e.ondataWindupUntil) {
        this.ripristinaTinta(e);
        e.setScale(bs);
        e.bossAtk = null;
        e.slamReadyAt = now + (e._enraged ? 2400 : 3600);
        this.bossSlamFx(e, e.x, this.terrainTopAt(e.x));
        this.cameras.main.shake(240, 0.013);
        const verso = Math.sign(this.player.x - e.x) || 1;
        for (let i = 0; i < 3; i++) {
          this.time.delayedCall(i * 150, () => { if (e.active && !this.locked) this.lanciaScheggia(e, verso); });
        }
      }
      return true;
    }
    return false;
  }

  // Telegrafo del balzo+schiacciata: fermo, lampeggia, si accovaccia. Alla fine parte il salto.
  // Restituisce TRUE se ha gestito lei il fotogramma.
  bossCaricaSalto(e, now, dir) {
    // Balzo+schiacciata IN CORSO: fermo/immobile durante il telegrafo, poi balza verso il
    // giocatore; niente avanzata "normale" ne' sputo finche' non e' finito (gate e.bossAtk).
    if (e.bossAtk === 'slamwind') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 90) % 2) ? 0xff8a4a : 0xffffff);
      if (now >= e.slamWindupUntil) {
        this.ripristinaTinta(e);
        if (e._baseScale) e.setScale(e._baseScale);
        e.bossAtk = 'slamjump';
        e.slamStartAt = now;
        e.slamDir = dir;
        e.setFlipX(dir < 0);
        // Arco VERTICALE (round 2, D.1): salto alto (-600, apice ~164px, quasi il doppio del
        // vecchio -430 di appena 84px) che ATTERRA SUL giocatore invece di superarlo — la
        // velocita' orizzontale si calcola dalla distanza reale al bersaglio (non un
        // moltiplicatore fisso di e.speed) assumendo un volo simmetrico (stessa quota di
        // partenza/arrivo): T = 2*|vy|/g, vx = distanza/T. Clamp di sicurezza (non dovrebbe
        // mai servire, il raggio d'innesco e' comunque limitato).
        const SLAM_VY = 600;
        const flightT = (2 * SLAM_VY) / this.physics.world.gravity.y;
        const vx = Phaser.Math.Clamp((this.player.x - e.x) / flightT, -420, 420);
        e.setVelocity(vx, -SLAM_VY);
        e.slamApex = (SLAM_VY * SLAM_VY) / (2 * this.physics.world.gravity.y);   // per l'ombra sotto
        // VENDERE il salto: stiramento verticale, ma APPLICATO UN ATTIMO DOPO il decollo (~50ms),
        // NON sullo stesso frame del lancio. In questa build `setScale` ridimensiona anche il CORPO
        // fisico (vedi gotcha nota): ingrandirlo mentre il boss e' ancora appoggiato a terra fa
        // ri-separare il corpo dal suolo e ANNULLA la velocita' di salto — era la vera causa del
        // "boss ancorato a terra" (il fix D.1 del round 2 non funzionava davvero in gioco, il salto
        // veniva azzerato all'istante). Scoperto 2026-07-18. A terra il boss resta a scala normale
        // (ripristinata sopra, riga ~clearTint); lo stiramento parte quando e' gia' in aria.
        const bs = e._baseScale || (e._baseScale = e.scaleX);
        this.time.delayedCall(50, () => {
          if (!e.active || e.bossAtk !== 'slamjump') return;   // gia' atterrato / morto: niente stiramento
          e.setScale(bs * 0.9, bs * 1.2);
          this.tweens.add({ targets: e, scaleX: bs, scaleY: bs, duration: 200, ease: 'Quad.out' });
        });
        if (!e.slamShadow) {
          e.slamShadow = this.add.ellipse(e.x, this.terrainTopAt(e.x), 70, 18, 0x000000, 0.35).setDepth(6);
        }
        e.slamShadow.setPosition(e.x, this.terrainTopAt(e.x)).setScale(1).setAlpha(0.35).setVisible(true);
      }
      return true;
    }
    return false;
  }

  // Boss per aria durante la schiacciata: aggiorna l'ombra a terra (che dice DOVE cadra') e
  // chiude l'attacco all'atterraggio. Restituisce TRUE se ha gestito lei il fotogramma.
  bossInVolo(e, now) {
    if (e.bossAtk === 'slamjump') {
      e.setFlipX(e.slamDir < 0);
      // Ombra a terra: segue orizzontalmente, si rimpicciolisce/schiarisce mentre sale (stessa
      // logica dell'altezza apice usata per calcolare la traiettoria, cosi' resta coerente).
      if (e.slamShadow) {
        const surf = this.terrainTopAt(e.x);   // superficie LOCALE sotto il boss
        const heightRatio = Phaser.Math.Clamp((surf - e.body.bottom) / (e.slamApex || 1), 0, 1);
        e.slamShadow.setPosition(e.x, surf);
        e.slamShadow.setScale(1 - heightRatio * 0.65);
        e.slamShadow.setAlpha(0.35 * (1 - heightRatio * 0.55));
      }
      // Atterrato per davvero (non nel primo istante del balzo, dove il corpo tocca ancora
      // terra per un frame): stesso accorgimento gia' usato per il Saltatore.
      const landed = e._grounded && now - e.slamStartAt > 250;
      if (landed) {
        e.bossAtk = null;
        e.setVelocityX(0);
        if (e.slamShadow) { e.slamShadow.destroy(); e.slamShadow = null; }
        this.bossSlamFx(e, e.x, e.y);
        e.slamReadyAt = now + (e._collapse ? 2200 : (e._enraged ? 3000 : 4500));
      }
      return true;
    }
    return false;
  }

  // I due passaggi di fase del boss: la FURIA a meta' vita (tutti) e il CROLLO del condotto a un
  // quarto (solo il boss finale). Scattano una volta sola ciascuno.
  bossCambioFase(e, now, enraged) {
    if (enraged && !e._enraged) {                 // passaggio di fase (2a): FURIA
      e._enraged = true;
      this.cameras.main.shake(200, 0.01);
      this.showBanner(this.cartelloBoss('game_boss_enrage', e), '#ff7043');
      e.spitEvery = Math.max(700, Math.round(e.spitEvery * 0.6));
      e._summonAt = now + 2500;
    }
    // FINALE, terza fase a 25% HP (round A, A.2): il condotto CROLLA. Parte la frana di cerume dal
    // soffitto (l'infrastruttura dell'evento 'quake', mai usata sui boss normali) e l'offesa sale
    // ancora — sputo a 5 vie e slam piu' ravvicinato (vedi sotto). Scatta UNA volta sola.
    if (e.finale && e.hp <= e.maxHp * 0.25 && !e._collapse) {
      e._collapse = true;
      this.cameras.main.shake(450, 0.018);
      // yPos piu' basso (175): normalmente furia (50%) e crollo (25%) scattano in momenti diversi,
      // ma un colpo molto forte puo' attraversare entrambe le soglie nello stesso frame -> cosi' i
      // due banner non si sovrappongono mai (quello della furia sta a 118).
      this.showBanner(window.I18n.t('game_boss_collapse'), '#ff5252', 175);
      this.placeStalactites();
      this.scheduleQuakePulse();
      e.spitEvery = Math.max(500, Math.round(e.spitEvery * 0.7));
    }
  }

  // Sputo col suo telegrafo: lampeggia ~0,32s e poi lancia. Quante palline dipende dalla fase.
  bossSputo(e, now, enraged) {
    // Sputo con TELEGRAFO: quando è ora di sputare, lampeggia ~0,32s poi lancia.
    // ⚠️ Il "sta nell'inquadratura" NON si ricontrolla qui: lo verifica gia' chi chiama. Restare
    // anche qui vorrebbe dire tenere la stessa regola in due posti, e prima o poi divergono.
    if (now >= (e.nextSpit || 0)) {
      if (!e.spitWindupAt) e.spitWindupAt = now;
      e.setTint((Math.floor(now / 80) % 2) ? 0xffe066 : (e.eliteTint || 0xffffff));
      if (now - e.spitWindupAt >= 320) {
        this.ripristinaTinta(e);
        e.spitWindupAt = 0;
        if (e._collapse) { this.spitAt(e, -240); this.spitAt(e, -120); this.spitAt(e, 0); this.spitAt(e, 120); this.spitAt(e, 240); }  // 5 vie (finale)
        else if (enraged) { this.spitAt(e, -150); this.spitAt(e, 0); this.spitAt(e, 150); }  // ventaglio 3 vie
        else this.spitAt(e, 0);
        e.nextSpit = now + e.spitEvery;
      }
    }
  }

  // IA del BOSS (Tappo di Cerume): avanza lento e SPUTA con telegrafo (breve carica
  // lampeggiante prima del lancio), INTERCALATO a un "Balzo + schiacciata" a cooldown
  // (macchina a stati in e.bossAtk: null|'slamwind'|'slamjump'). A META' VITA si INFURIA:
  // sputo piu' frequente e a VENTAGLIO (3 vie), slam piu' frequente, evoca un cerumino ogni
  // tanto. Chiamato dal loop nemici.
  bossAI(e, now) {
    const dir = Math.sign(this.player.x - e.x) || 1;
    // ⚠️ FUORI INQUADRATURA IL BOSS NON ATTACCA. Il boss nasce lontano e si avvicina: prima
    // sputava gia' mentre era oltre il bordo dello schermo, e al giocatore arrivavano proiettili
    // da un nemico che non aveva ancora visto (segnalato nel playtest). Cammina lo stesso — deve
    // avvicinarsi — ma niente sputi ne' telegrafi finche' non e' entrato.
    // Il gorgogliante ha da sempre lo stesso cancello (vedi aggiornaNemici): qui mancava.
    // Il margine e' generoso: l'attacco puo' partire appena il boss spunta, non quando e' gia'
    // in mezzo allo schermo. Gli attacchi GIA' AVVIATI si lasciano finire (i return qui sotto
    // stanno prima, cosi' un telegrafo non resta congelato a meta').
    const cam = this.cameras.main;
    const inQuadro = e.x > cam.scrollX - 40 && e.x < cam.scrollX + cam.width + 40;

    if (this.bossOnda(e, now)) return;

    if (this.bossCaricaSalto(e, now, dir)) return;
    if (this.bossInVolo(e, now)) return;

    e.setVelocityX(dir * e.speed);
    e.setFlipX(dir < 0);

    // Finche' e' fuori inquadratura il conto alla rovescia dello sputo viene rimandato in
    // avanti: se lo lasciassimo maturare, il boss entrerebbe in scena scaricando in un colpo
    // solo tutti gli sputi che si e' "risparmiato" mentre non lo vedevi.
    if (!inQuadro) { e.nextSpit = now + (e.spitEvery || 1500); e.spitWindupAt = 0; }

    const enraged = e.hp <= e.maxHp * 0.5;
    this.bossCambioFase(e, now, enraged);


    // Pronto + giocatore abbastanza vicino + boss a terra: parte il telegrafo dello slam.
    // Raggio allargato da 360 a 440 (round 2, D.1): con l'arco piu' verticale il boss deve
    // poter agganciare lo slam anche quando il giocatore lo tiene a distanza col getto.
    if (inQuadro && now >= (e.slamReadyAt || 0) && Math.abs(this.player.x - e.x) < 440 &&
        e._grounded) {
      if (e.bossKind === 'regina') {
        e.bossAtk = 'ondatawind';
        e.ondataWindupUntil = now + 620;   // telegrafo lungo: si vede che sta per sbattere
        e.setVelocityX(0);
        return;
      }
      e.bossAtk = 'slamwind';
      e.slamWindupUntil = now + 600;   // telegrafo lungo: e' pesante, si vede arrivare
      e.setVelocityX(0);
      e.setTint(0xff8a4a);
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      e.setScale(bs * 1.22, bs * 0.72);   // si accovaccia
      return;
    }

    if (inQuadro) this.bossSputo(e, now, enraged);

    // In furia: evoca uno sgherro ogni tanto (se non ce ne sono già troppi).
    if (inQuadro && enraged && now >= (e._summonAt || Number.MAX_SAFE_INTEGER)) {
      // La Regina chiama CROSTE (corazzate come lei): coerente con chi e', e costringe a tenere
      // la mazza in mano anche sugli sgherri invece di ripulirli col getto da lontano.
      if (this.enemies.countActive(true) < 4) this.spawnEnemy(e.bossKind === 'regina' ? 'crust' : 'blob');
      e._summonAt = now + 5000;
    }
  }

  // Onda d'urto all'atterraggio dello slam del boss: anello grosso + shake forte + danno ad
  // area al giocatore (se entro raggio) e al cerume vicino (stesso pattern di hopperLandFx,
  // ma piu' intenso: il boss e' molto piu' pesante del Saltatore).
  bossSlamFx(e, x, y) {
    const R = 100;
    const ring = this.add.circle(x, y, R, 0xff6b3d, 0.35).setDepth(12).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.smash();
    this.cameras.main.shake(220, 0.014);
    if (Math.hypot(this.player.x - x, this.player.y - y) < R) {
      this.hurtPlayer(Math.round(e.contactDamage * 0.9), x);
    }
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, 20);
    });
  }

  // Onda d'urto dello SCHIANTO (Abilità del giocatore): stesso trattamento del boss (C.1), ma
  // dal giocatore verso i nemici — "impari dal boss" la stessa mossa. Danno ad area a nemici e
  // cerume vicini, niente danno al giocatore stesso ovviamente.
  playerSlamFx() {
    const p = window.GameState.player;
    const x = this.player.x, y = this.player.body.bottom;
    const R = 100;
    const dmg = Math.round(p.damage * 0.8);
    const ring = this.add.circle(x, y, R, 0xff6b3d, 0.35).setDepth(12).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.smash();
    this.cameras.main.shake(180, 0.012);
    this.setJuice(1.32, 0.7);   // schiacciamento forte all'impatto (piu' dell'atterraggio normale)
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg, true);
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, Math.round(dmg * 0.6));
    });
  }

  // IA del GORGOGLIANTE (nemico azzurrino a distanza): avanza lento verso il giocatore;
  // quando è pronto e il giocatore è NELL'INQUADRATURA, si CARICA (si comprime + lampeggia
  // ~0,3s) e poi ESPELLE la pallina. Fuori campo NON spara (range d'attacco limitato).
  spitEnemyAI(e, now, onScreen) {
    const dir = Math.sign(this.player.x - e.x) || 1;
    e.setFlipX(dir < 0);

    // Carica in corso: fermo, si comprime, poi lancia.
    if (e.spitWindupAt) {
      e.setVelocityX(0);
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      const t = Phaser.Math.Clamp((now - e.spitWindupAt) / 300, 0, 1);
      e.setScale(bs * (1 + 0.18 * t), bs * (1 - 0.16 * t));           // si comprime (carica)
      e.setTint((Math.floor(now / 70) % 2) ? 0x9fe0ff : (e.eliteTint || 0xffffff));
      if (now - e.spitWindupAt >= 300) {
        e.setScale(bs); this.ripristinaTinta(e); e.spitWindupAt = 0;
        this.spitAt(e);                                              // espelle
        e.nextSpit = now + e.spitEvery;
      }
      return;
    }
    // Pronto e giocatore in vista: inizia la carica.
    if (onScreen && now >= (e.nextSpit || 0)) {
      e.spitWindupAt = now;
      e.setVelocityX(0);
      return;
    }
    // Altrimenti avanza lento verso il giocatore.
    e.setVelocityX(dir * e.speed);
  }

  // IA del MOSCERINO (volante): si LIBRA sopra il giocatore ondeggiando e avvicinandosi in
  // orizzontale; quando è pronto e più o meno sopra di te, si CARICA (fermo a mezz'aria,
  // lampeggia ~0,35s) e poi PICCHIA verso la tua posizione (schivabile), infine RISALE alla
  // quota di volo e ricomincia. Stati in e.diveState: hover|wind|dive|recover.
  flyAI(e, now) {
    const px = this.player.x, py = this.player.y;
    // Quota di volo tenuta SOTTO il soffitto locale (round 4) cosi' il moscerino non spinge
    // contro i collider del soffitto nei tratti bassi.
    const hoverY = Phaser.Math.Clamp(py - 150, this.ceilingYAt(e.x) + 40, this.groundTop - 110);

    // CARICA: fermo a mezz'aria, lampeggia; poi parte la picchiata verso il bersaglio bloccato.
    if (e.diveState === 'wind') {
      e.setVelocity(0, -8);
      e.setTint((Math.floor(now / 60) % 2) ? 0xffe066 : (e.eliteTint || 0xffffff));
      if (now >= e.diveTimer) {
        this.ripristinaTinta(e);
        const dx = e.diveTX - e.x, dy = e.diveTY - e.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.max(360, e.speed * 3.2);   // picchiata scattante (schivabile grazie al telegrafo)
        e.setVelocity((dx / d) * sp, (dy / d) * sp);
        e.setFlipX(dx < 0);
        e.diveState = 'dive';
        e.diveTimer = now + 800;   // durata massima della picchiata
      }
      return;
    }

    // PICCHIATA: prosegue dritta finché non arriva al bersaglio / tocca il basso / scade.
    if (e.diveState === 'dive') {
      if (now >= e.diveTimer || e.y >= this.groundTop - 24 ||
          (Math.abs(e.x - e.diveTX) < 18 && Math.abs(e.y - e.diveTY) < 18)) {
        e.diveState = 'recover';
      }
      return;
    }

    // RISALITA: torna su alla quota di volo, poi si rimette a librarsi (con attesa).
    if (e.diveState === 'recover') {
      e.setVelocity((px - e.x) * 0.6, -e.speed * 0.95);
      e.setFlipX((px - e.x) < 0);
      if (e.y <= hoverY + 16) { e.diveState = 'hover'; e.diveReadyAt = now + Phaser.Math.Between(1400, 2200); }
      return;
    }

    // HOVER (default): si libra sopra di te ondeggiando e avvicinandosi in orizzontale.
    const targetY = hoverY + Math.sin(now * 0.006 + (e.bobPhase || 0)) * 12;
    e.setVelocity(
      Phaser.Math.Clamp(px - e.x, -e.speed, e.speed) * 0.9,
      Phaser.Math.Clamp((targetY - e.y) * 4, -e.speed, e.speed)
    );
    e.setFlipX((px - e.x) < 0);
    // Pronto e più o meno sopra il giocatore → carica la picchiata (mira dove sei ORA).
    if (now >= (e.diveReadyAt || 0) && Math.abs(px - e.x) < 130) {
      e.diveState = 'wind';
      e.diveTimer = now + 350;
      e.diveTX = px; e.diveTY = py + 6;
      e.setVelocity(0, 0);
    }
  }

  // SALTO SUI NEMICI: rimbalzo + danno al nemico, niente danno al giocatore (vedi il rilevamento
  // in update, prima dello snap al terreno). Non sul boss (escluso a monte).
  stompEnemy(e) {
    const p = window.GameState.player;
    const now = this.time.now;
    // PIEDI SULLA TESTA prima di rimbalzare. La rilevazione e' predittiva (vedi update): senza
    // questo appoggio il rimbalzo scatterebbe con il PG ancora staccato dal nemico e non si
    // "sentirebbe" l'impatto — e' esattamente il difetto segnalato dal playtest.
    this.player.body.y += (e.body.top - this.player.body.bottom);
    this.player.y = this.player.body.center.y;                // lo sprite segue subito, non al frame dopo
    // Spinta del rimbalzo (manopola di prova "rimbalzo": a 1 e' quella normale).
    // Alzata due volte dal playtest: 0,72 -> 0,95 -> 1,15. Sopra 1 il rimbalzo manda PIU' IN ALTO
    // di un salto normale, ed e' voluto: e' la ricompensa del colpo in testa e quello che permette
    // di incatenare due nemici uno dopo l'altro senza toccare terra in mezzo.
    const spinta = 1.15 * (window.Taratura ? window.Taratura.v('rimbalzo') : 1);
    this.player.setVelocityY(-p.jumpVelocity * spinta);       // rimbalzo (e blocca lo snap: vy<0)
    this.jumpsLeft = p.doubleJump ? 2 : 1;                    // puoi risaltare dopo il rimbalzo
    this.canCutJump = true;
    this.invulnUntil = Math.max(this.invulnUntil, now + 400); // il rimbalzo ti porta via pulito (niente colpo al ritorno)
    this.setJuice(1 + window.CONFIG.JUICE_LAND, 1 - window.CONFIG.JUICE_LAND);
    window.Sfx.jump();
    // Sui BOSS il rimbalzo funziona lo stesso (prima li si attraversava e sembrava un bug —
    // segnalato sulla Regina), ma il danno e' ridotto: saltargli in testa non deve diventare
    // la scorciatoia per batterli.
    // ⚠️ IL CONGELAMENTO VA ACCORCIATO, QUI. Uccidendo un nemico la fisica si ferma 85ms per dare
    // peso al colpo — ma in un rimbalzo quel congelamento arriva DOPO che la spinta verso l'alto
    // e' gia' stata impostata, quindi il personaggio resta appeso in aria un decimo di secondo e
    // solo dopo schizza su. E' la causa del "rimbalzo ritardato rispetto all'impatto" segnalato
    // nel playtest: non era la rilevazione a essere in ritardo, era la partenza a essere bloccata.
    // Un colpetto piu' breve resta (serve a far sentire l'impatto), ma non si legge piu' come attesa.
    this._rimbalzoInCorso = true;
    this.damageEnemy(e, Math.max(1, Math.round(p.damage * (e.kind === 'boss' ? 0.35 : 1.1))), true);
    this._rimbalzoInCorso = false;
  }

  hurtPlayer(dmg, sourceX) {
    const now = this.time.now;
    if (now < this.invulnUntil || this.locked) return;
    if (window.Taratura && window.Taratura.godmode()) return;   // manopola di prova: vita infinita
    // Abilità SCUDO: para il colpo se è "carico" (ricarica ogni 6s). Niente danno.
    const pl = window.GameState.player;
    if (pl.shield && now >= (this.shieldReadyAt || 0)) {
      this.shieldReadyAt = now + 6000;
      this.invulnUntil = now + 500;
      window.Sfx.hit();
      this.shieldBreakFx(sourceX);
      if (this.shieldAura) this.shieldAura.setVisible(false);   // ora in ricarica: alone spento
      return;
    }
    this.invulnUntil = now + 1200;   // mercy-invuln allungata (giro difficolta' 2026-07-25): 0,9->1,2s
    window.GameState.player.hp -= dmg;
    if (pl.rage) this.rageReadyUntil = now + 4000;   // Abilità RABBIA: arma il prossimo attacco
    window.Sfx.hurt();
    this.cameras.main.shake(120, 0.01);
    // JUICE — colpo incassato: schiacciata netta (solo quando il danno e' REALMENTE applicato,
    // non se lo scudo para o si e' invulnerabili — quei casi escono prima, sopra).
    this.setJuice(1 + window.CONFIG.JUICE_HIT, 1 - window.CONFIG.JUICE_HIT);
    this.maybeSpeech('hit', 0.35);   // CARATTERE COMICO: reazione occasionale al colpo
    const dir = Math.sign(this.player.x - sourceX) || 1;
    this.player.setVelocity(dir * 240, -260);
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: 4 });
    if (window.GameState.player.hp <= 0) {
      // Abilità SECONDA VITA: sopravvivi a un colpo mortale, UNA SOLA VOLTA per l'intera run.
      if (pl.secondLife && !pl.secondLifeUsed) {
        pl.secondLifeUsed = true;
        pl.hp = Math.max(1, Math.round(pl.maxHp * 0.35));
        this.invulnUntil = now + 1300;
        this.secondLifeFx();
        return;
      }
      window.GameState.player.hp = 0;
      this.gameOver();
    }
  }

  // Effetto SECONDA VITA: esplosione dorata + lampo, per far capire che sei "risorto".
  secondLifeFx() {
    const x = this.player.x, y = this.player.y;
    window.Sfx.smash();
    const ring = this.add.circle(x, y, 24, 0xffe08a, 0).setStrokeStyle(5, 0xffd166, 1).setDepth(23);
    this.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 480, ease: 'Quad.out', onComplete: () => ring.destroy() });
    const flash = this.add.circle(x, y, 34, 0xffffff, 0.8).setDepth(23);
    this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => flash.destroy() });
    this.heroVisual.setTintFill(0xffe08a);
    this.time.delayedCall(140, () => { if (this.heroVisual && this.heroVisual.active) this.tintaPersonaggio(); });
    this.cameras.main.shake(220, 0.012);
    this.showBanner(window.I18n.t('game_second_life'), '#ffd166');
  }

  // Effetto "vita rubata": un lampo verde che sale dal giocatore.
  healFx(x, y) {
    const c = this.add.circle(x, y - 10, 7, 0x6bd66b, 0.9).setDepth(21);
    this.tweens.add({ targets: c, y: y - 40, alpha: 0, scale: 1.6, duration: 420, ease: 'Quad.out', onComplete: () => c.destroy() });
  }

  // Alone permanente dello scudo: una bolla azzurra attorno al giocatore, VISIBILE solo
  // quando lo scudo è CARICO (pronto a parare). Sparisce durante la ricarica → così si
  // capisce sempre a colpo d'occhio se sei protetto o no. Chiamato ogni frame in update().
  updateShieldAura(now) {
    const pl = window.GameState.player;
    if (!pl.shield) { if (this.shieldAura) this.shieldAura.setVisible(false); return; }
    if (!this.shieldAura) {
      // Raggio preso dall'ALTEZZA VERA del personaggio a schermo: a 24 fissi copriva solo il
      // busto e sembrava una bolla storta (segnalato dall'utente 2026-07-29).
      const raggio = Math.max(28, Math.round((this.heroVisual ? this.heroVisual.displayHeight : 56) * 0.46));
      this.shieldAura = this.add.circle(this.player.x, this.player.y, raggio, 0x8fd0ff, 0.12)
        .setStrokeStyle(2.5, 0xbfe8ff, 0.9).setDepth(9);   // dietro il PG (depth 10): alone, non lo copre
    }
    const charged = now >= (this.shieldReadyAt || 0);
    this.shieldAura.setVisible(charged);
    if (charged) {
      this.shieldAura.x = this.player.x;
      this.shieldAura.y = this.player.y;
      this.shieldAura.setScale(1 + Math.sin(now / 180) * 0.06);   // pulsazione leggera = "vivo"
    }
  }

  // Effetto di ROTTURA scudo (quando para un colpo): flash bianco + anello brillante +
  // schegge che schizzano + lampo sul personaggio + scossa. Molto più evidente di prima.
  shieldBreakFx(sourceX) {
    const x = this.player.x, y = this.player.y;
    const flash = this.add.circle(x, y, 30, 0xffffff, 0.85).setDepth(22);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => flash.destroy() });
    const ring = this.add.circle(x, y, 22, 0x8fd0ff, 0).setStrokeStyle(4, 0xbfe8ff, 1).setDepth(22);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => ring.destroy() });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sh = this.add.circle(x, y, 3, 0xbfe8ff, 1).setDepth(22);
      this.tweens.add({ targets: sh, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 46, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => sh.destroy() });
    }
    this.heroVisual.setTintFill(0xffffff);                  // lampo bianco pieno sul PG
    this.time.delayedCall(90, () => { if (this.heroVisual && this.heroVisual.active) this.tintaPersonaggio(); });
    this.cameras.main.shake(120, 0.008);
  }

  // Esplosione di particelle (briciole): vedi GameGfx in src/gfx.js.
  burst(key, x, y, n) { window.GameGfx.burst(this, key, x, y, n); }

  // ---------- Esiti del livello ----------

  // Sei arrivato al timpano ma non hai pulito abbastanza: avviso (non piu' di una
  // volta ogni 4s) che dice quanta percentuale serve.
  cleanHint(now) {
    if (this._cleanHintAt && now - this._cleanHintAt < 4000) return;
    this._cleanHintAt = now;
    this.showBanner(window.I18n.t('game_clean_more', { pct: Math.round(this.cleanGoal * 100) }), '#9be870');
  }

  // Congela i nemici a fine livello/run: NON basta azzerare la velocita'. Quando il livello si
  // "blocca" (this.locked) update() esce subito, quindi lo snap dei nemici al terreno si ferma, ma
  // la fisica continua e la GRAVITA' li tira sotto il suolo (c'e' solo il backstop a 408, sotto la
  // linea visibile) -> si vedevano cadere sotto terra al timpano (segnalato utente 2026-07-25).
  // `body.moves = false` ferma l'integrazione fisica: restano dove sono.
  freezeEnemies() {
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || !e.body) return;
      e.setVelocity(0, 0);
      e.body.moves = false;
    });
  }

  // Riepilogo per la schermata di vittoria + incasso e record. Stava dentro UpgradeScene.choose
   // (era li' che finiva la run); ora che l'ultimo livello salta la carta, vive qui.
  datiVittoria() {
    const livelli = window.GameState.level;
    const infezione = window.GameState.infezione || 0;
    const primaMax = window.Meta.get().infezioneMax;
    const meta = window.Meta.bankRun(window.GameState.wax, livelli);
    window.Meta.recordWin(infezione);
    const sbloccato = (infezione > primaMax) && (infezione < window.CONFIG.INFEZIONE_MAX);
    return {
      earned: window.GameState.wax, bank: meta.bank, levels: livelli,
      infezione: infezione, sbloccato: sbloccato ? infezione + 1 : null,
    };
  }

  levelComplete() {
    if (this.locked) return;
    this.locked = true;
    window.Sfx.win();
    if (this.spawnTimer) this.spawnTimer.remove();
    if (this.quakeTimer) { this.quakeTimer.remove(false); this.quakeTimer = null; }
    this.player.setVelocity(0, 0);
    this.freezeEnemies();

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(50).setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 20, window.I18n.t('done_title', { n: window.GameState.level }), {
      fontFamily: 'monospace', fontSize: '34px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 + 26, window.I18n.t('done_sub'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);

    // CURA DI FINE LIVELLO (chiesta dall'utente 2026-07-29): "l'equivalente di una pallina",
    // cioe' quanto una cura raccolta a terra (CONFIG.CURA_PICKUP). La vita NON si ricarica
    // del tutto fra un livello e l'altro — quella scelta resta, e' il motivo per cui la run e'
    // una corsa a lungo respiro — ma arrivare al livello dopo con un filo di fiato in piu' evita
    // che una brutta partenza si trascini fino alla fine.
    const pl = window.GameState.player;
    if (pl.hp < pl.maxHp) {
      const prima = pl.hp;
      pl.hp = Math.min(pl.maxHp, pl.hp + window.CONFIG.CURA_PICKUP);
      const recuperata = Math.round(pl.hp - prima);
      this.add.text(W / 2, H / 2 + 58, window.I18n.t('done_cura', { n: recuperata }), {
        fontFamily: 'monospace', fontSize: '16px', color: '#9fe6a0',
        stroke: '#14161f', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
      this.healFx(this.player.x, this.player.y);
    }

    // Ultimo livello: niente carta di potenziamento, si va alla VITTORIA. Sceglierne una che
    // non si usera' mai era solo un passaggio a vuoto fra il colpo finale e i titoli.
    const ultimo = window.GameState.level >= window.CONFIG.RUN_LEVELS;
    this.time.delayedCall(1300, () => this.scene.start(ultimo ? 'VictoryScene' : 'UpgradeScene',
      ultimo ? this.datiVittoria() : undefined));
  }

  gameOver() {
    if (this.locked) return;
    this.locked = true;
    window.Sfx.lose();
    if (this.spawnTimer) this.spawnTimer.remove();
    if (this.quakeTimer) { this.quakeTimer.remove(false); this.quakeTimer = null; }
    this.freezeEnemies();

    // Fine della run: incassa il cerume raccolto nella banca permanente.
    const lvl = window.GameState.level;
    const earned = window.GameState.wax;
    const meta = window.Meta.bankRun(earned, lvl);

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x1c0a12, 0.78).setDepth(50).setScrollFactor(0);
    // setScrollFactor(0): senza, il pannello (disegnato in coordinate del MONDO) scorreva con la
    // telecamera e finiva mezzo fuori schermo — il "riquadro a sinistra" segnalato dall'utente.
    window.GameGfx.panel(this, W / 2, H / 2 + 10, 620, 260, { accento: 0xb3374f, depth: 50 })
      .setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 56, window.I18n.t('over_title'), {
      fontFamily: 'monospace', fontSize: '30px', color: '#ff8a8a',
      stroke: '#1c0a12', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 14, window.I18n.t('over_level', { n: lvl }), {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 + 16, window.I18n.t('over_banked', { earned: earned, bank: meta.bank }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);

    // Pulsanti toccabili (indispensabili su telefono/tablet)
    const mkButton = (x, label, onTap) => {
      const b = window.GameGfx.uiButton(this, x, H / 2 + 80, label, onTap, { w: 170, h: 42 });
      b.sfondo.setDepth(51).setScrollFactor(0);
      b.label.setDepth(52).setScrollFactor(0);
      b.zona.setDepth(53).setScrollFactor(0);
      return b;
    };
    mkButton(W / 2 - 175, window.I18n.t('over_newrun'), () => { window.GameState.reset(); this.scene.start('GameScene'); });
    mkButton(W / 2, window.I18n.t('over_shop'), () => { window.GameState.reset(); this.scene.start('ShopScene'); });
    mkButton(W / 2 + 175, window.I18n.t('over_menu'), () => { window.GameState.reset(); this.scene.start('MenuScene'); });

    this.input.keyboard.once('keydown-R', () => { window.GameState.reset(); this.scene.start('GameScene'); });
  }

  // ---------- HUD ----------

  buildHud() {
    this.hudG = this.add.graphics().setDepth(100).setScrollFactor(0);
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8', stroke: '#14161f', strokeThickness: 3 };
    this.hpText = this.add.text(18, 16, '', style).setDepth(101).setScrollFactor(0);
    this.levelText = this.add.text(window.CONFIG.WIDTH / 2, 16, '', style).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
    this.blockText = this.add.text(window.CONFIG.WIDTH / 2, 38, '', style).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
    this.waxText = this.add.text(window.CONFIG.WIDTH - 18, 44, '', style).setOrigin(1, 0).setDepth(101).setScrollFactor(0);
    this.updateHud();
  }

  updateHud() {
    const p = window.GameState.player;
    const W = window.CONFIG.WIDTH;
    const x = 18, y = 40, w = 200, h = 18;
    this.hudG.clear();
    this.hudG.fillStyle(0x000000, 0.5); this.hudG.fillRect(x - 2, y - 2, w + 4, h + 4);
    this.hudG.fillStyle(0x3a2a1a, 1); this.hudG.fillRect(x, y, w, h);
    const ratio = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    const col = ratio > 0.5 ? 0x4caf50 : (ratio > 0.25 ? 0xe0a020 : 0xe74c3c);
    this.hudG.fillStyle(col, 1); this.hudG.fillRect(x, y, w * ratio, h);

    // Barra HP del BOSS (solo se un Tappo di Cerume è in campo): larga, centrata in alto.
    const boss = this.enemies && this.enemies.getChildren().find((b) => b.active && b.kind === 'boss');
    if (boss) {
      const bw = 380, bx = (W - bw) / 2, by = 64, bh = 14;
      const br = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
      this.hudG.fillStyle(0x000000, 0.55); this.hudG.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      this.hudG.fillStyle(0x3a1414, 1); this.hudG.fillRect(bx, by, bw, bh);
      this.hudG.fillStyle(br > 0.5 ? 0xd23a3a : 0xff7043, 1); this.hudG.fillRect(bx, by, bw * br, bh);   // arancione = infuriato
    }

    const T = window.I18n;
    this.hpText.setText(T.t('hud_hp', { hp: Math.ceil(p.hp), max: p.maxHp }));
    // Grado di infezione accanto al livello, solo se >0 (round A, A.5): cosi' e' sempre chiaro
    // che la run e' piu' dura del normale.
    const inf = window.GameState.infezione || 0;
    this.levelText.setText(inf > 0
      ? T.t('hud_level_inf', { n: window.GameState.level, inf: inf })
      : T.t('hud_level', { n: window.GameState.level }));
    const pct = this.totalWax ? Phaser.Math.Clamp(Math.round((this.cleanedWax / this.totalWax) * 100), 0, 100) : 100;
    this.blockText.setText(T.t('hud_clean', { pct: pct }));
    this.waxText.setText(T.t('hud_wax', { n: window.GameState.wax }));
  }

  // Timer grande e centrato (round 2, F.1/F.2a): condiviso da Assedio e Corsa (prima l'assedio
  // aveva solo `siegeText`, 20px poco leggibile, e la corsa non aveva nessun timer). Negli
  // ultimi 5s LAMPEGGIA (colore acceso + pulsazione) per segnalare che sta per scadere.
  buildBigTimer() {
    this.bigTimerText = this.add.text(window.CONFIG.WIDTH / 2, 92, '', {
      fontFamily: 'monospace', fontSize: '38px', color: '#ffd9a0', stroke: '#14161f', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
  }

  // CORSA A TEMPO — avvio LAMPANTE (playtest utente 2026-07-25: non era evidente che fosse una
  // corsa a tempo). Countdown "3 · 2 · 1 · VIA!" grande al centro (non blocca i comandi: puoi gia'
  // muoverti) + etichetta in alto; il cronometro parte a "VIA!", cosi' il countdown regala anche
  // qualche secondo. Tempo piu' generoso di prima (~115px/s + 11s, era 130px/s + 8s).
  startRushCountdown() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const STEP = 650;
    const steps = ['3', '2', '1', window.I18n.t('rush_go')];
    // MANOPOLA DI PROVA "durataCorsa" (src/taratura.js): a 1 e' il tempo normale.
    const rushTime = Math.round((Math.round(this.worldW / 115) * 1000 + 11000)
      * window.CONFIG.DURATA_CORSA
      * (window.Taratura ? window.Taratura.v('durataCorsa') : 1));
    // Il conto alla rovescia non consuma piu' cronometro: dal round 5 i cronometri sono FERMI
    // finche' il livello non e' davvero cominciato (vedi `avvioAl`), quindi il tempo scritto qui
    // e' tutto e solo tempo di gioco. Prima ci si sommava la durata del 3-2-1 per compensare.
    this.rushLeftMs = rushTime;

    const label = this.add.text(W / 2, H * 0.30, window.I18n.t('rush_countdown_title'), {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffd166', stroke: '#14161f', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(130);

    steps.forEach((s, i) => {
      this.time.delayedCall(i * STEP, () => {
        if (this.locked) return;
        const via = (i === steps.length - 1);
        const big = this.add.text(W / 2, H * 0.46, s, {
          fontFamily: 'monospace', fontSize: via ? '104px' : '88px',
          color: via ? '#9be870' : '#ff6b5a', stroke: '#14161f', strokeThickness: 9,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(131).setScale(0.5).setAlpha(0);
        this.tweens.add({ targets: big, scale: 1.15, alpha: 1, duration: 170, ease: 'Back.out' });
        this.tweens.add({ targets: big, alpha: 0, duration: 300, delay: STEP - 300, onComplete: () => big.destroy() });
        window.Sfx.pick();
        if (via) { this.cameras.main.shake(120, 0.006); label.destroy(); }
      });
    });
  }

  // `text` = stringa gia' formattata (i18n) da mostrare; `secondsLeft` guida SOLO il lampeggio.
  // Mette una posa di mira FERMA (un solo fotogramma). Va fermata l'animazione in corso, se no
  // al fotogramma dopo se lo riprende lei e la posa non si vede.
  posaMira(nome, indice) {
    this._posaMira = nome;
    this.heroVisual.anims.stop();
    this.heroVisual.setTexture('hero_aim', indice);
  }

  // Cronometro dell'assedio scaduto con la quota non ancora raggiunta: una botta e un
  // supplementare. La mercy-invuln va tolta di mezzo prima, se no un colpo preso un attimo
  // prima si mangerebbe la penalita' e sembrerebbe che la regola non funzioni. Lo SCUDO invece
  // puo' pararla: e' un'abilita' rara, e il cartello spiega comunque cos'e' successo.
  siegeTempoScaduto() {
    const pl = window.GameState.player;
    this.siegeLeftMs = window.CONFIG.SIEGE_SUPPLEMENTARE;
    this.invulnUntil = 0;
    this.hurtPlayer(Math.round(pl.maxHp * window.CONFIG.SIEGE_PENALITA), this.player.x - this.facing * 40);
    this.showBanner(window.I18n.t('game_siege_overtime', {
      s: Math.round(window.CONFIG.SIEGE_SUPPLEMENTARE / 1000),
    }), '#ff6b3d');
    this.cameras.main.shake(260, 0.012);
  }

  updateBigTimer(text, secondsLeft, now) {
    if (!this.bigTimerText) return;
    this.bigTimerText.setText(text);
    if (secondsLeft <= 5) {
      const blink = Math.floor(now / 200) % 2 === 0;
      this.bigTimerText.setColor(blink ? '#ff4040' : '#ffd9a0');
      this.bigTimerText.setScale(blink ? 1.18 : 1);
    } else {
      this.bigTimerText.setColor('#ffd9a0');
      this.bigTimerText.setScale(1);
    }
  }

  // ---------- Pausa ----------

  buildPauseButton() {
    const W = window.CONFIG.WIDTH;
    const btn = this.add.circle(W - 30, 26, 17, 0x000000, 0.35)
      .setScrollFactor(0).setDepth(110).setInteractive({ useHandCursor: true });
    btn.setStrokeStyle(2, 0xfff7e8, 0.6);
    const g = this.add.graphics().setScrollFactor(0).setDepth(111);
    g.fillStyle(0xfff7e8, 0.9);
    g.fillRect(W - 35, 19, 4, 14);   // due barrette = simbolo "pausa"
    g.fillRect(W - 28, 19, 4, 14);
    btn.on('pointerdown', (pointer, x, y, event) => {
      if (event) event.stopPropagation();   // non far partire l'attacco col clic
      this.pauseGame();
    });
  }

  pauseGame() {
    if (this.locked || this.scene.isPaused()) return;
    window.Sfx.unlock();
    // azzera gli stati "tenuti" del touch, così non si resta a muoversi in pausa
    this.touch.left = false;
    this.touch.right = false;
    this.scene.launch('PauseScene', { from: 'GameScene' });
    this.scene.pause();
  }

  // ---------- Sfondo ----------


  // ---------- Loop ----------

  // JUICE — imposta jx/jy SOLO se lo spostamento richiesto e' piu' marcato di quello gia' in
  // corso (per ampiezza, |1-jx|+|1-jy|), invece di sovrascrivere sempre l'ultimo arrivato.
  // Altrimenti un salto "bufferizzato" che scatta esattamente sul frame dell'atterraggio
  // cancellerebbe del tutto lo schiacciamento dell'atterraggio (capita nei bunny-hop veloci).
  setJuice(ax, ay) {
    const newAmp = Math.abs(1 - ax) + Math.abs(1 - ay);
    const curAmp = Math.abs(1 - this.jx) + Math.abs(1 - this.jy);
    if (newAmp >= curAmp) { this.jx = ax; this.jy = ay; }
  }

  // RIMBALZO su una superficie INCLINATA (colline e soffitto ondulato). Non basta invertire la
  // velocita' verticale: una pallina sparata in orizzontale ha vy≈0, e invertire zero lascia il
  // colpo fermo contro la collina — consumava un rimbalzo per frame finche' finivano e poi si
  // spappolava lo stesso (segnalato dall'utente 2026-07-31, dopo il fix che le fermava). Qui si
  // calcola la PENDENZA del terreno nel punto d'urto e si specchia la velocita' attorno alla
  // perpendicolare: su una salita il colpo schizza in alto, come ci si aspetta.
  rimbalzaSulTerreno(sh) {
    const now = this.time.now;
    if (now < (sh.bounceGrace || 0)) return;   // un urto solo per volta
    sh.bounceGrace = now + 60;
    sh.bounceLeft -= 1;

    const soffitto = sh.y <= this.ceilingYAt(sh.x);
    const quota = (x) => (soffitto ? this.ceilingYAt(x) : this.terrainTopAt(x));
    // pendenza misurata su 16px attorno al punto: dy/dx del profilo
    const pend = (quota(sh.x + 8) - quota(sh.x - 8)) / 16;
    // perpendicolare al profilo, rivolta verso il condotto (su per il terreno, giu' pel soffitto)
    const verso = soffitto ? 1 : -1;
    const len = Math.hypot(pend, 1) || 1;
    const nx = (-pend / len) * verso, ny = (1 / len) * verso;

    const v = sh.body.velocity;
    const dot = v.x * nx + v.y * ny;
    sh.setVelocity(v.x - 2 * dot * nx, v.y - 2 * dot * ny);
    // spinge il colpo FUORI dalla superficie, se no rientra subito e consuma un altro rimbalzo
    sh.x += nx * 6;
    sh.y = quota(sh.x) + verso * 7;
    this.splat(sh.x, sh.y, 'soft');
  }

  // I proiettili (getto del giocatore e sputi dei nemici) non hanno un terreno SOLIDO contro cui
  // sbattere: il pavimento e' una mappa di altezze, e l'unico corpo fisico e' un rettangolo piatto
  // in fondo al mondo. Quindi qui si controlla a mano, ogni frame, se hanno passato il profilo del
  // terreno o del soffitto. Senza, volavano attraverso le colline (segnalato dall'utente).
  fermaProiettiliNelTerreno() {
    const fuori = (o) => o.y >= this.terrainTopAt(o.x) || o.y <= this.ceilingYAt(o.x);
    this.shots.getChildren().forEach((sh) => {
      if (!sh.active || !fuori(sh)) return;
      if (sh.bounceLeft > 0) this.rimbalzaSulTerreno(sh);   // abilita' RIMBALZO
      else this.popShot(sh);
    });
    this.projectiles.getChildren().forEach((pr) => {
      if (pr.active && fuori(pr)) this.popProjectile(pr);
    });
  }

  // Cronometri delle modalita' a tempo (assedio e corsa). Restituisce TRUE se il livello e'
  // finito qui dentro: in quel caso update() deve fermarsi subito, senza toccare altro.
  aggiornaCronometri(now, dt) {
    // Finche' si sta leggendo il banner d'apertura il livello non e' ancora cominciato: nessun
    // cronometro parte e nessun contatore compare (vedi `avvioAl` in create). Sarebbe ingiusto
    // consumare secondi di assedio mentre il giocatore sta ancora capendo cosa deve fare.
    if (this.avvioAl && now < this.avvioAl) return false;
    // ASSEDIO: si vince ELIMINANDO la quota di nemici prima che scada il cronometro.
    if (this.levelKind === 'siege') {
      this.siegeLeftMs = Math.max(0, this.siegeLeftMs - dt);
      const left = Math.ceil(this.siegeLeftMs / 1000);
      this.updateBigTimer(window.I18n.t('hud_siege', {
        s: left, n: this.siegeKills, q: this.siegeQuota,
      }), left, now);
      // TEMPO SCADUTO SENZA QUOTA: non e' finita, ma fa male. Scelta dell'utente fra quattro
      // possibilita': "punisce senza troncare di netto". Prendi una botta e ti tocca un tempo
      // supplementare; se continui a non farcela le botte si sommano e prima o poi ci lasci la
      // pelle, quindi la regola si chiude da sola senza dover buttare la run al primo errore.
      if (this.siegeLeftMs <= 0) this.siegeTempoScaduto();
    } else if (this.levelKind === 'rush') {
      // CORSA A TEMPO (round 2, F.1): se il tempo scade PRIMA del timpano -> game over (deciso
      // con l'utente). Il controllo `player.x < goalX` evita che, nel caso limite in cui tempo
      // scaduto e traguardo raggiunto capitino nello stesso frame, si perda una corsa in realta'
      // vinta (il blocco "Traguardo" qui sotto la completerebbe comunque, se lo lasciamo passare).
      this.rushLeftMs = Math.max(0, this.rushLeftMs - dt);
      const left = Math.ceil(this.rushLeftMs / 1000);
      this.updateBigTimer(window.I18n.t('hud_rush', { s: left }), left, now);
      if (this.rushLeftMs <= 0 && this.player.x < this.goalX) { this.gameOver(); return true; }
    }
    return false;
  }

  // Timpano raggiunto: si completa solo se il cerume pulito arriva alla soglia e, nei livelli
  // boss, se il boss e' morto. Restituisce TRUE se il livello si e' concluso.
  controllaTraguardo(now) {
    // Traguardo: bisogna PULIRE almeno la soglia di cerume E raggiungere il timpano.
    // Nei livelli boss il timpano resta "sbarrato" finche' il Tappo di Cerume e' vivo.
    if (this.levelKind !== 'siege' && this.player.x >= this.goalX) {
      // Confronto sulle PERCENTUALI ARROTONDATE (le stesse mostrate nell'HUD): così se l'HUD
      // segna "80%" e la soglia e' 80%, basta — niente 79,8% che sembra 80 ma non completa.
      const cleanPct = this.totalWax ? Math.round((this.cleanedWax / this.totalWax) * 100) : 100;
      const goalPct = Math.round(this.cleanGoal * 100);
      const bossBlocking = this.levelKind === 'boss' &&
        this.enemies.getChildren().some((e) => e.active && e.kind === 'boss');
      if (cleanPct < goalPct) {
        this.cleanHint(now);                       // sei al timpano ma manca cerume da pulire
      } else if (bossBlocking) {
        if (!this._bossHintShown) { this._bossHintShown = true; this.showBanner(window.I18n.t('game_boss_guard', { nome: this.nomeBoss(null) }), '#ffb04a'); }
      } else {
        this.levelComplete(); return true;
      }
    }
    return false;
  }

  // Aggancio dei piedi al profilo del terreno (che e' una mappa di altezze, non un corpo
  // solido), salto sui nemici, atterraggio e ricarica dei salti.
  // ⚠️ L'ORDINE QUI DENTRO E' SIGNIFICATIVO: il salto sui nemici va rilevato PRIMA dello snap,
  // se no lo snap risucchia il giocatore a terra attraverso il nemico. Restituisce se e'
  // appoggiato, dato che serve a mezzo update().
  agganciaAlTerreno(now) {
    const p = window.GameState.player;
    // TERRENO A "MAPPA DI ALTEZZE" (prototipo round 4): il PG cammina sul profilo `terrainTopAt`
    // (colline dolci) agganciando i piedi alla superficie frame per frame → camminata liscia su/giu'
    // senza blocchi fisici (niente cuciture che incastrano). NON aggancia mentre SALE in un salto
    // (vy<0), ne' se la superficie e' molto piu' in basso (dirupo/salto) → li' cade. I dislivelli
    // sono limitati a pendenze dolci (vedi buildTerrain), quindi il cap di salita non si vede.
    // SALTO SUI NEMICI (stile Mario — giro difficolta' 2026-07-25): se stai SCENDENDO e i piedi
    // arrivano sulla testa di un nemico, rimbalzi e lo colpisci invece di prendere danno. DEVE
    // stare PRIMA dello snap al terreno qui sotto: i nemici non sono solidi e lo snap "risucchia"
    // il giocatore al suolo (attraverso il nemico) azzerandogli la velocita', quindi dopo lo snap
    // non si distinguerebbe una caduta-sulla-testa da un contatto laterale. Il rimbalzo mette
    // velocita' negativa -> lo snap qui sotto (che aggancia solo con vy >= -1) viene saltato da se'.
    // Soglia di caduta abbassata da 60 a 45 (playtest): serve solo a escludere il contatto
    // LATERALE, e da fermi la velocita' verticale non supera ~18 a 60 fotogrammi al secondo
    // (~37 se il telefono ne fa 30), quindi 45 e' ancora al sicuro. In cambio, atterrando in
    // cima all'arco del salto il rimbalzo scatta ~15ms prima.
    if (this.player.body.velocity.y > 45) {
      const pbody = this.player.body;
      // Dove finiranno i piedi DOPO lo snap qui sotto. Serve perche' il nemico non e' solido: se il
      // PG e' gia' entrato nella fascia d'aggancio, lo snap lo porta di colpo alla superficie
      // ATTRAVERSANDO il nemico, e guardando solo la posizione attuale il momento si perderebbe.
      // Prima si compensava con una finestra fissa di 48px sopra la testa: funzionava, ma il
      // rimbalzo partiva mentre il PG era ancora per aria e l'impatto non si vedeva (segnalato
      // dall'utente 2026-07-27). Ora la finestra e' esatta e ci pensa stompEnemy ad appoggiare
      // i piedi sulla testa prima di far rimbalzare.
      const surf0 = this.terrainTopAt(this.player.x);
      const piediDopo = (pbody.bottom - surf0) >= -44 ? surf0 : pbody.bottom;
      const T = GameScene.RIMBALZO_TOLLERANZA;
      const preda = this.enemies.getChildren().find((e) => {
        if (!e.active || e.spawning || e.fugitive || !e.body) return false;
        if (Math.abs(pbody.center.x - e.body.center.x) > e.body.halfWidth + pbody.halfWidth) return false;
        // Arrivi DALL'ALTO: nel fotogramma scorso i piedi non erano ancora scesi sotto la testa.
        // E' questo che distingue il salto in testa dallo strisciare contro il fianco.
        const daSopra = this._prevBottom <= e.body.top + T;
        // E ci sei arrivato: o i piedi hanno raggiunto la testa, o ci arriveranno con lo snap.
        // ⚠️ LA TOLLERANZA NON E' COSMETICA. Prima le due condizioni erano `bottom <= testa+6` e
        // `piediDopo >= testa`, e insieme lasciavano una fascia utile di 4 PIXEL: la seconda
        // esige che i piedi siano entro 44px dal suolo, la prima che siano sopra la testa, e da
        // quando cerumino e crosta sono alti 46 le due si sovrappongono appena. Restava in piedi
        // solo grazie al ramo "oltrepassata in questo frame", che pero' bucava a certe velocita'
        // di caduta: da qui il "alle volte non rimbalza" del playtest. Ora la fascia e' larga
        // quanto la tolleranza, in tutte e due le direzioni, e non dipende dall'altezza del nemico.
        return daSopra && piediDopo >= e.body.top - T;
      });
      if (preda) this.stompEnemy(preda);
    }

    let onGround = this.player.body.blocked.down || this.player.body.touching.down;   // backstop/pedane
    const surfaceY = this.terrainTopAt(this.player.x);
    const feetY = this.player.body.bottom;
    if (this.player.body.velocity.y >= -1 && (feetY - surfaceY) >= -44) {
      // sposto SOLO il corpo in verticale (non lo sprite → l'orizzontale resta al motore);
      // sali max 26/frame, scendi max 44/frame (per entrare/uscire dalle cunette).
      this.player.body.y -= Phaser.Math.Clamp(feetY - surfaceY, -44, 26);
      this.player.body.velocity.y = 0;
      onGround = true;
    }

    // JUICE — atterraggio: si rileva il passaggio aria->terra, ma solo se si era DAVVERO in aria
    // da un po' (confronto con `this.lastGroundAt`, letto PRIMA che il rifornimento salti qui
    // sotto lo aggiorni). Necessario perche' Arcade Physics risolve gravita'+collisione ogni
    // frame: da fermo `onGround` sfarfalla vero/falso in continuazione (un frame gravita' stacca
    // di un pelo, il frame dopo il collider rincolla) — lo stesso motivo per cui piu' sotto
    // l'accovacciamento usa gia' `lastGroundAt` invece di `onGround` nudo. Senza il filtro,
    // ogni sfarfallio farebbe scattare uno schiacciamento anche da fermi.
    const landed = onGround && !this._wasOnGround && (now - this.lastGroundAt) > 60;
    this._wasOnGround = onGround;
    if (landed) {
      const impact = Phaser.Math.Clamp(this._prevVelY / p.jumpVelocity, 0, 1.4);
      const a = window.CONFIG.JUICE_LAND * (0.5 + 0.5 * impact);
      this.setJuice(1 + a, 1 - a);
      // Abilità SCHIANTO: se stavi cadendo veloce per lo schianto, l'onda d'urto scatta qui,
      // esattamente all'atterraggio (non prima: deve colpire quando tocchi terra).
      if (this.slamming) { this.slamming = false; this.playerSlamFx(); }
    }

    // Rifornisci i salti SOLO quando sei davvero appoggiato e non stai già salendo: subito
    // dopo un salto il corpo "tocca" ancora il suolo per un frame e, senza questo controllo,
    // bastava ripremere in fretta per ottenere un salto in più (falso doppio salto).
    if (onGround && this.player.body.velocity.y >= 0) { this.jumpsLeft = p.doubleJump ? 2 : 1; this.lastGroundAt = now; }

    return onGround;
  }

  // Roba che vive per conto suo nel livello: gocce dal soffitto, macerie della frana, pozze
  // scivolose, calamita del cerume. Restituisce se il giocatore sta su una pozza.
  aggiornaAmbiente(now, onGround) {
    const p = window.GameState.player;
    // Gocce dal soffitto: emettitori che si gonfiano e rilasciano gocce che cadono. Il danno
    // al contatto e' gestito dall'overlap player/movers in create(); lo splash a terra qui.
    this.updateDrips(now);
    this.updateCollapseChunks();
    // Pozze di cerume scivoloso: rallentano il movimento mentre ci si cammina sopra a terra.
    const onSlime = onGround && this.slimeZones && this.slimeZones.some(
      (z) => this.player.x > z.x1 && this.player.x < z.x2);

    // Abilità CALAMITA: i bonus di cerume vicini volano verso il giocatore (raccolta a distanza).
    // EVOLUZIONE Buco Nero (evoMagnet): raggio molto più ampio.
    if (p.magnet && this.pickups) {
      const R = p.evoMagnet ? 320 : 170;
      this.pickups.getChildren().forEach((pk) => {
        if (!pk.active) return;
        const dx = this.player.x - pk.x, dy = this.player.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          if (!pk._magnet) { pk._magnet = true; this.tweens.killTweensOf(pk); }   // stacca l'ondeggio
          const pull = Phaser.Math.Clamp(140 + 340 * (1 - d / R), 140, 460);
          pk.body.setVelocity((dx / d) * pull, (dy / d) * pull);
        }
      });
    }

    return onSlime;
  }

  // Tutto quello che nasce da un tasto: accovacciamento, movimento, salto, scatto, mira e
  // attacco. E' il blocco piu' lungo ed e' l'unico che legge i comandi.
  comandiDelGiocatore(now, onGround, onSlime) {
    const p = window.GameState.player;
    const k = this.keys;
    // ACCOVACCIAMENTO (stile Metal Slug): tieni GIU' a terra -> ti abbassi, così getto e
    // mazza escono all'altezza dei piedi e colpisci i nemici bassi (es. Gorgogliante). In
    // aria GIU' resta la mira verso il basso del getto (gestita più sotto).
    const downHeld = k.DOWN.isDown || k.S.isDown || this.touch.aimDown;
    // Abilità SCHIANTO: in aria, premere GIU' di fresco (non tenuto: altrimenti mirare in giù
    // in volo lo farebbe scattare da solo) ti fa cadere veloce; l'onda d'urto parte quando
    // atterri (vedi il blocco 'landed' piu' sopra). "_slamPrevDown" rileva il fronte di
    // pressione sullo stesso downHeld gia' unificato tastiera/touch.
    if (p.slam && !onGround && downHeld && !this._slamPrevDown && !this.slamming) {
      this.slamming = true;
      this.player.setVelocityY(Math.max(this.player.body.velocity.y, 0) + 900);
      window.Sfx.dash();
    }
    this._slamPrevDown = downHeld;
    // L'accovacciamento resta valido per un attimo dopo aver perso il contatto col suolo
    // (dossi/bordi mentre ci si muove), COSI' il getto non passa a "mira in giù" sparando
    // nel pavimento. NON vale durante un vero salto (velocità decisa verso l'alto).
    this.crouching = downHeld && (onGround ||
      ((now - this.lastGroundAt) < 140 && this.player.body.velocity.y > -50));

    // Movimento (tastiera o pad a schermo); accovacciato ci si muove piano. La velocita' REALE
    // insegue quella bersaglio con un'accelerazione/decelerazione morbida (a terra piu'
    // reattiva, in aria piu' "molle"), invece di scattare istantanea: toglie il "legnoso" senza
    // diventare scivoloso. Lo SCATTO resta istantaneo (salta l'inseguimento apposta).
    const left = k.A.isDown || k.LEFT.isDown || this.touch.left;
    const right = k.D.isDown || k.RIGHT.isDown || this.touch.right;
    let targetVx = 0;
    if (left) { targetVx = -p.moveSpeed; this.facing = -1; }
    else if (right) { targetVx = p.moveSpeed; this.facing = 1; }
    if (this.crouching) targetVx *= 0.45;
    if (onSlime) targetVx *= 0.5;
    if (now < this.dashUntil) {
      this.player.setVelocityX(this.facing * p.moveSpeed * 2.4);
      this.spawnDashGhost(p.dashStrike);   // scia: azzurra normale, arancio se fa danno
    } else {
      const accel = onGround ? window.CONFIG.MOVE_ACCEL_GROUND : window.CONFIG.MOVE_ACCEL_AIR;
      this.player.setVelocityX(Phaser.Math.Linear(this.player.body.velocity.x, targetVx, accel));
    }

    // JUICE — inversione di corsa: piccola schiacciata quando cambi direzione a terra in movimento.
    if (onGround && this.facing !== this._lastFacing && Math.abs(this.player.body.velocity.x) > 10) {
      this.setJuice(1 + window.CONFIG.JUICE_TURN, 1 - window.CONFIG.JUICE_TURN);
    }
    this._lastFacing = this.facing;

    // --- Salto con "game feel": buffer + altezza variabile ---
    // Tasto DEDICATO: Spazio o pulsante a schermo. (Su/W NON saltano: mirano il getto.)
    const BUFFER = 130;
    const jumpEdge = Phaser.Input.Keyboard.JustDown(k.SPACE) || this.touch.jumpQueued;
    this.touch.jumpQueued = false;
    if (jumpEdge) this.jumpBufferedAt = now;                 // "ricorda" il salto premuto
    const jumpHeld = k.SPACE.isDown || this.touch.jumpHeld;
    const wantJump = (now - this.jumpBufferedAt) <= BUFFER;  // salto in coda (anche premuto un attimo prima di atterrare)
    if (wantJump && this.jumpsLeft > 0) {
      this.player.setVelocityY(-p.jumpVelocity);
      this.jumpsLeft--;
      this.jumpBufferedAt = -9999;   // consuma il buffer (niente doppio salto involontario)
      this.canCutJump = true;        // da qui in poi il rilascio puo' accorciare il salto
      window.Sfx.jump();
      // JUICE — salto: allungamento (alto/sottile) al decollo.
      this.setJuice(1 - window.CONFIG.JUICE_JUMP, 1 + window.CONFIG.JUICE_JUMP);
    }
    // Altezza variabile: se rilasci mentre stai ancora salendo, tronca la salita (saltino).
    if (this.canCutJump && !jumpHeld && this.player.body.velocity.y < 0) {
      this.player.setVelocityY(this.player.body.velocity.y * 0.45);
      this.canCutJump = false;
    }
    if (this.player.body.velocity.y >= 0) this.canCutJump = false;

    // Scatto
    const dashPressed = Phaser.Input.Keyboard.JustDown(k.SHIFT) || this.touch.dashQueued;
    this.touch.dashQueued = false;
    if (p.dash && dashPressed && now > this.dashReady) {
      this.dashUntil = now + 160;
      this.dashReady = now + 700;
      this.invulnUntil = Math.max(this.invulnUntil, now + 160);
      window.Sfx.dash();
      if (p.dashStrike) this.dashStrikeFx();   // lampo arancio: questo scatto fa danno
    }

    // Mira del getto (8 direzioni): orizzontale = verso dove guardi; su/giu coi tasti
    // (frecce su/giu o W/S, oppure pad a schermo). Da fermo si mira dritto su/giu.
    const aimUp = k.UP.isDown || k.W.isDown || this.touch.aimUp;
    // ⚠️ "giu'" e' lo STESSO comando che fa accovacciare (`downHeld`, in cima): era scritto due
    // volte identico, e due copie della stessa condizione prima o poi divergono — basta che
    // qualcuno aggiunga un tasto a una sola delle due e mirare in giu' e accovacciarsi
    // comincerebbero a rispondere a comandi diversi.
    let adx = this.facing, ady = 0;
    if (aimUp) ady = -1; else if (downHeld) ady = 1;
    if (ady !== 0 && !left && !right) adx = 0;
    // Accovacciato: si spara ORIZZONTALE (basso), non verso il pavimento.
    if (this.crouching) { ady = 0; adx = this.facing; }

    // Attacco UNICO e "intelligente" (tieni premuto: J / pulsante Spruzza / clic).
    // Se un nemico e' a distanza ravvicinata parte la BASTONATA (coton fioc) al posto
    // del getto; altrimenti spara il getto (pulisce il cerume e colpisce da lontano).
    const attackHeld = k.J.isDown || this.touch.sprayHeld || this.pcFiring;
    if (attackHeld) {
      window.Sfx.unlock();
      // Priorità: nemico vicino -> bastonata; altrimenti cerume a portata -> bastonata
      // (pulizia ravvicinata più veloce del getto); altrimenti getto a distanza.
      const foe = this.meleeTargetNear();
      const wax = foe ? null : this.meleeWaxNear();
      if (foe) this.doMelee(now, foe);
      else if (wax) this.doMelee(now, wax);
      else this.fireJet(adx, ady);
    }
  }

  // Quale animazione o posa mostrare, in base a cosa sta facendo il personaggio. Non tocca
  // la fisica: decide solo cosa si vede.
  // "Si sta muovendo?" con DUE soglie invece di una (isteresi): si comincia a considerarlo in
  // movimento sopra i 45, e si smette solo sotto i 10. ⚠️ CON UNA SOGLIA SOLA IL PERSONAGGIO
  // SFARFALLA: ogni volta che la velocita' balla attorno al valore unico (rinculo di un colpo,
  // discesa di una collina, un tasto sfiorato) si alterna fra posa ferma e ciclo di corsa, e il
  // ciclo RIPARTE OGNI VOLTA dal primo disegno. A schermo si legge come un'animazione a scatti —
  // e' il difetto segnalato nel playtest su corsa+sparo e idle+sparo.
  inMovimento(vx) {
    this._inMov = this._inMov ? (vx > 10) : (vx > 45);
    return this._inMov;
  }

  animaPersonaggio(onGround) {
    const p = window.GameState.player;
    const now2 = this.time.now;
    // Animazione (sul "vestito" this.heroVisual; la fisica resta sul player invisibile)
    this.heroVisual.setFlipX(this.facing < 0);
    const _vx = Math.abs(this.player.body.velocity.x);
    const muovendo = this.inMovimento(_vx);
    // ACCOVACCIAMENTO (2026-07-31). Prima si accorciava solo la sagoma INVISIBILE — quella che
    // decide se passi sotto un soffitto basso — e il personaggio a schermo restava dritto: si
    // infilava in pertugi in cui a occhio non ci stava. Ora c'e' il disegno.
    // E' un PASSAGGIO con posa tenuta, non un ciclo: si scende (180ms), si resta giu' finche'
    // tieni premuto, e per rialzarsi si rilegge lo stesso foglio al CONTRARIO. Quindi va gestito
    // sui FRONTI (entro/esco), non sullo stato: rilanciarlo ogni frame lo bloccherebbe sul primo
    // disegno. Il salto ha la precedenza su tutto e taglia corto la risalita, com'e' giusto.
    const va = this.heroVisual.anims;
    const inTransizione = va.isPlaying && va.currentAnim && va.currentAnim.key === 'hero_crouch_a';
    // POSE DI MIRA (2026-08-02): mentre l'arma a distanza e' in mano, il CORPO prende una posa
    // col braccio teso nella direzione di mira. Le pose hanno la mano VUOTA e l'arma ci si
    // infila dentro (vedi GameScene.MANO). Valgono solo A TERRA: in aria resta il salto.
    // IL COLPO CORPO A CORPO HA LA PRECEDENZA su tutto il resto: e' un gesto breve e va lasciato
    // finire, se no basta muovere un dito perche' il corpo torni a camminare a meta' bastonata.
    if (this._mischiaFinoA && now2 < this._mischiaFinoA) {
      this._posaMira = null;
      this.tintaPersonaggio();   // l'uscita anticipata non deve saltare la velatura
      return;
    }
    const mirando = onGround && this._weaponMode === 'ranged' && this.heroWeapon.visible;
    this._posaMira = null;
    if (mirando) {
      if (this.crouching) {
        // Accovacciato FERMO: posa tenuta. Accovacciato IN MOVIMENTO: il ciclo col braccio teso.
        if (muovendo) {
          this._posaMira = 'crouchaim';
          va.play('hero_crouchaim_a', true);
        } else {
          this.posaMira('accovacciato', 2);
        }
      } else if (muovendo) {
        this._posaMira = 'corsa';
        va.play('hero_runaim_a', true);
      } else {
        const su = Math.abs(this._weaponAim) > GameScene.MIRA_SU_OLTRE
          && Math.abs(this._weaponAim) < Math.PI - GameScene.MIRA_SU_OLTRE;
        this.posaMira(su ? 'su' : 'avanti', su ? 1 : 0);
      }
    } else if (!onGround) {
      this.heroVisual.anims.play('hero_jump_a', true);
    } else if (this.crouching) {
      if (!this._wasCrouching) {
        va.play('hero_crouch_a');                      // scende
      } else if (!inTransizione) {                     // finita la discesa: fermo o in cammino
        if (muovendo) {
          va.play('hero_crouchwalk_a', true);
        } else if (this.heroVisual.texture.key !== 'hero_crouch') {
          // stava camminando accovacciato e si e' fermato: torna alla posa tenuta. NON si
          // rilancia 'hero_crouch_a', che rifarebbe tutta la discesa da in piedi: si mette
          // direttamente l'ultimo fotogramma, che E' la posa tenuta.
          va.stop();
          this.heroVisual.setTexture('hero_crouch', 5);
        }
      }
    } else if (this._wasCrouching) {
      va.playReverse('hero_crouch_a');                 // si rialza (anche se stava camminando)
    } else if (!inTransizione) {                       // ...e la risalita si lascia finire
      if (muovendo) {
        const key = (_vx > p.moveSpeed * 0.85) ? 'hero_run_a' : 'hero_walk_a';
        this.heroVisual.anims.play(key, true);
      } else {
        this.heroVisual.anims.play('hero_idle_a', true);
      }
    }
    this._wasCrouching = this.crouching;
    this.tintaPersonaggio();
  }

  // VELATURA DELLE POSE ACCOVACCIATE (playtest round 5: "nelle posizioni in crouch il pg ha
  // colori piu' chiari"). I due fogli dell'accovacciamento sono usciti dal generatore piu'
  // luminosi degli altri — misurato: 108-110 di luminosita' media contro 80-86 di corsa,
  // camminata, idle e salto — e a schermo il personaggio si SCHIARIVA ogni volta che si abbassava.
  // ⚠️ PERCHE' NON SI CORREGGONO I DISEGNI. Provato, e buttato: la tavolozza del personaggio ha
  // SEI SOLI livelli per canale (i multipli di 51). Ribilanciando i fogli il gradino disponibile
  // piu' vicino cade sempre lontano dal bersaglio (misurato: si arrivava a 91 o a 71 invece che
  // a 82), e correggendo i tre canali separatamente il personaggio perdeva anche il colore —
  // rosso e verde scendevano di un gradino, il blu no, e veniva GRIGIO.
  // Qui la correzione e' esatta, non tocca nessun file ed e' reversibile: una velatura scura
  // applicata solo nei fotogrammi in cui a schermo c'e' uno dei due fogli accovacciati.
  // (La posa di mira accovacciata NON e' in questa lista: sta sul foglio `hero_aim`, che e' gia'
  // in tono con gli altri.)
  tintaPersonaggio() {
    const v = GameScene.VELATURA[this.heroVisual.texture.key];
    if (v) this.heroVisual.setTint(v);
    else this.heroVisual.clearTint();
  }

  // Intelligenza di tutte le creature vive, piu' il danno da contatto col giocatore.
  aggiornaNemici(now) {
    // IA nemici + danno da contatto
    const pb = this.player.getBounds();
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      if (e.eliteLavaggio) this.sincronizzaLavaggioElite(e);   // anche mentre emerge
      if (e.spawning) return;   // mentre emerge/cala è inerte: niente IA, sputi o danno

      // TERRENO (round 4): i nemici A TERRA camminano sul profilo `terrainTopAt` come il PG
      // (heightmap-snap: aggancio i piedi alla superficie). I VOLANTI no. `e._grounded` sostituisce
      // `blocked.down` nei controlli "a terra" dell'IA (che qui sopra le colline sarebbe falso).
      if (e.kind === 'fly') {
        e._grounded = e.body.blocked.down || e.body.touching.down;
      } else {
        const surf = this.terrainTopAt(e.x);
        const dy = e.body.bottom - surf;   // >0 = piedi SOTTO la superficie (dentro il terreno)
        if (dy > 0) {
          // SPROFONDATO: risale SEMPRE, senza il gate sulla velocita'. Serve dopo il rinculo di una
          // bastonata su una collina: il nemico veniva sbalzato, il gate teneva lo snap spento
          // mentre ricadeva, e restava piantato al vecchio livello piatto (360) senza riagganciarsi.
          e.body.y -= Math.min(dy, 22);
          if (e.body.velocity.y > 0) e.body.velocity.y = 0;
          e._grounded = true;
        } else if (e.body.velocity.y >= -30 && dy >= -44) {
          // aggancio se NON sta salendo in un salto (vy >= -30: esclude affondi/balzi -190/-480/…) e i
          // piedi sono entro il range dalla superficie (i balzi grandi hanno i piedi ben piu' in alto → passano).
          e.body.y -= Phaser.Math.Clamp(dy, -44, 22);
          if (e.body.velocity.y > 0) e.body.velocity.y = 0;
          e._grounded = true;
        } else {
          e._grounded = e.body.blocked.down || e.body.touching.down;
        }
      }

      // Sapone corrosivo: danno-nel-tempo ad intervalli finché la corrosione è attiva.
      if (e.corrodeUntil && now < e.corrodeUntil && now >= (e.corrodeNext || 0)) {
        e.corrodeNext = now + 350;
        this.damageEnemy(e, e.corrodeDmg || 2, false, true);
        if (!e.active) return;   // può morire dalla corrosione
      }

      // Nemico rimasto troppo indietro (oltre una membrana gia' superata): non potra'
      // piu' raggiungere il giocatore, lo rimuoviamo cosi' lo spawner ne crea di nuovi
      // nella sezione attuale. Boss, guardiani e il fuggitivo (gestisce da solo il proprio
      // esaurimento in fugitiveAI, con banner "scappato") sono esenti.
      if (!e.guard && !e.fugitive && e.kind !== 'boss' && (this.player.x - e.x) > this.cameras.main.width * 1.3) {
        e.destroy();
        return;
      }

      if (now >= e.knockUntil && now < (e.stunnedUntil || 0)) {
        e.setVelocityX(0);   // Abilità GETTO STORDENTE: fermo, niente IA finche' dura lo stordimento
      } else if (now >= e.knockUntil) {
        if (e.fugitive) {
          this.fugitiveAI(e, now);   // ignora tutto il resto: corre sempre verso il timpano
        } else if (e.kind === 'boss') {
          this.bossAI(e, now);
        } else if (e.kind === 'spit') {
          // Gorgogliante: spara SOLO se è nell'inquadratura (range d'attacco limitato).
          const cam = this.cameras.main;
          const onScreen = e.x > cam.scrollX - 60 && e.x < cam.scrollX + cam.width + 60;
          this.spitEnemyAI(e, now, onScreen);
        } else if (e.kind === 'fly') {
          this.flyAI(e, now);   // moscerino: si libra sopra di te e PICCHIA (telegrafato)
        } else if (e.guard && Math.abs(this.player.x - e.homeX) > e.guardRange) {
          // Guardiano in attesa: il giocatore e' lontano, resta a presidiare la membrana.
          if (Math.abs(e.homeX - e.x) > 8) e.setVelocityX(Math.sign(e.homeX - e.x) * e.speed * 0.5);
          else e.setVelocityX(0);
          e.setFlipX(this.player.x < e.x);
        } else if (e.kind === 'crust') {
          // Crosta (corazzata lenta): avanza camminando verso il giocatore. Niente
          // affondo (è una parete inesorabile), va abbattuta col corpo a corpo.
          // Stessa zona morta del cerumino, se no vibra quando gli stai sopra.
          const dir = this.versoIlGiocatore(e);
          e.setVelocityX(dir * e.speed);
          if (dir !== 0) e.setFlipX(dir < 0);
        } else if (e.kind === 'flea') {
          this.fleaAI(e, now);     // Pulce: saltella di continuo verso il giocatore
        } else if (e.kind === 'hopper') {
          this.hopperAI(e, now);   // Saltatore: balzo enorme telegrafato + onda d'urto
        } else {
          // Cerumino (blob): cammina + AFFONDO telegrafato.
          this.groundEnemyAI(e, now);
        }
      }

      if (!e.fugitive && Phaser.Geom.Intersects.RectangleToRectangle(e.getBounds(), pb)) {
        this.hurtPlayer(e.contactDamage, e.x);
      }
    });
  }

  // Le abilita' che vivono a ogni fotogramma: bolla compagna, colpi a ricerca, scia dello
  // scatto, alone dello scudo.
  // ABILITA' RAFFICA RADIALE (impilabile, idea dell'utente al playtest del 2026-08-02): ogni
  // paio di secondi parte una corona di palline tutt'attorno al personaggio.
  // A cosa serve nel gioco: copre l'unico punto debole di un'arma che spara in una direzione
  // sola, cioe' i nemici che ti si appiccicano ai fianchi mentre stai mirando altrove, e
  // intanto sgretola il cerume che hai intorno senza che tu debba pensarci.
  // ⚠️ Impilando si aggiungono DIREZIONI (4, poi 8, poi 12...), non colpi nella stessa
  // direzione: cosi' ogni carta allarga davvero la copertura invece di raddoppiare quello che
  // avevi gia'. Il danno di ogni pallina e' ridotto apposta (RADIALE_DANNO): e' un'arma che
  // lavora da sola, se picchiasse quanto il getto renderebbe inutile mirare.
  raffichaRadiale(now, p) {
    const n = p.radiale | 0;
    if (n <= 0 || now < (this._radialeAl || 0)) return;
    this._radialeAl = now + window.CONFIG.RADIALE_OGNI;
    const origine = { x: this.player.x, y: this.player.y - 6 };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // il 5o parametro di spawnPellet e' il moltiplicatore di danno della pallina
      this.spawnPellet(Math.cos(a), Math.sin(a), -6, p, window.CONFIG.RADIALE_DANNO, origine);
    }
    this.blastFx(46);            // anello: si vede da dove parte la corona
    window.Sfx.spray();
  }

  aggiornaAbilita(now) {
    const p = window.GameState.player;
    if (p.radiale) this.raffichaRadiale(now, p);
    if (this.companions.length) this.updateCompanions(now);
    if (p.homing) this.updateHomingShots(now);
    if (p.dashStrike) this.updateDashStrike(now);
    this.updateShieldAura(now);

    // JUICE — molla: i moltiplicatori di scala tornano verso 1 ogni frame (rimbalzo morbido).
    // Applicata qui, a fine update(): DOPO ogni possibile trigger di questo stesso frame
    // (atterraggio/inversione/salto sopra, ma anche il contatto coi nemici appena elaborato
  }

  // Chiusura del fotogramma: juice a molla, sagoma e vestito del personaggio, macchie, arma
  // in mano, e i due valori che il fotogramma successivo confronta col suo (velocita' e
  // quota dei piedi).
  chiudiFotogramma() {
    // sopra), cosi' nessun evento resta con un frame di ritardo prima di vedersi.
    this.jx += (1 - this.jx) * window.CONFIG.JUICE_SPRING;
    this.jy += (1 - this.jy) * window.CONFIG.JUICE_SPRING;
    // SAGOMA accovacciata (68% dell'altezza in piedi) + juice procedurale. Questo e' GAMEPLAY: e'
    // cio' che decide se passi sotto un soffitto basso, e i pertugi dei livelli sono tarati su
    // questo numero — non va inseguito al disegno. Il disegno (hero_crouch_a, vedi sopra) si
    // abbassa all'82%: il personaggio sembra un filo piu' alto del buco che attraversa. Scelta
    // consapevole con l'utente il 2026-07-31: alzare la sagoma renderebbe impraticabili passaggi
    // gia' collaudati, schiacciare il disegno lo allargherebbe e si vedrebbe.
    this.player.setScale(1.5 * this.jx, (this.crouching ? 1.02 : 1.5) * this.jy);
    // Il "vestito" animato segue il player (piedi = fondo del corpo fisico) e riceve il juice.
    this.heroVisual.setPosition(this.player.x, this.player.body.bottom);
    this.heroVisual.setScale(this.HERO_SCALE * this.jx, this.HERO_SCALE * this.jy);
    this.posizionaMacchie();          // le macchie di cerume seguono il corpo
    // Arma in mano (layer): segue la mano finche' visibile, poi si nasconde a fine attacco.
    if (this.heroWeapon.visible) {
      if (this.time.now > this._weaponHideAt) this.heroWeapon.setVisible(false);
      else this.positionWeapon();
    }

    // JUICE — salva la velocita' verticale di QUESTO frame: al prossimo frame, se si atterra,
    // e' la velocita' di caduta appena prima che il pavimento la azzeri (misura l'impatto).
    this._prevVelY = this.player.body.velocity.y;
    // Quota dei piedi a fine frame: al prossimo frame dice se la testa di un nemico e' stata
    // oltrepassata in un colpo solo (salto sui nemici con caduta veloce).
    this._prevBottom = this.player.body.bottom;

    this.updateHud();
  }

  // ==========================================================================================
  // IL FOTOGRAMMA. Gira 60 volte al secondo ed e' l'INDICE del gioco vivo: qui sotto non c'e'
  // logica, solo l'elenco ordinato di cosa succede in un fotogramma. Ogni riga porta a un metodo
  // che ha in testa il commento di cosa fa. Per mettere le mani da qualche parte: si legge questo
  // elenco, si trova il passo giusto, si scende li'.
  // ⚠️ L'ORDINE NON E' ARBITRARIO — i vincoli noti, in ordine di apparizione:
  //   · i cronometri e il traguardo vengono PRIMA di tutto: possono chiudere il livello, e da li'
  //     in poi toccare il personaggio o i nemici sarebbe lavoro su una partita gia' finita;
  //   · l'aggancio al terreno viene PRIMA dei comandi: dice se si e' appoggiati, e mezzo blocco
  //     dei comandi (salto, scatto, accovacciamento) dipende da quella risposta;
  //   · l'animazione viene DOPO i comandi: mostra cosa il personaggio ha appena deciso di fare;
  //   · la chiusura sta per ultima perche' salva i due valori (velocita' e quota dei piedi) che
  //     il fotogramma SUCCESSIVO confronta coi propri.
  // ==========================================================================================
  update(time, delta) {
    window.GameGfx.updateBackground(this);   // parallax: scorre gli strati di sfondo
    this.animateWax(time);                    // cerume "fluido": ondeggia e cola
    this.fermaProiettiliNelTerreno();         // colline e soffitto fermano i colpi (non sono solidi)
    // Schegge della Regina: incollate al profilo del terreno (e' il motivo per cui non saltellano).
    this.movers.getChildren().forEach((m) => {
      if (m.active && m.scheggia) m.y = this.terrainTopAt(m.x) - 10;
    });
    if (this.locked) { this.player.setVelocityX(0); return; }
    const now = time;
    const dt = Math.min(delta || 16.7, 100);   // tetto: se il telefono si impunta, il tempo non salta

    if (this.aggiornaCronometri(now, dt)) return;   // la corsa a tempo puo' finire qui

    if (this.controllaTraguardo(now)) return;       // livello completato: si esce

    const onGround = this.agganciaAlTerreno(now);
    const onSlime = this.aggiornaAmbiente(now, onGround);
    this.comandiDelGiocatore(now, onGround, onSlime);

    this.animaPersonaggio(onGround);

    this.aggiornaNemici(now);

    this.aggiornaAbilita(now);
    this.chiudiFotogramma();
  }
}
// Tinte delle varianti ELITE. Fuori dalla classe cosi' le leggono anche i controlli automatici.
// Scelte per MOLTIPLICAZIONE sull'arte ambra dei nemici: il blu-acciaio la raffredda (corazza),
// il rosso la accende (esplosivo), il viola la sposta di tono senza spegnerla (si sdoppia).
GameScene.ELITE_TINT = { tank: 0x9fc7e8, boom: 0xff7a4a, split: 0xb79bff };
// Colori del LAVAGGIO (vedi creaLavaggioElite): questi sono SATURI sul serio, perche' non
// vengono moltiplicati sul disegno ma stesi sopra. Sono i colori che il giocatore vede davvero.
GameScene.ELITE_LAVAGGIO = { tank: 0x2f9bff, boom: 0xff2f14, split: 0xa64bff };
// Quanto copre il lavaggio. Sotto ~0,45 la variante torna a non riconoscersi; sopra ~0,65 la
// creatura diventa una sagoma piatta e non si capisce piu' che nemico sia.
GameScene.ELITE_FORZA = 0.55;
// Quante macchie di cerume al massimo addosso al personaggio. Senza tetto, dopo qualche minuto
// il PG diventa una palla di cerume che cammina e non si legge piu' nulla.
GameScene.MACCHIE_MAX = 10;
// Quanto vicino (in pixel orizzontali) il giocatore deve essere perche' un nemico a terra
// smetta di inseguirlo e stia fermo. Vedi versoIlGiocatore: e' l'antidoto alla vibrazione.
GameScene.ZONA_MORTA = 16;
// Quanto si scurisce il personaggio, foglio per foglio (vedi tintaPersonaggio). Ogni numero e'
// il rapporto MISURATO fra la luminosita' media dei fogli di riferimento (84) e quella del
// foglio da correggere: non e' un gusto, e' una divisione.
//   · i due fogli accovacciati stanno a 108-110  -> 84/109 = 0,77 -> 0xc2c2c2
//   · i due fogli nuovi stanno a 91              -> 84/91  = 0,92 -> 0xebebeb
// (Sui nuovi lo scarto e' piccolo e da solo non si noterebbe; si corregge lo stesso perche'
// costa niente ed evita che il personaggio cambi resa passando da un'animazione all'altra.)
GameScene.VELATURA = {
  hero_crouch: 0xc2c2c2,
  hero_crouchwalk: 0xc2c2c2,
  hero_crouchaim: 0xebebeb,
  hero_melee: 0xebebeb,
};
// Dove sta la SPALLA rispetto al centro del corpo, e quanto e' lungo il braccio teso: l'arma a
// distanza si posiziona su quell'arco, nella direzione di mira (vedi positionWeapon).
GameScene.BRACCIO_SPALLA = -16;
GameScene.BRACCIO_RAGGIO = 13;
GameScene.BRACCIO_AVANTI = 6;
// Dove sta la MANO in ogni posa di mira, in pixel rispetto al punto d'appoggio dello sprite
// (i piedi). Misurati sui fogli baked cercando l'estremita' del braccio teso. Sono il motivo per
// cui l'arma finisce DENTRO la mano invece che a mezz'aria: quando una posa e' attiva l'arma si
// aggancia qui, non piu' all'arco della spalla.
// ⚠️ Se si ri-bakano le pose (tools\bake_hero_sheet.py) questi numeri vanno rimisurati.
GameScene.MANO = {
  avanti: [27, -45],
  su: [0, -63],
  accovacciato: [23, -34],
  corsa: [[31, -45], [24, -43], [23, -44], [25, -43], [28, -42], [25, -45]],
  // Sparo camminando accovacciato: una voce per fotogramma, misurata sul foglio in due modi
  // indipendenti (la punta della sagoma e il colore del guanto) che concordano entro 3 pixel.
  // ⚠️ Il fotogramma 3 sta piu' indietro degli altri perche' il braccio, in quel disegno, e'
  // venuto PIEGATO invece che teso. L'arma lo segue — e' giusto cosi', sta nella mano che c'e'
  // disegnata — ma per un fotogramma su otto si vede rientrare. Si chiude rigenerando quel
  // disegno, non toccando questo numero.
  crouchaim: [[23, -32], [20, -32], [20, -31], [12, -25], [26, -33], [31, -33], [28, -31], [28, -34]],
  // Colpo corpo a corpo: la mano gira in un arco, quindi qui c'e' anche la direzione del braccio
  // (vedi MISCHIA_ANGOLO) e non solo il punto.
  mischia: [[-14, -57], [-6, -61], [22, -42], [28, -26]],
};
// Verso in cui punta l'ARMA in ogni fotogramma del colpo, in gradi (0 = in avanti, negativo =
// verso l'alto). Non e' una scelta estetica: sono gli angoli fra la spalla e la mano disegnata
// in ciascuna posa, cioe' l'inclinazione che il braccio ha davvero. Presi da qui invece che da
// un'animazione a tempo, l'arma non puo' mai sfasarsi rispetto al corpo — era il difetto della
// versione precedente, dove il bastoncino ruotava per conto suo davanti a un corpo immobile.
GameScene.MISCHIA_ANGOLO = [-117, -101, -29, 8].map((g) => g * Math.PI / 180);
// Oltre questa inclinazione della mira si usa la posa col braccio in su invece di quella in
// avanti. Le diagonali non hanno una posa loro: si sceglie la piu' vicina.
GameScene.MIRA_SU_OLTRE = 55 * Math.PI / 180;
// Quanto sopra la testa di un nemico vale gia' come "gli sei saltato addosso", in pixel. Vale in
// tutte e due le direzioni (vedi il rimbalzo in update): sopra decide quanto presto scatta, sotto
// quanto in ritardo si puo' ancora recuperare. Con 12 la fascia utile e' 24px su un nemico alto
// 46 — grosso modo il quarto superiore del corpo, che e' quello che il giocatore mira.
GameScene.RIMBALZO_TOLLERANZA = 12;
// I fogli del personaggio, per misurarne l'altezza disegnata all'avvio (misuraAltezzeDisegnate).
GameScene.FOGLI_PG = ['hero_idle', 'hero_walk', 'hero_run', 'hero_jump', 'hero_crouch',
  'hero_crouchwalk', 'hero_aim', 'hero_runaim', 'hero_crouchaim', 'hero_melee'];
// I metodi che COSTRUISCONO il livello stanno in `src/scenes/game_livello.js`: sono 460
// righe che non toccano ne' i nemici ne' il combattimento, e qui in mezzo facevano solo
// volume. Si innestano sul prototipo invece di essere funzioni a se' che ricevono la scena,
// cosi' dentro di loro `this` e' la scena esattamente come prima e i corpi non sono stati
// riscritti: sono stati spostati e basta.
// ⚠️ `game_livello.js` va caricato PRIMA di questo file (vedi index.html), se no qui sotto
// non c'e' niente da innestare e il gioco parte senza pavimento.
Object.assign(GameScene.prototype, window.GameLivello);

window.GameScene = GameScene;
