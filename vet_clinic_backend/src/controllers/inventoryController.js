const Medicine = require('../models/Medicine');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');
const MedicineBatch = require('../models/MedicineBatch');
const Notification = require('../models/Notification');
const logActivity = require('../utils/logActivity');

// ── Helper: Gửi thông báo ADMIN khi tồn kho dưới mức tối thiểu ──────────────
const notifyLowStock = async (medicine, productName) => {
    try {
        const stock = medicine.stockQuantity;
        const min   = medicine.minimumStock || 5;
        if (stock >= min) return; // Đủ hàng → không cần thông báo

        const todayStr = new Date().toISOString().slice(0, 10);
        const key = `low_stock_${medicine._id}_${todayStr}`;
        const exists = await Notification.findOne({ 'metadata.notifKey': key });
        if (exists) return; // Đã thông báo hôm nay rồi

        const isOut = stock === 0;
        await Notification.create({
            role: 'ADMIN', // Gửi cho toàn bộ ADMIN
            title: isOut ? `🚨 Hết hàng: ${productName}` : `⚠️ Sắp hết: ${productName}`,
            message: isOut
                ? `Thuốc/vật tư "${productName}" đã hết hàng (Tồn kho: 0). Cần nhập hàng ngay.`
                : `Thuốc/vật tư "${productName}" sắp hết (Tồn: ${stock}/${min} tối thiểu). Vui lòng đặt hàng.`,
            type: isOut ? 'EMERGENCY' : 'WARNING',
            link: '/inventory',
            metadata: {
                notifKey: key,
                medicineId: medicine._id.toString(),
                stockQuantity: String(stock),
                minimumStock: String(min)
            }
        });
        console.log(`[LOW STOCK ALERT] ${productName}: ${stock}/${min}`);
    } catch (e) {
        console.error('[notifyLowStock]', e.message);
    }
};


// @desc    Admin/Manager tạo Thuốc/Vật tư mới
// @route   POST /api/v1/inventory/medicines
// @access  Private (Chỉ Admin, Manager)
const createMedicine = async (req, res) => {
    try {
        let { productId, name, category, unit, description, importPrice, retailPrice, stockQuantity, minimumStock, expiryDate, isActive } = req.body;

        if (!productId && name) {
            let product = await Product.findOne({ name: name.trim() });
            if (!product) {
                product = await Product.create({
                    name: name.trim(),
                    category: category || 'MEDICINE',
                    unit: unit || 'Lọ',
                    description: description || ''
                });
            }
            productId = product._id;
        }

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn hoặc nhập mã Danh mục sản phẩm (Product ID).' });
        }

        let medicineData = {
            productId, importPrice, retailPrice, stockQuantity, minimumStock, expiryDate, isActive
        };

        const existingMedicine = await Medicine.findOne({ productId: productId });
        if (existingMedicine) {
            return res.status(400).json({ success: false, message: 'Danh mục này đã có trong kho. Vui lòng cập nhật số lượng thay vì tạo mới.' });
        }

        const medicine = await Medicine.create(medicineData);

        if (medicine.stockQuantity > 0) {
            await InventoryTransaction.create({
                medicineId: medicine._id,
                productId: medicine.productId,
                transactionType: 'IMPORT',
                quantity: medicine.stockQuantity,
                notes: 'Nhập mới từ form',
                createdBy: req.user._id
            });
        }

        const populatedMedicine = await Medicine.findById(medicine._id).populate('productId');

        await logActivity({
            userId: req.user._id,
            action: 'CREATE_MEDICINE',
            description: `Nhập kho thuốc mới: ${populatedMedicine.productId?.name || 'Không tên'} (SL: ${stockQuantity || 0})`,
            targetModel: 'Medicine', targetId: medicine._id,
            metadata: { name: populatedMedicine.productId?.name, stockQuantity, importPrice, retailPrice },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: populatedMedicine });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
    }
};

// @desc    Lấy danh sách thuốc hiện có
// @route   GET /api/v1/inventory/medicines
// @access  Private
const getMedicines = async (req, res) => {
    try {
        let query = {};
        if (!req.query.includeInactive) {
            query.isActive = { $ne: false };
        }

        let productFilter = {};
        let hasProductFilter = false;

        if (req.query.category) {
            productFilter.category = req.query.category;
            hasProductFilter = true;
        }
        if (req.query.search) {
            productFilter.name = { $regex: req.query.search, $options: 'i' };
            hasProductFilter = true;
        }

        if (hasProductFilter) {
            const products = await Product.find(productFilter).select('_id');
            const productIds = products.map(p => p._id);
            query.productId = { $in: productIds };
        }

        const medicines = await Medicine.find(query)
            .populate('productId', 'name category unit description');

        medicines.sort((a, b) => {
            const nameA = a.productId ? a.productId.name.toLowerCase() : '';
            const nameB = b.productId ? b.productId.name.toLowerCase() : '';
            return nameA.localeCompare(nameB);
        });

        const formattedData = medicines.map(m => ({
            _id: m._id,
            productId: m.productId?._id,
            name: m.productId?.name || 'Vô danh',
            category: m.productId?.category || 'MEDICINE',
            unit: m.productId?.unit || 'Lọ',
            description: m.productId?.description || '',
            importPrice: m.importPrice,
            retailPrice: m.retailPrice,
            stockQuantity: m.stockQuantity,
            minimumStock: m.minimumStock,
            expiryDate: m.expiryDate,
            isActive: m.isActive,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt
        }));

        res.status(200).json({ success: true, count: formattedData.length, data: formattedData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Import danh sách thuốc/vật tư từ Array JSON
// @route   POST /api/v1/inventory/medicines/bulk
// @access  Private (Chỉ Admin, Manager)
const bulkCreateMedicines = async (req, res) => {
    try {
        const { medicines } = req.body;
        if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ hoặc trống.' });
        }

        let addedCount = 0;
        let errors = [];

        for (const item of medicines) {
            try {
                let productId = item.productId;
                if (!productId && item.name) {
                    let product = await Product.findOne({ name: item.name.trim() });
                    if (!product) {
                        product = await Product.create({
                            name: item.name.trim(),
                            category: item.category || 'MEDICINE',
                            unit: item.unit || 'Lọ',
                            description: item.description || ''
                        });
                    }
                    productId = product._id;
                }

                if (!productId) continue;

                const existing = await Medicine.findOne({ productId: productId });
                if (existing) {
                    existing.stockQuantity += (item.stockQuantity || 0);
                    if (item.importPrice) existing.importPrice = item.importPrice;
                    if (item.retailPrice) existing.retailPrice = item.retailPrice;
                    await existing.save();

                    if ((item.stockQuantity || 0) > 0) {
                        await InventoryTransaction.create({
                            medicineId: existing._id,
                            productId: productId,
                            transactionType: 'IMPORT',
                            quantity: item.stockQuantity,
                            notes: 'Nhập hàng loạt từ Excel (Cộng dồn)',
                            createdBy: req.user._id
                        });
                    }
                } else {
                    const newMed = await Medicine.create({
                        productId: productId,
                        importPrice: item.importPrice || 0,
                        retailPrice: item.retailPrice || 0,
                        stockQuantity: item.stockQuantity || 0,
                        minimumStock: item.minimumStock || 5,
                        expiryDate: item.expiryDate || null
                    });

                    if ((item.stockQuantity || 0) > 0) {
                        await InventoryTransaction.create({
                            medicineId: newMed._id,
                            productId: productId,
                            transactionType: 'IMPORT',
                            quantity: item.stockQuantity,
                            notes: 'Nhập mới từ Excel',
                            createdBy: req.user._id
                        });
                    }
                }
                addedCount++;
            } catch (err) {
                errors.push(`Lỗi dòng ${item.name}: ${err.message}`);
            }
        }

        await logActivity({
            userId: req.user._id,
            action: 'BULK_IMPORT_MEDICINES',
            description: `Nhập hàng loạt ${addedCount} sản phẩm vào kho`,
            metadata: { addedCount, errors: errors.length },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            message: `Xử lý lô hàng hoàn tất. Thành công: ${addedCount} sản phẩm.`,
            count: addedCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ lưu Batch: ' + error.message });
    }
};

// @desc    Cập nhật thông tin Thuốc/Vật tư
// @route   PUT /api/v1/inventory/medicines/:id
// @access  Private (Chỉ Admin, Manager)
const updateMedicine = async (req, res) => {
    try {
        let medicine = await Medicine.findById(req.params.id).populate('productId');
        if (!medicine) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        }

        const { importPrice, retailPrice, stockQuantity, minimumStock, expiryDate, name, category, unit, description } = req.body;

        if (req.user.role === 'ADMIN' && (name || category || unit || description)) {
            const productUpdates = {};
            if (name) productUpdates.name = name;
            if (category) productUpdates.category = category;
            if (unit) productUpdates.unit = unit;
            if (description !== undefined) productUpdates.description = description;

            await Product.findByIdAndUpdate(medicine.productId._id, productUpdates);
        }

        const inventoryUpdates = {};
        if (importPrice !== undefined) inventoryUpdates.importPrice = importPrice;
        if (retailPrice !== undefined) inventoryUpdates.retailPrice = retailPrice;
        if (stockQuantity !== undefined) inventoryUpdates.stockQuantity = stockQuantity;
        if (minimumStock !== undefined) inventoryUpdates.minimumStock = minimumStock;
        if (expiryDate !== undefined) inventoryUpdates.expiryDate = expiryDate;

        const updatedMedicine = await Medicine.findByIdAndUpdate(req.params.id, inventoryUpdates, {
            new: true,
            runValidators: true
        }).populate('productId');

        if (stockQuantity !== undefined && stockQuantity !== medicine.stockQuantity) {
            const diff = Math.abs(stockQuantity - medicine.stockQuantity);
            await InventoryTransaction.create({
                medicineId: updatedMedicine._id,
                productId: updatedMedicine.productId,
                transactionType: 'ADJUSTMENT',
                quantity: diff,
                notes: `Chỉnh sửa tồn kho bằng tay (Cũ: ${medicine.stockQuantity} -> Mới: ${stockQuantity})`,
                createdBy: req.user._id
            });
        }

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_MEDICINE',
            description: `Cập nhật thuốc: ${updatedMedicine.productId?.name || req.params.id}${stockQuantity !== undefined && stockQuantity !== medicine.stockQuantity ? ` (Tồn kho: ${medicine.stockQuantity} → ${stockQuantity})` : ''}`,
            targetModel: 'Medicine', targetId: req.params.id,
            ipAddress: req.ip
        });

        // Kiểm tra và thông báo tồn kho thấp
        if (stockQuantity !== undefined) {
            const freshMed = await Medicine.findById(req.params.id);
            await notifyLowStock(freshMed, updatedMedicine.productId?.name || 'Thuốc/Vật tư');
        }

        res.status(200).json({ success: true, data: updatedMedicine });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật: ' + error.message });
    }
};

// @desc    Xóa Thuốc/Vật tư
// @route   DELETE /api/v1/inventory/medicines/:id
// @access  Private (Chỉ Admin, Manager)
const deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm để xóa' });
        }

        const force = req.query.force === 'true';
        if (force) {
            const MedicalRecord = require('../models/MedicalRecord');
            const recCount = await MedicalRecord.countDocuments({ 'prescriptions.medicineId': medicine._id });

            if (recCount > 0) {
                return res.status(400).json({ success: false, message: 'Thuốc/Vật tư này đã được sử dụng trong bệnh án, chỉ có thể đánh dấu ngừng hoạt động.' });
            }

            await Medicine.findByIdAndDelete(medicine._id);
            // Cũng xóa các lô hàng liên quan (MedicineBatch) nếu xóa cứng
            const MedicineBatch = require('../models/MedicineBatch');
            await MedicineBatch.deleteMany({ medicineId: medicine._id });

            await logActivity({
                userId: req.user._id,
                action: 'DELETE_MEDICINE',
                description: `Xóa vĩnh viễn thuốc/vật tư thử nghiệm/rỗng khỏi kho (ID: ${req.params.id.slice(-6).toUpperCase()})`,
                targetModel: 'Medicine', targetId: req.params.id,
                ipAddress: req.ip
            });

            return res.status(200).json({ success: true, message: 'Đã xóa vĩnh viễn sản phẩm thành công' });
        }

        medicine.isActive = false;
        await medicine.save();

        await logActivity({
            userId: req.user._id,
            action: 'DEACTIVATE_MEDICINE',
            description: `Ngừng kinh doanh thuốc/vật tư khỏi kho (ID: ${req.params.id.slice(-6).toUpperCase()})`,
            targetModel: 'Medicine', targetId: req.params.id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Đã ngừng kinh doanh sản phẩm thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi xóa: ' + error.message });
    }
};

// @desc    Kiểm tra xem Thuốc/Vật tư có dữ liệu liên kết không để quyết định Xóa Hard hay Soft
// @route   GET /api/v1/inventory/medicines/:id/check-delete
// @access  Private
const checkMedicineDelete = async (req, res) => {
    try {
        const medicineId = req.params.id;
        
        const MedicalRecord = require('../models/MedicalRecord');

        const promises = [
            MedicalRecord.countDocuments({ 'prescriptions.medicineId': medicineId })
        ];

        const results = await Promise.allSettled(promises);
        
        const records = results[0].status === 'fulfilled' ? results[0].value : 0;

        const totalRelations = records;
        
        res.status(200).json({
            success: true,
            hasRelations: totalRelations > 0,
            relations: {
                records
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa hàng loạt Thuốc/Vật tư
// @route   POST /api/v1/inventory/medicines/bulk-delete
// @access  Private (Chỉ Admin, Manager)
const bulkDeleteMedicines = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có danh sách ID hợp lệ để xóa' });
        }

        const result = await Medicine.updateMany({ _id: { $in: ids } }, { isActive: false });

        await logActivity({
            userId: req.user._id,
            action: 'BULK_DELETE_MEDICINES',
            description: `Xóa hàng loạt ${result.modifiedCount} thuốc/vật tư khỏi kho`,
            metadata: { count: result.modifiedCount, ids },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: `Đã xóa thành công ${result.modifiedCount} sản phẩm` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi xóa hàng loạt: ' + error.message });
    }
};

// @desc    Lấy lịch sử giao dịch (nhập/xuất/sửa) của kho
// @route   GET /api/v1/inventory/transactions
// @access  Private
const getTransactionHistory = async (req, res) => {
    try {
        let query = {};
        if (req.query.medicineId) {
            query.medicineId = req.query.medicineId;
        }

        const transactions = await InventoryTransaction.find(query)
            .populate('productId', 'name category unit')
            .populate('createdBy', 'fullName')
            .select('medicineId productId transactionType quantity referenceId notes createdBy createdAt')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: transactions.length, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ======================= QUẢN LÝ BATCH (LÔ HÀNG) =======================

// @desc    Thêm Lô mới (Batch) cho 1 sản phẩm
// @route   POST /api/v1/inventory/medicines/:id/batches
// @access  Private
const addBatch = async (req, res) => {
    try {
        const medicineId = req.params.id;
        const { batchNumber, supplier, quantity, expiryDate, importPrice } = req.body;

        const medicine = await Medicine.findById(medicineId).populate('productId');
        if (!medicine) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

        const newBatch = await MedicineBatch.create({
            medicineId,
            batchNumber,
            supplier: supplier || medicine.supplier,
            quantity,
            importedQty: quantity,
            expiryDate,
            importPrice: importPrice || medicine.importPrice
        });

        // Cập nhật lại tổng tồn kho tự động
        medicine.stockQuantity += quantity;
        await medicine.save();

        await InventoryTransaction.create({
            medicineId: medicine._id,
            productId: medicine.productId,
            transactionType: 'IMPORT',
            quantity: quantity,
            notes: `Nhập lô mới: ${batchNumber}`,
            createdBy: req.user._id
        });

        await logActivity({
            userId: req.user._id,
            action: 'ADD_BATCH',
            description: `Thêm lô ${batchNumber} cho ${medicine.productId?.name} (SL: ${quantity})`,
            targetModel: 'MedicineBatch', targetId: newBatch._id,
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: newBatch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy tất cả các lô của 1 sản phẩm
// @route   GET /api/v1/inventory/medicines/:id/batches
// @access  Private
const getBatches = async (req, res) => {
    try {
        const medicineId = req.params.id;
        const batches = await MedicineBatch.find({ medicineId }).sort({ expiryDate: 1 });
        res.status(200).json({ success: true, count: batches.length, data: batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Báo cáo: Các lô sắp hết hạn (trong vòng 30 ngày)
// @route   GET /api/v1/inventory/batches/expiring
// @access  Private
const getExpiringBatches = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);

        const batches = await MedicineBatch.find({
            isActive: true,
            quantity: { $gt: 0 },
            expiryDate: { $lte: targetDate }
        }).populate({
            path: 'medicineId',
            populate: { path: 'productId', select: 'name category' }
        }).sort({ expiryDate: 1 });

        res.status(200).json({ success: true, count: batches.length, data: batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Cập nhật lô hàng
// @route   PATCH /api/v1/inventory/batches/:batchId
// @access  Private
const updateBatch = async (req, res) => {
    try {
        const batch = await MedicineBatch.findById(req.params.batchId);
        if (!batch) return res.status(404).json({ success: false, message: 'Lô không tồn tại' });

        const oldQty = batch.quantity;
        const newQty = req.body.quantity !== undefined ? req.body.quantity : batch.quantity;

        const updatedBatch = await MedicineBatch.findByIdAndUpdate(req.params.batchId, req.body, { new: true, runValidators: true });

        // Nếu thay đổi số lượng, phải tính lại tổng tồn
        if (oldQty !== newQty) {
            const medicine = await Medicine.findById(batch.medicineId);
            if (medicine) {
                const allBatches = await MedicineBatch.find({ medicineId: medicine._id, isActive: true });
                medicine.stockQuantity = allBatches.reduce((sum, b) => sum + b.quantity, 0);
                await medicine.save();

                // Ghi log Transaction
                await InventoryTransaction.create({
                    medicineId: medicine._id,
                    productId: medicine.productId,
                    transactionType: 'ADJUSTMENT',
                    quantity: Math.abs(newQty - oldQty),
                    notes: `Chỉnh sửa lô ${batch.batchNumber}: ${oldQty} -> ${newQty}`,
                    createdBy: req.user._id
                });
            }
        }

        // Kiểm tra và thông báo tồn kho thấp sau khi cập nhật lô
        if (oldQty !== newQty) {
            const freshMed = await Medicine.findById(batch.medicineId).populate('productId');
            if (freshMed) {
                await notifyLowStock(freshMed, freshMed.productId?.name || 'Thuốc/Vật tư');
            }
        }

        res.status(200).json({ success: true, data: updatedBatch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Quét toàn bộ kho, gửi notify ADMIN cho thuốc/vật tư sắp hết/hết
// @route   POST /api/v1/inventory/check-low-stock
// @access  Private
const checkLowStockAll = async (req, res) => {
    try {
        const medicines = await Medicine.find({ isActive: { $ne: false } }).populate('productId', 'name');
        let alertCount = 0;
        for (const med of medicines) {
            const before = alertCount;
            await notifyLowStock(med, med.productId?.name || 'Thuốc/Vật tư');
            // Nếu notifyLowStock tạo notification mới thì alertCount tăng
            if (med.stockQuantity < (med.minimumStock || 5)) alertCount++;
        }
        res.status(200).json({ success: true, checked: medicines.length, lowStockCount: alertCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createMedicine, getMedicines, bulkCreateMedicines,
    updateMedicine, deleteMedicine, bulkDeleteMedicines, checkMedicineDelete,
    getTransactionHistory,
    addBatch, getBatches, getExpiringBatches, updateBatch,
    checkLowStockAll
};
