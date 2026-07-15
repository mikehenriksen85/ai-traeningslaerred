const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "completed-workout-analysis.js"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "app", "service-worker.js"), "utf8");
const sandbox = { window: {}, Date, Intl };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const analyze = sandbox.window.Work4itCompletedWorkoutAnalysis.analyzeCompletedWorkout;
assert.doesNotMatch(source, /fetch\(|httpsCallable|AIRequest|Membership/, "Analysen bruger hverken ekstern AI, requests eller medlemskabsgren");

function exercise(name, sets, plannedSets = sets.length) {
  return { name, exerciseType: "strength", plannedSets, sets };
}

function set(weight, reps, targetReps = "8-12") {
  return { weight, reps, targetReps, completed: true };
}

function workout(sessionId, date, exercises) {
  return {
    id: sessionId,
    sessionId,
    date,
    completedAt: date,
    durationSeconds: 3600,
    exercises
  };
}

const first = analyze(workout("first", "2026-07-01T10:00:00Z", [exercise("Bench Press", [set(60, 8)])]), []);
assert.equal(first.summary.completedExercises, 1);
assert.equal(first.summary.completedSets, 1);
assert.equal(first.summary.totalVolumeKg, 480);
assert.equal(first.summary.personalRecords.length, 0, "Første træning må ikke give en falsk PR");
assert.match(first.insights[0].message, /udgangspunkt/);

const previous = workout("previous", "2026-07-03T10:00:00Z", [exercise("Bench Press", [set(60, 8), set(60, 8)])]);
const heavier = analyze(workout("heavier", "2026-07-05T10:00:00Z", [exercise("Bench Press", [set(62.5, 8), set(62.5, 8)])]), [previous]);
assert.ok(heavier.summary.personalRecords.some(record => record.type === "weight"), "Højere dokumenteret vægt giver PR");
assert.ok(heavier.insights.some(insight => insight.type === "progress"), "Højere vægt med samme reps registreres som fremgang");

const moreReps = analyze(workout("reps", "2026-07-06T10:00:00Z", [exercise("Bench Press", [set(60, 10), set(60, 10)])]), [previous]);
assert.ok(moreReps.insights.some(insight => insight.type === "progress"), "Samme vægt med flere reps registreres som fremgang");

const lower = analyze(workout("lower", "2026-07-07T10:00:00Z", [exercise("Bench Press", [set(50, 6)])]), [previous]);
assert.ok(lower.insights.some(insight => insight.type === "recovery" && /lidt lavere/.test(insight.message)), "Lavere resultat formuleres neutralt");
assert.equal(lower.summary.personalRecords.length, 0);

const invalid = analyze(workout("invalid", "2026-07-08T10:00:00Z", [exercise("Row", [set(70, ""), set(70, 0), set(70, "8-12")])]), []);
assert.equal(invalid.summary.completedExercises, 0, "Tomme og ugyldige reps tælles ikke");
assert.equal(invalid.summary.completedSets, 0);

const bodyweight = analyze(workout("bodyweight", "2026-07-09T10:00:00Z", [exercise("Push-Up", [set(0, 12), set(0, 12)])]), []);
assert.equal(bodyweight.summary.completedSets, 2, "Kropsvægtssæt med reps bevares uden opdigtet kg");
assert.ok(bodyweight.recommendations.some(item => /sværere variant/.test(item.message)));
assert.ok(bodyweight.recommendations.every(item => !/kg/.test(item.message)));

const duplicateHistory = analyze(workout("same-session", "2026-07-10T10:00:00Z", [exercise("Squat", [set(100, 5)])]), [
  workout("same-session", "2026-07-10T10:00:00Z", [exercise("Squat", [set(50, 5)])])
]);
assert.equal(duplicateHistory.summary.personalRecords.length, 0, "Samme session sammenlignes ikke med sig selv");

assert.match(html, /collectAnalyticsEntry\(\{ completedOnly: true \}\)/);
assert.match(html, /finishWorkoutInProgress/);
assert.match(html, /entry\.sessionId \? entries\.findIndex/);
assert.match(html, /showCompletedWorkoutSummary\(savedEntry, analysis\)/);
assert.match(html, /analysis \|\|= fallbackCompletedWorkoutAnalysis\(entry\)/);
assert.match(html, /if \(!writeLocalJson\("training_analytics_history", entries\)\) throw new Error/);
assert.match(html, /id="completionDoneButton"/);
assert.match(html, /aria-controls="completionDetails"/);
assert.match(html, /\.completion-details\[hidden\] \{ display: none; \}/);
assert.match(html, /completedWithData\[completedWithData\.length - 1\]/);
assert.match(worker, /completed-workout-analysis\.js\?v=20260716-completion-analysis1/);

console.log("Completed workout analysis tests passed");
