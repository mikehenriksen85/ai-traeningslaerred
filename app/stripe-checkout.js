import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db, functions } from "./firebase-config.js?v=20260713-stripe-google-login1";

const PAID_PLANS = new Set(["premium_3", "premium_6", "premium_12"]);

function currentUser() {
  return auth.currentUser ||
    window.FirebaseAuthService?.getCurrentUser?.() ||
    window.Work4itAuth?.getCurrentUser?.() ||
    null;
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("unauthenticated")) return "Log ind for at købe Premium.";
  if (code.includes("invalid-argument")) return "Den valgte plan kunne ikke startes.";
  if (code.includes("permission-denied")) return "Betaling kunne ikke startes for denne konto.";
  if (code.includes("failed-precondition")) {
    return error?.message || "Stripe er ikke konfigureret til den valgte plan endnu.";
  }
  if (code.includes("unavailable") || code.includes("deadline-exceeded")) {
    return "Betalingstjenesten svarer ikke lige nu. Prøv igen om et øjeblik.";
  }
  return "Stripe Checkout kunne ikke startes. Prøv igen om lidt.";
}

async function createCheckout(plan, options = {}) {
  if (!PAID_PLANS.has(plan)) {
    throw new Error("Ugyldig Stripe-plan.");
  }

  const stripePlan = window.Work4itStripeConfig?.getPlan?.(plan);
  if (!stripePlan?.priceId) {
    throw new Error("Stripe Price ID mangler for den valgte plan.");
  }

  const user = currentUser();
  const isPermanentAdmin = window.Work4itAdminConfig?.isPermanentAdminUser?.(user) === true;
  const adminTestMode = options.adminTestMode === true;
  if (adminTestMode && !isPermanentAdmin) {
    throw new Error("Admin-testtilstand er kun tilgængelig for administratoren.");
  }
  if (isPermanentAdmin && !adminTestMode) {
    window.Membership?.showConfirmation?.("Administrator har allerede fuld adgang. Stripe Checkout er deaktiveret.");
    return { admin: true, skipped: true };
  }
  if (!user) {
    window.Work4itAuthGate?.showLogin?.("Log ind for at købe Premium.");
    throw new Error("Log ind for at købe Premium.");
  }

  const createSession = httpsCallable(functions, "createStripeCheckoutSession");
  const result = await createSession({
    plan,
    priceId: stripePlan.priceId,
    locale: "da",
    origin: window.location.origin,
    adminTestMode
  });

  const url = result?.data?.url;
  if (!url) throw new Error("Stripe returnerede ikke en Checkout-url.");
  window.location.assign(url);
  return result.data;
}

async function runFreeAdminTest() {
  const user = currentUser();
  if (!window.Work4itAdminConfig?.isPermanentAdminUser?.(user)) {
    throw new Error("Admin-testtilstand er kun tilgængelig for administratoren.");
  }
  const runTest = httpsCallable(functions, "runAdminSubscriptionTest");
  const result = await runTest({ plan: "free" });
  return result?.data || {};
}

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function reportAdminTest(message, status = "info") {
  window.Membership?.showAdminTestStatus?.(message, status);
  window.Membership?.showConfirmation?.(message);
}

async function waitForConfirmedMembership(sessionId = "", maxAttempts = 8, options = {}) {
  const user = currentUser();
  let checkoutStatus = "";
  const adminTestMode = options.adminTestMode === true;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (!window.FirestoreDataService?.refreshFromCloud) {
        await delay(500);
        continue;
      }
      if (user?.uid && sessionId) {
        const checkoutSnapshot = await getDoc(doc(db, "users", user.uid, "checkoutSessions", sessionId));
        checkoutStatus = checkoutSnapshot.exists() ? String(checkoutSnapshot.data()?.status || "") : "";
      }
      await window.FirestoreDataService.refreshFromCloud();
      const membership = window.Membership?.getMembership?.();
      window.Membership?.render?.(membership);
      if (adminTestMode && checkoutStatus === "paid_admin_test") {
        reportAdminTest("Admin-test gennemført: Stripe Checkout, webhook og Firestore er bekræftet. Permanent administratoradgang er aktiv ✓", "success");
        window.Work4itAIRequestCounter?.refresh?.();
        return true;
      }
      if (adminTestMode && checkoutStatus === "expired_admin_test") {
        reportAdminTest("Admin-testens Stripe-session udløb. Permanent administratoradgang er fortsat aktiv.", "error");
        return false;
      }
      if (adminTestMode) {
        reportAdminTest(`Afventer webhook og Firestore-opdatering... Forsøg ${attempt}/${maxAttempts}.`, "loading");
        await delay(Math.min(1500 * attempt, 6000));
        continue;
      }
      if (membership?.role === "admin" || membership?.membershipStatus === "active" || membership?.isPremium === true) {
        window.Membership?.showConfirmation?.("Betaling bekræftet. Premium er aktivt ✓");
        window.Work4itAIRequestCounter?.refresh?.();
        return true;
      }
      if (checkoutStatus === "expired") {
        window.Membership?.showConfirmation?.("Stripe-sessionen udløb. Ingen Premium-adgang er aktiveret.");
        return false;
      }
    } catch (error) {
      console.warn("[Work4it Stripe] Cloud refresh after payment failed", error);
    }
    const statusText = checkoutStatus === "paid"
      ? "Betaling er registreret. Aktiverer Premium..."
      : "Afventer Stripe-bekræftelse...";
    window.Membership?.showConfirmation?.(`${statusText} Forsøg ${attempt}/${maxAttempts}.`);
    await delay(Math.min(1500 * attempt, 6000));
  }

  window.Membership?.showConfirmation?.("Betalingen er modtaget. Vi afventer stadig Stripe-bekræftelsen. Prøv at opdatere om et øjeblik.");
  return false;
}

function showReturnMessage() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const sessionId = params.get("session_id");
  const adminTestMode = params.get("admin_test") === "1";
  if (!payment) return;

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);

  window.setTimeout(() => {
    window.Membership?.openView?.();
    if (payment === "success") {
      console.log("[Work4it Stripe] Returned from Checkout", { sessionId });
      if (adminTestMode) reportAdminTest("Admin-testbetaling modtaget. Verificerer webhook og Firestore...", "loading");
      else window.Membership?.showConfirmation?.("Betaling modtaget. Henter Stripe-bekræftelse...");
      waitForConfirmedMembership(sessionId, 24, { adminTestMode });
    } else if (payment === "cancelled") {
      if (adminTestMode) reportAdminTest("Admin-testbetalingen blev afbrudt. Permanent administratoradgang er fortsat aktiv.", "error");
      else window.Membership?.showConfirmation?.("Betalingen blev afbrudt. Ingen ændringer er foretaget.");
    }
  }, 250);
}

window.Work4itStripeCheckout = {
  createCheckout,
  runFreeAdminTest,
  friendlyError
};
window.dispatchEvent(new CustomEvent("work4it:stripe-checkout-ready", {
  detail: { ready: true }
}));

showReturnMessage();
