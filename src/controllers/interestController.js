const Interest = require("../models/Interest")
const Notification = require("../models/Notification")
const ProductListing = require("../models/ProductListing")
const ServiceListing = require("../models/ServiceListing")
const JobListing = require("../models/JobListing")
const MatrimonyListing = require("../models/MatrimonyListing")
const mongoose = require("mongoose")

// Mapping of listing types to their models
const ListingModels = {
  product: ProductListing,
  service: ServiceListing,
  job: JobListing,
  matrimony: MatrimonyListing,
}

// @desc    Create a new interest
// @route   POST /api/interests
exports.createInterest = async (req, res) => {
  try {
    const { listingId, listingType, message } = req.body

    // Validate listing type
    const ListingModel = ListingModels[listingType]
    if (!ListingModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      })
    }

    function Convert(listingId) {
      try {
        const ListingId = new mongoose.Types.ObjectId(listingId)
        return ListingId // Now you can use listingId with findById or other MongoDB operations
      } catch (error) {
        console.error("Invalid ObjectId format:", error)
      }
    }
    // Find the listing
    console.log(ListingModel)
    console.log(listingId)
    const listing = await ListingModel.findById(Convert(listingId))
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      })
    }

    console.log(listing)
    // Check if interest already exists
    const existingInterest = await Interest.checkExistingInterest(req.user.id, listing.user, listingId)

    if (existingInterest) {
      return res.status(400).json({
        success: false,
        message: "You have already sent an interest for this listing",
      })
    }

    // Create new interest
    const interest = new Interest({
      sender: req.user.id,
      receiver: listing.user,
      listing: listingId,
      listingType: `${listingType.charAt(0).toUpperCase() + listingType.slice(1)}Listing`,
      message: message || "Interested in your listing",
    })

    await interest.save()

    // Create notification for the listing owner
    await Notification.createNotification({
      user: listing.user,
      type: "interest_received",
      content: `New interest received for your ${listingType} listing`,
      relatedEntity: {
        entityId: interest._id,
        type: "Interest",
      },
    })

    res.status(201).json({
      success: true,
      data: interest,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating interest",
      error: error.message,
    })
  }
}

// @route   GET /api/interests/check
exports.checkInterest = async (req, res) => {
  try {
    const { listingId, userId } = req.query;

    if (!listingId || !userId) {
      return res.status(400).json({
        success: false,
        message: "listingId and userId are required"
      });
    }

    const interest = await Interest.findOne({
      listing: listingId,
      sender: userId
    });

    res.status(200).json({
      success: true,
      hasShownInterest: !!interest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking interest status",
      error: error.message
    });
  }
};

// @desc    Get received interests
// @route   GET /api/interests/received
exports.getReceivedInterests = async (req, res) => {
  try {
    // Pagination
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skipIndex = (page - 1) * limit

    // Filtering
    const filters = {
      receiver: req.user.id,
    }
    if (req.query.status) {
      filters.status = req.query.status
    }

    // Execute query
    const totalInterests = await Interest.countDocuments(filters)
    const interests = await Interest.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skipIndex)
      .populate("sender", "firstName lastName email phoneNumber city state")
      .populate("listing")

    res.status(200).json({
      success: true,
      count: interests.length,
      totalInterests,
      totalPages: Math.ceil(totalInterests / limit),
      currentPage: page,
      data: interests,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching received interests",
      error: error.message,
    })
  }
}

// @desc    Get sent interests
// @route   GET /api/interests/sent
exports.getSentInterests = async (req, res) => {
  try {
    // Pagination
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skipIndex = (page - 1) * limit

    // Filtering
    const filters = {
      sender: req.user.id,
    }
    if (req.query.status) {
      filters.status = req.query.status
    }

    // Execute query
    const totalInterests = await Interest.countDocuments(filters)
    const interests = await Interest.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skipIndex)
      // Using the fields from the first file as they're more comprehensive
      .populate("receiver", "firstName lastName email")
      .populate("listing")

    res.status(200).json({
      success: true,
      count: interests.length,
      totalInterests,
      totalPages: Math.ceil(totalInterests / limit),
      currentPage: page,
      data: interests,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching sent interests",
      error: error.message,
    })
  }
}

// @desc    Respond to an interest
// @route   PUT /api/interests/:id/respond
exports.respondToInterest = async (req, res) => {
  try {
    const { id } = req.params
    const { status, responseMessage } = req.body

    // Validate status
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      })
    }

    // Find the interest
    const interest = await Interest.findOne({
      _id: id,
      receiver: req.user.id,
      status: "pending",
    })

    if (!interest) {
      return res.status(404).json({
        success: false,
        message: "Interest not found or already responded",
      })
    }

    // Update interest
    interest.status = status
    interest.responseMessage = responseMessage
    await interest.save()

    // Create notification for the sender
    await Notification.createNotification({
      user: interest.sender,
      type: `interest_${status}`,
      content: `Your interest was ${status} for the listing`,
      relatedEntity: {
        entityId: interest._id,
        type: "Interest",
      },
    })

    res.status(200).json({
      success: true,
      data: interest,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error responding to interest",
      error: error.message,
    })
  }
}