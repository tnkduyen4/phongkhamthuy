import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, Calendar, UserCheck, AlertTriangle, Info, Clock, ScanFace, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = 'https://vet-clinic-backend-tgtd.onrender.com/api/v1';
const authHeader = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const TYPE_META = {
    EMERGENCY:        { icon: <AlertTriangle size={15} />, color: '#ef4444', bg: '#fef2f2', label: 'Khẩn cấp' },
    WARNING:          { icon: <AlertTriangle size={15} />, color: '#f59e0b', bg: '#fffbeb', label: 'Cảnh báo' },
    INFO:             { icon: <Info size={15} />,           color: '#3b82f6', bg: '#eff6ff', label: 'Thông tin' },
    FACE_RESET:       { icon: <ScanFace size={15} />,       color: '#c2410c', bg: '#fff7ed', label: 'FaceID' },
    FACE_APPROVED:    { icon: <CheckCircle2 size={15} />,   color: '#16a34a', bg: '#dcfce7', label: 'FaceID Duyệt' },
    FACE_REJECTED:    { icon: <XCircle size={15} />,        color: '#dc2626', bg: '#fee2e2', label: 'FaceID Từ chối' },
    TICKET_NEW:       { icon: <Info size={15} />,           color: '#1d4ed8', bg: '#dbeafe', label: 'Hỗ trợ Mới' },
    TICKET_RESOLVED:  { icon: <CheckCircle2 size={15} />,   color: '#16a34a', bg: '#dcfce7', label: 'Hỗ trợ Cập nhật' },
    SHIFT_REMINDER:   { icon: <Calendar size={15} />,       color: '#0ea5e9', bg: '#f0f9ff', label: 'Lịch làm việc' },
    CHECKOUT_REMINDER:{ icon: <Clock size={15} />,          color: '#f59e0b', bg: '#fffbeb', label: 'Chưa kết ca' },
};

const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
};

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [prevUnread, setPrevUnread] = useState(0);
    const [isRinging, setIsRinging] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const { user } = useAuth();

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await axios.get(`${API}/notifications/my`, { headers: authHeader() });
            if (res.data.success) {
                const newNotifs = res.data.data;
                const newUnread = newNotifs.filter(n => !n.isRead).length;
                // Kích hoạt animation chuông khi có thông báo mới
                if (newUnread > prevUnread) {
                    setIsRinging(true);
                    setTimeout(() => setIsRinging(false), 3000);
                }
                setPrevUnread(newUnread);
                setNotifications(newNotifs);
            }
        } catch (_) {}
    }, [prevUnread]);

    // Fetch lần đầu và poll mỗi 30 giây
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Gọi check-my-schedule mỗi 5 phút — tự động tạo thông báo lịch cà và kết ca
    useEffect(() => {
        const checkSchedule = async () => {
            try {
                await axios.post(`${API}/notifications/check-my-schedule`, {}, { headers: authHeader() });
                fetchNotifications(); // refresh sau khi check
            } catch (_) {}
        };
        checkSchedule(); // chạy ngay khi mount
        const interval = setInterval(checkSchedule, 5 * 60 * 1000); // mỗi 5 phút
        return () => clearInterval(interval);
    }, []);

    // Kiểm tra thuốc sắp hết hạn mỗi 10 phút (chỉ ADMIN và DOCTOR)
    useEffect(() => {
        if (!['ADMIN', 'DOCTOR'].includes(user?.role)) return;
        const checkExpiry = async () => {
            try {
                await axios.post(`${API}/notifications/check-expiring-medicines`, {}, { headers: authHeader() });
                fetchNotifications();
            } catch (_) {}
        };
        checkExpiry();
        const interval = setInterval(checkExpiry, 10 * 60 * 1000); // mỗi 10 phút
        return () => clearInterval(interval);
    }, [user?.role]);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkOne = async (id) => {
        try {
            await axios.patch(`${API}/notifications/${id}/read`, {}, { headers: authHeader() });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (_) {}
    };

    const handleMarkAll = async () => {
        try {
            await axios.patch(`${API}/notifications/read-all`, {}, { headers: authHeader() });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (_) {}
    };

    const handleClearAll = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ thông báo?')) return;
        try {
            await axios.delete(`${API}/notifications/my`, { headers: authHeader() });
            setNotifications([]);
            setIsOpen(false);
        } catch (err) {
            console.error('Lỗi khi xóa thông báo:', err);
        }
    };

    const handleClickNotif = (notif) => {
        if (!notif.isRead) handleMarkOne(notif._id);
        setIsOpen(false);

        // Yêu cầu FaceID → dispatch event để Staff.jsx mở modal duyệt đúng nhân viên
        if (notif.type === 'FACE_RESET' && notif.metadata?.staffId) {
            window.dispatchEvent(new CustomEvent('openFaceApproval', {
                detail: { staffId: notif.metadata.staffId }
            }));
            navigate('/staff');
            return;
        }

        // Build navigation state for highlighting
        const navState = {};
        if (notif.metadata?.appointmentId) navState.highlightAptId = notif.metadata.appointmentId;
        if (notif.metadata?.invoiceId) navState.highlightInvoiceId = notif.metadata.invoiceId;
        if (notif.metadata?.ticketId) navState.highlightTicketId = notif.metadata.ticketId;

        if (notif.link) {
            navigate(notif.link, { state: Object.keys(navState).length > 0 ? navState : null });
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Bell button */}
            <button
                onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
                style={{
                    position: 'relative',
                    width: '42px', height: '42px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: isOpen ? 'var(--primary)' : 'white',
                    color: isOpen ? 'white' : '#475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s',
                }}
            >
                <Bell
                    size={20}
                    style={{
                        animation: isRinging ? 'bellRing 0.5s ease-in-out 0s 6 alternate' : 'none',
                        transformOrigin: 'top center'
                    }}
                />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '-5px', right: '-5px',
                        minWidth: '18px', height: '18px',
                        background: '#ef4444', color: 'white',
                        borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid white',
                        animation: isRinging ? 'pulseBadge 0.5s ease-in-out infinite alternate' : 'none',
                        padding: '0 3px'
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                    width: '380px', maxHeight: '520px',
                    background: 'white', borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column',
                    zIndex: 9999,
                    animation: 'slideDown 0.2s ease-out'
                }}>
                    {/* Header */}
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>Thông báo</span>
                            {unreadCount > 0 && (
                                <span style={{ marginLeft: '8px', background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: '999px' }}>
                                    {unreadCount} mới
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button onClick={handleMarkAll} disabled={unreadCount === 0} style={{ background: 'none', border: 'none', cursor: unreadCount === 0 ? 'default' : 'pointer', color: unreadCount === 0 ? '#cbd5e1' : '#3b82f6', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}>
                                <CheckCheck size={14} /> Đọc tất cả
                            </button>
                            <button onClick={handleClearAll} disabled={notifications.length === 0} style={{ background: 'none', border: 'none', cursor: notifications.length === 0 ? 'default' : 'pointer', color: notifications.length === 0 ? '#cbd5e1' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}>
                                <Trash2 size={14} /> Xóa tất cả
                            </button>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                                <Bell size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                                <div style={{ fontSize: '0.85rem' }}>Không có thông báo nào</div>
                            </div>
                        ) : notifications.map(notif => {
                            const meta = TYPE_META[notif.type] || TYPE_META.INFO;
                            return (
                                <div
                                    key={notif._id}
                                    onClick={() => handleClickNotif(notif)}
                                    style={{
                                        padding: '12px 20px',
                                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                                        borderBottom: '1px solid #f8fafc',
                                        background: notif.isRead ? 'transparent' : '#f0f9ff',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        borderLeft: notif.isRead ? '3px solid transparent' : `3px solid ${meta.color}`,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = notif.isRead ? 'transparent' : '#f0f9ff'}
                                >
                                    {/* Icon */}
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                        {meta.icon}
                                    </div>
                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: notif.isRead ? 600 : 700, fontSize: '0.83rem', color: '#0f172a', lineHeight: 1.4, marginBottom: '3px' }}>
                                            {notif.title}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, marginBottom: '4px' }}>
                                            {notif.message}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={10} /> {timeAgo(notif.createdAt)}
                                        </div>
                                    </div>
                                    {/* Unread dot */}
                                    {!notif.isRead && (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color, flexShrink: 0, marginTop: '6px' }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tự động cập nhật mỗi 30 giây</span>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes bellRing {
                    0%   { transform: rotate(0deg); }
                    25%  { transform: rotate(-20deg); }
                    50%  { transform: rotate(20deg); }
                    75%  { transform: rotate(-20deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes pulseBadge {
                    from { transform: scale(1); }
                    to   { transform: scale(1.25); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
