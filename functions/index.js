"use strict";

const admin = require("firebase-admin");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const Stripe = require("stripe");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const ADMIN_EMAILS = new Set([
  "mikehenriksen85@gmail.com"
]);

const EARLY_ADOPTER_LIMIT = 500;
const PLAN_CONFIG = Object.freeze({
  quarterly: Object.freeze({
    label: "Work4it Premium 3 måneder",
    priceId: "price_1TnhepJ8DJiiK3vDoqAb7oqY",
    fallbackPriceDkk: 59,
    months: 3,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  }),
  semiannual: Object.freeze({
    label: "Work4it Premium 6 måneder",
    priceId: "price_1TomK2J8DJiiK3vD4SfYI4tq",
    fallbackPriceDkk: 109,
    months: 6,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  }),
  yearly: Object.freeze({
    label: "Work4it Premium 12 måneder",
    priceId: "price_1Tnhf9J8DJiiK3vDpQe8srVl",
    fallbackPriceDkk: 199,
    months: 12,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  })
});

const ALLOWED_ORIGINS = new Set([
  "https://app.work-4it.dk",
  "https://work4it-app.web.app",
  "https://work4it-app.firebaseapp.com",
  "http://localhost:8767",
  "http://127.0.0.1:8767"
]);

function isAdminRequest(request) {
  const email = String(request.auth?.token?.email || "").toLowerCase();
  return Boolean(request.auth?.uid && ADMIN_EMAILS.has(email));
}

function authTimestamp(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? admin.firestore.Timestamp.fromDate(date)
    : admin.firestore.FieldValue.serverTimestamp();
}

function authProviderIds(userRecord) {
  return (userRecord.providerData || [])
    .map(provider => provider.providerId)
    .filter(Boolean);
}

async function ensureFirestoreUserForAuthRecord(userRecord) {
  if (!userRecord?.uid) return { uid: "", changed: false };
  const uid = userRecord.uid;
  const userRef = admin.firestore().doc(`users/${uid}`);
  const profileRef = admin.firestore().doc(`users/${uid}/profile/main`);
  const membershipRef = admin.firestore().doc(`users/${uid}/membership/main`);
  const [userSnapshot, membershipSnapshot] = await Promise.all([
    userRef.get(),
    membershipRef.get()
  ]);
  const existingUser = userSnapshot.exists ? userSnapshot.data() || {} : {};
  const membershipData = membershipSnapshot.exists ? membershipSnapshot.data() || {} : {};
  const membershipType = existingUser.membership || membershipData.membershipType || "free";
  const providerIds = authProviderIds(userRecord);
  const createdAt = existingUser.createdAt || authTimestamp(userRecord.metadata?.creationTime);
  const rootPayload = {
    uid,
    email: userRecord.email || "",
    displayName: userRecord.displayName || "",
    photoURL: userRecord.photoURL || "",
    emailVerified: Boolean(userRecord.emailVerified),
    providerIds,
    membership: membershipType,
    createdAt,
    lastLoginAt: authTimestamp(userRecord.metadata?.lastSignInTime),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  const profilePayload = {
    account: {
      uid,
      email: userRecord.email || "",
      displayName: userRecord.displayName || "",
      photoURL: userRecord.photoURL || "",
      emailVerified: Boolean(userRecord.emailVerified),
      providerIds,
      lastLoginAt: userRecord.metadata?.lastSignInTime || new Date().toISOString()
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await Promise.all([
    userRef.set(rootPayload, { merge: true }),
    profileRef.set(profilePayload, { merge: true }),
    membershipSnapshot.exists
      ? Promise.resolve()
      : membershipRef.set({
        membershipType: "free",
        membershipStatus: "free",
        selectedPlan: "free",
        isPremium: false,
        aiRequestLimit: 3,
        aiRequestsUsed: 0,
        aiResetDate: null,
        lastRequestTimestamp: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
  ]);

  return {
    uid,
    changed: !userSnapshot.exists || !membershipSnapshot.exists
  };
}

function stripeClient() {
  const secret = STRIPE_SECRET_KEY.value();
  if (!secret) {
    throw new HttpsError("failed-precondition", "Stripe er ikke konfigureret endnu.");
  }
  return new Stripe(secret, { apiVersion: "2024-12-18.acacia" });
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value || "");
    return `${url.protocol}//${url.host}`;
  } catch (_) {
    return "";
  }
}

function safeOrigin(request) {
  const requestedOrigin = normalizeOrigin(request.data?.origin);
  const headerOrigin = normalizeOrigin(request.rawRequest?.headers?.origin);
  const origin = ALLOWED_ORIGINS.has(requestedOrigin) ? requestedOrigin : headerOrigin;
  if (!ALLOWED_ORIGINS.has(origin)) {
    throw new HttpsError("permission-denied", "Dette domæne må ikke starte Stripe Checkout.");
  }
  return origin;
}

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function nextMonthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

async function pricingTier() {
  const snapshot = await admin.firestore().doc("appConfig/pricing").get();
  const data = snapshot.exists ? snapshot.data() : {};
  const count = Number(data?.registeredUserCount);
  if (data?.activeTier === "standard" || (Number.isFinite(count) && count >= (Number(data?.earlyAdopterLimit) || EARLY_ADOPTER_LIMIT))) {
    return {
      activeTier: "standard",
      registeredUserCount: Number.isFinite(count) ? count : null,
      earlyAdopterLimit: Number(data?.earlyAdopterLimit) || EARLY_ADOPTER_LIMIT
    };
  }
  return {
    activeTier: "early_adopter",
    registeredUserCount: Number.isFinite(count) ? count : null,
    earlyAdopterLimit: Number(data?.earlyAdopterLimit) || EARLY_ADOPTER_LIMIT
  };
}

function priceAmountDkk(price, fallbackPriceDkk) {
  const amount = Number(price?.unit_amount);
  return Number.isFinite(amount) && amount > 0 ? amount / 100 : fallbackPriceDkk;
}

function checkoutModeForPrice(price) {
  return price?.recurring ? "subscription" : "payment";
}

async function getOrCreateCustomer(stripe, uid, email, name) {
  const authUser = await admin.auth().getUser(uid).catch(() => null);
  if (authUser) await ensureFirestoreUserForAuthRecord(authUser);
  const membershipRef = admin.firestore().doc(`users/${uid}/membership/main`);
  const membershipSnapshot = await membershipRef.get();
  const existingCustomerId = membershipSnapshot.exists ? membershipSnapshot.data()?.stripeCustomerId : null;
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { uid }
  });
  await membershipRef.set({
    stripeCustomerId: customer.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return customer.id;
}

exports.createStripeCheckoutSession = onCall({
  region: "europe-west1",
  secrets: [STRIPE_SECRET_KEY]
}, async request => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Du skal være logget ind for at købe Premium.");
  }

  const plan = String(request.data?.plan || "");
  const config = PLAN_CONFIG[plan];
  if (!config) {
    throw new HttpsError("invalid-argument", "Ukendt medlemskabsplan.");
  }
  const requestedPriceId = String(request.data?.priceId || "");
  if (requestedPriceId !== config.priceId) {
    throw new HttpsError("invalid-argument", "Stripe Price ID matcher ikke den valgte Work4it-plan.");
  }

  const origin = safeOrigin(request);
  const tier = await pricingTier();
  const stripe = stripeClient();
  const stripePrice = await stripe.prices.retrieve(config.priceId);
  if (!stripePrice?.active) {
    throw new HttpsError("failed-precondition", "Den valgte Stripe-pris er ikke aktiv.");
  }
  const priceDkk = priceAmountDkk(stripePrice, config.fallbackPriceDkk);
  const email = request.auth?.token?.email || undefined;
  const name = request.auth?.token?.name || undefined;
  const customerId = await getOrCreateCustomer(stripe, uid, email, name);

  const session = await stripe.checkout.sessions.create({
    mode: checkoutModeForPrice(stripePrice),
    customer: customerId,
    client_reference_id: uid,
    locale: request.data?.locale === "en" ? "en" : "da",
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    allow_promotion_codes: true,
    line_items: [{
      price: config.priceId,
      quantity: 1
    }],
    metadata: {
      uid,
      plan,
      priceId: config.priceId,
      priceDkk: String(priceDkk),
      membershipDurationMonths: config.months == null ? "" : String(config.months),
      pricingTier: tier.activeTier,
      registeredUserCount: tier.registeredUserCount == null ? "" : String(tier.registeredUserCount)
    }
  });

  await admin.firestore().doc(`users/${uid}/checkoutSessions/${session.id}`).set({
    sessionId: session.id,
    plan,
    priceId: config.priceId,
    priceDkk,
    membershipDurationMonths: config.months,
    pricingTier: tier.activeTier,
    status: "created",
    stripeCustomerId: customerId,
    checkoutUrl: session.url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { url: session.url, sessionId: session.id };
});

exports.verifyAndBackfillUserDocuments = onCall({
  region: "europe-west1"
}, async request => {
  if (!isAdminRequest(request)) {
    throw new HttpsError("permission-denied", "Kun Work4it-admin kan synkronisere Auth-brugere.");
  }

  let authUserCount = 0;
  let pageToken;
  const backfilled = [];
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    authUserCount += page.users.length;
    for (const userRecord of page.users) {
      const result = await ensureFirestoreUserForAuthRecord(userRecord);
      if (result.changed) backfilled.push(result.uid);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  const firestoreCountSnapshot = await admin.firestore().collection("users").count().get();
  const firestoreUserCount = firestoreCountSnapshot.data().count;
  await admin.firestore().doc("appConfig/userSync").set({
    authUserCount,
    firestoreUserCount,
    matches: authUserCount === firestoreUserCount,
    backfilledCount: backfilled.length,
    backfilled,
    checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    checkedBy: request.auth.uid
  }, { merge: true });

  return {
    authUserCount,
    firestoreUserCount,
    matches: authUserCount === firestoreUserCount,
    backfilledCount: backfilled.length,
    backfilled
  };
});

async function activateMembershipFromSession(session) {
  if (session.payment_status !== "paid") return;

  const uid = session.metadata?.uid || session.client_reference_id;
  const plan = session.metadata?.plan;
  const config = PLAN_CONFIG[plan];
  if (!uid || !config) return;

  const now = new Date();
  const expiresAt = config.months ? addMonths(now, config.months) : null;
  const priceDkk = Number(session.metadata?.priceDkk) || (Number(session.amount_total) / 100);
  const priceId = session.metadata?.priceId || config.priceId;
  const membershipRef = admin.firestore().doc(`users/${uid}/membership/main`);
  const checkoutRef = admin.firestore().doc(`users/${uid}/checkoutSessions/${session.id}`);

  await admin.firestore().runTransaction(async transaction => {
    transaction.set(membershipRef, {
      membershipType: plan,
      membershipStatus: "active",
      membershipPrice: priceDkk,
      membershipDurationMonths: config.months,
      membershipStartedAt: admin.firestore.Timestamp.fromDate(now),
      membershipExpiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      stripeSessionId: session.id,
      stripePriceId: priceId,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
      isPremium: true,
      selectedPlan: plan,
      priceDkk,
      membershipStartDate: now.toISOString(),
      membershipEndDate: expiresAt ? expiresAt.toISOString() : null,
      aiRequestLimit: config.aiRequestLimit,
      aiRequestPeriod: config.aiRequestPeriod,
      aiRequestsUsed: 0,
      aiResetDate: nextMonthStart(now).toISOString(),
      lastRequestTimestamp: null,
      pricingTierAtPurchase: session.metadata?.pricingTier || "early_adopter",
      priceDkkAtPurchase: priceDkk,
      priceLocked: true,
      registeredUserCountAtSelection: Number(session.metadata?.registeredUserCount) || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(checkoutRef, {
      status: "paid",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeSessionId: session.id,
      stripePriceId: priceId,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

exports.stripeWebhook = onRequest({
  region: "europe-west1",
  secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]
}, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  const signature = request.headers["stripe-signature"];
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      request.rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET.value()
    );
  } catch (error) {
    console.error("[Work4it Stripe] Webhook signature failed", error.message);
    response.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      await activateMembershipFromSession(event.data.object);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const uid = session.metadata?.uid || session.client_reference_id;
      if (uid && session.id) {
        await admin.firestore().doc(`users/${uid}/checkoutSessions/${session.id}`).set({
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
    response.json({ received: true });
  } catch (error) {
    console.error("[Work4it Stripe] Webhook handling failed", event.type, error);
    response.status(500).send("Webhook handler failed");
  }
});
