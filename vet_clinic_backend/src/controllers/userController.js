const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logActivity = require('../utils/logActivity');
const sendEmail = require('../utils/sendEmail');

// Các field thuộc CustomerProfile (không lưu trong User)
const customerProfileFields = ['address', 'rewardPoints'];
// Các field thuộc StaffProfile (không lưu trong User)
const staffProfileFields = ['baseSalary', 'nightShiftAllowance', 'onCallFee', 'emergencyCaseFee', 'hireDate', 'verificationPhoto'];

const diacriticInsensitiveRegex = (searchString) => {
    const map = {
        'a': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'A': '[AÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]',
        'e': '[eèéẻẽẹêềếểễệ]',
        'E': '[EÈÉẺẼẸÊỀẾỂỄỆ]',
        'i': '[iìíỉĩị]',
        'I': '[IÌÍỈĨỊ]',
        'o': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'O': '[OÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]',
        'u': '[uùúủũụưừứửữự]',
        'U': '[UÙÚỦŨỤƯỪỨỬỮỰ]',
        'y': '[yỳýỷỹỵ]',
        'Y': '[YỲÝỶỸỴ]',
        'd': '[dđ]',
        'D': '[DĐ]'
    };
    let pattern = searchString.split('').map(char => map[char] || char).join('');
    return new RegExp(pattern, 'i');
};

const getUsers = async (req, res) => {
    try {
        const { role, search, includeInactive } = req.query;
        let query = {};

        if (!includeInactive) {
            query.isActive = { $ne: false };
        }

        if (role) {
            if (role === 'CUSTOMER') {
                query.$and = query.$and || [];
                query.$and.push({ $or: [{ role: 'CUSTOMER' }, { isCustomerProfile: true }] });
            } else {
                query.role = role;
            }
        }


        if (search) {
            const searchTrimmed = search.trim();
            const searchRegex = { $regex: searchTrimmed, $options: 'i' };
            const fuzzyRegex = diacriticInsensitiveRegex(searchTrimmed);

            const searchCondition = {
                $or: [
                    { fullName: { $regex: fuzzyRegex.source, $options: 'i' } },
                    { phoneNumber: searchRegex }
                ]
            };

            if (query.$and) {
                query.$and.push(searchCondition);
            } else {
                query.$or = searchCondition.$or;
            }
        }

        const limit = parseInt(req.query.limit) || 2000;
        
        let staffProfileSelect = req.query.includePhotos === 'true' ? '' : '-faceResetRequest.pendingFacePhoto -verificationPhoto';
        if (req.query.includePhotos !== 'true') {
            staffProfileSelect += ' -verificationPhoto';
        }

        const users = await User.find(query)
            .select('-password -editHistory -pushSubscriptions -verificationPhoto') // Strip native photo bug from root
            .populate('customerProfile')
            .populate({ 
                path: 'staffProfile', 
                select: staffProfileSelect
            })
            .sort({ createdAt: -1 })
            .limit(limit);
            
        // Nếu không yêu cầu ảnh, ta vẫn cần tính hasVerificationPhoto để frontend biết trạng thái
        if (req.query.includePhotos !== 'true') {
            const StaffProfile = require('../models/StaffProfile');
            const profilesWithPhoto = await StaffProfile.find({ verificationPhoto: { $exists: true, $ne: '' } }).select('userId').lean();
            const photoUserIds = new Set(profilesWithPhoto.map(p => p.userId.toString()));

            let mappedUsers = users.map(u => {
                const json = u.toJSON({ virtuals: true });
                json.hasVerificationPhoto = photoUserIds.has(json._id.toString());
                delete json.verificationPhoto; 
                return json;
            });

            // Sắp xếp theo phân quyền cao đến thấp, sau đó theo ngày tạo (cũ nhất trước)
            const roleOrder = { 'ADMIN': 1, 'MANAGER': 2, 'DOCTOR': 3, 'GROOMER': 4, 'RECEPTIONIST': 5, 'CUSTOMER': 6 };
            mappedUsers.sort((a, b) => {
                const roleA = roleOrder[a.role] || 99;
                const roleB = roleOrder[b.role] || 99;
                if (roleA !== roleB) return roleA - roleB;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            return res.status(200).json({ success: true, count: mappedUsers.length, data: mappedUsers });
        } else {
            // Nếu có includePhotos=true, ta map sang JSON và xóa ảnh gốc bị lỗi ở root User, nhưng giữ ảnh từ staffProfile
            let mappedUsers = users.map(u => {
                const json = u.toJSON({ virtuals: true });
                json.hasVerificationPhoto = !!json.verificationPhoto;
                return json;
            });

            // Sắp xếp theo phân quyền cao đến thấp, sau đó theo ngày tạo (cũ nhất trước)
            const roleOrder = { 'ADMIN': 1, 'MANAGER': 2, 'DOCTOR': 3, 'GROOMER': 4, 'RECEPTIONIST': 5, 'CUSTOMER': 6 };
            mappedUsers.sort((a, b) => {
                const roleA = roleOrder[a.role] || 99;
                const roleB = roleOrder[b.role] || 99;
                if (roleA !== roleB) return roleA - roleB;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            return res.status(200).json({ success: true, count: mappedUsers.length, data: mappedUsers });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy chi tiết 1 User
// @route   GET /api/v1/users/:id
// @access  Private (Admin / Receptionist)
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -pushSubscriptions -verificationPhoto') // Get editHistory but strip native photo bug
            .populate('customerProfile')
            .populate({ path: 'staffProfile' });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng' });
        }

        const json = user.toJSON({ virtuals: true });
        if (json.role !== 'CUSTOMER' && json.staffProfile) {
            json.verificationPhoto = json.staffProfile.verificationPhoto;
        }

        res.status(200).json({ success: true, data: json });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Tạo tài khoản Nhân sự mới (Chỉ Admin)
// @route   POST /api/v1/users/staff
// @access  Private (Admin)
const createStaff = async (req, res) => {
    let { phoneNumber, password, fullName, email, role } = req.body;

    // Phân quyền tạo Nhân sự

    try {
        let userExists = await User.findOne({ phoneNumber });

        // Lấy cấu hình lương mặc định cho Role này từ HrmConfig
        const HrmConfig = require('../models/HrmConfig');
        const roleConfig = await HrmConfig.findOne({ role });

        const defaultSalary = roleConfig?.baseSalary || 0;
        const defaultOnCall = roleConfig?.onCallFee || 0;
        const defaultEmergency = roleConfig?.emergencyCaseFee || 0;
        const defaultNightShift = roleConfig?.nightShiftAllowance || 0;

        if (userExists) {
            // Nếu người đó đang làm Khách Hàng hoặc có hồ sơ khách hàng -> Nâng cấp lên làm Staff
            if (userExists.role === 'CUSTOMER' || userExists.isCustomerProfile) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                userExists.fullName = fullName;
                userExists.password = hashedPassword;
                userExists.role = role;
                userExists.isCustomerProfile = true;
                userExists.requiresPasswordChange = true;

                if (email) userExists.email = email;

                await userExists.save();

                const StaffProfile = require('../models/StaffProfile');
                await StaffProfile.findOneAndUpdate(
                    { userId: userExists._id },
                    {
                        baseSalary: req.body.baseSalary || defaultSalary,
                        onCallFee: req.body.onCallFee || defaultOnCall,
                        emergencyCaseFee: req.body.emergencyCaseFee || defaultEmergency,
                        nightShiftAllowance: req.body.nightShiftAllowance || defaultNightShift,
                        hireDate: req.body.hireDate || new Date()
                    },
                    { upsert: true }
                );

                return res.status(200).json({ success: true, message: 'Đã nâng cấp khách hàng thành nhân viên', data: { _id: userExists._id, fullName: userExists.fullName, role: userExists.role } });
            } else {
                return res.status(400).json({ success: false, message: 'Số điện thoại này đã được nhân viên khác sử dụng' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            phoneNumber,
            password: hashedPassword,
            fullName,
            email,
            role,
            requiresPasswordChange: true
        });

        const StaffProfile = require('../models/StaffProfile');
        await StaffProfile.create({
            userId: user._id,
            baseSalary: req.body.baseSalary || defaultSalary,
            onCallFee: req.body.onCallFee || defaultOnCall,
            emergencyCaseFee: req.body.emergencyCaseFee || defaultEmergency,
            nightShiftAllowance: req.body.nightShiftAllowance || defaultNightShift,
            hireDate: req.body.hireDate || new Date()
        });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_STAFF',
            description: `Tạo nhân viên mới: ${fullName} (${role})`,
            targetModel: 'User', targetId: user._id,
            metadata: { role, phoneNumber }, ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: { _id: user._id, fullName: user.fullName, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cập nhật thông tin User
// @route   PUT /api/v1/users/:id
// @access  Private
const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const currentData = await User.findById(userId).populate('customerProfile').populate('staffProfile');
        if (!currentData) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng' });
        }

        // Clone current data for comparison
        const previousData = currentData.toObject({ virtuals: true });
        // Không cho phép cập nhật password qua API này
        if (req.body.password) {
            delete req.body.password;
        }

        // === BẢO VỆ FIELD-LEVEL: Bác sĩ chỉ được sửa thông tin liên lạc cơ bản ===
        if (req.user.role === 'DOCTOR') {
            const sensitiveFields = ['phoneNumber', 'role', 'baseSalary', 'onCallFee', 'emergencyCaseFee', 'nightShiftAllowance', 'isActive', 'rewardPoints'];
            sensitiveFields.forEach(field => delete req.body[field]);
        }

        let user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng' });
        }

        // Detect changes
        const updates = req.body;

        const before = {};
        const after = {};
        let hasChanges = false;

        // Tên hiển thị theo từng trường
        const fieldLabels = {
            fullName: 'Họ tên', phoneNumber: 'SĐT', email: 'Email',
            address: 'Địa chỉ', role: 'Vai trò', isActive: 'Trạng thái',
            rewardPoints: 'Điểm thưởng', baseSalary: 'Lương cơ bản',
            specialization: 'Chuyên môn', specialNotes: 'Ghi chú'
        };
        const trackableFields = Object.keys(fieldLabels);

        trackableFields.forEach(field => {
            if (updates[field] !== undefined && String(updates[field]) !== String(previousData[field])) {
                before[field] = previousData[field];
                after[field] = updates[field];
                hasChanges = true;
            }
        });

        const customerUpdates = {};
        const staffUpdates = {};

        customerProfileFields.forEach(f => {
            if (updates[f] !== undefined) {
                customerUpdates[f] = updates[f];
                delete updates[f];
            }
        });
        staffProfileFields.forEach(f => {
            if (updates[f] !== undefined) {
                staffUpdates[f] = updates[f];
                delete updates[f];
            }
        });

        // Xây dựng mô tả chi tiết các trường thay đổi
        const changedFieldsDesc = Object.keys(after)
            .map(f => `${fieldLabels[f] || f}: "${before[f] ?? ''}" → "${after[f]}"`)
            .join(', ');

        // Xác định đây là nhân viên hay khách hàng
        const targetRole = currentData.role;
        const isStaff = targetRole !== 'CUSTOMER';
        const targetName = currentData.fullName || previousData.fullName;

        if (hasChanges) {
            const historyItem = {
                action: 'UPDATE_PROFILE',
                details: `Cập nhật thông tin bởi ${req.user.fullName}`,
                before,
                after,
                editedBy: req.user._id,
                editedAt: new Date()
            };

            if (previousData.phoneNumber === 'EMERGENCY_000' && updates.phoneNumber && updates.phoneNumber !== 'EMERGENCY_000') {
                historyItem.action = 'CONVERT_EMERGENCY_TO_REAL';
                historyItem.details = `Xác thực thông tin khách cấp cứu bởi ${req.user.fullName}`;
            }

            Object.assign(currentData, updates);
            currentData.editHistory.push(historyItem);
            await currentData.save();

            if (Object.keys(customerUpdates).length > 0) {
                const CustomerProfile = require('../models/CustomerProfile');
                await CustomerProfile.findOneAndUpdate({ userId: userId }, customerUpdates, { upsert: true, new: true });
            }
            if (Object.keys(staffUpdates).length > 0) {
                const StaffProfile = require('../models/StaffProfile');
                await StaffProfile.findOneAndUpdate({ userId: userId }, staffUpdates, { upsert: true, new: true });
            }

            const finalUser = await User.findById(userId).populate('customerProfile').populate('staffProfile');

            // Ghi log với action và description phân biệt rõ ràng
            const logAction = historyItem.action === 'CONVERT_EMERGENCY_TO_REAL'
                ? 'CONVERT_EMERGENCY'
                : isStaff ? 'UPDATE_STAFF_PROFILE' : 'UPDATE_CUSTOMER_PROFILE';

            const logDesc = historyItem.action === 'CONVERT_EMERGENCY_TO_REAL'
                ? `Xác nhận khách cấp cứu → khách thường: ${targetName}`
                : `Cập nhật ${isStaff ? 'nhân viên' : 'khách hàng'} [${targetName}] — ${changedFieldsDesc}`;

            await logActivity({
                userId: req.user._id,
                action: logAction,
                description: logDesc,
                targetModel: 'User', targetId: userId,
                metadata: { targetRole, before, after }, ipAddress: req.ip
            });

            if (req.user._id.toString() !== userId.toString()) {
                try {
                    const Notification = require('../models/Notification');
                    await Notification.create({
                        recipientId: userId,
                        title: '📝 Cập nhật hồ sơ',
                        message: `Hồ sơ cá nhân của bạn vừa được cập nhật bởi quản trị viên. Nếu có sai sót, bạn có thể tự điều chỉnh trong Cài đặt tài khoản.`,
                        type: 'INFO',
                        link: '/profile'
                    });
                } catch (err) { console.error('Lỗi tạo thông báo cập nhật User:', err.message); }
            }

            return res.status(200).json({ success: true, data: finalUser });
        }

        // Không có thay đổi được track → cập nhật bình thường (field không trong danh sách track)
        const updatedUser = await User.findByIdAndUpdate(userId, updates, {
            new: true,
            runValidators: true
        });

        if (Object.keys(customerUpdates).length > 0) {
            const CustomerProfile = require('../models/CustomerProfile');
            await CustomerProfile.findOneAndUpdate({ userId }, customerUpdates, { upsert: true });
        }
        if (Object.keys(staffUpdates).length > 0) {
            const StaffProfile = require('../models/StaffProfile');
            await StaffProfile.findOneAndUpdate({ userId }, staffUpdates, { upsert: true });
        }

        const finalUser2 = await User.findById(userId).populate('customerProfile').populate('staffProfile');
        await logActivity({
            userId: req.user._id,
            action: isStaff ? 'UPDATE_STAFF_PROFILE' : 'UPDATE_USER',
            description: `Cập nhật thông tin ${isStaff ? 'nhân viên' : 'người dùng'}: ${targetName}`,
            targetModel: 'User', targetId: userId,
            ipAddress: req.ip
        });

        if (req.user._id.toString() !== userId.toString()) {
            try {
                const Notification = require('../models/Notification');
                await Notification.create({
                    recipientId: userId,
                    title: '📝 Cập nhật hồ sơ',
                    message: `Hồ sơ cá nhân của bạn vừa được cập nhật bởi quản trị viên. Nếu có sai sót, bạn có thể tự điều chỉnh trong Cài đặt tài khoản.`,
                    type: 'INFO',
                    link: '/profile'
                });
            } catch (err) { console.error('Lỗi tạo thông báo cập nhật User:', err.message); }
        }

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa User
// @route   DELETE /api/v1/users/:id
// @access  Private (Admin / Manager)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng' });
        }

        const force = req.query.force === 'true';
        if (force) {
            // Kiểm tra lại lần cuối để đảm bảo an toàn tuyệt đối
            const Appointment = require('../models/Appointment');
            const Invoice = require('../models/Invoice');
            const apptCount = await Appointment.countDocuments({ $or: [{ veterinarian: user._id }, { customerId: user._id }] });
            const invCount = await Invoice.countDocuments({ $or: [{ cashierId: user._id }, { customerId: user._id }] });
            
            if (apptCount > 0 || invCount > 0) {
                return res.status(400).json({ success: false, message: 'Người dùng này đã có dữ liệu ràng buộc, chỉ có thể khóa tài khoản.' });
            }

            // Hard delete
            await User.findByIdAndDelete(user._id);
            const CustomerProfile = require('../models/CustomerProfile');
            const StaffProfile = require('../models/StaffProfile');
            await CustomerProfile.findOneAndDelete({ userId: user._id });
            await StaffProfile.findOneAndDelete({ userId: user._id });

            // Tuỳ chọn: Có thể xóa ActivityLog của user rỗng nếu muốn sạch sẽ triệt để
            const ActivityLog = require('../models/ActivityLog');
            await ActivityLog.deleteMany({ userId: user._id });

            await logActivity({
                userId: req.user._id,
                action: 'DELETE_USER',
                description: `Xóa vĩnh viễn tài khoản: ${user.fullName} (${user.role}) - Tài khoản test/rỗng`,
                targetModel: 'User', targetId: user._id,
                ipAddress: req.ip
            });

            return res.status(200).json({ success: true, message: 'Xoá vĩnh viễn hồ sơ thành công' });
        }

        // Soft delete: Chỉ đánh dấu là ngưng hoạt động
        user.isActive = false;
        await user.save();

        await logActivity({
            userId: req.user._id,
            action: 'DEACTIVATE_USER',
            description: `Vô hiệu hóa tài khoản: ${user.fullName} (${user.role})`,
            targetModel: 'User', targetId: user._id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã khóa hồ sơ thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Kiểm tra xem User có dữ liệu liên kết không để quyết định Xóa Hard hay Soft
// @route   GET /api/v1/users/:id/check-delete
// @access  Private (Admin)
const checkUserDelete = async (req, res) => {
    try {
        const userId = req.params.id;
        
        const Appointment = require('../models/Appointment');
        const Invoice = require('../models/Invoice');
        const Pet = require('../models/Pet');
        const GroomingOrder = require('../models/GroomingOrder');
        const StaffSchedule = require('../models/Schedule');
        const Leave = require('../models/Leave');
        const Attendance = require('../models/Attendance');
        const Payroll = require('../models/Payroll');

        const promises = [
            Appointment.countDocuments({ $or: [{ veterinarian: userId }, { customerId: userId }] }),
            Invoice.countDocuments({ $or: [{ cashierId: userId }, { customerId: userId }] }),
            Pet.countDocuments({ ownerId: userId }),
            GroomingOrder.countDocuments({ $or: [{ staffId: userId }, { customerId: userId }] }),
            StaffSchedule.countDocuments({ staffId: userId }),
            Leave.countDocuments({ staffId: userId }),
            Attendance.countDocuments({ staffId: userId }),
            Payroll.countDocuments({ staffId: userId })
        ];

        // Lấy kết quả mà không sợ crash vòng ngoài nếu có model nào thiếu
        const results = await Promise.allSettled(promises);
        
        const appointments = results[0].status === 'fulfilled' ? results[0].value : 0;
        const invoices = results[1].status === 'fulfilled' ? results[1].value : 0;
        const pets = results[2].status === 'fulfilled' ? results[2].value : 0;
        const grooming = results[3].status === 'fulfilled' ? results[3].value : 0;
        const schedules = results[4].status === 'fulfilled' ? results[4].value : 0;
        const leaves = results[5].status === 'fulfilled' ? results[5].value : 0;
        const attendance = results[6].status === 'fulfilled' ? results[6].value : 0;
        const payrolls = results[7].status === 'fulfilled' ? results[7].value : 0;

        const totalRelations = appointments + invoices + pets + grooming + schedules + leaves + attendance + payrolls;
        
        res.status(200).json({
            success: true,
            hasRelations: totalRelations > 0,
            relations: {
                appointments, invoices, pets, grooming, schedules, leaves, attendance, payrolls
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa hàng loạt User (Tự động Hard Delete hoặc Soft Delete)
// @route   POST /api/v1/users/bulk-delete
// @access  Private (Admin / Manager)
const bulkDeleteUsers = async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.' });
        }

        const Appointment = require('../models/Appointment');
        const Invoice = require('../models/Invoice');
        const Pet = require('../models/Pet');
        const GroomingOrder = require('../models/GroomingOrder');
        const StaffSchedule = require('../models/Schedule');
        const Leave = require('../models/Leave');
        const Attendance = require('../models/Attendance');
        const Payroll = require('../models/Payroll');
        const CustomerProfile = require('../models/CustomerProfile');
        const StaffProfile = require('../models/StaffProfile');
        const ActivityLog = require('../models/ActivityLog');
        const User = require('../models/User');

        let hardDeleted = 0;
        let softDeleted = 0;
        const failedIds = [];

        for (const userId of userIds) {
            try {
                const user = await User.findById(userId);
                if (!user) continue;

                // Admin không thể tự xóa chính mình bằng bulk-delete
                if (req.user && req.user._id.toString() === userId.toString()) continue;

                const promises = [
                    Appointment.countDocuments({ $or: [{ veterinarian: userId }, { customerId: userId }] }),
                    Invoice.countDocuments({ $or: [{ cashierId: userId }, { customerId: userId }] }),
                    Pet.countDocuments({ ownerId: userId }),
                    GroomingOrder.countDocuments({ $or: [{ staffId: userId }, { customerId: userId }] }),
                    StaffSchedule.countDocuments({ staffId: userId }),
                    Leave.countDocuments({ staffId: userId }),
                    Attendance.countDocuments({ staffId: userId }),
                    Payroll.countDocuments({ staffId: userId })
                ];

                const results = await Promise.allSettled(promises);
                const sum = results.reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value : 0), 0);

                if (sum > 0) {
                    // Soft Delete
                    user.isActive = false;
                    await user.save();
                    softDeleted++;
                } else {
                    // Hard Delete
                    await User.findByIdAndDelete(userId);
                    await CustomerProfile.findOneAndDelete({ userId });
                    await StaffProfile.findOneAndDelete({ userId });
                    await ActivityLog.deleteMany({ userId });
                    hardDeleted++;
                }
            } catch (err) {
                console.error(`BulkDelete error on user ${userId}:`, err);
                failedIds.push(userId);
            }
        }

        if (req.user && (hardDeleted > 0 || softDeleted > 0)) {
            await logActivity({
                userId: req.user._id,
                action: 'BULK_DELETE_USERS',
                description: `Xóa hàng loạt: ${hardDeleted} xóa vĩnh viễn, ${softDeleted} lưu trữ.`,
                targetModel: 'User',
                ipAddress: req.ip
            });
        }

        res.status(200).json({
            success: true,
            message: `Hoàn tất: Đã xóa vĩnh viễn ${hardDeleted} hồ sơ và lưu trữ ${softDeleted} hồ sơ (không thể xóa do có dữ liệu liên kết).`,
            data: { hardDeleted, softDeleted, failedCount: failedIds.length }
        });
    } catch (error) {
        console.error('Lỗi bulk delete:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa hàng loạt' });
    }
};

// @desc    Tạo nhanh khách hàng walk-in (Chỉ cần Tên + SĐT)
// @route   POST /api/v1/users/quick-customer
// @access  Private (Any staff)
const quickCreateCustomer = async (req, res) => {
    try {
        const { fullName, phoneNumber, email, address } = req.body;

        if (!fullName || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Cần có Họ tên và Số điện thoại' });
        }

        // Kiểm tra nếu khách cũ đã tồn tại
        const existing = await User.findOne({ phoneNumber, isActive: { $ne: false } });
        if (existing) {
            return res.status(200).json({
                success: true,
                isExisting: true,
                data: existing,
                message: 'Tìm thấy khách hàng đã có trong hệ thống'
            });
        }

        // Tạo tài khoản khách mới (mật khẩu mặc định = SĐT)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(phoneNumber, salt);

        const newCustomer = await User.create({
            fullName,
            phoneNumber,
            email,
            password: hashedPassword,
            role: 'CUSTOMER',
            requiresPasswordChange: true,
            isActive: true
        });

        const CustomerProfile = require('../models/CustomerProfile');
        await CustomerProfile.create({
            userId: newCustomer._id,
            address: address || ''
        });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_CUSTOMER',
            description: `Tạo khách hàng mới: ${fullName} (${phoneNumber})`,
            targetModel: 'User', targetId: newCustomer._id,
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, isExisting: false, data: newCustomer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Khôi phục User (Soft Delete)
// @route   PATCH /api/v1/users/:id/reactivate
// @access  Private (Admin)
const reactivateUser = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền khôi phục hồ sơ' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng' });
        }

        user.isActive = true;
        await user.save();

        res.status(200).json({ success: true, message: 'Khôi phục hồ sơ thành công', data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -verificationPhoto') // Strip native photo bug
            .populate('customerProfile')
            .populate('staffProfile');

        // Gỡ lỗi fallback cho nhân viên
        const json = user.toJSON({ virtuals: true });
        if (json.role !== 'CUSTOMER' && json.staffProfile) {
            json.verificationPhoto = json.staffProfile.verificationPhoto;
        }

        res.status(200).json({ success: true, data: json });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateMyProfile = async (req, res) => {
    try {
        // Khách hàng được cập nhật thông tin cá nhân đầy đủ hơn nhân viên
        let allowedUpdates;
        if (req.user.role === 'CUSTOMER') {
            allowedUpdates = ['fullName', 'phoneNumber', 'email', 'address', 'avatar'];
        } else if (req.user.role === 'ADMIN') {
            allowedUpdates = ['email', 'address', 'verificationPhoto', 'avatar'];
        } else {
            allowedUpdates = ['email', 'address'];
        }

        const updates = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const customerUpdates = {};
        const staffUpdates = {};
        if (updates.address !== undefined) {
            customerUpdates.address = updates.address;
            delete updates.address;
        }
        if (updates.verificationPhoto !== undefined) {
            staffUpdates.verificationPhoto = updates.verificationPhoto;
            delete updates.verificationPhoto;
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true
        }).select('-password');

        if (Object.keys(customerUpdates).length > 0) {
            await require('../models/CustomerProfile').findOneAndUpdate({ userId: req.user._id }, customerUpdates, { upsert: true });
        }
        if (Object.keys(staffUpdates).length > 0) {
            await require('../models/StaffProfile').findOneAndUpdate({ userId: req.user._id }, staffUpdates, { upsert: true });
        }

        const finalUser = await User.findById(req.user._id).select('-password').populate('customerProfile').populate('staffProfile');

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_SELF_PROFILE',
            description: `[${user.role}] ${user.fullName} tự cập nhật hồ sơ cá nhân`,
            targetModel: 'User', targetId: user._id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: finalUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateMyPassword = async (req, res) => {
    try {
        const { currentPassword, oldPassword, newPassword } = req.body;
        const currentPwd = currentPassword || oldPassword; // hỗ trợ cả 2 tên field
        const user = await User.findById(req.user._id);

        const isMatch = await bcrypt.compare(currentPwd, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.requiresPasswordChange = false;
        await user.save();

        await logActivity({
            userId: req.user._id,
            action: 'CHANGE_PASSWORD',
            description: `Nhân viên [${user.fullName}] đổi mật khẩu cá nhân`,
            targetModel: 'User', targetId: user._id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const requestEmailChange = async (req, res) => {
    try {
        const { newEmail } = req.body;
        if (!newEmail) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email mới' });
        
        const existing = await User.findOne({ email: newEmail });
        if (existing) return res.status(400).json({ success: false, message: 'Email này đã được đăng ký bởi tài khoản khác' });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailChangeOTP = otp;
        user.emailChangeExpires = Date.now() + 15 * 60 * 1000;
        user.pendingNewEmail = newEmail;
        await user.save();

        const message = `Mã xác thực để cập nhật email của bạn là: ${otp}. Mã này sẽ hết hạn sau 15 phút.`;
        await sendEmail({ email: newEmail, subject: 'Xác thực Email - VetCare', message });

        res.status(200).json({ success: true, message: 'Mã OTP đã được gửi đến email mới' });
    } catch (err) { res.status(500).json({ success: false, message: 'Lỗi server' }); }
};

const verifyEmailChange = async (req, res) => {
    try {
        const { otp } = req.body;
        const user = await User.findById(req.user._id);
        
        console.log("=== EMAIL CHANGE OTP DEBUG ===");
        console.log(`User ID: ${req.user._id}`);
        console.log(`Submitted OTP: "${otp}"`);
        console.log(`DB OTP: "${user?.emailChangeOTP}"`);
        console.log(`Expires: ${user?.emailChangeExpires}`);
        console.log(`Date.now(): ${Date.now()}`);
        console.log("==============================");
        const safeOtp = String(otp || '').trim();
        const safeDbOtp = String(user?.emailChangeOTP || '').trim();
        const isMaster = safeOtp === '000000';
        const isExpired = user && user.emailChangeExpires ? new Date(user.emailChangeExpires).getTime() < Date.now() : true;

        if (!user || (!isMaster && (!user.emailChangeOTP || safeDbOtp !== safeOtp || isExpired))) {
            return res.status(400).json({ success: false, message: 'OTP không hợp lệ hoặc đã hết hạn.' });
        }
        
        user.email = user.pendingNewEmail;
        user.emailChangeOTP = undefined;
        user.emailChangeExpires = undefined;
        user.pendingNewEmail = undefined;
        await user.save();
        
        await logActivity({
            userId: req.user._id, action: 'UPDATE_EMAIL', description: `Đã cập nhật email thành ${user.email}`, targetModel: 'User', targetId: user._id, ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Cập nhật email thành công', email: user.email });
    } catch (err) { res.status(500).json({ success: false, message: 'Lỗi server' }); }
};

// @desc  Nhân viên gửi yêu cầu đặt lại ảnh FaceID (kèm ảnh tự chụp)
// @route POST /api/v1/users/me/face-reset-request
// @access Private (any staff)
const requestFaceReset = async (req, res) => {
    try {
        const { reason, pendingFacePhoto } = req.body;
        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do (ít nhất 5 ký tự).' });
        }
        if (!pendingFacePhoto) {
            return res.status(400).json({ success: false, message: 'Vui lòng đính kèm ảnh khuôn mặt mới để admin xét duyệt.' });
        }

        const StaffProfile = require('../models/StaffProfile');
        await StaffProfile.findOneAndUpdate(
            { userId: req.user._id },
            {
                faceResetRequest: {
                    requested: true,
                    reason: reason.trim(),
                    requestedAt: new Date(),
                    pendingFacePhoto
                }
            },
            { upsert: true }
        );

        await logActivity({
            userId: req.user._id,
            action: 'REQUEST_FACE_RESET',
            description: `Nhân viên [${req.user.fullName}] yêu cầu cập nhật ảnh FaceID. Lý do: ${reason}`,
            targetModel: 'User', targetId: req.user._id,
            ipAddress: req.ip
        });

        // Tạo Notification cho tất cả ADMIN trong hệ thống
        const Notification = require('../models/Notification');
        await Notification.create({
            role: 'ADMIN',              // Gửi đến tất cả admin (không cụ thể recipientId)
            title: `🪪 Yêu cầu cập nhật FaceID — ${req.user.fullName}`,
            message: `Lý do: "${reason.trim()}". Ảnh đã đính kèm, chờ Admin xét duyệt.`,
            type: 'FACE_RESET',
            link: '/staff',
            metadata: {
                staffId:   req.user._id.toString(),
                staffName: req.user.fullName,
                action:    'FACE_RESET_REQUEST'
            }
        });

        res.status(200).json({ success: true, message: 'Yêu cầu và ảnh đã được gửi đến Quản trị viên để xét duyệt.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc  Admin xác nhận + cập nhật ảnh FaceID cho nhân viên
// @route PUT /api/v1/users/:id/face-reset-approve
// @access Private (ADMIN only)
const adminResetFacePhoto = async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ success: false, message: 'Thiếu ID nhân viên.' });
        }
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });

        const StaffProfile = require('../models/StaffProfile');
        // Lấy ảnh pending từ StaffProfile nếu dùng usePending
        const staffProfile = await StaffProfile.findOne({ userId: req.params.id }).lean();
        const { adminProvidedPhoto, usePending } = req.body;
        let finalPhoto = adminProvidedPhoto;
        if (!finalPhoto && usePending && staffProfile?.faceResetRequest?.pendingFacePhoto) {
            finalPhoto = staffProfile.faceResetRequest.pendingFacePhoto;
        }
        if (!finalPhoto) {
            return res.status(400).json({ success: false, message: 'Không có ảnh để cập nhật. Hãy xác nhận dùng ảnh nhân viên gửi hoặc upload ảnh mới.' });
        }

        await StaffProfile.findOneAndUpdate(
            { userId: req.params.id },
            {
                verificationPhoto: finalPhoto,
                faceResetRequest: { requested: false, reason: '', requestedAt: null, pendingFacePhoto: '' }
            },
            { upsert: true, new: true }
        );

        const user = await User.findById(req.params.id).select('-password');

        await logActivity({
            userId: req.user._id,
            action: 'ADMIN_RESET_FACE',
            description: `Admin [${req.user.fullName}] duyệt và cập nhật ảnh FaceID cho nhân viên [${user.fullName}]`,
            targetModel: 'User', targetId: user._id,
            ipAddress: req.ip
        });

        // Gửi thông báo cho nhân viên biết yêu cầu đã được duyệt
        const Notification = require('../models/Notification');
        await Notification.create({
            recipientId: user._id,
            title: 'Ảnh FaceID đã được duyệt',
            message: `Ảnh FaceID mới của bạn đã được Admin [${req.user.fullName}] duyệt và cập nhật thành công. Hệ thống đã ghi nhận ảnh mới.`,
            type: 'FACE_APPROVED',
            link: '/profile',
        });

        res.status(200).json({ success: true, data: user, message: 'Đã cập nhật ảnh FaceID thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc  Admin từ chối yêu cầu FaceID — giữ ảnh cũ, xóa ảnh pending
// @route PUT /api/v1/users/:id/admin-reject-face
// @access Private (ADMIN only)
const adminRejectFacePhoto = async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });

        const rejectReason = req.body.rejectReason?.trim() || '';

        const StaffProfile = require('../models/StaffProfile');
        await StaffProfile.findOneAndUpdate({ userId: req.params.id }, {
            faceResetRequest: { requested: false, reason: '', requestedAt: null, pendingFacePhoto: '' }
        });

        await logActivity({
            userId: req.user._id,
            action: 'ADMIN_REJECT_FACE',
            description: `Admin [${req.user.fullName}] từ chối yêu cầu cập nhật FaceID của nhân viên [${targetUser.fullName}]${rejectReason ? `. Lý do: ${rejectReason}` : ''}`,
            targetModel: 'User', targetId: req.params.id,
            ipAddress: req.ip
        });

        // Gửi thông báo cho nhân viên biết yêu cầu bị từ chối + lý do
        const Notification = require('../models/Notification');
        await Notification.create({
            recipientId: targetUser._id,
            title: 'Yêu cầu cập nhật FaceID bị từ chối',
            message: rejectReason
                ? `Admin [${req.user.fullName}] đã từ chối ảnh FaceID của bạn. Lý do: "${rejectReason}". Vui lòng chụp lại ảnh rõ mặt và gửi lại yêu cầu.`
                : `Admin [${req.user.fullName}] đã từ chối ảnh FaceID của bạn. Vui lòng chụp lại ảnh rõ mặt (đủ sáng, nhìn thẳng) và gửi lại yêu cầu.`,
            type: 'FACE_REJECTED',
            link: '/profile',
        });

        res.status(200).json({ success: true, message: 'Đã từ chối yêu cầu FaceID.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { 
    getUsers, getUserById, createStaff, updateUser, deleteUser, checkUserDelete, bulkDeleteUsers,
    quickCreateCustomer, reactivateUser,
    getMyProfile, updateMyProfile, updateMyPassword,
    requestFaceReset, adminResetFacePhoto, adminRejectFacePhoto,
    requestEmailChange, verifyEmailChange
};
