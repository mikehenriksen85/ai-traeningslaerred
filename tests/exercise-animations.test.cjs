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
const renderer3dSource = fs.readFileSync(path.join(root, "app", "exercise-animation-3d-renderer.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "app", "service-worker.js"), "utf8");
const firestoreRules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
const storageRules = fs.readFileSync(path.join(root, "storage.rules"), "utf8");
const mannequinSource = fs.readFileSync(path.join(root, "app", "exercise-animation", "mannequin.js"), "utf8");
const mannequinCss = fs.readFileSync(path.join(root, "app", "exercise-animation", "mannequin.css"), "utf8");
const mannequinAnimationsSource = fs.readFileSync(path.join(root, "app", "exercise-animation", "animations.js"), "utf8");
const mannequinMusclesSource = fs.readFileSync(path.join(root, "app", "exercise-animation", "muscles.js"), "utf8");

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
assert.equal(spec.rendererVersion, "work4it-three-rig-v1");

const pending = animations.normalizeMetadata({ exerciseId: id, generationStatus: "pending_review" });
assert.equal(pending.generationStatus, "pending_review");
assert.equal(animations.validateMetadata({ ...pending, generationStatus: "approved" }).valid, false, "Godkendelse kr\u00e6ver medie");

assert.ok(indexSource.includes("Work4itExerciseAnimations?.openViewer"), "Demo bruger intern viewer");
assert.ok(modelSource.includes("canvas.captureStream(24)"), "Canvas-animation optages som video");
assert.ok(modelSource.includes("new MediaRecorder"), "Browserens medieencoder bruges");
assert.ok(modelSource.includes("engine.create(canvas, specification)"), "Videoen renderes med 3D-motoren");
assert.ok(modelSource.includes("videoTrack.requestFrame()"), "WebGL-frames sendes deterministisk til videoencoder");
assert.ok(modelSource.includes("Browseren kunne ikke afslutte 3D-videoen"), "En fastlåst videoencoder giver en tydelig fejl");
assert.ok(renderer3dSource.includes('return "push_up"'), "Push-Up har en særskilt biomekanisk profil");
assert.ok(renderer3dSource.includes("THREE.WebGLRenderer"), "Professionel WebGL-renderer bruges");
assert.ok(renderer3dSource.includes("PCFSoftShadowMap"), "3D-scenen bruger bløde skygger");
assert.ok(renderer3dSource.includes("applyPushUpPose"), "Push-Up har øvelsesspecifik poseberegning");
assert.ok(renderer3dSource.includes("length / 3"), "3D-led skaleres efter deres reelle længde");
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
assert.ok(functionsSource.includes("exports.getExerciseAnimationAdminState"));
assert.ok(cloudSource.includes('httpsCallable(functions, "getExerciseAnimationAdminState")'), "Admin-preview læses via backend");
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

const prototypeSandbox = { window: {} };
vm.createContext(prototypeSandbox);
vm.runInContext(mannequinMusclesSource, prototypeSandbox);
vm.runInContext(mannequinAnimationsSource, prototypeSandbox);
const prototypeDefinitions = prototypeSandbox.window.Work4itMannequinAnimations.DEFINITIONS;
assert.deepEqual(Object.keys(prototypeDefinitions), ["push_up", "dumbbell_curl", "back_squat"], "Prototypen omfatter kun de tre aftalte øvelser");
assert.deepEqual(Array.from(prototypeDefinitions.push_up.muscles), ["chest", "triceps", "frontShoulder"]);
assert.deepEqual(Array.from(prototypeDefinitions.dumbbell_curl.muscles), ["biceps", "forearm"]);
assert.deepEqual(Array.from(prototypeDefinitions.back_squat.muscles), ["quadriceps", "gluteus", "hamstrings"]);
Object.values(prototypeDefinitions).forEach(definition => {
  assert.ok(definition.duration >= 3 && definition.duration <= 5, `${definition.name} har et roligt 3-5 sekunders loop`);
  assert.equal(definition.keyframes.length, 3, `${definition.name} har separate start-, slut- og loop-keyframes`);
});
assert.match(mannequinSource, /createElementNS\(SVG_NS/);
assert.match(mannequinSource, /requestAnimationFrame\(animate\)/);
assert.doesNotMatch(mannequinSource, /THREE|fetch\(|\.gif|<canvas/i, "SVG-prototypen bruger ingen biblioteker, GIF eller Canvas");
assert.match(mannequinCss, /#f97316/i, "Work4its orange prototypefarve bruges til muskler og pile");
assert.match(mannequinCss, /@media \(max-width: 640px\)/);
assert.match(mannequinCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(indexSource, /Work4itMannequin\?\.supports\?\.\(exerciseName\)/, "De tre prototyper åbnes direkte på øvelseskortet");
assert.match(indexSource, /Work4itExerciseAnimations\?\.openViewer/, "Andre øvelser beholder det eksisterende demo-flow");
assert.match(workerSource, /exercise-animation\/mannequin\.js\?v=20260716-mannequin-prototype1/, "Prototypen caches i PWA app-shell");

console.log("Exercise animation phase 1 tests passed");
