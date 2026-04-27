const GroomingOrder = require('../models/GroomingOrder');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logActivity = require('../utils/logActivity');

// @desc    Tạo đơn Grooming mới
// @route   POST /api/v1/grooming
// @access  Private (Nhân viên)
const createGroomingOrder = async (req, res) => {
    try {
        const { customerId, pets, services, transportType, notes, medicalRecordId, isPaid } = req.body;
        console.log('--- CREATE GROOMING ORDER PAYLOAD ---', req.body);

        // Validation: cần ít nhất 1 thú cưng có dịch vụ
        const hasPetServices = Array.isArray(pets) && pets.some(p => p.services && p.services.length > 0);
        const hasGlobalServices = Array.isArray(services) && services.length > 0;
        if (!customerId || !Array.isArray(pets) || pets.length === 0 || (!hasPetServices && !hasGlobalServices)) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin Khách hàng, Thú cưng và Dịch vụ.' });
        }

        // Tạo OrderId tự động: GR-YYYYMMDD-[RANDOM]
        const today = new Date();
        const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase(); // Mạnh mẽ hơn
        const orderId = `GR-${yyyymmdd}-${randomStr}-${Date.now().toString().slice(-4)}`; // Thêm timestamp ngắn để đảm bảo duy nhất

        // Đảm bảo species luôn là Uppercase để khớp Enum và tính tổng tiền
        let totalAmount = 0;
        const sanitizedPets = pets.map(p => {
            const petServices = p.services || [];
            const petTotal = petServices.reduce((sum, svc) => sum + (svc.price || 0), 0);
            totalAmount += petTotal;

            return {
                ...p,
                species: p.species ? p.species.toUpperCase() : 'OTHER',
                weightAtVisit: p.weightAtVisit || 0,
                services: petServices
            };
        });

        // Tính tổng từ per-pet services
        if (services && services.length > 0 && totalAmount === 0) {
            // Chỉ cộng global services nếu per-pet chưa tính gì (tránh double-count)
            totalAmount += services.reduce((sum, svc) => sum + (svc.price || 0), 0);
        }

        // Tính toán số lượng từng loại thú cưng trước khi tạo đơn
        const dogCount = sanitizedPets.filter(p => p.species === 'DOG').length;
        const catCount = sanitizedPets.filter(p => p.species === 'CAT').length;
        const totalPets = sanitizedPets.length;

        const order = await GroomingOrder.create({
            orderId,
            customerId,
            // Lễ tân tạo đơn không tự gán mình làm groomer
            // staffId chỉ được gán khi Groomer nhận ca (check-in)
            staffId: req.user?.role === 'GROOMER' ? req.user._id : null,
            pets: sanitizedPets,
            dogCount,
            catCount,
            totalPets,
            services: services || [], // Lưu global services nếu có
            transportType,
            notes,
            totalAmount,
            medicalRecordId,
            isPaid: isPaid || false,
            status: 'BOOKED'
        });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_GROOMING_ORDER',
            description: `Tạo đơn Grooming ${orderId} — ${totalAmount.toLocaleString('vi-VN')}đ`,
            targetModel: 'GroomingOrder', targetId: order._id,
            metadata: { orderId, totalAmount, transportType },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: order });
    } catch (error) {
        console.error('SERVER ERROR CREATE GROOMING:', error);
        
        // Nếu là lỗi Validation của Mongoose, trả về chi tiết để debug
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: `Lỗi dữ liệu: ${messages.join(', ')}`, details: error.errors });
        }

        res.status(500).json({ 
            success: false, 
            message: error.message || 'Lỗi server không xác định',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        });
    }
};

// @desc    Check-in: Upload ảnh trước & Bắt đầu Grooming
// @route   PATCH /api/v1/grooming/:id/check-in
// @access  Private (GROOMER hoặc ADMIN)
const checkInGrooming = async (req, res) => {
    try {
        // Chỉ GROOMER và ADMIN được check-in
        if (!['GROOMER', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Chỉ Groomer hoặc Admin mới được check-in đơn grooming.' });
        }

        const { beforeImage } = req.body;
        if (!beforeImage) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ảnh chụp trước khi làm (Check-in).' });
        }

        const order = await GroomingOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

        // Nếu đã có groomer khác nhận ca, không cho phép
        if (order.staffId && order.staffId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Đơn này đã có Groomer khác nhận. Liên hệ Admin nếu cần chuyển ca.' });
        }

        const updatedOrder = await GroomingOrder.findByIdAndUpdate(
            req.params.id,
            {
                beforeImage,
                checkinTime: new Date(),
                status: 'GROOMING',
                staffId: req.user._id  // Luôn gán Groomer đang thực hiện check-in
            },
            { new: true, runValidators: true }
        );

        await logActivity({
            userId: req.user._id,
            action: 'GROOMING_CHECKIN',
            description: `Check-in Grooming đơn #${req.params.id.slice(-6).toUpperCase()} — Bắt đầu làm`,
            targetModel: 'GroomingOrder', targetId: req.params.id,
            ipAddress: req.ip
        });

        // Tạo thông báo cho Khách hàng
        if (order.customerId) {
            await Notification.create({
                userId: order.customerId,
                title: 'Pet bắt đầu làm đẹp (Grooming)',
                message: `Nhân viên đã nhận pet và chụp ảnh Check-in cho đơn ${order.orderId}. Vui lòng xem ảnh trong lịch sử chăm sóc.`,
                type: 'INFO',
                link: '/?tab=pets'
            });
        }

        res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Check-out: Upload ảnh sau & Hoàn thành
// @route   PATCH /api/v1/grooming/:id/check-out
// @access  Private (GROOMER đang phụ trách hoặc ADMIN)
const checkOutGrooming = async (req, res) => {
    try {
        // Chỉ GROOMER đang phụ trách hoặc ADMIN mới được check-out
        if (!['GROOMER', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Chỉ Groomer đang phụ trách hoặc Admin mới được check-out.' });
        }

        const { afterImage, completionNotes } = req.body;
        if (!afterImage) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ảnh chụp sau khi làm (Check-out).' });
        }

        const order = await GroomingOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

        // GROOMER chỉ được check-out ca của chính mình
        if (req.user.role === 'GROOMER' && order.staffId?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ được hoàn tất đơn grooming do chính mình phụ trách.' });
        }

        const updatedOrder = await GroomingOrder.findByIdAndUpdate(
            req.params.id,
            {
                afterImage,
                completionNotes,
                checkoutTime: new Date(),
                status: 'COMPLETED',
                staffId: order.staffId || req.user._id
            },
            { new: true, runValidators: true }
        );

        await logActivity({
            userId: req.user._id,
            action: 'GROOMING_CHECKOUT',
            description: `Check-out Grooming đơn #${req.params.id.slice(-6).toUpperCase()} — Hoàn tất (Groomer: ${req.user.fullName || req.user._id})`,
            targetModel: 'GroomingOrder', targetId: req.params.id,
            ipAddress: req.ip
        });

        // Tạo thông báo cho Khách hàng
        if (order.customerId) {
            await Notification.create({
                userId: order.customerId,
                title: 'Pet đã xong làm đẹp (Grooming)',
                message: `Nhân viên đã hoàn thành và chụp ảnh Check-out cho đơn ${order.orderId}. Bạn có thể đón bé ngay.`,
                type: 'SUCCESS',
                link: '/?tab=pets'
            });
        }

        res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Lấy danh sách đơn Grooming
// @route   GET /api/v1/grooming
// @access  Private
const getGroomingOrders = async (req, res) => {
    try {
        let query = {};

        // Khách hàng vãng lai chỉ xem đơn của mình
        if (req.user.role === 'CUSTOMER') {
            query.customerId = req.user._id;
        }

        // Filter thêm nếu có
        if (req.query.status) query.status = req.query.status;
        if (req.query.customerId) query.customerId = req.query.customerId;
        if (req.query.isPaid !== undefined) query.isPaid = req.query.isPaid === 'true';
        if (req.query._id) query._id = req.query._id;
        if (req.query.medicalRecordId !== undefined) {
            query.medicalRecordId = req.query.medicalRecordId === 'null' ? null : req.query.medicalRecordId;
        }
        if (req.query.appointmentId !== undefined) {
            query.appointmentId = req.query.appointmentId === 'null' ? null : req.query.appointmentId;
        }

        console.log('[GROOMING_DEBUG] Fetching with query:', query);
        const limit = parseInt(req.query.limit) || 2000;
        const orders = await GroomingOrder.find(query)
            .populate({
                path: 'customerId',
                select: 'fullName phoneNumber rewardPoints',
                populate: { path: 'customerProfile', select: 'rewardPoints' }
            })
            .populate('staffId', 'fullName')
            .populate('medicalRecordId')
            .sort({ createdAt: -1 })
            .limit(limit);

        res.status(200).json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa đơn Grooming (nếu tạo nhầm)
// @route   DELETE /api/v1/grooming/:id
// @access  Private
const deleteGroomingOrder = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do xóa đơn hàng.' });
        }

        const order = await GroomingOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

        // KHÔNG cho phép xóa đơn đã thanh toán để tránh sai lệch kế toán (Hóa đơn đã lưu)
        if (order.isPaid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Đơn hàng đã THANH TOÁN không thể xóa trực tiếp. Vui lòng hủy hóa đơn hoặc liên hệ Quản trị viên nếu cần hoàn tiền.' 
            });
        }

        const orderId = order.orderId;
        await order.deleteOne();

        await logActivity({
            userId: req.user._id,
            action: 'DELETE_GROOMING_ORDER',
            description: `Xóa đơn Grooming ${orderId} — Lý do: ${reason}`,
            targetModel: 'GroomingOrder', targetId: req.params.id,
            metadata: { orderId, reason },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã xóa đơn hàng thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy lịch sử Grooming theo thú cưng
// @route   GET /api/v1/grooming/pet/:petId
// @access  Private
const getGroomingOrdersByPet = async (req, res) => {
    try {
        const orders = await GroomingOrder.find({ 'pets.petId': req.params.petId })
            .populate('staffId', 'fullName')
            .sort({ createdAt: -1 });

        // Nếu là khách, kiểm tra xem có phải tải đúng pet của mình không?
        if (req.user.role === 'CUSTOMER') {
            const petOrders = orders.filter(o => o.customerId.toString() === req.user._id.toString());
            return res.status(200).json({ success: true, data: petOrders });
        }

        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createGroomingOrder,
    checkInGrooming,
    checkOutGrooming,
    getGroomingOrders,
    deleteGroomingOrder,
    getGroomingOrdersByPet
};
