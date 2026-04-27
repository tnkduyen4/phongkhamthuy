const Pet = require('../models/Pet');
const User = require('../models/User');
const logActivity = require('../utils/logActivity');

// @desc    Khách hàng (Customer) hoặc Lễ tân tạo Pet mới
// @route   POST /api/v1/pets
// @access  Private
const createPet = async (req, res) => {
    try {
        let ownerId = req.user._id; // Mặc định: Người gọi API là chủ Pet (Khách tự dùng app)

        // Nếu người gọi là Nhân Viên đang làm hồ sơ hộ khách tới tiệm, họ truyền ownerId vào body
        if (['ADMIN', 'RECEPTIONIST', 'DOCTOR'].includes(req.user.role) && req.body.ownerId) {
            ownerId = req.body.ownerId;

            // Validate xem khách hàng có tồn tại không
            const checkCustomer = await User.findById(ownerId);
            if (!checkCustomer) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng này' });
            }
        }

        const pet = await Pet.create({
            ...req.body,
            ownerId
        });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_PET',
            description: `Tạo hồ sơ thú cưng: ${req.body.name || 'Không tên'}`,
            targetModel: 'Pet', targetId: pet._id,
            metadata: { petName: req.body.name, species: req.body.species }, ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: pet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy danh sách thú cưng
// @route   GET /api/v1/pets
// @access  Private
const getPets = async (req, res) => {
    try {
        let query = {};

        // Mặc định lọc bỏ những thú cưng đã ngưng hoạt động (Soft Delete)
        if (!req.query.includeInactive) {
            query.isActive = { $ne: false };
        }

        // Nếu là khách hàng -> Chỉ cho phép xem pet của chính họ
        if (req.user.role === 'CUSTOMER') {
            query.ownerId = req.user._id;
        } else if (req.query.ownerId) {
            // Nhân viên tìm pet theo 1 khách cụ thể
            query.ownerId = req.query.ownerId;
        }

        // Tìm kiếm theo tên hoặc giống loài
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { breed: searchRegex }
            ];
        }

        // populate: Lấy thêm Họ tên + SĐT của người chủ để hiển thị lên App luôn
        const pets = await Pet.find(query).populate('ownerId', 'fullName phoneNumber');

        res.status(200).json({ success: true, count: pets.length, data: pets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy chi tiết 1 thú cưng
// @route   GET /api/v1/pets/:id
// @access  Private
const getPetById = async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.id).populate('ownerId', 'fullName phoneNumber address');

        if (!pet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
        }

        // Khách chỉ được xem chi tiết pet của mình
        if (req.user.role === 'CUSTOMER' && pet.ownerId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thông tin này' });
        }

        res.status(200).json({ success: true, data: pet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa thú cưng (Soft Delete)
// @route   DELETE /api/v1/pets/:id
// @access  Private (Admin, Manager, Receptionist)
const deletePet = async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.id);
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
        }

        if (req.user.role === 'CUSTOMER' && pet.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa thú cưng này' });
        }

        const force = req.query.force === 'true';
        if (force) {
            const Appointment = require('../models/Appointment');
            const MedicalRecord = require('../models/MedicalRecord');
            const GroomingOrder = require('../models/GroomingOrder');
            
            const apptCount = await Appointment.countDocuments({ petId: pet._id });
            const recCount = await MedicalRecord.countDocuments({ petId: pet._id });
            const grCount = await GroomingOrder.countDocuments({ 'pets.petId': pet._id });

            if (apptCount > 0 || recCount > 0 || grCount > 0) {
                return res.status(400).json({ success: false, message: 'Thú cưng này đã có dữ liệu ràng buộc, chỉ có thể đánh dấu ngưng hoạt động.' });
            }

            await Pet.findByIdAndDelete(pet._id);

            await logActivity({
                userId: req.user._id,
                action: 'DELETE_PET',
                description: `Xóa vĩnh viễn hồ sơ thú cưng thử nghiệm/test: ${pet.name}`,
                targetModel: 'Pet', targetId: pet._id,
                ipAddress: req.ip
            });

            return res.status(200).json({ success: true, message: 'Xóa vĩnh viễn hồ sơ thú cưng thành công' });
        }

        // Soft delete
        pet.isActive = false;
        await pet.save();

        await logActivity({
            userId: req.user._id,
            action: 'DEACTIVATE_PET',
            description: `Ẩn/Ngưng hoạt động hồ sơ thú cưng: ${pet.name}`,
            targetModel: 'Pet', targetId: pet._id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã ẩn thú cưng khỏi danh sách và lưu trữ hồ sơ thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Kiểm tra xem Pet có dữ liệu liên kết không để quyết định Xóa Hard hay Soft
// @route   GET /api/v1/pets/:id/check-delete
// @access  Private
const checkPetDelete = async (req, res) => {
    try {
        const petId = req.params.id;
        
        const Appointment = require('../models/Appointment');
        const MedicalRecord = require('../models/MedicalRecord');
        const GroomingOrder = require('../models/GroomingOrder');

        const promises = [
            Appointment.countDocuments({ petId: petId }),
            MedicalRecord.countDocuments({ petId: petId }),
            GroomingOrder.countDocuments({ 'pets.petId': petId })
        ];

        const results = await Promise.allSettled(promises);
        
        const appointments = results[0].status === 'fulfilled' ? results[0].value : 0;
        const records = results[1].status === 'fulfilled' ? results[1].value : 0;
        const grooming = results[2].status === 'fulfilled' ? results[2].value : 0;

        const totalRelations = appointments + records + grooming;
        
        res.status(200).json({
            success: true,
            hasRelations: totalRelations > 0,
            relations: {
                appointments, records, grooming
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa hàng loạt Thú cưng (Tự động Hard Delete hoặc Soft Delete)
// @route   POST /api/v1/pets/bulk-delete
// @access  Private (Admin, Manager, Receptionist)
const bulkDeletePets = async (req, res) => {
    try {
        const { petIds } = req.body;
        if (!petIds || !Array.isArray(petIds) || petIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
        }

        const Appointment = require('../models/Appointment');
        const MedicalRecord = require('../models/MedicalRecord');
        const GroomingOrder = require('../models/GroomingOrder');

        let hardDeleted = 0;
        let softDeleted = 0;
        const failedIds = [];

        for (const petId of petIds) {
            try {
                const pet = await Pet.findById(petId);
                if (!pet) continue;

                if (req.user.role === 'CUSTOMER' && pet.ownerId.toString() !== req.user._id.toString()) {
                    failedIds.push(petId);
                    continue; // Skip without throwing to let others process
                }

                const promises = [
                    Appointment.countDocuments({ petId: petId }),
                    MedicalRecord.countDocuments({ petId: petId }),
                    GroomingOrder.countDocuments({ 'pets.petId': petId })
                ];

                const results = await Promise.allSettled(promises);
                const sum = results.reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value : 0), 0);

                if (sum > 0) {
                    // Soft Delete
                    pet.isActive = false;
                    await pet.save();
                    softDeleted++;
                } else {
                    // Hard Delete
                    await Pet.findByIdAndDelete(petId);
                    hardDeleted++;
                }
            } catch (err) {
                console.error(`BulkDelete error on pet ${petId}:`, err);
                failedIds.push(petId);
            }
        }

        if (hardDeleted > 0 || softDeleted > 0) {
            await logActivity({
                userId: req.user._id,
                action: 'BULK_DELETE_PETS',
                description: `Xóa hàng loạt thú cưng: ${hardDeleted} xóa vĩnh viễn, ${softDeleted} lưu trữ.`,
                targetModel: 'Pet',
                ipAddress: req.ip
            });
        }

        res.status(200).json({
            success: true,
            message: `Hoàn tất: Đã xóa vĩnh viễn ${hardDeleted} hồ sơ và lưu trữ ${softDeleted} hồ sơ (không thể xóa do có dữ liệu liên kết).`,
            data: { hardDeleted, softDeleted, failedCount: failedIds.length }
        });
    } catch (error) {
        console.error('Lỗi bulk delete pets:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa hàng loạt thú cưng' });
    }
};

// @desc    Khôi phục thú cưng (Soft Delete)
// @route   PATCH /api/v1/pets/:id/reactivate
// @access  Private (Admin)
const reactivatePet = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền khôi phục thú cưng' });
        }

        const pet = await Pet.findById(req.params.id);
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
        }

        pet.isActive = true;
        await pet.save();

        res.status(200).json({ success: true, message: 'Khôi phục thú cưng thành công', data: pet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cập nhật thông tin thú cưng
// @route   PUT /api/v1/pets/:id
// @access  Private
const updatePet = async (req, res) => {
    try {
        const petId = req.params.id;
        const updates = req.body;

        const pet = await Pet.findById(petId);
        if (!pet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
        }

        // CUSTOMER chỉ được sửa pet của chính mình
        if (req.user.role === 'CUSTOMER' && pet.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật thú cưng này' });
        }

        const updatedPet = await Pet.findByIdAndUpdate(petId, updates, {
            new: true,
            runValidators: true
        });

        if (!updatedPet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
        }

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_PET',
            description: `Cập nhật hồ sơ thú cưng: ${updatedPet.name}`,
            targetModel: 'Pet', targetId: petId,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: updatedPet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createPet, getPets, getPetById, updatePet, deletePet, reactivatePet, checkPetDelete, bulkDeletePets };
