# Daglig motivation: Titel og muskelgruppevalg

## Årsag

Et tidligere automatisk eller autogemt træningspas kunne stadig have titlen eksempelvis:

`Styrke: Fullbody Pas (9 øvelser)`

Når den daglige motivation reducerede øvelseslisten, blev den gamle titel genbrugt uden at opdatere antal eller træningstype. Muskelgruppevalget blev desuden kun vist, hvis træningsvinduet var helt tomt.

## Rettelse

- "Tilpas dagens træning efter min motivation" spørger nu altid:
  "Hvilke muskelgrupper ønsker du at træne i dag?"
- Det tidligere træningspas vælger ikke automatisk Fullbody.
- Programmet genereres kun fra de muskelgrupper, brugeren vælger i dialogen.
- Titlen bygges efter generering ud fra:
  - brugerens træningsmål
  - de valgte muskelgrupper
  - det faktiske antal genererede øvelser
- Standarderne er:
  - Lav: 3 øvelser
  - Normal: 5 øvelser
  - Høj: 8 øvelser
- Et eksplicit antal valgt i "Automatiske træningspas" bevares fortsat.

## Test

- Lav: 3 øvelser og korrekt titel.
- Normal: 5 øvelser og korrekt titel.
- Høj: 8 øvelser og korrekt titel.
- Gammel Fullbody-titel fjernes.
- Kun valgte muskelgrupper anvendes.
- Testet ved 1366 px samt 360, 390 og 430 px.
- Ingen JavaScript- eller browserfejl blev registreret.
