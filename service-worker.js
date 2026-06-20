const CACHE_NAME = "work4it-shell-v12-pause-format1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./work4it-app-icon-192.png",
  "./work4it-app-icon-512.png",
  "./work4it-logo-v1.png",
  "./work4it-hero-logo-v1.png",
  "./storage-scope.js?v=20260618-authflow1",
  "./calorie-estimator.js?v=20260615-cardio1",
  "./training-goal-engine.js?v=20260620-calisthenics1",
  "./workout-program-store.js?v=20260615-days1",
  "./screenshot-import.js?v=20260620-import1",
  "./wizard-store.js?v=20260620-calisthenics1",
  "./daily-start-wizard.js?v=20260615-window1",
  "./wizard-controller.js?v=20260619-priority-goals1",
  "./membership.js?v=20260618-authflow1",
  "./ai-system.js?v=20260620-calisthenics1",
  "./ai-copilot-actions.js?v=20260619-ai-audit1",
  "./auth-gate.js?v=20260619-gdpr1",
  "./profile-account.js?v=20260620-calisthenics1",
  "./profile-wizard.js?v=20260620-calisthenics1",
  "./firebase-config.js?v=20260614-auth2",
  "./auth-service.js?v=20260619-gdpr1",
  "./firestore-cloud-service.js?v=20260619-gdpr1"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    })
  );
});


