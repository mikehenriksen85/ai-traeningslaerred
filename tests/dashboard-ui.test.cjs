"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("app/index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach(source => new Function(source));

for (const id of [
  "homeDashboard",
  "homeWelcomeTitle",
  "homeCurrentProgramName",
  "homeStartHelp",
  "elapsedTimeMetric",
  "programSecondaryActions",
  "homeSavedPrograms",
  "homeSavedEmpty",
  "workoutEditorDetails",
  "timerBtn",
  "savedSelect",
  "aiCoachButton"
]) {
  assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be unique`);
}

for (const handler of [
  "openProfileSetup",
  "openMembershipView",
  "openProfileWizardFromMenu",
  "openTodayWorkout",
  "toggleGeneratorMenu",
  "openBlankWorkoutDialog",
  "toggleSavedDropdown",
  "openScreenshotImportInfo",
  "openDashboard",
  "openCalorieView",
  "openProgressView",
  "openAiCoach",
  "exportDataFromMenu",
  "openHelpAboutDialog",
  "logoutProfileAccount"
]) {
  assert.match(html, new RegExp(`${handler}\\(`), `${handler} must remain wired`);
}

assert.match(html, /function renderHomeDashboard\(/);
assert.match(html, /function startDashboardWorkout\(/);
assert.match(html, /function updateStartTrainingAvailability\(/);
assert.match(html, /function updateLiveTrainingVisibility\(/);
assert.match(html, /const isActive = hasActiveWorkoutSession\(\)/);
assert.match(html, /document\.body\.dataset\.liveTraining = String\(isActive\)/);
assert.match(html, /document\.querySelectorAll\("\.live-training-only"\)/);
assert.match(html, /function hasActiveWorkoutSession\(\) \{\s+return isActiveWorkoutSession\(activeWorkoutSession\)/);
assert.match(html, /class="sticky-metric live-training-only" id="elapsedTimeMetric" hidden/);
assert.match(html, /class="calorie-panel live-training-only" id="caloriePanel" aria-live="polite" hidden/);
assert.match(html, /class="dashboard-btn live-training-only" type="button" onclick="openDashboard\(\)" hidden/);
assert.doesNotMatch(html, /class="dashboard-btn program-only"/);
assert.match(html, /body:not\(\[data-live-training="true"\]\) \.active-pause-component/);
assert.match(html, /function isValidWorkoutExerciseName\(/);
assert.match(html, /aria-describedby="homeStartHelp"/);
assert.match(html, /home-start-button:disabled/);
assert.match(html, /function updateWorkoutProgress\(\) \{\s+updateStartTrainingAvailability\(\)/);
assert.match(html, /if \(!hasActiveWorkoutSession\(\) && validCanvasExerciseCount\(\) === 0\) return updateStartTrainingAvailability\(\)/);
assert.match(html, /function openCreateOrImportWorkout\(/);
assert.match(html, /homeSavedEmpty[^>]*hidden/);
assert.match(html, /data-accordion="more"/);

assert.equal((html.match(/id=["']exerciseActionMenu["']/g) || []).length, 1);
assert.match(html, /class="exercise-more-button"/);
assert.match(html, /aria-haspopup="menu" aria-expanded="false" aria-controls="exerciseActionMenu"/);
assert.match(html, /role="menu" aria-label="Øvelseshandlinger"/);
for (const [action, label] of [
  ["demo", "Se demo"],
  ["replace", "Erstat øvelse"],
  ["simulate", "Simuler"],
  ["delete", "Slet øvelse"]
]) {
  assert.match(html, new RegExp(`data-exercise-action="${action}"[^>]*>${label}<`));
}
assert.match(html, /exercise-action-menu-item danger/);
assert.match(html, /function toggleExerciseActionMenu\(/);
assert.match(html, /function closeExerciseActionMenu\(/);
assert.match(html, /function handleExerciseActionMenuKey\(/);
assert.match(html, /WorkitMenuManager\?\.openPanel/);
assert.match(html, /onpointerdown="event\.stopPropagation\(\)" ondragstart="event\.preventDefault\(\)"/);
assert.match(html, /if \(action === "demo"\) openExerciseDemo\(slot\)/);
assert.match(html, /else if \(action === "replace"\) openReplacementDialog\(slot\)/);
assert.match(html, /else if \(action === "simulate"\) openDashboard\(slot\)/);
assert.match(html, /else if \(action === "delete"\) removeExercise\(slot\)/);

const exerciseTemplate = html.match(/block\.innerHTML = `[\s\S]*?`;/)?.[0] || "";
assert.doesNotMatch(exerciseTemplate, />Demo<|>Simuler<|danger-slot/);
assert.doesNotMatch(exerciseTemplate, /<div>\$\{t\("ok"\)\}<\/div>/);
assert.match(html, /data-set-number="\$\{i\}"/);
assert.match(html, /cb\.setAttribute\("aria-label", actionLabel\)/);
assert.match(html, /\.set-complete-control \{ position: relative; display: grid; place-items: center; width: 52px; height: 52px;/);
assert.match(html, /class="weight set-value-input" type="text" inputmode="decimal"/);
assert.match(html, /class="reps set-value-input" type="text" inputmode="numeric"/);
assert.match(html, /aria-label="Sæt \$\{i\}: vægt i kg"/);
assert.match(html, /aria-label="Sæt \$\{i\}: gentagelser"/);
assert.match(html, /font-size: 20px !important/);
assert.match(html, /min-height: 56px/);
assert.match(html, /grid-template-areas:\s+"set previous previous pause"\s+"set weight reps complete"/);
assert.match(html, /function formatPreviousSetDisplay\(/);
assert.match(html, /Sidst: \$\{weight\} kg × \$\{reps\}/);
assert.match(html, /function updatePauseInlineDisplay\(/);
assert.doesNotMatch(html, /if \(inline\) inline\.textContent/);
assert.match(html, /class="program-secondary-actions" id="programSecondaryActions"/);
assert.match(html, /<summary>Flere programhandlinger<\/summary>/);
assert.equal((html.match(/onclick="shareCurrentProgram\(\)"/g) || []).length, 1);
assert.equal((html.match(/onclick="deleteCurrentProgram\(\)"/g) || []).length, 1);
assert.match(html, /class="exercise-details-toggle" type="button" aria-expanded="false"/);
assert.match(html, /function toggleExerciseDetails\(/);
assert.match(html, /function closeExerciseDetails\(/);
assert.match(html, /\.exercise:not\(\.show-advanced\) \.set-analytics \{ display: none; \}/);
assert.match(html, /closeExerciseDetails\(\);\s+closeExerciseActionMenu\(false\)/);
assert.match(html, /function updateAutosaveStatusTone\(/);
assert.match(html, /new MutationObserver\(updateAutosaveStatusTone\)/);

const activeSessionPredicateBody = html.match(/function isActiveWorkoutSession\(session\) \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(activeSessionPredicateBody, "active session predicate must exist");
const isActiveWorkoutSession = new Function("session", activeSessionPredicateBody);
assert.equal(isActiveWorkoutSession(null), false, "a new workout is not active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "not_started" }), false, "not_started is not active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "in_progress" }), true, "in_progress is active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "paused" }), true, "paused remains active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "completed" }), false, "completed is not active");

const previousSetFormatterBody = html.match(/function formatPreviousSetDisplay\(value\) \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(previousSetFormatterBody, "previous set formatter must exist");
const formatPreviousSetDisplay = new Function("value", previousSetFormatterBody);
assert.equal(formatPreviousSetDisplay("45kg · 10r · 01:30"), "Sidst: 45 kg × 10");
assert.equal(formatPreviousSetDisplay("Sidst: 47,5 kg × 8"), "Sidst: 47,5 kg × 8");
assert.equal(formatPreviousSetDisplay("-"), "Sidst: –");

console.log("Simplified dashboard hierarchy and preserved-handler contracts OK");
