import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, Plus, Calendar, Clock, MapPin, User, Stethoscope, Phone, Trash2, Edit2, CheckCircle, X, Smartphone, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Debounce hook
const useDebounce = (value, delay) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};

const Appointments = () => {
    const location = useLocation();
    const highlightId = location.state?.highlightAptId;
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth(); // Phân quyền UI
    const { toast } = useToast();

    // Modal Đặt Lịch
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerPets, setCustomerPets] = useState([]);
    const [formData, setFormData] = useState({
        type: 'MEDICAL',
        date: '',
        timeSlot: '08:00',
        customerNotes: '',
        deliveryType: 'NONE',
        pickupAddress: '',
        returnAddress: '',
    });
    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [dutyStaff, setDutyStaff] = useState([]); // Nhân viên có ca hôm nay + đã checkin
    const [selectedApt, setSelectedApt] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReasonInput, setCancelReasonInput] = useState('');
    const [cancellingId, setCancellingId] = useState(null);

    // --- Đổi lịch hẹn (Reschedule) ---
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [rescheduleForm, setRescheduleForm] = useState({ aptId: '', date: '', timeSlot: '', note: '' });
    const [rescheduleLoading, setRescheduleLoading] = useState(false);

    // --- Autocomplete tìm khách ---
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneSuggestions, setPhoneSuggestions] = useState([]);
    const [showPhoneDrop, setShowPhoneDrop] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    // --- Tạo khách mới inline ---
    const [newCustomerMode, setNewCustomerMode] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newPetName, setNewPetName] = useState('');
    const debouncedPhone = useDebounce(phoneInput, 280);


    const [filterState, setFilterState] = useState({
        status: '',
        type: '',
        date: ''
    });
    const [onCallStaff, setOnCallStaff] = useState([]);

    // Khởi tạo search từ URL nếu có (từ Helpdesk chuyển qua)
    const [searchQuery, setSearchQuery] = useState(new URLSearchParams(location.search).get('search') || '');
    const [showTrash, setShowTrash] = useState(false); // Thùng rác (hiển thị ca đã hủy)
    const [newBadgeIds, setNewBadgeIds] = useState([]); // Chứa danh sách ID các ca hẹn mới được hiện badge NEW

    const fetchAppointments = async (filters = filterState) => {
        try {
            const token = sessionStorage.getItem('token');
            let url = 'https://vet-clinic-1j57.onrender.com/api/v1/appointments';
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.type) params.append('type', filters.type);
            if (filters.date) params.append('date', filters.date);

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const aptList = res.data.data;
                setAppointments(aptList);

                // Logic tính toán badge NEW (chỉ hiện 1 lần lúc mới tải trang)
                const userIdStr = user?._id || 'guest';
                const seenNewApts = JSON.parse(localStorage.getItem(`seen_new_apts_${userIdStr}`)) || [];
                const justSeen = [];

                aptList.forEach(apt => {
                    if (apt.status === 'BOOKED' && apt.createdAt) {
                        const ageMs = new Date() - new Date(apt.createdAt);
                        if (ageMs < 2 * 60 * 60 * 1000) {
                            const isCustomerBooked = apt.bookingSource === 'CUSTOMER_APP' || !apt.bookingSource;
                            const isDoctorBooked = apt.bookingSource === 'DOCTOR' && ['FOLLOW_UP', 'VACCINATION'].includes(apt.category);

                            if (isCustomerBooked || isDoctorBooked) {
                                if (!seenNewApts.includes(apt._id)) {
                                    justSeen.push(apt._id); // Chưa xem => Đây là lần xem đầu tiên
                                }
                            }
                        }
                    }
                });

                if (justSeen.length > 0) {
                    setNewBadgeIds(justSeen);
                    localStorage.setItem(`seen_new_apts_${userIdStr}`, JSON.stringify([...seenNewApts, ...justSeen]));
                } else {
                    setNewBadgeIds([]);
                }
            }
        } catch (error) {
            console.error("Lỗi khi tải lịch hẹn:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (name, value) => {
        const newFilters = { ...filterState, [name]: value };
        setFilterState(newFilters);
        fetchAppointments(newFilters);
    };

    const fetchCustomers = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-1j57.onrender.com/api/v1/users?role=CUSTOMER', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setCustomers(res.data.data);
            }
        } catch (error) {
            console.error("Lỗi tải danh sách chủ nuôi", error);
        }
    };

    const fetchStaff = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get('https://vet-clinic-1j57.onrender.com/api/v1/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                // Lọc lấy Doctors và Groomers
                const filtered = res.data.data.filter(s => ['DOCTOR', 'GROOMER', 'RECEPTIONIST'].includes(s.role));
                setStaffList(filtered);
            }
        } catch (error) {
            console.error("Lỗi tải danh sách nhân viên", error);
        }
    };

    const fetchOnCallStaff = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const today = new Date().toISOString().split('T')[0];
            let url = `https://vet-clinic-1j57.onrender.com/api/v1/hrm/schedules?date=${today}&isOnCall=true`;
            // Lọc theo chi nhánh của người dùng hiện tại
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                // Lấy thông tin staff từ schedule
                const doctors = res.data.data.map(s => s.staffId).filter(s => s?.role === 'DOCTOR');
                setOnCallStaff(doctors);
            }
        } catch (error) {
            console.error("Lỗi tải BS trực on-call", error);
        }
    };

    const fetchDutyStaff = async () => {
        try {
            const token = sessionStorage.getItem('token');
            // Lấy ngày hôm nay theo VN (YYYY-MM-DD)
            const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
            const res = await axios.get(`https://vet-clinic-1j57.onrender.com/api/v1/hrm/duty-staff?date=${todayVN}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                // Chỉ giữ bác sĩ & groomer đã chấm công checkin hôm nay
                const checked = res.data.data.filter(s =>
                    ['DOCTOR', 'GROOMER'].includes(s.role) && s.hasCheckedIn
                );
                setDutyStaff(checked);
            }
        } catch (error) {
            console.error("Lỗi tải nhân viên trực hôm nay", error);
        }
    };

    useEffect(() => {
        if (isModalOpen || isDetailModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isModalOpen, isDetailModalOpen]);

    useEffect(() => {
        fetchAppointments();
        // fetchStaff và fetchCustomers dùng API /users — chỉ ADMIN & RECEPTIONIST có quyền
        if (['ADMIN', 'RECEPTIONIST'].includes(user?.role)) {
            fetchCustomers();
            fetchStaff();
            fetchOnCallStaff();
            fetchDutyStaff(); // Đối chiếu ca trực + chấm công
        }
    }, []);

    useEffect(() => {
        if (highlightId && appointments.length > 0) {
            setTimeout(() => {
                const el = document.getElementById(`apt-${highlightId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }, [highlightId, appointments]);

    // Autocomplete: gọi API khi debouncedPhone thay đổi
    useEffect(() => {
        if (!isModalOpen) return;
        if (debouncedPhone.length < 2) { setPhoneSuggestions([]); setShowPhoneDrop(false); return; }
        const token = sessionStorage.getItem('token');
        axios.get(`https://vet-clinic-1j57.onrender.com/api/v1/users?role=CUSTOMER&search=${debouncedPhone}`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => {
            setPhoneSuggestions((r.data.data || []).slice(0, 8));
            setShowPhoneDrop(true);
        }).catch(() => { });
    }, [debouncedPhone, isModalOpen]);

    // Chọn khách từ dropdown
    const pickCustomer = async (c) => {
        setSelectedCustomer(c);
        setPhoneInput(''); // Tự động xóa trắng sau khi chọn
        setShowPhoneDrop(false);
        setNewCustomerMode(false);
        setFormData(prev => ({ ...prev, customerId: c._id, petId: '' }));
        setCustomerPets([]);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.get(`https://vet-clinic-1j57.onrender.com/api/v1/pets?ownerId=${c._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setCustomerPets(res.data.data);
                if (res.data.data.length > 0)
                    setFormData(prev => ({ ...prev, customerId: c._id, petId: res.data.data[0]._id }));
            }
        } catch (_) { }
    };

    const openAddModal = () => {
        setFormData({
            customerId: '',
            petId: '',
            type: 'MEDICAL',
            date: '',
            timeSlot: '08:00',
            customerNotes: '',
            deliveryType: 'NONE',
            pickupAddress: '',
            returnAddress: '',
        });
        setSelectedCustomer(null);
        setPhoneInput('');
        setPhoneSuggestions([]);
        setShowPhoneDrop(false);
        setNewCustomerMode(false);
        setNewCustomerName('');
        setNewPetName('');
        setCustomerPets([]);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const resetCustomerState = () => {
        setSelectedCustomer(null);
        setPhoneInput('');
        setPhoneSuggestions([]);
        setShowPhoneDrop(false);
        setNewCustomerMode(false);
        setNewCustomerName('');
        setNewPetName('');
        setCustomerPets([]);
        setFormData(prev => ({ ...prev, customerId: '', petId: '' }));
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validatePhone = (phone) => {
        const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
        return phoneRegex.test(phone);
    };

    const handleSubmitAppointment = async (e) => {
        e.preventDefault();
        setSubmitLoading(true);
        setErrorMsg('');

        // 0. Validation định dạng & Logic thời gian
        if (!formData.date) { setErrorMsg('Vui lòng chọn ngày hẹn.'); setSubmitLoading(false); return; }
        if (!formData.timeSlot) { setErrorMsg('Vui lòng chọn khung giờ hẹn.'); setSubmitLoading(false); return; }

        const aptDate = new Date(formData.date);
        const today = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(today.getFullYear() + 1);

        aptDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        nextYear.setHours(0, 0, 0, 0);

        if (aptDate < today) {
            setErrorMsg('Không thể đặt lịch hẹn trong quá khứ.');
            setSubmitLoading(false);
            return;
        }

        if (aptDate > nextYear) {
            setErrorMsg('Không thể đặt lịch hẹn quá 1 năm tính từ hiện tại.');
            setSubmitLoading(false);
            return;
        }

        if (newCustomerMode && !validatePhone(phoneInput)) {
            setErrorMsg('Số điện thoại không hợp lệ (Phải có 10 chữ số, đúng đầu số Việt Nam).');
            setSubmitLoading(false);
            return;
        }

        // 1. Validation Logic cũ
        if (!formData.date) { setErrorMsg('Vui lòng chọn ngày hẹn.'); setSubmitLoading(false); return; }
        if (!formData.timeSlot) { setErrorMsg('Vui lòng chọn khung giờ hẹn.'); setSubmitLoading(false); return; }

        let resolvedCustomerId = formData.customerId;
        let resolvedPetId = '';

        // Nếu là khách mới (gọi điện lần đầu) — tạo tài khoản nhanh
        if (newCustomerMode) {
            if (!newCustomerName.trim() || !phoneInput.trim() || !newPetName.trim()) {
                setErrorMsg('Vui lòng nhập đầy đủ Họ tên, SĐT và Tên thú cưng.');
                setSubmitLoading(false); return;
            }
            try {
                const token = sessionStorage.getItem('token');
                // 1. Tạo khách mới
                const r = await axios.post('https://vet-clinic-1j57.onrender.com/api/v1/users/quick-customer',
                    { fullName: newCustomerName.trim(), phoneNumber: phoneInput.trim() },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                resolvedCustomerId = r.data.data._id;

                // 2. Tạo thú cưng mới cho khách này
                const petR = await axios.post('https://vet-clinic-1j57.onrender.com/api/v1/pets',
                    {
                        name: newPetName.trim(),
                        ownerId: resolvedCustomerId,
                        species: 'OTHER',
                        breed: 'Chưa xác định'
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                // Cập nhật ID thú cưng cho payload mà không mutate state trực tiếp
                resolvedPetId = petR.data.data._id;
            } catch (err) {
                setErrorMsg(err.response?.data?.message || 'Không tạo được khách hàng hoặc thú cưng mới.');
                setSubmitLoading(false); return;
            }
        } else {
            resolvedPetId = formData.petId;
        }

        if (!resolvedCustomerId || !resolvedPetId) {
            setErrorMsg('Vui lòng chọn hoặc nhập đủ thông tin Khách & Thú cưng.');
            setSubmitLoading(false); return;
        }

        try {
            const token = sessionStorage.getItem('token');
            const payload = { ...formData, customerId: resolvedCustomerId, petId: resolvedPetId };
            const res = await axios.post('https://vet-clinic-1j57.onrender.com/api/v1/appointments', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setIsModalOpen(false);
                setFormData({ customerId: '', petId: '', category: 'REGULAR', date: '', timeSlot: '08:00', customerNotes: '' });
                resetCustomerState();
                fetchAppointments();
                toast('Đặt lịch hẹn thành công!', 'success');
            }
        } catch (error) {
            setErrorMsg(error.response?.data?.message || 'Có lỗi xảy ra khi đặt lịch.');
            toast(error.response?.data?.message || 'Có lỗi xảy ra khi đặt lịch.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleStatusOrStaffUpdate = async (appointmentId, updateData) => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.patch(`https://vet-clinic-1j57.onrender.com/api/v1/appointments/${appointmentId}/status`,
                updateData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                fetchAppointments();
                if (selectedApt && selectedApt._id === appointmentId) {
                    setSelectedApt(res.data.data);
                }
                toast('Cập nhật trạng thái thành công!', 'success');
            }
        } catch (error) {
            console.error('[STATUS_UPDATE_ERROR]', error.response?.data || error.message);
            toast(error.response?.data?.message || 'Không thể cập nhật.', 'error');
        }
    };

    const handleCancelAppointment = (id) => {
        setCancellingId(id);
        setCancelReasonInput('');
        setIsCancelModalOpen(true);
    };

    const confirmCancel = async () => {
        if (!cancelReasonInput.trim()) {
            toast('Vui lòng nhập lý do hủy lịch.', 'error');
            return;
        }
        setSubmitLoading(true);
        await handleStatusOrStaffUpdate(cancellingId, {
            status: 'CANCELLED',
            cancelReason: cancelReasonInput
        });
        setSubmitLoading(false);
        setIsCancelModalOpen(false);
        setCancellingId(null);
    };

    // Mở modal sửa lịch hẹn
    const openReschedule = (apt) => {
        const dateStr = apt.date ? new Date(apt.date).toISOString().split('T')[0] : '';
        setRescheduleForm({ aptId: apt._id, date: dateStr, timeSlot: apt.timeSlot || '', note: '' });
        setIsRescheduleOpen(true);
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();

        if (user?.role !== 'ADMIN' && !rescheduleForm.note.trim()) {
            toast('Vui lòng ghi chú lý do đổi lịch (bắt buộc đối với nhân viên).', 'error');
            return;
        }

        if (!rescheduleForm.date) {
            toast('Vui lòng chọn ngày hẹn mới.', 'error');
            return;
        }

        const aptDate = new Date(rescheduleForm.date);
        const today = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(today.getFullYear() + 1);

        aptDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        nextYear.setHours(0, 0, 0, 0);

        if (aptDate < today) {
            toast('Không thể đổi lịch hẹn sang ngày trong quá khứ.', 'error');
            return;
        }

        if (aptDate > nextYear) {
            toast('Không thể đổi lịch hẹn quá 1 năm tính từ hiện tại.', 'error');
            return;
        }

        if (!rescheduleForm.date && !rescheduleForm.timeSlot) {
            toast('Vui lòng chọn ngày hoặc giờ mới.', 'error');
            return;
        }
        setRescheduleLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.patch(
                `https://vet-clinic-1j57.onrender.com/api/v1/appointments/${rescheduleForm.aptId}/reschedule`,
                { date: rescheduleForm.date, timeSlot: rescheduleForm.timeSlot, note: rescheduleForm.note },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setIsRescheduleOpen(false);
                fetchAppointments();
                toast('Đã cập nhật lịch hẹn thành công!', 'success');
            }
        } catch (err) {
            toast(err.response?.data?.message || 'Không thể cập nhật lịch hẹn.', 'error');
        } finally {
            setRescheduleLoading(false);
        }
    };

    const getStatusBadge = (apt) => {
        let badgeColor = 'var(--text-muted)';
        let badgeBg = '#f1f5f9';
        let statusText = 'N/A';

        if (apt.status === 'COMPLETED') { badgeColor = '#059669'; badgeBg = '#d1fae5'; statusText = 'Hoàn Tất'; }
        else if (apt.status === 'READY_FOR_PAYMENT') { badgeColor = '#ea580c'; badgeBg = '#ffedd5'; statusText = 'Chờ Thanh Toán'; }
        else if (apt.status === 'IN_PROGRESS') { badgeColor = '#0284c7'; badgeBg = '#e0f2fe'; statusText = 'Đang Phục Vụ'; }
        else if (apt.status === 'ARRIVED') { badgeColor = '#7c3aed'; badgeBg = '#ede9fe'; statusText = 'Đã Đến'; }
        else if (apt.status === 'BOOKED') { badgeColor = '#475569'; badgeBg = '#f1f5f9'; statusText = 'Đã Đặt'; }
        else if (apt.status === 'CANCELLED') { badgeColor = '#dc2626'; badgeBg = '#fee2e2'; statusText = 'Đã Hủy'; }
        else if (apt.status === 'RESCHEDULE_PENDING') { badgeColor = '#c2410c'; badgeBg = '#fff7ed'; statusText = 'Chờ Phản Hồi'; }

        return (
            <div
                className="status-select"
                style={{
                    background: badgeBg,
                    color: badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    paddingRight: '14px', // Ghé lại padding vì không còn arrow của select
                    backgroundImage: 'none' // Bỏ icon arrow của dropdown
                }}
            >
                {statusText}
            </div>
        );
    };

    const getServiceBadge = (apt) => {
        const type = apt.type;
        const category = apt.category;
        const svcName = (apt.serviceId?.name || apt.serviceId?.serviceName || '').toLowerCase();

        // Tiêm phòng: ưu tiên category, fallback theo service name
        const isVaccination = category === 'VACCINATION' ||
            svcName.includes('tiêm') || svcName.includes('vaccine') || svcName.includes('vắc');

        let label, bg, color, border;

        if (type === 'GROOMING') {
            label = 'Grooming';
            bg = '#fff7ed'; color = '#c2410c'; border = '#fed7aa';
        } else if (isVaccination) {
            label = 'Tiêm Phòng';
            bg = '#dcfce7'; color = '#15803d'; border = '#86efac';
        } else if (category === 'FOLLOW_UP') {
            label = 'Tái Khám';
            bg = '#e0f2fe'; color = '#0284c7'; border = '#bae6fd';
        } else {
            // MEDICAL REGULAR / WALKIN
            label = category === 'WALKIN' ? 'Khám Bệnh · Trực tiếp' : 'Khám Bệnh';
            bg = '#f0fdfa'; color = '#0f766e'; border = '#99f6e4';
        }

        return (
            <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: bg,
                color,
                border: `1px solid ${border}`,
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
            }}>
                {label}
            </span>
        );
    };

    const getCategoryBadge = (category) => {
        switch (category) {
            case 'FOLLOW_UP':
                return <span style={{ background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>TÁI KHÁM</span>;
            case 'WALKIN':
                return <span style={{ background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>WALK-IN</span>;
            default:
                return null;
        }
    };

    // Badge guồn tạo lịch hẹn
    const getBookingSourceBadge = (apt) => {
        const source = apt.bookingSource;
        if (!source) {
            if (apt.category === 'FOLLOW_UP') return { label: 'Bác sĩ', color: '#0369a1', bg: '#e0f2fe' };
            if (apt.category === 'VACCINATION') return { label: 'Bác sĩ', color: '#15803d', bg: '#dcfce7' };
            return { label: 'App', color: '#7c3aed', bg: '#f5f3ff' };
        }
        switch (source) {
            case 'CUSTOMER_APP': return { label: 'App khách', color: '#7c3aed', bg: '#f5f3ff' };
            case 'RECEPTIONIST': return { label: 'Lễ tân', color: '#0369a1', bg: '#e0f2fe' };
            case 'DOCTOR': return { label: 'Bác sĩ', color: '#059669', bg: '#dcfce7' };
            case 'SYSTEM': return { label: 'Hệ thống', color: '#64748b', bg: '#f1f5f9' };
            default: return { label: source, color: '#94a3b8', bg: '#f8fafc' };
        }
    };

    const displayedAppointments = appointments
        .filter(apt => {
            // Ẩn ca Đã Hủy nếu chưa bật Thùng rác
            if (!showTrash && apt.status === 'CANCELLED') return false;
            // Chỉ hiện ca Đã Hủy nếu bật Thùng rác
            if (showTrash && apt.status !== 'CANCELLED') return false;

            const q = searchQuery.toLowerCase();
            const idMatched = apt._id?.toLowerCase().includes(q) || (apt.orderId || '').toLowerCase().includes(q);
            const customerName = (apt.customerId?.fullName || '').toLowerCase();
            const phone = (apt.customerId?.phoneNumber || '');
            const petName = (apt.petId?.name || '').toLowerCase();
            const staffName = (apt.staffId?.fullName || '').toLowerCase();
            const serviceType = apt.type === 'MEDICAL' ? 'khám bệnh' : 'grooming';

            // Map status code to Vietnamese text for searching
            const statusMap = {
                'BOOKED': 'đã đặt',
                'ARRIVED': 'đã đến',
                'IN_PROGRESS': 'đang phục vụ đang khám',
                'READY_FOR_PAYMENT': 'chờ thanh toán',
                'COMPLETED': 'hoàn tất xong',
                'CANCELLED': 'đã hủy',
                'RESCHEDULE_PENDING': 'chờ xác nhận đổi lịch'
            };
            const statusText = statusMap[apt.status] || '';

            return (
                idMatched ||
                customerName.includes(q) ||
                phone.includes(q) ||
                petName.includes(q) ||
                staffName.includes(q) ||
                serviceType.includes(q) ||
                statusText.includes(q)
            );
        })
        .sort((a, b) => {
            // Thứ tự ưu tiên trạng thái (số lớn = hiện trước)
            const STATUS_ORDER = {
                'RESCHEDULE_PENDING': 6,  // Chờ phản hồi — cấp thiết nhất
                'ARRIVED': 5,  // Đã đến
                'IN_PROGRESS': 4,  // Đang phục vụ
                'READY_FOR_PAYMENT': 3,  // Chờ thanh toán
                'BOOKED': 2,  // Đã đặt
                'COMPLETED': 1,  // Hoàn tất
                'CANCELLED': 0,  // Đã hủy
            };

            const prioA = STATUS_ORDER[a.status] ?? -1;
            const prioB = STATUS_ORDER[b.status] ?? -1;

            // Sắp xếp theo nhóm trạng thái trước
            if (prioA !== prioB) return prioB - prioA;

            // Cùng nhóm → sắp theo ngày
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);

            if (a.status === 'COMPLETED' || a.status === 'CANCELLED') {
                // Hoàn tất / Đã hủy: gần nhất → xa nhất (mới nhất hiện trước)
                if (dateA.getTime() !== dateB.getTime()) return dateB - dateA;
                return (b.timeSlot || '').localeCompare(a.timeSlot || '');
            }

            // Các trạng thái còn lại (BOOKED, ARRIVED, IN_PROGRESS...): ngày sắp tới trước
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
            return (a.timeSlot || '').localeCompare(b.timeSlot || '');
        });

    return (
        <Layout>
            <div className="dashboard-header animate-fade-in" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', margin: 0 }}>Quản Lý Lịch Hẹn</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.9rem' }}>
                            Theo dõi và sắp xếp lịch tiếp đón khách hàng.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '100%', justifyContent: 'flex-start' }}>
                        <div className="input-with-icon" style={{ flex: '1 1 300px', minWidth: '200px' }}>
                            <Search size={18} className="input-icon" />
                            <input
                                type="text"
                                className="input-field"
                                style={{ height: '42px', marginBottom: '0' }}
                                placeholder="Tìm khách, SĐT, thú cưng..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {user?.role !== 'GROOMER' && (
                            <button className="btn btn-primary btn-responsive" style={{ height: '42px', flex: '0 0 auto', padding: '0 24px' }} onClick={openAddModal}>
                                <Plus size={18} /> <span className="hide-on-mobile">Tiếp Nhận</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Staff Availability Panel (chỉ Admin & Lễ tân) ── */}
            {['ADMIN', 'RECEPTIONIST'].includes(user?.role) && (() => {
                const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
                const busyIds = new Set(
                    appointments
                        .filter(a => a.status === 'IN_PROGRESS' && a.date?.slice(0, 10) === today && a.staffId?._id)
                        .map(a => a.staffId._id)
                );
                const staffGroups = [
                    { label: '👨‍⚕️ Bác sĩ', members: dutyStaff.filter(s => s.role === 'DOCTOR') },
                    { label: '✂️ Groomer', members: dutyStaff.filter(s => s.role === 'GROOMER') },
                ].filter(g => g.members.length > 0);

                return (
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {staffGroups.length === 0 ? (
                            <div style={{
                                background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
                                padding: '10px 16px', fontSize: '0.8rem', color: '#94a3b8',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <span>⏳</span> Chưa có bác sĩ / groomer nào chấm công hôm nay
                            </div>
                        ) : staffGroups.map(group => (
                            <div key={group.label} style={{
                                background: 'white', borderRadius: '14px',
                                border: '1px solid #e2e8f0', padding: '12px 16px',
                                flex: '1 1 260px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                            }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    {group.label}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                    {group.members.map(s => {
                                        const busy = busyIds.has(s._id);
                                        const activeApt = busy ? appointments.find(a => a.status === 'IN_PROGRESS' && a.staffId?._id === s._id) : null;
                                        return (
                                            <div key={s._id}
                                                title={activeApt ? `Đang khám: ${activeApt.petId?.name || 'Thú cưng'} (${activeApt.timeSlot || ''})` : 'Đã chấm công · Sẵn sàng nhận ca'}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '4px 10px', borderRadius: '20px',
                                                    background: busy ? '#fef2f2' : '#f0fdf4',
                                                    border: `1px solid ${busy ? '#fca5a5' : '#86efac'}`,
                                                    fontSize: '0.78rem', fontWeight: 600,
                                                    color: busy ? '#dc2626' : '#16a34a',
                                                    cursor: 'default', whiteSpace: 'nowrap'
                                                }}>
                                                <span style={{
                                                    width: '7px', height: '7px', borderRadius: '50%',
                                                    background: busy ? '#ef4444' : '#22c55e',
                                                    animation: busy ? 'pulseDot 1.4s ease-in-out infinite' : 'none',
                                                    flexShrink: 0
                                                }} />
                                                {s.fullName?.split(' ').slice(-1)[0]}
                                                <span style={{ fontWeight: 400, opacity: 0.75, fontSize: '0.72rem' }}>
                                                    {busy ? '· Đang bận' : '· Trống'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        <style>{`@keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }`}</style>
                    </div>
                );
            })()}

            <div className="glass-card animate-fade-in" style={{ marginBottom: '24px', padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Trạng thái</label>
                        <select
                            className="input-field"
                            style={{ fontSize: '0.85rem', marginBottom: 0, width: '100%', height: '42px' }}
                            value={filterState.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="BOOKED">Đã Đặt</option>
                            <option value="ARRIVED">Đã Đến</option>
                            <option value="IN_PROGRESS">Đang Phục Vụ</option>
                            <option value="READY_FOR_PAYMENT">Chờ Thanh Toán</option>
                            <option value="COMPLETED">Hoàn Tất</option>
                            <option value="CANCELLED">Đã Hủy</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Dịch vụ</label>
                        <select
                            className="input-field"
                            style={{ fontSize: '0.85rem', marginBottom: 0, width: '100%', height: '42px' }}
                            value={filterState.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="">Tất cả dịch vụ</option>
                            <option value="MEDICAL">Khám Bệnh</option>
                            <option value="GROOMING">Grooming</option>
                            <option value="VACCINATION">Tiêm Phòng</option>
                            <option value="FOLLOW_UP">Tái Khám</option>
                            <option value="WALKIN">Trực tiếp</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Ngày hẹn</label>
                        <input
                            type="date"
                            className="input-field"
                            style={{ fontSize: '0.85rem', marginBottom: 0, width: '100%', height: '42px' }}
                            value={filterState.date}
                            onChange={(e) => handleFilterChange('date', e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', height: '42px', gridColumn: '1 / -1' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ flex: 1, fontSize: '0.85rem', height: '100%', padding: '0 12px' }}
                            onClick={() => {
                                const reset = { status: '', type: '', date: '' };
                                setFilterState(reset);
                                setSearchQuery('');
                                setShowTrash(false);
                                fetchAppointments(reset);
                            }}
                        >
                            Đặt lại
                        </button>
                        <button
                            className="btn"
                            style={{
                                flex: 2,
                                fontSize: '0.85rem',
                                height: '100%',
                                padding: '0 12px',
                                background: showTrash ? '#fee2e2' : '#f8fafc',
                                color: showTrash ? '#dc2626' : '#64748b',
                                border: `1px solid ${showTrash ? '#fecaca' : '#e2e8f0'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                            onClick={() => setShowTrash(!showTrash)}
                        >
                            {showTrash ? 'Đóng Thùng Rác' : 'Mở Thùng Rác'}
                        </button>
                    </div>
                </div>
            </div>


            <div className="glass-card animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--primary)' }}>
                        Danh Sách Đặt Chỗ
                    </h3>
                </div>

                <div className="table-responsive">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th className="col-customer">Khách & Thú Cưng</th>
                                <th className="col-time">Thời Gian</th>
                                <th className="col-service">Dịch Vụ & Nhân Viên</th>
                                <th className="col-status">Trạng Thái</th>
                                {user?.role !== 'GROOMER' && (
                                    <th className="col-actions">Hành Động</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Đang tải dữ liệu lịch hẹn...
                                    </td>
                                </tr>
                            ) : appointments.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role !== 'GROOMER' && user?.role !== 'DOCTOR' ? 5 : 4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Chưa có lịch hẹn nào trên hệ thống. Hãy bấm <strong>Đặt Lịch Mới</strong> để tạo dữ liệu.
                                    </td>
                                </tr>
                            ) : displayedAppointments.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <Search size={40} strokeWidth={1} />
                                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Không tìm thấy kết quả</div>
                                            <div style={{ fontSize: '0.9rem' }}>Không tìm thấy dữ liệu nào khớp với từ khóa "<strong>{searchQuery}</strong>"</div>
                                            <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={() => setSearchQuery('')}>Xóa tìm kiếm</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayedAppointments.map((apt) => (
                                    <tr key={apt._id} id={`apt-${apt._id}`} className="table-row-hover" style={{
                                        transition: 'background-color 0.4s ease, box-shadow 0.4s ease',
                                        backgroundColor: highlightId === apt._id ? 'rgba(15, 169, 172, 0.1)' : 'transparent',
                                        boxShadow: highlightId === apt._id ? 'inset 0 0 0 2px rgba(15, 169, 172, 0.5)' : 'none'
                                    }}>
                                        <td className="col-customer" data-label="Khách & Thú Cưng">
                                            <div className="apt-customer-cell">
                                                <div className="apt-customer-name">
                                                    {apt.customerId?.fullName || 'Khách Vãng Lai'}
                                                    {newBadgeIds.includes(apt._id) && (
                                                        <span title="Lịch hẹn vừa được tạo mới" style={{ marginLeft: '8px', padding: '1px 5px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 900, background: '#ef4444', color: 'white', letterSpacing: '0.05em', animation: 'pulseDot 2s infinite', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }}>
                                                            NEW
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const src = getBookingSourceBadge(apt);
                                                        return (
                                                            <span title={`Đặt qua: ${src.label}`}
                                                                style={{ marginLeft: '6px', padding: '1px 7px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, background: src.bg, color: src.color, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
                                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: src.color, flexShrink: 0 }} />
                                                                {src.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="apt-customer-phone">{apt.customerId?.phoneNumber || 'N/A'}</div>
                                                <div className="apt-pet-tag">
                                                    Thú cưng: <strong>{apt.petId?.name || '---'}</strong>
                                                </div>
                                                {apt.customerNotes && (
                                                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#7c3aed', background: '#f5f3ff', borderRadius: '6px', padding: '3px 8px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={apt.customerNotes}>
                                                        💬 {apt.customerNotes}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cột 2: Thời Gian */}
                                        <td className="col-time" data-label="Thời Gian">
                                            <div className="apt-time-cell">
                                                <div className="apt-date">
                                                    <Calendar size={13} />
                                                    <span>{apt.date ? new Date(apt.date).toLocaleDateString('vi-VN') : '---'}</span>
                                                </div>
                                                <div className="apt-hour">
                                                    <Clock size={13} />
                                                    <span>{apt.timeSlot || 'Chưa định giờ'}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột 3: Dịch Vụ & Nhân Viên */}
                                        <td className="col-service" data-label="Dịch Vụ & Nhân Viên">
                                            <div className="apt-service-cell">
                                                <div className="apt-service-type">{getServiceBadge(apt)}</div>
                                                {/* Hiển thị danh sách dịch vụ đã chọn */}
                                                {(() => {
                                                    const svcs = apt.serviceIds?.length > 0
                                                        ? apt.serviceIds
                                                        : apt.serviceId ? [apt.serviceId] : [];
                                                    if (svcs.length === 0) return null;
                                                    return (
                                                        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            {svcs.map((s, i) => (
                                                                <div key={i} style={{ fontSize: '0.73rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                                                                    {s.name || s}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                                {apt.staffId ? (
                                                    <div className="apt-staff-name">
                                                        <User size={12} />
                                                        <span>{apt.staffId.fullName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="apt-no-staff">Chưa phân công</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cột 4: Trạng Thái */}
                                        <td className="col-status" data-label="Trạng Thái">
                                            <div className="apt-status-cell">
                                                {getStatusBadge(apt)}
                                            </div>
                                        </td>

                                        {/* Cột 5: Hành Động */}
                                        <td className="col-actions" data-label="Hành Động">
                                            <div className="action-buttons-group">
                                                {/* 1. Nút Check-in — Admin: mọi lúc hôm nay | Lễ tân: trong 60 phút trước giờ hẹn */}
                                                {['ADMIN', 'RECEPTIONIST'].includes(user?.role) &&
                                                    apt.status === 'BOOKED' &&
                                                    (() => {
                                                        const now = new Date();
                                                        const aptDay = new Date(apt.date);

                                                        // So sánh ngày theo giờ LOCAL (tránh UTC shift)
                                                        const toLocalStr = d => {
                                                            const dd = new Date(d);
                                                            return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
                                                        };
                                                        const todayStr = toLocalStr(now);
                                                        const aptDayStr = toLocalStr(aptDay);

                                                        if (aptDayStr > todayStr) return false; // tương lai → ẩn
                                                        if (aptDayStr < todayStr) return true;  // quá hạn → cho check-in

                                                        // Cùng ngày: ADMIN không giới hạn giờ (để demo/test)
                                                        if (user?.role === 'ADMIN') return true;

                                                        // RECEPTIONIST: chỉ trong vòng 60 phút trước giờ hẹn
                                                        const [h, m] = (apt.timeSlot || '00:00').split(':').map(Number);
                                                        const aptTime = new Date(apt.date);
                                                        aptTime.setHours(h, m, 0, 0);
                                                        return (aptTime - now) / 60000 <= 60;
                                                    })() && (
                                                        <button
                                                            className="action-btn"
                                                            style={{ background: '#ede9fe', color: '#7c3aed', borderColor: '#ddd6fe' }}
                                                            onClick={() => handleStatusOrStaffUpdate(apt._id, { status: 'ARRIVED' })}
                                                            title="Khách đã đến"
                                                        >
                                                            <MapPin size={13} /> <span className="hide-on-mobile">Check-in</span>
                                                        </button>
                                                    )}



                                                {/* 3. Nút Hoàn Tất Chuyên Môn (Bác sĩ/Groomer đang phụ trách) */}
                                                {['DOCTOR', 'GROOMER'].includes(user?.role) &&
                                                    apt.staffId?._id === user?._id &&
                                                    apt.status === 'IN_PROGRESS' && (
                                                        <button
                                                            className="action-btn"
                                                            style={{ background: '#ecfdf5', color: '#059669', borderColor: '#d1fae5' }}
                                                            onClick={() => handleStatusOrStaffUpdate(apt._id, { status: 'READY_FOR_PAYMENT' })}
                                                            title="Xong chuyên môn"
                                                        >
                                                            ✅ <span className="hide-on-mobile">Hoàn Tất</span>
                                                        </button>
                                                    )}


                                                {/* Nút Sửa: BOOKED + đúng role → mở modal đổi lịch */}
                                                {apt.status === 'BOOKED' && ['ADMIN', 'RECEPTIONIST', 'DOCTOR'].includes(user?.role) ? (
                                                    <button
                                                        className="action-btn action-btn-ghost-info"
                                                        title="Đổi ngày/giờ lịch hẹn"
                                                        onClick={() => openReschedule(apt)}
                                                    >
                                                        <Edit2 size={14} />
                                                        <span className="hide-on-mobile">Sửa</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="action-btn action-btn-ghost-info"
                                                        title="Xem chi tiết"
                                                        onClick={() => {
                                                            setSelectedApt(apt);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                        <span className="hide-on-mobile">Sửa</span>
                                                    </button>
                                                )}
                                                <button
                                                    className="action-btn action-btn-ghost-danger"
                                                    title="Hủy lịch hẹn"
                                                    disabled={apt.status !== 'BOOKED'}
                                                    onClick={() => handleCancelAppointment(apt._id)}
                                                >
                                                    <Trash2 />
                                                    <span className="hide-on-mobile">Hủy</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Chi Tiết Lịch Hẹn */}
            {isDetailModalOpen && selectedApt && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, border: (selectedApt.isEmergency && !['READY_FOR_PAYMENT', 'COMPLETED'].includes(selectedApt.status)) ? '2px solid var(--danger)' : 'none', width: '90%', maxWidth: '720px', background: 'white', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
                        <div style={{ padding: '20px 28px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: (selectedApt.isEmergency && !['READY_FOR_PAYMENT', 'COMPLETED'].includes(selectedApt.status)) ? 'linear-gradient(to right, #fff1f2, white)' : '#f8fafc', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', color: selectedApt.isEmergency ? 'var(--danger)' : 'var(--primary)', fontWeight: 800 }}>
                                    Chi Tiết Lịch Hẹn
                                    {selectedApt.isEmergency && !['READY_FOR_PAYMENT', 'COMPLETED'].includes(selectedApt.status) && <span style={{ background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>CẤP CỨU</span>}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Mã: #{selectedApt._id.slice(-6).toUpperCase()}</p>
                            </div>
                            <button className="btn-icon" onClick={() => setIsDetailModalOpen(false)} style={{ color: '#94a3b8' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto' }}>
                            <div className="responsive-grid" style={{ marginBottom: '24px' }}>
                                <div>
                                    <h4 style={{ marginBottom: '16px', borderLeft: '4px solid var(--primary)', paddingLeft: '12px', fontSize: '1rem' }}>Thông Tin Khách</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Họ tên:</span>
                                            <span style={{ fontWeight: '600', textAlign: 'right' }}>{selectedApt.customerId?.fullName}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>SĐT:</span>
                                            <span style={{ fontWeight: '600', textAlign: 'right' }}>{selectedApt.customerId?.phoneNumber}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Thú cưng:</span>
                                            <span style={{ fontWeight: '600', color: 'var(--primary)', textAlign: 'right' }}>{selectedApt.petId?.name} ({selectedApt.petId?.breed})</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ marginBottom: '16px', borderLeft: '4px solid var(--info)', paddingLeft: '12px', fontSize: '1rem' }}>Thời Gian & Nguồn</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ngày hẹn:</span>
                                            <span style={{ fontWeight: '600', textAlign: 'right' }}>{new Date(selectedApt.date).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Khung giờ:</span>
                                            <span style={{ fontWeight: '600', color: 'var(--primary)', textAlign: 'right' }}>{selectedApt.timeSlot}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Dịch vụ:</span>
                                            <span style={{ textAlign: 'right' }}>{getServiceBadge(selectedApt)}</span>
                                        </div>
                                        {(() => {
                                            const svcs = selectedApt.serviceIds?.length > 0
                                                ? selectedApt.serviceIds
                                                : selectedApt.serviceId ? [selectedApt.serviceId] : [];
                                            if (svcs.length === 0) return null;
                                            return (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0 }}>Gói dịch vụ:</span>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {svcs.map((s, i) => (
                                                            <div key={i} style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f766e' }}>
                                                                {s.name || s}{s.price ? <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.8rem' }}> — {s.price.toLocaleString('vi-VN')}đ</span> : ''}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nguồn đặt:</span>
                                            <span style={{ textAlign: 'right', fontWeight: '500', fontSize: '0.85rem' }}>
                                                {selectedApt.bookingSource === 'APP' ? 'Ứng dụng' :
                                                    selectedApt.bookingSource === 'CALL' ? 'Gọi điện' :
                                                        selectedApt.bookingSource === 'PICKUP_REQUEST' ? 'Đưa rước' :
                                                            selectedApt.bookingSource === 'DELIVERY_REQUEST' ? 'Mang trả hộ' :
                                                                selectedApt.bookingSource === 'WALKIN' ? 'Đến trực tiếp' : 'Khác'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedApt.status === 'CANCELLED' && selectedApt.cancelReason && (
                                <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #fca5a5' }}>
                                    <h4 style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#b91c1c' }}>Lý do hủy lịch:</h4>
                                    <p style={{ margin: 0, color: '#991b1b', fontSize: '0.9rem', fontWeight: 500 }}>
                                        {selectedApt.cancelReason}
                                    </p>
                                </div>
                            )}

                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                <h4 style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Ghi chú từ khách hàng:</h4>
                                <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                    {selectedApt.customerNotes || "Không có ghi chú nào."}
                                </p>
                            </div>

                            {/* Thông tin đưa rước — hiện khi có */}
                            {selectedApt.deliveryType && selectedApt.deliveryType !== 'NONE' && (
                                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <h4 style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#0369a1' }}>
                                        🚗 Dịch vụ Đưa / Trả:
                                        <span style={{ marginLeft: '8px', fontWeight: 400 }}>
                                            {selectedApt.deliveryType === 'PICKUP_AND_RETURN' ? 'Đưa & Trả' :
                                                selectedApt.deliveryType === 'PICKUP_ONLY' ? 'Chỉ Rước' : 'Chỉ Trả'}
                                        </span>
                                    </h4>
                                    {selectedApt.pickupAddress && (
                                        <div style={{ fontSize: '0.9rem', marginBottom: '6px' }}>📍 <strong>Rước tại:</strong> {selectedApt.pickupAddress}</div>
                                    )}
                                    {selectedApt.returnAddress && (
                                        <div style={{ fontSize: '0.9rem' }}>📍 <strong>Trả về:</strong> {selectedApt.returnAddress}</div>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>Nhân viên phụ trách:</label>
                                {selectedApt.staffId ? (
                                    <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                        <strong>{selectedApt.staffId.fullName}</strong> đang phụ trách.
                                    </div>
                                ) : (
                                    <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', color: '#92400e', fontSize: '0.85rem' }}>
                                        Chưa có nhân viên phụ trách. Bác sĩ/Groomer sẽ trực tiếp xử lý khi đến ca.
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>Ghi chú nội bộ:</label>
                                <textarea
                                    className="input-field"
                                    style={{ minHeight: '80px', fontSize: '0.9rem' }}
                                    placeholder="Kết quả sơ bộ hoặc hướng dẫn..."
                                    defaultValue={selectedApt.staffNotes}
                                    onBlur={(e) => handleStatusOrStaffUpdate(selectedApt._id, { staffNotes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '20px 24px', borderTop: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#f8fafc', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trạng thái hiện tại:</span>
                                <div style={{ marginTop: '4px' }}>{getStatusBadge(selectedApt)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {/* Nút Hoàn Tất Ca trong modal — dành cho BS/Groomer đang phụ trách */}
                                {['DOCTOR', 'GROOMER'].includes(user?.role) &&
                                    selectedApt.staffId?._id === user?._id &&
                                    selectedApt.status === 'IN_PROGRESS' && (
                                        <button
                                            className="btn"
                                            style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}
                                            onClick={() => {
                                                handleStatusOrStaffUpdate(selectedApt._id, { status: 'COMPLETED' });
                                                setIsDetailModalOpen(false);
                                            }}
                                        >
                                            ✅ Hoàn Tất Ca
                                        </button>
                                    )}
                                <button className="btn btn-primary" onClick={() => setIsDetailModalOpen(false)} style={{ flex: '1 1 auto', maxWidth: '200px' }}>Đóng</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Đặt Lịch Hẹn Mới */}
            {isModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 3000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, width: '90%', maxWidth: '640px', background: 'white', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 800 }}>Tiếp Nhận Lịch Hẹn Mới</h3>
                            <button className="btn-icon" onClick={() => setIsModalOpen(false)} style={{ color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: '1 1 auto' }}>
                            <form id="createAppointmentForm" onSubmit={handleSubmitAppointment}>
                                {errorMsg && (
                                    <div style={{ background: 'var(--danger)', color: 'white', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                                        {errorMsg}
                                    </div>
                                )}

                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>

                                    {/* ── KHÁCH ĐÃ CHỌN ── */}
                                    {selectedCustomer && !newCustomerMode ? (
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>KHÁCH HÀNG</label>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '10px 14px', borderRadius: '10px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedCustomer.fullName}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#047857' }}>{selectedCustomer.phoneNumber}</div>
                                                </div>
                                                <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={resetCustomerState}>Đổi</button>
                                            </div>
                                        </div>
                                    ) : !newCustomerMode ? (
                                        /* ── AUTOCOMPLETE SĐT ── */
                                        <div className="form-group" style={{ marginBottom: '16px', position: 'relative' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>SỐ ĐIỆN THOẠI *</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={phoneInput}
                                                onChange={e => { setPhoneInput(e.target.value); setSelectedCustomer(null); setFormData(p => ({ ...p, customerId: '' })); }}
                                                onBlur={() => setTimeout(() => setShowPhoneDrop(false), 200)}
                                                onFocus={() => phoneSuggestions.length > 0 && setShowPhoneDrop(true)}
                                                placeholder="Nhập SĐT để tìm hoặc tạo mới..."
                                                style={{ background: 'white', marginBottom: 0 }}
                                                autoComplete="off"
                                            />
                                            {showPhoneDrop && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, overflowX: 'hidden', maxHeight: '250px', overflowY: 'auto' }}>
                                                    {phoneSuggestions.map(c => (
                                                        <div key={c._id}
                                                            style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', display: 'flex', gap: '12px', alignItems: 'center' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                            onMouseDown={() => pickCustomer(c)}
                                                        >
                                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                                                                {c.fullName?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.fullName}</div>
                                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.phoneNumber}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div
                                                        style={{ padding: '12px 14px', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', borderTop: phoneSuggestions.length > 0 ? '1px solid #e2e8f0' : 'none' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                        onMouseDown={() => { setShowPhoneDrop(false); setNewCustomerMode(true); }}
                                                    >+ Tạo khách mới</div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* ── FORM KHÁCH MỚI CẢI TIẾN ── */
                                        <div style={{
                                            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            marginBottom: '20px',
                                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <User size={18} />
                                                    </div>
                                                    <label style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', letterSpacing: '0.5px' }}>THÔNG TIN KHÁCH MỚI</label>
                                                </div>
                                                <button type="button" className="btn-text" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }} onClick={resetCustomerState}>
                                                    <X size={14} style={{ marginRight: '4px' }} /> Hủy tạo mới
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div className="responsive-grid" style={{ gap: '12px', gridTemplateColumns: '1fr 1fr' }}>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>HỌ VÀ TÊN *</label>
                                                        <input className="input-field" style={{ marginBottom: 0, background: 'white', border: '1px solid #cbd5e1' }} placeholder="Nguyễn Văn A" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
                                                    </div>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>SỐ ĐIỆN THOẠI *</label>
                                                        <input className="input-field" style={{ marginBottom: 0, background: 'white', border: '1px solid #cbd5e1' }} placeholder="09xxx..." value={phoneInput} onChange={e => setPhoneInput(e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>🐶 TÊN THÚ CƯNG *</label>
                                                    <input
                                                        className="input-field"
                                                        style={{ marginBottom: 0, background: 'white', border: '1px solid #cbd5e1', fontWeight: 600, color: 'var(--primary)' }}
                                                        placeholder="Nhập tên bé thú cưng..."
                                                        value={newPetName}
                                                        onChange={e => setNewPetName(e.target.value)}
                                                    />
                                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: '4px', fontStyle: 'italic' }}>Thông tin loài và giống sẽ được bổ sung khi bé đến phòng khám.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── CHỌN THU CƯNG (Chỉ hiện khi không ở chế độ khách mới) ── */}
                                    {!newCustomerMode && (
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>CHỌN THÚ CƯNG CỦA KHÁCH</label>
                                            <select
                                                className="input-field"
                                                name="petId"
                                                value={formData.petId}
                                                onChange={handleInputChange}
                                                disabled={!formData.customerId}
                                                style={{ background: 'white', marginBottom: 0 }}
                                            >
                                                <option value="">-- {formData.customerId ? (customerPets.length > 0 ? 'Chọn thú cưng...' : 'Chưa có thông tin thú cưng') : 'Chọn khách trước'} --</option>
                                                {customerPets.map(pet => (
                                                    <option key={pet._id} value={pet._id}>{pet.name} ({pet.species === 'DOG' ? 'Chó' : pet.species === 'CAT' ? 'Mèo' : 'Khác'})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="responsive-grid" style={{ marginBottom: '16px', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Dịch Vụ *</label>
                                        <select className="input-field" name="type" value={formData.type} onChange={handleInputChange} style={{ marginBottom: 0 }}>
                                            <option value="MEDICAL">Khám / Y tế</option>
                                            <option value="GROOMING">Grooming &amp; Spa</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Phân loại</label>
                                        <select className="input-field" name="category" value={formData.category || 'REGULAR'} onChange={handleInputChange} style={{ marginBottom: 0 }} disabled={formData.type === 'GROOMING'}>
                                            <option value="REGULAR">Khám Thường</option>
                                            <option value="VACCINATION">Tiêm Phòng</option>
                                            <option value="FOLLOW_UP">Tái Khám</option>
                                            <option value="WALKIN">Trực Tiếp</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Ngày Hẹn *</label>
                                        <input type="date" className="input-field" name="date" value={formData.date} onChange={handleInputChange} required style={{ marginBottom: 0 }} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Giờ Hẹn *</label>
                                        <select className="input-field" name="timeSlot" value={formData.timeSlot} onChange={handleInputChange} required style={{ marginBottom: 0 }}>
                                            <option value="">-- Chọn ca --</option>
                                            <optgroup label="🌅 Ca sáng">
                                                {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </optgroup>
                                            <optgroup label="☀️ Ca chiều">
                                                {['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>



                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>Ghi chú triệu chứng</label>
                                    <textarea
                                        className="input-field"
                                        name="customerNotes"
                                        value={formData.customerNotes}
                                        onChange={handleInputChange}
                                        placeholder="Mô tả tình trạng bé..."
                                        style={{ height: '80px', resize: 'vertical', marginBottom: 0 }}
                                    />
                                </div>
                            </form>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #eef2f5', padding: '14px 20px', flexShrink: 0, background: '#f8fafc' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                Hủy
                            </button>
                            <button type="submit" form="createAppointmentForm" className="btn btn-primary" disabled={submitLoading}>
                                {submitLoading ? 'Đang lưu...' : 'Lưu Lịch Hẹn'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Hủy Lịch Hẹn */}
            {isCancelModalOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 4000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{ padding: 0, width: '90%', maxWidth: '400px', background: 'white', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2' }}>
                            <h3 style={{ margin: 0, color: '#dc2626', fontWeight: 800, fontSize: '1.1rem' }}>Hủy Lịch Hẹn</h3>
                            <button className="btn-icon" onClick={() => setIsCancelModalOpen(false)} style={{ color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Vui lòng cho biết lý do bạn muốn hủy lịch hẹn này:</p>
                            <textarea
                                className="input-field"
                                value={cancelReasonInput}
                                onChange={(e) => setCancelReasonInput(e.target.value)}
                                placeholder="Nhập lý do hủy..."
                                style={{ height: '100px', resize: 'none', marginBottom: 0 }}
                                autoFocus
                            />
                        </div>
                        <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #eef2f5', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setIsCancelModalOpen(false)}>Quay lại</button>
                            <button
                                className="btn btn-primary"
                                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                onClick={confirmCancel}
                                disabled={submitLoading}
                            >
                                {submitLoading ? 'Đang xử lý...' : 'Xác Nhận Hủy'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* === Modal Đổi Lịch Hẹn === */}
            {isRescheduleOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 4000 }}>
                    <div className="modal-container glass-card animate-slide-up" style={{
                        padding: 0, width: '90%', maxWidth: '480px',
                        background: 'white', borderRadius: '20px', overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdfc' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={18} /> Đề xuất đổi lịch hẹn
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Mã #{rescheduleForm.aptId.slice(-6).toUpperCase()} · Yêu cầu sẽ gửi đến khách, chờ xác nhận
                                </p>
                            </div>
                            <button className="btn-icon" onClick={() => setIsRescheduleOpen(false)} style={{ color: '#94a3b8' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Info banner */}
                        <div style={{ margin: '16px 24px 0', padding: '10px 14px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.8rem', color: '#92400e' }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span><strong>Lưu ý:</strong> Thay đổi này sẽ được gửi đến khách hàng để xác nhận. Lịch hẹn <strong>chỉ cập nhật sau khi khách đồng ý</strong>. Trong thời gian chờ, lịch hẹn sẽ chuyển sang trạng thái <em>"Chờ xác nhận"</em>.</span>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleRescheduleSubmit} style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Ngày hẹn mới *</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    style={{ marginBottom: 0 }}
                                    value={rescheduleForm.date}
                                    onChange={e => setRescheduleForm(p => ({ ...p, date: e.target.value }))}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Giờ hẹn mới *</label>
                                <select
                                    className="input-field"
                                    style={{ marginBottom: 0 }}
                                    value={rescheduleForm.timeSlot}
                                    onChange={e => setRescheduleForm(p => ({ ...p, timeSlot: e.target.value }))}
                                >
                                    <optgroup label="🌅 Ca sáng">
                                        {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="☀️ Ca chiều">
                                        {['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">
                                    Lý do đề xuất đổi lịch <span style={{ color: '#dc2626', fontWeight: 600 }}>* (Bắt buộc)</span>
                                </label>
                                <textarea
                                    className="input-field"
                                    style={{ height: '80px', resize: 'none', marginBottom: 0 }}
                                    placeholder="VD: Phòng khám bận đột xuất, mời khách dời sang ngày khác..."
                                    value={rescheduleForm.note}
                                    onChange={e => setRescheduleForm(p => ({ ...p, note: e.target.value }))}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #eef2f5' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsRescheduleOpen(false)}>
                                    Huỷ
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={rescheduleLoading}>
                                    {rescheduleLoading ? 'Đang gửi...' : '📤 Gửi yêu cầu đổi lịch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

        </Layout>
    );
};

export default Appointments;
