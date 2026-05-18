import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    CalendarDays,
    Users,
    Dog,
    Stethoscope,
    Package,
    FileText,
    LogOut,
    UserCog,
    Tag,
    ShoppingCart,
    Sparkles,
    Clock,
    Settings,
    ListChecks,
    CalendarCheck,
    Banknote,
    Headset
} from 'lucide-react';
import '../styles/Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [waitingCount, setWaitingCount] = React.useState(0); // Ca chờ khám chưa xử lý
    const [groomingWaitingCount, setGroomingWaitingCount] = React.useState(0); // Đơn grooming chờ
    const [invoicePendingCount, setInvoicePendingCount] = React.useState(0); // Hóa đơn chờ thanh toán

    // Poll ca chờ khám mỗi 30 giây — chỉ với bác sĩ và admin
    React.useEffect(() => {
        if (!user || !['ADMIN', 'DOCTOR'].includes(user.role)) return;
        const fetchWaiting = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const res = await fetch('https://vet-clinic-backend-tgtd.onrender.com/api/v1/appointments', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    const n = data.data.filter(a =>
                        a.status === 'ARRIVED' &&
                        a.category !== 'VACCINATION' &&
                        a.type !== 'GROOMING'
                    ).length;
                    setWaitingCount(n);
                }
            } catch {}
        };
        fetchWaiting();
        const id = setInterval(fetchWaiting, 30000);
        return () => clearInterval(id);
    }, [user?.role]);

    // Poll đơn grooming chờ mỗi 30 giây — admin, groomer
    React.useEffect(() => {
        if (!user || !['ADMIN', 'GROOMER'].includes(user.role)) return;
        const fetchGrooming = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const res = await fetch('https://vet-clinic-backend-tgtd.onrender.com/api/v1/grooming', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    // Đếm đơn BOOKED (chờ check-in) và GROOMING (đang làm)
                    const n = data.data.filter(o => ['BOOKED', 'GROOMING'].includes(o.status)).length;
                    setGroomingWaitingCount(n);
                }
            } catch {}
        };
        fetchGrooming();
        const id = setInterval(fetchGrooming, 30000);
        return () => clearInterval(id);
    }, [user?.role]);

    // Poll hóa đơn chờ thanh toán mỗi 30 giây — admin, receptionist
    React.useEffect(() => {
        if (!user || !['ADMIN', 'RECEPTIONIST'].includes(user.role)) return;
        const fetchPending = async () => {
            try {
                const token = sessionStorage.getItem('token');
                // Đếm lịch hẹn READY_FOR_PAYMENT
                const aptRes = await fetch('https://vet-clinic-backend-tgtd.onrender.com/api/v1/appointments', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const aptData = await aptRes.json();
                const aptPending = aptData.success
                    ? aptData.data.filter(a => a.status === 'READY_FOR_PAYMENT').length
                    : 0;

                // Đếm đơn grooming hoàn tất chưa thanh toán
                const grRes = await fetch('https://vet-clinic-backend-tgtd.onrender.com/api/v1/grooming', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const grData = await grRes.json();
                const grPending = grData.success
                    ? grData.data.filter(o => o.status === 'DONE' && !o.isPaid).length
                    : 0;

                setInvoicePendingCount(aptPending + grPending);
            } catch {}
        };
        fetchPending();
        const id = setInterval(fetchPending, 30000);
        return () => clearInterval(id);
    }, [user?.role]);

    const [expandedMenus, setExpandedMenus] = useState({
        hrm: location.pathname.startsWith('/staff'),
        inventory: location.pathname.startsWith('/inventory')
    });

    useEffect(() => {
        setExpandedMenus(prev => ({
            ...prev,
            hrm: location.pathname.startsWith('/staff') ? true : prev.hrm,
            inventory: location.pathname.startsWith('/inventory') ? true : prev.inventory
        }));
    }, [location.pathname]);

    const toggleMenu = (key) => {
        setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleMouseEnter = (key) => setExpandedMenus(prev => ({ ...prev, [key]: true }));

    const handleMouseLeave = (key, path) => {
        setExpandedMenus(prev => ({ ...prev, [key]: false }));
    };

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        logout(); // xóa token khỏi sessionStorage
        setShowLogoutConfirm(false);
        // Dùng location.replace thay vì navigate để tránh race condition:
        // navigate('/') chạy trước khi setUser(null) apply → RootRoute vẫn thấy user → redirect /dashboard → /login
        window.location.replace('/');
    };

    // Cấu hình menu theo phân quyền
    const menuItems = [
        { name: 'Tổng Quan', path: '/', icon: <LayoutDashboard size={20} />, roles: ['ADMIN'] },
        { name: 'Lịch Hẹn', path: '/appointments', icon: <CalendarDays size={20} />, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'] },
        { name: 'Khám Bệnh', path: '/records', icon: <Stethoscope size={20} />, roles: ['ADMIN', 'DOCTOR'] },

        { name: 'Grooming', path: '/grooming', icon: <Sparkles size={20} />, roles: ['ADMIN', 'GROOMER'] },
        { name: 'Khách Hàng', path: '/users', icon: <Users size={20} />, roles: ['ADMIN', 'RECEPTIONIST'] },
        { name: 'Dịch Vụ', path: '/services', icon: <Tag size={20} />, roles: ['ADMIN'] },
        { name: 'Nhân Sự', icon: <UserCog size={20} />, roles: ['ADMIN'], key: 'hrm', path: '/staff',
            subItems: [
                { name: 'Danh Sách',  path: '/staff',           icon: <ListChecks size={15} /> },
                { name: 'Lịch Trực',  path: '/staff/schedules', icon: <CalendarCheck size={15} /> },
                { name: 'Nghỉ Phép',  path: '/staff/leaves',    icon: <FileText size={15} /> },
                { name: 'Bảng Lương', path: '/staff/payroll',   icon: <Banknote size={15} /> },
            ]
        },
        { name: 'Thú Cưng', path: '/pets', icon: <Dog size={20} />, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'] },
        { name: 'Lịch Cá Nhân', path: '/schedule', icon: <CalendarDays size={20} />, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'] },
        {
            name: 'Kho Thuốc',
            icon: <Package size={20} />,
            roles: ['ADMIN', 'DOCTOR'],
            key: 'inventory',
            path: '/inventory',
            subItems: [
                { name: 'Quản Lý Kho', path: '/inventory' },
                { name: 'Danh Mục Gốc', path: '/inventory/products', roles: ['ADMIN'] }
            ]
        },
        { name: 'Hóa Đơn', path: '/invoices', icon: <FileText size={20} />, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'] },
        { name: 'Bán Hàng', path: '/pos', icon: <ShoppingCart size={20} />, roles: ['ADMIN', 'RECEPTIONIST'] },
        { name: 'Helpdesk', path: '/helpdesk', icon: <Headset size={20} />, roles: ['ADMIN', 'RECEPTIONIST'] },
        { name: 'Cài Đặt', path: '/settings', icon: <Settings size={20} />, roles: ['ADMIN'] },
    ];

    return (
        <>
        <aside className={`sidebar flex-center animate-fade-in ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header" style={{ padding: "32px 24px", display: "flex", alignItems: "center", gap: "12px", width: '100%' }}>
                <div
                    className="logo-icon flex-center"
                    style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, rgba(15, 169, 172, 0.1) 0%, rgba(15, 169, 172, 0.02) 100%)",
                        boxShadow: "inset 0 0 0 1px rgba(15, 169, 172, 0.15), 0 4px 10px -2px rgba(15, 169, 172, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
                        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
                        <circle cx="20" cy="10" r="2.5" fill="var(--primary)" stroke="none" />
                    </svg>
                </div>
                <h2 className="brand-name" style={{ fontSize: "1.75rem", fontWeight: "800", letterSpacing: "-0.5px", margin: 0, flex: 1 }}>VetCare</h2>

                {/* Nút đóng cho mobile */}
                <button className="btn-icon mobile-close-btn" onClick={onClose} style={{ display: 'none' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 1024px) {
                    .mobile-close-btn { display: flex !important; margin-left: auto; }
                }
            `}} />  <nav className="sidebar-nav">
                {menuItems.map((item, index) => {
                    // Chỉ hiển thị menu nếu Role của user nằm trong danh sách cho phép
                    if (item.roles.includes(user?.role)) {
                        if (item.subItems) {
                            const isExpanded = expandedMenus[item.key];
                            const isActive = location.pathname.startsWith(item.path);

                            return (
                                <div
                                    key={index}
                                    className="nav-item-group"
                                    onMouseEnter={() => handleMouseEnter(item.key)}
                                    onMouseLeave={() => handleMouseLeave(item.key, item.path)}
                                >
                                    <div
                                        className={`nav-item ${isActive ? 'active' : ''}`}
                                        onClick={() => toggleMenu(item.key)}
                                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {item.icon}
                                            <span style={{ fontWeight: isActive ? '700' : '500' }}>{item.name}</span>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="sub-menu smooth-slide-down" style={{ paddingLeft: '32px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {item.subItems.map((sub, subIdx) => {
                                                if (sub.roles && !sub.roles.includes(user?.role)) return null;
                                                const isSubActive = sub.path === '/staff'
                                                    ? location.pathname === '/staff'
                                                    : location.pathname.startsWith(sub.path);
                                                return (
                                                    <NavLink
                                                        key={subIdx}
                                                        to={sub.path}
                                                        className={`nav-item sub-nav-item ${isSubActive ? 'active' : ''}`}
                                                        style={{ padding: '9px 16px', fontSize: '0.88rem', minHeight: 'auto', background: isSubActive ? 'var(--primary-glow)' : 'transparent', color: isSubActive ? 'var(--primary)' : 'var(--text-main)', fontWeight: isSubActive ? '700' : '500', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                    >
                                                        {sub.icon && <span style={{ opacity: 0.7 }}>{sub.icon}</span>}
                                                        <span>{sub.name}</span>
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <NavLink
                                key={index}
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                end={item.path === '/'}
                            >
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {item.icon}
                                    {item.path === '/records' && waitingCount > 0 && (
                                        <span className="waiting-badge">{waitingCount > 9 ? '9+' : waitingCount}</span>
                                    )}
                                    {item.path === '/grooming' && groomingWaitingCount > 0 && (
                                        <span className="waiting-badge grooming-badge">{groomingWaitingCount > 9 ? '9+' : groomingWaitingCount}</span>
                                    )}
                                    {item.path === '/invoices' && invoicePendingCount > 0 && (
                                        <span className="waiting-badge invoice-badge">{invoicePendingCount > 9 ? '9+' : invoicePendingCount}</span>
                                    )}
                                </div>
                                <span>{item.name}</span>
                            </NavLink>
                        );
                    }
                    return null;
                })}
            </nav>

            <div className="sidebar-footer">
                <NavLink to="/profile" className="user-profile card glass-card" style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px' }}>
                    <div className="avatar" style={{ flexShrink: 0 }}>{user?.fullName?.charAt(0) || 'U'}</div>
                    <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
                        <p className="user-name" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName}</p>
                        {user?.role === 'ADMIN' ? (
                            <span className="user-role-admin" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>HỆ THỐNG</span>
                        ) : (
                            <p className="user-role" style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>{user?.role}</p>
                        )}
                    </div>
                    <Settings size={16} color="var(--text-muted)" style={{ flexShrink: 0, opacity: 0.6 }} />
                </NavLink>
                <button onClick={handleLogout} className="logout-btn">
                    <LogOut size={18} />
                    <span>Đăng xuất</span>
                </button>
            </div>
        </aside>
        <style dangerouslySetInnerHTML={{ __html: `
            @keyframes badgePulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
                50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(239,68,68,0); }
            }
            @keyframes badgePulseGrooming {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(8,145,178,0.7); }
                50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(8,145,178,0); }
            }
            .waiting-badge {
                position: absolute;
                top: -7px; right: -8px;
                background: #ef4444;
                color: white;
                border-radius: 999px;
                min-width: 17px; height: 17px;
                padding: 0 4px;
                font-size: 0.62rem; font-weight: 900;
                display: flex; align-items: center; justify-content: center;
                animation: badgePulse 1.4s ease-in-out infinite;
                border: 2px solid white;
                line-height: 1;
                z-index: 10;
            }
            .grooming-badge {
                background: #0891b2;
                animation: badgePulseGrooming 1.4s ease-in-out infinite;
            }
            @keyframes badgePulseInvoice {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,158,11,0.7); }
                50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(245,158,11,0); }
            }
            .invoice-badge {
                background: #f59e0b;
                animation: badgePulseInvoice 1.4s ease-in-out infinite;
            }
        `}} />
        {/* Modal xác nhận đăng xuất */}
        {showLogoutConfirm && (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{
                    background: 'white', borderRadius: '20px', padding: '32px 28px',
                    width: '100%', maxWidth: '360px', textAlign: 'center',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👋</div>
                    <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>Đăng xuất?</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 24px' }}>Bạn có chắc muốn đăng xuất khỏi hệ thống không?</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setShowLogoutConfirm(false)}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={confirmLogout}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default Sidebar;
