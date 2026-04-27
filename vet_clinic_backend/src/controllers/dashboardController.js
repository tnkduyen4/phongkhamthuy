const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const MedicalRecord = require('../models/MedicalRecord');
const Medicine = require('../models/Medicine');
const Vaccination = require('../models/Vaccination');
const Pet = require('../models/Pet');
const Service = require('../models/Service');
const Product = require('../models/Product');

// @desc    Lấy dữ liệu thống kê tổng hợp cho Dashboard
// @route   GET /api/v1/dashboard/stats
// @access  Private (ADMIN)
exports.getDashboardStats = async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        const now = new Date();

        // Mặc định từ đầu tháng đến hiện tại nếu không chọn
        let filterStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let filterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Set the filter boundary if provided by user
        if (startDate && startDate !== 'null') filterStart = new Date(startDate);
        if (endDate && endDate !== 'null') {
            filterEnd = new Date(endDate);
            filterEnd.setHours(23, 59, 59, 999);
        }

        const dateFilter = { createdAt: { $gte: filterStart, $lte: filterEnd } };
        const appointmentFilter = { date: { $gte: filterStart, $lte: filterEnd } };
        const invoiceFilter = { status: 'PAID', ...dateFilter };
        const inpatientFilter = { status: 'IN_PROGRESS' };

        const upcomingFilter = {
            date: { $gte: now },
            status: { $in: ['BOOKED', 'ARRIVED', 'ASSIGNED'] }
        };

        const vacLimit = new Date();
        vacLimit.setDate(vacLimit.getDate() + 7);

        // --- BATCH FETCHING FOR PERFORMANCE (Hạn chế N+1 Query) ---
        // Sử dụng Promise.all để chạy 8 queries độc lập cùng 1 lúc thay vì tuần tự, && sử dụng .lean() giảm tải bộ nhớ
        const [
            newCustomersList,
            appointmentsList,
            periodInvoices,
            inpatientPetsList,
            upcomingAppointments,
            lowStockMedicinesRaw,
            recentAppointments,
            upcomingVaccinations
        ] = await Promise.all([
            // 1. Khách mới trong kỳ
            User.find({ role: 'CUSTOMER', ...dateFilter })
                .select('fullName phoneNumber email createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            
            // 2. Lịch hẹn (Ca Khám)
            Appointment.find(appointmentFilter)
                .populate('customerId', 'fullName phoneNumber')
                .populate('petId', 'name species')
                .populate('serviceId', 'name type')
                .sort({ date: 1 })
                .lean(),
            
            // 3. Toàn bộ hóa đơn thanh toán
            Invoice.find(invoiceFilter)
                .populate('customerId', 'fullName phoneNumber')
                .populate('appointmentId', 'date serviceId status')
                .lean(),
                
            // 4. Thú cưng nội trú
            Appointment.find(inpatientFilter)
                .populate('customerId', 'fullName phoneNumber')
                .populate('petId', 'name species weight')
                .lean(),
                
            // 5. Lịch khám sắp tới (Upcoming Appointments)
            Appointment.find(upcomingFilter)
                .sort({ date: 1, timeSlot: 1 })
                .limit(8)
                .populate('customerId', 'fullName')
                .populate('petId', 'name')
                .populate('serviceId', 'name')
                .lean(),
                
            // 6. Cảnh Báo Tồn Kho
            Medicine.find({ stockQuantity: { $lt: 5 } })
                .sort({ stockQuantity: 1 })
                .populate('productId', 'name unit category')
                .lean(),
                
            // 7. Gần đây
            Appointment.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('customerId', 'fullName')
                .populate('petId', 'name type')
                .populate('serviceId', 'name')
                .lean(),
                
            // 8. Lịch tiêm sắp tới
            Vaccination.find({ nextDueDate: { $gte: new Date(), $lte: vacLimit } })
                .limit(5)
                .populate('petId', 'name ownerId')
                .populate({
                    path: 'petId',
                    populate: { path: 'ownerId', select: 'fullName phoneNumber' }
                })
                .sort({ nextDueDate: 1 })
                .lean()
        ]);

        const newCustomers = newCustomersList.length;
        const todayAppointmentsCount = appointmentsList.length;
        const inpatientPets = inpatientPetsList.length;

        let periodRevenue = 0;
        let clinicProfit = 0;
        const inventoryProfitDetails = [];

        // --- OPTIMIZATION: BATCH FETCH MEDICAL RECORDS AND MEDICINES ---
        // Lấy danh sách ID của cuộc hẹn thuộc hóa đơn để query bảng MedicalRecord 1 lần duy nhất!
        const invoiceApptIds = periodInvoices
            .filter(inv => inv.medicineTotal > 0 && inv.appointmentId)
            .map(inv => inv.appointmentId._id || inv.appointmentId);

        const relatedRecords = await MedicalRecord.find({ appointmentId: { $in: invoiceApptIds } }).lean();
        const recordMap = {};
        const medicineIdsSet = new Set();
        
        relatedRecords.forEach(record => {
            recordMap[record.appointmentId.toString()] = record;
            if (record.prescriptions && Array.isArray(record.prescriptions)) {
                record.prescriptions.forEach(p => {
                     if (p.medicineId) medicineIdsSet.add(p.medicineId.toString());
                });
            }
        });

        // Chỉ query Medicine duy nhất 1 lần để lấy data của tất cả các loại thuốc cần thiết
        const relatedMedicines = await Medicine.find({ _id: { $in: Array.from(medicineIdsSet) } }).lean();
        const medicineMap = {};
        relatedMedicines.forEach(med => {
            medicineMap[med._id.toString()] = med;
        });

        // Logic tính toán đồng bộ hoàn toàn trên RAM
        for (const invoice of periodInvoices) {
            periodRevenue += (invoice.finalTotal || 0);
            clinicProfit += (invoice.serviceTotal || 0);

            if (invoice.medicineTotal > 0) {
                let invoiceMedicineCost = 0;
                let medicineDetails = [];

                const recordIdString = invoice.appointmentId ? (invoice.appointmentId._id?.toString() || invoice.appointmentId.toString()) : null;
                const record = recordIdString ? recordMap[recordIdString] : null;
                
                if (record && record.prescriptions) {
                    for (const item of record.prescriptions) {
                        const med = medicineMap[item.medicineId?.toString()];
                        if (med) {
                            const cost = med.importPrice * item.quantity;
                            invoiceMedicineCost += cost;
                            medicineDetails.push({
                                name: med.name,
                                quantity: item.quantity,
                                importPrice: med.importPrice,
                                cost: cost
                            });
                        }
                    }
                }

                inventoryProfitDetails.push({
                    invoiceId: invoice._id,
                    createdAt: invoice.createdAt,
                    customerName: invoice.customerId?.fullName || 'Khách vãng lai',
                    medicineRevenue: invoice.medicineTotal,
                    medicineCost: invoiceMedicineCost,
                    profit: invoice.medicineTotal - invoiceMedicineCost,
                    medicines: medicineDetails
                });
            }
        }
        
        let inventoryProfit = inventoryProfitDetails.reduce((sum, item) => sum + item.profit, 0);

        // 5. Biểu đồ doanh thu theo từng ngày TRONG KỲ
        const chartDataMap = {};
        const diffTime = Math.abs(filterEnd - filterStart);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 31) {
            for (let d = new Date(filterStart); d <= filterEnd; d.setDate(d.getDate() + 1)) {
                const dateKey = `${d.getDate()}/${d.getMonth() + 1}`;
                chartDataMap[dateKey] = 0;
            }
            periodInvoices.forEach(inv => {
                const d = new Date(inv.createdAt);
                const dateKey = `${d.getDate()}/${d.getMonth() + 1}`;
                if (chartDataMap[dateKey] !== undefined) {
                    chartDataMap[dateKey] += inv.finalTotal;
                }
            });
        }

        const chartData = Object.keys(chartDataMap).map(key => ({
            name: key,
            uv: chartDataMap[key]
        }));

        // 7. Top Khách Hàng VIP
        const customerSpentMap = {};
        periodInvoices.forEach(inv => {
            const cid = inv.customerId?._id?.toString();
            if (cid) {
                if (!customerSpentMap[cid]) {
                    customerSpentMap[cid] = {
                        customerId: inv.customerId._id,
                        fullName: inv.customerId.fullName,
                        phoneNumber: inv.customerId.phoneNumber,
                        totalSpent: 0,
                        visitCount: 0
                    };
                }
                customerSpentMap[cid].totalSpent += inv.finalTotal;
                customerSpentMap[cid].visitCount += 1;
            }
        });
        const topCustomers = Object.values(customerSpentMap)
            .sort((a, b) => b.totalSpent - a.totalSpent);

        // 8. Hiệu Suất Nhân Viên
        const staffRevenueMap = {};
        periodInvoices.forEach(inv => {
            const sid = inv.receptionistId?.toString();
            if (sid) {
                if (!staffRevenueMap[sid]) {
                    staffRevenueMap[sid] = {
                        staffId: sid,
                        totalRevenue: 0,
                        invoiceCount: 0
                    };
                }
                staffRevenueMap[sid].totalRevenue += inv.finalTotal;
                staffRevenueMap[sid].invoiceCount += 1;
            }
        });

        const topStaffIds = Object.keys(staffRevenueMap);
        const staffsInfo = await User.find({ _id: { $in: topStaffIds } }).select('fullName role').lean();
        
        const staffMap = {};
        staffsInfo.forEach(s => staffMap[s._id.toString()] = s);

        const staffPerformance = Object.values(staffRevenueMap)
            .map(item => ({
                ...item,
                fullName: staffMap[item.staffId]?.fullName || 'Unknown',
                role: staffMap[item.staffId]?.role || 'N/A'
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);

        // 9. Cảnh Báo Tồn Kho định dạng
        const lowStockMedicines = lowStockMedicinesRaw.map(m => ({
            _id: m._id,
            name: m.productId?.name || 'Vô danh',
            unit: m.productId?.unit || '',
            category: m.productId?.category || 'MEDICINE',
            stockQuantity: m.stockQuantity
        }));

        res.status(200).json({
            success: true,
            data: {
                metrics: {
                    newCustomers,
                    newCustomersList,
                    todayAppointments: todayAppointmentsCount,
                    appointmentsList,
                    periodRevenue,
                    periodInvoicesList: periodInvoices,
                    clinicProfit,
                    inventoryProfit,
                    inventoryProfitDetails,
                    inpatientPets,
                    inpatientPetsList
                },
                chartData,
                recentAppointments,
                advanced: {
                    upcomingAppointments,
                    topCustomers,
                    staffPerformance,
                    lowStockMedicines,
                    upcomingVaccinations
                },
                dateRange: {
                    startDate: filterStart,
                    endDate: filterEnd
                }
            }
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tính toán thống kê.' });
    }
};
