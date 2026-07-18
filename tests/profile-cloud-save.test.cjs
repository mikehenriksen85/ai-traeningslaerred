"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const wizardSource = fs.readFileSync("app/wizard-store.js", "utf8");
const profileSource = fs.readFileSync("app/profile-account.js", "utf8");
const cloudSource = fs.readFileSync("app/firestore-cloud-service.js", "utf8");
const html = fs.readFileSync("app/index.html", "utf8");
const serviceWorker = fs.readFileSync("app/service-worker.js", "utf8");

function createStore({ user = { uid: "uid-1" }, cloudSave = async () => true } = {}) {
  const values = new Map();
  const events = [];
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
  const window = {
    dispatchEvent: event => events.push(event),
    FirebaseAuthService: { getCurrentUser: () => user },
    FirestoreDataService: { saveProfileToCloud: cloudSave }
  };
  const sandbox = { window, localStorage, CustomEvent, Date, console };
  vm.createContext(sandbox);
  vm.runInContext(wizardSource, sandbox);
  return { store: window.TrainingWizardStore, values, events };
}

(async () => {
  let cloudProfile = null;
  const success = createStore({ cloudSave: async profile => { cloudProfile = profile; return true; } });
  const saved = await success.store.saveProfileAndSync({ name: "Mike", goal: "strength", trainingGoals: { primary: "strength" } });
  const localProfile = JSON.parse(success.values.get("training_profile_v1"));
  assert.equal(localProfile.name, "Mike", "profile is saved locally first");
  assert.equal(cloudProfile.name, "Mike", "the same normalized profile is sent directly to Cloud");
  assert.equal(saved.updatedAt, cloudProfile.updatedAt);

  const failed = createStore({ cloudSave: async () => { const error = new Error("offline"); error.code = "firestore/unavailable"; throw error; } });
  await assert.rejects(() => failed.store.saveProfileAndSync({ name: "Offline", goal: "strength", trainingGoals: { primary: "strength" } }), /offline/);
  assert.equal(JSON.parse(failed.values.get("training_profile_v1")).name, "Offline", "local profile survives a real network failure");

  const signedOut = createStore({ user: null });
  await assert.rejects(() => signedOut.store.saveProfileAndSync({ name: "Local", goal: "strength", trainingGoals: { primary: "strength" } }), /gyldigt login/);
  assert.equal(JSON.parse(signedOut.values.get("training_profile_v1")).name, "Local");

  assert.match(cloudSource, /const pendingInitialization = initializationByUid\.get\(uid\);\s+if \(pendingInitialization\) await pendingInitialization;/);
  assert.match(cloudSource, /async function saveProfileToCloud\(profile\) \{\s+const uid = await requireCloudUser\("Profilgemning"\)/);
  assert.match(cloudSource, /PATHS\.profile\(uid\)/);
  assert.match(cloudSource, /reportFirestoreError\("saveProfileToCloud", path, error, uid\)/);
  assert.match(cloudSource, /if \(\["offline", "error"\]\.includes\(cloudState\)\)[\s\S]*?await saveProfileToCloud\(pendingProfile\)/);
  assert.match(cloudSource, /localFingerprint = currentLocalFingerprint\(\);\s+window\.dispatchEvent\(new CustomEvent\("firestore:sync-completed"/);
  const fingerprintWatcher = cloudSource.match(/window\.setInterval\(\(\) => \{[\s\S]*?\}, 2000\);/)?.[0] || "";
  assert.doesNotMatch(fingerprintWatcher, /localFingerprint = next/, "failed syncs remain pending for retry");

  assert.match(profileSource, /Gemmer profil lokalt og i Cloud/);
  assert.match(profileSource, /✔ Profil gemt lokalt og i Cloud/);
  assert.match(profileSource, /\[Work4it profil\] Cloud-gemning mislykkedes/);
  assert.match(profileSource, /users\/\$\{window\.FirebaseAuthService/);
  assert.match(html, /wizard-store\.js\?v=20260718-profile-cloud1/);
  assert.match(html, /profile-account\.js\?v=20260718-profile-cloud1/);
  assert.match(html, /firestore-cloud-service\.js\?v=20260718-dashboard-buttons1/);
  assert.match(html, /service-worker\.js\?v=20260718-empty-workout-actions1/);
  assert.match(serviceWorker, /work4it-shell-v124-empty-workout-actions1/);

  console.log("Profile local-first and confirmed Cloud-save scenarios passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
