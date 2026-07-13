"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const context = {
  console,
  Date,
  Math,
  window: {
    Work4itAISystem: {
      guardInput: () => ({ allowed: true }),
      HEALTH_SAFETY_NOTICE: "Sikkerhedsbesked"
    }
  },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value))
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("app/ai-copilot-actions.js", "utf8"), context);

const actions = context.window.AICopilotActions;
const activeContext = {
  activeProgram: {
    exercises: [
      { name: "Barbell Bench Press" },
      { name: "Barbell Row" }
    ]
  }
};

const cases = [
  ["Opret et Push-program på 45 minutter", { action: "suggestProgram", programType: "push", durationMinutes: 45 }],
  ["Lav et Pull træningsprogram", { action: "suggestProgram", programType: "pull" }],
  ["Opret et FullBody-program", { action: "suggestProgram", programType: "fullbody" }],
  ["Lav et Stabilitet-program", { action: "suggestProgram", programType: "stability" }],
  ["Opret et Cardio-program på 30 minutter", { action: "suggestProgram", programType: "cardio", durationMinutes: 30 }],
  ["Opret et Calisthenics-program", { action: "suggestProgram", programType: "calisthenics" }],
  ["Flyt Barbell Row før Barbell Bench Press", { action: "reorderExercise", position: "before" }],
  ["Sæt sæt 2 i Barbell Bench Press til 80 kg, 8 reps og 90 sek", { action: "updateExerciseSet", setNumber: 2, weightKg: 80, reps: 8, pause: "90 sek" }],
  ["Sæt pausen for Barbell Row til 2 min", { action: "updateExercisePause", value: "2 min" }],
  ["Optimér mit træningsprogram", { action: "optimizeWorkout", mode: "all" }],
  ["Optimer træningspasset efter min profil", { action: "optimizeWorkout", mode: "all" }],
  ["Tilpas dagens træning efter min motivation", { action: "optimizeWorkout", mode: "motivation" }],
  ["Find et alternativ til Barbell Row", { action: "findExerciseAlternative", exerciseName: "barbell row" }],
  ["Jeg har kun 20 minutter", { action: "adaptWorkout", constraint: "time_limit", durationMinutes: 20 }],
  ["Add Push Up", { action: "addExercise", exerciseName: "Push Up" }],
  ["Remove Barbell Row", { action: "removeExercise", exerciseName: "barbell row" }],
  ["Replace Barbell Row with Pull Up", { action: "replaceExercise", replacementName: "Pull Up" }],
  ["Set Barbell Bench Press to 4 sets of 10 reps at 82.5 kg", { action: "updateExercise", sets: 4, reps: 10, weightKg: 82.5 }],
  ["Update set 1 of Barbell Row with 65 kg, 12 reps and 2 min", { action: "updateExerciseSet", setNumber: 1, weightKg: 65, reps: 12, pause: "2 min" }],
  ["Set the rest time to 75 seconds", { action: "updatePause", value: "75 seconds" }],
  ["Move Barbell Row after Barbell Bench Press", { action: "reorderExercise", position: "after" }]
];

for (const [input, expected] of cases) {
  const parsed = actions.parse(input, activeContext);
  assert.ok(parsed, `Forventede action for: ${input}`);
  for (const [key, value] of Object.entries(expected)) assert.equal(parsed[key], value, `${input}: ${key}`);
}

assert.equal(actions.validateAction(actions.parse("Fjern Barbell Row", activeContext), activeContext).valid, true);
assert.equal(actions.validateAction({ action: "updateExerciseSet", exerciseName: "Barbell Row", setNumber: 0, reps: 8 }, activeContext).valid, false);
assert.equal(actions.validateAction({ action: "reorderExercise", exerciseName: "Barbell Row", targetExerciseName: "Barbell Row", position: "before" }, activeContext).valid, false);
assert.equal(actions.validateAction({ action: "suggestProgram", durationMinutes: 4 }, activeContext).valid, false);
assert.equal(actions.validateAction({ action: "updateExerciseSet", exerciseName: "Barbell Row", setNumber: 2 }, activeContext).valid, false);
assert.equal(actions.requiresRequest({ action: "blockedSecurity" }), false);
assert.equal(actions.requiresRequest({ action: "switchDay" }), false);
assert.equal(actions.requiresRequest({ action: "suggestProgram" }), true);

console.log(`AI Coach parser/validation OK: ${cases.length} kommandoer`);
