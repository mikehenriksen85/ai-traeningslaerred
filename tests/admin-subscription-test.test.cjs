"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  normalizeAdminTestMode,
  subscriptionTestPolicy,
  isCompletedAdminTestStatus
} = require("../functions/subscription-test-policy");

assert.equal(normalizeAdminTestMode(true), true);
assert.equal(normalizeAdminTestMode("true"), true);
assert.equal(normalizeAdminTestMode(false), false);

assert.deepEqual(subscriptionTestPolicy({ adminTestMode: true, isPermanentAdmin: true }), {
  requested: true,
  permanentAdmin: true,
  allowed: true,
  blockNormalAdminCheckout: false
});
assert.equal(subscriptionTestPolicy({ adminTestMode: true, isPermanentAdmin: false }).allowed, false);
assert.equal(subscriptionTestPolicy({ adminTestMode: false, isPermanentAdmin: true }).blockNormalAdminCheckout, true);
assert.equal(subscriptionTestPolicy({ adminTestMode: false, isPermanentAdmin: false }).allowed, true);

assert.equal(isCompletedAdminTestStatus("free_admin_test_verified"), true);
assert.equal(isCompletedAdminTestStatus("paid_admin_test"), true);
assert.equal(isCompletedAdminTestStatus("created"), false);

const functionSource = fs.readFileSync("functions/index.js", "utf8");
const checkoutSource = fs.readFileSync("app/stripe-checkout.js", "utf8");
const membershipSource = fs.readFileSync("app/membership.js", "utf8");
const htmlSource = fs.readFileSync("app/index.html", "utf8");

assert.match(functionSource, /adminTestMode:\s*adminTest\.requested/);
assert.match(functionSource, /status:\s*adminTestMode \? "paid_admin_test" : "ignored_admin"/);
assert.match(functionSource, /permanentAdminRestored:\s*true/);
assert.match(functionSource, /exports\.runAdminSubscriptionTest/);
assert.match(checkoutSource, /checkoutStatus === "paid_admin_test"/);
assert.match(membershipSource, /createCheckout\(plan, \{ adminTestMode: true \}\)/);
assert.match(membershipSource, /isCurrentUserAdmin\?\.\(\) !== true/);
assert.match(htmlSource, /id="adminMembershipTestPanel" hidden/);

for (const plan of ["free", "premium_3", "premium_6", "premium_12"]) {
  assert.match(htmlSource, new RegExp(`data-admin-test-plan="${plan}"`));
}

console.log("Admin subscription test policy/UI contracts OK");
