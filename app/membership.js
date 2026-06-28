(function () {
  "use strict";

  // DEMO ONLY: Medlemskab og Premium-status er klientstyret og må ikke
  // bruges som produktionssikker adgangskontrol.
  // TODO: Flyt autoritativ medlemskabsstatus til backend/Cloud Functions,
  // og håndhæv den med serverudstedte claims og Firestore Rules.
  const CLIENT_MANAGED_DEMO = true;
  const STORAGE_KEY = "ai_training_membership_v1";
  const TRIAL_DAYS = 10;
  const POPUP_INTERVAL_DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const PRICING_STRATEGY_VERSION = "1.0";
  const EARLY_ADOPTER_LIMIT = 500;
  const PLAN_LABELS = {
    trial: "Premium-prøveperiode",
    free: "Gratis version",
    quarterly: "Premium 3 måneder",
    yearly: "Premium 12 måneder",
    lifetime: "Premium livstid"
  };
  const PRICE_TIERS = Object.freeze({
    early_adopter: Object.freeze({ quarterly: 59, yearly: 199, lifetime: 449 }),
    standard: Object.freeze({ quarterly: 79, yearly: 249, lifetime: 499 })
  });
  const PLAN_DETAILS = {
    trial: { priceDkk: 0, aiRequestLimit: 15, aiRequestPeriod: "monthly" },
    free: { priceDkk: 0, aiRequestLimit: 3, aiRequestPeriod: "included" },
    quarterly: { priceDkk: 59, aiRequestLimit: 15, aiRequestPeriod: "monthly" },
    yearly: { priceDkk: 199, aiRequestLimit: 15, aiRequestPeriod: "monthly" },
    lifetime: { priceDkk: 449, aiRequestLimit: 30, aiRequestPeriod: "monthly" }
  };
  let pricingContext = {
    strategyVersion: PRICING_STRATEGY_VERSION,
    registeredUserCount: null,
    earlyAdopterLimit: EARLY_ADOPTER_LIMIT,
    activeTier: "early_adopter",
    source: "fallback"
  };

  function normalizedPricingTier(value) {
    return value === "standard" ? "standard" : "early_adopter";
  }

  function planDetails(plan, tier = pricingContext.activeTier) {
    const base = PLAN_DETAILS[plan] || PLAN_DETAILS.free;
    const tierPrices = PRICE_TIERS[normalizedPricingTier(tier)] || PRICE_TIERS.early_adopter;
    return {
      ...base,
      priceDkk: Object.prototype.hasOwnProperty.call(tierPrices, plan) ? tierPrices[plan] : base.priceDkk
    };
  }

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
    const details = planDetails("trial");
    return {
      membershipType: "trial",
      trialStartDate: iso(now),
      trialEndDate: iso(addDays(now, TRIAL_DAYS)),
      membershipStartDate: null,
      membershipEndDate: null,
      isPremium: true,
      selectedPlan: "trial",
      priceDkk: details.priceDkk,
      aiRequestLimit: details.aiRequestLimit,
      aiRequestPeriod: details.aiRequestPeriod,
      lastMembershipPopupDate: null,
      pricingStrategyVersion: PRICING_STRATEGY_VERSION,
      pricingTierAtPurchase: null,
      priceDkkAtPurchase: null,
      priceLocked: false,
      registeredUserCountAtSelection: null,
      selectedAt: null,
      updatedAt: iso(now)
    };
  }

  function normalize(value, now = new Date()) {
    if (!value || typeof value !== "object") return createTrial(now);
    const allowed = ["trial", "free", "quarterly", "yearly", "lifetime"];
    const membershipType = allowed.includes(value.membershipType) ? value.membershipType : "free";
    const selectedPlan = allowed.includes(value.selectedPlan) ? value.selectedPlan : membershipType;
    const paidPlan = ["quarterly", "yearly", "lifetime"].includes(selectedPlan);
    const storedPrice = Number(value.priceDkkAtPurchase ?? value.priceDkk);
    const hasLockedPrice = paidPlan && Number.isFinite(storedPrice) && storedPrice > 0 && Boolean(value.membershipStartDate || value.priceLocked);
    const purchaseTier = value.pricingTierAtPurchase || (hasLockedPrice ? "legacy" : null);
    const details = planDetails(selectedPlan, purchaseTier === "standard" ? "standard" : pricingContext.activeTier);
    return {
      membershipType,
      trialStartDate: value.trialStartDate || null,
      trialEndDate: value.trialEndDate || null,
      membershipStartDate: value.membershipStartDate || null,
      membershipEndDate: value.membershipEndDate || null,
      isPremium: membershipType !== "free",
      selectedPlan,
      priceDkk: hasLockedPrice ? storedPrice : details.priceDkk,
      aiRequestLimit: details.aiRequestLimit,
      aiRequestPeriod: details.aiRequestPeriod,
      lastMembershipPopupDate: value.lastMembershipPopupDate || null,
      pricingStrategyVersion: value.pricingStrategyVersion || PRICING_STRATEGY_VERSION,
      pricingTierAtPurchase: purchaseTier,
      priceDkkAtPurchase: hasLockedPrice ? storedPrice : null,
      priceLocked: hasLockedPrice,
      registeredUserCountAtSelection: Number.isFinite(Number(value.registeredUserCountAtSelection))
        ? Number(value.registeredUserCountAtSelection)
        : null,
      selectedAt: value.selectedAt || value.membershipStartDate || null,
      updatedAt: value.updatedAt || null
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

  function formatPrice(price) {
    return `${Number(price) || 0} kr.`;
  }

  function renderPricing() {
    const quarterly = planDetails("quarterly");
    const yearly = planDetails("yearly");
    const lifetime = planDetails("lifetime");
    const values = {
      membershipPriceQuarterly: formatPrice(quarterly.priceDkk),
      membershipPriceYearly: formatPrice(yearly.priceDkk),
      membershipPriceLifetime: formatPrice(lifetime.priceDkk),
      membershipPopupPriceQuarterly: `${formatPrice(quarterly.priceDkk)} · 15 AI Requests/md.`,
      membershipPopupPriceYearly: `${formatPrice(yearly.priceDkk)} · 15 AI Requests/md. · Bedste værdi`,
      membershipPopupPriceLifetime: `${formatPrice(lifetime.priceDkk)} · 30 AI Requests/md.`
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
    const phase = document.getElementById("membershipPricingPhase");
    if (phase) {
      phase.textContent = pricingContext.activeTier === "early_adopter"
        ? "Early Adopter-priser · gælder de første 500 registrerede brugere"
        : "Standardpriser";
      phase.dataset.tier = pricingContext.activeTier;
    }
  }

  function updatePricingContext(detail = {}) {
    const count = Number(detail.registeredUserCount);
    const limit = Math.max(1, Number(detail.earlyAdopterLimit) || EARLY_ADOPTER_LIMIT);
    const hasCount = Number.isFinite(count) && count >= 0;
    pricingContext = {
      strategyVersion: detail.strategyVersion || PRICING_STRATEGY_VERSION,
      registeredUserCount: hasCount ? count : null,
      earlyAdopterLimit: limit,
      activeTier: hasCount && count >= limit ? "standard" : normalizedPricingTier(detail.activeTier),
      source: detail.source || "fallback"
    };
    renderPricing();
    render(getMembership());
  }

  function render(data = getMembership()) {
    const statusName = document.getElementById("membershipStatusName");
    const statusCopy = document.getElementById("membershipStatusCopy");
    const statusDate = document.getElementById("membershipStatusDate");
    const navStatus = document.getElementById("membershipNavStatus");
    const trialButton = document.getElementById("startTrialBtn");
    if (!statusName || !statusCopy || !statusDate) return;

    renderPricing();
    const remaining = daysRemaining(data);
    statusName.textContent = PLAN_LABELS[data.membershipType];

    if (data.membershipType === "trial") {
      statusCopy.textContent = `${remaining} ${remaining === 1 ? "dag" : "dage"} tilbage med fuld Premium-adgang.`;
      statusDate.textContent = `Prøveperioden udløber ${formatDate(data.trialEndDate)}. Ingen betaling kræves.`;
      if (navStatus) navStatus.textContent = `${remaining} dage`;
    } else if (data.membershipType === "free") {
      statusCopy.textContent = "Gratis medlemskab med 3 AI Requests.";
      statusDate.textContent = "Dine brugerdata slettes aldrig, hvis du bruger gratisversionen.";
      if (navStatus) navStatus.textContent = "Gratis";
    } else if (data.membershipType === "lifetime") {
      statusCopy.textContent = `Permanent Premium-adgang med 30 AI Requests pr. måned. Valgt til ${formatPrice(data.priceDkkAtPurchase || data.priceDkk)}.`;
      statusDate.textContent = `Medlemskabet blev valgt ${formatDate(data.membershipStartDate)}.`;
      if (navStatus) navStatus.textContent = "Livstid";
    } else {
      statusCopy.textContent = `Fuld Premium-adgang med 15 AI Requests pr. måned. Valgt til ${formatPrice(data.priceDkkAtPurchase || data.priceDkk)}.`;
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
    updateActivePlanUi(data);
    bindMembershipActivation();
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

  function appendConfirmation(message) {
    const element = document.getElementById("membershipConfirmation");
    if (!element) return;
    const current = element.textContent ? `${element.textContent} ` : "";
    element.textContent = `${current}${message}`;
    element.classList.add("show");
  }

  function updateActivePlanUi(data = getMembership()) {
    const activePlan = data.selectedPlan || data.membershipType || "free";
    document.querySelectorAll("[data-membership-plan]").forEach(card => {
      const isActive = card.dataset.membershipPlan === activePlan;
      card.classList.toggle("active", isActive);
      card.setAttribute("aria-current", isActive ? "true" : "false");
    });
    document.querySelectorAll("[data-membership-select]").forEach(button => {
      if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
      const isActive = button.dataset.membershipSelect === activePlan;
      button.setAttribute("aria-pressed", String(isActive));
      button.textContent = isActive ? "Aktiv plan" : button.dataset.defaultText;
    });
  }

  function clearMenuStateBeforeOpen() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    sidebar?.classList.remove("open");
    sidebar?.setAttribute("aria-hidden", "true");
    overlay?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
    document.querySelectorAll(".app-header, main.canvas, .modal, .progress-view, .calorie-view, .profile-account-view, .membership-view, .wizard-shell").forEach(element => {
      element.removeAttribute("aria-hidden");
      element.inert = false;
    });
  }

  function bindMembershipActivation() {
    document.querySelectorAll("[data-membership-select]").forEach(button => {
      if (button.dataset.membershipBound === "true") return;
      button.dataset.membershipBound = "true";
      const activate = event => {
        if (event.type === "pointerup" && event.pointerType === "mouse") return;
        const now = Date.now();
        const lastActivatedAt = Number(button.dataset.lastMembershipActivation || 0);
        if (now - lastActivatedAt < 450) {
          event.preventDefault();
          return;
        }
        button.dataset.lastMembershipActivation = String(now);
        const plan = button.dataset.membershipSelect;
        if (!plan) return;
        event.preventDefault();
        selectPlan(plan);
      };
      button.addEventListener("touchend", activate, { passive: false });
      button.addEventListener("pointerup", activate);
    });
  }

  function closePopup() {
    const popup = document.getElementById("membershipPopup");
    popup?.classList.remove("open");
    window.WorkitWindowManager?.notifyClosed?.("membership-popup");
  }

  function showPopup(force = false) {
    const data = getMembership();
    if (!force && !popupIsDue(data)) return false;
    if (!window.WorkitWindowManager?.canOpen?.("membership-popup")) return false;
    document.getElementById("membershipPopup")?.classList.add("open");
    return true;
  }

  function selectPlan(plan, now = new Date()) {
    const current = getMembership(now);
    const details = planDetails(plan);
    const next = {
      ...current,
      selectedPlan: plan,
      priceDkk: details.priceDkk,
      aiRequestLimit: details.aiRequestLimit,
      aiRequestPeriod: details.aiRequestPeriod,
      pricingStrategyVersion: PRICING_STRATEGY_VERSION,
      updatedAt: iso(now)
    };

    if (plan === "free") {
      next.membershipType = "free";
      next.isPremium = false;
      next.membershipStartDate = null;
      next.membershipEndDate = null;
      next.lastMembershipPopupDate = iso(now);
      next.pricingTierAtPurchase = null;
      next.priceDkkAtPurchase = null;
      next.priceLocked = false;
      next.registeredUserCountAtSelection = null;
      next.selectedAt = iso(now);
    } else {
      next.membershipType = plan;
      next.isPremium = true;
      next.membershipStartDate = iso(now);
      next.membershipEndDate = plan === "quarterly"
        ? iso(addMonths(now, 3))
        : plan === "yearly"
          ? iso(addMonths(now, 12))
          : null;
      next.pricingTierAtPurchase = pricingContext.activeTier;
      next.priceDkkAtPurchase = details.priceDkk;
      next.priceLocked = true;
      next.registeredUserCountAtSelection = pricingContext.registeredUserCount;
      next.selectedAt = iso(now);
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
    const trial = write({ ...createTrial(now), lastMembershipPopupDate: current.lastMembershipPopupDate, updatedAt: iso(now) });
    window.dispatchEvent(new CustomEvent("membership:changed", { detail: trial }));
    render(trial);
    showConfirmation("Din 10 dages gratis Premium-prøveperiode er startet.");
    return trial;
  }

  function openView() {
    window.WorkitViewState?.save?.("membership");
    clearMenuStateBeforeOpen();
    render();
    document.getElementById("progressView")?.classList.remove("open");
    document.getElementById("calorieView")?.classList.remove("open");
    const view = document.getElementById("membershipView");
    view?.classList.add("open");
    view?.setAttribute("aria-hidden", "false");
    view?.focus?.({ preventScroll: true });
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
  }

  function showStartupPopupWhenFree() {
    if (window.ENABLE_FIXED_LOGIN_ROUTING === true) return;
    window.setTimeout(() => showPopup(), 120);
  }

  window.Membership = {
    CLIENT_MANAGED_DEMO,
    STORAGE_KEY,
    TRIAL_DAYS,
    POPUP_INTERVAL_DAYS,
    PLAN_DETAILS,
    PRICE_TIERS,
    PRICING_STRATEGY_VERSION,
    EARLY_ADOPTER_LIMIT,
    getPricingContext: () => ({ ...pricingContext }),
    getPlanDetails: planDetails,
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
  window.addEventListener("work4it:pricing-config", event => updatePricingContext(event.detail));
  window.addEventListener("membership:cloud-saving", () => appendConfirmation("Gemmer i Cloud..."));
  window.addEventListener("membership:cloud-saved", () => appendConfirmation("Gemt i Cloud ☁️"));
  window.addEventListener("membership:cloud-failed", () => appendConfirmation("Gemt lokalt – Cloud ikke tilgængelig."));
  window.addEventListener("firestore:user-ready", showStartupPopupWhenFree);
  window.addEventListener("workit:window-closed", showStartupPopupWhenFree);
}());
