# Kvalitetsrapport

Dato: 11. juni 2026

## Testomfang

Appen er testet i lokal Chrome ved følgende viewport-størrelser:

- Mobil: 360, 390 og 430 px
- Tablet: 768 px
- Desktop: 1024, 1366 og 1920 px

Regressionen dækkede onboarding, daglig wizard, flerdagsprogrammer, aktive
øvelseskort, manuel øvelsesvælger, AI Erstat, Copilot-adgang, Demo-link,
simulering/dashboard, timere, beregninger, kropsmålinger, medlemskab,
Premium-regler og lokal datalagring.

## Fundne og rettede fejl

1. Aktive øvelseskort skabte 23 px vandret sidescrolling ved 360 px.
   Sættabellens mobilkolonner, inputfelter og timerknapper er komprimeret.

2. Tabeloverskrifterne "Tidligere" og "Vægt" kolliderede på små skærme.
   Mobilen viser nu de korte etiketter "Sidst" og "Kg".

3. Medlemskabskortene blev for smalle ved 768 px.
   Tabletvisningen bruger nu et stabilt 2 x 2-grid.

4. Browseren rapporterede en 404-fejl for manglende favicon.
   Et indlejret tomt favicon fjerner netværksfejlen.

5. Korrupte værdier i localStorage kunne stoppe appens opstart.
   Centrale læse- og skrivekald bruger nu fælles fejlhåndtering og
   typekontrol.

6. Fyldt eller deaktiveret browserlager kunne fejlagtigt vise "gemt".
   Autosave og manuel lagring viser nu fejlstatus og undgår falsk bekræftelse.

7. Vægt, reps og pause skrev hele træningspasset ved hvert tastetryk.
   Tekstinput bruger nu 250 ms debounce, mens kritiske handlinger fortsat
   gemmes straks.

8. Pausetimere kunne fortsætte efter sletning, ændring af sæt, øvelsesskift
   eller dagsskift.
   Timere ryddes nu deterministisk ved alle relevante rerenders.

## Verificerede beregninger

- 1RM: 100 kg x 5 reps = 116,7 kg med Epley-formlen.
- Volumen: 100 kg x 5 reps = 500 kg.
- BMI: 80 kg og 180 cm = 24,7.
- Progress: færdige sæt divideret med samlede sæt; 0 sæt giver 0%.
- Pause-timer: 1 sekund ender på 0m00s og stopper.
- Træningstimer: opdaterer sekunder korrekt.
- En dags program viser "Dagens træning"; flerdagsprogram viser "Dag X".
- 10 dages prøveperiode, 3/12 måneder, livstid og 30-dages popupinterval.

## Verificerede flows

- Onboarding går automatisk videre ved enkeltvalg.
- Tre valgte træningsdage opretter og gemmer tre dage.
- Testprogrammet indeholdt 7 øvelser pr. dag og 21 unikke øvelser.
- Daglig wizard går videre efter motivation, viser pep-talk og gemmer valget.
- Vægt og reps bevares, når et nyt sæt tilføjes.
- Manuel vælger viser mindst 15 øvelser for den testede muskelgruppe.
- Demo-knappen bygger korrekt Google Video-URL.
- Dashboard og modals holder sig inden for viewporten.
- Premium og gratis medlemskab håndhæver den forventede adgang.
- Korrupte lokale data falder tilbage til tomme, gyldige datasæt.

## Optimeringer

- Færre synkrone localStorage-skrivninger under indtastning.
- Oprydning af intervals og timere reducerer baggrundsarbejde.
- Genbrug af fælles storage-hjælpere reducerer gentaget fejlhåndtering.
- Responsive grids er tilpasset mobil, tablet og desktop.

## Kendte begrænsninger

- "Log ind" er endnu ikke rigtig autentificering. Profilen gemmes kun lokalt.
- AI-funktionerne er lokale regelbaserede funktioner uden ekstern AI-service.
- Betaling, Firebase og cloud-synkronisering er endnu kun forberedt/demo.
- Demo-videoer kræver internetadgang og tilladelse til at åbne en ny fane.
- Data deles ikke mellem browsere eller enheder uden fremtidig cloud-backup.

## Ændrede filer

- `index.html`
- `QA-REPORT.md`
- Synkroniseret GitHub-projekt og ZIP-pakke

Det automatiske testgrundlag ligger i projektets arbejdsmappe som
`qa-regression.cjs`, og testresultater/skærmbilleder ligger i `qa-artifacts`.
