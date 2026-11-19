const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const assistantController = require("../controllers/assistantController");

router.post("/chat", auth, assistantController.chat);
router.get("/status", assistantController.status);
router.get("/conversations", auth, assistantController.getConversations);
router.get("/conversations/:id", auth, assistantController.getConversation);
router.delete("/conversations/:id", auth, assistantController.deleteConversation);

module.exports = router;
