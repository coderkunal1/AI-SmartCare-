const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const auth = require("../middleware/auth");
const patientController = require("../controllers/patientController");

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

router.get("/", auth, patientController.listPatients);
router.post(
  "/",
  auth,
  (req, res, next) => {
    console.log('patientRoutes / POST headers:', req.headers['content-type']);
    next();
  },
  upload.fields([{ name: "file", maxCount: 1 }]),
  patientController.createPatient
);
router.get("/:id", auth, patientController.getPatient);
router.post(
  "/:id/reports",
  auth,
  (req, res, next) => {
    console.log('patientRoutes /:id/reports headers:', req.headers['content-type']);
    next();
  },
  upload.fields([{ name: "file", maxCount: 1 }]),
  patientController.uploadReport
);
router.post(
  "/reports",
  auth,
  (req, res, next) => {
    console.log('patientRoutes /reports headers:', req.headers['content-type']);
    next();
  },
  upload.fields([{ name: "file", maxCount: 1 }]),
  patientController.uploadReport
);
router.post("/:id/prescriptions", auth, patientController.addPrescription);
router.delete("/:id", auth, patientController.removePatient);

module.exports = router;
