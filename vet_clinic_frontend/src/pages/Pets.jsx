import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { Search, X, History, PawPrint, User, Plus, Trash2, ExternalLink, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CustomerQuickView } from '../components/QuickViews';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

const Pets = () => {
    const [pets, setPets] = useState([]);
    const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
    const [viewMode, setViewMode] = useState('pet'); // 'pet' hoặc 'owner'
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();
    const [showArchived, setShowArchived] = useState(false);
    const [selectedPetIds, setSelectedPetIds] = useState([]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedPet, setSelectedPet] = useState(null);
    const [medicalHistory, setMedicalHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [formData, setFormData] = useState({ name: '', species: 'DOG', breed: '', age: '', weight: '', ownerId: '' });

    // State cho Chủ nuôi
    const [isNewCustomer, setIsNewCustomer] = useState(true);
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerName, setCustomerName] = useState('');

    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [customers, setCustomers] = useState([]);

    // QuickView State
    const [quickViewCustomerId, setQuickViewCustomerId] = useState(null);
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

    const fetchPets = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem('token');
            const url = `https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets${showArchived ? '?includeInactive=true' : ''}`;
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setPets(showArchived ? res.data.data.filter(p => p.isActive === false) : res.data.data);
                setSelectedPetIds([]);
            }
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const fetchCustomers = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-backend-tgtd.onrender.com/api/v1/users?role=CUSTOMER', { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setCustomers(res.data.data);
        } catch (error) { console.error(error); }
    };

    const fetchMedicalHistory = async (pet) => {
        try {
            setHistoryLoading(true);
            setMedicalHistory([]);
            setSelectedPet(pet);
            setIsHistoryModalOpen(true);
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/records/pet/${pet._id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setMedicalHistory(res.data.data);
        } catch (error) { console.error(error); } finally { setHistoryLoading(false); }
    };

    useEffect(() => {
        fetchPets();
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get('id');
        if (urlId) {
            axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets/${urlId}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
                .then(res => { if (res.data.success) fetchMedicalHistory(res.data.data); });
        }
    }, [showArchived]);

    const handleDeletePet = async (petId, petName) => {
        try {
            const token = sessionStorage.getItem('token');
            const checkRes = await axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets/${petId}/check-delete`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const hasRelations = checkRes.data.hasRelations;

            if (hasRelations) {
                showConfirm(
                    'Ngưng Hoạt Động Thú Cưng',
                    `Thú cưng "${petName}" đang có các dữ liệu liên quan (Lịch hẹn, Bệnh án...). Hệ thống không thể xóa vĩnh viễn để bảo toàn dữ liệu.\n\nBạn có muốn NGƯNG HOẠT ĐỘNG (Lưu trữ) thú cưng này không?`,
                    async () => {
                        try {
                            await axios.delete(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets/${petId}`, { headers: { Authorization: `Bearer ${token}` } });
                            showToast('Đã ngưng hoạt động thú cưng.', 'success');
                            fetchPets();
                        } catch (error) { showToast('Lỗi khi lưu trữ thú cưng', 'error'); }
                    }
                );
            } else {
                showConfirm(
                    'Xóa Vĩnh Viễn Thú Cưng',
                    `Thú cưng "${petName}" là dữ liệu rỗng, không có liên kết nào.\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN thú cưng này không? Dữ liệu không thể khôi phục.`,
                    async () => {
                        try {
                            await axios.delete(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets/${petId}?force=true`, { headers: { Authorization: `Bearer ${token}` } });
                            showToast('Đã xóa vĩnh viễn thú cưng!', 'success');
                            fetchPets();
                        } catch (error) { showToast('Lỗi khi xóa vĩnh viễn', 'error'); }
                    }
                );
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra dữ liệu thú cưng:', error);
            showToast('Không thể kiểm tra dữ liệu thú cưng.', 'error');
        }
    };

    const handleBulkDeletePets = () => {
        showConfirm(
            'Xóa Nhiều Thú Cưng',
            `Bạn đang chọn ${selectedPetIds.length} thú cưng.\n\nHệ thống sẽ tự động lưu trữ (Ngừng hoạt động) các thú cưng có dữ liệu liên kết và xóa vĩnh viễn các hồ sơ trống.\n\nBạn có chắc chắn muốn thực hiện?`,
            async () => {
                setSubmitLoading(true);
                try {
                    const token = sessionStorage.getItem('token');
                    const res = await axios.post(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets/bulk-delete`, { petIds: selectedPetIds }, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) {
                        showToast(res.data.message, 'success');
                        fetchPets();
                    }
                } catch (error) {
                    showToast(error.response?.data?.message || 'Lỗi khi xóa hàng loạt', 'error');
                } finally {
                    setSubmitLoading(false);
                }
            }
        );
    };

    const handleRestorePet = async (petId) => {
        showConfirm(
            'Khôi Phục Hoạt Động',
            'Khôi phục hoạt động cho thú cưng này?',
            async () => {
                try {
                    await axios.patch(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets/${petId}/reactivate`, {}, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
                    showToast('Đã khôi phục thú cưng thành công!');
                    fetchPets();
                } catch (error) { showToast('Lỗi khôi phục', 'error'); }
            }
        );
    };

    const handleOpenModal = () => {
        setFormData({ name: '', species: 'DOG', breed: '', age: '', weight: '', ownerId: '' });
        setIsNewCustomer(true); setCustomerPhone(''); setCustomerName(''); setErrorMsg('');
        setIsModalOpen(true);
        fetchCustomers();
    };

    const handlePhoneChange = (e) => {
        const phone = e.target.value; setCustomerPhone(phone);
        const exiting = customers.find(c => c.phoneNumber === phone);
        if (exiting) {
            setIsNewCustomer(false); setCustomerName(exiting.fullName);
            setFormData(prev => ({ ...prev, ownerId: exiting._id }));
        } else {
            setIsNewCustomer(true); setFormData(prev => ({ ...prev, ownerId: '' }));
        }
    };

    const handleSubmitPet = async (e) => {
        e.preventDefault();
        showConfirm(
            'Xác nhận Lưu Hồ Sơ',
            `Lưu hồ sơ cho bé ${formData.name || 'thú cưng'} thuộc khách hàng ${customerName || 'mới'}?${isNewCustomer ? '\n(Hệ thống sẽ tự động tạo tài khoản khách hàng mới)' : ''}`,
            async () => {
                setSubmitLoading(true);
                try {
                    let oid = formData.ownerId;
                    if (isNewCustomer) {
                        const res = await axios.post('https://vet-clinic-backend-tgtd.onrender.com/api/v1/auth/register', { fullName: customerName, phoneNumber: customerPhone, password: '123456' });
                        oid = res.data.data._id;
                    }
                    await axios.post('https://vet-clinic-backend-tgtd.onrender.com/api/v1/pets', { ...formData, ownerId: oid }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
                    showToast('Tiếp nhận thú cưng thành công!', 'success');
                    setIsModalOpen(false);
                    fetchPets();
                } catch (error) {
                    setErrorMsg("Lỗi khi lưu: " + (error.response?.data?.message || "Hệ thống"));
                    showToast('Lỗi khi tiếp nhận', 'error');
                } finally {
                    setSubmitLoading(false);
                }
            }
        );
    };

    const handlePrintRecord = (rec) => {
        const printWindow = window.open('', '', 'width=800,height=600');
        const printContent = `
            <html>
                <head>
                    <title>Ho So Benh An - ${selectedPet.name}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                        .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
                        .title { font-size: 24px; font-weight: 800; text-transform: uppercase; margin: 0; }
                        .clinic-info { color: #64748b; font-size: 14px; margin-top: 5px; }
                        .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
                        .section { margin-top: 30px; }
                        .section-title { font-size: 16px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; color: #0284c7; }
                        .prescription-item { padding: 10px; border-bottom: 1px dashed #cbd5e1; }
                        .footer { margin-top: 50px; text-align: right; font-style: italic; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 class="title">HỒ SƠ BỆNH ÁN CHI TIẾT</h1>
                        <div class="clinic-info">Bệnh Viện Thú Y VetCare &mdash; Hotline: 1900 1000</div>
                    </div>
                    <div class="info-grid">
                        <div>
                            <div><strong>Bé (Pet):</strong> ${selectedPet.name} (${selectedPet.species === 'DOG' ? 'Chó' : selectedPet.species === 'CAT' ? 'Mèo' : 'Khác'})</div>
                            <div><strong>Chủ nuôi:</strong> ${selectedPet.ownerId?.fullName || '--'}</div>
                            <div><strong>Điện thoại:</strong> ${selectedPet.ownerId?.phoneNumber || '--'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div><strong>Ngày khám:</strong> ${new Date(rec.createdAt).toLocaleString('vi-VN')}</div>
                            <div><strong>Bác sĩ phụ trách:</strong> ${rec.doctorId?.fullName || 'BS'}</div>
                            <div><strong>Cân nặng:</strong> ${rec.weightAtVisit || '--'} kg | <strong>Nhiệt độ:</strong> ${rec.temperature || '--'} &deg;C</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">CHẨN ĐOÁN LÂM SÀNG</div>
                        <p style="margin: 4px 0;"><strong>Triệu chứng:</strong> ${rec.symptoms || '--'}</p>
                        <p style="margin: 4px 0;"><strong>Chẩn đoán:</strong> ${rec.diagnosis || '--'}</p>
                        ${rec.treatment ? `<p style="margin: 4px 0;"><strong>Hướng điều trị:</strong> ${rec.treatment}</p>` : ''}
                        ${rec.followUpDate ? `<p style="margin: 4px 0;"><strong>Ngày tái khám:</strong> ${new Date(rec.followUpDate).toLocaleDateString('vi-VN')}</p>` : ''}
                    </div>

                    ${rec.services && rec.services.length > 0 ? `
                    <div class="section">
                        <div class="section-title">DỊCH VỤ THỰC HIỆN</div>
                        <ul style="margin: 0; padding-left: 20px;">
                            ${rec.services.map(s => `<li>${s.serviceId?.name || s.name}</li>`).join('')}
                        </ul>
                    </div>` : ''}

                    ${rec.prescriptions && rec.prescriptions.length > 0 ? `
                    <div class="section">
                        <div class="section-title">ĐƠN THUỐC KÊ TOA</div>
                        ${rec.prescriptions.map((p, idx) => `
                        <div class="prescription-item" style="${idx === rec.prescriptions.length - 1 ? 'border: none;' : ''}">
                            <strong>${idx + 1}. ${p.medicineName || p.medicineId?.productId?.name || 'Thuốc'}</strong> - Số lượng: ${p.quantity} ${p.unit || 'viên/hộp'}
                            <div style="font-size: 13px; color: #475569; margin-top: 4px;"><em>HDSD: ${p.dosageInstructions || 'Theo chỉ định BS'}</em></div>
                        </div>`).join('')}
                    </div>` : ''}

                    <div class="footer">
                        <p style="margin-bottom: 60px;">Ký tên Bác sĩ xác nhận</p>
                        <strong>${rec.doctorId?.fullName || 'Bác sĩ thú y'}</strong>
                    </div>
                </body>
            </html>
        `;
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const filteredPets = pets.filter(p => {
        if (showArchived && p.isActive !== false) return false;
        const s = searchTerm.toLowerCase();
        return p.name?.toLowerCase().includes(s) || p.ownerId?.fullName?.toLowerCase().includes(s) || p.ownerId?.phoneNumber?.includes(s);
    });

    const ownerGroups = Object.values(filteredPets.reduce((acc, p) => {
        const oid = p.ownerId?._id || 'none';
        if (!acc[oid]) acc[oid] = { owner: p.ownerId || { fullName: 'Vô chủ' }, pets: [] };
        acc[oid].pets.push(p); return acc;
    }, {})).sort((a, b) => (a.owner.fullName || '').localeCompare(b.owner.fullName || ''));

    // --- Sub-Component: PetCard ---
    const PetCard = ({ pet }) => (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer', position: 'relative', border: selectedPetIds.includes(pet._id) ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.5)' }} onClick={() => {
            if (selectedPetIds.includes(pet._id)) setSelectedPetIds(selectedPetIds.filter(id => id !== pet._id));
            else setSelectedPetIds([...selectedPetIds, pet._id]);
        }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }} onClick={e => e.stopPropagation()}>
                <input type="checkbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} checked={selectedPetIds.includes(pet._id)} onChange={(e) => {
                    if (e.target.checked) setSelectedPetIds([...selectedPetIds, pet._id]);
                    else setSelectedPetIds(selectedPetIds.filter(id => id !== pet._id));
                }} />
            </div>
            <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    {pet.species === 'CAT' ? '🐱' : '🐶'}
                </div>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>{pet.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pet.breed || 'Chưa rõ giống'}</p>
                </div>
            </div>
            <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cân nặng:</span>
                    <span style={{ fontWeight: 700 }}>{pet.weight ? `${pet.weight} kg` : '--'}</span>
                </div>
                <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tuổi:</span>
                    <span style={{ fontWeight: 700 }}>{pet.age || '--'}</span>
                </div>
                <div className="flex-between" style={{ alignItems: 'flex-start', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Chủ nuôi:</span>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--primary)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if (pet.ownerId?._id) { setQuickViewCustomerId(pet.ownerId._id); setIsQuickViewOpen(true); } }}>
                            {pet.ownerId?.fullName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{pet.ownerId?.phoneNumber}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    {pet.isActive === false ? (
                        <button className="btn" style={{ flex: 1, background: '#f0fdf4', color: '#16a34a' }} onClick={(e) => { e.stopPropagation(); handleRestorePet(pet._id); }}>Khôi phục</button>
                    ) : (
                        <>
                            <button className="btn" style={{ flex: 1, border: '1px solid #e2e8f0', background: 'white', color: 'var(--text-main)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={(e) => { e.stopPropagation(); fetchMedicalHistory(pet); }}>
                                <History size={14} /> Lịch sử
                            </button>
                            {user?.role === 'ADMIN' && (
                                <button className="btn" style={{ background: '#fee2e2', color: '#dc2626', padding: '8px' }} onClick={(e) => { e.stopPropagation(); handleDeletePet(pet._id, pet.name); }}>
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="dashboard-header flex-between" style={{ marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: "2rem", fontWeight: "900", color: "var(--text-main)", letterSpacing: "-1px" }}>Data Center / Thú Cưng</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>Tra cứu hồ sơ bệnh án và quản lý thông tin thú cưng.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="input-with-icon" style={{ width: '300px' }}>
                        <Search size={18} className="input-icon" />
                        <input type="text" className="input-field" placeholder="Gõ tên bé, chủ hoặc SĐT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ height: '42px' }} />
                    </div>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                        <button className={`btn-icon ${viewMode === 'pet' ? 'active' : ''}`} onClick={() => setViewMode('pet')} style={{ background: viewMode === 'pet' ? 'white' : 'transparent', borderRadius: '8px', color: viewMode === 'pet' ? 'var(--primary)' : '#64748b' }}><PawPrint size={18} /></button>
                        <button className={`btn-icon ${viewMode === 'owner' ? 'active' : ''}`} onClick={() => setViewMode('owner')} style={{ background: viewMode === 'owner' ? 'white' : 'transparent', borderRadius: '8px', color: viewMode === 'owner' ? 'var(--primary)' : '#64748b' }}><User size={18} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className="btn" style={{ height: '42px', background: showArchived ? '#fef2f2' : 'white', color: showArchived ? '#ef4444' : '#64748b', border: showArchived ? '1px solid #fca5a5' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '0 16px' }} onClick={() => setShowArchived(!showArchived)}>
                            <Trash2 size={18} /> <span className="hide-on-mobile">{showArchived ? 'Đang xem Thùng rác' : 'Thùng rác'}</span>
                        </button>
                        {selectedPetIds.length > 0 && user?.role === 'ADMIN' && (
                            <button className="btn" style={{ height: '42px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', borderRadius: '12px' }} onClick={handleBulkDeletePets} disabled={submitLoading}>
                                <Trash2 size={18} /> <span className="hide-on-mobile">Xóa {selectedPetIds.length} mục</span>
                            </button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '0 12px', borderRadius: '12px', height: '42px' }}>
                            <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} checked={selectedPetIds.length > 0 && selectedPetIds.length === filteredPets.length} onChange={(e) => {
                                if (e.target.checked) setSelectedPetIds(filteredPets.map(p => p._id));
                                else setSelectedPetIds([]);
                            }} title="Chọn tất cả" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' }} onClick={() => {
                                if (selectedPetIds.length > 0) setSelectedPetIds([]);
                                else setSelectedPetIds(filteredPets.map(p => p._id));
                            }}>Chọn tất cả</span>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleOpenModal} style={{ height: '42px', padding: '0 20px', borderRadius: '12px', fontWeight: 700 }}><Plus size={20} /> Thêm Mới</button>
                </div>
            </div>

            {showArchived && (
                <div className="animate-fade-in" style={{ padding: '16px 20px', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '16px', color: '#b91c1c', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                    <Trash2 size={24} />
                    <div>
                        <div style={{ fontSize: '1.05rem', marginBottom: '4px' }}>ĐANG XEM THÙNG RÁC</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 400 }}>Danh sách dưới đây chỉ hiển thị các hồ sơ thú cưng đã bị xóa.</div>
                    </div>
                </div>
            )}

            <div className="content-container animate-fade-in">
                {loading ? (
                    <div className="flex-center" style={{ height: '200px', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
                ) : filteredPets.length === 0 ? (
                    <div className="glass-card flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
                        <PawPrint size={48} color="#e2e8f0" />
                        <p style={{ color: 'var(--text-muted)' }}>Không tìm thấy thú cưng nào phù hợp.</p>
                    </div>
                ) : viewMode === 'pet' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                        {filteredPets.map(p => <PetCard key={p._id} pet={p} />)}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
                        {ownerGroups.map((group, idx) => (
                            <div key={idx} className="owner-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px 20px', background: 'var(--primary-glow)', borderRadius: '16px', borderLeft: '4px solid var(--primary)' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><User size={20} /></div>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => { if (group.owner._id) { setQuickViewCustomerId(group.owner._id); setIsQuickViewOpen(true); } }}>{group.owner.fullName}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{group.owner.phoneNumber} • {group.pets.length} bé</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                    {group.pets.map(p => <PetCard key={p._id} pet={p} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Thêm Thú Cưng */}
            {isModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card" style={{ padding: 0, width: '95%', maxWidth: '500px', borderRadius: '24px', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Tiếp Nhận Thú Cưng</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmitPet} style={{ padding: '24px' }}>
                            <div style={{ background: isNewCustomer ? '#f8fafc' : '#f0fdf4', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Thông tin chủ nuôi</label>
                                <input type="text" className="input-field" placeholder="Số điện thoại..." value={customerPhone} onChange={handlePhoneChange} required style={{ marginBottom: '12px', background: 'white' }} />
                                <input type="text" className="input-field" placeholder="Họ và tên..." value={customerName} onChange={e => setCustomerName(e.target.value)} required readOnly={!isNewCustomer} style={{ background: isNewCustomer ? 'white' : 'transparent', fontWeight: isNewCustomer ? 400 : 700 }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <input type="text" className="input-field" placeholder="Tên bé cưng..." name="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <select className="input-field" name="species" value={formData.species} onChange={e => setFormData({ ...formData, species: e.target.value })}>
                                    <option value="DOG">Chó</option><option value="CAT">Mèo</option><option value="OTHER">Khác</option>
                                </select>
                                <input type="text" className="input-field" placeholder="Giống loài..." name="breed" value={formData.breed} onChange={e => setFormData({ ...formData, breed: e.target.value })} />
                                <input type="number" className="input-field" placeholder="Tuổi..." name="age" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                            </div>
                            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setIsModalOpen(false)}>Hủy</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '48px' }} disabled={submitLoading}>{submitLoading ? 'Đang lưu...' : 'Lưu Hồ Sơ'}</button>
                            </div>
                        </form>
                    </div>
                </div>, document.body
            )}

            {/* Modal Lịch Sử Bệnh Án */}
            {isHistoryModalOpen && selectedPet && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card" style={{ padding: 0, width: '95%', maxWidth: '700px', borderRadius: '24px', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Bệnh Án: {selectedPet.name}</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lịch sử điều trị chi tiết</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {historyLoading ? <div className="flex-center">Đang tải...</div> : medicalHistory.length === 0 ? <div className="flex-center" style={{ color: '#94a3b8' }}>Chưa có lịch sử khám bệnh.</div> : medicalHistory.map((rec, i) => (
                                <div key={rec._id} style={{ padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', position: 'relative', background: 'white' }}>
                                    <div style={{ position: 'absolute', top: '-10px', left: '20px', background: 'var(--primary)', color: 'white', padding: '2px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>{new Date(rec.createdAt).toLocaleDateString('vi-VN')}</div>
                                    <button
                                        onClick={() => handlePrintRecord(rec)}
                                        style={{ position: 'absolute', top: '15px', right: '15px', background: '#f0f9ff', color: 'var(--primary)', border: '1px solid #bae6fd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700 }}
                                    >
                                        <Printer size={14} /> In Hồ Sơ
                                    </button>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                        <div><label style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Cân nặng</label><div style={{ fontWeight: 700 }}>{rec.weightAtVisit || '--'} kg</div></div>
                                        <div><label style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Nhiệt độ</label><div style={{ fontWeight: 700 }}>{rec.temperature || '--'} °C</div></div>
                                        <div><label style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Bác sĩ phụ trách</label><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{rec.doctorId?.fullName || 'BS'}</div></div>
                                    </div>

                                    <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div><label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>C.Đoán lâm sàng / Triệu chứng:</label><div style={{ fontSize: '0.9rem' }}>{rec.symptoms}</div></div>
                                        <div><label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Kết luận chẩn đoán:</label><div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#dc2626' }}>{rec.diagnosis}</div></div>
                                    </div>

                                    {rec.treatment && <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '10px', color: '#0369a1', fontSize: '0.85rem' }}><strong>Hướng điều trị:</strong> {rec.treatment}</div>}

                                    {rec.services && rec.services.length > 0 && (
                                        <div style={{ marginTop: '16px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Dịch vụ thực hiện</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                                {rec.services.map((s, idx) => (
                                                    <span key={idx} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '100px', fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                                                        {s.serviceId?.name || s.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {rec.prescriptions && rec.prescriptions.length > 0 && (
                                        <div style={{ marginTop: '16px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Đơn thuốc kê toa</label>
                                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {rec.prescriptions.map((p, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{p.medicineName || p.medicineId?.productId?.name || 'Thuốc'}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>HDSD: {p.dosageInstructions || 'Theo chỉ định BS'}</div>
                                                        </div>
                                                        <div style={{ fontWeight: 800, color: 'var(--primary)', textAlign: 'right' }}>
                                                            Số lượng: {p.quantity} {p.unit || 'viên/lọ'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>, document.body
            )}


            <CustomerQuickView customerId={quickViewCustomerId} isOpen={isQuickViewOpen} onClose={() => setIsQuickViewOpen(false)} />
        </Layout>
    );
};

export default Pets;
