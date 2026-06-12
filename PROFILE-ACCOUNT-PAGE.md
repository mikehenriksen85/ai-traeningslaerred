# Træningsprofil: Profil- og kontoside

## Ændret adfærd

- Klik på Træningsprofil åbner nu en samlet profil- og kontoside.
- Profil-wizarden starter ikke længere automatisk ved klik.
- Den eksisterende wizard er bevaret og åbnes via knappen "Åbn profil-wizard igen".
- Nye brugere får fortsat den automatiske onboarding-wizard, indtil profilopsætningen er gennemført.

## Profilsidens sektioner

### Personlige oplysninger

- Navn
- Alder
- Køn
- Højde
- Vægt
- Fedtprocent
- Muskelmasse
- Personligt mål

Seneste gemte kropsmåling bruges som fallback, hvis et felt ikke tidligere findes i profilen.

### Træningsopsætning

- Træningsmål
- Erfaring
- Fokusområder
- Træningsdage pr. uge
- Øvelsespræference

Alle ændringer gemmes i den eksisterende lokale profil og kan fortsat bruges af generatoren og AI Copilot.

### Konto og sikkerhed

- Loginstatus og aktiv e-mail vises.
- E-mail-login, Google-login, logout, adgangskode og e-mailændring er synlige.
- Funktionerne er deaktiverede og markeret "Klar til Firebase", indtil Firebase implementeres.

### Data og privatliv

- Eksport af alle lokale appdata som JSON.
- Ryd lokale data med tydelig bekræftelse.
- Konto-sletning og GDPR-info er klargjort som kommende funktioner.

## Test

- Eksisterende profil- og kropsdata indlæses korrekt.
- Profilændringer gemmes lokalt.
- Kropsændringer tilføjes til målehistorikken.
- Gemte træningspas ændres ikke.
- Profil-wizard åbnes kun fra den nye knap.
- Eksportfunktion verificeret.
- Datarydning sker ikke uden bekræftelse.
- Testet ved 1366, 360, 390 og 430 px.
- Ingen vandret scrolling eller JavaScript-fejl registreret.
