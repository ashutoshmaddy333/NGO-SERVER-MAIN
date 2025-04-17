const mongoose = require("mongoose")

const InterestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "listingType",
      required: true,
    },
    listingType: {
      type: String,
      enum: ["ProductListing", "ServiceListing", "JobListing", "MatrimonyListing"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
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
  },
)

// Indexing for better query performance
InterestSchema.index({ sender: 1, receiver: 1, listing: 1 })

// Static method to check if an interest already exists
InterestSchema.statics.checkExistingInterest = async function (senderId, receiverId, listingId) {
  return await this.findOne({
    sender: senderId,
    receiver: receiverId,
    listing: listingId,
    status: "pending",
  })
}

// Validation to prevent self-interest (improved version with null checks)
InterestSchema.pre("validate", function (next) {
  if (this.sender && this.receiver && this.sender.equals(this.receiver)) {
    next(new Error("You cannot send an interest to yourself"))
  } else {
    next()
  }
})

const Interest = mongoose.model("Interest", InterestSchema)

module.exports = Interest