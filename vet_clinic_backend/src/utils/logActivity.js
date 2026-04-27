const ActivityLog = require('../models/ActivityLog');

/**
 * Ghi một dòng lịch sử hoạt động.
 * @param {Object} options
 * @param {string} options.userId      - ID tài khoản thực hiện hành động
 * @param {string} options.action      - Tên hành động (VD: 'CANCEL_APPOINTMENT')
 * @param {string} options.description - Mô tả ngắn gọn người đọc hiểu được
 * @param {string} [options.targetModel] - Model liên quan ('Appointment','Invoice'…)
 * @param {string} [options.targetId]    - ID document liên quan
 * @param {Object} [options.metadata]    - Dữ liệu phụ tuỳ ý (reason, oldStatus…)
 * @param {string} [options.ipAddress]   - IP của request (lấy từ req.ip)
 */
const logActivity = async ({ userId, action, description, targetModel, targetId, metadata, ipAddress }) => {
    try {
        await ActivityLog.create({ userId, action, description, targetModel, targetId, metadata, ipAddress });
    } catch (err) {
        // Không throw — log lỗi nhẹ thôi, không ảnh hưởng response chính
        console.error('[ActivityLog] Lỗi ghi log:', err.message);
    }
};

module.exports = logActivity;
