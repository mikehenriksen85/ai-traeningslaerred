(function trainingWizardStoreModule() {
  "use strict";

  const PROFILE_KEY = "training_profile_v1";
  const DAILY_KEY = "daily_start_v1";
  const LAST_PROGRAM_KEY = "last_active_program_id";
  const VALID_GOALS = ["muscle_gain", "weight_loss", "strength", "general_health", "cardio"];

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

  function normalizeTrainingGoals(value = {}, fallbackPrimary = "") {
    const source = value && typeof value === "object" ? value : {};
    const result = { primary: "", secondary: "", tertiary: "" };
    const used = new Set();
    ["primary", "secondary", "tertiary"].forEach((rank, index) => {
      const candidate = String(source[rank] || (index === 0 ? fallbackPrimary : "") || "");
      if (VALID_GOALS.includes(candidate) && !used.has(candidate)) {
        result[rank] = candidate;
        used.add(candidate);
      }
    });
    return result;
  }

  function getProfile() {
    const stored = read(PROFILE_KEY, {});
    const trainingGoals = normalizeTrainingGoals(stored.trainingGoals, stored.goal);
    return {
      hasCompletedProfileWizard: false,
      name: "",
      goal: "",
      trainingGoals: { primary: "", secondary: "", tertiary: "" },
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
      preferredTrainingStyle: "hybrid",
      preferredExerciseCount: 5,
      updatedAt: "",
      ...stored,
      goal: trainingGoals.primary || stored.goal || "",
      trainingGoals,
      preferredTrainingStyle: ["gym", "calisthenics", "hybrid"].includes(stored.preferredTrainingStyle)
        ? stored.preferredTrainingStyle
        : "hybrid"
    };
  }

  function saveProfile(profile, options = {}) {
    const current = getProfile();
    const hasLegacyGoalUpdate = Object.prototype.hasOwnProperty.call(profile, "goal");
    const requestedGoals = profile.trainingGoals || (hasLegacyGoalUpdate
      ? { ...current.trainingGoals, primary: profile.goal }
      : current.trainingGoals);
    const trainingGoals = normalizeTrainingGoals(requestedGoals, profile.goal || current.goal);
    const next = {
      ...current,
      ...profile,
      goal: trainingGoals.primary,
      trainingGoals,
      preferredTrainingStyle: ["gym", "calisthenics", "hybrid"].includes(profile.preferredTrainingStyle)
        ? profile.preferredTrainingStyle
        : current.preferredTrainingStyle,
      focusAreas: Array.isArray(profile.focusAreas) ? [...profile.focusAreas] : current.focusAreas,
      updatedAt: new Date().toISOString()
    };
    write(PROFILE_KEY, next);
    window.dispatchEvent(new CustomEvent("training-profile:updated", { detail: { ...next } }));
    if (options.cloud !== false && window.FirestoreDataService?.saveProfileToCloud) {
      window.FirestoreDataService.saveProfileToCloud(next).catch(error => {
        window.dispatchEvent(new CustomEvent("training-profile:cloud-save-failed", {
          detail: { error, profile: { ...next } }
        }));
      });
    }
    return next;
  }

  async function saveProfileAndSync(profile) {
    const saved = saveProfile(profile, { cloud: false });
    const user = window.FirebaseAuthService?.getCurrentUser?.() || null;
    if (!user?.uid) {
      const error = new Error("Profilen er gemt lokalt, men Cloud kræver et gyldigt login.");
      error.code = "auth/user-not-authenticated";
      throw error;
    }
    if (!window.FirestoreDataService?.saveProfileToCloud) {
      throw new Error("Cloud-tjenesten er ikke klar.");
    }
    const cloudSaved = await window.FirestoreDataService.saveProfileToCloud(saved);
    if (cloudSaved !== true) throw new Error("Cloud-gemningen blev ikke bekræftet.");
    return saved;
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
      trainingGoals: { ...profile.trainingGoals },
      experience: profile.experience,
      focusAreas: [...profile.focusAreas],
      exercisePreference: profile.exercisePreference,
      preferredTrainingStyle: ["gym", "calisthenics", "hybrid"].includes(profile.preferredTrainingStyle)
        ? profile.preferredTrainingStyle
        : "hybrid",
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
      motivation: daily.dailyMotivation,
      dailyMotivation: daily.dailyMotivation,
      dailyMotivationDate: daily.dailyMotivationDate,
      lastActiveProgramId: getLastActiveProgramId()
    };
  }

  window.TrainingWizardStore = {
    VALID_GOALS,
    normalizeTrainingGoals,
    getProfile,
    saveProfile,
    saveProfileAndSync,
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
