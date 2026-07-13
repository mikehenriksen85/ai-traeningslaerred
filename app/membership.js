(function () {
  "use strict";

  // Gratis håndteres fortsat i klienten. Betalte planer må kun
  // aktiveres af Stripe-webhooken i Firebase Functions efter bekræftet betaling.
  // TODO: Flyt endelig produktionsadgang til serverbeskyttede claims, når Stripe
  // går fra test-mode til live.
  const CLIENT_MANAGED_DEMO = false;
  const STORAGE_KEY = "ai_training_membership_v1";
  const POPUP_INTERVAL_DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const PRICING_STRATEGY_VERSION = "1.0";
  const EARLY_ADOPTER_LIMIT = 500;
  const PLAN_LABELS = {
    free: "Gratis version",
    premium_3: "Premium 3 måneder",
    premium_6: "Premium 6 måneder",
    premium_12: "Premium 12 måneder"
  };
  const PRICE_TIERS = Object.freeze({
    early_adopter: Object.freeze({ premium_3: 59, premium_6: 109, premium_12: 199 }),
    standard: Object.freeze({ premium_3: 79, premium_6: 129, premium_12: 249 })
  });
  const PLAN_DETAILS = {
    free: { priceDkk: 0, membershipDurationMonths: null, aiRequestLimit: 3, aiRequestPeriod: "included" },
    premium_3: { priceDkk: 59, membershipDurationMonths: 3, aiRequestLimit: 15, aiRequestPeriod: "monthly" },
    premium_6: { priceDkk: 109, membershipDurationMonths: 6, aiRequestLimit: 15, aiRequestPeriod: "monthly" },
    premium_12: { priceDkk: 199, membershipDurationMonths: 12, aiRequestLimit: 15, aiRequestPeriod: "monthly" }
  };
  const PLAN_ALIASES = {
    quarterly: "premium_3",
    semiannual: "premium_6",
    yearly: "premium_12",
    lifetime: "premium_12",
    trial: "free"
  };
  let pricingContext = {
    strategyVersion: PRICING_STRATEGY_VERSION,
    registeredUserCount: null,
    earlyAdopterLimit: EARLY_ADOPTER_LIMIT,
    activeTier: "early_adopter",
    source: "fallback"
  };
  let activeCheckoutPlan = "";
  let activeCheckoutAttempt = 0;
  let checkoutAttemptSerial = 0;
  let suppressMembershipClickUntil = 0;
  let membershipActivationBound = false;
  let lastMembershipActivation = { plan: "", at: 0 };
  let activeAdminTestPlan = "";
  const stripeCheckoutState = {
    ready: Boolean(window.Work4itStripeCheckout?.createCheckout),
    retryAllowed: false,
    failed: false,
    pendingImport: null
  };

  function isPermanentAdminIdentity(value = {}) {
    return Boolean(window.Work4itAdminConfig?.isPermanentAdminUser?.(value)) ||
      Boolean(window.Work4itAdminConfig?.isCurrentUserAdmin?.());
  };

  function normalizedPricingTier(value) {
    return value === "standard" ? "standard" : "early_adopter";
  }

  function planDetails(plan, tier = pricingContext.activeTier) {
    const base = PLAN_DETAILS[plan] || PLAN_DETAILS.free;
    const stripePlan = window.Work4itStripeConfig?.getPlan?.(plan);
    const tierPrices = PRICE_TIERS[normalizedPricingTier(tier)] || PRICE_TIERS.early_adopter;
    return {
      ...base,
      priceDkk: Number.isFinite(Number(stripePlan?.priceDkk))
        ? Number(stripePlan.priceDkk)
        : Object.prototype.hasOwnProperty.call(tierPrices, plan)
          ? tierPrices[plan]
          : base.priceDkk,
      membershipDurationMonths: Number.isFinite(Number(stripePlan?.membershipDurationMonths))
        ? Number(stripePlan.membershipDurationMonths)
        : base.membershipDurationMonths,
      stripePriceId: stripePlan?.priceId || null
    };
  }

  function iso(date) {
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function parseDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
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

  function nextMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).toISOString();
  }

  function createFreeFallback(now = new Date()) {
    const details = planDetails("free");
    return {
      membershipType: "free",
      membershipStartDate: null,
      membershipEndDate: null,
      isPremium: false,
      membershipStatus: "free",
      selectedPlan: "free",
      priceDkk: details.priceDkk,
      aiRequestLimit: details.aiRequestLimit,
      aiRequestPeriod: details.aiRequestPeriod,
      membershipDurationMonths: details.membershipDurationMonths,
      aiRequestsUsed: 0,
      aiResetDate: null,
      lastRequestTimestamp: null,
      lastMembershipPopupDate: null,
      pricingStrategyVersion: PRICING_STRATEGY_VERSION,
      pricingTierAtPurchase: null,
      priceDkkAtPurchase: null,
      priceLocked: false,
      registeredUserCountAtSelection: null,
      selectedAt: null,
      updatedAt: iso(now),
      source: "free_fallback"
    };
  }

  function normalize(value, now = new Date()) {
    if (!value || typeof value !== "object") return createFreeFallback(now);
    const admin = isPermanentAdminIdentity(value);
    const allowed = ["free", "premium_3", "premium_6", "premium_12"];
    const normalizePlan = plan => {
      const mapped = PLAN_ALIASES[plan] || plan;
      return allowed.includes(mapped) ? mapped : "free";
    };
    const membershipType = admin ? "premium_12" : normalizePlan(value.membershipType);
    const selectedPlan = admin ? "premium_12" : normalizePlan(value.selectedPlan || membershipType);
    const paidPlan = ["premium_3", "premium_6", "premium_12"].includes(selectedPlan);
    const migratedFromRetiredPlan = !admin && (value.membershipType === "lifetime" || value.selectedPlan === "lifetime");
    const storedPrice = Number(value.priceDkkAtPurchase ?? value.priceDkk);
    const hasLockedPrice = paidPlan && Number.isFinite(storedPrice) && storedPrice > 0 && Boolean(value.membershipStartDate || value.priceLocked);
    const purchaseTier = ["standard", "early_adopter"].includes(value.pricingTierAtPurchase)
      ? value.pricingTierAtPurchase
      : null;
    const details = planDetails(selectedPlan, purchaseTier === "standard" ? "standard" : pricingContext.activeTier);
    const startedAt = value.membershipStartDate || value.membershipStartedAt || (migratedFromRetiredPlan ? iso(now) : null);
    const endDate = value.membershipEndDate ||
      value.membershipExpiresAt ||
      (migratedFromRetiredPlan ? iso(addMonths(parseDate(startedAt) || now, details.membershipDurationMonths || 12)) : null);
    const activePaid = paidPlan && (value.membershipStatus === "active" || migratedFromRetiredPlan);
    const normalizedStatus = admin
      ? "active"
      : membershipType === "free"
        ? "free"
        : activePaid
          ? "active"
          : value.membershipStatus === "pending_payment"
            ? "pending_payment"
            : "pending_payment";
    return {
      membershipType,
      role: admin ? "admin" : "",
      isAdmin: admin,
      membershipStartDate: admin ? null : startedAt,
      membershipEndDate: admin ? null : endDate,
      isPremium: admin || activePaid,
      membershipStatus: normalizedStatus,
      selectedPlan,
      priceDkk: hasLockedPrice ? storedPrice : details.priceDkk,
      aiRequestLimit: admin ? -1 : details.aiRequestLimit,
      aiRequests: admin ? -1 : undefined,
      aiRequestPeriod: admin ? "unlimited" : details.aiRequestPeriod,
      membershipDurationMonths: Number.isFinite(Number(value.membershipDurationMonths))
        ? Number(value.membershipDurationMonths)
        : details.membershipDurationMonths,
      aiRequestsUsed: Number.isFinite(Number(value.aiRequestsUsed)) ? Math.max(0, Number(value.aiRequestsUsed)) : 0,
      aiResetDate: value.aiResetDate || null,
      lastRequestTimestamp: value.lastRequestTimestamp || null,
      lastMembershipPopupDate: value.lastMembershipPopupDate || null,
      pricingStrategyVersion: value.pricingStrategyVersion || PRICING_STRATEGY_VERSION,
      pricingTierAtPurchase: purchaseTier,
      priceDkkAtPurchase: hasLockedPrice ? storedPrice : null,
      priceLocked: hasLockedPrice,
      registeredUserCountAtSelection: Number.isFinite(Number(value.registeredUserCountAtSelection))
        ? Number(value.registeredUserCountAtSelection)
        : null,
      selectedAt: value.selectedAt || value.membershipStartDate || null,
      membershipPrice: Number.isFinite(Number(value.membershipPrice)) ? Number(value.membershipPrice) : null,
      membershipStartedAt: value.membershipStartedAt || null,
      membershipExpiresAt: value.membershipExpiresAt || null,
      stripeCustomerId: value.stripeCustomerId || null,
      stripeSessionId: value.stripeSessionId || null,
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
    const paidExpired = ["premium_3", "premium_6", "premium_12"].includes(next.membershipType) && expiry && expiry <= now;

    if (!next.isAdmin && paidExpired) {
      next.membershipType = "free";
      next.selectedPlan = "free";
      next.isPremium = false;
      next.membershipStatus = "free";
      next.membershipStartDate = null;
      next.membershipEndDate = null;
    } else {
      next.isPremium = next.isAdmin || next.membershipStatus === "active";
    }
    return next;
  }

  function getMembership(now = new Date()) {
    const existing = read();
    const adminOverlay = window.Work4itAdminConfig?.isCurrentUserAdmin?.()
      ? window.Work4itAdminConfig.adminMembershipOverlay?.()
      : null;
    const current = evaluate(adminOverlay ? { ...(existing || {}), ...adminOverlay } : (existing || createFreeFallback(now)), now);
    return write(current);
  }

  function daysRemaining(data, now = new Date()) {
    const end = parseDate(data.membershipEndDate);
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
    const premium3 = planDetails("premium_3");
    const premium6 = planDetails("premium_6");
    const premium12 = planDetails("premium_12");
    const values = {
      membershipPriceQuarterly: formatPrice(premium3.priceDkk),
      membershipPriceSemiannual: formatPrice(premium6.priceDkk),
      membershipPriceYearly: formatPrice(premium12.priceDkk),
      membershipPopupPriceQuarterly: `${formatPrice(premium3.priceDkk)} · 15 AI Requests/md.`,
      membershipPopupPriceSemiannual: `${formatPrice(premium6.priceDkk)} · 15 AI Requests/md.`,
      membershipPopupPriceYearly: `${formatPrice(premium12.priceDkk)} · 15 AI Requests/md. · Bedste værdi`
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
    if (!statusName || !statusCopy || !statusDate) return;

    renderPricing();
    renderAdminTestPanel();
    const remaining = daysRemaining(data);
    statusName.textContent = PLAN_LABELS[data.membershipType];

    if (data.isAdmin) {
      statusName.textContent = "Administrator";
      statusCopy.textContent = "Fuld adgang til hele Work4it uden abonnementskontrol.";
      statusDate.textContent = "AI Requests er ubegrænsede. Stripe Checkout er deaktiveret for administratorer.";
      if (navStatus) navStatus.textContent = "Administrator";
    } else if (data.membershipType === "free") {
      statusCopy.textContent = "Gratis medlemskab med 3 AI Requests.";
      statusDate.textContent = "Dine brugerdata slettes aldrig, hvis du bruger gratisversionen.";
      if (navStatus) navStatus.textContent = "Gratis";
    } else if (isPaidPlan(data.membershipType) && data.membershipStatus !== "active") {
      statusName.textContent = "Betaling afventer";
      statusCopy.textContent = "Premium aktiveres først, når Stripe har bekræftet betalingen.";
      statusDate.textContent = "Hvis du har gennemført betaling, opdaterer Work4it automatisk Cloud-status om lidt.";
      if (navStatus) navStatus.textContent = "Afventer";
    } else {
      statusCopy.textContent = `Fuld Premium-adgang med 15 AI Requests pr. måned. Valgt til ${formatPrice(data.priceDkkAtPurchase || data.priceDkk)}.`;
      statusDate.textContent = remaining == null
        ? "Medlemskabet er aktivt."
        : `${remaining} ${remaining === 1 ? "dag" : "dage"} tilbage. Udløber ${formatDate(data.membershipEndDate)}.`;
      if (navStatus) navStatus.textContent = "Premium";
    }

    applyAccessState(data);
    updateActivePlanUi(data);
    updatePaidButtonsState(data);
    bindMembershipActivation();
  }

  function renderAdminTestPanel() {
    const panel = document.getElementById("adminMembershipTestPanel");
    if (!panel) return;
    const isAdmin = window.Work4itAdminConfig?.isCurrentUserAdmin?.() === true;
    panel.hidden = !isAdmin;
    panel.setAttribute("aria-hidden", String(!isAdmin));
    if (!isAdmin) {
      panel.querySelectorAll("[data-admin-test-plan]").forEach(button => {
        button.disabled = true;
      });
      return;
    }
    panel.querySelectorAll("[data-admin-test-plan]").forEach(button => {
      const busy = activeAdminTestPlan === button.dataset.adminTestPlan;
      if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
      button.disabled = Boolean(activeAdminTestPlan);
      button.setAttribute("aria-busy", String(busy));
      button.textContent = busy ? "Starter test..." : button.dataset.defaultText;
    });
  }

  function showAdminTestStatus(message, status = "info") {
    const element = document.getElementById("adminMembershipTestStatus");
    if (!element) return;
    element.textContent = message;
    element.dataset.status = status;
    element.setAttribute("aria-busy", status === "loading" ? "true" : "false");
  }

  async function selectAdminSubscriptionTestPlan(plan) {
    if (window.Work4itAdminConfig?.isCurrentUserAdmin?.() !== true) {
      console.warn("[Work4it Membership] Rejected non-admin subscription test attempt.");
      return false;
    }
    if (!["free", "premium_3", "premium_6", "premium_12"].includes(plan)) {
      showAdminTestStatus("Ugyldig testplan.", "error");
      return false;
    }
    if (activeAdminTestPlan) return false;

    activeAdminTestPlan = plan;
    renderAdminTestPanel();
    showAdminTestStatus(plan === "free"
      ? "Verificerer Gratis-flow og permanent administratoradgang..."
      : "Opretter en normal Stripe Checkout-session i admin-testtilstand...", "loading");
    try {
      await ensureStripeCheckoutReady();
      if (plan === "free") {
        const result = await window.Work4itStripeCheckout.runFreeAdminTest();
        if (result?.status !== "free_admin_test_verified" || result?.permanentAdminRestored !== true) {
          throw new Error("Gratis-testen blev ikke bekræftet af serveren.");
        }
        render(getMembership());
        showAdminTestStatus("Gratis-flow verificeret i Firestore. Permanent administratoradgang er aktiv ✓", "success");
        return true;
      }
      showAdminTestStatus("Åbner Stripe Checkout. Efter betaling verificeres webhook, Firestore og automatisk tilbagevenden til admin.", "loading");
      await window.Work4itStripeCheckout.createCheckout(plan, { adminTestMode: true });
      return true;
    } catch (error) {
      const message = window.Work4itStripeCheckout?.friendlyError?.(error) || error?.message || "Admin-testen kunne ikke startes.";
      showAdminTestStatus(message, "error");
      console.error("[Work4it Membership] Admin subscription test failed", error);
      return false;
    } finally {
      activeAdminTestPlan = "";
      renderAdminTestPanel();
    }
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

  function isPaidPlan(plan) {
    return ["premium_3", "premium_6", "premium_12"].includes(plan);
  }

  function setStripeCheckoutReady(ready = true) {
    stripeCheckoutState.ready = Boolean(ready && window.Work4itStripeCheckout?.createCheckout);
    stripeCheckoutState.failed = false;
    stripeCheckoutState.pendingImport = null;
    updatePaidButtonsState();
  }

  function updatePaidButtonsState(data = getMembership()) {
    document.querySelectorAll("[data-membership-select]").forEach(button => {
      const plan = button.dataset.membershipSelect;
      if (!isPaidPlan(plan)) return;
      if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
      const activePlan = data.membershipStatus === "active" ? data.selectedPlan || data.membershipType : "";
      const isActive = activePlan === plan || button.getAttribute("aria-pressed") === "true";
      if (isActive) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = "Aktiv plan";
        return;
      }
      if (stripeCheckoutState.ready) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = button.dataset.defaultText;
        return;
      }
      if (stripeCheckoutState.retryAllowed || stripeCheckoutState.failed) {
        button.disabled = false;
        button.setAttribute("aria-busy", "false");
        button.textContent = stripeCheckoutState.failed ? "Prøv betaling igen" : button.dataset.defaultText;
        return;
      }
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = button.dataset.defaultText;
    });
  }

  async function ensureStripeCheckoutReady() {
    if (window.Work4itStripeCheckout?.createCheckout) {
      setStripeCheckoutReady(true);
      return true;
    }
    if (stripeCheckoutState.pendingImport) return stripeCheckoutState.pendingImport;
    stripeCheckoutState.failed = false;
    stripeCheckoutState.retryAllowed = true;
    updatePaidButtonsState();
    showConfirmation("Indlæser sikker betaling...");
    stripeCheckoutState.pendingImport = import(`./stripe-checkout.js?v=20260713-admin-subscription-test1&retry=${Date.now()}`)
      .then(() => {
        if (!window.Work4itStripeCheckout?.createCheckout) {
          throw new Error("Stripe Checkout blev indlæst, men blev ikke klar.");
        }
        setStripeCheckoutReady(true);
        return true;
      })
      .catch(error => {
        stripeCheckoutState.ready = false;
        stripeCheckoutState.failed = true;
        stripeCheckoutState.pendingImport = null;
        updatePaidButtonsState();
        throw error;
      });
    return stripeCheckoutState.pendingImport;
  }

  async function startStripeCheckout(plan) {
    if (getMembership().isAdmin) {
      showConfirmation("Administrator har allerede fuld adgang. Stripe Checkout er deaktiveret.");
      return;
    }
    if (!isPaidPlan(plan)) {
      console.warn("[Work4it Membership] Stripe checkout ignored for non-paid plan", { plan });
      return selectPlan("free");
    }

    const button = document.querySelector(`[data-membership-select="${plan}"]`);
    const defaultText = button?.dataset.defaultText || button?.textContent || "";
    if (activeCheckoutPlan) {
      showConfirmation("Stripe Checkout åbner allerede. Vent et øjeblik...");
      return;
    }

    const attempt = ++checkoutAttemptSerial;
    activeCheckoutAttempt = attempt;

    try {
      activeCheckoutPlan = plan;
      const stripePlan = window.Work4itStripeConfig?.getPlan?.(plan);
      console.log("[Work4it Stripe] Starter checkout", {
        plan,
        priceId: stripePlan?.priceId || null,
        origin: window.location.origin
      });
      if (button) {
        button.disabled = true;
        button.textContent = "Åbner sikker betaling...";
      }
      await ensureStripeCheckoutReady();
      if (activeCheckoutAttempt !== attempt || activeCheckoutPlan !== plan) {
        console.info("[Work4it Stripe] Checkout attempt cancelled before redirect", { plan, attempt });
        return;
      }
      showConfirmation("Åbner sikker Stripe-betaling...");
      await window.Work4itStripeCheckout.createCheckout(plan);
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = defaultText || `Vælg ${PLAN_LABELS[plan]}`;
      }
      if (activeCheckoutAttempt === attempt && activeCheckoutPlan === plan) {
        const message = window.Work4itStripeCheckout?.friendlyError?.(error) || error?.message || "Stripe Checkout kunne ikke startes.";
        showConfirmation(message);
      } else {
        console.info("[Work4it Stripe] Ignored stale checkout error", { plan, attempt, error });
      }
      console.error("[Work4it Stripe] Checkout failed", error);
    } finally {
      if (activeCheckoutAttempt === attempt) {
        activeCheckoutPlan = "";
        activeCheckoutAttempt = 0;
      }
    }
  }

  function appendConfirmation(message) {
    const element = document.getElementById("membershipConfirmation");
    if (!element) return;
    const current = element.textContent ? `${element.textContent} ` : "";
    element.textContent = `${current}${message}`;
    element.classList.add("show");
  }

  function updateActivePlanUi(data = getMembership()) {
    const activePlan = data.isAdmin
      ? ""
      : data.membershipStatus === "active" || data.membershipType === "free"
      ? data.selectedPlan || data.membershipType || "free"
      : "free";
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

  function closestMembershipTrigger(event) {
    const target = event.target;
    if (!target?.closest) return null;
    const trigger = target.closest("[data-membership-select], [data-membership-plan]");
    if (!trigger) return null;
    if (trigger.matches("[data-membership-plan]") && target.closest("button,a,input,select,textarea") && !target.closest("[data-membership-select]")) {
      return null;
    }
    return trigger;
  }

  function planFromTrigger(trigger) {
    return trigger?.dataset?.membershipSelect || trigger?.dataset?.membershipPlan || "";
  }

  function activateMembershipFromEvent(event) {
    const trigger = closestMembershipTrigger(event);
    const plan = planFromTrigger(trigger);
    if (!plan) return;

    const now = Date.now();
    const isPointerMouse = event.type === "pointerup" && event.pointerType === "mouse";
    if (isPointerMouse) return;

    if (event.type === "click" && now < suppressMembershipClickUntil) {
      event.preventDefault?.();
      event.stopPropagation?.();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      return;
    }

    if (event.type === "pointerup" || event.type === "touchend") {
      suppressMembershipClickUntil = now + 950;
    }

    if (now - lastMembershipActivation.at < 700) {
      event.preventDefault?.();
      event.stopPropagation?.();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      return;
    }

    lastMembershipActivation = { plan, at: now };
    event.preventDefault?.();
    event.stopPropagation?.();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    if (trigger.tagName === "BUTTON" && trigger.disabled) {
      trigger.disabled = false;
    }
    if (isPaidPlan(plan)) {
      showConfirmation("Forbereder sikker betaling...");
    }
    selectPlan(plan);
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

  function bindMembershipElement(element) {
    if (!element || element.dataset.membershipBound === "true") return;
    element.dataset.membershipBound = "true";
    element.addEventListener("pointerup", activateMembershipFromEvent, { capture: true });
    element.addEventListener("touchend", activateMembershipFromEvent, { capture: true, passive: false });
    element.addEventListener("click", activateMembershipFromEvent, { capture: true });
  }

  function bindMembershipActivation() {
    if (!membershipActivationBound) {
      membershipActivationBound = true;
      console.info("[Work4it Membership] Using direct plan bindings for membership selection.");
    }
    document.querySelectorAll("[data-membership-select], [data-membership-plan]").forEach(bindMembershipElement);
    document.querySelectorAll("[data-membership-plan]").forEach(card => {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      if (card.dataset.membershipKeyBound === "true") return;
      card.dataset.membershipKeyBound = "true";
      card.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        const plan = card.dataset.membershipPlan;
        if (plan) selectPlan(plan);
      });
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
    const requestedPlan = PLAN_ALIASES[plan] || plan;
    const current = getMembership(now);
    if (current.isAdmin) {
      showConfirmation("Administrator har allerede fuld adgang. Stripe Checkout er deaktiveret.");
      return current;
    }
    plan = requestedPlan;
    if (isPaidPlan(plan)) {
      const activePlan = current.membershipStatus === "active" ? current.selectedPlan || current.membershipType : "";
      if (activePlan === plan) {
        showConfirmation(`${PLAN_LABELS[plan]} er allerede aktiv.`);
        return current;
      }
      startStripeCheckout(plan);
      return getMembership(now);
    }

    if (plan === "free") {
      activeCheckoutPlan = "";
      activeCheckoutAttempt = 0;
    }
    const details = planDetails(plan);
    const next = {
      ...current,
      selectedPlan: plan,
      priceDkk: details.priceDkk,
      aiRequestLimit: details.aiRequestLimit,
      aiRequestPeriod: details.aiRequestPeriod,
      membershipDurationMonths: details.membershipDurationMonths,
      pricingStrategyVersion: PRICING_STRATEGY_VERSION,
      updatedAt: iso(now)
    };

    if (plan === "free") {
      next.membershipType = "free";
      next.membershipStatus = "free";
      next.isPremium = false;
      next.membershipStartDate = null;
      next.membershipEndDate = null;
      next.membershipDurationMonths = null;
      next.aiRequestsUsed = Math.min(Number(current.aiRequestsUsed) || 0, details.aiRequestLimit);
      next.aiResetDate = null;
      next.lastMembershipPopupDate = iso(now);
      next.pricingTierAtPurchase = null;
      next.priceDkkAtPurchase = null;
      next.priceLocked = false;
      next.registeredUserCountAtSelection = null;
      next.selectedAt = iso(now);
    }

    const saved = write(next);
    closePopup();
    render(saved);
    showConfirmation(plan === "free"
      ? "Gratisversionen er valgt. Alle dine eksisterende data er bevaret."
      : `${PLAN_LABELS[plan]} kræver sikker betaling via Stripe.`);
    window.dispatchEvent(new CustomEvent("membership:changed", { detail: saved }));
    return saved;
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
    POPUP_INTERVAL_DAYS,
    PLAN_DETAILS,
    PRICE_TIERS,
    PRICING_STRATEGY_VERSION,
    EARLY_ADOPTER_LIMIT,
    getPricingContext: () => ({ ...pricingContext }),
    getPlanDetails: planDetails,
    createFreeFallback,
    normalize,
    evaluate,
    getMembership,
    daysRemaining,
    popupIsDue,
    selectPlan,
    startStripeCheckout,
    render,
    initialize,
    requireFeature,
    openView,
    closeView,
    showPopup,
    showConfirmation,
    showAdminTestStatus
  };
  window.openMembershipView = openView;
  window.closeMembershipView = closeView;
  window.selectMembershipPlan = selectPlan;
  window.selectAdminSubscriptionTestPlan = selectAdminSubscriptionTestPlan;
  window.openPremiumFeature = requireFeature;

  window.addEventListener("training-app:ready", initialize, { once: true });
  window.addEventListener("work4it:pricing-config", event => updatePricingContext(event.detail));
  window.addEventListener("work4it:stripe-checkout-ready", () => {
    setStripeCheckoutReady(true);
    render(getMembership());
  });
  window.addEventListener("work4it:stripe-checkout-error", event => {
    stripeCheckoutState.ready = false;
    stripeCheckoutState.failed = true;
    stripeCheckoutState.pendingImport = null;
    updatePaidButtonsState();
    appendConfirmation(event.detail?.message || "Sikker betaling kunne ikke indlæses. Prøv igen.");
  });
  window.addEventListener("membership:cloud-saving", () => appendConfirmation("Gemmer i Cloud..."));
  window.addEventListener("membership:cloud-saved", () => {
    render(getMembership());
    appendConfirmation("Gemt i Cloud ☁️");
  });
  window.addEventListener("membership:cloud-failed", () => {
    render(getMembership());
    appendConfirmation("Gemt lokalt – Cloud ikke tilgængelig.");
  });
  window.addEventListener("membership:changed", event => render(event.detail || getMembership()));
  window.addEventListener("firestore:data-hydrated", () => render(getMembership()));
  window.addEventListener("firestore:sync-completed", () => render(getMembership()));
  window.addEventListener("firestore:user-cache-cleared", () => render(createFreeFallback()));
  window.addEventListener("firestore:user-ready", showStartupPopupWhenFree);
  window.addEventListener("workit:window-closed", showStartupPopupWhenFree);
  window.setTimeout(() => {
    if (window.Work4itStripeCheckout?.createCheckout) {
      setStripeCheckoutReady(true);
      return;
    }
    stripeCheckoutState.retryAllowed = true;
    updatePaidButtonsState();
  }, 2500);
}());
