const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const {
  hasValidWebhookSignature,
  matchesSuccessfulCharge
} = require("../payments/paystack");

const secret = "test-paystack-secret";
const payload = Buffer.from(JSON.stringify({
  event: "charge.success",
  data: { reference: "checkout-reference" }
}));
const signature = createHmac("sha512", secret).update(payload).digest("hex");

test("accepts a correctly signed Paystack webhook", () => {
  assert.equal(hasValidWebhookSignature(payload, signature, secret), true);
});

test("rejects missing, malformed, or invalid webhook signatures", () => {
  assert.equal(hasValidWebhookSignature(payload, undefined, secret), false);
  assert.equal(hasValidWebhookSignature(payload, "not-a-signature", secret), false);
  assert.equal(hasValidWebhookSignature(payload, "0".repeat(128), secret), false);
  assert.equal(hasValidWebhookSignature({}, signature, secret), false);
});

test("accepts only successful NGN charges for the exact server-side order total", () => {
  const order = { totalAmount: 45000 };
  assert.equal(matchesSuccessfulCharge({
    status: "success",
    currency: "NGN",
    amount: 4500000
  }, order), true);
  assert.equal(matchesSuccessfulCharge({
    status: "success",
    currency: "USD",
    amount: 4500000
  }, order), false);
  assert.equal(matchesSuccessfulCharge({
    status: "success",
    currency: "NGN",
    amount: 1
  }, order), false);
  assert.equal(matchesSuccessfulCharge({
    status: "failed",
    currency: "NGN",
    amount: 4500000
  }, order), false);
});
