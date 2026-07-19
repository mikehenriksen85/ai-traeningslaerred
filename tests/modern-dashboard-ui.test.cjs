"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("app/index.html", "utf8");
const source = fs.readFileSync("app/modern-dashboard-ui.js", "utf8");
const css = fs.readFileSync("app/modern-dashboard-ui.css", "utf8");
const profile = fs.readFileSync("app/profile-account.js", "utf8");
const serviceWorker = fs.readFileSync("app/service-worker.js", "utf8");

new Function(source);

for (const id of ["modernDashboardUI", "modernDashboardTitle", "modernIconRail", "modernFeaturePanel", "modernCardGrid", "modernBottomNav", "layoutSettingFeedback"]) {
  assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be unique`);
}

assert.match(html, /name="work4it-layout" value="classic" onchange="changeAppLayout\(this\.value\)"/);
assert.match(html, /name="work4it-layout" value="modern" onchange="changeAppLayout\(this\.value\)"/);
assert.match(html, />Classic UI</);
assert.match(html, />Modern Dashboard UI</);
assert.match(html, /data-modern-category="user"/);
assert.match(html, /data-modern-category="training"/);
assert.match(html, /data-modern-category="more"/);
assert.equal((html.match(/data-modern-category=/g) || []).length, 3, "Modern UI has exactly three primary categories");

assert.match(source, /const STORAGE_KEY = "work4it_ui_layout"/);
assert.match(source, /const DEFAULT_LAYOUT = "classic"/);
assert.match(source, /classic: \{ id: "classic", label: "Classic UI" \}/);
assert.match(source, /modern: \{ id: "modern", label: "Modern Dashboard UI" \}/);
for (const handler of [
  "openProfileSetup", "openProfileWizardFromMenu", "openMembershipView", "openCreateOrImportWorkout",
  "openSavedProgramsFromDashboard", "continueDashboardWorkout", "startDashboardWorkout", "openDashboard",
  "openProgressView", "openCalorieView", "openAiCoach", "openScreenshotImportInfo", "exportDataFromMenu",
  "openHelpAboutDialog", "logoutProfileAccount"
]) assert.match(source, new RegExp(handler), `Modern UI reuses ${handler}`);

assert.doesNotMatch(source, /FirestoreDataService|FirebaseAuthService|\bfetch\(|XMLHttpRequest/, "The alternative UI does not introduce a competing data flow");
assert.match(source, /MutationObserver/);
assert.match(source, /homeActiveSection/);
assert.match(source, /homeDashboardLoading/);
assert.match(source, /Forbereder dit dashboard/, "Modern UI does not show a false empty state during hydration");
assert.match(source, /homeWorkoutSection/);
assert.match(source, /homeEmptyState/);
assert.match(source, /homeResumeWorkoutButton/);
assert.match(source, /id === "saved"/);
assert.match(source, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/, "Horizontal icon tabs support keyboard navigation");
assert.match(source, /class="modern-mini-card" type="button" data-modern-open=/, "Shortcut cards invoke the existing action directly");

assert.match(css, /:root\[data-ui-layout="modern"\] #homeDashboard \{ display: none !important; \}/);
assert.match(css, /:root\[data-ui-layout="modern"\] \.modern-bottom-nav/);
assert.match(css, /position: fixed/);
assert.match(css, /overflow-x: auto/);
assert.match(css, /body\[data-workout-view="session"\] \.modern-bottom-nav \{ display: none !important; \}/);
assert.match(css, /@media \(max-width: 560px\)/);
assert.match(css, /@media \(min-width: 760px\)/);

assert.match(profile, /function changeAppLayout\(layout\)/);
assert.match(profile, /Work4itModernDashboard\.setLayout\(layout, \{ source: "profile" \}\)/);
assert.match(profile, /work4it:layout-changed/);
assert.match(html, /modern-dashboard-ui\.css\?v=20260719-modern-dashboard1/);
assert.match(html, /modern-dashboard-ui\.js\?v=20260719-modern-dashboard1/);
assert.match(html, /profile-account\.js\?v=20260719-modern-dashboard1/);
assert.match(html, /service-worker\.js\?v=20260719-modern-dashboard1/);
assert.match(serviceWorker, /work4it-shell-v125-modern-dashboard1/);
assert.match(serviceWorker, /modern-dashboard-ui\.css\?v=20260719-modern-dashboard1/);
assert.match(serviceWorker, /modern-dashboard-ui\.js\?v=20260719-modern-dashboard1/);
assert.match(serviceWorker, /profile-account\.js\?v=20260719-modern-dashboard1/);

const values = new Map();
const root = { dataset: {} };
const body = { dataset: {} };
const document = {
  documentElement: root,
  body,
  readyState: "loading",
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener() {}
};
class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
const window = {
  addEventListener() {},
  dispatchEvent() {},
  open() {},
  setTimeout() {},
  toggleSidebar() {}
};
const sandbox = {
  window,
  document,
  CustomEvent,
  localStorage: {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  },
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
assert.equal(window.Work4itModernDashboard.getLayout(), "classic", "Classic UI remains the default");
assert.equal(window.Work4itModernDashboard.setLayout("modern"), "modern");
assert.equal(root.dataset.uiLayout, "modern");
assert.equal(body.dataset.uiLayout, "modern");
assert.equal(values.get("work4it_ui_layout"), "modern");
assert.equal(window.Work4itModernDashboard.setLayout("classic"), "classic");
assert.equal(root.dataset.uiLayout, "classic", "Classic UI can be restored immediately");
assert.equal(window.Work4itModernDashboard.setLayout("invalid"), "classic", "Unknown values fail safely to Classic UI");

console.log("Modern Dashboard UI isolation, navigation and instant layout switching OK");
