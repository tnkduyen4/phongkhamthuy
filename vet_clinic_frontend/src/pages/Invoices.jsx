import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { createPortal } from 'react-dom';
import { Search, FileText, Printer, Download, Eye, Clock, User, Calendar, CreditCard, Filter, X, Package, Sparkles, CheckCircle2, ExternalLink } from 'lucide-react';
import { CustomerQuickView } from '../components/QuickViews';
import { API } from '../constants';

const Invoices = () => {
    const { toast } = useToast();
    // 1. Data States
    const [invoices, setInvoices] = useState([]);
    const [pendingAppointments, setPendingAppointments] = useState([]);
    const [pendingGrooming, setPendingGrooming] = useState([]);
    const [pendingVaccinations, setPendingVaccinations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allMedicines, setAllMedicines] = useState([]);

    // 2. Tab State
    const [activeTab, setActiveTab] = useState('PENDING');

    // 3. Print
    const [printData, setPrintData] = useState(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);

    // 4. Checkout modal
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [selectedApt, setSelectedApt] = useState(null);
    const [checkoutRecord, setCheckoutRecord] = useState(null);
    const [discountAmount, setDiscountAmount] = useState('');
    const [pointsUsed, setPointsUsed] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // 5. QR Payment state
    const [showQR, setShowQR] = useState(false);
    const [qrCountdown, setQrCountdown] = useState(120);
    const qrTimerRef = useRef(null);
    const [pendingPayload, setPendingPayload] = useState(null);
    const [amountReceived, setAmountReceived] = useState('');
    const [changeAmount, setChangeAmount] = useState(0);

    // Search state
    const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
    // QuickView State
    const [quickViewCustomerId, setQuickViewCustomerId] = useState(null);
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

    // Invoice Detail State
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [clinicConfig, setClinicConfig] = useState(null);

    const location = useLocation();

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const authHeader = { headers: { Authorization: `Bearer ${token}` } };

            // Sử dụng individual try-catch để nếu 1 endpoint lỗi thì các endpoint khác vẫn chạy
            const [invRes, aptRes, medRes, grRes, vacRes, cfgRes] = await Promise.allSettled([
                axios.get(`${API}/invoices`, authHeader),
                axios.get(`${API}/appointments`, authHeader),
                axios.get(`${API}/inventory/medicines`, authHeader),
                axios.get(`${API}/grooming?isPaid=false`, authHeader),
                axios.get(`${API}/vaccinations?status=PENDING`, authHeader),
                axios.get(`${API}/attendance/config`, authHeader)
            ]);

            let completedInvoices = [];
            if (invRes.status === 'fulfilled' && invRes.value.data.success) {
                completedInvoices = invRes.value.data.data;
                setInvoices(completedInvoices);
            }

            let initialPendingAppts = [];
            if (aptRes.status === 'fulfilled' && aptRes.value.data.success) {
                let apts = aptRes.value.data.data.filter(a => a.status === 'READY_FOR_PAYMENT');
                const billedAptIds = completedInvoices.map(inv => inv.appointmentId?._id || inv.appointmentId).filter(Boolean);
                initialPendingAppts = apts.filter(a => !billedAptIds.includes(a._id));
            }

            let groomingData = [];
            if (grRes.status === 'fulfilled' && grRes.value.data.success) {
                groomingData = grRes.value.data.data;
            }

            let vacData = [];
            if (vacRes.status === 'fulfilled' && vacRes.value.data.success) {
                vacData = vacRes.value.data.data;
            }

            // ENRICH APPOINTMENTS WITH GROOMING AND VACCINATION STATUS
            const enrichedApts = initialPendingAppts.map(apt => {
                const hasLinkedGrooming = groomingData.some(gr => {
                    const rec = gr.medicalRecordId;
                    const linkedAptId = rec?.appointmentId?._id || rec?.appointmentId;
                    return linkedAptId && String(linkedAptId) === String(apt._id);
                });
                const hasLinkedVaccination = vacData.some(vac => {
                    const linkedAptId = vac.appointmentId?._id || vac.appointmentId;
                    return linkedAptId && String(linkedAptId) === String(apt._id);
                });
                return { 
                    ...apt, 
                    _hasLinkedGrooming: hasLinkedGrooming,
                    _hasLinkedVaccination: hasLinkedVaccination 
                };
            });
            setPendingAppointments(enrichedApts);

            // FILTER REDUNDANT GROOMING CARDS
            const filteredGr = groomingData.filter(gr => {
                if (gr.medicalRecordId) {
                    const rec = gr.medicalRecordId;
                    const linkedAptId = rec.appointmentId?._id || rec.appointmentId;
                    if (initialPendingAppts.some(a => String(a._id) === String(linkedAptId))) return false;
                }
                return true;
            });
            setPendingGrooming(filteredGr);

            // FILTER REDUNDANT VACCINATIONS
            const filteredVac = vacData.filter(vac => {
                const linkedAptId = vac.appointmentId?._id || vac.appointmentId;
                if (linkedAptId && initialPendingAppts.some(a => String(a._id) === String(linkedAptId))) return false;
                return true;
            });
            setPendingVaccinations(filteredVac);

            if (medRes.status === 'fulfilled' && medRes.value.data.success) {
                setAllMedicines(medRes.value.data.data.filter(m => m.stockQuantity > 0));
            }

            if (typeof cfgRes !== 'undefined' && cfgRes.status === 'fulfilled' && cfgRes.value?.data?.success) {
                setClinicConfig(cfgRes.value.data.data);
            }

            // Handle URL params
            const params = new URLSearchParams(location.search);
            const aptId = params.get('appointmentId');
            if (aptId) {
                const target = enrichedApts.find(a => a._id === aptId);
                if (target) openCheckout(target);
            }

            // Báo lỗi nếu có yêu cầu bị lỗi
            if (invRes.status === 'rejected') {
                console.error("Lỗi fetch hóa đơn:", invRes.reason);
                toast('Không thể tải lịch sử hóa đơn. Lỗi: ' + (invRes.reason?.response?.data?.message || invRes.reason?.message), 'error');
            }
        } catch (error) {
            console.error("Lỗi lấy dữ liệu hóa đơn:", error);
            toast('Lỗi khi tải dữ liệu. Vui lòng thử lại.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('search')) setActiveTab('HISTORY');
        fetchData();
    }, [location.search]);

    useEffect(() => {
        if (!loading && location.state?.highlightInvoiceId && activeTab === 'HISTORY') {
            setTimeout(() => {
                const element = document.getElementById(`invoice-row-${location.state.highlightInvoiceId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300); // Wait for render
        } else if (!loading && location.state?.highlightInvoiceId && activeTab !== 'HISTORY') {
             setActiveTab('HISTORY'); // Switch tab first
        }
    }, [location.state, loading, activeTab]);

    const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

    const openCheckout = async (item, type = 'APPOINTMENT') => {
        // Chuẩn hóa customerId để luôn lấy được rewardPoints bất kể loại đơn nào
        const normalizedItem = {
            ...item,
            _type: type,
            customerId: item.customerId || item.petId?.ownerId,
            // Khi type=GROOMING, item chính là GroomingOrder → gán _linkedGrooming = item
            // để mọi logic đọc services/totalAmount trong modal hoạt động nhất quán
            _linkedGrooming: type === 'GROOMING' ? item : undefined
        };
        setSelectedApt(normalizedItem);
        setDiscountAmount('');
        setPointsUsed('');
        setPaymentMethod('CASH');
        setErrorMsg('');
        setSuccessMsg('');
        setCheckoutRecord(null);
        setAmountReceived('');
        setChangeAmount(0);
        setIsCheckoutModalOpen(true);
        setCheckoutLoading(true);

        const token = sessionStorage.getItem('token');
        const authHeader = { headers: { Authorization: `Bearer ${token}` } };

        try {
            if (type === 'APPOINTMENT') {
                // 1. Fetch bệnh án
                const r = await axios.get(`http://localhost:5000/api/v1/records?appointmentId=${item._id}`, authHeader);
                const records = r.data.data || [];
                if (records.length > 0) {
                    const record = records[0];
                    setCheckoutRecord(record);
                    // 2. Fetch đơn Grooming đi kèm bệnh án này (nếu có)
                    const grRes = await axios.get(`http://localhost:5000/api/v1/grooming?medicalRecordId=${record._id}`, authHeader);
                    if (grRes.data.success && grRes.data.data.length > 0) {
                        normalizedItem._linkedGrooming = grRes.data.data[0];
                    }
                }
                
                // 3. Fetch đơn Tiêm phòng đi kèm lịch hẹn này (nếu có)
                const vacRes = await axios.get(`http://localhost:5000/api/v1/vaccinations?appointmentId=${item._id}`, authHeader);
                if (vacRes.data.success && vacRes.data.data.length > 0) {
                    normalizedItem._linkedVaccination = vacRes.data.data[0];
                }
            } else if (type === 'GROOMING') {
                // Fetch bệnh án đi kèm đơn Grooming (nếu có)
                if (item.medicalRecordId) {
                    const recId = item.medicalRecordId._id || item.medicalRecordId;
                    const r = await axios.get(`http://localhost:5000/api/v1/records?_id=${recId}`, authHeader);
                    if (r.data.success && r.data.data.length > 0) setCheckoutRecord(r.data.data[0]);
                }
            }
        } catch (err) {
            console.error("Error fetching linked data for checkout:", err);
        } finally {
            setCheckoutLoading(false);
        }
    };

    const fetchFullInvoiceDetails = async (inv) => {
        let enriched = { ...inv };
        const token = sessionStorage.getItem('token');
        const authHeader = { headers: { Authorization: `Bearer ${token}` } };

        // 1. Phục hồi Bệnh án (nếu là ID hoặc thiếu prescriptions)
        const recId = enriched.medicalRecordId?._id || enriched.medicalRecordId;
        if (recId && recId !== 'undefined' && recId !== 'null' && (typeof enriched.medicalRecordId === 'string' || !enriched.medicalRecordId.prescriptions)) {
            try {
                const res = await axios.get(`http://localhost:5000/api/v1/records?_id=${recId}`, authHeader);
                if (res.data.success && res.data.data.length > 0) enriched.medicalRecordId = res.data.data[0];
            } catch (e) { console.error("Error enrichment Record:", e); }
        } else if (!enriched.medicalRecordId && enriched.appointmentId) {
             // Fallback tìm bệnh án qua appointmentId
             try {
                const aptId = enriched.appointmentId._id || enriched.appointmentId;
                if (aptId && aptId !== 'undefined' && aptId !== 'null') {
                    const res = await axios.get(`http://localhost:5000/api/v1/records?appointmentId=${aptId}`, authHeader);
                    if (res.data.success && res.data.data.length > 0) enriched.medicalRecordId = res.data.data[0];
                }
            } catch (e) { }
        }

        // 2. Phục hồi Grooming
        const gId = enriched.groomingOrderId?._id || enriched.groomingOrderId;
        if (gId && gId !== 'undefined' && gId !== 'null' && (typeof enriched.groomingOrderId === 'string' || !enriched.groomingOrderId.services)) {
             try {
                const res = await axios.get(`http://localhost:5000/api/v1/grooming?_id=${gId}`, authHeader);
                if (res.data.success && res.data.data.length > 0) enriched.groomingOrderId = res.data.data[0];
            } catch (e) { console.error("Error enrichment Grooming:", e); }
        } else if (!enriched.groomingOrderId && enriched.medicalRecordId) {
            // Thử tìm grooming đi kèm bệnh án (cho trường hợp hóa đơn gộp)
            try {
                const mId = enriched.medicalRecordId._id || enriched.medicalRecordId;
                if (mId && mId !== 'undefined' && mId !== 'null') {
                    const res = await axios.get(`http://localhost:5000/api/v1/grooming?medicalRecordId=${mId}`, authHeader);
                    if (res.data.success && res.data.data.length > 0) enriched.groomingOrderId = res.data.data[0];
                }
            } catch (e) { }
        }

        // 3. Phục hồi Tiêm phòng
        const vId = enriched.vaccinationId?._id || enriched.vaccinationId;
        if (vId && (typeof enriched.vaccinationId === 'string' || !enriched.vaccinationId.medicineId)) {
             try {
                const res = await axios.get(`http://localhost:5000/api/v1/vaccinations?_id=${vId}`, authHeader);
                if (res.data.success && res.data.data.length > 0) enriched.vaccinationId = res.data.data[0];
            } catch (e) { console.error("Error enrichment Vac:", e); }
        }

        return enriched;
    };

    const handlePrint = async (inv) => {
        const enriched = await fetchFullInvoiceDetails(inv);
        setPrintData(enriched);
        setShowPdfPreview(true);
    };

    // Kết thúc QR timer
    const stopQrTimer = () => {
        if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };

    // Bắt đầu QR countdown
    const startQrTimer = () => {
        setQrCountdown(120);
        qrTimerRef.current = setInterval(() => {
            setQrCountdown(prev => {
                if (prev <= 1) { stopQrTimer(); setShowQR(false); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleCheckout = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const token = sessionStorage.getItem('token');

        const isGrooming = selectedApt._type === 'GROOMING';
        const isVaccination = selectedApt._type === 'VACCINATION';

        let svcPrice = 0;
        if (isGrooming) svcPrice = selectedApt.totalAmount || 0;
        else if (isVaccination) svcPrice = selectedApt.price || 0;
        else svcPrice = selectedApt.serviceId?.price || 0;

        const rxItems = checkoutRecord?.prescriptions || [];
        const rxTotal = rxItems.reduce((s, p) => {
            const med = allMedicines.find(m => m._id === (p.medicineId?._id || p.medicineId));
            return s + (med ? med.retailPrice * p.quantity : 0);
        }, 0);
        const discount = Number(discountAmount) || 0;
        const inputPts = Number(pointsUsed) || 0;

        if (discount < 0) {
            toast('Số tiền giảm giá không được là số âm.', 'error');
            return;
        }
        if (inputPts < 0) {
            toast('Số điểm sử dụng không được là số âm.', 'error');
            return;
        }

        const customerPoints = selectedApt.customerId?.rewardPoints || 0;
        const ptValue = clinicConfig?.rewardPointsConfig?.valuePerPoint || 1000;
        const maxPtsConfig = clinicConfig?.rewardPointsConfig?.maxPointsPerUse || 0;

        if (maxPtsConfig > 0 && inputPts > maxPtsConfig) {
            toast(`Hệ thống giới hạn sử dụng tối đa ${maxPtsConfig} điểm cho mỗi hóa đơn.`, 'error');
            return;
        }

        if (inputPts > customerPoints) {
            toast(`Khách hàng chỉ có ${customerPoints} điểm. Không thể dùng ${inputPts} điểm.`, 'error');
            return;
        }

        const actualPtsUsed = inputPts;
        const ptsDiscount = actualPtsUsed * ptValue;
        const deposit = selectedApt.depositAmount || 0;
        
        let subtotal = svcPrice + rxTotal;
        // Nếu có Grooming gộp vào (cho UI hiển thị khớp backend)
        if (selectedApt._linkedGrooming) {
            subtotal += (selectedApt._linkedGrooming.totalAmount || 0);
        }
        // Nếu có Tiêm phòng gộp vào
        if (selectedApt._linkedVaccination) {
            subtotal += (selectedApt._linkedVaccination.price || 0);
        }

        const total = Math.max(0, subtotal - deposit - discount - ptsDiscount);

        const payload = {
            paymentMethod,
            discountAmount: discount,
            pointsUsed: actualPtsUsed,
            invoiceType: selectedApt._type,
            customerId: selectedApt.customerId?._id || selectedApt.customerId
        };

        if (selectedApt._type === 'VACCINATION') {
            payload.vaccinationId = selectedApt._id;
        } else if (selectedApt._type === 'GROOMING') {
            payload.groomingOrderId = selectedApt._id;
            // Nếu đơn grooming này có linked medical record, gửi kèm luôn
            if (selectedApt.medicalRecordId) {
                payload.medicalRecordId = selectedApt.medicalRecordId._id || selectedApt.medicalRecordId;
            }
        } else {
            payload.appointmentId = selectedApt._id;
            // Nếu là APPOINTMENT và có checkoutRecord (Bệnh án), gửi kèm ID
            if (checkoutRecord) payload.medicalRecordId = checkoutRecord._id;
            // QUAN TRỌNG: Nếu có Grooming đi kèm, gửi luôn ID để backend gom 1 hóa đơn và đánh dấu PAID
            if (selectedApt._linkedGrooming) {
                payload.groomingOrderId = selectedApt._linkedGrooming._id;
            }
        }

        // Nếu chọn chuyển khoản → hiện QR trước
        if (paymentMethod === 'TRANSFER' && !showQR) {
            setPendingPayload(payload);
            setShowQR(true);
            startQrTimer();

            // Sync with Customer Display
            const memo = `TT${selectedApt._id?.substring(18, 24)?.toUpperCase() || 'HD'}`;
            const qrUrl = `https://img.vietqr.io/image/VCB-1234567890-qr_only.png?amount=${total}&addInfo=${memo}&accountName=${encodeURIComponent('VETCARE CLINIC')}`;
            sessionStorage.setItem('vetcare_customer_display', JSON.stringify({
                status: 'PAYING',
                total,
                customerName: selectedApt.customerId?.fullName || 'Quý khách',
                memo,
                qrUrl
            }));
            return;
        }

        setSubmitLoading(true);
        setErrorMsg('');
        try {
            const res = await axios.post('http://localhost:5000/api/v1/invoices', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                stopQrTimer();
                setShowQR(false);
                setIsCheckoutModalOpen(false);
                fetchData();
                setActiveTab('HISTORY');
                toast('Hoá đơn đã được ghi nhận thành công!', 'success', 5000);

                // Tự động hiện bản xem trước để in ngay lập tức
                if (res.data.data) {
                    handlePrint(res.data.data);
                }

                // Update Customer Display to Success if it was a transfer
                if (paymentMethod === 'TRANSFER') {
                    const current = JSON.parse(sessionStorage.getItem('vetcare_customer_display') || '{}');
                    sessionStorage.setItem('vetcare_customer_display', JSON.stringify({ ...current, status: 'SUCCESS' }));
                    setTimeout(() => sessionStorage.removeItem('vetcare_customer_display'), 5000);
                }
            }
        } catch (error) {
            toast(error.response?.data?.message || 'Lỗi hệ thống khi thanh toán.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    // Xác nhận đã nhận chuyển khoản
    const confirmQrReceived = () => {
        stopQrTimer();
        handleCheckout(null);
    };

    return (
        <>
            <style>
                {`
                @media print {
                    /* KHÓA CHẾ ĐỘ IN: CHỈ HIỆN PRINT-SECTION */
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                    }

                    /* Ẩn triệt để mọi thứ khác trong body */
                    body > *:not(#print-section) {
                        display: none !important;
                        height: 0 !important;
                        overflow: hidden !important;
                    }

                    #print-section {
                        display: block !important;
                        width: 210mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        position: relative !important;
                        background: white !important;
                    }

                    .print-page {
                        display: block !important;
                        width: 210mm !important;
                        height: 297mm !important; /* Chuẩn A4 doc */
                        padding: 20mm !important;
                        box-sizing: border-box !important;
                        page-break-after: always !important;
                        page-break-inside: avoid !important;
                        background: white !important;
                    }

                    @page {
                        size: A4;
                        margin: 0;
                    }
                }
                
                /* Ẩn trên giao diện web thường */
                #print-section { display: none; }
            `}
            </style>

            {printData && createPortal(
                <div id="print-section">
                    {/* TRANG 1: HÓA ĐƠN */}
                    <div className="print-page">
                        <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '25px', textAlign: 'center' }}>
                            <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem', color: '#000' }}>Hóa Đơn Thanh Toán</h1>
                            <div style={{ marginTop: '5px', fontSize: '1.1rem', fontWeight: 800, color: '#000' }}>VETCARE CLINIC - BỆNH VIỆN THÚ Y</div>
                            <div style={{ fontSize: '0.85rem' }}>ĐC: Trung tâm VetCare - Hotline: 1900 1000</div>
                        </div>

                        <div style={{ marginBottom: '30px', fontSize: '1rem', lineHeight: '1.6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Khách hàng: <strong>{printData.customerId?.fullName || 'Khách vãng lai'}</strong></span>
                                <span>Mã số: <strong>#{printData._id.slice(-8).toUpperCase()}</strong></span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Ngày in: {new Date().toLocaleString('vi-VN')}</span>
                                <span>Người lập phiếu: <strong>{printData.receptionistId?.fullName || (printData.staffId?.fullName || (printData.creatorId?.fullName || 'Hệ thống VetCare'))}</strong></span>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #000' }}>
                                    <th style={{ padding: '12px 5px', textAlign: 'left' }}>DỊCH VỤ & SẢN PHẨM</th>
                                    <th style={{ padding: '12px 5px', textAlign: 'center' }}>SL</th>
                                    <th style={{ padding: '12px 5px', textAlign: 'right' }}>ĐƠN GIÁ</th>
                                    <th style={{ padding: '12px 5px', textAlign: 'right' }}>THÀNH TIỀN</th>
                                </tr>
                            </thead>
                            <tbody>
                                            {/* Gom tất cả dịch vụ từ mọi nguồn, dedup theo tên */}
                                            {(() => {
                                                const pSvcList = [];
                                                // appointmentId.serviceId (chỉ nếu không có grooming services)
                                                if (printData.appointmentId?.serviceId && !(printData.groomingOrderId?.services?.length)) {
                                                    const s = printData.appointmentId.serviceId;
                                                    pSvcList.push({ name: s.name, price: s.price || 0, label: s.name, diagnosis: printData.medicalRecordId?.diagnosis });
                                                }
                                                (printData.medicalRecordId?.services || []).forEach(s => {
                                                    pSvcList.push({ name: s.name || s.serviceId?.name, price: s.price ?? s.serviceId?.price ?? 0, label: s.name || s.serviceId?.name });
                                                });
                                                (printData.groomingOrderId?.services || []).forEach(s => {
                                                    pSvcList.push({ name: s.name || s.serviceId?.name, price: s.price ?? s.serviceId?.price ?? 0, label: s.name || s.serviceId?.name });
                                                });
                                                // Dedup theo tên
                                                const pSeen = new Map();
                                                pSvcList.forEach(s => {
                                                    if (!s.name) return;
                                                    if (!pSeen.has(s.name) || (s.price > 0 && pSeen.get(s.name).price === 0)) pSeen.set(s.name, s);
                                                });

                                                if (pSeen.size === 0 && printData.serviceTotal > 0) {
                                                    return <tr><td style={{ padding: '10px 5px', borderBottom: '1px solid #eee' }}><strong>Phí thăm khám/Dịch vụ chuyên môn</strong></td><td style={{ padding: '10px 5px', textAlign: 'center', borderBottom: '1px solid #eee' }}>1</td><td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(printData.serviceTotal)}</td><td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(printData.serviceTotal)}</td></tr>;
                                                }
                                                return Array.from(pSeen.values()).map((s, idx) => (
                                                    <tr key={`svc-dedup-${idx}`}>
                                                        <td style={{ padding: '10px 5px', borderBottom: '1px solid #eee' }}>
                                                            <strong>{s.label}</strong>
                                                            {s.diagnosis && <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>Chẩn đoán: {s.diagnosis}</div>}
                                                        </td>
                                                        <td style={{ padding: '10px 5px', textAlign: 'center', borderBottom: '1px solid #eee' }}>1</td>
                                                        <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(s.price)}</td>
                                                        <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(s.price)}</td>
                                                    </tr>
                                                ));
                                            })()}


                                {/* 2. Thuốc kê đơn / Tiêm chủng */}
                                {printData.invoiceType === 'VACCINATION' ? (
                                     <tr>
                                        <td style={{ padding: '10px 5px', borderBottom: '1px solid #eee' }}>
                                            <strong>Tiêm chủng: {printData.vaccinationId?.vaccineName || 'Vaccine'}</strong>
                                        </td>
                                        <td style={{ padding: '10px 5px', textAlign: 'center', borderBottom: '1px solid #eee' }}>1</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(printData.medicineTotal)}</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(printData.medicineTotal)}</td>
                                    </tr>
                                ) : (
                                    printData.medicalRecordId?.prescriptions?.map((p, idx) => {
                                        const unitPrice = p.medicineId?.retailPrice || (printData.medicineTotal / (printData.medicalRecordId?.prescriptions?.length || 1)); // Heuristic fallback
                                        return (
                                            <tr key={`rx-${idx}`}>
                                                <td style={{ padding: '10px 5px', borderBottom: '1px solid #eee' }}>
                                                    <strong>{p.medicineName || p.medicineId?.productId?.name || 'Thuốc'}</strong>
                                                </td>
                                                <td style={{ padding: '10px 5px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{p.quantity}</td>
                                                <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(unitPrice)}</td>
                                                <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(unitPrice * p.quantity)}</td>
                                            </tr>
                                        );
                                    })
                                )}

                                {/* 3. Sản phẩm bán lẻ */}
                                {printData.retailItems?.map((item, idx) => (
                                    <tr key={`rtl-${idx}`}>
                                        <td style={{ padding: '10px 5px', borderBottom: '1px solid #eee' }}>
                                            <strong>{item.productName || item.medicineId?.productId?.name || 'Sản phẩm lẻ'}</strong>
                                        </td>
                                        <td style={{ padding: '10px 5px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{item.quantity}</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(item.unitPrice)}</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                {printData.depositAmount > 0 && (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '10px 5px', textAlign: 'right', color: '#666' }}>Tiền cọc:</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(printData.depositAmount)}</td>
                                    </tr>
                                )}
                                {(printData.discountAmount > 0) && (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '10px 5px', textAlign: 'right', color: '#666' }}>Giảm giá:</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(printData.discountAmount)}</td>
                                    </tr>
                                )}
                                {(printData.pointsUsed > 0) && (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '10px 5px', textAlign: 'right', color: '#666' }}>Dùng {printData.pointsUsed} điểm:</td>
                                        <td style={{ padding: '10px 5px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(printData.pointsUsed * 1000)}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td colSpan="3" style={{ padding: '20px 5px', textAlign: 'right', fontWeight: 800 }}>TỔNG CỘNG THANH TOÁN:</td>
                                    <td style={{ padding: '20px 5px', textAlign: 'right', fontWeight: 900, fontSize: '1.4rem', borderTop: '2px solid #000' }}>{formatCurrency(printData.finalTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div style={{ marginTop: 'auto', textAlign: 'center', fontStyle: 'italic', fontSize: '0.9rem', color: '#666' }}>
                            Xin cảm ơn Quý khách và hẹn gặp lại Boss!
                        </div>
                    </div>

                    {/* TRANG 2: TOA THUỐC (Chỉ cho Appointment) */}
                    {printData.medicalRecordId && (
                        <div className="print-page">
                            <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '10px', marginBottom: '25px', textAlign: 'center' }}>
                                <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem', color: '#1e3a8a' }}>Toa Thuốc Điều Trị</h1>
                                <div style={{ marginTop: '5px', fontSize: '0.85rem', color: '#3b82f6' }}>Veterinary Prescription Journal</div>
                            </div>

                            <div style={{ marginBottom: '25px', border: '1px solid #3b82f6', padding: '20px', borderRadius: '12px', background: '#f0f7ff', fontSize: '0.95rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div>Pet: <strong>{printData.medicalRecordId?.petId?.name || printData.appointmentId?.petId?.name}</strong></div>
                                    <div>Bác sĩ: <strong>{printData.medicalRecordId?.doctorId?.fullName || printData.vaccinationId?.doctorId?.fullName || printData.appointmentId?.staffId?.fullName || 'BSTY VetCare'}</strong></div>
                                    
                                    <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: '10px' }}>
                                        <strong>Cân nặng:</strong> {printData.medicalRecordId?.weightAtVisit || '--'} kg
                                    </div>
                                    <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: '10px' }}>
                                        <strong>Nhiệt độ:</strong> {printData.medicalRecordId?.temperature || '--'} °C
                                    </div>

                                    <div style={{ gridColumn: 'span 2', marginTop: '5px' }}>
                                        <strong>Triệu chứng:</strong> {printData.medicalRecordId?.symptoms || 'Khám tổng quát'}
                                    </div>
                                    
                                    <div style={{ gridColumn: 'span 2', marginTop: '5px', color: '#1e3a8a', fontWeight: 600 }}>
                                        <strong>Chẩn đoán:</strong> {printData.medicalRecordId?.diagnosis || 'Theo dõi lâm sàng'}
                                    </div>

                                    {printData.medicalRecordId?.treatment && (
                                        <div style={{ gridColumn: 'span 2', marginTop: '5px' }}>
                                            <strong>Hướng điều trị:</strong> {printData.medicalRecordId.treatment}
                                        </div>
                                    )}

                                    {printData.medicalRecordId?.followUpDate && (
                                        <div style={{ gridColumn: 'span 2', marginTop: '10px', padding: '8px', background: '#dbeafe', borderRadius: '6px', textAlign: 'center', fontWeight: 700, color: '#1d4ed8' }}>
                                            HẸN TÁI KHÁM: {new Date(printData.medicalRecordId.followUpDate).toLocaleDateString('vi-VN')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ minHeight: '500px' }}>
                                <div style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1.1rem', color: '#1e3a8a' }}>CHỈ ĐỊNH SỬ DỤNG:</div>
                                {printData.medicalRecordId?.prescriptions?.length > 0 ? (
                                    printData.medicalRecordId.prescriptions.map((p, i) => (
                                        <div key={i} style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px dashed #bfdbfe' }}>
                                             <div style={{ fontWeight: 700, color: '#000' }}>{i + 1}. {p.medicineName || p.medicineId?.productId?.name || 'Thuốc điều trị'} — SL: {p.quantity}</div>
                                            <div style={{ paddingLeft: '25px', marginTop: '5px', color: '#4b5563', fontStyle: 'italic' }}>HD: {p.dosageInstructions}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', marginTop: '150px', color: '#94a3b8' }}>Không có thuốc kê toa cho hồ sơ này.</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingBottom: '40px' }}>
                                <div style={{ textAlign: 'center', width: '250px' }}>
                                    <div style={{ fontSize: '0.9rem' }}>Chữ ký Chủ nuôi</div>
                                    <div style={{ height: '80px' }}></div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>(Ký và ghi rõ họ tên)</div>
                                </div>
                                <div style={{ textAlign: 'center', width: '250px' }}>
                                    <div style={{ fontSize: '0.9rem' }}>Bác sĩ phụ trách</div>
                                    <div style={{ height: '80px' }}></div>
                                    <div style={{ fontWeight: 700 }}><strong>{printData.medicalRecordId?.doctorId?.fullName || printData.vaccinationId?.doctorId?.fullName || printData.appointmentId?.staffId?.fullName || 'BSTY VetCare'}</strong></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}

            {/* PHẦN KÝ TÊN VÈ NGƯỜI LẬP (Bổ sung cho Trang 1 Hóa đơn nếu cần) */}

            <Layout>
                {/* Header */}
                <div className="dashboard-header flex-between animate-fade-in" style={{ marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem' }}>Thu Ngân & Hóa Đơn</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Thanh toán chi phí Dịch vụ / Thuốc và xuất Hóa đơn điện tử.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            className="btn"
                            style={{ background: 'white', border: '1px solid #eef2f5', display: 'flex', alignItems: 'center', gap: '8px' }}
                            onClick={fetchData}
                            disabled={loading}
                        >
                            <Clock size={18} className={loading ? 'animate-spin' : ''} />
                            {loading ? 'Đang tải...' : 'LÀM MỚI'}
                        </button>
                        <div className="input-with-icon" style={{ width: '300px' }}>
                            <Search className="input-icon" size={18} />
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Tìm hóa đơn, tên khách..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Điều hướng Tab */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #eef2f5', paddingBottom: '0' }}>
                    {[
                        ['PENDING', `Chờ Thu Ngân (${pendingAppointments.length + pendingGrooming.length + pendingVaccinations.length})`],
                        ['HISTORY', 'Lịch Sử Hóa Đơn']
                    ].map(([tab, label]) => (
                        <button key={tab} onClick={() => setActiveTab(tab)} style={{
                            background: 'transparent', border: 'none', fontSize: '1rem', fontWeight: 600,
                            padding: '12px 20px', cursor: 'pointer',
                            color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                            borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                            transition: '0.2s'
                        }}>{label}</button>
                    ))}
                </div>
                {/* Nội Dung Tab PENDING */}
                {activeTab === 'PENDING' && (
                    <div className="animate-slide-up">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải danh sách chờ...</div>
                        ) : (pendingAppointments.length === 0 && pendingGrooming.length === 0 && pendingVaccinations.length === 0) ? (
                            <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>$</div>
                                <p style={{ fontSize: '1.1rem' }}>Hiện chưa có ca khám/Grooming/Tiêm phòng nào báo "Hoàn Thành" để thanh toán.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                                {/* Rend Lịch Hẹn */}
                                {pendingAppointments.map((apt) => (
                                    <div key={apt._id} className="glass-card" style={{ padding: '24px', borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {apt.customerId?.fullName || 'Khách vãng lai'}
                                                </h4>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Bé: <strong>{apt.petId?.name}</strong></p>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                                {apt._hasLinkedGrooming && (
                                                    <span style={{ fontSize: '0.8rem', background: '#f5f3ff', color: '#8b5cf6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Grooming (Gộp)</span>
                                                )}
                                                {apt._hasLinkedVaccination ? (
                                                    <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#059669', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Tiêm Phòng</span>
                                                ) : apt.category === 'VACCINATION' ? (
                                                    <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#059669', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Tiêm Phòng</span>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#d97706', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Khám Bệnh</span>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px', flex: 1 }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                                                <strong>Dịch vụ:</strong>{' '}
                                                <span style={{ color: 'var(--primary)' }}>
                                                    {apt._hasLinkedVaccination 
                                                        ? `Tiêm phòng: ${apt._linkedVaccination?.vaccineName || ''}` 
                                                        : (apt.serviceId?.name || (apt.category === 'VACCINATION' ? 'Tiêm Phòng (Khách Hẹn)' : 'Khám tổng quát'))}
                                                </span>
                                            </div>
                                            {apt.depositAmount > 0 && <div style={{ fontSize: '0.85rem', color: '#059669' }}>Cọc: {formatCurrency(apt.depositAmount)}</div>}
                                        </div>

                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => openCheckout(apt, 'APPOINTMENT')}>Thu Tiền</button>
                                    </div>
                                ))}

                                {/* Rend Đơn Grooming */}
                                {pendingGrooming.map((gr) => (
                                    <div key={gr._id} className="glass-card" style={{ padding: '24px', borderTop: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {gr.customerId?.fullName || 'Khách vãng lai'}
                                                </h4>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Grooming: <strong>{gr.pets.map(p => p.name || 'Thú cưng').join(', ')}</strong></p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '0.8rem', background: '#f3e8ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Làm Đẹp</span>
                                            </div>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px', flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                                <strong>Dịch vụ:</strong> {[
                                                    ...new Set([
                                                        ...(gr.services?.map(s => s.name) || []),
                                                        ...(gr.pets?.flatMap(p => p.services?.map(s => s.name) || []) || [])
                                                    ])
                                                ].filter(Boolean).join(', ') || '—'}
                                            </div>
                                            <div style={{ marginTop: '8px', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(gr.totalAmount)}</div>
                                        </div>

                                        <button className="btn btn-primary" style={{ width: '100%', background: '#8b5cf6' }} onClick={() => openCheckout(gr, 'GROOMING')}>Thu Tiền Grooming</button>
                                    </div>
                                ))}

                                {/* Rend Tiêm Phòng */}
                                {pendingVaccinations.map((vac) => (
                                    <div key={vac._id} className="glass-card" style={{ padding: '24px', borderTop: '4px solid #10b981', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {vac.petId?.ownerId?.fullName || 'N/A'}
                                                </h4>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Bé: <strong>{vac.petId?.name}</strong></p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '0.8rem', background: '#dcfce7', color: '#059669', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Tiêm Phòng</span>
                                            </div>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px', flex: 1 }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                                                <strong>Vaccine:</strong> <span style={{ color: '#059669' }}>{vac.vaccineName}</span>
                                            </div>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#059669' }}>{formatCurrency(vac.price || 0)}</div>
                                        </div>

                                        <button className="btn btn-primary" style={{ width: '100%', background: '#10b981' }} onClick={() => openCheckout(vac, 'VACCINATION')}>Thu Tiền Tiêm</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Nội Dung Tab HISTORY */}
                {activeTab === 'HISTORY' && (
                    <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                        <div className="table-responsive">
                            <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                                    <tr>
                                        <th style={{ padding: '16px 24px', fontWeight: '600' }}>Biên Lai</th>
                                        <th style={{ padding: '16px 24px', fontWeight: '600' }}>Khách Hàng</th>
                                        <th style={{ padding: '16px 24px', fontWeight: '600' }}>Diễn Giải</th>
                                        <th style={{ padding: '16px 24px', fontWeight: '600' }}>Tổng Thu</th>
                                        <th style={{ padding: '16px 24px', fontWeight: '600' }}>Thanh Toán</th>
                                        <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'center' }}>Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center' }}>Đang tải lịch sử hóa đơn...</td></tr>
                                    ) : (
                                        (() => {
                                            const filtered = invoices.filter(inv => {
                                                if (!inv) return false;
                                                const search = searchTerm.trim().toLowerCase();
                                                if (!search) return true;

                                                const idStr = String(inv._id || '').toLowerCase();
                                                const customerName = (inv.customerId?.fullName || 'khách vãng lai').toLowerCase();
                                                const customerPhone = (inv.customerId?.phoneNumber || '').toLowerCase();
                                                const type = (inv.invoiceType || '').toLowerCase();

                                                return (
                                                    idStr.includes(search) ||
                                                    customerName.includes(search) ||
                                                    customerPhone.includes(search) ||
                                                    type.includes(search)
                                                );
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan="6" style={{ padding: '80px 40px', textAlign: 'center' }}>
                                                            <div style={{ fontSize: '3rem', color: '#e2e8f0', marginBottom: '16px' }}>
                                                                <FileText size={64} style={{ opacity: 0.2 }} />
                                                            </div>
                                                            <div style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: 600 }}>
                                                                {searchTerm ? `Không tìm thấy hóa đơn nào khớp với "${searchTerm}"` : 'Chưa có lịch sử hóa đơn nào được ghi nhận.'}
                                                            </div>
                                                            {searchTerm && (
                                                                <button
                                                                    onClick={() => setSearchTerm('')}
                                                                    style={{ marginTop: '12px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                                                                >
                                                                    Xóa tìm kiếm để xem tất cả
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filtered.map((inv) => (
                                                <tr key={inv._id} id={`invoice-row-${inv._id}`} style={{ borderBottom: '1px solid #eef2f5', transition: 'all 0.5s ease', backgroundColor: location.state?.highlightInvoiceId === inv._id ? 'var(--primary-glow)' : 'inherit', boxShadow: location.state?.highlightInvoiceId === inv._id ? 'inset 4px 0 0 var(--primary)' : 'none' }} className="table-row-hover">
                                                    <td style={{ padding: '16px 24px' }} data-label="Biên Lai">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>#{inv._id.slice(-6).toUpperCase()}</strong>
                                                            {(() => {
                                                                let label = { text: 'Hóa đơn', color: '#64748b', bg: '#f1f5f9' };
                                                                if (inv.medicalRecordId && inv.groomingOrderId) label = { text: 'Khám & Grooming', color: '#8b5cf6', bg: '#f5f3ff' };
                                                                else if (inv.medicalRecordId && inv.vaccinationId) label = { text: 'Khám & Tiêm', color: '#059669', bg: '#dcfce7' };
                                                                else if (inv.vaccinationId || inv.invoiceType === 'VACCINATION') label = { text: 'Tiêm phòng', color: '#059669', bg: '#dcfce7' };
                                                                else if (inv.medicalRecordId || inv.invoiceType === 'APPOINTMENT') label = { text: 'Khám bệnh', color: '#2563eb', bg: '#eff6ff' };
                                                                else if (inv.groomingOrderId || inv.invoiceType === 'GROOMING') label = { text: 'Grooming', color: '#7c3aed', bg: '#f3e8ff' };
                                                                else if (inv.invoiceType === 'RETAIL') label = { text: 'Bán lẻ', color: '#d97706', bg: '#fffbeb' };
                                                                
                                                                return (
                                                                    <span style={{ 
                                                                        fontSize: '0.65rem', 
                                                                        fontWeight: 800, 
                                                                        padding: '2px 6px', 
                                                                        borderRadius: '4px', 
                                                                        background: label.bg, 
                                                                        color: label.color,
                                                                        width: 'fit-content',
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        {label.text}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                                            {new Date(inv.createdAt).toLocaleString('vi-VN')}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Khách Hàng">
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 600 }}
                                                        >
                                                            <User size={14} />
                                                            {inv.customerId?.fullName || 'Khách vãng lai'}
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{inv.customerId?.phoneNumber || 'Không có SĐT'}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }} data-label="Diễn Giải">
                                                        {(inv.vaccinationId || inv.invoiceType === 'VACCINATION') && !inv.medicalRecordId ? (
                                                            <div>Loại: <strong style={{ color: 'var(--text-main)' }}>Tiêm chủng {inv.vaccinationId?.vaccineName ? `(${inv.vaccinationId.vaccineName})` : ''}</strong></div>
                                                        ) : inv.invoiceType === 'RETAIL' ? (
                                                            <div>Loại: <strong style={{ color: 'var(--text-main)' }}>Bán lẻ phụ kiện</strong></div>
                                                        ) : (inv.medicalRecordId && inv.groomingOrderId) ? (
                                                            <div>Dịch vụ: <strong style={{ color: 'var(--text-main)' }}>Khám & Làm đẹp (Grooming)</strong></div>
                                                        ) : (inv.medicalRecordId && inv.vaccinationId) ? (
                                                            <div>Dịch vụ: <strong style={{ color: 'var(--text-main)' }}>Khám bệnh & Tiêm chủng</strong></div>
                                                        ) : (inv.groomingOrderId || inv.invoiceType === 'GROOMING') ? (
                                                            <div>Dịch vụ: <strong style={{ color: 'var(--text-main)' }}>Làm đẹp (Grooming)</strong></div>
                                                        ) : (
                                                            <>
                                                                {inv.serviceTotal > 0 && <div>Dịch vụ: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(inv.serviceTotal)}</strong></div>}
                                                                {inv.medicineTotal > 0 && <div>Thuốc: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(inv.medicineTotal)}</strong></div>}
                                                                {(!inv.serviceTotal && !inv.medicineTotal) && <div>Loại: <strong style={{ color: 'var(--text-main)' }}>Khám bệnh</strong></div>}
                                                            </>
                                                        )}
                                                        {inv.retailTotal > 0 && inv.invoiceType !== 'RETAIL' && (
                                                            <div>Hàng lẻ thêm: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(inv.retailTotal)}</strong></div>
                                                        )}
                                                        {(inv.discountAmount > 0 || inv.depositAmount > 0) && (
                                                            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                                                                {inv.discountAmount > 0 && <span style={{ color: '#dc2626' }}>KM: -{formatCurrency(inv.discountAmount)} </span>}
                                                                {inv.depositAmount > 0 && <span style={{ color: '#059669' }}>Cọc: -{formatCurrency(inv.depositAmount)}</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Tổng Thu">
                                                        <strong style={{ fontSize: '1.1rem', color: inv.finalTotal <= 0 ? '#94a3b8' : '#16a34a' }}>
                                                            {formatCurrency(inv.finalTotal || 0)}
                                                        </strong>
                                                        {inv.finalTotal <= 0 && (
                                                            <div style={{ color: '#dc2626', fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>Cảnh báo: Hóa đơn 0đ</div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }} data-label="Thanh Toán">
                                                        <span className="badge" style={{
                                                            background: inv.paymentMethod === 'TRANSFER' ? '#e0e7ff' : (inv.paymentMethod === 'CARD' ? '#f3e8ff' : '#d1fae5'),
                                                            color: inv.paymentMethod === 'TRANSFER' ? '#4f46e5' : (inv.paymentMethod === 'CARD' ? '#9333ea' : '#059669'),
                                                            fontWeight: 600, fontSize: '0.75rem'
                                                        }}>
                                                            {inv.paymentMethod === 'TRANSFER' ? 'Chuyển Khoản' : (inv.paymentMethod === 'CARD' ? 'Thẻ POS' : 'Tiền Mặt')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }} data-label="Thao Tác">
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--primary-glow)', color: 'var(--primary)', border: 'none' }}
                                                                onClick={async (e) => {
                                                                    e.currentTarget.disabled = true;
                                                                    const btn = e.currentTarget;
                                                                    const originalText = btn.innerHTML;
                                                                    btn.innerText = 'Đang tải...';
                                                                    
                                                                    const fullInv = await fetchFullInvoiceDetails(inv);
                                                                    
                                                                    setSelectedInvoice(fullInv);
                                                                    setIsDetailModalOpen(true);
                                                                    
                                                                    btn.disabled = false;
                                                                    btn.innerHTML = originalText;
                                                                }}>
                                                                <Eye size={14} style={{ marginRight: '4px' }} /> Chi Tiết
                                                            </button>
                                                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handlePrint(inv)}>
                                                                <Printer size={14} style={{ marginRight: '4px' }} /> In HĐ
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ));
                                        })()
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Modal Thanh Toán */}
                {isCheckoutModalOpen && selectedApt && createPortal(
                    (() => {
                        const recordServices = checkoutRecord?.services || [];
                        const linkedGrooming = selectedApt._linkedGrooming;

                        // Đọc dịch vụ từ cả global services VÀ per-pet services
                        const globalGroomingServices = linkedGrooming?.services || [];
                        const perPetGroomingServices = linkedGrooming?.pets?.flatMap(p => p.services || []) || [];
                        const groomingServices = [...globalGroomingServices, ...perPetGroomingServices];
                        
                        // Thu thập tất cả dịch vụ và lọc trùng theo tên
                        const collectedServices = [];
                        recordServices.forEach(s => {
                            collectedServices.push({ name: s.name || s.serviceId?.name, price: s.price !== undefined ? s.price : (s.serviceId?.price || 0) });
                        });
                        groomingServices.forEach(s => {
                            collectedServices.push({ name: s.name || s.serviceId?.name, price: s.price !== undefined ? s.price : (s.serviceId?.price || 0) });
                        });

                        const uniqueSvcMap = new Map();
                        collectedServices.forEach(s => {
                            if (!s.name) return;
                            if (!uniqueSvcMap.has(s.name) || (s.price > 0 && uniqueSvcMap.get(s.name).price === 0)) {
                                uniqueSvcMap.set(s.name, s);
                            }
                        });
                        const finalUniqueServices = Array.from(uniqueSvcMap.values());

                        // Tổng dịch vụ phải LUÔN khớp với những gì hiển thị:
                        // • Nhiều thú cưng (per-pet breakdown): dùng linkedGrooming.totalAmount
                        //   (vì mỗi pet cùng dịch vụ → nhân số lần, không dedup)
                        //   Cộng thêm phí khám bệnh (recordServices) nếu có
                        // • 1 thú cưng hoặc khám thuần: dùng tổng từ finalUniqueServices (đã dedup)
                        const isMultiPetGrooming = linkedGrooming?.pets?.length > 1;
                        const recordFee = recordServices.reduce((s, sv) => s + (sv.price !== undefined ? sv.price : (sv.serviceId?.price || 0)), 0);
                        const totalServicesPrice = isMultiPetGrooming
                            ? (linkedGrooming.totalAmount || 0) + recordFee
                            : finalUniqueServices.reduce((sum, s) => sum + s.price, 0);

                        const rxItems = checkoutRecord?.prescriptions || [];
                        const rxTotal = rxItems.reduce((s, p) => {
                            const mid = p.medicineId?._id || p.medicineId;
                            const med = allMedicines.find(m => m._id === mid);
                            const price = med?.retailPrice || (p.medicineId?.retailPrice || 0);
                            return s + (price * p.quantity);
                        }, 0);

                        const deposit = selectedApt.depositAmount || 0;
                        const discount = Number(discountAmount) || 0;

                        const inputPts = Number(pointsUsed) || 0;
                        const customerPoints = selectedApt.customerId?.rewardPoints || 0;
                        const actualPtsUsed = Math.min(inputPts, customerPoints);
                        const ptsDiscount = actualPtsUsed * 1000;

                        // Thêm giá tiêm phòng nếu là VACCINATION hoặc có Tiêm phòng gộp
                        let vaccinationPrice = 0;
                        if (selectedApt._type === 'VACCINATION') {
                            vaccinationPrice = selectedApt.price || 0;
                        } else if (selectedApt._linkedVaccination) {
                            vaccinationPrice = selectedApt._linkedVaccination.price || 0;
                        }

                        const estimatedSubtotal = totalServicesPrice + rxTotal + vaccinationPrice;
                        const finalTotal = Math.max(0, estimatedSubtotal - discount - ptsDiscount - deposit);

                        return (
                            <div className="modal-overlay animate-fade-in">
                                <div className="modal-container glass-card animate-slide-up" style={{ background: 'white', padding: 0, borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '90%', maxWidth: '640px' }}>
                                    <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                        <h3 style={{ margin: 0, color: 'var(--primary)' }}>Tiến Hành Thanh Toán</h3>
                                        <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsCheckoutModalOpen(false)}>
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div className="modal-body" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', padding: '24px 28px' }}>
                                        {/* Khách hàng */}
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #eef2f5', marginBottom: '24px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{selectedApt.customerId?.fullName || selectedApt.petId?.ownerId?.fullName || 'Khách vãng lai'}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>SĐT: <strong>{selectedApt.customerId?.phoneNumber || selectedApt.petId?.ownerId?.phoneNumber || 'N/A'}</strong></div>
                                                    {(selectedApt.customerId?.rewardPoints > 0 || selectedApt.petId?.ownerId?.rewardPoints > 0) && (
                                                        <div style={{ fontSize: '0.85rem', color: '#ca8a04', marginTop: '4px', fontWeight: 600 }}>Điểm hiện có: {new Intl.NumberFormat('vi-VN').format(selectedApt.customerId?.rewardPoints || selectedApt.petId?.ownerId?.rewardPoints || 0)}</div>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Bé: <strong>{selectedApt.petId?.name || selectedApt.pets?.[0]?.petName}</strong></div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                        {selectedApt._type === 'VACCINATION' ? 'Hóa đơn Tiêm chủng' : 
                                                         selectedApt._type === 'GROOMING' ? 'Hóa đơn Grooming' : 'Dịch vụ Thú y'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chi tiết hóa đơn */}
                                        <div style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>Bảng chi phí gộp</div>
                                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eef2f5', overflow: 'hidden' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <tbody>
                                                    {selectedApt._type === 'VACCINATION' ? (
                                                        <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                                            <td style={{ padding: '12px 16px', color: '#64748b' }}>Tiền vaccine ({selectedApt.vaccineName})</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(selectedApt.price || 0)}</td>
                                                        </tr>
                                                    ) : (
                                                        <>
                                                            {/* GROOMING nhiều thú cưng → hiện theo từng con */}
                                                            {linkedGrooming?.pets?.length > 1 ? (
                                                                linkedGrooming.pets.map((pet, pi) => {
                                                                    const icon = pet.species === 'DOG' ? '🐶' : pet.species === 'CAT' ? '🐱' : '🐾';
                                                                    const petSvcs = pet.services || [];
                                                                    return (
                                                                        <React.Fragment key={`pet-group-${pi}`}>
                                                                            {/* Header thú cưng */}
                                                                            <tr style={{ background: '#f8fafc' }}>
                                                                                <td colSpan="2" style={{ padding: '8px 16px', fontWeight: 700, fontSize: '0.82rem', color: '#0891b2' }}>
                                                                                    {icon} {pet.name || `Thú cưng ${pi + 1}`}
                                                                                </td>
                                                                            </tr>
                                                                            {petSvcs.map((s, si) => (
                                                                                <tr key={`pet${pi}-svc${si}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                                    <td style={{ padding: '8px 16px 8px 28px', color: '#475569', fontSize: '0.85rem' }}>
                                                                                        + {s.name}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(s.price || 0)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </React.Fragment>
                                                                    );
                                                                })
                                                            ) : (
                                                                // 1 thú cưng hoặc khám bệnh → hiện flat như cũ
                                                                finalUniqueServices.map((s, idx) => (
                                                                    <tr key={`svc-item-${idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                        <td style={{ padding: '10px 16px', color: '#475569', fontSize: '0.85rem' }}>
                                                                            <div style={{ fontWeight: 600 }}>+ {s.name}</div>
                                                                        </td>
                                                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(s.price)}</td>
                                                                    </tr>
                                                                ))
                                                            )}

                                                            {checkoutLoading && (
                                                                <tr><td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Đang tải dữ liệu bản ghi...</td></tr>
                                                            )}
                                                            
                                                            {rxItems.map((p, i) => {
                                                                const mid = p.medicineId?._id || p.medicineId;
                                                                const med = allMedicines.find(m => m._id === mid);
                                                                return (
                                                                    <tr key={`rx-item-${i}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                        <td style={{ padding: '10px 16px', color: '#475569', fontSize: '0.85rem' }}>
                                                                            <div style={{ fontWeight: 600 }}>{p.medicineName || med?.name || 'Thuốc điều trị'}</div>
                                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.quantity} {med?.unit || 'Lọ/Viên'} x {formatCurrency(med?.retailPrice || (p.medicineId?.retailPrice || 0))}</div>
                                                                        </td>
                                                                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency((med?.retailPrice || p.medicineId?.retailPrice || 0) * p.quantity)}</td>
                                                                    </tr>
                                                                );
                                                            })}

                                                            {selectedApt._linkedVaccination && (
                                                                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                    <td style={{ padding: '10px 16px', color: '#475569', fontSize: '0.85rem' }}>
                                                                        <div style={{ fontWeight: 600 }}>Dịch vụ Tiêm chủng</div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', paddingLeft: '10px' }}>• {selectedApt._linkedVaccination.vaccineName}</div>
                                                                    </td>
                                                                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>
                                                                        {formatCurrency(selectedApt._linkedVaccination.price || 0)}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    )}
                                                    {deposit > 0 && (
                                                        <tr style={{ borderTop: '1px dashed #eef2f5' }}>
                                                            <td style={{ padding: '12px 16px', color: '#059669', fontStyle: 'italic' }}>Khấu trừ tiền cọc</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>-{formatCurrency(deposit)}</td>
                                                        </tr>
                                                    )}
                                                    {ptsDiscount > 0 && (
                                                        <tr style={{ borderTop: '1px dashed #eef2f5' }}>
                                                            <td style={{ padding: '12px 16px', color: '#ea580c', fontStyle: 'italic' }}>Khấu trừ từ {actualPtsUsed} điểm</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ea580c', fontWeight: 600 }}>-{formatCurrency(ptsDiscount)}</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                                <tfoot style={{ background: 'var(--primary-glow)' }}>
                                                    <tr>
                                                        <td style={{ padding: '16px', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>TỔNG CỘNG THANH TOÁN</td>
                                                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>
                                                            {formatCurrency(finalTotal)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        <div style={{ height: '24px' }}></div>

                                        {paymentMethod === 'CASH' && (
                                            <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bcf0da', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block', color: '#065f46' }}>Tiền khách đưa (VNĐ)</label>
                                                    <input 
                                                        type="number" 
                                                        className="input-field" 
                                                        style={{ borderColor: '#34d399', background: 'white' }}
                                                        value={amountReceived} 
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setAmountReceived(val);
                                                            if (val) {
                                                                setChangeAmount(Number(val) - finalTotal);
                                                            } else {
                                                                setChangeAmount(0);
                                                            }
                                                        }} 
                                                        placeholder="Vd: 500000" 
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block', color: '#065f46' }}>Tiền thừa trả khách</label>
                                                    <div style={{ 
                                                        height: '42px', 
                                                        background: '#dcfce7', 
                                                        borderRadius: '8px', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        padding: '0 12px', 
                                                        fontWeight: 800, 
                                                        fontSize: '1.1rem', 
                                                        color: changeAmount < 0 ? '#dc2626' : '#059669'
                                                    }}>
                                                        {formatCurrency(changeAmount)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                            <div className="form-group">
                                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Dùng Điểm</span>
                                                    {(() => {
                                                        const customerPts = selectedApt.customerId?.rewardPoints || 0;
                                                        const maxPtsConfig = clinicConfig?.rewardPointsConfig?.maxPointsPerUse || 0;
                                                        const maxAllowedPoints = maxPtsConfig > 0 ? Math.min(customerPts, maxPtsConfig) : customerPts;
                                                        return (
                                                            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => setPointsUsed(maxAllowedPoints)}>Tối đa: {maxAllowedPoints}</span>
                                                        );
                                                    })()}
                                                </label>
                                                <input type="number" className="input-field" value={pointsUsed} onChange={(e) => setPointsUsed(e.target.value)} placeholder="0 điểm" />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>Giảm khác (VNĐ)</label>
                                                <input type="number" className="input-field" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0 đ" />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>Phương thức *</label>
                                                <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                                    <option value="CASH">Tiền Mặt</option>
                                                    <option value="TRANSFER">Chuyển Khoản (QR)</option>
                                                    <option value="CARD">Quẹt Thẻ</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ padding: '16px 28px', borderTop: '1px solid #eef2f5', background: '#f8fafc', display: 'flex', gap: '12px', flexShrink: 0 }}>
                                        <button className="btn" style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0' }} onClick={() => { setIsCheckoutModalOpen(false); setCheckoutRecord(null); setSelectedApt(null); }}>Huỷ bỏ</button>
                                        <button className="btn btn-primary" disabled={submitLoading || checkoutLoading} style={{ flex: 2, display: 'flex', justifyContent: 'center', gap: '8px', fontWeight: 700, opacity: (submitLoading || checkoutLoading) ? 0.6 : 1 }}
                                            onClick={handleCheckout}>
                                            <CheckCircle2 size={18} />
                                            {submitLoading ? 'Đang Xử Lý...' : checkoutLoading ? 'Đang Tải Toa Thuốc...' : (paymentMethod === 'TRANSFER' ? 'Hiện QR Thanh Toán' : 'Xác Nhận Thanh Toán')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })(),
                    document.body
                )}

                {/* ===== QR THANH TOÁN - BÁCH HÓA XANH STYLE ===== */}
                {showQR && selectedApt && createPortal(
                    (() => {
                        const fmtQr = (v) => new Intl.NumberFormat('vi-VN').format(v || 0);
                        const ptValue = clinicConfig?.rewardPointsConfig?.valuePerPoint || 1000;
                        let total = 0;
                        if (selectedApt._type === 'VACCINATION') {
                            total = (selectedApt.price || 0) - (Number(discountAmount) || 0) - ((Number(pointsUsed) || 0) * ptValue);
                        } else if (selectedApt._type === 'GROOMING') {
                            total = (selectedApt.totalAmount || 0) - (Number(discountAmount) || 0) - ((Number(pointsUsed) || 0) * ptValue);
                        } else {
                            const svcPrice = selectedApt.serviceId?.price || 0;
                            const rxItems = checkoutRecord?.prescriptions || [];
                            const rxTotal = rxItems.reduce((s, p) => {
                                const mid = p.medicineId?._id || p.medicineId;
                                const med = allMedicines.find(m => m._id === mid);
                                return s + (med ? med.retailPrice * p.quantity : 0);
                            }, 0);
                            const deposit = selectedApt.depositAmount || 0;
                            let subtotal = svcPrice + rxTotal;
                            if (selectedApt._linkedGrooming) subtotal += (selectedApt._linkedGrooming.totalAmount || 0);
                            if (selectedApt._linkedVaccination) subtotal += (selectedApt._linkedVaccination.price || 0);
                            total = subtotal - deposit - (Number(discountAmount) || 0) - ((Number(pointsUsed) || 0) * ptValue);
                        }
                        total = Math.max(0, total);

                        const bankInfo = { bankId: 'VCB', accountNo: '1234567890', accountName: 'VETCARE CLINIC', memo: `TT${selectedApt._id?.substring(18, 24)?.toUpperCase() || 'HD'}` };
                        const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNo}-qr_only.png?amount=${total}&addInfo=${bankInfo.memo}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
                        const mm = Math.floor(qrCountdown / 60);
                        const ss = String(qrCountdown % 60).padStart(2, '0');
                        return (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex' }}>
                                {/* Panel trái: thông tin */}
                                <div style={{ flex: 1, background: '#0f172a', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'white' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Thanh toán chuyển khoản</div>
                                    <div style={{ fontSize: '3rem', fontWeight: 900, color: '#34d399', fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>{fmtQr(total)} đ</div>
                                    <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '40px' }}>Khách: <strong style={{ color: 'white' }}>{selectedApt.customerId?.fullName || 'Khách vãng lai'}</strong></div>
                                    <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px 28px', width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>Thông tin thỵ hưởng</div>
                                        <div style={{ marginBottom: '8px' }}><span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Ngân hàng</span><div style={{ color: 'white', fontWeight: 700 }}>Vietcombank (VCB)</div></div>
                                        <div style={{ marginBottom: '8px' }}><span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Số tài khoản</span><div style={{ color: 'white', fontWeight: 700, letterSpacing: '0.08em' }}>{bankInfo.accountNo}</div></div>
                                        <div style={{ marginBottom: '8px' }}><span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Tên tài khoản</span><div style={{ color: 'white', fontWeight: 700 }}>{bankInfo.accountName}</div></div>
                                        <div><span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Nội dung CK</span><div style={{ color: '#fbbf24', fontWeight: 700 }}>{bankInfo.memo}</div></div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
                                        <button style={{ width: '100%', padding: '12px', background: '#10b981', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}
                                            disabled={submitLoading} onClick={confirmQrReceived}>
                                            {submitLoading ? 'Đang ghi nhận...' : 'Xác Nhận Đã Nhận Tiền'}
                                        </button>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button style={{ flex: 1, padding: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                                                onClick={() => { stopQrTimer(); setShowQR(false); }}>Hủy Quay Lại</button>
                                            <button style={{ flex: 1, padding: '10px', background: '#3b82f6', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                                                onClick={() => window.open('/customer-display', 'CustomerDisplay', 'width=1200,height=800')}>
                                                Màn Hình Khách
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {/* Panel phải: QR */}
                                <div style={{ width: '420px', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', flexShrink: 0 }}>
                                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                        <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#0f172a' }}>Quét mã QR để thanh toán</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Sử dụng app ngân hàng bất kỳ</div>
                                    </div>
                                    <div style={{ border: '4px solid #6366f1', borderRadius: '20px', padding: '12px', background: '#f0f4ff', marginBottom: '20px' }}>
                                        <img src={qrUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block', borderRadius: '12px' }}
                                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                        />
                                        <div style={{ display: 'none', width: '220px', height: '220px', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', flexDirection: 'column', gap: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                                            <div style={{ fontSize: '3rem' }}>&#9783;</div>
                                            <div>QR demo — VietQR</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{bankInfo.bankId} · {bankInfo.accountNo}</div>
                                        </div>
                                    </div>
                                    <div style={{ background: '#f0fdf4', border: '2px solid #34d399', borderRadius: '12px', padding: '12px 24px', textAlign: 'center', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#065f46', marginBottom: '2px' }}>Số tiền cần chuyển</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669' }}>{fmtQr(total)} đ</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: qrCountdown < 30 ? '#dc2626' : '#64748b', fontSize: '0.88rem', fontWeight: 600 }}>
                                        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.1rem', fontWeight: 700 }}>{mm}:{ss}</span>
                                        <span>QR hết hạn sau</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })(),
                    document.body
                )}

                {/* ===== PDF PREVIEW MODAL ===== */}
                {showPdfPreview && printData && createPortal(
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                        <div className="glass-card animate-slide-up" style={{ background: '#f8fafc', borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '95%', maxWidth: '1300px', height: '90vh' }}>
                            <div style={{ padding: '24px 40px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', background: 'var(--primary-glow)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Printer size={20} />
                                        </div>
                                        XEM TRƯỚC HÓA ĐƠN & ĐƠN THUỐC (PDF PREVIEW)
                                    </div>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Hệ thống tự động tách biệt Phiếu thu và Toa thuốc để in ấn chuyên nghiệp.</p>
                                </div>
                                <button style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }} onClick={() => setShowPdfPreview(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-body" style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', gap: '30px', justifyContent: 'center', background: '#e2e8f0' }}>
                                {/* CÁC TRANG A4 GIẢ LẬP */}

                                {/* TRANG 1: BILL */}
                                <div style={{ width: '595px', minWidth: '595px', height: '842px', minHeight: '842px', background: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '50px', display: 'flex', flexDirection: 'column', border: '1px solid #cbd5e1' }}>
                                    <div style={{ textAlign: 'center', borderBottom: '3px solid #1e293b', paddingBottom: '20px', marginBottom: '30px' }}>
                                        <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#1e293b' }}>HÓA ĐƠN DỊCH VỤ</div>
                                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Bệnh Viện Thú Y VetCare — Hotline: 1900 1000</div>
                                    </div>
                                    <div style={{ marginBottom: '30px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span>Mã số HĐ: <strong>#{printData._id.toUpperCase()}</strong></span>
                                            <span>Ngày: {new Date(printData.createdAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div>Khách hàng: <strong>{printData.customerId?.fullName || 'Khách vãng lai'}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div>Bé (Pet): <strong>{printData.medicalRecordId?.petId?.name || printData.appointmentId?.petId?.name || 'Pets'}</strong></div>
                                            {printData.medicalRecordId?.weightAtVisit && (
                                                <div style={{ fontSize: '0.85rem' }}>Cân nặng: <strong>{printData.medicalRecordId.weightAtVisit} kg</strong></div>
                                            )}
                                        </div>
 
                                        {/* Bổ sung Chẩn đoán & Triệu chứng tóm tắt trên Bill (Trang 1) */}
                                        {printData.medicalRecordId?.diagnosis && (
                                            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f8fafc', borderLeft: '4px solid #1e293b', fontSize: '0.85rem' }}>
                                                <div><strong>Chẩn đoán:</strong> {printData.medicalRecordId.diagnosis}</div>
                                                {printData.medicalRecordId.treatment && (
                                                    <div style={{ marginTop: '2px', color: '#475569' }}><strong>Hướng điều trị:</strong> {printData.medicalRecordId.treatment}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>DỊCH VỤ / SẢN PHẨM</th>
                                                <th style={{ padding: '12px', textAlign: 'center' }}>SL</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>ĐƠN GIÁ</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>THÀNH TIỀN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* HIỂN THỊ DỊCH VỤ (LỌC TRÙNG) */}
                                            {(() => {
                                                const svcs = [];
                                                if (printData.appointmentId?.serviceId) svcs.push({ name: printData.appointmentId.serviceId.name, price: printData.appointmentId.serviceId.price || 0 });
                                                (printData.medicalRecordId?.services || []).forEach(s => svcs.push({ name: s.name || s.serviceId?.name, price: s.price !== undefined ? s.price : (s.serviceId?.price || 0) }));
                                                (printData.groomingOrderId?.services || []).forEach(s => svcs.push({ name: s.name || s.serviceId?.name, price: s.price !== undefined ? s.price : (s.serviceId?.price || 0) }));
                                                
                                                const map = new Map();
                                                svcs.forEach(s => {
                                                    if (!s.name) return;
                                                    if (!map.has(s.name) || (s.price > 0 && map.get(s.name).price === 0)) map.set(s.name, s);
                                                });
                                                
                                                return Array.from(map.values()).map((s, idx) => (
                                                    <tr key={`svc-p-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>1</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(s.price)}</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(s.price)}</td>
                                                    </tr>
                                                ));
                                            })()}

                                            {/* Fallback an toàn */}
                                            {!(printData.medicalRecordId?.services?.length) && !(printData.groomingOrderId?.services?.length) && !printData.appointmentId?.serviceId && printData.serviceTotal > 0 && (
                                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 600 }}>Dịch vụ chuyên môn / Spa</div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>1</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(printData.serviceTotal)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(printData.serviceTotal)}</td>
                                                </tr>
                                            )}

                                            {/* 2. Thuốc kê đơn / Tiêm phòng */}
                                            {printData.vaccinationId && (
                                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 600 }}>Dịch vụ Tiêm chủng</div>
                                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>• {printData.vaccinationId.vaccineName}</div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>1</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(printData.vaccinationId.price || 0)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(printData.vaccinationId.price || 0)}</td>
                                                </tr>
                                            )}
                                            {printData.medicalRecordId?.prescriptions?.map((p, idx) => {
                                                const unitPrice = p.medicineId?.retailPrice || 0;
                                                return (
                                                    <tr key={`rx-prev-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ fontWeight: 600 }}>{p.medicineName || p.medicineId?.productId?.name || 'Thuốc'}</div>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>{p.quantity}</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(unitPrice)}</td>
                                                        <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(unitPrice * p.quantity)}</td>
                                                    </tr>
                                                );
                                            })}

                                            {/* 3. Sản phẩm bán lẻ */}
                                            {printData.retailItems?.map((item, idx) => (
                                                <tr key={`rtl-prev-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 600 }}>{item.productName || item.medicineId?.productId?.name || 'Sản phẩm lẻ'}</div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{item.quantity}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ marginTop: 'auto', background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>
                                            <span>TỔNG THANH TOÁN:</span>
                                            <span>{formatCurrency(printData.finalTotal || 0)}</span>
                                        </div>
                                    </div>
                                </div>

                                 {/* TRANG 2: PRESCRIPTION (Toa thuốc & Chỉ định chi tiết) */}
                                 {printData.medicalRecordId && (
                                     <div style={{ width: '595px', minWidth: '595px', height: '842px', minHeight: '842px', background: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '50px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column' }}>
                                         <div style={{ textAlign: 'center', borderBottom: '3px solid #3b82f6', paddingBottom: '16px', marginBottom: '24px' }}>
                                             <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#1e3a8a' }}>TOA THUỐC & CHỈ ĐỊNH</div>
                                             <div style={{ color: '#3b82f6', fontSize: '0.9rem', letterSpacing: '2px' }}>VETCARE CLINIC HOSPITAL</div>
                                         </div>
 
                                         <div style={{ marginBottom: '24px', background: '#f0f9ff', padding: '15px', borderRadius: '12px', fontSize: '0.9rem' }}>
                                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px' }}>
                                                 <div>Tên Bé: <strong>{printData.medicalRecordId?.petId?.name || printData.appointmentId?.petId?.name}</strong></div>
                                                 <div>Ngày khám: <strong>{new Date(printData.createdAt).toLocaleDateString('vi-VN')}</strong></div>
                                                 <div>Cân nặng: <strong>{printData.medicalRecordId?.weightAtVisit || '--'} kg</strong></div>
                                                 <div>Nhiệt độ: <strong>{printData.medicalRecordId?.temperature || '--'} °C</strong></div>
                                                 <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dashed #bfdbfe', paddingTop: '8px' }}>
                                                     <span style={{ color: '#64748b' }}>Triệu chứng:</span> <strong>{printData.medicalRecordId?.symptoms || 'N/A'}</strong>
                                                 </div>
                                                 <div style={{ gridColumn: 'span 2' }}>
                                                     <span style={{ color: '#64748b' }}>Chẩn đoán xác định:</span> 
                                                     <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e40af', marginTop: '2px' }}>{printData.medicalRecordId?.diagnosis || 'Theo dõi lâm sàng'}</div>
                                                 </div>
                                                 {printData.medicalRecordId?.treatment && (
                                                     <div style={{ gridColumn: 'span 2' }}>
                                                         <span style={{ color: '#64748b' }}>Hướng xử lý/Điều trị:</span> {printData.medicalRecordId.treatment}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
 
                                         <div style={{ flex: 1 }}>
                                             <div style={{ fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #bfdbfe', paddingBottom: '6px', marginBottom: '12px', fontSize: '0.85rem' }}>CHI TIẾT ĐƠN THUỐC:</div>
                                             {printData.medicalRecordId?.prescriptions?.length > 0 ? (
                                                 printData.medicalRecordId.prescriptions.map((p, i) => (
                                                     <div key={i} style={{ marginBottom: '16px', borderLeft: '3px solid #3b82f6', paddingLeft: '12px' }}>
                                                         <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{i + 1}. {p.medicineName || p.medicineId?.productId?.name || p.medicineId?.name || 'Thuốc điều trị'} <span style={{ color: '#0369a1' }}>(SL: {p.quantity})</span></div>
                                                         <div style={{ color: '#475569', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '2px' }}>Cách dùng: <strong>{p.dosageInstructions || 'Theo chỉ định'}</strong></div>
                                                     </div>
                                                 ))
                                             ) : (
                                                 <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px' }}>
                                                     Không có thuốc kê đơn trong bản ghi này.
                                                 </div>
                                             )}
                                         </div>
 
                                         <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                             {printData.medicalRecordId?.followUpDate ? (
                                                 <div style={{ textAlign: 'center', color: '#059669' }}>
                                                     <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>HẸN TÁI KHÁM:</div>
                                                     <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{new Date(printData.medicalRecordId.followUpDate).toLocaleDateString('vi-VN')}</div>
                                                 </div>
                                             ) : (
                                                 <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Vui lòng theo dõi sức khỏe Pet định kỳ.</div>
                                             )}
                                         </div>
 
                                         <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                             <div style={{ textAlign: 'center', width: '200px' }}>
                                                 <div>Khách hàng xác nhận</div>
                                                 <div style={{ height: '60px' }}></div>
                                                 <strong>{printData.customerId?.fullName || '...'}</strong>
                                             </div>
                                             <div style={{ textAlign: 'center', width: '200px' }}>
                                                 <div>Bác sĩ phụ trách</div>
                                                 <div style={{ height: '60px' }}></div>
                                                 <strong>{printData.medicalRecordId?.doctorId?.fullName || 'BSTY VetCare'}</strong>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                            </div>

                            <div style={{ padding: '24px 40px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '16px', background: 'white' }}>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, height: '56px' }} onClick={() => setShowPdfPreview(false)}>Quay lại</button>
                                <button className="btn btn-primary" style={{ flex: 1.5, height: '56px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 8px 20px var(--primary-glow)' }} onClick={() => window.print()}>
                                    <Printer size={24} /> XÁC NHẬN IN FILE (PDF)
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                <CustomerQuickView
                    customerId={quickViewCustomerId}
                    isOpen={isQuickViewOpen}
                    onClose={() => setIsQuickViewOpen(false)}
                />

                {/* ===== MODAL CHI TIẾT HÓA ĐƠN ===== */}
                {isDetailModalOpen && selectedInvoice && createPortal(
                    <div className="modal-overlay animate-fade-in" style={{ zIndex: 2600 }}>
                        <div className="modal-container glass-card animate-slide-up" style={{ background: '#f1f5f9', padding: 0, borderRadius: '24px', width: '98%', maxWidth: selectedInvoice.medicalRecordId ? '1200px' : '650px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem', fontWeight: 800 }}>Chi Tiết Hóa Đơn</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Mã HĐ: <strong style={{ color: 'var(--text-main)' }}>#{selectedInvoice._id.toUpperCase()}</strong></p>
                                </div>
                                <button style={{ background: '#f1f5f9', border: 'none', color: '#94a3b8', cursor: 'pointer', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                                    onClick={() => { setIsDetailModalOpen(false); setSelectedInvoice(null); }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="modal-body" style={{ 
                                overflowY: 'auto', 
                                padding: '24px', 
                                display: 'grid', 
                                gridTemplateColumns: selectedInvoice.medicalRecordId ? 'repeat(auto-fit, minmax(450px, 1fr))' : '1fr', 
                                gap: '24px',
                                maxWidth: selectedInvoice.medicalRecordId ? '1200px' : '650px',
                                margin: '0 auto',
                                width: '100%'
                            }}>

                                {/* CỘT 1: HÓA ĐƠN TÍNH TIỀN */}
                                <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid var(--primary-glow)', paddingBottom: '16px' }}>
                                        <h4 style={{ margin: 0, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 900 }}>Hóa Đơn Thanh Toán</h4>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Mã số: #{selectedInvoice._id.slice(-8).toUpperCase()}</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', fontSize: '0.85rem' }}>
                                        <div>
                                            <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Ngày thanh toán:</div>
                                            <div style={{ fontWeight: 600 }}>{new Date(selectedInvoice.createdAt).toLocaleString('vi-VN')}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Phương thức:</div>
                                            <div style={{ fontWeight: 600 }}>{selectedInvoice.paymentMethod === 'TRANSFER' ? 'Chuyển khoản' : selectedInvoice.paymentMethod === 'CARD' ? 'Thẻ' : 'Tiền mặt'}</div>
                                        </div>
                                        <div>
                                            <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Khách hàng:</div>
                                            <div style={{ fontWeight: 700 }}>{selectedInvoice.customerId?.fullName || 'Khách vãng lai'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Thu ngân:</div>
                                            <div style={{ fontWeight: 600 }}>{selectedInvoice.receptionistId?.fullName || 'Hệ thống'}</div>
                                        </div>
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                    <th style={{ padding: '12px 0', textAlign: 'left', color: '#64748b' }}>Diễn giải</th>
                                                    <th style={{ padding: '12px 0', textAlign: 'right', color: '#64748b' }}>Thành tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                 {selectedInvoice.serviceTotal > 0 && (() => {
                                                     // Gom tất cả tên dịch vụ, dedup theo tên — tránh "Tắm Vệ Sinh" hiện 2 lần
                                                     const svcMap = new Map();
                                                     (selectedInvoice.medicalRecordId?.services || []).forEach(s => {
                                                         const name = s.name || s.serviceId?.name;
                                                         if (name && !svcMap.has(name)) svcMap.set(name, { name, isGrooming: false });
                                                     });
                                                     (selectedInvoice.groomingOrderId?.services || []).forEach(s => {
                                                         const name = s.name || s.serviceId?.name;
                                                         if (name && !svcMap.has(name)) svcMap.set(name, { name, isGrooming: true });
                                                     });
                                                     if (svcMap.size === 0 && (selectedInvoice.invoiceType === 'APPOINTMENT' || selectedInvoice.invoiceType === 'GROOMING')) {
                                                         const fallback = selectedInvoice.appointmentId?.serviceId?.name || 'Dịch vụ tổng quát/Spa';
                                                         svcMap.set(fallback, { name: fallback, isGrooming: false });
                                                     }
                                                     const dedupedSvcs = Array.from(svcMap.values());
                                                     return (
                                                         <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                                             <td style={{ padding: '12px 0' }}>
                                                                 <div style={{ fontWeight: 600 }}>{selectedInvoice.invoiceType === 'GROOMING' ? 'Dịch vụ Spa & Grooming' : 'Dịch vụ chuyên môn & Spa'}</div>
                                                                 {dedupedSvcs.map((s, idx) => (
                                                                     <div key={idx} style={{ fontSize: '0.75rem', color: s.isGrooming ? '#7c3aed' : '#64748b', paddingLeft: '10px' }}>
                                                                         • {s.name}{s.isGrooming ? ' (Grooming)' : ''}
                                                                     </div>
                                                                 ))}
                                                             </td>
                                                             <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(selectedInvoice.serviceTotal)}</td>
                                                         </tr>
                                                     );
                                                 })()}

                                                 {selectedInvoice.retailItems?.length > 0 && selectedInvoice.retailItems.map((item, idx) => (
                                                     <tr key={`retail-${idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                         <td style={{ padding: '12px 0' }}>
                                                             <div style={{ fontWeight: 600 }}>{item.productName || item.medicineId?.productId?.name || item.medicineId?.name || 'Sản phẩm lẻ'}</div>
                                                             <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Số lượng: {item.quantity} x {formatCurrency(item.unitPrice || 0)}</div>
                                                         </td>
                                                         <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.subtotal || 0)}</td>
                                                     </tr>
                                                 ))}
                                                 {selectedInvoice.medicineTotal > 0 && (
                                                     <>
                                                         {/* CÓ THUỐC TRONG BỆNH ÁN */}
                                                         {selectedInvoice.medicalRecordId?.prescriptions?.length > 0 && (
                                                             <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                 <td style={{ padding: '12px 0' }}>
                                                                     <div style={{ fontWeight: 600 }}>Y tế & Toa thuốc</div>
                                                                     {selectedInvoice.medicalRecordId.prescriptions.map((p, idx) => (
                                                                         <div key={idx} style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: '10px' }}>• {p.medicineName || p.medicineId?.productId?.name || p.medicineId?.name || 'Thuốc'} (SL: {p.quantity})</div>
                                                                     ))}
                                                                 </td>
                                                                 <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>
                                                                     {formatCurrency(
                                                                         selectedInvoice.medicalRecordId.prescriptions.reduce((s, p) => 
                                                                             s + ((p.medicineId?.retailPrice || 0) * p.quantity), 0)
                                                                     )}
                                                                 </td>
                                                             </tr>
                                                         )}
                                                         {/* CÓ TIÊM PHÒNG */}
                                                         {selectedInvoice.vaccinationId && (
                                                             <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                 <td style={{ padding: '12px 0' }}>
                                                                     <div style={{ fontWeight: 600 }}>Dịch vụ Tiêm chủng</div>
                                                                     <div style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: '10px' }}>• {selectedInvoice.vaccinationId.vaccineName || 'Vaccine'}</div>
                                                                 </td>
                                                                 <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(selectedInvoice.vaccinationId.price || 0)}</td>
                                                             </tr>
                                                         )}
                                                     </>
                                                 )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{ marginTop: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                            <span style={{ color: '#64748b' }}>Tạm tính:</span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(selectedInvoice.serviceTotal + selectedInvoice.medicineTotal + selectedInvoice.retailTotal)}</span>
                                        </div>
                                        {selectedInvoice.discountAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#dc2626' }}>
                                                <span>Giảm giá:</span>
                                                <span>-{formatCurrency(selectedInvoice.discountAmount)}</span>
                                            </div>
                                        )}
                                        {selectedInvoice.pointsUsed > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#ea580c' }}>
                                                <span>Dùng {selectedInvoice.pointsUsed} điểm:</span>
                                                <span>-{formatCurrency(selectedInvoice.pointsUsed * 1000)}</span>
                                            </div>
                                        )}
                                        {selectedInvoice.depositAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#059669' }}>
                                                <span>Trừ tiền cọc:</span>
                                                <span>-{formatCurrency(selectedInvoice.depositAmount)}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '2px solid #e2e8f0', paddingTop: '12px', marginBottom: '24px' }}>
                                            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem' }}>TỔNG CỘNG:</span>
                                            <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.4rem' }}>{formatCurrency(selectedInvoice.finalTotal)}</span>
                                        </div>

                                        <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '12px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Hoạt động tài khoản:</div>
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', fontSize: '0.85rem', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: '#64748b' }}>Ngày thực hiện:</span>
                                                <span style={{ fontWeight: 600 }}>{new Date(selectedInvoice.createdAt).toLocaleString('vi-VN')}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: '#64748b' }}>Loại giao dịch:</span>
                                                <span style={{ fontWeight: 600, color: '#16a34a' }}>Thu tiền {selectedInvoice.invoiceType === 'RETAIL' ? 'bán lẻ' : 'dịch vụ'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: '#64748b' }}>Hình thức:</span>
                                                <span style={{ fontWeight: 600 }}>{selectedInvoice.paymentMethod === 'TRANSFER' ? 'Chuyển khoản' : (selectedInvoice.paymentMethod === 'CARD' ? 'Thẻ POS' : 'Tiền mặt')}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                                                <span style={{ fontWeight: 700 }}>Số tiền thu:</span>
                                                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{formatCurrency(selectedInvoice.finalTotal)}</strong>
                                            </div>
                                            {selectedInvoice.pointsUsed > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#059669', fontSize: '0.8rem' }}>
                                                    <span>Điểm đã dùng:</span>
                                                    <span>-{selectedInvoice.pointsUsed} pts</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* CỘT 2: HỒ SƠ BỆNH ÁN & TOA THUỐC (Hiển thị nếu có MedicalRecord đối tượng đầy đủ) */}
                                {selectedInvoice.medicalRecordId && typeof selectedInvoice.medicalRecordId === 'object' && (
                                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #3b82f6', paddingBottom: '16px' }}>
                                            <h4 style={{ margin: 0, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 900 }}>Hồ Sơ: {selectedInvoice.medicalRecordId.petId?.name || 'Thú cưng'}</h4>
                                            <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 700, marginTop: '4px' }}>Giống: {selectedInvoice.medicalRecordId.petId?.species || 'N/A'} - {selectedInvoice.medicalRecordId.petId?.breed || ''}</div>
                                            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#64748b' }}>BS Phụ trách: {selectedInvoice.medicalRecordId.doctorId?.fullName || selectedInvoice.appointmentId?.staffId?.fullName || 'BSTY VetCare'}</p>
                                        </div>

                                        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div><span style={{ color: '#64748b' }}>Cân nặng:</span> <strong>{selectedInvoice.medicalRecordId.weightAtVisit || '--'} kg</strong></div>
                                                <div><span style={{ color: '#64748b' }}>Nhiệt độ:</span> <strong>{selectedInvoice.medicalRecordId.temperature || '--'} °C</strong></div>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <span style={{ color: '#64748b' }}>Triệu chứng:</span> 
                                                    <div style={{ marginTop: '4px', borderLeft: '3px solid #bfdbfe', paddingLeft: '8px' }}>{selectedInvoice.medicalRecordId.symptoms || 'Khám tổng quát'}</div>
                                                </div>
                                                <div style={{ gridColumn: 'span 2', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe', marginTop: '8px' }}>
                                                    <span style={{ color: '#1e3a8a', fontWeight: 700 }}>Chẩn đoán xác định:</span>
                                                    <div style={{ marginTop: '4px', fontWeight: 600, color: '#1e40af' }}>{selectedInvoice.medicalRecordId.diagnosis}</div>
                                                </div>
                                                {selectedInvoice.medicalRecordId.treatment && (
                                                    <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                                                        <span style={{ color: '#64748b' }}>Hướng điều trị:</span>
                                                        <div style={{ marginTop: '2px' }}>{selectedInvoice.medicalRecordId.treatment}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, marginBottom: '24px' }}>
                                            <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: '12px', fontSize: '0.85rem', textTransform: 'uppercase' }}>Toa thuốc điều trị (Chi tiết):</div>
                                            {selectedInvoice.medicalRecordId.prescriptions && selectedInvoice.medicalRecordId.prescriptions.length > 0 ? (
                                                selectedInvoice.medicalRecordId.prescriptions.map((p, idx) => (
                                                    <div key={idx} style={{ padding: '12px', borderBottom: '1px dashed #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : 'white', borderRadius: '8px', marginBottom: '4px' }}>
                                                         <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                                            {idx + 1}. {p.medicineName || p.medicineId?.productId?.name || p.medicineId?.name || 'Tên thuốc'} 
                                                            <span style={{ color: '#0369a1', marginLeft: '8px' }}>(SL: {p.quantity})</span>
                                                         </div>
                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', marginTop: '6px', paddingLeft: '20px', borderLeft: '2px solid #3b82f6' }}>
                                                            <strong>Liều dùng:</strong> {p.dosageInstructions || 'Theo chỉ dẫn của bác sĩ'}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                                    Không có dữ liệu toa thuốc trong hồ sơ này.
                                                </div>
                                            )}
                                        </div>

                                        {selectedInvoice.medicalRecordId.followUpDate && (
                                            <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.8rem', color: '#059669' }}>Ngày hẹn tái khám:</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#047857' }}>
                                                    {new Date(selectedInvoice.medicalRecordId.followUpDate).toLocaleDateString('vi-VN')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>


                            <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: '16px' }}>
                                <button className="btn" style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0', height: '48px', fontSize: '1rem', fontWeight: 600 }} 
                                    onClick={() => { setIsDetailModalOpen(false); setSelectedInvoice(null); }}>Đóng cửa sổ</button>
                                <button className="btn btn-primary" style={{ flex: 1.5, height: '48px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    onClick={() => { const inv = selectedInvoice; setIsDetailModalOpen(false); setSelectedInvoice(null); handlePrint(inv); }}>
                                    <Printer size={20} /> In Hóa Đơn Ngay
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </Layout>
        </>
    );
};

export default Invoices;
