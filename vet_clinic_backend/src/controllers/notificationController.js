const Notification = require('../models/Notification');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const { sendTelegramAlert } = require('../services/notificationService');
const { sendPushNotification } = require('../services/webPushService');

// @desc    Tạo thông báo mới
// @route   POST /api/v1/notifications
// @access  Private
const createNotification = async (req, res) => {
    try {
        const notification = await Notification.create(req.body);

        // Nếu là loại Cấp cứu, gửi thêm qua Telegram và Web Push
        if (req.body.type === 'EMERGENCY') {
            await sendTelegramAlert(req.body);

            // Gửi Web Push cho toàn bộ Bác sĩ và Quản lý
            const targetUsers = await User.find({
                role: { $in: ['DOCTOR', 'ADMIN'] },
                'pushSubscriptions.0': { $exists: true }
            });

            const payload = {
                title: '🚨 CẤP CỨU KHẨN CẤP!',
                body: req.body.message,
                icon: '/emergency-icon.png', // Thay đổi icon nếu cần
                data: {
                    url: '/records'
                }
            };

            for (const user of targetUsers) {
                await sendPushNotification(user.pushSubscriptions, payload);
            }
        }

        res.status(201).json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy thông báo của người dùng hiện tại
// @route   GET /api/v1/notifications/my
// @access  Private
const getMyNotifications = async (req, res) => {
    try {
        const { role, _id } = req.user;

        // Lấy thông báo gửi riêng cho mình HOẶC gửi theo Role (Doctor/Receptionist...)
        const notifications = await Notification.find({
            $or: [
                { recipientId: _id },
                { role: role }
            ],
            deletedBy: { $ne: _id }
        }).sort({ createdAt: -1 }).limit(20).lean();

        res.status(200).json({ success: true, data: notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đánh dấu đã đọc
// @route   PATCH /api/v1/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );
        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đánh dấu tất cả đã đọc
// @route   PATCH /api/v1/notifications/read-all
// @access  Private
const markAllRead = async (req, res) => {
    try {
        const { role, _id } = req.user;
        await Notification.updateMany(
            { $or: [{ recipientId: _id }, { role }], isRead: false, deletedBy: { $ne: _id } },
            { isRead: true }
        );
        res.status(200).json({ success: true, message: 'Đã đọc tất cả thông báo' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa tất cả thông báo
// @route   DELETE /api/v1/notifications/my
// @access  Private
const deleteAllMyNotifications = async (req, res) => {
    try {
        const { role, _id } = req.user;
        await Notification.updateMany(
            { $or: [{ recipientId: _id }, { role }], deletedBy: { $ne: _id } },
            { $addToSet: { deletedBy: _id } }
        );
        res.status(200).json({ success: true, message: 'Đã xóa tất cả thông báo' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đăng ký nhận thông báo Push
// @route   POST /api/v1/notifications/subscribe
// @access  Private
const subscribePush = async (req, res) => {
    try {
        const userId = req.user._id;
        const subscription = req.body;

        await User.findByIdAndUpdate(userId, {
            $addToSet: { pushSubscriptions: subscription }
        });

        res.status(200).json({ success: true, message: 'Đã đăng ký nhận thông báo Push thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const checkMyScheduleNotifications = async (req, res) => {
    try {
        const userId  = req.user._id;
        const now     = new Date();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        // -- Lấy ClinicConfig để biết giờ ca thực tế --
        const ClinicConfig = require('../models/ClinicConfig');
        const Schedule     = require('../models/Schedule');
        const Attendance   = require('../models/Attendance');

        const cfg    = await ClinicConfig.findOne().lean() || {};
        const shifts = cfg.shifts || {
            DAY:     { start: '08:00', end: '12:00' },
            EVENING: { start: '13:30', end: '18:00' },
            NIGHT:   { start: '18:00', end: '23:00' }
        };

        // Hàm parse "HH:MM" → Date hôm nay
        const parseTime = (hhmm) => {
            const [h, m] = hhmm.split(':').map(Number);
            const d = new Date(now);
            d.setHours(h, m, 0, 0);
            return d;
        };

        const todayStart  = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);

        // Lấy lịch trực hôm nay
        const todaySchedules = await Schedule.find({
            staffId: userId,
            date:    { $gte: todayStart, $lt: tomorrowStart },
            status:  'CONFIRMED'
        });

        const created = [];

        for (const sc of todaySchedules) {
            const shiftDef = shifts[sc.shift];
            if (!shiftDef) continue;

            const startTime = parseTime(shiftDef.start);
            const endTime   = parseTime(shiftDef.end);
            const nowMs     = now.getTime();

            // Lấy attendance của ca này
            const att = await Attendance.findOne({ staffId: userId, scheduleId: sc._id });

            // ─── 1. Nhắc ca sắp bắt đầu (trong vòng 60 phút trước) ───
            const minsToStart = (startTime - nowMs) / 60000;
            if (minsToStart > 0 && minsToStart <= 60 && !att?.checkIn?.time) {
                const key = `shift_reminder_${userId}_${sc._id}_${todayStr}`;
                const exists = await Notification.findOne({ 'metadata.notifKey': key });
                if (!exists) {
                    const shiftLabel = sc.shift === 'DAY' ? 'Ca Sáng' : sc.shift === 'EVENING' ? 'Ca Chiều' : 'Ca Tối';
                    const n = await Notification.create({
                        recipientId: userId,
                        title: `📅 ${shiftLabel} sắp bắt đầu`,
                        message: `${shiftLabel} của bạn bắt đầu lúc ${shiftDef.start}. Vui lòng chấm công đúng giờ.`,
                        type:  'SHIFT_REMINDER',
                        link:  '/schedule',
                        metadata: { notifKey: key }
                    });
                    created.push(n);
                }
            }

            // ─── 2. Nhắc chưa kết ca (sau khi ca kết thúc 10 phút, đã check-in nhưng chưa check-out) ───
            const minsAfterEnd = (nowMs - endTime.getTime()) / 60000;
            if (minsAfterEnd >= 10 && att?.checkIn?.time && !att?.checkOut?.time) {
                const key = `checkout_reminder_${userId}_${sc._id}_${todayStr}`;
                const exists = await Notification.findOne({ 'metadata.notifKey': key });
                if (!exists) {
                    const shiftLabel = sc.shift === 'DAY' ? 'Ca Sáng' : sc.shift === 'EVENING' ? 'Ca Chiều' : 'Ca Tối';
                    const n = await Notification.create({
                        recipientId: userId,
                        title: `⏰ Bạn chưa kết ca!`,
                        message: `${shiftLabel} đã kết thúc lúc ${shiftDef.end} nhưng bạn chưa bấm Kết Ca. Vui lòng chấm công ra ngay.`,
                        type:  'CHECKOUT_REMINDER',
                        link:  '/schedule',
                        metadata: { notifKey: key }
                    });
                    created.push(n);
                }
            }
        }

        res.status(200).json({ success: true, created: created.length });
    } catch (error) {
        console.error('[CHECK SCHEDULE NOTIF]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Kiểm tra thuốc sắp hết hạn / hết hạn và gửi notify ADMIN
// @route   POST /api/v1/notifications/check-expiring-medicines
// @access  Private (ADMIN, DOCTOR)
const checkExpiringMedicines = async (req, res) => {
    try {
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const weekStr = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;

        // Lấy thuốc có expiryDate và còn hàng
        const medicines = await Medicine.find({
            isActive: { $ne: false },
            expiryDate: { $ne: null, $lte: in30Days },
            stockQuantity: { $gt: 0 }
        }).populate('productId', 'name');

        let alertCount = 0;

        for (const med of medicines) {
            const name = med.productId?.name || 'Thuốc/Vật tư';
            const expiry = new Date(med.expiryDate);
            const isExpired = expiry < now;
            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

            const key = `expiry_${med._id}_${weekStr}`;
            const exists = await Notification.findOne({ 'metadata.notifKey': key });
            if (exists) continue;

            await Notification.create({
                role: 'ADMIN',
                title: isExpired ? `⛔ Thuốc hết hạn: ${name}` : `⚠️ Sắp hết hạn: ${name}`,
                message: isExpired
                    ? `"${name}" đã HẾT HẠN sử dụng (${expiry.toLocaleDateString('vi-VN')}). Cần loại bỏ khỏi kho ngay.`
                    : `"${name}" sẽ hết hạn sau ${daysLeft} ngày (${expiry.toLocaleDateString('vi-VN')}). Tồn kho: ${med.stockQuantity}.`,
                type: isExpired ? 'EMERGENCY' : 'WARNING',
                link: '/inventory',
                metadata: {
                    notifKey: key,
                    medicineId: med._id.toString(),
                    expiryDate: med.expiryDate,
                    daysLeft: String(daysLeft)
                }
            });
            alertCount++;
        }

        res.status(200).json({ success: true, checked: medicines.length, alertSent: alertCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createNotification,
    getMyNotifications,
    markAsRead,
    markAllRead,
    deleteAllMyNotifications,
    subscribePush,
    checkMyScheduleNotifications,
    checkExpiringMedicines
};
