const { createHmac, timingSafeEqual } = require("node:crypto");

const hasValidWebhookSignature = (body, signature, secret) => {
  if (!Buffer.isBuffer(body) || typeof signature !== "string" || !secret) {
    return false;
  }

  const expected = createHmac("sha512", secret).update(body).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

const matchesSuccessfulCharge = (transaction, order) =>
  transaction?.status === "success" &&
  transaction?.currency === "NGN" &&
  Number.isSafeInteger(Number(transaction.amount)) &&
  Number(transaction.amount) === Math.round(order.totalAmount * 100);

module.exports = { hasValidWebhookSignature, matchesSuccessfulCharge };
