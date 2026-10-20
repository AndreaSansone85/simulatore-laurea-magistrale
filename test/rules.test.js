'use strict';
const assert = require('node:assert/strict');
const R = require('../rules.js');

let n = 0;
function test(nome, fn) {
  fn();
  n++;
  console.log('ok  ' + nome);
}

const cfg = R.configPredefinita();
const regola = (id) => cfg.regoleLode.find((r) => r.id === id);
const senzaBonus = { inCorso: false, lodi: 0, erasmus: false, elaborato: 0, discussione: 0 };

test('conversione della media in 110imi', () => {
  assert.equal(R.calcola(cfg, { ...senzaBonus, media: 30 }).base, 110);
  assert.equal(R.calcola(cfg, { ...senzaBonus, media: 27 }).base, 99);
  assert.equal(R.calcola(cfg, { ...senzaBonus, media: 24 }).base, 88);
  assert.equal(R.calcola(cfg, { ...senzaBonus, media: 18 }).base, 66);
});

test('bonus per le lodi a fasce', () => {
  assert.equal(R.puntiLodi(cfg, 0), 0);
  assert.equal(R.puntiLodi(cfg, 2), 0);
  assert.equal(R.puntiLodi(cfg, 3), 1);
  assert.equal(R.puntiLodi(cfg, 5), 1);
  assert.equal(R.puntiLodi(cfg, 6), 2);
  assert.equal(R.puntiLodi(cfg, 11), 2);
});

test('il voto non supera il tetto di 110', () => {
  const r = R.calcola(cfg, { media: 30, inCorso: true, lodi: 6, erasmus: true, elaborato: 5, discussione: 3 });
  assert.equal(r.totale, 122);
  assert.equal(r.voto, 110);
  assert.equal(R.massimo(cfg), 122);
});

test('arrotondamento', () => {
  assert.equal(R.arrotonda(104.5, 'nearest'), 105);
  assert.equal(R.arrotonda(104.49, 'nearest'), 104);
  assert.equal(R.arrotonda(104.01, 'up'), 105);
  assert.equal(R.arrotonda(99.00000000000001, 'up'), 99);
  assert.equal(R.arrotonda(104.3, 'none'), 104.3);
});

// Primo caso descritto nella discussione: 109 + 2 + 1 + 1 + 7 = 120
const studenteA = { media: (109 * 30) / 110, inCorso: true, lodi: 6, erasmus: true, elaborato: 4.5, discussione: 2.5 };
// Secondo caso: 101 + 1 + 8 = 110
const studenteB = { media: (101 * 30) / 110, inCorso: true, lodi: 0, erasmus: false, elaborato: 5, discussione: 3 };

test('caso 109 + bonus + tesi 7 = 120', () => {
  const r = R.calcola(cfg, studenteA);
  assert.equal(r.totaleArr, 120);
  assert.equal(R.valutaLode(cfg, regola('automatica'), studenteA, r).proponibile, false);
  assert.equal(R.valutaLode(cfg, regola('soglia113'), studenteA, r).proponibile, true);
  assert.equal(R.valutaLode(cfg, regola('soglia115'), studenteA, r).proponibile, true);
});

test('caso 101 + 1 + tesi 8 = 110', () => {
  const r = R.calcola(cfg, studenteB);
  assert.equal(r.totaleArr, 110);
  assert.equal(R.valutaLode(cfg, regola('automatica'), studenteB, r).proponibile, true);
  assert.equal(R.valutaLode(cfg, regola('soglia113'), studenteB, r).proponibile, false);
});

test('la regola automatica richiede la laurea in corso', () => {
  const s = { ...studenteA, inCorso: false, elaborato: 5, discussione: 3 };
  const r = R.calcola(cfg, s);
  assert.equal(R.lodeRapida(cfg, regola('automatica'), s, r), false);
});

test('la soglia non può scendere sotto il tetto', () => {
  const bassa = { ...regola('soglia113'), soglia: 100 };
  assert.equal(R.sogliaEffettiva(cfg, bassa), 110);
});

test('la regola a soglia semplice è coerente, quella automatica no', () => {
  const lista = R.profili(cfg);
  const soglia = R.analisiCoerenza(cfg, regola('soglia113'), lista);
  const auto = R.analisiCoerenza(cfg, regola('automatica'), lista);
  assert.equal(soglia.coerente, true);
  assert.equal(soglia.penalizzati, 0);
  assert.equal(auto.coerente, false);
  assert.ok(auto.penalizzati > 0);
  assert.ok(auto.esempi.length > 0);
  assert.equal(auto.minTotaleLode, 110);
});

test('lettura di una coorte con separatore punto e virgola e virgola decimale', () => {
  const testo = 'media;in_corso;lodi;erasmus;elaborato;discussione\n28,5;si;4;no;4,5;3\n31;si;0;no;1;1';
  const { studenti, errori } = R.leggiCoorte(testo, cfg);
  assert.equal(studenti.length, 1);
  assert.equal(errori.length, 1);
  assert.equal(studenti[0].media, 28.5);
  assert.equal(studenti[0].inCorso, true);
  assert.equal(studenti[0].elaborato, 4.5);
});

test('lettura di una coorte senza intestazione', () => {
  const { studenti } = R.leggiCoorte('27.5,1,2,0,4,2', cfg);
  assert.equal(studenti.length, 1);
  assert.equal(studenti[0].lodi, 2);
});

test('il generatore di esempio è riproducibile e valido', () => {
  const a = R.esempioCsv(40, 2026, cfg);
  const b = R.esempioCsv(40, 2026, cfg);
  assert.equal(a, b);
  const { studenti, errori } = R.leggiCoorte(a, cfg);
  assert.equal(studenti.length, 40);
  assert.equal(errori.length, 0);
});

test('la normalizzazione rifiuta configurazioni non valide', () => {
  assert.throws(() => R.normalizza({ scala: -1 }));
  assert.throws(() => R.normalizza({ arrotondamento: 'boh' }));
  const ok = R.normalizza(JSON.parse(JSON.stringify(cfg)));
  assert.equal(ok.regoleLode.length, 4);
});

console.log('\n' + n + ' test superati');
