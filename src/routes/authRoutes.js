const express = require("express")
const router = express.Router()
const authController = require("../controllers/authController")
const { protect } = require("../middleware/authMiddleware")

// Public routes
router.post("/register", authController.registerUser)
router.post("/verify-otp", authController.verifyOTP)
router.post("/login", authController.loginUser)

// Protected routes
router.get("/profile", protect, authController.getUserProfile)
router.put("/profile", protect, authController.updateUserProfile)

module.exports = router
