const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { createTicket, getMyTickets, getAllTickets, resolveTicket } = require('../controllers/ticketController');

router.post('/', protect, createTicket);
router.get('/me', protect, getMyTickets);

// Dành cho Quản lý / Admin
router.get('/', protect, authorize('ADMIN', 'RECEPTIONIST'), getAllTickets);
router.put('/:id/resolve', protect, authorize('ADMIN', 'RECEPTIONIST'), resolveTicket);

module.exports = router;
