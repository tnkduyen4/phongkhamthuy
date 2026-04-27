import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { Edit, Search, X, User, PawPrint, Edit2, Trash2, Plus, Sparkles, ExternalLink, History as LogsIcon, ChevronRight, ArrowRight } from 'lucide-react';
import { PetQuickView } from '../components/QuickViews';
const Users = () => {
    const [customers, setCustomers] = useState([]);
    const [allPets, setAllPets] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();
    const [showArchived, setShowArchived] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userPetsDetail, setUserPetsDetail] = useState([]);

    const [formData, setFormData] = useState({ fullName: '', phoneNumber: '', email: '' });
    const [editingUserId, setEditingUserId] = useState(null); // Quản lý trạng thái Sửa
    const [showHistory, setShowHistory] = useState(false);

    // State cho Thú cưng
    const [petData, setPetData] = useState({ name: '', species: 'DOG', weight: '', age: '', breed: '' });
    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
    const [rankFilter, setRankFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('RANK'); // 'RANK' or 'ABC'

    const [quickViewPetId, setQuickViewPetId] = useState(null);
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem('token');
            const url = `http://localhost:5000/api/v1/users?role=CUSTOMER${showArchived ? '&includeInactive=true' : ''}`;
            const usersRes = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

            if (usersRes.data.success) {
                setCustomers(usersRes.data.data);
                setSelectedUserIds([]);
            }
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu CRM:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Handle Deep Link
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get('id');
        if (urlId) {
            const findAndOpen = async () => {
                const token = sessionStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/v1/users/${urlId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.success) {
                    handleOpenDetailModal(res.data.data);
                }
            };
            findAndOpen();
        }
    }, [showArchived]);

    const handleOpenModal = () => {
        setEditingUserId(null); // Reset chế độ Edit
        setFormData({ fullName: '', phoneNumber: '', email: '' });
        setPetData({ name: '', species: 'DOG', weight: '', age: '', breed: '' });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleOpenDetailModal = async (user) => {
        setIsDetailModalOpen(true);
        try {
            const token = sessionStorage.getItem('token');
            
            // Lấy chi tiết user để có editHistory
            const userRes = await axios.get(`http://localhost:5000/api/v1/users/${user._id || user}`, { headers: { Authorization: `Bearer ${token}` } });
            if (userRes.data.success) {
                setSelectedUser(userRes.data.data);
            } else {
                setSelectedUser(user);
            }

            const res = await axios.get(`http://localhost:5000/api/v1/pets?ownerId=${user._id || user}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setUserPetsDetail(res.data.data);
            }
        } catch (error) {
            console.error("Lỗi khi tải chi tiết khách hàng:", error);
            if (!selectedUser) setSelectedUser(user);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedUser(null);
        setUserPetsDetail([]);
        setShowHistory(false);
    };

    const handleEditCustomer = () => {
        // Đẩy dữ liệu vào Form
        setFormData({
            fullName: selectedUser.fullName,
            phoneNumber: selectedUser.phoneNumber,
            email: selectedUser.email || ''
        });
        setEditingUserId(selectedUser._id);
        setErrorMsg('');
        setIsModalOpen(true);
        handleCloseDetailModal();
    };

    const handleDeleteCustomer = async (userToDelete = null) => {
        const targetUser = userToDelete || selectedUser;
        try {
            const token = sessionStorage.getItem('token');
            // Check if user has relations
            const checkRes = await axios.get(`http://localhost:5000/api/v1/users/${targetUser._id}/check-delete`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const hasRelations = checkRes.data.hasRelations;

            if (hasRelations) {
                // Có dữ liệu liên kết -> Chỉ cho phép Soft Delete (Lưu trữ)
                showConfirm(
                    'Ngừng Hoạt Động Khách Hàng',
                    `Khách hàng ${targetUser.fullName} đang có các dữ liệu liên quan (Hóa đơn, Bệnh án...). Hệ thống không thể xóa vĩnh viễn để bảo toàn dữ liệu.\n\nBạn có muốn NGƯNG HOẠT ĐỘNG (Lưu trữ vào thùng rác) khách hàng này không?`,
                    async () => {
                        try {
                            const res = await axios.delete(`http://localhost:5000/api/v1/users/${targetUser._id}`, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data.success) {
                                showToast('Đã lưu trữ hồ sơ khách hàng thành công!');
                                handleCloseDetailModal();
                                fetchData();
                            }
                        } catch (error) {
                            showToast(error.response?.data?.message || 'Có lỗi xảy ra khi lưu trữ.', 'error');
                        }
                    }
                );
            } else {
                // Không có dữ liệu liên kết -> Cho phép Hard Delete
                showConfirm(
                    'Xóa Vĩnh Viễn Khách Hàng',
                    `Khách hàng ${targetUser.fullName} không có liên kết nào quan trọng trong hệ thống.\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN khách hàng này không? Dữ liệu sẽ không thể khôi phục.`,
                    async () => {
                        try {
                            const res = await axios.delete(`http://localhost:5000/api/v1/users/${targetUser._id}?force=true`, { headers: { Authorization: `Bearer ${token}` } });
                            if (res.data.success) {
                                showToast('Đã xóa vĩnh viễn khách hàng thành công!');
                                handleCloseDetailModal();
                                fetchData();
                            }
                        } catch (error) {
                            showToast(error.response?.data?.message || 'Có lỗi xảy ra khi xoá vĩnh viễn.', 'error');
                        }
                    }
                );
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra dữ liệu khách hàng:', error);
            showToast('Không thể kiểm tra dữ liệu khách hàng. Vui lòng thử lại.', 'error');
        }
    };

    const handleBulkDelete = () => {
        showConfirm(
            'Xóa Nhiều Khách Hàng',
            `Bạn đang chọn ${selectedUserIds.length} khách hàng.\n\nHệ thống sẽ tự động lưu trữ (Ngừng hoạt động) các khách hàng có dữ liệu liên kết và xóa vĩnh viễn các hồ sơ trống.\n\nBạn có chắc chắn muốn thực hiện?`,
            async () => {
                try {
                    const token = sessionStorage.getItem('token');
                    const res = await axios.post('http://localhost:5000/api/v1/users/bulk-delete', { userIds: selectedUserIds }, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) {
                        showToast(res.data.message);
                        fetchData();
                    }
                } catch (error) {
                    showToast(error.response?.data?.message || 'Lỗi khi xóa hàng loạt', 'error');
                }
            }
        );
    };

    const handleRestoreCustomer = async (userId) => {
        showConfirm(
            'Khôi Phục Hoạt Động',
            'Khôi phục hoạt động cho khách hàng này?',
            async () => {
                try {
                    const token = sessionStorage.getItem('token');
                    const res = await axios.patch(`http://localhost:5000/api/v1/users/${userId}/reactivate`, {}, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) {
                        showToast('Đã khôi phục khách hàng thành công!');
                        fetchData();
                    }
                } catch (error) {
                    showToast(error.response?.data?.message || 'Lỗi khôi phục.', 'error');
                }
            }
        );
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePetChange = (e) => {
        setPetData({ ...petData, [e.target.name]: e.target.value });
    };

    const validatePhone = (phone) => {
        const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
        return phoneRegex.test(phone);
    };

    const validateEmail = (email) => {
        if (!email) return true; // Hoàn toàn hợp lệ nếu bỏ trống
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmitCustomer = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        setErrorMsg('');

        // Validation định dạng
        if (!validatePhone(formData.phoneNumber)) {
            setErrorMsg('Số điện thoại không hợp lệ (Phải có 10 chữ số, đầu số Việt Nam 03, 05, 07, 08, 09).');
            setSubmitLoading(false);
            return;
        }

        if (formData.email && !validateEmail(formData.email)) {
            setErrorMsg('Định dạng Email không hợp lệ.');
            setSubmitLoading(false);
            return;
        }

        if (!editingUserId && petData.name) {
            if (petData.age && (isNaN(petData.age) || Number(petData.age) < 0 || Number(petData.age) > 50)) {
                setErrorMsg('Tuổi thú cưng không hợp lệ (Phải từ 0 - 50 tuổi).');
                setSubmitLoading(false);
                return;
            }
            if (petData.weight && (isNaN(petData.weight) || Number(petData.weight) < 0.1 || Number(petData.weight) > 200)) {
                setErrorMsg('Cân nặng không hợp lệ (Phải từ 0.1 - 200 kg).');
                setSubmitLoading(false);
                return;
            }
        }

        try {
            const token = sessionStorage.getItem('token');

            if (editingUserId) {
                // API SỬA THÔNG TIN KHÁCH HÀNG (PUT)
                const res = await axios.put(`http://localhost:5000/api/v1/users/${editingUserId}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setIsModalOpen(false);
                    setEditingUserId(null); // Reset
                    fetchData();
                }
            } else {
                // API TẠO KHÁCH HÀNG MỚI (POST Register)
                const res = await axios.post('http://localhost:5000/api/v1/auth/register', { ...formData, password: 'app_user_password' });
                if (res.data.success) {
                    const newUserId = res.data.data._id;

                    // LIÊN KẾT THÚ CƯNG (Bắt buộc nếu có nhập tên)
                    if (petData.name) {
                        const finalToken = token || res.data.data.token;
                        const petPayload = { ...petData, ownerId: newUserId };
                        await axios.post('http://localhost:5000/api/v1/pets', petPayload, {
                            headers: { Authorization: `Bearer ${finalToken}` }
                        });
                    }
                    setIsModalOpen(false);
                    fetchData();
                }
            }
        } catch (error) {
            setErrorMsg(error.response?.data?.message || 'Có lỗi xảy ra khi lưu dữ liệu.');
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <Layout>
            <div className="dashboard-header animate-fade-in" style={{ marginBottom: '32px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', margin: 0 }}>Khách Hàng</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Quản lý hồ sơ chủ nuôi thú cưng (Customers CRM).
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="input-with-icon" style={{ flex: '1 1 200px', maxWidth: '400px', marginBottom: 0 }}>
                        <Search size={18} className="input-icon" />
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Tìm tên/SĐT..."
                            style={{ height: '42px', marginBottom: '0' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <select
                            style={{
                                height: '42px',
                                padding: '0 40px 0 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                background: '#fff',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                width: 'auto',
                                minWidth: '180px'
                            }}
                            value={rankFilter}
                            onChange={(e) => setRankFilter(e.target.value)}
                        >
                            <option value="ALL">Tất cả hạng</option>
                            <option value="DIAMOND">Kim Cương</option>
                            <option value="GOLD">Vàng</option>
                            <option value="SILVER">Bạc</option>
                            <option value="MEMBER">Thành viên</option>
                        </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <select
                            style={{
                                height: '42px',
                                padding: '0 40px 0 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                background: '#fff',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                width: 'auto',
                                minWidth: '160px'
                            }}
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="RANK">Sắp xếp: Hạng</option>
                            <option value="ABC">Sắp xếp: Tên A-Z</option>
                        </select>
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button className="btn" style={{ height: '42px', background: showArchived ? '#fef2f2' : 'white', color: showArchived ? '#ef4444' : '#64748b', border: showArchived ? '1px solid #fca5a5' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '0 16px' }} onClick={() => setShowArchived(!showArchived)}>
                            <Trash2 size={18} /> <span className="hide-on-mobile">{showArchived ? 'Đang xem Thùng rác' : 'Thùng rác'}</span>
                        </button>
                        {selectedUserIds.length > 0 && currentUser?.role === 'ADMIN' && (
                            <button className="btn" style={{ height: '42px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleBulkDelete}>
                                <Trash2 size={16} /> <span className="hide-on-mobile">Xóa {selectedUserIds.length} mục</span>
                            </button>
                        )}
                        <button className="btn btn-primary" style={{ height: '42px' }} onClick={handleOpenModal}>
                            + <span className="hide-on-mobile">Thêm Khách Hàng</span>
                        </button>
                    </div>
                </div>
            </div>

            {showArchived && (
                <div className="animate-fade-in" style={{ padding: '16px 20px', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '16px', color: '#b91c1c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                    <Trash2 size={24} /> 
                    <div>
                        <div style={{ fontSize: '1.05rem', marginBottom: '4px' }}>ĐANG XEM THÙNG RÁC</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 400 }}>Danh sách dưới đây chỉ hiển thị các hồ sơ khách hàng đã bị xóa.</div>
                    </div>
                </div>
            )}

            <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="table-responsive">
                    <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                            <tr>
                                <th style={{ padding: '16px 16px', width: '40px', textAlign: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const visibleIds = customers.map(c => c._id);
                                                setSelectedUserIds(visibleIds);
                                            } else {
                                                setSelectedUserIds([]);
                                            }
                                        }}
                                        checked={selectedUserIds.length > 0 && selectedUserIds.length === customers.length}
                                    />
                                </th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Khách Hàng</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Liên Hệ</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Hạng Thành Viên</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Điểm Tích Luỹ</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'right' }}>Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Đang quét danh bạ khách hàng...
                                    </td>
                                </tr>
                            ) : (() => {
                                // 1. Filter
                                let filtered = customers.filter(c => {
                                    if (showArchived && c.isActive !== false) return false;

                                    const matchSearch = c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        c.phoneNumber?.includes(searchTerm);

                                    const points = c.rewardPoints || 0;
                                    let rankKey = 'MEMBER';
                                    if (points >= 2000) rankKey = 'DIAMOND';
                                    else if (points >= 1000) rankKey = 'GOLD';
                                    else if (points >= 300) rankKey = 'SILVER';

                                    const matchRank = rankFilter === 'ALL' || rankFilter === rankKey;

                                    return matchSearch && matchRank;
                                });

                                // 2. Sort
                                if (sortBy === 'RANK') {
                                    filtered.sort((a, b) => (b.rewardPoints || 0) - (a.rewardPoints || 0));
                                } else {
                                    filtered.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'base' }));
                                }

                                if (filtered.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                {searchTerm || rankFilter !== 'ALL' ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có hồ sơ khách hàng nào trong hệ thống.'}
                                            </td>
                                        </tr>
                                    );
                                }

                                return filtered.map((user) => {
                                    const points = user.rewardPoints || 0;
                                    let rank = points >= 2000
                                        ? { label: 'Kim Cương', color: '#db2777', bg: '#fdf2f8' }
                                        : points >= 1000
                                        ? { label: 'Vàng', color: '#ca8a04', bg: '#fefce8' }
                                        : points >= 300
                                        ? { label: 'Bạc', color: '#475569', bg: '#f1f5f9' }
                                        : { label: 'Thành viên', color: '#16a34a', bg: '#f0fdf4' };

                                    return (
                                        <tr key={user._id} style={{ borderBottom: '1px solid #eef2f5', transition: 'var(--transition-fast)' }} className="table-row-hover">
                                            <td style={{ padding: '16px 16px', textAlign: 'center' }} data-label="Bật/Tắt Chọn" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                    checked={selectedUserIds.includes(user._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedUserIds([...selectedUserIds, user._id]);
                                                        else setSelectedUserIds(selectedUserIds.filter(id => id !== user._id));
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '16px 24px' }} data-label="Khách Hàng">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="avatar">
                                                        {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                                                    </div>
                                                    <div>
                                                        <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{user.fullName}</strong>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }} data-label="Liên Hệ">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>{user.phoneNumber}</span>
                                                    {user.email && <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>{user.email}</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px' }} data-label="Hạng Thành Viên">
                                                <span className="badge" style={{ background: rank.bg, color: rank.color, border: `1px solid ${rank.color}33`, fontWeight: 600 }}>
                                                    {rank.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', color: 'var(--text-main)' }} data-label="Điểm Tích Luỹ">
                                                <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{points}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>điểm</span>
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }} data-label="Thao Tác">
                                                {user.isActive === false ? (
                                                    <button className="btn btn-responsive" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRestoreCustomer(user._id)}>
                                                        <Plus size={16} /> <span className="hide-on-mobile">Khôi Phục</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-responsive" style={{ background: '#f8fafc', color: 'var(--primary)', border: '1px solid #eef2f5', padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleOpenDetailModal(user)}>
                                                            <Search size={16} /> <span className="hide-on-mobile">Chi Tiết</span>
                                                        </button>
                                                        {currentUser?.role === 'ADMIN' && (
                                                            <button 
                                                                className="btn btn-icon btn-responsive" 
                                                                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', padding: '6px 14px', fontSize: '0.85rem' }} 
                                                                onClick={() => handleDeleteCustomer(user)}
                                                            >
                                                                <Trash2 size={16} /> <span className="hide-on-mobile">Xóa</span>
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Thêm Khách Hàng */}
            {isModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{ width: '90%', maxWidth: editingUserId ? '500px' : '900px', background: 'white', padding: 0, borderRadius: '20px', overflow: 'hidden', transition: 'max-width 0.3s' }}>
                        <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                                {editingUserId ? 'Cập Nhật Hồ Sơ Khách Hàng' : 'Tiếp Nhận Hồ Sơ Khám Mới'}
                            </h3>
                            <button className="btn-icon" onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitCustomer}>
                            <div className="modal-body" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', padding: '1.5rem 2rem' }}>
                                {errorMsg && (
                                    <div style={{ background: 'var(--danger)', color: 'white', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                                        {errorMsg}
                                    </div>
                                )}

                                <div className={`grid grid-cols-1 ${!editingUserId ? 'md:grid-cols-2' : ''}`} style={{ gap: '32px' }}>
                                    {/* -- TRỤC TRÁI: KHÁCH HÀNG -- */}
                                    <div>
                                        <h4 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '16px', borderBottom: '2px solid #eef2f5', paddingBottom: '8px' }}>
                                            Thông tin Chủ Nuôi
                                        </h4>

                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Họ và Tên *</label>
                                            <input type="text" className="input-field" name="fullName" value={formData.fullName} onChange={handleInputChange} required placeholder="VD: Nguyễn Văn A" />
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Số ĐT (Zalo)*</label>
                                            <input type="text" className="input-field" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} required placeholder="Dùng tra cứu / tích điểm" />
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '24px' }}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Email (Tùy chọn)</label>
                                            <input type="email" className="input-field" name="email" value={formData.email} onChange={handleInputChange} placeholder="VD: email@example.com" />
                                        </div>
                                    </div>

                                    {/* -- TRỤC PHẢI: THÚ CƯNG (Chỉ hiện khi Thêm Mới) -- */}
                                    {!editingUserId && (
                                        <div className="mobile-divider" style={{ borderLeft: '1px dashed #cbd5e1', paddingLeft: '32px' }}>
                                            <h4 style={{ fontSize: '1.05rem', color: 'var(--primary)', marginBottom: '16px', borderBottom: '2px solid var(--primary-light)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                Tiếp nhận Thú Cưng
                                            </h4>

                                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Tên Bé Cưng *</label>
                                                <input type="text" className="input-field" name="name" value={petData.name} onChange={handlePetChange} required={!editingUserId} placeholder="VD: Milo, Boss, Na..." style={{ background: '#f8fafc' }} />
                                            </div>

                                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                <div className="form-group">
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Loài *</label>
                                                    <select className="input-field" name="species" value={petData.species} onChange={handlePetChange} style={{ background: '#f8fafc' }}>
                                                        <option value="DOG">Chó</option>
                                                        <option value="CAT">Mèo</option>
                                                        <option value="OTHER">Thú cưng khác</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Giống loài</label>
                                                    <input type="text" className="input-field" name="breed" value={petData.breed} onChange={handlePetChange} placeholder="VD: Poodle" style={{ background: '#f8fafc' }} />
                                                </div>
                                            </div>

                                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                <div className="form-group">
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Tuổi</label>
                                                    <input type="number" className="input-field" name="age" value={petData.age} onChange={handlePetChange} placeholder="VD: 2" style={{ background: '#f8fafc' }} />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Cân nặng (kg)</label>
                                                    <input type="number" step="0.1" className="input-field" name="weight" value={petData.weight} onChange={handlePetChange} placeholder="VD: 5" style={{ background: '#f8fafc' }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #eef2f5', padding: '1.25rem 2rem' }}>
                                <button type="button" className="btn" style={{ background: '#f8fafc', color: 'var(--text-main)', border: '1px solid #eef2f5' }} onClick={handleCloseModal}>
                                    Hủy bỏ
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ minWidth: '150px' }}>
                                    {submitLoading ? 'Đang lưu...' : (editingUserId ? 'Cập Nhật Hồ Sơ' : 'Lưu Hồ Sơ Khám')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Chi Tiết Khách Hàng */}
            {isDetailModalOpen && selectedUser && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, width: '90%', maxWidth: '800px', background: 'white', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 800 }}>
                                Hồ Sơ Khách Hàng
                            </h3>
                            <button className="btn-icon" onClick={handleCloseDetailModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                            {/* Cột trái: Thông tin Cá nhân */}
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 'bold' }}>
                                        {selectedUser.fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>{selectedUser.fullName}</h2>
                                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Tham gia: {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Số điện thoại</p>
                                        <p style={{ margin: 0, fontWeight: 500 }}>{selectedUser.phoneNumber}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Email</p>
                                        <p style={{ margin: 0, fontWeight: 500 }}>{selectedUser.email || 'Chưa cập nhật'}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fefce8', border: '1px solid #fef08a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ca8a04' }}>🏆</div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Điểm tích luỹ</p>
                                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary)' }}>{selectedUser.rewardPoints || 0} điểm</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cột phải: Thú Cưng & Lịch sử */}
                            <div className="mobile-divider" style={{ borderLeft: '1px solid #eef2f5', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <PawPrint size={18} /> Danh Sách Thú Cưng ({userPetsDetail.length})
                                    </h4>

                                    {userPetsDetail.length === 0 ? (
                                        <div style={{ background: '#f8fafc', padding: '32px', textAlign: 'center', borderRadius: '12px', color: 'var(--text-muted)' }}>
                                            Chưa có hồ sơ thú cưng.
                                        </div>
                                    ) : (
                                        <div className="widget-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {userPetsDetail.map(pet => (
                                                <div key={pet._id} className="clickable-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'white', border: '1px solid #eef2f5', borderRadius: '12px', cursor: 'pointer' }} onClick={() => { setQuickViewPetId(pet._id); setIsQuickViewOpen(true); }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                                                            {pet.species === 'DOG' ? '🐶' : '🐱'}
                                                        </div>
                                                        <div>
                                                            <h5 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>{pet.name}</h5>
                                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{pet.breed} • {pet.age} tuổi</p>
                                                        </div>
                                                    </div>
                                                    <ExternalLink size={16} color="#94a3b8" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedUser.editHistory && selectedUser.editHistory.length > 0 && (
                                    <div>
                                        <button
                                            onClick={() => setShowHistory(!showHistory)}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                color: 'var(--text-main)',
                                                fontWeight: 600,
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LogsIcon size={18} color="var(--primary)" />
                                                Lịch sử chỉnh sửa ({selectedUser.editHistory.length})
                                            </div>
                                            <ChevronRight style={{ transform: showHistory ? 'rotate(90deg)' : 'none', transition: '0.2s' }} size={18} />
                                        </button>

                                        {showHistory && (
                                            <div className="animate-slide-down" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                                                {selectedUser.editHistory.slice().reverse().map((log, idx) => (
                                                    <div key={idx} style={{ padding: '12px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                            <span style={{ fontWeight: 700, color: log.action === 'CONVERT_EMERGENCY_TO_REAL' ? '#059669' : 'var(--text-main)' }}>
                                                                {log.action === 'CONVERT_EMERGENCY_TO_REAL' ? '✨ Xác thực hồ sơ' : '📝 Cập nhật'}
                                                            </span>
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                                {new Date(log.editedAt).toLocaleString('vi-VN')}
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: '0 0 8px 0', color: 'var(--text-light)', fontSize: '0.8rem' }}>{log.details}</p>

                                                        {log.before && Object.keys(log.before).length > 0 && (
                                                            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px' }}>
                                                                {Object.keys(log.before).map(field => (
                                                                    <div key={field} style={{ marginBottom: '4px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                                                                        <span style={{ fontWeight: 600, color: '#64748b' }}>{field}:</span>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                                                            <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{String(log.before[field])}</span>
                                                                            <ArrowRight size={12} color="#94a3b8" />
                                                                            <span style={{ color: '#10b981', fontWeight: 600 }}>{String(log.after[field])}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ padding: '16px 28px', borderTop: '1px solid #eef2f5', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn" style={{ background: 'white', border: '1px solid #eef2f5', color: '#64748b' }} onClick={handleCloseDetailModal}>Đóng</button>
                            {currentUser?.role === 'ADMIN' && (
                                <button className="btn" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => handleDeleteCustomer(selectedUser)}>
                                    <Trash2 size={16} /> Xóa
                                </button>
                            )}
                            <button className="btn btn-primary" onClick={handleEditCustomer}>
                                <Edit2 size={16} style={{marginRight: '6px'}}/> Chỉnh sửa
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <PetQuickView
                petId={quickViewPetId}
                isOpen={isQuickViewOpen}
                onClose={() => setIsQuickViewOpen(false)}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 768px) {
                    .mobile-divider { border-left: none !important; padding-left: 0 !important; border-top: 1px dashed #cbd5e1; padding-top: 24px; }
                    .show-on-mobile { display: inline-block !important; }
                    .dashboard-header .btn { padding: 8px 12px; }
                }
            `}} />
        </Layout>
    );
};

export default Users;
