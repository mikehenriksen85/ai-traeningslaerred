(function profileAccountModule() {
  "use strict";

  const focusAreas = ["Bryst", "Skuldre", "Arme", "Ben", "Core", "Ryg"];
  const bodyHistoryKey = "body_measurement_history";
  const accountKey = "training_account_v1";

  function byId(id) {
    return document.getElementById(id);
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function numberOrBlank(value) {
    const number = Number.parseFloat(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) ? number : "";
  }

  function inputNumber(id) {
    return numberOrBlank(byId(id)?.value);
  }

  function latestBodyMeasurement() {
    const entries = readJson(bodyHistoryKey, []);
    if (!Array.isArray(entries) || !entries.length) return {};
    return [...entries].sort((a, b) => new Date(a.date) - new Date(b.date)).at(-1) || {};
  }

  function setValue(id, value) {
    const element = byId(id);
    if (element) element.value = value ?? "";
  }

  function renderFocusAreas(selected = []) {
    const root = byId("profileFocusAreas");
    if (!root) return;
    root.innerHTML = focusAreas.map(area => `
      <label class="profile-focus-option">
        <input type="checkbox" name="profile-focus" value="${area}" ${selected.includes(area) ? "checked" : ""}>
        <span>${area}</span>
      </label>`).join("");
  }

  function renderAccountStatus() {
    const account = readJson(accountKey, {});
    const firebaseReady = Boolean(window.firebase?.auth || window.FirebaseAuth);
    const loggedIn = Boolean(account.loggedIn && account.email);
    byId("profileLoginStatus").textContent = loggedIn ? "Logget ind" : firebaseReady ? "Ikke logget ind" : "Ikke logget ind · Klar til Firebase";
    byId("profileActiveEmail").textContent = loggedIn ? account.email : "Ingen aktiv e-mail";
  }

  function populateProfileAccount() {
    const profile = window.TrainingWizardStore?.getProfile?.() || {};
    const measurement = latestBodyMeasurement();
    setValue("profileName", profile.name);
    setValue("profileAge", profile.age);
    setValue("profileGender", profile.gender);
    setValue("profileHeight", profile.heightCm || measurement.height);
    setValue("profileWeight", profile.weightKg || measurement.weight);
    setValue("profileBodyFat", profile.bodyFat || measurement.fat);
    setValue("profileMuscleMass", profile.muscleMass || measurement.muscle);
    setValue("profilePersonalGoal", profile.personalGoal || measurement.goal);
    setValue("profileGoal", profile.goal || "general_health");
    setValue("profileExperience", profile.experience || "intermediate");
    setValue("profileTrainingDays", profile.trainingDaysPerWeek || 3);
    setValue("profileExercisePreference", profile.exercisePreference || "mixed");
    setValue("profilePreferredExerciseCount", profile.preferredExerciseCount || 5);
    renderFocusAreas(Array.isArray(profile.focusAreas) ? profile.focusAreas : []);
    renderAccountStatus();
    const feedback = byId("profileSaveFeedback");
    if (feedback) feedback.textContent = "";
  }

  function openProfileAccountView() {
    document.getElementById("progressView")?.classList.remove("open");
    document.getElementById("membershipView")?.classList.remove("open");
    document.getElementById("calorieView")?.classList.remove("open");
    if (document.getElementById("sidebar")?.classList.contains("open")) window.toggleSidebar?.();
    populateProfileAccount();
    const view = byId("profileAccountView");
    view?.classList.add("open");
    view?.setAttribute("aria-hidden", "false");
  }

  function closeProfileAccountView() {
    const view = byId("profileAccountView");
    view?.classList.remove("open");
    view?.setAttribute("aria-hidden", "true");
  }

  function selectedFocusAreas() {
    return [...document.querySelectorAll('input[name="profile-focus"]:checked')].map(input => input.value);
  }

  function saveMeasurementSnapshot(profile) {
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      height: numberOrBlank(profile.heightCm) || null,
      weight: numberOrBlank(profile.weightKg) || null,
      bmi: null,
      fat: numberOrBlank(profile.bodyFat) || null,
      muscle: numberOrBlank(profile.muscleMass) || null,
      waist: null,
      chest: null,
      hip: null,
      thigh: null,
      arm: null,
      goal: profile.personalGoal || ""
    };
    if (entry.height && entry.weight) {
      const meters = entry.height / 100;
      entry.bmi = entry.weight / (meters * meters);
    }
    const latest = latestBodyMeasurement();
    const comparable = ["height", "weight", "fat", "muscle", "goal"];
    const changed = comparable.some(key => String(latest[key] ?? "") !== String(entry[key] ?? ""));
    const hasValue = comparable.some(key => entry[key] !== null && entry[key] !== "");
    if (!changed || !hasValue) return;
    const entries = readJson(bodyHistoryKey, []);
    writeJson(bodyHistoryKey, [...(Array.isArray(entries) ? entries : []), entry]);
  }

  function saveProfileAccount(event) {
    event?.preventDefault?.();
    const profile = {
      hasCompletedProfileWizard: true,
      name: byId("profileName").value.trim(),
      age: inputNumber("profileAge"),
      gender: byId("profileGender").value,
      heightCm: inputNumber("profileHeight"),
      weightKg: inputNumber("profileWeight"),
      bodyFat: inputNumber("profileBodyFat"),
      muscleMass: inputNumber("profileMuscleMass"),
      personalGoal: byId("profilePersonalGoal").value.trim(),
      goal: byId("profileGoal").value,
      experience: byId("profileExperience").value,
      trainingDaysPerWeek: Number(byId("profileTrainingDays").value) || 3,
      focusAreas: selectedFocusAreas(),
      exercisePreference: byId("profileExercisePreference").value,
      preferredExerciseCount: Number(byId("profilePreferredExerciseCount").value) || 5
    };
    window.TrainingWizardStore?.saveProfile?.(profile);
    saveMeasurementSnapshot(profile);
    const feedback = byId("profileSaveFeedback");
    if (feedback) feedback.textContent = "Profilen er gemt lokalt.";
  }

  function openProfileWizardAgain() {
    closeProfileAccountView();
    window.ProfileWizard?.open?.({ mode: "edit" });
  }

  function exportProfileData() {
    const data = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key) continue;
      const raw = localStorage.getItem(key);
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      app: "AI Training Canvas",
      data
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-training-canvas-data-${window.TrainingWizardStore?.localDateString?.() || "export"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function clearAllLocalData() {
    const confirmed = window.confirm(
      "Vil du rydde alle lokale data? Træningspas, historik, profil og indstillinger fjernes fra denne browser."
    );
    if (!confirmed) return;
    localStorage.clear();
    window.location.reload();
  }

  window.openProfileAccountView = openProfileAccountView;
  window.closeProfileAccountView = closeProfileAccountView;
  window.saveProfileAccount = saveProfileAccount;
  window.openProfileWizardAgain = openProfileWizardAgain;
  window.exportProfileData = exportProfileData;
  window.clearAllLocalData = clearAllLocalData;
  window.refreshProfileAccountView = populateProfileAccount;
  window.saveProfileMeasurementSnapshot = saveMeasurementSnapshot;
})();
