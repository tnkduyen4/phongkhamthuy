import React, { useState, useEffect, useRef } from 'react';
import {
    Calendar, Clock, Building, Plus, X, MapPin, RefreshCw,
    ChevronLeft, ChevronRight, CheckCircle2, XCircle,
    AlertTriangle, MinusCircle, Palmtree, Hourglass,
    LogIn, LogOut, FileText, ScanFace, ShieldCheck, ShieldX, Loader2
} from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createPortal } from 'react-dom';
import { API } from '../constants';
import { loadFaceModels, verifyFace } from '../utils/faceVerify';

// ── Constants ──────────────────────────────────────────────────────────────────
const SHIFTS = [
    { code: 'DAY', label: 'Ca Sáng', time: '08:00 – 12:00', color: '#f59e0b', bg: '#fffbeb' },
    { code: 'EVENING', label: 'Ca Chiều', time: '13:30 – 18:00', color: '#10b981', bg: '#f0fdf4' },
    { code: 'NIGHT', label: 'Ca Tối', time: '18:00 – 23:00', color: '#6366f1', bg: '#f5f3ff' },
];
const LEAVE_TYPE = {
    PERSONAL: 'Việc riêng',
    SICK: 'Nghỉ ốm',
    UNPAID: 'Không lương',
};
const STATUS_CFG = {
    PRESENT: { label: 'Có mặt', color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2 },
    LATE: { label: 'Đi trễ', color: '#d97706', bg: '#fffbeb', Icon: AlertTriangle },
    ABSENT: { label: 'Vắng', color: '#ef4444', bg: '#fef2f2', Icon: XCircle },
    ON_LEAVE: { label: 'Nghỉ phép', color: '#7c3aed', bg: '#f5f3ff', Icon: Palmtree },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const toDateStr = (d) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
};

// Giờ bắt đầu và kết thúc ca (giờ local) — phải khớp với ClinicConfig trong DB
const SHIFT_START = { DAY: 8, EVENING: 13, NIGHT: 18 };
const SHIFT_END = { DAY: 12, EVENING: 18, NIGHT: 23 };

const shiftStarted = (shiftCode) => {
    const startHour = SHIFT_START[shiftCode];
    if (startHour == null) return true;
    return new Date().getHours() >= startHour;
};
const shiftEnded = (shiftCode) => {
    const endHour = SHIFT_END[shiftCode];
    if (endHour == null) return false;
    return new Date().getHours() >= endHour;
};
const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d;
};
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

// Dot màu nhỏ thay emoji
const Dot = ({ color, size = 8 }) => (
    <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />
);

// ══════════════════════════════════════════════════════════════════════════════
const MySchedule = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('schedule');

    // Schedule tab
    const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [schedules, setSchedules] = useState([]);
    const [myLeaves, setMyLeaves] = useState([]);
    const [attMap, setAttMap] = useState({});
    const [myAttendance, setMyAttendance] = useState(null);
    const [loading, setLoading] = useState(true);

    // History tab
    const [attHistory, setAttHistory] = useState([]);
    const [histFilter, setHistFilter] = useState('ALL');
    const [histFrom, setHistFrom] = useState('');
    const [histTo, setHistTo] = useState('');
    const [histLoading, setHistLoading] = useState(false);

    // Leave modal
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);
    const [quickLeave, setQuickLeave] = useState(null); // { shiftLabel, dateStr } khi click từ ô ca
    const [submitLoading, setSubmitLoading] = useState(false);
    const [leaveData, setLeaveData] = useState({
        startDate: toDateStr(new Date()), endDate: toDateStr(new Date()), type: '', reason: ''
    });

    // Complaint modal
    const [isComplaintOpen, setIsComplaintOpen] = useState(false);
    const [complaintData, setComplaintData] = useState({ attendanceId: null, dateStr: '', shiftLabel: '', reason: '' });
    const [complaintAttachment, setComplaintAttachment] = useState(null);

    // Attendance modal
    const [isAttOpen, setIsAttOpen] = useState(false);
    const [attLoading, setAttLoading] = useState(false);
    const [attType, setAttType] = useState('IN');
    const [shiftId, setShiftId] = useState(null);
    // faceStatus: null | { phase: 'loading-models'|'verifying'|'done', result?: {success,score,message} }
    const [faceStatus, setFaceStatus] = useState(null);
    const [modelMsg, setModelMsg] = useState(null); // tin nhắn tiến trình tải model
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [captured, setCaptured] = useState(null);

    // Date range for schedule query
    const rangeStart = useCustom && customFrom ? new Date(customFrom) : weekStart;
    const rangeEnd = useCustom && customTo ? new Date(customTo) : addDays(weekStart, 6);

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem('token');
            const s = new Date(rangeStart); s.setHours(0, 0, 0, 0);
            const e = new Date(rangeEnd); e.setHours(23, 59, 59, 999);

            // Mở rộng ±1 ngày để bù timezone UTC+7 (giống Staff.jsx)
            s.setDate(s.getDate() - 1);
            e.setDate(e.getDate() + 1);

            const [scRes, attRes, leaveRes] = await Promise.all([
                axios.get(`${API}/hrm/schedules?staffId=${user._id}&startDate=${s.toISOString()}&endDate=${e.toISOString()}`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/attendance/my`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/hrm/leaves`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } }))
            ]);
            setSchedules(scRes.data.data || []);
            const ownLeaves = (leaveRes.data.data || []).filter(lv => (lv.staffId?._id || lv.staffId) === user._id);
            setMyLeaves(ownLeaves);
            const attList = attRes.data.data || [];
            const map = {};
            attList.forEach(a => { const id = a.scheduleId?._id || a.scheduleId; if (id) map[id] = a; });
            setAttMap(map);
            const todayStr = toDateStr(new Date());
            setMyAttendance(attList.find(a => a.date?.split('T')[0] === todayStr) || null);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchHistory = async () => {
        try {
            setHistLoading(true);
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`${API}/attendance/my`, { headers: { Authorization: `Bearer ${token}` } });
            setAttHistory((res.data.data || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
        } catch (err) { console.error(err); }
        finally { setHistLoading(false); }
    };

    useEffect(() => { if (user?._id) fetchSchedule(); }, [user, weekStart, useCustom, customFrom, customTo]);
    useEffect(() => { if (user?._id && activeTab === 'history') fetchHistory(); }, [user, activeTab]);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const getLeaveForDate = (dateStr) =>
        myLeaves.find(lv => dateStr >= lv.startDate?.split('T')[0] && dateStr <= lv.endDate?.split('T')[0]);

    const weekDays = useCustom && customFrom
        ? (() => {
            const days = []; let cur = new Date(customFrom);
            const end = new Date(customTo || customFrom);
            while (cur <= end) { days.push(new Date(cur)); cur = addDays(cur, 1); }
            return days;
        })()
        : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // History filter
    const filteredHistory = attHistory.filter(a => {
        const dateStr = a.date?.split('T')[0] || '';
        if (histFrom && dateStr < histFrom) return false;
        if (histTo && dateStr > histTo) return false;
        if (histFilter !== 'ALL' && a.status !== histFilter) return false;
        return true;
    });

    // ── Leave handlers ─────────────────────────────────────────────────────────
    const handleLeaveChange = (e) => setLeaveData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleCreateLeave = async (e) => {
        e.preventDefault(); setSubmitLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API}/hrm/leaves`, { ...leaveData, staffId: user._id }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { showToast('Gửi đơn xin nghỉ thành công!', 'success'); setIsLeaveOpen(false); fetchSchedule(); }
        } catch (err) { showToast(err.response?.data?.message || 'Lỗi gửi đơn', 'error'); }
        finally { setSubmitLoading(false); }
    };

    const handleComplaintSubmit = async (e) => {
        e.preventDefault(); setSubmitLoading(true);
        if(!complaintData.reason.trim()) {
            showToast('Vui lòng nhập lý do khiếu nại', 'error');
            setSubmitLoading(false);
            return;
        }
        try {
            const token = sessionStorage.getItem('token');
            let attachmentUrl = null;
            if (complaintAttachment) {
                const formData = new FormData();
                formData.append('image', complaintAttachment);
                try {
                    const uploadRes = await axios.post(`${API}/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
                    if (uploadRes.data.success) attachmentUrl = uploadRes.data.data.imageUrl;
                } catch (err) {
                    showToast('Lỗi tải ảnh minh chứng, vẫn tiếp tục gửi khiếu nại', 'warning');
                }
            }

            const payload = {
                category: 'ATTENDANCE',
                subject: `Khiếu nại ca trực ${complaintData.shiftLabel} ngày ${new Date(complaintData.dateStr).toLocaleDateString('vi-VN')}`,
                content: complaintData.reason,
                referenceType: 'Attendance',
                referenceId: complaintData.attendanceId,
                attachment: attachmentUrl
            };
            const res = await axios.post(`${API}/tickets`, payload, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { 
                showToast('Gửi khiếu nại thành công! Vui lòng chờ Admin xử lý.', 'success'); 
                setIsComplaintOpen(false); 
                setComplaintAttachment(null);
            }
        } catch (err) { showToast(err.response?.data?.message || 'Lỗi gửi yêu cầu', 'error'); }
        finally { setSubmitLoading(false); }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
            if (videoRef.current) { videoRef.current.srcObject = stream; setCaptured(null); setFaceStatus(null); }
        } catch { showToast('Không thể truy cập máy ảnh', 'error'); }
    };
    const stopCamera = () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        setCaptured(canvasRef.current.toDataURL('image/jpeg', 0.9));
        setFaceStatus(null); // reset kết quả cũ nếu chụp lại
        stopCamera();
    };

    const openAttModal = (type, id) => {
        setAttType(type); setShiftId(id); setIsAttOpen(true);
        setCaptured(null); setFaceStatus(null);
        startCamera();
        // Preload models song song khi mở modal
        loadFaceModels(msg => setModelMsg(msg)).catch(() => { });
    };

    const handleAttendance = async () => {
        if (!captured) return showToast('Vui lòng chụp ảnh xác minh', 'warning');
        if (!user?.verificationPhoto) {
            return showToast('Ảnh mẫu chưa được thiết lập. Hãy cập nhật ảnh hồ sơ trước.', 'warning');
        }
        setAttLoading(true);

        try {
            // 1. Đảm bảo models đã tải xong
            setFaceStatus({ phase: 'loading-models' });
            await loadFaceModels(msg => setModelMsg(msg));

            // 2. Nhận diện khuôn mặt
            setFaceStatus({ phase: 'verifying' });
            const result = await verifyFace(user.verificationPhoto, canvasRef.current);
            setFaceStatus({ phase: 'done', result });

            if (!result.success) {
                showToast(result.message, 'error');
                setAttLoading(false);
                return;
            }

            // 3. Lấy vị trí GPS
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
            );

            // 4. Gửi lên backend với score thật
            const endpoint = attType === 'IN' ? '/attendance/check-in' : '/attendance/check-out';
            await axios.post(`${API}${endpoint}`, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                photo: captured,
                similarityScore: result.score,
                ...(shiftId ? { scheduleId: shiftId } : {})
            }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });

            showToast(
                `${attType === 'IN' ? 'Check-in' : 'Check-out'} thành công! (Độ khớp khuôn mặt: ${Math.round(result.score * 100)}%)`,
                'success'
            );
            setIsAttOpen(false); setCaptured(null); setFaceStatus(null); fetchSchedule();

        } catch (err) {
            showToast(err.response?.data?.message || err.message || 'Lỗi xác thực', 'error');
            setFaceStatus(null);
        } finally {
            setAttLoading(false);
        }
    };

    // ── Timetable cell ─────────────────────────────────────────────────────────
    const renderCell = (shift, dayDate) => {
        const dateStr = toDateStr(dayDate);
        const todayStr = toDateStr(new Date());
        const isToday = dateStr === todayStr;
        const isPast = dateStr < todayStr;
        const leave = getLeaveForDate(dateStr);
        const sc = schedules.find(s => toDateStr(s.date) === dateStr && s.shift === shift.code);

        if (!sc) {
            return (
                <div style={{
                    height: '96px', borderRadius: '8px',
                    background: isToday ? '#f0f9ff' : '#f9fafb',
                    border: isToday ? '1.5px dashed #bfdbfe' : '1px dashed #e2e8f0',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}>
                    <span style={{ fontSize: '0.76rem', color: '#cbd5e1', fontWeight: 600 }}>Không có ca</span>
                </div>
            );
        }

        const isApproved = leave?.status === 'APPROVED';
        const isPending = leave?.status === 'PENDING';
        const att = attMap[sc._id];
        const hasIn = !!att?.checkIn?.time;
        const hasOut = !!att?.checkOut?.time;
        const isLate = !!(att?.checkIn?.isLate || att?.status === 'LATE');
        const lateMin = att?.checkIn?.lateMinutes || 0;

        // Status
        let statusLabel = '', statusColor = '', statusBg = '', StatusIcon = null;
        if (isApproved) {
            statusLabel = LEAVE_TYPE[leave.type] || 'Nghỉ phép';
            statusColor = '#7c3aed'; statusBg = '#f5f3ff'; StatusIcon = Palmtree;
        } else if (isPending) {
            statusLabel = 'Chờ duyệt'; statusColor = '#64748b'; statusBg = '#f1f5f9'; StatusIcon = Hourglass;
        } else if (isPast || isToday) {
            if (hasIn && hasOut) {
                if (att.checkOut?.isAuto) {
                    statusLabel = 'Quên Checkout (Lỗi)'; statusColor = '#dc2626'; statusBg = '#fef2f2'; StatusIcon = XCircle;
                } else {
                    statusLabel = isLate ? `Trễ ${lateMin} phút` : 'Đúng giờ';
                    statusColor = isLate ? '#d97706' : '#16a34a';
                    statusBg = isLate ? '#fffbeb' : '#f0fdf4';
                    StatusIcon = isLate ? AlertTriangle : CheckCircle2;
                }
            } else if (hasIn) {
                if (isPast || (isToday && shiftEnded(shift.code))) {
                    statusLabel = 'Quên Checkout (Lỗi)'; statusColor = '#dc2626'; statusBg = '#fef2f2'; StatusIcon = XCircle;
                } else {
                    statusLabel = 'Chưa kết ca'; statusColor = '#d97706'; statusBg = '#fffbeb'; StatusIcon = AlertTriangle;
                }
            } else if (isPast || (isToday && shiftEnded(shift.code))) {
                // Qua ngày HOẶC hôm nay đã qua giờ ca, không có check-in → Vắng
                statusLabel = 'Vắng'; statusColor = '#ef4444'; statusBg = '#fef2f2'; StatusIcon = XCircle;
            }
        }

        return (
            <div style={{
                minHeight: '96px', borderRadius: '8px', padding: '8px 10px',
                border: isToday ? `2px solid ${shift.color}` : `1px solid ${shift.color}30`,
                background: isApproved ? '#faf5ff' : isPending ? '#f8fafc' : shift.bg,
                display: 'flex', flexDirection: 'column', gap: '3px',
                overflow: 'hidden'
            }}>
                {/* Dòng 1: Tên ca */}
                <span style={{
                    fontSize: '0.84rem', fontWeight: 800,
                    color: isApproved ? '#7c3aed' : shift.color,
                    textDecoration: isApproved ? 'line-through' : 'none'
                }}>{shift.label}</span>

                {/* Dòng 2: Giờ ca */}
                <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                    {shift.time}
                </span>

                {/* Dòng 3: Badge trạng thái */}
                {(isApproved || isPending) && (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '5px', width: 'fit-content',
                        background: isApproved ? '#ede9fe' : '#f1f5f9'
                    }}>
                        {isApproved ? <Palmtree size={11} color="#7c3aed" /> : <Hourglass size={11} color="#64748b" />}
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isApproved ? '#7c3aed' : '#64748b' }}>
                            {isApproved ? (LEAVE_TYPE[leave.type] || 'Nghỉ phép') : 'Chờ duyệt'}
                        </span>
                    </div>
                )}
                {statusLabel && !isApproved && !isPending && StatusIcon && (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '5px', width: 'fit-content',
                        background: statusBg
                    }}>
                        <StatusIcon size={11} color={statusColor} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                    </div>
                )}

                {/* Dòng 4: Giờ vào/ra */}
                {hasIn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.73rem' }}>
                        <LogIn size={11} color="#16a34a" />
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>{fmtTime(att.checkIn.time)}</span>
                        {hasOut && (
                            <>
                                <span style={{ color: '#cbd5e1' }}>→</span>
                                <LogOut size={11} color="#ef4444" />
                                <span style={{ fontWeight: 700, color: '#ef4444' }}>{fmtTime(att.checkOut.time)}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Nút VÀO CA: chỉ trong khoảng giờ ca, chưa hết ca */}
                {isToday && !isApproved && shiftStarted(shift.code) && !shiftEnded(shift.code) && !hasIn && (
                    <button onClick={() => openAttModal('IN', sc._id)} style={{
                        width: '100%', padding: '6px 0', borderRadius: '6px',
                        background: shift.color, color: '#fff', border: 'none',
                        fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
                        boxShadow: `0 2px 6px ${shift.color}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        marginTop: '2px'
                    }}>
                        <LogIn size={12} /> VÀO CA
                    </button>
                )}
                {/* Nút KẾT CA: hiện khi đã vào nhưng chưa kết — kể cả khi đã qua giờ ca */}
                {isToday && !isApproved && hasIn && !hasOut && (
                    <button onClick={() => openAttModal('OUT', sc._id)} style={{
                        width: '100%', padding: '6px 0', borderRadius: '6px',
                        background: '#f59e0b', color: '#fff', border: 'none',
                        fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
                        boxShadow: '0 2px 6px #f59e0b50',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        marginTop: '2px'
                    }}>
                        <LogOut size={12} /> KẾT CA
                    </button>
                )}
                {/* Nút XIN NGHỈ: ẩn khi: ngày đã qua | hôm nay sau giờ ca | đang nghỉ phép | đã vào ca */}
                {!isPast && !(isToday && shiftEnded(shift.code)) && !isApproved && !isPending && !hasIn && (
                    <button
                        onClick={() => {
                            const d = toDateStr(dayDate);
                            setLeaveData(p => ({ ...p, startDate: d, endDate: d, type: '', reason: '' }));
                            setQuickLeave({ shiftLabel: shift.label, dateStr: d });
                            setIsLeaveOpen(true);
                        }}
                        style={{
                            width: '100%', padding: '6px 0', borderRadius: '6px',
                            background: '#fff7ed', color: '#ea580c',
                            border: '1.5px solid #fdba74',
                            fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                            marginTop: '2px'
                        }}>
                        Xin Nghỉ
                    </button>
                )}
                {/* Nút KHIẾU NẠI GIỜ LÀM: hiện khi bị lỗi Quên Checkout */}
                {(statusLabel === 'Quên Checkout (Lỗi)') && (
                    <button onClick={() => {
                        setComplaintData({ attendanceId: att?._id, dateStr, shiftLabel: shift.label, reason: '' });
                        setComplaintAttachment(null);
                        setIsComplaintOpen(true);
                    }} style={{
                        width: '100%', padding: '6px 0', borderRadius: '6px',
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
                        fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                        marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                    }}>
                        <ShieldX size={12} /> Khiếu nại
                    </button>
                )}
            </div>
        );
    };

    // ── Styles ─────────────────────────────────────────────────────────────────

    const tabStyle = (active) => ({
        padding: '9px 22px', borderRadius: '9px', fontWeight: 700, fontSize: '0.86rem',
        border: 'none', cursor: 'pointer',
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: '7px'
    });

    const filterBtnStyle = (active, color) => ({
        padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
        cursor: 'pointer', border: `1.5px solid ${active ? color : '#e2e8f0'}`,
        background: active ? color + '18' : '#fff', color: active ? color : '#64748b',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px'
    });

    const inputStyle = { padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', fontWeight: 600, height: '36px', outline: 'none' };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <Layout>
            {/* Header */}
            <div className="animate-fade-in" style={{ marginBottom: '26px' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Lịch Cá Nhân &amp; Chấm Công
                </h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.88rem' }}>
                    {user?.role === 'DOCTOR' ? 'Bác sĩ ' : ''}<strong>{user?.fullName}</strong>
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', width: 'fit-content', marginBottom: '20px' }}>
                <button style={tabStyle(activeTab === 'schedule')} onClick={() => setActiveTab('schedule')}>
                    <Calendar size={15} /> Lịch Trực
                </button>
                <button style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>
                    <Clock size={15} /> Lịch Sử Chấm Công
                </button>
            </div>

            {/* ══════ TAB: LỊCH TRỰC ══════ */}
            {activeTab === 'schedule' && (
                <div className="glass-card animate-slide-up" style={{ padding: '24px' }}>

                    {/* Toolbar */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
                        {/* Điều hướng tuần */}
                        {!useCustom && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button onClick={() => setWeekStart(w => addDays(w, -7))}
                                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ChevronLeft size={16} color="#64748b" />
                                </button>
                                <div style={{ padding: '6px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', background: '#f8fafc', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                    {weekDays[0]?.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                    {' – '}
                                    {weekDays[6]?.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </div>
                                <button onClick={() => setWeekStart(w => addDays(w, 7))}
                                    style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ChevronRight size={16} color="#64748b" />
                                </button>
                                <button onClick={() => setWeekStart(getMonday(new Date()))}
                                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'white', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                    Tuần này
                                </button>
                            </div>
                        )}

                        {/* Khoảng ngày tuỳ chỉnh */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: useCustom ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                                Khoảng ngày tuỳ chỉnh
                            </label>
                            {useCustom && (
                                <>
                                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle} />
                                    <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem' }}>→</span>
                                    <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} style={inputStyle} />
                                </>
                            )}
                            <button onClick={fetchSchedule} style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RefreshCw size={14} color="#64748b" />
                            </button>
                        </div>
                    </div>

                    {/* Chú thích trạng thái */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {Object.values(STATUS_CFG).map(({ label, color, Icon }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', background: color + '12', border: `1px solid ${color}30` }}>
                                <Icon size={11} color={color} />
                                <span style={{ fontSize: '0.73rem', fontWeight: 700, color }}>{label}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '6px', background: '#f1f5f930', border: '1px solid #e2e8f0' }}>
                            <Hourglass size={11} color="#64748b" />
                            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#64748b' }}>Chờ duyệt</span>
                        </div>
                    </div>

                    {/* Timetable */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang tải lịch trực...</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px 12px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '76px', padding: '8px 4px', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>CA / NGÀY</th>
                                        {weekDays.map((day, i) => {
                                            const isToday = toDateStr(day) === toDateStr(new Date());
                                            return (
                                                <th key={i} style={{ padding: '6px 4px', textAlign: 'center', minWidth: '150px' }}>
                                                    <div style={{ fontSize: '0.74rem', color: isToday ? 'var(--primary)' : '#64748b', fontWeight: 700, letterSpacing: '0.3px' }}>
                                                        {day.toLocaleDateString('vi-VN', { weekday: 'short' }).toUpperCase()}
                                                    </div>
                                                    <div style={{
                                                        display: 'inline-block', padding: '3px 12px', borderRadius: '16px', marginTop: '3px',
                                                        background: isToday ? 'var(--primary)' : 'transparent',
                                                        color: isToday ? '#fff' : 'var(--text-main)',
                                                        fontWeight: 800, fontSize: '1rem'
                                                    }}>
                                                        {day.getDate()}/{day.getMonth() + 1}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {SHIFTS.map(shift => (
                                        <tr key={shift.code}>
                                            <td style={{ padding: '4px 3px', verticalAlign: 'middle' }}>
                                                <div style={{ textAlign: 'center', padding: '6px' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: shift.color }}>{shift.label}</div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '2px' }}>{shift.time}</div>
                                                </div>
                                            </td>
                                            {weekDays.map((day, i) => (
                                                <td key={i} style={{ padding: '3px', verticalAlign: 'top' }}>
                                                    {renderCell(shift, day)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══════ TAB: LỊCH SỬ CHẤM CÔNG ══════ */}
            {activeTab === 'history' && (
                <div className="glass-card animate-slide-up" style={{ padding: '24px' }}>

                    {/* Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                            <Clock size={17} /> Lịch Sử Chấm Công
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                            {/* Lọc ngày */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Từ ngày</span>
                                <input type="date" value={histFrom} onChange={e => setHistFrom(e.target.value)} style={inputStyle} />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>đến</span>
                                <input type="date" value={histTo} min={histFrom} onChange={e => setHistTo(e.target.value)} style={inputStyle} />
                                {(histFrom || histTo) && (
                                    <button onClick={() => { setHistFrom(''); setHistTo(''); }}
                                        style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <X size={12} /> Xoá lọc
                                    </button>
                                )}
                                <button onClick={fetchHistory} style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <RefreshCw size={13} color="#64748b" />
                                </button>
                            </div>

                            {/* Lọc trạng thái */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {[
                                    { val: 'ALL', label: 'Tất cả', color: '#64748b', Icon: null },
                                    { val: 'PRESENT', label: 'Có mặt', color: '#16a34a', Icon: CheckCircle2 },
                                    { val: 'LATE', label: 'Đi trễ', color: '#d97706', Icon: AlertTriangle },
                                    { val: 'ABSENT', label: 'Vắng', color: '#ef4444', Icon: XCircle },
                                    { val: 'ON_LEAVE', label: 'Nghỉ phép', color: '#7c3aed', Icon: Palmtree },
                                ].map(({ val, label, color, Icon }) => (
                                    <button key={val} onClick={() => setHistFilter(val)} style={filterBtnStyle(histFilter === val, color)}>
                                        {Icon && <Icon size={12} />}
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tổng kết */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', padding: '14px 18px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        {[
                            { label: 'Tổng ca', val: attHistory.length, color: '#64748b' },
                            { label: 'Có mặt', val: attHistory.filter(a => a.status === 'PRESENT').length, color: '#16a34a' },
                            { label: 'Đi trễ', val: attHistory.filter(a => a.status === 'LATE').length, color: '#d97706' },
                            { label: 'Vắng', val: attHistory.filter(a => a.status === 'ABSENT').length, color: '#ef4444' },
                            { label: 'Nghỉ phép', val: attHistory.filter(a => a.status === 'ON_LEAVE').length, color: '#7c3aed' },
                        ].map(({ label, val, color }) => (
                            <div key={label} style={{ textAlign: 'center', minWidth: '72px', flex: 1 }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{val}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Danh sách */}
                    {histLoading ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Đang tải...</div>
                    ) : filteredHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                            Không có dữ liệu{histFilter !== 'ALL' || histFrom ? ' theo điều kiện lọc' : ' chấm công'}.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filteredHistory.map((rec, i) => {
                                const cfg = STATUS_CFG[rec.status] || STATUS_CFG.PRESENT;
                                const { Icon } = cfg;
                                const hasIn = !!rec.checkIn?.time;
                                const hasOut = !!rec.checkOut?.time;
                                const isLate = rec.checkIn?.isLate;
                                const lateMin = rec.checkIn?.lateMinutes || 0;
                                let hoursWorked = null;
                                if (hasIn && hasOut) {
                                    if (rec.checkOut?.isAuto) {
                                        hoursWorked = '0.0';
                                    } else {
                                        const d = (new Date(rec.checkOut.time) - new Date(rec.checkIn.time)) / 3600000;
                                        hoursWorked = d.toFixed(1);
                                    }
                                }
                                const shiftLabel = rec.scheduleId?.shift
                                    ? ({ DAY: 'Ca Sáng', EVENING: 'Ca Chiều', NIGHT: 'Ca Tối' }[rec.scheduleId.shift] || rec.scheduleId.shift)
                                    : 'Ca làm việc';

                                return (
                                    <div key={rec._id || i} style={{
                                        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
                                        borderRadius: '10px', border: `1px solid ${cfg.color}20`, background: cfg.bg
                                    }}>
                                        <Icon size={22} color={cfg.color} style={{ flexShrink: 0 }} />

                                        {/* Ngày */}
                                        <div style={{ minWidth: '140px' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                                {new Date(rec.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>{shiftLabel}</div>
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <span style={{ padding: '3px 10px', borderRadius: '20px', background: rec.checkOut?.isAuto ? '#fef2f2' : cfg.color + '20', color: rec.checkOut?.isAuto ? '#dc2626' : cfg.color, fontWeight: 800, fontSize: '0.76rem' }}>
                                                {rec.checkOut?.isAuto ? 'Quên Checkout (Lỗi)' : cfg.label}{isLate && rec.status === 'LATE' && !rec.checkOut?.isAuto ? ` (${lateMin} phút)` : ''}
                                            </span>
                                        </div>

                                        {/* Giờ */}
                                        <div style={{ display: 'flex', gap: '18px', marginLeft: '4px' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.3px' }}>VÀO CA</div>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: hasIn ? '#16a34a' : '#94a3b8' }}>{fmtTime(rec.checkIn?.time)}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.3px' }}>KẾT CA</div>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: hasOut ? '#ef4444' : '#94a3b8' }}>{fmtTime(rec.checkOut?.time)}</div>
                                            </div>
                                            {hoursWorked && (
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.3px' }}>GIỜ LÀM</div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>{hoursWorked}h</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Ghi chú */}
                                        {rec.note && (
                                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic' }}>
                                                <FileText size={13} />
                                                {rec.note}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Modal Chấm Công (với Face AI) ──────────────── */}
            {isAttOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 4000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '420px', borderRadius: '24px' }}>
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ScanFace size={18} color="var(--primary)" />
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800, fontSize: '1rem' }}>
                                    Xác Thực Khuôn Mặt — {attType === 'IN' ? 'Vào Ca' : 'Kết Ca'}
                                </h3>
                            </div>
                            <button onClick={() => { setIsAttOpen(false); stopCamera(); setFaceStatus(null); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '22px' }}>

                            {/* Camera / Ảnh */}
                            <div style={{ width: '100%', aspectRatio: '4/3', background: '#1e293b', borderRadius: '14px', overflow: 'hidden', position: 'relative', marginBottom: '14px' }}>
                                {!captured ? (
                                    <>
                                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        {/* Nút chụp */}
                                        <button onClick={takePhoto} style={{
                                            position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
                                            width: '56px', height: '56px', borderRadius: '50%',
                                            border: '4px solid white', background: 'rgba(255,255,255,0.25)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white' }} />
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ position: 'relative', height: '100%' }}>
                                        <img src={captured} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Ảnh xác minh" />
                                        {/* Overlay kết quả */}
                                        {faceStatus?.phase === 'done' && (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                background: faceStatus.result.success ? 'rgba(22,163,74,0.35)' : 'rgba(239,68,68,0.35)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {faceStatus.result.success
                                                    ? <ShieldCheck size={64} color="#fff" strokeWidth={1.5} />
                                                    : <ShieldX size={64} color="#fff" strokeWidth={1.5} />}
                                            </div>
                                        )}
                                        {/* Nút chụp lại */}
                                        {(!attLoading) && (
                                            <button onClick={() => { setCaptured(null); setFaceStatus(null); startCamera(); }}
                                                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                                <RefreshCw size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', color: '#94a3b8', fontSize: '0.8rem', alignItems: 'flex-start' }}>
                                <MapPin size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                                <span>Tọa độ GPS sẽ được lấy để xác minh vị trí phòng khám.</span>
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', height: '46px', fontWeight: 800, letterSpacing: '0.5px' }}
                                onClick={handleAttendance} disabled={attLoading || !captured}>
                                {attLoading ? 'ĐANG XÁC THỰC...' : 'XÁC NHẬN CHẤM CÔNG'}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}

            {/* ── Modal Gửi Đơn Nghỉ ────────────────────── */}
            {isLeaveOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: quickLeave ? '420px' : '540px', borderRadius: '24px' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800, fontSize: '1rem' }}>Đăng Ký Nghỉ Phép</h3>
                                {quickLeave && (
                                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                                        {quickLeave.shiftLabel} &mdash; {new Date(quickLeave.dateStr).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => { setIsLeaveOpen(false); setQuickLeave(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <form className="modal-body" onSubmit={handleCreateLeave} style={{ padding: '24px' }}>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Hình thức nghỉ *</label>
                                <select
                                    className="input-field"
                                    name="type"
                                    value={leaveData.type}
                                    onChange={handleLeaveChange}
                                    style={{ height: '44px', fontWeight: 500, background: '#fff', cursor: 'pointer' }}
                                    required
                                >
                                    <option value="" disabled>-- Vui lòng chọn lý do --</option>
                                    <option value="PERSONAL">Việc riêng cá nhân</option>
                                    <option value="SICK">Nghỉ ốm, bệnh</option>
                                    <option value="VACATION">Nghỉ phép năm</option>
                                    <option value="UNPAID">Nghỉ không lương</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Lý do</label>
                                <textarea className="input-field" name="reason" value={leaveData.reason} rows={3}
                                    placeholder="Nhập lý do để quản lý duyệt nhanh hơn..."
                                    onChange={handleLeaveChange} style={{ resize: 'none', padding: '12px' }} required />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '22px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1, borderRadius: '100px' }}
                                    onClick={() => { setIsLeaveOpen(false); setQuickLeave(null); }}>Hủy</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2, borderRadius: '100px' }} disabled={submitLoading}>
                                    {submitLoading ? 'Đang gửi...' : 'Xác Nhận Gửi Đơn'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>, document.body
            )}

            {/* ── Modal Gửi Khiếu Nại Giờ Làm ────────────────────── */}
            {isComplaintOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card" style={{ maxWidth: '460px', borderRadius: '24px' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldX size={20} color="#ea580c" />
                                <div>
                                    <h3 style={{ margin: 0, color: '#ea580c', fontWeight: 800, fontSize: '1.05rem' }}>Khiếu Nại Giờ Làm</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                                        {complaintData.shiftLabel} &mdash; {new Date(complaintData.dateStr).toLocaleDateString('vi-VN')}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsComplaintOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <form className="modal-body" onSubmit={handleComplaintSubmit} style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fef08a', color: '#b45309', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                <strong>Lưu ý:</strong> Ca trực này bạn đã quên Check-out, nên hệ thống ghi nhận 0 giờ làm. Hãy cung cấp giờ vào/ra thực tế và nguyên nhân để Quản lý kiểm tra lại Camera và cấp bù giờ cho bạn.
                            </div>
                            
                            <div className="form-group">
                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>Nguyên nhân / Mô tả chi tiết *</label>
                                <textarea className="input-field" name="reason" value={complaintData.reason} rows={4}
                                    placeholder="VD: Em quên bấm máy lúc 18:00, em có vào ca lúc 13:25 và về lúc 18:05. Nhờ quản lý xem lại camera giúp em ạ."
                                    onChange={(e) => setComplaintData({...complaintData, reason: e.target.value})} 
                                    style={{ resize: 'vertical', padding: '12px', fontSize: '0.9rem' }} required />
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>Ảnh minh chứng (Tùy chọn)</label>
                                <input type="file" accept="image/*" onChange={e => setComplaintAttachment(e.target.files[0])} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.85rem' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '22px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1, borderRadius: '100px' }}
                                    onClick={() => setIsComplaintOpen(false)}>Hủy</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2, borderRadius: '100px', background: '#ea580c', borderColor: '#ea580c', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.2)' }} disabled={submitLoading}>
                                    {submitLoading ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>, document.body
            )}
        </Layout>
    );
};

export default MySchedule;
