import { db } from "./firebase-config.js?v=20260628-mobile-authdomain1";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const MIGRATION_VERSION = 1;
const KEYS = {
  profile: "training_profile_v1",
  daily: "daily_start_v1",
  membership: "ai_training_membership_v1",
  programs: "saved_workout_programs",
  sessions: "training_analytics_history",
  measurements: "body_measurement_history",
  aiHistory: "ai_copilot_history",
  imports: "screenshot_imports",
  customExercises: "custom_exercises",
  trash: "deleted_workout_programs",
  activeWorkout: "active_workout_autosave",
  lastProgram: "last_active_program_id"
};
const MANAGED_KEYS = new Set(Object.values(KEYS));
const originalSetItem = localStorage.setItem.bind(localStorage);
const originalRemoveItem = localStorage.removeItem.bind(localStorage);
let activeUid = "";
let migrationEnabled = false;
let suppressLocalEvents = false;
let syncTimer = null;
let syncInProgress = false;
let syncQueued = false;
let localFingerprint = "";
let migrationDialogRoot = null;

function parseLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    if (key === KEYS.lastProgram) return raw;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  suppressLocalEvents = true;
  try {
    if (value === null || value === undefined) originalRemoveItem(key);
    else originalSetItem(key, key === KEYS.lastProgram ? String(value) : JSON.stringify(value));
  } finally {
    suppressLocalEvents = false;
  }
}

function serializable(value) {
  return JSON.parse(JSON.stringify(value ?? null, (_key, item) => {
    if (item?.toDate instanceof Function) return item.toDate().toISOString();
    return item;
  }));
}

function cleanDocument(value) {
  const clean = serializable(value) || {};
  delete clean.firestoreUpdatedAt;
  delete clean.migratedAt;
  return clean;
}

function stableId(value, prefix = "item") {
  const source = value?.id || value?.sessionId || value?.date || value?.timestamp;
  return String(source || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 180);
}

function hasLocalData() {
  return Object.entries(KEYS).some(([name, key]) => {
    if (name === "lastProgram") return Boolean(localStorage.getItem(key));
    const value = parseLocal(key, null);
    if (Array.isArray(value)) return value.length > 0;
    return value && typeof value === "object" && Object.keys(value).length > 0;
  });
}

function syncReference(uid) {
  return doc(db, "users", uid, "profile", "syncMetadata");
}

async function getSyncMetadata(uid) {
  const snapshot = await getDoc(syncReference(uid));
  return snapshot.exists() ? snapshot.data() : {};
}

async function setSyncMetadata(uid, data) {
  await setDoc(syncReference(uid), {
    migrationVersion: MIGRATION_VERSION,
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (Object.prototype.hasOwnProperty.call(data, "migrationCompleted")) {
    await setDoc(doc(db, "users", uid), {
      migrationCompleted: Boolean(data.migrationCompleted),
      migrationCompletedAt: data.migrationCompletedAt || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function replaceCollection(pathSegments, values, prefix) {
  const collectionReference = collection(db, ...pathSegments);
  const existing = await getDocs(collectionReference);
  const desired = new Map((Array.isArray(values) ? values : []).map((value, index) => [
    value?.id || value?.sessionId || value?.date || value?.timestamp
      ? stableId(value, prefix)
      : `${prefix}_${index + 1}`,
    value
  ]));
  let batch = writeBatch(db);
  let operations = 0;
  const commitIfNeeded = async force => {
    if (operations && (force || operations >= 400)) {
      await batch.commit();
      batch = writeBatch(db);
      operations = 0;
    }
  };

  for (const snapshot of existing.docs) {
    if (!desired.has(snapshot.id)) {
      batch.delete(snapshot.ref);
      operations++;
      await commitIfNeeded(false);
    }
  }
  for (const [id, value] of desired) {
    batch.set(doc(collectionReference, id), {
      ...cleanDocument(value),
      id,
      firestoreUpdatedAt: serverTimestamp()
    }, { merge: true });
    operations++;
    await commitIfNeeded(false);
  }
  await commitIfNeeded(true);
}

async function syncPrograms(uid) {
  const programs = parseLocal(KEYS.programs, []);
  const programCollection = collection(db, "users", uid, "programs");
  const existingPrograms = await getDocs(programCollection);
  const ids = new Set((Array.isArray(programs) ? programs : []).map(program => stableId(program, "program")));

  for (const snapshot of existingPrograms.docs) {
    if (!ids.has(snapshot.id)) {
      const oldDays = await getDocs(collection(db, "users", uid, "programs", snapshot.id, "days"));
      for (const day of oldDays.docs) await deleteDoc(day.ref);
      await deleteDoc(snapshot.ref);
    }
  }

  for (const program of Array.isArray(programs) ? programs : []) {
    const programId = stableId(program, "program");
    const days = Array.isArray(program.days) ? program.days : [];
    const programData = cleanDocument(program);
    delete programData.days;
    await setDoc(doc(programCollection, programId), {
      ...programData,
      id: programId,
      dayCount: days.length,
      firestoreUpdatedAt: serverTimestamp()
    }, { merge: true });
    await replaceCollection(["users", uid, "programs", programId, "days"], days, "day");
  }
}

async function syncAllLocalData(uid = activeUid) {
  if (!uid || !migrationEnabled) return false;
  if (syncInProgress) {
    syncQueued = true;
    return false;
  }
  syncInProgress = true;
  try {
    const profile = parseLocal(KEYS.profile, {});
    const daily = parseLocal(KEYS.daily, {});
    const membership = parseLocal(KEYS.membership, {});
    const appState = {
      activeWorkout: parseLocal(KEYS.activeWorkout, null),
      lastActiveProgramId: parseLocal(KEYS.lastProgram, "")
    };
    await Promise.all([
      setDoc(doc(db, "users", uid, "profile", "main"), {
        ...cleanDocument(profile),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true }),
      setDoc(doc(db, "users", uid, "profile", "daily"), {
        ...cleanDocument(daily),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true }),
      setDoc(doc(db, "users", uid, "profile", "membership"), {
        ...cleanDocument(membership),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true }),
      setDoc(doc(db, "users", uid, "profile", "appState"), {
        ...cleanDocument(appState),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true }),
      syncPrograms(uid),
      replaceCollection(["users", uid, "workoutSessions"], parseLocal(KEYS.sessions, []), "session"),
      replaceCollection(["users", uid, "bodyMeasurements"], parseLocal(KEYS.measurements, []), "measurement"),
      replaceCollection(["users", uid, "aiCopilotHistory"], parseLocal(KEYS.aiHistory, []), "message"),
      replaceCollection(["users", uid, "imports"], parseLocal(KEYS.imports, []), "import"),
      replaceCollection(["users", uid, "customExercises"], parseLocal(KEYS.customExercises, []), "exercise"),
      replaceCollection(["users", uid, "deletedPrograms"], parseLocal(KEYS.trash, []), "deleted")
    ]);
    await setSyncMetadata(uid, {
      migrationCompleted: true,
      migrationCompletedAt: new Date().toISOString(),
      lastSyncAt: serverTimestamp(),
      localStoragePreserved: true,
      status: "synced"
    });
    window.dispatchEvent(new CustomEvent("firestore:sync-completed"));
    return true;
  } catch (error) {
    console.error("Firestore-synkronisering mislykkedes. Lokale data er bevaret.", error);
    await setSyncMetadata(uid, {
      status: "failed",
      lastError: error?.code || error?.message || "unknown",
      localStoragePreserved: true
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent("firestore:sync-failed", { detail: { error } }));
    return false;
  } finally {
    syncInProgress = false;
    if (syncQueued) {
      syncQueued = false;
      queueSync();
    }
  }
}

async function readCollection(pathSegments) {
  const snapshot = await getDocs(collection(db, ...pathSegments));
  return snapshot.docs.map(item => cleanDocument(item.data()));
}

async function hydratePrograms(uid) {
  const snapshots = await getDocs(collection(db, "users", uid, "programs"));
  const programs = [];
  for (const snapshot of snapshots.docs) {
    const data = cleanDocument(snapshot.data());
    const days = await readCollection(["users", uid, "programs", snapshot.id, "days"]);
    days.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    programs.push({ ...data, id: snapshot.id, days });
  }
  return programs;
}

async function hydrateFromFirestore(uid = activeUid) {
  if (!uid) return false;
  try {
    const [profile, daily, membership, appState, programs, sessions, measurements, aiHistory, imports, customExercises, trash] =
      await Promise.all([
        getDoc(doc(db, "users", uid, "profile", "main")),
        getDoc(doc(db, "users", uid, "profile", "daily")),
        getDoc(doc(db, "users", uid, "profile", "membership")),
        getDoc(doc(db, "users", uid, "profile", "appState")),
        hydratePrograms(uid),
        readCollection(["users", uid, "workoutSessions"]),
        readCollection(["users", uid, "bodyMeasurements"]),
        readCollection(["users", uid, "aiCopilotHistory"]),
        readCollection(["users", uid, "imports"]),
        readCollection(["users", uid, "customExercises"]),
        readCollection(["users", uid, "deletedPrograms"])
      ]);

    if (profile.exists()) writeLocal(KEYS.profile, cleanDocument(profile.data()));
    if (daily.exists()) writeLocal(KEYS.daily, cleanDocument(daily.data()));
    if (membership.exists()) writeLocal(KEYS.membership, cleanDocument(membership.data()));
    if (appState.exists()) {
      const state = cleanDocument(appState.data());
      if (state.activeWorkout) writeLocal(KEYS.activeWorkout, state.activeWorkout);
      if (state.lastActiveProgramId) writeLocal(KEYS.lastProgram, state.lastActiveProgramId);
    }
    programs.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
    sessions.sort((a, b) => new Date(a.date || a.completedAt || 0) - new Date(b.date || b.completedAt || 0));
    measurements.sort((a, b) => new Date(a.date || a.measuredAt || 0) - new Date(b.date || b.measuredAt || 0));
    aiHistory.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    writeLocal(KEYS.programs, programs);
    writeLocal(KEYS.sessions, sessions);
    writeLocal(KEYS.measurements, measurements);
    writeLocal(KEYS.aiHistory, aiHistory);
    writeLocal(KEYS.imports, imports);
    writeLocal(KEYS.customExercises, customExercises);
    writeLocal(KEYS.trash, trash);
    window.dispatchEvent(new CustomEvent("firestore:data-hydrated"));
    return true;
  } catch (error) {
    console.warn("Firestore kunne ikke hentes. Appen fortsætter med lokale data.", error);
    window.dispatchEvent(new CustomEvent("firestore:fallback-active", { detail: { error } }));
    return false;
  }
}

function showMigrationDialog() {
  return new Promise(resolve => {
    const root = document.createElement("div");
    migrationDialogRoot?.remove();
    migrationDialogRoot = root;
    root.className = "migration-dialog";
    root.innerHTML = `
      <div class="migration-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="migrationTitle">
        <h2 id="migrationTitle">Lokale træningsdata fundet</h2>
        <p>Vi fandt lokale træningsdata. Vil du flytte dem til din konto?</p>
        <p class="migration-note">Dine lokale data beholdes som backup.</p>
        <div class="migration-actions">
          <button type="button" data-choice="yes">Ja, flyt data</button>
          <button type="button" data-choice="no">Nej, behold kun lokalt</button>
        </div>
      </div>`;
    root.addEventListener("click", event => {
      const choice = event.target.closest("[data-choice]")?.dataset.choice;
      if (!choice) return;
      root.remove();
      migrationDialogRoot = null;
      resolve(choice === "yes");
    });
    document.body.appendChild(root);
    root.querySelector('[data-choice="yes"]')?.focus();
  });
}

function queueSync() {
  if (!activeUid || !migrationEnabled || suppressLocalEvents) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => syncAllLocalData(), 900);
}

function currentLocalFingerprint() {
  return [...MANAGED_KEYS].map(key => `${key}:${localStorage.getItem(key) || ""}`).join("|");
}

function installLocalStorageBridge() {
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (MANAGED_KEYS.has(key)) queueSync();
  };
  localStorage.removeItem = function(key) {
    originalRemoveItem(key);
    if (MANAGED_KEYS.has(key)) queueSync();
  };
  localFingerprint = currentLocalFingerprint();
  window.setInterval(() => {
    const next = currentLocalFingerprint();
    if (next === localFingerprint) return;
    localFingerprint = next;
    queueSync();
  }, 2000);
}

function saveImportData(payload) {
  const imports = parseLocal(KEYS.imports, []);
  const entry = {
    id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    sourceType: "screenshot",
    ...cleanDocument(payload)
  };
  localStorage.setItem(KEYS.imports, JSON.stringify([
    ...(Array.isArray(imports) ? imports : []),
    entry
  ]));
  return entry;
}

async function handleAuthenticatedUser(user) {
  activeUid = user.uid;
  const metadata = await getSyncMetadata(activeUid).catch(() => ({}));
  if (metadata.migrationCompleted === true) {
    migrationEnabled = true;
    await hydrateFromFirestore(activeUid);
    localFingerprint = currentLocalFingerprint();
    return;
  }
  if (metadata.status === "local_only" && metadata.migrationDeclinedAt) {
    migrationEnabled = false;
    return;
  }

  if (!hasLocalData()) {
    migrationEnabled = true;
    await hydrateFromFirestore(activeUid);
    await setSyncMetadata(activeUid, {
      migrationCompleted: true,
      migrationCompletedAt: new Date().toISOString(),
      localStoragePreserved: true,
      status: "ready"
    });
    localFingerprint = currentLocalFingerprint();
    return;
  }

  const accepted = await showMigrationDialog();
  if (accepted) {
    migrationEnabled = true;
    await syncAllLocalData(activeUid);
    localFingerprint = currentLocalFingerprint();
  } else {
    migrationEnabled = false;
    await setSyncMetadata(activeUid, {
      migrationCompleted: false,
      migrationDeclinedAt: new Date().toISOString(),
      status: "local_only",
      localStoragePreserved: true
    });
  }
}

installLocalStorageBridge();

window.FirestoreDataService = {
  keys: { ...KEYS },
  syncAllLocalData,
  hydrateFromFirestore,
  requestMigration: async () => {
    if (!activeUid) return false;
    migrationEnabled = true;
    const result = await syncAllLocalData(activeUid);
    localFingerprint = currentLocalFingerprint();
    return result;
  },
  saveImportData,
  isCloudPrimary: () => migrationEnabled,
  getActiveUid: () => activeUid
};

window.addEventListener("firebase-auth:changed", event => {
  const user = window.FirebaseAuthService?.getCurrentUser?.() || null;
  if (!user) {
    migrationDialogRoot?.remove();
    migrationDialogRoot = null;
    activeUid = "";
    migrationEnabled = false;
    return;
  }
  handleAuthenticatedUser(user);
});

const existingUser = window.FirebaseAuthService?.getCurrentUser?.();
if (existingUser) handleAuthenticatedUser(existingUser);
