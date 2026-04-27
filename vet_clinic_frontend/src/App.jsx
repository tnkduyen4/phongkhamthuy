import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import MedicalRecords from './pages/MedicalRecords'
import Inventory from './pages/Inventory'
import Invoices from './pages/Invoices'
import Users from './pages/Users'
import Pets from './pages/Pets'
import Staff from './pages/Staff'
import Services from './pages/Services'
import MySchedule from './pages/MySchedule'
import POS from './pages/POS'
import Grooming from './pages/Grooming'
import Attendance from './pages/Attendance'
import Profile from './pages/Profile'
import ForceChangePassword from './pages/ForceChangePassword'
import ClinicSettings from './pages/ClinicSettings'
import Helpdesk from './pages/Helpdesk'

import CustomerDisplay from './pages/CustomerDisplay'
import LandingPage from './pages/LandingPage'
import ChatWidget from './components/ChatWidget'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: '#fff', color: '#1e293b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444', marginBottom: 16 }}>⚠️ Lỗi Runtime - Ứng dụng gặp sự cố</h2>
          <pre style={{ background: '#fee2e2', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #fca5a5', fontSize: 13 }}>
            {this.state.error && this.state.error.toString()}
            {this.state.error && this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#0fa9ac', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Tải lại trang</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const EntryRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center" style={{ height: '100vh' }}>Đang tải hệ thống...</div>;
  if (!user) return <Navigate to="/?login=true" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (user.role === 'CUSTOMER') return <Navigate to="/" replace />;
  return <Navigate to="/appointments" replace />;
};

const GlobalChat = () => {
  const { user } = useAuth();
  if (!user || user.role === 'CUSTOMER') return <ChatWidget />;
  return null;
};

const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center" style={{ height: '100vh' }}>Đang tải hệ thống...</div>;
  // ADMIN/Staff → vào trang quản trị
  if (user && user.role === 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (user && user.role !== 'CUSTOMER' && user.role !== 'ADMIN') return <Navigate to="/appointments" replace />;
  // Chưa đăng nhập hoặc CUSTOMER → luôn ở trang Landing Page
  return <LandingPage />;
};

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
              {/* Root: Landing Page cho khách chưa đăng nhập / Điều hướng nếu đã đăng nhập */}
              <Route path="/" element={<RootRoute />} />

              {/* Trang Đăng Nhập (Công khai) đã chuyển sang Modal ở Landing Page */}
              <Route path="/login" element={<Navigate to="/?login=true" replace />} />

              {/* Điều hướng thông minh sau khi đăng nhập */}
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <EntryRoute />
                  </ProtectedRoute>
                }
              />

              {/* Quản lý Lịch Hẹn */}
              <Route
                path="/appointments"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER']}>
                    <Appointments />
                  </ProtectedRoute>
                }
              />

              {/* Hồ sơ Bệnh Án — chỉ bác sĩ và admin */}
              <Route
                path="/records"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR']}>
                    <MedicalRecords />
                  </ProtectedRoute>
                }
              />



              {/* Kho Thuốc */}
              <Route
                path="/inventory/*"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR']}>
                    <Inventory />
                  </ProtectedRoute>
                }
              />

              {/* Lịch trực cá nhân */}
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER']}>
                    <MySchedule />
                  </ProtectedRoute>
                }
              />

              {/* Hóa Đơn */}
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER']}>
                    <Invoices />
                  </ProtectedRoute>
                }
              />

              {/* Bán Hàng Nhanh (POS) */}
              <Route
                path="/pos"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST']}>
                    <POS />
                  </ProtectedRoute>
                }
              />

              {/* Khách hàng */}
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST']}>
                    <Users />
                  </ProtectedRoute>
                }
              />

              {/* Quản lý Nhân Sự (Chỉ Admin & Manager) */}
              <Route
                path="/staff/*"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Staff />
                  </ProtectedRoute>
                }
              />

              {/* Thú cưng */}
              <Route
                path="/pets"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER']}>
                    <Pets />
                  </ProtectedRoute>
                }
              />

              {/* Dịch vụ (Bảng giá) */}
              <Route
                path="/services"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Services />
                  </ProtectedRoute>
                }
              />

              {/* Grooming workspace */}
              <Route
                path="/grooming"
                element={
                  <ProtectedRoute allowedRoles={['GROOMER', 'RECEPTIONIST', 'ADMIN']}>
                    <Grooming />
                  </ProtectedRoute>
                }
              />

              {/* Chấm Công */}
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'GROOMER']}>
                    <Attendance />
                  </ProtectedRoute>
                }
              />

              {/* Bảng điều khiển (Dashboard) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Trung tâm Hỗ trợ (Helpdesk) */}
              <Route
                path="/helpdesk"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST']}>
                    <Helpdesk />
                  </ProtectedRoute>
                }
              />

              {/* Cài đặt phòng khám */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <ClinicSettings />
                  </ProtectedRoute>
                }
              />

              {/* Hồ sơ cá nhân & Cài đặt */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              {/* Màn hình phụ cho khách hàng (Quét QR) */}
              <Route path="/customer-display" element={<CustomerDisplay />} />

              {/* Kích hoạt tài khoản lần đầu (đổi mật khẩu + đăng ký khuôn mặt) */}
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ForceChangePassword />
                  </ProtectedRoute>
                }
              />
              {/* Customer Portal đã được tích hợp vào Landing Page tại / */}
              {/* Redirect mọi /customer/* về / */}
              <Route path="/customer/*" element={<Navigate to="/" replace />} />

              {/* Mặc định: 404 hoặc quay về / */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <GlobalChat />
          </AuthProvider>
        </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider >
    </ErrorBoundary>
  )
}

export default App
