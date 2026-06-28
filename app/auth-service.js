import { auth, db } from "./firebase-config.js?v=20260614-auth2";
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
const PRIVACY_CONSENT_KEY = "work4it:privacyConsent";

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
  const reference = doc(db, "users", user.uid, "profile", "main");
  const snapshot = await getDoc(reference);
  const privacyConsent = readPrivacyConsent();
  await setDoc(reference, {
    account: {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: Boolean(user.emailVerified),
      providerIds: user.providerData.map(provider => provider.providerId),
      lastLoginAt: new Date().toISOString()
    },
    ...(privacyConsent?.accepted ? { privacyConsent } : {}),
    ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function emitAuthState(error = null) {
  window.dispatchEvent(new CustomEvent("firebase-auth:changed", {
    detail: {
      initialized,
      user: publicUser(currentUser),
      error
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
    return signInWithRedirect(auth, provider);
  }

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error?.code)) {
      return signInWithRedirect(auth, provider);
    }
    throw error;
  }
}

async function logout() {
  return signOut(auth);
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
  getCurrentUser: () => publicUser(currentUser),
  isInitialized: () => initialized
};

window.dispatchEvent(new CustomEvent("firebase-auth:ready"));

async function initializeAuthState() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Firebase kunne ikke bekræfte lokal login-persistens.", error);
  }

  try {
    await getRedirectResult(auth);
  } catch (error) {
    console.error("Google-login via redirect kunne ikke gennemføres.", error);
    initialized = true;
    emitAuthState(error);
  }

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    initialized = true;

    if (user) {
      try {
        await ensureUserDocument(user);
      } catch (error) {
        console.error("Kunne ikke oprette Firebase-profilmetadata på users/{uid}/profile/main.", error);
        window.dispatchEvent(new CustomEvent("firebase-auth:profile-metadata-error", {
          detail: {
            path: `users/${user.uid}/profile/main`,
            operation: "setDoc",
            error
          }
        }));
      }
    }

    emitAuthState();
  }, error => {
    initialized = true;
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
  deleteAccountAndData
};
