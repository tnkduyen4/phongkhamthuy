import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Màn hình "Không có quyền truy cập" — thay thế trang trắng báo lỗi
const AccessDenied = ({ userRole }) => {
    const navigate = useNavigate();
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{
                textAlign: 'center', padding: '48px 40px', maxWidth: '420px',
                background: 'white', borderRadius: '20px',
                boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
                border: '1px solid #f1f5f9'
            }}>
                {/* Icon khóa */}
                <div style={{
                    width: '72px', height: '72px', borderRadius: '20px',
                    background: 'linear-gradient(135deg,#fef2f2,#fee2e2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px', fontSize: '2rem'
                }}>
                    🔒
                </div>

                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                    Không có quyền truy cập
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 8px', lineHeight: 1.6 }}>
                    Tài khoản <strong style={{ color: '#0f172a' }}>{userRole}</strong> không được phép xem trang này.
                </p>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 28px', lineHeight: 1.5 }}>
                    Nếu bạn cho rằng đây là lỗi, hãy liên hệ quản trị viên để được cấp quyền.
                </p>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            padding: '9px 20px', borderRadius: '10px', fontWeight: 600,
                            fontSize: '0.85rem', cursor: 'pointer', border: '1px solid #e2e8f0',
                            background: 'white', color: '#475569',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.target.style.background = '#f8fafc'}
                        onMouseLeave={e => e.target.style.background = 'white'}
                    >
                        ← Quay lại
                    </button>
                    <button
                        onClick={() => navigate('/appointments')}
                        style={{
                            padding: '9px 20px', borderRadius: '10px', fontWeight: 600,
                            fontSize: '0.85rem', cursor: 'pointer', border: 'none',
                            background: 'var(--primary, #0fa9ac)', color: 'white',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.target.style.opacity = '0.9'}
                        onMouseLeave={e => e.target.style.opacity = '1'}
                    >
                        🏠 Về trang chính
                    </button>
                </div>
            </div>
        </div>
    );
};

// Thành phần bảo vệ route
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex-center" style={{ height: '100vh' }}>Đang tải dữ liệu...</div>;
    }

    // Chưa đăng nhập:
    // - Route /customer/* → về trang chủ (/) để thấy Landing Page marketing
    // - Route /customer/* → về trang chủ (/) để thấy Landing Page marketing
    // - Các route khác (admin/staff) → bật modal login trên trang chủ
    if (!user) {
        return <Navigate to="/?login=true" replace />;
    }

    // Bắt buộc kích hoạt tài khoản: áp dụng với nhân viên (không phải CUSTOMER)
    const isOnChangePasswordPage = location.pathname === '/change-password';
    const isStaff = user.role !== 'CUSTOMER';

    if (isStaff && !isOnChangePasswordPage && user.role !== 'ADMIN') {
        const needsPasswordChange = user.requiresPasswordChange === true;
        const needsFaceRegistration = user.hasVerificationPhoto === false;

        if (needsPasswordChange || needsFaceRegistration) {
            return <Navigate to="/change-password" replace />;
        }
    }

    // Nếu truyền mảng allowedRoles mà user không thuộc mảng đó → Hiện màn hình cảnh báo đẹp
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <AccessDenied userRole={user.role} />;
    }

    return children;
};

export default ProtectedRoute;
