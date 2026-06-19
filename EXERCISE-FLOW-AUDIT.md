# Work4it øvelsesflow-audit

Dato: 19. juni 2026

## Tidligere flow

### Tomt styrketræningspas

1. Åbn "Opret tomt træningspas".
2. Vælg styrketræning.
3. Klik "Tilføj ny øvelse".
4. Vælg eventuelt Push/Pull/Stabilitet.
5. Vælg muskelgruppe.
6. Vælg øvelse.
7. Klik "Tilføj øvelse".

### Tomt cardio-pas

1. Vælg cardio som træningstype.
2. Klik "Tilføj ny øvelse".
3. Vælg eller behold Cardio-filteret.
4. Vælg "Cardio" igen som muskelgruppe.
5. Vælg cardioøvelse.
6. Klik "Tilføj øvelse".

Cardio blev dermed valgt op til tre gange, og begge flows indeholdt et ekstra
åbningsklik samt en separat bekræftelsesknap efter valget af en konkret øvelse.

## Nyt flow

### Tomt styrketræningspas

1. Vælg styrketræning.
2. Muskelgrupper vises automatisk.
3. Vælg muskelgruppe.
4. Vælg konkret øvelse. Øvelsen tilføjes straks.

### Tomt cardio-pas

1. Vælg cardio.
2. Konkrete cardioøvelser vises automatisk.
3. Vælg øvelse. Øvelsen tilføjes straks.

### Eksisterende og genererede programmer

- Push-programmer åbner direkte med Push-muskelgrupper.
- Pull-programmer åbner direkte med Pull-muskelgrupper.
- Benprogrammer viser kun forside lår samt bagside lår og baller.
- Cardio-programmer åbner direkte med konkrete cardioøvelser.
- Fullbody/mix viser alle relevante muskelgrupper.
- Ved genåbning udledes konteksten fra programmets eksisterende øvelser.

## Fjernede trin

- Ekstra klik på "Tilføj ny øvelse" efter oprettelse af et tomt pas.
- Gentaget valg af Cardio som muskelgruppe, når Cardio allerede er kendt.
- Separat valg + "Tilføj øvelse" for en konkret øvelse.
- Tilbage-navigation til en enkelt kategori, når der kun findes én mulighed.

## Ensartet UI

Mobil, tablet og desktop bruger samme DOM, state og event-handlere. Der findes
ikke separate flows efter skærmstørrelse. Muskelgrupper og øvelser er nu rigtige
knapper med mindst 44 px højde, så tastatur, mus og touch følger samme flow.
Popupens eksisterende viewport-positionering og maksimumhøjde er bevaret.

## Automatiske programmer

Automatisk styrke og cardio opretter fortsat øvelser direkte uden manuelle
mellemtrin. Ændringen påvirker kun den efterfølgende manuelle tilføjelse og
genbruger den kendte programtype.

## Calisthenics

Work4it har kropsvægtsøvelser og et udstyrsfilter, men ingen selvstændig
calisthenics-programtype. Der er derfor ikke et separat calisthenics-flow at
ændre. Kropsvægtsøvelser vælges fortsat via deres relevante muskelgruppe.

## Data og funktionalitet

Ingen øvelsesdata, gemte programmer, Firebase-struktur, medlemskab, AI-logik,
timere, sæt, reps eller historik er ændret. Den eksisterende beskyttelse mod at
bruge en muskelgruppe som øvelsesnavn er bevaret.

## Test

- Inline JavaScript: syntaks OK.
- Direkte tilføjelse af konkret øvelse: kontrolleret.
- Automatisk skip af enkelt kategori: kontrolleret.
- Cardio-kontekst: kontrolleret.
- Kontekst udledt fra genåbnede programmer: kontrolleret.
- Gammelt to-trins valg og gamle state-referencer: fjernet.
- Touch-mål: minimum 44 px.
- Samme flow på mobil, tablet og desktop: fælles kodevej bekræftet.

## Filer

Ændret:

- `index.html`
- `service-worker.js`

Oprettet:

- `EXERCISE-FLOW-AUDIT.md`
