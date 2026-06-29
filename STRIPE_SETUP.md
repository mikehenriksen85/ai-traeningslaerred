# Work4it Stripe Setup

Stripe-integrationen er implementeret som sikker Firebase Functions-backend.
Frontend må ikke aktivere betalte medlemskaber direkte.

## Status

- Stripe Checkout-flow er implementeret.
- Betalte planer opretter en Checkout-session via Firebase Function.
- Premium aktiveres først af Stripe webhook efter bekræftet betaling.
- Firestore Rules blokerer klienten fra selv at skrive betalt Premium-status.
- Gratis version og prøveperiode fungerer fortsat uden betaling.
- Firebase-projektet `workout-b55ed` er på Blaze.
- `createStripeCheckoutSession` og `stripeWebhook` er deployet i `europe-west1`.
- `STRIPE_SECRET_KEY` og `STRIPE_WEBHOOK_SECRET` er sat i Secret Manager.
- Stripe Sandbox-webhook og Sandbox Price IDs er oprettet.

## Firebase krav

Projektet `workout-b55ed` skal fortsat forblive på Firebase Blaze-planen, fordi Stripe-flowet bruger Cloud Functions og Secret Manager.

## Stripe secrets

Secrets er allerede sat. Hvis de skal roteres senere, kør fra projektroden:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY --project workout-b55ed
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project workout-b55ed
```

Brug testnøgler først:

- `STRIPE_SECRET_KEY`: `sk_test_...`
- `STRIPE_WEBHOOK_SECRET`: `whsec_...`

Læg aldrig Stripe-nøgler i frontend, GitHub eller `.env` der committes.

## Deploy

Når secrets er sat:

```bash
firebase deploy --only functions,firestore:rules,hosting:app --project workout-b55ed
```

Hvis du kun vil deploye backend først:

```bash
firebase deploy --only functions,firestore:rules --project workout-b55ed
```

## Stripe webhook

Efter Functions deploy skal webhooken oprettes i Stripe Dashboard.

Forventet endpoint:

```text
https://europe-west1-workout-b55ed.cloudfunctions.net/stripeWebhook
```

Events:

- `checkout.session.completed`
- `checkout.session.expired`

Kopier webhook signing secret fra Stripe og gem den som:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project workout-b55ed
```

## Planer

Work4it bruger prisstrategi 1.0.

Aktive Sandbox Price IDs:

- Premium 3 måneder: `price_1TnhepJ8DJiiK3vDoqAb7oqY`
- Premium 12 måneder: `price_1Tnhf9J8DJiiK3vDpQe8srVl`
- Livstid: `price_1TnhfNJ8DJiiK3vDCYTp8C4e`

Frontend sender kun plan og Price ID til backend. Backend validerer, at Price ID matcher den valgte Work4it-plan, og opretter Checkout-sessionen med Stripe Price ID.

## Firestore paths

Checkout sessioner:

```text
users/{uid}/checkoutSessions/{sessionId}
```

Medlemskab:

```text
users/{uid}/membership/main
```

Efter betaling opdaterer webhooken:

- `membershipType`
- `membershipStatus`
- `membershipPrice`
- `membershipStartedAt`
- `membershipExpiresAt`
- `stripeCustomerId`
- `stripeSessionId`
- `stripePriceId`
- `stripeSubscriptionId`
- `isPremium`
- `aiRequestLimit`
- `aiResetDate`

## Testplan

1. Log ind på `https://app.work-4it.dk`.
2. Åbn Medlemskab.
3. Vælg Premium 3 måneder.
4. Bekræft at Stripe Checkout åbner.
5. Gennemfør med Stripe testkort:

```text
4242 4242 4242 4242
```

6. Bekræft redirect tilbage til Work4it.
7. Bekræft at `users/{uid}/membership/main` får `membershipStatus: "active"`.
8. Bekræft at Premium vises på mobil og desktop.
9. Afbryd et Checkout-flow og bekræft, at medlemskab ikke ændres.

## Før live-betaling

- Skift Stripe testnøgler til live-nøgler.
- Opret live webhook endpoint.
- Sæt live `STRIPE_SECRET_KEY`.
- Sæt live `STRIPE_WEBHOOK_SECRET`.
- Gennemfør en rigtig lavbeløbsbetaling eller Stripe live test efter Stripe-godkendelse.
- Overvej Cloud Functions/custom claims til endnu stærkere serverbeskyttet Premium-adgang.
