const User = require("../models/User")
const { generateToken } = require("../middleware/authMiddleware")
const nodemailer = require("nodemailer")
const bcrypt = require("bcryptjs") // Make sure we're using bcryptjs, not bcrypt

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // Or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// @desc    Register new user
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, gender, pincode, state, city, password, confirmPassword } = req.body

  console.log("Register request received:", req.body)
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phoneNumber ||
    !gender ||
    !pincode ||
    !state ||
    !city ||
    !password ||
    !confirmPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required.",
    })
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    })

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User with this email, phone number, or username already exists.",
      })
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      })
    }

    // Create new user with plain password - it will be hashed by the pre-save middleware
    const user = new User({
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      pincode,
      state,
      city,
      password,
      confirmPassword,
      role: "user",
    })

    // Generate OTP
    const otp = user.generateOTP()
    await user.save()

    res.status(201).json({
      success: true,
      message: "User registered. Check your email for OTP verification.",
      userId: user._id,
      otp: otp,
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message,
    })
  }
}

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  const { userId, otp } = req.body

  try {
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Verify OTP
    const result = await user.verifyOTP(otp)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      })
    }

    // Generate JWT token
    const token = generateToken(user._id)

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("OTP verification error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
      error: error.message,
    })
  }
}

// @desc    Login user
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body

    console.log(`Login attempt for email: ${email}`)

    // Check if email and password are provided
    if (!email || !password) {
      console.log("Email or password missing")
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      })
    }

    // Find user by email - use lean() for better performance
    const user = await User.findOne({ email }).lean()

    if (!user) {
      console.log(`User not found for email: ${email}`)
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    console.log(`User found: ${user._id}, checking password...`)
    console.log(`Password from DB (first few chars): ${user.password.substring(0, 10)}...`)

    // For testing purposes only - create a backdoor for development
    const isDev = process.env.NODE_ENV === "development"
    const isTestUser =
      isDev && (email === "test@example.com" || email === "admin@example.com" || email === "rajput@gmail.com")

    let isMatch = false

    if (isTestUser && password.length >= 4) {
      console.log("Development mode: Using test user bypass")
      isMatch = true
    } else {
      // Check password using bcryptjs directly
      isMatch = await bcrypt.compare(password, user.password)
    }

    console.log(`Password match result: ${isMatch}`)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check if user is verified
    if (!user.isVerified) {
      // For simplicity in development, auto-verify test users
      if (isTestUser) {
        console.log("Auto-verifying test user in development mode")
        await User.findByIdAndUpdate(user._id, { isVerified: true })
      } else {
        // Regular verification flow
        const userModel = await User.findById(user._id)
        const otp = userModel.generateOTP()
        await userModel.save()

        // Send OTP via email
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify Your Account",
            text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
          })
        } catch (emailError) {
          console.error("Failed to send email:", emailError)
          // Continue without failing the request
        }

        return res.status(403).json({
          success: false,
          message: "Account not verified. OTP sent to email.",
          userId: user._id,
        })
      }
    }

    // Generate token
    const token = generateToken(user._id)
    console.log(`Login successful, token generated for user: ${user._id}`)

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    })
  }
}

// @desc    Get user profile
// @route   GET /api/auth/profile
exports.getUserProfile = async (req, res) => {
  try {
    // req.user is set by protect middleware
    const user = await User.findById(req.user.id).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: error.message,
    })
  }
}

// @desc    Update user profile
// @route   PUT /api/auth/profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, address } = req.body

    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Update profile fields
    if (firstName) user.firstName = firstName
    if (lastName) user.lastName = lastName
    if (phoneNumber) user.phoneNumber = phoneNumber
    if (address) {
      if (!user.location) user.location = {}
      user.location.address = address
    }

    await user.save()

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        location: user.location,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: error.message,
    })
  }
}
