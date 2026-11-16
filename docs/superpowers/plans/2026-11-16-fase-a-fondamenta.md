# Fase A — Fondamenta e prova dei rischi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sito React su GitHub Pages che, dopo codice evento e nome, carica un file a pezzi direttamente su Drive (`Laurea/<Nome>/`) tramite una sessione resumable aperta da Apps Script, e ne mostra la miniatura.

**Architecture:** frontend statico (Vite + React + TS) → Web App Apps Script (`doPost`, JSON in `text/plain`) per `ping`/`login`/`startUpload` → il browser fa le PUT dei pezzi sull'URL di sessione Drive → miniatura da `drive.google.com/thumbnail`.

**Tech Stack:** Node 24, Vite, React 18, TypeScript, Vitest, `@google/clasp` 3.x, Apps Script V8, Drive API v3 (REST via `UrlFetchApp`), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-16-photolaurea-design.md` · Roadmap: `docs/superpowers/plans/2026-11-16-roadmap.md`

## Global Constraints

- Nessun token o chiave Google nel frontend né nel repo. Nel frontend ci va solo l'URL `/exec` della Web App (pubblico per natura).
- Codice evento, ID della cartella radice e origine consentita stanno **solo** nelle Script Properties: `EVENT_CODE`, `ROOT_FOLDER_ID`, `ALLOWED_ORIGIN`.
- Web App: `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`. Fuso `Europe/Rome`.
- Nome file su Drive: `AAAAMMGG-HHMMSS_<nome originale>`, con l'ora di caricamento in Europe/Rome.
- Pezzi di upload: multipli di 256 KiB; default 8 MiB (`8 * 1024 * 1024`).
- Repo pubblico `KekkoCoppola/PhotoLaurea` (serve per Pages gratuito); Vite `base: '/PhotoLaurea/'`.
- Risposte dello script: `{ ok: true, data }` oppure `{ ok: false, error }`, con `error` ∈ `BAD_REQUEST | BAD_CODE | BAD_NAME | UPSTREAM | SERVER`.

## Review Focus

1. Nome fatto solo di spazi, slash o caratteri vietati → `BAD_NAME`, mai una cartella vuota o chiamata "/" (Task 3).
2. Codice evento con spazi o maiuscole diverse (`" laurea26 "`) → accettato (Task 3).
3. Nome file con spazi, parentesi, emoji o `.HEIC` → conservato intatto dopo il prefisso (Task 3).
4. File da 0 byte → una sola PUT con `Content-Range: bytes */0`, nessun loop (Task 5).
5. Sessione scaduta (404/410) a metà caricamento → errore `SESSION_EXPIRED`, non tentativi infiniti (Task 5).

## File Structure

```
package.json, vite.config.ts, tsconfig.json, index.html, .gitignore, .env.example
src/main.tsx                 entry
src/App.tsx                  schermata di prova Fase A (solo pulsanti)
src/api/client.ts            callApi + ApiError
src/upload/resumable.ts      uploadResumable (PUT a pezzi + ripresa)
src/upload/resumable.test.ts
src/drive/urls.ts            thumbnailUrl, videoPreviewUrl
apps-script/.clasp.json      { scriptId, rootDir: "src" }
apps-script/src/appsscript.json
apps-script/src/lib.js       helper puri (compatibili CommonJS per i test)
apps-script/src/Code.js      doPost, router, azioni
apps-script/test/lib.test.js
.github/workflows/deploy.yml
docs/superpowers/spikes/2026-fase-a-risultati.md
```

---

### Task 1: Scaffold frontend + test runner

**Files:** Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (placeholder "PhotoLaurea"), `.env.example` (`VITE_API_URL=`), aggiorna `.gitignore` (`node_modules`, `dist`, `.env*` tranne `.env.example`, `.clasprc.json`).

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts` (nella root già esistente; conserva `docs/`), poi `npm i -D vitest`.
- [ ] **Step 2:** in `vite.config.ts` imposta `base: '/PhotoLaurea/'` e `test.include: ['src/**/*.test.ts', 'apps-script/test/**/*.test.js']`. Aggiungi lo script `"test": "vitest run"`.
- [ ] **Step 3:** `npm run build && npm test`. Atteso: build ok; vitest dice "No test files found" ed esce senza errori (aggiungi `passWithNoTests: true`).
- [ ] **Step 4:** commit `chore: scaffold vite react-ts with vitest`.

### Task 2: Deploy su GitHub Pages

**Files:** Create: `.github/workflows/deploy.yml`

- [ ] **Step 1:** workflow su `push` a `main` e `workflow_dispatch`: `actions/checkout`, `actions/setup-node` (24, cache npm), `npm ci`, `npm test`, `npm run build` con `env: VITE_API_URL: ${{ vars.VITE_API_URL }}`, `actions/upload-pages-artifact` (`dist`), job `deploy` con `actions/deploy-pages`. Permessi: `pages: write`, `id-token: write`.
- [ ] **Step 2:** attiva Pages da Actions: `gh api -X POST repos/KekkoCoppola/PhotoLaurea/pages -f build_type=workflow`.
- [ ] **Step 3:** commit e push; `gh run watch`. Atteso: run verde; `https://kekkocoppola.github.io/PhotoLaurea/` mostra "PhotoLaurea".

### Task 3: Helper puri dello script + test

**Files:** Create: `apps-script/src/lib.js`, `apps-script/test/lib.test.js`

**Interfaces — Produces** (funzioni globali in Apps Script; in Node esportate con `if (typeof module !== 'undefined') module.exports = {...}`):
- `normalizeName(raw: string): string` — trim, spazi multipli → uno, rimuove `/ \ : * ? " < > |` e i caratteri di controllo, tronca a 40 caratteri; `''` se non resta nulla.
- `nameKey(name: string): string` — `normalizeName(name).toLocaleLowerCase('it')`.
- `buildDriveFileName(original: string, date: Date): string`, con `Intl.DateTimeFormat` e `timeZone: 'Europe/Rome'`.
- `isValidCode(given: string, expected: string): boolean` — trim e confronto case-insensitive; `false` se `expected` è vuoto.

- [ ] **Step 1: test che falliscono**

```js
const { normalizeName, nameKey, buildDriveFileName, isValidCode } = require('../src/lib.js');
test('normalizeName pulisce', () => {
  expect(normalizeName('  Paolo   Rossi ')).toBe('Paolo Rossi');
  expect(normalizeName('a/b\\c:d')).toBe('abcd');
  expect(normalizeName('   / ')).toBe('');
  expect(normalizeName('x'.repeat(60))).toHaveLength(40);
});
test('nameKey ignora maiuscole', () => expect(nameKey(' PAOLO ')).toBe(nameKey('paolo')));
test('buildDriveFileName usa ora di Roma e conserva il nome', () => {
  expect(buildDriveFileName('IMG 001 (1).HEIC', new Date('2026-11-20T18:05:09Z')))
    .toBe('20261120-190509_IMG 001 (1).HEIC');
  expect(buildDriveFileName('🎓.jpg', new Date('2026-07-01T10:00:00Z'))).toBe('20260701-120000_🎓.jpg');
});
test('isValidCode', () => {
  expect(isValidCode(' laurea26 ', 'LAUREA26')).toBe(true);
  expect(isValidCode('LAUREA25', 'LAUREA26')).toBe(false);
  expect(isValidCode('', '')).toBe(false);
});
```

- [ ] **Step 2:** `npm test` → FAIL (modulo mancante).
- [ ] **Step 3:** implementa `lib.js`. Usa solo sintassi supportata da Apps Script V8: niente `import`/`export`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** commit `feat(script): name, filename and code helpers`.

### Task 4: Progetto Apps Script + `ping`/`login`/`startUpload`

**Files:** Create: `apps-script/.clasp.json`, `apps-script/src/appsscript.json`, `apps-script/src/Code.js`

**Interfaces — Produces** (HTTP, `POST <exec URL>`, body JSON come testo):
- `{action:'ping'}` → `{ok:true,data:{pong:true}}` (non richiede il codice)
- `{action:'login', code, name}` → `{ok:true,data:{name:string, folderId:string}}`
- `{action:'startUpload', code, name, fileName, mimeType, size:number}` → `{ok:true,data:{uploadUrl:string}}`

**Prerequisiti manuali (li fa Francesco, una volta sola):**
1. Su Drive crea la cartella `Laurea`, condividila come "Chiunque abbia il link → Visualizzatore" e annota il suo ID.
2. Attiva la "Google Apps Script API" su `https://script.google.com/home/usersettings`.
3. Lancia `npx @google/clasp login` nel terminale e concedi l'accesso nel browser.

- [ ] **Step 1:** `cd apps-script && npx @google/clasp create --type standalone --title "PhotoLaurea API" --rootDir src`. Verifica che `.clasp.json` abbia `rootDir: "src"`.
- [ ] **Step 2:** `appsscript.json` con `timeZone: "Europe/Rome"`, `runtimeVersion: "V8"`, `webapp: {executeAs: "USER_DEPLOYING", access: "ANYONE_ANONYMOUS"}`, `oauthScopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/script.external_request"]`.
- [ ] **Step 3:** `Code.js`:
  - `doPost(e)` fa il parse di `e.postData.contents`, smista per `action` e risponde con `ContentService` in JSON. Un JSON non valido o un'azione sconosciuta danno `BAD_REQUEST`; un'eccezione imprevista dà `SERVER` (con `console.error`).
  - Tutte le azioni tranne `ping` verificano `isValidCode(code, EVENT_CODE)`, altrimenti rispondono `BAD_CODE`.
  - `resolveUserFolder(name)` usa `normalizeName`, e un nome vuoto dà `BAD_NAME`. Poi prende `LockService.getScriptLock().waitLock(10000)`, scorre le sottocartelle di `ROOT_FOLDER_ID` confrontando `nameKey`, crea la cartella se manca e rilascia il lock in `finally`.
  - `startUpload` apre la sessione con `UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', …)`:
    - metodo `post`, `contentType: 'application/json'`, `muteHttpExceptions: true`;
    - payload `{name: buildDriveFileName(fileName, new Date()), parents:[folderId]}`;
    - header `Authorization: 'Bearer ' + ScriptApp.getOAuthToken()`, `X-Upload-Content-Type: mimeType`, `X-Upload-Content-Length: String(size)`, `Origin: ALLOWED_ORIGIN`.
    - Se la risposta non è 200 dà `UPSTREAM`; altrimenti restituisce l'header `Location` come `uploadUrl`.
- [ ] **Step 4:** `npx @google/clasp push`. Nell'editor (`clasp open-script`), Impostazioni progetto → Script Properties: `EVENT_CODE`, `ROOT_FOLDER_ID`, `ALLOWED_ORIGIN=https://kekkocoppola.github.io`. Poi Esegui il deployment → Nuovo deployment → App web. Francesco autorizza i permessi; annota l'URL `/exec`.
- [ ] **Step 5: verifica**

```bash
curl -sL -H "Content-Type: text/plain" -d '{"action":"ping"}' "$EXEC_URL"
curl -sL -H "Content-Type: text/plain" -d '{"action":"login","code":"SBAGLIATO","name":"Test"}' "$EXEC_URL"
curl -sL -H "Content-Type: text/plain" -d '{"action":"login","code":"<codice>","name":"Test"}' "$EXEC_URL"
```
Atteso: `pong:true`; `BAD_CODE`; `folderId` presente e cartella `Laurea/Test` visibile su Drive. Ripetere il terzo comando con `"name":"test"` → stesso `folderId`.

- [ ] **Step 6:** `gh variable set VITE_API_URL --body "$EXEC_URL"`; commit `feat(script): web app with ping, login, startUpload`.

### Task 5: `uploadResumable` + test

**Files:** Create: `src/upload/resumable.ts`, `src/upload/resumable.test.ts`

**Interfaces — Produces:**

```ts
export type UploadOptions = { chunkSize?: number; maxRetries?: number;
  onProgress?: (sent: number, total: number) => void; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> };
export class UploadError extends Error { code: 'SESSION_EXPIRED' | 'FAILED' }
export function uploadResumable(uploadUrl: string, file: Blob, opts?: UploadOptions): Promise<{ id: string }>;
```

Protocollo:
- PUT di `file.slice(start, end)` con `Content-Range: bytes start-(end-1)/total`.
- 308 → leggi `Range: bytes=0-N`: il prossimo `start` è N+1; se manca `Range`, `start = 0`.
- 200/201 → `json().id`.
- Errore di rete o 5xx → attesa (1 s, 2 s, 4 s…), poi PUT di stato con corpo vuoto e `Content-Range: bytes */total`, e si riparte dall'offset restituito.
- `maxRetries` (default 5) tentativi **consecutivi** falliti → `FAILED`.
- 404/410 → `SESSION_EXPIRED`.
- File vuoto → una sola PUT con `Content-Range: bytes */0`.

- [ ] **Step 1: test che falliscono** (con `fetchImpl` finto che registra le chiamate, `sleep` istantaneo, `chunkSize: 262144`, Blob da 600 000 byte):
  - `invia 3 pezzi con Content-Range corretti e restituisce l'id`: gli header attesi sono `bytes 0-262143/600000`, `bytes 262144-524287/600000`, `bytes 524288-599999/600000`; il risultato è `{id:'abc'}`; `onProgress` chiamato con `600000, 600000` alla fine.
  - `dopo un errore di rete chiede lo stato e riprende dall'offset`: il secondo PUT lancia `TypeError`; il PUT di stato risponde 308 con `Range: bytes=0-262143`; il PUT successivo ha `Content-Range` che inizia con `bytes 262144-`.
  - `308 senza Range riparte da 0`.
  - `si arrende dopo maxRetries errori consecutivi` → `UploadError` con `code === 'FAILED'`.
  - `404 → SESSION_EXPIRED`.
  - `file vuoto → una sola PUT con bytes */0`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** implementa `uploadResumable`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** commit `feat(upload): resumable chunked upload with retry`.

### Task 6: Client API, URL Drive, schermata di prova

**Files:** Create: `src/api/client.ts`, `src/drive/urls.ts`; Modify: `src/App.tsx`

**Interfaces — Produces:**
- `callApi<T>(action: 'ping'|'login'|'startUpload', payload?: Record<string, unknown>): Promise<T>` fa una `fetch(import.meta.env.VITE_API_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action, ...payload})})`. Se `ok:false` lancia `ApiError` con `code`.
- `thumbnailUrl(id: string, width = 400): string` → `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`
- `videoPreviewUrl(id: string): string` → `https://drive.google.com/file/d/${id}/preview`

- [ ] **Step 1:** test di `urls.ts`: due `expect` sulle stringhe esatte qui sopra; `npm test` → FAIL; implementa; → PASS.
- [ ] **Step 2:** `App.tsx`, solo controlli nativi:
  - campi codice e nome + pulsante "Entra" → `login`; mostra il nome restituito o l'errore;
  - `<input type="file" multiple accept="image/*,video/*">`;
  - per ogni file: `startUpload` → `uploadResumable`, con `<progress>` e il testo dello stato;
  - a fine caricamento: `<img src={thumbnailUrl(id)}>` per le immagini e un link a `videoPreviewUrl(id)` per i video;
  - `beforeunload` attivo mentre ci sono caricamenti;
  - un banner fisso "Tieni aperta questa schermata finché non finisce" durante il caricamento.
- [ ] **Step 3:** `npm run build` ok; commit `feat: phase A test screen`; push; Pages verde.

### Task 7: Verifica dei rischi (sul campo)

**Files:** Create: `docs/superpowers/spikes/2026-fase-a-risultati.md`

- [ ] **Step 1 — R1, upload diretto:** dal sito pubblicato, su telefono (Android Chrome e iPhone Safari, se disponibili) e su desktop:
  - foto da circa 5 MB → arriva su Drive in `Laurea/<Nome>/` con il prefisso corretto;
  - video da 300 MB o più → arriva intero; ripetere attivando la modalità aereo a metà e disattivandola entro 30 s → deve riprendere, non ripartire da zero.
  - Annotare eventuali errori CORS dalla console. Se l'header `Range` non è leggibile dal browser (manca `Access-Control-Expose-Headers`), annotarlo.
- [ ] **Step 2 — R2, condivisione ereditata:** in una finestra in incognito senza login, `thumbnailUrl(id)` di un file appena caricato → l'immagine si vede.
- [ ] **Step 3 — R3, prima occhiata alle miniature:** caricare 20 o più foto e verificare che le miniature compaiano tutte (lo stress test vero è in Fase D).
- [ ] **Step 4:** scrivere i risultati (✅/❌ per R1–R3, browser usati, tempi indicativi) nel file spike.
- [ ] **Step 5 — decisione:**
  - **R1 ❌ per CORS** → prima prova senza l'header `Origin`, poi con `Origin` uguale all'origine esatta. Se fallisce ancora, si attiva il **piano B** della spec §10 (inoltro dei pezzi tramite lo script) come Task 8, da pianificare prima di passare alla Fase B.
  - **R2 ❌** → impostare la condivisione per file dopo il caricamento (azione `finishUpload`) e annotarlo.
  - Commit `docs: phase A spike results`.
