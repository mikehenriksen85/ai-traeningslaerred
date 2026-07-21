(function initMenuViewController() {
  "use strict";
  if (window.WorkitMenuManager?.__work4itMenuManagerVersion === "1.0") return;
  const menuState = {
    activeSurface: null,
    activePanel: null,
    historyToken: 0
  };
  function elementList(value) {
    const list = typeof value === "function" ? value() : value;
    return (Array.isArray(list) ? list : [list]).filter(Boolean);
  }
  function containsTarget(roots, target) {
    return elementList(roots).some(root => root === target || root.contains?.(target));
  }
  function pushMenuHistory(id) {
    try {
      const state = { ...(history.state || {}), workitMenuToken: ++menuState.historyToken, workitMenuId: id };
      history.pushState(state, "", location.href);
    } catch (error) {
      console.warn("[Work4it menu] Kunne ikke oprette historik-state.", error);
    }
  }
  function updateTransientMenuState() {
    document.body.classList.toggle("workit-transient-menu-open", Boolean(menuState.activePanel || menuState.activeSurface));
  }
  function closeActivePanel(reason = "close") {
    const panel = menuState.activePanel;
    if (!panel) return false;
    menuState.activePanel = null;
    panel.close?.(reason);
    updateTransientMenuState();
    return true;
  }
  function openPanel(id, options = {}) {
    if (menuState.activePanel?.id === id) return menuState.activePanel;
    closeActivePanel("switch-panel");
    menuState.activePanel = { id, roots: options.roots || [], close: options.close };
    updateTransientMenuState();
    if (options.history !== false) pushMenuHistory(id);
    return menuState.activePanel;
  }
  function notifyPanelClosed(id) {
    if (!id || menuState.activePanel?.id === id) {
      menuState.activePanel = null;
      updateTransientMenuState();
    }
  }
  function closeSurfaceDom(id, reason = "close") {
    if (id === "modal") {
      const modal = document.getElementById("modal");
      if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        document.getElementById("modalContent")?.classList.remove("brand-surface", "dashboard-brand-surface");
      }
    } else if (id === "membership-popup") {
      document.getElementById("membershipPopup")?.classList.remove("open");
    } else if (id === "exercise-picker") {
      const menu = document.getElementById("muscleMenu");
      if (menu) menu.style.display = "none";
      if (typeof window !== "undefined") window.exercisePickerMuscle = "";
    } else if (id === "ai-coach") {
      document.getElementById("aiCoachPanel")?.classList.remove("open");
      document.getElementById("aiCoachPanel")?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("ai-coach-open");
      document.getElementById("aiCoachButton")?.setAttribute("aria-expanded", "false");
    }
  }
  function closeActiveSurface(reason = "close") {
    const surface = menuState.activeSurface;
    if (!surface) {
      closeActivePanel(reason);
      return false;
    }
    menuState.activeSurface = null;
    surface.close?.(reason);
    updateTransientMenuState();
    return true;
  }
  function openSurface(id, options = {}) {
    if (menuState.activeSurface?.id === id) return menuState.activeSurface;
    closeActivePanel("surface-open");
    closeActiveSurface("switch-surface");
    menuState.activeSurface = {
      id,
      roots: options.roots || [],
      close: options.close || ((reason) => closeSurfaceDom(id, reason))
    };
    updateTransientMenuState();
    if (options.history !== false) pushMenuHistory(id);
    return menuState.activeSurface;
  }
  function notifySurfaceClosed(id) {
    if (!id || menuState.activeSurface?.id === id) {
      menuState.activeSurface = null;
      updateTransientMenuState();
    }
  }
  window.WorkitMenuManager = {
    __work4itMenuManagerVersion: "1.0",
    openSurface,
    closeActiveSurface,
    closeSurface(id, reason = "manual-close") {
      if (menuState.activeSurface?.id === id) return closeActiveSurface(reason);
      closeSurfaceDom(id, reason);
      return false;
    },
    notifySurfaceClosed,
    isSurfaceOpen(id) {
      return menuState.activeSurface?.id === id;
    },
    openPanel,
    closeActivePanel,
    closePanel(id, reason = "manual-close") {
      if (menuState.activePanel?.id === id) return closeActivePanel(reason);
      return false;
    },
    notifyPanelClosed,
    isPanelOpen(id) {
      return menuState.activePanel?.id === id;
    },
    closeAll(reason = "close-all") {
      closeActivePanel(reason);
      closeActiveSurface(reason);
    }
  };
  window.WorkitWindowManager = {
    canOpen(id) {
      const roots = id === "membership-popup"
        ? () => [document.querySelector("#membershipPopup .membership-popup-panel"), document.getElementById("membershipPopup")]
        : () => [document.getElementById(id), document.querySelector(`#${id} .modal-panel`)];
      openSurface(id, { roots, close: (reason) => closeSurfaceDom(id, reason) });
      return true;
    },
    notifyClosed(id) {
      notifySurfaceClosed(id);
    },
    closeNonAuthWindows() {
      closeActivePanel("auth-route");
      closeActiveSurface("auth-route");
      ["savedDropdown", "trashDropdown", "countPicker"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = "none";
      });
      const generator = document.getElementById("programGeneratorAccess");
      if (generator) generator.hidden = true;
      document.getElementById("membershipPopup")?.classList.remove("open");
      document.getElementById("aiCoachPanel")?.classList.remove("open");
      document.body.classList.remove("ai-coach-open");
      document.querySelectorAll(".progress-view.open, .calorie-view.open, .profile-account-view.open, .membership-view.open, .wizard-shell.open").forEach(view => {
        view.classList.remove("open");
        view.setAttribute("aria-hidden", "true");
      });
      const modal = document.getElementById("modal");
      if (modal) {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
      }
    }
  };
  document.addEventListener("pointerdown", event => {
    const target = event.target;
    const panel = menuState.activePanel;
    if (panel && !containsTarget(panel.roots, target)) {
      closeActivePanel("outside");
      return;
    }
    const surface = menuState.activeSurface;
    if (surface?.id && !containsTarget(surface.roots, target)) {
      closeActiveSurface("outside");
    }
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (closeActivePanel("escape") || closeActiveSurface("escape")) event.preventDefault();
    }
  });
  window.addEventListener("popstate", () => {
    closeActivePanel("browser-back") || closeActiveSurface("browser-back");
  });
})();
