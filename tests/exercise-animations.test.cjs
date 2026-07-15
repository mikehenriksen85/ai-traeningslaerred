const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const modelSource = fs.readFileSync(path.join(root, "app", "exercise-animation-model.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const cloudSource = fs.readFileSync(path.join(root, "app", "exercise-animation-cloud-service.js"), "utf8");
const aiSource = fs.readFileSync(path.join(root, "app", "ai-system.js"), "utf8");
const functionsSource = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "app", "service-worker.js"), "utf8");
const firestoreRules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
const storageRules = fs.readFileSync(path.join(root, "storage.rules"), "utf8");

const sandbox = {
  window: { matchMedia: () => ({ matches: false }) },
  document: {},
  performance: { now: () => 0 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {}
};
vm.createContext(sandbox);
vm.runInContext(modelSource, sandbox);
const animations = sandbox.window.Work4itExerciseAnimations;

assert.ok(animations, "Animationsmodellen eksponeres");
const id = animations.exerciseId("Barbell Bench Press", "Bryst");
assert.equal(id, animations.exerciseId("Barbell Bench Press", "Bryst"), "exerciseId er deterministisk");
assert.match(id, /^ex_barbell-bench-press_[a-z0-9]{7}$/);
assert.notEqual(id, animations.exerciseId("Barbell Bench Press", "Skuldre"), "Muskelgruppe indg\u00e5r i stabil identitet");

const spec = animations.originalSpecification({ name: "Back Squat", muscle: "Forside l\u00e5r" });
assert.equal(spec.duration, 4);
assert.equal(spec.loop, true);
assert.equal(spec.cameraAngle, "front_three_quarter");
assert.deepEqual(Array.from(spec.availableModes), ["standard", "muscle", "slowMotion", "alternateAngle"]);
assert.equal(animations.validateSpecification(spec).valid, true, "Generatorens output valideres");
assert.equal(animations.validateSpecification({ ...spec, duration: 8 }).valid, false, "For lang animation afvises");
assert.equal(animations.validateSpecification({ ...spec, sourceAssets: ["copied.glb"] }).valid, false, "Eksterne source assets afvises");
assert.equal(typeof animations.generateSpecification, "function", "Kontrolleret generator er eksponeret");
assert.equal(typeof animations.renderSpecificationToVideo, "function", "Specifikationen kan renderes automatisk til video");

const pending = animations.normalizeMetadata({ exerciseId: id, generationStatus: "pending_review" });
assert.equal(pending.generationStatus, "pending_review");
assert.equal(animations.validateMetadata({ ...pending, generationStatus: "approved" }).valid, false, "Godkendelse kr\u00e6ver medie");

assert.ok(indexSource.includes("Work4itExerciseAnimations?.openViewer"), "Demo bruger intern viewer");
assert.ok(modelSource.includes("canvas.captureStream(24)"), "Canvas-animation optages som video");
assert.ok(modelSource.includes("new MediaRecorder"), "Browserens medieencoder bruges");
assert.ok(modelSource.includes("uploadVersionMedia(exercise.exerciseId, saved.version"), "Genereret video uploades automatisk");
assert.ok(!/google\.com\/search\?tbm=vid/.test(indexSource), "Eksternt Demo-link er fjernet");
assert.ok(indexSource.includes("exercise-animation-cloud-service.js"), "Cloud-laget indl\u00e6ses");
assert.ok(cloudSource.includes('ROOT_COLLECTION = "exerciseAnimations"'));
assert.ok(cloudSource.includes('STORAGE_ROOT = "exercise-animations"'));
assert.ok(cloudSource.includes("LOCAL_METADATA_PREFIX"), "Godkendt metadata har offline fallback");
assert.ok(cloudSource.includes("approveVersion"), "Manuel godkendelse er implementeret");
assert.ok(cloudSource.includes('httpsCallable(functions, "createExerciseAnimationDraft")'), "Kladder skrives via verificeret backend");
assert.ok(functionsSource.includes("requirePermanentAdminRequest"), "Backend dobbelttjekker administratorens Auth-konto");
assert.ok(functionsSource.includes("exports.createExerciseAnimationDraft"));
assert.ok(functionsSource.includes("exports.recordExerciseAnimationUpload"));
assert.ok(functionsSource.includes("admin.storage().bucket()"), "Backend uploader medier uden klientens Storage-regler");
assert.ok(cloudSource.includes("fileAsBase64"), "Genererede filer sendes til den verificerede backend");
assert.ok(functionsSource.includes("exports.approveExerciseAnimationVersion"));
assert.ok(aiSource.includes("createExerciseAnimationSpecification"), "AI-systemet kan oprette en animationsspecifikation");
assert.ok(workerSource.includes("ANIMATION_CACHE_NAME"), "PWA runtime-cache er implementeret");
assert.ok(workerSource.includes("firebasestorage.googleapis.com"));
assert.ok(firestoreRules.includes("match /exerciseAnimations/{exerciseId}"));
assert.ok(storageRules.includes("match /exercise-animations/{exerciseId}/{version}/{fileName}"));
assert.ok(storageRules.includes("isPermanentAdmin()"));
assert.ok(firestoreRules.includes("request.auth.token.email.lower()"), "Admin-email sammenlignes case-insensitivt i Firestore");
assert.ok(storageRules.includes("request.auth.token.email.lower()"), "Admin-email sammenlignes case-insensitivt i Storage");

console.log("Exercise animation phase 1 tests passed");
