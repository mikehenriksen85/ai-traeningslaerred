# Work4it - platforms- og browserkompatibilitet

Dato: 18. juni 2026

## Formål

Denne gennemgang kontrollerer Work4it på tværs af Android, iOS, Safari,
Chrome og Edge med fokus på login, Firebase, Firestore, PWA-installation,
navigation, modals, formularer, touch, dropdown-menuer, eksport,
AI-funktioner, localStorage og responsivt design.

## Rettelser udført

### Firebase Authentication

Problem:

- Google-login brugte kun popup-login.
- Popups er ustabile eller blokeres ofte på iOS, Safari og installerede
  PWA'er.

Rettelse:

- Mobil, iOS og standalone-PWA bruger nu `signInWithRedirect`.
- Desktop bruger fortsat popup først.
- Hvis popup blokeres på desktop, falder appen tilbage til redirect.
- `getRedirectResult` håndteres ved app-start.

Berørte filer:

- `auth-service.js`

### PWA-installation

Problem:

- Manifestet manglede installationsikoner og mere komplet PWA-metadata.
- Der fandtes ingen service worker.

Rettelse:

- Tilføjet `service-worker.js`.
- Tilføjet `work4it-icon.svg`.
- Tilføjet `work4it-icon-192.png`.
- Tilføjet `work4it-icon-512.png`.
- Manifestet har nu app-id, kategorier, display fallback, orientation og
  maskable ikon.
- `index.html` registrerer service workeren automatisk på sikre origins.
- Tilføjet Apple touch icon og iOS web app metadata.

Berørte filer:

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `work4it-icon.svg`
- `work4it-icon-192.png`
- `work4it-icon-512.png`

### iOS, Safari og mobil layout

Problem:

- Klassisk `100vh` kan være ustabil i Safari, når adresselinjen åbner og
  lukker.
- Notch/statusbar/home-indikator kan overlappe fixed views.
- Safari zoomer formularfelter under 16 px.
- Nogle touch-kontroller var små på mobil.

Rettelse:

- Tilføjet `100dvh` med fallback.
- Tilføjet `env(safe-area-inset-*)` på header, fuldskærmsvisninger,
  login-gate og bundafstande.
- Mobilformularer bruger mindst 16 px.
- Touchmål på centrale mobile knapper er forstørret.
- Loginpanelet har mere robust viewport-baseret bredde.

Berørt fil:

- `index.html`

### localStorage og private/stramme browsermiljøer

Problem:

- Browserens lokale lager kan fejle i private modes, ved fuld kvote eller
  stramme storage-politikker.

Rettelse:

- `storage-scope.js` bruger nu defensive storage wrappers.
- Midlertidig memory-fallback er tilføjet.
- UID-opdeling og eksisterende localStorage fallback er bevaret.

Berørt fil:

- `storage-scope.js`

## Kontrollerede områder

| Område | Status | Kommentar |
|---|---|---|
| Login | Rettet | E-mail/password og Google-flow er kompatibilitetsforbedret |
| Firebase Authentication | Rettet | Redirect-fallback for mobil/PWA |
| Firestore | OK | Eksisterende Firestore/localStorage-model er bevaret |
| PWA-installation | Rettet | Manifest, ikoner og service worker tilføjet |
| Navigation | OK | Eksisterende interne funktioner bevares |
| Modals/popups | OK | Login-gate ligger øverst og skjuler andre vinduer |
| Formularer | Rettet | Mobilfont min. 16 px |
| Touch-funktioner | Rettet | Centrale mobilknapper har større flader |
| Dropdown-menuer | OK | Eksisterende fixed/scroll-løsning bevares |
| PDF-eksport | Ikke implementeret | Appen har JSON-eksport, ikke PDF-eksport |
| AI-funktioner | OK | Ingen platformsspecifikke blokeringer fundet |
| localStorage | Rettet | Defensive wrappers og memory-fallback |
| Responsivt design | Delvist testet | Headless Chrome/Edge testet; fysisk mobiltest anbefales |

## Tests udført

Automatisk/kodebaseret:

- `node --check auth-service.js`
- `node --check storage-scope.js`
- `node --check service-worker.js`
- `manifest.webmanifest` valideret som JSON
- Lokal server startede på `http://localhost:8767/`
- `index.html` svarede med HTTP 200
- PWA-filer blev leveret fra serveren
- Ikoner verificeret:
  - `work4it-icon-192.png`: 192x192
  - `work4it-icon-512.png`: 512x512
- Chrome headless screenshots:
  - 360 px
  - 390 px
  - 430 px
  - 768 px
  - 1366 px
- Edge headless screenshot:
  - 1366 px

## Vigtige noter om test

- Det indbyggede browserstyringsværktøj kunne ikke bruges i denne
  Windows-session på grund af en adgangsfejl i browser-runtime.
- Chrome headless kan på meget smalle screenshots opføre sig som en
  croppet desktopvisning frem for ægte mobil-emulering. Derfor bør iOS og
  Android stadig testes fysisk.
- Der er ikke testet med rigtige Firebase-loginoplysninger i denne runde.

## Anbefalet fysisk accepttest

Test disse flows på rigtige enheder:

1. iPhone Safari:
   - Åbn appen
   - Login med e-mail
   - Google-login
   - Fokus i formularfelter uden uønsket zoom
   - Føj til hjemmeskærm
   - Åbn appen fra hjemmeskærmen

2. Android Chrome:
   - Login
   - Google-login via redirect
   - PWA-installation
   - Dropdown-menuer og modals

3. Desktop Chrome og Edge:
   - Login
   - Logout
   - PWA-installation
   - Navigation
   - JSON-eksport
   - Firestore sync efter refresh

4. Layoutbredder:
   - 360 px
   - 390 px
   - 430 px
   - 768 px
   - 1024 px
   - 1366 px
   - 1920 px

## Kendte begrænsninger

- PDF-eksport findes ikke endnu.
- Firebase-login og cloud-sync kræver internet.
- Offline PWA fungerer som app-shell/cache efter første indlæsning, men
  clouddata kan ikke synkroniseres offline.
- Medlemskab og AI request-grænser er stadig klientstyrede demo-funktioner
  og må ikke bruges som produktionssikker adgangskontrol.

## Samlet status

Work4it er nu væsentligt bedre forberedt til Chrome, Edge, Android og
iOS/Safari. De største browserkompatibilitetsrisici er rettet i koden.
Næste naturlige skridt er fysisk test på iPhone og Android samt en rigtig
Firebase-loginrunde med en testkonto.
