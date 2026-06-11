# AI Training Canvas

En statisk dansk træningsapp til planlægning, registrering og analyse af træning.

## Funktioner

- Opret og gem træningspas
- Manuel og automatisk valg af øvelser
- Egne øvelser gemt lokalt
- Sæt, vægt, reps og pause-timere
- Automatisk pauseforslag og estimeret træningstid
- Live progress-ring for gennemførte sæt
- Estimeret 1RM og træningsvolumen
- Simulering af fremgang
- Dashboard og træningshistorik
- Siden Min udvikling med diagrammer og kropsmål
- Papirkurv med gendannelse og automatisk sletning efter 30 dage
- Separat profil-wizard til nye brugere
- Kort daglig start-wizard til kendte brugere
- Profilredigering og lokalt gemte træningspræferencer
- Målstyret programgenerator for muskelopbygning, vægttab, styrke og generel sundhed
- Målbaserede øvelsesvalg, rep-intervaller, sæt, pauser, split og Copilot-anbefalinger
- Fler-dages træningsprogrammer med dag-navigation og separat dagsdata
- Lokal lagring i browseren

## Projektstruktur

```text
.
├── index.html
├── training-goal-engine.js
├── workout-program-store.js
├── wizard-store.js
├── profile-wizard.js
├── daily-start-wizard.js
├── wizard-controller.js
├── serve.cjs
├── package.json
├── .gitignore
├── .nojekyll
├── LICENSE
└── README.md
```

## Kør lokalt

Appen kan åbnes direkte via `index.html`.

Den kan også startes med Node.js:

```bash
npm start
```

Åbn derefter:

```text
http://127.0.0.1:8767/index.html
```

Der kræves ingen installation af dependencies.

## Profil- og start-wizard

De to flows ligger i separate komponenter:

- `profile-wizard.js` bruges til førstegangsopsætning og profilredigering.
- `daily-start-wizard.js` hjælper kendte brugere i gang med dagens træning.
- `wizard-store.js` gemmer profil, motivation og seneste aktive træningspas.
- `wizard-controller.js` vælger det korrekte flow ved opstart.

Komponenterne aktiveres eller deaktiveres nederst i `index.html`:

```javascript
window.ENABLE_PROFILE_WIZARD = true;
window.ENABLE_DAILY_START_WIZARD = true;
```

Sæt et flag til `false` for at deaktivere det pågældende flow. Profil-wizarden
vises kun automatisk, indtil profilopsætningen er gennemført. Derefter vises
den korte daglige wizard ved appstart. Den fulde profilopsætning kan altid
åbnes igen fra profilområdet i venstremenuen.

Profil-wizarden genererer ét forskelligt træningspas pr. valgt træningsdag. Alle
genererede pas gemmes under **Gemte Træningspas**, og det første pas åbnes
automatisk i træningsvinduet.

## Målstyret træning

`training-goal-engine.js` er den fælles regelmotor for træningsmål. Den bruges
af profil-wizarden, den automatiske programgenerator, AI Erstat og Canvas
Copilot.

- **Muskelopbygning:** 6-15 reps, moderat til høj volumen og hypertrofi-split.
- **Vægttab:** helkropsrotation, store bevægelser, korte pauser og høj tæthed.
- **Styrke:** tunge basisløft, typisk 3-6 reps og lange pauser.
- **Generel sundhed:** balanceret styrke, stabilitet og funktionel træning.

Brugerens direkte ændringer af vægt, reps og manuelle pauser har fortsat
forrang. Når profilmålet ændres, bruges det nye mål til fremtidige programmer
og Copilot-forslag.

## Fler-dages programmer

Wizard-programmer gemmes som én programbeholder med separate dage. Hvis
brugeren vælger tre træningsdage, vises **Dag 1**, **Dag 2** og **Dag 3** i
træningsvinduet. Hver dag har egne øvelser, sæt, reps, pauser og timer.

`workout-program-store.js` normaliserer programdata og gør eksisterende
enkeltpas bagudkompatible ved at behandle dem som programmer med én dag.
Eksisterende data migreres først til det nye format, når brugeren gemmer.

Canvas Copilot understøtter blandt andet:

- `Vis Dag 2`
- `Næste dag`
- `Forrige dag`
- `Tilføj mere ryg`
- `Flyt øvelse 2 til Dag 3`
- `Flyt biceps til Dag 3`

## GitHub Pages

1. Upload alle filer til roden af et GitHub-repository.
2. Åbn repositoryets **Settings**.
3. Vælg **Pages**.
4. Vælg **Deploy from a branch**.
5. Vælg branch `main` og mappe `/ (root)`.

Appen bliver derefter udgivet direkte fra `index.html`.

## Data

Træningspas, historik, kropsmål, profilvalg og wizard-status gemmes i browserens `localStorage`.
Data følger derfor ikke automatisk med mellem forskellige browsere eller enheder.

## Licens

MIT License. Se `LICENSE`.
