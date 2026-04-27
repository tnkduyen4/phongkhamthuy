const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// @desc    Lấy lịch sử hoạt động của 1 nhân viên (Admin only)
// @route   GET /api/v1/activity-logs/:userId
// @access  Private (ADMIN only)
const getActivityLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Kiểm tra user tồn tại
        const targetUser = await User.findById(userId).select('fullName role phoneNumber');
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
        }

        const [logs, total] = await Promise.all([
            ActivityLog.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments({ userId })
        ]);

        res.status(200).json({
            success: true,
            user: targetUser,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy toàn bộ lịch sử hệ thống theo ngày (Admin only)
// @route   GET /api/v1/activity-logs
// @access  Private (ADMIN only)
const getSystemActivityLogs = async (req, res) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip  = (page - 1) * limit;

        // ── Build match stage ──────────────────────────────────────────────────
        const matchStage = {};

        // Lọc theo ngày (date=YYYY-MM-DD) — múi giờ Việt Nam UTC+7
        if (req.query.date) {
            const dateStr = req.query.date;
            matchStage.createdAt = {
                $gte: new Date(`${dateStr}T00:00:00+07:00`),
                $lte: new Date(`${dateStr}T23:59:59.999+07:00`),
            };
        }
        if (req.query.action) matchStage.action = req.query.action;
        if (req.query.model)  matchStage.targetModel = req.query.model;

        // ── Aggregation: join User, lọc CUSTOMER ra ───────────────────────────
        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo',
                },
            },
            // Giữ lại: nhân viên (role != CUSTOMER) + hệ thống (userId không khớp User nào)
            // $lookup trả về array → phải dùng $expr + $size thay vì $size trực tiếp trong $match
            {
                $match: {
                    $or: [
                        { 'userInfo': { $elemMatch: { role: { $ne: 'CUSTOMER' } } } }, // nhân viên / admin
                        { $expr: { $eq: [{ $size: '$userInfo' }, 0] } },               // SYSTEM actor
                    ],
                },
            },
            { $sort: { createdAt: -1 } },
        ];

        // Count tổng (dùng facet để tránh 2 lần aggregate)
        const [[countResult], logs] = await Promise.all([
            ActivityLog.aggregate([...pipeline, { $count: 'total' }]),
            ActivityLog.aggregate([
                ...pipeline,
                { $skip: skip },
                { $limit: limit },
                {
                    $addFields: {
                        userId: {
                            $cond: {
                                if: { $gt: [{ $size: '$userInfo' }, 0] },
                                then: { $arrayElemAt: ['$userInfo', 0] },
                                else: { _id: '$userId', fullName: 'Hệ thống', role: 'SYSTEM' },
                            },
                        },
                    },
                },
                { $project: { userInfo: 0 } },
            ]),
        ]);

        const total = countResult?.total || 0;

        res.status(200).json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: logs,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getActivityLogs, getSystemActivityLogs };

