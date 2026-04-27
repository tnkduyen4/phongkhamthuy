const Service = require('../models/Service');
const logActivity = require('../utils/logActivity');

// @desc    Lấy tất cả danh mục dịch vụ (Có thể lọc theo loại)
// @route   GET /api/v1/services
// @access  Private (All Roles)
exports.getServices = async (req, res) => {
    try {
        const match = {};
        if (req.query.type) {
            match.type = req.query.type;
        }

        // Mặc định lọc bỏ những dịch vụ đã ngưng (Soft Delete)
        if (!req.query.includeInactive) {
            match.isActive = { $ne: false };
        }

        const services = await Service.find(match).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Tạo dịch vụ mới
// @route   POST /api/v1/services
// @access  Private (ADMIN Only)
exports.createService = async (req, res) => {
    try {
        const { name, description, type, price, estimatedDuration } = req.body;

        const newService = await Service.create({
            name,
            description,
            type,
            price,
            estimatedDuration
        });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_SERVICE',
            description: `Tạo dịch vụ mới: ${name} (${type}) — ${(price || 0).toLocaleString('vi-VN')}đ`,
            targetModel: 'Service', targetId: newService._id,
            metadata: { name, type, price }, ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            data: newService
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Cập nhật dịch vụ
// @route   PUT /api/v1/services/:id
// @access  Private (ADMIN Only)
exports.updateService = async (req, res) => {
    try {
        let service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
        }

        service = await Service.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_SERVICE',
            description: `Cập nhật dịch vụ: ${service.name}`,
            targetModel: 'Service', targetId: req.params.id,
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: service
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Xoá dịch vụ
// @route   DELETE /api/v1/services/:id
// @access  Private (ADMIN Only)
exports.deleteService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
        }

        const force = req.query.force === 'true';
        if (force) {
            const Appointment = require('../models/Appointment');
            const MedicalRecord = require('../models/MedicalRecord');
            const GroomingOrder = require('../models/GroomingOrder');

            const apptCount = await Appointment.countDocuments({ $or: [{ serviceId: service._id }, { serviceIds: service._id }] });
            const recCount = await MedicalRecord.countDocuments({ 'services.serviceId': service._id });
            const grCount = await GroomingOrder.countDocuments({ $or: [{ 'services.serviceId': service._id }, { 'pets.services.serviceId': service._id }] });

            if (apptCount > 0 || recCount > 0 || grCount > 0) {
                return res.status(400).json({ success: false, message: 'Dịch vụ này đã được sử dụng trong hệ thống, chỉ có thể chuyển sang trạng thái ngừng kinh doanh.' });
            }

            await Service.findByIdAndDelete(service._id);

            await logActivity({
                userId: req.user._id,
                action: 'DELETE_SERVICE',
                description: `Xóa vĩnh viễn dịch vụ rỗng: ${service.name}`,
                targetModel: 'Service', targetId: service._id,
                ipAddress: req.ip
            });

            return res.status(200).json({ success: true, message: 'Dịch vụ rỗng đã bị xoá vĩnh viễn' });
        }

        // Soft delete: Chuyển sang trạng thái ngừng kinh doanh
        service.isActive = false;
        await service.save();

        await logActivity({
            userId: req.user._id,
            action: 'DEACTIVATE_SERVICE',
            description: `Ngừng kinh doanh dịch vụ: ${service.name}`,
            targetModel: 'Service', targetId: req.params.id,
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Dịch vụ đã được chuyển sang ngừng kinh doanh thành công'
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Kiểm tra dữ liệu liên kết trước khi xoá dịch vụ
// @route   GET /api/v1/services/:id/check-delete
// @access  Private (ADMIN Only)
exports.checkServiceDelete = async (req, res) => {
    try {
        const serviceId = req.params.id;
        
        const Appointment = require('../models/Appointment');
        const MedicalRecord = require('../models/MedicalRecord');
        const GroomingOrder = require('../models/GroomingOrder');

        const promises = [
            Appointment.countDocuments({ $or: [{ serviceId: serviceId }, { serviceIds: serviceId }] }),
            MedicalRecord.countDocuments({ 'services.serviceId': serviceId }),
            GroomingOrder.countDocuments({ $or: [{ 'services.serviceId': serviceId }, { 'pets.services.serviceId': serviceId }] })
        ];

        const results = await Promise.allSettled(promises);
        
        const appointments = results[0].status === 'fulfilled' ? results[0].value : 0;
        const records = results[1].status === 'fulfilled' ? results[1].value : 0;
        const groomingOrders = results[2].status === 'fulfilled' ? results[2].value : 0;

        const totalRelations = appointments + records + groomingOrders;
        
        res.status(200).json({
            success: true,
            hasRelations: totalRelations > 0,
            relations: {
                appointments, records, groomingOrders
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
