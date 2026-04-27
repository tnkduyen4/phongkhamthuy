const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Mọi người đều có thể vào, backend tự decode token để biết là Guest hay User
router.post('/send', chatController.sendMessage);
router.get('/history', chatController.getHistory);
router.get('/sessions', chatController.getActiveSessions);
router.post('/reply', chatController.staffReply);
router.post('/resolve', chatController.resolveSession);

module.exports = router;
