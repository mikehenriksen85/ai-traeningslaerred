"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { canonicalCheckoutLineItem } = require("../functions/stripe-pricing-policy");

const stripeConfigSource = fs.readFileSync("app/stripe-config.js", "utf8");
const membershipSource = fs.readFileSync("app/membership.js", "utf8");
const html = fs.readFileSync("app/index.html", "utf8");
const functionSource = fs.readFileSync("functions/index.js", "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(stripeConfigSource, sandbox);

const expected = Object.freeze({ premium_3: 59, premium_6: 109, premium_12: 199 });
for (const [plan, priceDkk] of Object.entries(expected)) {
  assert.equal(sandbox.window.Work4itStripeConfig.getPlan(plan).priceDkk, priceDkk, `${plan} client Stripe price`);
  assert.match(membershipSource, new RegExp(`${plan}: ${priceDkk}`), `${plan} membership tier price`);
  assert.match(functionSource, new RegExp(`${plan}:[\\s\\S]*?fallbackPriceDkk: ${priceDkk}`), `${plan} backend canonical price`);
}

assert.match(html, /id="membershipPriceQuarterly">59 kr\.<\/div>/);
assert.match(html, /id="membershipPriceSemiannual">109 kr\.<\/div>/);
assert.match(html, /id="membershipPriceYearly">199 kr\.<\/div>/);
assert.match(html, /id="membershipPopupPriceSemiannual">109 kr\. · 15 AI Requests\/md\.<\/span>/);

assert.match(functionSource, /require\("\.\/stripe-pricing-policy"\)/);
assert.match(functionSource, /line_items: \[checkoutPrice\.lineItem\]/);
assert.match(functionSource, /priceDkk = checkoutPrice\.canonicalUnitAmount \/ 100/);
assert.match(functionSource, /priceSource: checkoutPrice\.priceSource/);

const premium6Block = functionSource.match(/premium_6: Object\.freeze\(\{[\s\S]*?\}\)/)?.[0] || "";
assert.match(premium6Block, /fallbackPriceDkk: 109/);
assert.doesNotMatch(premium6Block, /119/);

const sixMonthConfig = {
  label: "Work4it Premium 6 måneder",
  priceId: "price_six_month_catalog",
  fallbackPriceDkk: 109
};
const matchingPrice = canonicalCheckoutLineItem({
  unit_amount: 10900,
  currency: "dkk",
  product: "prod_work4it",
  recurring: { interval: "month", interval_count: 6 }
}, sixMonthConfig, { warn() {} });
assert.deepEqual(matchingPrice.lineItem, { price: "price_six_month_catalog", quantity: 1 });
assert.equal(matchingPrice.priceSource, "stripe_catalog");

let mismatchWarning = null;
const mismatchingPrice = canonicalCheckoutLineItem({
  unit_amount: 11900,
  currency: "dkk",
  product: "prod_work4it",
  recurring: { interval: "month", interval_count: 6 }
}, sixMonthConfig, { warn: (_message, detail) => { mismatchWarning = detail; } });
assert.equal(mismatchingPrice.canonicalUnitAmount, 10900);
assert.equal(mismatchingPrice.priceSource, "canonical_inline");
assert.deepEqual(mismatchingPrice.lineItem, {
  price_data: {
    currency: "dkk",
    unit_amount: 10900,
    product: "prod_work4it",
    recurring: { interval: "month", interval_count: 6 }
  },
  quantity: 1
});
assert.deepEqual(mismatchWarning, {
  plan: "Work4it Premium 6 måneder",
  priceId: "price_six_month_catalog",
  stripeUnitAmount: 11900,
  canonicalUnitAmount: 10900
});

console.log("Membership and Stripe Checkout prices are consistent: 59 / 109 / 199 DKK");
