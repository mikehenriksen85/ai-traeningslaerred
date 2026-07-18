"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("app/index.html", "utf8");
const profileWizard = fs.readFileSync("app/profile-wizard.js", "utf8");
const trainingGoalEngine = fs.readFileSync("app/training-goal-engine.js", "utf8");
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach(source => new Function(source));

for (const id of [
  "homeDashboard",
  "homeDashboardLoading",
  "homeDashboardContent",
  "homeSyncNotice",
  "homeSyncRetryButton",
  "homeWelcomeTitle",
  "homeActiveSection",
  "homeResumeWorkoutButton",
  "homeWorkoutSection",
  "homeCurrentProgramName",
  "homeStartHelp",
  "homeEmptyState",
  "homeQuickSection",
  "homeLatestSection",
  "homeRecommendation",
  "elapsedTimeMetric",
  "programSecondaryActions",
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
assert.match(html, /function continueDashboardWorkout\(/);
assert.match(html, /function buildCurrentDashboardViewModel\(/);
assert.match(html, /async function retryDashboardSync\(/);
assert.match(html, /function updateStartTrainingAvailability\(/);
assert.match(html, /function updateLiveTrainingVisibility\(/);
assert.match(html, /const isActive = hasActiveWorkoutSession\(\)/);
assert.match(html, /document\.body\.dataset\.liveTraining = String\(isActive\)/);
assert.match(html, /document\.querySelectorAll\("\.live-training-only"\)/);
assert.match(html, /function hasActiveWorkoutSession\(\) \{\s+return isActiveWorkoutSession\(activeWorkoutSession\)/);
assert.match(html, /function presentGeneratedWorkout\(\) \{[\s\S]*toggleSidebar\(false\)[\s\S]*renderHomeDashboard\(\)[\s\S]*openWorkoutEditor\(\)/, "Genererede programmer vises automatisk efter mobilmenuen lukkes");
assert.equal((html.match(/presentGeneratedWorkout\(\);/g) || []).length, 3, "Styrke, calisthenics og cardio bruger samme visningsflow");
assert.match(html, /service-worker\.js\?v=20260718-dashboard1/, "Dashboardet udløser en ny PWA app-shell");
assert.match(html, /dashboard-view-model\.js\?v=20260718-dashboard1/);
assert.match(html, /class="progression-suggestion/);
assert.match(html, /function applyProgressionSuggestion\(/);
assert.match(html, /window\.Work4itProgression\.formatSuggestion/);
assert.match(html, /block\.dataset\.exerciseId/);
assert.match(html, /block\.dataset\.loadType/);
assert.match(html, /function latestCardioDurationMinutes\(exerciseName\)/, "Cardio can reuse the latest registered duration for the same exercise");
assert.match(html, /const requestedDuration = Number\(totalMinutes\) > 0 \? Math\.max\(count \* 5, Number\(totalMinutes\)\) : 0;/, "The plan default duration does not prefill cardio fields");
assert.match(html, /durationMinutes: requestedMinutes \|\| previousMinutes \|\| ""/, "New cardio fields stay empty without an explicit duration or history");
assert.doesNotMatch(html.match(/function generateCardioProgram[\s\S]*?function openBlankWorkoutDialog/)?.[0] || "", /Number\(totalMinutes\) \|\| plan\.totalMinutes/, "The cardio generator must not use the plan default as the field value");
assert.match(html, /durationMinutes: numberValue\(exercise\.cardio\?\.durationMinutes \|\| exercise\.durationMinutes\) \|\| latestCardioDurationMinutes\(exercise\.name\) \|\| ""/, "Onboarding cardio also stays empty without explicit time or history");
assert.doesNotMatch(html, /Number\(action\.durationMinutes\) \|\| 30/, "AI cardio creation must not invent a 30-minute duration");
assert.doesNotMatch(profileWizard, /durationMinutes: prescription\.durationMinutes \|\| 30/, "The profile wizard must not prefill cardio with 30 minutes");
assert.match(profileWizard, /durationMinutes: prescription\.durationMinutes \|\| ""/, "The profile wizard leaves new cardio duration empty");
assert.match(trainingGoalEngine, /exerciseType: "cardio", durationMinutes: ""/, "Cardio prescriptions start without an invented duration");
assert.match(html, /class="sticky-metric live-training-only" id="elapsedTimeMetric" hidden/);
assert.match(html, /class="calorie-panel live-training-only" id="caloriePanel" aria-live="polite" hidden/);
assert.match(html, /class="dashboard-btn live-training-only" type="button" onclick="openDashboard\(\)" hidden/);
assert.doesNotMatch(html, /class="dashboard-btn program-only"/);
assert.doesNotMatch(html, /body:not\(\[data-live-training="true"\]\) \.active-pause-component/);
assert.match(html, /\.active-pause-component\.active \{ display: grid; \}/);
assert.match(html, /function isValidWorkoutExerciseName\(/);
assert.match(html, /aria-describedby="homeStartHelp"/);
assert.match(html, /home-start-button:disabled/);
assert.match(html, /function updateWorkoutProgress\(\) \{\s+updateStartTrainingAvailability\(\)/);
assert.match(html, /if \(!hasActiveWorkoutSession\(\) && validCanvasExerciseCount\(\) === 0\) return updateStartTrainingAvailability\(\)/);
assert.match(html, /function openCreateOrImportWorkout\(/);
assert.match(html, /id="homeActiveSection"[^>]*hidden/);
assert.match(html, /id="homeWorkoutSection"[^>]*hidden/);
assert.match(html, /id="homeEmptyState"[^>]*hidden/);
assert.match(html, /id="homeLatestSection"[^>]*hidden/);
assert.match(html, /id="homeRecommendation"[^>]*hidden/);
assert.match(html, /activeSection\.hidden = !view\.activeWorkout/);
assert.match(html, /workoutSection\.hidden = !view\.featuredWorkout/);
assert.match(html, /function continueDashboardWorkout\(\) \{[\s\S]*?showTrainingSession\(\)/, "Fortsæt træning genbruger den aktive session");
assert.match(html, /loadAutosave\(\);\s+renderSaved\(\)/, "Dashboard rendres efter autosave\/cloud-sessionen er gendannet");
assert.match(html, /firestore:fallback-active[\s\S]*?dashboardCloudPending = false;[\s\S]*?renderSaved\(\)/, "Offline fallback frigiver dashboardet med den brugeropdelte cache");
assert.match(html, /Offline – ændringer synkroniseres senere/);
assert.match(html, /Kunne ikke synkronisere/);
assert.match(html, /id="homeSyncRetryButton" onclick="retryDashboardSync\(\)"/);
assert.doesNotMatch(html.match(/function dashboardDisplayName[\s\S]*?function programExerciseCount/)?.[0] || "", /user\.email/, "E-mail bruges aldrig som dashboardnavn");
const quickSection = html.match(/<section class="home-quick-section"[\s\S]*?<\/section>/)?.[0] || "";
assert.equal((quickSection.match(/<button/g) || []).length, 3, "Dashboardet viser højst tre hurtige handlinger");
assert.match(quickSection, /openBlankWorkoutDialog\(\)/);
assert.match(quickSection, /openScreenshotImportInfo\(\)/);
assert.match(quickSection, /openSavedProgramsFromDashboard\(\)/);
assert.match(html, /id="homeResumeWorkoutButton"[^>]*onclick="continueDashboardWorkout\(\)"/, "Aktiv træning fortsættes med ét tryk");
assert.match(html, /id="timerBtn"[^>]*onclick="startDashboardWorkout\(\)"/, "Valgt program startes med ét tryk");
assert.match(html, /programId && \(currentSavedProgramId !== programId \|\| !slotIds\(\)\.length\)\) loadSavedProgram\(programId, false\)/, "Start indlæser altid det program, dashboardet viser");
assert.match(html, /onclick="openProgramGeneratorFromDashboard\(\)"[^>]*>[^<]*Lad AI oprette et program/, "Ny bruger kan begynde AI-oprettelse med ét tryk");
assert.match(html, /onclick="openScreenshotImportInfo\(\)"[^>]*>[^<]*📷 Importér fra screenshot/, "Ny bruger kan begynde import med ét tryk");
assert.match(html, /onclick="openLatestWorkoutFromDashboard\(\)"[^>]*>Se træning/, "Seneste træning åbnes med ét tryk");
assert.match(html, /data-accordion="more"/);

const sidebarMarkup = html.match(/<nav class="sidebar"[\s\S]*?<\/nav>/)?.[0] || "";
const sidebarSections = [...sidebarMarkup.matchAll(/<section class="sidebar-accordion[^>]*data-accordion="([^"]+)"[\s\S]*?<\/section>/g)];
assert.deepEqual(sidebarSections.map(match => match[1]), ["user", "training", "more"], "Hovedmenuen har kun Bruger, Træning og Mere i korrekt rækkefølge");
assert.doesNotMatch(sidebarMarkup, /data-accordion="statistics"/);
const menuSection = name => sidebarSections.find(match => match[1] === name)?.[0] || "";
for (const id of ["profileAccountNavItem", "membershipNavItem", "trainingProfileNavItem", "aiCoachButton"]) {
  assert.match(menuSection("user"), new RegExp(`id="${id}"`), `${id} skal ligge under Bruger`);
}
for (const id of ["todayWorkoutNavItem", "generatorSectionTitle", "newWorkoutNavItem", "savedWorkoutsNavItem", "screenshotImportNavItem", "historyNavItem", "calorieNavItem", "progressNavItem"]) {
  assert.match(menuSection("training"), new RegExp(`id="${id}"`), `${id} skal ligge under Træning`);
}
for (const id of ["trashNavItem", "exportDataNavItem", "helpNavItem", "privacyNavItem", "feedbackNavItem"]) {
  assert.match(menuSection("more"), new RegExp(`id="${id}"`), `${id} skal ligge under Mere`);
}
assert.equal((sidebarMarkup.match(/class="sidebar-item(?:\s|\")/g) || []).length, 18, "Ingen menupunkter er tilføjet eller fjernet");
assert.ok(sidebarMarkup.indexOf('id="sidebarLogoutBtn"') > sidebarMarkup.lastIndexOf("</section>"), "Log ud forbliver uden for kategorierne nederst");

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
