import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, PhoneCall, User as UserIcon, Clock, XCircle } from 'lucide-react';

const EmergencyFAB = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [dutyStaff, setDutyStaff] = useState([]);
    const [allDoctors, setAllDoctors] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchDutyStaff();
            fetchAllDoctors();
        }
    }, [isOpen]);

    const fetchDutyStaff = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-1j57.onrender.com/api/v1/hrm/duty-staff', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const docs = res.data.data.filter(s => s.role === 'DOCTOR');
                const uniqueDocs = Array.from(new Map(docs.map(item => [item._id, item])).values());
                setDutyStaff(uniqueDocs);
            }
        } catch (error) {
            console.error("Error fetching duty staff:", error);
        }
    };

    const fetchAllDoctors = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-1j57.onrender.com/api/v1/users?role=DOCTOR', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setAllDoctors(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching all doctors:", error);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
    };

    return (
        <>
            {/* Minimized Bubble on Right Edge */}
            {isMinimized && createPortal(
                <button
                    onClick={() => setIsMinimized(false)}
                    title="Mở rộng nút liên hệ"
                    className="emergency-fab-minimized"
                    style={{
                        position: 'fixed',
                        bottom: 'min(5vh, 40px)',
                        right: 0,
                        padding: '12px 10px 12px 16px',
                        borderTopLeftRadius: '24px',
                        borderBottomLeftRadius: '24px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        boxShadow: '-4px 4px 12px rgba(239, 68, 68, 0.4)',
                        cursor: 'pointer',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease'
                    }}
                >
                    <PhoneCall size={20} className="animate-pulse-glow" />
                </button>,
                document.body
            )}

            {/* The Main FAB Button */}
            {!isMinimized && createPortal(
                <div style={{ position: 'fixed', bottom: 'min(5vh, 40px)', right: 'min(5vw, 40px)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                        title="Thu nhỏ nút này"
                        style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                    >
                        <XCircle size={14} />
                    </button>
                    <button
                        className="emergency-fab animate-pulse-glow"
                        onClick={handleOpen}
                        title="Liên hệ bác sĩ trực cấp cứu"
                        style={{
                            padding: '12px',
                            width: '74px',
                            height: '74px',
                            borderRadius: 'var(--radius-full)',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            color: 'white',
                            border: 'none',
                            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.6)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px',
                            fontWeight: '800',
                            fontSize: '0.6rem',
                            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) rotate(0)'}
                    >
                        <PhoneCall className="fab-icon" size={28} />
                        <span style={{ letterSpacing: '0.02em', textAlign: 'center' }}>SĐT BÁC SĨ</span>
                    </button>
                </div>,
                document.body
            )}

            {/* Quick Emergency Modal */}
            {isOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 3000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="glass-card animate-slide-up" style={{
                        maxWidth: '850px',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                        maxHeight: '90vh'
                    }}>
                        <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '800' }}>
                                <PhoneCall size={28} /> DANH BẠ LIÊN HỆ CẤP CỨU
                            </h2>
                            <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsOpen(false)}>
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* Left: Duty Doctors */}
                            <div style={{ width: '320px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Clock size={18} /> BÁC SĨ ĐANG TRỰC
                                    </h3>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                                    {dutyStaff.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', padding: '20px' }}>Không có bác sĩ trong ca trực hiện tại.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {dutyStaff.map(doc => (
                                                <div key={doc._id} style={{ background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                    <div style={{ fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>Bs. {doc.fullName}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>SĐT: {doc.phoneNumber}</div>
                                                    <a href={`tel:${doc.phoneNumber}`} style={{ textDecoration: 'none' }}>
                                                        <button className="btn-primary animate-pulse-glow" style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#22c55e', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            <PhoneCall size={16} /> GỌI NGAY
                                                        </button>
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: All System Doctors */}
                            <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '20px 32px', borderBottom: '1px solid #f1f5f9' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1e293b' }}>HỆ THỐNG BÁC SĨ DỰ PHÒNG</h3>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                                        {allDoctors.map(doc => (
                                            <div key={doc._id} style={{ padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>Bs. {doc.fullName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '10px' }}>{doc.phoneNumber || '---'}</div>
                                                {doc.phoneNumber && (
                                                    <a href={`tel:${doc.phoneNumber}`} style={{ textDecoration: 'none' }}>
                                                        <button style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #22c55e', color: '#22c55e', background: 'transparent', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                                            <PhoneCall size={14} /> Liên hệ
                                                        </button>
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default EmergencyFAB;
