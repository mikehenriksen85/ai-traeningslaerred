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
      goal: "",
      heightCm: "",
      weightKg: "",
      age: "",
      gender: "",
      experience: "",
      trainingDaysPerWeek: 3,
      focusAreas: [],
      exercisePreference: "",
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

  function getDailyState() {
    return {
      motivation: "",
      selectedAction: "",
      completedAt: "",
      ...read(DAILY_KEY, {})
    };
  }

  function saveDailyState(state) {
    const next = {
      ...getDailyState(),
      ...state,
      completedAt: new Date().toISOString()
    };
    return write(DAILY_KEY, next);
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
      motivation: daily.motivation,
      lastActiveProgramId: getLastActiveProgramId()
    };
  }

  window.TrainingWizardStore = {
    getProfile,
    saveProfile,
    getDailyState,
    saveDailyState,
    getLastActiveProgramId,
    setLastActiveProgramId,
    getContext
  };
})();
