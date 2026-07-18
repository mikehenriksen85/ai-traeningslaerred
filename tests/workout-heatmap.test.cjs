"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("app/workout-heatmap.js", "utf8");
const sandbox = { window: {}, Date, Intl };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { buildWorkoutHeatmap, localDateKey } = sandbox.window.Work4itWorkoutHeatmap;
const endDate = "2026-07-18T12:00:00+02:00";
const workout = (overrides = {}) => ({
  id: "w1",
  sessionId: "s1",
  userId: "u1",
  title: "FullBody",
  workoutStatus: "completed",
  completedAt: "2026-07-18T10:00:00+02:00",
  durationSeconds: 3120,
  totalVolume: 7840,
  exercises: [{ sets: Array.from({ length: 18 }, () => ({ completed: true, weight: 40, reps: 10 })) }],
  ...overrides
});
const build = (history, options = {}) => buildWorkoutHeatmap(history, { endDate, timeZone: "Europe/Copenhagen", userId: "u1", ...options });

const empty = build([]);
assert.equal(empty.days.length, 365);
assert.equal(empty.activeDays, 0);
assert.equal(empty.totalWorkouts, 0);
assert.equal(empty.currentWeekStreak, 0);

const one = build([workout()]);
assert.equal(one.totalWorkouts, 1);
assert.equal(one.activeDays, 1);
assert.equal(one.days.find(day => day.date === "2026-07-18").completedSets, 18);
assert.equal(one.days.find(day => day.date === "2026-07-18").activityLevel, 2);
assert.equal(one.workoutsLast30Days, 1);

const sameDay = build([
  workout(),
  workout({ id: "w2", sessionId: "s2", completedAt: "2026-07-18T18:00:00+02:00", durationSeconds: 1800, totalVolume: 0, exercises: [{ sets: [{ completed: true }] }] })
]);
const sameDayResult = sameDay.days.find(day => day.date === "2026-07-18");
assert.equal(sameDayResult.workoutCount, 2);
assert.equal(sameDayResult.durationSeconds, 4920);
assert.equal(sameDay.totalWorkouts, 2);

const consecutiveDays = build([
  workout({ sessionId: "d1", completedAt: "2026-07-16T10:00:00+02:00" }),
  workout({ sessionId: "d2", completedAt: "2026-07-17T10:00:00+02:00" }),
  workout({ sessionId: "d3", completedAt: "2026-07-18T10:00:00+02:00" })
]);
assert.equal(consecutiveDays.currentStreak, 3);
assert.equal(consecutiveDays.longestStreak, 3);

const activeWeeks = build([
  workout({ sessionId: "a1", completedAt: "2026-06-30T10:00:00+02:00" }),
  workout({ sessionId: "a2", completedAt: "2026-07-07T10:00:00+02:00" }),
  workout({ sessionId: "a3", completedAt: "2026-07-14T10:00:00+02:00" })
]);
assert.equal(activeWeeks.currentWeekStreak, 3);
assert.equal(activeWeeks.longestWeekStreak, 3);
const weekGap = build([
  workout({ sessionId: "g1", completedAt: "2026-06-23T10:00:00+02:00" }),
  workout({ sessionId: "g2", completedAt: "2026-07-07T10:00:00+02:00" }),
  workout({ sessionId: "g3", completedAt: "2026-07-14T10:00:00+02:00" })
]);
assert.equal(weekGap.currentWeekStreak, 2);
assert.equal(weekGap.longestWeekStreak, 2);

const midnight = build([
  workout({ sessionId: "m1", completedAt: "2026-07-18T21:30:00Z" }),
  workout({ sessionId: "m2", completedAt: "2026-07-18T22:30:00Z" })
], { endDate: "2026-07-19T12:00:00+02:00" });
assert.equal(midnight.days.find(day => day.date === "2026-07-18").workoutCount, 1);
assert.equal(midnight.days.find(day => day.date === "2026-07-19").workoutCount, 1);
assert.equal(localDateKey("2026-03-29T00:30:00Z", "Europe/Copenhagen"), "2026-03-29");
assert.equal(localDateKey("2026-03-29T01:30:00Z", "Europe/Copenhagen"), "2026-03-29");

const duplicate = build([workout(), workout({ id: "cloud-copy" })]);
assert.equal(duplicate.totalWorkouts, 1, "same sessionId is only counted once after offline sync");
const legacyDuplicate = build([
  workout({ id: undefined, sessionId: "", userId: "", title: "Legacy" }),
  workout({ id: undefined, sessionId: "", userId: "", title: "Legacy" })
]);
assert.equal(legacyDuplicate.totalWorkouts, 1, "exact legacy fingerprints are deduplicated without rewriting history");

const excluded = build([
  workout({ sessionId: "ok" }),
  workout({ sessionId: "deleted", deletedAt: "2026-07-18" }),
  workout({ sessionId: "trash", inTrash: true }),
  workout({ sessionId: "simulation", simulated: true }),
  workout({ sessionId: "test", isTest: true }),
  workout({ sessionId: "partial", workoutStatus: "in_progress" }),
  workout({ sessionId: "other-user", userId: "u2" }),
  workout({ sessionId: "invalid-date", completedAt: "not-a-date" })
]);
assert.equal(excluded.totalWorkouts, 1);

const startedFallback = build([workout({ completedAt: null, date: null, startedAt: "2026-07-17T23:30:00+02:00" })]);
assert.equal(startedFallback.days.find(day => day.date === "2026-07-17").workoutCount, 1);

const bodyweight = workout({ sessionId: "body", totalVolume: 0, durationSeconds: 3600, exercises: [{ sets: Array.from({ length: 20 }, () => ({ completed: true, reps: 12 })) }] });
const strength = workout({ sessionId: "heavy", completedAt: "2026-07-17T10:00:00+02:00", totalVolume: 12000, durationSeconds: 1200, exercises: [{ sets: [{ completed: true, weight: 200, reps: 3 }] }] });
const relative = build([bodyweight, strength]);
assert.ok(relative.days.find(day => day.date === "2026-07-18").activityLevel >= relative.days.find(day => day.date === "2026-07-17").activityLevel, "bodyweight can rank highly without kg volume");

const noDuration = build([workout({ durationSeconds: 0 })]);
assert.equal(noDuration.totalWorkouts, 1);
const noVolume = build([workout({ totalVolume: 0 })]);
assert.equal(noVolume.totalWorkouts, 1);

const largeHistory = Array.from({ length: 5000 }, (_, index) => workout({
  id: `large-${index}`,
  sessionId: `large-${index}`,
  completedAt: new Date(Date.UTC(2012, 11, 1 + index, 10)).toISOString()
}));
const started = Date.now();
const largeResult = build(largeHistory);
assert.equal(largeResult.days.length, 365);
assert.ok(Date.now() - started < 2500, "large history calculation stays bounded");

assert.doesNotMatch(source, /innerHTML|document\.|localStorage|firebase|fetch\(/, "central calculation remains UI and persistence independent");
console.log("Workout heatmap data scenarios passed: 18+");
