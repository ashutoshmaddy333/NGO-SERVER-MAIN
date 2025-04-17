const mongoose = require("mongoose")
const bcrypt = require("bcryptjs") // Make sure we're using bcryptjs, not bcrypt
const cities = require("./Cities")
const { validate } = require("./BaseListing")

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email address"],
    },
    role: {
      type: String,
      enum: ["admin", "moderator", "user"],
      required: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    pincode: {
      type: String,
      required: [true, "Pincode is required"],
      minlength: [6, "Enter a valid pincode"],
      maxlength: [6, "Enter a valid pincode"],
    },
    state: {
      type: String,
      enum: Object.keys(cities),
      required: true,
    },
    city: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return cities[this.state]?.includes(value)
        },
        message: (props) => `${props.value} is not a valid city for the selected state.`,
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password should be at least 6 characters long"],
    },
    confirmPassword: {
      type: String,
      validate: {
        validator: function (value) {
          return value === this.get("password")
        },
        message: () => "Passwords do not match. Please try again.",
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "rejected", "suspended"],
      default: "active",
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
    otp: {
      code: {
        type: String,
      },
      expiresAt: {
        type: Date,
      },
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Password hashing middleware
UserSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next()

  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10)

    // Hash the password along with our new salt
    this.password = await bcrypt.hash(this.password, salt)

    // Clear the confirmPassword field
    this.confirmPassword = undefined

    next()
  } catch (error) {
    console.error("Password hashing error:", error)
    next(error)
  }
})

// Method to check password validity
UserSchema.methods.isValidPassword = async function (password) {
  try {
    // Use bcryptjs to compare the provided password with the hashed password
    return await bcrypt.compare(password, this.password)
  } catch (error) {
    console.error("Password validation error:", error)
    return false
  }
}

// Method to generate OTP
UserSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
  }
  return otp
}

// Method to verify OTP
UserSchema.methods.verifyOTP = async function (otpCode) {
  if (!this.otp || !this.otp.code) {
    return { success: false, message: "OTP not found." }
  }

  if (this.otp.expiresAt < new Date()) {
    return { success: false, message: "OTP has expired." }
  }

  if (this.otp.code !== otpCode) {
    return { success: false, message: "Invalid OTP." }
  }

  // OTP is valid, mark the user as verified
  this.isVerified = true
  this.otp = undefined // Remove OTP
  await this.save() // Save the changes

  return { success: true, message: "OTP verified successfully." }
}

const User = mongoose.model("User", UserSchema)

module.exports = User
