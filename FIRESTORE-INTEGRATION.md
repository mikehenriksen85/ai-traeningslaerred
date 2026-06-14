# Firestore-integration

## Status

Firestore er primær datakilde for brugere, som har accepteret migrationen.
`localStorage` bevares som lokal backup og fallback. Lokale data slettes
aldrig automatisk.

## Firestore-struktur

```text
users/{uid}
  profile/main
  profile/daily
  profile/membership
  profile/appState
  profile/syncMetadata
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

Efter første login kontrollerer `firestore-service.js`, om der findes lokale
data. Brugeren vælger mellem:

- `Ja, flyt data`
- `Nej, behold kun lokalt`

Ved accept kopieres data til brugerens eget `users/{uid}`-område.
`migrationCompleted` og `migrationCompletedAt` gemmes både på brugerroden og
i `profile/syncMetadata`. LocalStorage-data beholdes.

Ved afvisning gemmes status `local_only`, og appen fortsætter med lokal
lagring. Migration kan senere startes programmatisk med:

```javascript
window.FirestoreDataService.requestMigration()
```

## Synkronisering og fallback

Når migrationen er gennemført:

1. Firestore hydreres til appens eksisterende lokale datamodel ved login.
2. Eksisterende UI opdateres via `firestore:data-hydrated`.
3. Efterfølgende lokale ændringer synkroniseres automatisk til Firestore.
4. Hvis Firestore fejler, fortsætter appen med de lokale data.

## Security Rules

Forslaget ligger i `firestore.rules`. Reglerne tillader kun en autentificeret
bruger at læse og skrive under sit eget `users/{uid}`-område. Filen er ikke
automatisk deployet.

