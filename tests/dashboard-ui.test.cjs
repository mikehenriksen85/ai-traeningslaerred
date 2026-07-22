"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("app/index.html", "utf8");
const profileWizard = fs.readFileSync("app/profile-wizard.js", "utf8");
const trainingGoalEngine = fs.readFileSync("app/training-goal-engine.js", "utf8");
const modernDashboard = fs.readFileSync("app/modern-dashboard-ui.js", "utf8");
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach(source => new Function(source));

for (const id of [
  "modernDashboardUI",
  "modernDashboardTitle",
  "modernIconRail",
  "modernFeaturePanel",
  "modernCardGrid",
  "modernToolPanel",
  "programGeneratorAccess",
  "savedDropdown",
  "savedSelect",
  "trashDropdown",
  "trashItems",
  "modernBottomNav",
  "membershipNavStatus",
  "elapsedTimeMetric",
  "programSecondaryActions",
  "workoutEditorDetails",
  "aiCoachPanel"
]) {
  assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be unique`);
}

for (const handler of [
  "openProfileSetup", "openMembershipView", "openProfileWizardFromMenu",
  "openBlankWorkoutDialog", "openScreenshotImportInfo", "openDashboard", "openCalorieView",
  "openProgressView", "openAiCoach", "exportDataFromMenu", "openHelpAboutDialog",
  "logoutProfileAccount", "startDashboardWorkout", "continueDashboardWorkout"
]) {
  assert.match(`${html}\n${modernDashboard}`, new RegExp(handler), `${handler} must remain wired`);
}

assert.match(html, /function modernDashboardSnapshot\(/);
assert.match(html, /window\.Work4itDashboardRuntime = Object\.freeze/);
assert.match(html, /function renderDashboard\(/);
assert.match(html, /work4it:dashboard-updated/);
assert.match(html, /function startDashboardWorkout\([\s\S]*?modernDashboardSnapshot\(\)\.view\?\.featuredWorkout/);
assert.match(html, /function continueDashboardWorkout\([\s\S]*?showTrainingSession\(\)/);
assert.match(html, /function presentGeneratedWorkout\(\) \{[\s\S]*?closeToolPanel[\s\S]*?renderDashboard\(\)[\s\S]*?openWorkoutEditor\(\)/);
assert.equal((html.match(/presentGeneratedWorkout\(\);/g) || []).length, 3);
assert.match(html, /function updateStartTrainingAvailability\([\s\S]*?validProgramExerciseCount/);
assert.match(html, /function updateLiveTrainingVisibility\(/);
assert.match(html, /const isActive = hasActiveWorkoutSession\(\)/);
assert.match(html, /document\.body\.dataset\.liveTraining = String\(isActive\)/);
assert.match(html, /function hasActiveWorkoutSession\(\) \{\s+return isActiveWorkoutSession\(activeWorkoutSession\)/);
assert.match(html, /service-worker\.js\?v=20260722-card-labels1/);
assert.match(html, /dashboard-view-model\.js\?v=20260718-dashboard-buttons1/);
assert.match(html, /workout-heatmap\.js\?v=20260718-heatmap1/);
assert.match(html, /function renderWorkoutHeatmapSection\(/);
assert.match(html, /function initializeWorkoutHeatmap\(/);
assert.match(html, /workout-history:changed/);
assert.match(html, /class="progression-suggestion/);
assert.match(html, /function applyProgressionSuggestion\(/);

assert.match(html, /function latestCardioDurationMinutes\(exerciseName\)/);
assert.match(html, /durationMinutes: requestedMinutes \|\| previousMinutes \|\| ""/);
assert.doesNotMatch(html, /Number\(action\.durationMinutes\) \|\| 30/);
assert.doesNotMatch(profileWizard, /durationMinutes: prescription\.durationMinutes \|\| 30/);
assert.match(profileWizard, /durationMinutes: prescription\.durationMinutes \|\| ""/);
assert.match(trainingGoalEngine, /exerciseType: "cardio", durationMinutes: ""/);

assert.match(html, /class="sticky-metric live-training-only" id="elapsedTimeMetric" hidden/);
assert.match(html, /class="calorie-panel live-training-only" id="caloriePanel" aria-live="polite" hidden/);
assert.match(html, /class="dashboard-btn live-training-only[^"]*"[^>]*data-work4it-leading-icon="progress"[^>]*onclick="openDashboard\(\)"[^>]*hidden/);
assert.match(html, /function isValidWorkoutExerciseName\(/);
assert.match(html, /function updateWorkoutProgress\(\) \{\s+updateStartTrainingAvailability\(\);\s+updateWorkoutEditorActionState\(\)/);
assert.match(html, /id="workoutEditorEmptyActions"/);
assert.match(html, /id="workoutPrimaryActions" hidden/);
assert.match(html, /onclick="openFirstExercisePicker\(event\)"/);
assert.match(html, /id="saveWorkoutButton"[^>]*onclick="saveCanvasState\(\)"/);
assert.match(html, /function saveCanvasState\(\) \{\s+if \(!updateWorkoutEditorActionState\(\)\) return false;/);
assert.match(html, /function openCreateOrImportWorkout\(/);
assert.match(html, /firestore:fallback-active[\s\S]*?dashboardCloudPending = false;[\s\S]*?renderSaved\(\)/);
assert.match(html, /Offline – ændringer synkroniseres senere/);
assert.match(html, /id="homeSyncRetryButton" onclick="retryDashboardSync\(\)"/);

assert.doesNotMatch(html, /id="sidebar"|class="sidebar"|sidebar-accordion|sidebar-item|home-dashboard|id="homeDashboard"|id="timerBtn"/);
assert.doesNotMatch(html, /work4it_ui_layout|data-ui-layout|changeAppLayout|Classic UI/);
assert.equal((html.match(/data-modern-category=/g) || []).length, 3);
for (const category of ["user", "training", "more"]) assert.match(html, new RegExp(`data-modern-category="${category}"`));
assert.match(html, /id="programGeneratorAccess"/);
assert.match(html, /id="savedDropdown"/);
assert.match(html, /id="trashDropdown"/);

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
assert.match(html, /grid-template-areas:\s+"previous previous previous pause"\s+"set weight reps complete"/);
assert.match(html, /\.set-number \{ display: grid; grid-template-rows: auto 52px;/);
assert.match(html, /\.set-number \{ grid-template-rows: auto 56px; \}/);
assert.match(html, /function maybeStartAutoPause\([\s\S]*?setActivePauseComponent\(slot, set\)/);
assert.match(html, /\.pause-control input \{[\s\S]*?background: var\(--input\);[\s\S]*?color: var\(--text-primary\);/);
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
assert.equal(isActiveWorkoutSession({ sessionStatus: "in_progress", exercises: [{ name: "Push-Up" }] }), true, "a valid in_progress workout is active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "paused", exercises: [{ name: "Back Squat" }] }), true, "a valid paused workout remains active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "in_progress", exercises: [] }), false, "an empty stale session is not active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "paused", exercises: [{ name: "Vælg øvelse" }] }), false, "a placeholder-only session is not active");
assert.equal(isActiveWorkoutSession({ sessionStatus: "completed" }), false, "completed is not active");

const editorActionStateBody = html.match(/function updateWorkoutEditorActionState\(\) \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(editorActionStateBody, "empty workout action-state function must exist");
const editorElements = Object.fromEntries(["workoutEditorEmptyActions", "workoutPrimaryActions", "workoutStatusSummary", "saveWorkoutButton"]
  .map(id => [id, { hidden: false, disabled: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }]));
const runEditorActionState = validCount => new Function("$", "validCanvasExerciseCount", editorActionStateBody)(
  id => editorElements[id],
  () => validCount
);
assert.equal(runEditorActionState(0), false);
assert.equal(editorElements.workoutEditorEmptyActions.hidden, false, "empty state is shown without exercises");
assert.equal(editorElements.workoutPrimaryActions.hidden, true, "save action area is hidden without exercises");
assert.equal(editorElements.workoutStatusSummary.hidden, true, "meaningless zero metrics are hidden without exercises");
assert.equal(editorElements.saveWorkoutButton.disabled, true, "save cannot be activated without exercises");
assert.equal(runEditorActionState(1), true);
assert.equal(editorElements.workoutEditorEmptyActions.hidden, true, "empty state disappears when an exercise exists");
assert.equal(editorElements.workoutPrimaryActions.hidden, false, "save action returns when content exists");
assert.equal(editorElements.workoutStatusSummary.hidden, false, "workout metrics return when content exists");
assert.equal(editorElements.saveWorkoutButton.disabled, false, "save is enabled for a valid workout");

const previousSetFormatterBody = html.match(/function formatPreviousSetDisplay\(value\) \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(previousSetFormatterBody, "previous set formatter must exist");
const formatPreviousSetDisplay = new Function("value", previousSetFormatterBody);
assert.equal(formatPreviousSetDisplay("45kg · 10r · 01:30"), "Sidst: 45 kg × 10");
assert.equal(formatPreviousSetDisplay("Sidst: 47,5 kg × 8"), "Sidst: 47,5 kg × 8");
assert.equal(formatPreviousSetDisplay("-"), "Sidst: –");

console.log("Simplified dashboard hierarchy and preserved-handler contracts OK");
