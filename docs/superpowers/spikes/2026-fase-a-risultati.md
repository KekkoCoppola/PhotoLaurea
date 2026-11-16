# Fase A — risultati verifica rischi (2026-11-16)

| Rischio | Esito | Come verificato |
|---|---|---|
| R1 — upload resumable dal browser (CORS) | ✅ desktop · ⏳ telefono | Preflight `OPTIONS` sull'URL di sessione: `Access-Control-Allow-Origin: https://kekkocoppola.github.io`, metodo PUT e header `content-range` ammessi. Dal browser (origine github.io): file da 9 MB caricato in 2 pezzi → 200 con id. |
| R1b — header `Range` leggibile | ⚠️ non garantito | Nella risposta alla query di stato via curl `Range` non compare in `Access-Control-Expose-Headers`; dal browser invece si è letto. `uploadResumable` ora funziona in entrambi i casi (avanza al pezzo successivo dopo un 308; dopo un errore riparte dall'ultimo offset confermato). |
| R1c — pezzi già ricevuti reinviati | ✅ | Drive risponde 308 con lo stesso `Range` e il file finale è corretto: reinviare è innocuo. |
| R2 — condivisione ereditata | ✅ | `drive.google.com/thumbnail?id=…&sz=w400` di un file appena caricato, senza login → `200 image/png`. |
| R3 — miniature a raffica | ⏳ | Da fare con 20+ foto dal telefono; stress vero in Fase D. |
| Script | ✅ | `ping`, `BAD_CODE`, login case-insensitive (stesso folderId per "Test" e "test", codice con spazi/minuscole accettato), `BAD_NAME` per " / ", `BAD_REQUEST` per JSON non valido. |

## Ancora da fare sul campo (Francesco)

- Dal telefono (iPhone Safari e/o Android Chrome), link `https://kekkocoppola.github.io/PhotoLaurea/#LAUREAKEKKO`:
  1. foto singola → miniatura visibile;
  2. 20+ foto insieme → tutte arrivano, miniature visibili;
  3. video da 300 MB o più, attivando la modalità aereo a metà e disattivandola entro 30 s → deve riprendere, non ripartire da zero.

File di prova lasciati su Drive in `Laurea/Test/` (da cancellare quando vuoi).
