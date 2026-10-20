/* Interfaccia del simulatore. La logica di calcolo sta in rules.js (window.Regole). */
(function () {
  'use strict';

  const R = window.Regole;
  const EPS = 1e-9;
  const LETTERE = 'ABCDEFGH';

  const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  const fmt = (x) => nf.format(x);
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arr2 = (x) => Math.round(x * 100) / 100;
  const segno = (n) => (n >= 0 ? '+' : '') + fmt(n);

  const state = {
    cfg: R.configPredefinita(),
    attiva: 'automatica',
    // fascia: indice della fascia di lodi scelta, -1 se nessuna
    profilo: { inCorso: true, erasmus: false, fascia: -1 },
    passo: 0.5
  };

  function regolaAttiva() {
    const lista = state.cfg.regoleLode;
    return lista.find((r) => r.id === state.attiva) || lista[0];
  }

  function indiceAttiva() {
    return state.cfg.regoleLode.indexOf(regolaAttiva());
  }

  function etichetta(i) {
    return LETTERE[i] + ' · ' + state.cfg.regoleLode[i].nome;
  }

  /* ---------- Profilo dei bonus ---------- */

  function costruisciProfilo() {
    const c = state.cfg;
    let h =
      '<label class="check-inline"><input type="checkbox" id="pf-corso"><span id="pf-corso-t"></span></label>';
    c.bonus.lodi.forEach((f, i) => {
      h += '<label class="check-inline"><input type="checkbox" data-fascia="' + i + '"><span data-fascia-t="' + i + '"></span></label>';
    });
    h += '<label class="check-inline"><input type="checkbox" id="pf-erasmus"><span id="pf-erasmus-t"></span></label>';
    $('profilo-campi').innerHTML = h;
    $('profilo-campi').dataset.fasce = String(c.bonus.lodi.length);
  }

  function aggiornaProfilo() {
    const c = state.cfg;
    if ($('profilo-campi').dataset.fasce !== String(c.bonus.lodi.length)) costruisciProfilo();
    $('pf-corso').checked = state.profilo.inCorso;
    $('pf-corso-t').textContent = 'Laurea in corso (' + segno(c.bonus.inCorso) + ')';
    $('pf-erasmus').checked = state.profilo.erasmus;
    $('pf-erasmus-t').textContent = 'Erasmus (' + segno(c.bonus.erasmus) + ')';
    c.bonus.lodi.forEach((f, i) => {
      document.querySelector('[data-fascia="' + i + '"]').checked = state.profilo.fascia === i;
      document.querySelector('[data-fascia-t="' + i + '"]').textContent =
        'Lodi ' + segno(f.punti) + ' (da ' + fmt(f.min) + ' lodi)';
    });
  }

  function initProfilo() {
    $('profilo-campi').addEventListener('change', (e) => {
      const el = e.target;
      if (el.id === 'pf-corso') state.profilo.inCorso = el.checked;
      else if (el.id === 'pf-erasmus') state.profilo.erasmus = el.checked;
      else if (el.dataset.fascia !== undefined) {
        // le fasce si escludono a vicenda: segnare una toglie l'altra
        state.profilo.fascia = el.checked ? parseInt(el.dataset.fascia, 10) : -1;
      }
      aggiornaProfilo();
      render();
    });
  }

  function profiloCome(media, tesi) {
    const c = state.cfg;
    const elab = Math.min(tesi, c.tesi.elaborato);
    const disc = Math.min(tesi - elab, c.tesi.discussione);
    const f = state.profilo.fascia;
    return {
      media,
      inCorso: state.profilo.inCorso,
      erasmus: state.profilo.erasmus,
      lodi: f >= 0 && c.bonus.lodi[f] ? c.bonus.lodi[f].min : 0,
      elaborato: elab,
      discussione: disc
    };
  }

  /* ---------- Mappa ---------- */

  function popolaSelect() {
    const sel = $('sel-regola');
    sel.innerHTML = state.cfg.regoleLode
      .map((r, i) => '<option value="' + esc(r.id) + '">' + esc(etichetta(i)) + '</option>')
      .join('');
    sel.value = regolaAttiva().id;
  }

  function renderMappa() {
    const cfg = state.cfg;
    const regola = regolaAttiva();
    const passo = state.passo;
    const inizio = Math.max(R.MEDIA_MINIMA, cfg.mediaMax - 6);
    const medie = [];
    for (let m = inizio; m <= cfg.mediaMax + EPS; m += passo) medie.push(arr2(Math.min(m, cfg.mediaMax)));

    const tmax = cfg.tesi.elaborato + cfg.tesi.discussione;
    const righe = [];
    for (let t = tmax; t >= -EPS; t -= 1) righe.push(arr2(Math.max(t, 0)));
    if (righe[righe.length - 1] > EPS) righe.push(0);

    const minimo = R.minimoScala(cfg);
    let html = '<table class="heat"><thead><tr><th scope="col" class="angolo">Punti tesi \\ Media</th>';
    medie.forEach((m) => {
      const intero = Math.abs(m - Math.round(m)) < EPS;
      html += '<th scope="col" title="Media ' + fmt(m) + '">' + (intero ? fmt(m) : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    righe.forEach((t) => {
      html += '<tr><th scope="row">' + fmt(t) + '</th>';
      medie.forEach((m) => {
        const prof = profiloCome(m, t);
        const rr = R.calcola(cfg, prof);
        const ok = R.lodeRapida(cfg, regola, prof, rr);
        const cls = ok ? 'lode' : rr.voto >= cfg.tetto - EPS ? 'p110' : '';
        let stile = '';
        if (!ok && rr.voto < cfg.tetto - EPS) {
          const p = 6 + 30 * Math.max(0, Math.min(1, (rr.voto - minimo) / (cfg.tetto - minimo)));
          stile = ' style="background:color-mix(in srgb, var(--c-base) ' + p.toFixed(1) + '%, var(--surface))"';
        }
        const titolo =
          'Media ' + fmt(m) + ', tesi ' + fmt(t) + ': totale ' + fmt(rr.totale) + ', voto ' + fmt(rr.voto) + (ok ? ' e lode' : '');
        html += '<td' + (cls ? ' class="' + cls + '"' : '') + stile + ' title="' + esc(titolo) + '">' + (ok ? 'L' : fmt(rr.voto)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    $('mappa-griglia').innerHTML = html;
    $('mappa-legenda').innerHTML =
      '<li><span class="sw sotto"></span>Voto sotto il tetto</li>' +
      '<li><span class="sw p110"></span>' + fmt(cfg.tetto) + ' senza lode</li>' +
      '<li><span class="sw lode"></span>L: lode proponibile</li>';
  }

  /* ---------- Regole spiegate a parole ---------- */

  function renderTesto() {
    const c = state.cfg;
    const regola = regolaAttiva();
    const zero = { inCorso: false, erasmus: false, lodi: 0, elaborato: 0, discussione: 0 };
    const esempi = [30, 27, 24]
      .filter((m) => m <= c.mediaMax)
      .map((m) => fmt(m) + ' diventa ' + fmt(R.calcola(c, Object.assign({ media: m }, zero)).base));
    const fasce = c.bonus.lodi.slice().sort((a, b) => a.min - b.min);
    const testoLodi =
      'meno di ' + fmt(fasce[0].min) + ' lodi nessun punto, ' +
      fasce.map((f) => 'da ' + fmt(f.min) + ' lodi ' + segno(f.punti)).join(', ');
    const arrot = { nearest: 'al numero intero più vicino (da .5 in su)', up: 'sempre per eccesso', none: 'senza arrotondamento' }[c.arrotondamento];
    const tesiMax = c.tesi.elaborato + c.tesi.discussione;
    const voci = [
      [
        'Punteggio di partenza',
        'La media in trentesimi è riportata su ' + fmt(c.scala) + ' con la formula media × ' + fmt(c.scala) + ' / ' + fmt(c.mediaMax) +
          '. Esempi: ' + esempi.join(', ') + '.'
      ],
      [
        'Bonus',
        'Laurea in corso ' + segno(c.bonus.inCorso) + '. Erasmus ' + segno(c.bonus.erasmus) + '. Lodi: ' + testoLodi + '.'
      ],
      [
        'Tesi',
        'Elaborato fino a ' + fmt(c.tesi.elaborato) + ' punti, discussione fino a ' + fmt(c.tesi.discussione) +
          ', in tutto fino a ' + fmt(tesiMax) + '. Le righe della mappa sono il totale dei punti tesi.'
      ],
      [
        'Totale e voto',
        'Il totale è punteggio di partenza più bonus più punti tesi, arrotondato ' + arrot + '. Il voto finale non supera ' +
          fmt(c.tetto) + '. Il massimo teorico del totale è ' + fmt(R.massimo(c)) + '.'
      ],
      [
        'Lode, regola ' + etichetta(indiceAttiva()),
        R.descriviRegola(c, regola) + '.' +
          (regola.soglia < c.tetto ? ' La soglia è portata al tetto di ' + fmt(c.tetto) + '.' : '') +
          ' La lode resta una decisione della commissione: la mappa segna L quando i requisiti sono soddisfatti.'
      ]
    ];
    $('regole-testo').innerHTML =
      '<dl class="regole-lista">' +
      voci.map((v) => '<div><dt>' + esc(v[0]) + '</dt><dd>' + esc(v[1]) + '</dd></div>').join('') +
      '</dl>';
  }

  /* ---------- Modifica delle regole ---------- */

  function campoNum(etichettaCampo, percorso, valore, opzioni) {
    const o = opzioni || {};
    return (
      '<label class="f"><span>' + etichettaCampo + '</span><input type="number" data-path="' + percorso + '" value="' + valore +
      '" step="' + (o.step || 1) + '" min="' + (o.min === undefined ? 0 : o.min) + '"' + (o.max !== undefined ? ' max="' + o.max + '"' : '') +
      ' inputmode="decimal">' + (o.nota ? '<small>' + o.nota + '</small>' : '') + '</label>'
    );
  }

  function costruisciFormRegole() {
    const c = state.cfg;
    const i = indiceAttiva();
    const r = c.regoleLode[i];
    const p = 'regoleLode.' + i + '.';
    let h = '<h2>Modifica le regole</h2>';

    h += '<fieldset><legend>Punteggio</legend><div class="grid-campi">';
    h += campoNum('Scala di arrivo', 'scala', c.scala);
    h += campoNum('Media massima', 'mediaMax', c.mediaMax, { min: 19 });
    h += campoNum('Tetto del voto', 'tetto', c.tetto);
    h +=
      '<label class="f"><span>Arrotondamento del totale</span><select data-path="arrotondamento">' +
      [['nearest', 'Al più vicino (da .5 in su)'], ['up', 'Sempre per eccesso'], ['none', 'Nessuno']]
        .map((o) => '<option value="' + o[0] + '"' + (c.arrotondamento === o[0] ? ' selected' : '') + '>' + o[1] + '</option>')
        .join('') +
      '</select></label>';
    h += '</div></fieldset>';

    h += '<fieldset><legend>Bonus</legend><div class="grid-campi">';
    h += campoNum('Laurea in corso (punti)', 'bonus.inCorso', c.bonus.inCorso, { step: 0.5 });
    h += campoNum('Erasmus (punti)', 'bonus.erasmus', c.bonus.erasmus, { step: 0.5 });
    c.bonus.lodi.forEach((f, k) => {
      h += campoNum('Fascia lodi ' + (k + 1) + ': da quante lodi', 'bonus.lodi.' + k + '.min', f.min);
      h += campoNum('Fascia lodi ' + (k + 1) + ': punti', 'bonus.lodi.' + k + '.punti', f.punti, { step: 0.5 });
    });
    h += '</div></fieldset>';

    h += '<fieldset><legend>Tesi</legend><div class="grid-campi">';
    h += campoNum('Punti massimi elaborato', 'tesi.elaborato', c.tesi.elaborato, { step: 0.5 });
    h += campoNum('Punti massimi discussione', 'tesi.discussione', c.tesi.discussione, { step: 0.5 });
    h += '</div></fieldset>';

    h += '<fieldset><legend>Lode, regola ' + esc(LETTERE[i]) + '</legend><div class="grid-campi">';
    h += '<label class="f"><span>Nome</span><input type="text" data-path="' + p + 'nome" value="' + esc(r.nome) + '"></label>';
    h += campoNum('Soglia sul totale', p + 'soglia', r.soglia, { step: 0.5, nota: 'Mai sotto il tetto del voto.' });
    h += campoNum('Quota minima dei punti tesi (%)', p + 'quotaTesiMinima', r.quotaTesiMinima, { max: 100, nota: '100 vuol dire tesi al massimo, 0 nessun minimo.' });
    h += campoNum('Media minima', p + 'mediaMinima', r.mediaMinima, { step: 0.1, nota: '0 vuol dire nessun minimo.' });
    h += '<label class="f check"><input type="checkbox" data-path="' + p + 'richiediInCorso"' + (r.richiediInCorso ? ' checked' : '') + '><span>Richiedi la laurea in corso</span></label>';
    h += '</div></fieldset>';

    h += '<div class="btn-row"><button type="button" class="btn" id="btn-reset">Ripristina i valori iniziali</button></div>';
    $('form-regole').innerHTML = h;
  }

  function initRegole() {
    const form = $('form-regole');
    const su = (e) => {
      const el = e.target;
      const percorso = el.dataset && el.dataset.path;
      if (!percorso) return;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number') {
        v = parseFloat(el.value);
        if (!Number.isFinite(v)) return;
      } else v = el.value;
      R.impostaPercorso(state.cfg, percorso, v);
      aggiornaProfilo();
      popolaSelect();
      render();
    };
    form.addEventListener('input', su);
    form.addEventListener('change', su);
    form.addEventListener('click', (e) => {
      if (e.target.id !== 'btn-reset') return;
      state.cfg = R.configPredefinita();
      state.attiva = 'automatica';
      state.profilo = { inCorso: true, erasmus: false, fascia: -1 };
      costruisciProfilo();
      aggiornaProfilo();
      popolaSelect();
      costruisciFormRegole();
      render();
    });
    $('sel-regola').addEventListener('change', (e) => {
      state.attiva = e.target.value;
      costruisciFormRegole();
      render();
    });
    $('sel-passo').addEventListener('change', (e) => {
      state.passo = parseFloat(e.target.value);
      render();
    });
  }

  function render() {
    renderMappa();
    renderTesto();
  }

  function avvia() {
    costruisciProfilo();
    initProfilo();
    initRegole();
    popolaSelect();
    $('sel-passo').value = String(state.passo);
    aggiornaProfilo();
    costruisciFormRegole();
    render();
  }

  avvia();
})();
