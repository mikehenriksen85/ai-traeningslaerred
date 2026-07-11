import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db, functions } from "./firebase-config.js?v=20260628-auth-ready1";

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
  return "Stripe Checkout kunne ikke startes. Prøv igen om lidt.";
}

async function createCheckout(plan) {
  if (!PAID_PLANS.has(plan)) {
    throw new Error("Ugyldig Stripe-plan.");
  }

  const stripePlan = window.Work4itStripeConfig?.getPlan?.(plan);
  if (!stripePlan?.priceId) {
    throw new Error("Stripe Price ID mangler for den valgte plan.");
  }

  const user = currentUser();
  if (!user) {
    window.Work4itAuthGate?.showLogin?.("Log ind for at købe Premium.");
    throw new Error("Log ind for at købe Premium.");
  }

  const createSession = httpsCallable(functions, "createStripeCheckoutSession");
  const result = await createSession({
    plan,
    priceId: stripePlan.priceId,
    locale: "da",
    origin: window.location.origin
  });

  const url = result?.data?.url;
  if (!url) throw new Error("Stripe returnerede ikke en Checkout-url.");
  window.location.assign(url);
  return result.data;
}

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForConfirmedMembership(sessionId = "", maxAttempts = 8) {
  const user = currentUser();
  let checkoutStatus = "";

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
  if (!payment) return;

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);

  window.setTimeout(() => {
    window.Membership?.openView?.();
    if (payment === "success") {
      console.log("[Work4it Stripe] Returned from Checkout", { sessionId });
      window.Membership?.showConfirmation?.("Betaling modtaget. Henter Stripe-bekræftelse...");
      waitForConfirmedMembership(sessionId, 24);
    } else if (payment === "cancelled") {
      window.Membership?.showConfirmation?.("Betalingen blev afbrudt. Ingen ændringer er foretaget.");
    }
  }, 250);
}

window.Work4itStripeCheckout = {
  createCheckout,
  friendlyError
};
window.dispatchEvent(new CustomEvent("work4it:stripe-checkout-ready", {
  detail: { ready: true }
}));

showReturnMessage();
