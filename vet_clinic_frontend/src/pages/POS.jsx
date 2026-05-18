import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { Trash2, Plus, QrCode, ShoppingCart, User, Package, DollarSign, Search, X, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';

/* ─────────────────────────────────────────
   Debounce helper
───────────────────────────────────────── */
function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

const API = 'https://vet-clinic-1j57.onrender.com/api/v1';
const token = () => sessionStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${token()}` });

const formatCurrency = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

/* ─────────────────────────────────────────
   ProductRow — mỗi dòng sản phẩm có ô tìm kiếm
───────────────────────────────────────── */
const ProductRow = ({ index, item, allMedicines, onChange, onRemove, onProductSelect }) => {
    const [search, setSearch] = useState('');
    const filtered = allMedicines.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase())
    );
    const selected = allMedicines.find(m => m._id === item.medicineId);

    return (
        <div className="pos-product-row" style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            background: 'white',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid #eef2f5',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            position: 'relative',
            cursor: 'default'
        }}>
            <div style={{
                width: '32px',
                height: '32px',
                background: '#f1f5f9',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#64748b',
                flexShrink: 0
            }}>
                {index + 1}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <div style={{ position: 'relative' }}>
                    <input
                        className="input-field"
                        style={{ marginBottom: 0, background: '#f8fafc', border: '1px solid #e2e8f0' }}
                        placeholder="Tìm sản phẩm (Tên, Mã...)"
                        value={search || (selected ? selected.name : '')}
                        onFocus={() => setSearch('')}
                        onChange={e => { setSearch(e.target.value); onChange('medicineId', ''); }}
                    />
                    {search !== '' && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '240px', overflowY: 'auto', zIndex: 100 }}>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '16px', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>Không tìm thấy sản phẩm</div>
                            ) : filtered.map(m => (
                                <div key={m._id}
                                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: '0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    onClick={() => { onChange('medicineId', m._id); if (onProductSelect) onProductSelect(m.name); setSearch(''); }}
                                >
                                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{m.name}</div>
                                    <div style={{ color: 'var(--primary)', fontSize: '0.82rem', marginTop: '2px', fontWeight: 600 }}>
                                        {formatCurrency(m.retailPrice)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· Kho: {m.stockQuantity} {m.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {selected && search === '' && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>Đơn giá: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(selected.retailPrice)}</strong></span>
                        <span style={{ color: '#64748b' }}>Tồn kho: <strong style={{ color: selected.stockQuantity < 10 ? '#dc2626' : '#059669' }}>{selected.stockQuantity} {selected.unit}</strong></span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '80px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'center' }}>S.Lượng</label>
                    <input
                        type="number" min="1"
                        className="input-field"
                        style={{ marginBottom: 0, textAlign: 'center', fontWeight: 700 }}
                        value={item.quantity}
                        onChange={e => onChange('quantity', Math.max(1, Number(e.target.value)))}
                    />
                </div>
                <button
                    className="btn-icon"
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '12px', width: '42px', height: '42px', marginTop: '18px' }}
                    onClick={onRemove} title="Xóa dòng này"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────
   Modal tạo khách mới
───────────────────────────────────────── */
const NewCustomerModal = ({ phone, onCreated, onClose }) => {
    const [form, setForm] = useState({ fullName: '', phoneNumber: phone || '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!form.fullName || !form.phoneNumber) { setErr('Vui lòng nhập Tên và Số điện thoại.'); return; }

        // Validation SĐT Việt Nam (10 số)
        const vnf_regex = /((09|03|07|08|05)+([0-9]{8})\b)/g;
        if (!vnf_regex.test(form.phoneNumber)) {
            setErr('Số điện thoại không đúng định dạng (phải có 10 số và đầu số hợp lệ).');
            return;
        }

        setSaving(true); setErr('');
        try {
            const res = await axios.post(`${API}/users/quick-customer`, form, { headers: headers() });
            onCreated(res.data.data);
        } catch (e) {
            setErr(e.response?.data?.message || 'Không tạo được khách hàng mới');
        } finally { setSaving(false); }
    };

    return createPortal(
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
            <div className="modal-container glass-card animate-slide-up" style={{ width: '90%', maxWidth: '450px', background: 'white', padding: 0, borderRadius: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Tạo thẻ khách hàng</h3>
                    <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={onClose}><X size={24} /></button>
                </div>
                <div style={{ padding: '24px 28px' }}>
                    {err && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 600 }}>{err}</div>}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>Họ và tên *</label>
                        <input className="input-field" style={{ marginBottom: 0 }} placeholder="Ví dụ: Nguyễn Văn A" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>Số điện thoại *</label>
                        <input className="input-field" style={{ marginBottom: 0 }} placeholder="090..." value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} />
                    </div>
                </div>
                <div style={{ padding: '16px 28px', borderTop: '1px solid #eef2f5', background: '#f8fafc', display: 'flex', gap: '12px' }}>
                    <button className="btn" style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0' }} onClick={onClose}>Huỷ bỏ</button>
                    <button className="btn btn-primary" style={{ flex: 2, fontWeight: 700 }} disabled={saving} onClick={submit}>
                        {saving ? 'Đang lưu...' : 'Tạo thẻ & Tích điểm'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

/* ─────────────────────────────────────────
   Main POS Page
───────────────────────────────────────── */
const POS = () => {
    const [phoneInput, setPhoneInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggest, setShowSuggest] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [showConfirmCheckout, setShowConfirmCheckout] = useState(false);

    const [cartItems, setCartItems] = useState([{ medicineId: '', quantity: 1 }]);
    const [allMedicines, setAllMedicines] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [discountAmount, setDiscountAmount] = useState('');
    const [pointsUsed, setPointsUsed] = useState('');
    const [clinicConfig, setClinicConfig] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [printData, setPrintData] = useState(null);
    const [amountReceived, setAmountReceived] = useState('');
    const [changeAmount, setChangeAmount] = useState(0);

    const { toast } = useToast();
    const debouncedPhone = useDebounce(phoneInput, 300);
    const inputRef = useRef();

    // Lấy danh sách sản phẩm và cấu hình
    useEffect(() => {
        axios.get(`${API}/inventory/medicines`, { headers: headers() })
            .then(r => { if (r.data.success) setAllMedicines(r.data.data.filter(m => m.stockQuantity > 0)); })
            .catch(console.error);

        axios.get(`${API}/attendance/config`, { headers: headers() })
            .then(r => { if (r.data.success) setClinicConfig(r.data.data); })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (debouncedPhone.length < 3) { setSuggestions([]); setShowSuggest(false); return; }
        axios.get(`${API}/users?role=CUSTOMER&search=${debouncedPhone}`, { headers: headers() })
            .then(r => {
                const list = r.data.data || [];
                const mappedList = list.map(c => ({
                    ...c,
                    rewardPoints: c.customerProfile?.rewardPoints || 0
                }));
                setSuggestions(mappedList.slice(0, 8));
                setShowSuggest(true);
            })
            .catch(() => setSuggestions([]));
    }, [debouncedPhone]);

    const selectCustomer = (c) => {
        setSelectedCustomer(c);
        setPhoneInput(c.phoneNumber);
        setShowSuggest(false);
    };

    const total = cartItems.reduce((acc, curr) => {
        if (!curr.medicineId) return acc;
        const med = allMedicines.find(m => m._id === curr.medicineId);
        return acc + (med ? (med.retailPrice || 0) * curr.quantity : 0);
    }, 0);

    const valuePerPoint = clinicConfig?.rewardPointsConfig?.valuePerPoint || 1000;
    const globalMaxPoint = clinicConfig?.rewardPointsConfig?.maxPointsPerUse || 999999;

    const maxPByConfig = selectedCustomer ? Math.min(selectedCustomer.rewardPoints, globalMaxPoint) : 0;
    const billSubtotal = Math.max(0, total - (Number(discountAmount) || 0));
    const maxPByBill = Math.floor(billSubtotal / valuePerPoint);
    const actualMaxPoints = Math.min(maxPByConfig, maxPByBill);

    const pointsDiscount = (Number(pointsUsed) || 0) * valuePerPoint;
    const finalTotal = Math.max(0, total - (Number(discountAmount) || 0) - pointsDiscount);

    const resetForm = () => {
        setCartItems([{ medicineId: '', quantity: 1 }]);
        setSelectedCustomer(null);
        setPhoneInput('');
        setSuggestions([]);
        setAmountReceived('');
        setChangeAmount(0);
        setDiscountAmount('');
        setPointsUsed('');
        // Re-fetch to update stock counts
        axios.get(`${API}/inventory/medicines`, { headers: headers() })
            .then(r => { if (r.data.success) setAllMedicines(r.data.data.filter(m => m.stockQuantity > 0)); });
    };

    const updateCartItem = (index, field, value) => {
        setCartItems(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
        // Reset change amounts when cart changes
        setAmountReceived('');
        setChangeAmount(0);
    };

    const handleCheckoutClick = () => {
        setSuccessMsg(''); setErrorMsg('');
        const validItems = cartItems.filter(i => i.medicineId && i.quantity > 0);
        if (validItems.length === 0) { setErrorMsg('Vui lòng chọn ít nhất 1 sản phẩm.'); return; }

        const checkTotal = validItems.reduce((sum, item) => {
            const med = allMedicines.find(m => m._id === item.medicineId);
            return sum + (med ? med.retailPrice * item.quantity : 0);
        }, 0);

        if (checkTotal <= 0) {
            setErrorMsg('Không thể xuất hóa đơn 0đ. Vui lòng kiểm tra lại giá sản phẩm.');
            return;
        }
        setShowConfirmCheckout(true);
    };

    const checkout = async () => {
        setSubmitting(true); setSuccessMsg(''); setErrorMsg(''); setShowConfirmCheckout(false);
        try {
            let cid = selectedCustomer?._id;
            if (!cid) {
                // Tạo khách vãng lai ẩn danh
                const guestRes = await axios.post(`${API}/users/quick-customer`,
                    { fullName: 'Khách Vãng Lai', phoneNumber: `VL${Date.now()}` },
                    { headers: headers() }
                );
                cid = guestRes.data.data._id;
            }
            const validItems = cartItems.filter(i => i.medicineId && i.quantity > 0).map(item => {
                const med = allMedicines.find(m => m._id === item.medicineId);
                return {
                    medicineId: item.medicineId,
                    quantity: item.quantity,
                    productName: med?.name || 'Sản phẩm'
                };
            });

            const invoiceRes = await axios.post(`${API}/invoices`, {
                customerId: cid,
                invoiceType: 'RETAIL',
                retailItems: validItems,
                discountAmount: Number(discountAmount) || 0,
                pointsUsed: Number(pointsUsed) || 0,
                paymentMethod,
            }, { headers: headers() });

            setSuccessMsg('Đã thu tiền và xuất kho thành công!');
            toast('Đã thu tiền và xuất kho thành công!', 'success', 5000);

            // Hiện bản in ngay lập tức
            if (invoiceRes.data.success) {
                setPrintData(invoiceRes.data.data);
                setShowPdfPreview(true);
            }
            resetForm();
        } catch (err) {
            const msg = err.response?.data?.message || 'Lỗi xuất hóa đơn';
            setErrorMsg(msg);
            toast(msg, 'error');
        } finally { setSubmitting(false); }
    };



    return (
        <Layout>
            {showNewModal && (
                <NewCustomerModal
                    phone={phoneInput}
                    onCreated={(c) => { setSelectedCustomer(c); setPhoneInput(c.phoneNumber); setShowNewModal(false); }}
                    onClose={() => setShowNewModal(false)}
                />
            )}

            <div className="dashboard-header flex-between animate-fade-in" style={{ marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Bán Hàng</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Bán lẻ phụ kiện, thức ăn, thuốc — không cần qua khám bệnh</p>
                </div>
            </div>

            <div className="animate-slide-up" style={{ maxWidth: '760px' }}>
                <div className="glass-card" style={{ padding: '28px' }}>

                    {/* Thông báo - Chỉ giữ lỗi, bỏ thông báo xanh vì đã có Toast */}
                    {errorMsg && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 600 }}>{errorMsg}</div>}

                    {/* ── 1. TÌM KHÁCH ─────────────────────── */}
                    <section style={{ marginBottom: '28px' }}>
                        <label style={{ fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
                            1 · Khách hàng
                        </label>

                        {selectedCustomer ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '12px 16px', borderRadius: '10px' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#065f46' }}>{selectedCustomer?.fullName || 'Khách vãng lai'}</div>
                                    <div style={{ fontSize: '0.87rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {selectedCustomer?.phoneNumber || '---'}
                                        {selectedCustomer?.rewardPoints !== undefined && (
                                            <span style={{ background: '#d1fae5', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', color: '#059669' }}>
                                                {selectedCustomer.rewardPoints} điểm tích lũy
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button style={{ background: 'transparent', border: '1px solid #6ee7b7', color: '#065f46', cursor: 'pointer', borderRadius: '6px', padding: '4px 12px', fontSize: '0.85rem' }}
                                    onClick={() => { setSelectedCustomer(null); setPhoneInput(''); }}>Đổi khách</button>
                            </div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <input
                                    ref={inputRef}
                                    className="input-field"
                                    style={{ marginBottom: 0, paddingLeft: '14px' }}
                                    placeholder="Nhập số điện thoại để tìm hoặc tạo mới..."
                                    value={phoneInput}
                                    onChange={e => { setPhoneInput(e.target.value); setSelectedCustomer(null); }}
                                    onBlur={() => setTimeout(() => setShowSuggest(false), 180)}
                                    onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                                    autoComplete="off"
                                />
                                {/* Google-style dropdown */}
                                {showSuggest && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 999, overflow: 'hidden'
                                    }}>
                                        {suggestions.map(c => (
                                            <div key={c._id}
                                                style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', display: 'flex', gap: '12px', alignItems: 'center' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                onMouseDown={() => selectCustomer(c)}
                                            >
                                                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                                                    {c.fullName?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{c?.fullName || 'Khách vãng lai'}</div>
                                                    <div style={{ fontSize: '0.83rem', color: '#64748b' }}>
                                                        {c?.phoneNumber || '---'} {c.rewardPoints > 0 ? ` • ${c.rewardPoints} điểm` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Tạo khách mới */}
                                        <div
                                            style={{ padding: '11px 16px', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', borderTop: suggestions.length > 0 ? '1px solid #e2e8f0' : 'none' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                            onMouseDown={() => { setShowSuggest(false); setShowNewModal(true); }}
                                        >
                                            + Tạo thẻ khách hàng mới {phoneInput && `"${phoneInput}"`} để tích điểm
                                        </div>
                                    </div>
                                )}
                                {/* Nếu gõ nhưng chưa thấy dropdown */}
                                {phoneInput.length >= 1 && !showSuggest && !selectedCustomer && (
                                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Không tìm thấy khách? <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                                            onClick={() => setShowNewModal(true)}>Tạo thẻ khách mới</button> hoặc <button
                                                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, gap: '4px' }}
                                                onClick={() => setPhoneInput('')}>
                                            <X size={14} /> Bán vãng lai
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ── 2. GIỎ HÀNG ──────────────────────── */}
                    <section style={{ marginBottom: '28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <label style={{ fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                2 · Sản phẩm
                            </label>
                            <button
                                style={{ background: '#eff6ff', border: '1px dashed #3b82f6', color: '#2563eb', cursor: 'pointer', borderRadius: '6px', padding: '4px 14px', fontSize: '0.85rem', fontWeight: 600 }}
                                onClick={() => setCartItems(prev => [...prev, { medicineId: '', quantity: 1 }])}
                            >+ Thêm dòng</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {cartItems.map((item, i) => (
                                <ProductRow
                                    key={i}
                                    index={i}
                                    item={item}
                                    allMedicines={allMedicines}
                                    onChange={(field, value) => updateCartItem(i, field, value)}
                                    onProductSelect={(name) => toast(`Đã thêm ${name}`, 'success')}
                                    onRemove={() => setCartItems(prev => prev.filter((_, idx) => idx !== i))}
                                />
                            ))}
                            {cartItems.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '10px', color: '#94a3b8', border: '1px dashed #cbd5e1', fontSize: '0.9rem' }}>
                                    Giỏ hàng trống — nhấn <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} /> "Thêm dòng" để bắt đầu
                                </div>
                            )}
                        </div>

                        {/* Discount & Points */}
                        {total > 0 && (
                            <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '400px', justifyContent: 'flex-end' }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Khuyến mãi (VNĐ)</label>
                                        <input
                                            type="number" min="0" placeholder="0"
                                            className="input-field" style={{ marginBottom: 0, padding: '8px 12px' }}
                                            value={discountAmount} onChange={e => setDiscountAmount(e.target.value)}
                                        />
                                    </div>
                                    {selectedCustomer && selectedCustomer.rewardPoints > 0 && (
                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                            <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Dùng điểm <span style={{ color: '#059669' }}>({valuePerPoint}đ/đ)</span></label>
                                            <input
                                                type="number" min="0" max={actualMaxPoints} placeholder={`Tối đa: ${actualMaxPoints}`}
                                                className="input-field" style={{ marginBottom: 0, padding: '8px 12px' }}
                                                value={pointsUsed} onChange={e => {
                                                    const val = Math.min(Number(e.target.value), actualMaxPoints);
                                                    setPointsUsed(val || '');
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '8px' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Tổng tiền hàng: {formatCurrency(total)}</div>
                                    {Number(discountAmount) > 0 && <div style={{ fontSize: '0.9rem', color: '#dc2626', fontWeight: 600 }}>Khuyến mãi: -{formatCurrency(Number(discountAmount))}</div>}
                                    {Number(pointsUsed) > 0 && <div style={{ fontSize: '0.9rem', color: '#dc2626', fontWeight: 600 }}>Đổi điểm: -{formatCurrency(pointsDiscount)}</div>}
                                    <div style={{ fontWeight: 900, fontSize: '1.4rem', color: 'var(--primary)', marginTop: '4px' }}>
                                        Cần thanh toán: {formatCurrency(finalTotal)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── 3. THANH TOÁN ────────────────────── */}
                    <section style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '20px' }}>
                        {/* ... payment methods ... */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {[['CASH', 'Tiền mặt'], ['TRANSFER', 'Chuyển khoản'], ['CARD', 'Quẹt thẻ']].map(([val, label]) => (
                                <button key={val}
                                    onClick={() => setPaymentMethod(val)}
                                    style={{
                                        padding: '10px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem', transition: '0.15s',
                                        background: paymentMethod === val ? 'var(--primary)' : '#f1f5f9',
                                        color: paymentMethod === val ? 'white' : 'var(--text-main)',
                                        border: paymentMethod === val ? '2px solid' + (paymentMethod === val ? ' var(--primary)' : ' transparent') : '2px solid transparent'
                                    }}
                                >{label}</button>
                            ))}
                        </div>

                        {paymentMethod === 'CASH' && finalTotal > 0 && (
                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>Tiền khách đưa (VNĐ)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ marginBottom: 0, fontWeight: 700, fontSize: '1.1rem' }}
                                        value={amountReceived}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAmountReceived(val);
                                            setChangeAmount(val ? Number(val) - finalTotal : 0);
                                        }}
                                        placeholder="Vd: 500000"
                                    />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>Tiền thừa trả khách</label>
                                    <div style={{
                                        height: '48px',
                                        background: changeAmount < 0 ? '#fee2e2' : '#dcfce7',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 16px',
                                        fontWeight: 800,
                                        fontSize: '1.2rem',
                                        color: changeAmount < 0 ? '#dc2626' : '#059669',
                                        border: '1px solid ' + (changeAmount < 0 ? '#fecaca' : '#bbf7d0')
                                    }}>
                                        {formatCurrency(changeAmount)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentMethod === 'TRANSFER' && finalTotal > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ background: '#f0fdf4', border: '2px solid #34d399', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', color: '#065f46', marginBottom: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Quét mã QR Thanh toán</div>
                                    <div style={{ display: 'inline-block', background: 'white', padding: '12px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                                        <img
                                            src={`https://qr.sepay.vn/img?acc=106878233519&bank=Vietinbank&amount=${finalTotal}&des=ThanhToanDonHang`}
                                            alt="QR Code"
                                            style={{ width: '220px', height: '220px', display: 'block' }}
                                        />
                                    </div>
                                    <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#059669' }}>
                                        {formatCurrency(finalTotal)}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px', background: 'rgba(255,255,255,0.5)', padding: '4px 12px', borderRadius: '20px', display: 'inline-block' }}>
                                        Nội dung: <strong>ThanhToanDonHang</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 700, background: 'var(--primary)', boxShadow: '0 6px 16px rgba(99,102,241,0.25)' }}
                            disabled={submitting}
                            onClick={handleCheckoutClick}
                        >
                            {submitting ? 'Đang xử lý...' : 'Thu tiền & Xuất kho'}
                        </button>

                        {!selectedCustomer && (
                            <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.82rem', color: '#94a3b8' }}>
                                Chưa chọn khách — sẽ ghi nhận là Khách Vãng Lai
                            </p>
                        )}
                    </section>
                </div>

                {/* ===== PDF PREVIEW MODAL ===== */}
                {showPdfPreview && printData && createPortal(
                    <div className="pos-print-wrapper" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.9)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                        <style>
                            {`
                                /* BỘ CSS CHUẨN IN ẤN TỪ Invoices.jsx */
                                @media print {
                                    html, body {
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        height: auto !important;
                                        overflow: visible !important;
                                        background: white !important;
                                    }

                                    /* Ẩn toàn bộ UI */
                                    body > *:not(.pos-print-wrapper) {
                                        display: none !important;
                                        height: 0 !important;
                                        overflow: hidden !important;
                                    }

                                    /* Ẩn phần UI xem trước trên màn hình khi In */
                                    .pos-print-modal {
                                        display: none !important;
                                    }

                                    .pos-print-wrapper {
                                        display: block !important;
                                        position: relative !important;
                                        background: transparent !important;
                                        z-index: 1000 !important;
                                        inset: auto !important;
                                        width: 100% !important;
                                        height: auto !important;
                                        backdrop-filter: none !important;
                                        -webkit-backdrop-filter: none !important;
                                    }

                                    #pos-print-section {
                                        display: block !important;
                                        width: 210mm !important;
                                        margin: 0 auto !important;
                                        padding: 0 !important;
                                        position: relative !important;
                                        background: white !important;
                                    }

                                    .pos-print-paper {
                                        display: block !important;
                                        width: 210mm !important;
                                        min-height: 297mm !important; /* Chuẩn A4 doc */
                                        padding: 20mm !important;
                                        box-sizing: border-box !important;
                                        page-break-after: always !important;
                                        page-break-inside: avoid !important;
                                        background: white !important;
                                        border: none !important;
                                        box-shadow: none !important;
                                        -webkit-print-color-adjust: exact !important; color-adjust: exact !important;
                                    }

                                    @page { size: A4 portrait; margin: 0; }
                                }
                                #pos-print-section { display: none; }
                            `}
                        </style>

                        {/* ===== PHẦN CHỈ DÀNH CHO IN ẤN (ẨN TRÊN APP) ===== */}
                        <div id="pos-print-section">
                            <div className="pos-print-paper">
                                <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '25px', textAlign: 'center' }}>
                                    <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem', color: '#000' }}>HÓA ĐƠN BÁN LẺ</h1>
                                    <div style={{ marginTop: '5px', fontSize: '1.1rem', fontWeight: 800, color: '#000' }}>VETCARE CLINIC - BỆNH VIỆN THÚ Y</div>
                                    <div style={{ fontSize: '0.85rem' }}>ĐC: Trung tâm VetCare - Hotline: 1900 1000</div>
                                </div>

                                <div style={{ marginBottom: '30px', fontSize: '1rem', lineHeight: '1.6' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Khách hàng: <strong>{printData.customerId?.fullName || 'Khách vãng lai'}</strong></span>
                                        <span>Mã số HĐ: <strong>#{printData._id?.slice(-8).toUpperCase()}</strong></span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Ngày in: {new Date().toLocaleString('vi-VN')}</span>
                                        <span>Thu ngân: <strong>{printData.receptionistId?.fullName || (printData.staffId?.fullName || (printData.creatorId?.fullName || 'VetCare'))}</strong></span>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #000' }}>
                                            <th style={{ padding: '12px 5px', textAlign: 'left' }}>SẢN PHẨM MUA LẺ</th>
                                            <th style={{ padding: '12px 5px', textAlign: 'center' }}>SL</th>
                                            <th style={{ padding: '12px 5px', textAlign: 'right' }}>ĐƠN GIÁ</th>
                                            <th style={{ padding: '12px 5px', textAlign: 'right' }}>THÀNH TIỀN</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {printData.retailItems?.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '10px 5px', borderBottom: '1px solid #eee' }}>
                                                    <strong>{item.productName || 'Sản phẩm lẻ'}</strong>
                                                </td>
                                                <td style={{ padding: '10px 5px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{item.quantity}</td>
                                                <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(item.unitPrice)}</td>
                                                <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(item.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        {(printData.discountAmount > 0) && (
                                            <tr>
                                                <td colSpan="3" style={{ padding: '10px 5px', textAlign: 'right', color: '#666' }}>Giảm giá khuyến mãi:</td>
                                                <td style={{ padding: '10px 5px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(printData.discountAmount)}</td>
                                            </tr>
                                        )}
                                        {(printData.pointsUsed > 0) && (
                                            <tr>
                                                <td colSpan="3" style={{ padding: '10px 5px', textAlign: 'right', color: '#666' }}>Đổi điểm:</td>
                                                <td style={{ padding: '10px 5px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(printData.pointsUsed * (clinicConfig?.rewardPointsConfig?.valuePerPoint || 1000))}</td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td colSpan="3" style={{ padding: '20px 5px', textAlign: 'right', fontWeight: 800 }}>TỔNG THANH TOÁN:</td>
                                            <td style={{ padding: '20px 5px', textAlign: 'right', fontWeight: 900, fontSize: '1.4rem', borderTop: '2px solid #000' }}>{formatCurrency(printData.finalTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>

                                <div style={{ marginTop: 'auto', textAlign: 'center', fontStyle: 'italic', fontSize: '0.9rem', color: '#666' }}>
                                    Xin cảm ơn Quý khách và hẹn gặp lại Boss!
                                </div>
                            </div>
                        </div>

                        {/* ===== PHẦN UI MODAL XEM TRƯỚC TRÊN MÀN HÌNH (SẼ BỊ ẨN KHI IN) ===== */}
                        <div className="glass-card pos-print-modal" style={{ background: '#f8fafc', borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '95%', maxWidth: '800px', height: '90vh' }}>
                            <div className="pos-print-header" style={{ padding: '24px 40px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        XEM TRƯỚC HÓA ĐƠN BÁN LẺ
                                    </div>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Hệ thống tự động tạo phiếu thu cho đơn hàng lẻ.</p>
                                </div>
                                <button className="pos-print-close-btn" style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowPdfPreview(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-body pos-print-body" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', gap: '30px', justifyContent: 'center', background: '#e2e8f0' }}>
                                <div style={{ width: '595px', minWidth: '595px', minHeight: '842px', background: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '50px', display: 'flex', flexDirection: 'column', border: '1px solid #cbd5e1' }}>
                                    <div style={{ textAlign: 'center', borderBottom: '3px solid #1e293b', paddingBottom: '20px', marginBottom: '30px' }}>
                                        <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#1e293b' }}>HÓA ĐƠN BÁN LẺ</div>
                                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Bệnh Viện Thú Y VetCare — Hotline: 1900 1000</div>
                                    </div>
                                    <div style={{ marginBottom: '30px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span>Mã số HĐ: <strong>#{printData._id?.slice(-8).toUpperCase()}</strong></span>
                                            <span>Ngày: {new Date(printData.createdAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div>Khách hàng: <strong>{printData.customerId?.fullName || 'Khách vãng lai'}</strong></div>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>SẢN PHẨM / DỊCH VỤ</th>
                                                <th style={{ padding: '12px', textAlign: 'center' }}>SL</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>THÀNH TIỀN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {printData.retailItems?.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 600 }}>{item.productName || 'Sản phẩm lẻ'}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Đơn giá: {formatCurrency(item.unitPrice)}</div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{item.quantity}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ marginTop: 'auto', background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                                        {printData.discountAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#64748b', marginBottom: '8px' }}>
                                                <span>Khuyến mãi:</span>
                                                <span style={{ color: '#dc2626' }}>-{formatCurrency(printData.discountAmount)}</span>
                                            </div>
                                        )}
                                        {printData.pointsUsed > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#64748b', marginBottom: '8px' }}>
                                                <span>Dùng điểm:</span>
                                                <span style={{ color: '#dc2626' }}>-{formatCurrency(printData.pointsUsed * (clinicConfig?.rewardPointsConfig?.valuePerPoint || 1000))}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>
                                            <span>TỔNG THANH TOÁN:</span>
                                            <span>{formatCurrency(printData.finalTotal || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pos-print-footer" style={{ padding: '24px 40px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '16px', background: 'white' }}>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, height: '56px' }} onClick={() => setShowPdfPreview(false)}>Đóng</button>
                                <button className="btn btn-primary" style={{ flex: 1.5, height: '56px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }} onClick={() => window.print()}>
                                    <CheckCircle2 size={24} /> XÁC NHẬN IN (PDF)
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* ===== CONFIRM CHECKOUT MODAL ===== */}
                {showConfirmCheckout && createPortal(
                    <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                        <div className="modal-container glass-card animate-slide-up" style={{ width: '90%', maxWidth: '400px', padding: 0, borderRadius: '24px', overflow: 'hidden' }}>
                            <div style={{ background: '#f8fafc', padding: '24px', borderBottom: '1px solid #eef2f5', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#059669' }}>
                                    <ShoppingCart size={32} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>Xác nhận thanh toán</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>Bạn có chắc chắn muốn xuất kho và in hóa đơn cho <strong style={{ color: 'var(--primary)' }}>{selectedCustomer?.fullName || 'Khách vãng lai'}</strong>?</p>
                            </div>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: '#64748b' }}>Tổng tiền hàng:</span>
                                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{formatCurrency(total)}</strong>
                                </div>
                                {Number(discountAmount) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: '#64748b' }}>Khuyến mãi:</span>
                                        <strong style={{ color: '#dc2626', fontSize: '1rem' }}>-{formatCurrency(Number(discountAmount))}</strong>
                                    </div>
                                )}
                                {Number(pointsUsed) > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span style={{ color: '#64748b' }}>Đổi điểm:</span>
                                        <strong style={{ color: '#dc2626', fontSize: '1rem' }}>-{formatCurrency(pointsDiscount)}</strong>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                                    <span style={{ color: '#0f172a', fontWeight: 800 }}>Cần thanh toán:</span>
                                    <strong style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{formatCurrency(finalTotal)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '8px' }}>
                                    <span style={{ color: '#64748b' }}>Thanh toán qua:</span>
                                    <strong style={{ color: 'var(--primary)' }}>{paymentMethod === 'CASH' ? 'Tiền mặt' : paymentMethod === 'TRANSFER' ? 'Chuyển khoản' : 'Quẹt thẻ'}</strong>
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', display: 'flex', gap: '12px', background: '#f8fafc', borderTop: '1px solid #eef2f5' }}>
                                <button className="btn" style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0' }} onClick={() => setShowConfirmCheckout(false)}>Hủy</button>
                                <button className="btn btn-primary" style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }} onClick={checkout}>Xác nhận xuất</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </Layout>
    );
};

export default POS;
