"use strict";

function canonicalCheckoutLineItem(stripePrice, config, logger = console) {
  const canonicalUnitAmount = Math.round(Number(config.fallbackPriceDkk) * 100);
  const stripeUnitAmount = Number(stripePrice?.unit_amount);
  if (stripeUnitAmount === canonicalUnitAmount) {
    return {
      lineItem: { price: config.priceId, quantity: 1 },
      priceSource: "stripe_catalog",
      canonicalUnitAmount
    };
  }

  const productId = typeof stripePrice?.product === "string"
    ? stripePrice.product
    : stripePrice?.product?.id || "";
  const recurring = stripePrice?.recurring
    ? {
        interval: stripePrice.recurring.interval,
        interval_count: Math.max(1, Number(stripePrice.recurring.interval_count) || 1)
      }
    : null;
  const priceData = {
    currency: String(stripePrice?.currency || "dkk").toLowerCase(),
    unit_amount: canonicalUnitAmount,
    ...(productId
      ? { product: productId }
      : { product_data: { name: config.label } }),
    ...(recurring ? { recurring } : {})
  };
  logger.warn?.("[Work4it Stripe] Catalog price differed from canonical Work4it price; Checkout uses canonical amount.", {
    plan: config.label,
    priceId: config.priceId,
    stripeUnitAmount,
    canonicalUnitAmount
  });
  return {
    lineItem: { price_data: priceData, quantity: 1 },
    priceSource: "canonical_inline",
    canonicalUnitAmount
  };
}

module.exports = { canonicalCheckoutLineItem };
