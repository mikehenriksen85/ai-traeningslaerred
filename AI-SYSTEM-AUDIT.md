# Work4it AI-systemaudit

Dato: 19. juni 2026  
AI-lag: lokal, regelbaseret logik (ingen ekstern sprogmodel er forbundet)

## Konklusion

Work4its aktive AI-funktioner er deterministic JavaScript-logik. Der sendes i dag
ingen prompts eller persondata til OpenAI, Gemini, Anthropic eller andre
AI-leverandører. Betegnelsen "AI" dækker kommando-fortolkning, rangering af
øvelser, målstyrede træningsregler og forslag fra appens eget øvelseskatalog.

Det eksisterende system virker til de understøttede danske kommandoer, men havde
ikke ét samlet prompt-/policy-lag, kun begrænset engelsk forståelse og ingen samlet
dataminimeret AI-kontekst. Disse områder er nu samlet i `ai-system.js`.

## 1. Eksisterende prompts og regler

Der fandtes ingen eksterne system- eller user-prompts. De aktive "prompts" var:

1. **AI Træningsassistent** (`ai-copilot-actions.js`, `index.html`)
   - Regeludtryk for profil, træningsmål, motivation, programdag, cardio,
     tilføj/fjern/erstat øvelse, sæt, reps, kg og pauser.
   - Faste bekræftelser efter en udført handling.
   - Opklarende svar ved den kendte tvetydighed "træne mere ryg".
2. **AI-programgenerator** (`training-goal-engine.js`, `profile-wizard.js`,
   `index.html`)
   - Fem målprofiler: muskelopbygning, vægttab, styrke, generel sundhed og cardio.
   - Regler for split, rangering, sæt, reps, pauser og antal øvelser.
3. **AI-øvelsesforslag** (`index.html`)
   - Samme muskelgruppe, lettere, hårdere, hjemme, center, samme muskelgruppe og
     uden maskiner.
   - Maksimalt tre forslag fra det lokale katalog og manuel godkendelse før skift.
4. **AI-profilanalyse**
   - Ingen selvstændig analysefunktion. Profilen bruges som generator-kontekst.
5. **AI-cardio**
   - Lokale kommandoer for cardioøvelser, distance, tid, måneds-/årsoversigt og
     programgenerering.
6. **AI-calisthenics**
   - Ingen dedikeret generator. Kropsvægt genkendes som udstyrskategori i
     øvelsesforslag.
7. **Screenshot-import**
   - Menupunkt og Firestore/import-datastruktur findes, men selve analyse/importen
     er deaktiveret. Ingen billeddata sendes nogen steder.
8. **Onboarding-prototype** (`onboarding-wizard.js`)
   - En ældre, separat prototypegenerator findes, men den aktive profilwizard
     bruger `profile-wizard.js` og `training-goal-engine.js`.

## 2. Nye centrale promptskabeloner

`ai-system.js` indeholder nu én versioneret promptkatalog-kilde:

| Prompt | Brug |
|---|---|
| `assistant` | Kommando, opklaring, ét konkret svar og programbeskyttelse |
| `programGenerator` | Mål, erfaring, fokus, dage, øvelsesantal og realistisk volumen |
| `exerciseSuggestions` | Tre relevante alternativer og brugerens godkendelse |
| `profileAnalysis` | Dataminimeret forklaring af profilvalg |
| `cardio` | Tid, distance, puls, historik og ingen opdigtede målinger |
| `calisthenics` | Kropsvægt, progression/regression og realistisk niveau |
| `screenshotImport` | Kun synlige data, usikkerhedsmarkering og godkendelse før gemning |

Promptreglerne kræver samme sprog som brugerens input, korte praktiske svar,
ingen konto-/betalingsændringer, ingen diagnose og ingen programoverskrivning
uden en udtrykkelig handling.

## 3. Data til AI-kontekst

`Work4itAISystem.buildContext()` samler lokalt:

- træningsmål
- personligt/prioriteret mål
- erfaring
- fokusområder
- øvelsespræference/træningsstil
- antal træningsdage
- foretrukket antal øvelser
- tilgængeligt udstyr, hvis feltet senere udfyldes
- alder, køn, højde, vægt, fedtprocent og muskelmasse
- dagens motivation
- aktivt program, aktiv dag, øvelser og antal sæt
- aggregeret historik for de seneste 20 sessioner
- medlemskabstype og den viste AI-request-grænse

Konteksten indeholder ikke navn, e-mail, uid, adgangskode eller loginoplysninger.
`externalModelContext()` udelader kropsdata som standard. De kan kun medtages ved
et eksplicit `includeBody: true`, hvis en ekstern model senere tilkobles med
samtykke og korrekt databehandlergrundlag.

## 4. Gennemførte forbedringer

- Tilføjet central, versioneret AI-policy og promptkatalog.
- Tilføjet dataminimeret AI-kontekst for profil, aktivt program og historik.
- Udvidet struktureret Copilot-parser med engelske kernekommandoer.
- Tilføjet samme-sprog-detektion for dansk og engelsk.
- Blokeret sikkerheds-, login-, betalings- og medlemskabsændringer i AI-laget.
- Tilføjet sundhedsfaglig grænse ved smerte, skade, diagnose og medicin.
- Tilføjet samme sikkerhedsgrænse i det frie AI-erstatningsfelt.
- Udvidet engelske filtre for hjemme, center, håndvægte og uden maskiner.
- Redigeret vægt, kropsdata og e-mail i den gemte Copilot-kommandohistorik.
- Tilføjet AI-systemet til app-start og PWA-cache med ny cacheversion.
- Eksisterende bekræftelse før manuel øvelseserstatning er bevaret.

## 5. Konsistens og programbeskyttelse

- Generatoren bruger kun øvelser fra Work4its lokale katalog.
- Sæt, reps og pauser valideres med faste intervaller.
- Valgt antal øvelser respekteres af den automatiske generator.
- Programkommandoer ændrer kun den aktive dag eller det aktive program.
- Øvelsesvælgerens AI-forslag udfører ikke erstatningen før brugerens valg.
- En eksplicit Copilot-kommando som "fjern squat" regnes som brugerens aktive
  valg. Ukendte eller tvetydige kommandoer giver fejl/opklaring.

## 6. Privatliv og sundhed

- Ingen data sendes til tredjeparts-AI i den nuværende version.
- Rå profil- og kropsværdier gemmes ikke længere ordret i ny AI-historik.
- Eksisterende historik er ikke ændret eller slettet.
- Sundhedsrelateret input giver en tydelig grænse: Work4it kan tilpasse træning,
  men ikke diagnosticere eller erstatte læge/fysioterapeut.
- Et fremtidigt eksternt AI-kald skal bruge `externalModelContext()` og kræver
  opdateret privatlivsinformation, DPA, retention-policy og samtykkegrundlag.

## 7. Medlemskab og request-grænser

Planernes grænser findes i `membership.js` (3, 15 eller 30 requests), men appen
tæller eller håndhæver dem ikke. Gratisbrugere blokeres desuden i dag fra hele
Copilot-funktionen via Premium-gaten. Det stemmer ikke fuldt overens med teksten
"Gratis: 3 AI Requests".

Dette er **ikke ændret**, fordi medlemskabslogik udtrykkeligt ligger uden for
denne opgave. En sikker løsning kræver server-side tælling (Cloud Function eller
backend), idempotente usage-events og serververificeret medlemskab. Klientbaseret
tælling kan omgås og må ikke bruges som produktionskontrol.

## 8. Mangler og risici

1. Ingen ekstern generativ AI er tilkoblet; svar er begrænset til kendte regler.
2. Historik og kropsdata samles nu som kontekst, men den nuværende regelgenerator
   bruger kun dele af konteksten til selve øvelsesvalget.
3. Tilgængeligt udstyr har ikke et etableret profilfelt og er derfor normalt tomt.
4. Der findes ingen selvstændig profil-analysevisning.
5. Calisthenics har ikke en selvstændig generator eller progressionsmodel.
6. Screenshot-import har ingen OCR/billedanalyse og er korrekt markeret inaktiv.
7. AI-request-forbrug håndhæves ikke server-side.
8. Den ældre onboarding-prototype har et separat, enklere generatorregelsæt og
   bør senere fjernes eller kobles til den centrale motor, hvis feature-flaget
   stadig skal kunne aktiveres.

## 9. Test

Lokale automatiske kontroller:

- JavaScript-syntaks for `ai-system.js`, `ai-copilot-actions.js`,
  `service-worker.js` og alle inline scripts.
- Dansk målkommando.
- Engelsk målkommando.
- Engelsk profilopdatering.
- Engelsk dagsnavigation.
- Engelsk øvelseserstatning.
- Sundhedsgrænse ved smerte.
- Sikkerhedsgrænse ved adgangskode.
- Redigering af kropsværdi og e-mail i AI-historik.

Resultat: alle kontroller bestået.

## 10. Filer

Oprettet:

- `ai-system.js`
- `AI-SYSTEM-AUDIT.md`

Ændret:

- `ai-copilot-actions.js`
- `index.html`
- `service-worker.js`

Firebase Authentication, Firestore-struktur, medlemskabslogik og eksisterende
træningsprogrammer er ikke ændret.
