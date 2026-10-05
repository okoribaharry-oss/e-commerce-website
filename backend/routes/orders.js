const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const products = require("../products");
const { protect } = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const asyncHandler = require("../middleware/asyncHandler");
const requireDatabase = require("../middleware/requireDatabase");

const router = express.Router();
const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const requiredAddressFields = ["fullName", "phone", "address", "city", "state"];

const optionalProtect = (req, res, next) => {
  if (!req.headers.authorization) {
    return next();
  }

  return protect(req, res, next);
};

const restoreReservedStock = async reservations => {
  while (reservations.length > 0) {
    const reservation = reservations[reservations.length - 1];
    await Product.updateOne(
      { _id: reservation.id },
      { $inc: { stock: reservation.quantity } }
    );
    reservations.pop();
  }
};

router.post("/", requireDatabase, optionalProtect, asyncHandler(async (req, res) => {
  const { items, shippingAddress, customer = {}, paymentMethod = "manual" } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Order must include at least one item." });
  }
  if (items.length > 50) {
    return res.status(400).json({ message: "An order can contain at most 50 line items." });
  }

  if (!shippingAddress || requiredAddressFields.some(field =>
    typeof shippingAddress[field] !== "string" || !shippingAddress[field].trim()
  )) {
    return res.status(400).json({ message: "Complete all shipping address fields." });
  }

  const customerEmail = typeof customer?.email === "string" ? customer.email.trim().toLowerCase() : "";
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  if (requiredAddressFields.some(field => shippingAddress[field].trim().length > 200)) {
    return res.status(400).json({ message: "A delivery detail is too long." });
  }

  if (!["manual", "cash_on_delivery"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Choose a supported payment method." });
  }

  const requestedItems = new Map();
  for (const item of items) {
    const quantity = Number(item?.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ message: "Order contains an invalid product or quantity." });
    }

    const key = String(item?.productId);
    const combinedQuantity = (requestedItems.get(key)?.quantity || 0) + quantity;
    if (combinedQuantity > 99) {
      return res.status(400).json({ message: "Maximum quantity per product is 99." });
    }
    requestedItems.set(key, { productId: item?.productId, quantity: combinedQuantity });
  }

  const orderItems = [];
  const stockReservations = [];
  try {
    for (const { productId, quantity } of requestedItems.values()) {
      const catalogProduct = products.find(product => product.id === Number(productId));
      if (catalogProduct) {
        orderItems.push({
          catalogProductId: catalogProduct.id,
          name: catalogProduct.name,
          price: catalogProduct.price,
          quantity
        });
        continue;
      }

      if (typeof productId === "string" && mongoose.isValidObjectId(productId)) {
        const databaseProduct = await Product.findOne({ _id: productId, isActive: true });
        if (databaseProduct && databaseProduct.stock >= quantity) {
          const reservation = await Product.updateOne(
            { _id: databaseProduct._id, isActive: true, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } }
          );
          if (reservation.modifiedCount !== 1) {
            await restoreReservedStock(stockReservations);
            return res.status(409).json({ message: `${databaseProduct.name} no longer has enough stock.` });
          }
          stockReservations.push({ id: databaseProduct._id, quantity });
          orderItems.push({
            product: databaseProduct._id,
            name: databaseProduct.name,
            price: databaseProduct.price,
            quantity
          });
          continue;
        }
      }

      await restoreReservedStock(stockReservations);
      return res.status(400).json({ message: "Order contains an unavailable product or insufficient stock." });
    }
  } catch (error) {
    await restoreReservedStock(stockReservations);
    throw error;
  }

  let order;
  try {
    order = await Order.create({
      user: req.user?._id,
      customer: {
        name: shippingAddress.fullName.trim(),
        email: customerEmail,
        phone: shippingAddress.phone.trim()
      },
      items: orderItems,
      totalAmount: orderItems.reduce((total, item) => total + item.price * item.quantity, 0),
      shippingAddress: Object.fromEntries(requiredAddressFields.map(field => [field, shippingAddress[field].trim()])),
      paymentMethod
    });
  } catch (error) {
    await restoreReservedStock(stockReservations);
    throw error;
  }

  return res.status(201).json({
    message: "Order created successfully.",
    order
  });
}));

router.get("/mine", requireDatabase, protect, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.json({ orders });
}));

router.get("/", requireDatabase, protect, adminOnly, asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  return res.json({ orders });
}));

router.patch("/:id/status", requireDatabase, protect, adminOnly, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Choose a valid order status." });
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  return res.json({ order });
}));

module.exports = router;
