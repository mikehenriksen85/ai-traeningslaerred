(function () {
  "use strict";

  const STRIPE_ENVIRONMENT = "sandbox";

  const STRIPE_PLANS = Object.freeze({
    quarterly: Object.freeze({
      plan: "quarterly",
      label: "Premium 3 måneder",
      priceId: "price_1TnhepJ8DJiiK3vDoqAb7oqY",
      priceDkk: 59,
      aiRequestLimit: 15,
      aiRequestPeriod: "monthly"
    }),
    yearly: Object.freeze({
      plan: "yearly",
      label: "Premium 12 måneder",
      priceId: "price_1Tnhf9J8DJiiK3vDpQe8srVl",
      priceDkk: 199,
      aiRequestLimit: 15,
      aiRequestPeriod: "monthly"
    }),
    lifetime: Object.freeze({
      plan: "lifetime",
      label: "Livstid",
      priceId: "price_1TnhfNJ8DJiiK3vDCYTp8C4e",
      priceDkk: 449,
      aiRequestLimit: 30,
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
