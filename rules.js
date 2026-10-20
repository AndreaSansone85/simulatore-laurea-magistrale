/*
 * Regole di calcolo del voto di laurea.
 * Nessuna dipendenza dal DOM: si può usare nel browser (window.Regole) e in Node (require).
 *
 * Schema del calcolo
 *   base      = media * scala / mediaMax              (30 -> 110, 27 -> 99, 24 -> 88)
 *   bonus     = in corso + lodi (a fasce) + Erasmus
 *   tesi      = elaborato + discussione
 *   totale    = base + bonus + tesi
 *   voto      = min(totale arrotondato, tetto)
 *   lode      = proponibile se una regola di lode è soddisfatta (la decisione resta della commissione)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Regole = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-9;
  const MEDIA_MINIMA = 18;
  const nfIt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  const fmt = (x) => nfIt.format(x);

  function configPredefinita() {
    return {
      scala: 110,
      mediaMax: 30,
      tetto: 110,
      arrotondamento: 'nearest', // 'nearest' | 'up' | 'none'
      bonus: {
        inCorso: 1,
        erasmus: 1,
        // fasce: dal numero di lodi indicato in su si ottengono i punti indicati
        lodi: [
          { min: 3, punti: 1 },
          { min: 6, punti: 2 }
        ]
      },
      tesi: { elaborato: 5, discussione: 3 },
      regoleLode: [
        {
          id: 'automatica',
          nome: 'Automatica',
          soglia: 110,
          richiediInCorso: true,
          quotaTesiMinima: 100,
          mediaMinima: 0
        },
        {
          id: 'soglia113',
          nome: 'Soglia 113',
          soglia: 113,
          richiediInCorso: false,
          quotaTesiMinima: 0,
          mediaMinima: 0
        },
        {
          id: 'soglia115',
          nome: 'Soglia 115',
          soglia: 115,
          richiediInCorso: false,
          quotaTesiMinima: 0,
          mediaMinima: 0
        },
        {
          id: 'personalizzata',
          nome: 'Personalizzata',
          soglia: 113,
          richiediInCorso: true,
          quotaTesiMinima: 0,
          mediaMinima: 0
        }
      ]
    };
  }

  function clamp(x, a, b) {
    return Math.min(b, Math.max(a, x));
  }

  function num(x, fallback) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  function arrotonda(x, modo) {
    if (modo === 'none') return x;
    if (modo === 'up') return Math.ceil(x - EPS);
    return Math.floor(x + 0.5 + EPS);
  }

  function puntiLodi(cfg, lodi) {
    const fasce = cfg.bonus.lodi.slice().sort((a, b) => a.min - b.min);
    let punti = 0;
    for (const f of fasce) if (lodi >= f.min) punti = f.punti;
    return punti;
  }

  function massimo(cfg) {
    const maxLodi = cfg.bonus.lodi.reduce((m, f) => Math.max(m, f.punti), 0);
    return cfg.scala + cfg.bonus.inCorso + cfg.bonus.erasmus + maxLodi + cfg.tesi.elaborato + cfg.tesi.discussione;
  }

  function minimoScala(cfg) {
    return (MEDIA_MINIMA * cfg.scala) / cfg.mediaMax;
  }

  function calcola(cfg, s) {
    const media = clamp(num(s.media, MEDIA_MINIMA), MEDIA_MINIMA, cfg.mediaMax);
    const base = (media * cfg.scala) / cfg.mediaMax;
    const bonusInCorso = s.inCorso ? cfg.bonus.inCorso : 0;
    const bonusLodi = puntiLodi(cfg, num(s.lodi, 0));
    const bonusErasmus = s.erasmus ? cfg.bonus.erasmus : 0;
    const elaborato = clamp(num(s.elaborato, 0), 0, cfg.tesi.elaborato);
    const discussione = clamp(num(s.discussione, 0), 0, cfg.tesi.discussione);
    const puntiTesi = elaborato + discussione;
    const bonus = bonusInCorso + bonusLodi + bonusErasmus;
    const totale = base + bonus + puntiTesi;
    const totaleArr = arrotonda(totale, cfg.arrotondamento);
    const voto = Math.min(totaleArr, cfg.tetto);
    return {
      media,
      base,
      bonusInCorso,
      bonusLodi,
      bonusErasmus,
      bonus,
      elaborato,
      discussione,
      puntiTesi,
      totale,
      totaleArr,
      voto,
      oltreTetto: totaleArr > cfg.tetto + EPS
    };
  }

  function sogliaEffettiva(cfg, regola) {
    return Math.max(regola.soglia, cfg.tetto);
  }

  function minimoTesi(cfg, regola) {
    return (regola.quotaTesiMinima / 100) * (cfg.tesi.elaborato + cfg.tesi.discussione);
  }

  function lodeRapida(cfg, regola, s, r) {
    if (r.totaleArr + EPS < sogliaEffettiva(cfg, regola)) return false;
    if (regola.richiediInCorso && !s.inCorso) return false;
    if (r.puntiTesi + EPS < minimoTesi(cfg, regola)) return false;
    if (regola.mediaMinima > 0 && r.media + EPS < regola.mediaMinima) return false;
    return true;
  }

  function criteriLode(cfg, regola, s, r) {
    const soglia = sogliaEffettiva(cfg, regola);
    const criteri = [
      {
        chiave: 'totale',
        ok: r.totaleArr + EPS >= soglia,
        testo: 'Totale ' + fmt(r.totaleArr) + ' (richiesto almeno ' + fmt(soglia) + ')'
      }
    ];
    if (regola.richiediInCorso) {
      criteri.push({
        chiave: 'inCorso',
        ok: !!s.inCorso,
        testo: s.inCorso ? 'Laurea in corso' : 'Laurea non in corso'
      });
    }
    const minTesi = minimoTesi(cfg, regola);
    if (minTesi > 0) {
      criteri.push({
        chiave: 'tesi',
        ok: r.puntiTesi + EPS >= minTesi,
        testo:
          'Punti tesi ' + fmt(r.puntiTesi) + ' (richiesti almeno ' + fmt(minTesi) +
          ' su ' + fmt(cfg.tesi.elaborato + cfg.tesi.discussione) + ')'
      });
    }
    if (regola.mediaMinima > 0) {
      criteri.push({
        chiave: 'media',
        ok: r.media + EPS >= regola.mediaMinima,
        testo: 'Media ' + fmt(r.media) + ' (richiesta almeno ' + fmt(regola.mediaMinima) + ')'
      });
    }
    return criteri;
  }

  function valutaLode(cfg, regola, s, r) {
    const criteri = criteriLode(cfg, regola, s, r);
    return { proponibile: criteri.every((c) => c.ok), criteri };
  }

  function descriviRegola(cfg, regola) {
    const parti = ['totale almeno ' + fmt(sogliaEffettiva(cfg, regola))];
    if (regola.richiediInCorso) parti.push('laurea in corso');
    const minTesi = minimoTesi(cfg, regola);
    if (minTesi > 0) {
      parti.push(
        'punti tesi almeno ' + fmt(minTesi) + ' su ' + fmt(cfg.tesi.elaborato + cfg.tesi.discussione)
      );
    }
    if (regola.mediaMinima > 0) parti.push('media almeno ' + fmt(regola.mediaMinima));
    const testo = parti.join(', ');
    return testo.charAt(0).toUpperCase() + testo.slice(1);
  }

  /* ---------- Griglia di profili per cercare le incoerenze ---------- */

  function valoriTesi(max) {
    const v = [];
    for (let x = 0; x < max - EPS; x += 1) v.push(x);
    v.push(max);
    return v;
  }

  function profili(cfg) {
    const medie = [];
    for (let m = MEDIA_MINIMA; m <= cfg.mediaMax + EPS; m += 0.25) medie.push(Math.min(m, cfg.mediaMax));
    const lodi = [0].concat(cfg.bonus.lodi.map((f) => f.min));
    const elab = valoriTesi(cfg.tesi.elaborato);
    const disc = valoriTesi(cfg.tesi.discussione);
    const lista = [];
    for (const media of medie) {
      for (const inCorso of [false, true]) {
        for (const nl of lodi) {
          for (const erasmus of [false, true]) {
            for (const e of elab) {
              for (const d of disc) {
                const s = { media, inCorso, lodi: nl, erasmus, elaborato: e, discussione: d };
                lista.push({ s, r: calcola(cfg, s) });
              }
            }
          }
        }
      }
    }
    return lista;
  }

  /*
   * Una regola è incoerente se esiste un profilo senza lode con un totale più alto
   * del totale più basso che ottiene la lode.
   */
  function analisiCoerenza(cfg, regola, lista) {
    let conLode = 0;
    let minLode = null;
    for (const p of lista) {
      if (lodeRapida(cfg, regola, p.s, p.r)) {
        conLode++;
        if (!minLode || p.r.totaleArr < minLode.r.totaleArr) minLode = p;
      }
    }
    const esito = {
      profili: lista.length,
      conLode,
      penalizzati: 0,
      cause: { tesi: 0, inCorso: 0, media: 0 },
      esempi: [],
      minTotaleLode: minLode ? minLode.r.totaleArr : null,
      coerente: true
    };
    if (!minLode) return esito;

    const migliori = {};
    for (const p of lista) {
      if (p.r.totaleArr <= minLode.r.totaleArr + EPS) continue;
      if (lodeRapida(cfg, regola, p.s, p.r)) continue;
      esito.penalizzati++;
      const falliti = criteriLode(cfg, regola, p.s, p.r)
        .filter((c) => !c.ok)
        .map((c) => c.chiave);
      for (const k of falliti) if (k in esito.cause) esito.cause[k]++;
      if (falliti.length === 1 && falliti[0] in esito.cause) {
        const k = falliti[0];
        if (!migliori[k] || p.r.totaleArr > migliori[k].r.totaleArr) migliori[k] = p;
      }
    }
    for (const k of ['tesi', 'inCorso', 'media']) {
      if (migliori[k]) esito.esempi.push({ causa: k, senza: migliori[k], con: minLode });
    }
    esito.coerente = esito.penalizzati === 0;
    return esito;
  }

  /* ---------- Coorte: lettura di dati incollati e dati di esempio ---------- */

  function siNo(v) {
    return /^(1|si|sì|s|true|vero|y|yes|x)$/i.test(String(v).trim());
  }

  function nomeColonna(c) {
    const n = String(c).toLowerCase().replace(/[^a-z]/g, '');
    if (n === 'media') return 'media';
    if (n === 'incorso' || n === 'regolare' || n === 'inregola') return 'inCorso';
    if (n === 'lodi' || n === 'lode') return 'lodi';
    if (n === 'erasmus') return 'erasmus';
    if (n === 'elaborato' || n === 'tesi') return 'elaborato';
    if (n === 'discussione') return 'discussione';
    return null;
  }

  function leggiCoorte(testo, cfg) {
    const studenti = [];
    const errori = [];
    const righe = String(testo || '')
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (!righe.length) return { studenti, errori };

    const sep = righe[0].indexOf('\t') >= 0 ? '\t' : righe[0].indexOf(';') >= 0 ? ';' : ',';
    const virgolaDecimale = sep !== ',';
    const idx = { media: 0, inCorso: 1, lodi: 2, erasmus: 3, elaborato: 4, discussione: 5 };
    let inizio = 0;
    const prima = righe[0].split(sep).map((c) => c.trim());
    if (prima.some((c) => /[a-zA-Z]/.test(c))) {
      inizio = 1;
      prima.forEach((c, i) => {
        const k = nomeColonna(c);
        if (k) idx[k] = i;
      });
    }
    const numero = (v) => {
      const t = virgolaDecimale ? String(v).replace(',', '.') : String(v);
      return t.trim() === '' ? NaN : Number(t);
    };
    for (let i = inizio; i < righe.length; i++) {
      const celle = righe[i].split(sep);
      const media = numero(celle[idx.media]);
      const lodi = numero(celle[idx.lodi]);
      const elaborato = numero(celle[idx.elaborato]);
      const discussione = numero(celle[idx.discussione]);
      const nr = i + 1;
      if (!Number.isFinite(media) || media < MEDIA_MINIMA - EPS || media > cfg.mediaMax + EPS) {
        errori.push('Riga ' + nr + ': media non valida (attesa tra ' + MEDIA_MINIMA + ' e ' + cfg.mediaMax + ').');
        continue;
      }
      if (!Number.isFinite(lodi) || lodi < 0) {
        errori.push('Riga ' + nr + ': numero di lodi non valido.');
        continue;
      }
      if (!Number.isFinite(elaborato) || !Number.isFinite(discussione)) {
        errori.push('Riga ' + nr + ': punti di elaborato o discussione mancanti.');
        continue;
      }
      studenti.push({
        media,
        inCorso: siNo(celle[idx.inCorso] || ''),
        lodi,
        erasmus: siNo(celle[idx.erasmus] || ''),
        elaborato,
        discussione
      });
    }
    return { studenti, errori };
  }

  function generatore(seme) {
    let a = seme >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function esempioCsv(n, seme, cfg) {
    const rnd = generatore(seme);
    const normale = () => {
      const u = Math.max(rnd(), 1e-12);
      const v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const mezzi = (x, max) => clamp(Math.round(x * 2) / 2, 0, max);
    const righe = ['media,in_corso,lodi,erasmus,elaborato,discussione'];
    for (let i = 0; i < n; i++) {
      const media = Math.round(clamp(27.6 + 1.7 * normale(), 21, cfg.mediaMax) * 100) / 100;
      const livello = (media - 23) / 7;
      const lodi = Math.max(0, Math.round((media - 26) * 1.6 + normale() * 1.2));
      const inCorso = rnd() < 0.72 ? 1 : 0;
      const erasmus = rnd() < 0.18 ? 1 : 0;
      const elaborato = mezzi(livello * cfg.tesi.elaborato + normale() * 0.7, cfg.tesi.elaborato);
      const discussione = mezzi(0.5 * livello * cfg.tesi.discussione + 1.2 + normale() * 0.5, cfg.tesi.discussione);
      righe.push([media, inCorso, lodi, erasmus, elaborato, discussione].join(','));
    }
    return righe.join('\n');
  }

  /* ---------- Configurazione: controllo e modifica ---------- */

  function impostaPercorso(obj, percorso, valore) {
    const chiavi = percorso.split('.');
    let o = obj;
    for (let i = 0; i < chiavi.length - 1; i++) o = o[chiavi[i]];
    o[chiavi[chiavi.length - 1]] = valore;
  }

  function normalizza(entrata) {
    if (!entrata || typeof entrata !== 'object') throw new Error('La configurazione deve essere un oggetto JSON.');
    const pre = configPredefinita();
    const c = JSON.parse(JSON.stringify(entrata));
    const positivo = (v, nome) => {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new Error('Il campo "' + nome + '" deve essere un numero maggiore di zero.');
    };
    const nonNeg = (v, nome) => {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('Il campo "' + nome + '" deve essere un numero maggiore o uguale a zero.');
    };
    c.scala = c.scala === undefined ? pre.scala : c.scala;
    c.mediaMax = c.mediaMax === undefined ? pre.mediaMax : c.mediaMax;
    c.tetto = c.tetto === undefined ? pre.tetto : c.tetto;
    c.arrotondamento = c.arrotondamento === undefined ? pre.arrotondamento : c.arrotondamento;
    c.bonus = Object.assign({}, pre.bonus, c.bonus || {});
    c.tesi = Object.assign({}, pre.tesi, c.tesi || {});
    c.regoleLode = c.regoleLode === undefined ? pre.regoleLode : c.regoleLode;

    positivo(c.scala, 'scala');
    positivo(c.tetto, 'tetto');
    if (typeof c.mediaMax !== 'number' || !(c.mediaMax > MEDIA_MINIMA)) {
      throw new Error('Il campo "mediaMax" deve essere un numero maggiore di ' + MEDIA_MINIMA + '.');
    }
    if (['nearest', 'up', 'none'].indexOf(c.arrotondamento) < 0) {
      throw new Error('Il campo "arrotondamento" deve essere "nearest", "up" o "none".');
    }
    nonNeg(c.bonus.inCorso, 'bonus.inCorso');
    nonNeg(c.bonus.erasmus, 'bonus.erasmus');
    if (!Array.isArray(c.bonus.lodi) || !c.bonus.lodi.length) throw new Error('Il campo "bonus.lodi" deve contenere almeno una fascia.');
    c.bonus.lodi.forEach((f, i) => {
      nonNeg(f && f.min, 'bonus.lodi[' + i + '].min');
      nonNeg(f && f.punti, 'bonus.lodi[' + i + '].punti');
    });
    nonNeg(c.tesi.elaborato, 'tesi.elaborato');
    nonNeg(c.tesi.discussione, 'tesi.discussione');
    if (!Array.isArray(c.regoleLode) || c.regoleLode.length < 1 || c.regoleLode.length > 8) {
      throw new Error('Servono da 1 a 8 regole per la lode.');
    }
    const visti = {};
    c.regoleLode = c.regoleLode.map((r, i) => {
      const regola = Object.assign({ richiediInCorso: false, quotaTesiMinima: 0, mediaMinima: 0 }, r);
      if (typeof regola.id !== 'string' || !regola.id) throw new Error('La regola ' + (i + 1) + ' non ha un "id".');
      if (visti[regola.id]) throw new Error('L\'id "' + regola.id + '" è usato due volte.');
      visti[regola.id] = true;
      if (typeof regola.nome !== 'string' || !regola.nome) regola.nome = regola.id;
      positivo(regola.soglia, 'regoleLode[' + i + '].soglia');
      nonNeg(regola.quotaTesiMinima, 'regoleLode[' + i + '].quotaTesiMinima');
      nonNeg(regola.mediaMinima, 'regoleLode[' + i + '].mediaMinima');
      regola.richiediInCorso = !!regola.richiediInCorso;
      return regola;
    });
    return c;
  }

  return {
    MEDIA_MINIMA,
    configPredefinita,
    arrotonda,
    puntiLodi,
    massimo,
    minimoScala,
    calcola,
    sogliaEffettiva,
    minimoTesi,
    lodeRapida,
    criteriLode,
    valutaLode,
    descriviRegola,
    profili,
    analisiCoerenza,
    leggiCoorte,
    esempioCsv,
    impostaPercorso,
    normalizza
  };
});
