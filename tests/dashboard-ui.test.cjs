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

console.log("Simplified dashboard hierarchy and preserved-handler contracts OK");
