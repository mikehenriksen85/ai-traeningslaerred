# Daily Start-Wizard: mobilrettelse

Dato: 12. juni 2026

## Fejl

Daily Start-Wizard blev kun startet via det interne event
`training-app:ready`. Mobilbrowsere kan genoptage en side fra BFCache eller
hukommelsen uden at udløse dette event igen. Resultatet var, at wizarden kunne
mangle ved mobil genåbning, selv om profil, medlemskab og feature-flag var
gyldige.

## Rettelse

- Controlleren starter nu sikkert via `training-app:ready` og almindelig
  `load`.
- Ved mobil genoptagelse startes kontrollen igen via `pageshow`, når siden
  kommer fra BFCache.
- Eksisterende wizard-roots kontrolleres først, så der ikke oprettes
  dubletter eller overlappende wizards.
- Daily Start-Wizard bruger dynamisk viewport-højde (`dvh`) på mobil.
- Panelet kan scrolle internt og footerknapperne forbliver tilgængelige.
- Touchmål på valg og knapper er mindst 48 px.
- Feature-flaget `ENABLE_DAILY_START_WIZARD` respekteres fortsat.

## Test

Testet i Chrome ved:

- 360 px
- 390 px
- 430 px
- 1366 px

På alle størrelser blev følgende bekræftet:

- Tre motivationsvalg: Lav, Normal og Høj.
- Automatisk skift til trin 2 efter valg.
- Tre handlinger på trin 2.
- Motivationskortet vises.
- Ingen vandret scrolling.
- Dialogen ligger over header, menu og cards med z-index 1000.
- Dialogen vises igen efter simuleret mobil BFCache-genoptagelse.
- Wizarden forbliver skjult, når feature-flaget er `false`.
- Ingen JavaScript- eller console-fejl.

## Bemærkning

Profil- og medlemskabsdata gemmes fortsat i lokal browserlagring. En fysisk
mobiltelefon og en desktopbrowser deler derfor ikke automatisk status, før
Firebase/cloud-synkronisering implementeres.
