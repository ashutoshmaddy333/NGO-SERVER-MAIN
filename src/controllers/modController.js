const User = require("../models/User")
const BaseListing = require("../models/BaseListing")
const ProductListing = require("../models/ProductListing")
const ServiceListing = require("../models/ServiceListing")
const JobListing = require("../models/JobListing")
const MatrimonyListing = require("../models/MatrimonyListing")
const Interest = require("../models/Interest")
const Notification = require("../models/Notification")
const mongoose = require("mongoose")

// Mapping of listing types to their models
const listingModels = {
  product: ProductListing,
  service: ServiceListing,
  job: JobListing,
  matrimony: MatrimonyListing,
}

// Dashboard Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      pendingListingsCount,
      pendingUsersCount,
      pendingInterestsCount,
      approvedListingsCount,
      approvedUsersCount,
      approvedInterestsCount,
      rejectedListingsCount
    ] = await Promise.all([
      BaseListing.countDocuments({ status: "pending" }),
      User.countDocuments({ status: "pending" }),
      Interest.countDocuments({ status: "pending" }),
      BaseListing.countDocuments({ status: "active" }),
      User.countDocuments({ status: "active" }),
      Interest.countDocuments({ status: "approved" }),
      BaseListing.countDocuments({ status: "rejected" })
    ])

    res.status(200).json({
      success: true,
      data: {
        pending: {
          listings: pendingListingsCount,
          users: pendingUsersCount,
          interests: pendingInterestsCount,
        },
        approved: {
          listings: approvedListingsCount,
          users: approvedUsersCount,
          interests: approvedInterestsCount,
        },
        rejected: {
          listings: rejectedListingsCount,
        },
      },
    })
  } catch (error) {
    console.error("Error getting dashboard stats:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Listings Moderation
exports.getListingsForModeration = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 10, type } = req.query
    const skip = (page - 1) * limit

    const query = { status }
    if (type && type !== "all") {
      query.__t = type.charAt(0).toUpperCase() + type.slice(1) + "Listing"
    }

    const [listings, total] = await Promise.all([
      BaseListing.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BaseListing.countDocuments(query)
    ])

    res.status(200).json({
      success: true,
      data: {
        listings,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error getting listings:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.getListingDetails = async (req, res) => {
  try {
    const listing = await BaseListing.findById(req.params.id)
      .populate("user", "firstName lastName email phoneNumber")

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      })
    }

    res.status(200).json({
      success: true,
      data: listing,
    })
  } catch (error) {
    console.error("Error getting listing details:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.approveListing = async (req, res) => {
  try {
    const listing = await BaseListing.findByIdAndUpdate(
      req.params.id,
      {
        status: "active",
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
      },
      { new: true }
    )

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      })
    }

    // await createNotification({
    //   user: listing.user,
    //   type: "listing_approved",
    //   content: `Your listing "${listing.title || listing.jobTitle}" has been approved`,
    //   relatedEntity: {
    //     entityId: listing._id,
    //     type: "Listing",
    //   },
    // })

    res.status(200).json({
      success: true,
      message: "Listing approved",
      data: listing,
    })
  } catch (error) {
    console.error("Error approving listing:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.rejectListing = async (req, res) => {
  try {
    const { reason } = req.body
    const listing = await BaseListing.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
        rejectionReason: reason || "Did not meet community guidelines",
      },
      { new: true }
    )

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      })
    }

    // await createNotification({
    //   user: listing.user,
    //   type: "listing_rejected",
    //   content: `Your listing "${listing.title || listing.jobTitle}" has been rejected`,
    //   relatedEntity: {
    //     entityId: listing._id,
    //     type: "Listing",
    //   },
    // })

    res.status(200).json({
      success: true,
      message: "Listing rejected",
      data: listing,
    })
  } catch (error) {
    console.error("Error rejecting listing:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.bulkApproveRejectListings = async (req, res) => {
  try {
    const { ids, action, reason } = req.body

    if (!ids?.length || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      })
    }

    // Validate all IDs are valid MongoDB ObjectIds
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id))
    if (validIds.length !== ids.length) {
      return res.status(400).json({
        success: false,
        message: "Some IDs are invalid",
      })
    }

    const updateData = {
      status: action === "approve" ? "active" : "rejected",
      moderatedBy: req.user._id,
      moderatedAt: Date.now(),
    }

    if (action === "reject") {
      updateData.rejectionReason = reason || "Did not meet community guidelines"
    }

    const result = await BaseListing.updateMany(
      { _id: { $in: validIds } },
      { $set: updateData }
    )

    // Send notifications
    // if (result.modifiedCount > 0) {
    //   const listings = await BaseListing.find({ _id: { $in: validIds } })
    //   await Promise.all(
    //     listings.map(listing =>
    //       createNotification({
    //         user: listing.user,
    //         type: `listing_${action === "approve" ? "approved" : "rejected"}`,
    //         content: `Your listing has been ${action === "approve" ? "approved" : "rejected"}`,
    //         relatedEntity: {
    //           entityId: listing._id,
    //           type: "Listing",
    //         },
    //       })
    //     )
    //   )
    // }

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} listings ${action === "approve" ? "approved" : "rejected"}`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    })
  } catch (error) {
    console.error("Error in bulk action:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Users Moderation
exports.getUsersForModeration = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      User.find({ status })
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments({ status })
    ])

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error getting users:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.approveUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: "active",
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
      },
      { new: true }
    ).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    await createNotification({
      user: user._id,
      type: "account_approved",
      content: "Your account has been approved",
      relatedEntity: {
        entityId: user._id,
        type: "User",
      },
    })

    res.status(200).json({
      success: true,
      message: "User approved",
      data: user,
    })
  } catch (error) {
    console.error("Error approving user:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.rejectUser = async (req, res) => {
  try {
    const { reason } = req.body
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
        rejectionReason: reason || "Did not meet community guidelines",
      },
      { new: true }
    ).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    await createNotification({
      user: user._id,
      type: "account_rejected",
      content: `Your account has been rejected: ${user.rejectionReason}`,
      relatedEntity: {
        entityId: user._id,
        type: "User",
      },
    })

    res.status(200).json({
      success: true,
      message: "User rejected",
      data: user,
    })
  } catch (error) {
    console.error("Error rejecting user:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.bulkApproveRejectUsers = async (req, res) => {
  try {
    const { ids, action, reason } = req.body

    if (!ids?.length || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      })
    }

    const updateData = {
      status: action === "approve" ? "active" : "rejected",
      moderatedBy: req.user._id,
      moderatedAt: Date.now(),
    }

    if (action === "reject") {
      updateData.rejectionReason = reason || "Did not meet community guidelines"
    }

    const result = await User.updateMany(
      { _id: { $in: ids } },
      { $set: updateData }
    )

    // Send notifications
    if (result.modifiedCount > 0) {
      await Promise.all(
        ids.map(userId =>
          createNotification({
            user: userId,
            type: `account_${action === "approve" ? "approved" : "rejected"}`,
            content: `Your account has been ${action === "approve" ? "approved" : "rejected"}`,
            relatedEntity: {
              entityId: userId,
              type: "User",
            },
          })
        )
      )
    }

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} users ${action === "approve" ? "approved" : "rejected"}`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    })
  } catch (error) {
    console.error("Error in bulk action:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Interests Moderation
exports.getInterestsForModeration = async (req, res) => {
  try {
    const { status = "pending", page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    const [interests, total] = await Promise.all([
      Interest.find({ status })
        .populate("sender", "firstName lastName email")
        .populate("receiver", "firstName lastName email")
        .populate("listing", "title jobTitle")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Interest.countDocuments({ status })
    ])

    res.status(200).json({
      success: true,
      data: {
        interests,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error("Error getting interests:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.approveInterest = async (req, res) => {
  try {
    const interest = await Interest.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
      },
      { new: true }
    )

    if (!interest) {
      return res.status(404).json({
        success: false,
        message: "Interest not found",
      })
    }

    // await Promise.all([
    //   createNotification({
    //     user: interest.sender,
    //     type: "interest_approved",
    //     content: "Your interest has been approved",
    //     relatedEntity: {
    //       entityId: interest._id,
    //       type: "Interest",
    //     },
    //   }),
    //   createNotification({
    //     user: interest.receiver,
    //     type: "interest_received",
    //     content: "You have received a new interest",
    //     relatedEntity: {
    //       entityId: interest._id,
    //       type: "Interest",
    //     },
    //   }),
    // ])

    res.status(200).json({
      success: true,
      message: "Interest approved",
      data: interest,
    })
  } catch (error) {
    console.error("Error approving interest:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.rejectInterest = async (req, res) => {
  try {
    const { reason } = req.body
    const interest = await Interest.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
        rejectionReason: reason || "Did not meet community guidelines",
      },
      { new: true }
    )

    if (!interest) {
      return res.status(404).json({
        success: false,
        message: "Interest not found",
      })
    }

    // await createNotification({
    //   user: interest.sender,
    //   type: "interest_rejected",
    //   content: `Your interest has been rejected: ${interest.rejectionReason}`,
    //   relatedEntity: {
    //     entityId: interest._id,
    //     type: "Interest",
    //   },
    // })

    res.status(200).json({
      success: true,
      message: "Interest rejected",
      data: interest,
    })
  } catch (error) {
    console.error("Error rejecting interest:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

exports.bulkApproveRejectInterests = async (req, res) => {
  try {
    const { ids, action, reason } = req.body

    if (!ids?.length || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      })
    }

    const updateData = {
      status: action === "approve" ? "approved" : "rejected",
      moderatedBy: req.user._id,
      moderatedAt: Date.now(),
    }

    if (action === "reject") {
      updateData.rejectionReason = reason || "Did not meet community guidelines"
    }

    const result = await Interest.updateMany(
      { _id: { $in: ids } },
      { $set: updateData }
    )

    // Send notifications
    // if (result.modifiedCount > 0) {
    //   const interests = await Interest.find({ _id: { $in: ids } })
    //   await Promise.all(
    //     interests.map(interest => {
    //       const notifications = []
          
    //       if (action === "approve") {
    //         notifications.push(
    //           createNotification({
    //             user: interest.sender,
    //             type: "interest_approved",
    //             content: "Your interest has been approved",
    //             relatedEntity: {
    //               entityId: interest._id,
    //               type: "Interest",
    //             },
    //           }),
    //           createNotification({
    //             user: interest.receiver,
    //             type: "interest_received",
    //             content: "You have received a new interest",
    //             relatedEntity: {
    //               entityId: interest._id,
    //               type: "Interest",
    //             },
    //           })
    //         )
    //       } else {
    //         notifications.push(
    //           createNotification({
    //             user: interest.sender,
    //             type: "interest_rejected",
    //             content: `Your interest has been rejected: ${updateData.rejectionReason}`,
    //             relatedEntity: {
    //               entityId: interest._id,
    //               type: "Interest",
    //             },
    //           })
    //         )
    //       }
          
    //       return Promise.all(notifications)
    //     })
    //   )
    // }

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} interests ${action === "approve" ? "approved" : "rejected"}`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    })
  } catch (error) {
    console.error("Error in bulk action:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Helper function for creating notifications
async function createNotification(data) {
  try {
    const notification = await Notification.create({
      recipient: data.user,
      type: data.type,
      title: data.content.split(":")[0] || data.content,
      message: data.content,
      relatedModel: data.relatedEntity?.type,
      relatedId: data.relatedEntity?.entityId,
      read: false,
    })
    return notification
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}