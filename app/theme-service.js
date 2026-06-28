(function () {
  const STORAGE_KEY = "work4it_theme";
  const DEFAULT_THEME = "work4it";

  const THEMES = {
    work4it: {
      id: "work4it",
      label: "Work4it",
      description: "Mørkt Work4it-design med blå, grøn og rød brandfarve.",
      colorScheme: "dark",
      themeColor: "#0F172A"
    },
    classic: {
      id: "classic",
      label: "Classic",
      description: "Roligt og tidløst tema med høj læsbarhed.",
      colorScheme: "light",
      themeColor: "#F4F4F5"
    }
  };

  function normalizeTheme(value) {
    const key = String(value || "").trim().toLowerCase();
    return THEMES[key] ? key : DEFAULT_THEME;
  }

  function readStoredTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return DEFAULT_THEME;
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, normalizeTheme(theme));
    } catch (_) {
      // Local storage can be unavailable in private browsing. The live theme still applies.
    }
  }

  function updateThemeMeta(theme) {
    const definition = THEMES[normalizeTheme(theme)];
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head?.appendChild(meta);
    }
    meta.setAttribute("content", definition.themeColor);
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    document.documentElement.dataset.theme = nextTheme;
    if (document.body) document.body.dataset.theme = nextTheme;
    updateThemeMeta(nextTheme);
    return nextTheme;
  }

  function setTheme(theme, options = {}) {
    const nextTheme = applyTheme(theme);
    if (!options.skipStorage) writeStoredTheme(nextTheme);
    if (!options.silent) {
      window.dispatchEvent(new CustomEvent("work4it:theme-changed", {
        detail: {
          theme: nextTheme,
          source: options.source || "user"
        }
      }));
    }
    return nextTheme;
  }

  function themeFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("theme");
    } catch (_) {
      return "";
    }
  }

  function initializeTheme() {
    const urlTheme = themeFromUrl();
    const initialTheme = THEMES[normalizeTheme(urlTheme)] && urlTheme ? normalizeTheme(urlTheme) : readStoredTheme();
    setTheme(initialTheme, { silent: true, source: urlTheme ? "url" : "local" });
  }

  window.Work4itTheme = {
    STORAGE_KEY,
    THEMES,
    DEFAULT_THEME,
    getTheme: readStoredTheme,
    setTheme,
    applyTheme,
    normalizeTheme
  };

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      applyTheme(event.newValue || DEFAULT_THEME);
      window.dispatchEvent(new CustomEvent("work4it:theme-applied", {
        detail: { theme: normalizeTheme(event.newValue), source: "storage" }
      }));
    }
  });

  window.addEventListener("work4it:theme-hydrated", event => {
    const theme = normalizeTheme(event.detail?.theme);
    setTheme(theme, { silent: true, source: "cloud" });
    window.dispatchEvent(new CustomEvent("work4it:theme-applied", {
      detail: { theme, source: "cloud" }
    }));
  });

  initializeTheme();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyTheme(readStoredTheme()), { once: true });
  } else {
    applyTheme(readStoredTheme());
  }
}());
