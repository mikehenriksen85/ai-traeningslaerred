import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
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
  if (snapshot.exists()) return;

  await setDoc(reference, {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    providerIds: user.providerData.map(provider => provider.providerId),
    createdAt: serverTimestamp()
  });
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

onAuthStateChanged(auth, async user => {
  currentUser = user;
  initialized = true;

  if (user) {
    try {
      await ensureUserDocument(user);
    } catch (error) {
      console.error("Kunne ikke oprette Firebase-brugerdokumentet.", error);
      emitAuthState(error);
      return;
    }
  }

  emitAuthState();
});

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

export {
  createAccount,
  loginWithEmail,
  loginWithGoogle,
  logout,
  resetPassword
};
