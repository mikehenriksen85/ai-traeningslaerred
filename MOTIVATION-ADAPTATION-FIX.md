# Rettelse: Tilpas dagens træning efter motivation

## Fejl

Den tidligere funktion indlæste automatisk det senest gemte træningspas og justerede alle øvelser uden et fast antal øvelser. Det kunne få dagens træning til at skifte muskelgrupper eller opleves som et andet program.

## Rettelse

- Lav motivation giver som standard 3 øvelser.
- Normal motivation giver som standard 5 øvelser.
- Høj motivation giver som standard 8 øvelser.
- Hvis brugeren har valgt et bestemt antal i den automatiske generator, bevarer motivationstilpasningen dette antal.
- Nye øvelser vælges kun fra muskelgrupper, der allerede findes på den aktive træningsdag.
- Profilens fokusområder bruges kun til prioritering inden for de tilladte muskelgrupper.
- Træningsmål, split, antal træningsdage og øvrige træningsdage ændres ikke.
- Motivation justerer fortsat sæt, vægt/intensitet og automatiske pauser.
- Manuelt ændrede pauser overskrives ikke.
- Uden en aktiv træning vises dialogen: "Hvilke muskelgrupper ønsker du at træne i dag?"
- Ved valg af "Tilpas dagens træning efter min motivation" vises muskelgruppe-dialogen altid, så et tidligere pas ikke automatisk bestemmer dagens muskelgrupper.
- Titlen opdateres med de valgte muskelgrupper og det faktiske antal øvelser.

## Test

Automatiske browserprøver er gennemført ved 1366 px samt 360, 390 og 430 px.

- 3/5/8 øvelser verificeret.
- Push-dage forbliver Push.
- Pull-dage forbliver Pull.
- Øvrige træningsdage og træningsmålet forbliver uændrede.
- Muskelgruppe-dialogen er responsiv og uden vandret scrolling.
- Ingen JavaScript- eller browserfejl blev registreret.
