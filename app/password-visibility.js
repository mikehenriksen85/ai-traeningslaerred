(function passwordVisibilityModule() {
  "use strict";

  const SHOW_LABEL = "👁 Vis adgangskode";
  const HIDE_LABEL = "🙈 Skjul adgangskode";

  function setVisibility(button, visible) {
    const inputId = button?.dataset.passwordToggle || "";
    const input = inputId ? document.getElementById(inputId) : null;
    if (!input) return false;
    input.type = visible ? "text" : "password";
    button.textContent = visible ? HIDE_LABEL : SHOW_LABEL;
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", visible ? "Skjul adgangskode" : "Vis adgangskode");
    return true;
  }

  function resetAll() {
    document.querySelectorAll("[data-password-toggle]").forEach(button => {
      setVisibility(button, false);
    });
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-password-toggle]");
    if (!button) return;
    event.preventDefault();
    const input = document.getElementById(button.dataset.passwordToggle || "");
    if (!input) return;
    setVisibility(button, input.type === "password");
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  });

  window.addEventListener("firebase-auth:changed", resetAll);
  window.PasswordVisibility = { reset: resetAll };
  resetAll();
})();
