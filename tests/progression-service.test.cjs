const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "progression-service.js"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const cloudSource = fs.readFileSync(path.join(root, "app", "firestore-cloud-service.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const progression = sandbox.window.Work4itProgression;

function set(weight, reps, targetReps = "8-12", options = {}) {
  return { weight, reps, targetReps, completed: options.completed !== false, isWarmup: options.isWarmup === true, setType: options.setType || "work" };
}

function exercise(overrides = {}) {
  return {
    exerciseId: "ex_bench_press_1234567",
    name: "Bench Press",
    muscle: "Bryst",
    exerciseType: "strength",
    loadType: "external",
    equipment: "barbell",
    plannedSets: 3,
    sets: [set(50, 10), set(50, 10), set(50, 10)],
    ...overrides
  };
}

function workout(id, item, date = "2026-07-01T10:00:00Z", overrides = {}) {
  return { id, sessionId: id, date, completedAt: date, sessionStatus: "completed", workoutStatus: "completed", exercises: [item], ...overrides };
}

function suggest(item, history = [], currentPlan = { targetReps: "8-12" }, availableWeightSteps) {
  return progression.calculateProgressionSuggestion({ exercise: item, currentPlan, history, availableWeightSteps });
}

const noHistory = suggest(exercise(), [], { weight: 42.5, targetReps: "8-12" });
assert.equal(noHistory.status, "no-data");
assert.equal(noHistory.suggestedWeight, 42.5);
assert.match(noHistory.reason, /udgangspunkt/);

const top = suggest(exercise(), [workout("top", exercise({ sets: [set(50, 12), set(50, 12), set(50, 12)] }))]);
assert.equal(top.status, "increase");
assert.equal(top.suggestedWeight, 52.5);
assert.equal(top.suggestedReps, "8-10");

const middle = suggest(exercise(), [workout("middle", exercise({ sets: [set(50, 10), set(50, 9), set(50, 8)] }))]);
assert.equal(middle.status, "maintain");
assert.equal(middle.suggestedWeight, 50);
assert.match(middle.reason, /ekstra samlet rep/);

const oneMiss = suggest(exercise(), [workout("one-miss", exercise({ sets: [set(50, 8), set(50, 7), set(50, 6)] }))]);
assert.equal(oneMiss.status, "maintain");
assert.match(oneMiss.reason, /udløser ikke en reduktion/);

const repeatedMiss = suggest(exercise(), [
  workout("miss-1", exercise({ sets: [set(50, 8), set(50, 7), set(50, 7)] }), "2026-07-01T10:00:00Z"),
  workout("miss-2", exercise({ sets: [set(50, 7), set(50, 7), set(50, 6)] }), "2026-07-03T10:00:00Z")
]);
assert.equal(repeatedMiss.status, "reduce");
assert.equal(repeatedMiss.suggestedWeight, 47.5);

const higherStable = suggest(exercise(), [
  workout("old-weight", exercise({ sets: [set(50, 10), set(50, 10), set(50, 9)] }), "2026-07-01T10:00:00Z"),
  workout("new-weight", exercise({ sets: [set(52.5, 9), set(52.5, 8), set(52.5, 8)] }), "2026-07-03T10:00:00Z")
]);
assert.equal(higherStable.status, "maintain");
assert.equal(higherStable.suggestedWeight, 52.5);
assert.match(higherStable.reason, /øget belastningen/);

const partial = suggest(exercise(), [workout("partial", exercise({ sets: [set(50, 10), set(50, 10, "8-12", { completed: false }), set(50, 10, "8-12", { completed: false })] }))]);
assert.equal(partial.status, "maintain");
assert.equal(partial.confidence, "low");

const invalid = suggest(exercise(), [workout("invalid", exercise({ sets: [set("", ""), set(50, "8-12"), set(5000, 10)] }))]);
assert.equal(invalid.status, "no-data");

const withoutWarmup = suggest(exercise({ plannedSets: 1 }), [workout("warmup", exercise({
  plannedSets: 1,
  sets: [set(20, 12, "8-12", { isWarmup: true }), set(50, 12)]
}))]);
assert.equal(withoutWarmup.status, "increase");
assert.equal(withoutWarmup.suggestedWeight, 52.5);

const bodyweightExercise = exercise({ exerciseId: "ex_push_up_1234567", name: "Push-Up", loadType: "bodyweight", equipment: "bodyweight", sets: [set(0, 12), set(0, 12), set(0, 12)] });
const bodyweight = suggest(bodyweightExercise, [workout("bodyweight", bodyweightExercise)]);
assert.equal(bodyweight.status, "increase");
assert.equal(bodyweight.suggestedWeight, null);
assert.ok(!progression.formatSuggestion(bodyweight).includes("kg"));

const weightedBodyweightExercise = exercise({ exerciseId: "ex_weighted_pull_up_1234567", name: "Weighted Pull-Up", loadType: "weighted_bodyweight", equipment: "bodyweight", sets: [set(10, 12), set(10, 12), set(10, 12)] });
const weightedBodyweight = suggest(weightedBodyweightExercise, [workout("weighted-bodyweight", weightedBodyweightExercise)]);
assert.equal(weightedBodyweight.suggestedWeight, 11.25);

const dumbbellExercise = exercise({ exerciseId: "ex_dumbbell_curl_1234567", name: "Dumbbell Curl", muscle: "Biceps", equipment: "dumbbell", sets: [set(12, 12), set(12, 12), set(12, 12)] });
assert.equal(suggest(dumbbellExercise, [workout("dumbbell", dumbbellExercise)]).suggestedWeight, 13);

const machineExercise = exercise({ exerciseId: "ex_leg_press_1234567", name: "Leg Press", muscle: "Forside lår", equipment: "machine", sets: [set(80, 12), set(80, 12), set(80, 12)] });
assert.equal(suggest(machineExercise, [workout("machine", machineExercise)], { targetReps: "8-12" }, [60, 70, 80, 90, 100]).suggestedWeight, 90);

const customExercise = exercise({ exerciseId: "custom_42", name: "Min egen øvelse", equipment: "external", sets: [set(20, 12), set(20, 12), set(20, 12)] });
assert.equal(suggest(customExercise, [workout("custom", customExercise)], { targetReps: "8-12", weightStep: .5 }).suggestedWeight, 20.5);

const renamedExercise = exercise({ name: "Nyt navn" });
const renamed = suggest(renamedExercise, [workout("renamed", exercise({ name: "Gammelt navn", sets: [set(50, 12), set(50, 12), set(50, 12)] }))]);
assert.equal(renamed.status, "increase", "Samme exerciseId bevarer historikken efter omdøbning");
assert.equal(renamed.identityConfidence, "exact");

const pounds = suggest(exercise(), [workout("pounds", exercise({ sets: [set(100, 12), set(100, 12), set(100, 12)] }))], { targetReps: "8-12", unit: "lb", weightStep: 5 });
assert.equal(pounds.suggestedWeight, 105);
assert.equal(pounds.unit, "lb");

const ignoredHistory = suggest(exercise(), [
  workout("simulation", exercise({ sets: [set(200, 12), set(200, 12), set(200, 12)] }), "2026-07-01T10:00:00Z", { simulated: true }),
  workout("deleted", exercise({ sets: [set(200, 12), set(200, 12), set(200, 12)] }), "2026-07-02T10:00:00Z", { deletedAt: "2026-07-03" })
]);
assert.equal(ignoredHistory.status, "no-data");

const wrongIdentity = suggest(exercise(), [workout("wrong-id", exercise({ exerciseId: "ex_other_7654321", sets: [set(200, 12), set(200, 12), set(200, 12)] }))]);
assert.equal(wrongIdentity.status, "no-data");

const outlier = suggest(exercise(), [
  workout("normal-1", exercise({ sets: [set(50, 10), set(50, 10), set(50, 10)] }), "2026-07-01T10:00:00Z"),
  workout("normal-2", exercise({ sets: [set(52.5, 10), set(52.5, 10), set(52.5, 10)] }), "2026-07-03T10:00:00Z"),
  workout("outlier", exercise({ sets: [set(100, 12), set(100, 12), set(100, 12)] }), "2026-07-05T10:00:00Z")
]);
assert.equal(outlier.status, "maintain");
assert.equal(outlier.confidence, "low");
assert.match(outlier.reason, /afviger meget/);

const cableExercise = exercise({ equipment: "cable", sets: [set(30, 12), set(30, 12), set(30, 12)] });
assert.equal(suggest(cableExercise, [workout("cable", cableExercise)]).suggestedWeight, 32.5, "Cable uses one configured stack step");

const kettlebellExercise = exercise({ equipment: "kettlebell", sets: [set(16, 12), set(16, 12), set(16, 12)] });
assert.equal(suggest(kettlebellExercise, [workout("kettlebell", kettlebellExercise)]).suggestedWeight, 20, "Kettlebell uses one configured implement step");

const atLargestMachinePlate = suggest(machineExercise, [workout("machine-max", machineExercise)], { targetReps: "8-12" }, [60, 70, 80]);
assert.equal(atLargestMachinePlate.status, "maintain", "Unknown next machine value never invents a jump");

const noRepRange = suggest(exercise(), [workout("no-range", exercise({ sets: [set(50, 10, "styrke"), set(50, 10, "styrke"), set(50, 10, "styrke")] }))], { targetReps: "" });
assert.equal(noRepRange.status, "maintain");
assert.match(noRepRange.reason, /kan ikke valideres/);

const unfinishedWorkout = suggest(exercise(), [workout("active", exercise({ sets: [set(50, 12), set(50, 12), set(50, 12)] }), undefined, { workoutStatus: "in_progress", sessionStatus: "in_progress" })]);
assert.equal(unfinishedWorkout.status, "no-data", "Active workouts are never progression evidence");

const legacyTarget = exercise({ exerciseId: "" });
const legacySuggestion = suggest(legacyTarget, [workout("legacy", exercise({ exerciseId: "", sets: [set(50, 12), set(50, 12), set(50, 12)] }))]);
assert.equal(legacySuggestion.identityConfidence, "legacy");
assert.equal(legacySuggestion.confidence, "low", "Legacy name matching lowers confidence");

const differentNameWithoutId = suggest(legacyTarget, [workout("same-muscle-other-name", exercise({ exerciseId: "", name: "Incline Bench Press", sets: [set(100, 12), set(100, 12), set(100, 12)] }))]);
assert.equal(differentNameWithoutId.status, "no-data", "Names are not mixed merely because muscle groups match");

const explicitlyDeleted = workout("deleted-flag", exercise({ sets: [set(100, 12), set(100, 12), set(100, 12)] }));
explicitlyDeleted.isDeleted = true;
assert.equal(suggest(exercise(), [explicitlyDeleted]).status, "no-data");

const poundHistory = exercise({ unit: "lb", sets: [set(100, 12), set(100, 12), set(100, 12)] });
assert.equal(suggest(exercise({ unit: "kg" }), [workout("wrong-unit", poundHistory)]).status, "no-data", "Kilograms and pounds are never mixed");

const machineHistoryForBarbell = exercise({ equipment: "machine", sets: [set(100, 12), set(100, 12), set(100, 12)] });
assert.equal(suggest(exercise({ equipment: "barbell" }), [workout("wrong-equipment", machineHistoryForBarbell)]).status, "no-data", "Equipment variants are never mixed");

assert.match(html, /history: history\(\)/, "Offline-local history drives the same calculation");
assert.match(html, /window\.addEventListener\("firestore:data-hydrated",[\s\S]*?refreshAllProgressionSuggestions\(\)/, "Cloud hydration and a second device refresh suggestions");
assert.match(html, /exerciseId: block\.dataset\.exerciseId/, "Stable IDs persist in program and workout data");
assert.match(html, /\.filter\(row => !row\.querySelector\('[^']*checkbox[^']*'\)\?\.checked\)/, "Accepted suggestions only update unfinished sets");
assert.match(html, /function progressionSuggestionIsApplied\(/, "Reload derives accepted state from saved plan values");
assert.doesNotMatch(source + html.match(/function renderProgressionSuggestion[\s\S]*?function renderSets/)?.[0], /Membership|premium|administrator|ai-requests/i, "Suggestions are membership-neutral for free, premium and admin users");
assert.match(cloudSource, /training_analytics_history/, "Workout history remains part of existing Firestore synchronization");

assert.doesNotMatch(source, /fetch\(|httpsCallable|AIRequest|Membership/, "Progression er lokal, regelbaseret og medlemskabsneutral");
console.log("Progression service tests passed");
