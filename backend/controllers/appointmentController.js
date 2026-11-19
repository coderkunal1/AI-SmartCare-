const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const { createNotification, ensureAppointmentReminder } = require("../utils/notificationHelper");

const listAppointments = async (req, res, next) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    const filters = { createdBy: req.userId };

    if (status) {
      filters.status = status;
    }
    if (startDate) {
      filters.date = { ...(filters.date || {}), $gte: new Date(startDate) };
    }
    if (endDate) {
      filters.date = { ...(filters.date || {}), $lte: new Date(endDate) };
    }
    if (search) {
      filters.notes = { $regex: search, $options: "i" };
    }

    const appointments = await Appointment.find(filters)
      .populate("patient", "name age problem phone medicalHistory prescriptions reports")
      .sort({ date: 1 });

    await Promise.all(appointments.map((appointment) => ensureAppointmentReminder({ userId: req.userId, appointment })));
    res.json(appointments);
  } catch (err) {
    next(err);
  }
};

const getAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, createdBy: req.userId }).populate("patient", "name age problem phone");
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }
    res.json(appointment);
  } catch (err) {
    next(err);
  }
};

const createAppointment = async (req, res, next) => {
  try {
    const { patientId, date, time, specialty, status = "pending", notes } = req.body;

    if (!patientId || !date || !time) {
      return res.status(400).json({ error: "Patient, date, and time are required for appointment booking." });
    }

    const patient = await Patient.findOne({ _id: patientId, createdBy: req.userId });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const appointment = new Appointment({
      patient: patient._id,
      createdBy: req.userId,
      date: new Date(`${date}T${time}`),
      specialty,
      status,
      notes
    });

    await appointment.save();
    const populated = await appointment.populate("patient", "name age problem phone medicalHistory prescriptions reports");

    await createNotification({
      userId: req.userId,
      title: `Appointment scheduled for ${new Date(appointment.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      detail: `${patient.name} has an appointment scheduled with ${appointment.specialty}.`,
      type: "success",
      category: "appointment-booking",
      relatedType: "appointment",
      relatedId: appointment._id
    });

    if (status === "confirmed") {
      await createNotification({
        userId: req.userId,
        title: "Appointment confirmed",
        detail: `${patient.name}'s appointment is confirmed for ${new Date(appointment.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        type: "success",
        category: "appointment-confirmation",
        relatedType: "appointment",
        relatedId: appointment._id
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

const updateAppointment = async (req, res, next) => {
  try {
    const { status, date, time, specialty, notes } = req.body;
    const update = {};

    if (status) update.status = status;
    if (date && time) update.date = new Date(`${date}T${time}`);
    if (specialty) update.specialty = specialty;
    if (notes) update.notes = notes;

    const appointment = await Appointment.findOne({ _id: req.params.id, createdBy: req.userId }).populate("patient", "name age problem phone");
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    const previousStatus = appointment.status;

    if (status) update.status = status;
    const updated = await Appointment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.userId },
      update,
      { new: true }
    ).populate("patient", "name age problem phone medicalHistory prescriptions reports");

    if (!updated) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    if (status && status !== previousStatus) {
      const statusTitle = status === "confirmed" ? "Appointment confirmed" : status === "completed" ? "Consultation completed" : `Appointment ${status}`;
      const statusDetail = status === "confirmed"
        ? `${updated.patient?.name || "The patient"}'s appointment is now confirmed for ${new Date(updated.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
        : status === "completed"
          ? `${updated.patient?.name || "The patient"}'s appointment has been completed.`
          : `Appointment status updated to ${status}.`;

      await createNotification({
        userId: req.userId,
        title: statusTitle,
        detail: statusDetail,
        type: status === "alert" ? "alert" : "success",
        category: `appointment-${status}`,
        relatedType: "appointment",
        relatedId: updated._id
      });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, createdBy: req.userId });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }
    res.json({ message: "Appointment removed successfully." });
  } catch (err) {
    next(err);
  }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.userId },
      { status: "cancelled" },
      { new: true }
    ).populate("patient", "name age problem phone");

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    res.json({ message: "Appointment cancelled.", appointment });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  cancelAppointment
};
