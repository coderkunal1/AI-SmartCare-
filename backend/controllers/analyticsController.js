const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');

// Helper to build an array of past N days (labels) and map of date->label
function getPastDays(days) {
  const result = [];
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    result.push({ key, label });
    map[key] = label;
  }
  return { list: result, map };
}

exports.getDailyPatientsAndAppointments = async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(30, parseInt(req.query.days || '7', 10)));
    const { list, map } = getPastDays(days);
    const startDate = new Date(list[0].key + 'T00:00:00.000Z');

    // Aggregate new patients by createdAt
    const patientAgg = await Patient.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Aggregate appointments by date field
    const appointmentAgg = await Appointment.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 }
        }
      }
    ]);

    const patientMap = {};
    patientAgg.forEach(p => { patientMap[p._id] = p.count; });
    const appointmentMap = {};
    appointmentAgg.forEach(a => { appointmentMap[a._id] = a.count; });

    const daysLabels = list.map(d => d.label);
    const patientsSeries = list.map(d => patientMap[d.key] || 0);
    const appointmentsSeries = list.map(d => appointmentMap[d.key] || 0);

    res.json({ days: daysLabels, patients: patientsSeries, appointments: appointmentsSeries });
  } catch (err) {
    next(err);
  }
};
