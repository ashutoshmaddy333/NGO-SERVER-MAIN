const mongoose = require("mongoose");
const BaseListing = require("./BaseListing");
const citiesByState = require("../models/Cities") || {}; // Prevents crash if undefined

// Validate citiesByState structure
if (typeof citiesByState !== "object" || Array.isArray(citiesByState)) {
  throw new Error("Invalid citiesByState structure. Expected an object with states as keys.");
}

const MatrimonyListing = BaseListing.discriminator(
  "MatrimonyListing",
  new mongoose.Schema({
    title: { type: String, required: false, trim: true }, // Override as optional
    description: { type: String, required: false, trim: true }, // Override as optional
    
    // Basic Information
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female"],
    },
    age: {
      type: Number,
      required: [true, "Age is required"],
      min: [18, "Minimum age is 18"],
      max: [80, "Maximum age is 80"],
    },
    religion: {
      type: String,
      required: [true, "Religion is required"],
      enum: ["doesnt-matter", "hindu", "muslim", "sikh", "christian", "buddhist", "jain", "parsi", "other"],
    },
    caste: {
      type: String,
      trim: true,
    },
    maritalStatus: {
      type: String,
      required: [true, "Marital status is required"],
      enum: ["doesnt-matter", "never-married", "awaiting-divorce", "divorced", "widowed", "annulled"],
    },
    bloodGroup: {
      type: String,
      enum: ["a-positive", "a-negative", "b-positive", "b-negative", "ab-positive", "ab-negative", "o-positive", "o-negative"],
    },
    
    // Physical Attributes
    height: {
      type: String, // Changed to string to accommodate format like "5 ft 2 inch"
      required: [true, "Height is required"],
      trim: true,
    },
    weight: {
      type: Number, // in kg
      required: [true, "Weight is required"],
      min: [40, "Minimum weight is 40 kg"],
      max: [120, "Maximum weight is 120 kg"],
    },
    
    // Education and Occupation
    education: {
      type: String,
      required: [true, "Education is required"],
      trim: true,
    },
    occupation: {
      type: String,
      required: [true, "Occupation is required"],
      enum: ["doesnt-matter", "private-sector", "govt-public-sector", "civil-services", "defence", 
             "business-self-employed", "professional", "not-working"],
    },
    incomeRange: {
      type: String,
      enum: ["less-than-5-lakhs", "5-10-lakhs", "10-20-lakhs", "20-30-lakhs", "above-30-lakhs"],
    },
    
    // Preferences and Habits
    foodPreference: {
      type: String,
      enum: ["doesnt-matter", "vegetarian", "non-vegetarian", "eggetarian", "jain"],
    },

    smoking: {
      type: String,
      enum: ["yes", "no"],
    },
    drinking: {
      type: String,
      enum: ["yes", "no"],
    },
    relocateWithinCountry: {
      type: String,
      enum: ["yes", "no"],
    },
    relocateoutsideCountry: {
      type: String,
      enum: ["yes", "no"],
    },
    
    // Location Information
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{6}$/, "Please provide a valid 6-digit pincode"],
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      enum: ["india", "usa", "canada", "uk", "australia", "other"],
    },
    
    // Additional Information
    otherInfo: {
      type: String,
      trim: true,
    },
    
    // File Upload
    documents: {
      type: [String], // Allows multiple document URLs
      validate: {
        validator: (docs) => Array.isArray(docs) && docs.length <= 4,
        message: "Maximum of 4 documents allowed",
      },
    },
    
    // Terms Acceptance
    termsAccepted: {
      type: Boolean,
      required: [true, "You must accept the terms and conditions"],
      default: true,
    },
  })
);

module.exports = MatrimonyListing;