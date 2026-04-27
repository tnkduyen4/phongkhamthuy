import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, Mail, Lock, UserCheck, AlertCircle, Camera, CheckCircle2, ArrowRight, RefreshCw, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API } from '../constants';
import { loadFaceModels, validateFacePhoto, checkFaceDuplicate } from '../utils/faceVerify';
import { uploadBase64ToCloudinary } from '../utils/uploadHelper';

const ForceChangePassword = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const { logout, user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const navigate = useNavigate();

    // Camera states
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [validating, setValidating] = useState(false);
    const [validationMsg, setValidationMsg] = useState(null); // { ok, text }

    // Gắn stream sau khi camera mở và video element được render
    useEffect(() => {
        if (isCameraOpen && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOpen]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            streamRef.current = stream;
            setIsCameraOpen(true);
        } catch (err) {
            setError('Không thể truy cập camera. Vui lòng cấp quyền camera.');
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setIsCameraOpen(false);
    };

    const takePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(photoData);
        setValidationMsg(null);
        stopCamera();

        // Lưu snapshot canvas trước khi bắt đầu async (tránh mất dữ liệu)
        const imgCtx = canvasRef.current.getContext('2d');
        const snapshot = imgCtx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

        setValidating(true);
        try {
            // ── Bước 1: Load model AI ─────────────────────────────────────────────
            await loadFaceModels();

            // ── Bước 2: Kiểm tra chất lượng ảnh ──────────────────────────────────
            const result = await validateFacePhoto(canvasRef.current);
            if (!result.valid) {
                setValidationMsg({ ok: false, text: result.message });
                setTimeout(() => { setCapturedPhoto(null); setValidationMsg(null); startCamera(); }, 2800);
                return;
            }

            // ── Bước 3: Kiểm tra trùng khuôn mặt — FAIL-SAFE (mọi lỗi đều CHẶN) ─
            setValidationMsg({ ok: null, text: '🔍 Đang đối chiếu khuôn mặt với hệ thống...' });

            let staffList = [];
            try {
                const token = sessionStorage.getItem('token');
                const res = await fetch('http://localhost:5000/api/v1/users/me/other-face-photos', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error(`Server trả lỗi HTTP ${res.status}`);
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'API không phản hồi đúng');
                staffList = data.data || [];
            } catch (fetchErr) {
                // Server chưa restart, mất mạng, hoặc route chưa tồn tại → CHẶN
                console.error('[FaceCheck] Lỗi fetch:', fetchErr.message);
                setValidationMsg({
                    ok: false,
                    text: '⚠️ Không thể kết nối hệ thống kiểm tra khuôn mặt. Vui lòng thử lại.'
                });
                setTimeout(() => { setCapturedPhoto(null); setValidationMsg(null); startCamera(); }, 3500);
                return;
            }

            // Khôi phục canvas từ snapshot trước khi so sánh descriptor
            imgCtx.putImageData(snapshot, 0, 0);

            const dupResult = await checkFaceDuplicate(canvasRef.current, staffList);
            if (dupResult.isDuplicate) {
                setValidationMsg({ ok: false, text: dupResult.message });
                setTimeout(() => { setCapturedPhoto(null); setValidationMsg(null); startCamera(); }, 4500);
                return;
            }

            // ── Bước 4: Ảnh hợp lệ, không trùng ─────────────────────────────────
            setValidationMsg({ ok: true, text: `✅ ${result.message}` });

        } catch (err) {
            console.error('[FaceCheck] Lỗi tổng:', err);
            setValidationMsg({ ok: false, text: 'Lỗi kiểm tra khuôn mặt. Vui lòng chụp lại.' });
            setTimeout(() => { setCapturedPhoto(null); setValidationMsg(null); startCamera(); }, 2500);
        } finally {
            setValidating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        if (!isAdmin && (!capturedPhoto || validationMsg?.ok === false)) {
            setError('Vui lòng chụp ảnh khuôn mặt hợp lệ để đăng ký xác thực chấm công.');
            return;
        }

        setLoading(true);
        try {
            const cloudUrl = await uploadBase64ToCloudinary(capturedPhoto);
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API}/auth/change-initial-password`, 
                { newPassword, verificationPhoto: cloudUrl },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setSuccess(true);
                setTimeout(() => {
                    logout();
                    navigate('/login');
                }, 3000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh', padding: '40px 20px' }}>
            <div className="login-box animate-slide-up" style={{ maxWidth: '550px', width: '100%' }}>
                <div className="login-header flex-center" style={{ flexDirection: 'column' }}>
                    <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '20px', borderRadius: '50%', marginBottom: '20px' }}>
                        <ShieldCheck size={48} color="var(--primary)" />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b' }}>Kích Hoạt Tài Khoản</h2>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '400px', margin: '8px auto 0' }}>
                        Chào mừng thành viên mới! Vui lòng thiết lập mật khẩu cá nhân và đăng ký khuôn mặt để bắt đầu làm việc.
                    </p>
                </div>

                {error && (
                    <div className="error-message animate-fade-in" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <AlertCircle size={20} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
                    </div>
                )}

                {success ? (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ color: '#059669', marginBottom: '16px' }}>
                            <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
                        </div>
                        <h3 style={{ color: '#065f46', fontSize: '1.2rem', fontWeight: 700 }}>Thiết lập hoàn tất!</h3>
                        <p style={{ color: '#047857', marginTop: '8px' }}>Tài khoản đã được kích hoạt. Bạn sẽ được chuyển về trang đăng nhập trong giây lát...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="login-form">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            <div className="input-group">
                                <label className="input-label" style={{ color: '#475569', fontWeight: 600 }}>Mật Khẩu Mới</label>
                                <div className="input-with-icon" style={{ position: 'relative' }}>
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        className="input-field"
                                        style={{ paddingRight: '40px' }}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                    <Lock className="input-icon" size={20} />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label" style={{ color: '#475569', fontWeight: 600 }}>Xác Nhận Lại</label>
                                <div className="input-with-icon" style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        className="input-field"
                                        style={{ paddingRight: '40px' }}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                    <Lock className="input-icon" size={20} />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="input-group" style={{ marginBottom: '32px', display: isAdmin ? 'none' : 'block' }}>
                            <label className="input-label" style={{ color: '#475569', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
                                Đăng Ký Khuôn Mặt (Dùng chấm công)
                            </label>
                            <div style={{ 
                                width: '100%', aspectRatio: '16/9', background: '#1e293b', 
                                borderRadius: '16px', overflow: 'hidden', position: 'relative' 
                            }}>
                                {!capturedPhoto ? (
                                    <>
                                        {isCameraOpen ? (
                                            <>
                                                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                {/* Khung oval guide */}
                                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)', width: '130px', height: '160px', border: '2px dashed rgba(255,255,255,0.8)', borderRadius: '50%', pointerEvents: 'none' }} />
                                                {/* Hướng dẫn */}
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '8px', fontSize: '0.72rem', color: '#e0f2fe', textAlign: 'center' }}>
                                                    Nhìn thẳng · Đủ sáng · Không đeo kính / khẩu trang
                                                </div>
                                                <button
                                                    type="button" onClick={takePhoto}
                                                    style={{ position: 'absolute', bottom: '46px', left: '50%', transform: 'translateX(-50%)', width: '56px', height: '56px', borderRadius: '50%', border: '4px solid #fff', background: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                                                />
                                            </>
                                        ) : (
                                            <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: '#94a3b8', gap: '12px' }}>
                                                <Camera size={48} />
                                                <button type="button" className="btn btn-primary" onClick={startCamera}>Mở Camera</button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ position: 'relative', height: '100%' }}>
                                        <img src={capturedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Seed" />

                                        {/* Spinner khi đang validate */}
                                        {validating && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#fff' }}>
                                                <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
                                                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Đang phân tích khuôn mặt...</span>
                                            </div>
                                        )}

                                        {/* Trạng thái: đang so sánh với hệ thống (ok=null) */}
                                        {!validating && validationMsg && validationMsg.ok === null && (
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,132,199,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', textAlign: 'center' }}>
                                                <Loader2 size={32} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                                                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '8px 12px', margin: 0 }}>
                                                    {validationMsg.text}
                                                </p>
                                            </div>
                                        )}

                                        {/* Kết quả validation cuối (ok=true/false) */}
                                        {!validating && validationMsg && validationMsg.ok !== null && (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                background: validationMsg.ok ? 'rgba(22,163,74,0.4)' : 'rgba(239,68,68,0.5)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', textAlign: 'center'
                                            }}>
                                                <span style={{ fontSize: '2.2rem' }}>{validationMsg.ok ? '✅' : '❌'}</span>
                                                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '8px 12px', margin: 0 }}>
                                                    {validationMsg.text}
                                                </p>
                                            </div>
                                        )}

                                        {/* Chụp lại — ẩn khi đang validate */}
                                        {!validating && (
                                            <button
                                                type="button" onClick={() => { setCapturedPhoto(null); setValidationMsg(null); startCamera(); }}
                                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', padding: '8px' }}
                                            >
                                                <RefreshCw size={20} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="login-btn" 
                            disabled={loading}
                            style={{ 
                                background: 'linear-gradient(135deg, var(--primary) 0%, #0891b2 100%)',
                                boxShadow: '0 10px 15px -3px rgba(15, 169, 172, 0.4)',
                                height: '56px', fontSize: '1.1rem'
                            }}
                        >
                            {loading ? 'Đang kích hoạt...' : 'HOÀN TẤT THIẾT LẬP'}
                        </button>
                    </form>
                )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
};

export default ForceChangePassword;
