(function wizardControllerModule() {
  "use strict";

  function ensureStyles() {
    if (document.getElementById("training-wizard-styles")) return;
    const style = document.createElement("style");
    style.id = "training-wizard-styles";
    style.textContent = `
      .wizard-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(10, 14, 18, .82);
        color: var(--text-primary, #fff);
        font-family: var(--font-primary, "Segoe UI", Arial, sans-serif);
      }
      .wizard-panel {
        width: min(660px, 100%);
        max-height: min(800px, 94vh);
        overflow-y: auto;
        border: 1px solid var(--border, #313d49);
        border-radius: 8px;
        background: var(--card, #252e36);
        box-shadow: 0 22px 60px rgba(0, 0, 0, .48);
      }
      .wizard-panel.daily-panel { width: min(560px, 100%); }
      .wizard-overlay.daily { min-height: 100vh; min-height: 100dvh; }
      .wizard-panel.daily-panel { max-height: calc(100vh - 36px); max-height: calc(100dvh - 36px); }
      .wizard-head { padding: 18px 18px 14px; border-bottom: 1px solid var(--border, #313d49); }
      .wizard-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .wizard-title {
        font-size: var(--font-size-h2, 1.125rem);
        font-weight: var(--font-weight-bold, 700);
        line-height: var(--line-height-heading, 1.25);
      }
      .wizard-close {
        width: 32px;
        height: 32px;
        border: 1px solid var(--border, #313d49);
        border-radius: 5px;
        background: var(--input, #1a2026);
        color: var(--text-secondary, #a0aab2);
        font: inherit;
        cursor: pointer;
      }
      .wizard-progress {
        height: 6px;
        margin-top: 14px;
        overflow: hidden;
        border-radius: 3px;
        background: rgba(255, 255, 255, .09);
      }
      .wizard-progress span {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: var(--blue, #3a93ff);
        transition: width .2s ease;
      }
      .wizard-progress-meta {
        display: flex;
        justify-content: space-between;
        margin-top: 7px;
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-small, .75rem);
      }
      .wizard-content { padding: 22px 18px; }
      .wizard-step-title {
        margin: 0 0 7px;
        font-size: var(--font-size-h1, 1.5rem);
        font-weight: var(--font-weight-bold, 700);
        line-height: var(--line-height-heading, 1.25);
      }
      .wizard-help {
        margin: 0 0 18px;
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-body, .875rem);
        line-height: var(--line-height-body, 1.5);
      }
      .wizard-subtitle {
        margin: 18px 0 8px;
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-small, .75rem);
        font-weight: var(--font-weight-semibold, 600);
      }
      .wizard-options {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .wizard-options.single-column { grid-template-columns: 1fr; }
      .wizard-options.compact .wizard-option:last-child { grid-column: 1 / -1; }
      .wizard-option {
        min-height: 48px;
        padding: 11px;
        border: 1px solid var(--border, #313d49);
        border-radius: 6px;
        background: var(--input, #1a2026);
        color: var(--text-primary, #fff);
        font: inherit;
        font-weight: var(--font-weight-semibold, 600);
        text-align: center;
        cursor: pointer;
      }
      .wizard-option.descriptive { text-align: left; }
      .wizard-option strong { display: block; font: inherit; font-weight: var(--font-weight-semibold, 600); }
      .wizard-option span {
        display: block;
        margin-top: 4px;
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-small, .75rem);
        font-weight: var(--font-weight-normal, 400);
        line-height: var(--line-height-body, 1.5);
      }
      .wizard-option.selected {
        border-color: var(--green, #4ade80);
        background: rgba(74, 222, 128, .09);
        color: var(--green, #4ade80);
      }
      .wizard-information {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid rgba(58, 147, 255, .55);
        border-radius: 6px;
        background: rgba(58, 147, 255, .09);
        color: var(--text-primary, #fff);
      }
      .wizard-information strong {
        display: block;
        margin-bottom: 4px;
        font-size: var(--font-size-body, .875rem);
        font-weight: var(--font-weight-semibold, 600);
      }
      .wizard-information span {
        display: block;
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-small, .75rem);
        line-height: var(--line-height-body, 1.5);
      }
      .wizard-pep-talk {
        position: relative;
        margin: 14px 0 22px;
        padding: 22px 20px;
        overflow: hidden;
        border: 1px solid rgba(58, 147, 255, .7);
        border-left: 5px solid var(--green, #4ade80);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(58, 147, 255, .2), rgba(74, 222, 128, .12));
        box-shadow: 0 14px 32px rgba(0, 0, 0, .22);
        color: var(--text-primary, #fff);
        pointer-events: none;
        animation: wizardFeedbackIn .28s ease-out both;
      }
      .wizard-pep-talk::after {
        content: "💪";
        position: absolute;
        right: 16px;
        top: 12px;
        font-size: 2rem;
        opacity: .16;
      }
      .wizard-pep-talk-kicker {
        margin-bottom: 7px;
        color: var(--green, #4ade80);
        font-size: var(--font-size-small, .75rem);
        font-weight: var(--font-weight-bold, 700);
        line-height: var(--line-height-heading, 1.25);
        text-transform: uppercase;
      }
      .wizard-pep-talk h3 {
        max-width: calc(100% - 40px);
        margin: 0 0 14px;
        color: var(--text-primary, #fff);
        font-size: var(--font-size-h2, 1.125rem);
        font-weight: var(--font-weight-bold, 700);
        line-height: var(--line-height-heading, 1.25);
      }
      .wizard-pep-talk-lines {
        display: grid;
        gap: 8px;
      }
      .wizard-pep-talk-lines p {
        margin: 0;
        color: var(--text-primary, #fff);
        font-size: var(--font-size-body, .875rem);
        font-weight: var(--font-weight-medium, 500);
        line-height: var(--line-height-body, 1.5);
      }
      .wizard-skip-feedback {
        position: fixed;
        z-index: 1100;
        right: 18px;
        bottom: 18px;
        max-width: min(390px, calc(100vw - 36px));
        padding: 13px 15px;
        border: 1px solid rgba(58, 147, 255, .58);
        border-radius: 6px;
        background: var(--card, #252e36);
        color: var(--text-primary, #fff);
        box-shadow: 0 12px 34px rgba(0, 0, 0, .38);
        font-size: var(--font-size-body, .875rem);
        font-weight: var(--font-weight-semibold, 600);
        line-height: var(--line-height-body, 1.5);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity .2s ease, transform .2s ease;
      }
      .wizard-skip-feedback.show { opacity: 1; transform: translateY(0); }
      @keyframes wizardFeedbackIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .wizard-fields {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .wizard-fields label {
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-small, .75rem);
      }
      .wizard-fields input {
        width: 100%;
        margin-top: 5px;
        padding: 10px;
        border: 1px solid var(--border, #313d49);
        border-radius: 6px;
        outline: none;
        background: var(--input, #1a2026);
        color: var(--text-primary, #fff);
        font: inherit;
      }
      .wizard-fields input:focus { border-color: var(--blue, #3a93ff); }
      .wizard-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
      .wizard-days .wizard-option { min-height: 44px; padding: 8px; }
      .wizard-summary { display: grid; gap: 10px; }
      .wizard-summary > div {
        padding: 12px;
        border: 1px solid var(--border, #313d49);
        border-radius: 6px;
        background: rgba(0, 0, 0, .14);
      }
      .wizard-summary span {
        display: block;
        color: var(--text-secondary, #a0aab2);
        font-size: var(--font-size-small, .75rem);
      }
      .wizard-summary strong { display: block; margin-top: 3px; font-size: var(--font-size-h3, 1rem); }
      .wizard-tabs { display: flex; gap: 7px; overflow-x: auto; margin-top: 14px; padding-bottom: 3px; }
      .wizard-tabs button {
        flex: 0 0 auto;
        padding: 8px 11px;
        border: 1px solid var(--border, #313d49);
        border-radius: 5px;
        background: var(--input, #1a2026);
        color: var(--text-secondary, #a0aab2);
        font: inherit;
        font-weight: var(--font-weight-semibold, 600);
        cursor: pointer;
      }
      .wizard-tabs button.selected { border-color: var(--green, #4ade80); color: var(--green, #4ade80); }
      .wizard-program { display: grid; gap: 2px; margin-top: 12px; }
      .wizard-program > div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 9px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, .06);
      }
      .wizard-program span:last-child { color: var(--text-secondary, #a0aab2); white-space: nowrap; }
      .wizard-footer {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 18px 18px;
        border-top: 1px solid var(--border, #313d49);
      }
      .wizard-button {
        min-width: 105px;
        padding: 10px 15px;
        border: 1px solid var(--border, #313d49);
        border-radius: 6px;
        background: var(--input, #1a2026);
        color: var(--text-primary, #fff);
        font: inherit;
        font-weight: var(--font-weight-semibold, 600);
        cursor: pointer;
      }
      .wizard-button.primary { border-color: var(--blue, #3a93ff); background: var(--blue, #3a93ff); }
      .wizard-button.create { border-color: var(--green, #4ade80); background: var(--green, #4ade80); color: #102117; }
      .wizard-button:disabled { cursor: not-allowed; opacity: .45; }
      @media (max-width: 560px) {
        .wizard-overlay { padding: 10px; }
        .wizard-overlay.daily {
          padding:
            max(10px, env(safe-area-inset-top))
            max(10px, env(safe-area-inset-right))
            max(10px, env(safe-area-inset-bottom))
            max(10px, env(safe-area-inset-left));
        }
        .wizard-panel.daily-panel {
          width: 100%;
          max-height: calc(100vh - 20px);
          max-height: calc(100dvh - 20px);
        }
        .daily-panel .wizard-option, .daily-panel .wizard-button { min-height: 48px; }
        .daily-panel .wizard-footer {
          position: sticky;
          bottom: 0;
          z-index: 1;
          background: var(--card, #252e36);
        }
        .wizard-options, .wizard-fields { grid-template-columns: 1fr; }
        .wizard-options.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .wizard-days { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .wizard-step-title { font-size: var(--font-size-h2, 1.125rem); }
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    const store = window.TrainingWizardStore;
    if (!store) return;
    if (document.getElementById("profile-wizard-root") || document.getElementById("daily-start-wizard-root")) return;
    const profile = store.getProfile();
    const profileEntry = document.querySelector(".profile");
    const profileLabel = document.querySelector(".profile-login");
    if (window.ENABLE_PROFILE_WIZARD === true) {
      profileEntry?.classList.add("profile-edit-enabled");
      if (profileLabel) profileLabel.textContent = "Rediger profilopsætning";
    }

    if (window.ENABLE_PROFILE_WIZARD === true && !profile.hasCompletedProfileWizard) {
      window.ProfileWizard?.open?.({ mode: "new" });
      return;
    }
    if (
      window.ENABLE_DAILY_START_WIZARD === true &&
      profile.hasCompletedProfileWizard &&
      window.Membership?.getMembership?.().isPremium !== false
    ) {
      window.DailyStartWizard?.open?.();
    }
  }

  window.WizardUI = { ensureStyles };
  window.openProfileSetup = function openProfileSetup() {
    if (window.ENABLE_PROFILE_WIZARD !== true) return;
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains("open")) window.toggleSidebar?.();
    window.ProfileWizard?.open?.({ mode: "edit" });
  };

  function startAfterLayout() {
    window.requestAnimationFrame(start);
  }

  window.addEventListener("training-app:ready", startAfterLayout);
  window.addEventListener("load", startAfterLayout, { once: true });
  window.addEventListener("pageshow", event => {
    if (event.persisted) startAfterLayout();
  });
})();
