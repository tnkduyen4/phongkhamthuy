/**
 * attendanceCron.js
 * ─────────────────────────────────────────────────────────────
 * Chạy mỗi giờ — tự động rà soát lịch chấm công trong ngày và ngày hôm trước.
 * 
 * Nghiệp vụ:
 * 1. Đánh vắng (ABSENT) các ca đã qua mà nhân viên không Check-in.
 * 2. Tự động Check-out (isAuto: true) cho các ca có Check-in nhưng quên Check-out, khi ca đã kết thúc.
 */

const cron = require('node-cron');
const { markAbsentPastShifts } = require('../controllers/attendanceController');

async function runAttendanceChecks() {
    try {
        console.log('[CronJob] Running auto-attendance checks (mark-absent / auto-checkout)...');
        // Tạo req, res ảo vì hàm markAbsentPastShifts ban đầu được viết cho REST API
        const req = {};
        const res = {
            status: () => ({
                json: (data) => console.log('[CronJob] Attendance check result:', data)
            })
        };
        await markAbsentPastShifts(req, res);
    } catch (err) {
        console.error('[CronJob] attendanceCron error:', err.message);
    }
}

/**
 * Chạy mỗi giờ vào phút số 5 (Ví dụ: 00:05, 01:05, ...)
 * Lùi 5 phút để đảm bảo các ca kết thúc tròn giờ không bị bỏ sót.
 */
function startAttendanceCron() {
    cron.schedule('5 * * * *', () => {
        runAttendanceChecks();
    }, {
        timezone: 'Asia/Ho_Chi_Minh',
    });

    console.log('✅ [CronJob] attendanceCron started (runs at minute 5 past every hour)');
}

module.exports = { startAttendanceCron, runAttendanceChecks };
