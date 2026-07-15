import { db, auth, functions } from "./firebase-config.js?v=20260715-exercise-animations1";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-functions.js";

const ROOT_COLLECTION = "exerciseAnimations";
const STORAGE_ROOT = "exercise-animations";
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const MEDIA_TYPES = new Set(["video/webm", "video/mp4", "image/gif"]);
const THUMBNAIL_TYPES = new Set(["image/webp", "image/png", "image/jpeg"]);
const memoryCache = new Map();
const LOCAL_METADATA_PREFIX = "work4it:exercise-animation:";
const createDraftCallable = httpsCallable(functions, "createExerciseAnimationDraft");
const getAdminStateCallable = httpsCallable(functions, "getExerciseAnimationAdminState");
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

function rootRef(exerciseId) {
  return doc(db, ROOT_COLLECTION, exerciseId);
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
  requireAdmin();
  const response = await getAdminStateCallable({ exerciseId });
  return response.data?.latest || null;
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

function assertFile(file, allowedTypes, maxBytes, label) {
  if (!file || !allowedTypes.has(file.type)) throw new Error(`${label} har et ugyldigt filformat`);
  if (file.size > maxBytes) throw new Error(`${label} er for stor`);
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "").split(",")[1] || ""), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("Filen kunne ikke læses")), { once: true });
    reader.readAsDataURL(file);
  });
}

async function uploadVersionMedia(exerciseId, version, mediaFile, thumbnailFile = null) {
  requireAdmin();
  assertFile(mediaFile, MEDIA_TYPES, MAX_MEDIA_BYTES, "Animationen");
  if (thumbnailFile) assertFile(thumbnailFile, THUMBNAIL_TYPES, MAX_THUMBNAIL_BYTES, "Thumbnail");
  const response = await recordUploadCallable({
    exerciseId,
    version,
    media: { contentType: mediaFile.type, base64: await fileAsBase64(mediaFile) },
    thumbnail: thumbnailFile ? { contentType: thumbnailFile.type, base64: await fileAsBase64(thumbnailFile) } : null
  });
  const { animationUrl, thumbnailUrl = "" } = response.data || {};
  if (!animationUrl) throw new Error("Backend-uploaden returnerede ingen animations-URL");
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
