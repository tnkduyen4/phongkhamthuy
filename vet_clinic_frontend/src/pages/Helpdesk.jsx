import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Search, Filter, Headset, CheckCircle2, Clock, XCircle, ChevronRight, FileText, User, Bell, X, Camera } from 'lucide-react';
import Layout from '../components/Layout';
import '../styles/Helpdesk.css';

const API = 'https://vet-clinic-backend-tgtd.onrender.com/api/v1';

export default function Helpdesk() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleNavigate = (path, requiredRoles = []) => {
        if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
            showToast('Tài khoản của bạn không có đủ phân quyền để truy cập trang này!', 'error');
            return;
        }
        navigate(path);
    };

    const getSearchParam = () => {
        let q = '';
        if (selectedTicket?.referenceId && selectedTicket.referenceId._id) q = selectedTicket.referenceId._id;
        else if (selectedTicket?.referenceId && typeof selectedTicket.referenceId === 'string') q = selectedTicket.referenceId;
        else if (selectedTicket?.sender?.phoneNumber) q = selectedTicket.sender.phoneNumber;
        else if (selectedTicket?.sender?.fullName) q = selectedTicket.sender.fullName;
        else if (selectedTicket?.guestPhone) q = selectedTicket.guestPhone;
        else if (selectedTicket?.guestName) q = selectedTicket.guestName;
        return encodeURIComponent(q);
    };

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters & Search
    const [filterRole, setFilterRole] = useState('CUSTOMER');
    const [filterStatus, setFilterStatus] = useState('ALL'); // Default to ALL
    const [filterCategory, setFilterCategory] = useState('ALL');
    
    // Modal
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [resolveNote, setResolveNote] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    
    // Zoomable Image Preview
    const [previewImage, setPreviewImage] = useState(null);
    
    // Attendance Specific inputs
    const [newCheckIn, setNewCheckIn] = useState('');
    const [newCheckOut, setNewCheckOut] = useState('');

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API}/tickets`, {
                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
            });
            if (res.data.success) {
                setTickets(res.data.data);
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi khi tải danh sách phiếu hỗ trợ', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleTicketClick = async (ticket) => {
        // Tự động chuyển PENDING -> IN_PROGRESS khi Admin click vào xem
        if (ticket.status === 'PENDING') {
            try {
                const token = sessionStorage.getItem('token');
                const res = await axios.put(`${API}/tickets/${ticket._id}/resolve`, { status: 'IN_PROGRESS' }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    ticket.status = 'IN_PROGRESS';
                    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, status: 'IN_PROGRESS' } : t));
                }
            } catch (err) { console.error('Auto status update failed', err); }
        }

        setSelectedTicket(ticket);
        if (ticket.category === 'ATTENDANCE' && ticket.referenceId) {
            const ref = ticket.referenceId;
            if (ref.checkIn && ref.checkIn.time) {
                const d = new Date(ref.checkIn.time);
                const localISOTime = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setNewCheckIn(localISOTime);
            } else {
                setNewCheckIn('');
            }
            if (ref.checkOut && ref.checkOut.time && !ref.checkOut.isAuto) {
                const d = new Date(ref.checkOut.time);
                const localISOTime = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setNewCheckOut(localISOTime);
            } else {
                setNewCheckOut('');
            }
        } else {
            setNewCheckIn('');
            setNewCheckOut('');
        }
    };

    useEffect(() => {
        fetchTickets().then(() => {
            const params = new URLSearchParams(window.location.search);
            const urlId = params.get('id');
            if (urlId) {
                // Ensure state takes effect slightly after fetch
                setTimeout(() => {
                    setTickets(currentTickets => {
                        const target = currentTickets.find(t => t._id === urlId);
                        if (target) handleTicketClick(target);
                        return currentTickets;
                    });
                }, 100);
            }
        });
        
        // Poll every 30s
        const interval = setInterval(fetchTickets, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleResolve = async (status) => {
        if (['RESOLVED', 'REJECTED'].includes(status) && !resolveNote.trim()) {
            return showToast('Vui lòng nhập ghi chú phản hồi cho người gửi!', 'error');
        }
        
        if (status === 'RESOLVED' && selectedTicket.category === 'ATTENDANCE') {
            if (!newCheckIn || !newCheckOut) {
                return showToast('Vui lòng nhập giờ Vào & Ra hợp lệ để giải quyết phiếu chấm công!', 'error');
            }
        }
        
        try {
            setIsResolving(true);
            const token = sessionStorage.getItem('token');
            const data = { status, adminNote: resolveNote };
            if (selectedTicket.category === 'ATTENDANCE' && status === 'RESOLVED') {
                data.newCheckIn = newCheckIn;
                data.newCheckOut = newCheckOut;
            }
            
            const res = await axios.put(`${API}/tickets/${selectedTicket._id}/resolve`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                showToast(`Đã ${status === 'RESOLVED' ? 'giải quyết' : 'từ chối'} phiếu hỗ trợ!`, 'success');
                setSelectedTicket(null);
                setResolveNote('');
                setNewCheckIn('');
                setNewCheckOut('');
                fetchTickets();
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Lỗi lưu thông tin', 'error');
        } finally {
            setIsResolving(false);
        }
    };

    const getStatusInfo = (status) => {
        switch(status) {
            case 'PENDING': return { text: 'Chờ tiếp nhận', color: '#b45309', bg: '#fef3c7', icon: <Clock size={14} /> };
            case 'IN_PROGRESS': return { text: 'Đang xử lý', color: '#1d4ed8', bg: '#dbeafe', icon: <Headset size={14} /> };
            case 'RESOLVED': return { text: 'Đã giải quyết', color: '#166534', bg: '#dcfce7', icon: <CheckCircle2 size={14} /> };
            case 'REJECTED': return { text: 'Từ chối', color: '#991b1b', bg: '#fee2e2', icon: <XCircle size={14} /> };
            default: return { text: status, color: '#333', bg: '#eee', icon: null };
        }
    };

    const getCategoryBadge = (cat) => {
        switch(cat) {
            case 'ATTENDANCE': return { text: 'Chấm công', color: '#0369a1', bg: '#e0f2fe' };
            case 'PAYROLL': return { text: 'Lương / Thưởng', color: '#7e22ce', bg: '#f3e8ff' };
            case 'SERVICE': return { text: 'Góp ý dịch vụ', color: '#b45309', bg: '#fef3c7' };
            case 'STAFF': return { text: 'Thái độ N.Viên', color: '#be185d', bg: '#fce7f3' };
            case 'BILLING': return { text: 'Hóa đơn', color: '#0f766e', bg: '#ccfbf1' };
            case 'APPOINTMENT': return { text: 'Lịch hẹn', color: '#4338ca', bg: '#e0e7ff' };
            default: return { text: 'Khác', color: '#334155', bg: '#f1f5f9' };
        }
    };
    
    // Lọc
    const filteredTickets = tickets.filter(t => {
        if (filterRole === 'CUSTOMER' && t.senderId?.role !== 'CUSTOMER') return false;
        if (filterRole === 'STAFF' && t.senderId?.role === 'CUSTOMER') return false;
        
        if (filterStatus === 'HISTORY') {
            if (t.status !== 'RESOLVED' && t.status !== 'REJECTED') return false;
        } else if (filterStatus !== 'ALL') {
            if (t.status !== filterStatus) return false;
        }

        if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
        return true;
    });

    const pendingCustomerCount = tickets.filter(t => t.senderId?.role === 'CUSTOMER' && t.status === 'PENDING').length;
    const pendingStaffCount = tickets.filter(t => t.senderId?.role !== 'CUSTOMER' && t.status === 'PENDING').length;

    return (
        <Layout>
            <div className="helpdesk-container fade-in">
                <div className="helpdesk-header">
                    <div className="helpdesk-header-top">
                        <div className="title-section">
                            <div className="title-icon-wrapper">
                                <Headset size={26} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2>Trung Tâm Hỗ Trợ & Khiếu Nại</h2>
                                <p>Quản lý yêu cầu từ Khách hàng và Nhân viên</p>
                            </div>
                        </div>
                    </div>
                
                    <div className="helpdesk-filters" style={{ flexWrap: 'wrap', gap: '16px' }}>
                        <div className="helpdesk-tabs" style={{ marginBottom: '8px' }}>
                            <button 
                                className={`helpdesk-tab ${filterRole === 'CUSTOMER' ? 'active' : ''}`}
                                onClick={() => setFilterRole('CUSTOMER')}
                                style={{ position: 'relative' }}
                            >
                                Yêu cầu từ Khách hàng
                                {pendingCustomerCount > 0 && (
                                    <span style={{ position: 'absolute', top: '-8px', right: '-12px', background: '#ef4444', color: 'white', borderRadius: '12px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        {pendingCustomerCount}
                                    </span>
                                )}
                            </button>
                            <button 
                                className={`helpdesk-tab ${filterRole === 'STAFF' ? 'active' : ''}`}
                                onClick={() => setFilterRole('STAFF')}
                                style={{ position: 'relative', marginLeft: '12px' }}
                            >
                                Yêu cầu từ Nhân viên
                                {pendingStaffCount > 0 && (
                                    <span style={{ position: 'absolute', top: '-8px', right: '-12px', background: '#ef4444', color: 'white', borderRadius: '12px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                        {pendingStaffCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="helpdesk-tabs">
                            {['ALL', 'PENDING', 'IN_PROGRESS', 'HISTORY'].map(status => (
                                <button 
                                    key={status} 
                                    className={`helpdesk-tab ${filterStatus === status ? 'active' : ''}`}
                                    onClick={() => setFilterStatus(status)}
                                >
                                    {status === 'ALL' ? 'Tất cả trạng thái' : 
                                     status === 'PENDING' ? 'Chờ tiếp nhận' : 
                                     status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Lịch sử (Đã chốt)'}
                                </button>
                            ))}
                        </div>
                        
                        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="helpdesk-select">
                            <option value="ALL">Tất cả danh mục</option>
                            <option value="ATTENDANCE">Chấm công</option>
                            <option value="PAYROLL">Lương / Thưởng</option>
                            <option value="SERVICE">Dịch vụ</option>
                            <option value="STAFF">Thái độ nhân viên</option>
                            <option value="BILLING">Hóa đơn</option>
                            <option value="APPOINTMENT">Lịch hẹn</option>
                        </select>
                    </div>
                </div>

            <div className="helpdesk-content">
                {loading ? (
                    <div className="loader-container"><div className="spinner"></div></div>
                ) : filteredTickets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><CheckCircle2 size={48} /></div>
                        <h3>Tuyệt vời!</h3>
                        <p>Không có phiếu hỗ trợ nào đang cần giải quyết.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                            <thead style={{ background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Mã Phiếu</th>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Người Gửi</th>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Danh Mục</th>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Nội Dung Yêu Cầu</th>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>T.Gian Gửi</th>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5' }}>Trạng Thái</th>
                                    <th style={{ padding: '16px', fontWeight: '600', borderBottom: '1px solid #eef2f5', textAlign: 'right' }}>Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTickets.map(ticket => {
                                    const statusInfo = getStatusInfo(ticket.status);
                                    const catInfo = getCategoryBadge(ticket.category);
                                    const senderRole = ticket.senderId?.role === 'CUSTOMER' ? 'Khách hàng' : 'Nhân sự';
                                    return (
                                        <tr key={ticket._id} onClick={() => handleTicketClick(ticket)} style={{ cursor: 'pointer', borderBottom: '1px solid #eef2f5', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <td style={{ padding: '16px' }}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-glow)', padding: '4px 8px', borderRadius: '6px' }}>#{ticket._id.slice(-6).toUpperCase()}</span></td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {ticket.senderId?.avatar ? (
                                                        <img src={ticket.senderId.avatar} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><User size={16} /></div>
                                                    )}
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{ticket.senderId?.fullName || "Người dùng"}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{senderRole}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{ background: catInfo.bg, color: catInfo.color, padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {catInfo.text}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{ticket.subject}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.content}</div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>{new Date(ticket.createdAt).toLocaleDateString('vi-VN')}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(ticket.createdAt).toLocaleTimeString('vi-VN')}</div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: statusInfo.bg, color: statusInfo.color, padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {statusInfo.icon} {statusInfo.text}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'right' }}>
                                                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleTicketClick(ticket); }} title="Xem chi tiết" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', color: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <ChevronRight size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Detail & Resolve */}
            {selectedTicket && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, width: '90%', maxWidth: '800px', background: 'white', borderRadius: '20px', overflow: 'hidden' }}>
                        <button className="modal-close-btn" onClick={() => setSelectedTicket(null)}>
                            <X size={18} strokeWidth={2.5} />
                        </button>
                        <div className="modal-header" style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div>
                                <span className="modal-id" style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-glow)', padding: '4px 10px', borderRadius: '8px', display: 'inline-block', marginBottom: '8px' }}>#{selectedTicket._id.slice(-6).toUpperCase()}</span>
                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{selectedTicket.subject}</h3>
                            </div>
                        </div>
                        
                        <div className="modal-body" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Người gửi</label>
                                    <div className="val_bold">{selectedTicket.senderId?.fullName} ({selectedTicket.senderId?.role})</div>
                                </div>
                                <div className="info-item">
                                    <label>Ngày gửi</label>
                                    <div className="val">{new Date(selectedTicket.createdAt).toLocaleString('vi-VN')}</div>
                                </div>
                                <div className="info-item">
                                    <label>Danh mục</label>
                                    <div className="val_bold" style={{ color: getCategoryBadge(selectedTicket.category).color }}>{getCategoryBadge(selectedTicket.category).text}</div>
                                </div>
                                {selectedTicket.attachment && (
                                    <div className="info-item" style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Ảnh minh chứng</label>
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={() => setPreviewImage(selectedTicket.attachment)} 
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: 'var(--primary)' }}
                                        >
                                            <Camera size={16} /> Nhấn để xem ảnh đính kèm
                                        </button>
                                    </div>
                                )}
                                {selectedTicket.referenceId && selectedTicket.category !== 'ATTENDANCE' && (
                                    <div className="info-item" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                            <FileText size={16} /> Liên kết đính kèm: {
                                                ['INVOICE', 'Invoice'].includes(selectedTicket.referenceType) ? 'Hóa Đơn' : 
                                                ['APPOINTMENT', 'Appointment'].includes(selectedTicket.referenceType) ? 'Lịch Hẹn' : 
                                                ['PAYROLL', 'Payroll'].includes(selectedTicket.referenceType) ? 'Bảng Lương' : 
                                                ['MEDICAL_RECORD', 'MedicalRecord'].includes(selectedTicket.referenceType) ? 'Bệnh Án' : 
                                                ['GROOMING_ORDER', 'GroomingOrder'].includes(selectedTicket.referenceType) ? 'Phiếu Spa' : 
                                                ['VACCINATION', 'Vaccination'].includes(selectedTicket.referenceType) ? 'Tiêm Phòng' : 'Hồ Sơ'
                                            }
                                        </label>
                                        
                                        {/* Hiển thị link đính kèm đơn giản */}
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Mã tham chiếu đính kèm</div>
                                                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#0f172a' }}>
                                                    #{selectedTicket.referenceId?._id 
                                                        ? selectedTicket.referenceId._id.slice(-6).toUpperCase() 
                                                        : typeof selectedTicket.referenceId === 'string' 
                                                            ? selectedTicket.referenceId.slice(-6).toUpperCase() 
                                                            : 'N/A'}
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {['INVOICE', 'Invoice'].includes(selectedTicket.referenceType) && (
                                                    <button onClick={() => handleNavigate(`/invoices?search=${getSearchParam()}&from=helpdesk`)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Tra cứu Hóa Đơn</button>
                                                )}
                                                {['APPOINTMENT', 'Appointment'].includes(selectedTicket.referenceType) && (
                                                    <button onClick={() => handleNavigate(`/appointments?search=${getSearchParam()}&from=helpdesk`)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Tra cứu Lịch Hẹn</button>
                                                )}
                                                {['PAYROLL', 'Payroll'].includes(selectedTicket.referenceType) && (
                                                    <button onClick={() => handleNavigate(`/profile?tab=payroll&from=helpdesk`)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Tra cứu Bảng Lương</button>
                                                )}
                                                {['MEDICAL_RECORD', 'MedicalRecord'].includes(selectedTicket.referenceType) && (
                                                    <button onClick={() => handleNavigate(`/records?search=${getSearchParam()}&from=helpdesk`, ['ADMIN', 'DOCTOR'])} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Tra cứu Bệnh Án</button>
                                                )}
                                                {['GROOMING_ORDER', 'GroomingOrder'].includes(selectedTicket.referenceType) && (
                                                    <button onClick={() => handleNavigate(`/grooming?search=${getSearchParam()}&from=helpdesk`)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Tra cứu Phiếu Spa</button>
                                                )}
                                                {['VACCINATION', 'Vaccination'].includes(selectedTicket.referenceType) && (
                                                    <button onClick={() => handleNavigate(`/pets?search=${getSearchParam()}&from=helpdesk`)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Tra cứu Hồ Sơ Tiêm</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="content-box">
                                <label>Nội dung chi tiết:</label>
                                <p>{selectedTicket.content}</p>
                            </div>

                            {['PENDING', 'IN_PROGRESS'].includes(selectedTicket.status) && (
                                <div className="resolve-section">
                                    <h4>Khu vực Xử lý</h4>
                                    
                                    {selectedTicket.category === 'ATTENDANCE' && (
                                        <div className="attendance-resolver">
                                            <div className="alert-box">
                                                <strong>⚠️ Yêu cầu sửa chấm công</strong>
                                                <p>Hệ thống sẽ tự động ghi đè giờ Check-in / Check-out và hủy bỏ mức phạt 0 giờ của ca trực này nếu bạn Duyệt. Vui lòng kiểm tra lại Camera và điền giờ chính xác.</p>
                                            </div>
                                            <div className="flex-inputs">
                                                <div>
                                                    <label>Giờ vào thực tế</label>
                                                    <input type="datetime-local" value={newCheckIn} onChange={e=>setNewCheckIn(e.target.value)} />
                                                </div>
                                                <div>
                                                    <label>Giờ ra thực tế</label>
                                                    <input type="datetime-local" value={newCheckOut} onChange={e=>setNewCheckOut(e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="textarea-wrapper">
                                        <label>Ghi chú phản hồi (Khách / Nhân viên sẽ đọc được nội dung này)</label>
                                        <textarea 
                                            rows="4" 
                                            placeholder="Nhập ghi chú hoặc lý do giải quyết..."
                                            value={resolveNote}
                                            onChange={e => setResolveNote(e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="action-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {selectedTicket.status === 'PENDING' && (
                                            <button className="btn btn-secondary" style={{ flex: '1 1 100%', height: '48px', color: '#1d4ed8', background: '#dbeafe', borderColor: '#bfdbfe' }} disabled={isResolving} onClick={() => handleResolve('IN_PROGRESS')}>
                                                <Headset size={18}/> Tiếp nhận & Đang xử lý
                                            </button>
                                        )}
                                        <button className="btn btn-danger-soft" style={{ flex: 1, height: '48px' }} disabled={isResolving} onClick={() => handleResolve('REJECTED')}>
                                            <XCircle size={18}/> Từ chối yêu cầu
                                        </button>
                                        <button className="btn btn-primary" style={{ flex: 1, height: '48px', background: '#16a34a', borderColor: '#16a34a' }} disabled={isResolving} onClick={() => handleResolve('RESOLVED')}>
                                            <CheckCircle2 size={18}/> Phê duyệt & Chốt phiếu
                                        </button>
                                    </div>
                                </div>
                            )}

                            {['RESOLVED', 'REJECTED'].includes(selectedTicket.status) && (
                                <div className={`resolved-info ${selectedTicket.status === 'REJECTED' ? 'rejected' : ''}`}>
                                    <div className="resolved-header">
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: selectedTicket.status === 'RESOLVED' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selectedTicket.status === 'RESOLVED' ? <CheckCircle2 size={18} color="#16a34a" /> : <XCircle size={18} color="#dc2626" />}
                                        </div>
                                        <span>Phiếu này đã được chốt bởi <b>{selectedTicket.resolvedBy?.fullName || 'Admin'}</b> vào {new Date(selectedTicket.resolvedAt).toLocaleString('vi-VN')}</span>
                                    </div>
                                    <div className="resolved-note">
                                        <strong>Ghi chú xử lý: </strong>
                                        <p>{selectedTicket.adminNote || 'Không có ghi chú.'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            </div>
            {/* Fullscreen Image Preview */}
            {previewImage && createPortal(
                <div 
                    className="modal-overlay animate-fade-in" 
                    style={{ zIndex: 9999, background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    onClick={() => setPreviewImage(null)}
                >
                    <button 
                        style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                    >
                        <X size={24} />
                    </button>
                    <img 
                        src={previewImage} 
                        alt="Preview" 
                        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} 
                        onClick={e => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </Layout>
    );
}
