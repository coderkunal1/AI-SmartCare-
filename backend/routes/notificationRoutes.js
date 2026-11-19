const express = require("express");
const auth = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.get("/", auth, notificationController.listNotifications);
router.get("/unread-count", auth, notificationController.unreadCount);
router.patch("/:id/read", auth, notificationController.markRead);
router.patch("/read-all", auth, notificationController.markAllRead);

module.exports = router;
