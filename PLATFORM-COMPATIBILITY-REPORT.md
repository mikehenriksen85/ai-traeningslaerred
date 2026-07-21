# Work4it - platforms- og browserkompatibilitet

Dato: 19. juni 2026

## Formål

Denne gennemgang kontrollerer Work4it på tværs af Android, iOS, Safari,
Chrome og Edge med fokus på login, Firebase, Firestore, PWA-installation,
navigation, modals, formularer, touch, dropdown-menuer, eksport,
AI-funktioner, localStorage, responsivt design og service worker/PWA-cache.

## Fundne kompatibilitetsproblemer

### 1. PWA-cache kunne fastholde gammel app-shell

Problem:

- Service workeren brugte stadig `work4it-shell-v1`.
- Installerede PWA'er på Android/iOS/Edge/Chrome kunne derfor risikere at holde fast i gamle frontend-filer efter deploy.
- App-shell-listen cachede primært HTML/manifest/ikoner, men ikke de centrale lokale JavaScript-filer.

Rettelse:

- Cache-navnet er opdateret til `work4it-shell-v2-20260619`.
- Centrale Work4it-scripts er tilføjet til app-shell cachelisten med nuværende cache-busting query strings.
- Aktiv service worker sletter gamle caches under `activate`.

Berørt fil:

- `service-worker.js`

### 2. Modal/popups havde inkonsistent åbne-logik

Problem:

- Flere funktioner satte `$("modal").style.display = "flex"` direkte.
- Det kan give forskellig `aria-hidden`, focus og inert-adfærd på især Safari/iOS og Edge.
- Privatlivsmodalen havde ekstra særlogik, fordi login-gaten låser resten af appen.

Rettelse:

- Tilføjet central `openModal()`.
- Alle almindelige modalåbninger bruger nu `openModal()`.
- `openModal()` sætter `display:flex`, `aria-hidden=false`, `inert=false` og flytter fokus til første relevante kontrol.
- `closeModal()` sætter `display:none` og `aria-hidden=true`.

Berørt fil:

- `index.html`

### 3. iOS safe-area kunne forbedres yderligere

Problem:

- Siden brugte allerede `env(safe-area-inset-*)`, men viewport-meta manglede `viewport-fit=cover`.
- På iOS/Safari kan det betyde mindre forudsigelig placering omkring notch/statusbar i standalone/PWA.

Rettelse:

- Viewport-meta er opdateret til `width=device-width, initial-scale=1.0, viewport-fit=cover`.

Berørt fil:

- `index.html`

## Kontrollerede områder

| Område | Status | Kommentar |
|---|---|---|
| Login | OK | Login-gate loader uden syntaksfejl; Google-flow bruger redirect på mobil/PWA |
| Firebase Authentication | OK | Popup/redirect-fallback er kompatibilitetsforbedret |
| Firestore | OK | Ejerbeskyttede regler og cloud/localStorage fallback bevares |
| PWA-installation | Rettet | Cache-version og app-shell opdateret |
| Navigation | OK | Ingen nye navigation-fejl fundet i statisk gennemgang |
| Modals og popups | Rettet | Central modalåbning og fokus/ARIA håndtering |
| Formularer | OK | Mobilfont og inputflow bevares; auth-samtykke er synligt |
| Touch-funktioner | OK | Touch-action og større mobile flader bevares |
| Dropdown-menuer | OK | Fixed/scroll-løsning bevares; exercise picker bruger viewportpositionering |
| PDF-eksport | Ikke implementeret | Appen har JSON-dataeksport; egentlig PDF-eksport findes ikke endnu |
| AI-funktioner | OK | Ingen platformsspecifikke API'er fundet; AI-logik er lokal/regelbaseret |
| localStorage | OK | Defensive wrappers og memory-fallback |
| Responsivt design | OK efter statisk kontrol | Fysisk enhedstest anbefales stadig |
| Service worker/PWA-cache | Rettet | Cache bump og script-assets tilføjet |

## Tests udført 19. juni 2026

Automatisk/kodebaseret:

- `node --check auth-gate.js`
- `node --check auth-service.js`
- `node --check firestore-cloud-service.js`
- `node --check profile-account.js`
- `node --check service-worker.js`
- Inline JavaScript i `index.html` valideret med `new Function(...)`
- `manifest.webmanifest` valideret som JSON
- Lokal server på `http://localhost:8767/` svarede HTTP 200
- Følgende assets svarede HTTP 200:
  - `/`
  - `/index.html`
  - `/manifest.webmanifest`
  - `/service-worker.js`
  - `/auth-gate.js?v=20260619-gdpr1`
  - `/profile-account.js?v=20260619-gdpr1`
  - `/auth-service.js?v=20260619-gdpr1`
  - `/firestore-cloud-service.js?v=20260619-gdpr1`
  - `/Pictures/App%20Ikon%20V1.png` (officiel source: `public/Pictures/App Ikon V1.png`)

## Testbegrænsninger

- Codex' in-app browser automation fejlede i denne Windows-session med en adgangsfejl.
- Den bundtede Playwright-installation kunne ikke starte, fordi `playwright-core` ikke var tilgængelig via runtime-resolution.
- Der er derfor ikke udført fuld automatisk visuel screenshot-test i denne runde.
- iOS/Safari og Android/Chrome skal stadig fysisk accepttestes for login, Google redirect, PWA-installation og touchadfærd.
- Der er ikke brugt rigtige Firebase-loginoplysninger i testen.

## Anbefalet fysisk accepttest

1. iPhone Safari:
   - Åbn Work4it
   - Opret/log ind med e-mail
   - Google-login via redirect
   - Åbn Privatliv/GDPR modal fra login
   - Føj til hjemmeskærm
   - Åbn standalone PWA og kontroller login-gendannelse

2. Android Chrome:
   - Login og Google-login
   - Installer PWA
   - Åbn/luk menu, dropdowns og modals
   - Opret og gem et træningspas

3. Desktop Chrome og Edge:
   - Login, logout, refresh-login
   - Firestore sync efter profilændring
   - JSON-eksport
   - Privatliv/GDPR-side
   - Konto-/datasletning med testkonto

4. Layoutbredder:
   - 360 px
   - 390 px
   - 430 px
   - 768 px
   - 1024 px
   - 1366 px
   - 1920 px

## Kendte begrænsninger

- PDF-eksport findes ikke endnu; kun JSON-dataeksport er implementeret.
- Firebase-login og cloud-sync kræver internet.
- Offline PWA fungerer som app-shell/cache efter første indlæsning, men clouddata kan ikke synkroniseres offline.
- Medlemskab og AI request-grænser er stadig klientstyrede demo-funktioner og må ikke bruges som produktionssikker adgangskontrol.
- Fuld bekræftelse af Safari/iOS og Android kræver fysisk test på enheder, fordi headless-test ikke var tilgængelig i denne session.

## Samlet status

Work4it er rettet for de kompatibilitetsproblemer, der kunne identificeres og løses direkte i koden: PWA-cache, modal/popups og iOS safe-area/viewport. Appen loader lokalt, centrale assets svarer korrekt, manifest/service worker er gyldige, og centrale scripts har ingen syntaksfejl.

Teknisk vurdering: Work4it er kompatibilitetsforbedret og forventes at fungere på Android, iOS, Safari, Chrome og Edge, men endelig bekræftelse kræver fysisk accepttest på især iPhone Safari og Android Chrome med rigtig Firebase-login.
