# Work4it GDPR- og databeskyttelsesgennemgang

Dato: 2026-06-19
Status: Teknisk compliance-forbedring og risikovurdering. Dette dokument er ikke juridisk rådgivning og skal gennemgås af en jurist før kommerciel lancering.

## Grundlag

Work4it behandler persondata, fordi appen knytter data til en identificerbar bruger via Firebase Authentication og gemmer profil-, trænings- og kropsdata. Efter GDPR-principperne skal behandling være lovlig, rimelig, gennemsigtig, formålsbegrænset, dataminimeret, korrekt, opbevaringsbegrænset, fortrolig og ansvarlig.

## 1. Personoplysninger der indsamles

- Konto/login: Firebase uid, e-mail, displayName, photoURL, emailVerified, providerIds og loginstatus.
- Profil: navn, alder, køn, højde, vægt, fedtprocent, muskelmasse, personligt mål.
- Træningsopsætning: mål, erfaring, fokusområder, træningsdage pr. uge, øvelsespræference, foretrukket antal øvelser, daglig motivation.
- Træningsdata: træningspas, øvelser, cardio, sæt, reps, kg, pauser, gennemført-status, sessionstid, kalorieestimat, 1RM og volumen.
- Historik/analyse: træningshistorik, personlige rekorder, dashboarddata, Min udvikling, kropsmålinger.
- AI/app: AI Copilot-kommandoer/historik, screenshot-importdata, medlemskabsdemo, appState, syncMetadata, aktiv træning og papirkurv.

## 2. Firestore-data

Primære cloud paths:

- `users/{uid}/profile/main`
- `users/{uid}/profile/daily`
- `users/{uid}/profile/membership`
- `users/{uid}/profile/appState`
- `users/{uid}/profile/syncMetadata`
- `users/{uid}/programs/{programId}`
- `users/{uid}/programs/{programId}/days/{dayId}`
- `users/{uid}/workoutSessions/{sessionId}`
- `users/{uid}/activeWorkout/current`
- `users/{uid}/bodyMeasurements/{measurementId}`
- `users/{uid}/aiCopilotHistory/{eventId}`
- `users/{uid}/imports/{importId}`
- `users/{uid}/customExercises/{exerciseId}`
- `users/{uid}/deletedPrograms/{itemId}`
- `users/{uid}/records/{recordId}`

Alle disse paths er brugerdata og skal kun kunne tilgås af den autentificerede ejer.

## 3. Lokal data

LocalStorage bruges som cache/fallback via UID-scoping. Relevante datatyper:

- Profil og wizard-state
- Gemte træningspas og aktive sessioner
- Historik og kropsmålinger
- AI Copilot-historik og imports
- Medlemskabsdemo og appindstillinger
- Privacy-consent metadata: `work4it:privacyConsent`

Lokal cache må ikke betragtes som eneste kilde, når brugeren er logget ind. Firestore er primær kilde.

## 4. AI-data

Nuværende AI Copilot er primært lokal/regelbaseret app-logik. Kommandohistorik kan indeholde persondata, fordi brugeren kan skrive vægt, mål, skader eller ønsker. Hvis en fremtidig ekstern AI-model anvendes, skal appen opdatere:

- Privatlivspolitik
- Databehandleraftale
- Samtykke eller andet retsgrundlag
- Dataminimering før prompt sendes
- Logging og retention for AI-prompts

## 5. Tredjepart

- Firebase/Google: Authentication, Firestore og Hosting.
- Google Login: hvis brugeren vælger Google som loginmetode.
- Google Search: Demo-knap åbner en Google-videosøgning i ny fane.
- Mailklient: Kontakt-funktion åbner e-mail til support.

Google Analytics SDK er ikke aktivt initialiseret i den nuværende appkode, selv om Firebase-konfigurationen indeholder `measurementId`.

## 6. Dataminimering

Vurdering: Delvist opfyldt.

Positive punkter:

- Mange kropsdata er funktionelt relevante for træningsanalyse.
- Køn kan fravælges i onboarding.
- LocalStorage er UID-scopet.
- Firestore er ejerbeskyttet.

Risici:

- Alder, køn, fedtprocent og muskelmasse er følsomme i praksis og bør være tydeligt frivillige.
- AI Copilot-feltet kan modtage fritekst med helbredsoplysninger.
- Screenshot-import kan potentielt indeholde uvedkommende data.

Anbefaling: Markér frivillige felter tydeligere og tilføj advarsel ved AI/import om ikke at indtaste følsomme helbredsoplysninger ud over det nødvendige.

## 7. Indsigt og eksport

Implementeret:

- `exportProfileData()` bruger nu Firestore-eksport først, hvis brugeren er logget ind.
- `FirestoreDataService.exportCurrentUserData()` samler profil, programmer, dage, historik, kropsmålinger, AI-historik, imports, egne øvelser, aktiv træning, papirkurv og records.
- LocalStorage medtages som backup i eksportfilen.

## 8. Sletning

Implementeret:

- `deleteProfileAccountAndData()` er tilføjet i profilområdet.
- `FirebaseAuthService.deleteAccountAndData()` sletter først Firestore-data og derefter Firebase Authentication-brugeren.
- `FirestoreDataService.deleteCurrentUserData()` sletter kendte brugerdata under `users/{uid}` og rydder lokal cache.

Kendt Firebase-begrænsning:

- Firebase kan kræve nylig login før konto kan slettes (`auth/requires-recent-login`). Appen viser nu en tydelig fejl i det tilfælde.

## 9. Samtykke og information

Implementeret:

- Loginvinduet har nu samtykke til privatlivspolitik og lokal/cloud-lagring ved oprettelse/Google-flow.
- Samtykke gemmes som `work4it:privacyConsent` og forsøges gemt i `users/{uid}/profile/main`.
- Ny menu: `Privatliv / GDPR` med information om data, formål, lagring, AI, tredjepart, rettigheder og kontakt.

Mangler juridisk:

- Endelig privatlivspolitik med korrekt dataansvarlig, CVR/identitet, kontakt, retsgrundlag, databehandlere, overførsler, opbevaringsfrister og klagevejledning.
- Eventuel cookiepolitik, hvis analytics, marketing eller tracking aktiveres.

## 10. Databehandleraftaler

Mangler manuel afklaring:

- Google/Firebase Data Processing and Security Terms skal accepteres/arkiveres som dokumentation.
- Ved eksterne AI-modeller skal der indgås og dokumenteres databehandleraftale, eller der skal vælges en leverandør med passende DPA og EU-transfergrundlag.

## 11. Firebase GDPR-vurdering

Teknisk forbedret:

- Firestore Security Rules kræver `request.auth != null` og `request.auth.uid == uid` for brugerdata.
- Ingen `allow read/write: if true` er observeret.
- Brugerdata ligger under `users/{uid}`.
- Medlemskab og AI-limits er stadig klientstyret/demo og må ikke bruges som sikker adgangskontrol.

Manuel vurdering kræves:

- Firebase-projektets region, databehandleraftale og internationale overførsler.
- Logning i Firebase Console og eventuelle support-/debuglogs.

## 12. Logning og fejlrapporter

Risici:

- Console logs kan vise Firestore paths med uid og fejlobjekter.
- AI-historik kan indeholde persondata skrevet i fritekst.

Anbefaling:

- Undgå at logge rå profil- eller helbredsdata i produktion.
- Tilføj senere en central logmaskering, hvis ekstern fejlrapportering aktiveres.

## 13. Firestore Security Rules

Status: Forbedret.

Reglerne dækker nu også ejerbeskyttede paths for `records`, `workouts`, `history` og `measurements` som legacy/fremtidige aliases. Den afsluttende wildcard-regel afviser alt andet.

## 14. Adgangskontrol

Status: Forbedret, men ikke færdig til betalingsadgang.

- Auth-gate låser appen uden Firebase-session.
- Firestore-regler beskytter brugerdata pr. uid.
- Premium/medlemskab er klientstyret demo og ikke sikker adgangskontrol.

## 15. Implementerede filer

- `index.html`: samtykke, Privatliv/GDPR-menu, aktiv dataeksport og konto-/datasletning.
- `auth-gate.js`: samtykkekrav ved oprettelse/Google-login.
- `auth-service.js`: konto- og datasletning samt privacyConsent metadata.
- `firestore-cloud-service.js`: cloud-eksport og permanent brugerdata-sletning.
- `profile-account.js`: cloud-først eksport, slet konto/data, opdaterede statusbeskeder.
- `firestore.rules`: ekstra ejerbeskyttede paths for records/legacy-data.
- `GDPR-COMPLIANCE-REPORT.md`: denne rapport.

## 16. Resterende juridiske risici

- Endelig juridisk privatlivspolitik mangler.
- Endelig cookiepolitik afhænger af Analytics/marketing/payment.
- DPA og transfergrundlag for Firebase skal dokumenteres.
- Ekstern AI må ikke aktiveres uden DPA, dataminimering og opdateret information.
- Kropsmålinger og træningsdata kan i praksis afsløre sundhedsforhold; vurder om DPIA eller ekstra sikkerhedsforanstaltninger er nødvendige.
- Betaling, medlemskab og premium-adgang kræver server-side håndhævelse før produktion.

## 17. Næste anbefalede trin

1. Deploy nye Firestore Rules.
2. Test eksport på desktop og mobil med samme login.
3. Test konto-/datasletning med en testbruger.
4. Gennemgå Firebase DPA og region/transferindstillinger.
5. Få privatlivspolitik og handels-/medlemsvilkår juridisk gennemgået.
