# Daglig motivation: Én gang pr. kalenderdag

## Implementeret

- Motivations-wizarden vises højst én gang pr. lokal kalenderdag.
- Følgende gemmes lokalt:
  - `dailyMotivation`
  - `dailyMotivationDate`
- Datoformatet er `YYYY-MM-DD` og beregnes ud fra brugerens lokale dato.
- Valget gemmes straks, når brugeren vælger Lav, Normal eller Høj.
- "Spring over" og luk-knappen gemmer dagens eksisterende eller normale motivation, så spørgsmålet ikke gentages samme dag.
- App-start, genindlæsning, navigation, flere træningspas og genåbning af browseren genbruger dagens gemte valg.
- En ny lokal kalenderdag viser motivations-wizarden igen.

## Synlig status

Appen viser:

- `💪 Dagens motivation: Lav`
- `💪 Dagens motivation: Normal`
- `🚀 Dagens motivation: Høj`

Knappen "Skift dagens motivation" åbner wizarden igen kun efter brugerens aktive valg.

## Test

- Første åbning på dagen viser wizarden.
- Genindlæsning samme dag viser den ikke igen.
- Menupunktet Dagens træning viser den ikke igen samme dag.
- Flere træningspas viser den ikke igen samme dag.
- Lukning og genåbning af browserfanen bevarer valget.
- Simuleret ny kalenderdag viser wizarden igen.
- Aktiv ændring fra Lav til Høj opdaterer status og lagring.
- Testet ved 1366, 360, 390 og 430 px.
- Ingen JavaScript- eller browserfejl registreret.
