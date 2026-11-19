const Patient = require("../models/Patient");
const { createNotification } = require("../utils/notificationHelper");

const listPatients = async (req, res, next) => {
  try {
    const { search, problem, minAge, maxAge } = req.query;
    const filters = { createdBy: req.userId };

    if (search) {
      filters.name = { $regex: search, $options: "i" };
    }
    if (problem) {
      filters.problem = { $regex: problem, $options: "i" };
    }
    if (minAge) {
      filters.age = { ...(filters.age || {}), $gte: Number(minAge) };
    }
    if (maxAge) {
      filters.age = { ...(filters.age || {}), $lte: Number(maxAge) };
    }

    const patients = await Patient.find(filters).sort({ lastVisit: -1, createdAt: -1 });
    res.json(patients);
  } catch (err) {
    next(err);
  }
};

const getPatient = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }
    res.json(patient);
  } catch (err) {
    next(err);
  }
};

const createPatient = async (req, res, next) => {
  try {
    console.log('createPatient incoming content-type:', req.headers['content-type']);
    console.log('createPatient req.body (raw):', req.body);
    console.log('createPatient req.file:', req.file);
    console.log('createPatient req.files:', req.files);
    const body = req.body || {};
    const { name, age, phone, problem, medicalHistory = [], prescriptions = [], isEmergency = false, title, summary } = body;

    if (!name || !problem) {
      return res.status(400).json({ error: "Patient name and primary health concern are required." });
    }

    const patient = new Patient({
      name,
      age: age ? Number(age) : null,
      phone,
      problem,
      medicalHistory,
      prescriptions,
      isEmergency: isEmergency === true || isEmergency === "true",
      createdBy: req.userId,
      reports: []
    });

    const uploadedFile = req.file || (req.files && req.files.file && req.files.file[0]);
    if (uploadedFile) {
      const report = {
        title: title || uploadedFile.originalname,
        summary: summary || "Uploaded report for clinical review.",
        url: `/uploads/${uploadedFile.filename}`,
        uploadedAt: new Date()
      };
      patient.reports.unshift(report);
    }

    await patient.save();

    await createNotification({
      userId: req.userId,
      title: `New patient ${patient.name} added`,
      detail: `${patient.name} was registered for ${patient.problem}.`,
      type: patient.isEmergency ? "alert" : "success",
      category: patient.isEmergency ? "emergency" : "patient-creation",
      relatedType: "patient",
      relatedId: patient._id
    });

    if (patient.isEmergency) {
      await createNotification({
        userId: req.userId,
        title: "Emergency case requires immediate attention",
        detail: `${patient.name} is flagged for urgent review.`,
        type: "alert",
        category: "emergency",
        relatedType: "patient",
        relatedId: patient._id
      });
    }

    if (req.file) {
      await createNotification({
        userId: req.userId,
        title: `Report uploaded for ${patient.name}`,
        detail: `${patient.reports[0].title} was added to ${patient.name}'s medical records.`,
        type: "success",
        category: "report-upload",
        relatedType: "patient",
        relatedId: patient._id
      });
    }

    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
};

const uploadReport = async (req, res, next) => {
  try {
    const patientId = req.params.id || req.body.patientId;
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required to upload a report." });
    }

    const patient = await Patient.findOne({ _id: patientId, createdBy: req.userId });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const uploadedFile = req.file || (req.files && req.files.file && req.files.file[0]);
    if (!uploadedFile) {
      return res.status(400).json({ error: "Report upload failed." });
    }

    const report = {
      title: req.body.title || uploadedFile.originalname,
      summary: req.body.summary || "Uploaded report for clinical review.",
      url: `/uploads/${uploadedFile.filename}`,
      uploadedAt: new Date()
    };

    patient.reports.unshift(report);
    await patient.save();

    await createNotification({
      userId: req.userId,
      title: `Report uploaded for ${patient.name}`,
      detail: `${report.title} was added to ${patient.name}'s medical records.`,
      type: "success",
      category: "report-upload",
      relatedType: "patient",
      relatedId: patient._id
    });

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

const addPrescription = async (req, res, next) => {
  try {
    const { title, dose, instructions } = req.body;
    if (!title || !instructions) {
      return res.status(400).json({ error: "Prescription title and instructions are required." });
    }

    const patient = await Patient.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const prescription = {
      title,
      dose: dose || "As directed",
      instructions,
      issuedAt: new Date()
    };

    patient.prescriptions.unshift(prescription);
    await patient.save();

    await createNotification({
      userId: req.userId,
      title: `Prescription issued for ${patient.name}`,
      detail: `${title} was added to ${patient.name}'s care plan.`,
      type: "info",
      category: "prescription",
      relatedType: "patient",
      relatedId: patient._id
    });

    res.json(patient);
  } catch (err) {
    next(err);
  }
};

const removePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findOneAndDelete({ _id: req.params.id, createdBy: req.userId });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    res.json({ message: "Patient record removed successfully." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPatients,
  getPatient,
  createPatient,
  uploadReport,
  addPrescription,
  removePatient
};
