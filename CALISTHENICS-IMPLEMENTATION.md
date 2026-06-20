# Work4it Calisthenics-implementation

Dato: 20. juni 2026

## Profil og Firestore

Træningsprofilen indeholder nu feltet `preferredTrainingStyle` med værdierne:

- `gym` - 🏋️ Fitnesscenter
- `calisthenics` - 🤸 Calisthenics
- `hybrid` - 🔄 Begge dele

Feltet gemmes sammen med resten af profilen i:

`users/{uid}/profile/main`

Den eksisterende `saveProfileToCloud()` bruger `setDoc(..., { merge: true })`, og
profilen hentes igen af `hydrateFromFirestore()` før lokal cache. Der er derfor
ikke behov for nye collections eller ændrede Security Rules.

Ældre profiler får automatisk standardværdien `hybrid`.

## Manuelle programmer

"Opret tomt træningspas" har nu et selvstændigt valg for Calisthenics.
Øvelsesvælgeren har et Calisthenics-filter, som kun viser kropsvægtsøvelser.

Brugeren kan fortsat:

- tilføje og fjerne øvelser
- erstatte øvelser
- ændre sæt, reps og pauser
- oprette egne Calisthenics-øvelser direkte i vælgeren
- gemme egne øvelser i øvelsesarkivet

`trainingStyle` gemmes på øvelsen og bevares ved gemning, genåbning og
erstatning.

## AI-programskabeloner

Generatoren indeholder otte skabeloner:

1. Begynder Calisthenics
2. Calisthenics Muskelopbygning
3. Calisthenics Styrke
4. Hjemmetræning uden udstyr
5. Pull-up Mastery
6. Dip Mastery
7. Muscle-up Progression
8. Avanceret Street Workout

Brugeren kan vælge 1-8 øvelser. Hver skabelon har op til otte ordnede øvelser
med egne forslag til sæt, reps og pauser.

## AI-regler

`TrainingGoalEngine.rankExercisesForGoals()` bruger nu både prioriterede mål og
foretrukken træningsstil.

- `calisthenics`: kropsvægt, bars, ringe og skills får høj prioritet; maskiner,
  kabler og frie vægte nedprioriteres.
- `gym`: vægte, kabler og maskiner prioriteres; rene calisthenicsøvelser får
  lavere prioritet.
- `hybrid`: begge grupper er tilladt og må kombineres ud fra træningsmålene.

Profilwizard, almindelig automatisk generator, målbaseret AI-generator og
AI-konteksten bruger samme `preferredTrainingStyle`.

## Nye Calisthenics-øvelser

47 øvelser/progressioner er nu officielt markeret som Calisthenics:

- Incline Push-up
- Knee Push-up
- Push-ups
- Diamond Push-up
- Decline Push-up
- Archer Push-up
- Pseudo Planche Push-up
- Ring Push-up
- Australian Pull-up
- Scapular Pull-up
- Negative Pull-up
- Band-Assisted Pull-up
- Pull-ups
- Chin-ups
- Archer Pull-up
- Chest-to-Bar Pull-up
- Explosive Pull-up
- Muscle-up Transition
- Bar Muscle-up
- Negative Muscle-up
- Pike Push-up
- Wall Handstand Hold
- Handstand Push-up Progression
- Wall Handstand Push-up
- Planche Lean
- Bodyweight Squat
- Assisted Pistol Squat
- Pistol Squat
- Walking Lunge
- Bulgarian Split Squat
- Single-Leg Glute Bridge
- Nordic Curl Progression
- Bench Dip
- Parallel Bar Dip
- Straight Bar Dip
- Ring Dip
- Korean Dip
- Negative Dip
- Hollow Body Hold
- Hanging Knee Raise
- Hanging Leg Raise
- L-Sit Tuck
- L-Sit
- Dragon Flag Progression
- Toes-to-Bar
- Superman Hold
- Arch Body Hold

Eksisterende øvelser genbruges uden dubletter.

## Test

- JavaScript-syntaks for alle ændrede filer og inline scripts: bestået.
- Profilgemning og ugyldig style-fallback: bestået.
- AI-rangering: Calisthenics vælger Push-ups over Barbell Bench Press.
- AI-rangering: Fitnesscenter vælger Barbell Bench Press over Push-ups.
- Alle otte skabeloner registreret: bestået.
- 47 officielle Calisthenics-definitioner registreret: bestået.
- Manuelt tomt Calisthenics-pas og egne øvelser: kontrolleret.

## Filer

Ændret:

- `index.html`
- `wizard-store.js`
- `profile-wizard.js`
- `profile-account.js`
- `training-goal-engine.js`
- `ai-system.js`
- `service-worker.js`

Oprettet:

- `CALISTHENICS-IMPLEMENTATION.md`

Firebase Authentication, Firestore-struktur, Security Rules, medlemskab og
eksisterende træningsdata er ikke ændret.
