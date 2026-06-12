(function trainingWizardStoreModule() {
  "use strict";

  const PROFILE_KEY = "training_profile_v1";
  const DAILY_KEY = "daily_start_v1";
  const LAST_PROGRAM_KEY = "last_active_program_id";

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return value;
    } catch {
      return value;
    }
  }

  function getProfile() {
    return {
      hasCompletedProfileWizard: false,
      name: "",
      goal: "",
      heightCm: "",
      weightKg: "",
      bodyFat: "",
      muscleMass: "",
      personalGoal: "",
      age: "",
      gender: "",
      experience: "",
      trainingDaysPerWeek: 3,
      focusAreas: [],
      exercisePreference: "",
      preferredExerciseCount: 5,
      updatedAt: "",
      ...read(PROFILE_KEY, {})
    };
  }

  function saveProfile(profile) {
    const next = {
      ...getProfile(),
      ...profile,
      focusAreas: Array.isArray(profile.focusAreas) ? [...profile.focusAreas] : getProfile().focusAreas,
      updatedAt: new Date().toISOString()
    };
    write(PROFILE_KEY, next);
    window.dispatchEvent(new CustomEvent("training-profile:updated", { detail: { ...next } }));
    return next;
  }

  function localDateString(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(value.getTime())) return "";
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0")
    ].join("-");
  }

  function getDailyState() {
    const stored = read(DAILY_KEY, {});
    const dailyMotivation = stored.dailyMotivation || stored.motivation || "";
    return {
      motivation: "",
      dailyMotivation: "",
      dailyMotivationDate: "",
      selectedAction: "",
      completedAt: "",
      ...stored,
      motivation: dailyMotivation,
      dailyMotivation
    };
  }

  function saveDailyState(state) {
    const current = getDailyState();
    const explicitMotivation = state.dailyMotivation || state.motivation || "";
    const motivation = explicitMotivation || current.dailyMotivation;
    const next = {
      ...current,
      ...state,
      motivation,
      dailyMotivation: motivation,
      dailyMotivationDate: state.dailyMotivationDate ||
        (explicitMotivation ? localDateString() : current.dailyMotivationDate),
      completedAt: new Date().toISOString()
    };
    const saved = write(DAILY_KEY, next);
    window.dispatchEvent(new CustomEvent("daily-motivation:changed", { detail: { ...saved } }));
    return saved;
  }

  function saveDailyMotivation(motivation, date = new Date()) {
    return saveDailyState({
      motivation,
      dailyMotivation: motivation,
      dailyMotivationDate: localDateString(date)
    });
  }

  function hasDailyMotivationForDate(date = new Date()) {
    const daily = getDailyState();
    return Boolean(
      daily.dailyMotivation &&
      daily.dailyMotivationDate === localDateString(date)
    );
  }

  function setLastActiveProgramId(programId) {
    try {
      if (programId) localStorage.setItem(LAST_PROGRAM_KEY, String(programId));
      else localStorage.removeItem(LAST_PROGRAM_KEY);
    } catch {}
  }

  function getLastActiveProgramId() {
    try {
      return localStorage.getItem(LAST_PROGRAM_KEY) || "";
    } catch {
      return "";
    }
  }

  function getContext() {
    const profile = getProfile();
    const daily = getDailyState();
    return {
      goal: profile.goal,
      experience: profile.experience,
      focusAreas: [...profile.focusAreas],
      exercisePreference: profile.exercisePreference,
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
      motivation: daily.dailyMotivation,
      dailyMotivation: daily.dailyMotivation,
      dailyMotivationDate: daily.dailyMotivationDate,
      lastActiveProgramId: getLastActiveProgramId()
    };
  }

  window.TrainingWizardStore = {
    getProfile,
    saveProfile,
    localDateString,
    getDailyState,
    saveDailyState,
    saveDailyMotivation,
    hasDailyMotivationForDate,
    getLastActiveProgramId,
    setLastActiveProgramId,
    getContext
  };
})();
