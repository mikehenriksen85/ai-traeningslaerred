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
assert.match(html, /function openCreateOrImportWorkout\(/);
assert.match(html, /homeSavedEmpty[^>]*hidden/);
assert.match(html, /data-accordion="more"/);

console.log("Simplified dashboard hierarchy and preserved-handler contracts OK");
