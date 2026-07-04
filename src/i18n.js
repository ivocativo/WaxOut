// i18n.js — dizionario centrale delle scritte e traduzioni.
// Lingua di DEFAULT: inglese (per facilitare la diffusione dell'app).
// La scelta si salva in localStorage; aggiungere una lingua = aggiungere un
// blocco a STRINGS e il suo codice a ORDER/NATIVE. Niente accenti nelle stringhe
// (il font pixel del gioco non li disegna bene), come nel resto del progetto.
//
// Uso:  window.I18n.t('menu_start')                       -> "START RUN"
//       window.I18n.t('hud_level', { n: 3 })              -> "Level 3"
//   I segnaposto {nome} vengono sostituiti coi valori passati in params.
window.I18n = (function () {
  const KEY = 'earwaxwar.lang';
  const ORDER = ['en', 'it'];                 // lingue disponibili, in ordine di scelta
  const NATIVE = { en: 'English', it: 'Italiano' };

  const STRINGS = {
    en: {
      // --- Menu ---
      menu_subtitle: 'The Earwax War',
      menu_bank: 'Wax in the bank: {bank}      Best level: {best}',
      menu_ctrl_title: 'CONTROLS',
      menu_ctrl_move: 'Move:    A / D  or  Left/Right',
      menu_ctrl_jump: 'Jump:    Space      Aim: Up/Down',
      menu_ctrl_attack: 'Spray:   J  or hold click',
      menu_ctrl_dash: 'Dash:    Shift  (if unlocked)',
      menu_ctrl_touch: 'On phone: on-screen buttons (swab is automatic)',
      menu_goal_1: 'Clean the earwax along the canal with your soap jet, then reach the eardrum.',
      menu_goal_2: 'After each level you unlock a new ability or weapon.',
      menu_start: 'START RUN',
      menu_shop: 'SHOP (N)',
      menu_lang: 'Language: {lang}',
      // --- HUD ---
      hud_hp: 'HP {hp}/{max}',
      hud_level: 'Level {n}',
      hud_wall: 'Wall: {left}/{total}',
      hud_goal: 'Eardrum: {pct}%',
      hud_clean: 'Clean: {pct}%',
      hud_wax: 'Wax: {n}',
      hud_abilities: 'Abilities: {list}',
      // --- Banner di gioco ---
      game_boss_in: '!  THE WAX PLUG APPROACHES  !',
      game_swarm_in: 'SWARM INCOMING!',
      game_goal: 'CLEAN THE EAR CANAL!',
      game_clean_more: 'CLEAN MORE WAX!  ({pct}% needed)',
      game_boss_guard: 'DEFEAT THE WAX PLUG TO BREAK THROUGH!',
      game_boss_dead: 'WAX PLUG DESTROYED!  +{wax}',
      game_boss_enrage: 'THE WAX PLUG IS ENRAGED!',
      // --- Livello completato ---
      done_title: 'LEVEL {n} COMPLETE!',
      done_sub: 'Ear canal cleaned!',
      // --- Game over ---
      over_title: 'OVERWHELMED BY EARWAX',
      over_level: 'Run ended at level {n}',
      over_banked: 'Wax banked: +{earned}   (in bank: {bank})',
      over_newrun: 'NEW RUN',
      over_shop: 'SHOP',
      over_menu: 'MENU',
      // --- Negozio ---
      shop_title: 'EARWAX SHOP',
      shop_bank: 'Wax in bank: {bank}   |   Best level: {best}',
      shop_lv: 'Lv. {lv}/{max}',
      shop_owned: 'Owned',
      shop_notowned: 'Not owned',
      shop_max: 'MAX',
      shop_buy: 'BUY\n{cost}',
      shop_need: '{cost} wax',
      shop_back: 'BACK (ESC)',
      unlock_hp_name: 'Extra Heart',
      unlock_hp_eff: '+{n} HP at run start',
      unlock_dmg_name: 'Sharp Blade',
      unlock_dmg_eff: '+{n} damage at run start',
      unlock_speed_name: 'Spring Boots',
      unlock_speed_eff: '+{n} speed at run start',
      unlock_djump_name: 'Innate Double Jump',
      unlock_djump_eff: 'Start every run with double jump',
      // Progetti (blueprint): sblocchi che aggiungono abilità nuove alle run
      shop_stats_title: 'UPGRADES',
      shop_bp_title: 'BLUEPRINTS',
      shop_bp_hint: 'Unlock new abilities for your runs',
      shop_bp_done: 'UNLOCKED',
      shop_unlock: 'UNLOCK\n{cost}',
      bp_magnet_name: 'Wax Magnet', bp_magnet_desc: 'Pulls nearby wax to you',
      bp_blast_name: 'Shockwave', bp_blast_desc: 'Melee also hits around you',
      bp_splash_name: 'Soap Burst', bp_splash_desc: 'Jet splashes on impact',
      // --- Pausa ---
      pause_title: 'PAUSED',
      pause_hint: 'ESC or P to resume',
      pause_resume: 'RESUME',
      pause_restart: 'RESTART LEVEL',
      pause_menu: 'MAIN MENU',
      // --- Potenziamento (a fine livello) ---
      up_title: 'UPGRADE',
      up_hint: 'Choose a new ability or weapon (1 / 2 / 3 or click)',
      up_ability_tag: '★ ABILITY',
      up_stat_wax: 'Wax collected: {wax}',
      up_stat_line: 'Damage: {dmg}   Max HP: {hp}   Speed: {spd}',
      up_stat_weapon: 'Weapon: {weapon}',
      up_damage_name: 'Sharpen', up_damage_desc: '+8 damage',
      up_hp_name: 'Extra Fibre', up_hp_desc: '+25 max HP\n(and full heal)',
      up_attspd_name: 'Reflexes', up_attspd_desc: 'Faster attack',
      up_speed_name: 'Fast Boots', up_speed_desc: '+30 speed',
      up_range_name: 'Long Arm', up_range_desc: '+25% range',
      up_doublejump_name: 'Double Jump', up_doublejump_desc: 'Jump twice',
      up_dash_name: 'Dash', up_dash_desc: 'Shift to dash',
      up_hammer_name: 'Earwax Hammer', up_hammer_desc: 'Area weapon\n+6 damage',
      up_spread_name: 'Spread Jet', up_spread_desc: 'Jet fires 3 pellets',
      up_pierce_name: 'Piercing Jet', up_pierce_desc: 'Pellets pass through',
      up_lifesteal_name: 'Lifesteal', up_lifesteal_desc: 'Kills heal you',
      up_shield_name: 'Soap Shield', up_shield_desc: 'Blocks a hit\nevery 6s',
      up_magnet_name: 'Wax Magnet', up_magnet_desc: 'Wax flies\nto you',
      up_blast_name: 'Shockwave', up_blast_desc: 'Melee hits\nall around',
      up_splash_name: 'Soap Burst', up_splash_desc: 'Jet splashes\non impact',
      // --- Abilita (lista HUD) + armi ---
      ability_doublejump: 'double jump',
      ability_dash: 'dash',
      ability_hammer: 'hammer',
      ability_magnet: 'magnet',
      ability_blast: 'shockwave',
      ability_splash: 'soap burst',
      weapon_swab: 'Cotton Swab',
      weapon_hammer: 'Earwax Hammer',
    },

    it: {
      // --- Menu ---
      menu_subtitle: 'La Guerra del Cerume',
      menu_bank: 'Cerume in banca: {bank}      Miglior livello: {best}',
      menu_ctrl_title: 'COMANDI',
      menu_ctrl_move: 'Muoviti:  A / D  o  Sx/Dx',
      menu_ctrl_jump: 'Salta:    Spazio     Mira: Su/Giu',
      menu_ctrl_attack: 'Spruzza:  J  o tieni il clic',
      menu_ctrl_dash: 'Scatto:   Shift  (se sbloccato)',
      menu_ctrl_touch: 'Su telefono: pulsanti a schermo (coton fioc auto)',
      menu_goal_1: 'Pulisci il cerume lungo il condotto col getto di sapone, poi raggiungi il timpano.',
      menu_goal_2: 'A fine livello sblocchi una nuova abilita o arma.',
      menu_start: 'INIZIA RUN',
      menu_shop: 'NEGOZIO (N)',
      menu_lang: 'Lingua: {lang}',
      // --- HUD ---
      hud_hp: 'HP {hp}/{max}',
      hud_level: 'Livello {n}',
      hud_wall: 'Muro: {left}/{total}',
      hud_goal: 'Timpano: {pct}%',
      hud_clean: 'Pulito: {pct}%',
      hud_wax: 'Cerume: {n}',
      hud_abilities: 'Abilita: {list}',
      // --- Banner di gioco ---
      game_boss_in: '!  ARRIVA IL TAPPO DI CERUME  !',
      game_swarm_in: 'SCIAME IN ARRIVO!',
      game_goal: 'PULISCI IL CONDOTTO!',
      game_clean_more: 'PULISCI ANCORA!  (serve {pct}%)',
      game_boss_guard: 'SCONFIGGI IL TAPPO DI CERUME PER PASSARE!',
      game_boss_dead: 'TAPPO DI CERUME DISTRUTTO!  +{wax}',
      game_boss_enrage: 'IL TAPPO DI CERUME SI E\' INFURIATO!',
      // --- Livello completato ---
      done_title: 'LIVELLO {n} COMPLETATO!',
      done_sub: 'Condotto ripulito!',
      // --- Game over ---
      over_title: 'SOPRAFFATTO DAL CERUME',
      over_level: 'Run terminata al livello {n}',
      over_banked: 'Cerume incassato: +{earned}   (in banca: {bank})',
      over_newrun: 'NUOVA RUN',
      over_shop: 'NEGOZIO',
      over_menu: 'MENU',
      // --- Negozio ---
      shop_title: 'NEGOZIO DEL CERUME',
      shop_bank: 'Cerume in banca: {bank}   |   Miglior livello: {best}',
      shop_lv: 'Liv. {lv}/{max}',
      shop_owned: 'Acquistato',
      shop_notowned: 'Non posseduto',
      shop_max: 'MAX',
      shop_buy: 'COMPRA\n{cost}',
      shop_need: '{cost} cerume',
      shop_back: 'INDIETRO (ESC)',
      unlock_hp_name: 'Cuore Extra',
      unlock_hp_eff: '+{n} HP a inizio run',
      unlock_dmg_name: 'Lama Affilata',
      unlock_dmg_eff: '+{n} danno a inizio run',
      unlock_speed_name: 'Stivali Molla',
      unlock_speed_eff: '+{n} velocita a inizio run',
      unlock_djump_name: 'Doppio Salto Innato',
      unlock_djump_eff: 'Inizi ogni run col doppio salto',
      // Progetti (blueprint): sblocchi che aggiungono abilità nuove alle run
      shop_stats_title: 'POTENZIAMENTI',
      shop_bp_title: 'PROGETTI',
      shop_bp_hint: 'Sblocca nuove abilità per le tue run',
      shop_bp_done: 'SBLOCCATO',
      shop_unlock: 'SBLOCCA\n{cost}',
      bp_magnet_name: 'Calamita', bp_magnet_desc: 'Attira il cerume vicino',
      bp_blast_name: "Onda d'Urto", bp_blast_desc: 'La mazza colpisce intorno',
      bp_splash_name: 'Scoppio di Sapone', bp_splash_desc: "Il getto scoppia all'impatto",
      // --- Pausa ---
      pause_title: 'PAUSA',
      pause_hint: 'ESC o P per riprendere',
      pause_resume: 'RIPRENDI',
      pause_restart: 'RIAVVIA LIVELLO',
      pause_menu: 'MENU PRINCIPALE',
      // --- Potenziamento (a fine livello) ---
      up_title: 'POTENZIAMENTO',
      up_hint: 'Scegli una nuova abilita o arma (1 / 2 / 3 o click)',
      up_ability_tag: '★ ABILITA',
      up_stat_wax: 'Cerume raccolto: {wax}',
      up_stat_line: 'Danno: {dmg}   HP max: {hp}   Velocita: {spd}',
      up_stat_weapon: 'Arma: {weapon}',
      up_damage_name: 'Affilatura', up_damage_desc: '+8 danno',
      up_hp_name: 'Fibra Extra', up_hp_desc: '+25 HP max\n(e cura completa)',
      up_attspd_name: 'Riflessi', up_attspd_desc: 'Attacco piu rapido',
      up_speed_name: 'Stivali Veloci', up_speed_desc: '+30 velocita',
      up_range_name: 'Braccio Lungo', up_range_desc: '+25% portata',
      up_doublejump_name: 'Salto Doppio', up_doublejump_desc: 'Salta due volte',
      up_dash_name: 'Scatto', up_dash_desc: 'Shift per scattare',
      up_hammer_name: 'Martello di Cerume', up_hammer_desc: 'Arma ad area\n+6 danno',
      up_spread_name: 'Getto a Ventaglio', up_spread_desc: 'Il getto spara 3 palline',
      up_pierce_name: 'Getto Perforante', up_pierce_desc: 'Le palline attraversano',
      up_lifesteal_name: 'Vita Rubata', up_lifesteal_desc: 'Uccidere ti cura',
      up_shield_name: 'Scudo di Sapone', up_shield_desc: 'Para un colpo\nogni 6s',
      up_magnet_name: 'Calamita', up_magnet_desc: 'Il cerume vola\nverso di te',
      up_blast_name: "Onda d'Urto", up_blast_desc: 'La mazza colpisce\ntutto intorno',
      up_splash_name: 'Scoppio di Sapone', up_splash_desc: "Il getto scoppia\nall'impatto",
      // --- Abilita (lista HUD) + armi ---
      ability_doublejump: 'salto doppio',
      ability_dash: 'scatto',
      ability_hammer: 'martello',
      ability_magnet: 'calamita',
      ability_blast: "onda d'urto",
      ability_splash: 'scoppio',
      weapon_swab: 'Cotton fioc',
      weapon_hammer: 'Martello di Cerume',
    },
  };

  let lang = (function () {
    try { const s = window.localStorage.getItem(KEY); if (s && STRINGS[s]) return s; } catch (e) { /* niente */ }
    return 'en';
  })();

  // Sostituisce i segnaposto {nome} con i valori passati.
  function fmt(str, params) {
    if (!params) return str;
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return (params[k] !== undefined && params[k] !== null) ? params[k] : m;
    });
  }

  return {
    get lang() { return lang; },
    list() { return ORDER.slice(); },
    nativeName(code) { return NATIVE[code] || code; },

    // Traduce una chiave nella lingua corrente (fallback: inglese, poi la chiave).
    t(key, params) {
      const table = STRINGS[lang] || STRINGS.en;
      let s = table[key];
      if (s === undefined) s = STRINGS.en[key];
      if (s === undefined) s = key;
      return fmt(s, params);
    },

    setLang(code) {
      if (!STRINGS[code]) return;
      lang = code;
      try { window.localStorage.setItem(KEY, code); } catch (e) { /* niente */ }
    },

    // Passa alla lingua successiva del ciclo e la restituisce.
    next() {
      const i = ORDER.indexOf(lang);
      this.setLang(ORDER[(i + 1) % ORDER.length]);
      return lang;
    },
  };
})();
