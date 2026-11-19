# Arcano AI

Home ("Entra") -> 5 domande -> foto + consenso -> carta dei tarocchi personalizzata con QR -> video animato.

- Illustrazione: Leonardo Nano Banana 2 (stessa chiave dell'app inviti), formato 4:5, senza testo
- Carta: fondo, cornici, nome, frase e QR composti dal server (template.js), identici per tutti
- Video: Kling 3.0 via Leonardo sull'illustrazione, parte in automatico; nella pagina copre solo il riquadro
- QR: apre /c/<id> con carta e video

## Variabili su Render
- LEONARDO_API_KEY (obbligatoria)
- Facoltative: LEONARDO_MODEL, VIDEO_MODEL, VIDEO_DURATION (default 5), VIDEO_MODE (RESOLUTION_720 / RESOLUTION_1080), PUBLIC_URL

## Note
- Archetipi, domande e frasi brevi sono in arcani.js; layout della carta in template.js
- Font: Cinzel e Cormorant Garamond (licenza SIL Open Font License), nella cartella fonts/
- Le carte sono salvate nella cartella data/ del server: sul piano Free di Render si cancellano a ogni riavvio o nuovo deploy. Va bene per i test.
