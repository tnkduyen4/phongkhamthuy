const Vaccination = require('../models/Vaccination');
const Pet = require('../models/Pet');
const Medicine = require('../models/Medicine');
const Invoice = require('../models/Invoice');
const InventoryTransaction = require('../models/InventoryTransaction');
const logActivity = require('../utils/logActivity');

// @desc    Tạo bản ghi tiêm phòng mới (Trạng thái PENDING chờ thanh toán)
// @route   POST /api/v1/vaccinations
// @access  Private
const createVaccination = async (req, res) => {
    try {
        const {
            petId, vaccineName, medicineId, administeredDate,
            nextDueDate, dosage, doseNumber, price, batchNumber, notes,
            customerId, appointmentId, services
        } = req.body;

        if (!petId || !vaccineName || !nextDueDate) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ: Thú cưng, Tên vaccine và Ngày hẹn tiếp theo'
            });
        }

        // Tạo bản ghi tiêm phòng với trạng thái PENDING
        const vaccination = await Vaccination.create({
            petId,
            vaccineName,
            medicineId,
            administeredDate: administeredDate || new Date(),
            nextDueDate,
            dosage,
            doseNumber: doseNumber || 1,
            price: price || 0,
            batchNumber,
            doctorId: req.user._id,
            notes,
            status: 'PENDING',
            customerId: customerId || null,
            appointmentId: appointmentId || null,
            services: services || []
        });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_VACCINATION',
            description: `Ghi nhận tiêm phòng: ${vaccineName} cho thú cưng ID ${petId} (Chờ thanh toán)`,
            targetModel: 'Vaccination',
            targetId: vaccination._id,
            metadata: { petId, vaccineName, nextDueDate },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Đã ghi nhận mũi tiêm. Vui lòng chuyển sang thanh toán để hoàn tất trừ kho.',
            data: vaccination
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Lấy danh sách tất cả các mũi tiêm (Hỗ trợ lọc theo trạng thái)
// @route   GET /api/v1/vaccinations
// @access  Private
const getVaccinations = async (req, res) => {
    try {
        let query = {};
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query._id) {
            query._id = req.query._id;
        }
        if (req.query.appointmentId) {
            query.appointmentId = req.query.appointmentId;
        }

        const vaccinations = await Vaccination.find(query)
            .populate({
                path: 'customerId',
                select: 'fullName phoneNumber rewardPoints',
                populate: { path: 'customerProfile', select: 'rewardPoints' }
            })
            .populate('petId', 'name breed')
            .populate({
                path: 'petId',
                populate: { 
                    path: 'ownerId', 
                    select: 'fullName phoneNumber rewardPoints',
                    populate: { path: 'customerProfile', select: 'rewardPoints' }
                }
            })
            .populate('doctorId', 'fullName')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: vaccinations.length, data: vaccinations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy lịch sử tiêm phòng của 1 thú cưng
// @route   GET /api/v1/vaccinations/pet/:petId
// @access  Private
const getPetVaccinations = async (req, res) => {
    try {
        const vaccinations = await Vaccination.find({ petId: req.params.petId })
            .populate('doctorId', 'fullName')
            .populate('medicineId', 'name')
            .sort({ administeredDate: -1 });

        res.status(200).json({ success: true, count: vaccinations.length, data: vaccinations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy danh sách các mũi tiêm sắp đến hạn (Reminder)
// @route   GET /api/v1/vaccinations/upcoming
// @access  Private
const getUpcomingVaccinations = async (req, res) => {
    try {
        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(today.getDate() + 7);

        const upcoming = await Vaccination.find({
            nextDueDate: { $gte: today, $lte: next7Days }
        })
            .populate('petId', 'name breed')
            .populate({
                path: 'petId',
                populate: { path: 'ownerId', select: 'fullName phoneNumber' }
            })
            .sort({ nextDueDate: 1 });

        res.status(200).json({ success: true, count: upcoming.length, data: upcoming });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa bản ghi tiêm phòng
// @route   DELETE /api/v1/vaccinations/:id
// @access  Private (Admin/Manager)
const deleteVaccination = async (req, res) => {
    try {
        const vaccination = await Vaccination.findByIdAndDelete(req.params.id);
        if (!vaccination) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi' });

        res.status(200).json({ success: true, message: 'Đã xóa bản ghi tiêm phòng' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createVaccination,
    getVaccinations,
    getPetVaccinations,
    getUpcomingVaccinations,
    deleteVaccination
};
