const express = require("express");
const router = express.Router();

const medicineRecommendations = {
  fever: [
    { name: "Paracetamol", dose: "500mg every 6 hours", note: "Do not exceed 4g per day." },
    { name: "Dolo", dose: "500mg every 6 hours", note: "Common fever and body ache relief." },
    { name: "Combiflam", dose: "1 tablet every 8 hours", note: "Use for fever and mild pain; avoid if stomach upset occurs." },
    { name: "Ibuprofen", dose: "200-400mg every 6-8 hours", note: "Take with food to avoid stomach upset." }
  ],
  cold: [
    { name: "Chlorpheniramine", dose: "4mg every 6 hours", note: "Helps reduce nasal congestion and runny nose." },
    { name: "Paracetamol", dose: "500mg every 6 hours", note: "For fever and body ache." }
  ],
  cough: [
    { name: "Dextromethorphan", dose: "10-20mg every 4-6 hours", note: "Use for dry cough." },
    { name: "Guaifenesin (Mucinex)", dose: "200-400mg every 4 hours", note: "Helps loosen mucus." },
    { name: "Cough syrup", dose: "As directed on pack", note: "Choose a syrup for wet or dry cough depending on symptoms." }
  ],
  headache: [
    { name: "Paracetamol", dose: "500mg every 6 hours", note: "Do not exceed 4g per day." },
    { name: "Ibuprofen", dose: "200-400mg every 6-8 hours", note: "Avoid on empty stomach." }
  ],
  stomachache: [
    { name: "Antacid", dose: "As directed on pack", note: "Use if pain is due to acidity." },
    { name: "Domperidone", dose: "10mg three times daily", note: "Use for nausea or indigestion." }
  ],
  diabetes: [
    { name: "Metformin", dose: "500mg twice daily", note: "Consult a doctor for dose adjustment." },
    { name: "Glipizide", dose: "5mg once daily", note: "Only if prescribed by physician." }
  ],
  hypertension: [
    { name: "Amlodipine", dose: "5mg once daily", note: "Helps control blood pressure." },
    { name: "Losartan", dose: "50mg once daily", note: "Take at the same time every day." }
  ]
};

router.get("/", (req, res) => {
  const problem = (req.query.problem || "").trim().toLowerCase();
  if (!problem) {
    return res.status(400).json({ error: "Problem query is required. Example: /api/medicines?problem=fever" });
  }

  const key = problem.replace(/\s+/g, "");
  const medicines = medicineRecommendations[key];

  if (!medicines) {
    return res.status(404).json({
      error: "No recommendation found for this problem.",
      knownProblems: Object.keys(medicineRecommendations)
    });
  }

  res.json({ problem, medicines });
});

module.exports = router;
