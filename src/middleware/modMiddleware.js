const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Protect routes - verify token
exports.protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1]

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // Get user from the token
      req.user = await User.findById(decoded.id).select("-password")

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authorized, user not found",
        })
      }

      next()
    } catch (error) {
      console.error("Error in auth middleware:", error)
      res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      })
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Not authorized, no token",
    })
  }
}

// Check if user is moderator or admin
exports.moderator = async (req, res, next) => {
  if (req.user && (req.user.role === "moderator" || req.user.role === "admin")) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: "Not authorized as moderator",
    })
  }
}

// Check if user is admin
exports.admin = async (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: "Not authorized as admin",
    })
  }
}
