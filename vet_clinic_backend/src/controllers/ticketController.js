const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification'); // Corrected from Notificonst
const mongoose = require('mongoose'); // Added mongoose
const Attendance = require('../models/Attendance');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const GroomingOrder = require('../models/GroomingOrder');
const Vaccination = require('../models/Vaccination');
const Invoice = require('../models/Invoice');
require('../models/User'); // ensure User is compiled
require('../models/Pet');  // ensure Pet is compiled
const ActivityLog = require('../models/ActivityLog');

// @desc    Tạo khiếu nại / yêu cầu hỗ trợ mới (Dành cho Cả Khách và Nhân viên)
// @route   POST /api/v1/tickets
// @access  Private
exports.createTicket = async (req, res) => {
    try {
        const { category, subject, content, referenceType, referenceId, attachment } = req.body;
        
        const ticket = await Ticket.create({
            senderId: req.user._id,
            category,
            subject,
            content,
            attachment: attachment || null,
            referenceType: referenceType || null,
            referenceId: referenceId || null
        });

        // Gửi Noti cho Tất cả Admin
        await Notification.create({
            recipientId: null, // null = gửi quyền ADMIN
            role: 'ADMIN',
            title: `Phiếu hỗ trợ mới: ${subject}`,
            message: `${req.user.fullName} vừa gửi một yêu cầu hỗ trợ (${category}).`,
            type: 'TICKET_NEW',
            link: `/helpdesk?id=${ticket._id.toString()}`,
            metadata: { ticketId: ticket._id.toString() }
        });

        // Gửi Noti cho người tạo (Xác nhận đã nhận yêu cầu)
        const isCustomer = req.user.role === 'CUSTOMER';
        await Notification.create({
            recipientId: req.user._id,
            title: `Đã tiếp nhận yêu cầu: ${subject}`,
            message: `Yêu cầu của bạn đã được ghi nhận. Vui lòng theo dõi trạng thái phiếu thường xuyên nhé.`,
            type: 'TICKET_NEW',
            link: isCustomer ? '/?tab=profile&section=complaint' : '/profile?tab=requests',
            metadata: { ticketId: ticket._id.toString() }
        });

        // Log Activity cho user
        await ActivityLog.create({
            userId: req.user._id,
            action: 'CREATE_TICKET',
            description: `Tạo phiếu hỗ trợ: ${subject}`
        });

        res.status(201).json({ success: true, data: ticket });
    } catch (err) {
        console.error('Create ticket error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi tạo yêu cầu.' });
    }
};

// @desc    Lấy danh sách Ticket do user hiện tại gửi
// @route   GET /api/v1/tickets/me
// @access  Private
exports.getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ senderId: req.user._id })
            .populate({ 
                path: 'referenceId', 
                populate: [
                    { path: 'petId', select: 'name species breed', strictPopulate: false },
                    { path: 'customerId', select: 'fullName phoneNumber', strictPopulate: false },
                    { path: 'doctorId', select: 'fullName', strictPopulate: false },
                    { path: 'staffId', select: 'fullName', strictPopulate: false },
                    { path: 'pets.petId', select: 'name species breed', strictPopulate: false }
                ] 
            })
            .sort('-createdAt');
        
        res.status(200).json({ success: true, count: tickets.length, data: tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Lấy toàn bộ Ticket (Dành riêng cho Admin Helpdesk)
// @route   GET /api/v1/tickets
// @access  Private/Admin
exports.getAllTickets = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.category) filter.category = req.query.category;

        const tickets = await Ticket.find(filter)
            .populate('senderId', 'fullName email phoneNumber avatar role')
            .populate({ 
                path: 'referenceId', 
                populate: [
                    { path: 'petId', select: 'name species breed', strictPopulate: false },
                    { path: 'customerId', select: 'fullName phoneNumber', strictPopulate: false },
                    { path: 'doctorId', select: 'fullName', strictPopulate: false },
                    { path: 'staffId', select: 'fullName', strictPopulate: false },
                    { path: 'pets.petId', select: 'name species breed', strictPopulate: false }
                ] 
            })
            .populate('resolvedBy', 'fullName')
            .sort('-createdAt');
            
        if (tickets.length > 0) {
            console.log("--- DEBUG TICKETS POPULATE ---");
            const aptTicket = tickets.find(t => t.referenceType === 'Appointment');
            if (aptTicket) {
                console.log("Appointment Ticket referenceId:", JSON.stringify(aptTicket.referenceId, null, 2));
            }
        }
        res.status(200).json({ success: true, count: tickets.length, data: tickets });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// @desc    Admin giải quyết Ticket
// @route   PUT /api/v1/tickets/:id/resolve
// @access  Private/Admin
exports.resolveTicket = async (req, res) => {
    try {
        const { status, adminNote, newCheckIn, newCheckOut } = req.body;
        const ticket = await Ticket.findById(req.params.id).populate('senderId', 'fullName role');
        
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu hỗ trợ.' });
        }

        // Xử lý đặc biệt cho khiếu nại chấm công:
        if (ticket.category === 'ATTENDANCE' && status === 'RESOLVED' && newCheckIn && newCheckOut) {
            if (!ticket.referenceId) return res.status(400).json({ success: false, message: 'Ticket không đính kèm ID chấm công hợp lệ.' });
            
            const attendance = await Attendance.findById(ticket.referenceId);
            if (!attendance) return res.status(404).json({ success: false, message: 'Bản ghi chấm công không tồn tại.' });

            // Sửa thẳng giờ vào ra
            attendance.checkIn.time = new Date(newCheckIn);
            attendance.checkOut.time = new Date(newCheckOut);
            attendance.checkOut.isAuto = false; // Xóa cờ phạt
            attendance.status = 'PRESENT';
            await attendance.save();

            // Ghi đè ghi chú vào AdminNote cho rõ ràng
            ticket.adminNote = (adminNote || '') + `\n[Hệ thống]: Đã cập nhật giờ chuẩn: IN: ${new Date(newCheckIn).toLocaleTimeString('vi-VN')} - OUT: ${new Date(newCheckOut).toLocaleTimeString('vi-VN')}`;
        } else {
            if (adminNote !== undefined) {
                ticket.adminNote = adminNote;
            }
        }

        ticket.status = status;
        
        // Chỉ lưu người giải quyết và thời gian khi phiếu hoàn tất (RESOLVED/REJECTED)
        if (status === 'RESOLVED' || status === 'REJECTED') {
            ticket.resolvedBy = req.user._id;
            ticket.resolvedAt = Date.now();
        }
        await ticket.save();

        // Push Noti về cho Khách/Nhân viên (Chỉ khi hoàn tất/từ chối hoặc bắt đầu xử lý)
        const isCustomer = ticket.senderId.role === 'CUSTOMER';
        let notiMessage = '';
        if (status === 'RESOLVED') notiMessage = 'QTV vừa giải quyết phản hồi của bạn! Trạng thái: ✅ Hoàn tất';
        else if (status === 'REJECTED') notiMessage = 'QTV đã phản hồi lại yêu cầu của bạn! Trạng thái: ❌ Từ chối';
        else if (status === 'IN_PROGRESS') notiMessage = 'QTV đã tiếp nhận và đang xử lý yêu cầu của bạn.';
        
        if (notiMessage) {
            await Notification.create({
                recipientId: ticket.senderId._id,
                title: `Cập nhật khiếu nại: ${ticket.subject}`,
                message: notiMessage,
                type: 'TICKET_RESOLVED',
                link: isCustomer ? '/?tab=profile&section=complaint' : '/profile?tab=requests',
                metadata: { ticketId: ticket._id.toString() }
            });
        }

        // Log của Admin
        await ActivityLog.create({
            userId: req.user._id,
            action: status === 'IN_PROGRESS' ? 'VIEW_TICKET' : 'RESOLVE_TICKET',
            description: `${status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Giải quyết'} khiếu nại #${ticket._id.toString().slice(-4)} của ${ticket.senderId.fullName}`
        });

        res.status(200).json({ success: true, data: ticket });
    } catch (err) {
        console.error('Resolve ticket error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi duyệt phiếu.' });
    }
};
