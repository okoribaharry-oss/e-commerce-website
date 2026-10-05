const mongoose = require("mongoose");

const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Database is unavailable. Please try again shortly." });
  }

  return next();
};

module.exports = requireDatabase;
