import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus, Search, Edit2, Trash2, X,
    Stethoscope, Sparkles, Check, AlertCircle, Info
} from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
// Lucide icons removed for a typographic UI

const Services = () => {
    const { user } = useAuth();
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('MEDICAL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category: 'MEDICAL', // Changed from 'type' to 'category'
        price: '',
        duration: '' // Changed from 'estimatedDuration' to 'duration'
    });
    const [editingId, setEditingId] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false); // Renamed to submitLoading for clarity in modal
    const [errorMsg, setErrorMsg] = useState('');

    const fetchServices = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/v1/services', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setServices(res.data.data);
            }
        } catch (error) {
            console.error('Lỗi khi tải dịch vụ:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOpenModal = (service = null) => {
        setErrorMsg('');
        if (service) {
            setEditingId(service._id);
            setFormData({
                name: service.name,
                description: service.description || '',
                category: service.type, // Map service.type to formData.category
                price: service.price,
                duration: service.estimatedDuration || '' // Map service.estimatedDuration to formData.duration
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                description: '',
                category: 'MEDICAL',
                price: '',
                duration: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        setErrorMsg('');

        // Validation định dạng số
        if (Number(formData.price) < 0) {
            setErrorMsg('Giá dịch vụ không được là số âm.');
            setSubmitLoading(false);
            return;
        }
        if (Number(formData.duration) <= 0) {
            setErrorMsg('Thời gian thực hiện phải lớn hơn 0 phút.');
            setSubmitLoading(false);
            return;
        }

        try {
            const token = sessionStorage.getItem('token');
            const url = editingId
                ? `http://localhost:5000/api/v1/services/${editingId}`
                : 'http://localhost:5000/api/v1/services';
            const method = editingId ? 'put' : 'post';

            const res = await axios[method](url, {
                name: formData.name,
                description: formData.description,
                type: formData.category, // Map formData.category back to API 'type'
                price: Number(formData.price),
                estimatedDuration: formData.duration ? Number(formData.duration) : undefined // Map formData.duration back to API 'estimatedDuration'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast(editingId ? 'Đã cập nhật dịch vụ thành công!' : 'Đã thêm dịch vụ mới!', 'success');
                setIsModalOpen(false);
                fetchServices();
            }
        } catch (error) {
            setErrorMsg(error.response?.data?.message || 'Có lỗi xảy ra khi lưu dịch vụ.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const token = sessionStorage.getItem('token');
            const checkRes = await axios.get(`http://localhost:5000/api/v1/services/${id}/check-delete`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (checkRes.data.hasRelations) {
                showConfirm(
                    'Ngừng Cung Cấp Dịch Vụ',
                    'Dịch vụ này đã có dữ liệu sử dụng trên hệ thống (Lịch hẹn, Hóa đơn...).\n\nBạn có muốn NGỪNG CUNG CẤP dịch vụ này không? Dịch vụ sẽ bị ẩn khỏi bảng giá mới nhưng mọi lịch sử vẫn được bảo toàn.',
                    async () => {
                        try {
                            await axios.delete(`http://localhost:5000/api/v1/services/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            showToast('Đã ngừng cung cấp dịch vụ.', 'success');
                            fetchServices();
                        } catch (error) {
                            showToast('Lỗi: ' + (error.response?.data?.message || 'Không thể xóa'), 'error');
                        }
                    }
                );
            } else {
                showConfirm(
                    'Xóa Vĩnh Viễn Dịch Vụ',
                    'Dịch vụ này chưa từng được sử dụng trong hệ thống.\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN không?',
                    async () => {
                        try {
                            await axios.delete(`http://localhost:5000/api/v1/services/${id}?force=true`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            showToast('Đã xóa vĩnh viễn dịch vụ.', 'success');
                            fetchServices();
                        } catch (error) {
                            showToast('Lỗi: ' + (error.response?.data?.message || 'Không thể xóa'), 'error');
                        }
                    }
                );
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra dữ liệu dịch vụ:', error);
            showToast('Không thể kiểm tra dữ liệu dịch vụ.', 'error');
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    return (
        <Layout>
            <div className="dashboard-header flex-between animate-fade-in" style={{ marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem' }}>Danh Mục Dịch Vụ</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Quản lý bảng giá Khám chữa bệnh & Grooming của hệ thống.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    {user?.role === 'ADMIN' && (
                        <button className="btn btn-primary btn-responsive" onClick={() => { setIsModalOpen(true); setEditingId(null); setFormData({ name: '', description: '', category: activeCategory, price: '', duration: '' }); }}>
                            <Plus size={20} /> <span className="hide-on-mobile">THÊM DỊCH VỤ MỚI</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs Phân loại dịch vụ */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button 
                    className="btn" 
                    onClick={() => setActiveCategory('MEDICAL')}
                    style={{ 
                        background: activeCategory === 'MEDICAL' ? 'var(--primary)' : 'white',
                        color: activeCategory === 'MEDICAL' ? 'white' : 'var(--text-main)',
                        border: '1px solid var(--primary)',
                        display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, padding: '10px 20px'
                    }}
                >
                    <Stethoscope size={18} /> Y TẾ / KHÁM BỆNH
                </button>
                <button 
                    className="btn" 
                    onClick={() => setActiveCategory('GROOMING')}
                    style={{ 
                        background: activeCategory === 'GROOMING' ? '#ec4899' : 'white',
                        color: activeCategory === 'GROOMING' ? 'white' : 'var(--text-main)',
                        border: '1px solid #ec4899',
                        display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, padding: '10px 20px'
                    }}
                >
                    <Sparkles size={18} /> GROOMING / LÀM ĐẸP
                </button>
                <button 
                    className="btn" 
                    onClick={() => setActiveCategory('SURCHARGE')}
                    style={{ 
                        background: activeCategory === 'SURCHARGE' ? '#f59e0b' : 'white',
                        color: activeCategory === 'SURCHARGE' ? 'white' : 'var(--text-main)',
                        border: '1px solid #f59e0b',
                        display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, padding: '10px 20px'
                    }}
                >
                    <Plus size={18} /> PHỤ PHÍ / DỊCH VỤ KHÁC
                </button>
            </div>

            <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                <div className="table-responsive">
                    <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Tên Dịch Vụ</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Hạng Mục</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Giá Cả</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Thời Lượng Ước Tính</th>
                                {user?.role === 'ADMIN' && (
                                    <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'center' }}>Thao Tác</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 5 : 4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Đang tải dữ liệu dịch vụ...
                                    </td>
                                </tr>
                            ) : services.filter(s => s.type === activeCategory).length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 5 : 4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Chưa có dịch vụ nào trong hạng mục {activeCategory === 'MEDICAL' ? 'Y TẾ' : activeCategory === 'GROOMING' ? 'GROOMING' : 'PHỤ PHÍ'}.
                                    </td>
                                </tr>
                            ) : (
                                services.filter(s => s.type === activeCategory).map((svc) => (
                                    <tr key={svc._id} style={{ borderBottom: '1px solid #eef2f5', transition: 'var(--transition-fast)' }} className="table-row-hover">
                                        <td style={{ padding: '16px 24px' }} data-label="Tên Dịch Vụ">
                                            <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem', display: 'block' }}>{svc.name}</strong>
                                            {svc.description && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{svc.description}</span>}
                                        </td>
                                        <td style={{ padding: '16px 24px' }} data-label="Hạng Mục">
                                            <div className="flex-y-center" style={{ gap: '8px' }}>
                                                {svc.type === 'MEDICAL' ? <Stethoscope size={16} color="var(--primary)" /> : svc.type === 'GROOMING' ? <Sparkles size={16} color="#ec4899" /> : <Plus size={16} color="#f59e0b" />}
                                                <span style={{ 
                                                    fontWeight: 600, 
                                                    color: svc.type === 'MEDICAL' ? 'var(--primary)' : svc.type === 'GROOMING' ? '#ec4899' : '#f59e0b' 
                                                }}>
                                                    {svc.type === 'MEDICAL' ? 'Y TẾ / KHÁM BỆNH' : svc.type === 'GROOMING' ? 'GROOMING / LÀM ĐẸP' : 'PHỤ PHÍ / KHÁC'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }} data-label="Giá Cả">
                                            <strong style={{ color: '#059669', fontSize: '1.1rem' }}>{formatCurrency(svc.price)}</strong>
                                        </td>
                                        <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }} data-label="Thời Lượng Ước Tính">
                                            {svc.estimatedDuration ? `${svc.estimatedDuration} phút` : 'Không xác định'}
                                        </td>
                                        {user?.role === 'ADMIN' && (
                                            <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }} data-label="Thao Tác">
                                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                    <button className="btn-icon" title="Sửa" onClick={() => handleOpenModal(svc)} style={{ color: '#0ea5e9', fontWeight: 700 }}><Edit2 size={18} /></button>
                                                    <button className="btn-icon" title="Ngừng cung cấp" onClick={() => handleDelete(svc._id)} style={{ color: '#ef4444', fontWeight: 700 }}><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Thêm/Sửa Dịch vụ */}
            {
                isModalOpen && user?.role === 'ADMIN' && createPortal(
                    <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                        <div className="modal-container glass-card animate-slide-up" style={{ '--modal-max-width': '550px', background: 'white', padding: 0 }}>
                            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 700 }}>
                                    {editingId ? 'Cập Nhật Dịch Vụ' : 'Phát Hành Dịch Vụ Mới'}
                                </h3>
                                <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form className="modal-body" style={{ padding: '24px' }} onSubmit={handleSubmit}>
                                {errorMsg && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{errorMsg}</div>}

                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Tên dịch vụ *</label>
                                    <input className="input-field" name="name" value={formData.name} onChange={handleInputChange} required placeholder="VD: Khám tổng quát, Cắt tỉa lông..." />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '20px', marginBottom: '16px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Loại danh mục *</label>
                                        <select className="input-field" name="category" value={formData.category} onChange={handleInputChange}>
                                            <option value="MEDICAL">Y Tế / Khám Bệnh</option>
                                            <option value="GROOMING">Grooming / Làm Đẹp</option>
                                            <option value="SURCHARGE">Phụ phí / Dịch vụ khác</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Giá dịch vụ (VNĐ) *</label>
                                        <input type="number" className="input-field" name="price" value={formData.price} onChange={handleInputChange} required placeholder="0" />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Thời gian thực hiện (Phút) *</label>
                                    <input type="number" className="input-field" name="duration" value={formData.duration} onChange={handleInputChange} required placeholder="VD: 30, 60..." />
                                </div>
                                <div className="form-group" style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Mô tả chi tiết</label>
                                    <textarea className="input-field" name="description" value={formData.description} onChange={handleInputChange} rows="3" placeholder="Ghi chú về dịch vụ..." />
                                </div>

                                <div className="modal-footer" style={{ borderTop: '1px solid #eef2f5', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy Bỏ</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                                        {submitLoading ? 'Đang xử lý...' : (editingId ? 'Cập Nhật' : 'Lưu Dịch Vụ')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )
            }
        </Layout >
    );
};

export default Services;
