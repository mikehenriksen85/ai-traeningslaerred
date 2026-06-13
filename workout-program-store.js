(function workoutProgramStoreModule() {
  "use strict";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeDay(day, index, fallbackTitle) {
    const source = day?.state || day || {};
    return {
      id: day?.id || `day_${index + 1}`,
      title: source.title || day?.title || fallbackTitle || `Dag ${index + 1}`,
      goal: source.goal || day?.goal || "",
      structure: source.structure || day?.structure || "",
      timerSeconds: 0,
      workoutIntensity: ["low", "medium", "high"].includes(source.workoutIntensity)
        ? source.workoutIntensity
        : "medium",
      desiredExerciseCount: Number.isInteger(source.desiredExerciseCount)
        ? Math.max(1, Math.min(8, source.desiredExerciseCount))
        : null,
      exercises: Array.isArray(source.exercises)
        ? clone(source.exercises).map(exercise => ({
          ...exercise,
            cardio: exercise.cardio ? { ...exercise.cardio, completed: false } : null,
            sets: Array.isArray(exercise.sets)
              ? exercise.sets.map(set => ({ ...set, completed: false }))
              : []
          }))
        : []
    };
  }

  function normalizeProgram(program) {
    if (!program) return null;
    if (program.version === 2 && Array.isArray(program.days) && program.days.length) {
      return {
        ...clone(program),
        version: 2,
        status: ["active", "archived", "deleted"].includes(program.status) ? program.status : "active",
        activeDayIndex: Math.max(0, Math.min(Number(program.activeDayIndex) || 0, program.days.length - 1)),
        days: program.days.map((day, index) => normalizeDay(day, index))
      };
    }

    const legacyState = program.state || program;
    return {
      id: program.id || legacyState.savedProgramId || "",
      version: 2,
      legacy: true,
      title: program.title || legacyState.title || "Træningspas",
      goal: legacyState.goal || "",
      status: "active",
      savedAt: program.savedAt || legacyState.savedAt || new Date().toISOString(),
      activeDayIndex: 0,
      days: [normalizeDay(legacyState, 0, legacyState.title || program.title || "Dag 1")]
    };
  }

  function createProgram(options = {}) {
    const days = (options.days || []).map((day, index) => normalizeDay(day, index));
    return {
      id: options.id || `program_${Date.now()}`,
      version: 2,
      title: options.title || "Mit træningsprogram",
      goal: options.goal || "",
      status: ["active", "archived", "deleted"].includes(options.status) ? options.status : "active",
      savedAt: options.savedAt || new Date().toISOString(),
      activeDayIndex: Math.max(0, Math.min(Number(options.activeDayIndex) || 0, Math.max(0, days.length - 1))),
      days
    };
  }

  function dayLabel(day, index) {
    const title = String(day?.title || "").trim();
    return /^dag\s+\d+/i.test(title) ? title : `Dag ${index + 1}`;
  }

  window.WorkoutProgramStore = {
    clone,
    normalizeDay,
    normalizeProgram,
    createProgram,
    dayLabel
  };
})();
