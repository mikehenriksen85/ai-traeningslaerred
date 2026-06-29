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

const EARLY_ADOPTER_LIMIT = 500;
const PRICE_TIERS = Object.freeze({
  early_adopter: Object.freeze({ quarterly: 59, yearly: 199, lifetime: 449 }),
  standard: Object.freeze({ quarterly: 79, yearly: 249, lifetime: 499 })
});

const PLAN_CONFIG = Object.freeze({
  quarterly: Object.freeze({
    label: "Work4it Premium 3 måneder",
    months: 3,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  }),
  yearly: Object.freeze({
    label: "Work4it Premium 12 måneder",
    months: 12,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  }),
  lifetime: Object.freeze({
    label: "Work4it Premium Livstid",
    months: null,
    aiRequestLimit: 30,
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

function planPrice(plan, tier) {
  return PRICE_TIERS[tier]?.[plan] || PRICE_TIERS.early_adopter[plan];
}

async function getOrCreateCustomer(stripe, uid, email, name) {
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

  const origin = safeOrigin(request);
  const tier = await pricingTier();
  const priceDkk = planPrice(plan, tier.activeTier);
  const stripe = stripeClient();
  const email = request.auth?.token?.email || undefined;
  const name = request.auth?.token?.name || undefined;
  const customerId = await getOrCreateCustomer(stripe, uid, email, name);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: uid,
    locale: request.data?.locale === "en" ? "en" : "da",
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    allow_promotion_codes: true,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "dkk",
        unit_amount: Math.round(priceDkk * 100),
        product_data: {
          name: config.label,
          description: plan === "lifetime"
            ? "Permanent Premium-adgang til Work4it."
            : `Premium-adgang i ${config.months} måneder.`
        }
      }
    }],
    metadata: {
      uid,
      plan,
      priceDkk: String(priceDkk),
      pricingTier: tier.activeTier,
      registeredUserCount: tier.registeredUserCount == null ? "" : String(tier.registeredUserCount)
    }
  });

  await admin.firestore().doc(`users/${uid}/checkoutSessions/${session.id}`).set({
    sessionId: session.id,
    plan,
    priceDkk,
    pricingTier: tier.activeTier,
    status: "created",
    stripeCustomerId: customerId,
    checkoutUrl: session.url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { url: session.url, sessionId: session.id };
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
  const membershipRef = admin.firestore().doc(`users/${uid}/membership/main`);
  const checkoutRef = admin.firestore().doc(`users/${uid}/checkoutSessions/${session.id}`);

  await admin.firestore().runTransaction(async transaction => {
    transaction.set(membershipRef, {
      membershipType: plan,
      membershipStatus: "active",
      membershipPrice: priceDkk,
      membershipStartedAt: admin.firestore.Timestamp.fromDate(now),
      membershipExpiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      stripeSessionId: session.id,
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
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
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
