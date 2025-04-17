const express = require("express")
const router = express.Router()
const adminController = require("../controllers/adminController")
const modController = require("../controllers/modController")
const { protect, adminProtect } = require("../middleware/authMiddleware")

// Apply middleware to all routes
router.use(protect)
router.use(adminProtect)

// Dashboard statistics
router.get("/dashboard", adminController.getDashboardStatistics)

// User management routes
router.get("/users", adminController.getUsers)
router.post("/users/bulk", adminController.bulkUserActions)

// Listing management routes
router.get("/listings", adminController.getListings)
router.post("/listings/bulk", adminController.bulkListingActions)

// Interest management routes
router.get("/interests", adminController.getInterests)
router.post("/interests/bulk", adminController.bulkInterestActions)

// Analytics routes
router.get("/analytics/overview", adminController.getAnalyticsOverview)
router.get("/analytics/listings", (req, res) => {
  // Placeholder until you implement getListingsAnalytics
  res.status(501).json({ message: "Not implemented yet" });
})
router.get("/analytics/users", (req, res) => {
  // Placeholder until you implement getUsersAnalytics
  res.status(501).json({ message: "Not implemented yet" });
})

// System configuration routes
router.get("/system-config", adminController.getSystemConfig)
router.put("/system-config", adminController.updateSystemConfig)

// Add routes for admin to access moderator functionality
router.get("/mod/listings", modController.getListingsForModeration)
router.get("/mod/listings/:id", modController.getListingDetails)
router.post("/mod/listings/approve/:id", modController.approveListing)
router.post("/mod/listings/reject/:id", modController.rejectListing)
router.post("/mod/listings/bulk-approve-reject", modController.bulkApproveRejectListings)
router.get("/mod/users", modController.getUsersForModeration)
router.post("/mod/users/approve/:id", modController.approveUser)
router.post("/mod/users/reject/:id", modController.rejectUser)
router.post("/mod/users/bulk-approve-reject", modController.bulkApproveRejectUsers)
router.get("/mod/interests", modController.getInterestsForModeration)
router.post("/mod/interests/approve/:id", modController.approveInterest)
router.post("/mod/interests/reject/:id", modController.rejectInterest)
router.post("/mod/interests/bulk-approve-reject", modController.bulkApproveRejectInterests)

module.exports = router