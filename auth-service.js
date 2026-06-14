import { auth, db } from "./firebase-config.js?v=20260614-auth2";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

let currentUser = null;
let initialized = false;

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
  const reference = doc(db, "users", user.uid);
  const snapshot = await getDoc(reference);
  await setDoc(reference, {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    providerIds: user.providerData.map(provider => provider.providerId),
    ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    lastLoginAt: serverTimestamp(),
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
  return signInWithPopup(auth, provider);
}

async function logout() {
  return signOut(auth);
}

async function resetPassword(email) {
  const targetEmail = email || currentUser?.email;
  return sendPasswordResetEmail(auth, validateEmail(targetEmail));
}

window.FirebaseAuthService = {
  loginWithEmail,
  createAccount,
  loginWithGoogle,
  logout,
  resetPassword,
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

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    initialized = true;
    let userDocumentError = null;

    if (user) {
      try {
        await ensureUserDocument(user);
      } catch (error) {
        userDocumentError = error;
        console.error("Kunne ikke oprette Firebase-brugerdokumentet.", error);
      }
    }

    emitAuthState(userDocumentError);
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
  resetPassword
};
