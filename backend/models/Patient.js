const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    default: null
  },
  phone: {
    type: String,
    trim: true
  },
  problem: {
    type: String,
    required: true,
    trim: true
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  medicalHistory: [String],
  prescriptions: [
    {
      title: String,
      dose: String,
      instructions: String,
      issuedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  reports: [
    {
      title: String,
      summary: String,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  lastVisit: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Patient", patientSchema);
