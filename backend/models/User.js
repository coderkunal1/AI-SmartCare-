const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["doctor", "patient"],
    default: "doctor"
  },
  specialty: {
    type: String,
    trim: true,
    default: "General Medicine"
  },
  phone: {
    type: String,
    trim: true
  },
  avatarUrl: {
    type: String,
    default: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=60"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.pre("save", async function() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(password) {
  if (this.password.startsWith("$2")) {
    return bcrypt.compare(password, this.password);
  }
  return password === this.password;
};

module.exports = mongoose.model("User", userSchema);
