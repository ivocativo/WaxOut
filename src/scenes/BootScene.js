// BootScene: carica gli sprite PNG (grafica vera) e genera via codice le texture
// non ancora ridisegnate, poi va al menu.
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  // Sprite PNG disegnati a mano. Sono INCORPORATI come data URI (src/sprites_data.js)
  // cosi' si caricano anche aprendo index.html da file:// (i browser bloccano i PNG
  // esterni in locale). Fallback al file su disco se i dati incorporati mancano.
  preload() {
    // ⚠️ QUANTI FILE PHASER SCARICA INSIEME. Il valore di fabbrica e' 32, e NON e' solo un limite
    // di parallelismo: quando i 32 finiscono tutti nello stesso momento il caricatore si dichiara
    // finito e i file oltre il 32esimo restano in coda PER SEMPRE, senza errori e senza fallimenti
    // (misurato: daCaricare 34, fatti 32, falliti 0, rimasti in lista hero_crouchaim e hero_melee).
    // E' cosi' che il gioco ha girato per giorni senza l'immagine del colpo corpo a corpo e senza
    // quella dello sparo accovacciato: le due animazioni aggiunte per ultime, cioe' proprio quelle
    // in fondo alla coda. Da fuori si vedeva solo che "l'animazione del coton fioc non si vede".
    // Il numero alto serve a stare larghi; il controllo qui sotto (verificaCaricamento) e' quello
    // che impedisce al problema di tornare in silenzio se un giorno i file diventassero 300.
    this.load.maxParallelDownloads = 256;
    const D = window.SPRITE_DATA || {};
    const img = (key, name, file) => this.load.image(key, D[name] || ('assets/sprites/' + file));
    img('player_a', 'hero_idle', 'hero_idle.png');
    img('player_b', 'hero_idle', 'hero_idle.png');   // walk = idle finche' non c'e' il frame di corsa
    img('wax_glob', 'wax_glob', 'wax_glob.png');

    // NEMICI (round B.2): immagini AI scontornate + pixellizzate (tools/bake_sprite.ps1), tutte in
    // assets/sprites/enemies/. Sostituiscono le vecchie texture (cerumino/crosta erano PNG, gli
    // altri 5 erano generati a codice con PixelArt.fromGrid — ora rimosso). Caricate DIRETTAMENTE
    // dal file (non via `img`) per non passare dai vecchi data URI in SPRITE_DATA, che avrebbero
    // la precedenza. La scala e la hitbox a schermo le ricalcola GameScene.spawnEnemy (tabella ART).
    // (Dal 2026-07-30 TUTTI i nemici sono animati: non resta nessuna immagine ferma.)

    // ARMI IN MANO (2026-07-31): erano le ultime due texture disegnate a codice di tutto il
    // gioco. Ora sono immagini vere, stessa pipeline di nemici e timpano (fondo magenta ->
    // tools\bake_sprite.ps1). Il coton fioc ha UNA sola punta: il bastoncino nudo e' dove il
    // personaggio impugna, ed e' li' che sta il perno (vedi WEAPONS in GameScene).
    // ⚠️ NON rimettere il braccio dentro l'immagine dell'arma: provato il 2026-08-01 e
    // BUTTATO. Funzionava benissimo come meccanica (un disegno solo, e la mira andava in tutte
    // e otto le direzioni), ma il corpo del personaggio ha GIA' DUE BRACCIA disegnate: quello
    // dell'arma diventava il terzo. Per farlo servirebbe ridisegnare il personaggio senza un
    // braccio, cioe' rigenerare tutte e quattro le animazioni da 25 frame. Il sorgente resta
    // in art_sources/hero/arm-gun.png se un domani si rifa' il personaggio da zero.
    [['swab', 'swab_px'], ['sprayer', 'sprayer_px']]
      .forEach(([chiave, file]) => this.load.image(chiave, 'assets/sprites/weapons/' + file + '.png'));

    // CERUMINO ANIMATO: stessa chiave 'enemy_blob' degli altri nemici, ma caricata come SPRITE
    // SHEET (12 frame di strisciata, testa a destra come tutti gli altri sprite del gioco). Usare
    // la stessa chiave invece di aggiungerne una nuova fa si' che tutto quello che gia' mostra il
    // cerumino (menu, tabella ART, hitbox) continui a funzionare senza saperne niente: chi non
    // chiede un'animazione vede il frame 0. Preparato con tools\bake_sheet.py.
    // ⚠️ frameWidth/Height devono combaciare con quello che stampa bake_sheet.py ("12 frame da
    // WxH"): l'altezza dipende dal riquadro comune dei frame, quindi CAMBIA se si ri-baka una
    // versione nuova dell'animazione. Sbagliarla non da' errore, taglia gli sprite di traverso.
    this.load.spritesheet('enemy_blob', 'assets/spritesheets/enemies/cerumino_crawl_px.png',
      { frameWidth: 116, frameHeight: 72 });
    // TUTTI GLI ALTRI NEMICI, ANIMATI. Ognuno tiene la sua chiave storica ('enemy_crust',
    // 'enemy_fly', ...): cosi' la tabella ART, le hitbox e ogni altro punto che li mostra
    // continuano a funzionare senza sapere che ora sono sprite sheet — chi non chiede
    // un'animazione vede il frame 0.
    // ⚠️ Le misure devono combaciare con quello che stampa tools\bake_sheet.py ("12 frame da
    // WxH"): dipendono dal riquadro comune dei frame e CAMBIANO se si ri-baka una versione nuova.
    // Sbagliarle non da' errore: taglia gli sprite di traverso.
    [['enemy_crust', 'crosta_crawl_px', 118, 70],
     ['enemy_fly', 'moscerino_fly_px', 88, 77],
     ['enemy_flea', 'pulce_walk_px', 74, 64],
     ['enemy_spit', 'gorgogliante_crawl_px', 80, 67],
     ['enemy_boss', 'boss_walk_px', 210, 144],
     ['enemy_boss_regina', 'regina_walk_px', 225, 129],
     ['enemy_hopper', 'saltatore_salto_px', 104, 96]]
      .forEach(([chiave, file, w, h]) => this.load.spritesheet(chiave,
        'assets/spritesheets/enemies/' + file + '.png', { frameWidth: w, frameHeight: h }));

    // Immagini "vere" (fondale, timpano, protuberanze): sono INCORPORATE come data URI
    // (src/assets_data.js) cosi' si caricano anche da file:// (i browser bloccano i
    // PNG/JPG esterni in locale). Ripiego al file su disco se il dato incorporato manca.
    // Per aggiornarle: sostituisci il PNG e rilancia tools/embed_assets.ps1.
    const A = window.ASSET_DATA || {};
    const aimg = (key, file) => this.load.image(key, A[key] || file);
    // Timpano: immagine AI scontornata (fondo magenta) + pixellizzata (tools/bake_sprite.ps1), round B.1.
    aimg('eardrum', 'assets/sprites/eardrum_px.png');
    // Fondale gia' pixelato+posterizzato (tools/bake_bg_pixel.ps1); niente elaborazione
    // canvas a runtime (che si romperebbe da file://).
    aimg('bg_flesh_px', 'assets/backgrounds/bg_flesh_01_px.png');
    // SET DI SFONDO: 3 strati di parallax (lontano/medio/vicino) DIETRO a soffitto e terreno.
    // Restano PITTORICI di proposito (contrasto voluto con i personaggi pixel-art), quindi non
    // sono pixelati/posterizzati come il resto. Preparati da tools/bake_background_set.ps1:
    // il 'far' e' un fondo pieno (JPG, leggero), gli altri due hanno la trasparenza scontornata
    // dal magenta (PNG). Un set ogni 5 livelli, cambia dopo il boss (vedi GameGfx.bgSetFor).
    // Per aggiungere un set: crea assets/backgrounds/<N>/ con fondale/mid/primo piano, lancia
    // lo script, e aggiungi N alla lista qui sotto.
    window.BG_SETS = [2];
    window.BG_SETS.forEach((s) => {
      const dir = 'assets/backgrounds/' + s + '/';
      aimg('bg' + s + '_far', dir + 'bg' + s + '_far.jpg');
      aimg('bg' + s + '_mid', dir + 'bg' + s + '_mid.png');
      aimg('bg' + s + '_near', dir + 'bg' + s + '_near.png');
    });
    // PROTUBERANZE: NON piu' caricate (2026-07-27). Il disegno non ha mai convinto l'utente, che
    // ha deciso di lasciarle ferme: sono gli sfondi a fare l'ambiente. Restavano caricate anche
    // se spente — 1,8 MB nell'app piu' 2,3 MB di copia incorporata in assets_data.js, sprecati.
    // I file sorgente restano in assets/protuberances/ per un'eventuale ripresa; per riaccenderle
    // servono: queste righe, la voce in tools/embed_assets.ps1 e la chiamata a
    // GameGfx.drawProtuberances in buildLevel.
    // CERUME (sprite AI): pezzi/chunk per il muro + gocce/colate. Ricolorati per tipo in gioco.
    ['wax_a', 'wax_b', 'wax_c', 'wax_d', 'wax_drip_a', 'wax_drip_b']
      .forEach((k) => aimg(k, 'assets/wax/' + k + '.png'));

    // Sprite sheet ANIMATI del personaggio (generati con AutoSprite da UNA sola immagine AI).
    // TUTTI gli sprite sheet del gioco vivono in assets/spritesheets/<entita'>/ (cartella dedicata,
    // separata da assets/sprites/ che ha le immagini singole). Griglia 5x5 = 25 frame da 256x256.
    // Caricati da file (in preview via server); per far girare da file:// andranno incorporati
    // come gli altri (embed) piu' avanti. Versione PIXELLATA (bake: risoluzione ridotta + colori
    // ridotti + bordi netti) per combaciare con lo stile pixel-art dello sfondo. Frame 84x84 (sheet 420x420).
    const heroSheet = (key, file) => this.load.spritesheet(key, (A[key] || 'assets/spritesheets/hero/' + file), { frameWidth: 84, frameHeight: 84 });
    heroSheet('hero_walk', 'hero_walk_px.png');
    heroSheet('hero_run',  'hero_run_px.png');
    heroSheet('hero_idle', 'hero_idle_px.png');
    heroSheet('hero_jump', 'hero_jump_px.png');
    // ACCOVACCIAMENTO (2026-07-31): 6 frame invece di 25 — e' un PASSAGGIO, non un ciclo, e a 60
    // fotogrammi al secondo un accovacciamento di 180ms ha spazio per 11 immagini in tutto. I 36
    // disegni originali stanno in assets/spritesheets/hero/crouch/: i primi 7 valevano lo 0,8%
    // della discesa e gli ultimi due erano identici. Scelti campionando il MOVIMENTO, con le
    // distanze che si accorciano verso il fondo (scende di slancio e si assesta).
    // ⚠️ 6 livelli di posterizzazione, non 22: le altre animazioni del personaggio usano una
    // tavolozza a multipli di 51 (6 passi per canale) e con 22 il costume risultava piu' chiaro
    // e piu' pulito degli altri — si vedeva il cambio di vestito ogni volta che ci si abbassava.
    // Rigenerabile: tools\bake_hero_sheet.py "...\crouch" ...\hero_crouch_px.png 1,17,21,26,30,35 6
    heroSheet('hero_crouch', 'hero_crouch_px.png');
    // CAMMINATA ACCOVACCIATA (2026-07-31): 8 fotogrammi presi dal VIDEO in
    // assets\spritesheets\hero\crouch move\. Dal video e non da pose singole perche' cosi'
    // vengono tutti dalla stessa generazione: inquadratura, scala, colori e proporzioni del
    // personaggio combaciano gia', senza doverli rimettere in riga a mano.
    // Rigenerabile: tools\bake_hero_sheet.py "...\crouch move.mp4" ...\hero_crouchwalk_px.png
    //               video:74,78,81,85,88,92,95,99 6 rif=...\crouch\Image35.png alto=50
    heroSheet('hero_crouchwalk', 'hero_crouchwalk_px.png');
    // POSE DI MIRA (2026-08-02). Tre pose ferme (avanti, in su, accovacciato) e un ciclo di sei
    // per la corsa. Il braccio e' teso e la MANO E' VUOTA: l'arma ci si infila dentro. E' la
    // soluzione al vicolo cieco del 01/08, quando avevo attaccato il braccio all'immagine
    // dell'arma e il personaggio si ritrovava con TRE braccia (il corpo ne ha gia' due).
    heroSheet('hero_aim', 'hero_aim_px.png');
    heroSheet('hero_runaim', 'hero_runaim_px.png');
    // SPARO CAMMINANDO ACCOVACCIATO (2026-08-03). Gli stessi 8 fotogrammi della camminata
    // accovacciata, ridisegnati col braccio teso: le GAMBE sono identiche, cambia solo il
    // braccio. E' quello che tiene insieme le due animazioni — se cambiassero anche le gambe,
    // cominciare a sparare mentre cammini farebbe scattare il passo.
    heroSheet('hero_crouchaim', 'hero_crouchaim_px.png');
    // COLPO CORPO A CORPO (2026-08-03). Quattro pose: mazza caricata sopra la spalla, braccio
    // in alto, colpo in orizzontale, fine corsa in basso. Prima il corpo restava fermo nella
    // posa di riposo e si muoveva solo l'arma disegnata: si vedeva un bastoncino che ruotava
    // da solo davanti a un personaggio immobile.
    heroSheet('hero_melee', 'hero_melee_px.png');
    // Chi non ce l'ha fatta, con l'indirizzo per esteso. Serve quando lo schermo resta vuoto:
    // e' l'unico modo per sapere SE il problema e' che i file non arrivano, e quali.
    this.load.on('loaderror', (f) => {
      if (!window.__falliti) window.__falliti = [];
      if (window.__falliti.length < 12) window.__falliti.push(f.key + ' → ' + (f.src || f.url || '?'));
    });
    this.load.on('complete', () => this.verificaCaricamento());
  }

  // CONTROLLO DI FINE CARICAMENTO. Non da' per scontato che "nessun errore" voglia dire
  // "tutto caricato": il caso che ci e' costato piu' caro non produceva nessun errore, i file
  // restavano semplicemente in coda (vedi maxParallelDownloads sopra). Qui si guarda il
  // risultato — le immagini ci sono davvero? — invece del percorso.
  // Nel pannello di prova acceso lo urla anche a schermo, se no un console.error non lo vede
  // nessuno: e' esattamente quello che e' successo per giorni.
  verificaCaricamento() {
    const L = this.load;
    const mancanti = [];
    for (const k of BootScene.TEXTURE_ATTESE) if (!this.textures.exists(k)) mancanti.push(k);
    const inCoda = L.list.size;
    if (!mancanti.length && !inCoda) return;
    const msg = 'CARICAMENTO INCOMPLETO — mancano: ' + (mancanti.join(', ') || '(nessuna)')
      + ' | rimasti in coda: ' + inCoda
      + ' | attesi ' + L.totalToLoad + ', caricati ' + L.totalComplete + ', falliti ' + L.totalFailed;
    console.error(msg);
    if (window.CONFIG && window.CONFIG.PANNELLO_PROVA) {
      this.add.text(8, 8, msg, { fontSize: '13px', color: '#ff5555', backgroundColor: '#000',
        wordWrap: { width: 900 } }).setDepth(9999).setScrollFactor(0);
    }
  }

  create() {
    const C = window.CONFIG.COLORS;
    const PA = window.PixelArt;
    const sE = window.CONFIG.PIXEL_SCALE_ENEMY;

    // MUSICA a brani veri (2026-07-28): scarica e decodifica in sottofondo, senza bloccare il
    // caricamento del gioco. Finche' non sono pronti (o se mancano) suona il synth di sempre.
    if (window.Sfx && window.Sfx.loadTracks) window.Sfx.loadTracks();

    // Strisciata del cerumino. Le animazioni in Phaser sono GLOBALI: registrata qui una volta,
    // e' disponibile a ogni scena (partita e menu) senza doverla ricreare a ogni livello.
    // 8 fps: a 6 (il valore del prototipo) si vedeva a scatti sotto ai nemici che corrono.
    if (!this.anims.exists('blob_crawl')) {
      this.anims.create({
        key: 'blob_crawl',
        frames: this.anims.generateFrameNumbers('enemy_blob', { start: 0, end: 11 }),
        frameRate: 8, repeat: -1,
      });
    }
    // ANIMAZIONI DEL PERSONAGGIO: registrate QUI e non piu' solo in GameScene, cosi' sono
    // disponibili anche prima di iniziare a giocare — al menu serviva il personaggio animato e
    // c'era rimasto il vecchio sprite pixel (segnalato dall'utente 2026-07-29). GameScene le
    // registra ancora con la stessa guardia `exists`, quindi non cambia niente per lei.
    [['hero_walk_a', 'hero_walk', 18], ['hero_run_a', 'hero_run', 22],
     ['hero_idle_a', 'hero_idle', 10], ['hero_jump_a', 'hero_jump', 18]].forEach(([chiave, sheet, fps]) => {
      if (!this.anims.exists(chiave)) {
        this.anims.create({
          key: chiave, frames: this.anims.generateFrameNumbers(sheet, { start: 0, end: 24 }),
          frameRate: fps, repeat: -1,
        });
      }
    });
    // L'accovacciamento e' l'unica animazione del personaggio che NON si ripete: 6 frame a 33/s
    // (180ms) e poi si FERMA sull'ultimo, che e' la posa tenuta. Per rialzarsi si rilegge al
    // contrario (`anims.playReverse`), quindi un solo foglio serve per andare giu' e tornare su.
    if (!this.anims.exists('hero_crouch_a')) {
      this.anims.create({
        key: 'hero_crouch_a', frames: this.anims.generateFrameNumbers('hero_crouch', { start: 0, end: 5 }),
        frameRate: 33, repeat: 0,
      });
    }
    // La camminata accovacciata invece SI ripete. 12 al secondo non e' un gusto: accovacciati si
    // va a 99 px/s (220 x 0,45) e il passo disegnato copre ~30px, quindi un ciclo intero vale
    // ~60px di terreno = ~0,6s. Piu' lenta e i piedi slitterebbero sul pavimento, piu' veloce e
    // sembrerebbe che pattini.
    if (!this.anims.exists('hero_crouchwalk_a')) {
      this.anims.create({
        key: 'hero_crouchwalk_a', frames: this.anims.generateFrameNumbers('hero_crouchwalk', { start: 0, end: 7 }),
        frameRate: 12, repeat: -1,
      });
    }
    // Corsa mirando: 6 fotogrammi = UN ciclo (due passi). La corsa normale ne ha 25 a 22/s, e
    // quei 25 contengono quattro passi: due passi durano 12,5 fotogrammi = 0,57s. Per tenere la
    // stessa andatura, 6 fotogrammi in 0,57s fanno 11 al secondo. Se non combaciasse, correndo e
    // sparando il passo cambierebbe velocita' rispetto a correndo e basta.
    if (!this.anims.exists('hero_runaim_a')) {
      this.anims.create({
        key: 'hero_runaim_a', frames: this.anims.generateFrameNumbers('hero_runaim', { start: 0, end: 5 }),
        frameRate: 11, repeat: -1,
      });
    }
    // Sparo camminando accovacciato: 12 al secondo ESATTAMENTE come `hero_crouchwalk_a`, e non e'
    // una coincidenza — sono gli stessi fotogrammi col braccio diverso, quindi devono scorrere
    // alla stessa andatura. Se divergessero, il passo cambierebbe velocita' nel momento in cui
    // apri il fuoco.
    if (!this.anims.exists('hero_crouchaim_a')) {
      this.anims.create({
        key: 'hero_crouchaim_a', frames: this.anims.generateFrameNumbers('hero_crouchaim', { start: 0, end: 7 }),
        frameRate: 12, repeat: -1,
      });
    }
    // Colpo corpo a corpo: NON si ripete (e' un gesto, non un ciclo) e la durata NON e' fissata
    // qui — la decide GameScene al momento del colpo, sulla cadenza dell'arma che hai in mano
    // (vedi meleeSwing). Con un valore fisso, il coton fioc rapido avrebbe l'animazione ancora a
    // meta' quando parte gia' il colpo successivo.
    if (!this.anims.exists('hero_melee_a')) {
      this.anims.create({
        key: 'hero_melee_a', frames: this.anims.generateFrameNumbers('hero_melee', { start: 0, end: 3 }),
        frameRate: 16, repeat: 0,
      });
    }

    // CICLI DEI NEMICI. La velocita' e' scelta per CARATTERE, non per comodita': la crosta e'
    // secca e pesante e si trascina (5), il cerumino striscia (8), il moscerino sbatte le ali
    // (16, e' l'unico che vola), i due boss sono moli lente (6).
    [['crust_crawl', 'enemy_crust', 11, 5],
     ['fly_flap', 'enemy_fly', 7, 16],
     ['flea_walk', 'enemy_flea', 11, 9],
     ['spit_crawl', 'enemy_spit', 11, 6],
     ['boss_walk', 'enemy_boss', 11, 6],
     ['regina_walk', 'enemy_boss_regina', 11, 6]].forEach(([chiave, sheet, ultimo, fps]) => {
      if (!this.anims.exists(chiave)) {
        this.anims.create({
          key: chiave, frames: this.anims.generateFrameNumbers(sheet, { start: 0, end: ultimo }),
          frameRate: fps, repeat: -1,
        });
      }
    });

    // SALTATORE: l'unico che NON ha un ciclo continuo. La sua animazione e' un SALTO, e il salto
    // ha un inizio e una fine — quindi e' spezzata in tre pezzi che partono sugli stati veri
    // dell'IA (carica, balzo, atterraggio) invece di girare a vuoto. `repeat: 0` = si ferma
    // sull'ultimo fotogramma, che e' proprio quello che serve: resta nella posa giusta.
    // La carica dura 4 frame in ~550ms perche' tanto dura il telegrafo nell'IA: se andasse piu'
    // veloce finirebbe prima e il nemico resterebbe immobile ad aspettare.
    [['hopper_carica', 0, 3, 7], ['hopper_volo', 4, 9, 14], ['hopper_atterra', 10, 11, 12]]
      .forEach(([chiave, da, a, fps]) => {
        if (!this.anims.exists(chiave)) {
          this.anims.create({
            key: chiave, frames: this.anims.generateFrameNumbers('enemy_hopper', { start: da, end: a }),
            frameRate: fps, repeat: 0,
          });
        }
      });

    // player e i 7 NEMICI (round B.2) ora arrivano da PNG (vedi preload): le texture
    // procedurali di moscerino/gorgogliante/pulce/saltatore/boss sono state rimosse. Qui sotto
    // restano solo le texture ancora generate da codice (proiettili, blocchi, particelle, armi).

    // Proiettile OSTILE dei nemici (sputo): texture propria, ben diversa dal cerume
    // raccoglibile 'wax_glob' (round 2, A.3 — prima erano la stessa immagine e si confondevano).
    PA.poisonBall(this, 'proj_poison');

    // --- Blocchi del muro (3 durezze) ---
    PA.block(this, 'block_soft', C.waxSoft, C.waxSoftLight, C.waxSoftDark,
      [[6, 7], [18, 5], [11, 19], [22, 14], [5, 22]]);
    PA.block(this, 'block_hard', C.waxHard, C.waxHardLight, C.waxHardDark,
      [[8, 6], [20, 10], [6, 18], [16, 20], [24, 22]]);
    PA.block(this, 'block_dirt', C.dirt, C.dirtLight, C.dirtDark,
      [[5, 8], [14, 6], [22, 12], [9, 18], [18, 22]]);

    // --- Particelle ---
    PA.solid(this, 'bit_wax', C.waxSoftLight, 5, 5);
    PA.solid(this, 'bit_dirt', C.dirtLight, 5, 5);
    PA.solid(this, 'bit_hard', C.waxHardLight, 5, 5);

    // --- Armi ---
    // swab e sprayer arrivano da immagini vere (vedi preload). Il martello resta generato a
    // codice: e' l'arma del kit "martello" dell'ARSENALE, oggi chiuso — se un domani si riapre
    // serve una texture, e questa costa zero.
    PA.hammer(this, 'hammer');

    this.scene.start('MenuScene');
  }
}
// Le immagini senza le quali il gioco e' visibilmente rotto. Non e' l'elenco completo di quello
// che si carica: e' l'elenco di quello che, se manca, deve fermare tutto invece di passare
// inosservato. I fogli del personaggio ci sono tutti perche' e' li' che il problema si e'
// presentato — un'animazione che manca non da' errore, semplicemente non parte.
BootScene.TEXTURE_ATTESE = [
  'hero_walk', 'hero_run', 'hero_idle', 'hero_jump', 'hero_crouch', 'hero_crouchwalk',
  'hero_aim', 'hero_runaim', 'hero_crouchaim', 'hero_melee',
  'swab', 'sprayer', 'eardrum', 'bg_flesh_px',
];
window.BootScene = BootScene;
