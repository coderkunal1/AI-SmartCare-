const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]?.trim();

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "super_secret_token_key";
    const decoded = jwt.verify(token, JWT_SECRET);

    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = auth;