# Automatisk træningspas: Antal øvelser

## Implementeret

- Generatoren viser indstillingen "Antal øvelser".
- Brugeren kan vælge fra 1 til 8 øvelser.
- Standardværdien er 5.
- En kort forklaring og en tydelig knap til oprettelse vises efter valg af træningstype.
- Det valgte antal gemmes på den aktuelle træningsdag.
- Automatisk generator og AI Copilot bruger det valgte antal.
- Motivation må fortsat ændre sæt, volumen, intensitet og pauser, men bevarer det valgte antal øvelser.
- Copilot tilføjer ikke ekstra øvelser over den valgte grænse.
- Eksisterende og ældre gemte træningspas fungerer fortsat uden en antalsgrænse.

## Test

- Fullbody: 1-8 øvelser testet.
- Push: 1-8 øvelser testet.
- Pull: 1-8 øvelser testet.
- I alt 24 generator-kombinationer oprettede præcis det valgte antal.
- Copilot-generering respekterede indstillingen.
- Motivation bevarede indstillingen.
- Mobil testet ved 360, 390 og 430 px uden vandret scrolling.
- Desktop testet ved 1366 px.
- Ingen JavaScript- eller browserfejl blev registreret.
