const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");
const multer = require("multer");

dotenv.config();

const app = express();
const userRoutes = require("./routes/userRoutes");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const aiRoutes = require("./routes/assistantRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const errorHandler = require("./middleware/errorHandler");
const auth = require("./middleware/auth");
const patientController = require("./controllers/patientController");
const User = require("./models/User");

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(morgan("tiny"));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-.]/g, "");
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({ storage });

app.post("/api/patients/reports", auth, upload.single("file"), patientController.uploadReport);

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/smartcare";

const seedAdminUser = async () => {
  try {
    const existingUser = await User.findOne({ email: "admin@smartcare.com" });
    if (!existingUser) {
      const admin = new User({
        name: "Admin Clinician",
        email: "admin@smartcare.com",
        password: "admin123",
        role: "doctor",
        specialty: "Clinical Operations"
      });
      await admin.save();
      console.log("✅ Default admin created: admin@smartcare.com / admin123");
    }
  } catch (err) {
    console.error("Admin seed error:", err.message);
  }
};

mongoose.connect(mongoUri)
  .then(async () => {
    console.log("✅ DB connected successfully");
    console.log("Database:", mongoose.connection.db.databaseName);
    await seedAdminUser();
  })
  .catch(err => {
    console.error("❌ DB connection error:", err.message);
    process.exit(1);
  });

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", userRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/assistant", aiRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.send("Smart Care AI Doctor Assistant API is live.");
});

app.use(errorHandler);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

module.exports = app;
