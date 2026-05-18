import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API } from '../constants';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Lock, Save, ShieldCheck, ShieldX, RefreshCw, AlertCircle, MessageSquare, Clock, Camera, ScanFace, Loader2, FileText, DollarSign, ClipboardList, CheckCircle2, XCircle, ChevronRight, Banknote, X } from 'lucide-react';
import { loadFaceModels, validateFacePhoto, checkFaceDuplicate } from '../utils/faceVerify';
import { uploadBase64ToCloudinary } from '../utils/uploadHelper';
import { Camera as CameraIcon } from 'lucide-react';
import InternalForgotPasswordModal from '../components/InternalForgotPasswordModal';
import EmailVerificationModal from '../components/EmailVerificationModal';

const getToken = () => sessionStorage.getItem('token');
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

// ── Modal chi tiết hoa hồng (nhân viên tự xem) ──
const CommissionDetailModal = ({ isOpen, onClose, py }) => {
    const [commissions, setCommissions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && py) {
            const fetchCommissions = async () => {
                setLoading(true);
                try {
                    const res = await axios.get(`${API}/hrm/my-commissions?month=${py.month}&year=${py.year}`, { headers: authHeader() });
                    if (res.data.success) {
                        setCommissions(res.data.data);
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoading(false);
                }
            };
            fetchCommissions();
        }
    }, [isOpen, py]);

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }} onMouseDown={onClose}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onMouseDown={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>Chi tiết Hoa hồng (Tháng {py.month}/{py.year})</h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '50%', padding: '6px', color: '#64748b' }}><X size={18} /></button>
                </div>
                {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div> : commissions.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Không có hóa đơn hoa hồng nào trong tháng này.</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {commissions.map(c => (
                            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #f1f5f9', borderRadius: '12px', background: '#f8fafc' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>Hóa đơn {c.invoiceType}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Ngày đối soát: {new Date(c.updatedAt).toLocaleDateString('vi-VN')}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '1rem' }}>+{c.commission.toLocaleString('vi-VN')}đ</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>DV: {c.serviceTotal.toLocaleString()}đ · Thuốc/Bán lẻ: {c.medicineTotal.toLocaleString()}đ</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Modal gửi phiếu khiếu nại lương ──
const PayrollComplaintModal = ({ isOpen, onClose, py, onSubmit }) => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                category: 'PAYROLL',
                subject: `Khiếu nại bảng lương tháng ${py.month}/${py.year}`,
                content,
                referenceType: 'Payroll',
                referenceId: py._id
            };
            const res = await axios.post(`${API}/tickets`, payload, { headers: authHeader() });
            if (res.data.success) {
                onSubmit();
                onClose();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }} onMouseDown={onClose}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }} onMouseDown={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: '#ef4444', fontWeight: 800 }}>Khiếu nại lương tháng {py.month}/{py.year}</h3>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '50%', padding: '6px', color: '#64748b' }}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Chi tiết vấn đề <span style={{ color: '#ef4444' }}>*</span></label>
                        <textarea required value={content} onChange={e => setContent(e.target.value)} rows="5" className="input-field" style={{ width: '100%', resize: 'none' }} placeholder="VD: Sai số lần đi trễ, thiếu hoa hồng dịch vụ hóa đơn ngày 05/11..."></textarea>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <button type="button" onClick={onClose} className="btn btn-secondary">Khép lại</button>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', minWidth: '120px' }}>{loading ? 'Đang gửi...' : 'Gửi Phiếu'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Modal chi tiết phiếu lương (nhân viên tự xem) ──
const StaffPayrollModal = ({ py, user, onClose, onOpenCommissions, onComplain }) => {
    const roleLabel = { DOCTOR: 'Bác sĩ thú y', RECEPTIONIST: 'Lễ Tân / Phụ Tá', GROOMER: 'Groomer' }[user?.role] || user?.role || '';
    const absentPenalty = Math.max(0, (py.deductions || 0) - (py.leaveDeduction || 0) - (py.latePenalty || 0));
    const totalIncome = (py.baseSalary || 0) + (py.commissions || 0) + (py.bonus || 0);
    const totalDeduct = py.deductions || 0;
    const netSalary = py.totalSalary || 0;
    const hourlyRateDisplay = py.hourlyRate > 0 ? py.hourlyRate.toLocaleString('vi-VN') + 'đ/h' : '—';
    const hourlyRateNum = py.hourlyRate || 0;
    const publishedText = py.publishedAt && !isNaN(new Date(py.publishedAt)) ? new Date(py.publishedAt).toLocaleDateString('vi-VN') : 'Chưa rõ';
    const name = user?.fullName || 'Nhân viên';

    const Row = ({ label, value, bold, color, sub }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.83rem', color: bold ? '#0f172a' : '#475569', fontWeight: bold ? 700 : 400, flex: 1 }}>
                {label}
                {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
            </span>
            <span style={{ fontSize: bold ? '0.93rem' : '0.85rem', fontWeight: bold ? 800 : 600, color: color || (bold ? '#0f172a' : '#334155'), whiteSpace: 'nowrap', marginLeft: '12px' }}>{value}</span>
        </div>
    );

    const SectionCard = ({ title, children }) => (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
            <div style={{ padding: '0 16px' }}>{children}</div>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
            <div style={{ display: 'flex', borderRadius: '20px', width: '100%', maxWidth: '820px', maxHeight: '88vh', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                {/* Sidebar xanh */}
                <div style={{ width: '260px', flexShrink: 0, background: 'linear-gradient(160deg, #059669, #10b981)', padding: '24px 20px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px', textAlign: 'center' }}>
                        <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 900, color: 'white', border: '3px solid rgba(255,255,255,0.3)' }}>{name.charAt(0)}</div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>Phiếu lương</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'white', marginBottom: '2px' }}>{name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>{roleLabel} · Tháng {py.month}/{py.year}</div>
                        </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Thu nhập <sup>(1)</sup></span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{totalIncome.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Khấu trừ <sup>(2)</sup></span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: totalDeduct > 0 ? '#ef4444' : '#64748b' }}>{totalDeduct > 0 ? '−' : ''}{totalDeduct.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Thực lĩnh <sup>(3)</sup></div>
                                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>(3) = (1) − (2)</div>
                            </div>
                            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{netSalary.toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>
                </div>

                {/* Panel chi tiết */}
                <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Chi tiết bảng lương</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                Kỳ lương: 01/{py.month}/{py.year} – {new Date(py.year, py.month, 0).getDate()}/{py.month}/{py.year}
                                {' · Công bố: '}{publishedText}
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, fontSize: '1rem' }}>×</button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
                        <SectionCard title="Chấm công">
                            <Row label="Số ngày làm việc" value={`${py.workingDays || 0} ngày`} />
                            <Row label="Tổng giờ làm" value={`${(py.totalHoursWorked || 0).toFixed(1)}h`} />
                            <Row label="Đơn giá giờ" value={hourlyRateDisplay} />
                            <Row label="Số lần đi trễ" value={py.lateCount > 0 ? `${py.lateCount} lần (${py.totalLateMins || 0} phút)` : '—'} />
                            <Row label="Giờ ca đêm" value={py.nightHoursWorked > 0 ? `${py.nightHoursWorked}h (${py.nightShiftsCount || 0} ca)` : '—'} />
                        </SectionCard>
                        <SectionCard title="Thu nhập">
                            <Row label="Lương cơ bản" value={`${(py.baseSalary || 0).toLocaleString('vi-VN')}đ`} sub={`${(py.totalHoursWorked || 0).toFixed(1)}h × ${hourlyRateNum > 0 ? hourlyRateNum.toLocaleString('vi-VN') : '?'}đ/h`} />
                            <div
                                onClick={() => py.commissions > 0 && onOpenCommissions && onOpenCommissions(py)}
                                style={{ cursor: py.commissions > 0 ? 'pointer' : 'default', transition: 'background 0.2s', borderRadius: '8px', padding: '0 8px', margin: '0 -8px' }}
                                className={py.commissions > 0 ? 'hover-bg-slate-50' : ''}
                            >
                                <Row label={<span>Hoa hồng dịch vụ {py.commissions > 0 && <span style={{ fontSize: '0.7rem', color: '#6366f1', marginLeft: '6px', textDecoration: 'underline', fontWeight: 600 }}>(Xem chi tiết)</span>}</span>} value={py.commissions > 0 ? `+${py.commissions.toLocaleString('vi-VN')}đ` : '—'} color={py.commissions > 0 ? '#16a34a' : undefined} />
                            </div>
                            <Row label="Phụ cấp ca đêm" value={py.bonus > 0 ? `+${py.bonus.toLocaleString('vi-VN')}đ` : '—'} color={py.bonus > 0 ? '#16a34a' : undefined} />
                            <Row label="Tổng thu nhập" value={`${totalIncome.toLocaleString('vi-VN')}đ`} bold color="#0f172a" />
                        </SectionCard>
                        <SectionCard title="Khấu trừ">
                            <Row label="Nghỉ không lương" value={(py.leaveDeduction || 0) > 0 ? `−${py.leaveDeduction.toLocaleString('vi-VN')}đ` : '—'} sub={py.unpaidDays > 0 ? `${py.unpaidDays} ngày` : undefined} color="#ef4444" />
                            <Row label="Đi trễ" value={(py.latePenalty || 0) > 0 ? `−${py.latePenalty.toLocaleString('vi-VN')}đ` : '—'} sub={py.lateCount > 0 ? `${py.lateCount} lần · ${py.totalLateMins || 0} phút` : undefined} color="#ef4444" />
                            <Row label="Vắng (có lịch, không chấm)" value={absentPenalty > 0 ? `−${absentPenalty.toLocaleString('vi-VN')}đ` : '—'} color="#ef4444" />
                            <Row label="Tổng khấu trừ" value={totalDeduct > 0 ? `−${totalDeduct.toLocaleString('vi-VN')}đ` : '0đ'} bold color={totalDeduct > 0 ? '#ef4444' : '#64748b'} />
                        </SectionCard>
                        {py.note && (
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                                <div style={{ fontWeight: 700, marginBottom: '3px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ghi chú</div>
                                {py.note}
                            </div>
                        )}
                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => onComplain && onComplain(py)} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }}>
                                <AlertCircle size={16} /> Nhắn tin khiếu nại phiếu lương này
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Profile = () => {
    const { user, login, updateUser } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [profileData, setProfileData] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        address: '',
        verificationPhoto: ''
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [showInternalForgotPW, setShowInternalForgotPW] = useState(false);
    const [showEmailVerify, setShowEmailVerify] = useState(false);
    const [pendingEmailChange, setPendingEmailChange] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [capturedPhoto, setCapturedPhoto] = useState(null); // ảnh hiện tại từ DB (hiển thị avatar)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPhoto, setNewPhoto] = useState(null);   // ảnh chụp mới trong modal session
    const [validating, setValidating] = useState(false);
    const [validationMsg, setValidationMsg] = useState(null);   // { ok, text }
    const [streamKey, setStreamKey] = useState(0);      // trigger gắn stream
    const [faceResetState, setFaceResetState] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetReason, setResetReason] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    // Camera trong modal yêu cầu (dành cho nhân viên)
    const resetVideoRef = useRef(null);
    const resetStreamRef = useRef(null);
    const resetCanvasRef = useRef(null);
    const [resetCameraOpen, setResetCameraOpen] = useState(false);
    const [resetPhoto, setResetPhoto] = useState(null);       // ảnh tự chụp kèm yêu cầu
    const [resetValidating, setResetValidating] = useState(false);
    const [resetValidMsg, setResetValidMsg] = useState(null); // { ok, text }

    // Tab state cho non-CUSTOMER
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'profile';
    }); // 'profile' | 'requests' | 'payroll'
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.has('tab')) setActiveTab(params.get('tab'));
    }, [location.search]);

    const [complainPayroll, setComplainPayroll] = useState(null);
    const [commissionDetailsPayroll, setCommissionDetailsPayroll] = useState(null);
    const [myRequests, setMyRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [myPayrolls, setMyPayrolls] = useState([]);
    const [payrollLoading, setPayrollLoading] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState(null);

    const isAdmin = user?.role === 'ADMIN';
    const isStaff = user?.role && user.role !== 'CUSTOMER';

    // Gắn stream vào video sau khi modal mở hoặc camera restart
    useEffect(() => {
        if (isModalOpen && !newPhoto && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [streamKey, isModalOpen]);

    // Gắn stream camera yêu cầu FaceID (nhân viên)
    useEffect(() => {
        if (resetCameraOpen && resetVideoRef.current && resetStreamRef.current) {
            resetVideoRef.current.srcObject = resetStreamRef.current;
        }
    }, [resetCameraOpen]);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get(`${API}/users/me/profile`, { headers: authHeader() });
            const data = res.data.data;
            setProfileData(data);
            setCapturedPhoto(data.verificationPhoto);
            setFaceResetState(data.faceResetRequest || null);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMyRequests = async () => {
        setRequestsLoading(true);
        try {
            const res = await axios.get(`${API}/users/me/requests`, { headers: authHeader() });
            setMyRequests(res.data.data || []);
        } catch (e) { console.error(e); }
        finally { setRequestsLoading(false); }
    };

    const fetchMyPayrolls = async () => {
        setPayrollLoading(true);
        try {
            const res = await axios.get(`${API}/hrm/payrolls/my`, { headers: authHeader() });
            setMyPayrolls(res.data.data || []);
        } catch (e) { console.error(e); }
        finally { setPayrollLoading(false); }
    };

    // Fetch khi chuyển tab
    useEffect(() => {
        if (activeTab === 'requests' && myRequests.length === 0) fetchMyRequests();
        if (activeTab === 'payroll' && myPayrolls.length === 0) fetchMyPayrolls();
    }, [activeTab]);

    const highlightTicketId = location.state?.highlightTicketId;
    useEffect(() => {
        if (highlightTicketId && activeTab === 'requests' && myRequests.length > 0) {
            setTimeout(() => {
                const el = document.getElementById(`request-${highlightTicketId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const req = myRequests.find(r => r._id === highlightTicketId);
                if (req) setSelectedRequest(req);
            }, 600);
        }
    }, [highlightTicketId, activeTab, myRequests]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                address: profileData.address,
                verificationPhoto: capturedPhoto
            };
            
            await axios.put(`${API}/users/me/profile`, payload, { headers: authHeader() });
            showToast('Cập nhật hồ sơ thành công', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Lỗi cập nhật', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEmailClick = async () => {
        if (!profileData.email || profileData.email === user?.email) return;
        setEmailLoading(true);
        try {
            const emailReq = await axios.post(`${API}/users/me/request-email-change`, { newEmail: profileData.email }, { headers: authHeader() });
            if (emailReq.data.success) {
                setPendingEmailChange(profileData.email);
                setShowEmailVerify(true);
            } else {
                showToast('Lỗi gửi yêu cầu xác nhận email mới.', 'error');
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Lỗi gửi yêu cầu xác nhận', 'error');
        } finally {
            setEmailLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return showToast('Mật khẩu mới không khớp', 'warning');
        }
        setLoading(true);
        try {
            await axios.put(`${API}/users/me/password`, {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            }, { headers: authHeader() });
            showToast('Đổi mật khẩu thành công', 'success');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            showToast(error.response?.data?.message || 'Mật khẩu hiện tại không đúng', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Camera helpers ─────────────────────────────────────────────
    const stopStream = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };
    const closeModal = () => {
        stopStream();
        setIsModalOpen(false);
        setNewPhoto(null);
        setValidationMsg(null);
        setValidating(false);
    };
    const openCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            streamRef.current = stream;
            setNewPhoto(null);
            setValidationMsg(null);
            setIsModalOpen(true);
            setStreamKey(k => k + 1); // trigger useEffect
        } catch { showToast('Không thể truy cập camera. Kiểm tra quyền trong trình duyệt.', 'error'); }
    };
    const takePhoto = async () => {
        if (!videoRef.current) return;
        // Tạo offscreen canvas độc lập với DOM → không bị null khi re-render
        const offscreen = document.createElement('canvas');
        offscreen.width = videoRef.current.videoWidth;
        offscreen.height = videoRef.current.videoHeight;
        offscreen.getContext('2d').drawImage(videoRef.current, 0, 0);
        const dataUrl = offscreen.toDataURL('image/jpeg', 0.9);

        stopStream();                // dừng stream, modal vẫn mở
        setNewPhoto(dataUrl);        // hiện ảnh trong modal
        setValidationMsg(null);
        setValidating(true);
        try {
            await loadFaceModels();
            const result = await validateFacePhoto(offscreen);
            
            if (!result.valid) {
                setValidationMsg({ ok: false, text: result.message });
                setTimeout(() => openCamera(), 2800);
                return;
            }

            setValidationMsg({ ok: null, text: '🔍 Đang kiểm tra trùng lặp khuôn mặt...' });
            
            let staffList = [];
            try {
                const token = sessionStorage.getItem('token');
                const res = await fetch('https://vet-clinic-1j57.onrender.com/api/v1/users/me/other-face-photos', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                staffList = data.data || [];
            } catch (err) {
                console.error(err);
                setValidationMsg({ ok: false, text: 'Lỗi mạng khi kiểm tra khuôn mặt. Vui lòng thử lại.' });
                setTimeout(() => openCamera(), 3500);
                return;
            }

            const dupResult = await checkFaceDuplicate(offscreen, staffList);
            if (dupResult.isDuplicate) {
                setValidationMsg({ ok: false, text: dupResult.message });
                setTimeout(() => openCamera(), 4500);
                return;
            }

            setValidationMsg({ ok: true, text: result.message });
        } catch (e) {
            setValidationMsg({ ok: false, text: 'Lỗi kiểm tra. Vui lòng chụp lại.' });
            setTimeout(() => openCamera(), 2500);
        } finally {
            setValidating(false);
        }
    };
    const confirmAndSave = async () => {
        if (!newPhoto) return;
        setLoading(true);
        try {
            const cloudUrl = await uploadBase64ToCloudinary(newPhoto);

            await axios.put(`${API}/users/me/profile`,
                { verificationPhoto: cloudUrl },
                { headers: authHeader() }
            );
            setCapturedPhoto(cloudUrl);  // cập nhật avatar card
            updateUser({ verificationPhoto: cloudUrl }); // sync AuthContext → MySchedule nhận ngay
            showToast('Ảnh FaceID đã được cập nhật!', 'success');
            closeModal();
        } catch (err) {
            showToast(err.response?.data?.message || 'Lỗi cập nhật ảnh.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendFaceResetRequest = async () => {
        if (resetReason.trim().length < 5) {
            return showToast('Vui lòng nhập lý do (ít nhất 5 ký tự).', 'warning');
        }
        if (!resetPhoto || resetValidMsg?.ok === false) {
            return showToast('Vui lòng chụp ảnh khuôn mặt hợp lệ để đính kèm yêu cầu.', 'warning');
        }
        setResetLoading(true);
        try {
            const cloudUrl = await uploadBase64ToCloudinary(resetPhoto);

            await axios.post(`${API}/users/me/face-reset-request`,
                { reason: resetReason, pendingFacePhoto: cloudUrl },
                { headers: authHeader() }
            );
            showToast('Yêu cầu và ảnh đã gửi đến Admin! Chờ Admin xét duyệt.', 'success');
            setShowResetModal(false);
            setResetReason('');
            setResetPhoto(null);
            setResetValidMsg(null);
            // Dừng camera nếu còn mở
            resetStreamRef.current?.getTracks().forEach(t => t.stop());
            resetStreamRef.current = null;
            setResetCameraOpen(false);
            fetchProfile();
        } catch (err) {
            showToast(err.response?.data?.message || 'Lỗi gửi yêu cầu.', 'error');
        } finally {
            setResetLoading(false);
        }
    };

    const openResetCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            resetStreamRef.current = stream;
            setResetPhoto(null);
            setResetValidMsg(null);
            setResetCameraOpen(true);
        } catch { showToast('Không thể mở camera.', 'error'); }
    };

    const takeResetPhoto = async () => {
        if (!resetVideoRef.current) return;
        const offscreen = document.createElement('canvas');
        offscreen.width = resetVideoRef.current.videoWidth;
        offscreen.height = resetVideoRef.current.videoHeight;
        offscreen.getContext('2d').drawImage(resetVideoRef.current, 0, 0);
        const dataUrl = offscreen.toDataURL('image/jpeg', 0.88);
        resetStreamRef.current?.getTracks().forEach(t => t.stop());
        resetStreamRef.current = null;
        setResetCameraOpen(false);
        setResetPhoto(dataUrl);
        setResetValidMsg(null);
        setResetValidating(true);
        try {
            await loadFaceModels();
            const result = await validateFacePhoto(offscreen);
            
            if (!result.valid) {
                setResetValidMsg({ ok: false, text: result.message });
                setTimeout(() => { setResetPhoto(null); setResetValidMsg(null); openResetCamera(); }, 2500);
                return;
            }

            setResetValidMsg({ ok: null, text: '🔍 Đang kiểm tra trùng lặp khuôn mặt...' });
            
            let staffList = [];
            try {
                const token = sessionStorage.getItem('token');
                const res = await fetch('https://vet-clinic-1j57.onrender.com/api/v1/users/me/other-face-photos', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                staffList = data.data || [];
            } catch (err) {
                setResetValidMsg({ ok: false, text: 'Lỗi mạng khi kiểm tra khuôn mặt. Thử lại.' });
                setTimeout(() => { setResetPhoto(null); setResetValidMsg(null); openResetCamera(); }, 3500);
                return;
            }

            const dupResult = await checkFaceDuplicate(offscreen, staffList);
            if (dupResult.isDuplicate) {
                setResetValidMsg({ ok: false, text: dupResult.message });
                setTimeout(() => { setResetPhoto(null); setResetValidMsg(null); openResetCamera(); }, 4500);
                return;
            }

            setResetValidMsg({ ok: true, text: result.message });
        } catch { 
            setResetValidMsg({ ok: false, text: 'Lỗi kiểm tra. Chụp lại.' }); 
            setTimeout(() => { setResetPhoto(null); setResetValidMsg(null); openResetCamera(); }, 2500);
        } finally { setResetValidating(false); }
    };

    return (
        <Layout>
            <div className="page-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Cài Đặt Cá Nhân</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Quản lý thông tin tài khoản và thiết lập sinh trắc học</p>
                </div>

                {/* Tab navigation — chỉ nhân viên */}
                {isStaff && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
                        {[
                            { key: 'profile', label: 'Hồ Sơ', icon: <User size={15} /> },
                            { key: 'requests', label: 'Yêu Cầu Đã Gửi', icon: <ClipboardList size={15} /> },
                            { key: 'payroll', label: 'Bảng Lương', icon: <Banknote size={15} /> },
                        ].map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                flex: 1, padding: '10px 16px', borderRadius: '9px', border: 'none',
                                background: activeTab === tab.key ? 'white' : 'transparent',
                                color: activeTab === tab.key ? 'var(--primary)' : '#64748b',
                                fontWeight: activeTab === tab.key ? 700 : 500,
                                fontSize: '0.85rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s'
                            }}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── TAB: HỒ SƠ (layout cũ) ── */}
                {activeTab === 'profile' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
                        {/* Left: Verification Photo & General Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
                                <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 700 }}>Xác Minh Khuôn Mặt</h3>

                                <div style={{
                                    width: '200px', height: '200px', borderRadius: '50%', margin: '0 auto 20px',
                                    border: `4px solid ${capturedPhoto ? 'var(--primary)' : '#e2e8f0'}`,
                                    overflow: 'hidden', background: '#f8fafc',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {capturedPhoto ? (
                                        <img src={capturedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="FaceID" />
                                    ) : (
                                        <User size={80} color="#cbd5e1" />
                                    )}
                                </div>

                                {capturedPhoto ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#16a34a', fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px' }}>
                                        <ShieldCheck size={18} /> Đã đăng ký khuôn mặt
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#dc2626', fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px' }}>
                                        <AlertCircle size={18} /> Chưa đăng ký khuôn mặt
                                    </div>
                                )}

                                {/* Admin: 1 nút duy nhất */}
                                {isAdmin ? (
                                    <div style={{ marginBottom: '12px' }}>
                                        <button
                                            onClick={() => openCamera()}
                                            className="btn btn-primary"
                                            style={{ width: '100%', fontSize: '0.85rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >
                                            <Camera size={15} />
                                            Cập nhật ảnh FaceID
                                        </button>
                                        <p style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                                            Bạn là Admin — mở camera, chụp ảnh hợp lệ là tự động lưu.
                                        </p>
                                    </div>
                                ) : (
                                    /* ── Nhân viên thường: yêu cầu ── */
                                    faceResetState?.requested ? (
                                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.8rem', color: '#92400e' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                                                <Clock size={14} /> Yêu cầu đang chờ Admin duyệt
                                            </div>
                                            <div style={{ color: '#78350f' }}>Lý do: <em>{faceResetState.reason}</em></div>
                                        </div>
                                    ) : capturedPhoto && (
                                        <button onClick={() => setShowResetModal(true)}
                                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <MessageSquare size={14} /> Yêu cầu đặt lại FaceID
                                        </button>
                                    )
                                )}

                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, background: '#f8fafc', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                                    {isAdmin
                                        ? 'Ảnh xác minh dùng để đối soát khuôn mặt khi chấm công. Hãy chụp rõ mặt, đủ sáng.'
                                        : <>Ảnh xác minh được đăng ký <strong>một lần duy nhất</strong> khi kích hoạt tài khoản. Liên hệ Admin nếu cần cập nhật.</>
                                    }
                                </p>

                            </div>

                            <div className="glass-card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--primary)', fontWeight: 700 }}>
                                    <ShieldCheck size={20} /> QUYỀN HẠN HỆ THỐNG
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="flex-between">
                                        <span style={{ color: 'var(--text-muted)' }}>Chức vụ:</span>
                                        <span style={{ fontWeight: 700 }}>{user?.role}</span>
                                    </div>
                                    <div className="flex-between">
                                        <span style={{ color: 'var(--text-muted)' }}>Mã NV:</span>
                                        <span style={{ fontWeight: 700 }}>#{user?._id?.slice(-6).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-between">
                                        <span style={{ color: 'var(--text-muted)' }}>Trạng thái:</span>
                                        <span className="badge badge-success">Đang làm việc</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Forms */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Profile Info Form */}
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ marginBottom: '24px', fontSize: '1.25rem', fontWeight: 800, borderBottom: '1px solid #eef2f5', paddingBottom: '12px' }}>
                                    Thông Tin Liên Hệ
                                </h3>
                                <form onSubmit={handleUpdateProfile}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                                        <div className="form-group">
                                            <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                                <User size={16} /> Họ và Tên
                                            </label>
                                            <input type="text" className="input-field" value={profileData.fullName} disabled style={{ background: '#f8fafc' }} />
                                        </div>
                                        <div className="form-group">
                                            <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                                <Phone size={16} /> Số Điện Thoại
                                            </label>
                                            <input type="text" className="input-field" value={profileData.phoneNumber} disabled style={{ background: '#f8fafc' }} />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '24px' }}>
                                        <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                            <Mail size={16} /> Địa chỉ Email
                                        </label>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <input
                                                type="email" className="input-field"
                                                value={profileData.email}
                                                onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                                                placeholder="yourname@gmail.com"
                                                style={{ flex: 1, height: '44px' }}
                                            />
                                            {profileData.email === user?.email ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem', padding: '0 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', height: '44px', whiteSpace: 'nowrap' }}>
                                                    <CheckCircle2 size={16} /> Đã xác minh
                                                </div>
                                            ) : (
                                                <button 
                                                    type="button" 
                                                    onClick={handleUpdateEmailClick} 
                                                    disabled={emailLoading || !profileData.email}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', padding: '0 16px', background: 'var(--primary)', border: 'none', borderRadius: '8px', height: '44px', cursor: (emailLoading || !profileData.email) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: (emailLoading || !profileData.email) ? 0.7 : 1, transition: 'all 0.2s' }}
                                                >
                                                    {emailLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={16} />}
                                                    {emailLoading ? 'Đang gửi...' : 'Xác minh & Cập nhật'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '32px' }}>
                                        <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                            <MapPin size={16} /> Địa Chỉ Thường Trú
                                        </label>
                                        <textarea
                                            className="input-field" rows="2"
                                            value={profileData.address}
                                            onChange={e => setProfileData({ ...profileData, address: e.target.value })}
                                            style={{ resize: 'none' }}
                                        ></textarea>
                                    </div>

                                    <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', padding: '12px 32px' }} disabled={loading}>
                                        <Save size={18} /> LƯU THAY ĐỔI
                                    </button>
                                </form>
                            </div>

                            {/* Password Change Form */}
                            <div className="glass-card" style={{ padding: '32px' }}>
                                <h3 style={{ marginBottom: '24px', fontSize: '1.25rem', fontWeight: 800, borderBottom: '1px solid #eef2f5', paddingBottom: '12px' }}>
                                    Bảo Mật & Mật Khẩu
                                </h3>
                                <form onSubmit={handleChangePassword}>
                                    <div className="form-group" style={{ marginBottom: '20px' }}>
                                        <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                            <Lock size={16} /> Mật khẩu hiện tại
                                        </label>
                                        <input
                                            type="password" className="input-field"
                                            value={passwordData.currentPassword}
                                            onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                                        <div className="form-group">
                                            <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                                <RefreshCw size={16} /> Mật khẩu mới
                                            </label>
                                            <input
                                                type="password" className="input-field"
                                                value={passwordData.newPassword}
                                                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="flex-y-center" style={{ gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                                <RefreshCw size={16} /> Xác nhận lại
                                            </label>
                                            <input
                                                type="password" className="input-field"
                                                value={passwordData.confirmPassword}
                                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', width: '100%' }}>
                                        <button type="button" onClick={() => setShowInternalForgotPW(true)} style={{ background: 'none', border: 'none', color: '#0fa9ac', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>Quên mật khẩu hiện tại?</button>
                                        <button type="submit" className="btn btn-secondary" style={{ width: 'fit-content', padding: '12px 32px', background: '#334155', color: '#fff' }} disabled={loading}>
                                            CẬP NHẬT MẬT KHẨU
                                        </button>
                                    </div>
                                    <InternalForgotPasswordModal isOpen={showInternalForgotPW} onClose={() => setShowInternalForgotPW(false)} userEmail={user?.email} />
                                    <EmailVerificationModal 
                                        isOpen={showEmailVerify} 
                                        onClose={() => setShowEmailVerify(false)} 
                                        newEmail={pendingEmailChange} 
                                        onSuccess={(newEmailAddr) => {
                                            updateUser({ email: newEmailAddr });
                                            showToast('Cập nhật email thành công', 'success');
                                        }} 
                                    />
                                </form>
                            </div>
                        </div>
                    </div>
                )} {/* end tab:profile */}

                {/* ── TAB: YÊU CẦU ĐÃ GỬI ── */}
                {activeTab === 'requests' && (
                    <div className="glass-card" style={{ padding: '28px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                                <ClipboardList size={20} color="var(--primary)" /> Lịch Sử Yêu Cầu
                            </div>
                            <button onClick={fetchMyRequests} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RefreshCw size={12} /> Làm mới
                            </button>
                        </div>
                        {requestsLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}><Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /></div>
                        ) : myRequests.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                                <ClipboardList size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                <div style={{ fontSize: '0.9rem' }}>Chưa có yêu cầu nào được ghi nhận</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {myRequests.map(req => {
                                    const statusMeta = {
                                        SENT: { label: 'Đã gửi', bg: '#eff6ff', color: '#2563eb' },
                                        APPROVED: { label: 'Được duyệt', bg: '#dcfce7', color: '#16a34a' },
                                        REJECTED: { label: 'Bị từ chối', bg: '#fee2e2', color: '#dc2626' },
                                        IN_PROGRESS: { label: 'Đang xử lý', bg: '#dbeafe', color: '#1d4ed8' },
                                        PENDING: { label: 'Chờ duyệt', bg: '#fffbeb', color: '#d97706' },
                                        CANCELLED: { label: 'Đã hủy', bg: '#f8fafc', color: '#94a3b8' },
                                    }[req.status] || { label: req.status, bg: '#f8fafc', color: '#64748b' };
                                    const catIcon = { FACE_ID: <ScanFace size={16} />, PASSWORD: <Lock size={16} />, LEAVE: <Clock size={16} />, PROFILE: <User size={16} />, ATTENDANCE: <ShieldX size={16} /> }[req.category] || <FileText size={16} />;
                                    return (
                                        <div key={req._id} id={`request-${req._id}`} onClick={() => setSelectedRequest(req)} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>{catIcon}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '3px' }}>{req.title}</div>
                                                <div style={{ fontSize: '0.77rem', color: '#64748b', marginBottom: '5px', lineHeight: 1.5 }}>{req.description}</div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.7rem', background: statusMeta.bg, color: statusMeta.color, padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>{statusMeta.label}</span>
                                                    {req.processedBy && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>bởi {req.processedBy}</span>}
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(req.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <div style={{ padding: '8px', background: '#f1f5f9', borderRadius: '50%', color: 'var(--primary)', display: 'flex' }}>
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: BẢNG LƯƠNG ── */}
                {activeTab === 'payroll' && (
                    <div>
                        <div className="glass-card" style={{ padding: '28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                                    <Banknote size={20} color="var(--primary)" /> Bảng Lương Của Tôi
                                </div>
                                <button onClick={fetchMyPayrolls} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <RefreshCw size={12} /> Làm mới
                                </button>
                            </div>
                            {payrollLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}><Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /></div>
                            ) : myPayrolls.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                                    <Banknote size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                                    <div style={{ fontSize: '0.9rem' }}>Chưa có bảng lương nào được công bố</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '6px', color: '#cbd5e1' }}>Admin sẽ công bố bảng lương sau khi chốt tháng</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                                    {myPayrolls.map(p => (
                                        <div key={p._id} onClick={() => setSelectedPayroll(p)}
                                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
                                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                                            style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', cursor: 'pointer', background: 'white', transition: 'all 0.2s' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Tháng {p.month}/{p.year}</span>
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>{p.totalSalary?.toLocaleString('vi-VN')}đ</div>
                                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#64748b' }}>
                                                <span>{p.workingDays || 0} ngày công</span>
                                                <span>•</span>
                                                <span>{(p.totalHoursWorked || 0).toFixed(1)}h làm việc</span>
                                            </div>
                                            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#94a3b8' }}>Công bố: {new Date(p.publishedAt).toLocaleDateString('vi-VN')}</div>
                                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, alignItems: 'center', gap: '4px' }}>
                                                Xem chi tiết <ChevronRight size={14} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal chi tiết lương — dùng component đẹp giống admin */}
                        {selectedPayroll && createPortal(
                            <StaffPayrollModal
                                py={selectedPayroll}
                                user={user}
                                onClose={() => setSelectedPayroll(null)}
                                onOpenCommissions={(py) => setCommissionDetailsPayroll(py)}
                                onComplain={(py) => setComplainPayroll(py)}
                            />,
                            document.body
                        )}
                        {/* Modal Khiếu Nại */}
                        {createPortal(
                            <PayrollComplaintModal isOpen={!!complainPayroll} py={complainPayroll} onClose={() => setComplainPayroll(null)} onSubmit={() => { showToast('Đã gửi khiếu nại thành công! Vui lòng theo dõi tại mục Hỗ Trợ.', 'success'); setComplainPayroll(null); fetchRequests(true); setActiveTab('requests'); }} />, document.body
                        )}
                        {/* Modal Chi Tiết Hoa Hồng */}
                        {createPortal(
                            <CommissionDetailModal isOpen={!!commissionDetailsPayroll} py={commissionDetailsPayroll} onClose={() => setCommissionDetailsPayroll(null)} />, document.body
                        )}
                    </div>
                )}

            </div>

            {/* Modal yêu cầu đặt lại FaceID */}
            {showResetModal && (
                <div className="modal-overlay" style={{ zIndex: 5000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '520px' }}>
                        <button className="modal-close-btn" onClick={() => {
                            setShowResetModal(false);
                            setResetPhoto(null); setResetValidMsg(null);
                            resetStreamRef.current?.getTracks().forEach(t => t.stop());
                            resetStreamRef.current = null;
                            setResetCameraOpen(false);
                        }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700 }}>✕</span>
                        </button>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <ScanFace size={20} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Yêu Cầu Cập Nhật FaceID</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
                                Chụp ảnh khuôn mặt mới và nhập lý do — Admin sẽ xét duyệt và cập nhật FaceID cho bạn.
                            </p>

                            {/* Camera chụp ảnh mới */}
                            <div style={{ width: '100%', aspectRatio: '4/3', background: '#1e293b', borderRadius: '14px', overflow: 'hidden', position: 'relative', marginBottom: '16px' }}>
                                {!resetPhoto ? (
                                    <>
                                        {resetCameraOpen ? (
                                            <>
                                                <video ref={resetVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)', width: '130px', height: '160px', border: '2px dashed rgba(255,255,255,0.8)', borderRadius: '50%', pointerEvents: 'none' }} />
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '7px', fontSize: '0.7rem', color: '#e0f2fe', textAlign: 'center' }}>
                                                    Nhìn thẳng · Đủ sáng · Không đeo kính / khẩu trang
                                                </div>
                                                <button onClick={takeResetPhoto} style={{ position: 'absolute', bottom: '44px', left: '50%', transform: 'translateX(-50%)', width: '52px', height: '52px', borderRadius: '50%', border: '4px solid #fff', background: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} />
                                            </>
                                        ) : (
                                            <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: '#94a3b8', gap: '12px' }}>
                                                <CameraIcon size={40} />
                                                <button type="button" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '8px 18px' }} onClick={openResetCamera}>
                                                    Mở Camera Chụp Ảnh Mới
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ position: 'relative', height: '100%' }}>
                                        <img src={resetPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ảnh mới" />
                                        {resetValidating && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#fff' }}>
                                                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Đang kiểm tra khuôn mặt...</span>
                                            </div>
                                        )}
                                        {!resetValidating && resetValidMsg && (
                                            <div style={{ position: 'absolute', inset: 0, background: resetValidMsg.ok ? 'rgba(22,163,74,0.4)' : 'rgba(239,68,68,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', textAlign: 'center' }}>
                                                <span style={{ fontSize: '2rem' }}>{resetValidMsg.ok ? '✅' : '❌'}</span>
                                                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '6px 10px', margin: 0 }}>{resetValidMsg.text}</p>
                                            </div>
                                        )}
                                        {!resetValidating && (
                                            <button onClick={() => { setResetPhoto(null); setResetValidMsg(null); openResetCamera(); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                                <RefreshCw size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <canvas ref={resetCanvasRef} style={{ display: 'none' }} />

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="input-label">Lý do cần cập nhật <span style={{ color: '#ef4444' }}>*</span></label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    style={{ resize: 'none' }}
                                    placeholder="Ví dụ: Ảnh bị mờ, không điểm danh được..."
                                    value={resetReason}
                                    onChange={e => setResetReason(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
                                    setShowResetModal(false); setResetPhoto(null); setResetValidMsg(null);
                                    resetStreamRef.current?.getTracks().forEach(t => t.stop());
                                    resetStreamRef.current = null; setResetCameraOpen(false);
                                }}>Hủy</button>
                                <button
                                    className="btn btn-primary" style={{ flex: 2 }}
                                    onClick={handleSendFaceResetRequest}
                                    disabled={resetLoading || !resetPhoto || !resetValidMsg?.ok}
                                >
                                    {resetLoading ? 'Đang gửi...' : 'Gửi Yêu Cầu + Ảnh'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Camera FaceID (Admin) ── */}
            {isModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 5000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '420px', borderRadius: '24px' }}>
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ScanFace size={18} color="var(--primary)" />
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800, fontSize: '1rem' }}>
                                    Chụp Ảnh Xác Minh FaceID
                                </h3>
                            </div>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                ✕
                            </button>
                        </div>
                        <div style={{ padding: '22px' }}>
                            {/* Camera / Ảnh */}
                            <div style={{ width: '100%', aspectRatio: '4/3', background: '#1e293b', borderRadius: '14px', overflow: 'hidden', position: 'relative', marginBottom: '14px' }}>
                                {!newPhoto ? (
                                    <>
                                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        {/* Khung oval căn khuôn mặt */}
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)', width: '150px', height: '180px', border: '2px dashed rgba(255,255,255,0.7)', borderRadius: '50%', pointerEvents: 'none' }} />
                                        {/* Tips */}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '8px 12px', fontSize: '0.72rem', color: '#e0f2fe', textAlign: 'center' }}>
                                            Nhìn thẳng · Đủ sáng · Không đeo kính / khẩu trang
                                        </div>
                                        {/* Nút chụp */}
                                        <button onClick={takePhoto} style={{
                                            position: 'absolute', bottom: '44px', left: '50%', transform: 'translateX(-50%)',
                                            width: '56px', height: '56px', borderRadius: '50%',
                                            border: '4px solid white', background: 'rgba(255,255,255,0.25)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white' }} />
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ position: 'relative', height: '100%' }}>
                                        <img src={newPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ảnh xác minh" />

                                        {/* Spinner validate */}
                                        {validating && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#fff' }}>
                                                <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Đang kiểm tra khuôn mặt...</span>
                                            </div>
                                        )}

                                        {/* Kết quả */}
                                        {!validating && validationMsg && (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                background: validationMsg.ok ? 'rgba(22,163,74,0.4)' : 'rgba(239,68,68,0.5)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', textAlign: 'center'
                                            }}>
                                                <span style={{ fontSize: '2.5rem' }}>{validationMsg.ok ? '✅' : '❌'}</span>
                                                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', background: 'rgba(0,0,0,0.45)', borderRadius: '8px', padding: '8px 12px', margin: 0 }}>
                                                    {validationMsg.text}
                                                </p>
                                            </div>
                                        )}

                                        {/* Chụp lại */}
                                        {!validating && (
                                            <button onClick={() => openCamera()}
                                                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                                <RefreshCw size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Nút xác nhận — chỉ enable khi pass validation */}
                            <button
                                className="btn btn-primary" style={{ width: '100%', height: '46px', fontWeight: 800, letterSpacing: '0.5px' }}
                                onClick={confirmAndSave}
                                disabled={!validationMsg?.ok || validating || loading}
                            >
                                {loading
                                    ? 'Đang lưu lên máy chủ...'
                                    : validating
                                        ? 'Đang kiểm tra...'
                                        : validationMsg?.ok
                                            ? 'LƯU ẢNH NÀY ✔'
                                            : newPhoto ? 'Đang chờ kết quả...' : 'Chụp ảnh để tiếp tục'}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}

            {/* Modal Chi Tiết Yêu Cầu */}
            {selectedRequest && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '500px', borderRadius: '24px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800, fontSize: '1.1rem' }}>{selectedRequest.title}</h3>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                    {new Date(selectedRequest.createdAt).toLocaleString('vi-VN')}
                                </div>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Trạng thái</label>
                                <div style={{
                                    marginTop: '6px', fontWeight: 700, display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem',
                                    background: selectedRequest.status === 'APPROVED' ? '#dcfce7' : selectedRequest.status === 'REJECTED' ? '#fee2e2' : selectedRequest.status === 'IN_PROGRESS' ? '#dbeafe' : '#fffbeb',
                                    color: selectedRequest.status === 'APPROVED' ? '#16a34a' : selectedRequest.status === 'REJECTED' ? '#dc2626' : selectedRequest.status === 'IN_PROGRESS' ? '#1d4ed8' : '#d97706'
                                }}>
                                    {selectedRequest.status} {selectedRequest.processedBy ? ` (bởi ${selectedRequest.processedBy})` : ''}
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Mô tả / Nội dung</label>
                                <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {selectedRequest.description || 'Không có nội dung chi tiết.'}
                                </p>
                            </div>
                            {selectedRequest.attachment && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Ảnh minh chứng</label>
                                    <div style={{ marginTop: '8px' }}>
                                        <a href={selectedRequest.attachment} target="_blank" rel="noreferrer">
                                            <img src={selectedRequest.attachment} alt="Minh chứng" style={{ maxWidth: '100%', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                                        </a>
                                    </div>
                                </div>
                            )}
                            {selectedRequest.adminNote && (
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', marginTop: '20px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Ghi chú từ Quản lý:
                                    </label>
                                    <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.5 }}>
                                        {selectedRequest.adminNote}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>, document.body
            )}
        </Layout>
    );
};

export default Profile;
