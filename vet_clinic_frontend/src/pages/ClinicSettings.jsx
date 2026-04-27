import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { MapPin, Clock, Save, Loader2, AlertCircle, RefreshCw, Navigation, Wallet, Percent, ShieldAlert } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { API } from '../constants';

// Fix icon leaflet bị vỡ khi dùng với bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const getToken = () => sessionStorage.getItem('token');
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });
const SHIFT_LABELS = { DAY: 'Ca Ngày', EVENING: 'Ca Chiều', NIGHT: 'Ca Tối' };

// Component lắng nghe click trên bản đồ → cập nhật tọa độ
const MapClickHandler = ({ onLocationChange }) => {
    useMapEvents({ click(e) { onLocationChange(e.latlng.lat, e.latlng.lng); } });
    return null;
};

// Component tự fly tới đúng vị trí khi lat/lng thay đổi từ bên ngoài
const MapFlyTo = ({ lat, lng }) => {
    const map = useMap();
    const prev = useRef(null);
    useEffect(() => {
        if (prev.current && (prev.current.lat !== lat || prev.current.lng !== lng)) {
            map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.8 });
        }
        prev.current = { lat, lng };
    }, [lat, lng, map]);
    return null;
};

const ClinicSettings = () => {
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [config,   setConfig]   = useState(null);
    const [hrmConfigs, setHrmConfigs] = useState([]);
    const [locating, setLocating] = useState(false);

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const [attRes, hrmRes] = await Promise.all([
                axios.get(`${API}/attendance/config`, { headers: authHeader() }),
                axios.get(`${API}/hrm/configs`, { headers: authHeader() })
            ]);
            setConfig(attRes.data.data);
            setHrmConfigs(hrmRes.data.data.map(c => ({
                ...c,
                commissionServiceRate: (c.commissionServiceRate || 0) * 100,
                commissionMedicineRate: (c.commissionMedicineRate || 0) * 100,
            })));
        } catch (err) { 
            console.error(err);
            showToast('Không tải được cấu hình hệ thống.', 'error'); 
        } finally { setLoading(false); }
    };

    const handleHrmChange = (role, field, val) => {
        setHrmConfigs(prev => prev.map(c => c.role === role ? { ...c, [field]: val } : c));
    };

    const handleSaveHrm = () => {
        showConfirm('Lưu Chính Sách Lương & Hoa Hồng', 'Bạn có chắc chắn muốn cập nhật toàn bộ cấu hình lương và hoa hồng?', async () => {
            setSaving(true);
            try {
                const parsedHrm = hrmConfigs.map(cfg => ({
                    ...cfg,
                    baseSalary: parseFloat(cfg.baseSalary) || 0,
                    commissionServiceRate: (parseFloat(cfg.commissionServiceRate) || 0) / 100,
                    commissionMedicineRate: (parseFloat(cfg.commissionMedicineRate) || 0) / 100,
                    nightShiftAllowance: parseFloat(cfg.nightShiftAllowance) || 1.5,
                    absentPenaltyPerDay: parseFloat(cfg.absentPenaltyPerDay) || 0
                }));
                await axios.put(`${API}/hrm/configs/all`, { configs: parsedHrm }, { headers: authHeader() });
                showToast('Đã lưu cấu hình Lương & Hoa Hồng!', 'success');
            } catch (err) { showToast(err.response?.data?.message || 'Lưu thất bại.', 'error'); } 
            finally { setSaving(false); }
        });
    };

    const handleSaveGeneral = () => {
        showConfirm('Lưu Quy Định Hệ Thống', 'Bạn có chắc chắn muốn cập nhật tọa độ GPS, Giờ ca, Đi trễ và Điểm tích lũy?', async () => {
            setSaving(true);
            try {
                await axios.put(`${API}/attendance/config`, config, { headers: authHeader() });
                showToast('Đã lưu cấu hình hệ thống!', 'success');
            } catch (err) { showToast(err.response?.data?.message || 'Lưu thất bại.', 'error'); } 
            finally { setSaving(false); }
        });
    };

    const handleSavePenalties = () => {
        showConfirm('Lưu Quy Định Đi Trễ & Vắng Mặt', 'Bạn có chắc chắn muốn cập nhật quy định xử phạt?', async () => {
            setSaving(true);
            try {
                const parsedHrm = hrmConfigs.map(cfg => ({
                    ...cfg,
                    baseSalary: parseFloat(cfg.baseSalary) || 0,
                    commissionServiceRate: (parseFloat(cfg.commissionServiceRate) || 0) / 100,
                    commissionMedicineRate: (parseFloat(cfg.commissionMedicineRate) || 0) / 100,
                    nightShiftAllowance: parseFloat(cfg.nightShiftAllowance) || 1.5,
                    absentPenaltyPerDay: parseFloat(cfg.absentPenaltyPerDay) || 0
                }));
                await Promise.all([
                    axios.put(`${API}/attendance/config`, config, { headers: authHeader() }),
                    axios.put(`${API}/hrm/configs/all`, { configs: parsedHrm }, { headers: authHeader() })
                ]);
                showToast('Đã cập nhật quy định xử phạt!', 'success');
            } catch (err) { showToast('Lưu lỗi', 'error'); }
            finally { setSaving(false); }
        });
    };

    const handleLocationChange = useCallback((lat, lng) => {
        setConfig(prev => ({ ...prev, location: { ...prev.location, lat: +lat.toFixed(6), lng: +lng.toFixed(6) } }));
    }, []);

    const autoLocate = () => {
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                handleLocationChange(pos.coords.latitude, pos.coords.longitude);
                showToast('Đã lấy vị trí hiện tại!', 'success');
                setLocating(false);
            },
            () => { showToast('Không lấy được vị trí GPS.', 'error'); setLocating(false); }
        );
    };

    const setLoc   = (key, val) => setConfig(p => ({ ...p, location: { ...p.location, [key]: parseFloat(val) || 0 } }));
    const setShift = (sh, key, val) => setConfig(p => ({ ...p, shifts: { ...p.shifts, [sh]: { ...p.shifts[sh], [key]: val } } }));

    if (loading || !config) return (
        <Layout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px', color: '#94a3b8' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '1rem' }}>Đang tải cấu hình...</span>
            </div>
        </Layout>
    );

    const lat = config.location.lat;
    const lng = config.location.lng;

    return (
        <Layout>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
                {/* Header */}
                <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>⚙️ Cài Đặt Hệ Thống</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                            Quản lý tập trung GPS, giờ ca, quy định chấm công và chính sách lương toàn phòng khám.
                        </p>
                    </div>
                    {/* Nút lưu chung bị loại bỏ để khuyến khích lưu riêng từng phần */}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px', alignItems: 'start' }}>
                    
                    {/* LEFT COLUMN: Map & Basic Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* GPS Location Card */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', color: 'var(--primary)' }}>
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Vị Trí Phòng Khám (GPS)</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Xác định tọa độ và phạm vi chấm công</span>
                                    </div>
                                </div>
                                <button onClick={handleSaveGeneral} disabled={saving} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu GPS
                                </button>
                            </div>

                            {/* MAP */}
                            <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1.5px solid #e2e8f0', marginBottom: '16px', height: '360px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                                <MapContainer center={[lat, lng]} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <MapClickHandler onLocationChange={handleLocationChange} />
                                    <MapFlyTo lat={lat} lng={lng} />
                                    <Marker position={[lat, lng]} draggable={true} eventHandlers={{ dragend: (e) => { const { lat: la, lng: lo } = e.target.getLatLng(); handleLocationChange(la, lo); } }} />
                                    <Circle center={[lat, lng]} radius={config.location.radius} pathOptions={{ color: '#0fa9ac', fillColor: '#0fa9ac', fillOpacity: 0.12, weight: 2 }} />
                                </MapContainer>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: '12px', alignItems: 'flex-end' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Vĩ độ</label>
                                    <input type="number" step="0.000001" value={lat} onChange={e => setLoc('lat', e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Kinh độ</label>
                                    <input type="number" step="0.000001" value={lng} onChange={e => setLoc('lng', e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Bán kính(m)</label>
                                    <input type="number" value={config.location.radius} onChange={e => setLoc('radius', e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', textAlign: 'center' }} />
                                </div>
                                <button onClick={autoLocate} disabled={locating}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '10px', border: '1.5px solid var(--primary)', background: '#f0fdfa', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', height: '40px' }}>
                                    {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                                    Lấy GPS hiện tại
                                </button>
                            </div>
                        </div>

                        {/* Salary & Commission Card */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: '#f5f3ff', padding: '8px', borderRadius: '10px', color: '#7c3aed' }}>
                                        <Wallet size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Chính Sách Lương & Hoa Hồng</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Thiết lập thu nhập theo chức danh</span>
                                    </div>
                                </div>
                                <button onClick={handleSaveHrm} disabled={saving} className="btn" style={{ background: '#7c3aed', color: 'white', padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu Lương
                                </button>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                {hrmConfigs.filter(c => c.role !== 'DEFAULT' && c.role !== 'ADMIN').map(cfg => {
                                    const roleMap = {
                                        DOCTOR: { label: 'Bác Sĩ', color: '#16a34a', bg: '#f0fdf4' },
                                        RECEPTIONIST: { label: 'Lễ Tân', color: '#2563eb', bg: '#eff6ff' },
                                        GROOMER: { label: 'Groomer', color: '#db2777', bg: '#fdf4ff' }
                                    };
                                    const info = roleMap[cfg.role] || { label: cfg.role, color: '#64748b', bg: '#f8fafc' };

                                    return (
                                        <div key={cfg.role} style={{ background: info.bg, borderRadius: '14px', padding: '16px', border: `1.5px solid ${info.color}20` }}>
                                            <div style={{ fontWeight: 800, color: info.color, fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '4px', height: '14px', background: info.color, borderRadius: '2px' }}></div>
                                                {info.label}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>Lương/giờ (đ)</label>
                                                    <input type="number" value={cfg.baseSalary || 0} onChange={e => handleHrmChange(cfg.role, 'baseSalary', e.target.value)}
                                                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700 }} />
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>% HH Dịch vụ</label>
                                                        <input type="number" step="0.1" value={cfg.commissionServiceRate} onChange={e => handleHrmChange(cfg.role, 'commissionServiceRate', e.target.value)}
                                                            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.8rem', textAlign: 'center' }} />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>% HH Thuốc</label>
                                                        <input type="number" step="0.1" value={cfg.commissionMedicineRate} onChange={e => handleHrmChange(cfg.role, 'commissionMedicineRate', e.target.value)}
                                                            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.8rem', textAlign: 'center' }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '3px' }}>Hệ số Ca Đêm (x)</label>
                                                    <input type="number" step="0.1" value={cfg.nightShiftAllowance || 1.5} onChange={e => handleHrmChange(cfg.role, 'nightShiftAllowance', e.target.value)}
                                                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', textAlign: 'center' }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Shifts & Rules */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* Shift Times Card */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '10px', color: '#d97706' }}>
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Khung Giờ Ca Làm Việc</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Xác định mốc check-in/out</span>
                                    </div>
                                </div>
                                <button onClick={handleSaveGeneral} disabled={saving} className="btn" style={{ background: '#d97706', color: 'white', padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu Ca
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {['DAY', 'EVENING', 'NIGHT'].map(sh => (
                                    <div key={sh} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', alignItems: 'center', gap: '12px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#475569' }}>{SHIFT_LABELS[sh]}</span>
                                        <div>
                                            <input type="time" value={config.shifts[sh]?.start || ''} onChange={e => setShift(sh, 'start', e.target.value)}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }} />
                                        </div>
                                        <div>
                                            <input type="time" value={config.shifts[sh]?.end || ''} onChange={e => setShift(sh, 'end', e.target.value)}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 600 }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Grace Period & Penalty */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '10px', color: '#dc2626' }}>
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Quy Định Đi Trễ & Vắng Mặt</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Xử lý vi phạm nội quy chấm công</span>
                                    </div>
                                </div>
                                <button onClick={handleSavePenalties} disabled={saving} className="btn" style={{ background: '#dc2626', color: 'white', padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu Phạt
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '14px', background: '#fdf2f2', border: '1px solid #fee2e2', borderRadius: '12px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '6px' }}>Thời gian ân hạn (phút)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input type="number" value={config.gracePeriod} onChange={e => setConfig(p => ({ ...p, gracePeriod: parseInt(e.target.value) || 0 }))}
                                            style={{ width: '80px', padding: '9px', borderRadius: '8px', border: '1.5px solid #fecaca', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }} />
                                        <span style={{ fontSize: '0.75rem', color: '#b91c1c', opacity: 0.8 }}>Đi trễ trong khoảng này không bị trừ lương</span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ padding: '14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Phạt trễ (đ / phút)</label>
                                        <input type="number" step="500" value={config.latePenaltyPerMinute} onChange={e => setConfig(p => ({ ...p, latePenaltyPerMinute: parseInt(e.target.value) || 0 }))}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 700 }} />
                                    </div>
                                    <div style={{ padding: '14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Phạt vắng (đ / ca)</label>
                                        <input type="number" step="10000" value={hrmConfigs.find(c => c.role === 'DEFAULT')?.absentPenaltyPerDay || 0} onChange={e => handleHrmChange('DEFAULT', 'absentPenaltyPerDay', e.target.value)}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 700 }} />
                                    </div>
                                </div>
                                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}>
                                    * Phạt vắng áp dụng khi nhân viên có lịch nhưng không chấm công và không có đơn xin nghỉ phép hợp lệ.
                                </div>
                            </div>
                        </div>

                        {/* Reward Points Card */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ background: '#fdf4ff', padding: '8px', borderRadius: '10px', color: '#c026d3' }}>
                                        <Percent size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Quy Định Điểm Tích Lũy</h3>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tỷ lệ quy đổi điểm</span>
                                    </div>
                                </div>
                                <button onClick={handleSaveGeneral} disabled={saving} className="btn" style={{ background: '#c026d3', color: 'white', padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu Điểm
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ padding: '14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>1 Điểm = ... VNĐ</label>
                                        <input type="number" step="1000" value={config?.rewardPointsConfig?.valuePerPoint || 1000} onChange={e => setConfig(p => ({ ...p, rewardPointsConfig: { ...(p.rewardPointsConfig || {}), valuePerPoint: parseInt(e.target.value) || 0 } }))}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 700 }} />
                                    </div>
                                    <div style={{ padding: '14px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Dùng tối đa (Điểm / Lần)</label>
                                        <input type="number" step="10" value={config?.rewardPointsConfig?.maxPointsPerUse || 100} onChange={e => setConfig(p => ({ ...p, rewardPointsConfig: { ...(p.rewardPointsConfig || {}), maxPointsPerUse: parseInt(e.target.value) || 0 } }))}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 700 }} />
                                    </div>
                                </div>
                                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}>
                                    * Giá trị quy đổi VNĐ của 1 điểm sẽ được hệ thống tự tính tự động trên Hóa đơn.
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ClinicSettings;
