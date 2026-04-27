import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axios from 'axios';
import NotificationCenter from '../components/NotificationCenter';
import InternalForgotPasswordModal from '../components/InternalForgotPasswordModal';
import EmailVerificationModal from '../components/EmailVerificationModal';
import {
    PawPrint, Phone, MapPin, Clock, Calendar, ArrowRight, Shield, HeartPulse,
    Stethoscope, Scissors, Package, Plus, ChevronRight, Activity, Users, FileText,
    LogOut, Star, Award, Medal, ShieldCheck, Home, ListPlus, Info, User,
    X, CheckCircle2, AlertCircle, XCircle, RefreshCw, Wallet, Eye, UserPlus, Lock,
    Settings, History, MessageSquare, Camera, Bell, CalendarDays, CheckCircle,
    Syringe, Edit2, Save, Smartphone, Laptop, Megaphone, Mail, Minus
} from 'lucide-react';

const API = 'http://localhost:5000/api/v1';
const H = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const TABS = [
    { id: 'home', label: 'Trang chủ', icon: Home },
    { id: 'appointments', label: 'Lịch hẹn', icon: Calendar },
    { id: 'pets', label: 'Thú cưng', icon: PawPrint },
    { id: 'services', label: 'Bảng giá', icon: ListPlus },
    { id: 'invoices', label: 'Hóa đơn', icon: FileText },
    { id: 'about', label: 'Phòng khám', icon: Info },
];

const APT_STATUS = {
    BOOKED: { label: 'Đã đặt', color: '#3b82f6', bg: '#eff6ff', icon: <Clock size={12} /> },
    ARRIVED: { label: 'Đã đến', color: '#8b5cf6', bg: '#f5f3ff', icon: <CheckCircle2 size={12} /> },
    IN_PROGRESS: { label: 'Đang khám', color: '#f59e0b', bg: '#fffbeb', icon: <RefreshCw size={12} /> },
    READY_FOR_PAYMENT: { label: 'Chờ thanh toán', color: '#ef4444', bg: '#fef2f2', icon: <AlertCircle size={12} /> },
    COMPLETED: { label: 'Hoàn tất', color: '#10b981', bg: '#d1fae5', icon: <CheckCircle2 size={12} /> },
    CANCELLED: { label: 'Đã hủy', color: '#64748b', bg: '#f8fafc', icon: <XCircle size={12} /> },
    RESCHEDULE_PENDING: { label: 'Chờ phản hồi', color: '#ea580c', bg: '#fff7ed', icon: <AlertCircle size={12} /> },
};

const fmt = n => Number(n || 0).toLocaleString('vi-VN');
const fmtDate = d => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = d => { const dt = new Date(d); return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Card = ({ children, style, ...props }) => (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', ...style }} {...props}>
        {children}
    </div>
);
const SectionTitle = ({ title, action, onAction }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{title}</h2>
        {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>{action} <ChevronRight size={14} /></button>}
    </div>
);
const Wrap = ({ children }) => (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>{children}</div>
);

// ── Tab: Trang chủ (overview) ─────────────────────────────────────────────────
function HomeTab({ user, switchTab }) {
    const [apts, setApts] = useState([]);
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewPet, setViewPet] = useState(null);
    const [viewPetTab, setViewPetTab] = useState('records');

    useEffect(() => {
        Promise.all([
            axios.get(`${API}/appointments`, { headers: H() }),
            axios.get(`${API}/pets`, { headers: H() })
        ]).then(([a, p]) => {
            if (a.data.success) setApts(a.data.data);
            if (p.data.success) setPets(p.data.data);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const upcoming = apts.filter(a => ['BOOKED', 'ARRIVED', 'IN_PROGRESS', 'RESCHEDULE_PENDING'].includes(a.status)).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);
    const pts = user?.rewardPoints || 0;

    // Hạng thành viên (đồng nhất với hệ thống quản lý)
    const TIERS = [
        { name: 'Thành viên', min: 0, max: 300, color: '#16a34a', bg: '#f0fdf4', emoji: '🏥', next: 'Bạc', nextPts: 300, cardGrad: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' },
        { name: 'Bạc', min: 300, max: 1000, color: '#475569', bg: '#f1f5f9', emoji: '🥈', next: 'Vàng', nextPts: 1000, cardGrad: 'linear-gradient(135deg, #334155 0%, #475569 50%, #64748b 100%)' },
        { name: 'Vàng', min: 1000, max: 2000, color: '#ca8a04', bg: '#fefce8', emoji: '🥇', next: 'Kim Cương', nextPts: 2000, cardGrad: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)' },
        { name: 'Kim Cương', min: 2000, max: null, color: '#db2777', bg: '#fdf2f8', emoji: '💎', next: null, nextPts: null, cardGrad: 'linear-gradient(135deg, #9d174d 0%, #db2777 50%, #ec4899 100%)' },
    ];
    const tierInfo = TIERS.find(t => pts >= t.min && (t.max === null || pts < t.max)) || TIERS[0];
    const progressPct = tierInfo.max ? Math.min(100, ((pts - tierInfo.min) / (tierInfo.max - tierInfo.min)) * 100) : 100;

    const pendingReschedule = apts.filter(a => a.status === 'RESCHEDULE_PENDING').length;

    const todayApts = apts.filter(a => {
        const d = new Date(a.date);
        const today = new Date();
        return d.toDateString() === today.toDateString() && ['BOOKED', 'ARRIVED', 'IN_PROGRESS'].includes(a.status);
    });
    const displayAvatar = user?.avatar || '';

    if (loading) return <Wrap><div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div></Wrap>;

    if (viewPet) {
        return (
            <Wrap>
                <PetDetailPage pet={viewPet} onBack={() => setViewPet(null)} initialTab={viewPetTab} />
            </Wrap>
        );
    }

    return (
        <Wrap>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ margin: '0 0 4px', fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Xin chào, {user?.fullName?.split(' ').slice(-1)[0]}
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {todayApts.length > 0 && (
                        <div onClick={() => switchTab('appointments')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: '#eff6ff', border: '1px solid #bfdbfe', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}>
                            <Calendar size={13} /> {todayApts.length} lịch hẹn hôm nay
                        </div>
                    )}
                    {pendingReschedule > 0 && (
                        <div onClick={() => switchTab('appointments')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: '#fff7ed', border: '1px solid #fed7aa', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#c2410c' }}>
                            <Activity size={13} /> {pendingReschedule} chờ xác nhận
                        </div>
                    )}
                </div>
            </div>

            {/* ── LỊCH HẸN SẮP TỚI ── */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '22px 24px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={17} color="var(--primary)" />
                            Lịch hẹn sắp tới
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {upcoming.length > 0 ? `${upcoming.length} lịch hẹn đang chờ` : 'Chưa có lịch hẹn nào'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => switchTab('appointments')}
                            style={{ padding: '7px 14px', borderRadius: '8px', background: 'none', border: '1.5px solid #e2e8f0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Xem tất cả
                        </button>
                        <button onClick={() => switchTab('appointments')}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Plus size={14} /> Đặt lịch
                        </button>
                    </div>
                </div>

                {upcoming.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 24px', color: 'var(--text-muted)', borderRadius: '12px', background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                        <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Chưa có lịch hẹn sắp tới</div>
                        <div style={{ fontSize: '0.8rem' }}>Bấm "Đặt lịch" để đặt lịch khám cho thú cưng</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {upcoming.map(a => {
                            const st = APT_STATUS[a.status] || APT_STATUS.BOOKED;
                            const isReschedule = a.status === 'RESCHEDULE_PENDING';

                            const rawName = (a.serviceId?.name || '').toLowerCase();
                            const aptType = (a.type || '').toUpperCase();       // 'MEDICAL' | 'GROOMING'
                            const aptCat = (a.category || '').toUpperCase();   // 'REGULAR' | 'FOLLOW_UP' | 'WALKIN'
                            let svcTag;
                            if (aptType === 'GROOMING') {
                                svcTag = { label: a.serviceId?.name || 'Chăm sóc', color: '#7c3aed', bg: '#f5f3ff', dot: '#7c3aed' };
                            } else if (aptCat === 'FOLLOW_UP') {
                                svcTag = { label: 'Tái khám', color: '#ea580c', bg: '#fff7ed', dot: '#ea580c' };
                            } else if (aptCat === 'WALKIN') {
                                svcTag = { label: 'Khám vãng lai', color: '#0369a1', bg: '#f0f9ff', dot: '#0369a1' };
                            } else if (rawName.includes('tiêm') || rawName.includes('vaccine') || rawName.includes('phòng bệnh')) {
                                svcTag = { label: 'Tiêm phòng', color: '#2563eb', bg: '#eff6ff', dot: '#2563eb' };
                            } else {
                                svcTag = { label: a.serviceId?.name || 'Khám thường', color: '#0f766e', bg: '#f0fdfa', dot: '#0f766e' };
                            }

                            return (
                                <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderRadius: '10px', background: isReschedule ? '#fff7ed' : '#f8fafc', border: `1px solid ${isReschedule ? '#fed7aa' : '#f1f5f9'}` }}>
                                    {/* Pet avatar */}
                                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {a.petId?.avatar
                                            ? <img src={a.petId.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <PawPrint size={18} color="#94a3b8" />}
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{a.petId?.name || 'Thú cưng'}</span>
                                            {/* Service type — clean pill, no emoji */}
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, background: svcTag.bg, color: svcTag.color }}>
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: svcTag.dot, flexShrink: 0 }} />
                                                {svcTag.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                <Calendar size={11} /> {fmtDate(a.date)}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                <Clock size={11} /> {a.timeSlot || '--'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Status */}
                                    <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{st.label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── BOTTOM GRID: Pets (left) + Membership (right) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'stretch' }}>

                {/* Left column: Pets + Recent history */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <PawPrint size={17} color="var(--primary)" />
                                    Thú cưng của tôi
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>{pets.length} thú cưng đã đăng ký</div>
                            </div>
                            <button onClick={() => switchTab('pets')}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '8px', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                <Plus size={13} /> Thêm
                            </button>
                        </div>
                        {pets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', borderRadius: '12px', background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🐾</div>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Chưa có thú cưng nào</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'thin' }}>
                                {pets.map(p => (
                                    <div key={p._id} onClick={() => switchTab('pets')}
                                        style={{ flexShrink: 0, width: '110px', padding: '14px 10px', borderRadius: '14px', background: '#f8fafc', border: '1.5px solid #e2e8f0', cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#f0fdf9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'none'; }}>
                                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', overflow: 'hidden' }}>
                                            {p.avatar ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PawPrint size={22} color="var(--primary)" />}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', marginBottom: '2px' }}>{p.name}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '20px', background: '#e2e8f0', display: 'inline-block' }}>{p.species}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lịch sử khám gần đây */}
                    {(() => {
                        const recentDone = apts.filter(a => a.status === 'COMPLETED').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
                        if (recentDone.length === 0) return null;
                        return (
                            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '14px' }}>🕐 Lịch sử hoạt động gần đây</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {recentDone.map(a => {
                                        const svcName = a.serviceId?.name || (a.type === 'EMERGENCY' ? 'Cấp cứu' : a.type === 'REVISIT' ? 'Tái khám' : 'Khám thường');
                                        return (
                                            <div key={a._id}
                                                onClick={() => {
                                                    if (a.petId) {
                                                        setViewPet(a.petId);
                                                        setViewPetTab(a.type === 'GROOMING' ? 'grooming' : 'records');
                                                    }
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', cursor: a.petId ? 'pointer' : 'default', transition: 'all 0.15s' }}
                                                onMouseEnter={e => { if (a.petId) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = '#f0fdf9'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                                                onMouseLeave={e => { if (a.petId) { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'none'; } }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                                    {a.petId?.avatar ? <img src={a.petId.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PawPrint size={16} color="#10b981" />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', transition: 'color 0.15s' }}>{a.petId?.name || 'Thú cưng'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>{svcName} · {fmtDate(a.date)}</div>
                                                </div>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap' }}>Hoàn tất</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden' }}>
                    {/* Soft tinted top accent */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: tierInfo.cardGrad, borderRadius: '16px 16px 0 0' }} />

                    {/* User row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', marginTop: '8px' }}>
                        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: tierInfo.bg, border: `2px solid ${tierInfo.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '1.3rem', fontWeight: 800, flexShrink: 0 }}>
                            {displayAvatar ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '3px', padding: '2px 10px', borderRadius: '20px', background: tierInfo.bg, fontSize: '0.7rem', fontWeight: 700, color: tierInfo.color }}>
                                {tierInfo.emoji} Hạng {tierInfo.name}
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: '#f1f5f9', margin: '0 0 14px' }} />

                    {/* Points */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Điểm tích lũy</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: tierInfo.color, lineHeight: 1 }}>{pts.toLocaleString('vi-VN')}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>pts</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>≈ {fmt(pts * 1000)}đ có thể quy đổi</div>
                    </div>

                    {/* Progress */}
                    {tierInfo.next ? (
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                                <span>Còn {(tierInfo.max - pts).toLocaleString('vi-VN')} pts</span>
                                <span>→ {tierInfo.next}</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '6px', background: '#f1f5f9', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progressPct}%`, background: tierInfo.cardGrad, borderRadius: '6px', transition: 'width 0.8s ease' }} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: tierInfo.bg, fontSize: '0.78rem', fontWeight: 700, color: tierInfo.color }}>
                            💎 Bạn đang ở hạng cao nhất!
                        </div>
                    )}

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                            { label: 'Thú cưng', value: pets.length, icon: '🐾' },
                            { label: 'Lần khám', value: apts.filter(a => a.status === 'COMPLETED').length, icon: '✅' },
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '10px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.1rem' }}>{s.icon}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{s.value}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Member ID */}
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Số thành viên</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '2px', letterSpacing: '0.04em' }}>#{user?._id?.slice(-8).toUpperCase()}</div>
                    </div>
                </div>
            </div>
        </Wrap>
    );
}

// ── Tab: Hồ sơ cá nhân ───────────────────────────────────────────────────────
function CustomerProfileTab({ user, onUserUpdate, onToast }) {
    const { updateUser } = useAuth();
    const [section, setSection] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('section') || 'info';
    }); // 'info' | 'password' | 'complaint' | 'history'

    const location = useLocation();
    
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.has('section')) {
            setSection(params.get('section'));
        }
    }, [location.search]);

    // ── Info state ──
    const [info, setInfo] = useState({ fullName: user?.fullName || '', phoneNumber: user?.phoneNumber || '', email: user?.email || '', address: user?.address || '' });
    const [avatarPreview, setAvatarPreview] = useState(() => user?.avatar || '');
    const [infoLoading, setInfoLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [showEmailVerify, setShowEmailVerify] = useState(false);
    const [pendingEmailChange, setPendingEmailChange] = useState('');

    // ── Password state ──
    const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirm: '' });
    const [pwdLoading, setPwdLoading] = useState(false);
    const [showInternalForgotPW, setShowInternalForgotPW] = useState(false);
    const [pwdMsg, setPwdMsg] = useState(null);
    const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });

    // ── Complaint state ──
    const [complaint, setComplaint] = useState({ subject: '', category: 'SERVICE', content: '', referenceId: '' });
    const [complaintLinkType, setComplaintLinkType] = useState('NONE'); // NONE, APPOINTMENT, BILLING
    const [complaintLoading, setComplaintLoading] = useState(false);
    const [complaintMsg, setComplaintMsg] = useState(null);
    const [isConfirmingComplaint, setIsConfirmingComplaint] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [referenceApts, setReferenceApts] = useState([]);

    const [referenceInvoices, setReferenceInvoices] = useState([]);
    const [referenceRecords, setReferenceRecords] = useState([]);
    const [referenceGroomings, setReferenceGroomings] = useState([]);
    const [referenceVaccinations, setReferenceVaccinations] = useState([]);
    const [dataLoaded, setDataLoaded] = useState(false);

        if (section === 'complaint' && !dataLoaded) {
            Promise.all([
                axios.get(`${API}/tickets/me`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } })),
                axios.get(`${API}/appointments`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } })),
                axios.get(`${API}/invoices?customerId=${user?._id || ''}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } })),
                axios.get(`${API}/pets`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } }))
            ]).then(async ([t, a, i, p]) => {
                const pets = p.data?.data || [];
                const petPromises = pets.map(async pet => {
                    const [recRes, groRes, vacRes] = await Promise.all([
                        axios.get(`${API}/records/pet/${pet._id}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } })),
                        axios.get(`${API}/grooming/pet/${pet._id}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } })),
                        axios.get(`${API}/vaccinations/pet/${pet._id}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }).catch(() => ({ data: { data: [] } }))
                    ]);

                    const injectPetName = (items) => (items || []).map(item => ({ ...item, injectedPetName: pet.name }));

                    return {
                        records: injectPetName(recRes.data?.data),
                        groomings: injectPetName(groRes.data?.data),
                        vaccinations: injectPetName(vacRes.data?.data)
                    };
                });
                const petResults = await Promise.all(petPromises);
                
                setTickets(t.data?.data || []);
                setReferenceApts(a.data?.data || []);
                setReferenceInvoices(i.data?.data || []);
                setReferenceRecords(petResults.map(r => r.records).flat());
                setReferenceGroomings(petResults.map(r => r.groomings).flat());
                setReferenceVaccinations(petResults.map(r => r.vaccinations).flat());
                setDataLoaded(true);
            });
        }

    const highlightTicketId = location.state?.highlightTicketId;

    useEffect(() => {
        if (highlightTicketId) {
            setSection('complaint'); // Force section to complaint if highlighting a ticket
            if (tickets.length > 0) {
                setTimeout(() => {
                    const el = document.getElementById(`ticket-${highlightTicketId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const targetTick = tickets.find(t => t._id === highlightTicketId);
                    if (targetTick) setSelectedTicket(targetTick);
                }, 600);
            }
        }
    }, [highlightTicketId, tickets]);

    // Avatar: chọn ảnh → preview ngay + lưu Cloudinary ngay
    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preview cục bộ tạm thời cho khách thấy ngay
        const localPreview = URL.createObjectURL(file);
        setAvatarPreview(localPreview);
        setAvatarLoading(true);

        try {
            const formData = new FormData();
            formData.append('image', file);
            const token = sessionStorage.getItem('token');
            
            // 1. Tải lên Cloudinary
            const uploadRes = await axios.post(`${API}/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
            
            if (uploadRes.data.success) {
                const cloudUrl = uploadRes.data.data.imageUrl;
                setAvatarPreview(cloudUrl);
                
                // 2. Lưu trực tiếp đường dẫn Cloudinary vào Hồ sơ User (DB)
                const profileRes = await axios.put(`${API}/users/me/profile`, { avatar: cloudUrl }, { headers: { Authorization: `Bearer ${token}` } });
                
                if (profileRes.data.success) {
                    updateUser({ avatar: cloudUrl });
                    onToast?.('Đã cập nhật Ảnh Đại Diện lên Cloudinary thành công! ✅', 'success');
                }
            }
        } catch (error) {
            console.error('Lỗi khi upload ảnh:', error);
            onToast?.('Lỗi khi tải ảnh lên Cloudinary.', 'error');
            // Revert lại ảnh cũ nếu lỗi
            setAvatarPreview(user?.avatar || '');
        } finally {
            setAvatarLoading(false);
        }
    };

    const saveInfo = async () => {
        setInfoLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const profileData = { ...info };

            const r = await axios.put(`${API}/users/me/profile`, profileData, { headers: { Authorization: `Bearer ${token}` } });
            if (r.data.success) {
                updateUser({ ...r.data.data, avatar: avatarPreview }); // giữ avatar local
                onToast?.('Cập nhật thông tin thành công! ✅', 'success');
            } else onToast?.(r.data.message || 'Có lỗi xảy ra.', 'error');
        } catch (e) {
            onToast?.(e.response?.data?.message || 'Có lỗi xảy ra.', 'error');
        } finally { setInfoLoading(false); }
    };

    const handleUpdateEmailClick = async () => {
        if (!info.email || info.email === user?.email) return;
        setEmailLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const emailReq = await axios.post(`${API}/users/me/request-email-change`, { newEmail: info.email }, { headers: { Authorization: `Bearer ${token}` } });
            if (emailReq.data.success) {
                setPendingEmailChange(info.email);
                setShowEmailVerify(true);
            } else {
                onToast?.('Lỗi gửi yêu cầu xác nhận email mới.', 'error');
            }
        } catch (err) {
            onToast?.(err.response?.data?.message || 'Lỗi gửi yêu cầu xác nhận email', 'error');
        } finally {
            setEmailLoading(false);
        }
    };

    const savePwd = async () => {
        if (!pwd.oldPassword || !pwd.newPassword) { setPwdMsg({ type: 'error', text: 'Vui lòng điền đầy đủ.' }); return; }
        if (pwd.newPassword.length < 6) { setPwdMsg({ type: 'error', text: 'Mật khẩu mới phải ít nhất 6 ký tự.' }); return; }
        if (pwd.newPassword !== pwd.confirm) { setPwdMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' }); return; }
        setPwdLoading(true); setPwdMsg(null);
        try {
            const token = sessionStorage.getItem('token');
            const r = await axios.put(`${API}/users/me/password`, { oldPassword: pwd.oldPassword, newPassword: pwd.newPassword }, { headers: { Authorization: `Bearer ${token}` } });
            if (r.data.success) {
                onToast?.('Đổi mật khẩu thành công! 🔑', 'success');
                setPwd({ oldPassword: '', newPassword: '', confirm: '' });
            } else setPwdMsg({ type: 'error', text: r.data.message });
        } catch (e) {
            setPwdMsg({ type: 'error', text: e.response?.data?.message || 'Mật khẩu cũ không đúng.' });
        } finally { setPwdLoading(false); }
    };

    const sendComplaint = async () => {
        if (!complaint.subject || !complaint.content) { setComplaintMsg({ type: 'error', text: 'Vui lòng điền tiêu đề và nội dung.' }); return; }
        setComplaintLoading(true); setComplaintMsg(null);
        try {
            const token = sessionStorage.getItem('token');
            let attachmentUrl = null;
            if (attachmentFile) {
                const formData = new FormData();
                formData.append('image', attachmentFile);
                try {
                    const uploadRes = await axios.post(`${API}/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
                    if (uploadRes.data.success) attachmentUrl = uploadRes.data.data.imageUrl;
                } catch (err) {
                    console.error('Lỗi upload ảnh đính kèm:', err);
                    setComplaintMsg({ type: 'error', text: 'Tải ảnh thất bại, vui lòng thử lại.' });
                    setComplaintLoading(false);
                    return;
                }
            }

            const payload = {
                category: complaint.category,
                subject: complaint.subject,
                content: complaint.content,
                referenceType: complaintLinkType === 'BILLING' ? 'Invoice' : 
                               complaintLinkType === 'APPOINTMENT' ? 'Appointment' : 
                               complaintLinkType === 'MEDICAL_RECORD' ? 'MedicalRecord' : 
                               complaintLinkType === 'GROOMING' ? 'GroomingOrder' : 
                               complaintLinkType === 'VACCINATION' ? 'Vaccination' : null,
                referenceId: complaint.referenceId || null,
                attachment: attachmentUrl
            };
            const r = await axios.post(`${API}/tickets`, payload, { headers: { Authorization: `Bearer ${token}` } });
            if (r.data.success) {
                onToast?.('Yêu cầu của bạn đã được tiếp nhận. Vui lòng theo dõi trạng thái phiếu thường xuyên nhé.', 'success');
                setComplaint({ subject: '', category: 'SERVICE', content: '', referenceId: '' });
                setComplaintLinkType('NONE');
                setAttachmentFile(null);
                setIsConfirmingComplaint(false);
                // Update danh sách
                axios.get(`${API}/tickets/me`, { headers: { Authorization: `Bearer ${token}` } }).then(tr => setTickets(tr.data?.data || []));
            } else {
                setComplaintMsg({ type: 'error', text: r.data.message || 'Lỗi gửi yêu cầu' });
            }
        } catch (e) {
            setComplaintMsg({ type: 'error', text: 'Lỗi hệ thống khi gửi yêu cầu' });
        } finally { setComplaintLoading(false); }
    };

    // Lịch sử đăng nhập (từ localStorage)
    const loginHistory = (() => {
        try {
            const raw = localStorage.getItem('vc_login_history');
            if (raw) return JSON.parse(raw);
        } catch { }
        return [];
    })();

    // Ghi login lần hiện tại (chạy 1 lần)
    useEffect(() => {
        try {
            const raw = localStorage.getItem('vc_login_history');
            const arr = raw ? JSON.parse(raw) : [];
            const now = { time: new Date().toISOString(), device: navigator.userAgent.includes('Mobile') ? '📱 Thiết bị di động' : '💻 Máy tính', browser: navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] || 'Trình duyệt khác', location: 'Việt Nam' };
            arr.unshift(now);
            localStorage.setItem('vc_login_history', JSON.stringify(arr.slice(0, 10)));
        } catch { }
    }, []);

    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' };
    const labelStyle = { display: 'block', fontWeight: 700, fontSize: '0.8rem', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' };
    const MsgBar = ({ msg }) => msg ? (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: msg.type === 'success' ? '#166534' : '#991b1b', fontWeight: 600, fontSize: '0.85rem', border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {msg.text}
        </div>
    ) : null;

    const MENU = [
        { id: 'info', Icon: User, label: 'Thông tin cá nhân' },
        { id: 'password', Icon: Lock, label: 'Đổi mật khẩu' },
        { id: 'complaint', Icon: MessageSquare, label: 'Khiếu nại' },
        { id: 'history', Icon: History, label: 'Lịch sử đăng nhập' },
    ];

    return (
        <Wrap>
            <h1 style={{ margin: '0 0 24px', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}><Settings size={22} /> Cài đặt tài khoản</h1>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>

                {/* ── LEFT: Settings Nav ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* User mini card */}
                    <div style={{ padding: '16px', borderRadius: '14px', background: 'white', border: '1px solid #e2e8f0', textAlign: 'center', marginBottom: '4px' }}>
                        <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 10px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', border: '2px solid rgba(15,169,172,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {avatarPreview || user?.avatar ? <img src={avatarPreview || user?.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{user?.fullName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{user?.email || user?.phoneNumber}</div>
                    </div>

                    {/* Nav items */}
                    {MENU.map(m => (
                        <button key={m.id} onClick={() => setSection(m.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '12px', border: 'none', background: section === m.id ? 'var(--primary-light)' : 'white', color: section === m.id ? 'var(--primary)' : '#475569', fontWeight: section === m.id ? 700 : 500, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s', borderLeft: section === m.id ? '3px solid var(--primary)' : '3px solid transparent', textAlign: 'left', width: '100%' }}>
                            <m.Icon size={15} />
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* ── RIGHT: Content ── */}
                <div>

                    {/* ── Thông tin cá nhân ── */}
                    {section === 'info' && (
                        <Card>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}><User size={16} /> Thông tin cá nhân</div>

                            {/* Avatar upload zone */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-light)', border: '3px solid rgba(15,169,172,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                                    {avatarPreview ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: avatarLoading ? 0.5 : 1 }} /> : user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>Ảnh đại diện</div>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>Chọn ảnh để tự động cập nhật</div>
                                    <label htmlFor="avatar-upload-main" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', background: avatarLoading ? '#94a3b8' : 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: avatarLoading ? 'not-allowed' : 'pointer', pointerEvents: avatarLoading ? 'none' : 'auto' }}>
                                        {avatarLoading ? <RefreshCw size={13} className="spin" /> : <Camera size={13} />} {avatarLoading ? 'Đang tải lên...' : 'Đổi ảnh'}
                                    </label>
                                    <input id="avatar-upload-main" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={avatarLoading} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={labelStyle}>Họ và tên *</label>
                                    <input style={inputStyle} value={info.fullName} onChange={e => setInfo(p => ({ ...p, fullName: e.target.value }))}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Số điện thoại</label>
                                    <input style={inputStyle} value={info.phoneNumber} onChange={e => setInfo(p => ({ ...p, phoneNumber: e.target.value }))}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={labelStyle}>Email</label>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input type="email" style={{ ...inputStyle, flex: 1, height: '44px' }} value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                    {info.email === user?.email ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem', padding: '0 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', height: '44px', whiteSpace: 'nowrap' }}>
                                            <CheckCircle2 size={16} /> Đã xác minh
                                        </div>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={handleUpdateEmailClick} 
                                            disabled={emailLoading || !info.email}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', padding: '0 16px', background: 'var(--primary)', border: 'none', borderRadius: '8px', height: '44px', cursor: (emailLoading || !info.email) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: (emailLoading || !info.email) ? 0.7 : 1, transition: 'all 0.2s' }}
                                        >
                                            {emailLoading ? <RefreshCw size={15} className="spin" /> : <Mail size={15} />}
                                            {emailLoading ? 'Đang gửi...' : 'Xác minh & Cập nhật'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ marginBottom: '22px' }}>
                                <label style={labelStyle}>Địa chỉ thường trú</label>
                                <input style={inputStyle} value={info.address} onChange={e => setInfo(p => ({ ...p, address: e.target.value }))} placeholder="VD: 123 Nguyễn Văn Linh, Q.7, HCM"
                                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                            </div>
                            <button onClick={saveInfo} disabled={infoLoading}
                                style={{ padding: '11px 28px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: infoLoading ? '#94a3b8' : 'var(--primary)', color: 'white', fontWeight: 700, cursor: infoLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                                {infoLoading ? <><RefreshCw size={16} className="spin" /> Đang lưu...</> : <><Save size={16} /> Lưu thay đổi</>}
                            </button>
                        </Card>
                    )}

                    {/* ── Đổi mật khẩu ── */}
                    {section === 'password' && (
                        <Card>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Lock size={18} color="var(--primary)" /> Đổi mật khẩu
                            </div>
                            <MsgBar msg={pwdMsg} />
                            <div style={{ maxWidth: '420px' }}>
                                {[
                                    { key: 'oldPassword', label: 'Mật khẩu hiện tại', show: 'old' },
                                    { key: 'newPassword', label: 'Mật khẩu mới', show: 'new', hint: 'Tối thiểu 6 ký tự' },
                                    { key: 'confirm', label: 'Xác nhận mật khẩu mới', show: 'confirm' },
                                ].map(field => (
                                    <div key={field.key} style={{ marginBottom: '16px', position: 'relative' }}>
                                        <label style={labelStyle}>{field.label}</label>
                                        <input
                                            type={showPwd[field.show] ? 'text' : 'password'}
                                            style={{ ...inputStyle, paddingRight: '44px' }}
                                            value={pwd[field.key]}
                                            onChange={e => setPwd(p => ({ ...p, [field.key]: e.target.value }))}
                                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                            placeholder={field.hint || ''}
                                        />
                                        <button onClick={() => setShowPwd(p => ({ ...p, [field.show]: !p[field.show] }))}
                                            style={{ position: 'absolute', right: '12px', top: '34px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', padding: 0 }}>
                                            {showPwd[field.show] ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                                    <button onClick={savePwd} disabled={pwdLoading}
                                        style={{ padding: '11px 28px', borderRadius: '10px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', background: pwdLoading ? '#94a3b8' : 'var(--primary)', color: 'white', fontWeight: 700, cursor: pwdLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                                        {pwdLoading ? <><RefreshCw size={16} className="spin" /> Đang xử lý...</> : <><Lock size={16} /> Đổi mật khẩu</>}
                                    </button>
                                </div>
                                <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>💡 Quên mật khẩu hiện tại?</span>
                                    <button type="button" onClick={() => setShowInternalForgotPW(true)} style={{ background: 'none', border: 'none', color: '#0fa9ac', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Khôi phục qua Email</button>
                                </div>
                                <InternalForgotPasswordModal isOpen={showInternalForgotPW} onClose={() => setShowInternalForgotPW(false)} userEmail={user?.email} />
                                <EmailVerificationModal 
                                    isOpen={showEmailVerify} 
                                    onClose={() => setShowEmailVerify(false)} 
                                    newEmail={pendingEmailChange} 
                                    onSuccess={(newEmailAddr) => {
                                        updateUser({ email: newEmailAddr });
                                        onToast?.('Cập nhật email thành công! ✅', 'success');
                                    }} 
                                />
                            </div>
                        </Card>
                    )}

                    {/* ── Khiếu nại ── */}
                    {section === 'complaint' && (
                        <Card>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Megaphone size={18} color="var(--primary)" /> Gửi khiếu nại / Phản hồi
                            </div>
                            <MsgBar msg={complaintMsg} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={labelStyle}>Danh mục</label>
                                    <select style={{ ...inputStyle, background: 'white' }} value={complaint.category} onChange={e => setComplaint(p => ({ ...p, category: e.target.value, referenceId: '' }))}>
                                        <option value="SERVICE">Dịch vụ khám chữa bệnh</option>
                                        <option value="STAFF">Thái độ nhân viên</option>
                                        <option value="BILLING">Hóa đơn / Chi phí</option>
                                        <option value="APPOINTMENT">Lịch hẹn</option>
                                        <option value="OTHER">Khác</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Tiêu đề *</label>
                                    <input style={inputStyle} value={complaint.subject} onChange={e => setComplaint(p => ({ ...p, subject: e.target.value }))} placeholder="Tóm tắt vấn đề của bạn"
                                        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={labelStyle}>Đính kèm tài liệu liên quan (Tùy chọn)</label>
                                <select style={{ ...inputStyle, background: 'white' }} value={complaintLinkType} onChange={e => { setComplaintLinkType(e.target.value); setComplaint(p => ({ ...p, referenceId: '' })); }}>
                                    <option value="NONE">Không đính kèm</option>
                                    <option value="APPOINTMENT">Lịch hẹn</option>
                                    <option value="BILLING">Hóa đơn</option>
                                    <option value="MEDICAL_RECORD">Bệnh án</option>
                                    <option value="GROOMING">Spa - Cắt tỉa (Grooming)</option>
                                    <option value="VACCINATION">Hồ sơ Tiêm phòng</option>
                                </select>
                            </div>

                            {complaintLinkType === 'BILLING' && referenceInvoices.length > 0 && (
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={labelStyle}>Chọn Hóa đơn *</label>
                                    <select style={{ ...inputStyle, background: 'white' }} value={complaint.referenceId} onChange={e => setComplaint(p => ({ ...p, referenceId: e.target.value }))}>
                                        <option value="">-- Chọn Hóa đơn --</option>
                                        {referenceInvoices.map(inv => (
                                            <option key={inv._id} value={inv._id}>Hóa đơn #{inv.invoiceNumber || inv._id.slice(-6).toUpperCase()} - Ngày {new Date(inv.createdAt).toLocaleDateString('vi-VN')} - {(inv.finalTotal || inv.finalAmount || 0).toLocaleString()}đ</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {complaintLinkType === 'APPOINTMENT' && referenceApts.length > 0 && (
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={labelStyle}>Chọn Lịch hẹn *</label>
                                    <select style={{ ...inputStyle, background: 'white' }} value={complaint.referenceId} onChange={e => setComplaint(p => ({ ...p, referenceId: e.target.value }))}>
                                        <option value="">-- Chọn Lịch hẹn --</option>
                                        {referenceApts.filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'BOOKED').map(apt => (
                                            <option key={apt._id} value={apt._id}>
                                                Lịch {apt.type === 'GROOMING' ? 'Grooming' : 'Khám'} {apt.petId?.name ? `bé ${apt.petId.name}` : '#'+apt._id.slice(-4).toUpperCase()} ngày {new Date(apt.date).toLocaleDateString('vi-VN')} {apt.timeSlot}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {complaintLinkType === 'MEDICAL_RECORD' && referenceRecords.length > 0 && (
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={labelStyle}>Chọn Bệnh án *</label>
                                    <select style={{ ...inputStyle, background: 'white' }} value={complaint.referenceId} onChange={e => setComplaint(p => ({ ...p, referenceId: e.target.value }))}>
                                        <option value="">-- Chọn Bệnh án --</option>
                                        {referenceRecords.map(r => (
                                            <option key={r._id} value={r._id}>Bệnh án {r.injectedPetName} - {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''} - {(r.diagnosis || 'Không rõ').slice(0, 30)}{r.diagnosis?.length > 30 ? '...' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {complaintLinkType === 'GROOMING' && referenceGroomings.length > 0 && (
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={labelStyle}>Chọn Phiếu Spa (Grooming) *</label>
                                    <select style={{ ...inputStyle, background: 'white' }} value={complaint.referenceId} onChange={e => setComplaint(p => ({ ...p, referenceId: e.target.value }))}>
                                        <option value="">-- Chọn Phiếu Spa --</option>
                                        {referenceGroomings.map(g => (
                                            <option key={g._id} value={g._id}>Spa {g.injectedPetName} - {g.createdAt ? new Date(g.createdAt).toLocaleDateString('vi-VN') : ''} - {g.services?.[0]?.name || g.pets?.[0]?.services?.[0]?.name || 'Combo cơ bản'}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {complaintLinkType === 'VACCINATION' && referenceVaccinations.length > 0 && (
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={labelStyle}>Chọn Hồ sơ Tiêm phòng *</label>
                                    <select style={{ ...inputStyle, background: 'white' }} value={complaint.referenceId} onChange={e => setComplaint(p => ({ ...p, referenceId: e.target.value }))}>
                                        <option value="">-- Chọn Mũi tiêm --</option>
                                        {referenceVaccinations.map(v => (
                                            <option key={v._id} value={v._id}>Tiêm {v.injectedPetName} - {v.administeredDate ? new Date(v.administeredDate).toLocaleDateString('vi-VN') : ''} - {v.vaccineName}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>Nội dung chi tiết *</label>
                                <textarea rows={5} style={{ ...inputStyle, resize: 'vertical' }} value={complaint.content} onChange={e => setComplaint(p => ({ ...p, content: e.target.value }))} placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>Ảnh minh chứng (Tùy chọn)</label>
                                <input type="file" accept="image/*" style={{ ...inputStyle, background: 'white' }} onChange={e => setAttachmentFile(e.target.files[0])} />
                            </div>
                            <button onClick={() => {
                                if (!complaint.subject || !complaint.content) { setComplaintMsg({ type: 'error', text: 'Vui lòng điền tiêu đề và nội dung.' }); return; }
                                setComplaintMsg(null);
                                setIsConfirmingComplaint(true);
                            }} disabled={complaintLoading}
                                style={{ padding: '11px 28px', borderRadius: '10px', border: 'none', background: complaintLoading ? '#94a3b8' : 'var(--primary)', color: 'white', fontWeight: 700, cursor: complaintLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <MessageSquare size={16} /> Tiếp tục gửi
                            </button>
                            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: '#fdf4ff', fontSize: '0.8rem', color: '#7c3aed', border: '1px solid #e9d5ff' }}>
                                📌 Khiếu nại sẽ được xử lý trong <strong>1–3 ngày làm việc</strong>. Chúng tôi sẽ thông báo kết quả qua phần Lịch sử dưới đây.
                            </div>

                            {/* ── Ticket History ── */}
                            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px dashed #f1f5f9' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '16px', color: '#334155' }}>📋 Lịch sử phiếu báo cáo của bạn</div>
                                {tickets.length === 0 ? (
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>Bạn chưa gửi phiếu khiếu nại nào.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {tickets.map(t => (
                                            <div id={`ticket-${t._id}`} key={t._id} onClick={() => setSelectedTicket(t)} 
                                                style={{ border: '1px solid #e2e8f0', cursor: 'pointer', borderRadius: '12px', padding: '16px', background: t.status === 'RESOLVED' ? '#f0fdf4' : t.status === 'REJECTED' ? '#fef2f2' : 'white', transition: 'all 0.2s', boxShadow: highlightTicketId === t._id ? '0 0 0 3px rgba(15, 169, 172, 0.5), 0 8px 24px rgba(15, 169, 172, 0.2)' : 'none' }} 
                                                onMouseEnter={e => highlightTicketId === t._id ? null : (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)')} 
                                                onMouseLeave={e => highlightTicketId === t._id ? (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 169, 172, 0.5), 0 8px 24px rgba(15, 169, 172, 0.2)') : (e.currentTarget.style.boxShadow = 'none')}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.subject}</div>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', 
                                                        background: t.status === 'RESOLVED' ? '#dcfce7' : t.status === 'REJECTED' ? '#fee2e2' : '#fef9c3',
                                                        color: t.status === 'RESOLVED' ? '#166534' : t.status === 'REJECTED' ? '#991b1b' : '#854d0e' }}>
                                                        {t.status === 'RESOLVED' ? 'Đã giải quyết' : t.status === 'REJECTED' ? 'Từ chối' : t.status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Chờ duyệt'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.content}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Ngày gửi: {new Date(t.createdAt).toLocaleString('vi-VN')}</div>
                                                
                                                {t.adminNote && (
                                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '0.82rem' }}>
                                                        <strong style={{ color: t.status === 'RESOLVED' ? '#16a34a' : t.status === 'REJECTED' ? '#dc2626' : '#64748b' }}>↳ Phản hồi từ Admin:</strong> 
                                                        <div style={{ marginTop: '4px', color: '#334155', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.adminNote}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* ── Lịch sử đăng nhập ── */}
                    {section === 'history' && (
                        <Card>
                            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={18} color="var(--primary)" /> Lịch sử đăng nhập
                            </div>
                            {loginHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chưa có lịch sử đăng nhập nào được ghi lại.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {loginHistory.map((h, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', background: i === 0 ? '#f0fdf4' : '#f8fafc', border: `1px solid ${i === 0 ? '#bbf7d0' : '#e2e8f0'}` }}>
                                            <div style={{ flexShrink: 0, color: 'var(--primary)' }}>{h.device?.includes('di động') ? <Smartphone size={24} /> : <Laptop size={24} />}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                                                    {h.device} {i === 0 && <span style={{ padding: '2px 8px', borderRadius: '20px', background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', marginLeft: '6px' }}>Phiên hiện tại</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{h.browser} · {h.location}</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>
                                                {new Date(h.time).toLocaleString('vi-VN')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: '#fff7ed', fontSize: '0.8rem', color: '#c2410c', border: '1px solid #fed7aa' }}>
                                ⚠️ Nếu bạn thấy đăng nhập lạ, hãy <strong>đổi mật khẩu ngay</strong> và liên hệ hotline <strong>0909 123 456</strong>.
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Modal Xác nhận gửi khiếu nại */}
            {isConfirmingComplaint && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000 }} onClick={() => setIsConfirmingComplaint(false)}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: '32px 24px 24px', maxWidth: '420px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <MessageSquare size={32} />
                        </div>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>Xác nhận gửi phiếu</h3>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', textAlign: 'center', marginBottom: '28px', lineHeight: 1.5, padding: '0 10px' }}>
                            Bạn có chắc chắn muốn gửi phiếu khiếu nại / yêu cầu hỗ trợ này ngay bây giờ không?
                        </p>
                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                            <button className="btn btn-secondary" onClick={() => setIsConfirmingComplaint(false)} disabled={complaintLoading} style={{ flex: 1, padding: '12px' }}>
                                Trở lại
                            </button>
                            <button className="btn btn-primary" onClick={sendComplaint} disabled={complaintLoading} style={{ flex: 1, padding: '12px' }}>
                                {complaintLoading ? 'Đang gửi...' : 'Đồng ý gửi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Chi Tiết Phiếu (Ticket Detail) */}
            {selectedTicket && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1000 }} onClick={() => setSelectedTicket(null)}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: '0', maxWidth: '500px', width: '100%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'var(--surface)', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Chi tiết phiếu hỗ trợ</h3>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', 
                                background: selectedTicket.status === 'RESOLVED' ? '#dcfce7' : selectedTicket.status === 'REJECTED' ? '#fee2e2' : '#fef9c3',
                                color: selectedTicket.status === 'RESOLVED' ? '#166534' : selectedTicket.status === 'REJECTED' ? '#991b1b' : '#854d0e' }}>
                                {selectedTicket.status === 'RESOLVED' ? 'Đã giải quyết' : selectedTicket.status === 'REJECTED' ? 'Từ chối' : selectedTicket.status === 'IN_PROGRESS' ? 'Đang xử lý' : 'Chờ duyệt'}
                            </span>
                        </div>
                        <div className="modal-body" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Tiêu đề</label>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{selectedTicket.subject}</div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Nội dung chi tiết</label>
                                <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>{selectedTicket.content}</div>
                            </div>
                            {selectedTicket.attachment && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Ảnh minh chứng đính kèm</label>
                                    <a href={selectedTicket.attachment} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: 'var(--primary)', textDecoration: 'none' }}>
                                        <Camera size={16} /> Nhấn để xem ảnh đính kèm
                                    </a>
                                </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '20px' }}>
                                🕒 Ngày tạo: {new Date(selectedTicket.createdAt).toLocaleString('vi-VN')}
                            </div>
                            
                            {selectedTicket.adminNote && (
                                <div style={{ background: selectedTicket.status === 'RESOLVED' ? '#f0fdf4' : selectedTicket.status === 'REJECTED' ? '#fef2f2' : '#f8fafc', padding: '16px', borderRadius: '12px', border: `1px solid ${selectedTicket.status === 'RESOLVED' ? '#bbf7d0' : selectedTicket.status === 'REJECTED' ? '#fecaca' : '#e2e8f0'}` }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: selectedTicket.status === 'RESOLVED' ? '#166534' : selectedTicket.status === 'REJECTED' ? '#991b1b' : '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                                        ↳ Phản hồi từ Admin
                                    </label>
                                    <div style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {selectedTicket.adminNote}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setSelectedTicket(null)}>Đóng lại</button>
                        </div>
                    </div>
                </div>
            )}

            <EmailVerificationModal
                isOpen={showEmailVerify}
                onClose={() => setShowEmailVerify(false)}
                newEmail={pendingEmailChange}
                onSuccess={(newEmailAddr) => {
                    if (typeof updateUser === 'function') {
                        updateUser({ email: newEmailAddr });
                    } else if (typeof onUserUpdate === 'function') {
                        onUserUpdate((prev) => ({ ...prev, email: newEmailAddr }));
                    }
                    onToast?.('Cập nhật thay đổi email thành công! ✅', 'success');
                }}
            />
        </Wrap>
    );
}


// ── Tab: Lịch hẹn ─────────────────────────────────────────────────────────────
function BookingModal({ onClose, onSuccess, onToast }) {
    const [pets, setPets] = useState([]);
    const [services, setServices] = useState([]);
    const [form, setForm] = useState({ petId: '', type: 'MEDICAL', category: 'REGULAR', date: '', timeSlot: '', customerNotes: '' });
    const [selectedPetsInfo, setSelectedPetsInfo] = useState({}); // { [petId]: [serviceId1, serviceId2] }
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const SLOTS_SANG = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
    const SLOTS_CHIEU = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    useEffect(() => {
        Promise.all([
            axios.get(`${API}/pets`, { headers: H() }),
            axios.get(`${API}/services/public`),
        ]).then(([p, s]) => {
            if (p.data.success) setPets(p.data.data);
            if (s.data.success) setServices(s.data.data.filter(x => x.isActive !== false && x.type !== 'SURCHARGE'));
        });
    }, []);

    const togglePetGrooming = (id) => {
        setSelectedPetsInfo(prev => {
            if (prev[id]) {
                const next = { ...prev };
                delete next[id];
                return next;
            } else {
                return { ...prev, [id]: [] };
            }
        });
    };

    const toggleServiceForPet = (petId, serviceId) => {
        setSelectedPetsInfo(prev => {
            const currentServices = prev[petId] || [];
            const isSelected = currentServices.includes(serviceId);
            return {
                ...prev,
                [petId]: isSelected ? currentServices.filter(id => id !== serviceId) : [...currentServices, serviceId]
            };
        });
    };

    const submit = async () => {
        if (form.type === 'GROOMING' && Object.keys(selectedPetsInfo).length === 0) { setError('Vui lòng chọn ít nhất 1 thú cưng.'); return; }
        if (form.type === 'MEDICAL' && !form.petId) { setError('Vui lòng chọn thú cưng.'); return; }
        if (!form.date || !form.timeSlot) { setError('Vui lòng chọn ngày và giờ hẹn.'); return; }
        setSubmitting(true); setError('');
        try {
            if (form.type === 'GROOMING') {
                const petIds = Object.keys(selectedPetsInfo);
                const promises = petIds.map(petId => {
                    const serviceIds = selectedPetsInfo[petId];
                    return axios.post(`${API}/appointments`, {
                        petId, petIds: [], date: form.date, timeSlot: form.timeSlot,
                        customerNotes: form.customerNotes, type: form.type, category: form.category,
                        serviceIds, serviceId: serviceIds[0] || undefined
                    }, { headers: H() });
                });
                await Promise.all(promises);
                onToast?.('Lịch hẹn Grooming cho các bé đã đặt thành công!', 'success');
                onSuccess();
                onClose();
            } else {
                const r = await axios.post(`${API}/appointments`, {
                    petId: form.petId, petIds: [], date: form.date, timeSlot: form.timeSlot,
                    customerNotes: form.customerNotes, type: form.type, category: form.category, serviceIds: []
                }, { headers: H() });
                if (r.data.success) {
                    onToast?.('Lịch hẹn đã được đặt thành công! Chúng tôi sẽ xác nhận sớm.', 'success');
                    onSuccess();
                    onClose();
                } else setError(r.data.message || 'Có lỗi xảy ra.');
            }
        } catch (e) { setError(e.response?.data?.message || 'Có lỗi xảy ra.'); }
        finally { setSubmitting(false); }
    };
    const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
    return (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 9999 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
            <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, maxWidth: '460px', width: '100%', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                {/* Header cố định */}
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Đặt lịch hẹn mới</h2>
                    <button className="modal-close-btn" onClick={onClose}><X size={18} strokeWidth={2.5}/></button>
                </div>
                {/* Body cuộn */}
                <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(92vh - 140px)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {error && <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>{error}</div>}
                    <div>
                        <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                            Thú cưng * {form.type === 'GROOMING' && <span style={{ color: '#94a3b8', fontWeight: 400 }}>(chọn một hoặc nhiều)</span>}
                        </label>
                        {form.type === 'GROOMING' ? (
                            // Multi-select checkboxes cho Grooming kèm chọn dịch vụ từng bé
                            pets.length === 0 ? (
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Bạn chưa có thú cưng nào.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {pets.map(p => {
                                        const checked = !!selectedPetsInfo[p._id];
                                        return (
                                            <div key={p._id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', borderRadius: '12px', border: `1.5px solid ${checked ? 'var(--primary)' : '#e2e8f0'}`, background: checked ? '#f0fdfa' : '#fafafa', transition: 'all 0.15s' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={checked} onChange={() => togglePetGrooming(p._id)} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', flexShrink: 0 }} />
                                                    <div>
                                                        <div style={{ fontWeight: checked ? 700 : 500, fontSize: '0.88rem', color: checked ? 'var(--primary)' : '#1e293b' }}>{p.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.species === 'DOG' ? '🐶' : p.species === 'CAT' ? '🐱' : '🐾'} {p.breed || p.species}</div>
                                                    </div>
                                                </label>
                                                {/* Render services selection for this pet if selected */}
                                                {checked && (
                                                    <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '2px' }}>Dịch vụ cho {p.name}:</div>
                                                        {services.filter(s => s.type === 'GROOMING' || !s.type).map(sv => {
                                                            const svChecked = (selectedPetsInfo[p._id] || []).includes(sv._id);
                                                            return (
                                                                <label key={sv._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', background: svChecked ? '#e0f2fe' : 'transparent' }}>
                                                                    <input type="checkbox" checked={svChecked} onChange={() => toggleServiceForPet(p._id, sv._id)} style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }} />
                                                                    <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                                                                        {sv.name} <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>— {(sv.price || 0).toLocaleString()}đ</span>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                        {(selectedPetsInfo[p._id] || []).length === 0 && (
                                                            <div style={{ fontSize: '0.72rem', color: '#ef4444', fontStyle: 'italic', marginTop: '4px' }}>* Vui lòng chọn ít nhất 1 dịch vụ</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        ) : (
                            // Single select cho Khám bệnh / Tiêm / Tái khám
                            <select style={inp} value={form.petId} onChange={e => setForm(f => ({ ...f, petId: e.target.value }))}>
                                <option value=''>-- Chọn thú cưng --</option>
                                {pets.map(p => <option key={p._id} value={p._id}>{p.name} ({p.species})</option>)}
                            </select>
                        )}
                    </div>
                    <div>
                        <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Loại dịch vụ *</label>
                        <select style={inp} value={form.type === 'GROOMING' ? 'GROOMING' : form.category} onChange={e => {
                            const v = e.target.value;
                            if (v === 'GROOMING') setForm(f => ({ ...f, type: 'GROOMING', category: 'REGULAR', serviceIds: [], petIds: [], petId: '' }));
                            else setForm(f => ({ ...f, type: 'MEDICAL', category: v, serviceIds: [], petIds: [], petId: '' }));
                        }}>
                            <option value='REGULAR'>Khám bệnh</option>
                            <option value='VACCINATION'>Tiêm phòng</option>
                            <option value='FOLLOW_UP'>Tái khám</option>
                            <option value='GROOMING'>Grooming / Làm đẹp</option>
                        </select>
                    </div>
                    {form.type === 'MEDICAL' && (
                        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#f0fdfa', border: '1px solid #99f6e4', fontSize: '0.82rem', color: '#0f766e' }}>
                            Dịch vụ y tế sẽ được bác sĩ chỉ định trong quá trình khám — không cần chọn trước.
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Ngày hẹn *</label>
                            <input type='date' style={inp} value={form.date} min={new Date().toISOString().split('T')[0]} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Giờ hẹn *</label>
                            <select style={inp} value={form.timeSlot} onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))}>
                                <option value=''>-- Chọn giờ --</option>
                                <optgroup label="🌅 Ca sáng (08:00 – 11:30)">
                                    {SLOTS_SANG.map(s => <option key={s} value={s}>{s}</option>)}
                                </optgroup>
                                <optgroup label="☀️ Ca chiều (13:00 – 16:30)">
                                    {SLOTS_CHIEU.map(s => <option key={s} value={s}>{s}</option>)}
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Ghi chú</label>
                        <textarea rows={2} style={{ ...inp, resize: 'none' }} placeholder='Triệu chứng, yêu cầu khác...' value={form.customerNotes} onChange={e => setForm(f => ({ ...f, customerNotes: e.target.value }))} />
                    </div>
                </div>{/* end body */}
                {/* Footer cố định */}
                <div className="modal-footer" style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, padding: '11px' }}>Hủy</button>
                    <button className="btn btn-primary" onClick={submit} disabled={submitting} style={{ flex: 1, padding: '11px' }}>{submitting ? 'Đang đặt...' : 'Xác nhận đặt lịch'}</button>
                </div>
            </div>
        </div>
    );
}

function RatingModal({ apt, onClose, onSuccess }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const submit = async () => {
        setSubmitting(true);
        try {
            const r = await axios.post(`${API}/appointments/${apt._id}/rate`, { rating, feedback: comment }, { headers: H() });
            if (r.data.success) { onSuccess(); onClose(); }
            else setError(r.data.message || 'Có lỗi xảy ra.');
        } catch (e) { setError(e.response?.data?.message || 'Có lỗi xảy ra.'); }
        finally { setSubmitting(false); }
    };
    return (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 9999 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
            <div className="modal-container glass-card animate-slide-up" style={{ padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#fbbf24' }}><Star size={40} fill="currentColor" strokeWidth={1}/></div>
                <h2 style={{ margin: '0 0 6px', fontWeight: 800 }}>Đánh giá dịch vụ</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 20px' }}>{apt.petId?.name} – {apt.date ? new Date(apt.date).toLocaleDateString('vi-VN') : ''}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s <= rating ? '#fbbf24' : '#e2e8f0', transition: 'color 0.15s' }}>
                            <Star fill="currentColor" size={36} strokeWidth={1} />
                        </button>
                    ))}
                </div>
                <textarea rows={3} placeholder='Nhận xét của bạn (tùy chọn)...' value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: error ? '10px' : '16px' }} />
                {error && <div style={{ padding: '8px', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', fontSize: '0.82rem', marginBottom: '12px', fontWeight: 600 }}>{error}</div>}
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1, padding: '12px' }}>Bỏ qua</button>
                    <button className="btn btn-primary" onClick={submit} disabled={submitting} style={{ flex: 1, padding: '12px' }}>{submitting ? 'Đang gửi...' : 'Gửi đánh giá'}</button>
                </div>
            </div>
        </div>
    );
}

function AppointmentsTab() {
    const { user } = useAuth();
    const location = useLocation();
    const highlightId = location.state?.highlightAptId;
    const [apts, setApts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newBadgeIds, setNewBadgeIds] = useState([]);
    const [filter, setFilter] = useState('all');
    const [showBooking, setShowBooking] = useState(false);
    const [ratingApt, setRatingApt] = useState(null);
    const [cancelApt, setCancelApt] = useState(null);   // apt cần hủy
    const [rejectApt, setRejectApt] = useState(null);   // apt đang chờ xác nhận từ chối
    const [rescheduleApt, setRescheduleApt] = useState(null); // apt cần đổi lịch
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const { showToast } = useToast();

    const load = useCallback(() => {
        setLoading(true);
        axios.get(`${API}/appointments`, { headers: H() })
            .then(r => {
                if (r.data.success) {
                    const aptList = r.data.data;
                    setApts(aptList);

                    const userIdStr = user?._id || 'guest';
                    const seenNewApts = JSON.parse(localStorage.getItem(`seen_new_apts_${userIdStr}`)) || [];
                    const justSeen = [];

                    aptList.forEach(apt => {
                        if (apt.status === 'BOOKED' && apt.createdAt) {
                            const ageMs = new Date() - new Date(apt.createdAt);
                            if (ageMs < 2 * 60 * 60 * 1000) {
                                const isDoctorBooked = apt.bookingSource === 'DOCTOR' && ['FOLLOW_UP', 'VACCINATION'].includes(apt.category);
                                if (isDoctorBooked && !seenNewApts.includes(apt._id)) {
                                    justSeen.push(apt._id);
                                }
                            }
                        }
                    });

                    if (justSeen.length > 0) {
                        setNewBadgeIds(justSeen);
                        localStorage.setItem(`seen_new_apts_${userIdStr}`, JSON.stringify([...seenNewApts, ...justSeen]));
                    } else {
                        setNewBadgeIds([]);
                    }
                }
            })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (highlightId && apts.length > 0) {
            setTimeout(() => {
                const el = document.getElementById(`apt-${highlightId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }, [highlightId, apts]);

    const handleCancel = async () => {
        if (!cancelApt) return;
        setActionLoading(true);
        try {
            await axios.patch(`${API}/appointments/${cancelApt._id}/cancel`, {}, { headers: H() });
            showToast('Đã hủy lịch hẹn thành công');
            setCancelApt(null);
            load();
        } catch (e) {
            showToast(e.response?.data?.message || 'Không thể hủy lịch', 'error');
        } finally { setActionLoading(false); }
    };

    const handleReschedule = async () => {
        if (!rescheduleApt || !newDate || !newTime) return;
        setActionLoading(true);
        try {
            await axios.patch(`${API}/appointments/${rescheduleApt._id}/reschedule-self`, { date: newDate, timeSlot: newTime }, { headers: H() });
            showToast('Đã đổi lịch thành công');
            setRescheduleApt(null);
            load();
        } catch (e) {
            showToast(e.response?.data?.message || 'Không thể đổi lịch', 'error');
        } finally { setActionLoading(false); }
    };

    const handleConfirmReschedule = async (aptId, action) => {
        setActionLoading(true);
        try {
            await axios.patch(`${API}/appointments/${aptId}/reschedule-confirm`, { action }, { headers: H() });
            showToast(action === 'ACCEPT' ? 'Đã xác nhận lịch mới!' : 'Đã từ chối, lịch cũ được giữ nguyên.');
            setRejectApt(null);
            load();
        } catch (e) {
            showToast(e.response?.data?.message || 'Có lỗi xảy ra', 'error');
        } finally { setActionLoading(false); }
    };

    // Từ chối + Hủy luôn
    const handleRejectAndCancel = async (apt) => {
        setActionLoading(true);
        try {
            // 1. Từ chối đổi lịch
            await axios.patch(`${API}/appointments/${apt._id}/reschedule-confirm`, { action: 'REJECT' }, { headers: H() });
            // 2. Hủy luôn sau đó
            await axios.patch(`${API}/appointments/${apt._id}/cancel`, {}, { headers: H() });
            showToast('Đã hủy lịch hẹn.');
            setRejectApt(null);
            load();
        } catch (e) {
            showToast(e.response?.data?.message || 'Có lỗi xảy ra', 'error');
        } finally { setActionLoading(false); }
    };

    const APT_TYPE_LABEL = { APPOINTMENT: 'Khám bệnh', GROOMING: 'Grooming', VACCINATION: 'Tiêm phòng', WALKIN: 'Trực tiếp' };
    const displayed = filter === 'all' ? apts : apts.filter(a => a.status === filter);

    return (
        <Wrap>
            {showBooking && <BookingModal onClose={() => setShowBooking(false)} onSuccess={load} onToast={showToast} />}
            {ratingApt && <RatingModal apt={ratingApt} onClose={() => setRatingApt(null)} onSuccess={load} />}

            {/* Modal TỪ CHỐI ĐỔI LỊCH — hỏi có hủy luôn không */}
            {rejectApt && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setRejectApt(null)}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', border: '2px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <AlertCircle size={22} color="#dc2626" />
                        </div>
                        <h3 style={{ margin: '0 0 10px', fontWeight: 800, fontSize: '1.15rem' }}>Hệ thống đang bận</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 8px', lineHeight: '1.5' }}>
                            Phòng khám đã đề xuất lịch mới vì không giữ được lịch cũ do quá tải. Nếu bạn từ chối, lịch cũ sẽ được giữ lại <strong>nhưng có thể bị thay đổi sau</strong>.
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.85rem', margin: '0 0 24px' }}>
                            Bạn muốn làm gì?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => handleConfirmReschedule(rejectApt._id, 'REJECT')}
                                disabled={actionLoading}
                                style={{ padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}
                            >
                                {actionLoading ? 'Đang xử lý...' : 'Giữ lịch cũ (từ chối đổi lịch)'}
                            </button>
                            <button
                                onClick={() => handleRejectAndCancel(rejectApt)}
                                disabled={actionLoading}
                                style={{ padding: '12px', border: 'none', borderRadius: '12px', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}
                            >
                                {actionLoading ? 'Đang xử lý...' : 'Hủy lịch hẹn luôn'}
                            </button>
                            <button
                                onClick={() => setRejectApt(null)}
                                style={{ padding: '10px', border: 'none', background: 'none', color: '#94a3b8', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
                            >
                                ← Định lại sau
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal HỦY LỊCH */}
            {cancelApt && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setCancelApt(null)}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><CalendarDays size={24} /> Hủy lịch hẹn?</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 8px' }}>
                            <strong>{APT_TYPE_LABEL[cancelApt.invoiceType] || APT_TYPE_LABEL[cancelApt.type] || 'Khám bệnh'}</strong> cho <strong>{cancelApt.petId?.name}</strong>
                        </p>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 24px' }}>
                            📅 {new Date(cancelApt.date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })} lúc {cancelApt.timeSlot}
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setCancelApt(null)} style={{ flex: 1, padding: '11px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Giữ lịch</button>
                            <button onClick={handleCancel} disabled={actionLoading} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận hủy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal ĐỔI LỊCH */}
            {rescheduleApt && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setRescheduleApt(null)}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1.15rem' }}>🗓️ Đổi lịch hẹn</h3>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 20px' }}>{rescheduleApt.petId?.name} · {APT_TYPE_LABEL[rescheduleApt.invoiceType] || APT_TYPE_LABEL[rescheduleApt.type] || 'Khám bệnh'}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Ngày mới</label>
                                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Khung giờ mới</label>
                                <select value={newTime} onChange={e => setNewTime(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }}>
                                    <option value="">-- Chọn khung giờ --</option>
                                    {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button onClick={() => setRescheduleApt(null)} style={{ flex: 1, padding: '11px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Hủy bỏ</button>
                            <button onClick={handleReschedule} disabled={actionLoading || !newDate || !newTime}
                                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: (!newDate || !newTime) ? '#94a3b8' : 'var(--primary)', color: 'white', fontWeight: 700, cursor: (!newDate || !newTime) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Lịch hẹn của tôi</h1>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[['all', 'Tất cả'], ['BOOKED', 'Đã đặt'], ['RESCHEDULE_PENDING', 'Chờ xác nhận'], ['COMPLETED', 'Hoàn tất'], ['CANCELLED', 'Đã hủy']].map(([val, lbl]) => (
                        <button key={val} onClick={() => setFilter(val)} style={{ padding: '7px 16px', borderRadius: '20px', border: '1.5px solid', borderColor: filter === val ? (val === 'RESCHEDULE_PENDING' ? '#ea580c' : 'var(--primary)') : '#e2e8f0', background: filter === val ? (val === 'RESCHEDULE_PENDING' ? '#ea580c' : 'var(--primary)') : 'white', color: filter === val ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>{lbl}{val === 'RESCHEDULE_PENDING' && apts.filter(a => a.status === 'RESCHEDULE_PENDING').length > 0 ? ` (${apts.filter(a => a.status === 'RESCHEDULE_PENDING').length})` : ''}</button>
                    ))}
                    <button onClick={() => setShowBooking(true)} style={{ padding: '8px 18px', borderRadius: '20px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> Đặt lịch mới</button>
                </div>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
                : displayed.length === 0
                    ? <Card style={{ textAlign: 'center', padding: '60px' }}>
                        <Calendar size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
                        <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Không có lịch hẹn nào</div>
                        <button onClick={() => setShowBooking(true)} style={{ marginTop: '16px', padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Đặt lịch ngay</button>
                    </Card>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {displayed.sort((a, b) => {
                            const STATUS_ORDER = {
                                'RESCHEDULE_PENDING': 6,
                                'ARRIVED': 5,
                                'IN_PROGRESS': 4,
                                'READY_FOR_PAYMENT': 3,
                                'BOOKED': 2,
                                'COMPLETED': 1,
                                'CANCELLED': 0,
                            };
                            const prioA = STATUS_ORDER[a.status] ?? -1;
                            const prioB = STATUS_ORDER[b.status] ?? -1;
                            if (prioA !== prioB) return prioB - prioA;
                            // Cùng nhóm → sắp theo ngày
                            const dA = new Date(a.date || 0);
                            const dB = new Date(b.date || 0);
                            if (a.status === 'COMPLETED' || a.status === 'CANCELLED') {
                                // Mới nhất hiện trước
                                return dB - dA;
                            }
                            // BOOKED / active: ngày gần nhất trước
                            return dA - dB;
                        }).map(apt => {
                            const st = APT_STATUS[apt.status] || APT_STATUS.BOOKED;
                            const aptDate = apt.status === 'RESCHEDULE_PENDING' && apt.proposedDate
                                ? new Date(apt.proposedDate) : new Date(apt.date);
                            const canCancel = ['BOOKED', 'RESCHEDULE_PENDING'].includes(apt.status);
                            const canReschedule = apt.status === 'BOOKED';

                            // Type + category → badge
                            let typeInfo;
                            if (apt.type === 'GROOMING') {
                                typeInfo = { label: 'Grooming', color: '#7c3aed', bg: '#f5f3ff' };
                            } else if (apt.category === 'VACCINATION') {
                                typeInfo = { label: 'Tiêm phòng', color: '#2563eb', bg: '#eff6ff' };
                            } else if (apt.category === 'FOLLOW_UP') {
                                typeInfo = { label: 'Tái khám', color: '#ea580c', bg: '#fff7ed' };
                            } else if (apt.category === 'WALKIN') {
                                typeInfo = { label: 'Trực tiếp', color: '#0369a1', bg: '#f0f9ff' };
                            } else {
                                typeInfo = { label: 'Khám bệnh', color: '#0f766e', bg: '#f0fdfa' };
                            }

                            const isPending = apt.status === 'RESCHEDULE_PENDING';
                            const todayStr = new Date().toLocaleDateString('vi-VN');
                            const isToday = aptDate.toLocaleDateString('vi-VN') === todayStr && ['BOOKED', 'ARRIVED', 'IN_PROGRESS', 'READY_FOR_PAYMENT'].includes(apt.status);

                            return (
                                <div key={apt._id} id={`apt-${apt._id}`} style={{
                                    borderRadius: '12px',
                                    background: isToday ? '#f0fdf4' : 'white',
                                    border: isPending ? '2px solid #fb923c' : (isToday ? '2px solid #10b981' : '1px solid #e2e8f0'),
                                    overflow: 'hidden',
                                    boxShadow: highlightId === apt._id ? '0 0 0 3px rgba(15, 169, 172, 0.5), 0 8px 24px rgba(15, 169, 172, 0.2)' : (isToday ? '0 4px 14px rgba(16, 185, 129, 0.2)' : '0 1px 4px rgba(0,0,0,0.04)'),
                                    position: 'relative',
                                    transition: 'box-shadow 0.4s ease'
                                }}>
                                    {/* Nếu là hôm nay, hiện thêm nhãn nhỏ góc phải */}
                                    {isToday && (
                                        <div style={{ position: 'absolute', top: 0, right: 0, background: '#10b981', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '2px 10px', borderBottomLeftRadius: '8px', letterSpacing: '0.05em' }}>
                                            HÔM NAY
                                        </div>
                                    )}
                                    {/* ── Main row ── */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
                                        {/* Color bar */}
                                        <div style={{ width: '4px', alignSelf: 'stretch', borderRadius: '2px', background: typeInfo.color, flexShrink: 0 }} />

                                        {/* Date */}
                                        <div style={{ textAlign: 'center', minWidth: '40px', flexShrink: 0 }}>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: typeInfo.color, lineHeight: 1 }}>{aptDate.getDate()}</div>
                                            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{aptDate.toLocaleDateString('vi-VN', { month: 'short' })}</div>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{aptDate.toLocaleDateString('vi-VN', { weekday: 'short' })}</div>
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{apt.petId?.name || 'Thú cưng'}</span>
                                                {newBadgeIds.includes(apt._id) && (
                                                    <span title="Lịch hẹn mới được đặt" style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 900, background: '#ef4444', color: 'white', letterSpacing: '0.05em', animation: 'pulseDot 2s infinite', display: 'inline-flex' }}>NEW</span>
                                                )}
                                                {apt.petId?.species && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 7px', borderRadius: '10px' }}>{apt.petId.species}</span>}
                                                <span style={{ padding: '2px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: typeInfo.bg, color: typeInfo.color }}>{typeInfo.label}</span>
                                                {isPending && <span style={{ padding: '2px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: '#fff7ed', color: '#c2410c' }}>Cần xác nhận</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.73rem', color: '#64748b' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={11} /> {apt.timeSlot || '--'}</span>
                                                {(apt.serviceIds?.length > 0 ? apt.serviceIds.map(s => s.name).join(', ') : apt.serviceId?.name) && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Activity size={11} /> {apt.serviceIds?.length > 0 ? apt.serviceIds.map(s => s.name).join(', ') : apt.serviceId?.name}</span>
                                                )}
                                                {apt.staffId?.fullName && <span>· BS/KTV {apt.staffId.fullName}</span>}
                                            </div>
                                            {apt.staffNotes && (
                                                <div style={{ marginTop: '4px', fontSize: '0.71rem', color: '#047857', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                                    <FileText size={10} /> {apt.staffNotes}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status pill */}
                                        <span style={{ padding: '4px 11px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {st.icon}{st.label}
                                        </span>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>

                                            {canReschedule && (
                                                <button onClick={() => { setRescheduleApt(apt); setNewDate(''); setNewTime(''); }} title="Đổi lịch"
                                                    style={{ padding: '6px', border: '1.5px solid var(--primary)', borderRadius: '8px', background: 'white', color: 'var(--primary)', cursor: 'pointer' }}>
                                                    <RefreshCw size={14} />
                                                </button>
                                            )}
                                            {canCancel && (
                                                <button onClick={() => setCancelApt(apt)} title="Hủy lịch"
                                                    style={{ padding: '6px', border: 'none', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Reschedule pending banner ── */}
                                    {isPending && (
                                        <div style={{ padding: '10px 14px 12px 60px', background: '#fff7ed', borderTop: '1px dashed #fed7aa' }}>
                                            <div style={{ fontSize: '0.78rem', color: '#c2410c', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Bell size={14} /> Phòng khám đề xuất đổi lịch:&nbsp;
                                                <span style={{ fontWeight: 800 }}>
                                                    {apt.proposedDate ? new Date(apt.proposedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }) : '?'} lúc {apt.proposedTimeSlot || '?'}
                                                </span>
                                            </div>
                                            {apt.rescheduleNote && <div style={{ fontSize: '0.75rem', color: '#9a3412', marginBottom: '8px', fontStyle: 'italic' }}>Lý do: {apt.rescheduleNote}</div>}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleConfirmReschedule(apt._id, 'ACCEPT')} disabled={actionLoading}
                                                    style={{ padding: '6px 16px', border: 'none', borderRadius: '8px', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                    {actionLoading ? '...' : 'Đồng ý'}
                                                </button>
                                                <button onClick={() => setRejectApt(apt)} disabled={actionLoading}
                                                    style={{ padding: '6px 16px', border: 'none', borderRadius: '8px', background: '#ef4444', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                    {actionLoading ? '...' : 'Từ chối'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Customer notes ── */}
                                    {apt.notes && (
                                        <div style={{ padding: '6px 14px 8px 60px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: '0.73rem', color: '#475569' }}>
                                            {apt.notes}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>}
        </Wrap>
    );
}



// ── Tab: Thú cưng (with medical history + vaccinations) ─────────────────────
function PetDetailPage({ pet, onBack, initialTab = 'records', onUpdate }) {
    const [records, setRecords] = useState([]);
    const [vaccines, setVaccines] = useState([]);
    const [groomings, setGroomings] = useState([]);
    const [tab, setTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [zoomImg, setZoomImg] = useState(null);
    const [zScale, setZScale] = useState(1);
    const [zPan, setZPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Edit Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    
    // Khởi tạo Toast
    const { toast } = useToast() || { toast: window.alert };

    // Tải lên ảnh thủ cưng (Upload trực tiếp lên Cloudinary)
    const handlePetAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preview ngay lập tức trên UI
        const localPreview = URL.createObjectURL(file);
        setPet(p => ({ ...p, avatar: localPreview }));
        setAvatarLoading(true);

        try {
            const formData = new FormData();
            formData.append('image', file);
            const token = sessionStorage.getItem('token');
            
            // 1. Upload lên Cloudinary
            const uploadRes = await axios.post(`${API}/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
            
            if (uploadRes.data.success) {
                const cloudUrl = uploadRes.data.data.imageUrl;
                
                // 2. Lưu link Cloudinary vào CSDL của Thú Cưng
                const updateRes = await axios.put(`${API}/pets/${pet._id}`, { avatar: cloudUrl }, { headers: { Authorization: `Bearer ${token}` } });
                
                if (updateRes.data.success) {
                    setPet(updateRes.data.data);
                    if (onUpdate) onUpdate(updateRes.data.data); // optional re-fetch parent list
                    toast('Đã cập nhật ảnh thú cưng thành công! 🐾', 'success');
                }
            }
        } catch (error) {
            console.error('Lỗi khi upload ảnh pet:', error);
            toast('Lỗi khi tải ảnh lên, vui lòng thử lại.', 'error');
            // Revert ảnh cũ
            setPet(p => ({ ...p, avatar: initialPet?.avatar || '' }));
        } finally {
            setAvatarLoading(false);
        }
    };

    useEffect(() => {
        Promise.all([
            axios.get(`${API}/records/pet/${pet._id}`, { headers: H() }),
            axios.get(`${API}/vaccinations/pet/${pet._id}`, { headers: H() }),
            axios.get(`${API}/grooming/pet/${pet._id}`, { headers: H() })
        ]).then(([r, v, g]) => {
            if (r.data.success) setRecords(r.data.data || []);
            if (v.data.success) setVaccines(v.data.data || []);
            if (g.data.success) setGroomings(g.data.data || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [pet._id]);

    const tabs2 = [
        { id: 'records', label: 'Lịch sử khám', count: records.length, icon: <History size={15} /> },
        { id: 'vaccines', label: 'Tiêm phòng', count: vaccines.length, icon: <Syringe size={15} /> },
        { id: 'grooming', label: 'Spa & Làm đẹp', count: groomings.length, icon: <Scissors size={15} /> },
        { id: 'info', label: 'Hồ sơ', count: null, icon: <Info size={15} /> },
    ];

    return (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
            {/* Back button + header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    ← Quay lại
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Hồ sơ thú cưng → <strong style={{ color: 'var(--text-main)' }}>{pet.name}</strong></span>
            </div>

            {/* Pet overview strip */}
            <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, var(--primary-light) 0%, #f0fdfe 100%)', border: '1.5px solid rgba(15,169,172,0.18)' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ 
                        width: '80px', height: '80px', borderRadius: '20px', background: 'white', border: '2px solid rgba(15,169,172,0.2)', 
                        overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)', position: 'relative', cursor: avatarLoading ? 'not-allowed' : 'pointer' 
                    }}>
                        {pet.avatar ? <img src={pet.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: avatarLoading ? 0.3 : 1 }} /> : <PawPrint size={36} color="var(--primary)" style={{ opacity: avatarLoading ? 0.3 : 1 }} />}
                        
                        {/* Biểu tượng Loading hoặc Camera Overlay */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: avatarLoading ? 'transparent' : 'rgba(0,0,0,0.2)', opacity: avatarLoading ? 1 : 0, transition: 'opacity 0.2s', ':hover': { opacity: 1 } }}>
                            {avatarLoading ? <RefreshCw size={24} color="var(--primary)" className="spin" /> : <Camera size={24} color="white" />}
                        </div>
                        
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                            <Camera size={14} />
                        </div>

                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={avatarLoading} onChange={handlePetAvatarChange} />
                    </label>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-main)' }}>{pet.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</div>
                    </div>
                    {/* Quick stats - Standardized Colors */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {pet.gender && <div style={{ textAlign: 'center', padding: '10px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '70px' }}>
                            <div style={{ fontSize: '1.1rem', color: '#475569' }}>{pet.gender === 'MALE' ? '♂' : '♀'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>{pet.gender === 'MALE' ? 'Đực' : 'Cái'}</div>
                        </div>}
                        {pet.weight && <div style={{ textAlign: 'center', padding: '10px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '70px' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>{pet.weight}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>kg</div>
                        </div>}
                        {(pet.birthDate || pet.age) && <div style={{ textAlign: 'center', padding: '10px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '70px' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#475569' }}>{pet.age ? pet.age : (new Date().getFullYear() - new Date(pet.birthDate).getFullYear())}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>tuổi</div>
                        </div>}
                        <div style={{ textAlign: 'center', padding: '10px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '70px' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#475569' }}>{records.length}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>lần khám</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '10px 16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '70px' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#475569' }}>{vaccines.length}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>mũi tiêm</div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {tabs2.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: tab === t.id ? '2.5px solid var(--primary)' : '2.5px solid transparent', marginBottom: '-2px', fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {t.icon} {t.label}{t.count !== null ? ` (${t.count})` : ''}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <Card style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</Card>
            ) : tab === 'info' ? (
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Thông tin hồ sơ</h3>
                        {!isEditing ? (
                            <button onClick={() => { setEditForm({ ...pet, birthDate: pet.birthDate ? pet.birthDate.split('T')[0] : '' }); setIsEditing(true); }} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                                <Edit2 size={14} /> Chỉnh sửa
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#64748b' }}><X size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Hủy</button>
                                <button onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        const res = await axios.put(`${API}/pets/${pet._id}`, editForm, { headers: H() });
                                        if (res.data.success && onUpdate) onUpdate(res.data.data);
                                        setIsEditing(false);
                                    } catch (err) {
                                        toast('Lỗi cập nhật: ' + (err.response?.data?.message || err.message), 'error');
                                    } finally { setIsSaving(false); }
                                }} disabled={isSaving} style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: isSaving ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {!isEditing ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                            {[['Tên gọi', pet.name], ['Giống loài', pet.species], ['Nòi giống', pet.breed||'Chưa rõ'], ['Giới tính', pet.gender==='MALE'?'♂ Đực':pet.gender==='FEMALE'?'♀ Cái':'Chưa rõ'], ['Tuổi', pet.age ? pet.age + ' tuổi' : 'Chưa rõ'], ['Cân nặng', pet.weight ? pet.weight+' kg' : 'Chưa rõ'], ['Ngày sinh', pet.birthDate ? fmtDate(pet.birthDate).split(' ')[0] : 'Chưa rõ']].map(([k,v]) => (
                                <div key={k} style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tên thú cưng *</label>
                                <input type="text" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Giới tính</label>
                                <select value={editForm.gender || 'UNKNOWN'} onChange={e => setEditForm({...editForm, gender: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box', background: 'white' }}>
                                    <option value="MALE">Đực ♂</option>
                                    <option value="FEMALE">Cái ♀</option>
                                    <option value="UNKNOWN">Chưa rõ</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Giống loài *</label>
                                <select value={editForm.species || 'DOG'} onChange={e => setEditForm({...editForm, species: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box', background: 'white' }}>
                                    <option value="DOG">Chó</option>
                                    <option value="CAT">Mèo</option>
                                    <option value="OTHER">Chó/Mèo/Khác</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Nòi giống</label>
                                <input type="text" value={editForm.breed || ''} onChange={e => setEditForm({...editForm, breed: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} placeholder="VD: Poodle" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Cân nặng (kg)</label>
                                <input type="number" step="0.1" value={editForm.weight || ''} onChange={e => setEditForm({...editForm, weight: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} placeholder="5.5" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tuổi</label>
                                <input type="number" value={editForm.age || ''} onChange={e => setEditForm({...editForm, age: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} placeholder="VD: 2" />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Ngày sinh</label>
                                <input type="date" value={editForm.birthDate || ''} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Ghi chú đặc biệt / Tiền sử bệnh</label>
                                <textarea rows="2" value={editForm.specialNotes || ''} onChange={e => setEditForm({...editForm, specialNotes: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }} placeholder="VD: Dị ứng với Vaccine A..." />
                            </div>
                        </div>
                    )}
                    {pet.specialNotes && !isEditing && <div style={{ marginTop: '16px', padding: '14px', background: '#fefce8', borderRadius: '12px', border: '1px solid #fef08a' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a16207', marginBottom: '6px', textTransform: 'uppercase' }}>📝 Ghi chú đặc biệt</div>
                        <div style={{ color: '#713f12', lineHeight: 1.6 }}>{pet.specialNotes}</div>
                    </div>}
                </Card>
            ) : tab === 'grooming' ? (
                groomings.length === 0
                    ? <Card style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '16px' }}>✂️</div>
                        <div>Chưa có lịch sử Spa & Grooming</div>
                    </Card>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {groomings.map((g, i) => (
                            <Card key={g._id || i} style={{ padding: '20px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e2e8f0' }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '4px' }}>{new Date(g.createdAt).toLocaleDateString('vi-VN')}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Trạng thái: <strong style={{ color: g.status === 'COMPLETED' ? '#10b981' : '#f59e0b' }}>{g.status}</strong></div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Nhân viên: <strong>{g.staffId?.fullName || 'Đang chờ phục vụ'}</strong></div>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '8px 14px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', border: '1px solid #e2e8f0' }}>
                                        {g.totalAmount?.toLocaleString('vi-VN')} ₫
                                    </div>
                                </div>

                                {(g.services?.length > 0 || g.pets.find(p => p.petId === pet._id)?.services?.length > 0) && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>DỊCH VỤ SỬ DỤNG:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {g.services?.map((svc, idx) => (
                                                <span key={idx} style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>{svc.name}</span>
                                            ))}
                                            {g.pets.find(p => p.petId === pet._id)?.services?.map((svc, idx) => (
                                                <span key={'p' + idx} style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>{svc.name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Hình ảnh Check-in / Check-out */}
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '12px' }}>HÌNH ẢNH SPA CỦA BÉ:</div>
                                    <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
                                        {g.beforeImage && (
                                            <div style={{ flex: '1', minWidth: '180px', maxWidth: '280px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={14} /> Ảnh Nhận Thú (Check-in)</div>
                                                <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                                                    <img src={g.beforeImage} alt="Before" 
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                                                        onClick={() => setZoomImg(g.beforeImage)} 
                                                    />
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', paddingLeft: '4px' }}>⏰ Nhận lúc: {g.checkinTime ? new Date(g.checkinTime).toLocaleTimeString('vi-VN') : ''}</div>
                                            </div>
                                        )}
                                        {g.afterImage && (
                                            <div style={{ flex: '1', minWidth: '180px', maxWidth: '280px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Ảnh Hoàn Tất (Check-out)</div>
                                                <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid #10b981', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)', aspectRatio: '4/3' }}>
                                                    <img src={g.afterImage} alt="After" 
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                                                        onClick={() => setZoomImg(g.afterImage)} 
                                                    />
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', paddingLeft: '4px' }}>⏰ Xong lúc: {g.checkoutTime ? new Date(g.checkoutTime).toLocaleTimeString('vi-VN') : ''}</div>
                                            </div>
                                        )}
                                        {!g.beforeImage && !g.afterImage && (
                                            <div style={{ flex: 1, padding: '30px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8' }}>
                                                <Camera size={32} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto' }} />
                                                <span style={{ fontSize: '0.85rem' }}>Đang chờ nhân viên cập nhật hình ảnh...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
            ) : tab === 'records' ? (
                records.length === 0
                    ? <Card style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><Stethoscope size={48} style={{ opacity: 0.12, display: 'block', margin: '0 auto 16px' }} />Chưa có lịch sử khám bệnh</Card>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {records.map((rec, i) => (
                            <Card key={rec._id || i} style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{fmtDate(rec.createdAt || rec.visitDate)}</div>
                                        {rec.doctorId && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>Bác sĩ: {rec.doctorId?.fullName || rec.doctorId}</div>}
                                    </div>
                                    <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#d1fae5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700 }}>Hoàn tất</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: rec.prescriptions?.length > 0 ? '14px' : 0 }}>
                                    {rec.diagnosis && <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '10px', border: '1px solid #fed7aa', gridColumn: rec.treatment ? '1' : '1/-1' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c2410c', marginBottom: '4px', textTransform: 'uppercase' }}>Chẩn đoán</div>
                                        <div style={{ fontSize: '0.88rem', color: '#7c2d12' }}>{rec.diagnosis}</div>
                                    </div>}
                                    {rec.treatment && <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', gridColumn: rec.diagnosis ? '2' : '1/-1' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', marginBottom: '4px', textTransform: 'uppercase' }}>Điều trị</div>
                                        <div style={{ fontSize: '0.88rem', color: '#14532d' }}>{rec.treatment}</div>
                                    </div>}
                                </div>
                                {rec.prescriptions?.length > 0 && (
                                    <div style={{ padding: '14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', marginBottom: '10px', textTransform: 'uppercase' }}>💊 Đơn thuốc ({rec.prescriptions.length} loại)</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {rec.prescriptions.map((p, j) => (
                                                <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: j < rec.prescriptions.length - 1 ? '8px' : 0, borderBottom: j < rec.prescriptions.length - 1 ? '1px dashed #bfdbfe' : 'none' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <span style={{ color: '#1e3a8a', fontWeight: 700, fontSize: '0.9rem' }}>{p.medicineName || p.name}</span>
                                                        <span style={{ color: '#3b82f6', fontWeight: 700, background: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.75rem', border: '1px solid #dbeafe' }}>SL: {p.quantity || 1} {p.unit || 'viên'}</span>
                                                    </div>
                                                    {p.dosageInstructions && <div style={{ fontSize: '0.8rem', color: '#1e40af', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                                        <span style={{ marginTop: '2px' }}>👉</span>
                                                        <span style={{ lineHeight: 1.4 }}><em>{p.dosageInstructions}</em></span>
                                                    </div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
            ) : (
                vaccines.length === 0
                    ? <Card style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}><span style={{ fontSize: '3rem', display: 'block', margin: '0 auto 16px' }}>💉</span>Chưa có lịch sử tiêm phòng</Card>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {vaccines.map((v, i) => {
                            const nextDate = v.nextDueDate ? new Date(v.nextDueDate) : null;
                            const isOverdue = nextDate && nextDate < new Date();
                            return (
                                <Card key={v._id || i} style={{ padding: '18px', border: `1.5px solid ${isOverdue ? '#fca5a5' : '#e2e8f0'}`, background: isOverdue ? '#fff5f5' : 'white' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>{v.vaccineName || v.name}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tiêm ngày: {fmtDate(v.administeredDate || v.createdAt)}{v.batchNumber ? ` · Lô: ${v.batchNumber}` : ''}</div>
                                            {nextDate && <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isOverdue ? '#ef4444' : '#10b981', marginTop: '4px' }}>{isOverdue ? '⚠️ Quá hạn nhắc lại' : '✅ Nhắc lại'}: {fmtDate(nextDate)}</div>}
                                        </div>
                                        <div style={{ padding: '6px 14px', borderRadius: '20px', background: isOverdue ? '#fee2e2' : '#d1fae5', color: isOverdue ? '#ef4444' : '#059669', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{isOverdue ? '⚠️ Quá hạn' : '✅ Hoàn tất'}</div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
            )}

            {/* ── ZOOM MODAL ── */}
            {zoomImg && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onWheel={(e) => {
                    e.preventDefault();
                    let newScale = zScale - e.deltaY * 0.005;
                    newScale = Math.min(Math.max(1, newScale), 5); // Tối đa zoom 5x
                    setZScale(newScale);
                    if (newScale === 1) setZPan({ x: 0, y: 0 }); // reset khi zoom out hết cỡ
                }}
                onMouseDown={(e) => {
                    if (zScale > 1) {
                        setIsDragging(true);
                        setDragStart({ x: e.clientX - zPan.x, y: e.clientY - zPan.y });
                    }
                }}
                onMouseMove={(e) => {
                    if (isDragging && zScale > 1) {
                        setZPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                    }
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onClick={(e) => { if (e.target === e.currentTarget && zScale === 1) setZoomImg(null); }}
                >
                    <button 
                        onClick={() => { setZoomImg(null); setZScale(1); setZPan({ x: 0, y: 0 }); }}
                        style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10000 }}
                    >
                        <X size={24} />
                    </button>
                    
                    <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(255,255,255,0.9)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', gap: '10px', alignItems: 'center', zIndex: 10000 }}>
                        <button onClick={() => setZScale(s => Math.max(1, s - 0.5))} style={{ background:'none', border:'none', cursor:'pointer' }}><Minus size={16}/></button>
                        <span>{Math.round(zScale * 100)}%</span>
                        <button onClick={() => setZScale(s => Math.min(5, s + 0.5))} style={{ background:'none', border:'none', cursor:'pointer' }}><Plus size={16}/></button>
                    </div>

                    <img src={zoomImg} alt="Zoomed" draggable={false}
                        style={{ 
                            maxHeight: '90vh', maxWidth: '90vw', 
                            objectFit: 'contain',
                            transform: `translate(${zPan.x}px, ${zPan.y}px) scale(${zScale})`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                        }} 
                    />
                </div>
            )}
        </div>
    );
}

function PetsTab({ initialPet, onClearInitial }) {
    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPet, setSelectedPet] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchPets = () => {
        setLoading(true);
        axios.get(`${API}/pets`, { headers: H() })
            .then(r => { if (r.data.success) setPets(r.data.data); })
            .catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchPets();
    }, []);

    if (loading) return <Wrap><div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div></Wrap>;

    // View chi tiết thú cưng (inline, không dùng modal)
    if (selectedPet) {
        return (
            <Wrap>
                <PetDetailPage pet={selectedPet} onBack={() => setSelectedPet(null)} onUpdate={(newPet) => { setSelectedPet(newPet); fetchPets(); }} />
            </Wrap>
        );
    }

    // View tổng quan: grid thú cưng
    return (
        <Wrap>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 24px', flexWrap: 'wrap', gap: '16px' }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Hồ sơ thú cưng</h1>
                <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15,169,172,0.3)', transition: 'all 0.2s', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <Plus size={18} /> Thêm thú cưng
                </button>
            </div>
            {pets.length === 0
                ? <Card style={{ textAlign: 'center', padding: '60px' }}><PawPrint size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} /><div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Chưa có thú cưng nào</div></Card>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '20px' }}>
                    {pets.map(pet => (
                        <Card key={pet._id} style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                            onClick={() => setSelectedPet(pet)}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.06)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--primary-light)', border: '2px solid rgba(15,169,172,0.15)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {pet.avatar ? <img src={pet.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PawPrint size={28} color="var(--primary)" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{pet.name}</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>{pet.species} · {pet.breed || 'Không rõ giống'}</div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                        {pet.gender && <span style={{ padding: '3px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>{pet.gender === 'MALE' ? '♂ Đực' : pet.gender === 'FEMALE' ? '♀ Cái' : 'Chưa rõ'}</span>}
                                        {pet.weight && <span style={{ padding: '3px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>{pet.weight} kg</span>}
                                        {(pet.birthDate || pet.age) && <span style={{ padding: '3px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>{pet.age ? pet.age : (new Date().getFullYear() - new Date(pet.birthDate).getFullYear())} tuổi</span>}
                                    </div>
                                    <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><ChevronRight size={13} /> Xem chi tiết</div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>}
            {showAddModal && <AddPetModal onClose={() => setShowAddModal(false)} onAdded={() => { setShowAddModal(false); fetchPets(); }} />}
        </Wrap>
    );
}

function AddPetModal({ onClose, onAdded }) {
    const [formData, setFormData] = useState({ name: '', species: 'DOG', breed: '', gender: 'MALE', weight: '', age: '', birthDate: '', specialNotes: '', avatar: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleImage = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return setError('Ảnh tối đa 2MB');
        const reader = new FileReader();
        reader.onloadend = () => setFormData({ ...formData, avatar: reader.result });
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!formData.name) return setError('Vui lòng nhập tên thú cưng');
        setLoading(true);
        try {
            await axios.post(`${API}/pets`, formData, { headers: H() });
            onAdded();
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi thêm thú cưng');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,169,172,0.15)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onMouseDown={e => { if(e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: 'white', width: '100%', maxWidth: '450px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 24px 50px rgba(0,0,0,0.15)', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Đăng ký Thú cưng mới</h2>
                    <button type="button" onClick={onClose} style={{ background: '#f8fafc', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                    {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, marginTop: '20px' }}>{error}</div>}
                    
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                        <label style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                            {formData.avatar ? <img src={formData.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={24} color="#94a3b8" />}
                            <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                        </label>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tên thú cưng *</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="VD: Milo, Lu..." required />
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Giống loài</label>
                            <select value={formData.species} onChange={e => setFormData({...formData, species: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' }}>
                                <option value="DOG">Chó</option>
                                <option value="CAT">Mèo</option>
                                <option value="OTHER">Lạc đà/Gà/Khác</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Giới tính</label>
                            <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' }}>
                                <option value="MALE">Đực ♂</option>
                                <option value="FEMALE">Cái ♀</option>
                                <option value="UNKNOWN">Chưa rõ</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Nòi giống (Tùy chọn)</label>
                            <input type="text" value={formData.breed} onChange={e => setFormData({...formData, breed: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="VD: Poodle, ta..." />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Cân nặng (kg)</label>
                            <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="VD: 5.5" />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Tuổi</label>
                            <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="VD: 2" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Ngày sinh (nếu có)</label>
                            <input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} style={{ marginTop: '10px', background: 'var(--primary)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }} onMouseEnter={e => { if(!loading) e.currentTarget.style.transform = 'scale(1.02)' }} onMouseLeave={e => { if(!loading) e.currentTarget.style.transform = 'scale(1)' }}>
                        {loading ? 'Đang lưu...' : 'Lưu hồ sơ'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Tab: Bảng giá ─────────────────────────────────────────────────────────────
function ServicesTab() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const TYPE_CFG = {
        MEDICAL: { label: 'Khám & Điều trị', icon: Stethoscope, color: '#0ea5e9', bg: '#e0f2fe' },
        GROOMING: { label: 'Spa & Grooming', icon: Scissors, color: '#8b5cf6', bg: '#ede9fe' },
        PRODUCT: { label: 'Sản phẩm', icon: Package, color: '#10b981', bg: '#d1fae5' },
        SURCHARGE: { label: 'Phụ phí', icon: Plus, color: '#f59e0b', bg: '#fef3c7' },
    };

    useEffect(() => {
        axios.get(`${API}/services/public`)
            .then(r => { if (r.data.success) setServices(r.data.data.filter(s => s.isActive !== false)); })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    const grouped = services.reduce((acc, s) => { const t = s.type || 'MEDICAL'; (acc[t] = acc[t] || []).push(s); return acc; }, {});

    return (
        <Wrap>
            <h1 style={{ margin: '0 0 24px', fontSize: '1.6rem', fontWeight: 800 }}>Bảng giá dịch vụ</h1>
            {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px' }}>
                    {Object.entries(grouped).map(([type, items]) => {
                        const cfg = TYPE_CFG[type] || { label: type, icon: Package, color: '#64748b', bg: '#f1f5f9' };
                        const Icon = cfg.icon;
                        return (
                            <Card key={type} style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '18px 22px', background: cfg.bg, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={cfg.color} /></div>
                                    <div><div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{cfg.label}</div><div style={{ fontSize: '0.78rem', color: cfg.color, fontWeight: 600 }}>{items.length} dịch vụ</div></div>
                                </div>
                                <div style={{ padding: '0 22px' }}>
                                    {items.map((s, i) => (
                                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < items.length - 1 ? '1px dashed #f1f5f9' : 'none' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{s.name}</div>
                                                {s.estimatedDuration && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>~{s.estimatedDuration} phút</div>}
                                            </div>
                                            <div style={{ fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{s.price ? `${fmt(s.price)}đ` : 'Liên hệ'}</div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        );
                    })}
                </div>}
        </Wrap>
    );
}

// ── Tab: Hóa đơn ─────────────────────────────────────────────────────────────────────────────
function buildInvoiceHTML(enriched, fmtFn, fmtDateTimeFn) {
    let petName = enriched.appointmentId?.petId?.name || enriched.medicalRecordId?.petId?.name;
    if (!petName && enriched.groomingOrderId?.pets) petName = enriched.groomingOrderId.pets.map(p => p.petId?.name).filter(Boolean).join(', ');
    if (!petName) petName = 'N/A';
    const doctorName = enriched.medicalRecordId?.doctorId?.fullName || enriched.appointmentId?.staffId?.fullName || '';
    const issuerName = enriched.createdBy?.fullName || enriched.staffId?.fullName || '................................';
    const custName = enriched.customerId?.fullName || 'Khách hàng';
    const custPhone = enriched.customerId?.phoneNumber || '';
    const INV_TYPE = { APPOINTMENT: 'Khám bệnh', WALKIN: 'Khám walk-in', GROOMING: 'Grooming', VACCINATION: 'Tiêm phòng', RETAIL: 'Bán lẻ' };
    const invDate = new Date(enriched.createdAt);
    const day = invDate.getDate();
    const month = invDate.getMonth() + 1;
    const year = invDate.getFullYear();
    const timeStr = invDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const statusLabel = enriched.status === 'PAID' ? 'ĐÃ THANH TOÁN' : 'CHờ THANH TOÁN';
    const isPaid = enriched.status === 'PAID';

    // Gom tất cả dịch vụ, dedup theo tên — tránh hiển thị trùng
    const svcList = [];
    const hasGroomingServices = (enriched.groomingOrderId?.services?.length || 0) > 0;
    if (enriched.appointmentId?.serviceId && !hasGroomingServices) {
        const s = enriched.appointmentId.serviceId;
        svcList.push({ name: s.name, price: s.price || 0, note: enriched.medicalRecordId?.diagnosis ? `Chẩn đoán: ${enriched.medicalRecordId.diagnosis}` : '' });
    }
    (enriched.medicalRecordId?.services || []).forEach(s => {
        svcList.push({ name: s.name || s.serviceId?.name, price: s.price ?? s.serviceId?.price ?? 0, note: '' });
    });
    (enriched.groomingOrderId?.services || []).forEach(s => {
        svcList.push({ name: s.name || s.serviceId?.name, price: s.price ?? s.serviceId?.price ?? 0, note: '(Grooming)' });
    });
    const svcSeen = new Map();
    svcList.forEach(s => {
        if (!s.name) return;
        if (!svcSeen.has(s.name) || (s.price > 0 && svcSeen.get(s.name).price === 0)) svcSeen.set(s.name, s);
    });

    let rows = '';
    let rowNum = 1;
    if (svcSeen.size === 0 && enriched.serviceTotal > 0) {
        rows += `<tr><td style="text-align:center">${rowNum++}</td><td>Phí khám / Dịch vụ chuyên môn</td><td style="text-align:center">1</td><td style="text-align:right">${fmtFn(enriched.serviceTotal)}</td><td style="text-align:right">${fmtFn(enriched.serviceTotal)}</td></tr>`;
    }
    Array.from(svcSeen.values()).forEach(s => {
        rows += `<tr><td style="text-align:center">${rowNum++}</td><td>${s.name}${s.note ? ` ${s.note}` : ''}</td><td style="text-align:center">1</td><td style="text-align:right">${fmtFn(s.price)}</td><td style="text-align:right">${fmtFn(s.price)}</td></tr>`;
    });

    if (enriched.invoiceType === 'VACCINATION') {
        rows += `<tr><td style="text-align:center">${rowNum++}</td><td>${enriched.vaccinationId?.vaccineName || 'Vaccine'} (Tiêm phòng)</td><td style="text-align:center">1</td><td style="text-align:right">${fmtFn(enriched.medicineTotal)}</td><td style="text-align:right">${fmtFn(enriched.medicineTotal)}</td></tr>`;
    } else {
        (enriched.medicalRecordId?.prescriptions || []).forEach(p => {
            const pr = p.medicineId?.retailPrice || 0;
            rows += `<tr><td style="text-align:center">${rowNum++}</td><td>${p.medicineName || p.medicineId?.productId?.name || 'Thuốc'}${p.dosage ? ` - ${p.dosage}` : ''}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:right">${fmtFn(pr)}</td><td style="text-align:right">${fmtFn(pr * p.quantity)}</td></tr>`;
        });
    }
    (enriched.retailItems || []).forEach(it => {
        rows += `<tr><td style="text-align:center">${rowNum++}</td><td>${it.productName || it.medicineId?.productId?.name || 'Sản phẩm'}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">${fmtFn(it.unitPrice || 0)}</td><td style="text-align:right">${fmtFn(it.subtotal || it.unitPrice * it.quantity)}</td></tr>`;
    });

    return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>Hóa đơn #${enriched._id?.slice(-8).toUpperCase()}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12px; color: #000; background: #fff; padding: 14px 18px; }
  .admin-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 3px double #000; }
  .clinic-left { width: 52%; line-height: 1.5; }
  .clinic-left .name { font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; }
  .clinic-left .info { font-size: 10px; margin-top: 2px; color: #222; }
  .republic-right { width: 46%; text-align: center; line-height: 1.6; }
  .republic-right .republic { font-weight: bold; font-size: 11.5px; text-transform: uppercase; }
  .republic-right .motto { font-weight: bold; font-size: 11px; text-decoration: underline; }
  .republic-right .date-line { font-size: 10.5px; font-style: italic; margin-top: 4px; }
  .doc-title { text-align: center; margin: 10px 0 4px; }
  .doc-title h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-title .inv-id { font-size: 12px; font-style: italic; color: #333; margin-top: 3px; }
  .doc-title .divider { margin: 5px auto 0; width: 60px; height: 2px; background: #000; }
  .info-section { margin: 10px 0 8px; border: 1px solid #aaa; padding: 8px 12px; font-size: 11.5px; line-height: 1.9; }
  .info-section .row { display: flex; gap: 16px; }
  .info-section .col { flex: 1; }
  .status-badge { display: inline-block; border: 1.5px solid #000; padding: 1px 8px; font-weight: bold; font-size: 10px; text-transform: uppercase; margin-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11.5px; }
  th { padding: 7px 8px; background: #d0d0d0; border: 1px solid #333; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 10.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 6px 8px; border: 1px solid #333; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f5f5f5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-section { margin-top: 6px; position: relative; }
  .summary-row { display: flex; justify-content: flex-end; gap: 0; margin-bottom: 2px; font-size: 11.5px; }
  .summary-row .lbl { width: 200px; text-align: right; padding-right: 12px; }
  .summary-row .val { width: 120px; text-align: right; font-weight: 600; }
  .total-row-sum { border-top: 2px solid #000; margin-top: 4px; padding-top: 4px; }
  .total-row-sum .lbl { font-weight: bold; font-size: 13px; text-transform: uppercase; }
  .total-row-sum .val { font-weight: bold; font-size: 13px; }
  /* ===== MỘC NGANG ĐẾ ===== */
  .red-stamp {
    position: absolute;
    top: 50%; right: 130px;
    transform: translateY(-50%) rotate(-8deg);
    padding: 5px 14px 6px;
    border: 3px solid #cc0000;
    color: #cc0000;
    opacity: 0.82;
    text-align: center;
    pointer-events: none;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    line-height: 1.25;
  }
  .red-stamp::before {
    content: '';
    position: absolute; inset: 3px;
    border: 1px solid #cc0000;
  }
  .red-stamp .s-main { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2.5px; display: block; }
  .red-stamp .s-sub { font-size: 7.5px; font-weight: bold; letter-spacing: 1.5px; display: block; margin-top: 1px; }
  .red-stamp .s-date { font-size: 7.5px; letter-spacing: 0.5px; display: block; margin-top: 1px; }
  .signature-section { margin-top: 28px; display: flex; justify-content: space-between; text-align: center; }
  .sig-col { flex: 1; font-size: 11px; line-height: 1.8; }
  .sig-col .sig-title { font-weight: bold; text-transform: uppercase; font-size: 11.5px; }
  .sig-col .sig-note { font-style: italic; font-size: 10.5px; color: #444; }
  .sig-col .sig-space { height: 55px; }
  .sig-col .sig-name { font-weight: bold; border-top: 1px solid #333; padding-top: 3px; margin-top: 2px; font-size: 11px; min-width: 120px; display: inline-block; }
  .footer-note { text-align: center; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #aaa; font-size: 10.5px; font-style: italic; color: #555; }
  @media print { @page { size: A4; margin: 12mm 10mm 18mm 10mm; } body { padding: 0; } .red-stamp { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <!-- Header hành chính -->
  <div class="admin-header">
    <div class="clinic-left">
      <div class="name">Hệ thống phòng khám thú y VetCare</div>
      <div class="info">Địa chỉ: Số 123, Đường Thú Y, Quận Cầu Giấy, TP. Hà Nội</div>
      <div class="info">ĐT: 0987.654.321 &nbsp;|&nbsp; Email: contact@vetcare.com</div>
    </div>
    <div class="republic-right">
      <div class="republic">Cộng hòa xã hội chủ nghĩa Việt Nam</div>
      <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
      <div class="date-line">Hà Nội, ngày <strong>${day}</strong> tháng <strong>${month}</strong> năm <strong>${year}</strong></div>
    </div>
  </div>

  <!-- Tiêu đề -->
  <div class="doc-title">
    <h1>Hóa đơn dịch vụ thú y</h1>
    <div class="inv-id">Số: #${enriched._id?.slice(-8).toUpperCase()} &nbsp;·&nbsp; ${INV_TYPE[enriched.invoiceType] || enriched.invoiceType || 'Khám bệnh'} &nbsp;·&nbsp; Thời gian: ${timeStr} ngày ${day}/${month}/${year} <span class="status-badge">${statusLabel}</span></div>
    <div class="divider"></div>
  </div>

  <!-- Thông tin -->
  <div class="info-section">
    <div class="row">
      <div class="col"><strong>Khách hàng:</strong> ${custName}${custPhone ? ` &nbsp;|&nbsp; ĐT: ${custPhone}` : ''}</div>
      <div class="col"><strong>Thú cưng:</strong> ${petName}</div>
    </div>
    ${doctorName ? `<div class="row"><div class="col"><strong>Bác sĩ / KTV phụ trách:</strong> ${doctorName}</div></div>` : ''}
    ${enriched.medicalRecordId?.diagnosis ? `<div class="row"><div class="col"><strong>Chẩn đoán:</strong> ${enriched.medicalRecordId.diagnosis}</div></div>` : ''}
  </div>

  <!-- Bảng chi tiết -->
  <table>
    <thead>
      <tr>
        <th style="width:36px">STT</th>
        <th style="text-align:left">Dịch vụ / Sản phẩm</th>
        <th style="width:46px">SL</th>
        <th style="width:100px">Đơn giá (đ)</th>
        <th style="width:110px">Thành tiền (đ)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Tổng kết & mộc đỏ -->
  <div class="summary-section">
    ${isPaid ? `<div class="red-stamp">
      <span class="s-main">ĐÃ THANH TOÁN</span>
      <span class="s-sub">VETCARE CLINIC</span>
      <span class="s-date">${day}/${month}/${year}</span>
    </div>` : ''}
    ${enriched.depositAmount > 0 ? `<div class="summary-row"><span class="lbl">Tiền cọc trước:</span><span class="val">- ${fmtFn(enriched.depositAmount)} đ</span></div>` : ''}
    ${enriched.discountAmount > 0 ? `<div class="summary-row"><span class="lbl">Giảm giá (điểm thưởng):</span><span class="val">- ${fmtFn(enriched.discountAmount)} đ</span></div>` : ''}
    ${enriched.pointsUsed > 0 ? `<div class="summary-row"><span class="lbl">Dùng ${enriched.pointsUsed} điểm thưởng:</span><span class="val">- ${fmtFn(enriched.pointsUsed * 1000)} đ</span></div>` : ''}
    <div class="summary-row total-row-sum"><span class="lbl">Tổng thanh toán:</span><span class="val">${fmtFn(enriched.finalTotal)} đ</span></div>
  </div>

  <!-- Chữ ký -->
  <div class="signature-section">
    <div class="sig-col">
      <div class="sig-title">Người xuất hóa đơn</div>
      <div class="sig-note">(Đã ký, ghi rõ họ tên)</div>
      <div class="sig-space"></div>
      <span class="sig-name">${issuerName}</span>
    </div>
    <div class="sig-col">
      <div class="sig-title">Khách hàng xác nhận</div>
      <div class="sig-note">(Ký, ghi rõ họ tên)</div>
      <div class="sig-space"></div>
      <span class="sig-name">${custName}</span>
    </div>
  </div>

  <div class="footer-note">Xin cảm ơn Quý khách đã tin tưởng sử dụng dịch vụ của Phòng khám Thú y VetCare!</div>
</body></html>`;
}


function InvoiceDetailModal({ inv, onClose, onPaid }) {
    const { user } = useAuth();
    const [enriched, setEnriched] = useState(inv);
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [points, setPoints] = useState(0);
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState('');
    const maxPts = Math.min(user?.rewardPoints || 0, Math.floor((enriched.finalTotal || 0) / 1000));

    // Cleanup hidden print iframe on modal unmount
    useEffect(() => {
        return () => {
            if (printFrameRef.current) {
                document.body.removeChild(printFrameRef.current);
                printFrameRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const fetchEnriched = async () => {
            let e = { ...inv };
            try {
                const aptId = e.appointmentId?._id || e.appointmentId;
                if (aptId) {
                    const r = await axios.get(`${API}/records?appointmentId=${aptId}`, { headers: H() });
                    if (r.data.success && r.data.data.length > 0) e.medicalRecordId = r.data.data[0];
                }
                if (e.groomingOrderId && typeof e.groomingOrderId === 'string') {
                    const r = await axios.get(`${API}/grooming/${e.groomingOrderId}`, { headers: H() });
                    if (r.data.success) e.groomingOrderId = r.data.data;
                }
                if (e.vaccinationId && typeof e.vaccinationId === 'string') {
                    const r = await axios.get(`${API}/vaccinations/${e.vaccinationId}`, { headers: H() });
                    if (r.data.success) e.vaccinationId = r.data.data;
                }
            } catch (err) { console.error('Enrichment error:', err); }
            setEnriched(e);
            setLoadingDetail(false);
        };
        fetchEnriched();
    }, [inv._id]);

    const payWithPoints = async () => {
        if (points <= 0) return;
        setPaying(true); setError('');
        try {
            const r = await axios.post(`${API}/invoices/${enriched._id}/pay-with-points`, { points }, { headers: H() });
            if (r.data.success) { onPaid(); onClose(); }
            else setError(r.data.message || 'Có lỗi xảy ra.');
        } catch (e) { setError(e.response?.data?.message || 'Có lỗi xảy ra.'); }
        finally { setPaying(false); }
    };

    const printFrameRef = useRef(null);
    const downloadPDF = () => {
        // Create or reuse hidden iframe — no new tab
        let iframe = printFrameRef.current;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none';
            document.body.appendChild(iframe);
            printFrameRef.current = iframe;
        }
        const htmlContent = buildInvoiceHTML(enriched, fmt, fmtDateTime);
        iframe.srcdoc = htmlContent;
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 300);
        };
    };

    const INV_TYPE_LABEL = { APPOINTMENT: 'Khám bệnh', WALKIN: 'Khám walk-in', GROOMING: 'Grooming', VACCINATION: 'Tiêm phòng', RETAIL: 'Bán lẻ' };
    let petName = enriched.appointmentId?.petId?.name || enriched.medicalRecordId?.petId?.name;
    if (!petName && enriched.groomingOrderId?.pets) petName = enriched.groomingOrderId.pets.map(p => p.petId?.name).filter(Boolean).join(', ');
    if (!petName) petName = 'N/A';
    const doctorName = enriched.medicalRecordId?.doctorId?.fullName || enriched.appointmentId?.staffId?.fullName;
    const issuerName = enriched.createdBy?.fullName || enriched.staffId?.fullName || '';

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Hóa đơn #{enriched._id?.slice(-8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>⏰ {fmtDateTime(enriched.createdAt)}</span>
                            <span>·</span>
                            <span>{INV_TYPE_LABEL[enriched.invoiceType] || enriched.invoiceType}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.71rem', fontWeight: 700, background: enriched.status === 'PAID' ? '#d1fae5' : '#fffbeb', color: enriched.status === 'PAID' ? '#059669' : '#d97706' }}>
                            {enriched.status === 'PAID' ? '✓ Đã TT' : 'Chờ TT'}
                        </span>
                        <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '5px 7px', cursor: 'pointer' }}><X size={16} /></button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
                    {loadingDetail ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải chi tiết...</div>
                    ) : (<>
                        {/* Meta info grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                            {[
                                ['Thú cưng', petName],
                                ['Khách hàng', enriched.customerId?.fullName || 'N/A'],
                                doctorName ? ['Bác sĩ / KTV', doctorName] : null,
                                issuerName ? ['Người xuất HD', issuerName] : null,
                                enriched.medicalRecordId?.diagnosis ? ['Chẩn đoán', enriched.medicalRecordId.diagnosis] : null,
                            ].filter(Boolean).map(([k, v]) => (
                                <div key={k} style={{ padding: '9px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{k}</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{v}</div>
                                </div>
                            ))}
                        </div>

                        {/* Items table */}
                        <div style={{ fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>Chi tiết dịch vụ &amp; sản phẩm</div>
                        <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 92px', padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.69rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                <span>Tên</span><span style={{ textAlign: 'center' }}>SL</span><span style={{ textAlign: 'right' }}>Thành tiền</span>
                            </div>
                            {/* Dịch vụ: gom tất cả nguồn lại, dedup theo tên — tránh "Tắm Vệ Sinh" hiện 2 lần */}
                            {(() => {
                                const svcList = [];
                                // appointmentId.serviceId (chỉ thêm nếu không có grooming services)
                                if (enriched.appointmentId?.serviceId && !(enriched.groomingOrderId?.services?.length)) {
                                    const s = enriched.appointmentId.serviceId;
                                    svcList.push({ name: s.name, price: s.price || 0, note: enriched.medicalRecordId?.diagnosis ? `Chẩn đoán: ${enriched.medicalRecordId.diagnosis}` : '' });
                                }
                                // medicalRecordId.services
                                (enriched.medicalRecordId?.services || []).forEach(s => {
                                    svcList.push({ name: s.name || s.serviceId?.name, price: s.price ?? s.serviceId?.price ?? 0, note: '' });
                                });
                                // groomingOrderId.services
                                (enriched.groomingOrderId?.services || []).forEach(s => {
                                    svcList.push({ name: s.name || s.serviceId?.name, price: s.price ?? s.serviceId?.price ?? 0, note: '✂ Grooming', isGrooming: true });
                                });
                                // Dedup theo tên (giữ lại bản đầu tiên có price > 0)
                                const seen = new Map();
                                svcList.forEach(s => {
                                    if (!s.name) return;
                                    if (!seen.has(s.name) || (s.price > 0 && seen.get(s.name).price === 0)) seen.set(s.name, s);
                                });
                                const deduped = Array.from(seen.values());

                                if (deduped.length === 0 && enriched.serviceTotal > 0) {
                                    return <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 92px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.87rem' }}>Phí khám / Dịch vụ</span>
                                        <span style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>1</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.87rem', textAlign: 'right' }}>{fmt(enriched.serviceTotal)}đ</span>
                                    </div>;
                                }
                                return deduped.map((s, i) => (
                                    <div key={`svc${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 42px 92px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', background: s.isGrooming ? '#fdf4ff' : 'transparent' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{s.name}</div>
                                            {s.note && <div style={{ fontSize: '0.7rem', color: s.isGrooming ? '#8b5cf6' : 'var(--text-muted)', fontWeight: s.isGrooming ? 600 : 400 }}>{s.note}</div>}
                                        </div>
                                        <span style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>1</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.87rem', textAlign: 'right' }}>{fmt(s.price)}đ</span>
                                    </div>
                                ));
                            })()}

                            {enriched.invoiceType === 'VACCINATION' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 92px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', background: '#f0fdf4' }}>
                                    <div><div style={{ fontWeight: 600, fontSize: '0.87rem' }}>💉 {enriched.vaccinationId?.vaccineName || 'Vaccine'}</div><div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Tiêm phòng</div></div>
                                    <span style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>1</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.87rem', textAlign: 'right' }}>{fmt(enriched.medicineTotal)}đ</span>
                                </div>
                            )}
                            {enriched.invoiceType !== 'VACCINATION' && (enriched.medicalRecordId?.prescriptions || []).map((p, i) => {
                                const price = p.medicineId?.retailPrice || 0;
                                return <div key={`rx${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 42px 92px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', background: '#eff6ff' }}>
                                    <div><div style={{ fontWeight: 600, fontSize: '0.87rem' }}>💊 {p.medicineName || p.medicineId?.productId?.name || 'Thuốc'}</div>{p.dosage && <div style={{ fontSize: '0.7rem', color: '#1e40af' }}>{p.dosage}</div>}</div>
                                    <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.82rem' }}>×{p.quantity}</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.87rem', textAlign: 'right' }}>{fmt(price * p.quantity)}đ</span>
                                </div>;
                            })}
                            {(enriched.retailItems || []).map((item, i) => (
                                <div key={`rt${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 42px 92px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.87rem' }}>{item.productName || item.medicineId?.productId?.name || 'Sản phẩm'}</span>
                                    <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.82rem' }}>×{item.quantity}</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.87rem', textAlign: 'right' }}>{fmt(item.subtotal || item.unitPrice * item.quantity)}đ</span>
                                </div>
                            ))}
                            {enriched.depositAmount > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#059669' }}><span style={{ fontSize: '0.84rem' }}>Tiền cọc trước</span><span style={{ fontWeight: 700, textAlign: 'right', fontSize: '0.87rem' }}>-{fmt(enriched.depositAmount)}đ</span></div>}
                            {enriched.discountAmount > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#059669' }}><span style={{ fontSize: '0.84rem' }}>Giảm giá (điểm thưởng)</span><span style={{ fontWeight: 700, textAlign: 'right', fontSize: '0.87rem' }}>-{fmt(enriched.discountAmount)}đ</span></div>}
                            {enriched.pointsUsed > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#059669' }}><span style={{ fontSize: '0.84rem' }}>Dùng {enriched.pointsUsed} điểm</span><span style={{ fontWeight: 700, textAlign: 'right', fontSize: '0.87rem' }}>-{fmt(enriched.pointsUsed * 1000)}đ</span></div>}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', padding: '13px 12px', background: 'var(--primary-light)' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.93rem' }}>TỔNG THANH TOÁN</span>
                                <span style={{ fontWeight: 900, fontSize: '1.08rem', color: 'var(--primary)', textAlign: 'right' }}>{fmt(enriched.finalTotal)}đ</span>
                            </div>
                        </div>

                        {/* Issuer info */}
                        {issuerName && (
                            <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>Người xuất hóa đơn</span>
                                <span style={{ fontWeight: 700, fontSize: '0.83rem' }}>{issuerName}</span>
                            </div>
                        )}

                        {error && <div style={{ padding: '10px', borderRadius: '10px', background: '#fef2f2', color: '#ef4444', fontSize: '0.84rem', marginBottom: '12px', fontWeight: 600 }}>{error}</div>}
                        {enriched.status === 'PENDING' && (user?.rewardPoints > 0) && (
                            <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '13px' }}>
                                <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={15} color="var(--primary)" /> Dùng điểm thưởng</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Bạn có <strong>{(user?.rewardPoints || 0).toLocaleString('vi-VN')}</strong> điểm (tối đa {maxPts} điểm = -{fmt(maxPts * 1000)}đ)</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type='number' min={0} max={maxPts} value={points} onChange={e => setPoints(Math.min(maxPts, Math.max(0, Number(e.target.value))))} style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.87rem', fontFamily: 'inherit' }} />
                                    <button onClick={payWithPoints} disabled={paying || points <= 0} style={{ padding: '7px 13px', borderRadius: '8px', border: 'none', background: points > 0 ? 'var(--primary)' : '#e2e8f0', color: points > 0 ? 'white' : 'var(--text-muted)', fontWeight: 700, cursor: points > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: '0.82rem' }}>{paying ? '...' : 'Áp dụng'}</button>
                                </div>
                                {points > 0 && <div style={{ fontSize: '0.77rem', color: 'var(--primary)', marginTop: '5px', fontWeight: 600 }}>→ Còn lại: {fmt((enriched.finalTotal || 0) - points * 1000)}đ</div>}
                            </div>
                        )}
                    </>)}
                </div>

                {/* Footer buttons */}
                <div style={{ padding: '12px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <button onClick={downloadPDF} style={{ flex: 1, padding: '10px', border: '1.5px solid var(--primary)', borderRadius: '12px', background: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--primary)' }}><FileText size={14} /> Tải PDF</button>
                    <button onClick={onClose} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem' }}>Đóng</button>
                </div>
            </div>
        </div>
    );
}


function InvoicesTab() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInv, setSelectedInv] = useState(null);
    const [fetchError, setFetchError] = useState('');
    const location = useLocation();
    const highlightId = location.state?.highlightInvoiceId;

    const load = useCallback(() => {
        setLoading(true); setFetchError('');
        axios.get(`${API}/invoices`, { headers: H() })
            .then(r => {
                if (r.data.success) setInvoices(r.data.data);
                else setFetchError(r.data.message || 'Lỗi tải dữ liệu');
            })
            .catch(e => setFetchError(e.response?.data?.message || 'Không kết nối được server'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (highlightId && invoices.length > 0) {
            setTimeout(() => {
                const el = document.getElementById(`inv-${highlightId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }, [highlightId, invoices]);

    const INV_STATUS = { PENDING: { label: 'Chờ TT', color: '#f59e0b', bg: '#fffbeb' }, PAID: { label: 'Đã TT', color: '#10b981', bg: '#d1fae5' }, CANCELLED: { label: 'Đã hủy', color: '#64748b', bg: '#f8fafc' } };

    return (
        <Wrap>
            {selectedInv && <InvoiceDetailModal inv={selectedInv} onClose={() => setSelectedInv(null)} onPaid={() => { setSelectedInv(null); load(); }} />}
            <h1 style={{ margin: '0 0 24px', fontSize: '1.6rem', fontWeight: 800 }}>Hóa đơn của tôi</h1>
            {fetchError && <div style={{ padding: '14px', borderRadius: '12px', background: '#fef2f2', color: '#ef4444', marginBottom: '16px', fontWeight: 600, fontSize: '0.88rem' }}>⚠️ {fetchError}</div>}
            {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Đang tải...</div>
                : invoices.length === 0 ? <Card style={{ textAlign: 'center', padding: '60px' }}><FileText size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} /><div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Chưa có hóa đơn nào</div></Card>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {invoices.map(inv => {
                            const st = INV_STATUS[inv.status] || INV_STATUS.PENDING;
                            return (
                                <Card key={inv._id} id={`inv-${inv._id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '18px 24px', cursor: 'pointer', transition: 'all 0.15s',
                                    boxShadow: highlightId === inv._id ? '0 0 0 3px rgba(15, 169, 172, 0.5), 0 8px 24px rgba(15, 169, 172, 0.2)' : 'none'
                                }}
                                    onClick={() => setSelectedInv(inv)}
                                    onMouseEnter={e => highlightId === inv._id ? null : (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)')}
                                    onMouseLeave={e => highlightId === inv._id ? (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 169, 172, 0.5), 0 8px 24px rgba(15, 169, 172, 0.2)') : (e.currentTarget.style.boxShadow = 'none')}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>#{inv._id?.slice(-6).toUpperCase()}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>{fmtDate(inv.createdAt || inv.date)} · {inv.appointmentId?.petId?.name || 'Thú cưng'}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>{fmt(inv.finalTotal)}đ</div>
                                            {inv.discountAmount > 0 && <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>-{fmt(inv.discountAmount)}đ giảm</div>}
                                        </div>
                                        <span style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                                        <Eye size={16} color='var(--text-muted)' />
                                    </div>
                                </Card>
                            );
                        })}
                    </div>}
        </Wrap>
    );
}

// ── Tab: Phòng khám ───────────────────────────────────────────────────────────
function AboutTab() {
    const items = [
        { icon: <MapPin size={22} color="var(--primary)" />, label: 'Địa chỉ', value: '123 Nguyễn Văn Linh, P. Tân Phong, Q.7, TP.HCM' },
        { icon: <Phone size={22} color="#3b82f6" />, label: 'Hotline', value: '0909 123 456 (24/7)' },
        { icon: <Clock size={22} color="#10b981" />, label: 'Giờ hoạt động', value: 'Thứ 2 – Chủ nhật: 07:30 – 21:00' },
        { icon: <HeartPulse size={22} color="#ef4444" />, label: 'Cấp cứu', value: 'Hỗ trợ 24/7, gọi ngay 0909 123 456' },
    ];
    const services2 = ['Khám tổng quát & chẩn đoán', 'Phẫu thuật & điều trị', 'Grooming & spa', 'Tiêm phòng & tẩy giun', 'Xét nghiệm & chụp X-quang', 'Lưu trú & chăm sóc nội trú'];
    return (
        <Wrap>
            <h1 style={{ margin: '0 0 24px', fontSize: '1.6rem', fontWeight: 800 }}>Về phòng khám VetCare</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '20px', marginBottom: '24px' }}>
                {items.map((item, i) => (
                    <Card key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>{item.icon}</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.label}</div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.value}</div>
                        </div>
                    </Card>
                ))}
            </div>
            <Card>
                <SectionTitle title="Dịch vụ chuyên khoa" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '10px' }}>
                    {services2.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '10px', background: '#f8fafc' }}>
                            <CheckCircle2 size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>{s}</span>
                        </div>
                    ))}
                </div>
            </Card>
        </Wrap>
    );
}

// ── Marketing content ─────────────────────────────────────────────────────────
function MarketingContent({ onLogin, onRegister, isLoggedIn }) {
    const [services, setServices] = useState([]);
    const TYPE_CFG = { MEDICAL: { label: 'Khám & Điều trị', icon: Stethoscope, color: '#0ea5e9', bg: '#e0f2fe' }, GROOMING: { label: 'Spa & Grooming', icon: Scissors, color: '#8b5cf6', bg: '#ede9fe' }, PRODUCT: { label: 'Sản phẩm', icon: Package, color: '#10b981', bg: '#d1fae5' }, SURCHARGE: { label: 'Phụ phí', icon: Plus, color: '#f59e0b', bg: '#fef3c7' } };

    useEffect(() => {
        axios.get(`${API}/services/public`).then(r => { if (r.data.success) setServices(r.data.data.filter(s => s.isActive !== false)); }).catch(() => { });
    }, []);

    const grouped = services.reduce((a, s) => { const t = s.type || 'MEDICAL'; (a[t] = a[t] || []).push(s); return a; }, {});

    return (
        <>
            <section style={{ padding: '80px 5% 60px', background: 'white' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.8fr)', gap: '60px', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#e0f2fe', color: '#0284c7', padding: '6px 16px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '24px' }}><HeartPulse size={16} /> Chăm sóc sức khỏe tiên tiến</div>
                        <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(2.2rem,4vw,3.2rem)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                            Phòng khám thú y<br /><span style={{ color: 'var(--primary)' }}>uy tín & tận tâm</span> nhất
                        </h1>
                        <p style={{ margin: '0 0 36px', fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '500px' }}>
                            Dịch vụ y tế, khám chữa bệnh và chăm sóc thú cưng toàn diện với đội ngũ bác sĩ giàu kinh nghiệm.
                        </p>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                            <button onClick={isLoggedIn ? onLogin : onRegister} style={{ padding: '14px 32px', borderRadius: '10px', background: 'var(--primary)', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit', boxShadow: '0 4px 16px var(--primary-glow)', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.07)'}
                                onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                                {isLoggedIn ? <><Calendar size={18} /> Đặt lịch ngay</> : <>Đăng ký ngay <ArrowRight size={18} /></>}
                            </button>
                            <a href="#services" style={{ padding: '14px 28px', borderRadius: '10px', background: '#f8fafc', color: 'var(--text-main)', fontWeight: 600, fontSize: '1rem', textDecoration: 'none', border: '1px solid #e2e8f0' }}>Xem bảng giá</a>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {[{ icon: <Users size={26} color="var(--primary)" />, title: 'Đội ngũ bác sĩ', desc: 'Hơn 10 năm kinh nghiệm' }, { icon: <Activity size={26} color="#f59e0b" />, title: 'Trang thiết bị', desc: 'Phòng lab hiện đại' }, { icon: <Clock size={26} color="#ef4444" />, title: 'Cấp cứu 24/7', desc: 'Luôn sẵn sàng' }, { icon: <Shield size={26} color="#10b981" />, title: 'Chất lượng', desc: 'Dịch vụ chuẩn 5 sao' }].map((c, i) => (
                            <div key={i} style={{ background: '#f8fafc', padding: '28px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', transition: 'all 0.3s' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '14px' }}>{c.icon}</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{c.title}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>{c.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <section style={{ padding: '40px 5%', background: 'var(--primary)' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '24px' }}>
                    {[['5.000+', 'Khách hàng tin tưởng'], ['10+', 'Năm hoạt động'], ['100%', 'Bác sĩ có chứng chỉ'], ['24/7', 'Hỗ trợ y tế']].map(([n, l], i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white' }}>{n}</div>
                            <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{l}</div>
                        </div>
                    ))}
                </div>
            </section>
            <section id="services" style={{ padding: '80px 5%', background: 'var(--bg-main)' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 800, margin: '0 0 12px' }}>Bảng giá dịch vụ</h2>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto' }}>Minh bạch, không phát sinh chi phí ẩn</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '20px' }}>
                        {Object.entries(grouped).map(([type, items]) => {
                            const cfg = TYPE_CFG[type] || { label: type, icon: Package, color: '#64748b', bg: '#f1f5f9' };
                            const Icon = cfg.icon;
                            return (
                                <div key={type} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ padding: '18px 22px', background: cfg.bg, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={cfg.color} /></div>
                                        <div><div style={{ fontWeight: 800 }}>{cfg.label}</div><div style={{ fontSize: '0.78rem', color: cfg.color, fontWeight: 600 }}>{items.length} dịch vụ</div></div>
                                    </div>
                                    <div style={{ padding: '0 22px' }}>
                                        {items.slice(0, 4).map((s, i) => (
                                            <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 3 ? '1px dashed #f1f5f9' : 'none' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</span>
                                                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.price ? `${fmt(s.price)}đ` : 'Liên hệ'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {items.length > 4 && <div style={{ padding: '10px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>+{items.length - 4} dịch vụ khác</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
            <footer style={{ background: 'var(--primary-light)', padding: '48px 5% 28px', borderTop: '1px solid rgba(15,169,172,0.1)' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '36px', paddingBottom: '32px', marginBottom: '20px', borderBottom: '1px solid rgba(15,169,172,0.12)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><PawPrint size={18} color="var(--primary)" /><span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary-dark)' }}>VetCare</span></div>
                        <p style={{ color: 'var(--primary-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>Hệ thống phòng khám thú y — chăm sóc tốt nhất cho thú cưng của bạn.</p>
                    </div>
                    <div><h4 style={{ color: 'var(--text-main)', fontWeight: 700, marginBottom: '16px' }}>Liên hệ</h4>
                        <div style={{ fontSize: '0.88rem', color: 'var(--primary-dark)', lineHeight: 2 }}>
                            <div>📍 123 Nguyễn Văn Linh, Q.7, TP.HCM</div>
                            <div>📞 0909 123 456</div>
                            <div>✉️ contact@vetcare.vn</div>
                        </div>
                    </div>
                </div>
                <div style={{ maxWidth: '1280px', margin: '0 auto', fontSize: '0.85rem', color: 'var(--primary-dark)', fontWeight: 500 }}>© 2026 VetCare Clinic. All rights reserved.</div>
            </footer>
        </>
    );
}

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────
export default function LandingPage() {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isCustomer = user?.role === 'CUSTOMER';

    // Khắc phục lỗi hiển thị Avatar cũ: Luôn ưu tiên dùng hình ảnh từ AuthContext (DB) 
    const displayAvatar = user?.avatar || '';

    const VALID_TABS = ['home', 'profile', 'appointments', 'pets', 'services', 'invoices', 'about'];
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        return tab && VALID_TABS.includes(tab) ? tab : 'home';
    });
    const [showLogout, setShowLogout] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginInitialMode, setLoginInitialMode] = useState('login'); // 'login' | 'register'
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const { showToast } = useToast();
    const [homeResetKey, setHomeResetKey] = useState(0);
    const [petsResetKey, setPetsResetKey] = useState(0);

    // ── Khi URL có ?tab= hoặc ?login= ──
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        let hasChanges = false;

        const tab = params.get('tab');
        if (tab && VALID_TABS.includes(tab)) {
            setActiveTab(tab);
            params.delete('tab');
            hasChanges = true;
        }

        const loginParam = params.get('login');
        if (loginParam === 'true') {
            setShowLoginModal(true);
            params.delete('login');
            hasChanges = true;
        }

        if (hasChanges) {
            const remainingParams = params.toString();
            navigate({
                pathname: '/',
                search: remainingParams ? `?${remainingParams}` : ''
            }, { replace: true, state: location.state });
        }
    }, [location.search, navigate, location.state]);

    const menuRef = React.useRef(null);
    // Close dropdown on outside click
    useEffect(() => {
        if (!showUserMenu) return;
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showUserMenu]);

    const pts = user?.rewardPoints || 0;
    const tier = pts >= 1000 ? 'Kim Cương' : pts >= 500 ? 'Vàng' : pts >= 100 ? 'Bạc' : 'Thành viên';

    return (
        <>
            <div style={{ fontFamily: 'var(--font-body)', background: 'var(--bg-main)', minHeight: '100vh' }}>

                {/* Logout modal */}
                {showLogout && (
                    <div className="modal-overlay animate-fade-in" style={{ zIndex: 9999 }} onClick={() => setShowLogout(false)}>
                        <div className="modal-container glass-card animate-slide-up" style={{ padding: '36px 32px', maxWidth: '380px', width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <LogOut size={32} />
                            </div>
                            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.15rem' }}>Đăng xuất khỏi VetCare?</h3>
                            <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bạn sẽ cần đăng nhập lại để xem lịch hẹn và hồ sơ thú cưng.</p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => setShowLogout(false)} style={{ flex: 1, padding: '11px' }}>Ở lại</button>
                                <button className="btn btn-primary" onClick={() => { setShowLogout(false); logout(); }} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none' }}>
                                    <LogOut size={15} /> Đăng xuất
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top bar */}
                <div style={{ background: 'var(--primary)', padding: '7px 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'white', fontWeight: 500 }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MapPin size={12} /> 123 Nguyễn Văn Linh, Q.7, TP.HCM</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={12} /> Thứ 2 – CN: 07:30 – 21:00</span>
                    </div>
                    <span><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Hotline 24/7: <strong>0909 123 456</strong></span>
                </div>

                {/* Header */}
                <header style={{ background: 'white', padding: '0 5%', height: '66px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,0.05)', gap: '16px' }}>
                    <button onClick={() => setActiveTab('home')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary-light), rgba(15,169,172,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(15,169,172,0.15)' }}><PawPrint size={18} color="var(--primary)" strokeWidth={2.5} /></div>
                        <span style={{ fontWeight: 800, fontSize: '1.25rem', background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>VetCare</span>
                    </button>

                    {isCustomer ? (
                        <div style={{ display: 'flex', alignItems: 'stretch', height: '66px', gap: '0', overflow: 'auto' }}>
                            {TABS.map(tab => {
                                const active = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button key={tab.id} onClick={() => {
                                        if (tab.id === 'home' && activeTab === 'home') setHomeResetKey(k => k + 1);
                                        if (tab.id === 'pets' && activeTab === 'pets') setPetsResetKey(k => k + 1);
                                        setActiveTab(tab.id);
                                    }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '0 14px',
                                            border: 'none', borderBottom: active ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                                            cursor: 'pointer',
                                            fontWeight: active ? 700 : 500,
                                            fontSize: '0.875rem',
                                            fontFamily: 'inherit',
                                            background: 'transparent',
                                            color: active ? 'var(--primary)' : '#64748b',
                                            transition: 'all 0.15s',
                                            whiteSpace: 'nowrap',
                                            borderRadius: 0,
                                            marginTop: '1px'
                                        }}
                                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--primary)'; }}
                                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#64748b'; }}
                                    >
                                        <Icon size={14} /> {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                    ) : (
                        <nav style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setLoginInitialMode('login'); setShowLoginModal(true); }} style={{ padding: '8px 20px', borderRadius: '8px', background: 'white', color: 'var(--text-muted)', fontWeight: 600, border: '1.5px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit' }}>Đăng nhập</button>
                            <button onClick={() => setShowAuthPrompt(true)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--primary)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={15} /> Đặt lịch</button>
                        </nav>
                    )}

                    {isCustomer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {/* Chuông thông báo */}
                            <NotificationCenter />

                            <div ref={menuRef} style={{ position: 'relative' }}>
                                {/* User avatar button */}
                                <button onClick={() => setShowUserMenu(v => !v)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px 5px 6px', borderRadius: '24px', background: showUserMenu ? 'var(--primary-light)' : '#f8fafc', border: showUserMenu ? '1.5px solid rgba(15,169,172,0.35)' : '1.5px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.18s' }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),var(--primary-end))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {displayAvatar
                                            ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <span style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>{(user?.fullName || 'U')[0].toUpperCase()}</span>
                                        }
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.2 }}>{user?.fullName?.split(' ').slice(-1)[0]}</div>
                                        <div style={{ fontSize: '0.66rem', color: 'var(--primary)', fontWeight: 700 }}>{tier} · {pts} điểm</div>
                                    </div>
                                    <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>

                                {/* Dropdown menu */}
                                {showUserMenu && (
                                    <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '240px', background: 'white', borderRadius: '16px', boxShadow: '0 16px 48px rgba(0,0,0,0.14)', border: '1px solid #e2e8f0', zIndex: 200, overflow: 'hidden', animation: 'slideDown 0.15s ease' }}>
                                        {/* Header */}
                                        <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, var(--primary-light), rgba(15,169,172,0.04))', borderBottom: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),var(--primary-end))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                                    {displayAvatar
                                                        ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{(user?.fullName || 'U')[0].toUpperCase()}</span>
                                                    }
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>{user?.fullName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>{tier} · {pts.toLocaleString('vi-VN')} điểm</div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Menu items */}
                                        <div style={{ padding: '8px' }}>
                                            {[
                                                { label: 'Hồ sơ của tôi', icon: User, tab: 'profile' },
                                                { label: 'Lịch hẹn', icon: Calendar, tab: 'appointments' },
                                                { label: 'Thú cưng', icon: PawPrint, tab: 'pets' },
                                                { label: 'Hóa đơn', icon: FileText, tab: 'invoices' },
                                            ].map(item => {
                                                const Icon = item.icon;
                                                return (
                                                    <button key={item.tab} onClick={() => { setActiveTab(item.tab); setShowUserMenu(false); }}
                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: activeTab === item.tab ? 'var(--primary-light)' : 'transparent', color: activeTab === item.tab ? 'var(--primary)' : 'var(--text-main)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left' }}
                                                        onMouseEnter={e => { if (activeTab !== item.tab) e.currentTarget.style.background = '#f8fafc'; }}
                                                        onMouseLeave={e => { if (activeTab !== item.tab) e.currentTarget.style.background = 'transparent'; }}>
                                                        <Icon size={15} color={activeTab === item.tab ? 'var(--primary)' : 'var(--text-muted)'} />
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {/* Divider + Logout */}
                                        <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px' }}>
                                            <button onClick={() => { setShowUserMenu(false); setShowLogout(true); }}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <LogOut size={15} /> Đăng xuất
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </header>

                {/* Content */}
                {isCustomer ? (
                    <>
                        {activeTab === 'home' && (
                            <>
                                <HomeTab key={homeResetKey} user={user} switchTab={setActiveTab} />
                                <MarketingContent onLogin={() => setActiveTab('appointments')} onRegister={() => {}} isLoggedIn={true} />
                            </>
                        )}
                        {activeTab === 'profile' && <CustomerProfileTab user={user} onUserUpdate={() => { }} onToast={showToast} />}
                        {activeTab === 'appointments' && <AppointmentsTab />}
                        {activeTab === 'pets' && <PetsTab key={petsResetKey} />}
                        {activeTab === 'services' && <ServicesTab />}
                        {activeTab === 'invoices' && <InvoicesTab />}
                        {activeTab === 'about' && <AboutTab />}
                    </>
                ) : (
                    <MarketingContent 
                        onLogin={() => setShowAuthPrompt(true)} 
                        onRegister={() => { setLoginInitialMode('register'); setShowLoginModal(true); }} 
                        isLoggedIn={false} 
                    />
                )}
            </div>
            <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
            {showAuthPrompt && <AuthPromptModal
                onClose={() => setShowAuthPrompt(false)}
                onLogin={() => { setShowAuthPrompt(false); setLoginInitialMode('login'); setShowLoginModal(true); }}
                onRegister={() => { setShowAuthPrompt(false); setLoginInitialMode('register'); setShowLoginModal(true); }}
            />}
            {showLoginModal && <LoginModal initialMode={loginInitialMode} onClose={() => setShowLoginModal(false)} />}
        </>
    );

    function AuthPromptModal({ onClose, onLogin, onRegister }) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,169,172,0.12)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
                <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '380px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div style={{ background: 'linear-gradient(135deg, #0fa9ac, #0891b2)', padding: '28px 28px 24px', position: 'relative', textAlign: 'center' }}>
                        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <X size={15} />
                        </button>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <Calendar size={26} color="white" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'white' }}>Đặt lịch khám</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', marginTop: '6px', lineHeight: 1.5 }}>Bạn cần có tài khoản để đặt lịch khám trực tuyến</div>
                    </div>
                    {/* Body */}
                    <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button onClick={onLogin} style={{ padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(15,169,172,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Lock size={16} /> Đăng nhập
                        </button>
                        <button onClick={onRegister} style={{ padding: '13px', borderRadius: '10px', border: '1.5px solid #0fa9ac', background: 'white', color: '#0fa9ac', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f0fdfd'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
                            <UserPlus size={16} /> Tạo tài khoản mới
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', marginTop: '2px' }}>Để sau</button>
                    </div>
                </div>
            </div>
        );
    }

    function LoginModal({ initialMode = 'login', onClose }) {
        const { login } = useAuth();
        const navigate = useNavigate();
        const SAVED_KEY = 'vc_saved_phone';
        const [mode, setMode] = React.useState(initialMode);
        const [phone, setPhone] = React.useState(() => { try { return localStorage.getItem(SAVED_KEY) || ''; } catch { return ''; } });
        const [pass, setPass] = React.useState(() => { try { return localStorage.getItem('vc_saved_pass') || ''; } catch { return ''; } });
        const [showPass, setShowPass] = React.useState(false);
        const [rememberMe, setRememberMe] = React.useState(() => { try { return !!localStorage.getItem(SAVED_KEY); } catch { return false; } });
        const [regPhone, setRegPhone] = React.useState('');
        const [regName, setRegName] = React.useState('');
        const [regPass, setRegPass] = React.useState('');
        const [regPass2, setRegPass2] = React.useState('');
        const [showRegPass, setShowRegPass] = React.useState(false);
        const [showRegPass2, setShowRegPass2] = React.useState(false);
        const [error, setError] = React.useState('');
        const [success, setSuccess] = React.useState('');
        const [isLoading, setIsLoading] = React.useState(false);
        
        // Forgot password states
        const [forgotEmail, setForgotEmail] = React.useState('');
        const [otp, setOtp] = React.useState('');
        const [newPass, setNewPass] = React.useState('');
        const [showNewPass, setShowNewPass] = React.useState(false);

        const handleLogin = async (e) => {
            e.preventDefault(); setIsLoading(true); setError('');
            try {
                if (rememberMe) {
                    localStorage.setItem(SAVED_KEY, phone);
                    localStorage.setItem('vc_saved_pass', pass);
                } else {
                    localStorage.removeItem(SAVED_KEY);
                    localStorage.removeItem('vc_saved_pass');
                }
                const result = await login(phone, pass);
                if (result.success) {
                    if (result.requiresPasswordChange || result.requiresFaceRegistration) {
                        navigate('/change-password'); return;
                    }
                    const role = result.user.role;
                    if (role === 'ADMIN') { window.location.replace('/dashboard'); }
                    else if (role !== 'CUSTOMER') { window.location.replace('/appointments'); }
                    else onClose();
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Không thể kết nối máy chủ.');
            } finally { setIsLoading(false); }
        };

        const handleRegister = async (e) => {
            e.preventDefault(); setError('');
            if (regPass !== regPass2) { setError('Mật khẩu xác nhận không khớp.'); return; }
            if (regPass.length < 6) { setError('Mật khẩu phải từ 6 ký tự.'); return; }
            setIsLoading(true);
            try {
                const res = await axios.post(`${API}/auth/register`, { phoneNumber: regPhone, fullName: regName, password: regPass });
                if (res.data.success) {
                    setSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
                    setMode('login'); setPhone(regPhone); setPass('');
                }
            } catch (err) { setError(err.response?.data?.message || 'Đăng ký thất bại.'); }
            finally { setIsLoading(false); }
        };

        const handleForgotPassword = async (e) => {
            e.preventDefault(); setError(''); setSuccess('');
            if (!forgotEmail) { setError('Vui lòng nhập email.'); return; }
            setIsLoading(true);
            try {
                const res = await axios.post(`${API}/auth/forgot-password`, { email: forgotEmail });
                if (res.data.success) {
                    setSuccess('Mã xác thực 6 số đã được gửi đến email của bạn.');
                    setMode('verify_otp');
                }
            } catch (err) { setError(err.response?.data?.message || 'Lỗi gửi yêu cầu quên mật khẩu.'); }
            finally { setIsLoading(false); }
        };

        const handleResetPassword = async (e) => {
            e.preventDefault(); setError(''); setSuccess('');
            if (!otp || !newPass) { setError('Vui lòng nhập đầy đủ OTP và mật khẩu mới.'); return; }
            if (newPass.length < 6) { setError('Mật khẩu mới phải từ 6 ký tự.'); return; }
            setIsLoading(true);
            try {
                const res = await axios.post(`${API}/auth/reset-password`, { email: forgotEmail, otp, newPassword: newPass });
                if (res.data.success) {
                    setSuccess('Mật khẩu đã được đặt lại thành công! Bạn có thể đăng nhập ngay.');
                    setMode('login');
                    setPass('');
                }
            } catch (err) { setError(err.response?.data?.message || 'Lỗi đặt lại mật khẩu.'); }
            finally { setIsLoading(false); }
        };

        // Màu hệ thống: trắng / teal (#0fa9ac)
        const inp = {
            width: '100%', padding: '11px 14px', borderRadius: '10px',
            border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box', background: '#f8fafc', color: '#111827',
            transition: 'border-color 0.15s',
        };
        const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '6px' };

        const EyeBtn = ({ show, toggle }) => (
            <button type="button" onClick={toggle} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}>
                <Eye size={16} style={{ opacity: show ? 1 : 0.45 }} />
            </button>
        );

        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,169,172,0.12)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(e); }}>
                <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>

                    {/* Header gradient teal — giống màu hệ thống */}
                    <div style={{ background: 'linear-gradient(135deg, #0fa9ac, #0891b2)', padding: '24px 28px 22px', position: 'relative' }}>
                        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <X size={15} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Stethoscope size={22} color="white" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.01em' }}>VETCARE SYSTEM</div>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                                    {mode === 'login' ? 'Đăng nhập tài khoản' : mode === 'register' ? 'Tạo tài khoản khách hàng' : 'Khôi phục mật khẩu'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '24px 28px 28px' }}>
                        {error && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.83rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />{error}
                            </div>
                        )}
                        {success && (
                            <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.83rem' }}>
                                ✅ {success}
                            </div>
                        )}

                        {mode === 'login' ? (
                            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={lbl}>Số điện thoại</label>
                                    <div style={{ position: 'relative' }}>
                                        <Phone size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                        <input type="text" style={{ ...inp, paddingLeft: '38px' }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" required autoFocus />
                                    </div>
                                </div>
                                <div>
                                    <label style={lbl}>Mật khẩu</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                        <input type={showPass ? 'text' : 'password'} style={{ ...inp, paddingLeft: '38px', paddingRight: '40px' }} value={pass} onChange={e => setPass(e.target.value)} placeholder="Mật khẩu" required />
                                        <EyeBtn show={showPass} toggle={() => setShowPass(v => !v)} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: '#0fa9ac', cursor: 'pointer', flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.83rem', color: '#6b7280' }}>Ghi nhớ mật khẩu</span>
                                    </label>
                                    <button type="button" onClick={() => { setMode('forgot_password'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#0fa9ac', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Quên mật khẩu?</button>
                                </div>
                                <button type="submit" disabled={isLoading} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: isLoading ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: isLoading ? '#94a3b8' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: isLoading ? 'none' : '0 4px 14px rgba(15,169,172,0.35)' }}>
                                    {isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>Khách hàng mới?</span>
                                    <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                                </div>
                                <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess(''); }} style={{ padding: '11px', borderRadius: '10px', border: '1.5px solid #ccfbf1', background: 'white', color: '#0fa9ac', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: 'inherit', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdfa'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                    <UserPlus size={15} /> Đăng ký
                                </button>
                                <p style={{ textAlign: 'center', fontSize: '0.73rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>Mật khẩu mặc định = số điện thoại của bạn</p>
                            </form>
                        ) : mode === 'forgot_password' ? (
                            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '0.9rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>Khôi phục mật khẩu</p>
                                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>Nhập email bạn đã đăng ký trên hệ thống để nhận mã xác thực đổi mật khẩu.</p>
                                <div>
                                    <label style={lbl}>Email đăng ký</label>
                                    <input type="email" style={inp} value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="VD: nguyenvan@gmail.com" required autoFocus />
                                </div>
                                <button type="submit" disabled={isLoading} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: isLoading ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: isLoading ? '#94a3b8' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: isLoading ? 'none' : '0 4px 14px rgba(15,169,172,0.35)' }}>
                                    {isLoading ? 'Đang gửi...' : 'Nhận mã xác thực'}
                                </button>
                                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
                                    ← Quay lại đăng nhập
                                </button>
                            </form>
                        ) : mode === 'verify_otp' ? (
                            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '0.9rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>Xác thực mã OTP</p>
                                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>Mã xác thực gồm 6 số đã được gửi tới <strong>{forgotEmail}</strong></p>
                                <div>
                                    <label style={lbl}>Mã xác thực (OTP)</label>
                                    <input type="text" style={{ ...inp, letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" required autoFocus />
                                </div>
                                <div>
                                    <label style={lbl}>Mật khẩu mới</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                        <input type={showNewPass ? 'text' : 'password'} style={{ ...inp, paddingLeft: '38px', paddingRight: '40px' }} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Từ 6 ký tự trở lên" required />
                                        <EyeBtn show={showNewPass} toggle={() => setShowNewPass(v => !v)} />
                                    </div>
                                </div>
                                <button type="submit" disabled={isLoading || otp.length < 6 || newPass.length < 6} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: (isLoading || otp.length < 6 || newPass.length < 6) ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: (isLoading || otp.length < 6 || newPass.length < 6) ? '#94a3b8' : 'white', fontWeight: 700, cursor: (isLoading || otp.length < 6 || newPass.length < 6) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: (isLoading || otp.length < 6 || newPass.length < 6) ? 'none' : '0 4px 14px rgba(15,169,172,0.35)' }}>
                                    {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                                </button>
                                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
                                    Hủy thao tác
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '0.9rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>Tạo tài khoản khách hàng</p>
                                {[
                                    { label: 'Họ và tên', val: regName, set: setRegName, type: 'text', ph: 'Nguyễn Văn A' },
                                    { label: 'Số điện thoại', val: regPhone, set: setRegPhone, type: 'text', ph: '0912 345 678' },
                                ].map(f => (
                                    <div key={f.label}>
                                        <label style={lbl}>{f.label}</label>
                                        <input style={inp} type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required />
                                    </div>
                                ))}
                                <div>
                                    <label style={lbl}>Mật khẩu</label>
                                    <div style={{ position: 'relative' }}>
                                        <input style={{ ...inp, paddingRight: '40px' }} type={showRegPass ? 'text' : 'password'} value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="Ít nhất 6 ký tự" required />
                                        <EyeBtn show={showRegPass} toggle={() => setShowRegPass(v => !v)} />
                                    </div>
                                </div>
                                <div>
                                    <label style={lbl}>Xác nhận mật khẩu</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            style={{
                                                ...inp,
                                                borderColor: regPass2
                                                    ? (regPass2 === regPass ? '#10b981' : '#ef4444')
                                                    : '#e2e8f0',
                                                paddingRight: '64px',
                                            }}
                                            type={showRegPass2 ? 'text' : 'password'}
                                            value={regPass2}
                                            onChange={e => setRegPass2(e.target.value)}
                                            placeholder="Nhập lại mật khẩu"
                                            required
                                        />
                                        {regPass2 && (
                                            <span style={{ position: 'absolute', right: '36px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: regPass2 === regPass ? '#10b981' : '#ef4444' }}>
                                                {regPass2 === regPass ? '✓' : '✗'}
                                            </span>
                                        )}
                                        <EyeBtn show={showRegPass2} toggle={() => setShowRegPass2(v => !v)} />
                                    </div>
                                    {regPass2 && regPass2 !== regPass && (
                                        <div style={{ fontSize: '0.73rem', color: '#ef4444', marginTop: '4px' }}>Mật khẩu không khớp</div>
                                    )}
                                </div>
                                <button type="submit" disabled={isLoading || (regPass2 && regPass2 !== regPass)} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: (isLoading || (regPass2 && regPass2 !== regPass)) ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: (isLoading || (regPass2 && regPass2 !== regPass)) ? '#94a3b8' : 'white', fontWeight: 700, cursor: (isLoading || (regPass2 && regPass2 !== regPass)) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: (isLoading || (regPass2 && regPass2 !== regPass)) ? 'none' : '0 4px 14px rgba(15,169,172,0.35)', transition: 'all 0.2s' }}>
                                    {isLoading ? 'Đang tạo...' : 'Xác nhận đăng ký'}
                                </button>
                                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    ← Quay lại đăng nhập
                                </button>
                            </form>

                        )}
                    </div>
                </div>
            </div>
        );
    }
}
