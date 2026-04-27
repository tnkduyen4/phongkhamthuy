const Appointment = require('../models/Appointment');
const Pet = require('../models/Pet');
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const GroomingOrder = require('../models/GroomingOrder');
const Service = require('../models/Service');
const logActivity = require('../utils/logActivity');

// @desc    Tạo lịch hẹn mới (Khách tự đặt HOẶC Lễ tân đặt cho khách)
// @route   POST /api/v1/appointments
// @access  Private
const createAppointment = async (req, res) => {
    try {
        let { petId, serviceId, serviceIds, type, date, timeSlot, depositAmount, customerNotes, category } = req.body;
        let customerId;

        if (!category) category = 'REGULAR';
        // Chuẩn hoá serviceIds
        if (!serviceIds || !Array.isArray(serviceIds)) serviceIds = serviceId ? [serviceId] : [];
        if (!serviceId && serviceIds.length > 0) serviceId = serviceIds[0];

        if (['RECEPTIONIST', 'ADMIN'].includes(req.user.role)) {
            const pet = await Pet.findById(petId);
            if (!pet) return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
            customerId = pet.ownerId;
        } else {
            customerId = req.user._id;
            const pet = await Pet.findById(petId);
            if (!pet || pet.ownerId.toString() !== customerId.toString()) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền đặt lịch cho thú cưng này' });
            }
        }

        if (!date || !timeSlot || !type) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ Ngày, Giờ và Loại dịch vụ.' });
        }

        const { deliveryType, pickupAddress, returnAddress } = req.body;

        // Xác định nguồn tạo lịch
        const roleSourceMap = {
            CUSTOMER:    'CUSTOMER_APP',
            RECEPTIONIST:'RECEPTIONIST',
            ADMIN:       'RECEPTIONIST',
            DOCTOR:      'DOCTOR',
            GROOMER:     'RECEPTIONIST',
        };
        const bookingSource = req.body.bookingSource || roleSourceMap[req.user.role] || 'CUSTOMER_APP';
        const isStaffCreated = ['ADMIN','RECEPTIONIST','DOCTOR','GROOMER'].includes(req.user.role);

        const appointment = await Appointment.create({
            customerId, petId, serviceId, serviceIds, staffId: null,
            type, date, timeSlot, category,
            depositAmount, customerNotes,
            status: 'BOOKED',
            bookingSource,
            createdByStaffId: isStaffCreated ? req.user._id : undefined,
            deliveryType: (type === 'GROOMING' && ['RECEPTIONIST', 'ADMIN'].includes(req.user.role)) ? (deliveryType || 'NONE') : 'NONE',
            pickupAddress: deliveryType !== 'RETURN_ONLY' ? pickupAddress : undefined,
            returnAddress: deliveryType !== 'PICKUP_ONLY' ? returnAddress : undefined,
        });

        const deliveryNote = appointment.deliveryType && appointment.deliveryType !== 'NONE'
            ? ` | Đưa rước: ${appointment.deliveryType}` : '';
        await logActivity({
            userId: req.user._id, action: 'CREATE_APPOINTMENT',
            description: `Tạo lịch hẹn #${appointment._id.toString().slice(-6).toUpperCase()} — Loại: ${type || '?'} | Ngày: ${date || '?'} ${timeSlot || ''}${deliveryNote}`,
            targetModel: 'Appointment', targetId: appointment._id,
            metadata: { type, date, timeSlot, deliveryType: appointment.deliveryType },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: appointment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy danh sách Lịch hẹn
// @route   GET /api/v1/appointments
// @access  Private
const getAppointments = async (req, res) => {
    try {
        let query = {};

        if (req.user.role === 'CUSTOMER') {
            query.customerId = req.user._id;
        } else if (['DOCTOR', 'GROOMER'].includes(req.user.role)) {
            query.type = req.user.role === 'DOCTOR' ? 'MEDICAL' : 'GROOMING';
            if (req.query.status) query.status = req.query.status;
            if (req.query.date) query.date = req.query.date;
            if (req.query.staffId) query.staffId = req.query.staffId;
        } else {
            if (req.query.status) query.status = req.query.status;
            if (req.query.date) query.date = req.query.date;
            if (req.query.type) query.type = req.query.type;
            if (req.query.staffId) query.staffId = req.query.staffId;
        }

        const limit = parseInt(req.query.limit) || 2000;
        const appointments = await Appointment.find(query)
            .populate({
                path: 'customerId',
                select: 'fullName phoneNumber role rewardPoints',
                populate: { path: 'customerProfile', select: 'rewardPoints' }
            })
            .populate('petId', 'name breed species')
            .populate('serviceId', 'name price')
            .populate('serviceIds', 'name price')
            .populate('staffId', 'fullName role')
            .sort({ date: 1, timeSlot: 1 })
            .limit(limit);

        res.status(200).json({ success: true, count: appointments.length, data: appointments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lễ tân cập nhật trạng thái Lịch Hẹn & Phân công
// @route   PATCH /api/v1/appointments/:id/status
// @access  Private (Chỉ nhân sự)
const updateAppointmentStatus = async (req, res) => {
    try {
        const { status, staffId, staffNotes, cancelReason } = req.body;
        const userRole = req.user.role;
        const userId = req.user._id.toString();

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        }

        let updateData = {};
        if (staffNotes !== undefined) updateData.staffNotes = staffNotes;

        // ── Mạch 1: Bác sĩ / Groomer ──
        if (['DOCTOR', 'GROOMER'].includes(userRole)) {
            const alreadyAssigned = appointment.staffId?.toString();
            if (staffId === userId) {
                if (alreadyAssigned && alreadyAssigned !== userId) {
                    return res.status(403).json({ success: false, message: 'Ca này đã có người nhận rồi.' });
                }
                updateData.staffId = userId;
                updateData.status = 'IN_PROGRESS';
            } else if (status === 'READY_FOR_PAYMENT') {
                if (!alreadyAssigned || alreadyAssigned !== userId) {
                    return res.status(403).json({ success: false, message: 'Chỉ nhân viên đang phụ trách mới có thể hoàn tất ca.' });
                }
                updateData.status = 'READY_FOR_PAYMENT';
            } else {
                return res.status(403).json({ success: false, message: 'Quyền của bạn chỉ cho phép Nhận ca hoặc Hoàn tất chuyên môn (Chờ thanh toán).' });
            }
        }
        // ── Mạch 2: Admin và Lễ tân ──
        else if (['ADMIN', 'RECEPTIONIST'].includes(userRole)) {

            // ── Kiểm tra thời gian khi Check-in (chỉ áp dụng cho Lễ tân, Admin bỏ qua) ──
            if (status === 'ARRIVED' && userRole === 'RECEPTIONIST') {
                const startTimeStr = (appointment.timeSlot || '00:00').includes('-')
                    ? appointment.timeSlot.split('-')[0].trim()
                    : (appointment.timeSlot || '00:00');
                const [h, m] = startTimeStr.split(':').map(Number);
                const aptDateTime = new Date(appointment.date);
                if (!isNaN(h) && !isNaN(m)) {
                    aptDateTime.setHours(h, m, 0, 0);
                    const diffMin = (aptDateTime - new Date()) / 60000;
                    if (diffMin > 60) {
                        return res.status(400).json({
                            success: false,
                            message: `Chưa đến giờ hẹn (${appointment.timeSlot}). Chỉ được check-in trong vòng 60 phút trước giờ hẹn.`
                        });
                    }
                }
            }

            if (userRole === 'RECEPTIONIST') {
                const restricted = ['IN_PROGRESS', 'READY_FOR_PAYMENT', 'COMPLETED'];
                if (status && restricted.includes(status)) {
                    return res.status(403).json({ success: false, message: `Lễ tân không được phép chuyển sang trạng thái là '${status}'.` });
                }
                if (status === 'CANCELLED') {
                    if (!cancelReason) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do hủy lịch.' });
                    if (appointment.status !== 'BOOKED') return res.status(400).json({ success: false, message: 'Chỉ được phép hủy lịch hẹn khi đang ở trạng thái "Đã Đặt".' });
                }
            }
            if (status === 'CANCELLED' && appointment.status !== 'BOOKED') {
                return res.status(400).json({ success: false, message: 'Chỉ được phép hủy lịch hẹn khi đang ở trạng thái "Đã Đặt".' });
            }
            if (status) {
                updateData.status = status;
                if (['IN_PROGRESS', 'READY_FOR_PAYMENT', 'COMPLETED'].includes(status) && !staffId && !appointment.staffId) {
                    updateData.staffId = req.user._id;
                }
            }
            if (cancelReason) updateData.cancelReason = cancelReason;
            if (staffId) updateData.staffId = staffId;
        } else {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện hành động này.' });
        }

        const updated = await Appointment.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
            .populate('customerId', 'fullName phoneNumber')
            .populate('petId', 'name breed species')
            .populate('serviceId', 'name price')
            .populate('serviceIds', 'name price')
            .populate('staffId', 'fullName role');

        const actAction = updateData.status === 'CANCELLED' ? 'CANCEL_APPOINTMENT'
            : updateData.status === 'READY_FOR_PAYMENT' ? 'READY_FOR_PAYMENT'
                : updateData.status === 'COMPLETED' ? 'COMPLETE_APPOINTMENT'
                    : updateData.status === 'IN_PROGRESS' ? 'ACCEPT_APPOINTMENT'
                        : updateData.status === 'ARRIVED' ? 'CHECKIN_APPOINTMENT'
                            : updateData.staffId ? 'ASSIGN_STAFF' : 'UPDATE_APPOINTMENT';

        let actDesc = `Lịch hẹn #${req.params.id.slice(-6).toUpperCase()}`;
        if (updateData.status === 'CANCELLED') actDesc += ` — Hủy: ${cancelReason || 'Không có lý do'}`;
        else if (updateData.status === 'COMPLETED') actDesc += ' — Đã hoàn tất ca và thanh toán';
        else if (updateData.status === 'READY_FOR_PAYMENT') actDesc += ' — Hoàn tất chuyên môn (Chờ thanh toán)';
        else if (updateData.status === 'IN_PROGRESS') actDesc += ' — Bắt đầu nhận ca';
        else if (updateData.status === 'ARRIVED') actDesc += ' — Check-in đã đến';

        await logActivity({
            userId: req.user._id, action: actAction, description: actDesc,
            targetModel: 'Appointment', targetId: req.params.id,
            metadata: { oldStatus: appointment.status, newStatus: updateData.status, cancelReason },
            ipAddress: req.ip
        });

        // ── Auto-create GroomingOrder khi lịch hẹn Grooming ARRIVED hoặc IN_PROGRESS ──
        if (['ARRIVED', 'IN_PROGRESS'].includes(updateData.status) && appointment.type === 'GROOMING') {
            const existing = await GroomingOrder.findOne({ appointmentId: appointment._id });
            if (!existing) {
                try {
                    const serviceIds = appointment.serviceIds?.length
                        ? appointment.serviceIds
                        : (appointment.serviceId ? [appointment.serviceId] : []);
                    const services = await Service.find({ _id: { $in: serviceIds } });
                    const mappedServices = services.map(s => ({
                        serviceId: s._id, name: s.name, price: s.price || 0
                    }));

                    // Lấy tất cả thú cưng: petIds (đặt nhiều) hoặc petId (một con)
                    const allPetIds = appointment.petIds?.length
                        ? appointment.petIds
                        : [appointment.petId];
                    const allPets = await Pet.find({ _id: { $in: allPetIds } });

                    const petsEntries = allPets.map(pet => ({
                        petId: pet._id,
                        name: pet.name || 'Thú cưng',
                        species: (pet.species || 'OTHER').toUpperCase(),
                        weightAtVisit: pet.weight || 0,
                        services: mappedServices // mỗi con cùng dịch vụ đã chọn
                    }));

                    const perPetTotal = mappedServices.reduce((s, x) => s + x.price, 0);
                    const totalAmount = perPetTotal * petsEntries.length;
                    const dogCount = allPets.filter(p => p.species === 'DOG').length;
                    const catCount = allPets.filter(p => p.species === 'CAT').length;

                    const today = new Date();
                    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
                    const orderId = `GR-${yyyymmdd}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

                    await GroomingOrder.create({
                        orderId,
                        customerId: appointment.customerId,
                        pets: petsEntries,
                        dogCount, catCount,
                        totalPets: petsEntries.length,
                        services: mappedServices,
                        transportType: appointment.deliveryType && appointment.deliveryType !== 'NONE' ? 'PICKUP' : 'DROPOFF',
                        notes: appointment.customerNotes || '',
                        totalAmount,
                        appointmentId: appointment._id,
                        status: 'BOOKED'
                    });
                } catch (grErr) {
                    console.error('[AUTO_GROOMING] Lỗi tạo đơn tự động:', grErr.message);
                }
            }
        }

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Staff đề xuất đổi lịch → chờ khách xác nhận (không tự cập nhật ngay)
// @route   PATCH /api/v1/appointments/:id/reschedule
// @access  Private (ADMIN, RECEPTIONIST, DOCTOR)
const rescheduleAppointment = async (req, res) => {
    try {
        const { date, timeSlot, note } = req.body;
        const userRole = req.user.role;

        if (!['ADMIN', 'RECEPTIONIST', 'DOCTOR'].includes(userRole)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa lịch hẹn.' });
        }
        if (!date && !timeSlot) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày hoặc giờ mới.' });
        }
        if (!note || !note.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng ghi chú lý do đề xuất đổi lịch cho khách.' });
        }

        const appointment = await Appointment.findById(req.params.id).populate('customerId', 'fullName _id');
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

        if (userRole === 'DOCTOR' && appointment.staffId?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bác sĩ chỉ được phép đổi lịch hẹn do chính mình phụ trách.' });
        }

        if (appointment.status !== 'BOOKED') {
            return res.status(400).json({ success: false, message: `Chỉ được phép đề xuất đổi lịch khi trạng thái là "Đã Đặt". Hiện tại: ${appointment.status}` });
        }

        const oldDate = appointment.date;
        const oldTimeSlot = appointment.timeSlot;
        const staffName = req.user.fullName || 'Nhân viên';
        const oldD = oldDate ? new Date(oldDate).toLocaleDateString('vi-VN') : '?';
        const newD = date ? new Date(date).toLocaleDateString('vi-VN') : oldD;

        // ── Chuyển sang RESCHEDULE_PENDING, lưu đề xuất ──
        await Appointment.findByIdAndUpdate(req.params.id, {
            status: 'RESCHEDULE_PENDING',
            proposedDate: date || appointment.date,
            proposedTimeSlot: timeSlot || appointment.timeSlot,
            proposedBy: req.user._id,
            rescheduleNote: note
        });

        // ── Gửi thông báo yêu cầu xác nhận đến khách ──
        try {
            const Notification = require('../models/Notification');
            const customerId = appointment.customerId?._id || appointment.customerId;
            await Notification.create({
                recipientId: customerId,
                title: '📅 Phòng khám muốn đổi lịch hẹn của bạn',
                message: `Lịch hẹn #${req.params.id.slice(-6).toUpperCase()} được đề nghị đổi từ ${oldD} ${oldTimeSlot || ''} → ${newD} ${timeSlot || oldTimeSlot || ''}. Lý do: ${note}. Vui lòng vào mục Lịch hẹn để Đồng ý hoặc Từ chối.`,
                type: 'WARNING',
                link: '/?tab=appointments',
                metadata: {
                    appointmentId: req.params.id,
                    proposedDate: String(date || appointment.date),
                    proposedTimeSlot: String(timeSlot || appointment.timeSlot),
                    changedBy: req.user._id.toString(),
                    changedByName: staffName,
                    notifKey: `reschedule_propose_${req.params.id}_${Date.now()}`
                }
            });
        } catch (e) {
            console.error('[NOTIFY] Lỗi gửi thông báo đổi lịch:', e.message);
        }

        await logActivity({
            userId: req.user._id, action: 'PROPOSE_RESCHEDULE',
            description: `${staffName} đề xuất đổi lịch #${req.params.id.slice(-6).toUpperCase()} | ${oldD} ${oldTimeSlot} → ${newD} ${timeSlot || oldTimeSlot} | Lý do: ${note}`,
            targetModel: 'Appointment', targetId: req.params.id,
            metadata: { oldDate: String(oldDate), oldTimeSlot, proposedDate: String(date), proposedTimeSlot: timeSlot, note },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã gửi đề xuất đổi lịch cho khách hàng. Chờ khách xác nhận.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Khách hàng xác nhận hoặc từ chối đề xuất đổi lịch
// @route   PATCH /api/v1/appointments/:id/reschedule-confirm
// @access  Private (CUSTOMER)
const confirmReschedule = async (req, res) => {
    try {
        const { action } = req.body; // 'ACCEPT' hoặc 'REJECT'
        if (!['ACCEPT', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phải là ACCEPT hoặc REJECT.' });
        }

        const appointment = await Appointment.findById(req.params.id).populate('proposedBy', 'fullName _id');
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });

        if (appointment.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xác nhận lịch hẹn này.' });
        }
        if (appointment.status !== 'RESCHEDULE_PENDING') {
            return res.status(400).json({ success: false, message: 'Lịch hẹn này không có đề xuất đổi lịch nào đang chờ.' });
        }

        const Notification = require('../models/Notification');
        const aptCode = req.params.id.slice(-6).toUpperCase();
        const proposedById = appointment.proposedBy?._id?.toString() || appointment.proposedBy?.toString();
        const assignedStaffId = appointment.staffId?.toString();
        const customerName = req.user.fullName || 'Khách hàng';

        // Helper: broadcast to all ADMIN + RECEPTIONIST + assignedStaff + proposedBy (dedup)
        const broadcastToStaff = async (title, message, type = 'INFO') => {
            const staffUsers = await User.find(
                { role: { $in: ['ADMIN', 'RECEPTIONIST'] }, _id: { $ne: req.user._id } },
                '_id'
            );
            const recipientSet = new Set(staffUsers.map(u => u._id.toString()));
            if (proposedById) recipientSet.add(proposedById);
            if (assignedStaffId) recipientSet.add(assignedStaffId);
            // remove customer themselves
            recipientSet.delete(req.user._id.toString());
            await Promise.all([...recipientSet].map(rid =>
                Notification.create({
                    recipientId: rid, title, message, type,
                    link: '/appointments',
                    metadata: { appointmentId: req.params.id }
                }).catch(() => {})
            ));
        };

        if (action === 'ACCEPT') {
            await Appointment.findByIdAndUpdate(req.params.id, {
                date: appointment.proposedDate,
                timeSlot: appointment.proposedTimeSlot,
                status: 'BOOKED',
                proposedDate: null, proposedTimeSlot: null,
                proposedBy: null, rescheduleNote: null
            });

            const newD = new Date(appointment.proposedDate).toLocaleDateString('vi-VN');
            await broadcastToStaff(
                '✅ Khách đồng ý đổi lịch',
                `${customerName} đã đồng ý đổi lịch hẹn #${aptCode} sang ${newD} lúc ${appointment.proposedTimeSlot}.`
            );

            await logActivity({
                userId: req.user._id, action: 'ACCEPT_RESCHEDULE',
                description: `Khách đồng ý đổi lịch #${aptCode} → ${newD} ${appointment.proposedTimeSlot}`,
                targetModel: 'Appointment', targetId: req.params.id,
                metadata: { newDate: String(appointment.proposedDate), newTimeSlot: appointment.proposedTimeSlot },
                ipAddress: req.ip
            });

            return res.status(200).json({ success: true, message: 'Đã xác nhận lịch hẹn mới.' });
        }

        // REJECT — keep old schedule
        await Appointment.findByIdAndUpdate(req.params.id, {
            status: 'BOOKED',
            proposedDate: null, proposedTimeSlot: null,
            proposedBy: null, rescheduleNote: null
        });

        await broadcastToStaff(
            '❌ Khách từ chối đổi lịch',
            `${customerName} đã từ chối đề xuất đổi lịch hẹn #${aptCode}. Lịch hẹn vẫn giữ nguyên ngày cũ.`,
            'WARNING'
        );

        await logActivity({
            userId: req.user._id, action: 'REJECT_RESCHEDULE',
            description: `Khách từ chối đổi lịch #${aptCode}, giữ nguyên lịch cũ.`,
            targetModel: 'Appointment', targetId: req.params.id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã từ chối, lịch hẹn giữ nguyên.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Khách hàng tự hủy lịch (chỉ khi trạng thái là BOOKED)
// @route   PATCH /api/v1/appointments/:id/cancel
// @access  Private (CUSTOMER)
const cancelMyAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        if (req.user.role === 'CUSTOMER' && appointment.customerId?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền huỷ lịch hẹn này' });
        }
        if (!['BOOKED', 'RESCHEDULE_PENDING'].includes(appointment.status)) {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy lịch khi đang ở trạng thái đã đặt' });
        }

        appointment.status = 'CANCELLED';
        appointment.cancelReason = 'Khách hàng tự huỷ qua App';
        await appointment.save();

        await logActivity({
            userId: req.user._id, action: 'CANCEL_APPOINTMENT_BY_CUSTOMER',
            description: `Khách hàng tự hủy lịch hẹn #${req.params.id.slice(-6).toUpperCase()}`,
            targetModel: 'Appointment', targetId: req.params.id,
            metadata: { oldStatus: 'BOOKED', newStatus: 'CANCELLED' },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Khách hàng đánh giá chất lượng (chỉ khi COMPLETED)
// @route   POST /api/v1/appointments/:id/rate
// @access  Private (CUSTOMER)
const rateAppointment = async (req, res) => {
    try {
        const { rating, feedback } = req.body;
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        if (req.user.role === 'CUSTOMER' && appointment.customerId?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền đánh giá lịch hẹn này' });
        }
        if (appointment.status !== 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể đánh giá lịch hẹn sau khi đã khám xong' });
        }
        if (appointment.rating) {
            return res.status(400).json({ success: false, message: 'Bạn đã đánh giá lịch hẹn này rồi' });
        }

        appointment.rating = rating;
        if (feedback) appointment.ratingFeedback = feedback;
        await appointment.save();

        res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Khách hàng tự đổi lịch của chính mình
// @route   PATCH /api/v1/appointments/:id/reschedule-self
const rescheduleByCustomer = async (req, res) => {
    try {
        const { date, timeSlot } = req.body;
        if (!date && !timeSlot) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày hoặc giờ mới.' });
        }
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn.' });
        if (req.user.role === 'CUSTOMER' && appointment.customerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền đổi lịch hẹn này.' });
        }
        if (appointment.status !== 'BOOKED') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể đổi lịch khi trạng thái là Đã Đặt.' });
        }
        const updateData = {};
        if (date) updateData.date = date;
        if (timeSlot) updateData.timeSlot = timeSlot;
        const updated = await Appointment.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
            .populate('customerId', 'fullName phoneNumber')
            .populate('petId', 'name breed species')
            .populate('serviceId', 'name price')
            .populate('serviceIds', 'name price')
            .populate('staffId', 'fullName role');

        // Notify all admin/receptionist + assigned staff when customer self-reschedules
        try {
            const Notification = require('../models/Notification');
            const aptCode = req.params.id.slice(-6).toUpperCase();
            const customerName = req.user.fullName || 'Khách hàng';
            const newD = date ? new Date(date).toLocaleDateString('vi-VN') : '(giữ nguyên)';
            const newT = timeSlot || (updated.timeSlot || '?');
            const assignedId = appointment.staffId?.toString();

            const staffUsers = await User.find(
                { role: { $in: ['ADMIN', 'RECEPTIONIST'] }, _id: { $ne: req.user._id } },
                '_id'
            );
            const recipientSet = new Set(staffUsers.map(u => u._id.toString()));
            if (assignedId) recipientSet.add(assignedId);
            recipientSet.delete(req.user._id.toString());

            await Promise.all([...recipientSet].map(rid =>
                Notification.create({
                    recipientId: rid,
                    title: '📅 Khách tự đổi lịch hẹn',
                    message: `${customerName} đã tự đổi lịch hẹn #${aptCode} sang ${newD} lúc ${newT}. Vui lòng kiểm tra lại lịch trình.`,
                    type: 'WARNING', link: '/appointments',
                    metadata: { appointmentId: req.params.id, newDate: date, newTimeSlot: timeSlot }
                }).catch(() => {})
            ));
        } catch (notifErr) {
            console.error('[NOTIFY] Customer self-reschedule notify failed:', notifErr.message);
        }

        await logActivity({
            userId: req.user._id, action: 'RESCHEDULE_BY_CUSTOMER',
            description: `Khách hàng ${req.user.fullName || ''} đổi lịch #${req.params.id.slice(-6).toUpperCase()} → ${date || '?'} ${timeSlot || ''}`,
            targetModel: 'Appointment', targetId: req.params.id,
            metadata: { newDate: date, newTimeSlot: timeSlot }, ipAddress: req.ip
        });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createAppointment, getAppointments, updateAppointmentStatus,
    rescheduleAppointment, confirmReschedule,
    cancelMyAppointment, rateAppointment, rescheduleByCustomer
};
