(function profileAccountModule() {
  "use strict";

  const focusAreas = ["Bryst", "Skuldre", "Arme", "Ben", "Core", "Ryg"];
  const bodyHistoryKey = "body_measurement_history";
  let profileAutosaveTimer = null;
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

  const profileGoalFields = {
    primary: "profileGoalPrimary",
    secondary: "profileGoalSecondary",
    tertiary: "profileGoalTertiary"
  };

  function selectedProfileGoals() {
    return Object.fromEntries(Object.entries(profileGoalFields).map(([rank, id]) => [rank, byId(id)?.value || ""]));
  }

  function syncProfileGoalOptions() {
    const selected = selectedProfileGoals();
    Object.entries(profileGoalFields).forEach(([rank, id]) => {
      const select = byId(id);
      if (!select) return;
      const usedElsewhere = new Set(Object.entries(selected)
        .filter(([otherRank, value]) => otherRank !== rank && value)
        .map(([, value]) => value));
      [...select.options].forEach(option => {
        option.disabled = Boolean(option.value && usedElsewhere.has(option.value));
      });
    });
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
    const ready = Boolean(service?.isInitialized?.());
    const user = ready ? service?.getCurrentUser?.() || null : null;
    const loggedIn = Boolean(user);
    const status = byId("profileLoginStatus");
    const email = byId("profileActiveEmail");
    const firebaseStatus = byId("profileFirebaseStatus");
    const emailInput = byId("profileLoginEmail");
    const passwordInput = byId("profileLoginPassword");
    const credentials = byId("profileLoginCredentials");

    const setVisible = (element, visible) => {
      if (!element) return;
      element.hidden = !visible;
      element.setAttribute("aria-hidden", String(!visible));
    };

    if (status) status.textContent = loggedIn ? "Logget ind" : ready ? "Ikke logget ind" : "Firebase indlæses";
    if (email) email.textContent = loggedIn ? user.email : "Ingen aktiv e-mail";
    if (firebaseStatus) firebaseStatus.textContent = loggedIn ? "Forbundet" : ready ? "Firebase klar" : "Firebase indlæses";
    if (emailInput) {
      emailInput.disabled = !ready || loggedIn;
      emailInput.value = loggedIn ? user.email || "" : "";
    }
    if (passwordInput) {
      passwordInput.disabled = !ready || loggedIn;
      passwordInput.value = "";
    }

    setVisible(credentials, ready && !loggedIn);
    ["profileGoogleLoginBtn", "profileEmailLoginBtn", "profileCreateAccountBtn"].forEach(id => {
      const button = byId(id);
      if (!button) return;
      setVisible(button, ready && !loggedIn);
      button.disabled = !ready || loggedIn;
    });
    const logoutButton = byId("profileLogoutBtn");
    if (logoutButton) {
      setVisible(logoutButton, ready && loggedIn);
      logoutButton.disabled = !ready || !loggedIn;
    }
    const resetButton = byId("profileResetPasswordBtn");
    if (resetButton) resetButton.disabled = !ready || !loggedIn;
    const changePasswordButton = byId("profileChangePasswordBtn");
    if (changePasswordButton) changePasswordButton.disabled = !ready || !loggedIn;
    updateSidebarProfileIdentity();
  }

  function updateSidebarProfileIdentity() {
    const service = window.FirebaseAuthService;
    const ready = Boolean(service?.isInitialized?.());
    const user = ready ? service?.getCurrentUser?.() || null : null;
    const profile = user ? window.TrainingWizardStore?.getProfile?.() || {} : {};
    const label = String(
      (user && profile.name) ||
      user?.displayName ||
      user?.email ||
      "Min profil"
    ).trim();
    const nameElement = byId("sidebarProfileName");
    const subtitleElement = byId("sidebarProfileSubtitle");
    if (nameElement) nameElement.textContent = label || "Min profil";
    if (subtitleElement) subtitleElement.textContent = "Profil og konto";
  }

  function authErrorMessage(error) {
    const messages = {
      "auth/email-already-in-use": "E-mailadressen er allerede i brug.",
      "auth/invalid-credential": "E-mail eller adgangskode er forkert.",
      "auth/wrong-password": "Den nuværende adgangskode er forkert.",
      "auth/invalid-email": "E-mailadressen er ikke gyldig.",
      "auth/popup-closed-by-user": "Google-login blev lukket, før det var færdigt.",
      "auth/popup-blocked": "Browseren blokerede Google-login-vinduet.",
      "auth/too-many-requests": "For mange forsøg. Vent lidt og prøv igen.",
      "auth/user-disabled": "Denne konto er deaktiveret.",
      "auth/requires-recent-login": "Firebase kræver et nyt login. Log ud, log ind igen og prøv derefter på ny.",
      "auth/weak-password": "Adgangskoden skal være på mindst 6 tegn.",
      "auth/password-provider-required": "Direkte skift er kun muligt for konti med e-mail/adgangskode. Brug nulstillingsmail eller log ind via din Google-konto.",
      "auth/password-unchanged": "Den nye adgangskode skal være forskellig fra den nuværende."
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

  function setPasswordChangeFeedback(message, isError = false) {
    const feedback = byId("passwordChangeFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.style.color = isError ? "var(--text-danger)" : "var(--text-success)";
  }

  function passwordChangeErrorMessage(error) {
    if (["auth/invalid-credential", "auth/wrong-password"].includes(error?.code)) {
      return "Den nuværende adgangskode er forkert. Prøv igen, eller brug nulstillingsmail.";
    }
    return authErrorMessage(error);
  }

  function openChangePasswordDialog() {
    const user = window.FirebaseAuthService?.getCurrentUser?.() || null;
    if (!user) {
      setAuthFeedback("Du skal være logget ind for at ændre adgangskoden.", true);
      return;
    }
    const supportsPassword = Array.isArray(user.providerIds) && user.providerIds.includes("password");
    const title = byId("modalTitle");
    const content = byId("modalContent");
    if (!title || !content) return;
    title.textContent = "Skift adgangskode";
    content.innerHTML = supportsPassword ? `
      <form class="password-change-form" onsubmit="changePasswordFromDialog(event)">
        <p class="profile-section-copy">Bekræft din nuværende adgangskode. Firebase bruger den til sikker re-authentication før ændringen.</p>
        <label class="profile-form-field">Nuværende adgangskode
          <span class="password-control"><input id="currentPasswordChange" type="password" autocomplete="current-password" minlength="6" required><button class="password-visibility-button" type="button" data-password-toggle="currentPasswordChange" aria-controls="currentPasswordChange" aria-pressed="false">👁 Vis adgangskode</button></span>
        </label>
        <label class="profile-form-field">Ny adgangskode
          <span class="password-control"><input id="newPasswordChange" type="password" autocomplete="new-password" minlength="6" required><button class="password-visibility-button" type="button" data-password-toggle="newPasswordChange" aria-controls="newPasswordChange" aria-pressed="false">👁 Vis adgangskode</button></span>
        </label>
        <label class="profile-form-field">Gentag ny adgangskode
          <span class="password-control"><input id="confirmPasswordChange" type="password" autocomplete="new-password" minlength="6" required><button class="password-visibility-button" type="button" data-password-toggle="confirmPasswordChange" aria-controls="confirmPasswordChange" aria-pressed="false">👁 Vis adgangskode</button></span>
        </label>
        <div class="profile-account-actions">
          <button class="profile-account-button primary" id="confirmPasswordChangeBtn" type="submit">Skift adgangskode</button>
          <button class="profile-account-button" type="button" onclick="sendPasswordResetFromDialog()">Send nulstillingsmail</button>
        </div>
        <div class="profile-save-feedback" id="passwordChangeFeedback" aria-live="polite"></div>
      </form>` : `
      <div class="password-change-form">
        <p>Din konto bruger ${user.providerIds?.includes("google.com") ? "Google-login" : "en ekstern loginmetode"}. Den har derfor ingen nuværende Work4it-adgangskode, som kan bekræftes direkte.</p>
        <p class="profile-section-copy">Fortsæt med din normale loginmetode, eller forsøg at få tilsendt en Firebase-nulstillingsmail til <strong>${String(user.email || "din e-mail")}</strong>.</p>
        <div class="profile-account-actions"><button class="profile-account-button" type="button" onclick="sendPasswordResetFromDialog()">Send nulstillingsmail</button></div>
        <div class="profile-save-feedback" id="passwordChangeFeedback" aria-live="polite"></div>
      </div>`;
    window.openModal?.();
  }

  async function changePasswordFromDialog(event) {
    event?.preventDefault?.();
    const currentPassword = byId("currentPasswordChange")?.value || "";
    const newPassword = byId("newPasswordChange")?.value || "";
    const confirmation = byId("confirmPasswordChange")?.value || "";
    if (newPassword !== confirmation) {
      setPasswordChangeFeedback("De to nye adgangskoder er ikke ens.", true);
      return;
    }
    const button = byId("confirmPasswordChangeBtn");
    if (button) button.disabled = true;
    setPasswordChangeFeedback("Bekræfter login og opdaterer adgangskoden...");
    try {
      const service = window.FirebaseAuthService;
      if (!service?.changePassword) throw new Error("Firebase Authentication er ikke klar endnu.");
      await service.changePassword(currentPassword, newPassword);
      ["currentPasswordChange", "newPasswordChange", "confirmPasswordChange"].forEach(id => {
        const input = byId(id);
        if (input) input.value = "";
      });
      window.PasswordVisibility?.reset?.();
      setPasswordChangeFeedback("Adgangskoden er ændret sikkert ✓");
      setAuthFeedback("Adgangskoden er ændret sikkert.");
      window.setTimeout(() => window.closeModal?.(), 900);
    } catch (error) {
      setPasswordChangeFeedback(passwordChangeErrorMessage(error), true);
      if (button) button.disabled = false;
    }
  }

  async function sendPasswordResetFromDialog() {
    const service = window.FirebaseAuthService;
    const email = service?.getCurrentUser?.()?.email || "";
    if (!service?.resetPassword || !email) {
      setPasswordChangeFeedback("Der findes ingen aktiv e-mail til nulstillingsmailen.", true);
      return;
    }
    setPasswordChangeFeedback("Sender nulstillingsmail...");
    try {
      await service.resetPassword(email);
      setPasswordChangeFeedback("Nulstillingsmail er sendt. Kontrollér også din spam-mappe.");
      setAuthFeedback("Link til nulstilling af adgangskode er sendt.");
    } catch (error) {
      setPasswordChangeFeedback(authErrorMessage(error), true);
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
    const trainingGoals = window.TrainingWizardStore?.normalizeTrainingGoals?.(profile.trainingGoals, profile.goal || "general_health") || {
      primary: profile.goal || "general_health",
      secondary: "",
      tertiary: ""
    };
    setValue("profileGoalPrimary", trainingGoals.primary);
    setValue("profileGoalSecondary", trainingGoals.secondary);
    setValue("profileGoalTertiary", trainingGoals.tertiary);
    syncProfileGoalOptions();
    setValue("profilePreferredTrainingStyle", profile.preferredTrainingStyle || "hybrid");
    setValue("profileExperience", profile.experience || "intermediate");
    setValue("profileTrainingDays", profile.trainingDaysPerWeek || 3);
    setValue("profileExercisePreference", profile.exercisePreference || "mixed");
    setValue("profilePreferredExerciseCount", profile.preferredExerciseCount || 5);
    renderFocusAreas(Array.isArray(profile.focusAreas) ? profile.focusAreas : []);
    renderAccountStatus();
    populateThemeSettings();
    const feedback = byId("profileSaveFeedback");
    if (feedback) feedback.textContent = "";
  }

  function populateThemeSettings() {
    const theme = window.Work4itTheme?.getTheme?.() || "work4it";
    document.querySelectorAll('input[name="work4it-theme"]').forEach(input => {
      input.checked = input.value === theme;
    });
  }

  function setThemeFeedback(message, isWarning = false) {
    const feedback = byId("themeSaveFeedback");
    if (!feedback) return;
    feedback.textContent = message || "";
    feedback.style.color = isWarning ? "#fbbf24" : "";
  }

  function changeAppTheme(theme) {
    if (!window.Work4itTheme?.setTheme) {
      setThemeFeedback("Tema-systemet er ikke klar endnu.", true);
      return;
    }
    const appliedTheme = window.Work4itTheme.setTheme(theme, { source: "profile" });
    populateThemeSettings();
    const loggedIn = Boolean(window.FirebaseAuthService?.getCurrentUser?.());
    setThemeFeedback(loggedIn ? "Tema gemmes i Cloud..." : "Tema gemt lokalt ✓");
    if (!loggedIn) {
      window.setTimeout(() => {
        if ((window.Work4itTheme?.getTheme?.() || "work4it") === appliedTheme) {
          setThemeFeedback("Tema gemt lokalt ✓");
        }
      }, 300);
    }
  }

  function openProfileAccountView() {
    window.WorkitViewState?.save?.("profile");
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

  function collectProfileAccountData() {
    const trainingGoals = selectedProfileGoals();
    return {
      hasCompletedProfileWizard: true,
      name: byId("profileName")?.value.trim() || "",
      age: inputNumber("profileAge"),
      gender: byId("profileGender")?.value || "",
      heightCm: inputNumber("profileHeight"),
      weightKg: inputNumber("profileWeight"),
      bodyFat: inputNumber("profileBodyFat"),
      muscleMass: inputNumber("profileMuscleMass"),
      personalGoal: byId("profilePersonalGoal")?.value.trim() || "",
      goal: trainingGoals.primary,
      trainingGoals,
      preferredTrainingStyle: ["gym", "calisthenics", "hybrid"].includes(byId("profilePreferredTrainingStyle")?.value)
        ? byId("profilePreferredTrainingStyle").value
        : "hybrid",
      experience: byId("profileExperience")?.value || "",
      trainingDaysPerWeek: Number(byId("profileTrainingDays")?.value) || 3,
      focusAreas: selectedFocusAreas(),
      exercisePreference: byId("profileExercisePreference")?.value || "",
      preferredExerciseCount: Number(byId("profilePreferredExerciseCount")?.value) || 5
    };
  }

  function profileIsValid(profile, feedback = null) {
    const selectedGoalValues = Object.values(profile.trainingGoals || {}).filter(Boolean);
    if (!profile.trainingGoals?.primary) {
      if (feedback) feedback.textContent = "Vælg et primært træningsmål.";
      return false;
    }
    if (new Set(selectedGoalValues).size !== selectedGoalValues.length) {
      if (feedback) feedback.textContent = "Det samme træningsmål kan kun vælges én gang.";
      return false;
    }
    return true;
  }

  function scheduleProfileAutosave() {
    window.clearTimeout(profileAutosaveTimer);
    profileAutosaveTimer = window.setTimeout(async () => {
      if (!window.FirebaseAuthService?.getCurrentUser?.()) return;
      const feedback = byId("profileSaveFeedback");
      const profile = collectProfileAccountData();
      if (!profileIsValid(profile, feedback)) return;
      try {
        await window.TrainingWizardStore?.saveProfileAndSync?.(profile);
        updateSidebarProfileIdentity();
        if (feedback) {
          feedback.textContent = "Profil gemt automatisk i Cloud ☁️";
          feedback.style.color = "";
        }
      } catch {
        if (feedback) {
          feedback.textContent = "Profil gemt lokalt – Cloud ikke tilgængelig";
          feedback.style.color = "#fbbf24";
        }
      }
    }, 700);
  }

  async function saveProfileAccount(event) {
    event?.preventDefault?.();
    const feedback = byId("profileSaveFeedback");
    const profile = collectProfileAccountData();
    if (!profileIsValid(profile, feedback)) return;
    window.clearTimeout(profileAutosaveTimer);
    try {
      const savedProfile = window.TrainingWizardStore?.saveProfileAndSync
        ? await window.TrainingWizardStore.saveProfileAndSync(profile)
        : window.TrainingWizardStore?.saveProfile?.(profile);
      saveMeasurementSnapshot(savedProfile || profile);
      updateSidebarProfileIdentity();
      if (feedback) {
        feedback.textContent = "Profil gemt i Cloud ☁️";
        feedback.style.color = "";
      }
    } catch (error) {
      saveMeasurementSnapshot(profile);
      updateSidebarProfileIdentity();
      if (feedback) {
        feedback.textContent = "Profil gemt lokalt – Cloud ikke tilgængelig";
        feedback.style.color = "#fbbf24";
      }
    }
  }

  function openProfileWizardAgain() {
    closeProfileAccountView();
    window.ProfileWizard?.open?.({ mode: "edit" });
  }

  async function exportProfileData() {
    setAuthFeedback("Eksporterer dine data...");
    try {
      const cloudExport = await window.FirestoreDataService?.exportCurrentUserData?.();
      const data = cloudExport || {
        source: "localStorage",
        exportedAt: new Date().toISOString(),
        localCache: window.WorkitStorageScope?.exportCurrentUserData?.() || {}
      };
      const blob = new Blob([JSON.stringify({
        exportedAt: new Date().toISOString(),
        app: "Work4it",
        data
      }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `work4it-data-${window.TrainingWizardStore?.localDateString?.() || "export"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setAuthFeedback(data.source === "firestore" ? "Cloud-dataeksport er klar." : "Lokal dataeksport er klar.");
    } catch (error) {
      setAuthFeedback(`Data kunne ikke eksporteres: ${authErrorMessage(error)}`, true);
    }
  }

  function clearAllLocalData() {
    const confirmed = window.confirm(
      "Vil du rydde alle lokale data på denne enhed? Cloud-data slettes ikke."
    );
    if (!confirmed) return;
    window.WorkitStorageScope?.clearCurrentUserCache?.();
    window.location.reload();
  }

  async function deleteProfileAccountAndData() {
    const confirmed = window.confirm(
      "Dette sletter din Work4it-konto og alle tilhørende cloud-data permanent. Eksportér dine data først, hvis du vil gemme en kopi. Vil du fortsætte?"
    );
    if (!confirmed) return;
    const service = window.FirebaseAuthService;
    if (!service?.deleteAccountAndData) {
      setAuthFeedback("Konto- og datasletning er ikke klar endnu.", true);
      return;
    }
    setAuthFeedback("Sletter konto og cloud-data...");
    try {
      await service.deleteAccountAndData();
      window.WorkitStorageScope?.clearCurrentUserCache?.();
      setAuthFeedback("Konto og data er slettet.");
      window.showAuthGate?.("Kontoen er slettet. Log ind eller opret en ny konto for at fortsætte.");
    } catch (error) {
      setAuthFeedback(authErrorMessage(error), true);
    }
  }

  window.openProfileAccountView = openProfileAccountView;
  window.closeProfileAccountView = closeProfileAccountView;
  window.saveProfileAccount = saveProfileAccount;
  window.syncProfileGoalOptions = syncProfileGoalOptions;
  window.openProfileWizardAgain = openProfileWizardAgain;
  window.exportProfileData = exportProfileData;
  window.clearAllLocalData = clearAllLocalData;
  window.deleteProfileAccountAndData = deleteProfileAccountAndData;
  window.refreshProfileAccountView = populateProfileAccount;
  window.changeAppTheme = changeAppTheme;
  window.saveProfileMeasurementSnapshot = saveMeasurementSnapshot;
  window.updateSidebarProfileIdentity = updateSidebarProfileIdentity;
  window.loginProfileWithEmail = loginProfileWithEmail;
  window.createProfileAccount = createProfileAccount;
  window.loginProfileWithGoogle = loginProfileWithGoogle;
  window.logoutProfileAccount = logoutProfileAccount;
  window.resetProfilePassword = resetProfilePassword;
  window.openChangePasswordDialog = openChangePasswordDialog;
  window.changePasswordFromDialog = changePasswordFromDialog;
  window.sendPasswordResetFromDialog = sendPasswordResetFromDialog;

  window.addEventListener("firebase-auth:ready", renderAccountStatus);
  window.addEventListener("firebase-auth:changed", event => {
    renderAccountStatus();
    const error = event.detail?.error;
    if (error) setAuthFeedback(authErrorMessage(error), true);
  });
  window.addEventListener("firestore:data-hydrated", () => {
    renderAccountStatus();
    if (byId("profileAccountView")?.classList.contains("open")) populateProfileAccount();
  });
  window.addEventListener("firestore:user-cache-cleared", renderAccountStatus);
  window.addEventListener("training-profile:updated", updateSidebarProfileIdentity);
  window.addEventListener("work4it:theme-applied", populateThemeSettings);
  window.addEventListener("work4it:theme-cloud-saving", () => setThemeFeedback("Tema gemmes i Cloud..."));
  window.addEventListener("work4it:theme-cloud-saved", () => setThemeFeedback("Tema gemt i Cloud ☁️"));
  window.addEventListener("work4it:theme-cloud-failed", () => setThemeFeedback("Tema gemt lokalt – Cloud ikke tilgængelig", true));
  const profileForm = byId("profileAccountForm");
  profileForm?.addEventListener("input", scheduleProfileAutosave);
  profileForm?.addEventListener("change", scheduleProfileAutosave);
})();
