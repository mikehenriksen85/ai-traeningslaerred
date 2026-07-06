import { auth, db } from "./firebase-config.js?v=20260628-auth-ready1";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

let currentUser = null;
let initialized = false;
let redirectChecked = false;
let authStateChecked = false;
let authInitError = null;
const PRIVACY_CONSENT_KEY = "work4it:privacyConsent";
const REDIRECT_PENDING_KEY = "work4it:authRedirectPending";

function markRedirectPending() {
  const value = String(Date.now());
  try { sessionStorage.setItem(REDIRECT_PENDING_KEY, value); } catch {}
  try { localStorage.setItem(REDIRECT_PENDING_KEY, value); } catch {}
}

function clearRedirectPending() {
  try { sessionStorage.removeItem(REDIRECT_PENDING_KEY); } catch {}
  try { localStorage.removeItem(REDIRECT_PENDING_KEY); } catch {}
}

function logAuthError(context, error) {
  console.error("Work4it Firebase Auth-fejl", {
    context,
    code: error?.code || "unknown",
    message: error?.message || String(error || "Ukendt fejl"),
    host: window.location.host,
    href: window.location.href,
    isStandalone: window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
  });
}

function readPrivacyConsent() {
  try {
    return JSON.parse(localStorage.getItem(PRIVACY_CONSENT_KEY) || "null");
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    providerIds: user.providerData.map(provider => provider.providerId)
  };
}

async function ensureUserDocument(user) {
  const userReference = doc(db, "users", user.uid);
  const profileReference = doc(db, "users", user.uid, "profile", "main");
  const membershipReference = doc(db, "users", user.uid, "membership", "main");
  const privacyConsent = readPrivacyConsent();
  const providerIds = user.providerData.map(provider => provider.providerId);
  const [userSnapshot, membershipSnapshot] = await Promise.all([
    getDoc(userReference),
    getDoc(membershipReference)
  ]);
  const existingUser = userSnapshot.exists() ? userSnapshot.data() : {};
  const membershipType = existingUser?.membership || membershipSnapshot.data()?.membershipType || "free";

  await setDoc(userReference, {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    providerIds,
    membership: membershipType,
    createdAt: existingUser?.createdAt || serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(profileReference, {
    account: {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: Boolean(user.emailVerified),
      providerIds,
      lastLoginAt: new Date().toISOString()
    },
    ...(privacyConsent?.accepted ? { privacyConsent } : {}),
    updatedAt: serverTimestamp()
  }, { merge: true });

  if (!membershipSnapshot.exists()) {
    await setDoc(membershipReference, {
      membershipType: "free",
      membershipStatus: "free",
      selectedPlan: "free",
      isPremium: false,
      aiRequestLimit: 3,
      aiRequestsUsed: 0,
      aiResetDate: null,
      lastRequestTimestamp: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  window.dispatchEvent(new CustomEvent("firebase-auth:user-document-ready", {
    detail: { uid: user.uid, path: `users/${user.uid}` }
  }));
}

function reportAuthFirestoreError(operation, path, uid, error) {
  console.error("Work4it Auth/Firestore-fejl", {
    operation,
    path,
    uid: uid || null,
    code: error?.code || "unknown",
    message: error?.message || String(error || "Ukendt fejl")
  });
}

function emitAuthState(error = null) {
  const authReady = redirectChecked && authStateChecked;
  initialized = authReady;
  window.dispatchEvent(new CustomEvent("firebase-auth:changed", {
    detail: {
      initialized,
      authReady,
      redirectChecked,
      authStateChecked,
      user: publicUser(currentUser),
      error: error || authInitError
    }
  }));
}

function validateEmail(email) {
  const normalized = String(email || "").trim();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Indtast en gyldig e-mailadresse.");
  }
  return normalized;
}

function validatePassword(password) {
  const normalized = String(password || "");
  if (normalized.length < 6) {
    throw new Error("Adgangskoden skal være på mindst 6 tegn.");
  }
  return normalized;
}

async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(
    auth,
    validateEmail(email),
    validatePassword(password)
  );
}

async function createAccount(email, password) {
  return createUserWithEmailAndPassword(
    auth,
    validateEmail(email),
    validatePassword(password)
  );
}

async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const userAgent = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  const isMobile = isIOS || /Android|Mobile/i.test(userAgent);

  if (isMobile || isStandalone) {
    markRedirectPending();
    console.info("Work4it Google-login bruger redirect på mobil/PWA.", {
      host: window.location.host,
      isMobile,
      isStandalone
    });
    return signInWithRedirect(auth, provider);
  }

  try {
    console.info("Work4it Google-login bruger popup.", {
      host: window.location.host,
      isMobile,
      isStandalone
    });
    return await signInWithPopup(auth, provider);
  } catch (error) {
    logAuthError("google-popup", error);
    if ([
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment",
      "auth/popup-blocked",
      "auth/popup-closed-by-user"
    ].includes(error?.code)) {
      markRedirectPending();
      console.info("Work4it Google-login skifter fra popup til redirect.", {
        host: window.location.host,
        code: error?.code || "unknown"
      });
      return signInWithRedirect(auth, provider);
    }
    throw error;
  }
}

async function logout() {
  window.WorkitViewState?.clear?.();
  return signOut(auth);
}

async function clearLoginCache() {
  try { await signOut(auth); } catch (error) { logAuthError("clear-login-cache-signout", error); }
  clearRedirectPending();

  try {
    Object.keys(localStorage)
      .filter(key => /^firebase:|^firebaseui::|^work4it:authRedirectPending$/.test(key))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn("[Work4it Firebase Auth] Kunne ikke rydde localStorage auth-cache", error);
  }

  try {
    Object.keys(sessionStorage)
      .filter(key => /^firebase:|^firebaseui::|^work4it:authRedirectPending$/.test(key))
      .forEach(key => sessionStorage.removeItem(key));
  } catch (error) {
    console.warn("[Work4it Firebase Auth] Kunne ikke rydde sessionStorage auth-cache", error);
  }

  try {
    if (window.indexedDB?.deleteDatabase) {
      ["firebaseLocalStorageDb", "firebase-heartbeat-database"].forEach(name => {
        const request = indexedDB.deleteDatabase(name);
        request.onerror = () => console.warn("[Work4it Firebase Auth] Kunne ikke rydde IndexedDB", name, request.error);
      });
    }
  } catch (error) {
    console.warn("[Work4it Firebase Auth] Kunne ikke rydde IndexedDB auth-cache", error);
  }

  try {
    if (window.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => /^work4it-shell-/i.test(key)).map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[Work4it Firebase Auth] Kunne ikke rydde app-cache", error);
  }

  window.location.reload();
}

async function resetPassword(email) {
  const targetEmail = email || currentUser?.email;
  return sendPasswordResetEmail(auth, validateEmail(targetEmail));
}

async function changePassword(currentPassword, newPassword) {
  if (!currentUser) throw new Error("Du er ikke logget ind.");
  const providerIds = currentUser.providerData.map(provider => provider.providerId);
  if (!providerIds.includes("password") || !currentUser.email) {
    const error = new Error("Direkte adgangskodeskift kræver en konto oprettet med e-mail og adgangskode.");
    error.code = "auth/password-provider-required";
    throw error;
  }
  const current = validatePassword(currentPassword);
  const next = validatePassword(newPassword);
  if (current === next) {
    const error = new Error("Den nye adgangskode skal være forskellig fra den nuværende.");
    error.code = "auth/password-unchanged";
    throw error;
  }
  const credential = EmailAuthProvider.credential(currentUser.email, current);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, next);
  return true;
}

async function deleteAccountAndData() {
  if (!currentUser) throw new Error("Du er ikke logget ind.");
  if (!window.FirestoreDataService?.deleteCurrentUserData) {
    throw new Error("Datasletning er ikke klar endnu. Prøv igen om et øjeblik.");
  }
  await window.FirestoreDataService.deleteCurrentUserData(currentUser.uid);
  await deleteUser(currentUser);
}

window.FirebaseAuthService = {
  loginWithEmail,
  createAccount,
  loginWithGoogle,
  logout,
  resetPassword,
  changePassword,
  deleteAccountAndData,
  clearLoginCache,
  getCurrentUser: () => publicUser(currentUser),
  isInitialized: () => initialized,
  isAuthReady: () => redirectChecked && authStateChecked
};

window.dispatchEvent(new CustomEvent("firebase-auth:ready"));

async function initializeAuthState() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Firebase kunne ikke bekræfte lokal login-persistens.", error);
  }

  try {
    console.log("[Work4it Firebase Auth] Checking redirect result");
    const redirectResult = await getRedirectResult(auth);
    console.log("[Work4it Firebase Auth] Redirect result", redirectResult);
    if (redirectResult?.user) {
      currentUser = redirectResult.user;
      clearRedirectPending();
    }
  } catch (error) {
    clearRedirectPending();
    authInitError = error;
    console.error("[Work4it Firebase Auth] Redirect error", error?.code || "unknown", error?.message || error);
    logAuthError("google-redirect-result", error);
  } finally {
    redirectChecked = true;
    emitAuthState(authInitError);
  }

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    authStateChecked = true;
    console.log("[Work4it Firebase Auth] currentUser", publicUser(currentUser));
    console.log("[Work4it Firebase Auth] auth.currentUser", publicUser(auth.currentUser));
    if (user) {
      authInitError = null;
      clearRedirectPending();
    }

    if (user) {
      try {
        await ensureUserDocument(user);
      } catch (error) {
        reportAuthFirestoreError("setDoc", `users/${user.uid}`, user.uid, error);
        window.dispatchEvent(new CustomEvent("firebase-auth:profile-metadata-error", {
          detail: {
            path: `users/${user.uid}`,
            operation: "setDoc",
            error
          }
        }));
      }
    }

    emitAuthState();
  }, error => {
    authStateChecked = true;
    authInitError = error;
    currentUser = null;
    emitAuthState(error);
  });
}

initializeAuthState();

export {
  createAccount,
  loginWithEmail,
  loginWithGoogle,
  logout,
  resetPassword,
  changePassword,
  deleteAccountAndData,
  clearLoginCache
};
