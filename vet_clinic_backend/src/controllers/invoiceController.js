const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const Medicine = require('../models/Medicine');
const InventoryTransaction = require('../models/InventoryTransaction');
const GroomingOrder = require('../models/GroomingOrder');
const Vaccination = require('../models/Vaccination');
const logActivity = require('../utils/logActivity');

// @desc    Tạo hóa đơn (Hỗ trợ 3 loại: APPOINTMENT / WALKIN / RETAIL)
// @route   POST /api/v1/invoices
// @access  Private (Receptionist, Doctor, Manager, Admin)
// @desc    Tạo hóa đơn (Hỗ trợ: APPOINTMENT / WALKIN / RETAIL / GROOMING / VACCINATION)
// @route   POST /api/v1/invoices
// @access  Private (Receptionist, Doctor, Manager, Admin)
const createInvoice = async (req, res) => {
    try {
        let {
            appointmentId, medicalRecordId, groomingOrderId, vaccinationId, invoiceType,
            customerId,
            retailItems,
            discountCode, discountAmount, pointsUsed, paymentMethod, notes
        } = req.body;

        let serviceTotal = 0;
        let medicineTotal = 0;
        let retailTotal = 0;
        let depositAmount = 0;
        let resolvedInvoiceType = invoiceType || 'APPOINTMENT';
        let medicalRecordForDeduction = null;

        const allServicesRaw = [];
        const allPrescriptionsRaw = [];

        // ====== LUỒNG 1: TỪ LỊCH HẸN (Có appointmentId) ======
        if (appointmentId) {
            resolvedInvoiceType = 'APPOINTMENT';
            const appointment = await Appointment.findById(appointmentId);
            if (appointment) {
                depositAmount = appointment.depositAmount || 0;
                
                const record = await MedicalRecord.findOne({ appointmentId });
                medicalRecordForDeduction = record;
                if (record) {
                    medicalRecordId = record._id;
                    if (record.prescriptions?.length > 0) allPrescriptionsRaw.push(...record.prescriptions);
                    if (record.services?.length > 0) allServicesRaw.push(...record.services);
                    
                    const linkedGrooming = await GroomingOrder.findOne({ medicalRecordId: record._id });
                    if (linkedGrooming) {
                        groomingOrderId = linkedGrooming._id;
                        if (linkedGrooming.services?.length > 0) allServicesRaw.push(...linkedGrooming.services);
                        linkedGrooming.isPaid = true;
                        await linkedGrooming.save();
                    }
                }

                // Gộp Vaccination vào Appointment để tính tiền chung (Tránh 2 hóa đơn)
                const linkedVaccination = await Vaccination.findOne({ appointmentId: appointment._id, status: 'PENDING' });
                if (linkedVaccination) {
                    vaccinationId = linkedVaccination._id;
                }

                appointment.status = 'COMPLETED';
                await appointment.save();
            }
        }
        // ====== LUỒNG 2: KHÁM WALK-IN (Có medicalRecordId) ======
        else if (medicalRecordId) {
            resolvedInvoiceType = 'WALKIN';
            const record = await MedicalRecord.findById(medicalRecordId);
            medicalRecordForDeduction = record;
            if (record) {
                if (record.prescriptions?.length > 0) allPrescriptionsRaw.push(...record.prescriptions);
                if (record.services?.length > 0) allServicesRaw.push(...record.services);
                
                if (record.appointmentId) {
                    const apt = await Appointment.findById(record.appointmentId).populate('serviceId');
                    if (apt) {
                        if (apt.serviceId) allServicesRaw.push({ name: apt.serviceId.name, price: apt.serviceId.price || 0 });
                        depositAmount = apt.depositAmount || 0;
                        apt.status = 'COMPLETED';
                        await apt.save();
                    }
                }
                const linkedGrooming = await GroomingOrder.findOne({ medicalRecordId: record._id });
                if (linkedGrooming) {
                    groomingOrderId = linkedGrooming._id;
                    if (linkedGrooming.services?.length > 0) allServicesRaw.push(...linkedGrooming.services);
                    linkedGrooming.isPaid = true;
                    await linkedGrooming.save();
                }
            }
        }
        // ====== LUỒNG 3: ĐƠN GROOMING TRỰC TIẾP ======
        else if (groomingOrderId) {
            resolvedInvoiceType = 'GROOMING';
            const order = await GroomingOrder.findById(groomingOrderId);
            if (order) {
                // Đọc global services
                if (order.services?.length > 0) allServicesRaw.push(...order.services);
                // BUG FIX: Đọc per-pet services (auto-created orders lưu services tại đây)
                order.pets?.forEach(p => {
                    if (p.services?.length > 0) allServicesRaw.push(...p.services);
                });

                if (order.medicalRecordId) {
                    const record = await MedicalRecord.findById(order.medicalRecordId);
                    medicalRecordForDeduction = record;
                    if (record) {
                        medicalRecordId = record._id;
                        if (record.prescriptions?.length > 0) allPrescriptionsRaw.push(...record.prescriptions);
                        if (record.services?.length > 0) allServicesRaw.push(...record.services);
                        if (record.appointmentId) {
                            const apt = await Appointment.findById(record.appointmentId);
                            if (apt) {
                                depositAmount = apt.depositAmount || 0;
                                apt.status = 'COMPLETED';
                                await apt.save();
                            }
                        }
                    }
                }
                // BUG FIX: Hoàn tất Appointment được liên kết qua appointmentId
                if (order.appointmentId) {
                    const apt = await Appointment.findById(order.appointmentId);
                    if (apt && apt.status !== 'COMPLETED') {
                        depositAmount = apt.depositAmount || 0;
                        apt.status = 'COMPLETED';
                        await apt.save();
                    }
                }
                order.isPaid = true;
                await order.save();
            }
        }

        // --- Xử lý Lọc Trùng & Tính Tổng Dịch vụ ---
        const svcMap = new Map();
        allServicesRaw.forEach(s => {
            const name = s.name || s.serviceId?.name;
            const price = s.price !== undefined ? s.price : (s.serviceId?.price || 0);
            if (name) {
                if (!svcMap.has(name) || (price > 0 && svcMap.get(name).price === 0)) {
                    svcMap.set(name, { name, price });
                }
            }
        });
        serviceTotal = Array.from(svcMap.values()).reduce((sum, s) => sum + s.price, 0);

        // FIX: Đơn grooming trực tiếp multi-pet bị tính thấp do dedup theo tên dịch vụ.
        // Lấy thẳng từ order.totalAmount (đã tính * số lượng thú cưng) để đảm bảo chính xác.
        if (resolvedInvoiceType === 'GROOMING' && groomingOrderId && !appointmentId && !medicalRecordId) {
            const _grOrder = await GroomingOrder.findById(groomingOrderId);
            if (_grOrder && _grOrder.totalAmount > 0) {
                serviceTotal = _grOrder.totalAmount;
            }
        }

        // --- Tính Tổng Thuốc từ prescriptions ---
        for (const item of allPrescriptionsRaw) {
            const medicine = await Medicine.findById(item.medicineId);
            if (medicine) medicineTotal += (medicine.retailPrice * item.quantity);
        }

        // ====== LUỒNG 4: TIÊM PHÒNG ======
        if (vaccinationId) {
            if (resolvedInvoiceType !== 'APPOINTMENT' && resolvedInvoiceType !== 'WALKIN' && resolvedInvoiceType !== 'GROOMING') {
                resolvedInvoiceType = 'VACCINATION';
            }
            const vaccination = await Vaccination.findById(vaccinationId);
            if (!vaccination) return res.status(404).json({ success: false, message: 'Bản ghi tiêm phòng không tồn tại' });

            medicineTotal += (vaccination.price || 0);

            // Nếu tiêm phòng từ lịch hẹn → hoàn tất appointment
            if (vaccination.appointmentId) {
                const apt = await Appointment.findById(vaccination.appointmentId);
                if (apt) {
                    apt.status = 'COMPLETED';
                    await apt.save();
                }
            } else {
                // Fallback: tìm lịch hẹn gần nhất có thể liên quan (theo petId + trạng thái chưa hoàn tất)
                const pendingApt = await Appointment.findOne({
                    petId: vaccination.petId,
                    status: { $in: ['ARRIVED', 'IN_PROGRESS', 'READY_FOR_PAYMENT'] },
                    category: 'VACCINATION'
                }).sort({ date: -1 });
                if (pendingApt) {
                    pendingApt.status = 'COMPLETED';
                    await pendingApt.save();
                }
            }

            vaccination.status = 'PAID';
            await vaccination.save();

            if (vaccination.medicineId) {
                const medicine = await Medicine.findById(vaccination.medicineId);
                if (medicine) {
                    medicine.stockQuantity -= 1;
                    await medicine.save();
                    await InventoryTransaction.create({
                        medicineId: medicine._id, productId: medicine.productId,
                        transactionType: 'USAGE', quantity: 1,
                        notes: `Trừ kho tiêm phòng: ${vaccination.vaccineName}`,
                        createdBy: req.user._id
                    });
                }
            }
        }

        // ====== LUỒNG 5: BÁN LẺ (Có retailItems) - CHẾ ĐỘ CỘNG DỒN ======
        if (retailItems && retailItems.length > 0) {
            // Nếu chưa có type từ các luồng trên thì mới là RETAIL thuần túy
            if (resolvedInvoiceType === 'APPOINTMENT' && !appointmentId && !medicalRecordId && !groomingOrderId && !vaccinationId) {
                resolvedInvoiceType = 'RETAIL';
            }
            
            for (let item of retailItems) {
                const medicine = await Medicine.findById(item.medicineId).populate('productId');
                if (!medicine) continue; 
                
                if (medicine.stockQuantity < item.quantity) {
                    // Có thể báo lỗi hoặc skip, ở đây ta ưu tiên báo lỗi để đảm bảo tính nhất quán
                    return res.status(400).json({ success: false, message: `${medicine.productId?.name || 'Sản phẩm'} đã hết hàng` });
                }

                const sub = (medicine.retailPrice || 0) * (item.quantity || 0);
                item.unitPrice = medicine.retailPrice;
                item.subtotal = sub;
                // QUAN TRỌNG: Gán tên sản phẩm để lưu vào lịch sử hóa đơn
                item.productName = medicine.productId?.name || medicine.name || 'Sản phẩm';
                
                retailTotal += sub;

                // Trừ kho
                medicine.stockQuantity -= item.quantity;
                await medicine.save();

                await InventoryTransaction.create({
                    medicineId: medicine._id, 
                    productId: medicine.productId?._id || medicine.productId,
                    transactionType: 'USAGE', quantity: item.quantity,
                    notes: `Bán lẻ ${resolvedInvoiceType !== 'RETAIL' ? 'kèm dịch vụ' : 'trực tiếp'}`, 
                    createdBy: req.user._id
                });
            }
        }

        // Kiểm tra tính hợp lệ cuối cùng
        if (serviceTotal === 0 && medicineTotal === 0 && retailTotal === 0) {
            return res.status(400).json({ success: false, message: 'Hóa đơn không có bất kỳ khoản thu nào (Dịch vụ/Thuốc/Bán lẻ).' });
        }

        // === Tính tổng & Điểm thưởng ===
        let rawTotal = serviceTotal + medicineTotal + retailTotal - depositAmount - (discountAmount || 0);
        if (rawTotal < 0) rawTotal = 0;

        let pointsDiscountAmount = 0;
        let actualPointsUsed = 0;
        if (pointsUsed && pointsUsed > 0 && customerId && rawTotal > 0) {
            const profile = await require('../models/CustomerProfile').findOne({ userId: customerId });
            if (profile) {
                actualPointsUsed = Math.min(pointsUsed, profile.rewardPoints || 0);
                const maxUsable = Math.floor(rawTotal / 1000);
                if (actualPointsUsed > maxUsable) actualPointsUsed = maxUsable;
                pointsDiscountAmount = actualPointsUsed * 1000;
            }
        }
        const finalTotal = Math.max(0, rawTotal - pointsDiscountAmount);

        if (finalTotal <= 0 && resolvedInvoiceType !== 'RETAIL') {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể xuất hóa đơn 0đ. Vui lòng kiểm tra lại dịch vụ hoặc đơn thuốc trong hồ sơ này.' 
            });
        }
        
        // === Cập nhật điểm thưởng (Trừ điểm dùng & Tích điểm mới) ===
        if (customerId) {
            const CustomerProfile = require('../models/CustomerProfile');
            const profile = await CustomerProfile.findOne({ userId: customerId });
            const earnedPoints = Math.floor(finalTotal / 1000);

            if (profile) {
                if (actualPointsUsed > 0) profile.rewardPoints -= actualPointsUsed;
                profile.rewardPoints = (profile.rewardPoints || 0) + earnedPoints;
                await profile.save();
            } else {
                await CustomerProfile.create({ userId: customerId, rewardPoints: earnedPoints });
            }
        }

        // Tạo hóa đơn
        const invoice = await Invoice.create({
            appointmentId: appointmentId || undefined,
            medicalRecordId: medicalRecordId || undefined,
            groomingOrderId: groomingOrderId || undefined,
            vaccinationId: vaccinationId || undefined,
            invoiceType: resolvedInvoiceType,
            customerId, receptionistId: req.user._id,
            serviceTotal, medicineTotal, retailTotal,
            retailItems: retailItems || [],
            depositAmount, discountAmount: discountAmount || 0,
            pointsUsed: actualPointsUsed, finalTotal,
            paymentMethod: paymentMethod || 'CASH', status: 'PAID', notes
        });

        // Trừ kho thuốc trong bệnh án (nếu có)
        if (medicalRecordForDeduction && medicalRecordForDeduction.prescriptions.length > 0) {
            for (let item of medicalRecordForDeduction.prescriptions) {
                // Sử dụng medicineName có sẵn trong item của record nếu có, nếu không tìm từ DB
                const med = await Medicine.findById(item.medicineId);
                if (med) {
                    med.stockQuantity -= item.quantity;
                    await med.save();
                    await InventoryTransaction.create({
                        medicineId: med._id, productId: med.productId,
                        transactionType: 'USAGE', quantity: item.quantity,
                        referenceId: invoice._id, 
                        notes: `Trừ kho bệnh án (Invoice: #${invoice._id.toString().slice(-6).toUpperCase()})`,
                        createdBy: req.user._id
                    });
                }
            }
        }

        // Trả về dữ liệu chi tiết
        const pop = await Invoice.findById(invoice._id)
            .populate('customerId', 'fullName phoneNumber')
            .populate('receptionistId', 'fullName')
            .populate({ 
                path: 'appointmentId', 
                options: { strictPopulate: false },
                populate: [
                    { path: 'petId', select: 'name species', options: { strictPopulate: false } }, 
                    { path: 'serviceId', select: 'name price', options: { strictPopulate: false } },
                    { path: 'staffId', select: 'fullName', options: { strictPopulate: false } }
                ] 
            })
            .populate({ 
                path: 'medicalRecordId', 
                options: { strictPopulate: false },
                populate: [
                    { path: 'petId', select: 'name species', options: { strictPopulate: false } },
                    { path: 'doctorId', select: 'fullName', options: { strictPopulate: false } },
                    { 
                        path: 'prescriptions.medicineId', 
                        options: { strictPopulate: false },
                        populate: { path: 'productId', select: 'name' }
                    },
                    { path: 'services.serviceId', options: { strictPopulate: false } }
                ] 
            })
            .populate({ 
                path: 'vaccinationId', 
                options: { strictPopulate: false },
                populate: [
                    { path: 'doctorId', select: 'fullName', options: { strictPopulate: false } },
                    { path: 'medicineId', select: 'name', options: { strictPopulate: false }, populate: { path: 'productId', select: 'name' } }
                ]
            })
            .populate({
                path: 'groomingOrderId',
                options: { strictPopulate: false },
                populate: { path: 'services.serviceId', options: { strictPopulate: false } }
            })
            .populate({
                path: 'retailItems.medicineId',
                options: { strictPopulate: false },
                populate: { path: 'productId', select: 'name' }
            });

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_INVOICE',
            description: `[THU TIỀN] Xuất hóa đơn ${resolvedInvoiceType} cho ${pop.customerId?.fullName || 'Khách vãng lai'} - Số tiền: ${finalTotal.toLocaleString('vi-VN')}đ - HTTT: ${paymentMethod || 'Tiền mặt'}`,
            targetModel: 'Invoice', targetId: invoice._id,
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: pop });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy danh sách Hóa đơn
// @route   GET /api/v1/invoices
// @access  Private
const getInvoices = async (req, res) => {
    try {
        let query = {};

        if (req.user.role === 'CUSTOMER') {
            query.customerId = req.user._id;
        }

        // GROOMER chỉ xem hóa đơn của đơn grooming mà họ phụ trách
        if (req.user.role === 'GROOMER') {
            const myOrders = await GroomingOrder.find({ staffId: req.user._id }).select('_id');
            const orderIds = myOrders.map(o => o._id);
            query.groomingOrderId = { $in: orderIds };
        }

        // Lọc theo loại hóa đơn
        if (req.query.invoiceType) {
            query.invoiceType = req.query.invoiceType;
        }
        if (req.query._id) {
            query._id = req.query._id;
        }

        const invoices = await Invoice.find(query)
            .populate({
                path: 'customerId',
                select: 'fullName phoneNumber',
                options: { strictPopulate: false }
            })
            .populate({
                path: 'appointmentId',
                options: { strictPopulate: false },
                populate: [
                    { path: 'petId', select: 'name species', options: { strictPopulate: false } },
                    { path: 'staffId', select: 'fullName', options: { strictPopulate: false } },
                    { path: 'serviceId', select: 'name price', options: { strictPopulate: false } }
                ]
            })
            .populate({
                path: 'medicalRecordId',
                options: { strictPopulate: false },
                populate: [
                    { path: 'doctorId', select: 'fullName', options: { strictPopulate: false } },
                    { path: 'petId', select: 'name species', options: { strictPopulate: false } },
                    { 
                        path: 'prescriptions.medicineId', 
                        options: { strictPopulate: false },
                        populate: { path: 'productId', select: 'name' }
                    },
                    { path: 'services.serviceId', options: { strictPopulate: false } }
                ]
            })
            .populate({ 
                path: 'vaccinationId', 
                options: { strictPopulate: false },
                populate: [
                    { path: 'doctorId', select: 'fullName', options: { strictPopulate: false } },
                    { path: 'medicineId', select: 'name', options: { strictPopulate: false }, populate: { path: 'productId', select: 'name' } }
                ]
            })
            .populate({
                path: 'retailItems.medicineId',
                options: { strictPopulate: false },
                populate: { path: 'productId', select: 'name' }
            })
            .populate({ 
                path: 'groomingOrderId', 
                options: { strictPopulate: false },
                populate: { path: 'services.serviceId', options: { strictPopulate: false } }
            })
            .populate({ path: 'receptionistId', select: 'fullName', options: { strictPopulate: false } })
            .sort({ createdAt: -1 });

        
        // Clean up data to be safe for frontend
        const sanitizedInvoices = invoices.map(inv => {
            try {
                const obj = inv.toObject();
                if (!obj.customerId) {
                    obj.customerId = { fullName: 'Khách vãng lai', phoneNumber: 'N/A' };
                }
                return obj;
            } catch (e) {
                return { _id: inv._id, finalTotal: 0, status: 'ERROR' };
            }
        });

        res.status(200).json({ success: true, count: sanitizedInvoices.length, data: sanitizedInvoices });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi đồng bộ dữ liệu: ' + error.message });
    }
};

module.exports = { createInvoice, getInvoices };
