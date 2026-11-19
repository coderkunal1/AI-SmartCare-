const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  detail: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ["info", "success", "alert", "warning"],
    default: "info"
  },
  read: {
    type: Boolean,
    default: false
  },
  category: String,
  relatedType: String,
  relatedId: mongoose.Schema.Types.ObjectId
}, {
  timestamps: true
});

module.exports = mongoose.model("Notification", notificationSchema);
