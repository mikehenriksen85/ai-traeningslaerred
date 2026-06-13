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
    const service = window.FirebaseAuthService;
    const user = service?.getCurrentUser?.() || null;
    const ready = Boolean(service);
    const loggedIn = Boolean(user);
    const status = byId("profileLoginStatus");
    const email = byId("profileActiveEmail");
    const firebaseStatus = byId("profileFirebaseStatus");
    const emailInput = byId("profileLoginEmail");
    const passwordInput = byId("profileLoginPassword");

    if (status) status.textContent = loggedIn ? "Logget ind" : ready ? "Ikke logget ind" : "Firebase indlæses";
    if (email) email.textContent = loggedIn ? user.email : "Ingen aktiv e-mail";
    if (firebaseStatus) firebaseStatus.textContent = loggedIn ? "Forbundet" : ready ? "Firebase klar" : "Firebase indlæses";
    if (emailInput) {
      emailInput.disabled = !ready || loggedIn;
      if (loggedIn) emailInput.value = user.email || "";
    }
    if (passwordInput) {
      passwordInput.disabled = !ready || loggedIn;
      if (loggedIn) passwordInput.value = "";
    }

    ["profileEmailLoginBtn", "profileCreateAccountBtn", "profileGoogleLoginBtn"].forEach(id => {
      const button = byId(id);
      if (button) button.disabled = !ready || loggedIn;
    });
    const logoutButton = byId("profileLogoutBtn");
    if (logoutButton) logoutButton.disabled = !ready || !loggedIn;
    const resetButton = byId("profileResetPasswordBtn");
    if (resetButton) resetButton.disabled = !ready;
  }

  function authErrorMessage(error) {
    const messages = {
      "auth/email-already-in-use": "E-mailadressen er allerede i brug.",
      "auth/invalid-credential": "E-mail eller adgangskode er forkert.",
      "auth/invalid-email": "E-mailadressen er ikke gyldig.",
      "auth/popup-closed-by-user": "Google-login blev lukket, før det var færdigt.",
      "auth/popup-blocked": "Browseren blokerede Google-login-vinduet.",
      "auth/too-many-requests": "For mange forsøg. Vent lidt og prøv igen.",
      "auth/user-disabled": "Denne konto er deaktiveret.",
      "auth/weak-password": "Adgangskoden skal være på mindst 6 tegn."
    };
    return messages[error?.code] || error?.message || "Firebase-handlingen kunne ikke gennemføres.";
  }

  function setAuthFeedback(message, isError = false) {
    const feedback = byId("profileAuthFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.style.color = isError ? "#ff6b6b" : "";
  }

  function loginValues() {
    return {
      email: byId("profileLoginEmail")?.value.trim() || "",
      password: byId("profileLoginPassword")?.value || ""
    };
  }

  async function runAuthAction(action, successMessage) {
    const service = window.FirebaseAuthService;
    if (!service?.[action]) {
      setAuthFeedback("Firebase Authentication er ikke klar endnu.", true);
      return;
    }
    setAuthFeedback("Arbejder...");
    try {
      const values = loginValues();
      await service[action](values.email, values.password);
      setAuthFeedback(successMessage);
      renderAccountStatus();
    } catch (error) {
      setAuthFeedback(authErrorMessage(error), true);
    }
  }

  function loginProfileWithEmail() {
    return runAuthAction("loginWithEmail", "Du er nu logget ind.");
  }

  function createProfileAccount() {
    return runAuthAction("createAccount", "Din bruger er oprettet og logget ind.");
  }

  function loginProfileWithGoogle() {
    return runAuthAction("loginWithGoogle", "Du er nu logget ind med Google.");
  }

  async function logoutProfileAccount() {
    const service = window.FirebaseAuthService;
    if (!service?.logout) return;
    try {
      await service.logout();
      setAuthFeedback("Du er nu logget ud.");
      renderAccountStatus();
    } catch (error) {
      setAuthFeedback(authErrorMessage(error), true);
    }
  }

  async function resetProfilePassword() {
    const service = window.FirebaseAuthService;
    const email = byId("profileLoginEmail")?.value.trim() || service?.getCurrentUser?.()?.email || "";
    if (!service?.resetPassword) return;
    try {
      await service.resetPassword(email);
      setAuthFeedback("Link til nulstilling af adgangskode er sendt.");
    } catch (error) {
      setAuthFeedback(authErrorMessage(error), true);
    }
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
  window.loginProfileWithEmail = loginProfileWithEmail;
  window.createProfileAccount = createProfileAccount;
  window.loginProfileWithGoogle = loginProfileWithGoogle;
  window.logoutProfileAccount = logoutProfileAccount;
  window.resetProfilePassword = resetProfilePassword;

  window.addEventListener("firebase-auth:ready", renderAccountStatus);
  window.addEventListener("firebase-auth:changed", event => {
    renderAccountStatus();
    const error = event.detail?.error;
    if (error) setAuthFeedback(authErrorMessage(error), true);
  });
})();
