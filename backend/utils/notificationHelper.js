const Notification = require("../models/Notification");

const createNotification = async ({ userId, title, detail, type = "info", category, relatedType, relatedId }) => {
  const notification = new Notification({
    user: userId,
    title,
    detail,
    type,
    category,
    relatedType,
    relatedId
  });
  return notification.save();
};

const ensureAppointmentReminder = async ({ userId, appointment }) => {
  if (!appointment || appointment.status !== "confirmed" || !appointment.date) {
    return null;
  }

  const now = new Date();
  const appointmentTime = new Date(appointment.date);
  const timeUntil = appointmentTime.getTime() - now.getTime();
  const minutesUntil = timeUntil / 60000;

  if (minutesUntil > 0 && minutesUntil <= 30) {
    const existing = await Notification.findOne({
      user: userId,
      category: "appointment-reminder",
      relatedType: "appointment",
      relatedId: appointment._id
    });

    if (!existing) {
      return createNotification({
        userId,
        title: `Upcoming appointment in ${Math.round(minutesUntil)} minutes`,
        detail: `Reminder: ${appointment.patient?.name || "patient"} has a confirmed appointment at ${appointmentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        type: "warning",
        category: "appointment-reminder",
        relatedType: "appointment",
        relatedId: appointment._id
      });
    }
  }

  return null;
};

module.exports = {
  createNotification,
  ensureAppointmentReminder
};
