# Simulatore del voto di laurea

Strumento per confrontare le regole di calcolo del voto di laurea magistrale e le ipotesi per la proposta di lode. Funziona interamente nel browser e non usa dipendenze.

## Regole implementate

- **Punteggio di partenza**: la media in trentesimi è riportata in centodecimi (30 diventa 110, 27 diventa 99, 24 diventa 88).
- **Bonus**: 1 punto per la laurea in corso, 1 punto per l'Erasmus, lodi a fasce (0-2 lodi nessun punto, 3-5 un punto, 6 o più due punti).
- **Tesi**: fino a 5 punti per l'elaborato e fino a 3 per la discussione.
- **Tetto**: il voto finale non supera 110. Sopra il tetto si valuta la lode.
- **Lode**: ogni regola è una combinazione di soglia sul totale, laurea in corso richiesta o no, quota minima dei punti tesi e media minima. Le quattro regole iniziali sono:
  - A, automatica: totale almeno 110, in corso, tesi al massimo.
  - B, soglia 113 sul totale, qualunque ne sia l'origine.
  - C, soglia 115 sul totale.
  - D, personalizzabile.

Tutti i valori si cambiano dal pannello "Modifica le regole" sotto la mappa.

## Come si usa

La pagina è una sola mappa: ogni cella mostra il voto finale per una media (colonne) e un totale di punti tesi (righe).

- **Regola per la lode** e **passo della media** si scelgono sopra la mappa.
- **Profilo dei bonus**: caselle per laurea in corso, lodi (+1 oppure +2, si escludono a vicenda) ed Erasmus.
- **Regole in uso**: le regole sono riscritte a parole e si aggiornano a ogni modifica.
- **Modifica le regole**: scala, tetto, arrotondamento, bonus, punti tesi e parametri della regola di lode scelta.

Le funzioni di `rules.js` per la coerenza delle regole (`profili`, `analisiCoerenza`) e per la lettura di una coorte (`leggiCoorte`, `esempioCsv`) restano disponibili e testate, anche se l'interfaccia attuale non le usa.

## Struttura dei file

| File | Contenuto |
| --- | --- |
| `rules.js` | Logica di calcolo, senza accesso al DOM. Usabile in Node e nel browser. |
| `app.js` | Interfaccia. |
| `style.css` | Stili e temi chiaro e scuro. |
| `index.html` | Pagina. |
| `test/rules.test.js` | Test della logica. |

## Test

```
npm test
```

I test usano solo Node (versione 18 o successiva).

## Pubblicare su GitHub Pages

Il file `index.html` è scritto come frammento, senza `<!doctype html>`, `<html>`, `<head>` e `<body>`, perché la piattaforma di anteprima aggiunge questa struttura. Per servirlo da solo, racchiudi il contenuto così:

```html
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- qui il contenuto attuale fino a <link rel="stylesheet" href="style.css"> -->
</head>
<body>
  <!-- qui il resto di index.html -->
</body>
</html>
```

Poi attiva GitHub Pages sul ramo principale.

## Dati

Per la scheda Coorte usa solo dati anonimi e privi di identificativi. I dati restano nel browser, ma conviene comunque non incollare nominativi.

## Note aperte

- Il totale viene arrotondato prima del confronto con le soglie (modificabile).
- I punti tesi ammettono mezzi punti.
- La lode resta una decisione della commissione: il simulatore dice solo se i requisiti sono soddisfatti.
