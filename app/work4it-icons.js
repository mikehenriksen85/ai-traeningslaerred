(function work4itIconSystem() {
  "use strict";

  const ICONS = Object.freeze({
    user: '<circle cx="12" cy="8" r="3.25"/><path d="M5.5 20c.45-4 2.6-6 6.5-6s6.05 2 6.5 6"/>',
    profile: '<circle cx="9" cy="8" r="3"/><path d="M3.75 19c.35-3.55 2.1-5.3 5.25-5.3 2.15 0 3.65.8 4.5 2.4"/><path d="M16.5 13.5v6m-3-3h6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.25"/><path d="m12 12 6.7-6.7M16 5.3h2.7V8"/>',
    membership: '<path d="m4 8 3 3 5-6 5 6 3-3-1.5 10h-13L4 8Z"/><path d="M7 21h10"/>',
    coach: '<path d="M7 18.5H5.5A2.5 2.5 0 0 1 3 16V7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5V9"/><path d="m7 18.5-2.5 2v-3"/><path d="m17.5 10 .75 2.25L20.5 13l-2.25.75L17.5 16l-.75-2.25L14.5 13l2.25-.75L17.5 10Z"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/>',
    play: '<circle cx="12" cy="12" r="9"/><path class="work4it-icon-fill" d="m10 8 6 4-6 4Z"/>',
    aiPlan: '<path d="M5 16h14M7 13v6M17 13v6M4 14h3M17 14h3"/><path d="m12 3 .8 2.2L15 6l-2.2.8L12 9l-.8-2.2L9 6l2.2-.8L12 3Z"/>',
    blank: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M12 11v6M9 14h6"/>',
    programs: '<rect x="4" y="5" width="13" height="15" rx="2"/><path d="M8 2h10a2 2 0 0 1 2 2v12M8 10h5M8 14h5"/>',
    active: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5v2M12 13l3-2"/><path class="work4it-icon-fill" d="m10.5 10 4.5 3-4.5 3Z"/>',
    import: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m6 16 4-4 3 3 2-2 3 3M15 7h3M16.5 5.5v3"/>',
    history: '<path d="M4 8V4m0 0h4M4.8 5.2A9 9 0 1 1 3 14"/><path d="M12 7v5l3 2"/>',
    progress: '<path d="M4 20V9M10 20V5M16 20v-7M3 20h18"/><path d="m5 11 5-5 4 4 6-7"/>',
    calories: '<path d="M13.5 3c1 4-2.5 5-1 8 1.1-1.6 2.5-2.2 4-3 1.8 2 3 4.2 3 6.6A7.5 7.5 0 0 1 4.5 15c0-3.9 2.3-6.2 5.3-9.3.1 2.5.7 3.7 1.5 4.4C11 7.3 13 6 13.5 3Z"/>',
    trash: '<path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    export: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-.8 1-.8 2.1M12 17.5h.01"/>',
    privacy: '<path d="M12 3 5 6v5c0 4.7 2.6 8 7 10 4.4-2 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    feedback: '<path d="M4 5h16v12H9l-5 4V5Z"/><path d="m9 13 1.2-3.7L16 6l2 2-3.3 5.8L11 15l-2-2Z"/>',
    logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
    training: '<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>',
    more: '<circle class="work4it-icon-fill" cx="6" cy="12" r="1.5"/><circle class="work4it-icon-fill" cx="12" cy="12" r="1.5"/><circle class="work4it-icon-fill" cx="18" cy="12" r="1.5"/>',
    save: '<path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    finish: '<path d="M5 21V4M6 5h11l-2 3 2 3H6"/><path d="m9 16 2 2 4-4"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 8v8M14 8v8"/>',
    close: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.9 7.4-4.7M8.3 13.1l7.4 4.7"/>',
    add: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
    cloud: '<path d="M7.5 18.5H18a4 4 0 0 0 .7-7.9A6.5 6.5 0 0 0 6.3 9.2 4.7 4.7 0 0 0 7.5 18.5Z"/><path d="m9 14 2 2 4-4"/>',
    reset: '<path d="M4 8V4m0 0h4M4.8 5.2A9 9 0 1 1 3 14"/>',
    calisthenics: '<circle cx="12" cy="4.5" r="2"/><path d="m12 7 3 4 4-1M12 7l-3 4-4-1M9 11l1 4-3 5M15 11l-1 4 3 5"/>'
  });

  function markup(name, extraClass = "") {
    const drawing = ICONS[name] || ICONS.more;
    const className = `work4it-icon-svg${extraClass ? ` ${extraClass}` : ""}`;
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${drawing}</svg>`;
  }

  function hydrate(root = document) {
    root.querySelectorAll?.("[data-work4it-icon]").forEach(node => {
      node.innerHTML = markup(node.dataset.work4itIcon || "more");
    });
    root.querySelectorAll?.("[data-work4it-leading-icon]").forEach(node => {
      node.querySelector(":scope > .work4it-leading-icon")?.remove();
      const icon = document.createElement("span");
      icon.className = "work4it-leading-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = markup(node.dataset.work4itLeadingIcon || "more");
      node.prepend(icon);
    });
  }

  window.Work4itIcons = Object.freeze({ markup, hydrate, names: Object.freeze(Object.keys(ICONS)) });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate(), { once: true });
  else hydrate();
}());
