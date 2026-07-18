"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("app/dashboard-view-model.js", "utf8");
const sandbox = { window: {}, Date };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const build = sandbox.window.Work4itDashboard.buildDashboardViewModel;
const program = (id = "p1", title = "Push") => ({ id, title, savedAt: "2026-07-01", activeDayIndex: 0, days: [{ exercises: [{ name: "Bench Press" }, { name: "Push-Up" }] }] });
const workout = (overrides = {}) => ({ id: "w1", sessionId: "w1", programId: "p1", title: "Pull", completedAt: "2026-07-17T10:00:00Z", workoutStatus: "completed", durationSeconds: 2880, totalVolume: 7840, exercises: [{ sets: [{ completed: true }, { completed: true }] }], ...overrides });

assert.equal(build({ now: new Date("2026-07-18T08:00:00"), profile: { name: "Mike Henriksen" } }).greeting, "Godmorgen, Mike");
assert.equal(build({ now: new Date("2026-07-18T14:00:00"), user: { displayName: "Anna Jensen" } }).greeting, "God eftermiddag, Anna");
assert.equal(build({ now: new Date("2026-07-18T20:00:00"), profile: { name: "Bo" } }).greeting, "Godaften, Bo");
assert.equal(build({ user: { displayName: "person@example.com" } }).greeting, "Velkommen tilbage");
assert.equal(build({ user: { email: "person@example.com" } }).greeting, "Velkommen tilbage");

const empty = build({ programs: [], history: [] });
assert.equal(empty.emptyState, true);
assert.equal(empty.primaryAction, null);
assert.equal(empty.latestWorkout, null);
assert.equal(empty.recommendation, null);

const one = build({ programs: [program()] });
assert.equal(one.featuredWorkout.id, "p1");
assert.equal(one.featuredWorkout.heading, "Næste træning");
assert.equal(one.primaryAction.type, "start-workout");
assert.equal(one.featuredWorkout.exerciseCount, 2);

const many = build({ programs: [program("p1"), program("p2", "Ben")], lastActiveProgramId: "p2" });
assert.equal(many.featuredWorkout.id, "p2");
assert.equal(many.featuredWorkout.heading, "Fortsæt med");

const scheduled = program("today", "FullBody");
scheduled.scheduledDate = "2026-07-18";
assert.equal(build({ now: new Date("2026-07-18T12:00:00"), programs: [program(), scheduled] }).featuredWorkout.heading, "Dagens træning");

const active = build({ programs: [program()], activeWorkout: { sessionId: "s1", sessionStatus: "in_progress", title: "Bryst", timerSeconds: 1680, exercises: [{ sets: [{ completed: true }, { completed: false }] }] } });
assert.equal(active.activeWorkout.status, "Aktiv");
assert.equal(active.activeWorkout.completedSets, 1);
assert.equal(active.activeWorkout.totalSets, 2);
assert.equal(active.primaryAction.type, "resume-workout");
assert.equal(active.featuredWorkout, null);

const paused = build({ activeWorkout: { sessionId: "s2", sessionStatus: "paused", title: "Ben", exercises: [] } });
assert.equal(paused.activeWorkout.status, "Pauset");
assert.match(paused.recommendation.message, /pauset træning/);

const completed = workout({ completionAnalysis: { summary: { completedSets: 18, totalVolumeKg: 7840, personalRecords: [{ type: "weight" }] }, recommendations: [{ type: "progression", message: "Øg forsigtigt næste gang." }] } });
const withHistory = build({ programs: [program()], history: [completed] });
assert.equal(withHistory.latestWorkout.completedSets, 18);
assert.equal(withHistory.latestWorkout.totalVolumeKg, 7840);
assert.equal(withHistory.latestWorkout.personalRecords, 1);
assert.equal(withHistory.recommendation.message, "Øg forsigtigt næste gang.");

const newer = workout({ id: "w2", completedAt: "2026-07-18T10:00:00Z", title: "Ben" });
assert.equal(build({ history: [completed, newer] }).latestWorkout.title, "Ben");
assert.equal(build({ history: [workout({ workoutStatus: "in_progress" })] }).latestWorkout, null);
assert.equal(build({ history: [workout({ deletedAt: "2026-07-18" })] }).latestWorkout, null);
assert.equal(build({ history: [workout({ simulated: true })] }).latestWorkout, null);

const bodyweight = workout({ totalVolume: 0, completionAnalysis: { summary: { completedSets: 6, totalVolumeKg: 0, personalRecords: [] }, recommendations: [] } });
assert.equal(build({ history: [bodyweight] }).latestWorkout.totalVolumeKg, 0);
assert.equal(build({ programs: [program()], history: [workout({ programId: "p1" })] }).featuredWorkout.source, "last-used");
assert.equal(build({ programs: [program()], currentProgramId: "p1" }).featuredWorkout.source, "last-selected");
assert.equal(build({ programs: [{ id: "invalid", days: [{ exercises: [] }] }] }).featuredWorkout, null);
assert.doesNotMatch(source, /fetch\(|firebase|localStorage|Membership|AIRequest/, "View-model is pure and membership-neutral");
console.log("Dashboard view-model scenarios passed: 24+");
