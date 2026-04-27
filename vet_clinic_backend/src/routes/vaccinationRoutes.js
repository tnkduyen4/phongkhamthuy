const express = require('express');
const router = express.Router();
const { 
    createVaccination, 
    getVaccinations,
    getPetVaccinations, 
    getUpcomingVaccinations,
    deleteVaccination
} = require('../controllers/vaccinationController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.route('/')
    .get(getVaccinations)
    .post(authorize('ADMIN', 'DOCTOR'), createVaccination);

router.get('/upcoming', getUpcomingVaccinations);
router.get('/pet/:petId', getPetVaccinations);

router.route('/:id')
    .delete(authorize('ADMIN'), deleteVaccination);

module.exports = router;
