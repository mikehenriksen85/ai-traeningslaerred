"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("app/index.html", "utf8");
const source = fs.readFileSync("app/modern-dashboard-ui.js", "utf8");
const iconSource = fs.readFileSync("app/work4it-icons.js", "utf8");
const css = fs.readFileSync("app/modern-dashboard-ui.css", "utf8");
const profile = fs.readFileSync("app/profile-account.js", "utf8");
const helpContent = fs.readFileSync("app/help-content-config.js", "utf8");
const screenshotImport = fs.readFileSync("app/screenshot-import.js", "utf8");
const menuManager = fs.readFileSync("app/workit-menu-manager.js", "utf8");
const serviceWorker = fs.readFileSync("app/service-worker.js", "utf8");

new Function(source);
new Function(iconSource);

for (const id of [
  "modernDashboardUI", "modernDashboardTitle", "modernIconRail", "modernFeaturePanel",
  "modernCardGrid", "modernToolPanel", "modernBottomNav", "programGeneratorAccess",
  "savedDropdown", "savedSelect", "trashDropdown", "trashItems", "membershipNavStatus"
]) {
  assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be unique`);
}

assert.doesNotMatch(html, /id="sidebar"|class="sidebar"|home-dashboard|id="homeDashboard"|work4it_ui_layout|data-ui-layout|changeAppLayout|Classic UI/);
assert.doesNotMatch(source, /work4it_ui_layout|DEFAULT_LAYOUT|setLayout|getLayout|MutationObserver|homeDashboard|toggleSidebar/);
assert.doesNotMatch(profile, /work4it-layout|changeAppLayout|layoutSettingFeedback|work4it:layout-changed/);
assert.doesNotMatch(menuManager, /sidebar|toggleSidebar|WorkitMenuView/);
assert.doesNotMatch(css, /data-ui-layout|home-dashboard|\.sidebar/);

for (const category of ["user", "training", "more"]) {
  assert.match(html, new RegExp(`data-modern-category="${category}"`));
  assert.match(source, new RegExp(`${category}: \\{`));
}
assert.equal((html.match(/data-modern-category=/g) || []).length, 3, "Modern UI has exactly three primary categories");

for (const handler of [
  "openProfileSetup", "openProfileWizardFromMenu", "openMembershipView", "openBlankWorkoutDialog",
  "openModernProgramGenerator", "openModernSavedPrograms", "continueDashboardWorkout", "startDashboardWorkout",
  "openDashboard", "openProgressView", "openCalorieView", "openAiCoach", "openScreenshotImportInfo",
  "exportDataFromMenu", "openHelpAboutDialog", "logoutProfileAccount", "openModernTrash"
]) assert.match(source, new RegExp(handler), `Modern UI reuses ${handler}`);

assert.match(source, /Work4itDashboardRuntime\?\.getSnapshot/);
assert.doesNotMatch(source, /FirestoreDataService|FirebaseAuthService|\bfetch\(|XMLHttpRequest/, "Modern UI does not introduce a competing data flow");
assert.match(source, /Forbereder dit dashboard/);
assert.match(source, /state\.view\.featuredWorkout/);
assert.match(source, /data\.view\?\.activeWorkout/);
assert.match(source, /function openModernSavedPrograms\(/);
assert.match(source, /function openModernProgramGenerator\(/);
assert.match(source, /function openModernTrash\(/);
assert.match(source, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/, "Horizontal tabs support keyboard navigation");
assert.match(source, /class="modern-mini-card/);
assert.match(source, /data-modern-open=/);
assert.match(source, /class="modern-mini-card-label"/);
assert.doesNotMatch(source, /<small>\$\{escapeHtml\(state\.meta \|\| action\.description\)\}<\/small>/, "Quick access cards show names only");
assert.match(source, /Work4itIcons\?\.markup/);
assert.match(source, /scrollIntoView\?\.\(\{ behavior: "smooth", block: "nearest", inline: "center" \}\)/);

for (const iconName of [
  "profile", "target", "membership", "coach", "settings", "play", "aiPlan", "blank",
  "programs", "active", "import", "history", "progress", "calories", "trash", "export",
  "help", "privacy", "feedback", "logout", "user", "training", "more", "save",
  "finish", "pause", "close", "share", "add", "cloud", "reset", "calisthenics"
]) assert.match(iconSource, new RegExp(`${iconName}:`), `Shared icon system includes ${iconName}`);
assert.doesNotMatch(source, /👤|🏋️|◆|✦|▣|◷|▧|⌫/, "Modern navigation no longer uses generic emoji or text glyphs");
assert.match(html, /data-work4it-icon="user"/);
assert.match(html, /data-work4it-icon="training"/);
assert.match(html, /data-work4it-icon="more"/);
for (const iconName of ["save", "finish", "pause", "play", "close", "progress", "share", "trash", "add"])
  assert.match(html, new RegExp(`data-work4it-leading-icon="${iconName}"`), `Core app action uses ${iconName} SVG icon`);
assert.match(helpContent, /icon: "coach"/);
assert.match(helpContent, /icon: "cloud"/);
assert.doesNotMatch(helpContent, /🤖|🎯|📊|☁️|📸|⭐|📝/);
assert.match(screenshotImport, /Work4itIcons\?\.markup\?\.\("import"\)/);
assert.doesNotMatch(html, />▶<\/button>|>↺<\/button>|>📷|>🗑|>💾|>➕/);

assert.match(css, /position: fixed/);
assert.match(css, /overflow-x: auto/);
assert.match(css, /\.modern-icon-label/);
assert.match(css, /\.modern-icon-label[\s\S]*?white-space: nowrap/);
assert.match(css, /\.modern-mini-card strong[\s\S]*?white-space: nowrap/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.modern-card-grid \{ grid-template-columns: 1fr; \}/);
assert.match(css, /\.work4it-icon-svg/);
assert.match(css, /--modern-icon-color/);
assert.match(css, /--modern-touch: 48px/);
assert.match(css, /min-height: var\(--modern-touch\)/);
assert.match(css, /body\[data-workout-view="session"\] \.modern-bottom-nav/);
assert.match(css, /@media \(max-width: 560px\)/);
assert.match(css, /@media \(min-width: 760px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

for (const asset of ["modern-dashboard-ui.css", "modern-dashboard-ui.js"])
  assert.match(html, new RegExp(`${asset.replace(".", "\\.")}\\?v=20260722-card-labels1`));
assert.match(html, /work4it-icons\.js\?v=20260722-icon-system1/);
for (const asset of ["profile-account.js", "workit-menu-manager.js", "membership.js"])
  assert.match(html, new RegExp(`${asset.replace(".", "\\.")}\\?v=20260721-modern-permanent1`));
assert.match(html, /service-worker\.js\?v=20260723-sync-notice1/);
assert.match(serviceWorker, /work4it-shell-v130-sync-notice1/);
for (const asset of ["modern-dashboard-ui.css", "modern-dashboard-ui.js"])
  assert.match(serviceWorker, new RegExp(`${asset.replace(".", "\\.")}\\?v=20260722-card-labels1`));
assert.match(serviceWorker, /work4it-icons\.js\?v=20260722-icon-system1/);
for (const asset of ["profile-account.js", "workit-menu-manager.js", "membership.js"])
  assert.match(serviceWorker, new RegExp(`${asset.replace(".", "\\.")}\\?v=20260721-modern-permanent1`));

const listeners = new Map();
const window = {
  addEventListener(type, handler) { listeners.set(type, handler); },
  dispatchEvent() {},
  setTimeout() {},
  Work4itDashboardRuntime: { getSnapshot: () => ({ loading: true, view: {} }) }
};
const document = {
  readyState: "loading",
  getElementById: () => null,
  addEventListener(type, handler) { listeners.set(type, handler); }
};
vm.runInNewContext(source, { window, document, console, CustomEvent: class CustomEvent {} });
assert.equal(typeof window.Work4itModernDashboard.render, "function");
assert.equal(typeof window.Work4itModernDashboard.setCategory, "function");
assert.equal(typeof window.openModernProgramGenerator, "function");
assert.equal(typeof window.openModernSavedPrograms, "function");
assert.equal(typeof window.openModernTrash, "function");
assert.equal("setLayout" in window.Work4itModernDashboard, false, "Classic/Modern switching is permanently removed");

console.log("Permanent Modern Dashboard UI migration, navigation and runtime contracts OK");
