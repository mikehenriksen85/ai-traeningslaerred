# Firestore-integration

## Status

Firestore er primær datakilde for autentificerede brugere.
`localStorage` bruges som UID-opdelt cache og fallback med nøgler i formatet
`workit:{uid}:...`. En brugers lokale data kan derfor ikke læses af en anden
bruger på samme enhed.

## Firestore-struktur

```text
users/{uid}
  profile/main
  profile/daily
  profile/membership
  profile/appState
  profile/syncMetadata
  activeWorkout/current
  programs/{programId}
    days/{dayId}
  workoutSessions/{sessionId}
  bodyMeasurements/{measurementId}
  aiCopilotHistory/{messageId}
  imports/{importId}
  customExercises/{exerciseId}
  deletedPrograms/{programId}
```

Programdage indeholder øvelser, sæt, reps, vægt og pauser som strukturerede
felter. Dashboard og Min udvikling beregnes fortsat ud fra
`workoutSessions` og `bodyMeasurements`.

## Migration

Efter første login kontrollerer `firestore-cloud-service.js`, om der findes
gamle globale data fra før kontoadskillelsen. Tilbuddet vises kun én gang.
Brugeren vælger mellem:

- `Ja, knyt data til min konto`
- `Nej, spring gamle data over`

Ved accept kopieres data til brugerens eget `users/{uid}`-område.
`migrationCompleted` og `migrationCompletedAt` gemmes både på brugerroden og
i `profile/syncMetadata`. LocalStorage-data beholdes.

Firestore fortsætter som primær datakilde for nye data, selv hvis de gamle
globale data springes over.

## Synkronisering og fallback

Ved login:

1. Firestore hentes før UID-cachen bruges.
2. Nyeste `updatedAt` vinder ved konflikt.
3. Dokumenter opdateres enkeltvis med merge; collections erstattes ikke blindt.
4. Aktiv træning gemmes i `activeWorkout/current` og fjernes ved afslutning.
5. Hvis Firestore fejler, fortsætter appen med den aktive brugers UID-cache.

## Medlemskab

Medlemskab er fortsat klientstyret demo-data. Det er ikke produktionssikker
adgangskontrol. Autoritativ Premium-status skal senere flyttes til backend
eller Cloud Functions og håndhæves med serverudstedte claims.

## Security Rules

Forslaget ligger i `firestore.rules`. Reglerne tillader kun en autentificeret
bruger at læse og skrive under sit eget `users/{uid}`-område. Filen er ikke
automatisk deployet.
