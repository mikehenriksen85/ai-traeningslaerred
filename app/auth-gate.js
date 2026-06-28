(function authGateModule() {
  "use strict";

  const LAST_VIEW_KEY = "work4it:lastActiveView";
  const PRIVACY_CONSENT_KEY = "work4it:privacyConsent";
  const REDIRECT_PENDING_KEY = "work4it:authRedirectPending";
  const PRIVACY_VERSION = "2026-06-19";
  const restoreableViews = new Set([
    "program",
    "today",
    "profile",
    "membership",
    "progress",
    "calorie",
    "dashboard"
  ]);
  let appReady = false;
  let cloudReady = false;
  let routingAttempted = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function isVisible(element) {
    if (!element) return false;
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function closeNonAuthWindows() {
    document.getElementById("profile-wizard-root")?.remove();
    document.getElementById("daily-start-wizard-root")?.remove();
    document.getElementById("membershipPopup")?.classList.remove("open");
    const modal = byId("modal");
    if (modal) modal.style.display = "none";
    ["progressView", "profileAccountView", "membershipView", "calorieView"].forEach(id => {
      byId(id)?.classList.remove("open");
    });
    const exerciseMenu = byId("muscleMenu");
    if (exerciseMenu) exerciseMenu.style.display = "none";
  }

  function activeWindow(except = "") {
    const candidates = [
      ["migration", document.querySelector(".migration-dialog")],
      ["profile-wizard", byId("profile-wizard-root")],
      ["daily-wizard", byId("daily-start-wizard-root")],
      ["membership-popup", byId("membershipPopup")],
      ["modal", byId("modal")],
      ["profile-view", byId("profileAccountView")],
      ["membership-view", byId("membershipView")],
      ["progress-view", byId("progressView")],
      ["calorie-view", byId("calorieView")]
    ];
    return candidates.find(([name, element]) => name !== except && isVisible(element))?.[0] || "";
  }

  window.WorkitWindowManager = {
    closeNonAuthWindows,
    activeWindow,
    canOpen(name) {
      const service = window.FirebaseAuthService;
      return Boolean(service?.isInitialized?.() && service?.getCurrentUser?.() && !activeWindow(name));
    },
    notifyClosed(name) {
      window.dispatchEvent(new CustomEvent("workit:window-closed", { detail: { name } }));
    }
  };

  function authErrorMessage(error) {
    const messages = {
      "auth/email-already-in-use": "E-mailadressen er allerede i brug.",
      "auth/invalid-credential": "E-mail eller adgangskode er forkert.",
      "auth/invalid-email": "E-mailadressen er ikke gyldig.",
      "auth/missing-password": "Indtast din adgangskode.",
      "auth/popup-blocked": "Browseren blokerede Google-login-vinduet.",
      "auth/popup-closed-by-user": "Google-login blev lukket, før det var færdigt.",
      "auth/too-many-requests": "For mange forsøg. Vent lidt og prøv igen.",
      "auth/user-disabled": "Denne konto er deaktiveret.",
      "auth/weak-password": "Adgangskoden skal være på mindst 6 tegn."
    };
    return messages[error?.code] || error?.message || "Login kunne ikke gennemføres.";
  }

  function setFeedback(message, isError = false) {
    const feedback = byId("authGateFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.style.color = isError ? "var(--text-danger)" : "";
  }

  function setActionsEnabled(enabled) {
    ["authGateLoginBtn", "authGateCreateBtn", "authGateGoogleBtn", "authGateResetBtn"].forEach(id => {
      const button = byId(id);
      if (button) button.disabled = !enabled;
    });
  }

  function setBusy(busy) {
    setActionsEnabled(!busy && Boolean(window.FirebaseAuthService));
  }

  function readLastActiveView() {
    try {
      return sessionStorage.getItem(LAST_VIEW_KEY) ||
        localStorage.getItem(LAST_VIEW_KEY) ||
        "program";
    } catch {
      return "program";
    }
  }

  function saveLastActiveView(view) {
    const normalized = String(view || "program");
    if (!restoreableViews.has(normalized)) return;
    try {
      sessionStorage.setItem(LAST_VIEW_KEY, normalized);
      localStorage.setItem(LAST_VIEW_KEY, normalized);
    } catch {}
  }

  function setAppInert(locked) {
    [...document.body.children].forEach(element => {
      if (element.id === "authGate" || element.tagName === "SCRIPT") return;
      element.inert = locked;
      element.setAttribute("aria-hidden", String(locked));
    });
  }

  function showLoading(message = "Kontrollerer eksisterende login...") {
    const gate = byId("authGate");
    if (!gate) return;
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    gate.classList.add("loading");
    document.body.classList.add("auth-locked");
    setAppInert(true);
    const copy = byId("authGateCopy");
    if (copy) copy.textContent = message;
    setActionsEnabled(false);
  }

  function showGate(message = "Log ind eller opret en konto for at fortsætte.") {
    const gate = byId("authGate");
    if (!gate) return;
    closeNonAuthWindows();
    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    gate.classList.remove("loading");
    document.body.classList.add("auth-locked");
    setAppInert(true);
    const copy = byId("authGateCopy");
    if (copy) copy.textContent = message;
    window.setTimeout(() => byId("authGateEmail")?.focus(), 0);
  }

  function clearGateIdentity() {
    const email = byId("authGateEmail");
    const password = byId("authGatePassword");
    if (email) email.value = "";
    if (password) password.value = "";
  }

  function hideGate() {
    const gate = byId("authGate");
    if (!gate) return;
    gate.hidden = true;
    gate.setAttribute("aria-hidden", "true");
    gate.classList.remove("loading");
    document.body.classList.remove("auth-locked");
    setAppInert(false);
    const password = byId("authGatePassword");
    if (password) password.value = "";
  }

  function credentials() {
    return {
      email: byId("authGateEmail")?.value.trim() || "",
      password: byId("authGatePassword")?.value || ""
    };
  }

  function recordPrivacyConsent(source) {
    const payload = {
      accepted: true,
      version: PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
      source
    };
    try {
      localStorage.setItem(PRIVACY_CONSENT_KEY, JSON.stringify(payload));
    } catch {}
    return payload;
  }

  function recentGoogleRedirectPending() {
    try {
      const raw = sessionStorage.getItem(REDIRECT_PENDING_KEY);
      if (!raw) return false;
      const startedAt = Number(raw);
      return Number.isFinite(startedAt) && Date.now() - startedAt < 25000;
    } catch {
      return false;
    }
  }

  function clearGoogleRedirectPending() {
    try {
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    } catch {}
  }

  function requirePrivacyConsent(source) {
    const checkbox = byId("authPrivacyConsent");
    if (!checkbox?.checked) {
      setFeedback("Accepter privatlivspolitikken for at oprette eller forbinde en konto.", true);
      checkbox?.focus();
      return false;
    }
    recordPrivacyConsent(source);
    return true;
  }

  async function run(action, successMessage) {
    const service = window.FirebaseAuthService;
    if (!service?.[action]) {
      setFeedback("Firebase Authentication er ikke klar endnu.", true);
      return;
    }
    setBusy(true);
    setFeedback("Arbejder...");
    try {
      const values = credentials();
      await service[action](values.email, values.password);
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(authErrorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }

  function loginFromAuthGate(event) {
    event?.preventDefault?.();
    return run("loginWithEmail", "Login gennemført. Appen åbnes...");
  }

  function createFromAuthGate() {
    if (!requirePrivacyConsent("email_create")) return;
    return run("createAccount", "Din konto er oprettet. Appen åbnes...");
  }

  function googleFromAuthGate() {
    if (!requirePrivacyConsent("google_auth")) return;
    return run("loginWithGoogle", "Google-login gennemført. Appen åbnes...");
  }

  async function resetFromAuthGate() {
    const service = window.FirebaseAuthService;
    const email = byId("authGateEmail")?.value.trim() || "";
    if (!service?.resetPassword) {
      setFeedback("Firebase Authentication er ikke klar endnu.", true);
      return;
    }
    setBusy(true);
    try {
      await service.resetPassword(email);
      setFeedback("Link til nulstilling af adgangskode er sendt.");
    } catch (error) {
      setFeedback(authErrorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }

  function handleAuthState(detail = {}) {
    setActionsEnabled(Boolean(window.FirebaseAuthService));
    const verifiedUser = window.FirebaseAuthService?.getCurrentUser?.() || null;
    if (verifiedUser) {
      clearGoogleRedirectPending();
      routingAttempted = false;
      cloudReady = false;
      closeNonAuthWindows();
      showLoading("Gendanner dit træningspas...");
      setFeedback("Henter træningsdata fra Cloud...");
      routeAfterLoginWhenReady();
      return;
    }
    if (detail.initialized) {
      if (detail.error) {
        clearGoogleRedirectPending();
        routingAttempted = false;
        cloudReady = false;
        clearGateIdentity();
        showGate("Google-login kunne ikke gennemføres. Prøv igen eller brug e-mail-login.");
        setFeedback(authErrorMessage(detail.error), true);
        return;
      }
      if (recentGoogleRedirectPending()) {
        showLoading("Afslutter Google-login...");
        setFeedback("Venter på Firebase-session fra Google...");
        window.setTimeout(() => {
          if (window.FirebaseAuthService?.getCurrentUser?.()) return;
          clearGoogleRedirectPending();
          showGate("Google-login tager længere tid end normalt. Prøv igen eller brug e-mail-login.");
          setFeedback("Google-login blev ikke bekræftet endnu på denne enhed.", true);
        }, 30000);
        return;
      }
      routingAttempted = false;
      cloudReady = false;
      clearGateIdentity();
      showGate();
      setFeedback(detail.error ? authErrorMessage(detail.error) : "Log ind for at fortsætte.");
    }
  }

  function routeAfterLoginWhenReady() {
    if (routingAttempted || !appReady || !cloudReady) return;
    const verifiedUser = window.FirebaseAuthService?.getCurrentUser?.() || null;
    if (!verifiedUser) return;
    if (!window.WorkitWorkoutRouting?.routeAfterLogin) return;
    routingAttempted = true;
    window.setTimeout(() => {
      if (!window.FirebaseAuthService?.getCurrentUser?.()) return;
      try {
        closeNonAuthWindows();
        const destination = window.WorkitWorkoutRouting.routeAfterLogin();
        setFeedback(destination === "active" ? "Aktiv træning gendannet." : "Tomt træningspas er klar.");
        hideGate();
      } catch (error) {
        routingAttempted = false;
        showLoading("Kunne ikke gendanne træningen. Prøver igen...");
        setFeedback(error?.message || "Træningen kunne ikke gendannes.", true);
      }
    }, 0);
  }

  window.WorkitViewState = {
    key: LAST_VIEW_KEY,
    save: saveLastActiveView,
    get: readLastActiveView,
    restore: () => {
      routingAttempted = false;
      routeAfterLoginWhenReady();
    }
  };
  window.WorkitAuthRouting = {
    route: () => {
      routingAttempted = false;
      routeAfterLoginWhenReady();
    }
  };

  window.loginFromAuthGate = loginFromAuthGate;
  window.createFromAuthGate = createFromAuthGate;
  window.googleFromAuthGate = googleFromAuthGate;
  window.resetFromAuthGate = resetFromAuthGate;
  window.showAuthGate = showGate;

  window.addEventListener("firebase-auth:ready", () => {
    clearGateIdentity();
    showLoading();
    setFeedback("Kontrollerer eksisterende login...");
  });
  window.addEventListener("firebase-auth:changed", event => handleAuthState(event.detail));
  window.addEventListener("training-app:ready", () => {
    appReady = true;
    routeAfterLoginWhenReady();
  });
  ["firestore:data-hydrated", "firestore:user-ready", "firestore:fallback-active"].forEach(eventName => {
    window.addEventListener(eventName, () => {
      cloudReady = true;
      routeAfterLoginWhenReady();
    });
  });

  clearGateIdentity();
  showLoading();
})();
