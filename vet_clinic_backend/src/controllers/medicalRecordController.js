const MedicalRecord = require('../models/MedicalRecord');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Pet = require('../models/Pet');
const Medicine = require('../models/Medicine');
const InventoryTransaction = require('../models/InventoryTransaction');
const logActivity = require('../utils/logActivity');

// @desc    Bác sĩ tạo Hồ sơ Bệnh án & Kê đơn (Có thể walk-in không cần lịch hẹn)
// @route   POST /api/v1/medical-records
// @access  Private (Doctor, Admin, Manager)
const createMedicalRecord = async (req, res) => {
    try {
        const {
            appointmentId, petId, customerId,
            weightAtVisit, temperature, symptoms, diagnosis,
            treatment, prescriptions, services, followUpDate
        } = req.body;

        if ((!prescriptions || prescriptions.length === 0) && (!services || services.length === 0)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bệnh án bắt buộc phải có ít nhất một Dịch vụ hoặc một loại Thuốc kê đơn.' 
            });
        }

        let resolvedAppointmentId = appointmentId;

        // === Walk-in: Tự động tạo Appointment ẩn nếu không có sẵn ===
        if (!appointmentId) {
            if (!petId || !customerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Walk-in cần có customerId và petId để tạo bệnh án'
                });
            }
            const walkInAppointment = await Appointment.create({
                customerId,
                petId,
                staffId: req.user._id,
                type: 'MEDICAL',
                category: 'WALKIN',
                bookingSource: 'DOCTOR',
                createdByStaffId: req.user._id,
                date: new Date(),
                timeSlot: new Date().toTimeString().slice(0, 5),
                status: 'IN_PROGRESS',
                customerNotes: 'Walk-in (Khách trực tiếp)'
            });
            resolvedAppointmentId = walkInAppointment._id;
        }


        // === Kiểm tra tồn kho trước khi kê đơn ===
        if (prescriptions && prescriptions.length > 0) {
            for (let item of prescriptions) {
                const medicine = await Medicine.findById(item.medicineId).populate('productId');
                if (!medicine || !medicine.productId) {
                    return res.status(404).json({
                        success: false,
                        message: `Không tìm thấy thuốc ID: ${item.medicineId}`
                    });
                }
                if (medicine.stockQuantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Thuốc ${medicine.productId.name} không đủ tồn kho (Còn lại: ${medicine.stockQuantity})`
                    });
                }
                // Lưu tên thuốc để không mất dù thuốc bị xóa sau này
                item.medicineName = medicine.productId.name;
            }
        }

        // === Tạo Hồ sơ Bệnh án ===
        const record = await MedicalRecord.create({
            appointmentId: resolvedAppointmentId,
            petId: petId || (await Appointment.findById(resolvedAppointmentId))?.petId,
            doctorId: req.user._id,
            weightAtVisit,
            temperature,
            symptoms,
            diagnosis,
            treatment,
            prescriptions: prescriptions || [],
            services: services || [],
            followUpDate
        });

        // === Cập nhật Cân nặng mới nhất vào Hồ sơ Thú cưng ===
        if (weightAtVisit) {
            await Pet.findByIdAndUpdate(petId || (await Appointment.findById(resolvedAppointmentId))?.petId, {
                weight: weightAtVisit
            });
        }

        // === Trừ tồn kho & Ghi log USAGE : ĐÃ CHUYỂN QUA LÚC THANH TOÁN (invoiceController) ===

        // === Cập nhật trạng thái lịch hẹn thành READY_FOR_PAYMENT ===
        const appt = await Appointment.findById(resolvedAppointmentId);
        if (appt) {
            appt.status = 'READY_FOR_PAYMENT';
            appt.staffId = appt.staffId || req.user._id;
            await appt.save();
        }

        // === Tự động tạo Lịch hẹn Tái khám nếu có followUpDate ===
        if (followUpDate) {
            console.log(`[FOLLOW_UP_LOG] Đang tạo lịch tái khám cho ngày: ${followUpDate}`);
            try {
                const currentAppt = await Appointment.findById(resolvedAppointmentId);
                const finalCustomerId = customerId || currentAppt?.customerId;
                const finalPetId = petId || currentAppt?.petId;

                if (finalCustomerId && finalPetId) {
                    const newFollowUp = await Appointment.create({
                        customerId: finalCustomerId,
                        petId: finalPetId,
                        // Bỏ staffId theo yêu cầu: không cần ghi nhân viên phụ trách mặc định
                        type: 'MEDICAL',
                        category: 'FOLLOW_UP',
                        bookingSource: 'DOCTOR',
                        createdByStaffId: req.user._id,
                        date: followUpDate,
                        timeSlot: '08:00', // Giờ mặc định
                        status: 'BOOKED',
                        customerNotes: `Lịch tái khám tự động từ Bệnh án ngày ${new Date().toLocaleDateString('vi-VN')}`
                    });
                    console.log(`[FOLLOW_UP_LOG] Tạo thành công lịch hẹn ID: ${newFollowUp._id}`);
                } else {
                    console.warn('[FOLLOW_UP_LOG] Thiếu customerId hoặc petId để tạo lịch tái khám');
                }
            } catch (followUpErr) {
                console.error('[FOLLOW_UP_LOG] Lỗi khi tạo lịch tái khám:', followUpErr.message);
            }
        }

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_MEDICAL_RECORD',
            description: `Tạo bệnh án${!appointmentId ? ' (Walk-in)' : ''}: Chẩn đoán — ${diagnosis || 'Chưa có'}${followUpDate ? ` | Có hẹn tái khám: ${new Date(followUpDate).toLocaleDateString('vi-VN')}` : ''}`,
            targetModel: 'MedicalRecord', targetId: record._id,
            metadata: { petId, diagnosis, followUpDate, prescriptionCount: prescriptions?.length || 0 },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: record });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy toàn bộ lịch sử khám của 1 Thú cưng
// @route   GET /api/v1/medical-records/pet/:petId
// @access  Private
const getPetMedicalHistory = async (req, res) => {
    try {
        const records = await MedicalRecord.find({ petId: req.params.petId })
            .populate('doctorId', 'fullName')
            .populate('appointmentId', 'date')
            .populate({
                path: 'prescriptions.medicineId',
                populate: { path: 'productId', select: 'name' }
            })
            .populate('services.serviceId')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: records.length, data: records });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy tất cả bệnh án (Admin/Manager xem tổng quan)
// @route   GET /api/v1/medical-records
// @access  Private
const getMedicalRecords = async (req, res) => {
    try {
        let dbQuery = {};
        const { appointmentId, petId, _id } = req.query;
        
        const searchFields = ['appointmentId', 'petId', '_id'];
        const providedParams = searchFields.filter(f => req.query[f] !== undefined);
        
        if (providedParams.length > 0) {
            const handleCommaIds = (val) => {
                if (!val || val === 'undefined' || val === 'null' || val.trim() === '') return null;
                if (val.includes(',')) return { $in: val.split(',').map(id => id.trim()).filter(Boolean) };
                return val;
            };

            const aid = handleCommaIds(appointmentId);
            if (aid) dbQuery.appointmentId = aid;

            const pid = handleCommaIds(petId);
            if (pid) dbQuery.petId = pid;

            const rid = handleCommaIds(_id);
            if (rid) dbQuery._id = rid;

            if (Object.keys(dbQuery).length === 0) {
                return res.status(200).json({ success: true, count: 0, data: [] });
            }
        }

        const records = await MedicalRecord.find(dbQuery)
            .populate('petId', 'name species breed')
            .populate('doctorId', 'fullName')
            .populate('appointmentId', 'date customerId')
            .populate({
                path: 'prescriptions.medicineId',
                populate: { path: 'productId', select: 'name' }
            })
            .populate('services.serviceId')
            .sort({ createdAt: -1 })
            .limit(100);

        res.status(200).json({ success: true, count: records.length, data: records });
    } catch (error) {
        console.error('[MED_REC_ERROR]', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createMedicalRecord,
    getPetMedicalHistory,
    getMedicalRecords
};
