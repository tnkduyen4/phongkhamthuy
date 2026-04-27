const User = require('../models/User');
const Schedule = require('../models/Schedule');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const HrmConfig = require('../models/HrmConfig');
const Attendance = require('../models/Attendance');
const ClinicConfig = require('../models/ClinicConfig');
const Notification = require('../models/Notification');
const logActivity = require('../utils/logActivity');

// ============================================
// Giá trị mặc định nếu Admin chưa cấu hình
// baseSalary = lương/GIỜ (đ/h), nightShiftAllowance = HỆ SỐ (1.5 = x1.5)
// ============================================
const DEFAULT_CONFIG = {
    DOCTOR:      { baseSalary: 150000, commissionServiceRate: 0.10, commissionMedicineRate: 0.05, onCallFee: 0, emergencyCaseFee: 0, nightShiftAllowance: 1.5 },
    RECEPTIONIST:{ baseSalary: 50000,  commissionServiceRate: 0.05, commissionMedicineRate: 0.03, onCallFee: 0, emergencyCaseFee: 0, nightShiftAllowance: 1.5 },
    GROOMER:     { baseSalary: 60000,  commissionServiceRate: 0.10, commissionMedicineRate: 0.00, onCallFee: 0, emergencyCaseFee: 0, nightShiftAllowance: 1.5 },
    DEFAULT:     { baseSalary: 40000,  commissionServiceRate: 0,    commissionMedicineRate: 0,    onCallFee: 0, emergencyCaseFee: 0, nightShiftAllowance: 1.5 },
};

// Đọc config từ DB, fallback sang DEFAULT_CONFIG nếu chưa cài
const getConfigForRole = async (role) => {
    const cfg = await HrmConfig.findOne({ role });
    if (cfg) return cfg.toObject();
    return DEFAULT_CONFIG[role] || DEFAULT_CONFIG.DEFAULT;
};

// ============================================
// ADMIN: Quản lý cấu hình phụ cấp HRM
// ============================================
exports.getHrmConfigs = async (req, res) => {
    try {
        const dbConfigs = await HrmConfig.find({});
        const roles = ['DOCTOR', 'RECEPTIONIST', 'GROOMER', 'DEFAULT'];
        const result = roles.map(r => {
            const dbCfg = dbConfigs.find(c => c.role === r);
            return dbCfg ? dbCfg : { role: r, ...DEFAULT_CONFIG[r], _isDefault: true };
        });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.upsertHrmConfig = async (req, res) => {
    try {
        const { role } = req.params;
        const updateData = { ...req.body };

        console.log(`[HRM] Updating policy for role: ${role}`, updateData);

        const config = await HrmConfig.findOneAndUpdate(
            { role },
            { ...updateData, role },
            { new: true, upsert: true, runValidators: true }
        );

        const baseSalary = parseFloat(updateData.baseSalary);
        const targetRoles = ['DOCTOR', 'RECEPTIONIST', 'GROOMER'];

        if (!isNaN(baseSalary) && targetRoles.includes(role)) {
            const updateFields = {
                baseSalary: baseSalary,
                onCallFee: parseFloat(updateData.onCallFee) || 0,
                emergencyCaseFee: parseFloat(updateData.emergencyCaseFee) || 0,
                nightShiftAllowance: parseFloat(updateData.nightShiftAllowance) || 0
            };

            const users = await User.find({ role: { $regex: new RegExp(`^${role}$`, 'i') } }).select('_id');
            const userIds = users.map(u => u._id);
            const StaffProfile = require('../models/StaffProfile');
            await StaffProfile.updateMany(
                { userId: { $in: userIds } },
                { $set: updateFields }
            );
        }

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_HRM_CONFIG',
            description: `Cập nhật chính sách lương cho role: ${role}`,
            metadata: { role, updateData }, ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.bulkUpdateConfigs = async (req, res) => {
    try {
        const { configs } = req.body;
        if (!configs || !Array.isArray(configs)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
        }

        const results = [];
        for (const cfg of configs) {
            const role = cfg.role;
            const updateData = { ...cfg };

            const config = await HrmConfig.findOneAndUpdate(
                { role },
                { ...updateData, role },
                { new: true, upsert: true, runValidators: true }
            );

            // Cập nhật lương cho nhân viên đang có role này (trừ DEFAULT)
            if (role !== 'DEFAULT') {
                const updateFields = {
                    baseSalary: parseFloat(updateData.baseSalary) || 0,
                    onCallFee: parseFloat(updateData.onCallFee) || 0,
                    emergencyCaseFee: parseFloat(updateData.emergencyCaseFee) || 0,
                    nightShiftAllowance: parseFloat(updateData.nightShiftAllowance) || 0
                };

                const users = await User.find({ role }).select('_id');
                const userIds = users.map(u => u._id);
                const StaffProfile = require('../models/StaffProfile');
                await StaffProfile.updateMany(
                    { userId: { $in: userIds } },
                    { $set: updateFields }
                );
            }
            results.push(config);
        }

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_HRM_CONFIG',
            description: `Ban hành chính sách lương toàn hệ thống cho ${configs.length} bộ phận`,
            metadata: { count: configs.length }, ipAddress: req.ip
        });

        res.status(200).json({ success: true, count: results.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// SCHEDULES
// ============================================
exports.getDutyStaff = async (req, res) => {
    try {
        // Frontend truyền ngày và ca hiện tại theo timezone VN của client
        const dateStr = req.query.date; // "2026-03-14"
        const currentShift = req.query.currentShift || 'DAY';

        let start, end;
        if (dateStr) {
            const d = new Date(dateStr); // UTC midnight của ngày đó
            start = new Date(d.getTime() - 7 * 60 * 60 * 1000); // -7h: bắt đầu từ VN midnight hôm đó
            end = new Date(d.getTime() + 17 * 60 * 60 * 1000); // +17h: kết thúc VN 23:59
        } else {
            const now = new Date();
            start = new Date(now); start.setUTCHours(0, 0, 0, 0);
            end = new Date(now); end.setUTCHours(23, 59, 59, 999);
        }

        console.log(`[DutyStaff] Querying date: ${dateStr}, range: ${start.toISOString()} → ${end.toISOString()}`);

        const rawSchedules = await Schedule.find({
            date: { $gte: start, $lte: end },
            status: 'CONFIRMED'
        }).populate({
            path: 'staffId',
            select: 'fullName role phoneNumber avatar isActive',
            match: { isActive: { $ne: false } }
        });
        const schedules = rawSchedules.filter(s => s.staffId != null);

        console.log(`[DutyStaff] Found ${schedules.length} schedules`);

        // Lấy tất cả chấm công hôm nay cho các ca này
        const scheduleIds = schedules.map(s => s._id);
        const todayAttendances = await Attendance.find({
            scheduleId: { $in: scheduleIds },
            'checkIn.time': { $exists: true }
        }).select('scheduleId staffId');

        // Map scheduleId → có checkin không
        const checkedInScheduleIds = new Set(todayAttendances.map(a => a.scheduleId.toString()));

        res.status(200).json({
            success: true,
            currentShift,
            data: schedules.map(s => ({
                ...s.staffId._doc,
                shift: s.shift,
                isOnCall: s.isOnCall,
                hasCheckedIn: checkedInScheduleIds.has(s._id.toString()) // ← thêm flag này
            }))
        });
    } catch (error) {
        console.error('[HRM] getDutyStaff error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSchedules = async (req, res) => {
    try {
        const { staffId, startDate, endDate } = req.query;
        let query = {};
        if (staffId) query.staffId = staffId;
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        const rawSchedules = await Schedule.find(query)
            .populate({
                path: 'staffId',
                select: 'fullName role isActive',
                match: { isActive: { $ne: false } }
            })
            .sort({ date: 1 });
        const schedules = rawSchedules.filter(s => s.staffId != null);
        res.status(200).json({ success: true, data: schedules });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const { staffId, date, shift } = req.body;
        const existingStaff = await Schedule.findOne({ staffId, date, status: 'CONFIRMED' });
        if (existingStaff) {
            return res.status(400).json({ success: false, message: 'Nhân viên này đã có ca trực trong ngày hôm nay.' });
        }

        if (shift === 'NIGHT') {
            const mainConfig = await HrmConfig.findOne({ role: 'DEFAULT' });
            const reqDoctors = mainConfig?.nightShiftRequirements?.minDoctors || 1;
            const reqOthers = mainConfig?.nightShiftRequirements?.minAssistants || 1;

            const currentNightSchedules = await Schedule.find({ date, shift: 'NIGHT', status: 'CONFIRMED' })
                .populate('staffId', 'role');

            const currentStaff = await User.findById(staffId);
            const allNightStaff = [...currentNightSchedules.map(s => s.staffId), currentStaff];

            const doctorCount = allNightStaff.filter(s => s?.role === 'DOCTOR').length;
            const otherCount = allNightStaff.filter(s => s && s.role !== 'DOCTOR').length;

            const isStaffingMet = doctorCount >= reqDoctors && otherCount >= reqOthers;

            const schedule = await Schedule.create(req.body);

            await logActivity({
                userId: req.user._id,
                action: 'CREATE_SCHEDULE',
                description: `Thêm lịch trực: Ca ${shift} ngày ${new Date(date).toLocaleDateString('vi-VN')} cho NV #${staffId?.toString().slice(-6).toUpperCase()}`,
                metadata: { staffId, date, shift }, ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                data: schedule,
                staffingStatus: {
                    isMet: isStaffingMet,
                    doctors: `${doctorCount}/${reqDoctors}`,
                    others: `${otherCount}/${reqOthers}`
                }
            });
        }

        const schedule = await Schedule.create(req.body);

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_SCHEDULE',
            description: `Thêm lịch trực: Ca ${shift} ngày ${new Date(date).toLocaleDateString('vi-VN')} cho NV #${staffId?.toString().slice(-6).toUpperCase()}`,
            metadata: { staffId, date, shift }, ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: schedule });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.bulkCreateSchedules = async (req, res) => {
    try {
        const { staffIds, startDate, endDate, shift } = req.body;
        if (!staffIds || !Array.isArray(staffIds) || !startDate || !endDate || !shift) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ (staffIds, startDate, endDate, shift là bắt buộc).' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const results = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            currentDate.setHours(0, 0, 0, 0);

            for (const staffId of staffIds) {
                // Check duplicate for this staff on this day
                const existing = await Schedule.findOne({ staffId, date: currentDate, status: 'CONFIRMED' });
                if (existing) {
                    // Overwrite if shift is different, or skip if same
                    if (existing.shift !== shift) {
                        existing.shift = shift;
                        await existing.save();
                        results.push(existing);
                    }
                } else {
                    const newSched = await Schedule.create({
                        staffId,
                        date: currentDate,
                        shift,
                        status: 'CONFIRMED'
                    });
                    results.push(newSched);
                }
            }
        }

        await logActivity({
            userId: req.user._id,
            action: 'BULK_CREATE_SCHEDULE',
            description: `Phân ca hàng loạt: ${results.length} bản ghi (Từ ${new Date(startDate).toLocaleDateString('vi-VN')} đến ${new Date(endDate).toLocaleDateString('vi-VN')}) cho ${staffIds.length} nhân viên`,
            metadata: { count: results.length, staffIds, startDate, endDate, shift },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, count: results.length, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.syncSchedules = async (req, res) => {
    try {
        const { schedules } = req.body; // Array of { staffId, date, shifts: ['DAY', 'NIGHT'] }
        if (!schedules || !Array.isArray(schedules)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
        }

        const isAdmin = req.user.role === 'ADMIN';

        // ─── BACKEND GUARD: Khóa chỉnh sửa ngày quá khứ với non-Admin ───
        // Tính "hôm nay UTC+7" → ngày bắt đầu 00:00 VN
        const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const todayVN = nowVN.toISOString().split('T')[0]; // "2026-03-14"

        const pastEntries = schedules.filter(item => {
            const itemDate = typeof item.date === 'string' ? item.date.split('T')[0] : new Date(item.date).toISOString().split('T')[0];
            return itemDate < todayVN;
        });

        if (pastEntries.length > 0 && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: `Không thể sửa lịch của ${pastEntries.length} ngày đã qua. Chỉ Admin mới có quyền điều chỉnh lịch cũ.`
            });
        }

        // Nếu Admin sửa ngày cũ, ghi log riêng để audit
        if (pastEntries.length > 0 && isAdmin) {
            await logActivity({
                userId: req.user._id,
                action: 'ADMIN_EDIT_PAST_SCHEDULE',
                description: `Admin chỉnh sửa lịch của ${pastEntries.length} ngày đã qua (${pastEntries.map(e => e.date).join(', ')})`,
                metadata: { dates: pastEntries.map(e => e.date) },
                ipAddress: req.ip
            });
        }

        let totalProcessed = 0;
        for (const item of schedules) {
            const { staffId, date, shifts } = item;

            // "2026-03-14" → UTC midnight 2026-03-14T00:00:00.000Z
            const utcMidnight = new Date(date);

            // Dùng range rộng để xoá cả dữ liệu cũ (có thể lưu tại nhiều timestamps khác nhau)
            // từ 2026-03-13T17:00Z (VN midnight) đến 2026-03-14T17:00Z (hết ngày VN 23:59)
            const rangeStart = new Date(utcMidnight.getTime() - 7 * 60 * 60 * 1000);
            const rangeEnd = new Date(utcMidnight.getTime() + 17 * 60 * 60 * 1000);

            // Xoá tất cả lịch cũ trong ngày đó (dù lưu theo bất kỳ timezone nào)
            await Schedule.deleteMany({
                staffId,
                date: { $gte: rangeStart, $lte: rangeEnd },
                status: 'CONFIRMED'
            });

            // Lưu ca mới với UTC midnight — nhất quán, đơn giản
            if (shifts && shifts.length > 0) {
                const newSchedules = shifts.map(s => ({
                    staffId,
                    date: utcMidnight, // 2026-03-14T00:00:00.000Z
                    shift: s,
                    status: 'CONFIRMED'
                }));
                await Schedule.insertMany(newSchedules);
                totalProcessed += newSchedules.length;
            }
        }

        // --- Kích hoạt Thông báo cho nhân viên ---
        const staffUpdates = {};
        for (const item of schedules) {
            const { staffId, date } = item;
            if (!staffUpdates[staffId]) {
                staffUpdates[staffId] = { minDate: date, maxDate: date };
            } else {
                if (date < staffUpdates[staffId].minDate) staffUpdates[staffId].minDate = date;
                if (date > staffUpdates[staffId].maxDate) staffUpdates[staffId].maxDate = date;
            }
        }

        for (const staffId of Object.keys(staffUpdates)) {
            try {
                const { minDate, maxDate } = staffUpdates[staffId];
                const minFmt = new Date(minDate).toLocaleDateString('vi-VN');
                const maxFmt = new Date(maxDate).toLocaleDateString('vi-VN');
                const dateStr = minDate === maxDate ? minFmt : `từ ${minFmt} đến ${maxFmt}`;
                
                await Notification.create({
                    recipientId: staffId,
                    title: '📅 Cập nhật lịch trực',
                    message: `Quản lý đã cập nhật lịch trực của bạn ${dateStr}. Nhấn để xem chi tiết.`,
                    type: 'INFO',
                    link: '/schedule'
                });
            } catch (err) {
                console.error('[HRM] Không thể tạo thông báo lịch trực:', err.message);
            }
        }

        await logActivity({
            userId: req.user._id,
            action: 'SYNC_SCHEDULES',
            description: `Đồng bộ ma trận lịch trực đa ca: ${totalProcessed} ca trực được cập nhật`,
            metadata: { count: totalProcessed },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, count: totalProcessed });
    } catch (error) {
        console.error("[HRM] SYNC ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId, date, shift } = req.body;

        const duplicate = await Schedule.findOne({ staffId, date, _id: { $ne: id }, status: 'CONFIRMED' });
        if (duplicate) {
            return res.status(400).json({ success: false, message: 'Nhân viên đã có lịch khác trong ngày này.' });
        }

        let staffingStatus = null;
        if (shift === 'NIGHT') {
            const mainConfig = await HrmConfig.findOne({ role: 'DEFAULT' });
            const reqDoctors = mainConfig?.nightShiftRequirements?.minDoctors || 1;
            const reqOthers = mainConfig?.nightShiftRequirements?.minAssistants || 1;

            const existingNightSchedules = await Schedule.find({
                date, shift: 'NIGHT', status: 'CONFIRMED', _id: { $ne: id }
            }).populate('staffId', 'role');

            const currentStaff = await User.findById(staffId);
            const allNightStaff = [...existingNightSchedules.map(s => s.staffId), currentStaff];

            const doctorCount = allNightStaff.filter(s => s?.role === 'DOCTOR').length;
            const otherCount = allNightStaff.filter(s => s && s.role !== 'DOCTOR').length;

            staffingStatus = {
                isMet: doctorCount >= reqDoctors && otherCount >= reqOthers,
                doctors: `${doctorCount}/${reqDoctors}`,
                others: `${otherCount}/${reqOthers}`
            };
        }

        const schedule = await Schedule.findByIdAndUpdate(id, req.body, { new: true });

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_SCHEDULE',
            description: `Sửa lịch trực #${id.slice(-6).toUpperCase()}: Ca ${shift} ngày ${new Date(date).toLocaleDateString('vi-VN')}`,
            metadata: { staffId, date, shift }, ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: schedule, staffingStatus });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Schedule.findById(id);
        await Schedule.findByIdAndDelete(id);

        await logActivity({
            userId: req.user._id,
            action: 'DELETE_SCHEDULE',
            description: `Xóa lịch trực #${id.slice(-6).toUpperCase()}${deleted ? ` (Ca ${deleted.shift} ngày ${new Date(deleted.date).toLocaleDateString('vi-VN')})` : ''}`,
            metadata: { scheduleId: id }, ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã xóa lịch trực' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// LEAVES
// ============================================
exports.getLeaveRequests = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        const leaves = await Leave.find(query)
            .populate('staffId', 'fullName role')
            .populate('approvedBy', 'fullName')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: leaves });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createLeaveRequest = async (req, res) => {
    try {
        const leave = await Leave.create({ ...req.body, staffId: req.user._id });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_LEAVE_REQUEST',
            description: `Gửi đơn xin nghỉ phép: ${req.body.reason || 'Không có lý do'} (${new Date(req.body.startDate).toLocaleDateString('vi-VN')} — ${new Date(req.body.endDate).toLocaleDateString('vi-VN')})`,
            targetModel: 'Leave', targetId: leave._id,
            metadata: { startDate: req.body.startDate, endDate: req.body.endDate, reason: req.body.reason },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: leave });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const leave = await Leave.findByIdAndUpdate(id, {
            status,
            approvedBy: req.user._id
        }, { new: true }).populate('staffId', 'fullName');

        await logActivity({
            userId: req.user._id,
            action: status === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
            description: `${status === 'APPROVED' ? 'Duyệt' : 'Từ chối'} đơn nghỉ phép của: ${leave.staffId?.fullName || id}`,
            targetModel: 'Leave', targetId: id,
            metadata: { status }, ipAddress: req.ip
        });

        // Tạo thông báo cho nhân viên được duyệt/từ chối
        try {
            await Notification.create({
                recipientId: leave.staffId?._id,
                title: status === 'APPROVED' ? '✅ Đơn nghỉ phép đã được duyệt' : '❌ Đơn nghỉ phép bị từ chối',
                message: status === 'APPROVED'
                    ? `Đơn nghỉ phép của bạn đã được Admin duyệt.`
                    : `Đơn nghỉ phép của bạn đã bị từ chối. Vui lòng liên hệ quản lý.`,
                type: status === 'APPROVED' ? 'INFO' : 'WARNING',
                link: '/staff?tab=leave'
            });
            // Thông báo cho toàn bộ ADMIN về đơn nghỉ vừa xử lý
            await Notification.create({
                role: 'ADMIN',
                title: `📋 Đơn nghỉ phép: ${leave.staffId?.fullName}`,
                message: `${status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} đơn nghỉ phép của ${leave.staffId?.fullName}.`,
                type: 'INFO',
                link: '/staff?tab=leave'
            });
        } catch (notifErr) {
            console.warn('[HRM] Không thể tạo notification:', notifErr.message);
        }

        res.status(200).json({ success: true, data: leave });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// PAYROLL
// ============================================
exports.getPayrolls = async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = { month: parseInt(month), year: parseInt(year) };
        const rawPayrolls = await Payroll.find(query)
            .populate({
                path: 'staffId',
                select: 'fullName role baseSalary avatar isActive',
                match: { isActive: { $ne: false } }
            });
        const payrolls = rawPayrolls.filter(p => p.staffId != null);
        res.status(200).json({ success: true, data: payrolls });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.previewPayroll = async (req, res) => {
    try {
        const { month, year, staffIds } = req.body;
        const startDate = new Date(year, month - 1, 1, 0, 0, 0);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        let staffQuery = { role: { $nin: ['CUSTOMER', 'ADMIN', 'MANAGER'] }, isActive: { $ne: false } };
        if (staffIds && staffIds.length > 0) staffQuery = { _id: { $in: staffIds }, isActive: { $ne: false } };
        const staffList = await User.find(staffQuery).populate('staffProfile');
        const results = [];

        // ─── Cấu hình giờ ca ───
        const clinicCfg = await ClinicConfig.findOne() || {};
        const shiftDefs = clinicCfg.shifts || {
            DAY: { start: '07:30', end: '12:00' },
            EVENING: { start: '13:00', end: '18:00' },
            NIGHT: { start: '18:00', end: '07:30' }
        };
        const shiftHours = (s, e) => {
            const [sh, sm] = s.split(':').map(Number);
            const [eh, em] = e.split(':').map(Number);
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins <= 0) mins += 1440;
            return mins / 60;
        };
        const hoursPerShift = {};
        for (const [k, v] of Object.entries(shiftDefs)) hoursPerShift[k] = shiftHours(v.start, v.end);

        // ─── Commission theo hoá đơn ───
        const commissionMap = new Map();
        const paidInvoices = await Invoice.find({
            status: 'PAID',
            updatedAt: { $gte: startDate, $lte: endDate }  // dùng updatedAt (lúc chuyển PAID)
        }).populate('appointmentId medicalRecordId groomingOrderId vaccinationId');

        console.log(`[PAYROLL PREVIEW] ${month}/${year}: Tìm thấy ${paidInvoices.length} hóa đơn PAID`);

        for (const inv of paidInvoices) {
            let providerId = null;
            if (inv.invoiceType === 'APPOINTMENT' || inv.invoiceType === 'WALKIN') {
                providerId = inv.medicalRecordId?.doctorId || inv.appointmentId?.staffId;
            } else if (inv.invoiceType === 'GROOMING') {
                providerId = inv.groomingOrderId?.staffId;
            } else if (inv.invoiceType === 'VACCINATION') {
                providerId = inv.vaccinationId?.doctorId;
            } else if (inv.invoiceType === 'RETAIL') {
                providerId = inv.receptionistId;
            }
            if (providerId) {
                const provider = await User.findById(providerId).select('role');
                if (provider) {
                    const cfg = await getConfigForRole(provider.role);
                    const comm = (inv.serviceTotal || 0) * (cfg.commissionServiceRate || 0)
                               + ((inv.medicineTotal || 0) + (inv.retailTotal || 0)) * (cfg.commissionMedicineRate || 0);
                    const sId = providerId.toString();
                    commissionMap.set(sId, (commissionMap.get(sId) || 0) + comm);
                    if (comm > 0) console.log(`[COMMISSION] Staff ${sId} (${provider.role}): +${Math.round(comm).toLocaleString()}đ từ HĐ ${inv._id} (svc:${inv.serviceTotal}, med:${inv.medicineTotal})`);
                }
            }
        }
        console.log(`[PAYROLL PREVIEW] Commission map: ${commissionMap.size} nhân viên có hoa hồng`);

        // ─── Lấy cấu hình phạt từ HrmConfig (DEFAULT) ───
        const defaultCfg = await getConfigForRole('DEFAULT');
        const latePenaltyPerMinute = defaultCfg.latePenaltyPerMinute ?? clinicCfg.latePenaltyPerMinute ?? 2000;
        const absentPenaltyPerDay = defaultCfg.absentPenaltyPerDay ?? 100000;

        for (const staff of staffList) {
            const existing = await Payroll.findOne({ staffId: staff._id, month, year });
            // Preview luôn tính lại — không skip người đã chốt (chỉ đánh dấu isConfirmed)

            const cfg = await getConfigForRole(staff.role);
            const hourlyRate = staff.baseSalary || cfg.baseSalary || 0; // Ưu tiên lương cá nhân, nếu không lấy theo chính sách

            // ─── Lấy chấm công trong tháng ───
            const attendanceList = await Attendance.find({
                staffId: staff._id,
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['PRESENT', 'LATE'] }
            }).populate('scheduleId', 'shift');

            let totalHoursWorked = 0, nightHoursWorked = 0, nightShiftsCount = 0;
            let usedScheduleFallback = false;

            // ── Tính từ chấm công thực tế — KHÔNG fallback lịch trực ──
            // Nhân viên không chấm công → giờ làm = 0 (bị phạt vắng riêng)
            for (const att of attendanceList) {
                let hoursThisShift = 0;
                if (att.checkIn?.time && (!att.checkOut?.time || att.checkOut.isAuto)) {
                    // Quên check-out hoặc được hệ thống auto-checkout -> tính 0 giờ
                    hoursThisShift = 0;
                } else if (att.checkIn?.time && att.checkOut?.time) {
                    const mins = (new Date(att.checkOut.time) - new Date(att.checkIn.time)) / 60000;
                    hoursThisShift = Math.max(0, mins / 60);
                }
                totalHoursWorked += hoursThisShift;
                const shift = att.scheduleId?.shift || null;
                if (shift === 'NIGHT') { nightHoursWorked += hoursThisShift; nightShiftsCount++; }
            }
            totalHoursWorked = Math.round(totalHoursWorked * 10) / 10;

            const computedBasePay = Math.round(hourlyRate * totalHoursWorked);

            // ─── Hoa hồng ───
            const commissions = Math.round(commissionMap.get(staff._id.toString()) || 0);

            // ─── Phụ cấp ca đêm: lương/giờ × giờ ca đêm × (hệ số−1) ───
            const rawM = parseFloat(cfg.nightShiftAllowance);
            const multiplier = (!rawM || rawM > 10) ? 1.5 : rawM;
            const nightAllowanceTotal = Math.round(nightHoursWorked * hourlyRate * (multiplier - 1));

            // ─── Nghỉ không lương ───
            const leaves = await Leave.find({
                staffId: staff._id, status: 'APPROVED',
                startDate: { $lte: endDate }, endDate: { $gte: startDate }
            });
            let unpaidDays = 0;
            for (const lv of leaves) {
                if (lv.type === 'UNPAID') {
                    const s = lv.startDate < startDate ? startDate : lv.startDate;
                    const e = lv.endDate > endDate ? endDate : lv.endDate;
                    unpaidDays += Math.ceil(Math.abs(e - s) / 86400000) + 1;
                }
            }
            const leaveDeduction = Math.round(hourlyRate * 8 * unpaidDays);

            // ─── Phạt trễ ───
            const lateDays = attendanceList.filter(a => a.checkIn?.isLate);
            let totalLateMins = 0;
            lateDays.forEach(a => { totalLateMins += a.checkIn.lateMinutes || 0; });
            const latePenalty = Math.round(totalLateMins * latePenaltyPerMinute);

            // ─── Phạt vắng mặt ───
            const today = new Date();
            const allScheduledInMonth = await Schedule.find({
                staffId: staff._id,
                date: { $gte: startDate, $lte: endDate < today ? endDate : today },
                status: 'CONFIRMED'
            });
            const toLocalDateKey = (d) => {
                const dt = new Date(d);
                return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
            };
            const checkedInDates = new Set(attendanceList.map(a => toLocalDateKey(a.date)));
            const leaveApprovedDates = new Set();
            for (const lv of leaves) {
                if (lv.status !== 'APPROVED') continue;
                const s = new Date(lv.startDate < startDate ? startDate : lv.startDate);
                const e = new Date(lv.endDate > endDate ? endDate : lv.endDate);
                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                    leaveApprovedDates.add(toLocalDateKey(d));
                }
            }
            let absentShiftsCount = 0;
            for (const sc of allScheduledInMonth) {
                const dKey = toLocalDateKey(sc.date);
                if (!checkedInDates.has(dKey) && !leaveApprovedDates.has(dKey)) {
                    absentShiftsCount++;
                }
            }
            const absentPenalty = Math.round(absentShiftsCount * absentPenaltyPerDay);

            const workingDays = attendanceList.length;
            const totalDeductions = leaveDeduction + latePenalty + absentPenalty;
            const totalBonus = nightAllowanceTotal;
            const totalSalary = Math.round(computedBasePay + commissions + totalBonus - totalDeductions);

            // ─── Ghi chú chi tiết ───
            const noteArr = [`${totalHoursWorked}h (chấm công) × ${hourlyRate.toLocaleString('vi-VN')}đ/h = ${computedBasePay.toLocaleString('vi-VN')}đ`];
            if (commissions > 0) noteArr.push(`Hoa hồng HĐ: +${commissions.toLocaleString('vi-VN')}đ`);
            if (nightShiftsCount > 0) noteArr.push(`Ca đêm: ${nightHoursWorked.toFixed(1)}h × hệ số ×${multiplier} = +${nightAllowanceTotal.toLocaleString('vi-VN')}đ`);
            if (unpaidDays > 0) noteArr.push(`Nghỉ KL: ${unpaidDays} ngày -${leaveDeduction.toLocaleString('vi-VN')}đ`);
            if (totalLateMins > 0) noteArr.push(`Trễ: ${lateDays.length} lần (${totalLateMins}p) -${latePenalty.toLocaleString('vi-VN')}đ`);
            if (absentShiftsCount > 0) noteArr.push(`Vắng: ${absentShiftsCount} ca -${absentPenalty.toLocaleString('vi-VN')}đ`);

            results.push({
                staffId: { _id: staff._id, fullName: staff.fullName, role: staff.role },
                month, year,
                hourlyRate,
                totalHoursWorked,
                nightHoursWorked: Math.round(nightHoursWorked * 10) / 10,
                nightShiftsCount,
                totalCas: attendanceList.length,
                baseSalary: computedBasePay,
                commissions,
                bonus: totalBonus,
                deductions: totalDeductions,
                leaveDeduction,
                latePenalty,
                unpaidDays,
                lateCount: lateDays.length,
                totalLateMins,
                workingDays,
                totalSalary,
                isPaid: existing?.isPaid || false,
                isConfirmed: !!existing, // đã chốt trong DB
                existingId: existing?._id,
                note: noteArr.join(' | ')
            });
        }

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.generatePayroll = async (req, res) => {
    try {
        const { month, year, staffIds } = req.body;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        let staffQuery = { role: { $nin: ['CUSTOMER', 'ADMIN', 'MANAGER'] }, isActive: { $ne: false } };
        if (staffIds && staffIds.length > 0) staffQuery = { _id: { $in: staffIds }, isActive: { $ne: false } };
        const staffList = await User.find(staffQuery).populate('staffProfile');
        const results = [];

        // --- NEW COMMISSION LOGIC ---
        const commissionMap = new Map(); // staffId -> amount
        const paidInvoices = await Invoice.find({
            status: 'PAID',
            updatedAt: { $gte: startDate, $lte: endDate }  // dùng updatedAt = lúc chuyển sang PAID
        }).populate('appointmentId medicalRecordId groomingOrderId vaccinationId');

        for (const inv of paidInvoices) {
            let providerId = null;
            if (inv.invoiceType === 'APPOINTMENT' || inv.invoiceType === 'WALKIN') {
                providerId = inv.medicalRecordId?.doctorId || inv.appointmentId?.staffId;
            } else if (inv.invoiceType === 'GROOMING') {
                providerId = inv.groomingOrderId?.staffId;
            } else if (inv.invoiceType === 'VACCINATION') {
                providerId = inv.vaccinationId?.doctorId;
            } else if (inv.invoiceType === 'RETAIL') {
                providerId = inv.receptionistId;
            }

            if (providerId) {
                const sId = providerId.toString();
                const provider = await User.findById(providerId).select('role');
                if (provider) {
                    const cfg = await getConfigForRole(provider.role);
                    const comm = ((inv.serviceTotal || 0) * (cfg.commissionServiceRate || 0))
                               + (((inv.medicineTotal || 0) + (inv.retailTotal || 0)) * (cfg.commissionMedicineRate || 0));
                    commissionMap.set(sId, (commissionMap.get(sId) || 0) + comm);
                }
            }
        }
        // --- END COMMISSION LOGIC ---

        // ─── Lấy cấu hình giờ ca từ ClinicConfig ───
        const clinicCfg = await ClinicConfig.findOne() || {};
        const shiftDefs = clinicCfg.shifts || {
            DAY: { start: '07:30', end: '12:00' },
            EVENING: { start: '13:00', end: '18:00' },
            NIGHT: { start: '18:00', end: '07:30' }
        };

        // Hàm tính số giờ từ "HH:MM" đến "HH:MM" (qua đêm nếu end < start)
        const shiftHours = (startStr, endStr) => {
            const [sh, sm] = startStr.split(':').map(Number);
            const [eh, em] = endStr.split(':').map(Number);
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins <= 0) mins += 24 * 60; // qua đêm
            return mins / 60;
        };
        const hoursPerShift = {};
        for (const [key, val] of Object.entries(shiftDefs)) {
            hoursPerShift[key] = shiftHours(val.start, val.end);
        }


        // ─── Lấy cấu hình phạt từ HrmConfig (DEFAULT) ───
        const defaultCfg = await getConfigForRole('DEFAULT');
        const latePenaltyPerMinute = defaultCfg.latePenaltyPerMinute ?? clinicCfg.latePenaltyPerMinute ?? 2000;
        const absentPenaltyPerDay = defaultCfg.absentPenaltyPerDay ?? 100000;

        for (const staff of staffList) {
            const existing = await Payroll.findOne({ staffId: staff._id, month, year });
            if (existing) continue;

            const cfg = await getConfigForRole(staff.role);
            const commissions = Math.round(commissionMap.get(staff._id.toString()) || 0);
            const hourlyRate = staff.baseSalary || cfg.baseSalary || 0; // Ưu tiên lương cá nhân, nếu không lấy theo chính sách HRM

            // ─── Chấm công thực tế trong tháng ───
            const attendanceList = await Attendance.find({
                staffId: staff._id,
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['PRESENT', 'LATE'] }
            }).populate('scheduleId', 'shift');

            // ─── Chấm công thực tế trong tháng — KHÔNG fallback lịch trực ───
            let totalHoursWorked = 0, nightHoursWorked = 0, nightShiftsCount = 0;
            for (const att of attendanceList) {
                let hoursThisShift = 0;
                if (att.checkIn?.time && (!att.checkOut?.time || att.checkOut.isAuto)) {
                    // Quên check-out hoặc được hệ thống auto-checkout -> tính 0 giờ
                    hoursThisShift = 0;
                } else if (att.checkIn?.time && att.checkOut?.time) {
                    const mins = (new Date(att.checkOut.time) - new Date(att.checkIn.time)) / 60000;
                    hoursThisShift = Math.max(0, mins / 60);
                }
                totalHoursWorked += hoursThisShift;
                if (att.scheduleId?.shift === 'NIGHT') { nightHoursWorked += hoursThisShift; nightShiftsCount++; }
            }
            totalHoursWorked = Math.round(totalHoursWorked * 10) / 10;
            const computedBasePay = Math.round(hourlyRate * totalHoursWorked);

            // ─── Phụ cấp ca đêm: lương/giờ × giờ ca đêm × (hệ số−1) ───
            const rawMultiplier = parseFloat(cfg.nightShiftAllowance);
            const multiplier = (!rawMultiplier || rawMultiplier > 10) ? 1.5 : rawMultiplier;
            const nightAllowanceTotal = Math.round(nightHoursWorked * hourlyRate * (multiplier - 1));

            // ─── Nghỉ không lương ───
            const leaves = await Leave.find({
                staffId: staff._id, status: 'APPROVED',
                startDate: { $lte: endDate }, endDate: { $gte: startDate }
            });
            let unpaidDays = 0;
            for (const lv of leaves) {
                if (lv.type === 'UNPAID') {
                    const actualStart = lv.startDate < startDate ? startDate : lv.startDate;
                    const actualEnd = lv.endDate > endDate ? endDate : lv.endDate;
                    unpaidDays += Math.ceil(Math.abs(actualEnd - actualStart) / 86400000) + 1;
                }
            }
            const leaveDeduction = Math.round(hourlyRate * 8 * unpaidDays);

            // ─── Phạt trễ ───
            const lateDays = attendanceList.filter(a => a.checkIn?.isLate);
            let totalLateMins = 0;
            lateDays.forEach(att => { totalLateMins += att.checkIn.lateMinutes || 0; });
            const latePenalty = Math.round(totalLateMins * latePenaltyPerMinute);

            // ─── Phạt vắng mặt (được lịch nhưng không chấm công, không có leave APPROVED) ───
            const today = new Date();
            const allScheduledInMonth = await Schedule.find({
                staffId: staff._id,
                date: { $gte: startDate, $lte: endDate < today ? endDate : today },
                status: 'CONFIRMED'
            });
            // Dùng local date key để tránh lệch timezone UTC vs UTC+7
            const toLocalDateKey = (d) => {
                const dt = new Date(d);
                return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
            };
            const checkedInDates = new Set(attendanceList.map(a => toLocalDateKey(a.date)));
            const leaveApprovedDates = new Set();
            for (const lv of leaves) {
                if (lv.status !== 'APPROVED') continue;
                const s = new Date(lv.startDate < startDate ? startDate : lv.startDate);
                const e = new Date(lv.endDate > endDate ? endDate : lv.endDate);
                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                    leaveApprovedDates.add(toLocalDateKey(d));
                }
            }
            let absentShiftsCount = 0;
            for (const sc of allScheduledInMonth) {
                const dKey = toLocalDateKey(sc.date);
                if (!checkedInDates.has(dKey) && !leaveApprovedDates.has(dKey)) {
                    absentShiftsCount++;
                }
            }
            const absentPenalty = Math.round(absentShiftsCount * absentPenaltyPerDay);

            const workingDays = Math.round((totalHoursWorked / 8) * 10) / 10;
            const totalDeductions = leaveDeduction + latePenalty + absentPenalty;
            const totalBonus = nightAllowanceTotal;
            const totalSalaryRaw = Math.round(computedBasePay + commissions + totalBonus - totalDeductions);
            const totalSalary = Math.max(0, totalSalaryRaw);

            if (staff.isActive === false && computedBasePay === 0 && commissions === 0) {
                // Ignore missing shifts/penalties if inactive with 0 income
                continue; 
            }

            const noteArr = [`${totalHoursWorked}h (chấm công) × ${hourlyRate.toLocaleString('vi-VN')}đ/h = ${computedBasePay.toLocaleString('vi-VN')}đ`];
            if (commissions > 0) noteArr.push(`Hoa hồng HĐ: +${commissions.toLocaleString('vi-VN')}đ`);
            if (nightShiftsCount > 0) noteArr.push(`Ca đêm: ${Math.round(nightHoursWorked*10)/10}h × hệ số ×${multiplier} = +${nightAllowanceTotal.toLocaleString('vi-VN')}đ`);
            if (unpaidDays > 0) noteArr.push(`Nghỉ KL: ${unpaidDays} ngày -${leaveDeduction.toLocaleString('vi-VN')}đ`);
            if (totalLateMins > 0) noteArr.push(`Trễ: ${lateDays.length} lần (${totalLateMins}p) -${latePenalty.toLocaleString('vi-VN')}đ`);
            if (absentShiftsCount > 0) noteArr.push(`Vắng: ${absentShiftsCount} ca -${absentPenalty.toLocaleString('vi-VN')}đ`);

            // Chỉ lưu số khấu trừ thực tế bị trừ (tối đa bằng tổng thu nhập)
            const actualDeductions = totalSalaryRaw < 0 ? (computedBasePay + commissions + totalBonus) : totalDeductions;

            const payroll = await Payroll.create({
                staffId: staff._id, month, year,
                baseSalary: computedBasePay,
                commissions,
                workingDays,
                totalHoursWorked,
                lateCount: lateDays.length,
                bonus: totalBonus,
                deductions: actualDeductions,
                totalSalary,
                isPaid: false,
                isPublished: true,      // Tự động công bố khi chốt
                publishedAt: new Date(),
                note: noteArr.join(' | ') || null,
                // ── Fields chi tiết ──
                hourlyRate,
                unpaidDays,
                latePenalty,
                leaveDeduction,
                totalLateMins,
                nightHoursWorked: Math.round(nightHoursWorked * 10) / 10,
                nightShiftsCount,
            });
            results.push(payroll);

            // Thông báo cho nhân viên biết lương đã được chốt
            try {
                await Notification.create({
                    recipientId: staff._id,
                    title: `Bảng lương tháng ${month}/${year} đã được công bố`,
                    message: `Bảng lương tháng ${month}/${year} của bạn đã được xác nhận và công bố.\nTổng lương nhận: ${totalSalary.toLocaleString('vi-VN')}đ\nVào Hồ Sơ → Bảng Lương để xem chi tiết.`,
                    type: 'INFO',
                    link: '/profile'
                });
            } catch (notifErr) {
                console.warn('[PAYROLL] Không thể gửi thông báo cho', staff.fullName, notifErr.message);
            }
        }

        await logActivity({
            userId: req.user._id,
            action: 'GENERATE_PAYROLL',
            description: `Chốt bảng lương tháng ${month}/${year} — ${results.length} nhân viên`,
            metadata: { month, year, count: results.length }, ipAddress: req.ip
        });

        res.status(201).json({ success: true, count: results.length, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const { isPaid, bonus, deductions, note } = req.body;

        const existing = await Payroll.findById(id);
        if (!existing) return res.status(404).json({ success: false, message: 'Bảng lương không tồn tại' });

        const updateData = {};
        if (typeof isPaid === 'boolean') {
            updateData.isPaid = isPaid;
            if (isPaid) updateData.paymentDate = new Date();
        }

        let newBonus = bonus !== undefined ? parseFloat(bonus) : existing.bonus;
        let newDeductions = deductions !== undefined ? parseFloat(deductions) : existing.deductions;

        updateData.bonus = newBonus;
        updateData.deductions = newDeductions;
        if (note !== undefined) updateData.note = note;

        // Re-calculate Total Salary
        updateData.totalSalary = Math.round(existing.baseSalary + existing.commissions + newBonus - newDeductions);

        const payroll = await Payroll.findByIdAndUpdate(id, updateData, { new: true })
            .populate('staffId', 'fullName role');

        await logActivity({
            userId: req.user._id,
            action: updateData.isPaid ? 'MARK_PAYROLL_PAID' : 'UPDATE_PAYROLL',
            description: updateData.isPaid
                ? `Đánh dấu đã thanh toán lương: ${payroll.staffId?.fullName} — ${payroll.totalSalary?.toLocaleString('vi-VN')}đ`
                : `Sửa bảng lương: ${payroll.staffId?.fullName}`,
            targetModel: 'Payroll', targetId: id,
            metadata: { isPaid: updateData.isPaid, bonus: updateData.bonus, deductions: updateData.deductions },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: payroll });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Xóa toàn bộ bảng lương theo tháng (hoặc 1 nhân viên) để tính lại
exports.deletePayrollByMonth = async (req, res) => {
    try {
        const { month, year, staffId, deleteAll } = req.query;
        const filter = { month: parseInt(month), year: parseInt(year) };
        
        if (staffId && staffId !== 'undefined' && staffId !== 'null' && staffId !== '') {
            filter.staffId = staffId;
        } else if (deleteAll !== 'true') {
            return res.json({ success: false, message: 'API cần staffId hoặc flag deleteAll=true để xác nhận xóa toàn bộ.' });
        }

        
        const result = await Payroll.deleteMany(filter);
        await logActivity({
            userId: req.user._id,
            action: staffId ? 'DELETE_SINGLE_PAYROLL' : 'DELETE_PAYROLL_MONTH',
            description: staffId 
                ? `Xóa bảng lương cá nhân tháng ${month}/${year} để tính lại`
                : `Xóa bảng lương tháng ${month}/${year} để tính lại — ${result.deletedCount} bản ghi`,
            metadata: { month, year, staffId, count: result.deletedCount }, ipAddress: req.ip
        });
        res.status(200).json({ success: true, deleted: result.deletedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// NHÂN VIÊN: Xem bảng lương của mình (chỉ bản đã published)
// ============================================
exports.getMyPayrolls = async (req, res) => {
    try {
        const payrolls = await Payroll.find({
            staffId: req.user._id
            // Hiển thị tất cả bảng lương đã được tạo — isPublished ko cần filter vì generatePayroll đã control
        })
        .select('-__v')
        .sort({ year: -1, month: -1 })
        .limit(24);
        res.status(200).json({ success: true, data: payrolls });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// ADMIN: Công bố bảng lương → nhân viên có thể xem
// ============================================
exports.publishPayroll = async (req, res) => {
    try {
        const { id } = req.params;
        const payroll = await Payroll.findById(id).populate('staffId', 'fullName _id');
        if (!payroll) return res.status(404).json({ success: false, message: 'Không tìm thấy bảng lương.' });

        payroll.isPublished = true;
        payroll.publishedAt = new Date();
        await payroll.save();

        // Gửi thông báo cho nhân viên
        try {
            await Notification.create({
                recipientId: payroll.staffId._id,
                title: `Bảng lương tháng ${payroll.month}/${payroll.year} đã được công bố`,
                message: `Bảng lương tháng ${payroll.month}/${payroll.year} của bạn vừa được Admin công bố. Tổng lương: ${payroll.totalSalary.toLocaleString('vi-VN')}đ. Vào Hồ Sơ để xem chi tiết.`,
                type: 'INFO',
                link: '/profile',
            });
        } catch (_) {}

        await logActivity({
            userId: req.user._id,
            action: 'PUBLISH_PAYROLL',
            description: `Công bố bảng lương tháng ${payroll.month}/${payroll.year} cho ${payroll.staffId?.fullName}`,
            targetModel: 'Payroll', targetId: id, ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: payroll });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// L?y danh s�ch h�a ��n hoa h?ng c?a nh�n vi�n trong th�ng
exports.getMyCommissions = async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ success: false, message: 'Thi?u month ho?c year' });

        const startDate = new Date(year, parseInt(month) - 1, 1);
        const endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);

        const Invoice = require('../models/Invoice');
        const User = require('../models/User');

        const paidInvoices = await Invoice.find({
            status: 'PAID',
            updatedAt: { $gte: startDate, $lte: endDate }
        }).populate('appointmentId medicalRecordId groomingOrderId vaccinationId');

        const myCommissions = [];
        const myUser = await User.findById(req.user._id).select('role');
        const { getConfigForRole } = require('./hrmController'); // Local reference just in case
        let cfg = null;

        for (const inv of paidInvoices) {
            let providerId = null;
            if (inv.invoiceType === 'APPOINTMENT' || inv.invoiceType === 'WALKIN') {
                providerId = inv.medicalRecordId?.doctorId || inv.appointmentId?.staffId;
            } else if (inv.invoiceType === 'GROOMING') {
                providerId = inv.groomingOrderId?.staffId;
            } else if (inv.invoiceType === 'VACCINATION') {
                providerId = inv.vaccinationId?.doctorId;
            } else if (inv.invoiceType === 'RETAIL') {
                providerId = inv.receptionistId;
            }

            if (providerId && providerId.toString() === req.user._id.toString()) {
                if (!cfg) cfg = await exports.getConfigForRole(myUser.role);
                const comm = (inv.serviceTotal || 0) * (cfg.commissionServiceRate || 0)
                           + ((inv.medicineTotal || 0) + (inv.retailTotal || 0)) * (cfg.commissionMedicineRate || 0);
                
                if (comm > 0) {
                    myCommissions.push({
                        _id: inv._id,
                        invoiceType: inv.invoiceType,
                        serviceTotal: inv.serviceTotal || 0,
                        medicineTotal: (inv.medicineTotal || 0) + (inv.retailTotal || 0),
                        commission: Math.round(comm),
                        updatedAt: inv.updatedAt
                    });
                }
            }
        }

        myCommissions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.status(200).json({ success: true, count: myCommissions.length, data: myCommissions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
