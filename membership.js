(function () {
  "use strict";

  const STORAGE_KEY = "ai_training_membership_v1";
  const TRIAL_DAYS = 10;
  const POPUP_INTERVAL_DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const PLAN_LABELS = {
    trial: "Premium-prøveperiode",
    free: "Gratis version",
    quarterly: "Premium 3 måneder",
    yearly: "Premium 12 måneder",
    lifetime: "Premium livstid"
  };

  function iso(date) {
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function parseDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
  }

  function addMonths(date, months) {
    const result = new Date(date);
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
  }

  function createTrial(now = new Date()) {
    return {
      membershipType: "trial",
      trialStartDate: iso(now),
      trialEndDate: iso(addDays(now, TRIAL_DAYS)),
      membershipStartDate: null,
      membershipEndDate: null,
      isPremium: true,
      selectedPlan: "trial",
      lastMembershipPopupDate: null
    };
  }

  function normalize(value, now = new Date()) {
    if (!value || typeof value !== "object") return createTrial(now);
    const allowed = ["trial", "free", "quarterly", "yearly", "lifetime"];
    const membershipType = allowed.includes(value.membershipType) ? value.membershipType : "free";
    return {
      membershipType,
      trialStartDate: value.trialStartDate || null,
      trialEndDate: value.trialEndDate || null,
      membershipStartDate: value.membershipStartDate || null,
      membershipEndDate: value.membershipEndDate || null,
      isPremium: membershipType !== "free",
      selectedPlan: allowed.includes(value.selectedPlan) ? value.selectedPlan : membershipType,
      lastMembershipPopupDate: value.lastMembershipPopupDate || null
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch (_) {
      return null;
    }
  }

  function write(data) {
    const normalized = normalize(data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_) {
      // Appen kan stadig bruges, selv hvis browseren afviser lokal lagring.
    }
    return normalized;
  }

  function evaluate(data, now = new Date()) {
    const next = normalize(data, now);
    const expiry = parseDate(next.membershipEndDate);
    const trialEnd = parseDate(next.trialEndDate);
    const trialExpired = next.membershipType === "trial" && trialEnd && trialEnd <= now;
    const paidExpired = ["quarterly", "yearly"].includes(next.membershipType) && expiry && expiry <= now;

    if (trialExpired || paidExpired) {
      next.membershipType = "free";
      next.selectedPlan = "free";
      next.isPremium = false;
      next.membershipStartDate = null;
      next.membershipEndDate = null;
    } else {
      next.isPremium = next.membershipType !== "free";
    }
    return next;
  }

  function getMembership(now = new Date()) {
    const existing = read();
    const current = evaluate(existing || createTrial(now), now);
    return write(current);
  }

  function daysRemaining(data, now = new Date()) {
    const end = data.membershipType === "trial"
      ? parseDate(data.trialEndDate)
      : parseDate(data.membershipEndDate);
    return end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS)) : null;
  }

  function formatDate(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(date) : "";
  }

  function popupIsDue(data, now = new Date()) {
    if (data.membershipType !== "free") return false;
    const lastShown = parseDate(data.lastMembershipPopupDate);
    return !lastShown || now.getTime() - lastShown.getTime() >= POPUP_INTERVAL_DAYS * DAY_MS;
  }

  function render(data = getMembership()) {
    const statusName = document.getElementById("membershipStatusName");
    const statusCopy = document.getElementById("membershipStatusCopy");
    const statusDate = document.getElementById("membershipStatusDate");
    const navStatus = document.getElementById("membershipNavStatus");
    const trialButton = document.getElementById("startTrialBtn");
    if (!statusName || !statusCopy || !statusDate) return;

    const remaining = daysRemaining(data);
    statusName.textContent = PLAN_LABELS[data.membershipType];

    if (data.membershipType === "trial") {
      statusCopy.textContent = `${remaining} ${remaining === 1 ? "dag" : "dage"} tilbage med fuld Premium-adgang.`;
      statusDate.textContent = `Prøveperioden udløber ${formatDate(data.trialEndDate)}. Ingen betaling kræves.`;
      if (navStatus) navStatus.textContent = `${remaining} dage`;
    } else if (data.membershipType === "free") {
      statusCopy.textContent = "Du kan fortsat gennemføre træning, se eksisterende data og gemme lokalt.";
      statusDate.textContent = "Dine brugerdata slettes aldrig, hvis du bruger gratisversionen.";
      if (navStatus) navStatus.textContent = "Gratis";
    } else if (data.membershipType === "lifetime") {
      statusCopy.textContent = "Permanent adgang til alle Premium-funktioner.";
      statusDate.textContent = `Medlemskabet blev valgt ${formatDate(data.membershipStartDate)}.`;
      if (navStatus) navStatus.textContent = "Livstid";
    } else {
      statusCopy.textContent = "Fuld adgang til alle Premium-funktioner.";
      statusDate.textContent = `${remaining} ${remaining === 1 ? "dag" : "dage"} tilbage. Udløber ${formatDate(data.membershipEndDate)}.`;
      if (navStatus) navStatus.textContent = "Premium";
    }

    if (trialButton) {
      const trialUsed = Boolean(data.trialStartDate);
      trialButton.disabled = trialUsed;
      trialButton.textContent = data.membershipType === "trial"
        ? "Prøveperiode aktiv"
        : trialUsed
          ? "Prøveperiode brugt"
          : "Start gratis prøveperiode";
      trialButton.style.opacity = trialUsed ? ".65" : "1";
      trialButton.style.cursor = trialUsed ? "default" : "pointer";
    }

    applyAccessState(data);
  }

  function applyAccessState(data = getMembership()) {
    const locked = !data.isPremium;
    ["copilotAccess", "programGeneratorAccess"].forEach(id => {
      document.getElementById(id)?.classList.toggle("premium-locked", locked);
    });
    document.documentElement.dataset.membership = data.membershipType;
  }

  function showConfirmation(message) {
    const element = document.getElementById("membershipConfirmation");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
  }

  function closePopup() {
    const popup = document.getElementById("membershipPopup");
    popup?.classList.remove("open");
  }

  function showPopup(force = false) {
    const data = getMembership();
    if (!force && !popupIsDue(data)) return false;
    document.getElementById("membershipPopup")?.classList.add("open");
    return true;
  }

  function selectPlan(plan, now = new Date()) {
    const current = getMembership(now);
    const next = { ...current, selectedPlan: plan };

    if (plan === "free") {
      next.membershipType = "free";
      next.isPremium = false;
      next.membershipStartDate = null;
      next.membershipEndDate = null;
      next.lastMembershipPopupDate = iso(now);
    } else {
      next.membershipType = plan;
      next.isPremium = true;
      next.membershipStartDate = iso(now);
      next.membershipEndDate = plan === "quarterly"
        ? iso(addMonths(now, 3))
        : plan === "yearly"
          ? iso(addMonths(now, 12))
          : null;
    }

    const saved = write(next);
    closePopup();
    render(saved);
    showConfirmation(plan === "free"
      ? "Gratisversionen er valgt. Alle dine eksisterende data er bevaret."
      : `${PLAN_LABELS[plan]} er valgt som demo. Ingen betaling er gennemført.`);
    window.dispatchEvent(new CustomEvent("membership:changed", { detail: saved }));
    return saved;
  }

  function startTrial(now = new Date()) {
    const current = getMembership(now);
    if (current.trialStartDate) {
      showConfirmation("Den gratis prøveperiode er allerede startet eller tidligere brugt.");
      return current;
    }
    const trial = write({ ...createTrial(now), lastMembershipPopupDate: current.lastMembershipPopupDate });
    render(trial);
    showConfirmation("Din 10 dages gratis Premium-prøveperiode er startet.");
    return trial;
  }

  function openView() {
    render();
    document.getElementById("progressView")?.classList.remove("open");
    document.getElementById("calorieView")?.classList.remove("open");
    const view = document.getElementById("membershipView");
    view?.classList.add("open");
    view?.setAttribute("aria-hidden", "false");
    if (document.getElementById("sidebar")?.classList.contains("open") && typeof window.toggleSidebar === "function") {
      window.toggleSidebar();
    }
  }

  function closeView() {
    const view = document.getElementById("membershipView");
    view?.classList.remove("open");
    view?.setAttribute("aria-hidden", "true");
  }

  function requireFeature(featureName, callback) {
    const data = getMembership();
    if (data.isPremium) {
      if (typeof callback === "function") callback();
      return true;
    }
    openView();
    const labels = {
      progress: "Min udvikling",
      copilot: "AI Copilot",
      generator: "Programgeneratoren",
      adaptation: "Automatisk programtilpasning",
      programs: "Flere end 2 gemte træningspas"
    };
    showConfirmation(`${labels[featureName] || "Denne funktion"} kræver Premium. Du kan altid fortsætte med gratisversionens basale funktioner.`);
    return false;
  }

  function initialize() {
    const data = getMembership();
    render(data);
    if (popupIsDue(data)) showPopup();
  }

  window.Membership = {
    STORAGE_KEY,
    TRIAL_DAYS,
    POPUP_INTERVAL_DAYS,
    createTrial,
    normalize,
    evaluate,
    getMembership,
    daysRemaining,
    popupIsDue,
    selectPlan,
    startTrial,
    render,
    initialize,
    requireFeature,
    openView,
    closeView,
    showPopup
  };
  window.openMembershipView = openView;
  window.closeMembershipView = closeView;
  window.selectMembershipPlan = selectPlan;
  window.startMembershipTrial = startTrial;
  window.openPremiumFeature = requireFeature;

  window.addEventListener("training-app:ready", initialize, { once: true });
}());
