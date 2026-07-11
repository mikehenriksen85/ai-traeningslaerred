(function () {
  "use strict";

  const ADMIN_EMAILS = Object.freeze([
    "mikehenriksen85@gmail.com"
  ]);

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isPermanentAdminEmail(email) {
    return ADMIN_EMAILS.includes(normalizeEmail(email));
  }

  function isPermanentAdminUser(user) {
    if (!user) return false;
    return isPermanentAdminEmail(user.email || user.account?.email || user.profile?.email);
  }

  function isCurrentUserAdmin() {
    const user = window.FirebaseAuthService?.getCurrentUser?.() ||
      window.Work4itAuth?.getCurrentUser?.() ||
      null;
    return isPermanentAdminUser(user);
  }

  function adminMembershipOverlay() {
    return {
      role: "admin",
      membership: "lifetime",
      membershipType: "premium_12",
      membershipStatus: "active",
      selectedPlan: "premium_12",
      isPremium: true,
      isAdmin: true,
      aiRequestLimit: -1,
      aiRequestsUsed: 0,
      aiRequestPeriod: "unlimited",
      aiRequests: -1,
      source: "permanent_admin"
    };
  }

  window.Work4itAdminConfig = Object.freeze({
    adminEmails: ADMIN_EMAILS,
    isPermanentAdminEmail,
    isPermanentAdminUser,
    isCurrentUserAdmin,
    adminMembershipOverlay
  });
})();
