import { db, auth, storage, functions } from "./firebase-config.js?v=20260715-exercise-animations1";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";

const ROOT_COLLECTION = "exerciseAnimations";
const STORAGE_ROOT = "exercise-animations";
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const MEDIA_TYPES = new Set(["video/webm", "video/mp4", "image/gif"]);
const THUMBNAIL_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const memoryCache = new Map();
const LOCAL_METADATA_PREFIX = "work4it:exercise-animation:";
const createDraftCallable = httpsCallable(functions, "createExerciseAnimationDraft");
const recordUploadCallable = httpsCallable(functions, "recordExerciseAnimationUpload");
const approveVersionCallable = httpsCallable(functions, "approveExerciseAnimationVersion");

function model() {
  const api = window.Work4itExerciseAnimations;
  if (!api) throw new Error("Animationsmodellen er ikke indl\u00e6st");
  return api;
}

function requireUser() {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Log ind for at bruge animationsbiblioteket");
  return user;
}

function requireAdmin() {
  const user = requireUser();
  if (window.Work4itAdminConfig?.isPermanentAdminEmail?.(user.email) !== true &&
      window.Work4itAdminConfig?.isCurrentUserAdmin?.() !== true) {
    throw new Error("Kun administrator kan \u00e6ndre animationer");
  }
  return user;
}

function versionId(version) {
  return `v${String(Math.max(1, Number.parseInt(version, 10))).padStart(4, "0")}`;
}

function rootRef(exerciseId) {
  return doc(db, ROOT_COLLECTION, exerciseId);
}

function versionRef(exerciseId, version) {
  return doc(db, ROOT_COLLECTION, exerciseId, "versions", versionId(version));
}

function readLocalMetadata(exerciseId) {
  try {
    return JSON.parse(localStorage.getItem(`${LOCAL_METADATA_PREFIX}${exerciseId}`) || "null");
  } catch {
    return null;
  }
}

function writeLocalMetadata(exerciseId, value) {
  try {
    if (value?.generationStatus === "approved") localStorage.setItem(`${LOCAL_METADATA_PREFIX}${exerciseId}`, JSON.stringify(value));
  } catch {}
}

function serializableMetadata(value) {
  const validation = model().validateMetadata(value);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const metadata = validation.metadata;
  return {
    exerciseId: metadata.exerciseId,
    animationUrl: metadata.animationUrl,
    thumbnailUrl: metadata.thumbnailUrl,
    duration: metadata.duration,
    version: metadata.version,
    generationStatus: metadata.generationStatus,
    cameraAngle: metadata.cameraAngle,
    availableModes: metadata.availableModes,
    specification: metadata.specification || null
  };
}

async function getAnimation(exerciseId, { force = false } = {}) {
  requireUser();
  if (!force && memoryCache.has(exerciseId)) return memoryCache.get(exerciseId);
  if (!force && navigator.onLine === false) {
    const offline = readLocalMetadata(exerciseId);
    if (offline) {
      memoryCache.set(exerciseId, offline);
      return offline;
    }
  }
  try {
    const snapshot = await getDoc(rootRef(exerciseId));
    const value = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    memoryCache.set(exerciseId, value);
    writeLocalMetadata(exerciseId, value);
    return value;
  } catch (error) {
    const cached = readLocalMetadata(exerciseId);
    if (cached) {
      console.info("[Work4it animation] Bruger cachet metadata, mens Firestore er offline.", { exerciseId, code: error?.code });
      memoryCache.set(exerciseId, cached);
      return cached;
    }
    throw error;
  }
}

async function getLatestVersion(exerciseId) {
  requireUser();
  const versions = collection(db, ROOT_COLLECTION, exerciseId, "versions");
  const snapshot = await getDocs(query(versions, orderBy("version", "desc"), limit(1)));
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function saveDraft(specification) {
  requireAdmin();
  const validation = model().validateSpecification(specification);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const response = await createDraftCallable({ specification });
  const draft = serializableMetadata(response.data);
  memoryCache.delete(specification.exerciseId);
  return draft;
}

function extensionFor(file) {
  const byType = { "video/webm": "webm", "video/mp4": "mp4", "image/gif": "gif", "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };
  return byType[file.type] || "bin";
}

function assertFile(file, allowedTypes, maxBytes, label) {
  if (!file || !allowedTypes.has(file.type)) throw new Error(`${label} har et ugyldigt filformat`);
  if (file.size > maxBytes) throw new Error(`${label} er for stor`);
}

function uploadFile(storageRef, file, metadata) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, metadata);
    task.on("state_changed", null, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
  });
}

async function uploadVersionMedia(exerciseId, version, mediaFile, thumbnailFile = null) {
  requireAdmin();
  assertFile(mediaFile, MEDIA_TYPES, MAX_MEDIA_BYTES, "Animationen");
  if (thumbnailFile) assertFile(thumbnailFile, THUMBNAIL_TYPES, MAX_THUMBNAIL_BYTES, "Thumbnail");
  const snapshot = await getDoc(versionRef(exerciseId, version));
  if (!snapshot.exists()) throw new Error("Animationsversionen findes ikke");
  if (snapshot.data().generationStatus === "approved") throw new Error("En godkendt version kan ikke overskrives");
  const folder = `${STORAGE_ROOT}/${exerciseId}/${versionId(version)}`;
  const animationUrl = await uploadFile(
    ref(storage, `${folder}/animation.${extensionFor(mediaFile)}`),
    mediaFile,
    { contentType: mediaFile.type, customMetadata: { exerciseId, version: String(version), origin: "work4it-original" } }
  );
  const thumbnailUrl = thumbnailFile
    ? await uploadFile(ref(storage, `${folder}/thumbnail.${extensionFor(thumbnailFile)}`), thumbnailFile, { contentType: thumbnailFile.type, customMetadata: { exerciseId, version: String(version), origin: "work4it-original" } })
    : "";
  await recordUploadCallable({ exerciseId, version, animationUrl, thumbnailUrl });
  memoryCache.delete(exerciseId);
  return { animationUrl, thumbnailUrl };
}

async function approveVersion(exerciseId, version) {
  requireAdmin();
  const response = await approveVersionCallable({ exerciseId, version });
  const approved = serializableMetadata(response.data);
  memoryCache.set(exerciseId, approved);
  writeLocalMetadata(exerciseId, approved);
  return approved;
}

window.Work4itExerciseAnimationCloud = Object.freeze({
  ROOT_COLLECTION,
  STORAGE_ROOT,
  getAnimation,
  getLatestVersion,
  saveDraft,
  uploadVersionMedia,
  approveVersion,
  clearCache: exerciseId => exerciseId ? memoryCache.delete(exerciseId) : memoryCache.clear()
});

window.addEventListener("firebase-auth:changed", () => memoryCache.clear());
