(function () {
  "use strict";

  const STRIPE_ENVIRONMENT = "sandbox";

  const STRIPE_PLANS = Object.freeze({
    premium_3: Object.freeze({
      plan: "premium_3",
      label: "Premium 3 måneder",
      priceId: "price_1TnhepJ8DJiiK3vDoqAb7oqY",
      priceDkk: 59,
      membershipDurationMonths: 3,
      aiRequestLimit: 15,
      aiRequestPeriod: "monthly"
    }),
    premium_6: Object.freeze({
      plan: "premium_6",
      label: "Premium 6 måneder",
      priceId: "price_1TomK2J8DJiiK3vD4SfYI4tq",
      priceDkk: 109,
      membershipDurationMonths: 6,
      aiRequestLimit: 15,
      aiRequestPeriod: "monthly"
    }),
    premium_12: Object.freeze({
      plan: "premium_12",
      label: "Premium 12 måneder",
      priceId: "price_1Tnhf9J8DJiiK3vDpQe8srVl",
      priceDkk: 199,
      membershipDurationMonths: 12,
      aiRequestLimit: 15,
      aiRequestPeriod: "monthly"
    })
  });

  function getPlan(plan) {
    return STRIPE_PLANS[plan] || null;
  }

  window.Work4itStripeConfig = {
    environment: STRIPE_ENVIRONMENT,
    plans: STRIPE_PLANS,
    getPlan
  };
}());
