# Work4it Design System 1.0

Dato: 2026-06-19

## Opdaterede filer

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `work4it-app-icon.png`
- `work4it-app-icon-192.png`
- `work4it-app-icon-512.png`
- `work4it-logo-v1.png`
- `work4it-hero-logo-v1.png`
- `screenshots/work4it-design-desktop.png`
- `screenshots/work4it-design-mobile.png`

## Logo v1 bruges her

- Login-side
- Desktop-header
- Profil og konto-side
- Hjælp / Om Work4it-dialog

## Hero-logo v1 bruges her

- Velkomst/topsektion på programsiden
- Splash/loading-visning før loginstatus er afklaret
- Medlemskabssiden
- Open Graph/Twitter preview image

## App-ikonet bruges her

- Mobil-header
- Favicon
- Apple touch icon
- PWA manifest icons
- Android/PWA icon via manifest
- Service worker app shell cache

## Design System 1.0

- Primær: `#3B82F6`
- Success/Gem: `#22C55E`
- Advarsel/Slet: `#EF4444`
- Baggrund: `#0F172A`
- Kort: `#1E293B`
- Tekst: `#FFFFFF`

Dashboard- og AI-relaterede knapper er standardiseret til blå. Gem/success bruger grøn, og slet/fare bruger rød.

## Manglende filer eller stier

Ingen nødvendige brandfiler manglede. Filen `public/Pictures/Logo` findes uden filendelse og er ikke brugt, fordi de tre navngivne filer dækker kravene.

## Screenshots

- Desktop: `screenshots/work4it-design-desktop.png`
- Mobil 390px: `screenshots/work4it-design-mobile.png`

Screenshots er taget med Microsoft Edge headless fra `http://localhost:8767/`.

## Branding-status

Work4it er nu det synlige brandnavn i appens metadata, PWA-manifest, login, header, profil, medlemskab og hjælpeside. Tekniske Firebase- og datastrukturnavne med `workout` er bevidst bevaret, fordi de ikke er synlig branding og ellers kunne bryde cloud-sync.
