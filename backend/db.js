const mongoose = require("mongoose");
let reconnectTimer;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    console.log("MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        connectDB();
      }, 10000);
      reconnectTimer.unref();
    }
    return false;
  }
};

module.exports = connectDB;
