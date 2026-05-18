import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import {
    Package, LayoutList, Truck, ArrowRightLeft,
    History, Pencil, Trash2, X, Plus, Search,
    Download, Upload, AlertCircle, CheckCircle2,
    Calendar, Building, Info, FileText, ChevronDown, Clock
} from 'lucide-react';

const Inventory = () => {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('ALL');
    const { user } = useAuth(); // Phân quyền UI
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();

    // Modal State Mới (Preview Excel)
    const [previewData, setPreviewData] = useState([]);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // Modal State (Tạo tay & Cập nhật)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null); // Lên sóng khi Edit
    const [searchQuery, setSearchQuery] = useState(''); // Live search
    const [showSuggestions, setShowSuggestions] = useState(false); // Trạng thái show dropdown dropdown
    const [selectedIds, setSelectedIds] = useState([]); // Array chọn nhiều dòng
    const searchRef = useRef(null);

    // Delete Confirmation Modal State
    const [deleteModalConfig, setDeleteModalConfig] = useState({ isOpen: false, type: null, itemId: null }); // type: 'single' | 'bulk'
    const [globalProducts, setGlobalProducts] = useState([]);

    // Determine active section from URL path instead of internal state
    const location = useLocation();
    const activeSection = location.pathname.includes('/products') ? 'PRODUCTS' : 'INVENTORY';
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productFormData, setProductFormData] = useState({
        name: '', description: '', category: 'MEDICINE', unit: 'Lọ'
    });
    const [editingProductId, setEditingProductId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'MEDICINE',
        unit: 'Lọ',
        importPrice: '',
        retailPrice: '',
        stockQuantity: '',
        minimumStock: '5',
        expiryDate: ''
    });
    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // State Lịch sử Giao dịch
    const [transactions, setTransactions] = useState([]);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionLoading, setTransactionLoading] = useState(false);
    const [viewingMedicineName, setViewingMedicineName] = useState('');

    const [receiptData, setReceiptData] = useState({ id: '', actualQuantity: '', discrepancyNotes: '' });


    const fetchInventory = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setMedicines(res.data.data);
            }
        } catch (error) {
            console.error("Lỗi tải danh mục kho:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-backend-tgtd.onrender.com/api/v1/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setGlobalProducts(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching global products:', error);
        }
    };


    const handleViewTransactions = async (medicine) => {
        setTransactionLoading(true);
        setViewingMedicineName(medicine.name);
        setIsTransactionModalOpen(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/transactions?medicineId=${medicine._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setTransactions(res.data.data);
            }
        } catch (error) {
            console.error('Lỗi khi lấy lịch sử giao dịch:', error);
            showToast('Không thể tải lịch sử giao dịch', 'error');
        } finally {
            setTransactionLoading(false);
        }
    };



    useEffect(() => {
        fetchInventory();
        fetchProducts();

        // Cụm click outside để ẩn Suggestion dropdown
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const mappedData = data.map(row => {
                    const name = row['Tên Thuốc'] || row['name'] || row['Tên'] || row['Tên Thu?c'] || row['Tên Hàng'];
                    const unit = row['Đơn Vị'] || row['unit'] || row['Đơn Vị Tính'] || 'Lọ';
                    const importPrice = Number(row['Giá Nhập'] || row['importPrice'] || 0);
                    const retailPrice = Number(row['Giá Bán'] || row['retailPrice'] || 0);
                    const stockQuantity = Number(row['Tồn Kho'] || row['stockQuantity'] || row['Số Lượng'] || 0);
                    const minimumStock = Number(row['Mức Cảnh Báo'] || row['minimumStock'] || 5);
                    const description = row['Mô Tả'] || row['description'] || '';

                    const rawType = (row['Phân Loại'] || row['category'] || '').toLowerCase();
                    let category = 'MEDICINE';
                    if (rawType.includes('vật tư') || rawType.includes('dụng cụ')) {
                        category = 'SUPPLY';
                    } else if (rawType.includes('vắc') || rawType.includes('vac')) {
                        category = 'VACCINE';
                    }

                    let expiryDate = null;
                    const rawDate = row['Hạn Sử Dụng'] || row['expiryDate'];
                    if (rawDate) {
                        expiryDate = new Date(rawDate);
                    }

                    if (name) {
                        return {
                            name, unit, importPrice, retailPrice, stockQuantity, minimumStock, description, category,
                            expiryDate: (expiryDate && !isNaN(expiryDate.getTime())) ? expiryDate.toISOString().split('T')[0] : ''
                        };
                    }
                    return null;
                }).filter(Boolean);

                if (mappedData.length === 0) {
                    showToast('File Excel trống hoặc cấu trúc không chứa cột "Tên Thuốc"', 'error');
                    return;
                }

                setPreviewData(mappedData);
                setIsPreviewModalOpen(true);
            };
            reader.readAsBinaryString(file);
        } catch (error) {
            showToast('Có lỗi xảy ra khi đọc file Excel: ' + error.message, 'error');
        } finally {
            setUploadLoading(false);
            e.target.value = null; // Reset input sau khi parse
        }
    };

    const handlePreviewChange = (index, field, value) => {
        const newData = [...previewData];
        newData[index][field] = value;
        setPreviewData(newData);
    };

    const handleConfirmImport = async () => {
        setSubmitLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post('https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines/bulk', { medicines: previewData }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast(`Thành công: ${res.data.message}`, 'success');
                setIsPreviewModalOpen(false);
                setPreviewData([]);
                fetchInventory();
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Có lỗi xảy ra khi lưu Import Batch.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleOpenModal = () => {
        setFormData({
            productId: '', name: '', description: '', category: 'MEDICINE', unit: 'Lọ',
            importPrice: '', retailPrice: '', stockQuantity: '', minimumStock: '5', expiryDate: ''
        });
        setEditingId(null);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        setErrorMsg('');

        // 0. Validation định dạng số
        if (Number(formData.importPrice) < 0) { setErrorMsg('Giá nhập không được là số âm.'); setSubmitLoading(false); return; }
        if (Number(formData.retailPrice) < 0) { setErrorMsg('Giá bán không được là số âm.'); setSubmitLoading(false); return; }
        if (Number(formData.stockQuantity) < 0) { setErrorMsg('Số lượng tồn kho không được là số âm.'); setSubmitLoading(false); return; }
        if (Number(formData.minimumStock) < 0) { setErrorMsg('Mức cảnh báo tồn kho không được là số âm.'); setSubmitLoading(false); return; }

        // 0.1 Expiry Date validation
        if (formData.expiryDate) {
            const expDate = new Date(formData.expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expDate < today) {
                setErrorMsg('Hạn sử dụng không được ở trong quá khứ.');
                setSubmitLoading(false);
                return;
            }
        }

        try {
            const token = sessionStorage.getItem('token');
            const url = editingId ? `https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines/${editingId}` : 'https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines';
            const method = editingId ? 'put' : 'post';

            const res = await axios[method](url, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast(editingId ? 'Đã cập nhật thay đổi!' : 'Đã nhập kho mới!', 'success');
                setIsModalOpen(false);
                fetchInventory();
                fetchProducts(); // Cập nhật danh mục
            }
        } catch (error) {
            setErrorMsg(error.response?.data?.message || `Có lỗi xảy ra khi ${editingId ? 'cập nhật' : 'nhập'} kho.`);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        setErrorMsg('');
        try {
            const token = sessionStorage.getItem('token');
            const url = editingProductId ? `https://vet-clinic-backend-tgtd.onrender.com/api/v1/products/${editingProductId}` : 'https://vet-clinic-backend-tgtd.onrender.com/api/v1/products';
            const method = editingProductId ? 'put' : 'post';
            const res = await axios[method](url, productFormData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                showToast(editingProductId ? 'Đã cập nhật danh mục' : 'Đã tạo danh mục', 'success');
                setIsProductModalOpen(false);
                fetchProducts();
            }
        } catch (error) {
            setErrorMsg(error.response?.data?.message || 'Có lỗi xảy ra khi lưu danh mục.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleEditProduct = (prod) => {
        setProductFormData({
            name: prod.name,
            description: prod.description || '',
            category: prod.category || 'MEDICINE',
            unit: prod.unit || 'Lọ'
        });
        setEditingProductId(prod._id);
        setErrorMsg('');
        setIsProductModalOpen(true);
    };

    const confirmDeleteProduct = async (id) => {
        showConfirm(
            'Ngừng Kinh Doanh',
            'Xác nhận NGỪNG KINH DOANH danh mục hàng hoá này?\n\nLưu ý: Hành động này sẽ ẩn sản phẩm khỏi các danh mục tra cứu, nhưng lịch sử nhập xuất cũ vẫn được bảo lưu.',
            async () => {
                try {
                    const token = sessionStorage.getItem('token');
                    const res = await axios.delete(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/products/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data.success) {
                        showToast('Đã xóa thành công danh mục', 'success');
                        fetchProducts();
                    }
                } catch (e) {
                    showToast(e.response?.data?.message || 'Lỗi khi xoá danh mục.', 'error');
                }
            }
        );
    };

    const handleEdit = (med) => {
        setFormData({
            productId: med.productId || '',
            name: med.name || '',
            description: med.description || '',
            category: med.category || 'MEDICINE',
            unit: med.unit || '',
            importPrice: med.importPrice || 0,
            retailPrice: med.retailPrice || 0,
            stockQuantity: med.stockQuantity || 0,
            minimumStock: med.minimumStock || 5,
            expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : ''
        });
        setEditingId(med._id);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const confirmDelete = async (id) => {
        try {
            const token = sessionStorage.getItem('token');
            const targetMedicine = inventory.find(i => i._id === id);
            const medName = targetMedicine ? targetMedicine.name : 'Sản phẩm này';

            const checkRes = await axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines/${id}/check-delete`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (checkRes.data.hasRelations) {
                showConfirm(
                    'Ngừng Kinh Doanh Sản Phẩm',
                    `Sản phẩm "${medName}" đã có dữ liệu sử dụng trên bệnh án/hóa đơn.\n\nBạn có muốn NGỪNG KINH DOANH sản phẩm này không? Sản phẩm sẽ bị ẩn khỏi danh sách nhưng mọi lịch sử vẫn được bảo toàn.`,
                    async () => {
                        try {
                            const res = await axios.delete(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data.success) {
                                setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
                                showToast('Đã ngừng kinh doanh sản phẩm', 'success');
                                fetchInventory();
                            }
                        } catch (error) { showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
                    }
                );
            } else {
                showConfirm(
                    'Xóa Vĩnh Viễn Sản Phẩm',
                    `Sản phẩm "${medName}" chưa từng được sử dụng.\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN không? Dữ liệu không thể khôi phục.`,
                    async () => {
                        try {
                            const res = await axios.delete(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines/${id}?force=true`, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data.success) {
                                setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
                                showToast('Đã xóa vĩnh viễn sản phẩm', 'success');
                                fetchInventory();
                            }
                        } catch (error) { showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
                    }
                );
            }
        } catch (error) {
            console.error('Lỗi kiểm tra dữ liệu:', error);
            showToast('Không thể kiểm tra sản phẩm.', 'error');
        }
    };

    const confirmBulkDelete = () => {
        showConfirm(
            'Xóa Số Lượng Lớn',
            `Bạn có chắc chắn muốn NGỪNG KINH DOANH ${selectedIds.length} sản phẩm đã chọn không?`,
            async () => {
                try {
                    setLoading(true);
                    const token = sessionStorage.getItem('token');
                    const res = await axios.post(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/inventory/medicines/bulk-delete`, { ids: selectedIds }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data.success) {
                        setSelectedIds([]);
                        showToast('Ngừng kinh doanh số lượng lớn thành công', 'success');
                        fetchInventory();
                    }
                } catch (error) {
                    showToast(error.response?.data?.message || 'Có lỗi khi xóa hàng loạt!', 'error');
                    setLoading(false);
                }
            }
        );
    };

    const handleDelete = async (id) => {
        confirmDelete(id);
    };

    const handleBulkDelete = async () => {
        confirmBulkDelete();
    };

    const handleSelectAll = (e, filteredList) => {
        if (e.target.checked) {
            setSelectedIds(filteredList.map(item => item._id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleExportExcel = () => {
        if (processedMedicines.length === 0) {
            showToast("Không có dữ liệu để xuất theo bộ lọc hiện tại.", 'error');
            return;
        }

        const dataToExport = processedMedicines.map(med => ({
            "Tên Sản Phẩm": med.name,
            "Phân Loại": med.category === 'SUPPLY' ? 'Vật Tư' : 'Thuốc',
            "Đơn Vị": med.unit,
            "Giá Nhập": med.importPrice,
            "Giá Bán Lẻ": med.retailPrice,
            "Tồn Kho": med.stockQuantity,
            "Mức Cảnh Báo": med.minimumStock,
            "Hạn Sử Dụng": med.expiryDate ? new Date(med.expiryDate).toLocaleDateString('vi-VN') : '',
            "Mô Tả": med.description || ''
        }));

        // Thêm 1 dòng trống cho dễ nhìn
        dataToExport.push({});

        // Thêm dòng Tổng Cộng
        dataToExport.push({
            "Tên Sản Phẩm": "TỔNG CỘNG:",
            "Tồn Kho": summaryStats.totalQuantity,
            "Mô Tả": `Tổng Giá Trị Lưu Kho: ${formatCurrency(summaryStats.totalValue)}`
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        // Auto-size cột
        const colWidths = [
            { wch: 30 }, // Tên Sản Phẩm
            { wch: 15 }, // Phân Loại
            { wch: 10 }, // Đơn Vị
            { wch: 15 }, // Giá Nhập
            { wch: 15 }, // Giá Bán Lẻ
            { wch: 10 }, // Tồn Kho
            { wch: 15 }, // Mức Cảnh Báo
            { wch: 15 }, // Hạn Sử Dụng
            { wch: 40 }  // Mô Tả
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");

        XLSX.writeFile(workbook, `TonKho_${new Date().getTime()}.xlsx`);
    };

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null || isNaN(amount)) return "0 ₫";
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    // Hàm nhận diện tình trạng tồn kho
    const getStockStatus = (stock, minStock) => {
        if (stock === 0) return { label: 'Hết Hàng', color: '#dc2626', bg: '#fee2e2' };
        if (stock <= minStock) return { label: 'Sắp Hết', color: '#d97706', bg: '#fef3c7' };
        return { label: 'Còn Hàng', color: '#059669', bg: '#d1fae5' };
    };

    // --- DATA KẾT HỢP LỌC TAB (KHÔNG LỌC THEO SEARCH NỮA) ---
    const processedMedicines = React.useMemo(() => {
        return medicines.filter(m => activeTab === 'ALL' || m.category === activeTab);
    }, [medicines, activeTab]);

    // --- DATA GỢI Ý TÌM KIẾM ---
    const searchSuggestions = React.useMemo(() => {
        if (!searchQuery.trim()) return [];
        const normalize = str => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const query = normalize(searchQuery);
        return medicines
            .filter(m => activeTab === 'ALL' || m.category === activeTab)
            .filter(m => normalize(m.name).includes(query))
            .slice(0, 10); // Chỉ hiển thị top 10 gợi ý
    }, [medicines, activeTab, searchQuery]);

    // Hàm tô sáng chữ trùng khớp
    const highlightText = (text, highlight) => {
        if (!highlight.trim()) return text;
        const normalize = str => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const normalizedText = normalize(text);
        const normalizedHighlight = normalize(highlight);

        const index = normalizedText.indexOf(normalizedHighlight);
        if (index === -1) return text;

        return (
            <span>
                {text.substring(0, index)}
                <strong style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{text.substring(index, index + highlight.length)}</strong>
                {text.substring(index + highlight.length)}
            </span>
        );
    };

    // --- TÍNH TOÁN THỐNG KÊ (SUMMARY STATS) DỰA TRÊN TAB ---
    const summaryStats = React.useMemo(() => {
        let totalItems = processedMedicines.length; // Tổng mã sản phẩm
        let totalQuantity = 0; // Tổng số lượng (ĐVT)
        let totalValue = 0; // Tổng giá trị kho (Giá Nhập * Số Lượng)

        processedMedicines.forEach(med => {
            totalQuantity += med.stockQuantity || 0;
            totalValue += (med.stockQuantity || 0) * (med.importPrice || 0);
        });

        return { totalItems, totalQuantity, totalValue };
    }, [processedMedicines]);

    return (
        <Layout>
            <div className="dashboard-header flex-between animate-fade-in" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: '1 1 300px' }}>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', margin: 0 }}>Quản Lý Kho</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Theo dõi danh mục, số lượng tồn kho và cảnh báo.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', maxWidth: '800px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {activeSection === 'INVENTORY' && selectedIds.length > 0 && user?.role !== 'DOCTOR' && (
                        <button className="btn animate-fade-in" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', height: '42px', fontWeight: 600, boxShadow: '0 4px 12px rgba(220,38,38,0.15)' }} onClick={handleBulkDelete}>
                            <Trash2 size={18} style={{ marginRight: '8px' }} /> <span className="hide-on-mobile">Xóa ({selectedIds.length}) mục</span>
                            <span className="show-on-mobile" style={{ display: 'none' }}>{selectedIds.length}</span>
                        </button>
                    )}
                    {activeSection === 'INVENTORY' && (
                        <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#475569', height: '42px', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={handleExportExcel}>
                            Xuất Excel
                        </button>
                    )}
                    {user?.role !== 'DOCTOR' && activeSection === 'INVENTORY' && (
                        <>
                            <input type="file" ref={fileInputRef} hidden accept=".xlsx, .xls" onChange={handleFileUpload} />
                            <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: 'var(--primary)', height: '42px', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}>
                                {uploadLoading ? 'Đang Xử Lý...' : 'Nhập Lô Excel'}
                            </button>
                            <button className="btn btn-primary" onClick={handleOpenModal}>
                                <Plus size={18} /> <span className="hide-on-mobile">Khai báo thuốc</span>
                            </button>
                        </>
                    )}
                    {user?.role === 'ADMIN' && activeSection === 'PRODUCTS' && (
                        <button className="btn btn-primary" onClick={() => { setProductFormData({ name: '', description: '', category: 'MEDICINE', unit: 'Lọ' }); setEditingProductId(null); setIsProductModalOpen(true); }}>
                            <Plus size={18} /> <span className="hide-on-mobile">Tạo Danh Mục</span>
                        </button>
                    )}
                </div>
            </div>

            {/* --- NỘI DUNG SECTION: PRODUCTS --- */}
            {activeSection === 'PRODUCTS' && (
                <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', borderRadius: '20px', border: '1px solid #ffffff' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                        Từ Điển Danh Mục Gốc ({globalProducts.length})
                    </div>
                    <div className="table-responsive">
                        <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.85rem' }}>
                                <tr>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Tên Sản Phẩm</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Phân Loại</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Đơn vị</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Mô tả</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {globalProducts.map(prod => (
                                    <tr key={prod._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px', fontWeight: '500' }} data-label="Tên Sản Phẩm">{prod.name}</td>
                                        <td style={{ padding: '12px' }} data-label="Phân Loại">
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '4px',
                                                background: prod.category === 'SUPPLY' ? '#f3e8ff' : (prod.category === 'VACCINE' ? '#dcfce7' : '#e0f2fe'),
                                                color: prod.category === 'SUPPLY' ? '#9333ea' : (prod.category === 'VACCINE' ? '#166534' : '#0284c7'),
                                                fontSize: '0.8rem'
                                            }}>
                                                {prod.category === 'SUPPLY' ? 'Vật Tư' : (prod.category === 'VACCINE' ? 'Vắc-xin' : 'Thuốc')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }} data-label="Đơn vị">{prod.unit}</td>
                                        <td style={{ padding: '12px', color: '#64748b', fontSize: '0.9rem' }} data-label="Mô tả">{prod.description}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button onClick={() => handleEditProduct(prod)} style={{ background: 'transparent', color: '#8b5cf6', border: 'none', cursor: 'pointer', fontWeight: 600 }}>SỬA</button>
                                                <button onClick={() => confirmDeleteProduct(prod._id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 600 }}>XÓA</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- NỘI DUNG SECTION: INVENTORY --- */}
            {activeSection === 'INVENTORY' && (
                <>
                    {/* --- THỐNG KÊ TỔNG QUAN --- */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px', marginBottom: '32px' }}>
                        {/* Card 1: Tổng Sản Phẩm */}
                        <div className="glass-card animate-slide-up" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '20px', border: '1px solid #ffffff', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', animationDelay: '0.1s' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', flexShrink: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
                                {summaryStats.totalItems}
                            </div>
                            <div>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng Mã Sản Phẩm</p>
                                <h2 style={{ margin: '4px 0 0', color: '#0f172a', fontSize: '1.5rem', fontWeight: 700 }}>{summaryStats.totalItems} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>mục</span></h2>
                            </div>
                        </div>

                        {/* Card 2: Tổng Tồn Kho */}
                        <div className="glass-card animate-slide-up" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '20px', border: '1px solid #ffffff', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', animationDelay: '0.2s' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
                                {summaryStats.totalQuantity}
                            </div>
                            <div>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng Lưu Lượng Tồn</p>
                                <h2 style={{ margin: '4px 0 0', color: '#0f172a', fontSize: '1.5rem', fontWeight: 700 }}>{new Intl.NumberFormat('vi-VN').format(summaryStats.totalQuantity)} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>đơn vị</span></h2>
                            </div>
                        </div>

                        {/* Card 3: Tổng Giá Trị Kho */}
                        <div className="glass-card animate-slide-up" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '20px', border: '1px solid #ffffff', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', animationDelay: '0.3s' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0, fontSize: '1.5rem' }}>
                                ₫
                            </div>
                            <div>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng Giá Trị Lưu Kho</p>
                                <h2 style={{ margin: '4px 0 0', color: '#10b981', fontSize: '1.5rem', fontWeight: 800 }}>{formatCurrency(summaryStats.totalValue)}</h2>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setActiveTab('ALL')}
                                className={`btn ${activeTab === 'ALL' ? 'btn-primary' : ''}`}
                                style={{ background: activeTab === 'ALL' ? 'var(--primary)' : 'white', border: activeTab !== 'ALL' ? '1px solid #e2e8f0' : 'none', color: activeTab === 'ALL' ? 'white' : 'var(--text-main)', borderRadius: '24px', padding: '8px 20px', fontSize: '0.9rem', boxShadow: activeTab !== 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', flex: '1 1 auto' }}>
                                Tất cả
                            </button>
                            <button
                                onClick={() => setActiveTab('MEDICINE')}
                                className={`btn ${activeTab === 'MEDICINE' ? 'btn-primary' : ''}`}
                                style={{ background: activeTab === 'MEDICINE' ? 'var(--primary)' : 'white', border: activeTab !== 'MEDICINE' ? '1px solid #e2e8f0' : 'none', color: activeTab === 'MEDICINE' ? 'white' : 'var(--text-main)', borderRadius: '24px', padding: '8px 20px', fontSize: '0.9rem', boxShadow: activeTab !== 'MEDICINE' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', flex: '1 1 auto' }}>
                                Thuốc
                            </button>
                            <button
                                onClick={() => setActiveTab('SUPPLY')}
                                className={`btn ${activeTab === 'SUPPLY' ? 'btn-primary' : ''}`}
                                style={{ background: activeTab === 'SUPPLY' ? 'var(--primary)' : 'white', border: activeTab !== 'SUPPLY' ? '1px solid #e2e8f0' : 'none', color: activeTab === 'SUPPLY' ? 'white' : 'var(--text-main)', borderRadius: '24px', padding: '8px 20px', fontSize: '0.9rem', boxShadow: activeTab !== 'SUPPLY' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', flex: '1 1 auto' }}>
                                Vật Tư
                            </button>
                            <button
                                onClick={() => setActiveTab('VACCINE')}
                                className={`btn ${activeTab === 'VACCINE' ? 'btn-primary' : ''}`}
                                style={{ background: activeTab === 'VACCINE' ? 'var(--primary)' : 'white', border: activeTab !== 'VACCINE' ? '1px solid #e2e8f0' : 'none', color: activeTab === 'VACCINE' ? 'white' : 'var(--text-main)', borderRadius: '24px', padding: '8px 20px', fontSize: '0.9rem', boxShadow: activeTab !== 'VACCINE' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', flex: '1 1 auto' }}>
                                Vắc-xin
                            </button>
                        </div>

                        <div className="input-with-icon search-container-mobile" style={{
                            width: '100%',
                            maxWidth: '380px',
                            flex: '1 1 300px',
                            background: 'white',
                            borderRadius: '100px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 20px',
                            position: 'relative'
                        }} ref={searchRef}>
                            <Search size={20} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm tên sản phẩm..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                style={{
                                    height: '46px',
                                    marginBottom: '0',
                                    width: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: '1rem',
                                    paddingLeft: '12px',
                                    color: '#334155'
                                }}
                            />

                            {/* Dropdown Suggestions */}
                            {showSuggestions && searchQuery.trim().length > 0 && (
                                <div className="suggestions-dropdown animate-slide-up" style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                                    background: 'white', borderRadius: '16px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                                    border: '1px solid #e2e8f0', zIndex: 50, overflow: 'hidden'
                                }}>
                                    {searchSuggestions.length > 0 ? (
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' }}>
                                            {searchSuggestions.map((item, index) => (
                                                <li key={index}
                                                    onClick={() => {
                                                        setSearchQuery(item.name);
                                                        setShowSuggestions(false);
                                                        // Có thể thêm logic scroll mượt tới id của item đó trong bảng nếu cần
                                                        const row = document.getElementById(`row-${item._id}`);
                                                        if (row) {
                                                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            row.style.backgroundColor = '#fef08a'; // highlight row
                                                            setTimeout(() => row.style.backgroundColor = '', 2000);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'white'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px', height: '8px', borderRadius: '50%',
                                                            background: item.category === 'SUPPLY' ? '#a855f7' : (item.category === 'VACCINE' ? '#10b981' : '#3b82f6')
                                                        }}></div>
                                                        <span style={{ color: '#334155', fontSize: '0.95rem' }}>{highlightText(item.name, searchQuery)}</span>
                                                    </div>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Kho: {item.stockQuantity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                            Không tìm thấy dữ liệu khớp <strong>"{searchQuery}"</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', borderRadius: '20px', border: '1px solid #ffffff' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                                Danh Mục Hàng Hoá Trong Kho ({processedMedicines.length})
                            </h3>
                        </div>

                        <div className="table-responsive">
                            <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                                <thead style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        {user?.role !== 'DOCTOR' && (
                                            <th style={{ padding: '16px', fontWeight: '700', textAlign: 'center', width: '50px', borderBottom: '2px solid #e2e8f0' }}>
                                                <input type="checkbox" onChange={(e) => handleSelectAll(e, processedMedicines)} checked={selectedIds.length === processedMedicines.length && processedMedicines.length > 0} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                            </th>
                                        )}
                                        <th style={{ padding: '16px', fontWeight: '700', borderBottom: '2px solid #e2e8f0' }}>Sản Phẩm & Phân Loại</th>
                                        <th style={{ padding: '16px', fontWeight: '700', borderBottom: '2px solid #e2e8f0' }}>Giá Cả (VND)</th>
                                        <th style={{ padding: '16px', fontWeight: '700', borderBottom: '2px solid #e2e8f0' }}>Quy Cách & Tồn Kho</th>
                                        <th style={{ padding: '16px', fontWeight: '700', borderBottom: '2px solid #e2e8f0' }}>Hạn Dùng & Ghi Chú</th>
                                        <th style={{ padding: '16px', fontWeight: '700', borderBottom: '2px solid #e2e8f0' }}>Tình Trạng</th>
                                        {user?.role !== 'DOCTOR' && (
                                            <th style={{ padding: '16px', fontWeight: '700', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Thao Tác</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={user?.role !== 'DOCTOR' ? 7 : 5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Đang tải dữ liệu kho...
                                            </td>
                                        </tr>
                                    ) : processedMedicines.length === 0 ? (
                                        <tr>
                                            <td colSpan={user?.role !== 'DOCTOR' ? 7 : 5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                    <p style={{ margin: 0, fontSize: '1.1rem' }}>Không tìm thấy dược phẩm/vật tư nào.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        processedMedicines.map((med) => {
                                            const status = getStockStatus(med.stockQuantity, med.minimumStock);
                                            return (
                                                <tr id={`row-${med._id}`} key={med._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.5s ease', cursor: 'default', backgroundColor: selectedIds.includes(med._id) ? '#f0fdf4' : 'transparent' }} onMouseOver={e => e.currentTarget.style.backgroundColor = selectedIds.includes(med._id) ? '#dcfce7' : '#f8fafc'} onMouseOut={e => { if (e.currentTarget.style.backgroundColor !== 'rgb(254, 240, 138)') e.currentTarget.style.backgroundColor = selectedIds.includes(med._id) ? '#f0fdf4' : 'transparent' }}>
                                                    {user?.role !== 'DOCTOR' && (
                                                        <td style={{ padding: '16px', textAlign: 'center' }} data-label="Chọn">
                                                            <input type="checkbox" checked={selectedIds.includes(med._id)} onChange={() => toggleSelection(med._id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                                        </td>
                                                    )}
                                                    <td style={{ padding: '16px 24px' }} data-label="Sản phẩm">
                                                        <span style={{
                                                            fontSize: '0.85rem', padding: '4px 8px', borderRadius: '4px',
                                                            background: med.category === 'SUPPLY' ? '#f3e8ff' : (med.category === 'VACCINE' ? '#dcfce7' : '#e0f2fe'),
                                                            color: med.category === 'SUPPLY' ? '#9333ea' : (med.category === 'VACCINE' ? '#166534' : '#0284c7'),
                                                            fontWeight: 500
                                                        }}>
                                                            {med.category === 'SUPPLY' ? 'Vật Tư' : (med.category === 'VACCINE' ? 'Vắc-xin' : 'Thuốc')}
                                                        </span>
                                                        <div style={{ marginTop: '8px' }}>
                                                            <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>{med.name}</strong>
                                                            {med.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{med.description}</p>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Giá cả">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nhập: {formatCurrency(med?.importPrice)}</span>
                                                            <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>Bán: {formatCurrency(med?.retailPrice)}</strong>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Tồn kho">
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{med.stockQuantity}</span>
                                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{med.unit}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Hạn dùng">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {med.expiryDate && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>HSD: {new Date(med.expiryDate).toLocaleDateString('vi-VN')}</span>}
                                                            {med.notes && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{med.notes}</p>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Tình trạng">
                                                        <span className="badge" style={{ background: status.bg, color: status.color, display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    {user?.role !== 'DOCTOR' && (
                                                        <td style={{ padding: '16px 24px' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                                <button onClick={() => handleViewTransactions(med)} style={{ background: 'transparent', color: '#f59e0b', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#fef3c7'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'} title="Lịch sử">
                                                                    <History size={18} />
                                                                </button>
                                                                <button onClick={() => handleEdit(med)} style={{ background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#ecfdf5'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'} title="Sửa">
                                                                    <Pencil size={18} />
                                                                </button>
                                                                <button onClick={() => handleDelete(med._id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem' }} onMouseOver={e => e.currentTarget.style.background = '#fee2e2'} onMouseOut={e => e.currentTarget.style.background = '#fef2f2'}>
                                                                    <Trash2 size={18} />
                                                                    Xoá
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Modal Form Nhập SP */}
                    {isModalOpen && createPortal(
                        <div className="modal-overlay">
                            <div className="modal-container glass-card" style={{ width: '700px', maxWidth: '95%' }}>

                                {/* Header Modal */}
                                <div className="modal-header">
                                    <div>
                                        <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 700 }}>
                                            {editingId ? 'Cập Nhật Dược Phẩm' : 'Thêm Mới Dược Phẩm'}
                                        </h3>
                                    </div>
                                    <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}>
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body - Scrollable Area */}
                                <form onSubmit={handleSubmit} className="modal-body" style={{ flex: 1 }}>
                                    {errorMsg && (
                                        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '20px' }}>
                                            {errorMsg}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Phần 1: Thông tin cơ bản */}
                                        <div className="form-section">
                                            <h4 className="section-title">1. Thông tin cơ bản</h4>
                                            <div className="responsive-grid">
                                                <div className="form-group" style={{ gridColumn: 'span 1' }}>
                                                    <label>Tên Sản Phẩm <span style={{ color: '#ef4444' }}>*</span></label>
                                                    <input type="text" list="global-products" className="input-field" name="name" value={formData.name} onChange={(e) => {
                                                        const val = e.target.value;
                                                        const matchedProduct = globalProducts.find(p => p.name === val);
                                                        if (matchedProduct) {
                                                            setFormData(prev => ({ ...prev, name: val, productId: matchedProduct._id, category: matchedProduct.category, unit: matchedProduct.unit, description: matchedProduct.description }));
                                                        } else {
                                                            setFormData(prev => ({ ...prev, name: val, productId: '' }));
                                                        }
                                                    }} required placeholder="Chọn hoặc nhập tên mới..." />
                                                    <datalist id="global-products">
                                                        {globalProducts.map(p => <option key={p._id} value={p.name} />)}
                                                    </datalist>
                                                </div>
                                                <div className="form-group">
                                                    <label>Đơn vị <span style={{ color: '#ef4444' }}>*</span></label>
                                                    <select className="input-field" name="unit" value={formData.unit} onChange={handleInputChange} required>
                                                        <optgroup label="Cơ bản">
                                                            <option value="Viên">Viên</option>
                                                            <option value="Vỉ">Vỉ</option>
                                                            <option value="Hộp">Hộp</option>
                                                        </optgroup>
                                                        <optgroup label="Dung dịch / Nước">
                                                            <option value="Lọ">Lọ</option>
                                                            <option value="Chai">Chai</option>
                                                            <option value="Tuýp">Tuýp</option>
                                                            <option value="ml">ml</option>
                                                        </optgroup>
                                                        <optgroup label="Khác">
                                                            <option value="Cái">Cái</option>
                                                            <option value="Bộ">Bộ</option>
                                                            <option value="Gói">Gói</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>Phân Loại <span style={{ color: '#ef4444' }}>*</span></label>
                                                    <select className="input-field" name="category" value={formData.category} onChange={handleInputChange} required>
                                                        <option value="MEDICINE">Thuốc điều trị</option>
                                                        <option value="SUPPLY">Vật tư y tế</option>
                                                        <option value="VACCINE">Vắc-xin</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ marginTop: '16px' }}>
                                                <label>Mô tả / Ghi chú</label>
                                                <textarea className="input-field" name="description" value={formData.description} onChange={handleInputChange} placeholder="Nhập tóm tắt cách sử dụng, chỉ định..." style={{ height: '70px' }} />
                                            </div>
                                        </div>

                                        {/* Phần 2: Định lượng & Giá cả */}
                                        <div className="form-section highlight" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <h4 className="section-title">2. Định giá & Quy cách</h4>
                                            <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                                                <div className="form-group">
                                                    <label>Giá Nhập (VND) *</label>
                                                    <input type="number" className="input-field" name="importPrice" value={formData.importPrice} onChange={handleInputChange} required />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ color: 'var(--primary)' }}>Giá Bán Lẻ (VND) *</label>
                                                    <input type="number" className="input-field" name="retailPrice" value={formData.retailPrice} onChange={handleInputChange} required style={{ borderColor: 'var(--primary)', borderStyle: 'dashed' }} />
                                                </div>
                                                <div className="form-group">
                                                    <label>Hạn Sử Dụng</label>
                                                    <input type="date" className="input-field" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Phần 3: Quản lý Kho bãi */}
                                        <div className="form-section">
                                            <h4 className="section-title">3. Quản lý Kho bãi</h4>
                                            <div className="responsive-grid">
                                                <div className="form-group">
                                                    <label>Tồn Kho Ban Đầu *</label>
                                                    <input type="number" className="input-field" name="stockQuantity" value={formData.stockQuantity} onChange={handleInputChange} required />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ color: '#d97706' }}>Ngưỡng Cảnh Báo *</label>
                                                    <input type="number" className="input-field" name="minimumStock" value={formData.minimumStock} onChange={handleInputChange} required />
                                                </div>
                                            </div>
                                        </div>
                                    </div>


                                    {/* Footer Modal */}
                                    <div className="modal-footer" style={{ border: 'none', padding: '16px 0 0 0', marginTop: '16px' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy Bỏ</button>
                                        <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ minWidth: '120px' }}>
                                            {submitLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                        </button>
                                    </div>

                                </form>
                            </div>
                        </div>,
                        document.body
                    )}

                    {isPreviewModalOpen && createPortal(
                        <div className="modal-overlay">
                            <div className="modal-container glass-card" style={{ width: '900px', maxWidth: '95%', padding: 0 }}>
                                <div style={{ padding: '20px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Xác Nhận Xem Trước Dữ Liệu
                                        </h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tải {previewData.length} sản phẩm từ Excel.</p>
                                    </div>
                                    <button className="btn-icon" onClick={() => setIsPreviewModalOpen(false)} style={{ color: '#94a3b8' }}>
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="modal-body" style={{ padding: 0 }}>
                                    <div className="table-responsive">
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                            <thead style={{ background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ padding: '12px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Sản Phẩm</th>
                                                    <th style={{ padding: '12px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Giá Bán (VND)</th>
                                                    <th style={{ padding: '12px', fontWeight: '600', borderBottom: '1px solid #eef2f5', width: '90px' }}>Tồn Kho</th>
                                                    <th style={{ padding: '12px', fontWeight: '600', borderBottom: '1px solid #eef2f5', width: '130px' }}>Hạn Dùng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.map((med, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid #eef2f5' }}>
                                                        <td style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                <input type="text" className="input-field" style={{ height: '32px', padding: '4px 8px', fontSize: '0.85rem', marginBottom: 0, flex: '1 1 150px' }} value={med.name} onChange={(e) => handlePreviewChange(index, 'name', e.target.value)} />
                                                                <select className="input-field" style={{ height: '32px', padding: '4px 8px', fontSize: '0.85rem', marginBottom: 0, width: '90px' }} value={med.category} onChange={(e) => handlePreviewChange(index, 'category', e.target.value)}>
                                                                    <option value="MEDICINE">Thuốc</option>
                                                                    <option value="SUPPLY">Vật Tư</option>
                                                                    <option value="VACCINE">Vắc-xin</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <input type="number" className="input-field" style={{ height: '32px', padding: '4px 8px', fontSize: '0.85rem', marginBottom: 0, width: '100px' }} value={med.retailPrice} onChange={(e) => handlePreviewChange(index, 'retailPrice', e.target.value)} />
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <input type="number" className="input-field" style={{ height: '32px', padding: '4px 8px', fontSize: '0.85rem', marginBottom: 0, width: '60px' }} value={med.stockQuantity} onChange={(e) => handlePreviewChange(index, 'stockQuantity', e.target.value)} />
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <input type="date" className="input-field" style={{ height: '32px', padding: '4px 4px', fontSize: '0.85rem', marginBottom: 0 }} value={med.expiryDate || ''} onChange={(e) => handlePreviewChange(index, 'expiryDate', e.target.value)} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div style={{ padding: '20px 24px', borderTop: '1px solid #eef2f5', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: '#f8fafc', flexShrink: 0 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsPreviewModalOpen(false)}>Hủy</button>
                                    <button type="button" className="btn btn-primary" onClick={handleConfirmImport} disabled={submitLoading}>
                                        {submitLoading ? 'Đang Lưu...' : 'Xác Nhận Import'}
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                    {deleteModalConfig.isOpen && createPortal(
                        <div className="modal-overlay">
                            <div className="modal-container glass-card" style={{ width: '400px', maxWidth: '100%', background: 'white', padding: 0, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', fontSize: '2rem' }}>
                                        !
                                    </div>
                                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 700 }}>
                                        Xác Nhận Ngừng Hoạt Động
                                    </h3>
                                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                        {deleteModalConfig.type === 'bulk'
                                            ? `Bạn có chắc chắn muốn ngừng kinh doanh ${selectedIds.length} dược phẩm đã chọn?`
                                            : 'Bạn có chắc chắn muốn ngừng kinh doanh dược phẩm này?'}
                                        <br /><span style={{ color: '#0ea5e9' }}>Dữ liệu sẽ được <strong>lưu trữ vĩnh viễn</strong> để đối soát hóa đơn.</span>
                                    </p>
                                </div>
                                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px', background: '#f8fafc' }}>
                                    <button type="button" className="btn" onClick={() => setDeleteModalConfig({ isOpen: false, type: null, itemId: null })} style={{ flex: 1, background: 'white', border: '1px solid #cbd5e1', color: '#475569', fontWeight: 600, padding: '10px 0' }}>
                                        Hủy Bỏ
                                    </button>
                                    <button type="button" className="btn animate-pulse" onClick={executeDelete} style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 600, padding: '10px 0', boxShadow: '0 4px 12px var(--primary-glow)' }} onMouseOver={e => e.currentTarget.style.background = 'var(--primary-dark)'} onMouseOut={e => e.currentTarget.style.background = 'var(--primary)'}>
                                        Đồng Ý Lưu Trữ
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            )}


            {/* Modal Quản Lý Danh Mục (Products) */}
            {isProductModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in">
                    <form onSubmit={handleProductSubmit} className="glass-card animate-slide-up" style={{ padding: 0 }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, color: '#8b5cf6', fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {editingProductId ? 'Sửa Danh Mục' : 'Tạo Danh Mục Mới'}
                            </h3>
                            <button type="button" onClick={() => setIsProductModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px', borderRadius: '50%' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Tên Sản Phẩm *</label>
                                <input type="text" className="input-field" value={productFormData.name} onChange={e => setProductFormData({ ...productFormData, name: e.target.value })} required style={{ width: '100%' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Phân Loại *</label>
                                    <select className="input-field" value={productFormData.category} onChange={e => setProductFormData({ ...productFormData, category: e.target.value })} style={{ width: '100%' }}>
                                        <option value="MEDICINE">Thuốc</option>
                                        <option value="SUPPLY">Vật Tư</option>
                                        <option value="VACCINE">Vắc-xin</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Đơn vị *</label>
                                    <input type="text" className="input-field" value={productFormData.unit} onChange={e => setProductFormData({ ...productFormData, unit: e.target.value })} required style={{ width: '100%' }} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Mô tả thêm</label>
                                <textarea className="input-field" value={productFormData.description} onChange={e => setProductFormData({ ...productFormData, description: e.target.value })} style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} />
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc', flexShrink: 0 }}>
                            <button type="button" className="btn" style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 24px', fontWeight: 500, borderRadius: '8px' }} onClick={() => setIsProductModalOpen(false)}>Hủy Bỏ</button>
                            <button type="submit" className="btn" disabled={submitLoading} style={{ background: '#8b5cf6', color: 'white', padding: '10px 24px', fontWeight: 600, minWidth: '140px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.4)' }}>
                                {submitLoading ? 'Đang lưu...' : 'Lưu Danh Mục'}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body
            )}

            {/* Modal Lịch sử Giao dịch */}
            {isTransactionModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="modal-container glass-card" style={{ width: '800px', maxWidth: '95%', padding: 0 }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#334155', fontSize: '1.25rem', fontWeight: 600 }}>
                                    Lịch Sử Xuất/Nhập
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Mặt hàng: <strong style={{ color: 'var(--primary)' }}>{viewingMedicineName}</strong></p>
                            </div>
                            <button className="btn-icon" onClick={() => setIsTransactionModalOpen(false)} style={{ color: '#94a3b8' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ background: '#fcfcfc', padding: 0 }}>
                            {transactionLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải...</div>
                            ) : transactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Chưa có giao dịch.</div>
                            ) : (
                                <div className="table-responsive">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                                        <thead style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.8rem' }}>
                                            <tr>
                                                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Thời gian</th>
                                                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Loại</th>
                                                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>SL</th>
                                                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Người tạo</th>
                                                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Ghi chú</th>
                                                <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map(tx => (
                                                <tr key={tx._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px', color: '#64748b' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span className={`badge badge-${tx.transactionType.toLowerCase()}`}>
                                                            {tx.transactionType}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                                        {tx.quantity}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>{tx.createdBy?.fullName || 'Hệ thống'}</td>
                                                    <td style={{ padding: '12px', color: '#64748b' }}>{tx.notes}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        {tx.referenceId && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                                                onClick={() => {
                                                                    if (tx.transactionType === 'USAGE') {
                                                                        window.location.href = `/records?recordId=${tx.referenceId}`;
                                                                    } else if (tx.notes?.includes('Hoá đơn')) {
                                                                        window.location.href = `/invoices?invoiceId=${tx.referenceId}`;
                                                                    }
                                                                }}
                                                            >
                                                                Xem Nguồn
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right', flexShrink: 0 }}>
                            <button className="btn btn-secondary" onClick={() => setIsTransactionModalOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </Layout>
    );
};

export default Inventory;
