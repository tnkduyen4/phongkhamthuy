import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API } from '../constants';
import { X } from 'lucide-react';

const EmailVerificationModal = ({ isOpen, onClose, newEmail, onSuccess }) => {
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setOtp('');
            setError('');
            setSuccess('');
            setShowConfirm(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSafeClose = () => setShowConfirm(true);
    const cancelClose = () => setShowConfirm(false);
    const confirmClose = () => {
        setShowConfirm(false);
        onClose();
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!otp || otp.length < 6) { 
            setError('Vui lòng nhập đủ 6 số OTP.'); 
            return; 
        }

        setIsLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.post(`${API}/users/me/verify-email-change`, 
                { otp }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (res.data.success) {
                setSuccess('Xác thực và cập nhật email thành công!');
                setTimeout(() => {
                    onSuccess(res.data.email);
                    onClose();
                }, 1500);
            }
        } catch (err) { 
            setError(err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.'); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const inp = { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '0.9rem', outline: 'none', transition: 'all 0.2s', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' };
    const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '6px' };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }} onMouseDown={handleSafeClose}>
            <div style={{ background: 'white', padding: '28px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
                <button type="button" onClick={handleSafeClose} style={{ position: 'absolute', top: '16px', right: '16px', background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '50%', padding: '6px', color: '#64748b' }}><X size={16}/></button>

                {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.83rem' }}>{error}</div>}
                {success && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.83rem' }}>✅ {success}</div>}

                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textAlign: 'center' }}>Xác Nhận Email Mới</p>
                    <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#6b7280', textAlign: 'center', lineHeight: 1.4 }}>
                        Hệ thống đã gửi một mã OTP gồm 6 số tới địa chỉ email<br/>
                        <strong style={{color: '#111827'}}>{newEmail}</strong>
                    </p>
                    
                    <div>
                        <label style={lbl}>Mã xác thực (OTP)</label>
                        <input 
                            type="text" 
                            style={{ ...inp, letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }} 
                            value={otp} 
                            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                            placeholder="000000" 
                            inputMode="numeric" 
                            required 
                            autoFocus 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isLoading || otp.length < 6} 
                        style={{ 
                            padding: '12px', borderRadius: '10px', border: 'none', 
                            background: (isLoading || otp.length < 6) ? '#e2e8f0' : 'linear-gradient(135deg, #0fa9ac, #0891b2)', 
                            color: (isLoading || otp.length < 6) ? '#94a3b8' : 'white', 
                            fontWeight: 700, cursor: (isLoading || otp.length < 6) ? 'not-allowed' : 'pointer', 
                            fontFamily: 'inherit', transition: 'all 0.2s', marginTop: '4px' 
                        }}
                    >
                        {isLoading ? 'Đang xác thực...' : 'Xác thực & Cập nhật'}
                    </button>
                    
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
                        Lưu ý: Mã OTP sẽ hết hạn sau 15 phút.
                    </p>
                </form>

                {/* Custom Confirm Overlay */}
                {showConfirm && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', borderRadius: '20px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <X size={24} />
                        </div>
                        <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>Xóa bỏ xác nhận?</h4>
                        <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                            Bạn có chắc chắn muốn thoát? Mã OTP hiện tại sẽ <strong>mất hiệu lực</strong> và bạn phải yêu cầu mã mới.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                            <button onClick={cancelClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Ở lại</button>
                            <button onClick={confirmClose} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Thoát</button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default EmailVerificationModal;
