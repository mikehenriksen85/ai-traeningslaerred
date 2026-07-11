import { db } from "./firebase-config.js?v=20260628-auth-ready1";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const MIGRATION_VERSION = 2;
const PRICING_CONFIG = {
  collection: "appConfig",
  document: "pricing",
  strategyVersion: "1.0",
  earlyAdopterLimit: 500
};
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
  lastProgram: "last_active_program_id",
  theme: "work4it_theme"
};
const COLLECTIONS = {
  sessions: "workoutSessions",
  measurements: "bodyMeasurements",
  aiHistory: "aiCopilotHistory",
  imports: "imports",
  customExercises: "customExercises",
  trash: "deletedPrograms"
};
const PATHS = {
  profile: uid => ["users", uid, "profile", "main"],
  syncMetadata: uid => ["users", uid, "profile", "syncMetadata"],
  daily: uid => ["users", uid, "profile", "daily"],
  settings: uid => ["users", uid, "settings", "main"],
  legacySettings: uid => ["users", uid, "profile", "appState"],
  membership: uid => ["users", uid, "membership", "main"],
  appState: (uid, stateId = "main") => ["users", uid, "appState", stateId],
  activeWorkout: uid => ["users", uid, "activeWorkout", "current"]
};
const storageScope = window.WorkitStorageScope;
let activeUid = "";
let cloudEnabled = false;
let syncTimer = null;
let syncInProgress = false;
let syncQueued = false;
let migrationDialogRoot = null;
let localFingerprint = "";
let refreshInProgress = false;
let lastCloudRefreshAt = 0;
let cloudHydrationInProgress = false;
let localSyncReady = false;
const initializationByUid = new Map();

function parseLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    if (key === KEYS.lastProgram || key === KEYS.theme) return raw;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  if (storageScope?.writeCurrentRaw?.(key, value)) return;
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, (key === KEYS.lastProgram || key === KEYS.theme) ? String(value) : JSON.stringify(value));
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
  return clean;
}

async function loadPublicPricingConfig() {
  let detail = {
    strategyVersion: PRICING_CONFIG.strategyVersion,
    registeredUserCount: null,
    earlyAdopterLimit: PRICING_CONFIG.earlyAdopterLimit,
    activeTier: "early_adopter",
    source: "fallback"
  };
  if (window.ENABLE_FIRESTORE_PRICING_CONFIG !== true) {
    detail.source = "client_pricing_strategy";
    window.dispatchEvent(new CustomEvent("work4it:pricing-config", { detail }));
    return detail;
  }
  const user = window.FirebaseAuthService?.getCurrentUser?.() || null;
  if (!user) {
    detail.source = "fallback_until_auth_ready";
    window.dispatchEvent(new CustomEvent("work4it:pricing-config", { detail }));
    return detail;
  }
  try {
    const snapshot = await getDoc(doc(db, PRICING_CONFIG.collection, PRICING_CONFIG.document));
    if (snapshot.exists()) {
      const data = cleanDocument(snapshot.data());
      const registeredUserCount = Math.max(0, Number(data.registeredUserCount) || 0);
      const earlyAdopterLimit = Math.max(1, Number(data.earlyAdopterLimit) || PRICING_CONFIG.earlyAdopterLimit);
      detail = {
        strategyVersion: data.strategyVersion || PRICING_CONFIG.strategyVersion,
        registeredUserCount,
        earlyAdopterLimit,
        activeTier: registeredUserCount >= earlyAdopterLimit ? "standard" : "early_adopter",
        source: "firestore"
      };
    }
  } catch (error) {
    console.warn("Priskonfiguration kunne ikke hentes efter login. Early Adopter-priser bruges som fallback.", error);
  }
  window.dispatchEvent(new CustomEvent("work4it:pricing-config", { detail }));
  return detail;
}

function hasProfileFields(value) {
  if (!value || typeof value !== "object") return false;
  return [
    "hasCompletedProfileWizard",
    "name",
    "goal",
    "trainingGoals",
    "heightCm",
    "weightKg",
    "bodyFat",
    "muscleMass",
    "personalGoal",
    "age",
    "gender",
    "experience",
    "trainingDaysPerWeek",
    "focusAreas",
    "exercisePreference",
    "preferredTrainingStyle",
    "preferredExerciseCount"
  ].some(field => Object.prototype.hasOwnProperty.call(value, field));
}

function stableId(value, prefix = "item", index = 0) {
  const source = value?.id || value?.sessionId || value?.date || value?.timestamp;
  return String(source || `${prefix}_${index + 1}`)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 180);
}

function timestampMillis(value) {
  const candidate = value?.updatedAt ??
    value?.firestoreUpdatedAt ??
    value?.savedAt ??
    value?.completedAt ??
    value?.date ??
    value?.createdAt;
  if (candidate?.toMillis instanceof Function) return candidate.toMillis();
  if (candidate?.toDate instanceof Function) return candidate.toDate().getTime();
  const milliseconds = new Date(candidate || 0).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

function newest(localValue, cloudValue) {
  if (cloudValue == null) return localValue;
  if (localValue == null) return cloudValue;
  const localTime = timestampMillis(localValue);
  const cloudTime = timestampMillis(cloudValue);
  if (!localTime && cloudTime) return cloudValue;
  if (!cloudTime && localTime) return localValue;
  return cloudTime >= localTime ? cloudValue : localValue;
}

function mergeLists(localValues, cloudValues, prefix) {
  const merged = new Map();
  (Array.isArray(localValues) ? localValues : []).forEach((value, index) => {
    merged.set(stableId(value, prefix, index), value);
  });
  (Array.isArray(cloudValues) ? cloudValues : []).forEach((value, index) => {
    const id = stableId(value, prefix, index);
    merged.set(id, newest(merged.get(id), value));
  });
  return [...merged.values()];
}

function syncReference(uid) {
  return doc(db, "users", uid, "profile", "syncMetadata");
}

function firestorePath(pathSegments) {
  return Array.isArray(pathSegments) ? pathSegments.join("/") : String(pathSegments || "");
}

function authUid() {
  return window.FirebaseAuthService?.getCurrentUser?.()?.uid || "";
}

function reportFirestoreError(operation, pathSegments, error, uid = activeUid || authUid()) {
  console.error("Work4it Firestore-fejl", {
    operation,
    path: firestorePath(pathSegments),
    uid: uid || null,
    code: error?.code || "unknown",
    message: error?.message || String(error || "Ukendt fejl")
  });
}

function assertCloudUser(operation = "Firestore") {
  const uid = activeUid || "";
  const authenticatedUid = authUid();
  if (!uid || !cloudEnabled) {
    throw new Error(`${operation}: Cloud er ikke klar. Vent på login og prøv igen.`);
  }
  if (!authenticatedUid || authenticatedUid !== uid) {
    throw new Error(`${operation}: Firebase Auth UID er ikke klar eller matcher ikke aktiv cloud-session.`);
  }
  return uid;
}

async function getDocument(pathSegments, operation = "getDoc") {
  try {
    return await getDoc(doc(db, ...pathSegments));
  } catch (error) {
    reportFirestoreError(operation, pathSegments, error);
    throw error;
  }
}

async function readDocumentData(pathSegments) {
  const snapshot = await getDocument(pathSegments);
  return snapshot.exists() ? cleanDocument(snapshot.data()) : null;
}

async function readDocumentDataWithFallback(primaryPath, fallbackPath) {
  const primary = await readDocumentData(primaryPath);
  if (primary) return { data: primary, source: firestorePath(primaryPath) };
  if (!fallbackPath) return { data: null, source: "" };
  const fallback = await readDocumentData(fallbackPath);
  return { data: fallback, source: fallback ? firestorePath(fallbackPath) : "" };
}

async function getSyncMetadata(uid) {
  const snapshot = await getDocument(PATHS.syncMetadata(uid));
  return snapshot.exists() ? snapshot.data() : {};
}

async function setSyncMetadata(uid, data) {
  const syncPath = PATHS.syncMetadata(uid);
  try {
    await setDoc(doc(db, ...syncPath), {
      migrationVersion: MIGRATION_VERSION,
      ...data,
      updatedAt: new Date().toISOString(),
      firestoreUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    reportFirestoreError("setDoc", syncPath, error);
    throw error;
  }
  if (Object.prototype.hasOwnProperty.call(data, "migrationCompleted")) {
    const appStatePath = PATHS.appState(uid, "main");
    try {
      await setDoc(doc(db, ...appStatePath), {
        migrationCompleted: Boolean(data.migrationCompleted),
        migrationCompletedAt: data.migrationCompletedAt || null,
        updatedAt: new Date().toISOString(),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      reportFirestoreError("setDoc", appStatePath, error);
      throw error;
    }
  }
}

async function readCollection(pathSegments) {
  try {
    const snapshot = await getDocs(collection(db, ...pathSegments));
    return snapshot.docs.map(item => ({ ...cleanDocument(item.data()), id: item.id }));
  } catch (error) {
    reportFirestoreError("getDocs", pathSegments, error);
    throw error;
  }
}

async function upsertDocument(reference, localValue) {
  if (!localValue || typeof localValue !== "object") return false;
  const snapshot = await getDoc(reference);
  const remote = snapshot.exists() ? cleanDocument(snapshot.data()) : null;
  if (remote && timestampMillis(remote) > timestampMillis(localValue)) return false;
  await setDoc(reference, {
    ...cleanDocument(localValue),
    updatedAt: localValue.updatedAt || new Date().toISOString(),
    firestoreUpdatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

async function saveProfileToCloud(profile) {
  assertCloudUser("Profilgemning");
  const path = PATHS.profile(activeUid);
  const nextProfile = {
    ...cleanDocument(profile),
    updatedAt: profile?.updatedAt || new Date().toISOString(),
    firestoreUpdatedAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, ...path), nextProfile, { merge: true });
    localFingerprint = currentLocalFingerprint();
    window.dispatchEvent(new CustomEvent("firestore:profile-saved", {
      detail: { uid: activeUid, path: firestorePath(path) }
    }));
    queueSync();
    return true;
  } catch (error) {
    reportFirestoreError("setDoc", path, error);
    window.dispatchEvent(new CustomEvent("firestore:profile-save-failed", {
      detail: { uid: activeUid, path: firestorePath(path), error }
    }));
    throw error;
  }
}

async function saveProfileDocumentToCloud(documentId, value) {
  assertCloudUser("Cloud-gemning");
  const path = documentId === "membership"
    ? PATHS.membership(activeUid)
    : documentId === "appState"
      ? PATHS.settings(activeUid)
      : ["users", activeUid, "profile", documentId];
  try {
    await setDoc(doc(db, ...path), {
      ...cleanDocument(value),
      updatedAt: value?.updatedAt || new Date().toISOString(),
      firestoreUpdatedAt: serverTimestamp()
    }, { merge: true });
    localFingerprint = currentLocalFingerprint();
    return true;
  } catch (error) {
    reportFirestoreError("setDoc", path, error);
    throw error;
  }
}

const saveDailyToCloud = value => saveProfileDocumentToCloud("daily", value);
const saveMembershipToCloud = value => saveProfileDocumentToCloud("membership", value);

async function upsertCollection(pathSegments, values, prefix, fallbackUpdatedAt = "") {
  const reference = collection(db, ...pathSegments);
  const existing = await getDocs(reference);
  const remote = new Map(existing.docs.map(snapshot => [
    snapshot.id,
    cleanDocument(snapshot.data())
  ]));
  for (const [index, value] of (Array.isArray(values) ? values : []).entries()) {
    const id = stableId(value, prefix, index);
    const remoteValue = remote.get(id);
    const localUpdatedAt = value?.updatedAt || fallbackUpdatedAt;
    if (remoteValue && timestampMillis(remoteValue) > timestampMillis({ ...value, updatedAt: localUpdatedAt })) continue;
    await setDoc(doc(reference, id), {
      ...cleanDocument(value),
      id,
      updatedAt: localUpdatedAt || value?.savedAt || value?.date || new Date().toISOString(),
      firestoreUpdatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function syncPrograms(uid) {
  const localPrograms = parseLocal(KEYS.programs, []);
  const trashIds = new Set((parseLocal(KEYS.trash, []) || []).map(program => String(program?.id || "")));
  const programCollection = collection(db, "users", uid, "programs");
  for (const [programIndex, program] of (Array.isArray(localPrograms) ? localPrograms : []).entries()) {
    const programId = stableId(program, "program", programIndex);
    if (trashIds.has(programId)) continue;
    const programReference = doc(programCollection, programId);
    const remoteSnapshot = await getDoc(programReference);
    const remoteProgram = remoteSnapshot.exists() ? cleanDocument(remoteSnapshot.data()) : null;
    if (!remoteProgram || timestampMillis(program) >= timestampMillis(remoteProgram)) {
      const programData = cleanDocument(program);
      const days = Array.isArray(programData.days) ? programData.days : [];
      delete programData.days;
      await setDoc(programReference, {
        ...programData,
        id: programId,
        dayCount: days.length,
        updatedAt: program.updatedAt || program.savedAt || new Date().toISOString(),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true });
      await upsertCollection(
        ["users", uid, "programs", programId, "days"],
        days,
        "day",
        program.updatedAt || program.savedAt || new Date().toISOString()
      );
    }
  }

  // Et program slettes kun målrettet, når det findes i brugerens papirkurv.
  for (const programId of trashIds) {
    if (!programId) continue;
    const daySnapshots = await getDocs(collection(db, "users", uid, "programs", programId, "days"));
    for (const daySnapshot of daySnapshots.docs) await deleteDoc(daySnapshot.ref);
    await deleteDoc(doc(programCollection, programId));
  }
}

function activeSessionFromAutosave() {
  const autosave = parseLocal(KEYS.activeWorkout, null);
  const session = autosave?.session;
  return session && ["in_progress", "paused"].includes(session.sessionStatus) ? autosave : null;
}

function workoutDraftFromAutosave() {
  const autosave = parseLocal(KEYS.activeWorkout, null);
  if (!autosave || (!autosave.program && !autosave.draft)) return null;
  const updatedAt = autosave.session?.updatedAt ||
    autosave.draft?.savedAt ||
    autosave.program?.updatedAt ||
    autosave.program?.savedAt ||
    new Date().toISOString();
  return { ...cleanDocument(autosave), updatedAt };
}

async function syncActiveWorkout(uid) {
  const reference = doc(db, ...PATHS.activeWorkout(uid));
  const draftReference = doc(db, ...PATHS.appState(uid, "workoutDraft"));
  const activeAutosave = activeSessionFromAutosave();
  const workoutDraft = workoutDraftFromAutosave();
  if (!activeAutosave) {
    await deleteDoc(reference).catch(() => {});
  } else {
    await upsertDocument(reference, {
      ...cleanDocument(activeAutosave),
      status: activeAutosave.session.sessionStatus,
      sessionId: activeAutosave.session.sessionId || "",
      updatedAt: activeAutosave.session.updatedAt || new Date().toISOString()
    });
  }
  if (workoutDraft) await upsertDocument(draftReference, workoutDraft);
  else await deleteDoc(draftReference).catch(() => {});
}

async function clearActiveWorkout(uid = activeUid) {
  if (!uid || !cloudEnabled) return false;
  assertCloudUser("Ryd aktiv træning");
  await deleteDoc(doc(db, ...PATHS.activeWorkout(uid))).catch(error => {
    reportFirestoreError("clearActiveWorkout", PATHS.activeWorkout(uid), error, uid);
    throw error;
  });
  return true;
}

async function syncAllLocalData(uid = activeUid) {
  if (!uid || !cloudEnabled) return false;
  if (syncInProgress) {
    syncQueued = true;
    return false;
  }
  syncInProgress = true;
  try {
    assertCloudUser("Firestore-synkronisering");
    const profile = parseLocal(KEYS.profile, {});
    const daily = parseLocal(KEYS.daily, {});
    const membership = parseLocal(KEYS.membership, {});
    const appState = {
      lastActiveProgramId: parseLocal(KEYS.lastProgram, ""),
      theme: parseLocal(KEYS.theme, "work4it"),
      updatedAt: new Date().toISOString()
    };
    await Promise.all([
      upsertDocument(doc(db, ...PATHS.profile(uid)), profile),
      upsertDocument(doc(db, ...PATHS.daily(uid)), daily),
      upsertDocument(doc(db, ...PATHS.membership(uid)), membership),
      upsertDocument(doc(db, ...PATHS.settings(uid)), appState),
      upsertDocument(doc(db, ...PATHS.appState(uid, "main")), appState),
      syncPrograms(uid),
      upsertCollection(["users", uid, COLLECTIONS.sessions], parseLocal(KEYS.sessions, []), "session"),
      upsertCollection(["users", uid, COLLECTIONS.measurements], parseLocal(KEYS.measurements, []), "measurement"),
      upsertCollection(["users", uid, COLLECTIONS.aiHistory], parseLocal(KEYS.aiHistory, []), "message"),
      upsertCollection(["users", uid, COLLECTIONS.imports], parseLocal(KEYS.imports, []), "import"),
      upsertCollection(["users", uid, COLLECTIONS.customExercises], parseLocal(KEYS.customExercises, []), "exercise"),
      upsertCollection(["users", uid, COLLECTIONS.trash], parseLocal(KEYS.trash, []), "deleted"),
      syncActiveWorkout(uid)
    ]);
    await setSyncMetadata(uid, {
      lastSyncAt: new Date().toISOString(),
      cacheStrategy: "uid_scoped",
      conflictStrategy: "newest_updatedAt_wins",
      localStorageRole: "cache_fallback",
      status: "synced"
    });
    window.dispatchEvent(new CustomEvent("firestore:sync-completed"));
    return true;
  } catch (error) {
    reportFirestoreError("syncAllLocalData", ["users", uid], error, uid);
    await setSyncMetadata(uid, {
      status: "failed",
      lastError: error?.code || error?.message || "unknown"
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

async function hydratePrograms(uid) {
  const programSnapshots = await getDocs(collection(db, "users", uid, "programs"));
  const programs = [];
  for (const snapshot of programSnapshots.docs) {
    const data = cleanDocument(snapshot.data());
    const days = await readCollection(["users", uid, "programs", snapshot.id, "days"]);
    days.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    programs.push({ ...data, id: snapshot.id, days });
  }
  return programs;
}

async function hydrateFromFirestore(uid = activeUid, options = {}) {
  if (!uid) return false;
  const preserveLocalWhenCloudEmpty = Boolean(options.preserveLocalWhenCloudEmpty);
  try {
    assertCloudUser("Cloud-hentning");
    const profileSnapshot = getDocument(PATHS.profile(uid));
    const userSnapshot = getDocument(["users", uid]);
    const dailySnapshot = getDocument(PATHS.daily(uid));
    const membershipSnapshot = getDocument(PATHS.membership(uid));
    const settingsSnapshot = readDocumentDataWithFallback(PATHS.settings(uid), PATHS.legacySettings(uid));
    const appStateSnapshot = readDocumentDataWithFallback(PATHS.appState(uid, "main"), PATHS.legacySettings(uid));
    const [
      profile,
      userRoot,
      daily,
      membership,
      settings,
      appState,
      activeWorkout,
      workoutDraft,
      programs,
      sessions,
      measurements,
      aiHistory,
      imports,
      customExercises,
      trash
    ] = await Promise.all([
      profileSnapshot,
      userSnapshot,
      dailySnapshot,
      membershipSnapshot,
      settingsSnapshot,
      appStateSnapshot,
      getDocument(PATHS.activeWorkout(uid)),
      getDocument(PATHS.appState(uid, "workoutDraft")),
      hydratePrograms(uid),
      readCollection(["users", uid, COLLECTIONS.sessions]),
      readCollection(["users", uid, COLLECTIONS.measurements]),
      readCollection(["users", uid, COLLECTIONS.aiHistory]),
      readCollection(["users", uid, COLLECTIONS.imports]),
      readCollection(["users", uid, COLLECTIONS.customExercises]),
      readCollection(["users", uid, COLLECTIONS.trash])
    ]);

    const cloudProfile = profile.exists() ? cleanDocument(profile.data()) : null;
    const hasCloudProfile = hasProfileFields(cloudProfile);
    if (hasCloudProfile) {
      writeLocal(KEYS.profile, cloudProfile);
    } else if (!preserveLocalWhenCloudEmpty) {
      writeLocal(KEYS.profile, null);
    }
    if (daily.exists()) writeLocal(KEYS.daily, cleanDocument(daily.data()));
    else if (!preserveLocalWhenCloudEmpty) writeLocal(KEYS.daily, null);
    const rootUserData = userRoot.exists() ? cleanDocument(userRoot.data()) : null;
    if (membership.data || rootUserData?.role) {
      writeLocal(KEYS.membership, {
        ...(membership.data || {}),
        ...(rootUserData?.role ? {
          role: rootUserData.role,
          membership: rootUserData.membership || membership.data?.membership || undefined,
          aiRequests: rootUserData.aiRequests ?? membership.data?.aiRequests
        } : {})
      });
    }
    else if (!preserveLocalWhenCloudEmpty) writeLocal(KEYS.membership, null);
    const state = { ...(settings.data || {}), ...(appState.data || {}) };
    if (Object.keys(state).length) {
      if (state.lastActiveProgramId) writeLocal(KEYS.lastProgram, state.lastActiveProgramId);
      else if (!preserveLocalWhenCloudEmpty) writeLocal(KEYS.lastProgram, null);
      if (state.theme) {
        writeLocal(KEYS.theme, state.theme);
        window.dispatchEvent(new CustomEvent("work4it:theme-hydrated", {
          detail: { theme: state.theme, uid }
        }));
      } else if (!preserveLocalWhenCloudEmpty) {
        writeLocal(KEYS.theme, null);
        window.dispatchEvent(new CustomEvent("work4it:theme-hydrated", {
          detail: { theme: "work4it", uid }
        }));
      }
    } else if (!preserveLocalWhenCloudEmpty) {
      writeLocal(KEYS.lastProgram, null);
      writeLocal(KEYS.theme, null);
      window.dispatchEvent(new CustomEvent("work4it:theme-hydrated", {
        detail: { theme: "work4it", uid }
      }));
    }

    const writeCloudCollection = (key, values, sorter = null) => {
      if (values.length || !preserveLocalWhenCloudEmpty) {
        const next = sorter ? [...values].sort(sorter) : [...values];
        writeLocal(key, next);
      }
    };
    writeCloudCollection(KEYS.programs, programs, (a, b) => timestampMillis(b) - timestampMillis(a));
    writeCloudCollection(KEYS.sessions, sessions,
      (a, b) => new Date(a.date || a.completedAt || 0) - new Date(b.date || b.completedAt || 0));
    writeCloudCollection(KEYS.measurements, measurements,
      (a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    writeCloudCollection(KEYS.aiHistory, aiHistory.slice(-200));
    writeCloudCollection(KEYS.imports, imports);
    writeCloudCollection(KEYS.customExercises, customExercises);
    writeCloudCollection(KEYS.trash, trash);

    if (activeWorkout.exists()) {
      const remoteAutosave = cleanDocument(activeWorkout.data());
      writeLocal(KEYS.activeWorkout, remoteAutosave);
    } else if (workoutDraft.exists()) {
      writeLocal(KEYS.activeWorkout, cleanDocument(workoutDraft.data()));
    } else if (!preserveLocalWhenCloudEmpty) {
      writeLocal(KEYS.activeWorkout, null);
    }

    localFingerprint = currentLocalFingerprint();
    const cloudHasData = hasCloudProfile || daily.exists() || Boolean(membership.data) || Boolean(settings.data || appState.data) ||
      activeWorkout.exists() || workoutDraft.exists() || [programs, sessions, measurements, aiHistory, imports, customExercises, trash]
        .some(values => values.length > 0);
    window.dispatchEvent(new CustomEvent("firestore:data-hydrated", {
      detail: { uid, source: "firestore", authoritative: !preserveLocalWhenCloudEmpty, cloudHasData }
    }));
    return { success: true, cloudHasData };
  } catch (error) {
    console.warn("Firestore kunne ikke hentes. Appen fortsætter med den aktive brugers UID-cache.", error);
    window.dispatchEvent(new CustomEvent("firestore:fallback-active", { detail: { error } }));
    return { success: false, cloudHasData: false, error };
  }
}

function showLegacyMigrationDialog() {
  return new Promise(resolve => {
    migrationDialogRoot?.remove();
    const root = document.createElement("div");
    migrationDialogRoot = root;
    root.className = "migration-dialog";
    root.innerHTML = `
      <div class="migration-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="migrationTitle">
        <h2 id="migrationTitle">Gamle lokale træningsdata fundet</h2>
        <p>Dataene er fra appens tidligere, ikke-kontoopdelte lager. Vil du knytte dem til den konto, du er logget ind med nu?</p>
        <p class="migration-note">Valget tilbydes kun én gang. Ved accept gemmes også en lokal backup under denne konto.</p>
        <div class="migration-actions">
          <button type="button" data-choice="yes">Ja, knyt data til min konto</button>
          <button type="button" data-choice="no">Nej, spring gamle data over</button>
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

function currentLocalFingerprint() {
  return Object.values(KEYS).map(key => `${key}:${localStorage.getItem(key) || ""}`).join("|");
}

function queueSync() {
  if (!activeUid || !cloudEnabled || !localSyncReady || cloudHydrationInProgress) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => syncAllLocalData(), 900);
}

async function refreshFromCloud(reason = "manual") {
  if (!activeUid || !cloudEnabled || refreshInProgress || syncInProgress) return false;
  const now = Date.now();
  if (reason !== "manual" && now - lastCloudRefreshAt < 15000) return false;
  refreshInProgress = true;
  cloudHydrationInProgress = true;
  try {
    // Firestore er autoritativ ved login. Refresh/focus/online må aldrig
    // uploade en gammel lokal cache før Cloud er hentet.
    const result = await hydrateFromFirestore(activeUid, { preserveLocalWhenCloudEmpty: false });
    if (!result.success) throw result.error || new Error("Cloud-data kunne ikke opdateres.");
    lastCloudRefreshAt = Date.now();
    return true;
  } finally {
    cloudHydrationInProgress = false;
    refreshInProgress = false;
  }
}

async function initializeUserData(user) {
  activeUid = user.uid;
  storageScope?.setActiveUid(activeUid);
  cloudEnabled = true;
  localSyncReady = false;
  cloudHydrationInProgress = true;
  const metadata = await getSyncMetadata(activeUid).catch(() => ({}));
  const localMigrationDecision = storageScope?.legacyResolution?.(activeUid);
  const cloudMigrationDecision = ["accepted", "declined"].includes(metadata.legacyMigrationStatus)
    ? metadata.legacyMigrationStatus
    : "";
  const legacyAvailable = storageScope?.hasLegacyData?.() &&
    !localMigrationDecision &&
    !cloudMigrationDecision;

  const cloudBootstrapCompleted = metadata.cloudBootstrapCompleted === true;

  // Efter første bootstrap er Firestore autoritativ og overskriver altid UID-cachen.
  // Første gang bevares en eventuel UID-cache, hvis Cloud endnu er tom.
  let hydration;
  try {
    hydration = await hydrateFromFirestore(activeUid, {
      preserveLocalWhenCloudEmpty: !cloudBootstrapCompleted
    });
    if (!hydration.success) throw hydration.error || new Error("Cloud-data kunne ikke hentes.");
    if (!cloudBootstrapCompleted && hydration.cloudHasData) {
      hydration = await hydrateFromFirestore(activeUid, { preserveLocalWhenCloudEmpty: false });
      if (!hydration.success) throw hydration.error || new Error("Cloud-data kunne ikke hentes.");
    }
  } finally {
    cloudHydrationInProgress = false;
  }

  let legacyAccepted = false;
  if (legacyAvailable) {
    const accepted = await showLegacyMigrationDialog();
    storageScope.resolveLegacyMigration(accepted ? "accepted" : "declined", activeUid);
    if (accepted) {
      storageScope.importLegacyToCurrent();
      legacyAccepted = true;
    }
  }

  const migrationDecision = storageScope?.legacyResolution?.(activeUid)?.status ||
    cloudMigrationDecision ||
    "none";
  const migrationCompletedAt = metadata.migrationCompletedAt || new Date().toISOString();
  const shouldBootstrapLocalCache = !cloudBootstrapCompleted && !hydration.cloudHasData;
  if (shouldBootstrapLocalCache || legacyAccepted) {
    await syncAllLocalData(activeUid);
  }

  await setSyncMetadata(activeUid, {
    migrationCompleted: true,
    migrationCompletedAt,
    legacyMigrationStatus: migrationDecision,
    cloudBootstrapCompleted: true,
    cloudBootstrapCompletedAt: metadata.cloudBootstrapCompletedAt || new Date().toISOString(),
    sourceOfTruth: "firestore",
    cacheStrategy: "uid_scoped",
    status: "ready"
  });
  localFingerprint = currentLocalFingerprint();
  localSyncReady = true;
  window.dispatchEvent(new CustomEvent("firestore:user-ready", {
    detail: { uid: activeUid, fallback: false }
  }));
}

function initializeUser(user) {
  const uid = String(user?.uid || "");
  if (!uid) return Promise.resolve();
  if (initializationByUid.has(uid)) return initializationByUid.get(uid);
  const initialization = initializeUserData(user).finally(() => {
    if (initializationByUid.get(uid) === initialization) initializationByUid.delete(uid);
  });
  initializationByUid.set(uid, initialization);
  return initialization;
}

function clearRuntimeForLogout() {
  window.clearTimeout(syncTimer);
  syncTimer = null;
  migrationDialogRoot?.remove();
  migrationDialogRoot = null;
  activeUid = "";
  cloudEnabled = false;
  localSyncReady = false;
  cloudHydrationInProgress = false;
  localFingerprint = "";
  storageScope?.setActiveUid("");
  window.dispatchEvent(new CustomEvent("firestore:user-cache-cleared"));
}

window.addEventListener("workit-storage:changed", queueSync);
window.addEventListener("daily-motivation:changed", event => {
  if (!activeUid || !event.detail) return;
  saveDailyToCloud(event.detail).catch(error => {
    window.dispatchEvent(new CustomEvent("firestore:daily-save-failed", { detail: { error } }));
  });
});
window.addEventListener("membership:changed", event => {
  if (!event.detail) return;
  if (!activeUid || !cloudEnabled) {
    window.dispatchEvent(new CustomEvent("membership:cloud-failed", { detail: { reason: "cloud_unavailable" } }));
    return;
  }
  window.dispatchEvent(new CustomEvent("membership:cloud-saving"));
  saveMembershipToCloud(event.detail).then(() => {
    window.dispatchEvent(new CustomEvent("membership:cloud-saved"));
  }).catch(error => {
    window.dispatchEvent(new CustomEvent("membership:cloud-failed", { detail: { error } }));
    window.dispatchEvent(new CustomEvent("firestore:membership-save-failed", { detail: { error } }));
  });
});
window.addEventListener("work4it:theme-changed", event => {
  const theme = event.detail?.theme || "work4it";
  const user = window.FirebaseAuthService?.getCurrentUser?.() || null;
  if (!user) return;
  if (!activeUid || !cloudEnabled) {
    window.dispatchEvent(new CustomEvent("work4it:theme-cloud-failed", {
      detail: { reason: "cloud_unavailable" }
    }));
    return;
  }
  window.dispatchEvent(new CustomEvent("work4it:theme-cloud-saving", { detail: { theme } }));
  saveProfileDocumentToCloud("appState", {
    theme,
    updatedAt: new Date().toISOString()
  }).then(() => {
    localFingerprint = currentLocalFingerprint();
    window.dispatchEvent(new CustomEvent("work4it:theme-cloud-saved", { detail: { theme } }));
  }).catch(error => {
    window.dispatchEvent(new CustomEvent("work4it:theme-cloud-failed", { detail: { theme, error } }));
  });
});
window.addEventListener("focus", () => refreshFromCloud("focus").catch(() => {}));
window.addEventListener("online", () => refreshFromCloud("online").catch(() => {}));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshFromCloud("visibility").catch(() => {});
});
window.setInterval(() => {
  if (!activeUid || !localSyncReady || cloudHydrationInProgress) return;
  const next = currentLocalFingerprint();
  if (next === localFingerprint) return;
  localFingerprint = next;
  queueSync();
}, 2000);

async function exportPrograms(uid) {
  const programSnapshots = await getDocs(collection(db, "users", uid, "programs"));
  const programs = [];
  for (const snapshot of programSnapshots.docs) {
    const program = { ...cleanDocument(snapshot.data()), id: snapshot.id };
    const days = await readCollection(["users", uid, "programs", snapshot.id, "days"]);
    days.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    programs.push({ ...program, days });
  }
  return programs;
}

async function exportCurrentUserData(uid = activeUid) {
  if (!uid || !cloudEnabled) {
    return {
      source: "localStorage",
      exportedAt: new Date().toISOString(),
      note: "Bruger er ikke logget ind eller cloud er ikke klar. Eksporten er lavet fra lokal cache.",
      localCache: storageScope?.exportCurrentUserData?.() || {}
    };
  }

  const readDoc = async (...segments) => {
    const snapshot = await getDoc(doc(db, ...segments));
    return snapshot.exists() ? cleanDocument(snapshot.data()) : null;
  };

  const [
    profile,
    daily,
    membership,
    settings,
    appState,
    syncMetadata,
    activeWorkout,
    programs,
    workoutSessions,
    bodyMeasurements,
    aiCopilotHistory,
    aiHistoryAlias,
    imports,
    customExercises,
    deletedPrograms,
    trashAlias,
    records
  ] = await Promise.all([
    readDoc(...PATHS.profile(uid)),
    readDoc(...PATHS.daily(uid)),
    readDoc(...PATHS.membership(uid)),
    readDoc(...PATHS.settings(uid)),
    readDoc(...PATHS.appState(uid, "main")),
    readDoc(...PATHS.syncMetadata(uid)),
    readDoc(...PATHS.activeWorkout(uid)),
    exportPrograms(uid),
    readCollection(["users", uid, "workoutSessions"]),
    readCollection(["users", uid, "bodyMeasurements"]),
    readCollection(["users", uid, "aiCopilotHistory"]),
    readCollection(["users", uid, "aiHistory"]),
    readCollection(["users", uid, "imports"]),
    readCollection(["users", uid, "customExercises"]),
    readCollection(["users", uid, "deletedPrograms"]),
    readCollection(["users", uid, "trash"]),
    readCollection(["users", uid, "records"])
  ]);

  return {
    source: "firestore",
    exportedAt: new Date().toISOString(),
    uid,
    profile: { main: profile, daily, syncMetadata },
    membership,
    settings,
    appState,
    programs,
    workoutSessions,
    bodyMeasurements,
    activeWorkout,
    aiCopilotHistory,
    aiHistoryAlias,
    imports,
    customExercises,
    trash: { deletedPrograms, trashAlias },
    records,
    localCacheBackup: storageScope?.exportCurrentUserData?.() || {}
  };
}

async function deleteCollectionDocuments(pathSegments, nestedDelete = null) {
  const snapshot = await getDocs(collection(db, ...pathSegments));
  for (const item of snapshot.docs) {
    if (nestedDelete) await nestedDelete(item.id);
    await deleteDoc(item.ref);
  }
}

async function deleteAllPrograms(uid) {
  await deleteCollectionDocuments(["users", uid, "programs"], async programId => {
    await deleteCollectionDocuments(["users", uid, "programs", programId, "days"]);
  });
}

async function deleteCurrentUserData(uid = activeUid) {
  if (!uid || !cloudEnabled) throw new Error("Cloud er ikke klar til datasletning.");

  await deleteAllPrograms(uid);
  await Promise.all([
    deleteCollectionDocuments(["users", uid, "workoutSessions"]),
    deleteCollectionDocuments(["users", uid, "bodyMeasurements"]),
    deleteCollectionDocuments(["users", uid, "aiCopilotHistory"]),
    deleteCollectionDocuments(["users", uid, "aiHistory"]),
    deleteCollectionDocuments(["users", uid, "imports"]),
    deleteCollectionDocuments(["users", uid, "customExercises"]),
    deleteCollectionDocuments(["users", uid, "deletedPrograms"]),
    deleteCollectionDocuments(["users", uid, "trash"]),
    deleteCollectionDocuments(["users", uid, "records"]),
    deleteCollectionDocuments(["users", uid, "settings"]),
    deleteCollectionDocuments(["users", uid, "membership"]),
    deleteCollectionDocuments(["users", uid, "appState"])
  ]);

  await Promise.all([
    deleteDoc(doc(db, ...PATHS.activeWorkout(uid))).catch(() => {}),
    deleteDoc(doc(db, ...PATHS.profile(uid))).catch(() => {}),
    deleteDoc(doc(db, ...PATHS.daily(uid))).catch(() => {}),
      deleteDoc(doc(db, ...PATHS.legacySettings(uid))).catch(() => {}),
    deleteDoc(doc(db, ...PATHS.syncMetadata(uid))).catch(() => {}),
    deleteDoc(doc(db, "users", uid)).catch(() => {})
  ]);

  storageScope?.clearCurrentUserCache?.();
  localStorage.removeItem("work4it:privacyConsent");
  window.dispatchEvent(new CustomEvent("firestore:user-data-deleted", { detail: { uid } }));
  return true;
}

window.FirestoreDataService = {
  keys: { ...KEYS },
  saveProfileToCloud,
  saveDailyToCloud,
  saveMembershipToCloud,
  refreshFromCloud,
  syncAllLocalData,
  clearActiveWorkout,
  hydrateFromFirestore,
  exportCurrentUserData,
  deleteCurrentUserData,
  requestMigration: async () => {
    if (!activeUid || !storageScope?.hasLegacyData?.() || storageScope?.legacyResolution?.(activeUid)) return false;
    const accepted = await showLegacyMigrationDialog();
    storageScope.resolveLegacyMigration(accepted ? "accepted" : "declined", activeUid);
    if (!accepted) return false;
    storageScope.importLegacyToCurrent();
    return syncAllLocalData(activeUid);
  },
  saveImportData(payload) {
    const imports = parseLocal(KEYS.imports, []);
    const entry = {
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceType: "screenshot",
      ...cleanDocument(payload)
    };
    localStorage.setItem(KEYS.imports, JSON.stringify([
      ...(Array.isArray(imports) ? imports : []),
      entry
    ]));
    return entry;
  },
  refreshPricingConfig: loadPublicPricingConfig,
  deleteDeletedProgram: async programId => {
    if (!activeUid || !programId) return false;
    await deleteDoc(doc(db, "users", activeUid, COLLECTIONS.trash, String(programId)));
    return true;
  },
  isCloudPrimary: () => cloudEnabled,
  getActiveUid: () => activeUid
};

function beginAuthenticatedUser(user) {
  initializeUser(user).catch(error => {
    console.error("Kunne ikke initialisere brugerens cloud-data.", error);
    window.dispatchEvent(new CustomEvent("firestore:fallback-active", { detail: { error } }));
    window.dispatchEvent(new CustomEvent("firestore:user-ready", {
      detail: { uid: user.uid, fallback: true }
    }));
  });
}

window.addEventListener("firebase-auth:changed", () => {
  const user = window.FirebaseAuthService?.getCurrentUser?.() || null;
  if (!user) {
    clearRuntimeForLogout();
    loadPublicPricingConfig();
    return;
  }
  beginAuthenticatedUser(user);
  loadPublicPricingConfig();
});

const existingUser = window.FirebaseAuthService?.getCurrentUser?.();
if (existingUser) beginAuthenticatedUser(existingUser);
loadPublicPricingConfig();
