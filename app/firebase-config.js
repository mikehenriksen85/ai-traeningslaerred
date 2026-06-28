import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBT0dbEXXb1lmVzhTHyfBw2r_DiwBWIphg",
  authDomain: "workout-b55ed.firebaseapp.com",
  projectId: "workout-b55ed",
  storageBucket: "workout-b55ed.firebasestorage.app",
  messagingSenderId: "873024449428",
  appId: "1:873024449428:web:0b1c168317235f28eebd81",
  measurementId: "G-HEK84CT9TQ"
};

const hostAuthDomains = {
  "app.work-4it.dk": "app.work-4it.dk",
  "work4it-app.web.app": "work4it-app.web.app"
};

const currentHost = window.location.hostname;
if (hostAuthDomains[currentHost]) {
  firebaseConfig.authDomain = hostAuthDomains[currentHost];
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
