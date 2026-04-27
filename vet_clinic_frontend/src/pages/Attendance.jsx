import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API } from '../constants';
import axios from 'axios';
import { MapPin, Camera, Clock, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { uploadBase64ToCloudinary } from '../utils/uploadHelper';

const Attendance = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [clinicConfig, setClinicConfig] = useState(null);
    const [history, setHistory] = useState([]);
    const [myAttendance, setMyAttendance] = useState(null);
    const [viewMode, setViewMode] = useState('CHECKIN'); // CHECKIN, HISTORY, ADMIN

    // Camera states
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [hasCamera, setHasCamera] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [cfgRes, myRes] = await Promise.all([
                axios.get(`${API}/attendance/config`),
                axios.get(`${API}/attendance/my`)
            ]);
            setClinicConfig(cfgRes.data.data);
            setHistory(myRes.data.data);

            // Tìm bản ghi hôm nay
            const today = new Date().toISOString().split('T')[0];
            const todayRecord = myRes.data.data.find(a => a.date.split('T')[0] === today);
            setMyAttendance(todayRecord);
        } catch (error) {
            console.error(error);
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setHasCamera(true);
                setCapturedPhoto(null);
            }
        } catch (err) {
            showToast('Không thể truy cập máy ảnh', 'error');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            setHasCamera(false);
        }
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0);
            const photoData = canvasRef.current.toDataURL('image/jpeg', 0.8);
            setCapturedPhoto(photoData);
            stopCamera();
        }
    };

    const handleAction = async (type) => {
        if (!capturedPhoto) return showToast('Vui lòng chụp ảnh xác minh', 'warning');

        setLoading(true);
        try {
            // Lấy tọa độ GPS
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
            });

            const { latitude, longitude } = position.coords;
            const endpoint = type === 'IN' ? '/attendance/check-in' : '/attendance/check-out';

            // Upload ảnh lên Cloudinary trước khi gửi request Check-in/Check-out
            const cloudPhotoUrl = await uploadBase64ToCloudinary(capturedPhoto);

            const res = await axios.post(`${API}${endpoint}`, {
                lat: latitude,
                lng: longitude,
                photo: cloudPhotoUrl
            });

            showToast(type === 'IN' ? 'Check-in thành công!' : 'Check-out thành công!', 'success');
            setMyAttendance(res.data.data);
            fetchInitialData();
            setCapturedPhoto(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="header-box" style={{ marginBottom: '24px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(to right, var(--primary), #0891b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Chấm Công Kỹ Thuật Số
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Xác thực sinh trắc học & vị trí GPS</p>
                </div>

                {/* Tabs Navigation */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '6px', borderRadius: '12px' }}>
                    <button
                        onClick={() => setViewMode('CHECKIN')}
                        className={`btn ${viewMode === 'CHECKIN' ? 'btn-primary' : ''}`}
                        style={{ flex: 1, border: 'none', background: viewMode === 'CHECKIN' ? 'var(--primary)' : 'transparent', color: viewMode === 'CHECKIN' ? '#fff' : '#64748b' }}
                    >
                        Chấm Công
                    </button>
                    <button
                        onClick={() => setViewMode('HISTORY')}
                        className={`btn ${viewMode === 'HISTORY' ? 'btn-primary' : ''}`}
                        style={{ flex: 1, border: 'none', background: viewMode === 'HISTORY' ? 'var(--primary)' : 'transparent', color: viewMode === 'HISTORY' ? '#fff' : '#64748b' }}
                    >
                        Lịch Sử
                    </button>
                    {user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setViewMode('ADMIN')}
                            className={`btn ${viewMode === 'ADMIN' ? 'btn-primary' : ''}`}
                            style={{ flex: 1, border: 'none', background: viewMode === 'ADMIN' ? 'var(--primary)' : 'transparent', color: viewMode === 'ADMIN' ? '#fff' : '#64748b' }}
                        >
                            Quản Lý
                        </button>
                    )}
                </div>

                {viewMode === 'CHECKIN' && (
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>
                                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </div>
                        </div>

                        {/* Camera Area */}
                        <div style={{
                            width: '100%',
                            aspectRatio: '4/3',
                            background: '#1e293b',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            position: 'relative',
                            marginBottom: '24px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                        }}>
                            {!capturedPhoto ? (
                                <>
                                    {!hasCamera ? (
                                        <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '16px', color: '#94a3b8' }}>
                                            <Camera size={48} strokeWidth={1} />
                                            <button className="btn btn-primary" onClick={startCamera}>Mở Camera Xác Minh</button>
                                        </div>
                                    ) : (
                                        <>
                                            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                onClick={takePhoto}
                                                style={{
                                                    position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                                                    width: '64px', height: '64px', borderRadius: '50%', border: '4px solid #fff',
                                                    background: 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: '0.2s'
                                                }}
                                                onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.6)'}
                                                onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
                                            />
                                        </>
                                    )}
                                </>
                            ) : (
                                <div style={{ position: 'relative', height: '100%' }}>
                                    <img src={capturedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Captured" />
                                    <button
                                        onClick={() => { setCapturedPhoto(null); startCamera(); }}
                                        style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
                                    >
                                        <RefreshCw size={20} />
                                    </button>
                                </div>
                            )}
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {!myAttendance?.checkIn?.time ? (
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1, height: '56px', fontSize: '1.1rem', borderRadius: '16px' }}
                                    onClick={() => handleAction('IN')}
                                    disabled={loading || !capturedPhoto}
                                >
                                    {loading ? 'Đang xác thực...' : 'Check-in Bắt đầu ca'}
                                </button>
                            ) : !myAttendance?.checkOut?.time ? (
                                <button
                                    className="btn btn-secondary"
                                    style={{ flex: 1, height: '56px', fontSize: '1.1rem', borderRadius: '16px', background: '#f59e0b', color: '#fff' }}
                                    onClick={() => handleAction('OUT')}
                                    disabled={loading || !capturedPhoto}
                                >
                                    {loading ? 'Đang xác thực...' : 'Check-out Kết thúc ca'}
                                </button>
                            ) : (
                                <div className="flex-center" style={{ flex: 1, height: '56px', background: '#f0fdf4', color: '#16a34a', borderRadius: '16px', fontWeight: 600, gap: '8px' }}>
                                    <CheckCircle size={20} /> Bạn đã hoàn tất ngày làm việc!
                                </div>
                            )}
                        </div>

                        {/* Status Info */}
                        {myAttendance && (
                            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="glass-card" style={{ padding: '16px', background: '#f8fafc' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Giờ vào:</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                        {myAttendance.checkIn ? new Date(myAttendance.checkIn.time).toLocaleTimeString() : '--:--'}
                                    </div>
                                    {myAttendance.checkIn?.isLate && (
                                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Trễ {myAttendance.checkIn.lateMinutes}p</div>
                                    )}
                                </div>
                                <div className="glass-card" style={{ padding: '16px', background: '#f8fafc' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Giờ ra:</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                        {myAttendance.checkOut ? new Date(myAttendance.checkOut.time).toLocaleTimeString() : '--:--'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: '#fff9eb', border: '1px solid #feebc8', display: 'flex', gap: '12px' }}>
                            <AlertCircle size={20} color="#d97706" />
                            <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                                <strong>Lưu ý:</strong> Hệ thống sử dụng GPS để xác minh bạn đang ở phòng khám. Ca sáng bắt đầu lúc {clinicConfig?.shifts?.DAY?.start || '08:00'}.Trễ quá {clinicConfig?.gracePeriod || 15}p sẽ bị tính phạt.
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'HISTORY' && (
                    <div className="glass-card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Ngày</th>
                                    <th>Giờ vào</th>
                                    <th>Giờ ra</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(att => (
                                    <tr key={att._id}>
                                        <td>{new Date(att.date).toLocaleDateString('vi-VN')}</td>
                                        <td>
                                            {att.checkIn?.time ? new Date(att.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td>
                                            {att.checkOut?.time ? new Date(att.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td>
                                            <span className={`badge ${att.status === 'PRESENT' ? 'badge-success' : att.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`}>
                                                {att.status === 'PRESENT' ? 'Đúng giờ' : att.status === 'LATE' ? `Trễ ${att.checkIn?.lateMinutes}p` : att.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>Chưa có dữ liệu</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {viewMode === 'ADMIN' && user?.role === 'ADMIN' && (
                    <AdminAttendanceView clinicConfig={clinicConfig} />
                )}
            </div>
        </Layout>
    );
};

// Component con cho Admin quản lý
const AdminAttendanceView = ({ clinicConfig }) => {
    const [allLogs, setAllLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchAllLogs();
    }, [month, year]);

    const fetchAllLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API}/attendance/all`, { params: { month, year } });
            setAllLogs(res.data.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0 }}>Quản Lý Chấm Công Hệ Thống</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <select className="input-field" value={month} onChange={e => setMonth(e.target.value)} style={{ padding: '8px' }}>
                        {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                    </select>
                    <select className="input-field" value={year} onChange={e => setYear(e.target.value)} style={{ padding: '8px' }}>
                        {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                        <tr>
                            <th>Nhân viên</th>
                            <th>Ngày</th>
                            <th>Check-in</th>
                            <th>Check-out</th>
                            <th>Trễ</th>
                            <th>Ảnh ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allLogs.map(log => (
                            <tr key={log._id}>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{log.staffId?.fullName}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.staffId?.role}</div>
                                </td>
                                <td>{new Date(log.date).toLocaleDateString('vi-VN')}</td>
                                <td>{log.checkIn?.time ? new Date(log.checkIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                <td>{log.checkOut?.time ? new Date(log.checkOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                <td style={{ color: log.checkIn?.isLate ? '#ef4444' : 'inherit' }}>
                                    {log.checkIn?.isLate ? `${log.checkIn.lateMinutes}p` : '-'}
                                </td>
                                <td>
                                    {log.checkIn?.photo ? (
                                        <img
                                            src={log.checkIn.photo}
                                            alt="FaceID"
                                            style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                                            onClick={() => window.open(log.checkIn.photo)}
                                        />
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Attendance;
