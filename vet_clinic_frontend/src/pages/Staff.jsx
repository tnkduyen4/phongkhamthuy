import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { printReport, printBatchPayslips } from '../utils/printService';
import { loadFaceModels } from '../utils/faceVerify';
import * as faceapi from 'face-api.js';
import {
    CheckCircle2, Clock, X, Search,
    Filter, Download, Calendar, Mail, Phone,
    Stethoscope, Plus, PlusCircle, UserCircle,
    LayoutDashboard, Users, UserPlus, ClipboardList,
    Briefcase, CreditCard, Building2, DollarSign, AlertCircle, Pencil, Trash2,
    History, Activity, ArrowRight, ArrowLeft, Save, RefreshCw, Printer, ScanFace, Loader2, Eye, EyeOff, Lock
} from 'lucide-react';

const API = 'https://vet-clinic-backend-tgtd.onrender.com/api/v1';
const getToken = () => sessionStorage.getItem('token');
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

// ── PayrollDetailModal: định nghĩa ở module-level để dùng createPortal ──
const PayrollDetailModal = ({ py, onClose, onPrint, onConfirm, submitLoading }) => {
    const name = py.staffId?.fullName || 'Nhân viên';
    const roleLabel = { DOCTOR: 'Bác sĩ thú y', RECEPTIONIST: 'Lễ Tân / Phụ Tá', GROOMER: 'Groomer' }[py.staffId?.role] || py.staffId?.role || '';
    const absentPenalty = Math.max(0, (py.deductions || 0) - (py.leaveDeduction || 0) - (py.latePenalty || 0));
    const totalIncome = (py.baseSalary || 0) + (py.commissions || 0) + (py.bonus || 0);
    const totalDeduct = (py.deductions || 0);
    const netSalary = py.totalSalary || 0;
    const hourlyRateDisplay = py.hourlyRate > 0
        ? py.hourlyRate.toLocaleString('vi-VN') + 'đ/h'
        : ((py.note || '').match(/×\s*([\d.,]+)đ\/h/)?.[1]
            ? (py.note.match(/×\s*([\d.,]+)đ\/h/)[1] + 'đ/h')
            : '—');
    const hourlyRateNum = py.hourlyRate > 0
        ? py.hourlyRate
        : parseInt(((py.note || '').match(/×\s*([\d.,]+)đ\/h/)?.[1] || '0').replace(/[.,]/g, '')) || 0;
    const isDesktop = window.innerWidth >= 768;

    const overlayStyle = {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2147483647, padding: '16px'  // max z-index
    };

    const Row = ({ label, value, bold, color, sub }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.83rem', color: bold ? '#0f172a' : '#475569', fontWeight: bold ? 700 : 400, flex: 1 }}>
                {label}
                {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
            </span>
            <span style={{ fontSize: bold ? '0.93rem' : '0.85rem', fontWeight: bold ? 800 : 600, color: color || (bold ? '#0f172a' : '#334155'), whiteSpace: 'nowrap', marginLeft: '12px' }}>
                {value}
            </span>
        </div>
    );

    const SectionCard = ({ title, children }) => (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
            <div style={{ padding: '0 16px' }}>{children}</div>
        </div>
    );

    const Avatar = ({ size, fontSize }) => (
        py.staffId?.avatar
            ? <img src={py.staffId.avatar} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)' }} />
            : <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 900, color: 'white', border: '3px solid rgba(255,255,255,0.3)' }}>{name.charAt(0)}</div>
    );

    const SidebarContent = ({ compact }) => (
        <>
            <div style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', gap: compact ? '12px' : '10px', marginBottom: '20px', textAlign: compact ? 'left' : 'center' }}>
                <div style={{ flexShrink: 0 }}>
                    <Avatar size={compact ? '44px' : '68px'} fontSize={compact ? '1.2rem' : '1.8rem'} />
                </div>
                <div style={{ textAlign: compact ? 'left' : 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>Phiếu lương</div>
                    <div style={{ fontSize: compact ? '1rem' : '1.2rem', fontWeight: 800, color: 'white', marginBottom: '2px' }}>{name}</div>
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
            {!compact && (
                <div style={{ marginTop: '16px' }}>
                    <button onClick={() => onPrint(py)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontWeight: 700, borderRadius: '10px', padding: '10px', cursor: 'pointer' }}>
                        <Printer size={14} /> In phiếu lương
                    </button>
                </div>
            )}
        </>
    );

    const DetailContent = () => (
        <div style={{ overflowY: 'auto', flex: 1, padding: isDesktop ? '20px' : '16px' }}>
            <SectionCard title="Chấm công">
                <Row label="Số ngày làm việc" value={`${py.workingDays || 0} ngày`} />
                <Row label="Tổng giờ làm" value={`${py.totalHoursWorked || 0}h`} />
                <Row label="Đơn giá giờ" value={hourlyRateDisplay} />
                <Row label="Số lần đi trễ" value={py.lateCount > 0 ? `${py.lateCount} lần (${py.totalLateMins || 0} phút)` : '—'} />
                <Row label="Giờ ca đêm" value={py.nightHoursWorked > 0 ? `${py.nightHoursWorked}h (${py.nightShiftsCount || 0} ca)` : '—'} />
            </SectionCard>
            <SectionCard title="Thu nhập">
                <Row label="Lương cơ bản" value={`${(py.baseSalary || 0).toLocaleString('vi-VN')}đ`} sub={`${py.totalHoursWorked || 0}h × ${hourlyRateNum > 0 ? hourlyRateNum.toLocaleString('vi-VN') : '?'}đ/h`} />
                <Row label="Hoa hồng dịch vụ" value={py.commissions > 0 ? `+${py.commissions.toLocaleString('vi-VN')}đ` : '—'} color={py.commissions > 0 ? '#16a34a' : undefined} />
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
        </div>
    );

    // DESKTOP: 2 cột
    if (isDesktop) return (
        <div style={overlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
            <div style={{ display: 'flex', borderRadius: '20px', width: '100%', maxWidth: '820px', maxHeight: '88vh', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                <div style={{ width: '280px', flexShrink: 0, background: 'linear-gradient(160deg, #059669, #10b981)', padding: '24px 20px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                    <SidebarContent compact={false} />
                </div>
                <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Chi tiết bảng lương</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Kỳ lương: 01/{py.month}/{py.year} – {new Date(py.year, py.month, 0).getDate()}/{py.month}/{py.year}</div>
                        </div>
                        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                            <X size={16} />
                        </button>
                    </div>
                    <DetailContent />
                    {py._pendingConfirm && (
                        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: 'white', flexShrink: 0 }}>
                            <button onClick={() => onConfirm(py)} disabled={submitLoading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                                {submitLoading ? '⏳ Đang chốt...' : '✓ Xác nhận chốt lương'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // MOBILE: 1 cột
    return (
        <div style={overlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
            <div style={{ background: '#f8fafc', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '20px 20px 24px', position: 'relative', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <X size={16} />
                    </button>
                    <SidebarContent compact={true} />
                </div>
                <DetailContent />
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button onClick={() => onPrint(py)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600 }}>
                        <Printer size={15} /> In phiếu lương
                    </button>
                    {py._pendingConfirm && (
                        <button onClick={() => onConfirm(py)} disabled={submitLoading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                            {submitLoading ? '⏳...' : '✓ Xác nhận chốt'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const Staff = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Đọc tab từ URL path
    const activeTab = useMemo(() => {
        if (location.pathname.startsWith('/staff/schedules')) return 'schedules';
        if (location.pathname.startsWith('/staff/leaves')) return 'leaves';
        if (location.pathname.startsWith('/staff/payroll')) return 'payroll';
        return 'list';
    }, [location.pathname]);

    // Navigate khi cần đổi tab (dùng cho các button nội bộ nếu còn)
    const setActiveTab = (tab) => {
        const map = { list: '/staff', schedules: '/staff/schedules', leaves: '/staff/leaves', payroll: '/staff/payroll' };
        navigate(map[tab] || '/staff');
    };

    const [staffList, setStaffList] = useState([]);
    const [selectedStaffIds, setSelectedStaffIds] = useState([]);
    const [selectedCalcIds, setSelectedCalcIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [payrollLoading, setPayrollLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // HRM Data
    const [schedules, setSchedules] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [payrolls, setPayrolls] = useState([]);
    const [payrollPreviewData, setPayrollPreviewData] = useState([]);
    const [selectedPayrollStaff, setSelectedPayrollStaff] = useState(new Set());
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Bộ lọc tháng bảng lương
    const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
    const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());

    // Modal xem chi tiết lương
    const [payrollDetailModal, setPayrollDetailModal] = useState(null); // data của 1 nhân viên
    // Toggle body class để hạ z-index header khi modal chi tiết mở
    useEffect(() => {
        if (payrollDetailModal) {
            document.body.classList.add('payroll-modal-open');
        } else {
            document.body.classList.remove('payroll-modal-open');
        }
        return () => document.body.classList.remove('payroll-modal-open');
    }, [payrollDetailModal]);

    // Helper thay thế window.confirm
    const showConfirm = (title, message, onConfirm) => setConfirmDialog({ title, message, onConfirm });

    // Modal States
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isBulkScheduleModalOpen, setIsBulkScheduleModalOpen] = useState(false);
    const [isPreviewSyncOpen, setIsPreviewSyncOpen] = useState(false);
    const [syncDiff, setSyncDiff] = useState([]);

    // Activity Log
    const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityLogUser, setActivityLogUser] = useState(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [isAttendanceHistoryOpen, setIsAttendanceHistoryOpen] = useState(false);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [scheduleGrid, setScheduleGrid] = useState({}); // { staffId: { dateKey: shift } }
    const [savedScheduleGrid, setSavedScheduleGrid] = useState({}); // bản gốc từ DB
    const [attendanceData, setAttendanceData] = useState({}); // { 'sc_scheduleId' | 'staffId_dateKey_shift' -> attendance }
    const [schedulesMap, setSchedulesMap] = useState({}); // { scheduleId -> { shift, staffId, dateKey } }
    const [allowEditPast, setAllowEditPast] = useState(false); // Admin override
    const [matrixStartDate, setMatrixStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [matrixEndDate, setMatrixEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        return d.toISOString().split('T')[0];
    });
    const [matrixRoleFilter, setMatrixRoleFilter] = useState('ALL');
    const [matrixViewMode, setMatrixViewMode] = useState('WEEK'); // 'WEEK' or 'DAY'
    const [matrixRefreshing, setMatrixRefreshing] = useState(false);

    // Modal xem ảnh FaceID chờ duyệt
    const [faceApprovalModal, setFaceApprovalModal] = useState(null); // { staff, pendingPhoto, fetchedDetail }
    const [faceApprovalLoading, setFaceApprovalLoading] = useState(false);
    const [faceDetailLoading, setFaceDetailLoading] = useState(false);
    const [faceAnalysis, setFaceAnalysis] = useState(null); // { score, label, color, recommendation }
    const [faceAnalysisLoading, setFaceAnalysisLoading] = useState(false);

    // Mode for Staff Modal
    const [editingStaffId, setEditingStaffId] = useState(null);
    const [editingScheduleId, setEditingScheduleId] = useState(null);

    const initialFormData = {
        fullName: '', phoneNumber: '', password: '', role: 'RECEPTIONIST',
        baseSalary: 0, onCallFee: 0, emergencyCaseFee: 0, nightShiftAllowance: 0,
        hireDate: new Date().toISOString().split('T')[0]
    };
    const [formData, setFormData] = useState(initialFormData);

    const [schedData, setSchedData] = useState({
        staffId: '', date: new Date().toISOString().split('T')[0], shift: 'DAY'
    });
    const [bulkSchedData, setBulkSchedData] = useState({
        staffIds: [], startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], shift: 'DAY'
    });

    const [leaveData, setLeaveData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        type: 'PERSONAL', reason: ''
    });

    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // State cho việc điều chỉnh bảng lương thủ công
    const [isEditPayrollModalOpen, setIsEditPayrollModalOpen] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [editPayrollData, setEditPayrollData] = useState({ bonus: 0, deductions: 0, note: '' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        const timeout = type === 'info' ? 8000 : 4000; // info hiện lâu hơn trong lúc đang xử lý
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), timeout);
    };

    // Gỡ bỏ khóa cuộn Body để đồng bộ với các trang khác (Pets, Branches)
    // Người dùng có thể cuộn nền trang ngoài khi modal đang mở

    // ─────────────────────────────────────────────────────
    // FETCH STAFF: chỉ 1 lần khi mount, không lặp lại
    // ─────────────────────────────────────────────────────
    const fetchStaffList = async () => {
        try {
            const res = await axios.get('https://vet-clinic-backend-tgtd.onrender.com/api/v1/users?includeInactive=true&includePhotos=true', { headers: authHeader() });
            if (res.data.success) {
                setStaffList(res.data.data.filter(u => u.role !== 'CUSTOMER'));
                setSelectedStaffIds([]);
            }
        } catch (err) { console.error('Fetch staff error:', err); }
    };

    // ─────────────────────────────────────────────────────
    // FETCH SCHEDULE + LEAVES: chỉ lấy date range hiện tại
    // ─────────────────────────────────────────────────────
    const fetchScheduleData = async (showGlobalLoading = true) => {
        try {
            if (showGlobalLoading) setLoading(true);
            else setMatrixRefreshing(true);

            // Extend range 1 ngày 2 phía để bù timezone
            const extStart = new Date(matrixStartDate);
            extStart.setDate(extStart.getDate() - 1);
            const extEnd = new Date(matrixEndDate);
            extEnd.setDate(extEnd.getDate() + 1);

            const [resSched, resLeave, resAtt] = await Promise.all([
                // Chỉ lấy schedules trong khoảng ngày đang xem — giảm payload đáng kể
                axios.get(`${API}/hrm/schedules`, {
                    params: { startDate: extStart.toISOString(), endDate: extEnd.toISOString() },
                    headers: authHeader()
                }),
                axios.get(`${API}/hrm/leaves`, { headers: authHeader() }),
                // Lấy dữ liệu chấm công cho cùng khoảng ngày
                axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/attendance/all`, {
                    params: { startDate: extStart.toISOString().split('T')[0], endDate: extEnd.toISOString().split('T')[0] },
                    headers: authHeader()
                }).catch(() => ({ data: { success: false } })) // không block nếu attendance lỗi
            ]);

            if (resSched.data.success) {
                setSchedules(resSched.data.data);
                const grid = {};
                const schedMap = {}; // scheduleId -> schedule object
                resSched.data.data.forEach(s => {
                    const sId = s.staffId?._id || s.staffId;
                    if (!grid[sId]) grid[sId] = {};
                    const dKey = new Date(s.date).toISOString().split('T')[0];
                    if (!grid[sId][dKey]) grid[sId][dKey] = [];
                    if (!grid[sId][dKey].includes(s.shift)) grid[sId][dKey].push(s.shift);
                    // Lưu map scheduleId -> { shift, staffId, dateKey }
                    schedMap[s._id] = { shift: s.shift, staffId: sId, dateKey: dKey };
                });
                setScheduleGrid(grid);
                setSavedScheduleGrid(JSON.parse(JSON.stringify(grid)));
                // Lưu schedMap vào state để tra cứu
                setSchedulesMap(schedMap);
            }
            if (resLeave.data.success) setLeaves(resLeave.data.data);
            if (resAtt.data.success) {
                // Build map: scheduleId -> attendance record (key chính xác thông qua ca)
                // Cũng build map: "staffId_dateKey_shift" -> attendance (fallback khi không có scheduleId)
                const attMap = {};
                resAtt.data.data.forEach(a => {
                    // Key 1: theo scheduleId (chính xác nhất)
                    if (a.scheduleId) {
                        const scId = a.scheduleId?._id || a.scheduleId;
                        attMap[`sc_${scId}`] = a;
                    }
                    // Key 2: fallback theo staffId_date_shift
                    const sId = a.staffId?._id || a.staffId;
                    const dKey = new Date(a.date).toISOString().split('T')[0];
                    const shift = a.scheduleId?.shift || 'UNKNOWN';
                    attMap[`${sId}_${dKey}_${shift}`] = a;
                });
                setAttendanceData(attMap);
            }
        } catch (error) {
            console.error('Lỗi tải lịch trực:', error);
        } finally {
            if (showGlobalLoading) setLoading(false);
            setMatrixRefreshing(false);
        }

        // Sau khi fetch xong, gọi ngầm mark-absent để cập nhật vắng các ca đã qua
        // Không await → không block UI, chạy hoàn toàn nền
        axios.post(`${API}/attendance/mark-absent`, {}, { headers: authHeader() })
            .then(r => { if (r.data?.count > 0) fetchScheduleDataSilent(); })
            .catch(() => { });
    };

    // Fetch lại chỉ attendance (sau khi mark-absent xong)
    const fetchScheduleDataSilent = async () => {
        try {
            const extStart = new Date(matrixStartDate);
            extStart.setDate(extStart.getDate() - 1);
            const extEnd = new Date(matrixEndDate);
            extEnd.setDate(extEnd.getDate() + 1);
            const resAtt = await axios.get(`${API}/attendance/all`, {
                params: { startDate: extStart.toISOString().split('T')[0], endDate: extEnd.toISOString().split('T')[0] },
                headers: authHeader()
            }).catch(() => ({ data: { success: false } }));
            if (resAtt.data.success) {
                const attMap = {};
                resAtt.data.data.forEach(a => {
                    if (a.scheduleId) {
                        const scId = a.scheduleId?._id || a.scheduleId;
                        attMap[`sc_${scId}`] = a;
                    }
                    const sId = a.staffId?._id || a.staffId;
                    const dKey = new Date(a.date).toISOString().split('T')[0];
                    const shift = a.scheduleId?.shift || 'UNKNOWN';
                    attMap[`${sId}_${dKey}_${shift}`] = a;
                });
                setAttendanceData(attMap);
            }
        } catch (_) { }
    };

    // ─────────────────────────────────────────────────────
    // FETCH theo từng tab — không fetch staff lại
    // ─────────────────────────────────────────────────────
    const fetchPayrollData = async (m = payrollMonth, y = payrollYear) => {
        setPayrollLoading(true);
        try {
            const payRes = await axios.get(`${API}/hrm/payrolls?month=${m}&year=${y}`, { headers: authHeader() });
            if (payRes.data.success) setPayrolls(payRes.data.data);
            setPayrollPreviewData([]); // Ngừng tự động tính nháp
        } catch (err) {
            console.error('Payroll fetch error:', err);
        } finally {
            setPayrollLoading(false);
        }
    };

    const calculateSinglePayroll = async (staffId) => {
        setSubmitLoading(true);
        showToast('⏳ Đang tính toán dữ liệu...', 'info');
        try {
            const res = await axios.post(`${API}/hrm/payrolls/preview`, { month: payrollMonth, year: payrollYear, staffIds: [staffId] }, { headers: authHeader() });
            if (res.data.success && res.data.data.length > 0) {
                setPayrollDetailModal({ ...res.data.data[0], month: payrollMonth, year: payrollYear, _pendingConfirm: true });
            } else {
                showToast('Không có dữ liệu công cho nhân viên này.', 'warning');
            }
        } catch (error) {
            showToast('Lỗi khi tính lương', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            if (activeTab === 'schedules') {
                await fetchScheduleData(false);
            } else if (activeTab === 'leaves') {
                const leaveRes = await axios.get(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/hrm/leaves`, { headers: authHeader() });
                if (leaveRes.data.success) setLeaves(leaveRes.data.data);
            } else if (activeTab === 'payroll') {
                await fetchPayrollData(payrollMonth, payrollYear);
            }
            // tab 'list' không cần fetch thêm, staff đã có
        } catch (error) {
            console.error('Lỗi tải dữ liệu HRM', error);
            setPayrollLoading(false);
        }
    };

    // Mount: chỉ fetch staff 1 lần
    useEffect(() => { fetchStaffList(); }, []);

    // Mỗi khi đổi tab: fetch data riêng cho tab đó (không fetch staff lại)
    useEffect(() => { fetchData(); }, [activeTab]);

    // Lắng nghe event từ NotificationBell để mở modal duyệt FaceID
    useEffect(() => {
        const handleOpenFaceApproval = (e) => {
            const { staffId } = e.detail || {};
            if (!staffId) return;
            // Chuyển sang tab nhân sự
            setActiveTab('staff');
            // Tìm staff trong danh sách (refetch nếu cần)
            const doOpen = (list) => {
                const found = list.find(s => s._id === staffId);
                if (found) {
                    setFaceApprovalModal({
                        staff: found,
                        pendingPhoto: found.faceResetRequest?.pendingFacePhoto || null
                    });
                }
            };
            // Nếu staffList đã có thì mở ngay, nếu không thì fetch rồi mở
            if (staffList.length > 0) {
                doOpen(staffList);
            } else {
                axios.get(`${API}/users?includePhotos=true`, { headers: authHeader() }).then(res => {
                    if (res.data.success) {
                        const list = res.data.data.filter(u => u.role !== 'CUSTOMER');
                        setStaffList(list);
                        doOpen(list);
                    }
                }).catch(() => { });
            }
        };
        window.addEventListener('openFaceApproval', handleOpenFaceApproval);
        return () => window.removeEventListener('openFaceApproval', handleOpenFaceApproval);
    }, [staffList]);

    // Khi thay đổi tháng/năm bảng lương
    useEffect(() => {
        if (activeTab === 'payroll') fetchPayrollData(payrollMonth, payrollYear);
    }, [payrollMonth, payrollYear]);

    // Khi thay đổi date range trên matrix → re-fetch schedule cho range mới
    useEffect(() => {
        if (activeTab === 'schedules') fetchScheduleData(false);
    }, [matrixStartDate, matrixEndDate]);

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSchedChange = (e) => {
        const { name, value } = e.target;
        setSchedData({ ...schedData, [name]: value });
    };
    const handleLeaveChange = (e) => setLeaveData({ ...leaveData, [e.target.name]: e.target.value });

    const handleOpenStaffModal = (staff = null) => {
        setErrorMsg('');
        if (staff) {
            setEditingStaffId(staff._id);
            setFormData({
                fullName: staff.fullName,
                phoneNumber: staff.phoneNumber,
                password: '', // Không hiển thị pass cũ
                role: staff.role || 'RECEPTIONIST',
                baseSalary: staff.baseSalary || 0,
                onCallFee: staff.onCallFee || 0,
                emergencyCaseFee: staff.emergencyCaseFee || 0,
                nightShiftAllowance: staff.nightShiftAllowance || 0,
                hireDate: staff.hireDate ? new Date(staff.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            });
        } else {
            setEditingStaffId(null);
            setFormData(initialFormData);
        }
        setIsStaffModalOpen(true);
    };

    const validatePhone = (phone) => {
        const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
        return phoneRegex.test(phone);
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        setErrorMsg('');

        // Validation định dạng
        if (!validatePhone(formData.phoneNumber)) {
            setErrorMsg('Số điện thoại không hợp lệ (Phải có 10 chữ số, đúng đầu số Việt Nam).');
            setSubmitLoading(false);
            return;
        }

        if (!editingStaffId && formData.password.length < 6) {
            setErrorMsg('Mật khẩu đăng nhập phải từ 6 ký tự trở lên.');
            setSubmitLoading(false);
            return;
        }

        if (editingStaffId && formData.password && formData.password.length < 6) {
            setErrorMsg('Mật khẩu mới phải từ 6 ký tự trở lên.');
            setSubmitLoading(false);
            return;
        }

        if (formData.hireDate) {
            const hire = new Date(formData.hireDate);
            const today = new Date();
            hire.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            if (hire > today) {
                setErrorMsg('Ngày vào làm không thể là ngày trong tương lai.');
                setSubmitLoading(false);
                return;
            }
        }

        try {
            if (editingStaffId) {
                const updatePayload = { ...formData };
                if (!updatePayload.password) delete updatePayload.password;

                await axios.put(`${API}/users/${editingStaffId}`, updatePayload, { headers: authHeader() });
            } else {
                // Create mode
                await axios.post(`${API}/users/staff`, formData, { headers: authHeader() });
            }
            setIsStaffModalOpen(false);
            fetchData();
            showToast(editingStaffId ? 'Đã cập nhật hồ sơ nhân sự' : 'Đã tiếp nhận nhân sự mới');
        } catch (error) {
            showToast(error.response?.data?.message || 'Lỗi xử lý nhân sự', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleViewAttendanceHistory = async (staff) => {
        setActivityLogUser(staff);
        setAttendanceLogs([]);
        setIsAttendanceHistoryOpen(true);
        setActivityLoading(true);
        try {
            const allRes = await axios.get(`${API}/attendance/all`, { headers: authHeader() });
            if (allRes.data.success) {
                const logs = allRes.data.data.filter(a => a.staffId?._id === staff._id);
                setAttendanceLogs(logs);
            }
        } catch (err) {
            console.error('Lỗi lấy chấm công:', err);
        } finally {
            setActivityLoading(false);
        }
    };

    const handleViewActivityLog = async (staff) => {
        setActivityLogUser(staff);
        setActivityLogs([]);
        setIsActivityLogOpen(true);
        setActivityLoading(true);
        try {
            const res = await axios.get(`${API}/activity-logs/${staff._id}?limit=100`, { headers: authHeader() });
            if (res.data.success) setActivityLogs(res.data.data);
        } catch (err) {
            console.error('Lỗi lấy log:', err);
        } finally {
            setActivityLoading(false);
        }
    };

    const handleBulkDeleteStaff = () => {
        showConfirm(
            'Xóa Nhiều Nhân Viên',
            `Bạn đang chọn ${selectedStaffIds.length} nhân viên.\n\nHệ thống sẽ tự động lưu trữ (Ngừng hoạt động) các nhân viên có dữ liệu liên kết và xóa vĩnh viễn các hồ sơ trống.\n\nLưu ý: Bạn không thể tự thao tác xóa chính mình.\n\nBạn có chắc chắn muốn thực hiện?`,
            async () => {
                setSubmitLoading(true);
                try {
                    const token = sessionStorage.getItem('token');
                    const res = await axios.post(`${API}/users/bulk-delete`, { userIds: selectedStaffIds }, { headers: { Authorization: `Bearer ${token}` } });
                    if (res.data.success) {
                        showToast(res.data.message);
                        fetchStaffList();
                    }
                } catch (error) {
                    showToast(error.response?.data?.message || 'Lỗi khi xóa hàng loạt', 'error');
                } finally {
                    setSubmitLoading(false);
                }
            }
        );
    };

    const handleDeleteStaff = async (id) => {
        setSubmitLoading(true);
        try {
            const res = await axios.get(`${API}/users/${id}/check-delete`, { headers: authHeader() });
            setSubmitLoading(false);

            if (res.data.hasRelations) {
                // Có dữ liệu liên kết -> Bắt buộc khóa tạm thời (soft delete)
                const rels = res.data.relations;
                const relText = [
                    rels.appointments > 0 ? `${rels.appointments} lịch hẹn` : '',
                    rels.invoices > 0 ? `${rels.invoices} hóa đơn` : '',
                    rels.schedules > 0 ? `${rels.schedules} ca trực` : '',
                    rels.attendance > 0 ? `${rels.attendance} chấm công` : '',
                    rels.payrolls > 0 ? `${rels.payrolls} bảng lương` : ''
                ].filter(Boolean).join(', ');

                showConfirm(
                    'Dữ liệu ràng buộc',
                    `Nhân viên này đang có dữ liệu hoạt động (${relText}).\n\nĐể đảm bảo an toàn cho báo cáo và kế toán, nhân viên này CHỈ CÓ THỂ được chuyển vào Thùng Rác (Khóa tài khoản).\n\nTài khoản sẽ bị ẩn khỏi danh sách hoạt động nhưng lịch sử vẫn được giữ nguyên.`,
                    async () => {
                        try {
                            await axios.delete(`${API}/users/${id}?force=false`, { headers: authHeader() });
                            fetchData();
                            showToast('Đã đưa hồ sơ nhân viên vào lưu trữ (khóa).');
                        } catch (error) { showToast('Lỗi: ' + (error.response?.data?.message || 'Không thể xóa'), 'error'); }
                    }
                );
            } else {
                // Rỗng -> Cho phép xóa cứng
                showConfirm(
                    'Xóa Vĩnh Viễn Mới Tinh',
                    `Tài khoản nhân viên này chưa có bất kỳ dữ liệu hoạt động nào trong hệ thống.\n\nBạn có muốn XÓA VĨNH VIỄN nhân viên này để dọn dẹp hệ thống không?`,
                    async () => {
                        try {
                            await axios.delete(`${API}/users/${id}?force=true`, { headers: authHeader() });
                            fetchData();
                            showToast('Đã xóa vĩnh viễn nhân viên trống khỏi hệ thống.');
                        } catch (error) { showToast('Lỗi: ' + (error.response?.data?.message || 'Không thể xóa'), 'error'); }
                    }
                );
            }
        } catch (error) {
            setSubmitLoading(false);
            showToast('Lỗi kiểm tra dữ liệu kết nối', 'error');
        }
    };

    const handleToggleLock = async (staff) => {
        const action = staff.isActive === false ? 'Mở khoá' : 'Tạm khoá';
        showConfirm(
            `${action} Tài Khoản`,
            `Xác nhận ${action} tài khoản nhân viên ${staff.fullName}?`,
            async () => {
                try {
                    await axios.put(`${API}/users/${staff._id}`, { isActive: staff.isActive === false }, { headers: authHeader() });
                    fetchData();
                    showToast(`Đã ${action} tài khoản thành công`);
                } catch (error) { showToast('Lỗi khi thay đổi trạng thái tài khoản', 'error'); }
            }
        );
    };

    // ─── FaceID Approval ───────────────────────────────────────────────
    const handleApproveFace = async () => {
        if (!faceApprovalModal) return;
        setFaceApprovalLoading(true);
        try {
            await axios.put(
                `${API}/users/${faceApprovalModal.staff._id}/admin-reset-face`,
                { usePending: true },
                { headers: authHeader() }
            );
            showToast(`✅ Đã duyệt ảnh FaceID cho ${faceApprovalModal.staff.fullName}`);
            setFaceApprovalModal(null);
            fetchStaffList(); // Refresh để cập nhật badge & avatar
        } catch (err) {
            showToast(err.response?.data?.message || 'Lỗi duyệt ảnh', 'error');
        } finally {
            setFaceApprovalLoading(false);
        }
    };

    const handleRejectFace = async (rejectReason = '') => {
        if (!faceApprovalModal) return;
        setFaceApprovalLoading(true);
        try {
            await axios.put(
                `${API}/users/${faceApprovalModal.staff._id}/admin-reject-face`,
                { rejectReason },
                { headers: authHeader() }
            );
            showToast(`Đã từ chối yêu cầu FaceID của ${faceApprovalModal.staff.fullName}`);
            setFaceApprovalModal(null);
            fetchStaffList();
        } catch (err) {
            showToast(err.response?.data?.message || 'Lỗi từ chối', 'error');
        } finally {
            setFaceApprovalLoading(false);
        }
    };

    const handleCreateSchedule = async (e) => {
        e.preventDefault();
        console.log('[HRM] Creating/Updating schedule with data:', schedData);
        setSubmitLoading(true);
        try {
            let res;
            if (editingScheduleId) {
                res = await axios.put(`${API}/hrm/schedules/${editingScheduleId}`, schedData, { headers: authHeader() });
            } else {
                res = await axios.post(`${API}/hrm/schedules`, schedData, { headers: authHeader() });
            }

            if (res.data.success) {
                if (res.data.staffingStatus && !res.data.staffingStatus.isMet) {
                    const warnMsg = (editingScheduleId ? 'Đã cập nhật lịch. ' : 'Đã xếp lịch. ') + `Cảnh báo ca đêm chưa đủ định mức: Bác sĩ (${res.data.staffingStatus.doctors}), Lễ Tân/Phụ Tá (${res.data.staffingStatus.others})`;
                    showToast(warnMsg, 'warning');
                } else {
                    showToast(editingScheduleId ? 'Đã cập nhật lịch trực' : 'Đã xếp lịch trực thành công');
                }
                setIsScheduleModalOpen(false);
                fetchScheduleData(false); // Refresh ngầm, không reload trang
            }
        } catch (error) { showToast(error.response?.data?.message || 'Lỗi lưu lịch trực', 'error'); }
        finally { setSubmitLoading(false); }
    };

    const handleDeleteSchedule = async (id) => {
        // Tìm schedule info
        const sc = Object.values(schedulesMap).find(s => s.scheduleId === id || s._id === id);
        const attKey = `sc_${id}`;
        const att = attendanceData[attKey];
        const scheduleInfo = schedulesMap[id];

        // Kiểm tra có chấm công chưa
        const hasAttendance = att && (att.checkIn || att.status === 'PRESENT' || att.status === 'LATE');
        if (hasAttendance) {
            showConfirm(
                '⛔ Không Thể Xóa Ca Này',
                `Ca trực này đã có dữ liệu chấm công (${att.status === 'LATE' ? 'đi trễ' : 'có mặt'}).\n\nXóa sẽ làm mất dữ liệu lương và chấm công của nhân viên.\n\nNếu cần điều chỉnh, hãy liên hệ quản trị hệ thống.`,
                null // Disable nút Xác nhận bằng cách không truyền callback
            );
            // Hiện lại dialog chỉ với nút Đóng
            setConfirmDialog({
                title: '⛔ Không Thể Xóa Ca Này',
                message: `Ca trực này đã có dữ liệu chấm công.\n\nXóa sẽ làm mất dữ liệu lương và chấm công của nhân viên.\n\nNếu cần điều chỉnh, hãy liên hệ quản trị hệ thống.`,
                onConfirm: null,
                dangerOnly: true
            });
            return;
        }

        // Kiểm tra có leave APPROVED không
        const hasLeave = att?.status === 'ON_LEAVE';
        if (hasLeave) {
            showConfirm(
                '❌ Cảnh Báo: Ca Có Nghỉ Phép Được Duyệt',
                `Nhân viên đã được duyệt nghỉ phép cho ca này.\n\nNếu xóa ca, bản ghi nghỉ phép vẫn còn nhưng lịch trực sẽ mất.\n\nBạn có chắc muốn xóa không?`,
                async () => {
                    try {
                        await axios.delete(`${API}/hrm/schedules/${id}`, { headers: authHeader() });
                        showToast('Đã xóa ca trực (lưu ý: đơn nghỉ phép vẫn còn)');
                        fetchScheduleData(false);
                    } catch (error) { showToast('Không thể xóa lịch trực', 'error'); }
                }
            );
            return;
        }

        // Xóa thông thường
        showConfirm(
            '🗑️ Xóa Ca Trực',
            `Xác nhận xóa ca trực này?\n\nHành động này không thể hoàn tác.`,
            async () => {
                try {
                    await axios.delete(`${API}/hrm/schedules/${id}`, { headers: authHeader() });
                    showToast('Đã xóa ca trực');
                    fetchScheduleData(false);
                } catch (error) { showToast('Không thể xóa lịch trực', 'error'); }
            }
        );
    };

    const handleBulkSchedule = async (e) => {
        e.preventDefault();
        if (bulkSchedData.staffIds.length === 0) return showToast('Vui lòng chọn ít nhất 1 nhân viên', 'error');
        setSubmitLoading(true);
        try {
            await axios.post(`${API}/hrm/schedules/bulk`, bulkSchedData, { headers: authHeader() });
            setIsBulkScheduleModalOpen(false);
            showToast('Đã phân ca hàng loạt thành công');
            fetchScheduleData(false); // Refresh ngầm sau khi toast đã hiện
        } catch (error) { showToast('Lỗi phân ca hàng loạt', 'error'); }
        finally { setSubmitLoading(false); }
    };

    // Tính diff trước khi lưu
    const computeSyncDiff = () => {
        const SHIFT_LABEL = { DAY: 'Ca Ngày', EVENING: 'Chiều Tối', NIGHT: 'Ca Đêm' };
        const allKeys = new Set([
            ...Object.keys(scheduleGrid),
            ...Object.keys(savedScheduleGrid)
        ]);
        const diffs = [];

        allKeys.forEach(staffId => {
            const staff = staffList.find(s => s._id === staffId);
            const staffName = staff?.fullName || staffId;
            const newDates = scheduleGrid[staffId] || {};
            const savedDates = savedScheduleGrid[staffId] || {};
            const allDates = new Set([...Object.keys(newDates), ...Object.keys(savedDates)]);

            allDates.forEach(dateKey => {
                const newShifts = (newDates[dateKey] || []).sort();
                const savedShifts = (savedDates[dateKey] || []).sort();
                if (JSON.stringify(newShifts) === JSON.stringify(savedShifts)) return;

                const added = newShifts.filter(s => !savedShifts.includes(s));
                const removed = savedShifts.filter(s => !newShifts.includes(s));

                if (added.length > 0 || removed.length > 0) {
                    diffs.push({ staffId, staffName, dateKey, added, removed });
                }
            });
        });

        return diffs.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.staffName.localeCompare(b.staffName));
    };

    // Mở modal xác nhận thay vì lưu thẳng
    const handlePreviewSync = () => {
        const diff = computeSyncDiff();
        if (diff.length === 0) {
            showToast('Không có thay đổi nào để lưu.', 'warning');
            return;
        }
        setSyncDiff(diff);
        setIsPreviewSyncOpen(true);
    };

    const handleSyncScheduleGrid = async () => {
        setIsPreviewSyncOpen(false);
        setSubmitLoading(true);
        try {
            // Chỉ gửi những ô đã thay đổi so với baseline — giảm payload tối đa
            const syncData = [];
            const allStaffIds = new Set([
                ...Object.keys(scheduleGrid),
                ...Object.keys(savedScheduleGrid)
            ]);

            allStaffIds.forEach(staffId => {
                if (!staffId || staffId === 'null' || staffId === 'undefined') return;
                const newDates = scheduleGrid[staffId] || {};
                const savedDates = savedScheduleGrid[staffId] || {};
                const allDates = new Set([...Object.keys(newDates), ...Object.keys(savedDates)]);

                allDates.forEach(dKey => {
                    const newShifts = (newDates[dKey] || []).sort().join(',');
                    const savedShifts = (savedDates[dKey] || []).sort().join(',');
                    if (newShifts !== savedShifts) {
                        // Chỉ thêm entry này — đây là ô đã bị thay đổi
                        syncData.push({ staffId, date: dKey, shifts: newDates[dKey] || [] });
                    }
                });
            });

            if (syncData.length === 0) {
                showToast('Không có thay đổi nào để lưu.', 'warning');
                return;
            }

            await axios.post(`${API}/hrm/schedules/sync`, { schedules: syncData }, { headers: authHeader() });
            showToast(` Đã lưu ${syncData.length} thay đổi thành công!`);
            setSavedScheduleGrid(JSON.parse(JSON.stringify(scheduleGrid)));
            fetchScheduleData(false);
        } catch (error) { showToast(error.response?.data?.message || 'Lỗi đồng bộ lịch', 'error'); }
        finally { setSubmitLoading(false); }
    };

    // Hoàn tác: khôi phục về trạng thái đã lưu trong DB (không cần gọi API)
    const handleDiscardChanges = () => {
        setScheduleGrid(JSON.parse(JSON.stringify(savedScheduleGrid)));
        showToast('↩️ Đã hoàn tác — lịch trực được khôi phục về trạng thái đã lưu.', 'warning');
    };

    const getMatrixDates = () => {
        const dates = [];
        let start = new Date(matrixStartDate);
        let end = new Date(matrixEndDate);

        // Safety cap: prevents UI explosion for ranges over 31 days
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 31) {
            end = new Date(start);
            end.setDate(start.getDate() + 31);
        }

        let curr = new Date(start);
        while (curr <= end) {
            dates.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    };

    const handleCreateLeave = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            await axios.post(`${API}/hrm/leaves`, leaveData, { headers: authHeader() });
            setIsLeaveModalOpen(false);
            fetchData();
            showToast('Đã gửi đơn nghỉ phép thành công');
        } catch (error) { showToast(error.response?.data?.message || 'Lỗi gửi đơn', 'error'); }
        finally { setSubmitLoading(false); }
    };

    const updateLeaveStatus = async (id, status) => {
        try {
            await axios.put(`https://vet-clinic-backend-tgtd.onrender.com/api/v1/hrm/leaves/${id}`, { status }, { headers: authHeader() });
            fetchData();
            showToast(`Đã ${status === 'APPROVED' ? 'phê duyệt' : 'từ chối'} đơn nghỉ`);
        } catch (error) { showToast('Lỗi phê duyệt', 'error'); }
    };


    // Đánh vắng tự động — giờ chạy ngầm trong fetchScheduleData
    // Giữ lại hàm để dùng nội bộ nếu cần
    const handleMarkAbsent = async () => {
        setMatrixRefreshing(true);
        try {
            const res = await axios.post(`${API}/attendance/mark-absent`, {}, { headers: authHeader() });
            if (res.data.success) {
                showToast(`✅ ${res.data.message}`);
                await fetchScheduleData(false);
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Lỗi cập nhật vắng', 'error');
        } finally {
            setMatrixRefreshing(false);
        }
    };

    // Chốt lương — tính cho tất cả nhân viên hợp lệ (không ADMIN/MANAGER)
    const confirmGeneratePayrollDirect = async () => {
        const m = payrollMonth, y = payrollYear;
        showConfirm(
            `Chốt lương tháng ${m}/${y}`,
            `Xác nhận chốt lương cho tất cả nhân viên chưa chốt trong tháng ${m}/${y}?`,
            async () => {
                setSubmitLoading(true);
                try {
                    const res = await axios.post(`${API}/hrm/payrolls/generate`, {
                        month: m, year: y
                    }, { headers: authHeader() });
                    if (res.data.success) {
                        showToast(`✅ Chốt lương thành công — ${res.data.count} nhân viên đã được thông báo`);
                        fetchPayrollData(m, y);
                    }
                } catch (err) { showToast('Lỗi chốt lương', 'error'); }
                finally { setSubmitLoading(false); }
            }
        );
    };

    // Xóa và tính lại lương tháng đang chọn cho toàn bộ nhân viên hợp lệ
    // Xóa và tính lại lương tháng đang chọn cho nhân viên đã chọn hoặc hợp lệ
    const resetAndRecalculatePayroll = async () => {
        const m = payrollMonth, y = payrollYear;
        const isTargeted = selectedCalcIds.length > 0;
        const msg = isTargeted
            ? `Tính lương cho ${selectedCalcIds.length} nhân sự đã chọn tháng ${m}/${y}?\nDữ liệu cũ của những người này (nếu có) sẽ bị ghi đè.`
            : `Hệ thống sẽ chạy lại quá trình tính lương cho điểm tất cả nhân viên tháng ${m}/${y}?\nMọi dữ liệu cũ tháng này sẽ bị xóa.`;

        showConfirm(
            isTargeted ? 'Tính Điểm Lương Nhóm' : `Tính lại lô tháng ${m}/${y}`,
            msg,
            async () => {
                setSubmitLoading(true);
                showToast('⏳ Đang xử lý tính lương... vui lòng chờ', 'info');
                try {
                    if (isTargeted) {
                        for (const id of selectedCalcIds) {
                            await axios.delete(`${API}/hrm/payrolls/month?month=${m}&year=${y}&staffId=${id}`, { headers: authHeader() }).catch(() => null);
                        }
                        const res = await axios.post(`${API}/hrm/payrolls/generate`, {
                            month: m, year: y, staffIds: selectedCalcIds
                        }, { headers: authHeader() });
                        if (res.data.success) showToast(`✅ Đã tính lương xong cho ${selectedCalcIds.length} nhân sự`, 'success');
                    } else {
                        await axios.delete(`${API}/hrm/payrolls/month?month=${m}&year=${y}&deleteAll=true`, { headers: authHeader() });
                        const res = await axios.post(`${API}/hrm/payrolls/generate`, {
                            month: m, year: y
                        }, { headers: authHeader() });
                        if (res.data.success) showToast(`✅ Tính thành công toàn bộ ${res.data.count || 0} nhân sự`, 'success');
                    }
                    setSelectedCalcIds([]); // clear selection
                    fetchPayrollData(m, y);
                } catch (err) { showToast('Lỗi tính lương', 'error'); }
                finally { setSubmitLoading(false); }
            }
        );
    };

    // ─── Build HTML phiếu lương in ấn — theo mẫu hành chính (ACheckin style) ───
    const buildPayslipHTML = (py, m, y, breakAfter = false) => {
        const name = py.staffId?.fullName || 'Nhân viên';
        const role = py.staffId?.role || '';
        const roleLabel = { DOCTOR: 'Bác sĩ thú y', RECEPTIONIST: 'Lễ Tân / Phụ Tá', GROOMER: 'Groomer' }[role] || role;
        const staffCode = py.staffId?._id ? String(py.staffId._id).slice(-6).toUpperCase() : '—';
        const absentPenalty = Math.max(0, (py.deductions || 0) - (py.leaveDeduction || 0) - (py.latePenalty || 0));
        const totalIncome = (py.baseSalary || 0) + (py.commissions || 0) + (py.bonus || 0);
        const totalDeduct = (py.deductions || 0);
        const netSalary = py.totalSalary || 0;
        const pageBreakStyle = breakAfter ? 'page-break-after:always;' : '';
        const fmt = n => (n || 0).toLocaleString('vi-VN');

        const row = (label, value, bold = false, color = '') =>
            `<tr><td style="padding:4px 10px;font-size:11px;border:1px solid #ccc;${bold ? 'font-weight:700;' : ''}">${label}</td>
             <td style="padding:4px 10px;font-size:11px;text-align:right;border:1px solid #ccc;${bold ? 'font-weight:800;' : ''}${color ? `color:${color};` : ''}">${value}</td></tr>`;

        const section = (label) =>
            `<tr><td colspan="2" style="padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;background:#e8e8e8;border:1px solid #ccc;letter-spacing:0.05em;color:#333;">${label}</td></tr>`;

        const signatureBlock = `
            <div style="margin-top: 20px; display: flex; justify-content: space-between; text-align: center; page-break-inside: avoid; gap: 10px;">
                <div style="flex: 1; font-size: 11px;">
                    <div style="font-weight: 800; text-transform: uppercase; font-size: 11px;">Người lập biểu</div>
                    <div style="font-style: italic; font-size: 10px; color: #555;">(Ký, ghi rõ họ tên)</div>
                    <div style="height: 36px;"></div>
                    <div style="font-weight: 800; border-top: 1px solid #333; display: inline-block; min-width: 120px; padding-top: 3px; font-size: 11px;">..........................</div>
                </div>
                <div style="flex: 1; font-size: 11px;">
                    <div style="font-weight: 800; text-transform: uppercase; font-size: 11px;">Kế toán trưởng</div>
                    <div style="font-style: italic; font-size: 10px; color: #555;">(Ký, ghi rõ họ tên)</div>
                    <div style="height: 36px;"></div>
                    <div style="font-weight: 800; border-top: 1px solid #333; display: inline-block; min-width: 120px; padding-top: 3px; font-size: 11px;">..........................</div>
                </div>
                <div style="flex: 1; font-size: 11px;">
                    <div style="font-weight: 800; text-transform: uppercase; font-size: 11px;">Giám đốc</div>
                    <div style="font-style: italic; font-size: 10px; color: #555;">(Ký tên, đóng dấu)</div>
                    <div style="height: 36px;"></div>
                    <div style="font-weight: 800; border-top: 1px solid #333; display: inline-block; min-width: 120px; padding-top: 3px; font-size: 11px;">..........................</div>
                </div>
            </div>`;

        return `
        <div style="${pageBreakStyle} padding: 0 0 10px; font-family: 'Times New Roman', Times, serif;">
            <!-- Thông tin người nhận -->
            <div style="margin-bottom:12px;">
                <div style="font-size:12px; margin-bottom:4px;">Kính gửi: <u><strong>${name}</strong></u></div>
                <div style="font-size:11px; color:#555;">Chức vụ: ${roleLabel} &nbsp;|&nbsp; Kỳ lương: 01/${m}/${y} — ${new Date(y, m, 0).getDate()}/${m}/${y}</div>
            </div>

            <table style="width:100%; border-collapse:collapse;">
                <colgroup><col style="width:60%"><col style="width:40%"></colgroup>

                ${section('I. Thông tin nhân viên')}
                ${row('Mã nhân viên', staffCode)}
                ${row('Họ và tên', name)}
                ${row('Chức vụ / Bộ phận', roleLabel)}
                ${row('Số ngày làm việc thực tế', `${py.workingDays || 0} ngày`)}
                ${row('Tổng giờ làm việc', `${py.totalHoursWorked || 0}h`)}
                ${row('Đơn giá giờ', (() => {
            if (py.hourlyRate > 0) return `${fmt(py.hourlyRate)}đ/h`;
            const m2 = (py.note || '').match(/×\s*([\d.,]+)đ\/h/);
            return m2 ? `${m2[1]}đ/h` : '—';
        })())}

                ${section('II. Khoản thu nhập')}
                ${row('1. Lương cơ bản', `${fmt(py.baseSalary)}đ`)}
                ${row('2. Hoa hồng dịch vụ / Hóa đơn', `${fmt(py.commissions)}đ`)}
                ${row('3. Phụ cấp ca đêm', `${fmt(py.bonus)}đ`)}
                ${row('Tổng thu nhập', `${fmt(totalIncome)}đ`, true)}

                ${section('III. Khoản khấu trừ')}
                ${row(`4. Nghỉ không lương (${py.unpaidDays || 0} ngày)`, `${fmt(py.leaveDeduction)}đ`, false, '#cc0000')}
                ${row(`5. Đi trễ`, `${fmt(py.latePenalty)}đ`, false, '#cc0000')}
                ${row('6. Vắng mặt', `${fmt(absentPenalty)}đ`, false, '#cc0000')}
                ${row('Tổng khấu trừ', `${fmt(totalDeduct)}đ`, true, totalDeduct > 0 ? '#cc0000' : '')}

                ${section('IV. Lương thực lĩnh')}
                <tr><td colspan="2" style="padding:2px;border:none;background:transparent;"></td></tr>
                <tr>
                    <td style="padding:10px 10px;font-size:13px;font-weight:900;border:2px solid #111;text-transform:uppercase;">
                        LƯƠNG THỰC LĨNH = (II) − (III)
                    </td>
                    <td style="padding:10px 10px;font-size:15px;font-weight:900;border:2px solid #111;text-align:right;color:#006633;">
                        ${fmt(netSalary)}đ
                    </td>
                </tr>
                ${py.note ? `<tr><td colspan="2" style="padding:6px 10px;font-size:10px;color:#555;border:1px solid #ccc;font-style:italic;">Ghi chú: ${py.note}</td></tr>` : ''}
            </table>

            <!-- Chữ ký tích hợp hẳn vào trong 1 phiếu -->
            ${signatureBlock}
        </div>`;
    };

    // In phiếu lương cá nhân — không dùng page-break để chữ ký nằm cùng trang
    const handlePrintPayslip = async (py) => {
        const m = py.month || payrollMonth;
        const y = py.year || payrollYear;
        await printReport({
            title: `PHIẾU LƯƠNG THÁNG ${m}/${y}`,
            metaInfo: '',
            contentHTML: buildPayslipHTML(py, m, y, false),
            summaryHTML: '',
            hideSignatures: true,
        });
    };

    // In hàng loạt — mỗi NV là 1 phiếu riêng biệt (header + bảng + chữ ký)
    const handleBatchPrintPayslips = async (allRows) => {
        const m = payrollMonth, y = payrollYear;
        if (!allRows || allRows.length === 0) { showToast('Không có dữ liệu để in', 'warning'); return; }
        // Mỗi phần tử = 1 phếu lương hoàn chỉnh với header, bảng và chữ ký riêng
        const pages = allRows.map(py => ({
            title: `PHIẾU LƯƠNG THÁNG ${m}/${y}`,
            payslipHTML: buildPayslipHTML(py, m, y, false), // breakAfter=false vì đã xử lý bằng page-break trong printBatchPayslips
        }));
        await printBatchPayslips(pages);
    };

    // Chốt lương riêng 1 nhân viên — hiển thị chi tiết preview trước khi xác nhận
    const generatePayrollForOne = (previewRow) => {
        const m = payrollMonth, y = payrollYear;
        setPayrollDetailModal({ ...previewRow, month: m, year: y, _pendingConfirm: true });
    };

    const doGeneratePayrollForOne = async (previewRow) => {
        const m = payrollMonth, y = payrollYear;
        const staffId = previewRow.staffId?._id || previewRow.staffId;
        const name = previewRow.staffId?.fullName;
        setSubmitLoading(true);
        try {
            await axios.delete(`${API}/hrm/payrolls/month?month=${m}&year=${y}&staffId=${staffId}`, { headers: authHeader() });
            const res = await axios.post(`${API}/hrm/payrolls/generate`, {
                month: m, year: y, staffIds: [staffId]
            }, { headers: authHeader() });
            if (res.data.success) {
                showToast(`✅ Chốt lương thành công — ${name}`);
                setPayrollDetailModal(null);
                fetchPayrollData(m, y);
            }
        } catch (err) { showToast('Lỗi chốt lương', 'error'); }
        finally { setSubmitLoading(false); }
    };



    const getRoleBadge = (role) => {
        const roles = {
            ADMIN: { label: 'Hệ thống', color: '#ef4444' },
            DOCTOR: { label: 'Bác sĩ', color: '#16a34a' },
            RECEPTIONIST: { label: 'Lễ Tân / Phụ Tá', color: '#2563eb' },
            GROOMER: { label: 'Groomer', color: '#db2777' }
        };
        const info = roles[role] || { label: role, color: '#94a3b8' };
        return <span className="badge" style={{ background: `${info.color}15`, color: info.color, border: `1px solid ${info.color}30` }}>{info.label}</span>;
    };

    const getRoleWeight = (role) => {
        const weights = { ADMIN: 1, DOCTOR: 2, RECEPTIONIST: 3, GROOMER: 4 };
        return weights[role] || 99;
    };

    const sortedStaffList = [...staffList].sort((a, b) => {
        const diff = getRoleWeight(a.role) - getRoleWeight(b.role);
        if (diff !== 0) return diff;
        const dateA = new Date(a.createdAt || a.hireDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.hireDate || 0).getTime();
        return dateA - dateB;
    });

    const filteredStaffList = sortedStaffList.filter(s => (s.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.phoneNumber || '').includes(searchQuery));
    const filteredSchedules = schedules.filter(sc => (sc.staffId?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (sc.shift || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredLeaves = leaves.filter(lv => (lv.staffId?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (lv.reason || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredPayrolls = payrolls.filter(py => (py.staffId?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()));

    const handlePublishPayroll = async (payroll) => {
        if (payroll.isPublished) return showToast('Bảng lương này đã được công bố rồi.', 'warning');
        showConfirm(
            'Công bố bảng lương',
            `Công bố bảng lương tháng ${payroll.month || payrollMonth}/${payroll.year || payrollYear} cho ${payroll.staffId?.fullName}?\nNhân viên sẽ xem được trong Trang Hồ Sơ.`,
            async () => {
                try {
                    await axios.put(`${API}/hrm/payrolls/${payroll._id}/publish`, {}, { headers: authHeader() });
                    showToast(`Đã công bố bảng lương cho ${payroll.staffId?.fullName}`, 'success');
                    fetchPayrollData(payrollMonth, payrollYear);
                } catch (e) {
                    showToast(e.response?.data?.message || 'Lỗi công bố', 'error');
                }
            }
        );
    };


    const handleOpenEditPayroll = (py) => {
        setSelectedPayroll(py);
        setEditPayrollData({
            bonus: py.bonus || 0,
            deductions: py.deductions || 0,
            note: py.note || ''
        });
        setIsEditPayrollModalOpen(true);
    };

    const handleSavePayrollAdjustment = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            await axios.put(`${API}/hrm/payrolls/${selectedPayroll._id}`, editPayrollData, { headers: authHeader() });
            showToast('Đã cập nhật bảng lương');
            setIsEditPayrollModalOpen(false);
            fetchData();
        } catch (error) {
            showToast('Lỗi cập nhật bảng lương', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };



    return (
        <Layout active="staff">
            <div className="animate-fade-in">
                {/* Main Content Header */}
                <div className="flex-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            {activeTab === 'list' ? 'Đội Ngũ Nhân Viên' :
                                activeTab === 'schedules' ? 'Lịch Trực Hệ Thống' :
                                    activeTab === 'leaves' ? 'Đơn Nghỉ Phép' :
                                        'Bảng Lương & Thưởng'}
                        </h2>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {activeTab === 'list' ? 'Quản lý thông tin và tài khoản nhân sự.' :
                                activeTab === 'schedules' ? 'Phân bổ ca trực cho bác sĩ và phụ tá.' :
                                    activeTab === 'leaves' ? 'Theo dõi và duyệt đơn vắng mặt.' :
                                        'Tổng hợp thu nhập và hoa hồng tháng.'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="input-with-icon" style={{ maxWidth: '250px' }}>
                            <Search className="input-icon" size={18} />
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Tìm kiếm..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '8px 12px 8px 40px', borderRadius: '12px' }}
                            />
                        </div>
                        {activeTab === 'list' && selectedStaffIds.length > 0 && user?.role === 'ADMIN' && (
                            <button className="btn" style={{ height: '42px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }} onClick={handleBulkDeleteStaff} disabled={submitLoading}>
                                <Trash2 size={18} /> <span className="hide-on-mobile">Xóa {selectedStaffIds.length} mục</span>
                            </button>
                        )}
                        {activeTab === 'list' && (
                            <button className="btn btn-primary" onClick={() => handleOpenStaffModal()} style={{ padding: '8px 16px' }}>
                                <Plus size={18} /> <span className="hide-on-mobile">Thêm mới</span>
                            </button>
                        )}
                    </div>
                </div>



                <div className="glass-card" style={{ padding: '0', overflow: activeTab === 'payroll' ? 'visible' : 'hidden', border: '1px solid rgba(255,255,255,0.5)' }}>
                    {activeTab === 'list' && (
                        <div className="table-responsive">
                            <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '16px 16px', width: '40px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedStaffIds(filteredStaffList.map(s => s._id));
                                                    else setSelectedStaffIds([]);
                                                }}
                                                checked={selectedStaffIds.length > 0 && selectedStaffIds.length === filteredStaffList.length}
                                            />
                                        </th>
                                        <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Nhân viên</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Liên hệ</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '15%' }}>Ngày tham gia</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '20%' }}>Trạng thái</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Quản lý</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaffList.map(s => (
                                        <tr key={s._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="hover-row">
                                            <td style={{ padding: '16px 16px', textAlign: 'center' }} data-label="Bật/Tắt Chọn" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                    checked={selectedStaffIds.includes(s._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, s._id]);
                                                        else setSelectedStaffIds(selectedStaffIds.filter(id => id !== s._id));
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '14px 20px' }} data-label="Nhân viên">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    {/* Avatar: ảnh thật hoặc chữ cái đầu */}
                                                    {s.verificationPhoto ? (
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', flexShrink: 0, position: 'relative' }}>
                                                            <img src={s.verificationPhoto} alt={s.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            width: '40px', height: '40px', borderRadius: '10px',
                                                            background: 'linear-gradient(135deg, var(--primary-light), #fff)',
                                                            color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontWeight: 700, fontSize: '1.1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', flexShrink: 0
                                                        }}>
                                                            {(s.fullName || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {s.fullName}
                                                            {s.isActive === false && <span style={{ color: '#ef4444', fontSize: '0.7rem', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>KHÓA</span>}
                                                            {/* Badge yêu cầu FaceID đang chờ */}
                                                            {s.faceResetRequest?.requested && (
                                                                <span
                                                                    onClick={() => setFaceApprovalModal({ staff: s, pendingPhoto: s.faceResetRequest.pendingFacePhoto })}
                                                                    style={{ cursor: 'pointer', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                                    title="Click xuống xem yêu cầu FaceID"
                                                                >
                                                                    <ScanFace size={11} /> FaceID
                                                                </span>
                                                            )}
                                                        </div>
                                                        {getRoleBadge(s.role)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 20px', color: '#444', fontSize: '0.88rem' }} data-label="Liên hệ">
                                                <div style={{ fontWeight: 600, color: '#334155' }}>{s.phoneNumber}</div>
                                                {s.email ? (
                                                    <a href={`mailto:${s.email}`} style={{ color: '#6366f1', fontSize: '0.78rem', textDecoration: 'none', display: 'block', marginTop: '2px' }}
                                                        title="Gửi email" onClick={e => e.stopPropagation()}
                                                    >
                                                        {s.email}
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Chưa có email</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }} data-label="Ngày tham gia">{new Date(s.hireDate).toLocaleDateString('vi-VN')}</td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }} data-label="Trạng thái">
                                                {s.isActive === false ? (
                                                    <span className="badge" style={{ background: '#fef2f2', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, padding: '6px 12px', minWidth: '130px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                        <Lock size={12} /> Đã khóa
                                                    </span>
                                                ) : s.hasVerificationPhoto ? (
                                                    <span className="badge" style={{ background: '#ecfdf5', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, padding: '6px 12px', minWidth: '130px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                        <CheckCircle2 size={12} /> Đã xác thực
                                                    </span>
                                                ) : (
                                                    <span className="badge" style={{ background: '#f5f3ff', color: '#d97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, padding: '6px 12px', minWidth: '130px', border: '1px solid rgba(217,119,6,0.2)' }}>
                                                        <AlertCircle size={12} /> Chưa xác thực
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button
                                                        className="btn-icon"
                                                        style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '6px' }}
                                                        onClick={() => handleOpenStaffModal(s)}
                                                        title="Sửa"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        style={{ color: s.isActive === false ? '#10b981' : '#7e22ce', background: s.isActive === false ? '#ecfdf5' : '#f5f3ff', padding: '6px' }}
                                                        onClick={() => handleToggleLock(s)}
                                                        title={s.isActive === false ? "Mở" : "Khóa"}
                                                    >
                                                        {s.isActive === false ? <CheckCircle2 size={16} /> : <X size={16} />}
                                                    </button>
                                                    {/* Nút Chấm Công — chỉ Admin */}
                                                    {user?.role === 'ADMIN' && (
                                                        <button
                                                            className="btn-icon"
                                                            style={{ color: '#0ea5e9', background: '#f0f9ff', padding: '6px' }}
                                                            onClick={() => handleViewAttendanceHistory(s)}
                                                            title="Lịch sử chấm công"
                                                        >
                                                            <Clock size={16} />
                                                        </button>
                                                    )}
                                                    {/* Nút Lịch sử — chỉ Admin */}
                                                    {user?.role === 'ADMIN' && (
                                                        <button
                                                            className="btn-icon"
                                                            style={{ color: '#7c3aed', background: '#f5f3ff', padding: '6px' }}
                                                            onClick={() => handleViewActivityLog(s)}
                                                            title="Lịch sử hoạt động"
                                                        >
                                                            <History size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn-icon"
                                                        style={{ color: '#ef4444', background: '#fef2f2', padding: '6px' }}
                                                        onClick={() => handleDeleteStaff(s._id)}
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'schedules' && (
                        <div style={{ padding: '24px' }}>
                            {/* TOP HEADER: Title & Major Actions */}
                            <div className="flex-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Calendar size={26} style={{ color: 'var(--primary)' }} />
                                        Bảng Phân Ca Hệ Thống
                                    </h3>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Theo dõi và cập nhật lịch trực nhân viên chính xác.</p>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {/* Chỉ báo thay đổi chưa lưu */}
                                    {JSON.stringify(scheduleGrid) !== JSON.stringify(savedScheduleGrid) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f3ff', border: '1px solid #7e22ce', borderRadius: '10px', padding: '6px 14px', animation: 'pulse 2s infinite' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309' }}>⚠️ Có thay đổi chưa lưu</span>
                                            <button
                                                onClick={handleDiscardChanges}
                                                style={{ background: 'none', border: 'none', padding: '2px 6px', borderRadius: '6px', color: '#b45309', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                            >↩ Hoàn tác</button>
                                        </div>
                                    )}
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => fetchScheduleData(false)}
                                        disabled={matrixRefreshing}
                                        style={{ height: '42px', padding: '0 18px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#44546a', opacity: matrixRefreshing ? 0.7 : 1 }}
                                    >
                                        <RefreshCw size={18} className={matrixRefreshing ? 'animate-spin' : ''} /> <span>{matrixRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
                                    </button>

                                    {/* Nút khóa/mở lịch quá khứ — chỉ Admin */}
                                    {user?.role === 'ADMIN' && (
                                        <button
                                            onClick={() => setAllowEditPast(p => !p)}
                                            style={{
                                                height: '42px',
                                                padding: '0 18px',
                                                borderRadius: '10px',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                background: allowEditPast ? '#f5f3ff' : 'white',
                                                border: `1.5px solid ${allowEditPast ? '#7e22ce' : '#e2e8f0'}`,
                                                color: allowEditPast ? '#92400e' : '#475569',
                                                fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
                                                boxShadow: allowEditPast ? '0 0 0 3px #fde68a55' : 'none',
                                                transition: 'all 0.2s',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>{allowEditPast ? '🔓' : '🔒'}</span>
                                            {allowEditPast ? 'Đang sửa lịch cũ' : 'Lịch cũ bị khóa'}
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-primary"
                                        onClick={handlePreviewSync}
                                        disabled={submitLoading}
                                        style={{ height: '42px', padding: '0 24px', borderRadius: '10px', fontWeight: 700, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}
                                    >
                                        <Save size={18} /> <span>{submitLoading ? 'ĐANG LƯU...' : 'LƯU LỊCH TRỰC'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* TOOLBAR: Controls & Filters */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '16px',
                                alignItems: 'center',
                                marginBottom: '24px',
                                padding: '12px 20px',
                                background: '#f8fafc',
                                borderRadius: '14px',
                                border: '1px solid #f1f5f9'
                            }}>
                                {/* Date Selection Group */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', borderRadius: '8px', padding: '5px 12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>TỪ:</span>
                                        <input
                                            type="date"
                                            value={matrixStartDate}
                                            onChange={(e) => {
                                                setMatrixStartDate(e.target.value);
                                                if (matrixViewMode === 'DAY') setMatrixEndDate(e.target.value);
                                                if (matrixViewMode === 'WEEK') {
                                                    const d = new Date(e.target.value);
                                                    d.setDate(d.getDate() + 6);
                                                    setMatrixEndDate(d.toISOString().split('T')[0]);
                                                }
                                            }}
                                            style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ width: '1px', height: '14px', background: '#cbd5e1' }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>ĐẾN:</span>
                                        <input
                                            type="date"
                                            value={matrixEndDate}
                                            onChange={(e) => setMatrixEndDate(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
                                    <button
                                        className={`btn ${matrixViewMode === 'DAY' ? 'btn-primary' : ''}`}
                                        onClick={() => {
                                            setMatrixViewMode('DAY');
                                            setMatrixEndDate(matrixStartDate);
                                        }}
                                        style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: matrixViewMode === 'DAY' ? '' : 'transparent', color: matrixViewMode === 'DAY' ? '' : '#64748b', fontWeight: 700 }}
                                    >Ngày</button>
                                    <button
                                        className={`btn ${matrixViewMode === 'WEEK' ? 'btn-primary' : ''}`}
                                        onClick={() => {
                                            setMatrixViewMode('WEEK');
                                            const d = new Date(matrixStartDate);
                                            d.setDate(d.getDate() + 6);
                                            setMatrixEndDate(d.toISOString().split('T')[0]);
                                        }}
                                        style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', background: matrixViewMode === 'WEEK' ? '' : 'transparent', color: matrixViewMode === 'WEEK' ? '' : '#64748b', fontWeight: 700 }}
                                    >Tuần</button>
                                </div>

                                <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />

                                {/* Role Filter Group */}
                                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
                                    {['ALL', 'DOCTOR', 'RECEPTIONIST', 'GROOMER'].map(role => (
                                        <button
                                            key={role}
                                            className={`btn ${matrixRoleFilter === role ? 'btn-primary' : ''}`}
                                            onClick={() => setMatrixRoleFilter(role)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '0.7rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: matrixRoleFilter === role ? '' : 'transparent',
                                                color: matrixRoleFilter === role ? '' : '#64748b',
                                                fontWeight: 700
                                            }}
                                        >
                                            {role === 'ALL' ? 'Tất cả' : role === 'DOCTOR' ? 'Bác sĩ' : role === 'RECEPTIONIST' ? 'Lễ tân' : 'Groomer'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* LEGEND */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0', fontSize: '0.75rem' }}>
                                <span style={{ fontWeight: 800, color: '#475569', marginRight: '4px', whiteSpace: 'nowrap' }}>📌 Chú thích:</span>

                                {/* Ca trực theo chức vụ */}
                                {[
                                    { color: '#16a34a', label: 'Bác sĩ' },
                                    { color: '#2563eb', label: 'Lễ tân' },
                                    { color: '#db2777', label: 'Groomer' },
                                    { color: '#ef4444', label: 'Admin' }
                                ].map(({ color, label }) => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', padding: '3px 10px', borderRadius: '6px', border: `1px solid ${color}30` }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: `${color}20`, border: `1.5px solid ${color}` }} />
                                        <span style={{ color, fontWeight: 700 }}>{label}</span>
                                    </div>
                                ))}

                                <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fffbeb', padding: '3px 10px', borderRadius: '6px', border: '1px solid #f59e0b' }}>
                                    <span style={{ fontSize: '11px' }}>🏖</span>
                                    <span style={{ color: '#d97706', fontWeight: 700 }}>Nghỉ phép đã duyệt</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8f8f8', padding: '3px 10px', borderRadius: '6px', border: '1px solid #94a3b8' }}>
                                    <span style={{ fontSize: '11px' }}>⏳</span>
                                    <span style={{ color: '#64748b', fontWeight: 700 }}>Đang chờ duyệt</span>
                                </div>

                                <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

                                {/* Chấm công */}
                                {[
                                    { dot: '#22c55e', label: 'Có mặt' },
                                    { dot: '#7e22ce', label: 'Đi trễ' },
                                    { dot: '#ef4444', label: 'Vắng' },
                                    { dot: '#dc2626', label: 'Quên Checkout (Lỗi)' },
                                    { dot: '#94a3b8', label: 'Chưa chấm' },
                                ].map(({ dot, label }) => (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', background: 'white', border: '1px solid #e2e8f0' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot }} />
                                        <span style={{ color: '#475569', fontWeight: 600 }}>{label}</span>
                                    </div>
                                ))}


                                {/* Hướng dẫn thao tác */}
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}> Nhấn vào ô ca để bật/tắt · Nhấn <strong style={{ color: '#0f172a' }}>LƯU LỊCH TRỰC</strong> để lưu thay đổi</span>
                            </div>

                            <div className="table-responsive" style={{ borderTop: '1px solid #e2e8f0', overflow: 'auto', maxHeight: '75vh', padding: 0 }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{
                                                padding: '16px',
                                                textAlign: 'left',
                                                borderBottom: '2px solid #e2e8f0',
                                                width: '200px',
                                                position: 'sticky',
                                                left: 0,
                                                top: 0,
                                                background: '#f8fafc',
                                                zIndex: 102,
                                                fontFamily: 'var(--font-body)'
                                            }}>Nhân viên</th>
                                            {getMatrixDates().map((d, idx) => (
                                                <th key={idx} style={{
                                                    padding: '12px',
                                                    textAlign: 'center',
                                                    borderBottom: '2px solid #e2e8f0',
                                                    borderLeft: '1px solid #f1f5f9',
                                                    minWidth: '100px',
                                                    background: '#f8fafc',
                                                    position: 'sticky',
                                                    top: 0,
                                                    zIndex: 100,
                                                    fontFamily: 'var(--font-body)'
                                                }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>{d.toLocaleDateString('vi-VN', { weekday: 'short' })}</div>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{d.getDate()}/{d.getMonth() + 1}</div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffList.filter(s => s.isActive !== false && (matrixRoleFilter === 'ALL' || s.role === matrixRoleFilter)).map(s => {
                                            const roleMeta = {
                                                DOCTOR: { label: 'Bác sĩ', color: '#16a34a' },
                                                RECEPTIONIST: { label: 'Lễ tân', color: '#2563eb' },
                                                GROOMER: { label: 'Groomer', color: '#db2777' },
                                                ADMIN: { label: 'Admin', color: '#ef4444' }
                                            }[s.role] || { label: s.role, color: '#64748b' };

                                            return (
                                                <tr key={s._id} className="schedule-row" style={{ borderBottom: '2px solid #e2e8f0', transition: 'background 0.2s' }}>
                                                    <td style={{
                                                        padding: '12px 16px',
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem',
                                                        position: 'sticky',
                                                        left: 0,
                                                        background: 'white',
                                                        zIndex: 5,
                                                        borderRight: '1px solid #e2e8f0',
                                                        borderBottom: '2px solid #e2e8f0',
                                                        fontFamily: 'var(--font-body)'
                                                    }}>
                                                        <div style={{ whiteSpace: 'nowrap', color: '#1e293b' }}>{s.fullName}</div>
                                                        <div style={{ fontSize: '0.7rem', color: roleMeta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{roleMeta.label}</div>
                                                    </td>
                                                    {getMatrixDates().map((d, idx) => {
                                                        const dKey = d.toISOString().split('T')[0];
                                                        const todayKey = new Date().toISOString().split('T')[0];
                                                        const isPast = dKey <= todayKey;   // hôm nay cũng hiện chấm
                                                        const isStrictlyPast = dKey < todayKey; // chỉ ngày qua mới khóa
                                                        const isLocked = isStrictlyPast && !allowEditPast;
                                                        const currentShifts = (scheduleGrid[s._id] && scheduleGrid[s._id][dKey]) || [];

                                                        // Kiểm tra đơn nghỉ phép
                                                        const approvedLeave = leaves.find(lv => {
                                                            if (lv.staffId?._id !== s._id && lv.staffId !== s._id) return false;
                                                            if (lv.status !== 'APPROVED') return false;
                                                            const leaveStart = lv.startDate?.split('T')[0];
                                                            const leaveEnd = lv.endDate?.split('T')[0];
                                                            return dKey >= leaveStart && dKey <= leaveEnd;
                                                        });

                                                        const pendingLeave = leaves.find(lv => {
                                                            if (lv.staffId?._id !== s._id && lv.staffId !== s._id) return false;
                                                            if (lv.status !== 'PENDING') return false;
                                                            const leaveStart = lv.startDate?.split('T')[0];
                                                            const leaveEnd = lv.endDate?.split('T')[0];
                                                            return dKey >= leaveStart && dKey <= leaveEnd;
                                                        });

                                                        // Tìm chấm công theo từng ca cụ thể
                                                        // Ư u tiên: theo scheduleId (chính xác nhất)
                                                        const getAttForShift = (shiftCode) => {
                                                            // Tìm schedule của nhân viên này tại ngày & ca này
                                                            const sc = schedules.find(x => {
                                                                const xSId = x.staffId?._id || x.staffId;
                                                                const xDKey = new Date(x.date).toISOString().split('T')[0];
                                                                return xSId === s._id && xDKey === dKey && x.shift === shiftCode;
                                                            });
                                                            if (sc) {
                                                                const byScId = attendanceData[`sc_${sc._id}`];
                                                                if (byScId) return byScId;
                                                            }
                                                            // Fallback: staffId_date_shift
                                                            return attendanceData[`${s._id}_${dKey}_${shiftCode}`];
                                                        };

                                                        const getAttDotForShift = (shiftCode) => {
                                                            if (!isPast) return null;
                                                            const isActiveShift = currentShifts.includes(shiftCode);
                                                            if (!isActiveShift) return null;
                                                            const rec = getAttForShift(shiftCode);
                                                            if (rec) {
                                                                if (rec.checkOut?.isAuto) return { color: '#dc2626', title: 'Quên Checkout (Lỗi)', status: 'FORGOTTEN_CHECKOUT' };
                                                                if (rec.status === 'LATE') return { color: '#7e22ce', title: `Đi trễ ${rec.checkIn?.lateMinutes || 0} phút`, status: 'LATE' };
                                                                if (rec.status === 'ABSENT') return { color: '#ef4444', title: 'Vắng mặt', status: 'ABSENT' };
                                                                if (rec.status === 'ON_LEAVE') return { color: '#f59e0b', title: 'Nghỉ phép', status: 'ON_LEAVE' };
                                                                return { color: '#22c55e', title: 'Có mặt', status: 'PRESENT' };
                                                            }
                                                            // Có lịch trực nhưng chưa có record → xem đã qua chưa
                                                            if (isStrictlyPast) return { color: '#ef4444', title: 'Vắng (chưa đánh dấu)', status: 'ABSENT_LIKELY' };
                                                            return { color: '#94a3b8', title: 'Chưa chấm công', status: 'PENDING' };
                                                        };

                                                        const toggleShift = (shiftCode) => {
                                                            if (isLocked) return; // Blocked nếu đang khóa
                                                            const newShifts = currentShifts.includes(shiftCode)
                                                                ? currentShifts.filter(c => c !== shiftCode)
                                                                : [...currentShifts, shiftCode];

                                                            setScheduleGrid(prev => ({
                                                                ...prev,
                                                                [s._id]: {
                                                                    ...(prev[s._id] || {}),
                                                                    [dKey]: newShifts
                                                                }
                                                            }));
                                                        };

                                                        return (
                                                            <td key={idx} style={{
                                                                padding: '6px',
                                                                borderLeft: '1px solid #f1f5f9',
                                                                borderBottom: '1px solid #e2e8f0',
                                                                background: isLocked ? '#fbfbfa' : approvedLeave ? '#fffbeb' : pendingLeave ? '#f8f8f8' : 'transparent',
                                                                position: 'relative',
                                                                opacity: isLocked ? 0.75 : 1,
                                                                filter: isLocked ? 'grayscale(40%)' : 'none',
                                                                transition: 'all 0.15s'
                                                            }}>
                                                                {/* Biểu tượng khóa ngày cũ */}
                                                                {isLocked && (
                                                                    <div style={{ position: 'absolute', top: '3px', right: '4px', fontSize: '10px', color: '#94a3b8' }} title="Ngày đã qua — khóa chỉnh sửa">🔒</div>
                                                                )}

                                                                {/* Badge nghỉ phép nổi bật ở trên cùng ô */}
                                                                {approvedLeave && (
                                                                    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                                                                        <span style={{ background: '#f59e0b', color: 'white', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', letterSpacing: '0.5px' }}>
                                                                            🏖 NGHỈ PHÉP
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pendingLeave && !approvedLeave && (
                                                                    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                                                                        <span style={{ background: '#94a3b8', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', letterSpacing: '0.5px' }}>
                                                                            ⏳ CHỜ DUYỆT
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    {[
                                                                        { code: 'DAY', label: 'Ca Ngày' },
                                                                        { code: 'EVENING', label: 'Chiều Tối' },
                                                                        { code: 'NIGHT', label: 'Ca Đêm' }
                                                                    ].map(({ code, label }) => {
                                                                        const isActive = currentShifts.includes(code);
                                                                        const isOnLeave = approvedLeave && isActive;
                                                                        const attDot = getAttDotForShift(code);
                                                                        // Tô nền cả ô button khi vắng/có mặt
                                                                        const attBg = attDot ? {
                                                                            'PRESENT': { bg: '#f0fdf4', border: '#16a34a50' },
                                                                            'LATE': { bg: '#f5f3ff', border: '#7e22ce60' },
                                                                            'ABSENT': { bg: '#fef2f2', border: '#ef444460' },
                                                                            'ABSENT_LIKELY': { bg: '#fef2f2', border: '#ef444430' },
                                                                            'ON_LEAVE': { bg: '#fffbeb', border: '#f59e0b40' },
                                                                            'FORGOTTEN_CHECKOUT': { bg: '#fef2f2', border: '#dc262660' }
                                                                        }[attDot.status] || {} : {};
                                                                        return (
                                                                            <button
                                                                                key={code}
                                                                                onClick={() => toggleShift(code)}
                                                                                title={isOnLeave ? `⚠️ Ca này đã được duyệt nghỉ phép (${approvedLeave.type})` : attDot?.title || ''}
                                                                                style={{
                                                                                    padding: '4px 2px',
                                                                                    borderRadius: '4px',
                                                                                    fontSize: '10px',
                                                                                    fontWeight: 700,
                                                                                    cursor: 'pointer',
                                                                                    fontFamily: 'var(--font-body)',
                                                                                    transition: 'all 0.2s',
                                                                                    textTransform: 'uppercase',
                                                                                    ...(isOnLeave ? {
                                                                                        background: '#fef3c7',
                                                                                        color: '#d97706',
                                                                                        border: '1.5px solid #7e22ce',
                                                                                        textDecoration: 'line-through',
                                                                                        opacity: 0.85
                                                                                    } : isActive ? {
                                                                                        background: `${roleMeta.color}15`,
                                                                                        color: roleMeta.color,
                                                                                        border: `1.5px solid ${roleMeta.color}40`,
                                                                                    } : {
                                                                                        background: '#fff',
                                                                                        color: '#94a3b8',
                                                                                        border: '1px solid #e2e8f0'
                                                                                    })
                                                                                }}
                                                                            ><span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                                                                    <span style={{
                                                                                        display: 'inline-block',
                                                                                        width: '6px', height: '6px',
                                                                                        borderRadius: '50%',
                                                                                        flexShrink: 0,
                                                                                        background: (isPast && isActive && attDot) ? attDot.color : 'transparent',
                                                                                        border: (isPast && isActive && !attDot) ? '1.5px solid #94a3b8' : 'none',
                                                                                        boxShadow: (isPast && isActive && attDot) ? `0 0 0 1.5px white` : 'none'
                                                                                    }} />
                                                                                    {label}
                                                                                </span></button>

                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'leaves' && (
                        <div className="table-responsive">
                            <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', width: '25%' }}>Nhân viên</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', width: '25%' }}>Thời gian</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', width: '25%' }}>Lý do</th>
                                        <th style={{ padding: '14px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', width: '25%' }}>Phê duyệt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeaves.map(lv => (
                                        <tr key={lv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '14px 20px' }} data-label="Nhân viên"><strong>{lv.staffId?.fullName}</strong></td>
                                            <td style={{ padding: '14px 20px', fontSize: '0.85rem' }} data-label="Thời gian">{new Date(lv.startDate).toLocaleDateString()} - {new Date(lv.endDate).toLocaleDateString()}</td>
                                            <td style={{ padding: '14px 20px', fontSize: '0.85rem' }} data-label="Lý do">
                                                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{lv.type}</span>: {lv.reason}
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                                {lv.status === 'PENDING' ? (
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button onClick={() => updateLeaveStatus(lv._id, 'APPROVED')} className="btn-icon" style={{ color: '#16a34a', background: '#ecfdf5' }}><CheckCircle2 size={18} /></button>
                                                        <button onClick={() => updateLeaveStatus(lv._id, 'REJECTED')} className="btn-icon" style={{ color: '#ef4444', background: '#fef2f2' }}><X size={18} /></button>
                                                    </div>
                                                ) : (
                                                    <span className={`badge ${lv.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>{lv.status}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'payroll' && (() => {
                        const confirmedIds = new Set(payrolls.map(p => p.staffId?._id || p.staffId));
                        const uncalculatedStaff = staffList.filter(s => s.role !== 'MANAGER' && s.role !== 'ADMIN' && s.isActive !== false && !confirmedIds.has(s._id));
                        const totalConfirmed = payrolls.reduce((s, p) => s + (p.totalSalary || 0), 0);
                        const allRows = [...payrolls];
                        return (
                            <div style={{ padding: '20px 24px 24px' }}>

                                {/* ── Header: chọn tháng bên trái | nút bên phải ── */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                    {/* Bên trái: bộ chọn tháng/năm */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                            <Calendar size={15} color="#64748b" />
                                            <select value={payrollMonth} onChange={e => setPayrollMonth(Number(e.target.value))}
                                                style={{ border: 'none', background: 'transparent', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', cursor: 'pointer', outline: 'none' }}>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <option key={m} value={m}>Tháng {m}</option>
                                                ))}
                                            </select>
                                            <span style={{ color: '#94a3b8' }}>/</span>
                                            <input type="number" value={payrollYear} onChange={e => setPayrollYear(Number(e.target.value))}
                                                min={2020} max={2099}
                                                style={{ width: '52px', border: 'none', background: 'transparent', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', outline: 'none', textAlign: 'center' }} />
                                        </div>
                                    </div>
                                    {/* Bên phải: các nút hành động */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button className="btn btn-secondary" onClick={() => fetchPayrollData(payrollMonth, payrollYear)} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <RefreshCw size={15} className={payrollLoading ? 'animate-spin' : ''} /> Tải lại
                                        </button>
                                        <button className="btn btn-primary" onClick={resetAndRecalculatePayroll}
                                            disabled={submitLoading}
                                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px', justifyContent: 'center', opacity: submitLoading ? 0.75 : 1 }}>
                                            {submitLoading
                                                ? <><RefreshCw size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> ...</>
                                                : <><RefreshCw size={15} /> {selectedCalcIds.length > 0 ? `Tính lương (${selectedCalcIds.length})` : 'Tính hàng loạt'}</>}
                                        </button>
                                        {allRows.length > 0 && (
                                            <button className="btn btn-primary" onClick={() => handleBatchPrintPayslips(allRows)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Printer size={15} /> In tất cả
                                            </button>
                                        )}

                                    </div>
                                </div>


                                {/* ── Loading Skeleton ── */}
                                {payrollLoading && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[1, 2, 3].map(i => (
                                            <div key={i} style={{ height: '60px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', borderRadius: '12px' }} />
                                        ))}
                                    </div>
                                )}
                                {!payrollLoading && <>
                                    {/* ── Summary Cards ── */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                        {[
                                            { label: 'Đã lưu (DB)', value: payrolls.length, sub: totalConfirmed.toLocaleString('vi-VN') + 'đ', color: '#10b981', bg: '#f8fafc', border: '#10b981' },
                                            { label: 'Chưa tính lương', value: uncalculatedStaff.length, sub: 'cần xử lý', color: '#f59e0b', bg: '#fefce8', border: '#f59e0b' },
                                            { label: 'Tổng chi tháng', value: totalConfirmed.toLocaleString('vi-VN') + 'đ', sub: 'chính thức', color: '#6366f1', bg: '#f8fafc', border: '#6366f1' },
                                        ].map(c => (
                                            <div key={c.label} style={{ background: c.bg, borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: `1.5px solid ${c.border}22` }}>
                                                <div style={{ width: '10px', height: '36px', borderRadius: '4px', background: c.border, flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{c.label}</div>
                                                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{c.sub}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── Merged Table ── */}
                                    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead style={{ background: '#f8fafc' }}>
                                                <tr>
                                                    <th style={{ padding: '11px 14px', textAlign: 'center', width: '40px' }}>
                                                        <input
                                                            type="checkbox"
                                                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                                            checked={selectedCalcIds.length > 0 && selectedCalcIds.length === payrolls.length + uncalculatedStaff.length}
                                                            onChange={e => setSelectedCalcIds(e.target.checked ? [...payrolls, ...uncalculatedStaff].map(s => s.staffId?._id || s._id) : [])}
                                                        />
                                                    </th>
                                                    {['Nhân viên', 'Giờ công', 'Lương giờ công', 'Hoa hồng', 'Ca đêm', 'Khấu trừ', 'Thực nhận', 'T.Thái', ''].map(h => (
                                                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Confirmed payrolls */}
                                                {payrolls
                                                    .filter(py => !searchQuery || py.staffId?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .sort((a, b) => {
                                                        const roleA = a.staffId?.role || '';
                                                        const roleB = b.staffId?.role || '';
                                                        if (roleA !== roleB) return roleA.localeCompare(roleB);
                                                        return (a.staffId?.fullName || '').localeCompare(b.staffId?.fullName || '', 'vi');
                                                    })
                                                    .map(py => {
                                                        const nm = py.note || '';
                                                        return (
                                                            <tr key={py._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                                                        checked={selectedCalcIds.includes(py.staffId?._id || py.staffId)}
                                                                        onChange={e => {
                                                                            const id = py.staffId?._id || py.staffId;
                                                                            setSelectedCalcIds(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '12px 14px' }}>
                                                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{py.staffId?.fullName}</div>
                                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{py.staffId?.role}</div>
                                                                </td>
                                                                <td style={{ padding: '12px 14px' }}>
                                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{py.workingDays || 0} n.công</div>
                                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{py.totalHoursWorked || nm.match(/[\d.]+h/)?.[0] || '0h'} làm việc</div>
                                                                </td>
                                                                <td style={{ padding: '12px 14px' }}>
                                                                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{py.baseSalary?.toLocaleString('vi-VN')}đ</div>
                                                                    <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                                                                        {py.hourlyRate > 0
                                                                            ? `${py.hourlyRate.toLocaleString('vi-VN')}đ/h`
                                                                            : (py.note?.match(/×\s*([\d.,]+)đ\/h/)?.[1]
                                                                                ? `${py.note.match(/×\s*([\d.,]+)đ\/h/)[1]}đ/h`
                                                                                : '—')
                                                                        }
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>{py.commissions > 0 ? `+${py.commissions?.toLocaleString('vi-VN')}đ` : '—'}</td>
                                                                <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#6366f1', fontWeight: 600 }}>{py.bonus > 0 ? `+${py.bonus?.toLocaleString('vi-VN')}đ` : '—'}</td>
                                                                <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#ef4444' }}>
                                                                    {py.deductions > 0 ? (
                                                                        <span title={nm.includes('Trễ') || nm.includes('Nghỉ') ? nm : ''}>−{py.deductions?.toLocaleString('vi-VN')}đ</span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{py.totalSalary?.toLocaleString('vi-VN')}đ</td>
                                                                <td style={{ padding: '12px 14px' }}>
                                                                    <span style={{ background: '#fef9c3', color: '#92400e', borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                        ✓ Đã chốt
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '8px 14px' }}>
                                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                                        <button onClick={() => setPayrollDetailModal(py)}
                                                                            style={{ padding: '5px 9px', borderRadius: '7px', border: '1px solid #d1fae5', background: '#ecfdf5', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700 }}
                                                                            title="Xem chi tiết bảng lương"
                                                                        >
                                                                            <Eye size={13} /> Chi tiết
                                                                        </button>
                                                                        <button onClick={() => handlePrintPayslip(py)} style={{ padding: '5px', borderRadius: '7px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }} title="In phiếu lương"><Printer size={13} /></button>
                                                                        <button onClick={() => handleOpenEditPayroll(py)} style={{ padding: '5px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }} title="Điều chỉnh"><Pencil size={13} /></button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                {/* Chưa tính lương */}
                                                {uncalculatedStaff
                                                    .filter(s => !searchQuery || s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .sort((a, b) => {
                                                        const roleA = a.role || '';
                                                        const roleB = b.role || '';
                                                        if (roleA !== roleB) return roleA.localeCompare(roleB);
                                                        return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
                                                    })
                                                    .map((s, i) => (
                                                        <tr key={`u${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                                                    checked={selectedCalcIds.includes(s._id)}
                                                                    onChange={e => {
                                                                        setSelectedCalcIds(prev => e.target.checked ? [...prev, s._id] : prev.filter(x => x !== s._id));
                                                                    }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '12px 14px' }}>
                                                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{s.fullName}</div>
                                                                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.role}</div>
                                                            </td>
                                                            <td colSpan={6} style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                                                                Chưa có dữ liệu lương. Vui lòng bấm "Tính lương" để tạo.
                                                            </td>
                                                            <td style={{ padding: '12px 14px' }}>
                                                                <span style={{ background: '#fefce8', color: '#b45309', borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                    ⚠️ Chưa tính
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '8px 14px' }}>
                                                                <button
                                                                    onClick={() => calculateSinglePayroll(s._id)}
                                                                    disabled={submitLoading}
                                                                    style={{ padding: '5px 9px', borderRadius: '7px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}
                                                                >
                                                                    <RefreshCw size={13} className={submitLoading ? 'animate-spin' : ''} /> Tính lương
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {payrolls.length === 0 && uncalculatedStaff.length === 0 && (
                                                    <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                        Chưa có dữ liệu lương tháng này
                                                    </td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </> /* end !payrollLoading */}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* MODALS */}

            {/* Modal chi tiết bảng lương — render qua Portal ra document.body */}
            {payrollDetailModal && createPortal(
                <PayrollDetailModal
                    py={payrollDetailModal}
                    onClose={() => setPayrollDetailModal(null)}
                    onPrint={handlePrintPayslip}
                    onConfirm={doGeneratePayrollForOne}
                    submitLoading={submitLoading}
                />,
                document.body
            )}



            {isStaffModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="modal-container glass-card">
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 700 }}>
                                    {editingStaffId ? 'Sửa hồ sơ' : 'Thêm nhân viên'}
                                </h3>
                            </div>
                            <button className="btn-icon" onClick={() => setIsStaffModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form className="modal-body" onSubmit={handleCreateStaff} style={{ flex: 1 }}>
                            {errorMsg && (
                                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', border: '1px solid #fecaca' }}>
                                    {errorMsg}
                                </div>
                            )}

                            {/* Bước 1: Thông tin cơ bản */}
                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px dashed #cbd5e1', width: '100%', boxSizing: 'border-box' }}>
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
                                    Bước 1: Thông tin tài khoản
                                </h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Số điện thoại / Zalo *</label>
                                        <input className="input-field" name="phoneNumber" value={formData.phoneNumber} placeholder="Số điện thoại đăng nhập" onChange={handleInputChange} required />
                                    </div>
                                    <div className="form-group">
                                        <label>{editingStaffId ? 'Mật khẩu mới' : 'Mật khẩu đăng nhập *'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input type={showPassword ? "text" : "password"} name="password" value={formData.password} className="input-field" placeholder={editingStaffId ? "Để trống nếu giữ cũ" : "Mật khẩu tối thiểu 6 ký tự"} onChange={handleInputChange} required={!editingStaffId} style={{ paddingRight: '40px' }} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Hiển thị mật khẩu">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '16px', borderBottom: '1px solid #eef2f5', paddingBottom: '8px', fontWeight: 700 }}>
                                Bước 2: Hồ sơ & Chế độ đãi ngộ
                            </h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Họ và tên nhân viên *</label>
                                    <input className="input-field" name="fullName" value={formData.fullName} placeholder="VD: Nguyễn Văn A" onChange={handleInputChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Chức vụ / Vai trò *</label>
                                    <select className="input-field" name="role" value={formData.role} onChange={handleInputChange}>
                                        <option value="RECEPTIONIST">Lễ Tân / Phụ Tá</option>
                                        <option value="DOCTOR">Bác Sĩ</option>
                                        <option value="GROOMER">Groomer</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label>Ngày vào làm</label>
                                <input type="date" className="input-field" name="hireDate" value={formData.hireDate} onChange={handleInputChange} />
                            </div>

                            <div className="modal-footer" style={{ border: 'none', padding: '12px 0 0 0' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsStaffModalOpen(false)}>Hủy Bỏ</button>
                                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                                    {submitLoading ? 'Đang xử lý...' : (editingStaffId ? 'Cập Nhật Hồ Sơ' : 'Lưu Hồ Sơ')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}

            {/* Modal Phân ca trực */}
            {isScheduleModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="modal-container glass-card">
                        <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 700 }}>{editingScheduleId ? 'Hiệu Chỉnh Lịch Trực' : 'Phân Ca Làm Việc'}</h3>
                            <button onClick={() => setIsScheduleModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                        </div>
                        <form className="modal-body" onSubmit={handleCreateSchedule} style={{ flex: 1 }}>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Nhân viên thực hiện *</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                                        <Stethoscope size={18} />
                                    </span>
                                    <select className="input-field" name="staffId" value={schedData.staffId} onChange={handleSchedChange} required style={{ width: '100%', paddingLeft: '40px' }}>
                                        <option value="">-- Chọn bác sĩ trực --</option>
                                        {staffList.filter(s => s.isActive !== false && s.role === 'DOCTOR').map(s => <option key={s._id} value={s._id}>{s.fullName}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Bổ sung nhân sự</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                                        <PlusCircle size={18} />
                                    </span>
                                    <select className="input-field" name="staffId" value={schedData.staffId} onChange={handleSchedChange} style={{ width: '100%', paddingLeft: '40px' }}>
                                        <option value="">-- Chọn nhân sự hỗ trợ --</option>
                                        {staffList.filter(s => s.isActive !== false && s.role !== 'DOCTOR').map(s => <option key={s._id} value={s._id}>{s.fullName}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Ngày trực *</label>
                                <input type="date" className="input-field" name="date" value={schedData.date} onChange={handleSchedChange} required style={{ width: '100%' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Ca trực ấn định *</label>
                                <input
                                    list="shift-presets"
                                    className="input-field"
                                    name="shift"
                                    value={schedData.shift}
                                    onChange={handleSchedChange}
                                    placeholder="VD: DAY, Sáng Chủ Nhật..."
                                    required
                                    style={{ width: '100%' }}
                                />
                                <datalist id="shift-presets">
                                    <option value="DAY">Ca Ngày (08:00 - 17:00)</option>
                                    <option value="EVENING">Ca Chiều Tối (14:00 - 21:00)</option>
                                    <option value="NIGHT">Ca Đêm / Cấp cứu (21:00 - 08:00)</option>
                                </datalist>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingTop: '24px', borderTop: '1px solid #eef2f5', marginTop: '32px' }}>
                                <button type="button" className="btn" style={{ background: '#f8fafc', color: 'var(--text-main)', border: '1px solid #eef2f5' }} onClick={() => setIsScheduleModalOpen(false)}>Hủy Bỏ</button>
                                <button type="submit" className="btn btn-primary" style={{ padding: '10px 32px' }} disabled={submitLoading}>
                                    {submitLoading ? 'Đang lưu...' : (editingScheduleId ? 'Cập Nhật Thay Đổi' : 'Lưu Lịch Trực')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}

            {/* Modal Đơn nghỉ phép */}
            {isLeaveModalOpen && createPortal(
                <div className="modal-overlay">
                    <div className="modal-container glass-card">
                        <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 700 }}>Đăng Ký Nghỉ Phép</h3>
                            <button onClick={() => setIsLeaveModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                        </div>
                        <form className="modal-body" onSubmit={handleCreateLeave} style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Từ ngày *</label>
                                    <input type="date" className="input-field" name="startDate" value={leaveData.startDate} onChange={handleLeaveChange} required style={{ width: '100%' }} />
                                </div>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Đến ngày *</label>
                                    <input type="date" className="input-field" name="endDate" value={leaveData.endDate} onChange={handleLeaveChange} required style={{ width: '100%' }} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Loại hình nghỉ *</label>
                                <select className="input-field" name="type" value={leaveData.type} onChange={handleLeaveChange} style={{ width: '100%' }}>
                                    <option value="PERSONAL">Nghỉ việc riêng</option>
                                    <option value="SICK">Nghỉ ốm / Điều trị</option>
                                    <option value="VACATION">Nghỉ phép năm (có lương)</option>
                                    <option value="UNPAID">Nghỉ không hưởng lương</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Ghi chú chi tiết</label>
                                <textarea className="input-field" name="reason" value={leaveData.reason} rows="3" placeholder="Lý do xin nghỉ cụ thể..." onChange={handleLeaveChange} style={{ resize: 'none', borderRadius: '12px', width: '100%' }}></textarea>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', paddingTop: '24px', borderTop: '1px solid #eef2f5', marginTop: '32px' }}>
                                <button type="button" className="btn" style={{ background: '#f8fafc', color: 'var(--text-main)', border: '1px solid #eef2f5' }} onClick={() => setIsLeaveModalOpen(false)}>Hủy Bỏ</button>
                                <button type="submit" className="btn btn-primary" style={{ padding: '10px 32px' }} disabled={submitLoading}>
                                    {submitLoading ? 'Đang gửi...' : 'Gửi Đơn Nghỉ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}

            {/* ===== Confirm Dialog ===== */}
            {confirmDialog && createPortal(
                <div className="modal-overlay">
                    <div className="modal-container glass-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                            {confirmDialog.dangerOnly ? '🚫' : confirmDialog.title?.includes('Cảnh Báo') ? '❌' : '⚠️'}
                        </div>
                        <h3 className="modal-title" style={{ marginBottom: '10px', color: confirmDialog.dangerOnly ? '#dc2626' : 'inherit' }}>
                            {confirmDialog.title}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '28px', whiteSpace: 'pre-line' }}>
                            {confirmDialog.message}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            {confirmDialog.dangerOnly ? (
                                <button className="btn btn-secondary" style={{ padding: '10px 28px' }}
                                    onClick={() => setConfirmDialog(null)}>
                                    Đóng
                                </button>
                            ) : (
                                <>
                                    <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Hủy</button>
                                    <button
                                        className="btn btn-primary"
                                        style={confirmDialog.title?.includes('Cảnh Báo') ? { background: '#dc2626', borderColor: '#dc2626' } : {}}
                                        onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }}
                                    >
                                        Xác nhận
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                , document.body)}


            {/* Toast Thông báo — góc trên bên phải, dưới thanh header */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    top: '80px',
                    right: '24px',
                    left: 'auto',
                    transform: 'none',
                    zIndex: 9999999,
                    padding: '14px 22px',
                    borderRadius: '14px',
                    background: 'white',
                    boxShadow: '0 20px 40px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: `1px solid ${toast.type === 'error' ? '#fecaca'
                            : toast.type === 'warning' ? '#fef3c7'
                                : toast.type === 'info' ? '#bfdbfe'
                                    : '#bbf7d0'
                        }`,
                    borderLeft: `6px solid ${toast.type === 'error' ? '#ef4444'
                            : toast.type === 'warning' ? '#7e22ce'
                                : toast.type === 'info' ? '#3b82f6'
                                    : '#22c55e'
                        }`,
                    animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    minWidth: '300px',
                    maxWidth: '420px',
                    pointerEvents: 'all'
                }}>
                    <style>{`
                    @keyframes toastSlideIn {
                        from { transform: translateX(48px); opacity: 0; }
                        to   { transform: translateX(0);    opacity: 1; }
                    }
                `}</style>
                    {toast.type === 'success' && <CheckCircle2 size={22} color="#22c55e" style={{ flexShrink: 0 }} />}
                    {toast.type === 'error' && <AlertCircle size={22} color="#ef4444" style={{ flexShrink: 0 }} />}
                    {toast.type === 'warning' && <AlertCircle size={22} color="#7e22ce" style={{ flexShrink: 0 }} />}
                    {toast.type === 'info' && <Loader2 size={22} color="#3b82f6" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />}

                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontWeight: 700,
                            color: toast.type === 'error' ? '#991b1b' : toast.type === 'warning' ? '#92400e' : '#166534',
                            fontSize: '0.9rem',
                            marginBottom: '2px'
                        }}>
                            {toast.type === 'success' ? '✅ Thành công'
                                : toast.type === 'error' ? '❌ Lỗi hệ thống'
                                    : toast.type === 'info' ? '⏳ Đang xử lý'
                                        : '⚠️ Thông báo'}
                        </div>
                        <div style={{ color: '#4b5563', fontSize: '0.83rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                            {toast.message}
                        </div>
                    </div>
                    <button
                        onClick={() => setToast({ ...toast, show: false })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', flexShrink: 0 }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
            {/* ===== Modal: Lịch Sử Hoạt Động ===== */}
            {isActivityLogOpen && activityLogUser && createPortal(
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="modal-container glass-card" style={{ width: '95%', maxWidth: '700px', padding: 0, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 700 }}>
                                    {(activityLogUser.fullName || '?').charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#4c1d95' }}>{activityLogUser.fullName}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#7c3aed' }}>Lịch sử hoạt động • Chỉ đọc</div>
                                </div>
                            </div>
                            <button onClick={() => setIsActivityLogOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Body — Timeline */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                            {activityLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <div className="animate-spin" style={{ width: '36px', height: '36px', border: '4px solid #ede9fe', borderTop: '4px solid #7c3aed', borderRadius: '50%' }} />
                                </div>
                            ) : activityLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                    <Activity size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                    <div>Chưa có hoạt động nào được ghi nhận.</div>
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    {/* Đường timeline dọc */}
                                    <div style={{ position: 'absolute', left: '19px', top: 0, bottom: 0, width: '2px', background: '#ede9fe' }} />

                                    {activityLogs.map((log, idx) => {
                                        const actionMeta = {
                                            // Lịch hẹn
                                            CANCEL_APPOINTMENT: { color: '#ef4444', bg: '#fef2f2', icon: '🚫', label: 'Hủy Lịch Hẹn' },
                                            COMPLETE_APPOINTMENT: { color: '#16a34a', bg: '#f0fdf4', icon: '✅', label: 'Hoàn Tất Ca' },
                                            ACCEPT_APPOINTMENT: { color: '#2563eb', bg: '#eff6ff', icon: '🩺', label: 'Nhận Ca' },
                                            CHECKIN_APPOINTMENT: { color: '#0891b2', bg: '#ecfeff', icon: '📍', label: 'Check-in' },
                                            CREATE_APPOINTMENT: { color: '#7e22ce', bg: '#f5f3ff', icon: '📅', label: 'Tạo Lịch Hẹn' },
                                            CREATE_EMERGENCY_APPT: { color: '#dc2626', bg: '#fff1f2', icon: '🚨', label: 'Tạo Ca Cấp Cứu' },
                                            UPDATE_APPOINTMENT: { color: '#64748b', bg: '#f8fafc', icon: '🔄', label: 'Cập Nhật Lịch Hẹn' },
                                            ASSIGN_STAFF: { color: '#7c3aed', bg: '#f5f3ff', icon: '👤', label: 'Phân Công NV' },
                                            // Khách hàng
                                            CREATE_CUSTOMER: { color: '#7e22ce', bg: '#f5f3ff', icon: '🙋', label: 'Tạo Khách Mới' },
                                            UPDATE_CUSTOMER_PROFILE: { color: '#0891b2', bg: '#ecfeff', icon: '✏️', label: 'Cập Nhật KH' },
                                            CONVERT_EMERGENCY: { color: '#7c3aed', bg: '#f5f3ff', icon: '🚑', label: 'Xác Nhận Cấp Cứu' },
                                            // Nhân viên
                                            CREATE_STAFF: { color: '#16a34a', bg: '#f0fdf4', icon: '👔', label: 'Tạo Nhân Viên' },
                                            UPDATE_STAFF_PROFILE: { color: '#2563eb', bg: '#eff6ff', icon: '👤', label: 'Sửa Hồ Sơ NV' },
                                            UPDATE_USER: { color: '#64748b', bg: '#f8fafc', icon: '🔧', label: 'Cập Nhật User' },
                                            DEACTIVATE_USER: { color: '#ef4444', bg: '#fef2f2', icon: '🔒', label: 'Vô Hiệu Hóa' },
                                            // Thú cưng
                                            CREATE_PET: { color: '#ec4899', bg: '#fdf2f8', icon: '🐾', label: 'Tạo Thú Cưng' },
                                            UPDATE_PET: { color: '#a855f7', bg: '#faf5ff', icon: '🐕', label: 'Cập Nhật Thú Cưng' },
                                            DELETE_PET: { color: '#6b7280', bg: '#f9fafb', icon: '🗂️', label: 'Ẩn Thú Cưng' },
                                            // Hóa đơn
                                            CREATE_INVOICE: { color: '#16a34a', bg: '#f0fdf4', icon: '🧾', label: 'Tạo Hóa Đơn' },
                                            // Bệnh án
                                            CREATE_MEDICAL_RECORD: { color: '#0891b2', bg: '#ecfeff', icon: '📋', label: 'Tạo Bệnh Án' },
                                            CREATE_EMERGENCY: { color: '#dc2626', bg: '#fff1f2', icon: '🚨', label: 'Hồ Sơ Cấp Cứu' },
                                            // Grooming
                                            CREATE_GROOMING_ORDER: { color: '#ec4899', bg: '#fdf2f8', icon: '✂️', label: 'Tạo Đơn Grooming' },
                                            GROOMING_CHECKIN: { color: '#7e22ce', bg: '#f5f3ff', icon: '📸', label: 'Check-in Grooming' },
                                            GROOMING_CHECKOUT: { color: '#16a34a', bg: '#f0fdf4', icon: '🎉', label: 'Checkout Grooming' },
                                            // Kho / Thuốc
                                            CREATE_MEDICINE: { color: '#0891b2', bg: '#ecfeff', icon: '💊', label: 'Nhập Thuốc Mới' },
                                            UPDATE_MEDICINE: { color: '#64748b', bg: '#f8fafc', icon: '🔄', label: 'Cập Nhật Kho' },
                                            DELETE_MEDICINE: { color: '#ef4444', bg: '#fef2f2', icon: '🗑️', label: 'Xóa Thuốc' },
                                            BULK_IMPORT_MEDICINES: { color: '#2563eb', bg: '#eff6ff', icon: '📦', label: 'Nhập Hàng Loạt' },
                                            BULK_DELETE_MEDICINES: { color: '#ef4444', bg: '#fef2f2', icon: '🗑️', label: 'Xóa Hàng Loạt' },
                                            // Dịch vụ
                                            CREATE_SERVICE: { color: '#7c3aed', bg: '#f5f3ff', icon: '🛎️', label: 'Tạo Dịch Vụ' },
                                            UPDATE_SERVICE: { color: '#64748b', bg: '#f8fafc', icon: '✏️', label: 'Cập Nhật DV' },
                                            DELETE_SERVICE: { color: '#ef4444', bg: '#fef2f2', icon: '🚫', label: 'Xóa Dịch Vụ' },
                                            // Danh mục sản phẩm
                                            CREATE_PRODUCT: { color: '#0891b2', bg: '#ecfeff', icon: '📦', label: 'Tạo Danh Mục' },
                                            UPDATE_PRODUCT: { color: '#64748b', bg: '#f8fafc', icon: '🏷️', label: 'Sửa Danh Mục' },
                                            DELETE_PRODUCT: { color: '#ef4444', bg: '#fef2f2', icon: '🗑️', label: 'Xóa Danh Mục' },
                                            // Lịch trực
                                            CREATE_SCHEDULE: { color: '#2563eb', bg: '#eff6ff', icon: '🗓️', label: 'Thêm Lịch Trực' },
                                            UPDATE_SCHEDULE: { color: '#64748b', bg: '#f8fafc', icon: '📝', label: 'Sửa Lịch Trực' },
                                            DELETE_SCHEDULE: { color: '#ef4444', bg: '#fef2f2', icon: '🗑️', label: 'Xóa Lịch Trực' },
                                            // Nghỉ phép
                                            CREATE_LEAVE_REQUEST: { color: '#7e22ce', bg: '#f5f3ff', icon: '🏖️', label: 'Xin Nghỉ Phép' },
                                            APPROVE_LEAVE: { color: '#16a34a', bg: '#f0fdf4', icon: '✅', label: 'Duyệt Nghỉ Phép' },
                                            REJECT_LEAVE: { color: '#ef4444', bg: '#fef2f2', icon: '❌', label: 'Từ Chối NP' },
                                            // Bảng lương
                                            GENERATE_PAYROLL: { color: '#7c3aed', bg: '#f5f3ff', icon: '💰', label: 'Chốt Bảng Lương' },
                                            UPDATE_PAYROLL: { color: '#64748b', bg: '#f8fafc', icon: '✏️', label: 'Sửa Bảng Lương' },
                                            MARK_PAYROLL_PAID: { color: '#16a34a', bg: '#f0fdf4', icon: '💳', label: 'Đã Thanh Toán Lương' },
                                            // Cấu hình HRM
                                            UPDATE_HRM_CONFIG: { color: '#7c3aed', bg: '#f5f3ff', icon: '⚙️', label: 'Cập Nhật Cấu Hình' },
                                            // Đăng nhập
                                            LOGIN: { color: '#64748b', bg: '#f8fafc', icon: '🔐', label: 'Đăng Nhập' },
                                        };
                                        const meta = actionMeta[log.action] || { color: '#94a3b8', bg: '#f8fafc', icon: '⚡', label: log.action };
                                        const dt = new Date(log.createdAt);
                                        const dtStr = dt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

                                        return (
                                            <div key={log._id} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                                                {/* Dot */}
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: meta.bg, border: `2px solid ${meta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, zIndex: 1 }}>
                                                    {meta.icon}
                                                </div>
                                                {/* Card */}
                                                <div style={{ flex: 1, background: meta.bg, border: `1px solid ${meta.color}20`, borderRadius: '12px', padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.85rem' }}>{meta.label}</span>
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>{dtStr}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.88rem', color: '#475569', marginTop: '4px' }}>{log.description}</div>
                                                    {/* Lý do hủy nổi bật */}
                                                    {log.action === 'CANCEL_APPOINTMENT' && log.metadata?.cancelReason && (
                                                        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fef2f2', borderLeft: '3px solid #ef4444', borderRadius: '6px', fontSize: '0.83rem', color: '#991b1b' }}>
                                                            📝 Lý do: <strong>{log.metadata.cancelReason}</strong>
                                                        </div>
                                                    )}
                                                    {log.metadata?.oldStatus && (
                                                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                            Trạng thái: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px' }}>{log.metadata.oldStatus}</code>
                                                            {log.metadata.newStatus && <> → <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px' }}>{log.metadata.newStatus}</code></>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef2f5', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                Tổng: {activityLogs.length} hoạt động • Chỉ Admin đọc được
                            </span>
                            <button className="btn btn-secondary" onClick={() => setIsActivityLogOpen(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
                , document.body)}
            {/* Modal Điều Chỉnh Lương Thủ Công (Bonus/Deductions) */}
            {isEditPayrollModalOpen && selectedPayroll && (
                <div className="modal-overlay" style={{ zIndex: 5000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 800 }}>Điều Chỉnh Thu Nhập</h3>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedPayroll.staffId?.fullName} — Th{selectedPayroll.month}/{selectedPayroll.year}</p>
                            </div>
                            <button onClick={() => setIsEditPayrollModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSavePayrollAdjustment} style={{ padding: '24px' }}>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Thưởng thêm / Phụ cấp khác (đ)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={editPayrollData.bonus}
                                    onChange={e => setEditPayrollData({ ...editPayrollData, bonus: e.target.value })}
                                    style={{ width: '100%', borderColor: '#10b981' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Khoản khấu trừ / Phạt (đ)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={editPayrollData.deductions}
                                    onChange={e => setEditPayrollData({ ...editPayrollData, deductions: e.target.value })}
                                    style={{ width: '100%', borderColor: '#ef4444' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>* Bao gồm: Nghỉ không lương, đi trễ, mắc lỗi...</p>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Ghi chú lý do</label>
                                <textarea
                                    className="input-field"
                                    value={editPayrollData.note}
                                    onChange={e => setEditPayrollData({ ...editPayrollData, note: e.target.value })}
                                    placeholder="Lý do điều chỉnh (VD: Đi trễ 3 buổi, Thưởng nóng dự án...)"
                                    rows="3"
                                    style={{ width: '100%', resize: 'none' }}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsEditPayrollModalOpen(false)}>Hủy</button>
                                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                                    {submitLoading ? 'Đang lưu...' : 'Cập Nhật'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isBulkScheduleModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container glass-card" style={{ maxWidth: '600px' }}>
                        <div className="flex-between" style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '12px', color: '#7c3aed' }}>
                                    <ClipboardList size={24} />
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Phân Ca Hàng Loạt</h2>
                            </div>
                            <button onClick={() => setIsBulkScheduleModalOpen(false)} className="btn-icon"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleBulkSchedule}>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>Chọn nhân viên thực hiện <span style={{ color: '#ef4444' }}>*</span></label>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button type="button" onClick={() => setBulkSchedData({ ...bulkSchedData, staffIds: staffList.map(s => s._id) })} style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}>Tất cả</button>
                                        <button type="button" onClick={() => setBulkSchedData({ ...bulkSchedData, staffIds: staffList.filter(s => s.role === 'DOCTOR').map(s => s._id) })} style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}>Bác sĩ</button>
                                        <button type="button" onClick={() => setBulkSchedData({ ...bulkSchedData, staffIds: [] })} style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}>Bỏ chọn</button>
                                    </div>
                                </div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    {staffList.map(s => (
                                        <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <input
                                                type="checkbox"
                                                id={`staff-${s._id}`}
                                                checked={bulkSchedData.staffIds.includes(s._id)}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...bulkSchedData.staffIds, s._id]
                                                        : bulkSchedData.staffIds.filter(id => id !== s._id);
                                                    setBulkSchedData({ ...bulkSchedData, staffIds: newIds });
                                                }}
                                            />
                                            <label htmlFor={`staff-${s._id}`} style={{ cursor: 'pointer', flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.fullName}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.role}</div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>Từ ngày <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input
                                        className="form-control"
                                        type="date"
                                        required
                                        value={bulkSchedData.startDate}
                                        onChange={(e) => setBulkSchedData({ ...bulkSchedData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>Đến ngày <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input
                                        className="form-control"
                                        type="date"
                                        required
                                        value={bulkSchedData.endDate}
                                        onChange={(e) => setBulkSchedData({ ...bulkSchedData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>Ca trực áp dụng <span style={{ color: '#ef4444' }}>*</span></label>
                                <select
                                    className="form-control"
                                    required
                                    value={bulkSchedData.shift}
                                    onChange={(e) => setBulkSchedData({ ...bulkSchedData, shift: e.target.value })}
                                >
                                    <option value="DAY">CA NGÀY (DAY)</option>
                                    <option value="EVENING">CA CHIỀU (EVENING)</option>
                                    <option value="NIGHT">CA ĐÊM (NIGHT)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsBulkScheduleModalOpen(false)}>Hủy</button>
                                <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                                    {submitLoading ? 'Đang phân ca...' : 'Lưu Danh Sách Ca'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <AttendanceHistoryModal
                isOpen={isAttendanceHistoryOpen}
                onClose={() => setIsAttendanceHistoryOpen(false)}
                user={activityLogUser}
                logs={attendanceLogs}
                loading={activityLoading}
            />

            {/* Modal Xem Trước Thay Đổi Lịch Trực */}
            {isPreviewSyncOpen && createPortal(
                <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setIsPreviewSyncOpen(false)}>
                    <div className="modal-container glass-card" style={{ width: '95%', maxWidth: '680px', padding: 0, overflow: 'visible', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{
                            padding: '24px 24px',
                            borderBottom: '1px solid #e2e8f0',
                            background: 'linear-gradient(135deg, #f5f3ff, #fef3c7)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTopLeftRadius: '24px',
                            borderTopRightRadius: '24px',
                            position: 'relative'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.2 }}>
                                    ⚠️ Xác nhận lưu thay đổi
                                    <span style={{ background: '#7e22ce', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>
                                        {syncDiff.length} thay đổi
                                    </span>
                                </h3>
                                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#b45309', fontWeight: 500 }}>
                                    Xem lại và hoàn tác từng thay đổi nếu cần trước khi lưu vĩnh viễn.
                                </p>
                            </div>
                            <button onClick={() => setIsPreviewSyncOpen(false)} style={{ background: 'rgba(146, 64, 14, 0.1)', border: 'none', cursor: 'pointer', color: '#92400e', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>✕</button>
                        </div>

                        {/* Diff list với nút hoàn tác từng dòng */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                            {syncDiff.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: '#16a34a', fontWeight: 700 }}>
                                    ✅ Đã hoàn tác tất cả thay đổi!
                                </div>
                            ) : (() => {
                                // Nhóm theo ngày
                                const groupedByDate = {};
                                syncDiff.forEach(d => {
                                    if (!groupedByDate[d.dateKey]) groupedByDate[d.dateKey] = [];
                                    groupedByDate[d.dateKey].push(d);
                                });

                                const SHIFT_LABEL = { DAY: 'Ca Ngày', EVENING: 'Chiều Tối', NIGHT: 'Ca Đêm' };

                                return Object.keys(groupedByDate).sort().map(dateKey => {
                                    const changes = groupedByDate[dateKey];
                                    const dateFormatted = new Date(dateKey + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });

                                    // Phân tích Action -> Shift -> Array of Staff Names
                                    const actions = []; // { type: 'ADD'|'REMOVE', shift: 'DAY', staffs: [] }
                                    changes.forEach(d => {
                                        d.added.forEach(s => {
                                            let act = actions.find(a => a.type === 'ADD' && a.shift === s);
                                            if (!act) { act = { type: 'ADD', shift: s, staffs: [] }; actions.push(act); }
                                            act.staffs.push(d.staffName);
                                        });
                                        d.removed.forEach(s => {
                                            let act = actions.find(a => a.type === 'REMOVE' && a.shift === s);
                                            if (!act) { act = { type: 'REMOVE', shift: s, staffs: [] }; actions.push(act); }
                                            act.staffs.push(d.staffName);
                                        });
                                    });

                                    // Sort actions: ADD first, then REMOVE, then by shift
                                    actions.sort((a, b) => {
                                        if (a.type !== b.type) return a.type === 'ADD' ? -1 : 1;
                                        const shiftOrder = { DAY: 1, EVENING: 2, NIGHT: 3 };
                                        return shiftOrder[a.shift] - shiftOrder[b.shift];
                                    });

                                    const handleUndoDate = () => {
                                        setScheduleGrid(prev => {
                                            const next = { ...prev };
                                            changes.forEach(d => {
                                                const savedShifts = savedScheduleGrid[d.staffId]?.[dateKey] || [];
                                                if (!next[d.staffId]) next[d.staffId] = {};
                                                if (savedShifts.length === 0) { delete next[d.staffId][dateKey]; }
                                                else { next[d.staffId][dateKey] = [...savedShifts]; }
                                            });
                                            return next;
                                        });
                                        setSyncDiff(prev => prev.filter(d => d.dateKey !== dateKey));
                                    };

                                    return (
                                        <div key={dateKey} style={{ marginBottom: '16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                                                    📅 {dateFormatted}
                                                </div>
                                                <button
                                                    onClick={handleUndoDate}
                                                    title={`Hoàn tác tất cả thay đổi trong ngày ${dateFormatted}`}
                                                    style={{ border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    ↩ Hoàn tác ngày này
                                                </button>
                                            </div>
                                            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {actions.map((act, idx) => {
                                                    const isAdd = act.type === 'ADD';
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                            <div style={{ flexShrink: 0, width: '90px' }}>
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    background: isAdd ? '#dcfce7' : '#fee2e2',
                                                                    color: isAdd ? '#16a34a' : '#dc2626',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.7rem',
                                                                    padding: '4px 8px',
                                                                    borderRadius: '6px',
                                                                    textDecoration: isAdd ? 'none' : 'line-through'
                                                                }}>
                                                                    {isAdd ? '+' : '−'} {SHIFT_LABEL[act.shift]}
                                                                </span>
                                                            </div>
                                                            <div style={{ flex: 1, fontSize: '0.85rem', color: '#334155', fontWeight: 600, lineHeight: 1.5, paddingTop: '2px' }}>
                                                                {act.staffs.join(', ')}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>


                        {/* Footer actions */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#fafafa' }}>
                            {/* Hoàn tác tất cả */}
                            <button
                                onClick={() => {
                                    // Reset scheduleGrid về savedScheduleGrid
                                    setScheduleGrid(JSON.parse(JSON.stringify(savedScheduleGrid)));
                                    setSyncDiff([]);
                                }}
                                style={{ padding: '10px 16px', borderRadius: '10px', border: '1.5px solid #fbbf24', background: '#f5f3ff', color: '#d97706', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                ↩ Hoàn tác tất cả
                            </button>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setIsPreviewSyncOpen(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                                    Đóng
                                </button>
                                <button
                                    onClick={handleSyncScheduleGrid}
                                    disabled={submitLoading || syncDiff.length === 0}
                                    style={{ padding: '10px 24px', borderRadius: '10px', background: syncDiff.length === 0 ? '#94a3b8' : 'var(--primary)', color: 'white', fontWeight: 700, border: 'none', cursor: syncDiff.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Save size={16} /> {submitLoading ? 'Đang lưu...' : `Lưu ${syncDiff.length} thay đổi`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}



            {/* ── Modal duyệt FaceID nhân viên ── */}
            {faceApprovalModal && (
                <FaceApprovalModal
                    staffInfo={faceApprovalModal.staff}
                    onClose={() => { setFaceApprovalModal(null); setFaceAnalysis(null); }}
                    onApprove={handleApproveFace}
                    onReject={handleRejectFace}
                    loading={faceApprovalLoading}
                    API={API}
                    authHeader={authHeader}
                />
            )}
        </Layout>
    );
};

// Modal Chấm Công tách rời
const AttendanceHistoryModal = ({ isOpen, onClose, user, logs, loading }) => {
    if (!isOpen || !user) return null;
    return (
        <div className="modal-overlay" style={{ zIndex: 4000 }}>
            <div className="modal-container glass-card" style={{ width: '95%', maxWidth: '800px', padding: 0, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #ecfeff, #cffafe)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 700 }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#164e63' }}>Nhật ký Chấm công: {user.fullName}</div>
                            <div style={{ fontSize: '0.8rem', color: '#0891b2' }}>Dữ liệu FaceID & GPS thực tế</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0891b2' }}>
                        <X size={22} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <div className="animate-spin" style={{ width: '36px', height: '36px', border: '4px solid #f0f9ff', borderTop: '4px solid #0891b2', borderRadius: '50%' }} />
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <Clock size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <div>Nhân viên chưa có dữ liệu chấm công cho kỳ này.</div>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f8fafc', fontSize: '0.75rem', color: '#64748b' }}>
                                    <tr>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>NGÀY</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>CHECK-IN</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>CHECK-OUT</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>TRẠNG THÁI</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>ẢNH ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px', fontWeight: 600 }}>{new Date(log.date).toLocaleDateString('vi-VN')}</td>
                                            <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                                <div>{log.checkIn?.time ? new Date(log.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                                                {log.checkIn?.location?.lat && (
                                                    <a href={`https://maps.google.com/?q=${log.checkIn.location.lat},${log.checkIn.location.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }} title="Xem vị trí Check-in">
                                                        📍 GPS
                                                    </a>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                                <div>{log.checkOut?.time ? new Date(log.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                                                {log.checkOut?.location?.lat && (
                                                    <a href={`https://maps.google.com/?q=${log.checkOut.location.lat},${log.checkOut.location.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }} title="Xem vị trí Check-out">
                                                        📍 GPS
                                                    </a>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span className={`badge ${log.checkOut?.isAuto ? 'badge-danger' : log.status === 'PRESENT' ? 'badge-success' : log.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                                    {log.checkOut?.isAuto ? 'Quên Checkout (Lỗi)' : log.status === 'PRESENT' ? 'Đúng giờ' : log.status === 'LATE' ? `Trễ ${log.checkIn?.lateMinutes}p` : log.status === 'ABSENT' ? 'Vắng mặt' : log.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {log.checkIn?.photo ? (
                                                    <img
                                                        src={log.checkIn.photo}
                                                        alt="FaceID"
                                                        style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                        onClick={() => window.open(log.checkIn.photo)}
                                                    />
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #eef2f5', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default Staff;

// ══════════════════════════════════════════════════════════
// FaceApprovalModal — Modal duyệt FaceID với AI phân tích
// ══════════════════════════════════════════════════════════
const FaceApprovalModal = ({ staffInfo, onClose, onApprove, onReject, loading, API, authHeader }) => {
    const [detail, setDetail] = React.useState(null);
    const [fetchLoading, setFetchLoading] = React.useState(true);
    const [analysis, setAnalysis] = React.useState(null);
    const [analysisLoading, setAnalysisLoading] = React.useState(false);
    const [faceApiError, setFaceApiError] = React.useState(null);

    // Fetch đầy đủ data (kể cả pendingFacePhoto base64) khi modal mở
    React.useEffect(() => {
        const fetchDetail = async () => {
            setFetchLoading(true);
            try {
                const res = await axios.get(`${API}/users/${staffInfo._id}/face-reset-detail`, { headers: authHeader() });
                if (res.data.success) setDetail(res.data.data);
            } catch (e) {
                setDetail(staffInfo); // fallback
            } finally {
                setFetchLoading(false);
            }
        };
        fetchDetail();
    }, [staffInfo._id]);

    // Auto phân tích khi cả 2 ảnh đã có
    React.useEffect(() => {
        const pending = detail?.faceResetRequest?.pendingFacePhoto;
        const current = detail?.verificationPhoto;
        if (!pending || !current || analysisLoading || analysis) return;
        runFaceAnalysis(current, pending);
    }, [detail]);

    const runFaceAnalysis = async (img1Src, img2Src) => {
        setAnalysisLoading(true);
        setFaceApiError(null);
        try {
            // Load models từ /weights (đã tải sẵn)
            await loadFaceModels();

            const loadImg = (src) => new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Không load được ảnh'));
                img.src = src;
            });

            const [img1, img2] = await Promise.all([loadImg(img1Src), loadImg(img2Src)]);

            const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
            const [d1, d2] = await Promise.all([
                faceapi.detectSingleFace(img1, opts).withFaceLandmarks().withFaceDescriptor(),
                faceapi.detectSingleFace(img2, opts).withFaceLandmarks().withFaceDescriptor()
            ]);

            if (!d1 || !d2) {
                setFaceApiError(!d1
                    ? 'Không nhận diện được khuôn mặt trong ảnh HIỆN TẠI.'
                    : 'Không nhận diện được khuôn mặt trong ảnh MỚI. Ảnh có thể bị mờ hoặc thiếu sáng.');
                setAnalysisLoading(false);
                return;
            }

            // Euclidean: < 0.38 = cùng người, 0.38-0.55 = có thể, > 0.55 = khác người
            const dist = faceapi.euclideanDistance(d1.descriptor, d2.descriptor);
            const pct = Math.round(Math.max(0, (1 - dist / 0.8)) * 100);

            let label, color, bg, rec;
            if (dist < 0.38) {
                label = 'Cùng người — Khớp tốt';
                color = '#16a34a'; bg = '#dcfce7';
                rec = 'Có thể duyệt ngay. Khuôn mặt nhất quán với ảnh cũ.';
            } else if (dist < 0.55) {
                label = 'Có thể là cùng người';
                color = '#d97706'; bg = '#fef3c7';
                rec = 'Xem xét kỹ trước khi duyệt. Độ sáng hoặc góc chụp có thể ảnh hưởng đến kết quả.';
            } else {
                label = 'Có thể khác người';
                color = '#dc2626'; bg = '#fee2e2';
                rec = 'Nên từ chối. Khuôn mặt khác biệt đáng kể — có thể ảnh sai người.';
            }

            setAnalysis({ score: pct, dist: dist.toFixed(3), label, color, bg, rec });
        } catch (err) {
            setFaceApiError(`Lỗi phân tích: ${err.message}`);
        } finally {
            setAnalysisLoading(false);
        }
    };

    const pendingPhoto = detail?.faceResetRequest?.pendingFacePhoto;
    const currentPhoto = detail?.verificationPhoto;
    const reason = detail?.faceResetRequest?.reason || staffInfo.faceResetRequest?.reason || '';

    return (
        <div className="modal-overlay" style={{ zIndex: 6000 }}>
            <div className="modal-container glass-card" style={{ maxWidth: '620px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ScanFace size={20} color="#fff" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Duyệt Yêu Cầu Cập Nhật FaceID</div>
                            <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 600 }}>
                                {staffInfo.fullName}{reason ? ` — "${reason}"` : ''}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {fetchLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px', color: '#64748b' }}>
                            <div style={{ width: '36px', height: '36px', border: '4px solid #f0f9ff', borderTop: '4px solid #0891b2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '0.85rem' }}>Đang tải dữ liệu ảnh...</span>
                        </div>
                    ) : (
                        <>
                            {/* Ảnh so sánh */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '6px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ảnh FaceID Hiện Tại</p>
                                    <div style={{ width: '100%', aspectRatio: '4/5', borderRadius: '12px', overflow: 'hidden', background: '#1e293b', border: '2px solid #e2e8f0' }}>
                                        {currentPhoto ? (
                                            <img src={currentPhoto} alt="Hiện tại"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                                                onClick={() => window.open(currentPhoto)}
                                            />
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem', flexDirection: 'column', gap: '8px' }}>
                                                <ScanFace size={32} style={{ opacity: 0.3 }} />
                                                <span>Chưa có ảnh</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <p style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '6px', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ảnh Mới (Chờ Duyệt)</p>
                                    <div style={{ width: '100%', aspectRatio: '4/5', borderRadius: '12px', overflow: 'hidden', background: '#1e293b', border: '2px solid #fed7aa' }}>
                                        {pendingPhoto ? (
                                            <img src={pendingPhoto} alt="Ảnh mới"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                                                onClick={() => window.open(pendingPhoto)}
                                            />
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '12px', textAlign: 'center', flexDirection: 'column', gap: '8px' }}>
                                                <ScanFace size={32} style={{ opacity: 0.3 }} />
                                                <span>Nhân viên chưa đính kèm ảnh mới</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* AI Analysis */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <ScanFace size={15} color="#6366f1" />
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Phân Tích AI Khuôn Mặt</span>
                                    {currentPhoto && pendingPhoto && analysis && !analysisLoading && (
                                        <button
                                            onClick={() => { setAnalysis(null); runFaceAnalysis(currentPhoto, pendingPhoto); }}
                                            style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#6366f1', background: '#f0f0ff', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                                        >Phân tích lại</button>
                                    )}
                                </div>

                                {analysisLoading && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6366f1', fontSize: '0.82rem' }}>
                                        <div style={{ width: '18px', height: '18px', border: '3px solid #e0e7ff', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                                        Đang so sánh khuôn mặt bằng AI...
                                    </div>
                                )}

                                {faceApiError && (
                                    <div style={{ color: '#dc2626', fontSize: '0.8rem', background: '#fee2e2', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertCircle size={14} />
                                        <span style={{ flex: 1 }}>{faceApiError}</span>
                                        {currentPhoto && pendingPhoto && (
                                            <button onClick={() => { setFaceApiError(null); runFaceAnalysis(currentPhoto, pendingPhoto); }}
                                                style={{ fontSize: '0.72rem', color: '#dc2626', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Thử lại</button>
                                        )}
                                    </div>
                                )}

                                {analysis && (
                                    <div style={{ background: analysis.bg, border: `1.5px solid ${analysis.color}`, borderRadius: '10px', padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 700, color: analysis.color, fontSize: '0.88rem' }}>{analysis.label}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontWeight: 800, fontSize: '1.5rem', color: analysis.color }}>{analysis.score}%</span>
                                                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>tương đồng</span>
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: '999px', height: '6px', marginBottom: '8px' }}>
                                            <div style={{ width: `${analysis.score}%`, height: '6px', borderRadius: '999px', background: analysis.color, transition: 'width 1s ease' }} />
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#334155', fontWeight: 500 }}>{analysis.rec}</p>
                                    </div>
                                )}

                                {!currentPhoto && !pendingPhoto && !analysisLoading && (
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>Cần có cả 2 ảnh để thực hiện phân tích AI.</p>
                                )}
                                {!analysisLoading && !analysis && !faceApiError && currentPhoto && !pendingPhoto && (
                                    <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: 0 }}>Thiếu ảnh mới — không thể phân tích.</p>
                                )}
                            </div>

                            {!pendingPhoto && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '10px 14px' }}>
                                    <p style={{ margin: 0, color: '#92400e', fontSize: '0.8rem', fontWeight: 600 }}>
                                        Không thấy ảnh mới trong hệ thống. Nhân viên có thể chưa gửi ảnh hoặc gặp lỗi khi upload. Hãy nhắc họ thực hiện lại trong trang Hồ Sơ.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0 }}>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '5px' }}>
                            Lý do từ chối (tuỳ chọn — sẽ gửi thông báo cho nhân viên):
                        </label>
                        <RejectReasonInput onReject={onReject} loading={loading || fetchLoading}
                            onApprove={onApprove} pendingPhoto={!!pendingPhoto} analysis={analysis} />
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// Sub-component tách riêng để có state rejectReason và confirm dialog
const RejectReasonInput = ({ onReject, onApprove, loading, pendingPhoto, analysis }) => {
    const [reason, setReason] = React.useState('');
    const [showConfirm, setShowConfirm] = React.useState(false);
    const [confirmInput, setConfirmInput] = React.useState('');

    // Cảnh báo khi AI phân tích kết quả nghi ngờ (dist > 0.55 hoặc label chứa 'khác người')
    const isRiskyApproval = analysis && parseFloat(analysis.dist) > 0.55;

    const handleApproveClick = () => {
        if (isRiskyApproval) {
            setShowConfirm(true); // Hiện dialog xác nhận
        } else {
            onApprove(); // Duyệt bình thường nếu AI không cảnh báo
        }
    };

    const handleConfirmApprove = () => {
        if (confirmInput.trim().toUpperCase() === 'XAC NHAN') {
            setShowConfirm(false);
            setConfirmInput('');
            onApprove();
        }
    };

    return (
        <>
            <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="VD: Ảnh bị mờ, ảnh có nhiều người, ảnh không phải khuôn mặt thật..."
                rows={2}
                style={{
                    width: '100%', boxSizing: 'border-box',
                    border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    padding: '8px 12px', fontSize: '0.8rem', color: '#334155',
                    resize: 'none', outline: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5,
                    transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                    onClick={() => onReject(reason)}
                    disabled={loading}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #ef4444', background: '#fef2f2', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: loading ? 0.6 : 1 }}
                >
                    {loading ? 'Đang xử lý...' : 'Từ Chối'}
                </button>
                <button
                    onClick={handleApproveClick}
                    disabled={loading || !pendingPhoto}
                    style={{
                        flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                        background: !pendingPhoto || loading ? '#94a3b8'
                            : isRiskyApproval ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                                : 'linear-gradient(135deg, #0fa9ac, #0891b2)',
                        color: '#fff', fontWeight: 700,
                        cursor: pendingPhoto && !loading ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem'
                    }}
                >
                    {loading ? 'Đang duyệt...' : isRiskyApproval ? '⚠️ Duyệt (Cảnh Báo)' : 'Duyệt & Cập Nhật FaceID'}
                </button>
            </div>

            {/* Confirmation Dialog Overlay */}
            {showConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', padding: '28px 32px',
                        maxWidth: '420px', width: '90%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                        border: '3px solid #dc2626'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertCircle size={24} color="#dc2626" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Cảnh báo: AI phát hiện người khác</div>
                                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Kết quả phân tích: {analysis?.label} ({analysis?.score}% tương đồng)</div>
                            </div>
                        </div>

                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#92400e', lineHeight: 1.6 }}>
                                AI cho thấy ảnh mới <strong>có thể không phải cùng người</strong>. Nếu duyệt nhầm, nhân viên khác có thể đăng nhập thại khoản này.
                                <br /><br />
                                Để xác nhận muốn duyệt, gõ chử: <strong style={{ color: '#dc2626' }}>XAC NHAN</strong>
                            </p>
                        </div>

                        <input
                            value={confirmInput}
                            onChange={e => setConfirmInput(e.target.value)}
                            placeholder="Gõ XAC NHAN để tiếp tục..."
                            autoFocus
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                border: '2px solid ' + (confirmInput.trim().toUpperCase() === 'XAC NHAN' ? '#16a34a' : '#e2e8f0'),
                                borderRadius: '10px', padding: '10px 14px',
                                fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.05em',
                                color: '#0f172a', outline: 'none', marginBottom: '14px',
                                textTransform: 'uppercase'
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleConfirmApprove()}
                        />

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => { setShowConfirm(false); setConfirmInput(''); }}
                                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmApprove}
                                disabled={confirmInput.trim().toUpperCase() !== 'XAC NHAN'}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                                    background: confirmInput.trim().toUpperCase() === 'XAC NHAN' ? '#dc2626' : '#94a3b8',
                                    color: '#fff', fontWeight: 700,
                                    cursor: confirmInput.trim().toUpperCase() === 'XAC NHAN' ? 'pointer' : 'not-allowed',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Xác nhận duyệt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
