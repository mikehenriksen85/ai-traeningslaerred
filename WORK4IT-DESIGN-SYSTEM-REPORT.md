# Work4it Design System 1.0

Dato: 2026-06-19

## Opdaterede filer

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `public/Pictures/App Ikon V1.png`
- `public/Pictures/App Logo v1.png`
- `public/Pictures/Hero Logo v1.png`
- `scripts/sync-official-assets.cjs`

## Logo v1 bruges her

- Login-side
- Desktop-header
- Profil og konto-side
- Hjælp / Om Work4it-dialog

## Hero-logo v1 bruges her

- Login og splash/loading-visning
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

## Assetstruktur

`public/Pictures` er eneste officielle kilde. Firebase-appens og websitets `Pictures`-mapper genereres automatisk før lokal start og deploy. Der er derfor ingen døde screenshot- eller legacy-logoreferencer i rapporten.

## Branding-status

Work4it er nu det synlige brandnavn i appens metadata, PWA-manifest, login, header, profil, medlemskab og hjælpeside. Tekniske Firebase- og datastrukturnavne med `workout` er bevidst bevaret, fordi de ikke er synlig branding og ellers kunne bryde cloud-sync.
