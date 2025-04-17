const mongoose = require("mongoose")

const BaseListing = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    images: [
      {
        type: String, // URL to the image
        validate: {
          validator: (v) => {
            // Basic URL validation - combines both versions' validators
            return /^https?:\/\/.+/.test(v) || v.startsWith("/") // Allow local paths too
          },
          message: (props) => `${props.value} is not a valid URL!`,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "rejected", "expired"], // Combined enum values
      default: "pending", // Kept the more restrictive default
    },
    views: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    location: {
      address: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
    discriminatorKey: "__t", // Kept MongoDB's default discriminator key
  },
)

// Middleware to update views
BaseListing.methods.incrementViews = function () {
  this.views += 1
  return this.save()
}

// Indexing for better query performance
BaseListing.index({
  title: "text",
  description: "text",
  tags: "text",
})

// Static method to search listings
BaseListing.statics.search = async function (query) {
  return this.find({
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { tags: { $regex: query, $options: "i" } },
    ],
  })
}

module.exports = mongoose.model("BaseListing", BaseListing)