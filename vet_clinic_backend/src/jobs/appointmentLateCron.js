/**
 * appointmentLateCron.js
 * ─────────────────────────────────────────────────────────────
 * Chạy mỗi 5 phút — kiểm tra lịch hẹn đã qua giờ nhưng chưa đến.
 *
 * Phase 1 — Trễ ≥ 20 phút (lúc BOOKED):
 *   • Gửi cảnh báo tới khách: "Bạn đang trễ hẹn"
 *   • Gửi thông báo tới lễ tân/admin: "Khách chưa đến"
 *   • Đánh dấu metadata để không gửi lại
 *
 * Phase 2 — Trễ ≥ 60 phút (vẫn BOOKED, chưa được xử lý):
 *   • Tự động chuyển sang CANCELLED với lý do "NO_SHOW"
 *   • Thông báo khách: lịch đã bị hủy tự động
 *   • Thông báo quản lý: cần xem lại
 */

const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const mongoose = require('mongoose');

// ID ảo đại diện cho "hệ thống" (không phải người dùng thực)
const SYSTEM_ACTOR_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// ── Helpers ──────────────────────────────────────────────────

/**
 * Parse "HH:mm" → số phút trong ngày (ví dụ "09:30" → 570)
 */
function timeSlotToMinutes(slot) {
    if (!slot) return null;
    const startTimeStr = slot.includes('-') ? slot.split('-')[0].trim() : slot;
    const [h, m] = startTimeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

/**
 * Trả về số phút đã trễ so với giờ hẹn (dương = đang trễ)
 */
function minutesLate(appointmentDate, timeSlot) {
    const slotMins = timeSlotToMinutes(timeSlot);
    if (slotMins === null) return null;

    // Kết hợp ngày hẹn + giờ slot
    const aptDate = new Date(appointmentDate);
    const aptDateTime = new Date(
        aptDate.getFullYear(),
        aptDate.getMonth(),
        aptDate.getDate(),
        Math.floor(slotMins / 60),
        slotMins % 60,
        0, 0
    );

    const diffMs = Date.now() - aptDateTime.getTime();
    return Math.floor(diffMs / 60000); // minutes
}

/**
 * Kiểm tra đã từng gửi notification loại này cho lịch hẹn chưa
 */
async function alreadyNotified(appointmentId, notifType) {
    const exists = await Notification.findOne({
        'metadata.appointmentId': appointmentId.toString(),
        'metadata.notifType': notifType,
    });
    return !!exists;
}

/**
 * Gửi thông báo tới tất cả RECEPTIONIST + ADMIN đang active
 */
async function notifyStaff(title, message, notifType, appointmentId) {
    const staff = await User.find({ role: { $in: ['RECEPTIONIST', 'ADMIN'] }, isActive: true }, '_id');
    const docs = staff.map(s => ({
        recipientId: s._id,
        title,
        message,
        type: 'WARNING',
        link: '/appointments',
        metadata: { appointmentId: appointmentId.toString(), notifType },
    }));
    if (docs.length) await Notification.insertMany(docs);
}

// ── Core job logic ────────────────────────────────────────────

async function checkLateAppointments() {
    try {
        const now = new Date();
        // Chỉ xét ngày hôm nay, trạng thái BOOKED
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const appointments = await Appointment.find({
            status: 'BOOKED',
            date: { $gte: startOfDay, $lte: endOfDay },
        }).populate('customerId', '_id fullName phoneNumber')
          .populate('petId', 'name');

        for (const apt of appointments) {
            const late = minutesLate(apt.date, apt.timeSlot);
            if (late === null || late <= 0) continue; // chưa tới giờ hoặc lỗi

            const aptId     = apt._id.toString();
            const aptCode   = aptId.slice(-6).toUpperCase();
            const petName   = apt.petId?.name || 'Thú cưng';
            const custName  = apt.customerId?.fullName || 'Khách hàng';
            const custId    = apt.customerId?._id;
            const slotLabel = apt.timeSlot || '--';
            const dateLabel = new Date(apt.date).toLocaleDateString('vi-VN');

            // ── Phase 2: NO-SHOW (≥ 60 phút) ──────────────────
            if (late >= 60) {
                const alreadyCancelled = await alreadyNotified(aptId, 'NO_SHOW');
                if (!alreadyCancelled) {
                    // Tự động hủy
                    await Appointment.findByIdAndUpdate(apt._id, {
                        status: 'CANCELLED',
                        cancelReason: `Tự động hủy — Khách không đến sau ${late} phút (No-show)`,
                    });

                    // Thông báo cho khách
                    if (custId) {
                        await Notification.create({
                            recipientId: custId,
                            title: 'Lịch hẹn đã bị hủy tự động',
                            message: `Lịch hẹn #${aptCode} cho ${petName} lúc ${slotLabel} ngày ${dateLabel} đã bị hủy tự động do không có mặt sau 60 phút. Vui lòng đặt lại lịch nếu cần.`,
                            type: 'WARNING',
                            link: '/?tab=appointments',
                            metadata: {
                                appointmentId: aptId,
                                notifType: 'NO_SHOW',
                            },
                        });
                    }

                    // Thông báo cho lễ tân / admin
                    await notifyStaff(
                        `Lịch hẹn #${aptCode} — Khách không đến`,
                        `${custName} không đến lịch hẹn lúc ${slotLabel} ngày ${dateLabel} (trễ ${late} phút). Hệ thống đã tự động hủy.`,
                        'NO_SHOW',
                        aptId
                    );

                    // Ghi activity log
                    await ActivityLog.create({
                        userId: SYSTEM_ACTOR_ID,
                        action: 'AUTO_CANCEL_NO_SHOW',
                        description: `[Hệ thống] Tự động hủy lịch #${aptCode} — ${custName} không đến sau ${late} phút (${slotLabel} ngày ${dateLabel})`,
                        targetModel: 'Appointment',
                        targetId: apt._id,
                        metadata: { custName, petName, slotLabel, dateLabel, lateMinutes: String(late), reason: 'NO_SHOW' },
                    }).catch(() => {});

                    console.log(`[CronJob] NO-SHOW: Đã hủy lịch #${aptCode} — trễ ${late} phút`);
                }
                continue; // không cần xét Phase 1 nữa
            }

            // ── Phase 1: LATE WARNING (≥ 20 phút) ─────────────
            if (late >= 20) {
                const alreadyLate = await alreadyNotified(aptId, 'LATE_WARNING');
                if (!alreadyLate) {
                    // Thông báo cho khách
                    if (custId) {
                        await Notification.create({
                            recipientId: custId,
                            title: 'Bạn đang trễ lịch hẹn',
                            message: `Lịch hẹn #${aptCode} cho ${petName} đã qua giờ ${slotLabel} ngày ${dateLabel} được ${late} phút. Vui lòng đến phòng khám hoặc liên hệ để đổi lịch.`,
                            type: 'WARNING',
                            link: '/?tab=appointments',
                            metadata: {
                                appointmentId: aptId,
                                notifType: 'LATE_WARNING',
                            },
                        });
                    }

                    // Thông báo cho lễ tân / admin
                    await notifyStaff(
                        `Khách trễ hẹn — #${aptCode}`,
                        `${custName} trễ ${late} phút cho lịch hẹn ${petName} lúc ${slotLabel} ngày ${dateLabel}. Vui lòng liên hệ khách.`,
                        'LATE_WARNING',
                        aptId
                    );

                    // Ghi activity log
                    await ActivityLog.create({
                        userId: SYSTEM_ACTOR_ID,
                        action: 'LATE_WARNING_SENT',
                        description: `[Hệ thống] Cảnh báo trễ hẹn #${aptCode} — ${custName} trễ ${late} phút (${slotLabel} ngày ${dateLabel})`,
                        targetModel: 'Appointment',
                        targetId: apt._id,
                        metadata: { custName, petName, slotLabel, dateLabel, lateMinutes: String(late) },
                    }).catch(() => {});

                    console.log(`[CronJob] LATE_WARNING: Gửi cảnh báo lịch #${aptCode} — trễ ${late} phút`);
                }
            }
        }
    } catch (err) {
        console.error('[CronJob] appointmentLateCron error:', err.message);
    }
}

// ── Register cron ─────────────────────────────────────────────

/**
 * Chạy mỗi 5 phút trong giờ làm việc (7:00 - 21:00)
 * Cron expression: every-5-min from 7 to 21
 */
function startAppointmentLateCron() {
    cron.schedule('*/5 7-21 * * *', () => {
        console.log('[CronJob] Checking late appointments...');
        checkLateAppointments();
    }, {
        timezone: 'Asia/Ho_Chi_Minh',
    });

    console.log('✅ [CronJob] appointmentLateCron started (every 5 min, 07:00–21:00 ICT)');
}

module.exports = { startAppointmentLateCron, checkLateAppointments };
