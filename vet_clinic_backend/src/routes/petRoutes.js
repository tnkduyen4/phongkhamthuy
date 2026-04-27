const express = require('express');
const { createPet, getPets, getPetById, updatePet, deletePet, reactivatePet, checkPetDelete, bulkDeletePets } = require('../controllers/petController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.route('/')
    .post(protect, createPet)
    .get(protect, getPets);

router.post('/bulk-delete', protect, authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), bulkDeletePets);

router.get('/:id/check-delete', protect, checkPetDelete);

router.route('/:id')
    .get(protect, getPetById)
    .put(protect, updatePet)
    .delete(protect, deletePet)
    .patch(protect, authorize('ADMIN'), reactivatePet);

module.exports = router;
