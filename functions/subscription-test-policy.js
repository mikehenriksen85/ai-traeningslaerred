"use strict";

const ADMIN_TEST_COMPLETED_STATUSES = new Set([
  "free_admin_test_verified",
  "paid_admin_test"
]);

function normalizeAdminTestMode(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function subscriptionTestPolicy({ adminTestMode, isPermanentAdmin }) {
  const requested = normalizeAdminTestMode(adminTestMode);
  const permanentAdmin = isPermanentAdmin === true;
  return {
    requested,
    permanentAdmin,
    allowed: !requested || permanentAdmin,
    blockNormalAdminCheckout: permanentAdmin && !requested
  };
}

function isCompletedAdminTestStatus(status) {
  return ADMIN_TEST_COMPLETED_STATUSES.has(String(status || ""));
}

module.exports = {
  ADMIN_TEST_COMPLETED_STATUSES,
  normalizeAdminTestMode,
  subscriptionTestPolicy,
  isCompletedAdminTestStatus
};
