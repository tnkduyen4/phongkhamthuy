import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { X, ExternalLink, Activity, Calendar, User, Phone, Mail, Award, Clock } from 'lucide-react';

const API = 'https://vet-clinic-1j57.onrender.com/api/v1';

// --- Shared Modal Container ---
const QuickViewModal = ({ title, isOpen, onClose, children, onFullView, fullViewLabel }) => {
    if (!isOpen) return null;
    return createPortal(
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 9999 }}>
            <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, width: '90%', maxWidth: '500px', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                        <X size={20} />
                    </button>
                </div>
                <div style={{ padding: '24px' }}>
                    {children}
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }} onClick={onClose}>Đóng</button>
                    {onFullView && (
                        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={onFullView}>
                            <ExternalLink size={16} /> {fullViewLabel || 'Xem chi tiết'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Pet Quick View ---
export const PetQuickView = ({ petId, isOpen, onClose }) => {
    const [pet, setPet] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && petId) {
            const fetchData = async () => {
                setLoading(true);
                setPet(null);
                setHistory([]);
                try {
                    const token = sessionStorage.getItem('token');
                    const headers = { Authorization: `Bearer ${token}` };

                    const [petRes, historyRes] = await Promise.all([
                        axios.get(`${API}/pets/${petId}`, { headers }),
                        axios.get(`${API}/records/pet/${petId}`, { headers })
                    ]);

                    if (petRes.data.success) setPet(petRes.data.data);
                    if (historyRes.data.success) setHistory(historyRes.data.data.slice(0, 3)); // Chỉ lấy 3 bản ghi gần nhất
                } catch (err) { console.error(err); }
                setLoading(false);
            };
            fetchData();
        }
    }, [isOpen, petId]);

    const handleFullView = () => {
        window.location.href = `/pets?id=${petId}`;
    };

    return (
        <QuickViewModal title="Thông tin Bé cưng" isOpen={isOpen} onClose={onClose} onFullView={handleFullView} fullViewLabel="Hồ sơ bệnh án">
            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Đang tải...</div>
            ) : !pet ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>Không tìm thấy dữ liệu.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                            {pet.species === 'DOG' ? '🐶' : '🐱'}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{pet.name}</h2>
                            <p style={{ margin: 0, color: '#64748b' }}>{pet.breed || 'Chưa rõ giống'} • {pet.age} tuổi</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Cân nặng</div>
                            <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{pet.weight} kg</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Loài</div>
                            <div style={{ fontWeight: 800 }}>{pet.species === 'DOG' ? 'Chó' : 'Mèo'}</div>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                            <User size={16} /> <strong>Chủ nuôi:</strong> {pet.ownerId?.fullName || 'N/A'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                            <Activity size={16} /> <strong>Lịch sử bệnh án mới nhất:</strong>
                        </div>

                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {history.length === 0 ? (
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Bé chưa có lịch sử khám bệnh.</div>
                            ) : (
                                history.map(h => (
                                    <div key={h._id} style={{ padding: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#166534', fontWeight: 700, marginBottom: '2px' }}>
                                            <span>{new Date(h.createdAt).toLocaleDateString('vi-VN')}</span>
                                            <span>BS. {h.doctorId?.fullName || 'BS'}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{h.diagnosis}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </QuickViewModal>
    );
};

// --- Customer Quick View ---
export const CustomerQuickView = ({ customerId, isOpen, onClose }) => {
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && customerId) {
            const fetchCustomer = async () => {
                setLoading(true);
                try {
                    const token = sessionStorage.getItem('token');
                    const res = await axios.get(`${API}/users/${customerId}`, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) setCustomer(res.data.data);
                } catch (err) { console.error(err); }
                setLoading(false);
            };
            fetchCustomer();
        }
    }, [isOpen, customerId]);

    const handleFullView = () => {
        window.location.href = `/users?id=${customerId}`;
    };

    return (
        <QuickViewModal title="Thông tin Khách hàng" isOpen={isOpen} onClose={onClose} onFullView={handleFullView} fullViewLabel="Quản lý CRM">
            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Đang tải...</div>
            ) : !customer ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#ef4444' }}>Không tìm thấy dữ liệu.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                            {customer.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{customer.fullName}</h2>
                            <p style={{ margin: 0, color: '#64748b' }}>Khách hàng thân thiết</p>
                        </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <Phone size={18} color="var(--primary)" />
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Số điện thoại</div>
                                <div style={{ fontWeight: 700 }}>{customer.phoneNumber}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Award size={18} color="#ca8a04" />
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Điểm tích lũy</div>
                                <div style={{ fontWeight: 700, color: '#ca8a04' }}>{customer.rewardPoints || 0} điểm</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                        <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        Tham gia từ: {new Date(customer.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                </div>
            )}
        </QuickViewModal>
    );
};
