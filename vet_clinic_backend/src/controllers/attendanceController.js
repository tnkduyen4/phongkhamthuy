const Attendance = require('../models/Attendance');
const ClinicConfig = require('../models/ClinicConfig');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Leave = require('../models/Leave');
const logActivity = require('../utils/logActivity');

// Helper tính khoảng cách GPS (m)
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Helper: parse "HH:MM" thành milliseconds từ midnight
const parseTimeMs = (timeStr, baseDate) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d.getTime();
};

// Helper: lấy giờ bắt đầu & kết thúc ca theo config
const getShiftWindow = (shiftKey, config, now) => {
    const shiftDef = config.shifts?.[shiftKey];
    if (!shiftDef) return null;

    const startMs = parseTimeMs(shiftDef.start, now);
    let endMs = parseTimeMs(shiftDef.end, now);
    // Ca đêm có thể qua ngày hôm sau
    if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000;
    return { startMs, endMs };
};

exports.getClinicConfig = async (req, res) => {
    try {
        let config = await ClinicConfig.findOne();
        if (!config) config = await ClinicConfig.create({});
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateClinicConfig = async (req, res) => {
    try {
        let config = await ClinicConfig.findOne();
        if (!config) {
            config = await ClinicConfig.create(req.body);
        } else {
            config = await ClinicConfig.findByIdAndUpdate(config._id, req.body, { new: true });
        }
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// CHECK-IN: Chấm công vào ca (theo scheduleId)
// =============================================
exports.checkIn = async (req, res) => {
    try {
        const { lat, lng, photo, similarityScore, scheduleId: requestedScheduleId } = req.body;

        const user = await User.findById(req.user._id).populate('staffProfile');
        if (!user.verificationPhoto) {
            return res.status(400).json({
                success: false,
                message: 'Bạn chưa cài đặt ảnh mẫu trong trang Cá nhân. Hãy cập nhật ảnh mẫu trước khi chấm công.'
            });
        }

        if (similarityScore !== undefined && similarityScore < 0.6) {
            return res.status(401).json({
                success: false,
                message: `Xác thực khuôn mặt thất bại (Độ khớp: ${Math.round(similarityScore * 100)}%). Vui lòng thử lại.`
            });
        }

        const config = await ClinicConfig.findOne() || await ClinicConfig.create({});

        // 1. Kiểm tra vị trí GPS
        const dist = getDistance(lat, lng, config.location.lat, config.location.lng);
        if (dist > config.location.radius) {
            return res.status(400).json({
                success: false,
                message: `Bạn đang ở ngoài vùng Check-in (${Math.round(dist)}m). Vui lòng di chuyển lại gần hơn.`
            });
        }

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        // 2. Tìm lịch trực hôm nay của nhân viên (CONFIRMED)
        // Hỗ trợ check-in theo ca cụ thể hoặc tự động tìm ca hiện tại
        let schedule;
        if (requestedScheduleId) {
            schedule = await Schedule.findOne({
                _id: requestedScheduleId,
                staffId: req.user._id,
                status: 'CONFIRMED'
            });
        } else {
            // Tìm tất cả ca hôm nay
            const todaySchedules = await Schedule.find({
                staffId: req.user._id,
                date: { $gte: todayStart, $lt: tomorrowStart },
                status: 'CONFIRMED'
            });

            if (!todaySchedules.length) {
                return res.status(400).json({ success: false, message: 'Bạn không có lịch trực được phân công ngày hôm nay.' });
            }

            // Tìm ca phù hợp với thời điểm hiện tại
            const nowMs = now.getTime();
            const EARLY_WINDOW_MS = 30 * 60 * 1000; // Cho phép check-in sớm 30 phút

            for (const sc of todaySchedules) {
                const window = getShiftWindow(sc.shift, config, now);
                if (!window) continue;
                // Trong cửa sổ: từ 30 phút trước đến khi kết thúc ca
                if (nowMs >= window.startMs - EARLY_WINDOW_MS && nowMs <= window.endMs) {
                    schedule = sc;
                    break;
                }
            }

            if (!schedule) {
                return res.status(400).json({
                    success: false,
                    message: 'Không có ca trực nào đang mở lúc này. Vui lòng chấm công đúng giờ ca của bạn.'
                });
            }
        }

        if (!schedule) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy lịch trực hợp lệ.' });
        }

        // 3. Kiểm tra ca đã kết thúc chưa
        const shiftWindow = getShiftWindow(schedule.shift, config, now);
        if (shiftWindow && now.getTime() > shiftWindow.endMs) {
            return res.status(400).json({
                success: false,
                message: `Ca ${schedule.shift} đã kết thúc. Không thể chấm công sau khi hết ca.`
            });
        }

        // 4. Kiểm tra đã chấm công ca này chưa (tránh chấm lại)
        const existingAtt = await Attendance.findOne({
            staffId: req.user._id,
            scheduleId: schedule._id
        });
        if (existingAtt && existingAtt.checkIn?.time) {
            return res.status(400).json({
                success: false,
                message: `Bạn đã chấm công vào ca ${schedule.shift} rồi. Không thể chấm lại.`
            });
        }

        // 5. Tính toán đi trễ
        const gracePeriod = config.gracePeriod ?? 15; // phút, mặc định 15
        let isLate = false;
        let lateMinutes = 0;

        if (shiftWindow) {
            const diffMs = now.getTime() - shiftWindow.startMs;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins > gracePeriod) {
                isLate = true;
                lateMinutes = diffMins - gracePeriod; // chỉ tính phần vượt grace
            }
        }

        // 6. Lưu Attendance (dùng scheduleId làm key thay vì date+staffId)
        const dateKey = new Date(todayStart);
        const attendance = await Attendance.findOneAndUpdate(
            { staffId: req.user._id, scheduleId: schedule._id },
            {
                staffId: req.user._id,
                date: dateKey,
                scheduleId: schedule._id,
                checkIn: {
                    time: now,
                    location: { lat, lng },
                    photo,
                    isLate,
                    lateMinutes
                },
                status: isLate ? 'LATE' : 'PRESENT'
            },
            { upsert: true, new: true }
        );

        await logActivity({
            userId: req.user._id,
            action: 'CHECK_IN',
            description: `Check-in ${isLate ? `TRỄ ${lateMinutes}p` : 'đúng giờ'} — Ca ${schedule.shift}`,
            metadata: { isLate, lateMinutes, dist, scheduleId: schedule._id },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: attendance,
            message: isLate
                ? `Chấm công thành công — Đi trễ ${lateMinutes} phút`
                : 'Chấm công vào ca thành công!'
        });
    } catch (error) {
        console.error('[CHECK-IN ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// CHECK-OUT: Chấm công ra ca
// =============================================
exports.checkOut = async (req, res) => {
    try {
        const { lat, lng, photo, scheduleId } = req.body;

        let query = { staffId: req.user._id };
        if (scheduleId) {
            query.scheduleId = scheduleId;
        } else {
            // Tìm ca gần nhất hôm nay đã check-in nhưng chưa check-out
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            query.date = { $gte: todayStart, $lt: tomorrowStart };
            query['checkIn.time'] = { $exists: true };
            query['checkOut.time'] = { $exists: false };
        }

        const attendance = await Attendance.findOne(query).sort({ 'checkIn.time': -1 });
        if (!attendance || !attendance.checkIn?.time) {
            return res.status(400).json({ success: false, message: 'Bạn chưa Check-in ca này.' });
        }
        if (attendance.checkOut?.time) {
            return res.status(400).json({ success: false, message: 'Bạn đã Check-out ca này rồi.' });
        }

        attendance.checkOut = { time: new Date(), location: { lat, lng }, photo };
        await attendance.save();

        await logActivity({
            userId: req.user._id,
            action: 'CHECK_OUT',
            description: 'Check-out thành công',
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: attendance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// MARK ABSENT: Đánh vắng các ca đã qua mà không chấm công
// Gọi khi: admin vào tab lịch trực, hoặc cron job
// =============================================
exports.markAbsentPastShifts = async (req, res) => {
    try {
        const config = await ClinicConfig.findOne() || {};
        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const pastSchedules = await Schedule.find({
            status: 'CONFIRMED',
            date: { $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) }
        });

        let markedCount = 0;
        let onLeaveCount = 0;
        let autoCheckoutCount = 0;
        for (const sc of pastSchedules) {
            const window = getShiftWindow(sc.shift, config, new Date(sc.date));
            if (!window) continue;

            const scDate = new Date(sc.date);
            scDate.setHours(0, 0, 0, 0);
            const isToday = scDate.getTime() === todayStart.getTime();

            if (isToday) {
                const shiftEndMs = window.endMs;
                if (now.getTime() < shiftEndMs) continue;
            }

            // Đã có record rồi → kiểm tra quên checkout
            const existing = await Attendance.findOne({ scheduleId: sc._id });
            if (existing) {
                if (existing.checkIn?.time && !existing.checkOut?.time && now.getTime() > window.endMs) {
                    existing.checkOut = { time: new Date(existing.checkIn.time), isAuto: true };
                    existing.note = existing.note ? existing.note + ' | Quên Check-out (Phạt 0 giờ)' : 'Quên Check-out (Hệ thống tự chốt 0 giờ)';
                    await existing.save();
                    autoCheckoutCount++;
                }
                continue;
            }

            // Kiểm tra leave: APPROVED → ON_LEAVE, PENDING → bỏ qua (admin tự xử lý), không có → ABSENT
            const anyLeave = await Leave.findOne({
                staffId:   sc.staffId,
                status:    { $in: ['APPROVED', 'PENDING'] },
                startDate: { $lte: scDate },
                endDate:   { $gte: scDate }
            });

            if (anyLeave?.status === 'APPROVED') {
                await Attendance.findOneAndUpdate(
                    { staffId: sc.staffId, scheduleId: sc._id },
                    {
                        staffId:    sc.staffId,
                        date:       scDate,
                        scheduleId: sc._id,
                        status:     'ON_LEAVE',
                        note:       `Nghỉ phép được duyệt (${anyLeave.type || anyLeave.reason || 'Phép'})`
                    },
                    { upsert: true, setDefaultsOnInsert: true }
                );
                onLeaveCount++;
            } else if (anyLeave?.status === 'PENDING') {
                // Leave chưa được duyệt/từ chối — chưa đánh vắng, chờ admin xử lý
                continue;
            } else {
                // Không có leave → đánh vắng
                await Attendance.findOneAndUpdate(
                    { staffId: sc.staffId, scheduleId: sc._id },
                    {
                        staffId:    sc.staffId,
                        date:       scDate,
                        scheduleId: sc._id,
                        status:     'ABSENT',
                        note:       'Tự động cập nhật: không chấm công sau khi ca kết thúc'
                    },
                    { upsert: true, setDefaultsOnInsert: true }
                );
                markedCount++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Đã cập nhật ${markedCount} ca vắng mặt, ${onLeaveCount} ca nghỉ phép, ${autoCheckoutCount} ca quên checkout`,
            count: markedCount,
            autoCheckoutCount
        });
    } catch (error) {
        console.error('[MARK ABSENT ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// Sửa các record ABSENT sai (có leave đã approved)
// =============================================
exports.fixWrongAbsentRecords = async (req, res) => {
    try {
        // Tìm tất cả record ABSENT
        const absentRecords = await Attendance.find({ status: 'ABSENT' })
            .populate('scheduleId', 'date shift');

        let fixedCount = 0;
        for (const att of absentRecords) {
            const recordDate = new Date(att.date);
            recordDate.setHours(0, 0, 0, 0);

            const approvedLeave = await Leave.findOne({
                staffId: att.staffId,
                status: 'APPROVED',
                startDate: { $lte: recordDate },
                endDate:   { $gte: recordDate }
            });

            if (approvedLeave) {
                att.status = 'ON_LEAVE';
                att.note   = `Đã sửa: Nghỉ phép được duyệt (${approvedLeave.type || approvedLeave.reason || 'Phép'})`;
                await att.save();
                fixedCount++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Đã sửa ${fixedCount} record ABSENT thành ON_LEAVE`,
            fixedCount
        });
    } catch (error) {
        console.error('[FIX ABSENT ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// Lấy lịch sử chấm công cá nhân
// =============================================
exports.getMyAttendance = async (req, res) => {
    try {
        const attendances = await Attendance.find({ staffId: req.user._id })
            .populate('scheduleId', 'shift date')
            .sort({ date: -1 })
            .limit(30);
        res.status(200).json({ success: true, data: attendances });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// Lấy tất cả chấm công (Admin/Manager)
// =============================================
exports.getAllAttendance = async (req, res) => {
    try {
        const { month, year, startDate, endDate } = req.query;
        let query = {};
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (month && year) {
            const s = new Date(year, month - 1, 1);
            const e = new Date(year, month, 0, 23, 59, 59);
            query.date = { $gte: s, $lte: e };
        }

        const list = await Attendance.find(query)
            .populate('staffId', 'fullName role')
            .populate('scheduleId', 'shift')
            .sort({ date: -1 });

        res.status(200).json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =============================================
// Lấy danh sách ca hôm nay để hiển thị nút check-in
// Trả về trạng thái từng ca: canCheckIn, isOpen, isExpired, hasCheckedIn
// =============================================
exports.getTodayShifts = async (req, res) => {
    try {
        const config = await ClinicConfig.findOne() || {};
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        const schedules = await Schedule.find({
            staffId: req.user._id,
            date: { $gte: todayStart, $lt: tomorrowStart },
            status: 'CONFIRMED'
        });

        const EARLY_WINDOW_MS = 30 * 60 * 1000;
        const nowMs = now.getTime();

        const result = await Promise.all(schedules.map(async (sc) => {
            const window = getShiftWindow(sc.shift, config, now);
            const attendance = await Attendance.findOne({ scheduleId: sc._id });

            let shiftStatus = 'UPCOMING'; // Chưa đến giờ
            if (window) {
                if (nowMs > window.endMs) {
                    shiftStatus = 'EXPIRED'; // Đã hết ca
                } else if (nowMs >= window.startMs - EARLY_WINDOW_MS) {
                    shiftStatus = 'OPEN'; // Đang trong cửa sổ check-in
                }
            }

            return {
                scheduleId: sc._id,
                shift: sc.shift,
                shiftStart: config.shifts?.[sc.shift]?.start,
                shiftEnd: config.shifts?.[sc.shift]?.end,
                shiftStatus, // UPCOMING | OPEN | EXPIRED
                attendance: attendance ? {
                    status: attendance.status,
                    checkInTime: attendance.checkIn?.time,
                    checkOutTime: attendance.checkOut?.time,
                    isLate: attendance.checkIn?.isLate,
                    lateMinutes: attendance.checkIn?.lateMinutes
                } : null,
                canCheckIn: shiftStatus === 'OPEN' && !attendance?.checkIn?.time,
                canCheckOut: shiftStatus === 'OPEN' && !!attendance?.checkIn?.time && !attendance?.checkOut?.time,
            };
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
