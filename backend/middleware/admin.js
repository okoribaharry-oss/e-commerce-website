const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Administrator access required" });
  }

  return next();
};

module.exports = adminOnly;
