const CACHE_NAME = "work4it-shell-v124-empty-workout-actions1";
const ANIMATION_CACHE_NAME = "work4it-exercise-animations-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin-config.js?v=20260712-home-center1",
  "./exercise-animation/mannequin.css?v=20260716-mannequin-prototype1",
  "./exercise-animation/muscles.js?v=20260716-mannequin-prototype1",
  "./exercise-animation/animations.js?v=20260716-mannequin-prototype1",
  "./exercise-animation/mannequin.js?v=20260716-mannequin-prototype1",
  "./exercise-animation-model.js?v=20260716-professional-three1",
  "./exercise-animation-3d-renderer.js?v=20260716-professional-three1",
  "./dashboard-view-model.js?v=20260718-dashboard-buttons1",
  "./workout-heatmap.js?v=20260718-heatmap1",
  "./progression.css?v=20260718-progression1",
  "./progression-service.js?v=20260718-progression1",
  "./completed-workout-analysis.js?v=20260716-completion-analysis2",
  "./vendor/three/three.module.min.js",
  "./vendor/three/LICENSE",
  "./manifest.webmanifest",
  "./work4it-app-icon-192.png",
  "./work4it-app-icon-512.png",
  "./work4it-logo-v1.png",
  "./work4it-hero-logo-v1.png",
  "./workit-menu-manager.js?v=20260712-menu-manager1",
  "./storage-scope.js?v=20260621-cloud-primary1",
  "./calorie-estimator.js?v=20260615-cardio1",
  "./training-goal-engine.js?v=20260716-cardio-empty-time1",
  "./workout-program-store.js?v=20260615-days1",
  "./screenshot-import.js?v=20260710-reps-input1",
  "./wizard-store.js?v=20260718-profile-cloud1",
  "./daily-start-wizard.js?v=20260615-window1",
  "./wizard-controller.js?v=20260622-fixed-routing1",
  "./stripe-config.js?v=20260712-home-center1",
  "./membership.js?v=20260713-admin-subscription-test1",
  "./stripe-checkout.js?v=20260713-admin-subscription-test1",
  "./ai-system.js?v=20260715-exercise-animations1",
  "./ai-copilot-actions.js?v=20260713-ai-coach1",
  "./ai-request-counter.js?v=20260713-stripe-google-login1",
  "./help-content-config.js?v=20260628-help1",
  "./password-visibility.js?v=20260621-password-toggle1",
  "./auth-gate.js?v=20260712-google-auth-domain1",
  "./theme-service.js?v=20260627-theme1",
  "./profile-account.js?v=20260718-profile-cloud1",
  "./profile-wizard.js?v=20260716-cardio-empty-time1",
  "./firebase-config.js?v=20260715-exercise-animations1",
  "./exercise-animation-cloud-service.js?v=20260716-backend-admin-read1",
  "./auth-service.js?v=20260713-stripe-google-login1",
  "./firestore-cloud-service.js?v=20260718-dashboard-buttons1"
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
        keys.filter(key => ![CACHE_NAME, ANIMATION_CACHE_NAME].includes(key)).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isCloudAnimation = ["firebasestorage.googleapis.com", "storage.googleapis.com"]
    .includes(url.hostname) && decodeURIComponent(url.pathname).includes("exercise-animations/");

  if (isCloudAnimation) {
    event.respondWith(
      caches.open(ANIMATION_CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

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






