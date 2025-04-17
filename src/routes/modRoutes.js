const express = require("express")
const router = express.Router()
const modController = require("../controllers/modController")
const { protect, moderator } = require("../middleware/modMiddleware")
const { upload } = require("../middleware/uploadMiddleware")

// Apply middleware to all routes
router.use(protect)
router.use(moderator)

// Dashboard route
router.get("/dashboard", modController.getDashboardStats)

// Listings moderation routes
router.get("/listings", modController.getListingsForModeration)
router.get("/listings/:id", modController.getListingDetails)
router.post("/listings/:id/approve", modController.approveListing)
router.post("/listings/:id/reject", modController.rejectListing)
router.post("/listings/bulk-action", modController.bulkApproveRejectListings)

// User moderation routes
router.get("/users", modController.getUsersForModeration)
router.post("/users/:id/approve", modController.approveUser)
router.post("/users/:id/reject", modController.rejectUser)
router.post("/users/bulk-action", modController.bulkApproveRejectUsers)

// Interest moderation routes
router.get("/interests", modController.getInterestsForModeration)
router.post("/interests/:id/approve", modController.approveInterest)
router.post("/interests/:id/reject", modController.rejectInterest)
router.post("/interests/bulk-action", modController.bulkApproveRejectInterests)

module.exports = router