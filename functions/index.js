"use strict";

const admin = require("firebase-admin");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const Stripe = require("stripe");
const { normalizeAdminTestMode, subscriptionTestPolicy } = require("./subscription-test-policy");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const ADMIN_EMAILS = new Set([
  "mikehenriksen85@gmail.com"
]);

const EARLY_ADOPTER_LIMIT = 500;
const PLAN_CONFIG = Object.freeze({
  premium_3: Object.freeze({
    label: "Work4it Premium 3 måneder",
    priceId: "price_1TnhepJ8DJiiK3vDoqAb7oqY",
    fallbackPriceDkk: 59,
    months: 3,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  }),
  premium_6: Object.freeze({
    label: "Work4it Premium 6 måneder",
    priceId: "price_1TomK2J8DJiiK3vD4SfYI4tq",
    fallbackPriceDkk: 109,
    months: 6,
    aiRequestLimit: 15,
    aiRequestPeriod: "monthly"
  }),
  premium_12: Object.freeze({
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

function isPermanentAdminEmail(email) {
  return ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}

function isAdminRequest(request) {
  const email = String(request.auth?.token?.email || "").toLowerCase();
  return Boolean(request.auth?.uid && isPermanentAdminEmail(email));
}

async function requirePermanentAdminRequest(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Du skal være logget ind.");
  }
  const tokenEmail = String(request.auth.token?.email || "").trim().toLowerCase();
  if (isPermanentAdminEmail(tokenEmail)) return request.auth.uid;
  const userRecord = await admin.auth().getUser(request.auth.uid).catch(() => null);
  if (!isPermanentAdminEmail(userRecord?.email)) {
    throw new HttpsError("permission-denied", "Kun Work4it-admin kan administrere animationer.");
  }
  return request.auth.uid;
}

const ANIMATION_MODES = Object.freeze(["standard", "muscle", "slowMotion", "alternateAngle"]);

function validateAnimationSpecification(value) {
  const specification = value && typeof value === "object" ? value : {};
  const exerciseId = String(specification.exerciseId || "");
  if (specification.schemaVersion !== 1 || !/^ex_[a-z0-9-]+_[a-z0-9]{7}$/.test(exerciseId)) {
    throw new HttpsError("invalid-argument", "Animationsspecifikationen har et ugyldigt format.");
  }
  if (!String(specification.exerciseName || "").trim() || !String(specification.movement || "").trim()) {
    throw new HttpsError("invalid-argument", "Øvelsesnavn eller bevægelse mangler.");
  }
  if (Number(specification.duration) < 3 || Number(specification.duration) > 5 || specification.loop !== true) {
    throw new HttpsError("invalid-argument", "Animationen skal være et loop på 3-5 sekunder.");
  }
  if (specification.cameraAngle !== "front_three_quarter" ||
      !ANIMATION_MODES.every(mode => Array.isArray(specification.availableModes) && specification.availableModes.includes(mode))) {
    throw new HttpsError("invalid-argument", "Kamera eller availableModes er ugyldig.");
  }
  if (specification.rights !== "original_procedural" || !Array.isArray(specification.sourceAssets) || specification.sourceAssets.length) {
    throw new HttpsError("invalid-argument", "Kun originale Work4it-animationer uden eksterne assets accepteres.");
  }
  return specification;
}

function animationVersionId(version) {
  return `v${String(Math.max(1, Number.parseInt(version, 10))).padStart(4, "0")}`;
}

function adminMembershipPayload() {
  return {
    role: "admin",
    membership: "lifetime",
    membershipType: "premium_12",
    membershipStatus: "active",
    selectedPlan: "premium_12",
    isPremium: true,
    aiRequestLimit: -1,
    aiRequestsUsed: 0,
    aiRequests: -1,
    aiRequestPeriod: "unlimited",
    aiResetDate: null,
    lastRequestTimestamp: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function restorePermanentAdminAccess(uid, membershipRef = admin.firestore().doc(`users/${uid}/membership/main`)) {
  await Promise.all([
    admin.firestore().doc(`users/${uid}`).set({
      role: "admin",
      membership: "lifetime",
      aiRequests: -1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }),
    membershipRef.set(adminMembershipPayload(), { merge: true })
  ]);
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

function normalizeMembershipType(value, role = "") {
  const mapped = {
    quarterly: "premium_3",
    semiannual: "premium_6",
    yearly: "premium_12",
    lifetime: role === "admin" ? "premium_12" : "premium_12",
    trial: "free"
  }[value] || value;
  return ["free", "premium_3", "premium_6", "premium_12"].includes(mapped) ? mapped : "free";
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
  const userRole = isPermanentAdminEmail(userRecord.email) ? "admin" : "";
  const membershipType = userRole
    ? "lifetime"
    : normalizeMembershipType(membershipData.membershipType || existingUser.membership || "free", userRole);
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
    role: userRole || admin.firestore.FieldValue.delete(),
    aiRequests: userRole ? -1 : admin.firestore.FieldValue.delete(),
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
    userRole
      ? membershipRef.set({
        ...adminMembershipPayload(),
        createdAt: membershipSnapshot.exists ? (membershipData.createdAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      : membershipSnapshot.exists
        ? membershipRef.set({
          role: admin.firestore.FieldValue.delete(),
          aiRequests: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
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
  if (existingCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(existingCustomerId);
      if (existingCustomer && !existingCustomer.deleted) return existingCustomerId;
    } catch (error) {
      // Test data resets and Stripe mode changes can invalidate a saved ID.
      if (error?.code !== "resource_missing") throw error;
      console.warn("[Work4it Stripe] Replacing stale customer", {
        uid,
        customerId: existingCustomerId
      });
    }
  }

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

  const [userSnapshot, authUser] = await Promise.all([
    admin.firestore().doc(`users/${uid}`).get(),
    admin.auth().getUser(uid).catch(() => null)
  ]);
  const permanentAdmin = isPermanentAdminEmail(authUser?.email) ||
    (userSnapshot.exists && userSnapshot.data()?.role === "admin" && isPermanentAdminEmail(userSnapshot.data()?.email));
  const adminTest = subscriptionTestPolicy({
    adminTestMode: request.data?.adminTestMode,
    isPermanentAdmin: permanentAdmin
  });
  if (!adminTest.allowed) {
    throw new HttpsError("permission-denied", "Admin-testtilstand er kun tilgængelig for Work4it-administratoren.");
  }
  if (adminTest.blockNormalAdminCheckout) {
    throw new HttpsError("failed-precondition", "Administrator har allerede fuld adgang og kan ikke sendes til Stripe Checkout.");
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
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}${adminTest.requested ? `&admin_test=1&plan=${encodeURIComponent(plan)}` : ""}`,
    cancel_url: `${origin}/?payment=cancelled${adminTest.requested ? "&admin_test=1" : ""}`,
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
      registeredUserCount: tier.registeredUserCount == null ? "" : String(tier.registeredUserCount),
      adminTestMode: adminTest.requested ? "true" : "false"
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
    adminTestMode: adminTest.requested,
    stripeCustomerId: customerId,
    checkoutUrl: session.url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { url: session.url, sessionId: session.id };
});

exports.runAdminSubscriptionTest = onCall({
  region: "europe-west1"
}, async request => {
  if (!isAdminRequest(request)) {
    throw new HttpsError("permission-denied", "Admin-testtilstand er kun tilgængelig for Work4it-administratoren.");
  }
  const plan = String(request.data?.plan || "");
  if (plan !== "free") {
    throw new HttpsError("invalid-argument", "Betalte admin-tests skal gennemføres via Stripe Checkout.");
  }

  const uid = request.auth.uid;
  const sessionId = `admin_test_free_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const membershipRef = admin.firestore().doc(`users/${uid}/membership/main`);
  const checkoutRef = admin.firestore().doc(`users/${uid}/checkoutSessions/${sessionId}`);
  await restorePermanentAdminAccess(uid, membershipRef);
  await checkoutRef.set({
    sessionId,
    plan: "free",
    status: "free_admin_test_verified",
    adminTestMode: true,
    stripeRequired: false,
    permanentAdminRestored: true,
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    sessionId,
    status: "free_admin_test_verified",
    permanentAdminRestored: true
  };
});

exports.createExerciseAnimationDraft = onCall({
  region: "europe-west1"
}, async request => {
  const uid = await requirePermanentAdminRequest(request);
  const specification = validateAnimationSpecification(request.data?.specification);
  const rootRef = admin.firestore().doc(`exerciseAnimations/${specification.exerciseId}`);
  const latest = await rootRef.collection("versions").orderBy("version", "desc").limit(1).get();
  const version = Math.max(1, Number(latest.docs[0]?.data()?.version || 0) + 1);
  const draft = {
    exerciseId: specification.exerciseId,
    animationUrl: "",
    thumbnailUrl: "",
    duration: Number(specification.duration),
    version,
    generationStatus: "pending_review",
    cameraAngle: specification.cameraAngle,
    availableModes: ANIMATION_MODES,
    specification,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
    approvedAt: null,
    approvedBy: null
  };
  const batch = admin.firestore().batch();
  batch.set(rootRef.collection("versions").doc(animationVersionId(version)), draft);
  batch.set(rootRef, {
    exerciseId: specification.exerciseId,
    latestVersion: version,
    generationStatus: "pending_review",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  return { ...draft, createdAt: null };
});

exports.recordExerciseAnimationUpload = onCall({
  region: "europe-west1"
}, async request => {
  const uid = await requirePermanentAdminRequest(request);
  const exerciseId = String(request.data?.exerciseId || "");
  const version = Number.parseInt(request.data?.version, 10);
  const animationUrl = String(request.data?.animationUrl || "");
  const thumbnailUrl = String(request.data?.thumbnailUrl || "");
  if (!/^ex_[a-z0-9-]+_[a-z0-9]{7}$/.test(exerciseId) || !Number.isInteger(version) || version < 1) {
    throw new HttpsError("invalid-argument", "Ugyldig animationsversion.");
  }
  const allowedStorageUrl = url => !url || /^https:\/\/firebasestorage\.googleapis\.com\//.test(url);
  if (!animationUrl || !allowedStorageUrl(animationUrl) || !allowedStorageUrl(thumbnailUrl)) {
    throw new HttpsError("invalid-argument", "Upload-URL kommer ikke fra Work4it Storage.");
  }
  const ref = admin.firestore().doc(`exerciseAnimations/${exerciseId}/versions/${animationVersionId(version)}`);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.generationStatus === "approved") {
    throw new HttpsError("failed-precondition", "Animationsversionen kan ikke opdateres.");
  }
  await ref.set({
    animationUrl,
    thumbnailUrl,
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    uploadedBy: uid
  }, { merge: true });
  return { animationUrl, thumbnailUrl };
});

exports.approveExerciseAnimationVersion = onCall({
  region: "europe-west1"
}, async request => {
  const uid = await requirePermanentAdminRequest(request);
  const exerciseId = String(request.data?.exerciseId || "");
  const version = Number.parseInt(request.data?.version, 10);
  if (!/^ex_[a-z0-9-]+_[a-z0-9]{7}$/.test(exerciseId) || !Number.isInteger(version) || version < 1) {
    throw new HttpsError("invalid-argument", "Ugyldig animationsversion.");
  }
  const versionRef = admin.firestore().doc(`exerciseAnimations/${exerciseId}/versions/${animationVersionId(version)}`);
  const snapshot = await versionRef.get();
  if (!snapshot.exists || !snapshot.data()?.animationUrl) {
    throw new HttpsError("failed-precondition", "Upload animationen før godkendelse.");
  }
  const current = snapshot.data();
  const approved = {
    exerciseId,
    animationUrl: current.animationUrl,
    thumbnailUrl: current.thumbnailUrl || "",
    duration: Number(current.duration),
    version,
    generationStatus: "approved",
    cameraAngle: current.cameraAngle,
    availableModes: current.availableModes,
    specification: current.specification,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvedBy: uid
  };
  validateAnimationSpecification(current.specification);
  const rootRef = admin.firestore().doc(`exerciseAnimations/${exerciseId}`);
  const batch = admin.firestore().batch();
  batch.set(versionRef, approved, { merge: true });
  batch.set(rootRef, {
    ...approved,
    activeVersion: version,
    latestVersion: version,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
  return { ...approved, approvedAt: null };
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
  const authUser = await admin.auth().getUser(uid).catch(() => null);
  const adminTestMode = normalizeAdminTestMode(session.metadata?.adminTestMode);
  if (isPermanentAdminEmail(authUser?.email)) {
    await restorePermanentAdminAccess(uid, membershipRef);
    await checkoutRef.set({
      status: adminTestMode ? "paid_admin_test" : "ignored_admin",
      adminTestMode,
      testedPlan: adminTestMode ? plan : null,
      permanentAdminRestored: true,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeSessionId: session.id,
      stripePriceId: priceId,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }

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
          status: normalizeAdminTestMode(session.metadata?.adminTestMode) ? "expired_admin_test" : "expired",
          adminTestMode: normalizeAdminTestMode(session.metadata?.adminTestMode),
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

