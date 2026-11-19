const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const appointmentController = require("../controllers/appointmentController");

router.get("/", auth, appointmentController.listAppointments);
router.get("/:id", auth, appointmentController.getAppointment);
router.post("/", auth, appointmentController.createAppointment);
router.patch("/:id", auth, appointmentController.updateAppointment);
router.patch("/:id/cancel", auth, appointmentController.cancelAppointment);
router.delete("/:id", auth, appointmentController.deleteAppointment);

module.exports = router;
