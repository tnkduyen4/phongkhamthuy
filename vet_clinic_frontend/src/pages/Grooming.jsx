import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
    Sparkles,
    Plus,
    Search,
    X,
    Camera,
    CheckCircle2,
    Clock,
    Truck,
    Dog,
    Cat,
    ChevronRight,
    MapPin,
    Calendar,
    ImageIcon,
    UserPlus,
    Phone,
    User,
    Trash2
} from 'lucide-react';

const API = 'https://vet-clinic-backend-tgtd.onrender.com/api/v1';

const Grooming = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const [orders, setOrders] = useState([]);
    const [groomingApts, setGroomingApts] = useState([]); // Lịch hẹn Grooming từ Appointments
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('search') || '');

    // Modal Create Order State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [groomingServices, setGroomingServices] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerPets, setCustomerPets] = useState([]);
    const [orderData, setOrderData] = useState({
        pets: [], // List of { petId, name, species }
        services: [], // List of { serviceId, name, price }
        transportType: 'DROPOFF',
        notes: ''
    });

    // Check-in / Check-out State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeOrder, setActiveOrder] = useState(null);
    const [uploadType, setUploadType] = useState('BEFORE'); // BEFORE | AFTER
    const [isUploading, setIsUploading] = useState(false);
    const [isGroomingDataLoading, setIsGroomingDataLoading] = useState(false);

    // Quick Create Customer State
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCustForm, setQuickCustForm] = useState({ fullName: '', phoneNumber: '' });
    const [quickPetForm, setQuickPetForm] = useState({ name: '', species: 'DOG', breed: '', weight: '' });
    const [showQuickPet, setShowQuickPet] = useState(false);
    const [customerCreated, setCustomerCreated] = useState(null); // Snapshot of newly created customer
    
    // View & Filter State
    const [viewMode, setViewMode] = useState(() => {
        const search = new URLSearchParams(window.location.search).get('search');
        return search ? 'HISTORY' : 'ACTIVE';
    }); // ACTIVE | HISTORY
    const [activeFilter, setActiveFilter] = useState('ALL'); // ALL | TODAY | ACTIVE (GROOMING)
    const [bannerDismissed, setBannerDismissed] = useState(false); // Ẩn banner khi đã xem

    // Custom Delete Reason State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Detail Modal State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [activeDetailOrder, setActiveDetailOrder] = useState(null);

    // Completion Notes State
    const [completionNotes, setCompletionNotes] = useState('');

    // Image Preview State
    const [previewImage, setPreviewImage] = useState(null);
    const [zoomScale, setZoomScale] = useState(1);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });


    const fetchOrders = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const [grRes, aptRes] = await Promise.all([
                axios.get(`${API}/grooming`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/appointments`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            if (grRes.data.success) {
                setOrders(grRes.data.data);
                setBannerDismissed(false); // Reset banner khi load mới
            }
            if (aptRes.data.success && grRes.data.success) {
                // Tập hợp appointmentId đã có GroomingOrder → không hiện lại trong "Chờ xử lý"
                const linkedAptIds = new Set(
                    (grRes.data.data || [])
                        .filter(o => o.appointmentId)
                        .map(o => (o.appointmentId?._id || o.appointmentId).toString())
                );

                // Lịch hẹn Grooming chưa có đơn
                const pendingApts = aptRes.data.data.filter(a =>
                    a.type === 'GROOMING' &&
                    ['ARRIVED', 'IN_PROGRESS'].includes(a.status) &&
                    !linkedAptIds.has(a._id.toString())
                );
                setGroomingApts(pendingApts);
            }
        } catch (err) {
            toast('Không thể tải danh sách đơn Grooming', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchGroomingData = async () => {
        setIsGroomingDataLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const h = { Authorization: `Bearer ${token}` };
            const [custRes, svcRes] = await Promise.all([
                axios.get(`${API}/users?role=CUSTOMER`, { headers: h }),
                axios.get(`${API}/services?type=GROOMING`, { headers: h })
            ]);
            setCustomers(custRes.data.data || []);
            const mainServices = svcRes.data.data || [];
            setGroomingServices(mainServices);
        } catch (err) {
            console.error('Lỗi tải dữ liệu khách hàng/dịch vụ:', err);
        } finally {
            setIsGroomingDataLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    // Tự động tắt banner sau 5 giây
    useEffect(() => {
        if (bannerDismissed) return;
        const timer = setTimeout(() => setBannerDismissed(true), 5000);
        return () => clearTimeout(timer);
    }, [bannerDismissed]);

    const openCreateModal = () => {
        fetchGroomingData();
        setSelectedCustomer(null);
        setCustomerPets([]);
        setOrderData({ pets: [], services: [], transportType: 'DROPOFF', notes: '' });
        setIsCreateModalOpen(true);
        setShowQuickCreate(false);
        setCustomerCreated(null);
        setQuickCustForm({ fullName: '', phoneNumber: '' });
        setQuickPetForm({ name: '', species: 'DOG', breed: '', weight: '' });
        setShowQuickPet(false);
    };

    const handleSelectCustomer = async (cust) => {
        setSelectedCustomer(cust);
        setQuickCustForm({ fullName: '', phoneNumber: '' });
        setShowQuickCreate(false);
        const token = sessionStorage.getItem('token');
        try {
            const res = await axios.get(`${API}/pets?ownerId=${cust._id}`, { headers: { Authorization: `Bearer ${token}` } });
            setCustomerPets(res.data.data || []);
            setOrderData(prev => ({ ...prev, customerId: cust._id, pets: [] }));
        } catch (err) {
            toast('Lỗi tải danh sách thú cưng', 'error');
        }
    };

    const togglePet = (pet) => {
        setOrderData(prev => {
            const exists = prev.pets.find(p => p.petId === pet._id);
            if (exists) {
                return { ...prev, pets: prev.pets.filter(p => p.petId !== pet._id) };
            } else {
                return { ...prev, pets: [...prev.pets, { 
                    petId: pet._id, 
                    name: pet.name, 
                    species: pet.species,
                    weightAtVisit: pet.weight || '',
                    services: []
                }] };
            }
        });
    };

    const updatePetData = (petId, field, value) => {
        setOrderData(prev => ({
            ...prev,
            pets: prev.pets.map(p => p.petId === petId ? { ...p, [field]: value } : p)
        }));
    };

    const toggleServiceForPet = (petId, svc) => {
        setOrderData(prev => ({
            ...prev,
            pets: prev.pets.map(p => {
                if (p.petId !== petId) return p;
                const exists = p.services.find(s => s.serviceId === svc._id);
                const newServices = exists 
                    ? p.services.filter(s => s.serviceId !== svc._id)
                    : [...p.services, { serviceId: svc._id, name: svc.name, price: svc.price }];
                return { ...p, services: newServices };
            })
        }));
    };

    const handleAddQuickCustomer = async () => {
        if (!quickCustForm.fullName || !quickCustForm.phoneNumber) {
            return toast('Vui lòng nhập đầy đủ tên và SĐT', 'warning');
        }
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API}/users/quick-customer`, quickCustForm, { headers: { Authorization: `Bearer ${token}` } });
            toast('Thêm khách hàng thành công', 'success');
            handleSelectCustomer(res.data.data);
            fetchGroomingData();
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi khi tạo khách hàng', 'error');
        }
    };

    const handleAddQuickPet = async () => {
        if (!selectedCustomer) return toast('Cần chọn khách hàng trước', 'warning');
        if (!quickPetForm.name || !quickPetForm.species) {
            return toast('Vui lòng nhập tên và loài (Chó/Mèo)', 'warning');
        }
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API}/pets`, { 
                ...quickPetForm, 
                ownerId: selectedCustomer._id,
                weight: quickPetForm.weight // Pass initial weight
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            const newPet = res.data.data;
            toast(`Đã thêm bé ${newPet.name}`, 'success');
            
            // Thêm vào danh sách thú của khách đang chọn
            setCustomerPets(prev => [...prev, newPet]);
            
            // Tự động chọn (toggle) bé này vào đơn luôn
            togglePet(newPet);
            
            // Reset form
            setQuickPetForm({ name: '', species: 'DOG', breed: '', weight: '' });
            setShowQuickPet(false);
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi khi tạo thú cưng', 'error');
        }
    };

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        
        if (!selectedCustomer) return toast('Vui lòng chọn khách hàng', 'warning');
        if (orderData.pets.length === 0) return toast('Vui lòng chọn ít nhất 1 thú cưng', 'warning');

        const hasNoServices = orderData.pets.some(p => p.services.length === 0);
        if (hasNoServices) {
            return toast('Tất cả thú cưng được chọn phải có ít nhất 1 dịch vụ', 'warning');
        }

        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API}/grooming`, {
                ...orderData,
                customerId: selectedCustomer._id,
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.success) {
                toast('Tạo đơn Grooming thành công!', 'success');
                setIsCreateModalOpen(false);
                fetchOrders();
            }
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi khi tạo đơn', 'error');
        }
    };

    const openDeleteModal = (order) => {
        setOrderToDelete(order);
        setDeleteReason('');
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteOrder = async () => {
        if (!deleteReason.trim()) {
            return toast('Vui lòng nhập lý do để xóa đơn hàng', 'warning');
        }

        setIsDeleting(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.delete(`${API}/grooming/${orderToDelete._id}`, { 
                headers: { Authorization: `Bearer ${token}` },
                data: { reason: deleteReason.trim() }
            });
            if (res.data.success) {
                toast('Đã xóa đơn hàng thành công', 'success');
                setIsDeleteModalOpen(false);
                fetchOrders();
            }
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi khi xóa đơn hàng', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);

        try {
            const token = sessionStorage.getItem('token');
            const h = { Authorization: `Bearer ${token}` };
            // 1. Upload ảnh lên Cloudinary
            const uploadRes = await axios.post(`${API}/upload`, uploadFormData, {
                headers: { ...h, 'Content-Type': 'multipart/form-data' }
            });

            if (uploadRes.data.success) {
                const imageUrl = uploadRes.data.data.imageUrl;

                // 2. Cập nhật đơn Grooming
                const endpoint = uploadType === 'BEFORE' ? 'check-in' : 'check-out';
                const body = uploadType === 'BEFORE' 
                    ? { beforeImage: imageUrl } 
                    : { afterImage: imageUrl, completionNotes };

                const res = await axios.patch(`${API}/grooming/${activeOrder._id}/${endpoint}`, body, { headers: h });

                if (res.data.success) {
                    toast(uploadType === 'BEFORE' ? 'Check-in thành công!' : 'Hoàn tất đơn Grooming!', 'success');
                    setIsUploadModalOpen(false);
                    fetchOrders();
                }
            }
        } catch (err) {
            console.error('GROOMING_UPLOAD_ERROR:', err);
            toast(err.response?.data?.message || 'Lỗi khi tải ảnh lên hệ thống', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const openDetailModal = (order) => {
        setActiveDetailOrder(order);
        setIsDetailModalOpen(true);
    };

    // Tự động tạo đơn Grooming từ lịch hẹn (đã có thú cưủng + dịch vụ)
    const handleAutoCreateFromAppointment = async (apt) => {
        try {
            const token = sessionStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Map services từ serviceIds (populated) hoặc serviceId
            const rawServices = apt.serviceIds?.length
                ? apt.serviceIds
                : (apt.serviceId ? [apt.serviceId] : []);

            const mappedServices = rawServices.map(s => ({
                serviceId: s._id || s,
                name: s.name || 'Dịch vụ Grooming',
                price: s.price || 0
            }));

            const petEntry = {
                petId: apt.petId?._id || apt.petId,
                name: apt.petId?.name || 'Thú cưủng',
                species: (apt.petId?.species || 'OTHER').toUpperCase(),
                weightAtVisit: apt.petId?.weight || 0,
                services: mappedServices
            };

            const payload = {
                customerId: apt.customerId?._id || apt.customerId,
                pets: [petEntry],
                services: mappedServices, // cần để pass validation backend
                transportType: apt.deliveryType && apt.deliveryType !== 'NONE' ? 'PICKUP' : 'DROPOFF',
                notes: apt.customerNotes || apt.staffNotes || ''
            };

            const res = await axios.post(`${API}/grooming`, payload, { headers });
            if (res.data.success) {
                // Chuyển appointment sang IN_PROGRESS
                await axios.patch(`${API}/appointments/${apt._id}/status`, {
                    status: 'IN_PROGRESS'
                }, { headers }).catch(() => {}); // bỏ qua nếu không có quyền

                toast(`Đã tạo đơn Grooming cho ${apt.petId?.name || 'thú cưủng'}!`, 'success');
                fetchOrders();
            }
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi tạo đơn từ lịch hẹn', 'error');
        }
    };

    const getStatusInfo = (status) => {
        const configs = {
            BOOKED: { label: 'Chờ thực hiện', color: '#6366f1', bg: '#eef2ff', icon: <Clock size={16} /> },
            GROOMING: { label: 'Đang làm đẹp', color: '#f59e0b', bg: '#fffbeb', icon: <Sparkles size={16} /> },
            COMPLETED: { label: 'Hoàn tất', color: '#10b981', bg: '#f0fdf4', icon: <CheckCircle2 size={16} /> },
            CANCELLED: { label: 'Đã hủy', color: '#ef4444', bg: '#fef2f2', icon: <X size={16} /> }
        };
        return configs[status] || configs.BOOKED;
    };

    const filteredOrders = orders.filter(o => {
        // 1. Filter by View Mode (Tab)
        if (viewMode === 'ACTIVE') {
            if (o.status === 'COMPLETED' || o.status === 'CANCELLED') return false;
        } else {
            if (o.status !== 'COMPLETED' && o.status !== 'CANCELLED') return false;
        }

        // 2. Filter by Search Query
        const matchesSearch = o.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customerId?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.pets.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        if (!matchesSearch) return false;

        // 3. Filter by Toolbar Buttons
        if (activeFilter === 'TODAY') {
            const today = new Date();
            const orderDate = new Date(o.createdAt);
            return today.getDate() === orderDate.getDate() && 
                   today.getMonth() === orderDate.getMonth() && 
                   today.getFullYear() === orderDate.getFullYear();
        }

        if (activeFilter === 'ACTIVE') {
            return o.status === 'GROOMING';
        }

        return true;
    });

    return (
        <Layout active="grooming">
            <div className="dashboard-header flex-between animate-fade-in" style={{ marginBottom: '32px', fontFamily: 'var(--font-body)' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'var(--font-heading)' }}>
                        Trung Tâm Grooming
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Quản lý quy trình làm đẹp, check-in/out hình ảnh chuyên nghiệp.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openCreateModal} style={{ borderRadius: '100px', padding: '12px 24px', boxShadow: '0 4px 15px var(--primary-glow)', fontFamily: 'var(--font-heading)' }}>
                    <Plus size={20} /> <span className="hide-on-mobile">TẠO ĐƠN MỚI</span>
                </button>
            </div>


            {/* ✦ Toast thông báo đơn grooming chờ — góc trên phải */}
            {!bannerDismissed && (() => {
                const waiting = orders.filter(o => o.status === 'BOOKED');
                if (waiting.length === 0) return null;
                return createPortal(
                    <>
                        <style>{`
                            @keyframes toastSlideIn {
                                from { transform: translateX(110%); opacity: 0; }
                                to   { transform: translateX(0);    opacity: 1; }
                            }
                            @keyframes toastSlideOut {
                                from { transform: translateX(0);    opacity: 1; }
                                to   { transform: translateX(110%); opacity: 0; }
                            }
                        `}</style>
                        <div style={{
                            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                            background: 'white',
                            borderRadius: '14px',
                            padding: '14px 16px',
                            boxShadow: '0 8px 32px rgba(8,145,178,0.18), 0 2px 8px rgba(0,0,0,0.08)',
                            border: '1.5px solid #bae6fd',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            maxWidth: '340px', minWidth: '260px',
                            animation: 'toastSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
                            fontFamily: 'var(--font-body)'
                        }}>
                            {/* Icon */}
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                                background: 'linear-gradient(135deg, #0891b2, #0e7490)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Sparkles size={20} color="white" />
                            </div>
                            {/* Nội dung */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0c4a6e' }}>
                                    {waiting.length} đơn grooming chờ check-in
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {waiting.map(o => o.customerId?.fullName || 'Khách').join(' • ')}
                                </div>
                            </div>
                            {/* Nút đóng */}
                            <button onClick={() => setBannerDismissed(true)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#94a3b8', padding: '2px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', borderRadius: '6px'
                            }}>
                                <X size={16} />
                            </button>
                        </div>
                    </>,
                    document.body
                );
            })()}

            <div style={{ display: 'flex', gap: '32px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', padding: '0 8px' }}>
                <button 
                    onClick={() => { setViewMode('ACTIVE'); setActiveFilter('ALL'); }}
                    style={{ 
                        padding: '12px 16px', 
                        background: 'none', 
                        border: 'none', 
                        borderBottom: viewMode === 'ACTIVE' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: viewMode === 'ACTIVE' ? 'var(--primary)' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        letterSpacing: '0.02em',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        fontFamily: 'var(--font-body)'
                    }}
                >
                    ĐƠN ĐANG THỰC HIỆN
                </button>
                <button 
                    onClick={() => { setViewMode('HISTORY'); setActiveFilter('ALL'); }}
                    style={{ 
                        padding: '12px 16px', 
                        background: 'none', 
                        border: 'none', 
                        borderBottom: viewMode === 'HISTORY' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: viewMode === 'HISTORY' ? 'var(--primary)' : '#94a3b8',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        letterSpacing: '0.02em',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        fontFamily: 'var(--font-body)'
                    }}
                >
                    LỊCH SỬ HOÀN TẤT
                </button>
            </div>

            {/* Toolbar Filter */}
            <div className="glass-card animate-slide-up" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#f8fafc',
                    padding: '10px 18px',
                    borderRadius: '100px',
                    border: '1px solid #e2e8f0',
                    flex: '1 1 300px'
                }}>
                    <Search size={18} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Tìm theo Mã đơn, Khách hàng, Tên thú..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'none', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        className={`btn ${activeFilter === 'ALL' ? 'btn-primary' : ''}`} 
                        style={{ borderRadius: '100px', border: activeFilter === 'ALL' ? 'none' : '1px solid #e2e8f0', background: activeFilter === 'ALL' ? 'var(--primary)' : 'white', fontSize: '0.85rem', color: activeFilter === 'ALL' ? 'white' : '#64748b' }}
                        onClick={() => setActiveFilter('ALL')}
                    >
                        Tất cả
                    </button>
                    <button 
                        className={`btn ${activeFilter === 'TODAY' ? 'btn-primary' : ''}`} 
                        style={{ borderRadius: '100px', border: activeFilter === 'TODAY' ? 'none' : '1px solid #e2e8f0', background: activeFilter === 'TODAY' ? 'var(--primary)' : 'white', fontSize: '0.85rem', color: activeFilter === 'TODAY' ? 'white' : '#64748b' }}
                        onClick={() => setActiveFilter('TODAY')}
                    >
                        Hôm nay
                    </button>
                    <button 
                        className={`btn ${activeFilter === 'ACTIVE' ? 'btn-primary' : ''}`} 
                        style={{ borderRadius: '100px', border: activeFilter === 'ACTIVE' ? 'none' : '1px solid #e2e8f0', background: activeFilter === 'ACTIVE' ? 'var(--primary)' : 'white', fontSize: '0.85rem', color: activeFilter === 'ACTIVE' ? 'white' : '#64748b' }}
                        onClick={() => setActiveFilter('ACTIVE')}
                    >
                        Đang thực hiện
                    </button>
                </div>
            </div>

            {/* ── Lịch hẹn Grooming từ booking chưa tạo đơn ── */}
            {viewMode === 'ACTIVE' && groomingApts.length > 0 && (
                <div style={{ marginBottom: '28px' }} className="animate-slide-up">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Calendar size={20} color="#7c3aed" />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#7c3aed' }}>
                            LỊCH HẸN GROOMING CHỜ XỬ LÝ ({groomingApts.length})
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
                        {groomingApts.map(apt => (
                            <div key={apt._id} style={{
                                background: 'white', borderRadius: '16px',
                                border: '2px dashed #8b5cf6', padding: '16px 18px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                                boxShadow: '0 2px 8px rgba(124,58,237,0.08)'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                        {apt.petId?.name || 'Thú cưng'} {apt.petId?.species === 'DOG' ? '🐶' : apt.petId?.species === 'CAT' ? '🐱' : ''}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                                        {apt.customerId?.fullName} — {apt.customerId?.phoneNumber}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#8b5cf6', marginTop: '4px', fontWeight: 600 }}>
                                        🕐 {apt.timeSlot} • {new Date(apt.date).toLocaleDateString('vi-VN')}
                                    </div>
                                    {apt.customerNotes && (
                                        <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '6px', background: '#fef3c7', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fde68a', fontStyle: 'italic', display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '2px' }}>Khách hàng ghi chú:</span>
                                            {apt.customerNotes}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: apt.status === 'ARRIVED' ? '#d97706' : '#6366f1', marginTop: '8px', fontWeight: 700 }}>
                                        {apt.status === 'ARRIVED' ? '📍 Đã đến — Chờ tạo đơn' : '⚙️ Đang xử lý'}
                                    </div>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ background: '#7c3aed', borderRadius: '10px', padding: '9px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                                    onClick={() => handleAutoCreateFromAppointment(apt)}
                                >
                                    <Sparkles size={14} /> Tạo Đơn
                                </button>
                            </div>
                        ))}
                    </div>
                    <div style={{ borderBottom: '1px dashed #e2e8f0', marginTop: '20px' }} />
                </div>
            )}

            {/* Danh sách đơn hàng */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }} className="animate-slide-up">
                {loading ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px' }}>Đang tải dữ liệu...</div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', background: 'white', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
                        <Sparkles size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                        <p style={{ color: '#94a3b8' }}>Chưa có đơn Grooming nào được ghi nhận.</p>
                    </div>
                ) : filteredOrders.map(order => {
                    const status = getStatusInfo(order.status);
                    return (
                        <div key={order._id} className="glass-card" style={{ padding: 0, overflow: 'hidden', borderBottom: `6px solid ${status.color}` }}>
                            <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-body)' }}>
                                <div 
                                    onClick={() => openDetailModal(order)}
                                    style={{ fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                    className="hover-primary"
                                >
                                    {order.orderId}
                                    <ChevronRight size={18} color="var(--primary)" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        padding: '6px 12px',
                                        borderRadius: '100px',
                                        background: status.bg,
                                        color: status.color,
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontFamily: 'var(--font-body)'
                                    }}>
                                        {status.icon} {status.label}
                                    </div>
                                </div>
                                {order.isPaid && (
                                    <div style={{
                                        padding: '6px 12px',
                                        borderRadius: '100px',
                                        background: '#f0fdf4',
                                        color: '#16a34a',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        border: '1px solid #bbf7d0',
                                        marginLeft: '8px'
                                    }}>
                                        ĐÃ THANH TOÁN
                                    </div>
                                )}
                                {!order.isPaid && (
                                    <div style={{
                                        padding: '6px 12px',
                                        borderRadius: '100px',
                                        background: '#fff7ed',
                                        color: '#c2410c',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        border: '1px solid #ffedd5',
                                        marginLeft: '8px'
                                    }}>
                                        CHỜ THANH TOÁN
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                        {order.customerId?.fullName.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{order.customerId?.fullName}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{order.customerId?.phoneNumber}</div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {order.dogCount > 0 && (
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #d1fae5' }}>
                                                        <Dog size={12} /> {order.dogCount} CHÓ
                                                    </div>
                                                )}
                                                {order.catCount > 0 && (
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #fee2e2' }}>
                                                        <Cat size={12} /> {order.catCount} MÈO
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {[...new Set(order.pets.flatMap(p => p.services || []).map(s => s.name))].map((svcName, sIdx) => (
                                            <span key={sIdx} style={{ padding: '4px 12px', background: '#f8fafc', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', border: '1px solid #eef2f5' }}>
                                                {svcName}
                                            </span>
                                        ))}
                                    </div>
                                    {order.notes && (
                                        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', borderLeft: '3px solid #f59e0b', fontSize: '0.85rem', color: '#b45309' }}>
                                            <strong style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '2px' }}>Ghi chú dặn dò:</strong>
                                            <span style={{ fontStyle: 'italic' }}>"{order.notes}"</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
                                    {order.status === 'BOOKED' && (
                                        <button className="btn btn-primary" style={{ gridColumn: '1/-1', padding: '12px' }} onClick={() => { setActiveOrder(order); setUploadType('BEFORE'); setCompletionNotes(''); setIsUploadModalOpen(true); }}>
                                            <Camera size={18} /> CHECK-IN VỚI ẢNH
                                        </button>
                                    )}
                                    {order.status === 'GROOMING' && (
                                        <button className="btn btn-primary" style={{ gridColumn: '1/-1', padding: '12px', background: '#10b981' }} onClick={() => { setActiveOrder(order); setUploadType('AFTER'); setCompletionNotes(''); setIsUploadModalOpen(true); }}>
                                            <Camera size={18} /> CHECK-OUT HOÀN TẤT
                                        </button>
                                    )}
                                    {order.status === 'COMPLETED' && (
                                        <>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>TRƯỚC</div>
                                                <img 
                                                    src={order.beforeImage} 
                                                    alt="Before" 
                                                    style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer' }} 
                                                    onClick={() => setPreviewImage(order.beforeImage)}
                                                />
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>SAU</div>
                                                <img 
                                                    src={order.afterImage} 
                                                    alt="After" 
                                                    style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer' }} 
                                                    onClick={() => setPreviewImage(order.afterImage)}
                                                />
                                            </div>
                                        </>
                                    )}
                                    {order.status !== 'COMPLETED' && !order.isPaid && (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '4px' }}>
                                            <button 
                                                type="button" 
                                                onClick={() => openDeleteModal(order)}
                                                style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                Xóa đơn hàng nhầm
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Create Order */}
            {isCreateModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '800px', padding: 0, borderRadius: '24px' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Tạo Đơn Grooming Mới</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
                        </div>
                        <form className="modal-body" style={{ padding: '24px 32px' }} onSubmit={handleCreateOrder}>
                            <div className="grid grid-cols-1 md:grid-cols-12" style={{ gap: '32px' }}>
                                {/* Cột trái: Tìm & Chọn (4 phần) */}
                                <div className="md:col-span-4" style={{ height: 'fit-content', borderRight: '1px solid #eef2f5', paddingRight: '20px' }}>
                                    <div className="form-group" style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <label style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Chọn khách hàng *</label>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setShowQuickCreate(!showQuickCreate);
                                                    setSelectedCustomer(null);
                                                    setCustomerPets([]);
                                                }}
                                                style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                            >
                                                {showQuickCreate ? 'Hủy' : '+ Khách mới'}
                                            </button>
                                        </div>

                                        {!showQuickCreate ? (
                                            <select
                                                className="input-field"
                                                value={selectedCustomer?._id || ''}
                                                onChange={(e) => handleSelectCustomer(customers.find(c => c._id === e.target.value))}
                                                required={!showQuickCreate}
                                            >
                                                <option value="">-- Tìm khách hàng --</option>
                                                {customers.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.phoneNumber})</option>)}
                                            </select>
                                        ) : (
                                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }} className="animate-fade-in">
                                                <input 
                                                    type="text" 
                                                    className="input-field" 
                                                    style={{ marginBottom: '8px' }}
                                                    placeholder="Tên khách hàng..."
                                                    value={quickCustForm.fullName}
                                                    onChange={(e) => setQuickCustForm({...quickCustForm, fullName: e.target.value})}
                                                />
                                                <input 
                                                    type="text" 
                                                    className="input-field" 
                                                    placeholder="Số điện thoại..."
                                                    value={quickCustForm.phoneNumber}
                                                    onChange={(e) => setQuickCustForm({...quickCustForm, phoneNumber: e.target.value})}
                                                    style={{ marginBottom: '12px' }}
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn btn-primary" 
                                                    style={{ width: '100%', height: '36px', fontSize: '0.85rem' }}
                                                    onClick={handleAddQuickCustomer}
                                                >
                                                    XÁC NHẬN KHÁCH
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <label style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Chọn bé thực hiện *</label>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowQuickPet(!showQuickPet)}
                                                style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                            >
                                                {showQuickPet ? 'Hủy' : '+ Thêm thú mới'}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                                            {customerPets.map(pet => {
                                                const isSelected = orderData.pets.some(p => p.petId === pet._id);
                                                return (
                                                    <div
                                                        key={pet._id}
                                                        onClick={() => togglePet(pet)}
                                                        style={{
                                                            padding: '10px 14px',
                                                            borderRadius: '12px',
                                                            border: `2px solid ${isSelected ? 'var(--primary)' : '#e2e8f0'}`,
                                                            background: isSelected ? 'var(--primary-glow)' : 'white',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: pet.species === 'DOG' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {pet.species === 'DOG' ? <Dog size={16} color="#16a34a" /> : <Cat size={16} color="#ef4444" />}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{pet.name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                                {pet.breed || pet.species} 
                                                                {pet.weight ? ` • ${pet.weight}kg` : ''}
                                                            </div>
                                                        </div>
                                                        {isSelected && <CheckCircle2 size={18} color="var(--primary)" />}
                                                    </div>
                                                );
                                            })}
                                            
                                            {showQuickPet && (
                                                <div style={{ background: '#fff1f2', padding: '12px', borderRadius: '12px', border: '1px solid #fecdd3' }} className="animate-fade-in">
                                                    <input 
                                                        type="text" 
                                                        className="input-field" 
                                                        style={{ marginBottom: '8px', height: '36px', fontSize: '0.85rem' }}
                                                        placeholder="Tên thú mới..."
                                                        value={quickPetForm.name}
                                                        onChange={(e) => setQuickPetForm({...quickPetForm, name: e.target.value})}
                                                    />
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <select 
                                                            className="input-field" 
                                                            style={{ flex: 1, height: '36px', fontSize: '0.85rem' }}
                                                            value={quickPetForm.species}
                                                            onChange={(e) => setQuickPetForm({...quickPetForm, species: e.target.value})}
                                                        >
                                                            <option value="DOG">Chó</option>
                                                            <option value="CAT">Mèo</option>
                                                        </select>
                                                        <input 
                                                            type="number" 
                                                            className="input-field" 
                                                            style={{ flex: 1, height: '36px', fontSize: '0.85rem' }}
                                                            placeholder="Cân kg"
                                                            value={quickPetForm.weight}
                                                            onChange={(e) => setQuickPetForm({...quickPetForm, weight: e.target.value})}
                                                        />
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-primary" 
                                                        style={{ width: '100%', height: '36px', marginTop: '12px', fontSize: '0.85rem', background: '#ef4444' }}
                                                        onClick={handleAddQuickPet}
                                                    >
                                                        XÁC NHẬN BÉ
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {!selectedCustomer && !showQuickCreate && (
                                                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                    Vui lòng chọn khách trước
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Cột phải: Cấu hình chi tiết (8 phần) */}
                                <div className="md:col-span-8">
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>
                                        CHI TIẾT ĐIỀU PHỐI ({orderData.pets.length})
                                    </div>

                                    <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '10px' }}>
                                        {orderData.pets.length === 0 ? (
                                            <div style={{ background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: '24px', padding: '60px 40px', textAlign: 'center' }}>
                                                <Dog size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                                <p style={{ color: '#94a3b8', fontWeight: 600 }}>Chưa có bé nào được chọn.</p>
                                                <p style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Chọn thú cưng ở cột bên trái để bắt đầu cấu hình dịch vụ.</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                {orderData.pets.map(p => (
                                                    <div key={p.petId} className="glass-card" style={{ padding: '20px', borderRadius: '20px', border: '1px solid #eef2f5', background: 'white' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {p.species === 'DOG' ? <Dog size={18} /> : <Cat size={18} />}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Chọn dịch vụ cho bé này</div>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ position: 'relative', width: '90px' }}>
                                                                    <input 
                                                                        type="number" 
                                                                        className="input-field" 
                                                                        style={{ height: '36px', paddingRight: '30px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 700 }}
                                                                        placeholder="Cân"
                                                                        value={p.weightAtVisit}
                                                                        onChange={(e) => updatePetData(p.petId, 'weightAtVisit', e.target.value)}
                                                                    />
                                                                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8' }}>kg</span>
                                                                </div>
                                                                <button type="button" onClick={() => togglePet({ _id: p.petId })} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                                            {groomingServices.map(svc => {
                                                                const isSelected = p.services.some(s => s.serviceId === svc._id);
                                                                return (
                                                                    <div
                                                                        key={svc._id}
                                                                        onClick={() => toggleServiceForPet(p.petId, svc)}
                                                                        style={{
                                                                            padding: '8px 12px',
                                                                            borderRadius: '12px',
                                                                            border: `1.5px solid ${isSelected ? 'var(--primary)' : '#e2e8f0'}`,
                                                                            background: isSelected ? 'var(--primary)' : 'transparent',
                                                                            color: isSelected ? 'white' : '#64748b',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 700,
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s',
                                                                        }}
                                                                    >
                                                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {svc.name}
                                                                        </div>
                                                                        <div style={{ fontSize: '0.65rem', opacity: isSelected ? 0.9 : 0.6 }}>{svc.price?.toLocaleString()}đ</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        
                                                        <div style={{ marginTop: '14px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>
                                                            Tạm tính: {p.services.reduce((sum, s) => sum + s.price, 0).toLocaleString()}đ
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group" style={{ marginTop: '20px' }}>
                                        <textarea
                                            className="input-field"
                                            rows="2"
                                            placeholder="Ghi chú đặc biệt (vd: cắt tỉa đuôi, gỡ rối kỹ...)"
                                            value={orderData.notes}
                                            onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                                            style={{ resize: 'none', fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    {/* Tổng kết cuối cùng */}
                                    <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '16px 24px', borderRadius: '20px', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>Tổng hóa đơn sơ bộ</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
                                                {orderData.pets.reduce((sum, p) => sum + p.services.reduce((sSum, svc) => sSum + svc.price, 0), 0).toLocaleString()}đ
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '100px', border: 'none', padding: '8px 20px' }} onClick={() => setIsCreateModalOpen(false)}>Hủy</button>
                                            <button type="submit" className="btn btn-primary" style={{ borderRadius: '100px', padding: '8px 24px', fontWeight: 800 }}>XÁC NHẬN</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Upload Image */}
            {isUploadModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3100 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '500px', padding: '40px', textAlign: 'center', borderRadius: '32px' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <ImageIcon size={32} />
                        </div>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 800 }}>
                            {uploadType === 'BEFORE' ? 'Check-in Grooming' : 'Hoàn tất Grooming'}
                        </h3>
                        <p style={{ color: '#64748b', marginBottom: '32px', lineHeight: 1.6 }}>
                            {uploadType === 'BEFORE'
                                ? 'Vui lòng chụp 1 tấm ảnh tình trạng các bé trước khi thực hiện quy trình spa.'
                                : 'Vui lòng chụp 1 tấm ảnh thành quả sau khi các bé đã được làm đẹp xong.'}
                        </p>

                        {uploadType === 'AFTER' && (
                            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Ghi chú sau khi làm (Không bắt buộc)</label>
                                <textarea 
                                    value={completionNotes}
                                    onChange={(e) => setCompletionNotes(e.target.value)}
                                    placeholder="Ví dụ: Bé ngoan, Đã vệ sinh tai kỹ..."
                                    style={{ width: '100%', minHeight: '80px', padding: '12px 16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.95rem', resize: 'none', transition: 'all 0.2s', outline: 'none' }}
                                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                />
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Sparkles size={12} /> Nhập ghi chú trước khi bấm tải ảnh lên để lưu thông tin.
                                </div>
                            </div>
                        )}

                        <input
                            type="file"
                            id="grooming-upload"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />

                        <label
                            htmlFor="grooming-upload"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '16px', borderRadius: '100px', display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '1.1rem', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1 }}
                        >
                            {isUploading ? 'ĐANG TẢI ẢNH...' : (
                                <>
                                    <Camera size={24} /> CHỤP & TẢI ẢNH LÊN
                                </>
                            )}
                        </label>

                        <button
                            className="btn"
                            style={{ marginTop: '16px', background: 'none', color: '#94a3b8', fontWeight: 600 }}
                            onClick={() => setIsUploadModalOpen(false)}
                            disabled={isUploading}
                        >
                            Đóng lại
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {/* Modal Nhập lý do xóa */}
            {isDeleteModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3200 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '450px', padding: '32px', borderRadius: '28px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Trash2 size={28} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>Xác nhận xóa đơn hàng</h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '8px' }}>Mã đơn: <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{orderToDelete?.orderId}</span></p>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Lý do xóa đơn hàng <span style={{ color: '#ef4444' }}>*</span></label>
                            <textarea 
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                placeholder="Ví dụ: Khách hủy đơn, Tạo nhầm thú cưng..."
                                style={{ width: '100%', minHeight: '100px', padding: '12px 16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.95rem', resize: 'none', transition: 'all 0.2s', outline: 'none' }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <button 
                                className="btn" 
                                style={{ padding: '12px', borderRadius: '100px', background: '#f1f5f9', color: '#64748b', fontWeight: 700 }}
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                            >
                                HỦY BỎ
                            </button>
                            <button 
                                className="btn" 
                                style={{ padding: '12px', borderRadius: '100px', background: '#ef4444', color: 'white', fontWeight: 700, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
                                onClick={confirmDeleteOrder}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'ĐANG XÓA...' : 'XÁC NHẬN XÓA'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Chi tiết đơn hàng Grooming */}
            {isDetailModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3300 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '600px', padding: 0, borderRadius: '28px' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 900, fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Chi Tiết Đơn Grooming</h3>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{activeDetailOrder?.orderId}</div>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
                        </div>

                        <div className="modal-body" style={{ padding: '32px', fontFamily: 'var(--font-body)' }}>
                            {/* Thông tin khách hàng */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', gap: '12px', padding: '12px', background: '#f1f5f9', borderRadius: '16px', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800, fontSize: '1rem' }}>
                                        {activeDetailOrder?.customerId?.fullName.charAt(0)}
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeDetailOrder?.customerId?.fullName}</div>
                                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{activeDetailOrder?.customerId?.phoneNumber}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', padding: '12px', background: '#ecfdf5', borderRadius: '16px', alignItems: 'center', border: '1px solid #d1fae5' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                        <User size={20} />
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Groomer phụ trách</div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#064e3b' }}>{activeDetailOrder?.staffId?.fullName || 'Chưa nhận ca'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Danh sách thú cưng và dịch vụ */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thú cưng thực hiện</label>
                                {activeDetailOrder?.pets.map((pet, pIdx) => (
                                    <div key={pIdx} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '20px', background: 'white' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {pet.species === 'DOG' ? <Dog size={20} /> : <Cat size={20} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#1e293b' }}>{pet.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{pet.species === 'DOG' ? 'Chó' : 'Mèo'} • {pet.weightAtVisit}kg</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {pet.services.map((svc, sIdx) => (
                                                <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '12px' }}>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <CheckCircle2 size={14} color="var(--primary)" /> {svc.name}
                                                    </div>
                                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{svc.price.toLocaleString()}đ</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Ghi chú đặt đơn */}
                            <div style={{ marginTop: '32px' }}>
                                <div style={{ padding: '16px', background: '#f1f5f9', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Ghi chú đặt đơn</div>
                                    <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>{activeDetailOrder?.notes || 'Không có ghi chú'}</div>
                                </div>
                            </div>

                            {/* Lịch sử hình ảnh & Ghi chú hoàn tất */}
                            {(activeDetailOrder?.beforeImage || activeDetailOrder?.afterImage) && (
                                <div style={{ marginTop: '32px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '16px' }}>Lịch sử thực hiện & Hình ảnh</label>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                        {activeDetailOrder.beforeImage && (
                                            <div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>TRƯỚC (CHECK-IN)</span>
                                                    <span>{new Date(activeDetailOrder.checkinTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <img 
                                                    src={activeDetailOrder.beforeImage} 
                                                    alt="Before" 
                                                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer' }} 
                                                    onClick={() => setPreviewImage(activeDetailOrder.beforeImage)}
                                                />
                                            </div>
                                        )}
                                        {activeDetailOrder.afterImage && (
                                            <div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>SAU (CHECK-OUT)</span>
                                                    <span>{new Date(activeDetailOrder.checkoutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <img 
                                                    src={activeDetailOrder.afterImage} 
                                                    alt="After" 
                                                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '16px', border: '1px solid #059669', cursor: 'pointer' }} 
                                                    onClick={() => setPreviewImage(activeDetailOrder.afterImage)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {activeDetailOrder.completionNotes && (
                                        <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '16px', border: '1px solid #d1fae5' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '4px' }}>Ghi chú sau khi hoàn tất</div>
                                            <div style={{ fontSize: '0.9rem', color: '#064e3b', fontWeight: 600, fontStyle: 'italic' }}>"{activeDetailOrder.completionNotes}"</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', textAlign: 'right', background: '#f8fafc' }}>
                            <button className="btn btn-primary" style={{ padding: '12px 32px', borderRadius: '100px' }} onClick={() => setIsDetailModalOpen(false)}>ĐÓNG LẠI</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Phóng to ảnh (V2: Zoom & Pan) */}
            {previewImage && createPortal(
                <div 
                    className="modal-overlay animate-fade-in" 
                    style={{ zIndex: 4000, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)', overflow: 'hidden', touchAction: 'none' }}
                    onWheel={(e) => {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.25 : 0.25;
                        setZoomScale(prev => Math.min(Math.max(1, prev + delta), 5));
                    }}
                    onMouseMove={(e) => {
                        if (!isDragging) return;
                        setDragPos({
                            x: e.clientX - startPos.x,
                            y: e.clientY - startPos.y
                        });
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                >
                    {/* Toolbar */}
                    <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '12px 28px', borderRadius: '100px', backdropFilter: 'blur(20px)', fontSize: '0.9rem', fontWeight: 700, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '15px', zIndex: 4001, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={18} /> Lăn chuột: Zoom • Nhấp giữ: Kéo ảnh</div>
                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '4px 12px', background: 'var(--primary)', borderRadius: '100px', fontSize: '0.8rem' }}>{Math.round(zoomScale * 100)}%</div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setZoomScale(1); setDragPos({ x: 0, y: 0 }); }}
                                style={{ pointerEvents: 'auto', background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '100px', padding: '4px 14px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                                RESET
                            </button>
                        </div>
                    </div>

                    {/* Nút đóng */}
                    <button 
                        onClick={() => { setPreviewImage(null); setZoomScale(1); setDragPos({ x: 0, y: 0 }); }}
                        style={{ position: 'fixed', top: '24px', right: '24px', background: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 4002 }}
                    >
                        <X size={28} color="#1e293b" />
                    </button>

                    {/* Vùng hiển thị ảnh */}
                    <div 
                        style={{ 
                            width: '100vw', 
                            height: '100vh',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isDragging ? 'grabbing' : zoomScale > 1 ? 'grab' : 'default',
                        }}
                        onMouseDown={(e) => {
                            if (zoomScale <= 1 && e.target.tagName !== 'IMG') {
                                setPreviewImage(null);
                                return;
                            }
                            setIsDragging(true);
                            setStartPos({
                                x: e.clientX - dragPos.x,
                                y: e.clientY - dragPos.y
                            });
                        }}
                    >
                        <img 
                            src={previewImage} 
                            alt="PreviewLarge" 
                            style={{ 
                                maxHeight: '85vh',
                                maxWidth: '90vw',
                                borderRadius: '16px',
                                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: `translate(${dragPos.x}px, ${dragPos.y}px) scale(${zoomScale})`,
                                userSelect: 'none',
                                pointerEvents: 'none' // Để dragPos được xử lý bởi div cha
                            }} 
                        />
                    </div>
                </div>,
                document.body
            )}
        </Layout>
    );
};

export default Grooming;
