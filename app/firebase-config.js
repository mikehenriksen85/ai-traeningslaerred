import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js";

const AUTH_DOMAIN_FALLBACK = "workout-b55ed.firebaseapp.com";
const SAME_ORIGIN_AUTH_DOMAINS = new Set([
  "app.work-4it.dk",
  "work4it-app.web.app"
]);
const currentHostname = window.location?.hostname || "";
const resolvedAuthDomain = SAME_ORIGIN_AUTH_DOMAINS.has(currentHostname)
  ? currentHostname
  : AUTH_DOMAIN_FALLBACK;

const firebaseConfig = {
  apiKey: "AIzaSyBT0dbEXXb1lmVzhTHyfBw2r_DiwBWIphg",
  authDomain: resolvedAuthDomain,
  projectId: "workout-b55ed",
  storageBucket: "workout-b55ed.firebasestorage.app",
  messagingSenderId: "873024449428",
  appId: "1:873024449428:web:0b1c168317235f28eebd81",
  measurementId: "G-HEK84CT9TQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, "europe-west1");

console.log("[Work4it Firebase] firebaseConfig", firebaseConfig);
console.log("[Work4it Firebase] resolved authDomain", resolvedAuthDomain, "for host", currentHostname);
console.log("[Work4it Firebase] auth.currentUser at init", auth.currentUser);

export { app, db, auth, functions };


