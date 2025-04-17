const User = require("../models/User")
const ProductListing = require("../models/ProductListing")
const ServiceListing = require("../models/ServiceListing")
const JobListing = require("../models/JobListing")
const MatrimonyListing = require("../models/MatrimonyListing")
const BaseListing = require("../models/BaseListing")
const AdminDashboard = require("../models/Admin")
const Interest = require("../models/Interest")
const Notification = require("../models/Notification")

// Listing models mapping
const ListingModels = {
  product: ProductListing,
  service: ServiceListing,
  job: JobListing,
  matrimony: MatrimonyListing,
}

// Explicit exports with error handling wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
const getDashboardStatistics = asyncHandler(async (req, res) => {
  try {
    // If AdminDashboard model has an updateStatistics method, use it
    if (typeof AdminDashboard.updateStatistics === 'function') {
      const dashboard = await AdminDashboard.updateStatistics()
      return res.status(200).json({
        success: true,
        data: dashboard,
      })
    }
    
    // Otherwise, calculate statistics directly
    // Count total users
    const totalUsers = await User.countDocuments()
    const activeUsers = await User.countDocuments({ status: "active" })
    const pendingUsers = await User.countDocuments({ status: "pending" })
    const rejectedUsers = await User.countDocuments({ status: "rejected" })

    // Count listings by type
    const productCount = await ProductListing.countDocuments()
    const serviceCount = await ServiceListing.countDocuments()
    const jobCount = await JobListing.countDocuments()
    const matrimonyCount = await MatrimonyListing.countDocuments()

    // Count listings by status
    const activeListingsCount = await BaseListing.countDocuments({ status: "active" })
    const pendingListingsCount = await BaseListing.countDocuments({ status: "pending" })
    const rejectedListingsCount = await BaseListing.countDocuments({ status: "rejected" })
    const inactiveListingsCount = await BaseListing.countDocuments({ status: "inactive" })

    // Calculate changes (mock data for now)
    const adsLiveChange = 5
    const adsPendingChange = -10
    const activeUsersChange = 8
    const deactivatedUsersChange = 2
    const adsRejectedChange = -5

    res.status(200).json({
      totalAdsLive: activeListingsCount,
      totalAdsPending: pendingListingsCount,
      totalActiveUsers: activeUsers,
      totalDeactivatedUsers: totalUsers - activeUsers,
      totalAdsRejected: rejectedListingsCount,
      adsLiveChange,
      adsPendingChange,
      activeUsersChange,
      deactivatedUsersChange,
      adsRejectedChange,
      productCount,
      serviceCount,
      jobCount,
      matrimonyCount,
      pendingListingsCount,
      activeListingsCount,
      rejectedListingsCount,
      inactiveListingsCount,
    })
  } catch (error) {
    console.error("Error getting dashboard statistics:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
})

// @desc    Get users with filtering and pagination
// @route   GET /api/admin/users
const getUsers = asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 10
  const skipIndex = (page - 1) * limit

  // Filtering options
  const filters = {}
  if (req.query.role && req.query.role !== "all") filters.role = req.query.role
  if (req.query.status && req.query.status !== "all") filters.status = req.query.status
  // Support for legacy isActive filter
  if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === "true"

  // Search
  if (req.query.search) {
    filters.$or = [
      { firstName: { $regex: req.query.search, $options: "i" } },
      { lastName: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
      { username: { $regex: req.query.search, $options: "i" } },
    ]
  }

  // Execute query
  const totalUsers = await User.countDocuments(filters)
  const users = await User.find(filters).select("-password").sort({ createdAt: -1 }).limit(limit).skip(skipIndex)

  res.status(200).json({
    success: true,
    count: users.length,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
    data: users,
  })
})

// @desc    Bulk user actions
// @route   POST /api/admin/users/bulk
const bulkUserActions = asyncHandler(async (req, res) => {
  const { action, userIds, value } = req.body

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user IDs",
    })
  }

  let result
  switch (action) {
    // New status approach
    case "status":
      if (!["active", "inactive", "suspended"].includes(value)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        })
      }
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { status: value } })
      break;
    case "role":
      if (!["user", "moderator", "admin"].includes(value)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role value",
        })
      }
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { role: value } })
      break;
    // Legacy approaches
    case "activate":
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive: true, status: "active" } })
      break;
    case "deactivate":
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive: false, status: "inactive" } })
      break;
    case "delete":
      result = await User.deleteMany({ _id: { $in: userIds } })
      break;
    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount || result.deletedCount} users updated successfully`,
    modifiedCount: result.modifiedCount || result.deletedCount,
  })
})

// @desc    Get all listings with filtering
// @route   GET /api/admin/listings
const getListings = asyncHandler(async (req, res) => {
  try {
    const { type = "all", status = "all", page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Build query
    const query = {}

    // Filter by status if provided
    if (status !== "all") {
      query.status = status
    }

    // Filter by type if provided
    if (type !== "all") {
      query.__t = type.charAt(0).toUpperCase() + type.slice(1) + "Listing"
    }

    // Get listings with pagination
    const listings = await BaseListing.find(query)
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))

    // Get total count for pagination
    const total = await BaseListing.countDocuments(query)

    res.status(200).json({
      success: true,
      data: listings,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    })
  } catch (error) {
    console.error("Error getting listings:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
})

// @desc    Bulk listing actions
// @route   POST /api/admin/listings/bulk
const bulkListingActions = asyncHandler(async (req, res) => {
  const { action, listingIds, type, reason } = req.body

  // Validate input
  if (!listingIds || !Array.isArray(listingIds)) {
    return res.status(400).json({
      success: false,
      message: "Invalid listing IDs",
    })
  }

  let result;
  let ListingModel = BaseListing; // Default to BaseListing

  // If specific type provided, use the corresponding model
  if (type && ListingModels[type]) {
    ListingModel = ListingModels[type];
  }

  switch (action) {
    // New approach
    case "approve":
      result = await ListingModel.updateMany({ _id: { $in: listingIds } }, { $set: { status: "active" } })

      // Create notifications for approved listings
      const approvedListings = await ListingModel.find({ _id: { $in: listingIds } })
      for (const listing of approvedListings) {
        await Notification.createNotification({
          user: listing.user,
          type: "listing_approved",
          content: `Your listing "${listing.title}" has been approved`,
          relatedEntity: {
            entityId: listing._id,
            type: "Listing",
          },
        })
      }
      break;

    case "reject":
      result = await ListingModel.updateMany(
        { _id: { $in: listingIds } },
        {
          $set: {
            status: "rejected",
            rejectionReason: reason || "Did not meet community guidelines",
          },
        },
      )

      // Create notifications for rejected listings
      const rejectedListings = await ListingModel.find({ _id: { $in: listingIds } })
      for (const listing of rejectedListings) {
        await Notification.createNotification({
          user: listing.user,
          type: "listing_rejected",
          content: `Your listing "${listing.title}" has been rejected: ${reason || "Did not meet community guidelines"}`,
          relatedEntity: {
            entityId: listing._id, // Fixed: was listing._i in original
            type: "Listing",
          },
        })
      }
      break;

    // Legacy approach
    case "activate":
      result = await ListingModel.updateMany({ _id: { $in: listingIds } }, { $set: { status: "active" } })
      break;
    case "deactivate":
      result = await ListingModel.updateMany({ _id: { $in: listingIds } }, { $set: { status: "inactive" } })
      break;
    case "delete":
      result = await ListingModel.deleteMany({ _id: { $in: listingIds } })
      break;
    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount || result.deletedCount || result.matchedCount} listings updated successfully`,
    modifiedCount: result.modifiedCount || result.deletedCount || result.matchedCount,
  })
})

// @desc    Get interests with filtering
// @route   GET /api/admin/interests
const getInterests = asyncHandler(async (req, res) => {
  try {
    const { status = "all", page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Build query
    const query = {}

    // Filter by status if provided
    if (status !== "all") {
      query.status = status
    }

    // Get interests with pagination
    const interests = await Interest.find(query)
      .populate("sender", "firstName lastName email")
      .populate("receiver", "firstName lastName email")
      .populate("listing")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))

    // Get total count for pagination
    const total = await Interest.countDocuments(query)

    res.status(200).json({
      success: true,
      data: interests,
      totalPages: Math.ceil(total / limit),
      currentPage: Number.parseInt(page),
      total,
    })
  } catch (error) {
    console.error("Error getting interests:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
})

// @desc    Bulk interest actions
// @route   POST /api/admin/interests/bulk
const bulkInterestActions = asyncHandler(async (req, res) => {
  const { action, interestIds, reason } = req.body

  // Validate input
  if (!interestIds || !Array.isArray(interestIds)) {
    return res.status(400).json({
      success: false,
      message: "Invalid interest IDs",
    })
  }

  let result

  switch (action) {
    case "approve":
      result = await Interest.updateMany({ _id: { $in: interestIds } }, { $set: { status: "accepted" } })

      // Create notifications for approved interests
      const approvedInterests = await Interest.find({ _id: { $in: interestIds } })
      for (const interest of approvedInterests) {
        // Notify sender
        await Notification.createNotification({
          user: interest.sender,
          type: "interest_accepted",
          content: "Your interest has been approved by an admin",
          relatedEntity: {
            entityId: interest._id,
            type: "Interest",
          },
        })

        // Notify receiver
        await Notification.createNotification({
          user: interest.receiver,
          type: "interest_received",
          content: "You have received a new approved interest",
          relatedEntity: {
            entityId: interest._id,
            type: "Interest",
          },
        })
      }
      break;

    case "reject":
      result = await Interest.updateMany(
        { _id: { $in: interestIds } },
        {
          $set: {
            status: "rejected",
            rejectionReason: reason || "Did not meet community guidelines",
          },
        },
      )

      // Create notifications for rejected interests
      const rejectedInterests = await Interest.find({ _id: { $in: interestIds } })
      for (const interest of rejectedInterests) {
        await Notification.createNotification({
          user: interest.sender,
          type: "interest_rejected",
          content: `Your interest has been rejected: ${reason || "Did not meet community guidelines"}`,
          relatedEntity: {
            entityId: interest._id,
            type: "Interest",
          },
        })
      }
      break;

    case "delete":
      result = await Interest.deleteMany({ _id: { $in: interestIds } })
      break;

    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount || result.deletedCount} interests updated successfully`,
    modifiedCount: result.modifiedCount || result.deletedCount,
  })
})

// @desc    Get analytics overview
// @route   GET /api/admin/analytics/overview
const getAnalyticsOverview = asyncHandler(async (req, res) => {
  try {
    // Get counts for different entities
    const totalUsers = await User.countDocuments()
    const totalListings = await BaseListing.countDocuments()
    const totalInterests = await Interest.countDocuments()

    // Get counts by status
    const activeUsers = await User.countDocuments({ status: "active" })
    const activeListings = await BaseListing.countDocuments({ status: "active" })
    const acceptedInterests = await Interest.countDocuments({ status: "accepted" })

    // Get counts by type
    const productListings = await ProductListing.countDocuments()
    const serviceListings = await ServiceListing.countDocuments()
    const jobListings = await JobListing.countDocuments()
    const matrimonyListings = await MatrimonyListing.countDocuments()

    // Generate trend data (mock data for now)
    const listingsTrend = generateTrendData(7)
    const usersTrend = generateTrendData(7)
    const interestsTrend = generateTrendData(7)

    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalUsers,
          totalListings,
          totalInterests,
          activeUsers,
          activeListings,
          acceptedInterests,
        },
        byType: {
          productListings,
          serviceListings,
          jobListings,
          matrimonyListings,
        },
        trends: {
          listingsTrend,
          usersTrend,
          interestsTrend,
        },
      },
    })
  } catch (error) {
    console.error("Error getting analytics overview:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
})

// Helper function to generate trend data
function generateTrendData(days) {
  const data = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      listings: Math.floor(Math.random() * 10) + 5,
      users: Math.floor(Math.random() * 5) + 2,
      interests: Math.floor(Math.random() * 15) + 8,
    })
  }

  return data
}

// @desc    Get system configuration
// @route   GET /api/admin/system-config
const getSystemConfig = asyncHandler(async (req, res) => {
  try {
    // Check if AdminDashboard has system config
    const adminDashboard = await AdminDashboard.findOne({});
    if (adminDashboard && adminDashboard.systemConfig) {
      return res.status(200).json(adminDashboard.systemConfig);
    }
    
    // Default fallback config
    const config = {
      siteName: "FreecoSystem",
      siteDescription: "A platform for free exchange of goods and services",
      contactEmail: "support@freecosystem.com",
      contactPhone: "+1234567890",
      maxImagesPerAd: 4,
      maxAdDurationDays: 30,
      requireModeration: true,
      allowUserRegistration: true,
      maintenanceMode: false,
    }

    res.status(200).json(config)
  } catch (error) {
    console.error("Error in getSystemConfig:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
})

// @desc    Update system configuration
// @route   PUT /api/admin/system-config
const updateSystemConfig = asyncHandler(async (req, res) => {
  try {
    const { maintenanceMode, disclaimerText, termsOfService, ...otherConfig } = req.body

    // Find or create dashboard
    const dashboard = await AdminDashboard.findOne({}) || new AdminDashboard();
    
    // Initialize systemConfig if it doesn't exist
    if (!dashboard.systemConfig) {
      dashboard.systemConfig = {};
    }

    // Update specific fields
    if (maintenanceMode !== undefined) {
      dashboard.systemConfig.maintenanceMode = maintenanceMode;
    }
    
    if (disclaimerText) {
      dashboard.systemConfig.disclaimerText = disclaimerText;
    }
    
    if (termsOfService) {
      dashboard.systemConfig.termsOfService = termsOfService;
    }
    
    // Update any other provided config fields
    Object.keys(otherConfig).forEach(key => {
      dashboard.systemConfig[key] = otherConfig[key];
    });

    await dashboard.save();

    res.status(200).json({
      success: true,
      message: "System configuration updated successfully",
      data: dashboard.systemConfig
    })
  } catch (error) {
    console.error("Error in updateSystemConfig:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
})

// Export all methods
module.exports = {
  getDashboardStatistics,
  getUsers,
  bulkUserActions,
  getListings,
  bulkListingActions,
  getInterests,
  bulkInterestActions,
  getAnalyticsOverview,
  getSystemConfig,
  updateSystemConfig,
}