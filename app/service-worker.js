const CACHE_NAME = "work4it-shell-v58-kg-input1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./work4it-app-icon-192.png",
  "./work4it-app-icon-512.png",
  "./work4it-logo-v1.png",
  "./work4it-hero-logo-v1.png",
  "./storage-scope.js?v=20260621-cloud-primary1",
  "./calorie-estimator.js?v=20260615-cardio1",
  "./training-goal-engine.js?v=20260620-calisthenics1",
  "./workout-program-store.js?v=20260615-days1",
  "./screenshot-import.js?v=20260701-kg-input1",
  "./wizard-store.js?v=20260621-cloud-primary1",
  "./daily-start-wizard.js?v=20260615-window1",
  "./wizard-controller.js?v=20260622-fixed-routing1",
  "./stripe-config.js?v=20260629-priceids1",
  "./membership.js?v=20260701-membership-status-fix1",
  "./stripe-checkout.js?v=20260701-membership-mobile-fix1",
  "./ai-system.js?v=20260628-ai20",
  "./ai-copilot-actions.js?v=20260628-ai20",
  "./ai-request-counter.js?v=20260701-membership-status-fix1",
  "./help-content-config.js?v=20260628-help1",
  "./password-visibility.js?v=20260621-password-toggle1",
  "./auth-gate.js?v=20260628-auth-ready1",
  "./theme-service.js?v=20260627-theme1",
  "./profile-account.js?v=20260627-theme1",
  "./profile-wizard.js?v=20260620-calisthenics1",
  "./firebase-config.js?v=20260628-auth-ready1",
  "./auth-service.js?v=20260630-user-doc1",
  "./firestore-cloud-service.js?v=20260630-cloud-primary2"
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

  if (url.pathname.startsWith("/__/auth/")) return;

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


