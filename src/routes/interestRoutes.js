const express = require("express")
const router = express.Router()
const {
  createInterest,
  getReceivedInterests,
  getSentInterests,
  respondToInterest,
  checkInterest,
} = require("../controllers/interestController")
const { protect } = require("../middleware/authMiddleware")

// Create a new interest
router.post("/", protect, createInterest)

// Check if user has shown interest in a specific listing
router.get("/check", protect, checkInterest)

// Get all interests received by the current user
router.get("/received", protect, getReceivedInterests)

// Get all interests sent by the current user
router.get("/sent", protect, getSentInterests)

// Respond to a specific interest (accept/reject)
router.put("/:id/respond", protect, respondToInterest)

module.exports = router