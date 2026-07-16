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

function set(weight, reps, targetReps = "8-12", completed = true) {
  return { weight, reps, targetReps, completed };
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

const partial = analyze(workout("partial", "2026-07-09T11:00:00Z", [exercise("Row", [set(70, 10), set(70, 10, "8-12", false)], 2)]), []);
assert.equal(partial.summary.completedSets, 1, "Only explicitly completed work sets are analyzed");
assert.equal(partial.summary.totalVolumeKg, 700, "An unfinished set must not affect volume");

const unchanged = analyze(workout("unchanged", "2026-07-09T12:00:00Z", [exercise("Bench Press", [set(60, 8), set(60, 8)])]), [previous]);
assert.equal(unchanged.summary.personalRecords.length, 0, "An unchanged result is not a PR");
assert.ok(unchanged.insights.some(insight => insight.type === "stable"), "An unchanged result is described as stable");

const belowRange = analyze(workout("below-range", "2026-07-09T13:00:00Z", [exercise("Squat", [set(80, 6, "8-12"), set(80, 7, "8-12")])]), []);
assert.ok(belowRange.recommendations.some(item => /Behold niveauet/.test(item.message)), "Missed target reps produce a cautious recommendation");

const cardio = analyze(workout("cardio", "2026-07-09T14:00:00Z", [{
  name: "Cykling",
  exerciseType: "cardio",
  cardio: { completed: true, durationMinutes: 20 },
  sets: []
}]), []);
assert.equal(cardio.summary.completedExercises, 1, "Completed cardio is counted without inventing work sets");
assert.equal(cardio.summary.completedSets, 0);
assert.equal(cardio.summary.totalVolumeKg, 0);

const unfinishedHistory = workout("unfinished-history", "2026-07-02T10:00:00Z", [exercise("Deadlift", [set(200, 5)])]);
unfinishedHistory.workoutStatus = "in_progress";
const againstUnfinished = analyze(workout("finished-deadlift", "2026-07-09T15:00:00Z", [exercise("Deadlift", [set(100, 5)])]), [unfinishedHistory]);
assert.equal(againstUnfinished.summary.personalRecords.length, 0, "An unfinished historical workout is never a PR baseline");
assert.ok(againstUnfinished.insights.some(insight => insight.type === "baseline"));

const consistencyHistory = [
  workout("week-1", "2026-07-05T10:00:00Z", [exercise("Row", [set(50, 8)])]),
  workout("week-2", "2026-07-07T10:00:00Z", [exercise("Squat", [set(80, 8)])])
];
const consistentWeek = analyze(workout("week-current", "2026-07-10T10:00:00Z", [exercise("Push-Up", [set(0, 10)])]), consistencyHistory);
assert.ok(consistentWeek.insights.some(insight => insight.type === "consistency" && /3/.test(insight.message)), "Reliable dates can produce a seven-day consistency insight");

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
assert.match(html, /window\.requestAnimationFrame\(\(\) => \$\("completionDoneButton"\)\?\.focus\(\)\)/, "Primary completion action receives focus");
assert.match(html, /FirestoreDataService\?\.syncAllLocalData\?\.\(\)\.catch/, "Offline completion keeps the existing non-blocking cloud sync flow");
assert.match(html, /if \(finishWorkoutInProgress \|\| !\["in_progress", "paused"\]\.includes\(sessionStatus\)\) return/, "Double completion is blocked for active and paused sessions");
assert.match(worker, /completed-workout-analysis\.js\?v=20260716-completion-analysis2/);

console.log("Completed workout analysis tests passed");
