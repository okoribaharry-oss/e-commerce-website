const express = require("express");
const { rateLimit } = require("express-rate-limit");
const Order = require("../models/Order");
const asyncHandler = require("../middleware/asyncHandler");
const requireDatabase = require("../middleware/requireDatabase");
const {
  hasValidWebhookSignature,
  matchesSuccessfulCharge
} = require("../payments/paystack");

const router = express.Router();
const verifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment verification attempts. Please try again later." }
});
const referencePattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

const markOrderPaid = async transaction => {
  const reference = transaction?.reference;
  if (typeof reference !== "string" || !referencePattern.test(reference)) return null;

  const order = await Order.findOne({
    paymentMethod: "paystack",
    paymentReference: reference
  });
  if (
    !order ||
    order.status === "cancelled" ||
    !matchesSuccessfulCharge(transaction, order)
  ) {
    return null;
  }

  if (order.paymentStatus !== "paid") {
    order.paymentStatus = "paid";
    if (order.status === "pending") order.status = "processing";
    await order.save();
  }

  return order;
};

router.get("/verify/:reference", verifyRateLimit, requireDatabase, asyncHandler(async (req, res) => {
  const { reference } = req.params;
  if (!referencePattern.test(reference)) {
    return res.status(400).json({ message: "Payment reference is invalid." });
  }
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(503).json({ message: "Secure payment verification is not configured." });
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      signal: AbortSignal.timeout(10000)
    }
  );
  const result = await response.json();
  if (!response.ok || result?.status !== true || !result.data) {
    console.error("Paystack payment verification failed.", { status: response.status });
    return res.status(502).json({ message: "Payment verification is temporarily unavailable." });
  }

  const order = await markOrderPaid(result.data);
  if (!order) {
    return res.json({ paid: false });
  }

  return res.json({
    paid: true,
    order: {
      id: String(order._id),
      paymentStatus: order.paymentStatus,
      status: order.status
    }
  });
}));

const paystackWebhook = async (req, res, next) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.get("x-paystack-signature");
    if (!hasValidWebhookSignature(req.body, signature, secret)) {
      return res.status(401).json({ message: "Invalid webhook signature." });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ message: "Invalid webhook payload." });
    }

    if (event.event === "charge.success") {
      const order = await markOrderPaid(event.data);
      if (!order) {
        console.error("Paystack success webhook did not match a valid order.");
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};

module.exports = { router, paystackWebhook };
