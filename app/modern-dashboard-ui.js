(function modernDashboardUiModule() {
  "use strict";

  const STORAGE_KEY = "work4it_ui_layout";
  const DEFAULT_LAYOUT = "classic";
  const LAYOUTS = Object.freeze({
    classic: { id: "classic", label: "Classic UI" },
    modern: { id: "modern", label: "Modern Dashboard UI" }
  });

  const CATEGORIES = Object.freeze({
    user: {
      label: "Bruger",
      icon: "👤",
      actions: [
        { id: "profile", icon: "👤", label: "Profil", description: "Personlige oplysninger og konto.", handler: "openProfileSetup", cta: "Åbn profil" },
        { id: "training-profile", icon: "🎯", label: "Træningsprofil", description: "Mål, niveau, udstyr og træningssted.", handler: "openProfileWizardFromMenu", cta: "Tilpas profil" },
        { id: "membership", icon: "💎", label: "Medlemskab", description: "Se adgang, AI Requests og abonnement.", handler: "openMembershipView", cta: "Se medlemskab" },
        { id: "settings", icon: "⚙️", label: "Indstillinger", description: "Tema, layout, auto-pause og appvalg.", handler: "openModernSettings", cta: "Åbn indstillinger" }
      ]
    },
    training: {
      label: "Træning",
      icon: "🏋️",
      actions: [
        { id: "today", icon: "▶", label: "Dagens træning", description: "Dit vigtigste næste skridt.", contextual: true, cta: "Åbn" },
        { id: "create", icon: "＋", label: "Nyt program", description: "Opret selv, importér eller brug AI.", handler: "openCreateOrImportWorkout", cta: "Opret program" },
        { id: "saved", icon: "📂", label: "Mine programmer", description: "Find og redigér gemte træningspas.", handler: "openSavedProgramsFromDashboard", cta: "Se programmer" },
        { id: "active", icon: "⏱", label: "Aktiv træning", description: "Fortsæt en igangværende eller pauset træning.", handler: "continueDashboardWorkout", cta: "Fortsæt træning", activeOnly: true },
        { id: "history", icon: "📜", label: "Historik", description: "Se afsluttede træninger og heatmap.", handler: "openDashboard", cta: "Se historik" },
        { id: "progress", icon: "📈", label: "Min udvikling", description: "Følg styrke, kropsmål og progression.", handler: "openModernProgress", cta: "Se udvikling" },
        { id: "calories", icon: "🔥", label: "Kalorier", description: "Se og tilpas kalorieestimatet.", handler: "openCalorieView", cta: "Se estimat" },
        { id: "ai-coach", icon: "✨", label: "AI Coach", description: "Tilpas program og profil med Work4it Coach.", handler: "openAiCoach", cta: "Åbn AI Coach" },
        { id: "import", icon: "📷", label: "Importér", description: "Opret et program ud fra et screenshot.", handler: "openScreenshotImportInfo", cta: "Importér screenshot" }
      ]
    },
    more: {
      label: "Mere",
      icon: "•••",
      actions: [
        { id: "trash", icon: "🗑", label: "Papirkurv", description: "Gendan eller fjern slettede programmer.", handler: "openModernTrash", cta: "Åbn papirkurv" },
        { id: "export", icon: "↗", label: "Eksportér data", description: "Hent en kopi af dine Work4it-data.", handler: "exportDataFromMenu", cta: "Eksportér" },
        { id: "feedback", icon: "📝", label: "Feedback", description: "Send fejl, forslag eller forbedringsønsker.", href: "https://docs.google.com/forms/d/e/1FAIpQLScIi1YE2x3pzRQI7dmztC3kWgjysDFkcUfKJtZXcOzAeIV7Tg/viewform", cta: "Send feedback" },
        { id: "help", icon: "?", label: "Hjælp", description: "Få hjælp og læs om Work4it.", handler: "openHelpAboutDialog", cta: "Åbn hjælp" },
        { id: "privacy", icon: "🔒", label: "Privatliv", description: "Privatliv og GDPR på Work-4it.dk.", href: "https://work-4it.dk/", cta: "Læs mere" },
        { id: "logout", icon: "↪", label: "Log ud", description: "Afslut den aktive Work4it-session.", handler: "logoutProfileAccount", cta: "Log ud" }
      ]
    }
  });

  let activeCategory = "training";
  let activeAction = "today";
  let dashboardObserver = null;

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function normalizeLayout(value) {
    const key = String(value || "").trim().toLowerCase();
    return LAYOUTS[key] ? key : DEFAULT_LAYOUT;
  }

  function readStoredLayout() {
    try {
      return normalizeLayout(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return DEFAULT_LAYOUT;
    }
  }

  function writeStoredLayout(layout) {
    try {
      localStorage.setItem(STORAGE_KEY, normalizeLayout(layout));
    } catch (_) {}
  }

  function currentActions() {
    return CATEGORIES[activeCategory]?.actions || CATEGORIES.training.actions;
  }

  function selectedAction() {
    return currentActions().find(action => action.id === activeAction) || currentActions()[0];
  }

  function isVisible(element) {
    return Boolean(element && !element.hidden);
  }

  function dashboardWorkoutState() {
    const loading = isVisible(byId("homeDashboardLoading")) && !isVisible(byId("homeDashboardContent"));
    const active = isVisible(byId("homeActiveSection"));
    const featured = isVisible(byId("homeWorkoutSection"));
    const empty = isVisible(byId("homeEmptyState"));
    if (loading) {
      return {
        title: "Forbereder dit dashboard",
        description: "Henter dine træningsdata og aktive session.",
        meta: "Synkroniserer…",
        cta: "Indlæser…",
        handler: "openCreateOrImportWorkout",
        disabled: true
      };
    }
    if (active) {
      return {
        title: byId("homeActiveName")?.textContent?.trim() || "Aktiv træning",
        description: "Din træning er klar til at blive fortsat.",
        meta: byId("homeActiveMetrics")?.textContent?.trim() || byId("homeActiveStatus")?.textContent?.trim() || "Aktiv",
        cta: "Fortsæt træning",
        handler: "continueDashboardWorkout",
        disabled: Boolean(byId("homeResumeWorkoutButton")?.disabled)
      };
    }
    if (featured) {
      return {
        title: byId("homeCurrentProgramName")?.textContent?.trim() || "Næste træning",
        description: byId("homeCurrentProgramHeading")?.textContent?.trim() || "Dit næste program er klar.",
        meta: byId("homeCurrentProgramMeta")?.textContent?.trim() || "",
        cta: "Start træning",
        handler: "startDashboardWorkout",
        disabled: Boolean(byId("timerBtn")?.disabled)
      };
    }
    return {
      title: empty ? "Kom i gang med din første træning" : "Dagens træning",
      description: "Opret eller importér et træningspas for at komme i gang.",
      meta: "",
      cta: "Opret træningspas",
      handler: "openCreateOrImportWorkout",
      disabled: false
    };
  }

  function actionState(action) {
    if (action.contextual) return { ...action, ...dashboardWorkoutState() };
    if (action.activeOnly) {
      const active = isVisible(byId("homeActiveSection"));
      return {
        ...action,
        title: active ? (byId("homeActiveName")?.textContent?.trim() || action.label) : action.label,
        meta: active ? (byId("homeActiveMetrics")?.textContent?.trim() || "Aktiv") : "Ingen aktiv træning",
        disabled: !active || Boolean(byId("homeResumeWorkoutButton")?.disabled)
      };
    }
    const state = { ...action, title: action.label, disabled: false };
    if (action.id === "saved") {
      const count = [...(byId("savedSelect")?.options || [])].filter(option => option.value).length;
      state.meta = count ? `${count} gemte ${count === 1 ? "program" : "programmer"}` : "Ingen gemte programmer endnu";
    }
    if (action.id === "membership") state.meta = byId("membershipNavStatus")?.textContent?.trim() || "Se status";
    return state;
  }

  function renderRail() {
    const rail = byId("modernIconRail");
    if (!rail) return;
    rail.setAttribute("aria-label", `${CATEGORIES[activeCategory].label}: funktioner`);
    rail.innerHTML = currentActions().map(action => `
      <button class="modern-icon-tab" type="button" role="tab" data-modern-action="${escapeHtml(action.id)}"
        aria-selected="${String(action.id === activeAction)}" aria-controls="modernFeaturePanel">
        <span class="modern-icon" aria-hidden="true">${escapeHtml(action.icon)}</span>
        <span>${escapeHtml(action.label)}</span>
      </button>`).join("");
  }

  function renderFeature() {
    const panel = byId("modernFeaturePanel");
    if (!panel) return;
    const action = actionState(selectedAction());
    panel.dataset.icon = action.icon;
    panel.innerHTML = `
      <div class="modern-feature-copy">
        <span class="modern-feature-eyebrow">${escapeHtml(CATEGORIES[activeCategory].label)}</span>
        <h2 class="modern-feature-title">${escapeHtml(action.title || action.label)}</h2>
        <p class="modern-feature-description">${escapeHtml(action.description)}</p>
        ${action.meta ? `<div class="modern-feature-meta">${escapeHtml(action.meta)}</div>` : ""}
      </div>
      <button class="modern-feature-open" type="button" data-modern-open="${escapeHtml(action.id)}"
        ${action.disabled ? "disabled aria-disabled=\"true\"" : "aria-disabled=\"false\""}>${escapeHtml(action.cta || "Åbn")}</button>`;
  }

  function renderCards() {
    const grid = byId("modernCardGrid");
    if (!grid) return;
    grid.innerHTML = currentActions().map(action => {
      const state = actionState(action);
      return `<button class="modern-mini-card" type="button" data-modern-open="${escapeHtml(action.id)}"
        aria-pressed="${String(action.id === activeAction)}" ${state.disabled ? "disabled aria-disabled=\"true\"" : "aria-disabled=\"false\""}>
        <span class="modern-icon" aria-hidden="true">${escapeHtml(action.icon)}</span>
        <span><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(state.meta || action.description)}</span></span>
      </button>`;
    }).join("");
  }

  function renderBottomNavigation() {
    document.querySelectorAll("[data-modern-category]").forEach(button => {
      const active = button.dataset.modernCategory === activeCategory;
      button.setAttribute("aria-current", active ? "page" : "false");
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function render() {
    if (readStoredLayout() !== "modern") return;
    const shell = byId("modernDashboardUI");
    const bottom = byId("modernBottomNav");
    if (!shell || !bottom) return;
    shell.hidden = false;
    bottom.hidden = false;
    const greeting = byId("homeWelcomeTitle")?.textContent?.trim() || "Velkommen tilbage";
    const title = byId("modernDashboardTitle");
    if (title) title.textContent = greeting;
    renderRail();
    renderFeature();
    renderCards();
    renderBottomNavigation();
  }

  function selectAction(actionId) {
    if (!currentActions().some(action => action.id === actionId)) return false;
    activeAction = actionId;
    render();
    byId("modernFeaturePanel")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    return true;
  }

  function setCategory(category) {
    if (!CATEGORIES[category]) return false;
    activeCategory = category;
    activeAction = CATEGORIES[category].actions[0].id;
    render();
    byId("modernDashboardUI")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    return true;
  }

  function invokeHandler(name) {
    const handler = window[name];
    if (typeof handler !== "function") {
      console.warn(`[Work4it Modern UI] Handleren ${name} er ikke tilgængelig.`);
      return false;
    }
    handler();
    return true;
  }

  function invokeAction(actionId) {
    const action = currentActions().find(item => item.id === actionId);
    if (!action) return false;
    const state = actionState(action);
    if (state.disabled) return false;
    if (state.href) {
      window.open(state.href, "_blank", "noopener,noreferrer");
      return true;
    }
    return invokeHandler(state.handler);
  }

  function openModernSettings() {
    if (!invokeHandler("openProfileSetup")) return false;
    window.setTimeout(() => byId("themeSettingsSection")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 80);
    return true;
  }

  function openModernProgress() {
    if (typeof window.openPremiumFeature === "function" && typeof window.openProgressView === "function") {
      window.openPremiumFeature("progress", window.openProgressView);
      return true;
    }
    return invokeHandler("openProgressView");
  }

  function openModernTrash() {
    if (typeof window.toggleSidebar === "function") window.toggleSidebar(true);
    window.setTimeout(() => {
      const more = document.querySelector('[data-accordion="more"]');
      if (more && !more.classList.contains("open")) window.toggleSidebarAccordion?.("more");
      window.toggleTrashDropdown?.();
    }, 0);
    return true;
  }

  function applyLayout(layout) {
    const next = normalizeLayout(layout);
    document.documentElement.dataset.uiLayout = next;
    if (document.body) document.body.dataset.uiLayout = next;
    const shell = byId("modernDashboardUI");
    const bottom = byId("modernBottomNav");
    if (shell) shell.hidden = next !== "modern";
    if (bottom) bottom.hidden = next !== "modern";
    if (next === "modern") {
      window.toggleSidebar?.(false);
      render();
    }
    return next;
  }

  function setLayout(layout, options = {}) {
    const next = normalizeLayout(layout);
    if (!options.skipStorage) writeStoredLayout(next);
    applyLayout(next);
    if (!options.silent) {
      window.dispatchEvent(new CustomEvent("work4it:layout-changed", {
        detail: { layout: next, source: options.source || "user" }
      }));
    }
    return next;
  }

  function bindNavigation() {
    const dashboard = byId("modernDashboardUI");
    dashboard?.addEventListener("click", event => {
      const open = event.target.closest?.("[data-modern-open]");
      if (open) return void invokeAction(open.dataset.modernOpen);
      const action = event.target.closest?.("[data-modern-action]");
      if (action) selectAction(action.dataset.modernAction);
    });
    dashboard?.addEventListener("keydown", event => {
      const tab = event.target.closest?.(".modern-icon-tab");
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tabs = [...byId("modernIconRail")?.querySelectorAll?.(".modern-icon-tab") || []];
      if (!tabs.length) return;
      event.preventDefault();
      const current = Math.max(0, tabs.indexOf(tab));
      const next = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      selectAction(tabs[next].dataset.modernAction);
    });
    byId("modernBottomNav")?.addEventListener("click", event => {
      const category = event.target.closest?.("[data-modern-category]");
      if (category) setCategory(category.dataset.modernCategory);
    });
  }

  function observeDashboard() {
    const dashboard = byId("homeDashboard");
    if (!dashboard || typeof MutationObserver !== "function") return;
    dashboardObserver?.disconnect?.();
    dashboardObserver = new MutationObserver(() => {
      if (readStoredLayout() === "modern") render();
    });
    dashboardObserver.observe(dashboard, { childList: true, subtree: true, attributes: true, characterData: true });
  }

  function initialize() {
    bindNavigation();
    observeDashboard();
    applyLayout(readStoredLayout());
  }

  window.openModernSettings = openModernSettings;
  window.openModernProgress = openModernProgress;
  window.openModernTrash = openModernTrash;
  window.Work4itModernDashboard = Object.freeze({
    STORAGE_KEY,
    DEFAULT_LAYOUT,
    LAYOUTS,
    CATEGORIES,
    normalizeLayout,
    getLayout: readStoredLayout,
    setLayout,
    applyLayout,
    setCategory,
    selectAction,
    invokeAction,
    render
  });

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) applyLayout(event.newValue || DEFAULT_LAYOUT);
  });
  ["firestore:data-hydrated", "firestore:sync-completed", "training-profile:updated", "firebase-auth:changed"]
    .forEach(eventName => window.addEventListener(eventName, render));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
}());
