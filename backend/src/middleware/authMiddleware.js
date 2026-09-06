import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { User } from "../models/User.js";

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (typeof req.query.token === "string" && req.query.token.trim()) {
    // Allows CSV download links (<a href>) to authenticate without a custom header
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({
      message: "Access denied. Authentication token is missing!",
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const userId = decoded.user_id || decoded.id;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload!" });
    }

    const user = await User.findById(userId).select("-password_hash");
    if (!user) {
      return res.status(401).json({ message: "Account not found or session invalid!" });
    }

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid token. Authorization denied." });
  }
}

export function generateJWT(user) {
  const payload = {
    user_id: String(user._id),
    email: user.email,
  };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
}
