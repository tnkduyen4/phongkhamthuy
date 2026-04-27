import React, { useState } from 'react';
import axios from 'axios';
import { API } from '../constants';
import { Lock, Eye as EyeIcon, EyeOff as EyeOffIcon, X } from 'lucide-react';

const EyeBtn = ({ show, toggle }) => (
    <button type="button" onClick={toggle} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}>
        {show ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
    </button>
);

const InternalForgotPasswordModal = ({ isOpen, onClose, userEmail }) => {
    const [mode, setMode] = useState('forgot_password');
    const [otp, setOtp] = useState('');
    const [newPass, setNewPass] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!isOpen) return null;

    const handleForgotPassword = async (e) => {
        e.preventDefault(); setError(''); setSuccess('');
        setIsLoading(true);
        try {
            const res = await axios.post(`${API}/auth/forgot-password`, { email: userEmail });
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
            const res = await axios.post(`${API}/auth/reset-password`, { email: userEmail, otp, newPassword: newPass });
            if (res.data.success) {
                setSuccess('Mật khẩu đã được đặt lại thành công!');
                setTimeout(() => { 
                    onClose(); 
                    setMode('forgot_password'); 
                    setOtp(''); 
                    setNewPass(''); 
                    setSuccess(''); 
                }, 2000);
            }
        } catch (err) { setError(err.response?.data?.message || 'Lỗi đặt lại mật khẩu.'); }
        finally { setIsLoading(false); }
    };

    const inp = { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '0.9rem', outline: 'none', transition: 'all 0.2s', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' };
    const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '6px' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }} onMouseDown={onClose}>
            <div style={{ background: 'white', padding: '28px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
                <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '50%', padding: '6px', color: '#64748b' }}><X size={16}/></button>

                {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.83rem' }}>{error}</div>}
                {success && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.83rem' }}>✅ {success}</div>}

                {mode === 'forgot_password' ? (
                    <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textAlign: 'center' }}>Khôi phục mật khẩu</p>
                        <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>Gửi mã xác thực về email cá nhân của bạn để đổi mật khẩu.</p>
                        <div>
                            <label style={lbl}>Email đăng ký</label>
                            <input type="email" style={{...inp, background: '#e5e7eb', color: '#6b7280', cursor: 'not-allowed'}} value={userEmail} disabled />
                        </div>
                        <button type="submit" disabled={isLoading} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: isLoading ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: isLoading ? '#94a3b8' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                            {isLoading ? 'Đang gửi...' : 'Nhận mã xác thực OTP'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textAlign: 'center' }}>Xác thực mã OTP</p>
                        <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>Mã xác thực gồm 6 số đã được gửi tới <strong>{userEmail}</strong></p>
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
                        <button type="submit" disabled={isLoading || otp.length < 6 || newPass.length < 6} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: (isLoading || otp.length < 6 || newPass.length < 6) ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', color: (isLoading || otp.length < 6 || newPass.length < 6) ? '#94a3b8' : 'white', fontWeight: 700, cursor: (isLoading || otp.length < 6 || newPass.length < 6) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                            {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default InternalForgotPasswordModal;
