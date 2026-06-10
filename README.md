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
- Lokal lagring i browseren

## Projektstruktur

```text
.
├── index.html
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

## GitHub Pages

1. Upload alle filer til roden af et GitHub-repository.
2. Åbn repositoryets **Settings**.
3. Vælg **Pages**.
4. Vælg **Deploy from a branch**.
5. Vælg branch `main` og mappe `/ (root)`.

Appen bliver derefter udgivet direkte fra `index.html`.

## Data

Træningspas, historik og kropsmål gemmes i browserens `localStorage`.
Data følger derfor ikke automatisk med mellem forskellige browsere eller enheder.

## Licens

MIT License. Se `LICENSE`.
