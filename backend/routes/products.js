const express = require("express");
const mongoose = require("mongoose");
const products = require("../products");
const Product = require("../models/Product");
const { protect } = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const asyncHandler = require("../middleware/asyncHandler");
const requireDatabase = require("../middleware/requireDatabase");

const router = express.Router();

const serializeProduct = product => ({
  id: String(product._id),
  name: product.name,
  description: product.description,
  category: product.category,
  price: product.price,
  image: product.image || "",
  rating: 0,
  badge: "",
  stock: product.stock
});

router.get("/", asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim().toLowerCase() : "";
  const databaseProducts = mongoose.connection.readyState === 1
    ? await Product.find({ isActive: true }).lean()
    : [];
  const catalog = [
    ...products,
    ...databaseProducts.map(serializeProduct)
  ];
  const filteredProducts = catalog.filter(product =>
    (!search || product.name.toLowerCase().includes(search)) &&
    (!category || category === "all" || product.category === category)
  );

  res.json({ products: filteredProducts });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const product = products.find(item => item.id === Number(req.params.id));
  if (product) {
    return res.json({ product });
  }

  if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(req.params.id)) {
    const databaseProduct = await Product.findOne({ _id: req.params.id, isActive: true }).lean();
    if (databaseProduct) {
      return res.json({ product: serializeProduct(databaseProduct) });
    }
  }

  return res.status(404).json({ message: "Product not found" });
}));

router.post("/", requireDatabase, protect, adminOnly, asyncHandler(async (req, res) => {
  const { name, description, price, category, image = "", stock = 0 } = req.body || {};
  const product = await Product.create({ name, description, price, category, image, stock });
  return res.status(201).json({ product: serializeProduct(product) });
}));

router.patch("/:id", requireDatabase, protect, adminOnly, asyncHandler(async (req, res) => {
  const allowedFields = ["name", "description", "price", "category", "image", "stock", "isActive"];
  const updates = Object.fromEntries(
    Object.entries(req.body || {}).filter(([field]) => allowedFields.includes(field))
  );
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "Provide at least one product field to update." });
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json({ product: serializeProduct(product) });
}));

router.delete("/:id", requireDatabase, protect, adminOnly, asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json({ message: "Product removed from the storefront." });
}));

module.exports = router;
