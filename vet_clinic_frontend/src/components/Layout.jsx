import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import EmergencyFAB from './EmergencyFAB';
import NotificationBell from './NotificationBell';
import AdminChatPanel from './AdminChatPanel';
import { useAuth } from '../context/AuthContext';
import { subscribeUserToPush } from '../utils/PushManager';
import '../styles/Layout.css';

const Layout = ({ children }) => {
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const location = useLocation();
    const navigate = useNavigate();

    const searchParams = new URLSearchParams(location.search);
    const fromHelpdesk = searchParams.get('from') === 'helpdesk';
    const canSeeHelpdeskBtn = fromHelpdesk && user && ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user.role);

    useEffect(() => {
        // Tự động đăng ký Web Push cho nhân sự chuyên môn (Admin, Manager, Doctor)
        if (user && ['ADMIN', 'DOCTOR'].includes(user.role)) {
            subscribeUserToPush();
        }
    }, [user]);

    // Cập nhật đồng hồ mỗi giây
    useEffect(() => {
        const tick = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    const timeStr = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = currentTime.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });

    return (
        <div className={`admin-layout ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            {/* Overlay cho mobile khi sidebar mở */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

            <main className="main-content">
                {/* Top Bar / Header */}
                <header style={{
                    padding: '10px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #eef2f5',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100
                }}>
                    {/* Left: hamburger (mobile) */}
                    <button
                        className="btn-icon mobile-menu-btn"
                        onClick={toggleSidebar}
                        style={{ display: 'none' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
                    </button>

                    {/* Right: Clock + Bell */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                        {/* Đồng hồ */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums' }}>
                                {timeStr}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                                {dateStr}
                            </span>
                        </div>

                        <div style={{ width: '1px', height: '28px', background: '#e2e8f0' }} />

                        {/* Chuông thông báo */}
                        <NotificationBell />
                        
                        {/* Box tin nhắn trực tuyến Lễ tân */}
                        <AdminChatPanel />
                    </div>
                </header>

                {/* Nơi chứa nội dung động */}
                <div className="page-wrapper">
                    {children}
                </div>
            </main>
            <EmergencyFAB />

            {/* Quick Back to Helpdesk Floating Button */}
            {canSeeHelpdeskBtn && (
                <button 
                    onClick={() => navigate('/helpdesk')}
                    className="btn animate-slide-up hover-scale"
                    style={{
                        position: 'fixed',
                        bottom: '32px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none',
                        padding: '12px 28px', fontSize: '1rem', borderRadius: '30px', fontWeight: 700,
                        boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
                        cursor: 'pointer'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Quay Về Trang Hỗ Trợ
                </button>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 1024px) {
                    .mobile-menu-btn { display: flex !important; margin-right: 16px; }
                }
            `}} />
        </div>
    );
};

export default Layout;
