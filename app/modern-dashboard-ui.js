(function modernDashboardUiModule() {
  "use strict";

  const CATEGORIES = Object.freeze({
    user: {
      label: "Bruger",
      actions: [
        { id: "profile", icon: "👤", label: "Profil og konto", description: "Personlige oplysninger, konto og sikkerhed.", handler: "openProfileSetup", cta: "Åbn profil" },
        { id: "training-profile", icon: "🎯", label: "Træningsprofil", description: "Mål, niveau, udstyr og træningssted.", handler: "openProfileWizardFromMenu", cta: "Tilpas profil" },
        { id: "membership", icon: "◆", label: "Medlemskab", description: "Adgang, AI Requests og abonnement.", handler: "openMembershipView", cta: "Se medlemskab" },
        { id: "ai-coach", icon: "✦", label: "AI Coach", description: "Tilpas program og profil med Work4it Coach.", handler: "openAiCoach", cta: "Åbn AI Coach" },
        { id: "settings", icon: "⚙", label: "Indstillinger", description: "Tema, auto-pause og appindstillinger.", handler: "openModernSettings", cta: "Åbn indstillinger" }
      ]
    },
    training: {
      label: "Træning",
      actions: [
        { id: "today", icon: "▶", label: "Dagens træning", description: "Dit vigtigste næste skridt.", contextual: true, cta: "Åbn" },
        { id: "generator", icon: "✦", label: "AI-træningsplan", description: "Opret en måltilpasset træningsplan.", handler: "openModernProgramGenerator", cta: "Opret med AI" },
        { id: "blank", icon: "＋", label: "Tomt træningspas", description: "Byg selv et styrke-, cardio- eller calisthenics-pas.", handler: "openBlankWorkoutDialog", cta: "Opret træningspas" },
        { id: "saved", icon: "▣", label: "Mine programmer", description: "Find og redigér gemte træningspas.", handler: "openModernSavedPrograms", cta: "Se programmer" },
        { id: "active", icon: "◷", label: "Aktiv træning", description: "Fortsæt en igangværende eller pauset træning.", handler: "continueDashboardWorkout", cta: "Fortsæt træning", activeOnly: true },
        { id: "import", icon: "▧", label: "Importér screenshot", description: "Opret et program ud fra et billede.", handler: "openScreenshotImportInfo", cta: "Importér" },
        { id: "history", icon: "↺", label: "Historik og dashboard", description: "Se afsluttede træninger, statistik og heatmap.", handler: "openDashboard", cta: "Se historik" },
        { id: "progress", icon: "↗", label: "Min udvikling", description: "Følg rekorder, styrke, kropsmål og progression.", handler: "openModernProgress", cta: "Se udvikling" },
        { id: "calories", icon: "◉", label: "Kalorie-estimat", description: "Se beregning og træningsintensitet.", handler: "openCalorieView", cta: "Se estimat" }
      ]
    },
    more: {
      label: "Mere",
      actions: [
        { id: "trash", icon: "⌫", label: "Papirkurv", description: "Gendan eller fjern slettede programmer.", handler: "openModernTrash", cta: "Åbn papirkurv" },
        { id: "export", icon: "⇧", label: "Eksportér data", description: "Hent en kopi af dine Work4it-data.", handler: "exportDataFromMenu", cta: "Eksportér" },
        { id: "help", icon: "?", label: "Hjælp og om appen", description: "Få hjælp og læs om Work4it.", handler: "openHelpAboutDialog", cta: "Åbn hjælp" },
        { id: "privacy", icon: "▢", label: "Privatliv og GDPR", description: "Læs Work4its privatlivsinformation.", href: "https://work-4it.dk/", cta: "Læs mere" },
        { id: "feedback", icon: "✎", label: "Feedback", description: "Send fejl, forslag eller forbedringsønsker.", href: "https://docs.google.com/forms/d/e/1FAIpQLScIi1YE2x3pzRQI7dmztC3kWgjysDFkcUfKJtZXcOzAeIV7Tg/viewform", cta: "Send feedback" },
        { id: "logout", icon: "↪", label: "Log ud", description: "Afslut den aktive Work4it-session.", handler: "logoutProfileAccount", cta: "Log ud", destructive: true }
      ]
    }
  });

  let activeCategory = "training";
  let activeAction = "today";

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function snapshot() {
    return window.Work4itDashboardRuntime?.getSnapshot?.() || { loading: true, view: null, programs: [] };
  }

  function currentActions() {
    return CATEGORIES[activeCategory]?.actions || CATEGORIES.training.actions;
  }

  function selectedAction() {
    return currentActions().find(action => action.id === activeAction) || currentActions()[0];
  }

  function workoutMeta(workout) {
    if (!workout) return "";
    const meta = [];
    if (workout.exerciseCount) meta.push(`${workout.exerciseCount} ${workout.exerciseCount === 1 ? "øvelse" : "øvelser"}`);
    if (workout.estimatedMinutes) meta.push(`cirka ${workout.estimatedMinutes} min.`);
    if (workout.dayCount > 1) meta.push(`${workout.dayCount} træningsdage`);
    return meta.join(" · ");
  }

  function dashboardWorkoutState() {
    const state = snapshot();
    if (state.loading || !state.view) return {
      title: "Forbereder dit dashboard",
      description: "Henter dine træningsdata og aktive session.",
      meta: "Synkroniserer…", cta: "Indlæser…", disabled: true
    };
    if (state.view.activeWorkout) {
      const workout = state.view.activeWorkout;
      const meta = [];
      if (workout.totalSets > 0) meta.push(`${workout.completedSets} af ${workout.totalSets} sæt`);
      if (workout.status) meta.push(workout.status);
      return { title: workout.title || "Aktiv træning", description: "Din træning er klar til at blive fortsat.", meta: meta.join(" · "), cta: "Fortsæt træning", handler: "continueDashboardWorkout", disabled: false };
    }
    if (state.view.featuredWorkout) {
      const workout = state.view.featuredWorkout;
      return {
        title: workout.title || "Næste træning",
        description: workout.heading || "Dit næste program er klar.",
        meta: workoutMeta(workout),
        cta: "Start træning",
        handler: "startDashboardWorkout",
        disabled: window.Work4itDashboardRuntime?.canStartProgram?.(workout.id) === false
      };
    }
    return { title: "Kom i gang med din første træning", description: "Opret med AI, byg selv eller importér et screenshot.", meta: "", cta: "Opret med AI", handler: "openModernProgramGenerator", disabled: false };
  }

  function actionState(action) {
    if (action.contextual) return { ...action, ...dashboardWorkoutState() };
    const state = { ...action, title: action.label, disabled: false };
    const data = snapshot();
    if (action.activeOnly) {
      const active = data.view?.activeWorkout;
      state.title = active?.title || action.label;
      state.meta = active ? active.status || "Aktiv" : "Ingen aktiv træning";
      state.disabled = !active;
    }
    if (action.id === "saved") {
      const count = data.programs?.length || 0;
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
      <button class="modern-icon-tab" id="modern-tab-${escapeHtml(action.id)}" type="button" role="tab"
        data-modern-action="${escapeHtml(action.id)}" tabindex="${action.id === activeAction ? "0" : "-1"}"
        aria-selected="${String(action.id === activeAction)}" aria-controls="modernFeaturePanel">
        <span class="modern-icon" aria-hidden="true">${escapeHtml(action.icon)}</span><span>${escapeHtml(action.label)}</span>
      </button>`).join("");
  }

  function renderFeature() {
    const panel = byId("modernFeaturePanel");
    if (!panel) return;
    const action = actionState(selectedAction());
    panel.dataset.icon = action.icon || "";
    panel.setAttribute("aria-labelledby", `modern-tab-${action.id}`);
    panel.innerHTML = `
      <div class="modern-feature-copy">
        <span class="modern-feature-eyebrow">${escapeHtml(CATEGORIES[activeCategory].label)}</span>
        <h2 class="modern-feature-title">${escapeHtml(action.title || action.label)}</h2>
        <p class="modern-feature-description">${escapeHtml(action.description || "")}</p>
        ${action.meta ? `<div class="modern-feature-meta">${escapeHtml(action.meta)}</div>` : ""}
      </div>
      <button class="modern-feature-open${action.destructive ? " destructive" : ""}" type="button"
        data-modern-open="${escapeHtml(action.id)}" ${action.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>${escapeHtml(action.cta || "Åbn")}</button>`;
  }

  function renderCards() {
    const grid = byId("modernCardGrid");
    if (!grid) return;
    grid.innerHTML = currentActions().map(action => {
      const state = actionState(action);
      return `<button class="modern-mini-card${action.destructive ? " destructive" : ""}" type="button"
        data-modern-open="${escapeHtml(action.id)}" ${state.disabled ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>
        <span class="modern-icon" aria-hidden="true">${escapeHtml(action.icon)}</span>
        <span><strong>${escapeHtml(action.label)}</strong><small>${escapeHtml(state.meta || action.description)}</small></span>
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
    const shell = byId("modernDashboardUI");
    if (!shell) return;
    const data = snapshot();
    const title = byId("modernDashboardTitle");
    if (title) title.textContent = data.view?.greeting || "Velkommen tilbage";
    renderRail();
    renderFeature();
    renderCards();
    renderBottomNavigation();
  }

  function closeToolPanel() {
    const panel = byId("modernToolPanel");
    if (panel) panel.hidden = true;
    ["programGeneratorAccess", "savedDropdown", "trashDropdown"].forEach(id => {
      const item = byId(id);
      if (item) item.hidden = true;
    });
    window.WorkitMenuManager?.closePanel?.("count-picker");
  }

  function openToolPanel(kind, title) {
    closeToolPanel();
    const panel = byId("modernToolPanel");
    const content = byId(kind);
    if (!panel || !content) return false;
    panel.hidden = false;
    content.hidden = false;
    content.style.removeProperty("display");
    const heading = byId("modernToolTitle");
    if (heading) heading.textContent = title;
    window.requestAnimationFrame(() => panel.scrollIntoView?.({ behavior: "smooth", block: "start" }));
    return true;
  }

  function openModernProgramGenerator() {
    if (!openToolPanel("programGeneratorAccess", "AI-genereret træningsplan")) return false;
    const access = byId("programGeneratorAccess");
    if (access) access.hidden = false;
    const count = byId("countPicker");
    if (count) count.style.display = "none";
    return true;
  }

  function openModernSavedPrograms() {
    window.renderSaved?.();
    return openToolPanel("savedDropdown", "Mine programmer");
  }

  function openModernSavedProgram(id) {
    if (!id) return false;
    window.loadSavedProgram?.(id);
    closeToolPanel();
    window.openWorkoutEditor?.();
    render();
    return true;
  }

  function openModernTrash() {
    window.renderTrash?.();
    return openToolPanel("trashDropdown", "Papirkurv");
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

  function invokeHandler(name) {
    const handler = window[name];
    if (typeof handler !== "function") {
      console.warn(`[Work4it Modern UI] Handleren ${name} er ikke tilgængelig.`);
      return false;
    }
    closeToolPanel();
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
    closeToolPanel();
    render();
    byId("modernDashboardUI")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    return true;
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
      const tabs = [...(byId("modernIconRail")?.querySelectorAll?.(".modern-icon-tab") || [])];
      if (!tabs.length) return;
      event.preventDefault();
      const current = Math.max(0, tabs.indexOf(tab));
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      selectAction(tabs[next].dataset.modernAction);
    });
    byId("modernBottomNav")?.addEventListener("click", event => {
      const category = event.target.closest?.("[data-modern-category]");
      if (category) setCategory(category.dataset.modernCategory);
    });
  }

  function initialize() {
    bindNavigation();
    render();
  }

  window.closeModernToolPanel = closeToolPanel;
  window.openModernProgramGenerator = openModernProgramGenerator;
  window.openModernSavedPrograms = openModernSavedPrograms;
  window.openModernSavedProgram = openModernSavedProgram;
  window.openModernTrash = openModernTrash;
  window.openModernSettings = openModernSettings;
  window.openModernProgress = openModernProgress;
  window.Work4itModernDashboard = Object.freeze({ CATEGORIES, setCategory, selectAction, invokeAction, closeToolPanel, render });

  ["work4it:dashboard-updated", "firestore:data-hydrated", "firestore:sync-completed", "training-profile:updated", "firebase-auth:changed", "workout-history:changed"]
    .forEach(eventName => window.addEventListener(eventName, render));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
}());
