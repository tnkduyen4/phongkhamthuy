import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bell, AlertTriangle, Info, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = 'https://vet-clinic-1j57.onrender.com/api/v1';

const NotificationCenter = () => {
    const { user } = useAuth(); // Lấy role của user hiện tại
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [prevUnread, setPrevUnread] = useState(0);
    const [isRinging, setIsRinging] = useState(false);
    const navigate = useNavigate();

    const fetchNotifications = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;
            const res = await axios.get(`${API}/notifications/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const newNotifs = res.data.data;
                const newUnread = newNotifs.filter(n => !n.isRead).length;
                if (newUnread > prevUnread) {
                    setIsRinging(true);
                    setTimeout(() => setIsRinging(false), 3000);
                }
                setPrevUnread(newUnread);
                setNotifications(newNotifs);
                setUnreadCount(newUnread);
            }
        } catch (err) {
            console.error('Lỗi tải thông báo:', err);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        // Poll every 15 seconds for new notifications
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAsRead = async (id, link) => {
        try {
            const token = sessionStorage.getItem('token');
            await axios.patch(`${API}/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotifications();
            fetchNotifications();
            setIsOpen(false);
            
            // Nếu không có link chuẩn thì dùng fallback đưa về trang quản lý/lịch hẹn chung
            let targetLink = link || '';

            const notif = notifications.find(n => n._id === id);
            const statePayload = {};
            if (notif?.metadata?.appointmentId) statePayload.highlightAptId = notif.metadata.appointmentId;
            if (notif?.metadata?.invoiceId) statePayload.highlightInvoiceId = notif.metadata.invoiceId;
            if (notif?.metadata?.ticketId) statePayload.highlightTicketId = notif.metadata.ticketId;

            if (user?.role === 'CUSTOMER') {
                if (notif?.type === 'TICKET_RESOLVED' || notif?.type === 'TICKET_NEW' || targetLink.includes('requests') || targetLink.includes('complaint')) {
                    targetLink = '/?tab=profile&section=complaint';
                }
                
                if (targetLink === '/' || targetLink.startsWith('/?tab=') || targetLink.startsWith('/customer')) {
                    navigate(targetLink, { state: statePayload });
                } else {
                    navigate('/?tab=appointments', { state: statePayload });
                }
            } else if (user?.role === 'RECEPTIONIST') {
                navigate(targetLink === '/records' ? '/appointments' : (targetLink || '/appointments'), { state: statePayload });
            } else {
                navigate(targetLink || '/appointments', { state: statePayload });
            }
        } catch (err) {
            console.error('Lỗi đánh dấu đã đọc:', err);
        }
    };

    const hasEmergency = notifications.some(n => !n.isRead && n.type === 'EMERGENCY');
    const latestEmergency = notifications.find(n => !n.isRead && n.type === 'EMERGENCY');

    return (
        <>
            {/* Global Emergency Banner (Level 3 Active Awareness) */}
            {hasEmergency && latestEmergency && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)',
                    backgroundSize: '200% auto',
                    animation: 'shimmer 2s linear infinite',
                    color: 'white',
                    padding: '12px 24px',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)',
                    fontWeight: '800',
                    fontSize: '0.95rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={24} className="animate-bounce" />
                        <span>🚨 CẢNH BÁO CẤP CỨU: {latestEmergency.message}</span>
                    </div>
                    <button
                        onClick={() => markAsRead(latestEmergency._id, latestEmergency.link)}
                        style={{
                            background: 'white',
                            color: '#dc2626',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: '900',
                            fontSize: '0.85rem',
                            textTransform: 'uppercase',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                        }}
                    >
                        {user?.role === 'RECEPTIONIST' ? 'XEM LỊCH HẸN' : 'XỬ LÝ NGAY'}
                    </button>

                    <style>
                        {`
                            @keyframes shimmer {
                                0% { background-position: 0% 50%; }
                                100% { background-position: 200% 50%; }
                            }
                        `}
                    </style>
                </div>
            )}

            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer',
                        position: 'relative',
                        color: hasEmergency ? '#ef4444' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '12px',
                        transition: 'all 0.2s',
                        backgroundColor: unreadCount > 0 ? '#f8fafc' : 'transparent',
                        transformOrigin: 'top center'
                    }}
                >
                    <Bell size={24} style={{
                        animation: hasEmergency ? 'pulse-danger 1.5s infinite' : (isRinging ? 'ring-bell 0.5s ease-in-out 0s 6 alternate' : 'none'),
                        transformOrigin: 'top center'
                    }} />
                    {unreadCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: hasEmergency ? '#ef4444' : '#6366f1',
                            color: 'white',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            border: '2px solid white'
                        }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <>
                        <div
                            onClick={() => setIsOpen(false)}
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                        />
                        <div style={{
                            position: 'absolute',
                            top: '120%',
                            right: 0,
                            width: '380px',
                            maxHeight: '500px',
                            background: 'white',
                            borderRadius: '20px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                            zIndex: 999,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', fontWeight: '800', color: '#1e293b', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Thông báo mới</span>
                                {unreadCount > 0 && <span style={{ color: '#6366f1', fontSize: '0.8rem', fontWeight: '600' }}>{unreadCount} tin mới</span>}
                            </div>

                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                                        <Clock size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                        <p>Không có thông báo nào</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div
                                            key={notif._id}
                                            onClick={() => markAsRead(notif._id, notif.link)}
                                            style={{
                                                padding: '16px 20px',
                                                borderBottom: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                background: notif.isRead ? '#fff' : '#f0f7ff',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                gap: '12px',
                                                position: 'relative'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = notif.isRead ? '#fff' : '#f0f7ff'}
                                        >
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '12px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: notif.type === 'EMERGENCY' ? '#fee2e2' : '#e0e7ff',
                                                color: notif.type === 'EMERGENCY' ? '#ef4444' : '#6366f1',
                                                flexShrink: 0
                                            }}>
                                                {notif.type === 'EMERGENCY' ? <AlertTriangle size={20} /> : <Info size={20} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e293b', marginBottom: '4px' }}>{notif.title}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.4' }}>{notif.message}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '8px' }}>
                                                    {new Date(notif.createdAt).toLocaleTimeString('vi-VN')} • {new Date(notif.createdAt).toLocaleDateString('vi-VN')}
                                                </div>
                                            </div>
                                            {!notif.isRead && (
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', position: 'absolute', top: '20px', right: '12px' }} />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div
                                style={{ padding: '12px', textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #f1f5f9', color: '#6366f1', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
                                onClick={() => setIsOpen(false)}
                            >
                                Đóng hộp thư
                            </div>
                        </div>

                    </>
                )}
            </div>
            <style>
                {`
                @keyframes pulse-danger {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes ring-bell {
                    0% { transform: rotate(0); }
                    10% { transform: rotate(15deg); }
                    20% { transform: rotate(-15deg); }
                    30% { transform: rotate(10deg); }
                    40% { transform: rotate(-10deg); }
                    50%, 100% { transform: rotate(0); }
                }
                `}
            </style>
        </>
    );
};

export default NotificationCenter;
