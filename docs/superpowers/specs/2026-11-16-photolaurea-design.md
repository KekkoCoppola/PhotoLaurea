# PhotoLaurea — Design

Data: 2026-11-16
Stato: rivisto, in attesa di approvazione

## 1. Intento

Francesco si laurea e vuole raccogliere in un unico posto tutte le foto e i video che gli amici scattano alla festa. Ogni invitato apre un sito dal telefono, inserisce il proprio nome e carica quanti file vuole. I file finiscono sul Google Drive di Francesco, in una cartella per persona (`Laurea/Paolo/`, `Laurea/Giulia/`…). Nella home il sito mostra anche le foto e i video caricati da tutti gli altri, così la festa diventa un album condiviso.

Vincolo forte: **zero spese** e nessuna carta di credito collegata a servizi a consumo.

## 2. Obiettivi

- Caricamento di molte foto e video in qualità originale, dal telefono, anche su rete mobile instabile (ripresa dei caricamenti interrotti).
- File salvati sul Drive di Francesco (5 TB disponibili) in `Laurea/<Nome>/`.
- Home con: pulsante di caricamento, la "propria cartella" sempre fissata in alto, la galleria di tutti i file (più recenti prima) con lazy loading e filtro per persona.
- Galleria che si aggiorna da sola durante la festa.
- Nessuna credenziale Google nel codice del frontend.

## 3. Non-obiettivi

- UI curata: per ora solo pulsanti e liste/griglie minime. Il design grafico arriverà dopo.
- Login con account (Google o altro) per gli invitati.
- Cancellazione o modifica dei file dal sito (Francesco pulisce da Drive). Vedi §8.
- Compressione dei file prima del caricamento.
- Privacy forte sui singoli file: chi ottiene il link di un file può vederlo (scelta accettata, vedi §5).

## 4. Anti-obiettivi (fallimento anche se "funziona")

- Un token o una chiave di Drive leggibile nel codice del sito.
- Un video da 400 MB che fallisce al 90% su 4G e riparte da zero.
- La galleria che si blocca o va in errore quando 50 persone la aprono insieme.
- Chiunque trovi l'URL possa riempire il Drive di spazzatura (serve il codice evento).
- Servizi che richiedono una carta di credito o che dopo una certa soglia iniziano a costare.

## 5. Vincoli e decisioni di Francesco

- **Hosting frontend:** GitHub Pages.
- **Backend:** Google Apps Script pubblicato come Web App ("Esegui come: me", "Accesso: chiunque"), nell'account di Francesco.
- **Frontend in React.** UI minima.
- **Storage:** Google Drive di Francesco, **account Google personale** (Google One da 5 TB, non Workspace: nessun vincolo da amministratore su Web App pubblica e condivisione con link). Lo spazio non è un problema.
- **Visibilità (opzione A):** la cartella `Laurea/` è condivisa come "chiunque abbia il link può visualizzare". I file ereditano questa condivisione. L'elenco dei file lo fornisce solo lo script, e solo dopo il codice evento. Francesco accetta che il link di un singolo file, una volta copiato, possa girare.
- **Protezione:** codice evento (es. `LAUREA26`) chiesto all'ingresso e verificato **dallo script**, mai nel browser.

## 6. Approcci considerati

| Approccio | Pro | Contro | Esito |
|---|---|---|---|
| **GitHub Pages + Google Apps Script** | Gratis, nessuna carta, nessun progetto Google Cloud, nessun token da conservare; lo script gira con i permessi di Francesco | Cold start 1–2 s; limiti di quota Apps Script (circa 30 esecuzioni contemporanee) da gestire con la cache | **Scelto** |
| Cloudflare Pages + Worker con refresh token Drive come segreto | Più veloce, limiti alti | Serve un progetto Google Cloud e una schermata di consenso OAuth in produzione (in modalità test il token scade dopo 7 giorni): più parti che possono rompersi | Scartato: troppa complessità per un evento di una sera |
| Firebase Storage | SDK comodo | Richiede il piano Blaze (carta) e la quota gratuita (~5 GB) si esaurisce subito con i video; i file non stanno su Drive | Scartato |
| Google Form con caricamento file | Zero codice | Obbliga al login Google, nessuna cartella per persona, nessuna galleria | Scartato |

## 7. Architettura

```
Telefono (React su GitHub Pages)
   │  1. chiamate brevi (JSON)            ┌──────────────────────────┐
   ├────────────────────────────────────▶ │ Apps Script Web App       │
   │     verifica codice, crea cartella,  │ (esegue come Francesco)   │
   │     apre sessione upload, elenco     └────────────┬─────────────┘
   │                                                   │ Drive API v3
   │  2. byte del file, a pezzi (PUT)                  ▼
   ├──────────────────────────────────────────▶  Google Drive
   │                                               Laurea/<Nome>/
   │  3. miniature/anteprime (GET diretto)             ▲
   └───────────────────────────────────────────────────┘
```

### 7.1 Apps Script (backend)

Un solo endpoint Web App; l'azione arriva nel corpo della richiesta. Ogni azione verifica prima il codice evento (salvato nelle Script Properties, non nel codice).

Azioni:

1. **`login(code, name)`** → verifica il codice, normalizza il nome, trova o crea `Laurea/<Nome>/` e restituisce `{ name, folderId }`.
2. **`startUpload(code, name, fileName, mimeType, size)`** → apre una **sessione di caricamento resumable** di Drive API v3 nella cartella dell'utente, usando `ScriptApp.getOAuthToken()` e `UrlFetchApp`. Restituisce l'URL della sessione. L'URL vale per un solo file e non espone token riutilizzabili.
3. **`list(code, cursor, author?)`** → elenco paginato (circa 50 per pagina) dei file sotto `Laurea/`, più recenti prima: `{ id, name, author, mimeType, createdTime }` e il cursore della pagina successiva. Se `author` è valorizzato filtra per persona. Restituisce anche l'elenco degli autori, per il filtro.
4. **`ping`** → opzionale, per scaldare lo script all'apertura del sito.

Cache: i risultati di `list` vanno in `CacheService` per 30–60 secondi (chiave per pagina e autore), così molti invitati che aggiornano non moltiplicano le chiamate a Drive.

Nomi dei file su Drive: `AAAAMMGG-HHMMSS_<nome originale>`, per evitare sovrascritture e ordinare bene.

### 7.2 Caricamento (frontend → Drive)

- Selezione multipla dalla galleria del telefono (`<input type="file" multiple accept="image/*,video/*">`).
- Per ogni file: `startUpload` → PUT a pezzi (es. 8 MB, multipli di 256 KB) verso l'URL della sessione, con `Content-Range`.
- Se un pezzo fallisce: interroga la sessione per sapere quanti byte sono arrivati e riprende da lì, con qualche tentativo e un'attesa crescente.
- Coda con 2–3 file in parallelo al massimo; barra di avanzamento per file e stato (in coda, in caricamento, fatto, errore + "riprova").
- Avviso se l'utente prova a chiudere la pagina con caricamenti in corso.
- **Portata della ripresa (decisione di Francesco):** il caricamento riprende da solo dopo cali di rete e dopo blocco schermo o cambio app, **finché la pagina non viene ricaricata**. Durante i caricamenti un avviso ben visibile dice "tieni aperta questa schermata finché non finisce". Se la pagina si ricarica, i caricamenti a metà sono persi e vanno rifatti. Niente persistenza delle sessioni in IndexedDB.

### 7.3 Galleria (frontend)

- Dopo il login (codice + nome, ricordati in `localStorage` su quel telefono), la home mostra:
  1. pulsante "Carica foto/video";
  2. **la tua cartella**: i file dell'utente, fissati in alto;
  3. **tutti**: griglia paginata con scroll infinito (`IntersectionObserver`) e lazy loading;
  4. filtro per persona.
- Miniature caricate **direttamente da Google** (`https://drive.google.com/thumbnail?id=<id>&sz=w400`), possibile solo perché la cartella è condivisa con link. Al tocco: immagine grande (`sz=w1600` o simile); video nel player di Drive (`https://drive.google.com/file/d/<id>/preview` in un iframe).
- **Ordinamento (decisione di Francesco):** per **data di caricamento** (`createdTime` di Drive), più recenti prima. Nessuna lettura EXIF, nessun indice separato. Anche il prefisso `AAAAMMGG-HHMMSS_` del nome file usa l'ora di caricamento.
- Aggiornamento automatico: ogni 30–60 secondi viene richiesta la prima pagina e i file nuovi si aggiungono in cima.
- I video appena caricati possono restare "in elaborazione" su Drive per qualche minuto: va mostrato un segnaposto, non un errore.

### 7.4 Regole sul nome

- Il nome viene ripulito da spazi in eccesso e da caratteri non validi.
- Il confronto ignora maiuscole e minuscole: "paolo" e "Paolo" finiscono nella stessa cartella, che prende il nome dalla prima forma usata.
- Due persone con lo stesso nome condividono la cartella: accettato.

## 8. Scelte fatte da me (da confermare in lettura)

- Nessuna cancellazione dal sito. Se servirà, un'estensione possibile: ogni telefono può cancellare solo ciò che ha caricato lui (token di dispositivo).
- Aggiornamento della galleria ogni 30–60 s tramite polling, non in tempo reale.
- Codice evento unico per tutti, salvato nelle Script Properties.
- UI in italiano, pensata prima di tutto per il telefono.

## 9. Lasciato al builder

- Stack frontend preciso: React + Vite (TypeScript consigliato), router e gestione dello stato.
- Deploy su GitHub Pages (consigliato tramite GitHub Actions) e base path del repo.
- Come tenere il codice Apps Script nel repo: `clasp` consigliato.
- Implementazione di `list`: query Drive sulle sottocartelle di `Laurea/`, oppure un indice. Basta rispettare paginazione, ordine e cache.
- Gestione CORS delle chiamate a Apps Script (es. POST con `Content-Type: text/plain` per evitare il preflight).
- Dimensione dei pezzi, numero di file in parallelo, politica dei tentativi.

## 10. Rischi da verificare subito con una prova veloce

1. **Upload resumable dal browser** con l'URL di sessione creato da Apps Script: verificare che le PUT da un'origine `github.io` passino (CORS) e che la ripresa funzioni.
   **Piano B (scelta mia), se la prova fallisce:** il browser manda i pezzi (es. 8–10 MB) allo script, che li inoltra alla stessa sessione resumable con `UrlFetchApp`. Funziona anche per i video grandi, perché ogni pezzo è una chiamata separata sotto il limite di ~50 MB. In cambio i caricamenti sono più lenti e consumano esecuzioni e quote UrlFetch: va limitato il parallelismo. **Mai** passare al browser un token OAuth, nemmeno a breve scadenza: darebbe accesso all'intero Drive.
2. **Ereditarietà della condivisione:** i file creati via API dentro `Laurea/<Nome>/` devono risultare visibili con link senza passaggi aggiuntivi.
3. **Miniature dirette** (`drive.google.com/thumbnail`): verificare che reggano molte richieste ravvicinate senza blocchi o errori 429. Alternativa da tenere pronta: `thumbnailLink` restituito dall'API.
4. **Quote Apps Script** con molti utenti insieme: verificare che la cache basti.
