import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
    Plus as FcPlus,
    Search as FcSearch,
    BookOpen as FcReading,
    FileText as FcAnswers,
    RefreshCw as FcRefresh,
    XCircle as FcCancel,
    Stethoscope as FcInspection,
    ClipboardList as FcDataSheet,
    Stethoscope, Plus, Search, FileText,
    Dna, History, X, Check, Save,
    User, Calendar, Clock, AlertCircle,
    User as FcBusinessman,
    CheckCircle as FcAutomark,
    AlertCircle as FcVlc,
    Syringe,
    Package,
    Thermometer,
    Scale,
    Activity,
    Clipboard
} from "lucide-react";

const API = 'http://localhost:5000/api/v1';
const RECORDS_API = 'http://localhost:5000/api/v1/records';

// Debounce hook
const useDebounce = (value, delay) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};


const MedicalRecords = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]); // Ca từ lịch hẹn
    const [medicines, setMedicines] = useState([]);
    const [availableServices, setAvailableServices] = useState([]);
    const [customers, setCustomers] = useState([]); // Danh sách khách hàng gợi ý
    const [loading, setLoading] = useState(true);
    const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
    // Walk-in flow state
    const [walkInMode, setWalkInMode] = useState(false);
    const [phoneSearch, setPhoneSearch] = useState('');
    const [customerPhoneSuggestions, setCustomerPhoneSuggestions] = useState([]);
    const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
    const phoneSearchRef = useRef(null);
    const [foundCustomer, setFoundCustomer] = useState(null);
    const [customerPets, setCustomerPets] = useState([]);
    const [selectedPet, setSelectedPet] = useState(null);
    const [newCustomerForm, setNewCustomerForm] = useState({ fullName: '', phoneNumber: '', email: '' });
    const [newPetForm, setNewPetForm] = useState({ name: '', species: 'DOG', breed: '' });
    const [showNewCustomer, setShowNewCustomer] = useState(false);
    const [showNewPet, setShowNewPet] = useState(false);
    const [walkInLoading, setWalkInLoading] = useState(false);

    // Exam modal state
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [currentAppointment, setCurrentAppointment] = useState(null);
    const [currentVacAppointment, setCurrentVacAppointment] = useState(null); // Lịch hẹn tiêm phòng đang xử lý
    const [currentWalkIn, setCurrentWalkIn] = useState(null); // { customerId, petId }
    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [petHistory, setPetHistory] = useState([]);
    const [petVacHistory, setPetVacHistory] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false); // Bước xác nhận trước khi lưu

    const [recordForm, setRecordForm] = useState({
        weightAtVisit: '', temperature: '', symptoms: '',
        diagnosis: '', treatment: '', followUpDate: ''
    });
    const [selectedPetName, setSelectedPetName] = useState(''); // Tên pet cho drawer lịch sử
    const [prescriptions, setPrescriptions] = useState([]);
    const [selectedServices, setSelectedServices] = useState([]);
    const [medicineSearchTerm, setMedicineSearchTerm] = useState('');
    const [medicineSuggestions, setMedicineSuggestions] = useState([]);
    const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
    const medicineSearchRef = useRef(null);
    const [quickPetSearch, setQuickPetSearch] = useState(() => new URLSearchParams(location.search).get('search') || '');
    const [petSuggestions, setPetSuggestions] = useState([]);
    const [showPetSuggestions, setShowPetSuggestions] = useState(false);
    const petSearchRef = useRef(null);
    const debouncedPetSearch = useDebounce(quickPetSearch, 500);

    // Tab & History Lookup State
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'vaccination') return 'VACCINATION';
        if (tab === 'vac_history') return 'VAC_HISTORY';
        return 'EXAM';
    });
    const [allRecords, setAllRecords] = useState([]);
    const [allRecordsLoading, setAllRecordsLoading] = useState(false);
    const [historySearchTerm, setHistorySearchTerm] = useState(() => new URLSearchParams(location.search).get('search') || '');

    useEffect(() => {
        if (debouncedPetSearch.length >= 1) {
            axios.get(`${API}/pets?search=${debouncedPetSearch}`, { headers })
                .then(res => {
                    if (res.data.success) setPetSuggestions(res.data.data);
                })
                .catch(err => console.error('Lỗi tìm thú cưng:', err));
        } else {
            setPetSuggestions([]);
        }
    }, [debouncedPetSearch]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'vaccination') setActiveTab('VACCINATION');
        else if (tab === 'vac_history') setActiveTab('VAC_HISTORY');
        else if (tab === 'exam' || !tab) setActiveTab('EXAM');
    }, [location.search]);

    // Vaccination Specific State
    const [upcomingVaccinations, setUpcomingVaccinations] = useState([]);
    const [historyVaccinations, setHistoryVaccinations] = useState([]);
    const [showVacModal, setShowVacModal] = useState(false);
    const [vacStep, setVacStep] = useState(1);
    const [vacForm, setVacForm] = useState({
        administeredDate: new Date().toISOString().split('T')[0],
        administeredTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        medicineId: '', medicineName: '', doseNumber: 1, reminderDate: '', expiryDate: '', notes: '', reaction: ''
    });
    const [vacMedSearch, setVacMedSearch] = useState('');
    const [vacMedSuggestions, setVacMedSuggestions] = useState([]);
    const [showVacMedSuggestions, setShowVacMedSuggestions] = useState(false);
    const [showVacReviewModal, setShowVacReviewModal] = useState(false);
    const vacMedSearchRef = useRef(null);

    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const [isVacDiagnosing, setIsVacDiagnosing] = useState(false);
    const [showInventoryTable, setShowInventoryTable] = useState(false);
    const [showVacInventoryTable, setShowVacInventoryTable] = useState(false);

    const resetWalkInState = () => {
        setFoundCustomer(null);
        setSelectedPet(null);
        setCustomerPets([]);
        setPhoneSearch('');
        setShowPhoneSuggestions(false);
        setNewCustomerForm({ fullName: '', phoneNumber: '', email: '' });
        setNewPetForm({ name: '', species: 'DOG', breed: '' });
        setShowNewCustomer(false);
        setShowNewPet(false);
        setIsVacDiagnosing(false);
        setVacStep(1);
    };

    const handleRefresh = () => {
        setWalkInMode(false);
        setShowVacModal(false);
        resetWalkInState();
        setHistorySearchTerm('');
        setMedicineSearchTerm('');
        setVacMedSearch('');
        fetchData();
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [aptRes, medRes, serviceRes, upcomingRes, vHistoryRes] = await Promise.all([
                axios.get(`${API}/appointments`, { headers }),
                axios.get(`${API}/inventory/medicines`, { headers }),
                axios.get(`${API}/services`, { headers }),
                axios.get(`${API}/vaccinations/upcoming`, { headers }),
                axios.get(`${API}/vaccinations`, { headers })
            ]);

            setAppointments(aptRes.data.data.filter(a =>
                ['ARRIVED', 'IN_PROGRESS'].includes(a.status)
            ));
            if (medRes.data.success) {
                setMedicines(medRes.data.data.filter(m => m.stockQuantity > 0));
            }
            if (serviceRes.data.success) {
                setAvailableServices(serviceRes.data.data.filter(s => s.isActive));
            }
            setUpcomingVaccinations(upcomingRes.data.data || []);
            setHistoryVaccinations(vHistoryRes.data.data || []);
        } catch (err) {
            console.error('Lỗi tải dữ liệu:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredVaccinations = historyVaccinations.filter(v => {
        const search = historySearchTerm.toLowerCase();
        return (
            v.petId?.name?.toLowerCase().includes(search) ||
            v.customerId?.fullName?.toLowerCase().includes(search) ||
            v.customerId?.phoneNumber?.toLowerCase().includes(search) ||
            v.medicineId?.name?.toLowerCase().includes(search)
        );
    });

    const fetchCustomers = async () => {
        try {
            const res = await axios.get(`${API}/users?role=CUSTOMER`, { headers });
            if (res.data.success) {
                setCustomers(res.data.data);
            }
        } catch (err) {
            console.error('Lỗi tải danh sách khách hàng:', err);
        }
    };

    const fetchPetHistory = async (petId, petName = '') => {
        if (!petId) return;
        setPetHistory([]);
        setPetVacHistory([]); // Xóa dữ liệu cũ ngay lập tức
        if (petName) setSelectedPetName(petName);
        setHistoryLoading(true);
        try {
            const [recordsRes, vacsRes] = await Promise.all([
                axios.get(`${API}/records/pet/${petId}`, { headers }),
                axios.get(`${API}/vaccinations/pet/${petId}`, { headers })
            ]);

            if (recordsRes.data.success) {
                setPetHistory(recordsRes.data.data);
                if (!petName && recordsRes.data.data.length > 0) {
                    setSelectedPetName(recordsRes.data.data[0].petId?.name || 'Thú cưng');
                }
            }
            if (vacsRes.data.success) {
                setPetVacHistory(vacsRes.data.data);
            }
            setIsHistoryOpen(true);
        } catch (err) {
            console.error('Lỗi tải lịch sử:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchAllRecords = async () => {
        setAllRecordsLoading(true);
        try {
            const res = await axios.get(`${RECORDS_API}`, { headers });
            if (res.data.success) {
                setAllRecords(res.data.data);
            }
        } catch (err) {
            console.error('Lỗi tải tất cả bệnh án:', err);
        } finally {
            setAllRecordsLoading(false);
        }
    };

    // Click outside gợi ý SĐT
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (phoneSearchRef.current && !phoneSearchRef.current.contains(event.target)) {
                setShowPhoneSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const debouncedPhoneSearch = useDebounce(phoneSearch, 300);

    useEffect(() => {
        if (debouncedPhoneSearch.length < 1) {
            setCustomerPhoneSuggestions([]);
            setShowPhoneSuggestions(false);
            return;
        }
        const token = sessionStorage.getItem('token');
        axios.get(`http://localhost:5000/api/v1/users?role=CUSTOMER&search=${debouncedPhoneSearch}`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => {
            setCustomerPhoneSuggestions(r.data.data.slice(0, 50));
            setShowPhoneSuggestions(true);
        }).catch(() => {
            setCustomerPhoneSuggestions([]);
            setShowPhoneSuggestions(false);
        });
    }, [debouncedPhoneSearch]);

    // Medicine search effect (Exam)
    useEffect(() => {
        if (medicineSearchTerm.length < 1) {
            setMedicineSuggestions([]);
            setShowMedicineSuggestions(false);
            return;
        }
        const filtered = medicines.filter(m =>
            m.name.toLowerCase().includes(medicineSearchTerm.toLowerCase())
        ).slice(0, 50);
        setMedicineSuggestions(filtered);
        setShowMedicineSuggestions(true);
    }, [medicineSearchTerm, medicines]);

    // Medicine search effect (Vaccination)
    useEffect(() => {
        if (vacMedSearch.length < 1) {
            setVacMedSuggestions([]);
            setShowVacMedSuggestions(false);
            return;
        }
        const filtered = medicines.filter(m =>
            m.name.toLowerCase().includes(vacMedSearch.toLowerCase())
        ).slice(0, 50);
        setVacMedSuggestions(filtered);
        setShowVacMedSuggestions(true);
    }, [vacMedSearch, medicines]);

    // Handle click outside for medicine search
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (medicineSearchRef.current && !medicineSearchRef.current.contains(event.target)) {
                setShowMedicineSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    // Handle click outside for pet search
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (petSearchRef.current && !petSearchRef.current.contains(event.target)) {
                setShowPetSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        fetchData();
        fetchCustomers(); // Load customers for suggestions

        // Handle Deep Links (recordId or petId from URL)
        const params = new URLSearchParams(window.location.search);
        const urlPetId = params.get('petId');
        if (urlPetId) {
            fetchPetHistory(urlPetId);
        }

        const interval = setInterval(() => {
            fetchData();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Cập nhật tiêu đề tab trình duyệt khi có ca chờ
    useEffect(() => {
        const waiting = appointments.filter(a => a.status === 'ARRIVED' && a.category !== 'VACCINATION' && a.type !== 'GROOMING');
        if (waiting.length > 0) {
            document.title = `(${waiting.length}) VetCare — Có ca chờ khám!`;
        } else {
            document.title = 'VetCare — Hồ Sơ Y Tế';
        }
        return () => { document.title = 'VetCare'; };
    }, [appointments]);

    // ===== Walk-in: Tìm khách theo SĐT =====
    const fetchCustomerPets = async (customerId) => {
        try {
            const petsRes = await axios.get(`${API}/pets?ownerId=${customerId}`, { headers });
            const pets = petsRes.data.data || [];
            setCustomerPets(pets);
            if (pets.length === 1) setSelectedPet(pets[0]);
            else setSelectedPet(null); // Clear selected pet if multiple or none
        } catch (err) {
            console.error('Lỗi tải thú cưng của khách hàng:', err);
            setCustomerPets([]);
            setSelectedPet(null);
        }
    };

    const pickCustomerFromSearch = async (customer) => {
        setPhoneSearch(''); // Tự động xóa trắng ô tìm kiếm sau khi chọn
        setShowPhoneSuggestions(false);
        setFoundCustomer(customer);
        setShowNewCustomer(false); // Hide new customer form if a customer is picked
        await fetchCustomerPets(customer._id);
    };

    const handlePhoneSearch = async (val = phoneSearch) => {
        if (!val.trim()) {
            setFoundCustomer(null);
            setCustomerPets([]);
            setSelectedPet(null);
            setShowNewCustomer(false);
            return;
        }
        setWalkInLoading(true);
        setFoundCustomer(null);
        setCustomerPets([]);
        setSelectedPet(null);
        setShowNewCustomer(false);
        try {
            // Try to find in the currently loaded suggestions or by direct search
            const match = customerPhoneSuggestions.find(c => c.phoneNumber === val || c.fullName.toLowerCase().includes(val.toLowerCase()));
            if (match) {
                await pickCustomerFromSearch(match);
            } else {
                // If not found in suggestions, try a direct API call for exact match
                const res = await axios.get(`${API}/users?role=CUSTOMER&phoneNumber=${val}`, { headers });
                if (res.data.success && res.data.data.length > 0) {
                    await pickCustomerFromSearch(res.data.data[0]);
                } else {
                    setShowNewCustomer(true);
                    setNewCustomerForm(prev => ({ ...prev, phoneNumber: val }));
                }
            }
        } catch (err) {
            setShowNewCustomer(true);
            setNewCustomerForm(prev => ({ ...prev, phoneNumber: val }));
        } finally {
            setWalkInLoading(false);
        }
    };

    // ===== Walk-in: Tạo nhanh khách mới =====
    const handleQuickCreateCustomer = async () => {
        if (!newCustomerForm.fullName || !newCustomerForm.phoneNumber) return;

        // Validation SĐT Việt Nam (10 số)
        const vnf_regex = /((09|03|07|08|05)+([0-9]{8})\b)/g;
        if (!vnf_regex.test(newCustomerForm.phoneNumber)) {
            toast('Số điện thoại không đúng định dạng (phải có 10 số và đầu số hợp lệ).', 'error');
            return;
        }

        setWalkInLoading(true);
        try {
            const res = await axios.post(`${API}/users/quick-customer`, newCustomerForm, { headers });
            setFoundCustomer(res.data.data);
            setShowNewCustomer(false);
            setCustomerPets([]);
            toast('Đã tạo hồ sơ khách hàng mới!', 'success');
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi tạo khách hàng', 'error');
        } finally {
            setWalkInLoading(false);
        }
    };

    // ===== Walk-in: Tạo nhanh thú cưng mới =====
    const handleQuickCreatePet = async () => {
        if (!newPetForm.name || !foundCustomer) return;
        setWalkInLoading(true);
        try {
            const res = await axios.post(`${API}/pets`, {
                ...newPetForm,
                ownerId: foundCustomer._id
            }, { headers });
            const newPet = res.data.data;
            setCustomerPets(prev => [...prev, newPet]);
            setSelectedPet(newPet);
            setShowNewPet(false);
            setNewPetForm({ name: '', species: 'DOG', breed: '' });
            toast('Đã thêm thú cưng!', 'success');
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi tạo thú cưng', 'error');
        } finally {
            setWalkInLoading(false);
        }
    };

    // ===== Bắt đầu khám: Từ lịch hẹn =====
    const startDiagnosisFromAppointment = async (apt) => {
        if (loading || submitLoading) return; // Ngăn bấm nhiều lần

        // Xóa sạch trạng thái cũ trước khi bắt đầu ca mới
        resetForm('');
        setCurrentAppointment(null);
        setCurrentWalkIn(null);

        if (apt.status !== 'IN_PROGRESS' || !apt.staffId) {
            try {
                setSubmitLoading(true); // Dùng submitLoading làm cờ chặn
                await axios.patch(`${API}/appointments/${apt._id}/status`, {
                    status: 'IN_PROGRESS', staffId: user._id
                }, { headers });
                fetchData();
            } catch (err) {
                console.error(err);
                toast('Không thể cập nhật trạng thái lịch hẹn', 'error');
                return;
            } finally {
                setSubmitLoading(false);
            }
        }

        setCurrentAppointment(apt);
        setCurrentWalkIn(null);
        resetForm(apt.customerNotes || '');
        setIsDiagnosing(true);
    };

    // ===== Bắt đầu Tiêm Phòng: Từ lịch hẹn có category VACCINATION =====
    const startVaccinationFromAppointment = async (apt) => {
        if (loading || submitLoading) return;

        // Cập nhật trạng thái IN_PROGRESS nếu chưa
        if (apt.status !== 'IN_PROGRESS' || !apt.staffId) {
            try {
                setSubmitLoading(true);
                await axios.patch(`${API}/appointments/${apt._id}/status`, {
                    status: 'IN_PROGRESS', staffId: user._id
                }, { headers });
            } catch (err) {
                toast('Không thể cập nhật trạng thái lịch hẹn', 'error');
                return;
            } finally {
                setSubmitLoading(false);
            }
        }

        // Gán thông tin khách & thú cưng từ lịch hẹn
        const customer = apt.customerId;
        const pet = apt.petId;

        if (!customer || !pet) {
            toast('Lịch hẹn thiếu thông tin khách hàng hoặc thú cưng', 'error');
            return;
        }

        // Populate foundCustomer & selectedPet rồi mở form tiêm
        setFoundCustomer(typeof customer === 'object' ? customer : { _id: customer });
        setSelectedPet(typeof pet === 'object' ? pet : { _id: pet });
        setCurrentVacAppointment(apt); // lưu lại để patch status sau
        setActiveTab('VACCINATION');
        setWalkInMode(false);
        setVacStep(2);
        setIsVacDiagnosing(true);

        // Refresh data để cập nhật trạng thái mới
        fetchData();
    };

    // ===== Bắt đầu khám: Walk-in trực tiếp =====
    const startWalkInDiagnosis = () => {
        if (!foundCustomer || !selectedPet) {
            toast('Vui lòng chọn đủ Khách hàng và Thú cưng', 'warning');
            return;
        }
        // Xóa sạch trạng thái cũ
        resetForm('');
        setCurrentAppointment(null);

        setCurrentWalkIn({ customerId: foundCustomer._id, petId: selectedPet._id });
        setIsDiagnosing(true);
        setWalkInMode(false);
    };


    const resetForm = (notes = '') => {
        setRecordForm({ weightAtVisit: '', temperature: '', symptoms: '', diagnosis: '', treatment: notes, followUpDate: '' });
        setPrescriptions([]);
        setSelectedServices([]);
        setMedicineSearchTerm('');
        setErrorMsg('');
        setSuccessMsg('');
    };

    // Bước 1: Validate và mở modal xem lại đơn thuốc
    const handleSubmitRecord = (e) => {
        e.preventDefault();
        if (!recordForm.symptoms || !recordForm.diagnosis) {
            toast('Vui lòng điền đầy đủ Triệu chứng và Chẩn đoán.', 'error');
            return;
        }

        // Numerical validation
        if (recordForm.weightAtVisit && Number(recordForm.weightAtVisit) < 0) {
            toast('Cân nặng không được là số âm.', 'error');
            return;
        }
        if (recordForm.temperature && Number(recordForm.temperature) < 0) {
            toast('Thân nhiệt không được là số âm.', 'error');
            return;
        }

        // Follow-up date validation
        if (recordForm.followUpDate) {
            const followDate = new Date(recordForm.followUpDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (followDate < today) {
                toast('Ngày tái khám không được ở trong quá khứ.', 'error');
                return;
            }
        }

        const validPrescriptions = prescriptions.filter(p => p.medicineId && p.quantity > 0);
        if (validPrescriptions.length === 0 && selectedServices.length === 0) {
            toast('Bắt buộc phải chọn ít nhất một Dịch vụ hoặc kê đơn Thuốc để hoàn tất khám bệnh.', 'error');
            return;
        }

        setShowReviewModal(true);
    };

    // Bước 2: Thực sự gọi API sau khi bác sĩ xác nhận
    const confirmAndSubmitRecord = async () => {
        const currentToken = sessionStorage.getItem('token');
        const authHeaders = { Authorization: `Bearer ${currentToken}` };

        const validPrescriptions = prescriptions.filter(p => p.medicineId && p.quantity > 0);
        const payload = {
            ...recordForm,
            prescriptions: validPrescriptions,
            services: selectedServices.map(sId => {
                const s = availableServices.find(as => as._id === sId);
                return { serviceId: s._id, name: s.name, price: s.price };
            }),
            ...(currentAppointment
                ? { appointmentId: currentAppointment._id, petId: currentAppointment.petId?._id }
                : { customerId: currentWalkIn.customerId, petId: currentWalkIn.petId }
            )
        };

        setSubmitLoading(true);
        setErrorMsg('');
        try {
            // 1. Lưu Hồ sơ bệnh án
            const res = await axios.post(RECORDS_API, payload, { headers: authHeaders });

            if (res.data.success) {
                // 2. Kiểm tra xem có dịch vụ GROOMING nào được chọn không để đẩy qua trang Grooming
                const groomingServiceDetails = selectedServices
                    .map(sId => availableServices.find(as => as._id === sId))
                    .filter(as => as && as.type === 'GROOMING');

                if (groomingServiceDetails.length > 0) {
                    try {
                        const petInfo = currentAppointment?.petId || selectedPet;
                        const customerId = currentAppointment?.customerId?._id || currentAppointment?.customerId || currentWalkIn?.customerId;
                        const petId = petInfo?._id || petInfo?.id || petInfo;

                        await axios.post(`${API}/grooming`, {
                            customerId,
                            medicalRecordId: res.data.data._id,
                            pets: [{
                                petId,
                                name: petInfo?.name || 'Thú cưng',
                                species: petInfo?.species || 'OTHER'
                            }],
                            services: groomingServiceDetails.map(gs => ({
                                serviceId: gs._id,
                                name: gs.name,
                                price: gs.price
                            })),
                            transportType: 'DROPOFF', // Mặc định từ phòng khám chuyển qua là khách đang ở đó
                            notes: `Chuyển tiếp từ phòng khám. Bác sĩ ghi chú: ${recordForm.treatment || 'Không có'}`
                        }, { headers: authHeaders });
                        toast('Đã đẩy yêu cầu làm đẹp qua trang Grooming thành công!', 'success');
                    } catch (gErr) {
                        console.error('Lỗi tự động tạo đơn Grooming:', gErr);
                        const serverData = gErr.response?.data;
                        const serverMsg = serverData?.message || gErr.message || 'Lỗi kết nối server';
                        toast(`Hồ sơ đã lưu, nhưng không thể đẩy đơn qua Grooming: ${serverMsg}`, 'error', 12000);
                    }
                }

                setShowReviewModal(false);
                setIsDiagnosing(false);
                setCurrentAppointment(null);
                setCurrentWalkIn(null);
                setFoundCustomer(null);
                setSelectedPet(null);
                setCustomerPets([]);
                setPrescriptions([]);
                setSelectedServices([]);
                setPhoneSearch('');
                fetchData();
                toast('Phiếu khám bệnh & Đơn thuốc đã lưu thành công! Thuốc đã được xuất kho.', 'success', 6000);
            }
        } catch (err) {
            setShowReviewModal(false);
            toast(err.response?.data?.message || 'Có lỗi khi lưu Phiếu khám bệnh.', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    const addPrescriptionRow = () => setPrescriptions([{ medicineId: '', quantity: 1, dosageInstructions: '' }, ...prescriptions]);

    const quickAddMedicine = (med) => {
        // Nếu thuốc đã có trong đơn, không thêm nữa hoặc thông báo
        if (prescriptions.find(p => p.medicineId === med._id)) {
            toast(`Thuốc ${med.name} đã có trong đơn.`, 'info');
            return;
        }
        setPrescriptions([{ medicineId: med._id, medicineName: med.name, quantity: 1, dosageInstructions: '', unit: med.unit }, ...prescriptions]);
        setMedicineSearchTerm('');
        setShowMedicineSuggestions(false);
        toast(`Đã thêm ${med.name} vào phác đồ điều trị!`, 'success');
    };

    const removePrescriptionRow = (i) => setPrescriptions(prescriptions.filter((_, idx) => idx !== i));

    const toggleService = (serviceId) => {
        if (selectedServices.includes(serviceId)) {
            setSelectedServices(selectedServices.filter(id => id !== serviceId));
        } else {
            setSelectedServices([...selectedServices, serviceId]);
        }
    };
    const handlePrescriptionChange = (i, field, value) => {
        const updated = [...prescriptions];
        updated[i][field] = value;
        setPrescriptions(updated);
    };

    const handleVacAdd = (e) => {
        if (e) e.preventDefault();
        if (!selectedPet || !vacForm.medicineId) {
            toast('Vui lòng chọn thuốc vắc-xin và thú cưng.', 'warning');
            return;
        }

        // Validate dates if needed
        if (vacForm.reminderDate && new Date(vacForm.reminderDate) < new Date(vacForm.administeredDate)) {
            toast('Ngày nhắc lại không được trước ngày tiêm.', 'error');
            return;
        }

        setShowVacReviewModal(true);
    };

    const confirmAndSubmitVac = async () => {
        setSubmitLoading(true);
        try {
            const payload = {
                petId: selectedPet._id,
                customerId: foundCustomer._id,
                vaccineName: vacForm.medicineName,
                administeredDate: vacForm.administeredDate,
                administeredTime: vacForm.administeredTime,
                medicineId: vacForm.medicineId,
                doseNumber: vacForm.doseNumber,
                nextDueDate: vacForm.reminderDate,
                expiryDate: vacForm.expiryDate,
                notes: vacForm.notes,
                reaction: vacForm.reaction,
                price: (medicines.find(m => m._id === vacForm.medicineId)?.retailPrice || 0) +
                    selectedServices.reduce((sum, id) => sum + (availableServices.find(s => s._id === id)?.price || 0), 0),
                services: selectedServices.map(sId => {
                    const s = availableServices.find(as => as._id === sId);
                    return { serviceId: s._id, name: s.name, price: s.price };
                }),
                // Gắn appointmentId nếu tiêm từ lịch hẹn (để invoice tự cập nhật appointment)
                ...(currentVacAppointment?._id ? { appointmentId: currentVacAppointment._id } : {})
            };
            const res = await axios.post(`${API}/vaccinations`, payload, { headers });
            if (res.data.success) {
                const vacAptId = currentVacAppointment?._id;

                // Nếu tiêm từ lịch hẹn → chuyển appointment sang READY_FOR_PAYMENT
                if (vacAptId) {
                    try {
                        const freshToken = sessionStorage.getItem('token');
                        await axios.patch(`${API}/appointments/${vacAptId}/status`, {
                            status: 'READY_FOR_PAYMENT'
                        }, { headers: { Authorization: `Bearer ${freshToken}` } });

                        // Xóa ngay khỏi local state (optimistic) — không chờ fetchData
                        setAppointments(prev => prev.filter(a => a._id !== vacAptId));
                    } catch (e) {
                        console.warn('Không thể cập nhật trạng thái lịch hẹn:', e);
                        toast('Lưu tiêm phòng OK nhưng không cập nhật được trạng thái lịch hẹn.', 'warning');
                    }
                }

                toast('Hồ sơ tiêm phòng đã được lưu. Vui lòng thanh toán để hoàn tất trừ kho!', 'success');
                setShowVacReviewModal(false);
                setShowVacModal(false);
                setIsVacDiagnosing(false);
                setVacStep(1);
                setCurrentVacAppointment(null);
                setFoundCustomer(null);
                setSelectedPet(null);
                setVacForm({
                    administeredDate: new Date().toISOString().split('T')[0],
                    administeredTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                    medicineId: '', medicineName: '', doseNumber: 1, reminderDate: '', expiryDate: '', notes: '', reaction: ''
                });
                setVacMedSearch('');
                setSelectedServices([]);
                setPrescriptions([]);
                fetchData(); // refresh đầy đủ ở background
            }
        } catch (err) {
            toast(err.response?.data?.message || 'Lỗi khi lưu tiêm phòng', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <Layout>
            <div className="dashboard-header animate-fade-in flex-between" style={{ marginBottom: '32px', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', margin: 0 }}>Hồ Sơ Y Tế</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Quản lý bệnh án lâm sàng và lịch tiêm chủng định kỳ.</p>
                </div>

                <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '6px', borderRadius: '14px', border: '1px solid #eef2f5', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <button
                        className={`btn ${activeTab === 'EXAM' ? '' : 'btn-secondary'}`}
                        onClick={() => {
                            setActiveTab('EXAM');
                            setShowVacModal(false);
                            setVacStep(1);
                        }}
                        style={{
                            borderRadius: '10px', padding: '8px 20px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: activeTab === 'EXAM' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'EXAM' ? 'white' : 'var(--text-muted)',
                            border: 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Stethoscope size={18} /> Khám Lâm Sàng
                    </button>
                    <button
                        className={`btn ${['VACCINATION', 'VAC_HISTORY'].includes(activeTab) ? '' : 'btn-secondary'}`}
                        onClick={() => {
                            setActiveTab('VACCINATION');
                            setShowVacModal(false);
                            setVacStep(1);
                            resetWalkInState();
                        }}
                        style={{
                            borderRadius: '10px', padding: '8px 20px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: ['VACCINATION', 'VAC_HISTORY'].includes(activeTab) ? '#10b981' : 'transparent',
                            color: ['VACCINATION', 'VAC_HISTORY'].includes(activeTab) ? 'white' : 'var(--text-muted)',
                            border: 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Syringe size={18} /> Tiêm Phòng
                    </button>
                </div>
            </div>

            {activeTab === 'EXAM' && (
            <>
                {/* ⚠ Banner cảnh báo ca chờ khám (sticky, chỉ hiện với bác sĩ/admin) */}
                {['ADMIN', 'DOCTOR'].includes(user?.role) && (() => {
                    const waiting = appointments.filter(a => a.status === 'ARRIVED' && a.category !== 'VACCINATION' && a.type !== 'GROOMING');
                    if (waiting.length === 0) return null;
                    return (
                        <div style={{
                            position: 'sticky', top: 0, zIndex: 95,
                            marginBottom: '18px',
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
                            border: '2px solid #fb923c',
                            borderRadius: '14px',
                            display: 'flex', alignItems: 'center', gap: '14px',
                            boxShadow: '0 4px 20px rgba(251,146,60,0.2)',
                            animation: 'waitingAlert 2s ease-in-out infinite',
                        }}>
                            <div style={{
                                width: '36px', height: '36px', flexShrink: 0,
                                borderRadius: '50%', background: '#fed7aa',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: 'badgePulse 1.2s ease-in-out infinite'
                            }}>
                                <AlertCircle size={18} color="#c2410c" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: '#9a3412', fontSize: '0.95rem' }}>
                                    Có <span style={{ fontSize: '1.15rem' }}>{waiting.length}</span> bệnh nhân đang chờ khám!
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#c2410c', marginTop: '2px' }}>
                                    {waiting.map(a => a.petId?.name).filter(Boolean).join(', ')}
                                </div>
                            </div>
                            <button
                                onClick={() => document.getElementById('waiting-list-anchor')?.scrollIntoView({ behavior: 'smooth' })}
                                style={{ padding: '7px 16px', borderRadius: '10px', border: 'none', background: '#c2410c', color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                            >
                                Xem ngay
                            </button>
                        </div>
                    );
                })()}

                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes waitingAlert {
                        0%, 100% { border-color: #fb923c; box-shadow: 0 4px 20px rgba(251,146,60,0.2); }
                        50% { border-color: #ef4444; box-shadow: 0 4px 28px rgba(239,68,68,0.35); }
                    }
                `}} />

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                padding: '10px 20px'
                            }}
                            onClick={() => setWalkInMode(true)}
                        >
                            <FcPlus size={20} /> TIẾP NHẬN TRỰC TIẾP
                        </button>

                        {/* Thanh tra cứu bệnh án nhanh cho Bác sĩ */}
                        <div style={{ flex: 1, minWidth: '300px', position: 'relative' }} ref={petSearchRef}>
                            <div className="input-with-icon" style={{ marginBottom: 0 }}>
                                <FcSearch size={18} className="input-icon" />
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Tra cứu lịch sử bé (Tên bé, Giống...)"
                                    style={{ marginBottom: 0, background: 'white', border: '2px solid #eef2f5' }}
                                    value={quickPetSearch}
                                    onChange={(e) => {
                                        setQuickPetSearch(e.target.value);
                                        if (e.target.value.length >= 1) setShowPetSuggestions(true);
                                    }}
                                    onFocus={() => {
                                        if (quickPetSearch.length >= 1) setShowPetSuggestions(true);
                                    }}
                                />
                            </div>

                            {showPetSuggestions && petSuggestions.length > 0 && (
                                <div className="custom-scrollbar" style={{
                                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000,
                                    maxHeight: '350px', overflowY: 'auto'
                                }}>
                                    {petSuggestions.map(pet => (
                                        <div
                                            key={pet._id}
                                            onClick={() => {
                                                fetchPetHistory(pet._id, pet.name);
                                                setShowPetSuggestions(false);
                                                setQuickPetSearch('');
                                            }}
                                            style={{
                                                padding: '12px 16px', borderBottom: '1px solid #f8fafc',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
                                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '10px',
                                                background: pet.species === 'DOG' ? '#eff6ff' : pet.species === 'CAT' ? '#fdf2f8' : '#f0fdf4',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                                            }}>
                                                {pet.species === 'DOG' ? '🐶' : pet.species === 'CAT' ? '🐱' : '🐾'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{pet.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {pet.breed || 'Chưa rõ giống'} • Chủ: {pet.ownerId?.fullName}
                                                </div>
                                            </div>
                                            <History size={16} color="var(--primary)" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0' }} onClick={handleRefresh}>
                            <FcRefresh size={18} /> LÀM MỚI
                        </button>
                    </div>

                    {/* Walk-in Panel */}
                    {walkInMode && (
                        <div className="glass-card animate-slide-up" style={{ marginBottom: '28px', padding: '28px', border: '2px solid #6366f1', overflow: 'visible', position: 'relative', zIndex: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
                                    <FcPlus size={24} />
                                    TIẾP NHẬN KHÁCH TRỰC TIẾP (WALK-IN)
                                </h3>
                                <button className="btn-icon" onClick={() => {
                                    setWalkInMode(false);
                                    resetWalkInState();
                                }} style={{ background: '#f1f5f9', borderRadius: '50%', padding: '4px' }}>
                                    <FcCancel size={20} />
                                </button>
                            </div>

                            {/* Bước 1: Tìm khách */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>1. Tìm khách theo Số Điện Thoại</label>
                                <div className="input-with-icon" style={{ position: 'relative', zIndex: 100 }} ref={phoneSearchRef}>
                                    <Search size={18} className="input-icon" />
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Tìm khách (SĐT hoặc tên)..."
                                        style={{ marginBottom: 0 }}
                                        value={phoneSearch}
                                        onChange={(e) => {
                                            setPhoneSearch(e.target.value);
                                            if (e.target.value.length < 1) setShowPhoneSuggestions(false);
                                        }}
                                        onFocus={() => {
                                            if (phoneSearch.length >= 1) setShowPhoneSuggestions(true);
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handlePhoneSearch()}
                                        autoComplete="off"
                                    />

                                    {/* Premium Suggestion Dropdown */}
                                    {showPhoneSuggestions && (
                                        <div className="custom-scrollbar" style={{
                                            position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                                            background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 9999,
                                            maxHeight: '300px', overflowY: 'auto', overflowX: 'hidden'
                                        }}>
                                            {customerPhoneSuggestions.length > 0 ? (
                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                    {customerPhoneSuggestions.map(c => (
                                                        <li key={c._id}
                                                            onClick={() => pickCustomerFromSearch(c)}
                                                            style={{
                                                                padding: '10px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: '12px', transition: '0.2s'
                                                            }}
                                                            onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
                                                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                                                        >
                                                            <div style={{
                                                                width: '36px', height: '36px', borderRadius: '50%',
                                                                background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                                                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                                            }}>
                                                                {c.fullName?.[0]?.toUpperCase()}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.fullName}</div>
                                                                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{c.phoneNumber}</div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '12px' }}>Không tìm thấy khách hàng</p>
                                                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 16px' }} onClick={() => { setShowNewCustomer(true); setShowPhoneSuggestions(false); }}>
                                                        <FcPlus size={16} /> TẠO KHÁCH MỚI
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Form tạo nhanh khách mới */}
                            {showNewCustomer && (
                                <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#f0f9ff', border: '1.5px dashed #6366f1', marginBottom: '20px' }}>
                                    <div style={{ fontWeight: 700, marginBottom: '16px', color: '#4f46e5', fontSize: '0.9rem', textTransform: 'uppercase' }}>Tạo Hồ Sơ Khách Hàng Mới</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                                        <input type="text" className="input-field" placeholder="Họ và tên *" value={newCustomerForm.fullName} onChange={e => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })} style={{ background: 'white' }} />
                                        <input type="text" className="input-field" placeholder="Số điện thoại *" value={newCustomerForm.phoneNumber} onChange={e => setNewCustomerForm({ ...newCustomerForm, phoneNumber: e.target.value })} style={{ background: 'white' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="btn btn-primary" style={{ flex: 1, background: '#4f46e5' }} onClick={handleQuickCreateCustomer} disabled={walkInLoading}>
                                            {walkInLoading ? 'Đang tạo...' : 'Lưu & Chọn Khách'}
                                        </button>
                                        <button className="btn" style={{ flex: 1, background: 'white' }} onClick={() => setShowNewCustomer(false)}>Hủy</button>
                                    </div>
                                </div>
                            )}

                            {/* Bước 2: Chọn thú cưng */}
                            {foundCustomer && (
                                <div className="animate-fade-in" style={{ marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}>Khách hàng: <strong>{foundCustomer.fullName}</strong> — {foundCustomer.phoneNumber}</p>
                                        <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#f1f5f9' }} onClick={() => { setFoundCustomer(null); setCustomerPets([]); setSelectedPet(null); }}>Thay đổi</button>
                                    </div>

                                    <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>2. Chọn Thú Cưng</label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                        {customerPets.map(pet => (
                                            <button
                                                key={pet._id}
                                                className="btn"
                                                style={{
                                                    padding: '8px 16px',
                                                    background: selectedPet?._id === pet._id ? 'var(--primary)' : 'white',
                                                    color: selectedPet?._id === pet._id ? 'white' : 'var(--text-main)',
                                                    border: `1px solid ${selectedPet?._id === pet._id ? 'var(--primary)' : '#e2e8f0'}`,
                                                    fontWeight: 600
                                                }}
                                                onClick={() => setSelectedPet(pet)}
                                            >
                                                {pet.species === 'DOG' ? '🐶' : pet.species === 'CAT' ? '🐱' : '🐾'} {pet.name}
                                            </button>
                                        ))}
                                        <button className="btn" style={{ border: '1px dashed var(--primary)', color: 'var(--primary)', background: 'white', fontWeight: 600 }} onClick={() => setShowNewPet(true)}>
                                            <FcPlus size={16} /> Thêm bé
                                        </button>
                                    </div>

                                    {/* Form tạo nhanh pet mới */}
                                    {showNewPet && (
                                        <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#f5f3ff', border: '1.5px dashed #8b5cf6', marginTop: '10px', marginBottom: '20px' }}>
                                            <div style={{ fontWeight: 700, marginBottom: '12px', color: '#7c3aed', fontSize: '0.85rem' }}>Thêm Thú Cưng Mới cho {foundCustomer.fullName}</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                                <input type="text" className="input-field" placeholder="Tên bé *" value={newPetForm.name} onChange={e => setNewPetForm({ ...newPetForm, name: e.target.value })} style={{ background: 'white' }} />
                                                <select className="input-field" value={newPetForm.species} onChange={e => setNewPetForm({ ...newPetForm, species: e.target.value })} style={{ background: 'white' }}>
                                                    <option value="DOG">Chó 🐶</option>
                                                    <option value="CAT">Mèo 🐱</option>
                                                    <option value="OTHER">Khác 🐾</option>
                                                </select>
                                                <input type="text" className="input-field" placeholder="Giống" value={newPetForm.breed} onChange={e => setNewPetForm({ ...newPetForm, breed: e.target.value })} style={{ background: 'white' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-primary" style={{ flex: 1, background: '#8b5cf6', border: 'none' }} onClick={handleQuickCreatePet} disabled={walkInLoading}>
                                                    {walkInLoading ? 'Đang lưu...' : 'Lưu & Chọn Bé'}
                                                </button>
                                                <button className="btn" style={{ flex: 1, background: 'white' }} onClick={() => setShowNewPet(false)}>Hủy</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Nút bắt đầu khám */}
                            {foundCustomer && selectedPet && (
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', fontSize: '1.1rem', padding: '14px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 6px 20px rgba(79, 70, 229, 0.4)' }}
                                    onClick={startWalkInDiagnosis}
                                >
                                    <FcInspection size={24} />
                                    BẮT ĐẦU KHÁM — {foundCustomer?.fullName} / {selectedPet?.name}
                                </button>
                            )}

                        </div>
                    )}

                    {/* Danh sách phòng chờ */}
                    <h3 id="waiting-list-anchor" style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FcDataSheet size={28} />
                        DANH SÁCH CHỜ KHÁM ({appointments.filter(a => a.category !== 'VACCINATION' && a.type !== 'GROOMING').length})
                    </h3>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang quét danh sách bệnh nhân...</div>
                    ) : appointments.filter(a => a.category !== 'VACCINATION' && a.type !== 'GROOMING').length === 0 ? (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', borderRadius: '24px' }}>
                            <FcVlc size={64} style={{ marginBottom: '16px', opacity: 0.6 }} />
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Hiện tại chưa có bé nào đang chờ khám.</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Khách vào thẳng? Dùng nút <strong>"Tiếp Nhận Trực Tiếp"</strong> ở trên.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }} className="animate-slide-up">
                            {appointments.filter(a => a.category !== 'VACCINATION' && a.type !== 'GROOMING').map((apt) => (
                                <div key={apt._id} className="glass-card" style={{ padding: '20px', borderLeft: `4px solid ${apt.isEmergency ? 'var(--danger)' : apt.status === 'IN_PROGRESS' ? 'var(--primary)' : '#d97706'}`, position: 'relative' }}>
                                    {apt.isEmergency && (
                                        <span style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, animation: 'pulseGlow 1.5s infinite' }}>CẤP CỨU</span>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {apt.petId?.name || 'Thú cưng'} {apt.petId?.species === 'DOG' ? '🐶' : apt.petId?.species === 'CAT' ? '🐱' : ''}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        fetchPetHistory(apt.petId?._id, apt.petId?.name);
                                                    }}
                                                    style={{
                                                        background: 'none', border: 'none', color: 'var(--primary)',
                                                        cursor: 'pointer', padding: '2px', display: 'flex',
                                                        alignItems: 'center', borderRadius: '4px', transition: 'background 0.2s'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                                                    title="Xem nhanh lịch sử bệnh án"
                                                >
                                                    <History size={16} />
                                                </button>
                                            </h4>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Chủ nuôi: <strong>{apt.customerId?.fullName || 'Khách vãng lai'}</strong> — {apt.customerId?.phoneNumber || 'Không có SĐT'}
                                            </p>
                                        </div>
                                        <span style={{ background: apt.status === 'IN_PROGRESS' ? '#d1fae5' : '#fef3c7', color: apt.status === 'IN_PROGRESS' ? '#059669' : '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {apt.status === 'IN_PROGRESS' ? 'Đang Khám' : 'Chờ Khám'}
                                        </span>
                                    </div>

                                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                                        <div><strong>Giờ:</strong> {new Date(apt.date).toLocaleDateString('vi-VN')} • {apt.timeSlot}</div>
                                        {apt.customerNotes && <div style={{ marginTop: '4px', color: '#dc2626' }}><strong>Ghi chú:</strong> {apt.customerNotes}</div>}
                                        {apt.staffId && (
                                            <div style={{ marginTop: '8px', padding: '3px 8px', background: apt.staffId?._id === user._id ? '#ecfdf5' : '#fef2f2', color: apt.staffId?._id === user._id ? '#059669' : '#dc2626', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <div className="flex-y-center" style={{ gap: '8px', color: 'var(--primary)', fontWeight: 600 }}>
                                                    <Stethoscope size={16} />
                                                    {apt.staffId?._id === user._id ? 'Bạn đang phụ trách' : `BS ${apt.staffId.fullName} đang khám`}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {user.role !== 'RECEPTIONIST' && (
                                        <button
                                            className="btn btn-primary"
                                            style={{
                                                width: '100%',
                                                background: apt.status === 'IN_PROGRESS' && apt.staffId?._id !== user._id ? '#cbd5e1' : 'var(--primary)',
                                                cursor: apt.status === 'IN_PROGRESS' && apt.staffId?._id !== user._id ? 'not-allowed' : 'pointer'
                                            }}
                                            onClick={() => startDiagnosisFromAppointment(apt)}
                                            disabled={apt.status === 'IN_PROGRESS' && apt.staffId?._id !== user._id}
                                        >
                                            BẮT ĐẦU KHÁM
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {['VACCINATION', 'VAC_HISTORY'].includes(activeTab) && (
                <>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {user.role !== 'RECEPTIONIST' && (
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowVacModal(!showVacModal)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: showVacModal ? '#059669' : 'linear-gradient(135deg, #10b981, #059669)',
                                    border: 'none',
                                    boxShadow: showVacModal ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <FcPlus size={20} /> TIẾP NHẬN TIÊM PHÒNG
                            </button>
                        )}

                        <button
                            className="btn"
                            onClick={() => setActiveTab(activeTab === 'VAC_HISTORY' ? 'VACCINATION' : 'VAC_HISTORY')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: activeTab === 'VAC_HISTORY' ? '#10b981' : 'white',
                                color: activeTab === 'VAC_HISTORY' ? 'white' : '#059669',
                                border: '1px solid #10b981',
                                fontWeight: 700
                            }}
                        >
                            <History size={18} /> LỊCH SỬ TIÊM
                        </button>

                        <button className="btn" style={{ background: 'white', border: '1px solid #e2e8f0', marginLeft: 'auto' }} onClick={handleRefresh}>
                            <FcRefresh size={18} /> LÀM MỚI
                        </button>
                    </div>

                    {/* Tiếp nhận tiêm phòng Panel (Inline) - Giống Walk-in của Khám Lâm Sàng */}
                    {showVacModal && (
                        <div className="glass-card animate-slide-up" style={{ marginBottom: '28px', padding: '28px', border: '2px solid #10b981', overflow: 'visible', position: 'relative', zIndex: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, color: '#059669', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
                                    <FcPlus size={24} />
                                    TIẾP NHẬN TIÊM PHÒNG (TRỰC TIẾP)
                                </h3>
                                <button className="btn-icon" onClick={() => {
                                    setShowVacModal(false);
                                    setVacStep(1);
                                    resetWalkInState();
                                }} style={{ background: '#f1f5f9', borderRadius: '50%', padding: '4px' }}>
                                    <FcCancel size={20} />
                                </button>
                            </div>

                            {vacStep === 1 && (
                                <div className="animate-fade-in">
                                    <h4 style={{ marginBottom: '16px' }}>1. Tìm Khách Hàng & Thú Cưng</h4>
                                    <div className="input-with-icon" style={{ position: 'relative' }} ref={phoneSearchRef}>
                                        <Search size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="SĐT hoặc tên khách..."
                                            value={phoneSearch}
                                            onChange={(e) => {
                                                setPhoneSearch(e.target.value);
                                                if (e.target.value.length < 1) setShowPhoneSuggestions(false);
                                            }}
                                            onFocus={() => { if (phoneSearch.length >= 1) setShowPhoneSuggestions(true); }}
                                            onKeyDown={e => e.key === 'Enter' && handlePhoneSearch()}
                                            autoComplete="off"
                                        />
                                        {showPhoneSuggestions && (
                                            <div className="custom-scrollbar" style={{
                                                position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                                                background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 9999,
                                                maxHeight: '300px', overflowY: 'auto', overflowX: 'hidden'
                                            }}>
                                                {customerPhoneSuggestions.length > 0 ? (
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                        {customerPhoneSuggestions.map(c => (
                                                            <li key={c._id}
                                                                onClick={() => pickCustomerFromSearch(c)}
                                                                style={{
                                                                    padding: '10px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', gap: '12px', transition: '0.2s'
                                                                }}
                                                                onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
                                                                onMouseOut={e => e.currentTarget.style.background = 'white'}
                                                            >
                                                                <div style={{
                                                                    width: '36px', height: '36px', borderRadius: '50%',
                                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                                    color: 'white', display: 'flex', alignItems: 'center',
                                                                    justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem'
                                                                }}>
                                                                    {c.fullName?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{c.fullName}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{c.phoneNumber}</div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>Không tìm thấy khách hàng.</p>
                                                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 16px', background: '#10b981' }} onClick={() => { setShowNewCustomer(true); setShowPhoneSuggestions(false); }}>
                                                            <FcPlus size={16} /> TẠO KHÁCH MỚI
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Form tạo nhanh khách mới cho Vaccination */}
                                    {showNewCustomer && (
                                        <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#ecfdf5', border: '1.5px dashed #10b981', marginBottom: '20px' }}>
                                            <div style={{ fontWeight: 700, marginBottom: '16px', color: '#059669', fontSize: '0.9rem', textTransform: 'uppercase' }}>Tạo Hồ Sơ Khách Hàng Mới (Tiêm Phòng)</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                                                <input type="text" className="input-field" placeholder="Họ và tên *" value={newCustomerForm.fullName} onChange={e => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })} style={{ background: 'white' }} />
                                                <input type="text" className="input-field" placeholder="Số điện thoại *" value={newCustomerForm.phoneNumber} onChange={e => setNewCustomerForm({ ...newCustomerForm, phoneNumber: e.target.value })} style={{ background: 'white' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button className="btn btn-primary" style={{ flex: 1, background: '#059669' }} onClick={handleQuickCreateCustomer} disabled={walkInLoading}>
                                                    {walkInLoading ? 'Đang tạo...' : 'Lưu & Chọn Khách'}
                                                </button>
                                                <button className="btn" style={{ flex: 1, background: 'white' }} onClick={() => setShowNewCustomer(false)}>Hủy</button>
                                            </div>
                                        </div>
                                    )}

                                    {foundCustomer && (
                                        <div style={{ marginTop: '20px' }} className="animate-fade-in">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <p style={{ margin: 0, fontSize: '0.95rem' }}>Khách hàng: <strong>{foundCustomer.fullName}</strong> — {foundCustomer.phoneNumber}</p>
                                                <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#f1f5f9' }} onClick={() => { setFoundCustomer(null); setCustomerPets([]); setSelectedPet(null); }}>Thay đổi</button>
                                            </div>

                                            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>2. Chọn Thú Cưng</label>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                {customerPets.map(p => (
                                                    <button
                                                        key={p._id}
                                                        className="btn"
                                                        onClick={() => setSelectedPet(p)}
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: selectedPet?._id === p._id ? '#10b981' : 'white',
                                                            color: selectedPet?._id === p._id ? 'white' : 'var(--text-main)',
                                                            border: `1px solid ${selectedPet?._id === p._id ? '#10b981' : '#e2e8f0'}`,
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {p.species === 'DOG' ? '🐶' : p.species === 'CAT' ? '🐱' : '🐾'} {p.name}
                                                    </button>
                                                ))}
                                                <button className="btn" style={{ border: '1px dashed #10b981', color: '#10b981', background: 'white', fontWeight: 600 }} onClick={() => setShowNewPet(true)}>
                                                    <FcPlus size={16} /> Thêm bé
                                                </button>
                                            </div>

                                            {/* Form tạo nhanh pet mới cho Vaccination */}
                                            {showNewPet && (
                                                <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#ecfdf5', border: '1.5px dashed #059669', marginTop: '10px', marginBottom: '20px' }}>
                                                    <div style={{ fontWeight: 700, marginBottom: '12px', color: '#059669', fontSize: '0.85rem' }}>Thêm Thú Cưng Mới cho {foundCustomer.fullName}</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                                        <input type="text" className="input-field" placeholder="Tên bé *" value={newPetForm.name} onChange={e => setNewPetForm({ ...newPetForm, name: e.target.value })} style={{ background: 'white' }} />
                                                        <select className="input-field" value={newPetForm.species} onChange={e => setNewPetForm({ ...newPetForm, species: e.target.value })} style={{ background: 'white' }}>
                                                            <option value="DOG">Chó 🐶</option>
                                                            <option value="CAT">Mèo 🐱</option>
                                                            <option value="OTHER">Khác 🐾</option>
                                                        </select>
                                                        <input type="text" className="input-field" placeholder="Giống" value={newPetForm.breed} onChange={e => setNewPetForm({ ...newPetForm, breed: e.target.value })} style={{ background: 'white' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn btn-primary" style={{ flex: 1, background: '#059669', border: 'none' }} onClick={handleQuickCreatePet} disabled={walkInLoading}>
                                                            {walkInLoading ? 'Đang lưu...' : 'Lưu & Chọn Bé'}
                                                        </button>
                                                        <button className="btn" style={{ flex: 1, background: 'white' }} onClick={() => setShowNewPet(false)}>Hủy</button>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedPet && (
                                                <button className="btn btn-primary" style={{ width: '100%', marginTop: '24px', background: '#10b981' }} onClick={() => {
                                                    setVacStep(2);
                                                    setIsVacDiagnosing(true);
                                                }}>BẮT ĐẦU TIÊM PHÒNG — {selectedPet?.name}</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 2 & 3 now handled in the Modal */}
                        </div>
                    )}

                    {/* Content Section: Upcoming or History */}
                    {activeTab === 'VACCINATION' ? (
                        <>
                            {/* Danh sách chờ tiêm (từ lịch hẹn ARRIVED/IN_PROGRESS có category VACCINATION) */}
                            {appointments.filter(a => a.category === 'VACCINATION').length > 0 && (
                                <>
                                    <h3 style={{ fontSize: '1.1rem', color: '#059669', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Syringe size={20} /> CHỜ TIÊM PHÒNG ({appointments.filter(a => a.category === 'VACCINATION').length})
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                                        {appointments.filter(a => a.category === 'VACCINATION').map(apt => (
                                            <div key={apt._id} className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{apt.petId?.name}</span>
                                                    <span style={{ background: apt.status === 'IN_PROGRESS' ? '#d1fae5' : '#fef3c7', color: apt.status === 'IN_PROGRESS' ? '#059669' : '#d97706', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                                                        {apt.status === 'IN_PROGRESS' ? 'Đang tiêm' : 'Chờ tiêm'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '10px' }}>
                                                    Chủ: <strong>{apt.customerId?.fullName}</strong> — {apt.customerId?.phoneNumber}<br />
                                                    Giờ: {new Date(apt.date).toLocaleDateString('vi-VN')} · {apt.timeSlot}
                                                </div>
                                                {user.role !== 'RECEPTIONIST' && (
                                                    <button className="btn btn-primary" style={{ width: '100%', background: '#10b981', border: 'none', fontSize: '0.85rem', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                        onClick={() => startVaccinationFromAppointment(apt)}>
                                                        <Syringe size={14} /> Bắt đầu tiêm cho {apt.petId?.name}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '20px' }}>
                                LỊCH NHẮC TIÊM TRONG TUẦN ({upcomingVaccinations.length})
                            </h3>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải lịch nhắc tiêm...</div>
                            ) : upcomingVaccinations.length === 0 ? (
                                <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                    <p>Không có lịch nhắc tiêm nào trong tuần tới.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                    {upcomingVaccinations.map(v => (
                                        <div key={v._id} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #ef4444' }}>
                                            <div style={{ fontWeight: 700 }}>{v.petId?.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{v.customerId?.fullName} — {v.customerId?.phoneNumber}</div>
                                            <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                                                Vắc-xin: <strong>{v.medicineId?.name}</strong><br />
                                                Ngày nhắc: <span style={{ color: '#ef4444', fontWeight: 700 }}>{new Date(v.reminderDate).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
                                <div className="input-with-icon" style={{ flex: 1 }}>
                                    <Search size={18} className="input-icon" />
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Tra cứu lịch sử (Tên bé, Tên chủ, SĐT...)"
                                        style={{ marginBottom: 0 }}
                                        value={historySearchTerm}
                                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginBottom: '20px' }}>
                                TOÀN BỘ LỊCH SỬ TIÊM PHÒNG ({filteredVaccinations.length})
                            </h3>

                            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {filteredVaccinations.length === 0 ? (
                                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <p>Không tìm thấy dữ liệu tiêm chủng nào khớp với tìm kiếm.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="premium-table">
                                            <thead>
                                                <tr>
                                                    <th>Ngày Tiêm</th>
                                                    <th>Người thực hiện</th>
                                                    <th>Bệnh Nhân / Chủ Nuôi</th>
                                                    <th>Vắc-xin & Mũi</th>
                                                    <th>Ngày Nhắc</th>
                                                    <th>Ghi Chú</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredVaccinations.map(v => (
                                                    <tr key={v._id}>
                                                        <td style={{ whiteSpace: 'nowrap' }}>
                                                            <div style={{ fontWeight: 600 }}>{new Date(v.administeredDate).toLocaleDateString('vi-VN')}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.administeredTime || '--:--'}</div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <User size={14} style={{ color: 'var(--primary)' }} />
                                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v.doctorId?.fullName || 'BS Trực'}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{v.petId?.name}</div>
                                                            <div style={{ fontSize: '0.85rem' }}>{v.customerId?.fullName} — {v.customerId?.phoneNumber}</div>
                                                        </td>
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{v.medicineId?.name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>Mũi {v.doseNumber}</div>
                                                        </td>
                                                        <td>
                                                            {v.nextDueDate || v.reminderDate ? (
                                                                <div style={{ color: '#dc2626', fontWeight: 600 }}>{new Date(v.nextDueDate || v.reminderDate).toLocaleDateString('vi-VN')}</div>
                                                            ) : '--'}
                                                        </td>
                                                        <td>
                                                            <div style={{ fontSize: '0.85rem' }}>{v.notes || '--'}</div>
                                                            {v.reaction && <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '2px' }}>⚠️ {v.reaction}</div>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}


            {/* Modal Chuẩn Đoán & Kê Đơn */}
            {isDiagnosing && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card animate-slide-up" style={{ background: 'white', padding: 0, display: 'flex', flexDirection: 'column', width: '95%', maxWidth: '1000px', maxHeight: '95vh', overflow: 'hidden' }}>

                        <div style={{ padding: '20px 32px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                EXAM: [PHIẾU KHÁM BỆNH]
                                {currentWalkIn && <span style={{ background: '#6366f1', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>Walk-in</span>}
                            </h3>
                            <button className="btn-icon" onClick={() => {
                                setIsDiagnosing(false);
                                setCurrentAppointment(null);
                                setCurrentWalkIn(null);
                                resetForm('');
                            }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ overflowY: 'auto', padding: '24px 32px' }}>
                            <form id="medicalRecordForm" onSubmit={handleSubmitRecord}>
                                {errorMsg && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>{errorMsg}</div>}

                                {/* Thẻ thông tin */}
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ flex: 1, background: 'var(--primary-glow)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--primary-light)' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Thú Cưng</div>
                                        <h2 style={{ margin: 0 }}>{currentAppointment?.petId?.name || selectedPet?.name}</h2>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                {(currentAppointment?.petId?.species || selectedPet?.species)} • {currentAppointment?.petId?.breed || selectedPet?.breed || 'Chưa rõ giống'}
                                            </p>
                                            <button
                                                type="button"
                                                className="btn"
                                                style={{
                                                    padding: '6px 14px',
                                                    fontSize: '0.85rem',
                                                    background: 'var(--primary-glow)',
                                                    border: '1.5px solid var(--primary)',
                                                    color: 'var(--primary)',
                                                    borderRadius: '10px',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.1)',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={e => {
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(99, 102, 241, 0.15)';
                                                }}
                                                onMouseOut={e => {
                                                    e.currentTarget.style.transform = 'none';
                                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.1)';
                                                }}
                                                onClick={() => fetchPetHistory(currentAppointment?.petId?._id || selectedPet?._id, currentAppointment?.petId?.name || selectedPet?.name)}
                                            >
                                                <History size={16} /> XEM LỊCH SỬ BỆNH ÁN
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, background: '#f8fafc', padding: '16px 24px', borderRadius: '12px', border: '1px solid #eef2f5' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Chủ Nuôi</div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                                            {currentAppointment?.customerId?.fullName || foundCustomer?.fullName}
                                        </h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            {currentAppointment?.customerId?.phoneNumber || foundCustomer?.phoneNumber}
                                            {currentAppointment && ` • ${new Date(currentAppointment.date).toLocaleDateString('vi-VN')} ${currentAppointment.timeSlot}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '32px' }}>
                                    {/* Cột trái: Khám bệnh */}
                                    <div>
                                        <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #eef2f5', paddingBottom: '8px' }}>
                                            Kết Quả Chuẩn Đoán
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '16px', marginBottom: '20px' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 500 }}>Cân Nặng (kg)</label>
                                                <input type="number" step="0.1" className="input-field" name="weightAtVisit" value={recordForm.weightAtVisit} onChange={e => setRecordForm(p => ({ ...p, weightAtVisit: e.target.value }))} placeholder="VD: 5.2" style={{ background: '#f8fafc' }} />
                                            </div>
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 500 }}>Thân Nhiệt (°C)</label>
                                                <input type="number" step="0.1" className="input-field" name="temperature" value={recordForm.temperature} onChange={e => setRecordForm(p => ({ ...p, temperature: e.target.value }))} placeholder="VD: 38.5" style={{ background: '#f8fafc' }} />
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#dc2626' }}>Triệu Chứng *</label>
                                            <textarea className="input-field" name="symptoms" value={recordForm.symptoms} onChange={e => setRecordForm(p => ({ ...p, symptoms: e.target.value }))} required placeholder="Biếng ăn, nôn mửa, lờ đờ..." style={{ minHeight: '80px', resize: 'vertical' }}></textarea>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>Chuẩn Đoán Cuối *</label>
                                            <textarea className="input-field" name="diagnosis" value={recordForm.diagnosis} onChange={e => setRecordForm(p => ({ ...p, diagnosis: e.target.value }))} required placeholder="Tên bệnh lý sau khám lâm sàng..." style={{ minHeight: '80px', resize: 'vertical', background: '#f0fdf4', borderColor: '#bbf7d0' }}></textarea>
                                        </div>

                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 500 }}>Ngày Tái Khám</label>
                                            <input type="date" className="input-field" name="followUpDate" value={recordForm.followUpDate} onChange={e => setRecordForm(p => ({ ...p, followUpDate: e.target.value }))} style={{ width: '200px' }} />
                                        </div>

                                        <div className="form-group" style={{ marginTop: '16px' }}>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 500 }}>Ghi Chú</label>
                                            <input type="text" className="input-field" name="treatment" value={recordForm.treatment} onChange={e => setRecordForm(p => ({ ...p, treatment: e.target.value }))} placeholder="Lưu ý, chỉ định thêm..." style={{ background: '#f8fafc' }} />
                                        </div>
                                    </div>

                                    {/* Cột phải: Toa thuốc & Dịch vụ */}
                                    <div className="md-border-left" style={{ paddingLeft: '0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #eef2f5', paddingBottom: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                                                Toa Thuốc Xuất Kho
                                            </h4>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="button" className="btn"
                                                    style={{ fontSize: '0.8rem', padding: '6px 12px', background: showInventoryTable ? '#64748b' : '#3b82f6', color: 'white', border: 'none' }}
                                                    onClick={() => setShowInventoryTable(!showInventoryTable)}
                                                >
                                                    {showInventoryTable ? 'Đóng Bảng Kho' : 'Bảng Kho'}
                                                </button>
                                                <button type="button" className="btn" style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)' }} onClick={addPrescriptionRow}>+ Thêm Thuốc</button>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '16px', position: 'relative' }} ref={medicineSearchRef}>
                                            {showInventoryTable && (
                                                <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', maxHeight: '350px', overflowY: 'auto', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Chọn thuốc từ kho (Thủ công)</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{medicines.length} sản phẩm</div>
                                                    </div>
                                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                                                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                                                                <th style={{ padding: '10px 8px' }}>Tên thuốc</th>
                                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Tồn</th>
                                                                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Giá</th>
                                                                <th style={{ padding: '10px 8px' }}></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {medicines.map(m => {
                                                                const isAdded = prescriptions.some(p => p.medicineId === m._id);
                                                                return (
                                                                    <tr key={m._id} style={{ borderBottom: '1px solid #e2e8f0' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{m.name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.75rem' }}>({m.unit})</span></td>
                                                                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                                            <span style={{
                                                                                background: m.stockQuantity < 10 ? '#fef2f2' : '#f0fdf4',
                                                                                color: m.stockQuantity < 10 ? '#ef4444' : '#10b981',
                                                                                padding: '2px 8px', borderRadius: '6px', fontWeight: 700
                                                                            }}>{m.stockQuantity}</span>
                                                                        </td>
                                                                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN').format(m.retailPrice)}đ</td>
                                                                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                                                            <button type="button" className="btn-icon" onClick={() => quickAddMedicine(m)} style={{ background: isAdded ? '#10b981' : '#0ea5e9', color: 'white', width: '28px', height: '28px' }} title={isAdded ? "Đã thêm" : "Thêm vào đơn"}>
                                                                                {isAdded ? <Check size={16} /> : <Plus size={16} />}
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            <div className="input-with-icon">
                                                <Search size={18} className="input-icon" />
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Gõ tên thuốc để thêm nhanh..."
                                                    value={medicineSearchTerm}
                                                    onChange={(e) => setMedicineSearchTerm(e.target.value)}
                                                    onFocus={() => { if (medicineSearchTerm.length > 0) setShowMedicineSuggestions(true) }}
                                                />
                                            </div>

                                            {showMedicineSuggestions && medicineSuggestions.length > 0 && (
                                                <div className="custom-scrollbar" style={{
                                                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                                                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                                                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 9999,
                                                    maxHeight: '300px', overflowY: 'auto', overflowX: 'hidden'
                                                }}>
                                                    {medicineSuggestions.map(m => {
                                                        const isAdded = prescriptions.some(p => p.medicineId === m._id);
                                                        return (
                                                            <div key={m._id}
                                                                onClick={() => quickAddMedicine(m)}
                                                                style={{
                                                                    padding: '10px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', gap: '12px', transition: '0.2s',
                                                                    background: isAdded ? '#f0fdf4' : 'transparent'
                                                                }}
                                                                onMouseOver={e => e.currentTarget.style.background = isAdded ? '#dcfce7' : '#f0f9ff'}
                                                                onMouseOut={e => e.currentTarget.style.background = isAdded ? '#f0fdf4' : 'white'}
                                                            >
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isAdded ? '#166534' : 'inherit' }}>{m.name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tồn: {m.stockQuantity} {m.unit} — {new Intl.NumberFormat('vi-VN').format(m.retailPrice)}đ</div>
                                                                </div>
                                                                {isAdded ? <Check size={18} color="#10b981" /> : <Plus size={18} color="var(--primary)" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {prescriptions.length === 0 ? (
                                            <div style={{ background: '#f8fafc', padding: '32px', textAlign: 'center', borderRadius: '12px', color: 'var(--text-muted)', border: '1px dashed #cbd5e1' }}>
                                                Gõ tên thuốc ở trên hoặc nhấn "+" để kê đơn
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                                                {prescriptions.map((item, i) => (
                                                    <div key={i} style={{ background: '#fefce8', padding: '12px', borderRadius: '12px', border: '1px solid #fef08a', position: 'relative' }}>
                                                        <button type="button" onClick={() => removePrescriptionRow(i)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#fef3c7', border: 'none', color: '#dc2626', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

                                                        <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '10px', fontSize: '0.9rem' }}>
                                                            {item.medicineName || medicines.find(m => m._id === item.medicineId)?.name || '---'}
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: '10px' }}>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a16207', marginBottom: '2px' }}>Số lượng</label>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <input type="number" className="input-field" style={{ background: 'white', padding: '8px' }} value={item.quantity} onChange={e => handlePrescriptionChange(i, 'quantity', e.target.value)} required min="1" />
                                                                    <span style={{ fontSize: '0.8rem', color: '#a16207' }}>{item.unit}</span>
                                                                </div>
                                                            </div>
                                                            <div className="form-group md:col-span-3" style={{ marginBottom: 0 }}>
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a16207', marginBottom: '2px' }}>Hướng dẫn sử dụng</label>
                                                                <input type="text" className="input-field" style={{ background: 'white', padding: '8px' }} placeholder="VD: Sáng 1, chiều 1 sau ăn" value={item.dosageInstructions} onChange={e => handlePrescriptionChange(i, 'dosageInstructions', e.target.value)} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ marginBottom: '24px' }}>
                                            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0, fontWeight: 800, borderBottom: '2px solid #eef2f5', paddingBottom: '8px', marginBottom: '16px' }}>
                                                Dịch Vụ & Thủ Thuật
                                            </h4>

                                            {/* Y Tế */}
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Y Tế & Điều Trị</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                                    {availableServices.filter(s => s.type === 'MEDICAL' || !s.type).map(s => (
                                                        <div key={s._id} onClick={() => toggleService(s._id)}
                                                            style={{
                                                                padding: '10px 14px', borderRadius: '12px', border: '1.5px solid',
                                                                borderColor: selectedServices.includes(s._id) ? '#0ea5e9' : '#e2e8f0',
                                                                background: selectedServices.includes(s._id) ? '#f0f9ff' : 'white',
                                                                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px'
                                                            }}>
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid', borderColor: selectedServices.includes(s._id) ? '#0ea5e9' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedServices.includes(s._id) ? '#0ea5e9' : 'transparent' }}>
                                                                {selectedServices.includes(s._id) && <Check size={14} color="white" />}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Intl.NumberFormat('vi-VN').format(s.price)}đ</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Grooming */}
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#c026d3', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grooming & Spa</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                                    {availableServices.filter(s => s.type === 'GROOMING').map(s => (
                                                        <div key={s._id} onClick={() => toggleService(s._id)}
                                                            style={{
                                                                padding: '10px 14px', borderRadius: '12px', border: '1.5px solid',
                                                                borderColor: selectedServices.includes(s._id) ? '#d946ef' : '#e2e8f0',
                                                                background: selectedServices.includes(s._id) ? '#fdf4ff' : 'white',
                                                                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px'
                                                            }}>
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid', borderColor: selectedServices.includes(s._id) ? '#d946ef' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedServices.includes(s._id) ? '#d946ef' : 'transparent' }}>
                                                                {selectedServices.includes(s._id) && <Check size={14} color="white" />}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Intl.NumberFormat('vi-VN').format(s.price)}đ</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Phụ phí */}
                                            <div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ea580c', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phụ phí & Khác</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                                    {availableServices.filter(s => s.type === 'SURCHARGE').map(s => (
                                                        <div key={s._id} onClick={() => toggleService(s._id)}
                                                            style={{
                                                                padding: '10px 14px', borderRadius: '12px', border: '1.5px solid',
                                                                borderColor: selectedServices.includes(s._id) ? '#f97316' : '#e2e8f0',
                                                                background: selectedServices.includes(s._id) ? '#fff7ed' : 'white',
                                                                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px'
                                                            }}>
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid', borderColor: selectedServices.includes(s._id) ? '#f97316' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedServices.includes(s._id) ? '#f97316' : 'transparent' }}>
                                                                {selectedServices.includes(s._id) && <Check size={14} color="white" />}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Intl.NumberFormat('vi-VN').format(s.price)}đ</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div style={{ padding: '20px 32px', borderTop: '1px solid #eef2f5', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: 'white', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
                            <button type="button" className="btn" style={{ background: '#f8fafc', border: '1px solid #eef2f5' }} onClick={() => { setIsDiagnosing(false); resetForm(); }}>Tạm Đóng</button>
                            <button form="medicalRecordForm" type="submit" className="btn btn-primary" disabled={submitLoading} style={{ fontSize: '1rem', padding: '10px 24px' }}>
                                {submitLoading ? 'Đang Xử Lý...' : 'Kiểm Tra & Hoàn Tất Khám Bệnh'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== Modal xác nhận đơn thuốc trước khi lưu ===== */}
            {showReviewModal && (() => {
                const validRx = prescriptions.filter(p => p.medicineId && p.quantity > 0);
                const fmt = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
                const rxTotal = validRx.reduce((s, p) => {
                    const med = medicines.find(m => m._id === p.medicineId);
                    return s + (med ? med.retailPrice * p.quantity : 0);
                }, 0);
                return createPortal(
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="glass-card animate-slide-up" style={{ background: 'white', padding: 0, borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '2px solid #fbbf24', width: '95%', maxWidth: '800px', maxHeight: '95vh' }}>
                            <div style={{ padding: '18px 28px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#92400e' }}>Kiểm tra trước khi hoàn tất</div>
                                    <div style={{ fontSize: '0.82rem', color: '#a16207', marginTop: '2px' }}>Phiếu khám này không thể chỉnh sửa sau khi lưu. Vui lòng xác nhận.</div>
                                </div>
                                <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowReviewModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div style={{ overflowY: 'auto', padding: '24px 28px', flex: 1 }}>
                                {/* Bệnh nhân */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ flex: 1, background: '#f0f9ff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>Thú cưng</div>
                                        <div style={{ fontWeight: 700 }}>{currentAppointment?.petId?.name || selectedPet?.name}</div>
                                        <div style={{ fontSize: '0.83rem', color: '#64748b' }}>{currentAppointment?.petId?.species || selectedPet?.species}</div>
                                    </div>
                                    <div style={{ flex: 1, background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Chủ nuôi</div>
                                        <div style={{ fontWeight: 700 }}>{currentAppointment?.customerId?.fullName || foundCustomer?.fullName || 'Khách vãng lai'}</div>
                                        <div style={{ fontSize: '0.83rem', color: '#64748b' }}>{currentAppointment?.customerId?.phoneNumber || foundCustomer?.phoneNumber || '---'}</div>
                                    </div>
                                </div>
                                {/* Chẩn đoán */}
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '6px' }}>Chẩn đoán</div>
                                    <div style={{ fontWeight: 600, color: '#14532d' }}>{recordForm.diagnosis}</div>
                                    {recordForm.treatment && <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '6px' }}>Ghi chú: {recordForm.treatment}</div>}
                                    {recordForm.followUpDate && <div style={{ fontSize: '0.85rem', color: '#166534' }}>Tái khám: {new Date(recordForm.followUpDate).toLocaleDateString('vi-VN')}</div>}
                                </div>

                                {/* Dịch vụ */}
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px' }}>
                                    Dịch vụ thực hiện ({selectedServices.length})
                                </div>
                                {selectedServices.length === 0 ? (
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', marginBottom: '20px', fontSize: '0.85rem' }}>Không có dịch vụ đi kèm</div>
                                ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                                        {selectedServices.map(sId => {
                                            const s = availableServices.find(as => as._id === sId);
                                            return (
                                                <div key={sId} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '150px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e40af' }}>{s?.name}</span>
                                                    <span style={{ fontSize: '0.8rem', color: '#1e40af', marginLeft: '10px' }}>{fmt(s?.price)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Toa thuốc */}
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Đơn thuốc xuất kho ({validRx.length} loại)
                                </div>
                                {validRx.length === 0 ? (
                                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', marginBottom: '16px' }}>Không kê thuốc trong lần khám này</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table-mobile-cards" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.88rem' }}>
                                            <thead className="hide-on-mobile">
                                                <tr style={{ background: '#fef3c7', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', borderRadius: '6px 0 0 6px' }}>Thuốc</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Số lượng</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đơn giá</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Thành tiền</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', borderRadius: '0 6px 6px 0' }}>Liều dùng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validRx.map((p, i) => {
                                                    const med = medicines.find(m => m._id === p.medicineId);
                                                    return (
                                                        <tr key={i} style={{ borderBottom: '1px solid #fef3c7' }}>
                                                            <td style={{ padding: '10px 12px', fontWeight: 600 }} data-label="Thuốc">{med?.name || p.medicineId}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'center' }} data-label="Số lượng">{p.quantity} {med?.unit || ''}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }} data-label="Đơn giá">{fmt(med?.retailPrice)}</td>
                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0369a1' }} data-label="Thành tiền">{fmt((med?.retailPrice || 0) * p.quantity)}</td>
                                                            <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.82rem' }} data-label="Liều dùng">{p.dosageInstructions || '--'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <td colSpan="3" style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }} className="hide-on-mobile">Tổng trị giá xuất kho:</td>
                                                    <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: '1rem', color: '#6366f1', textAlign: 'right' }} data-label="Tổng xuất kho">{fmt(rxTotal)}</td>
                                                    <td className="hide-on-mobile"></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '16px 28px', borderTop: '1px solid #fde68a', background: '#fffbeb', display: 'flex', gap: '12px' }}>
                                <button className="btn" style={{ flex: 1, background: 'white', border: '1px solid #d1d5db' }} onClick={() => setShowReviewModal(false)}>Quay lại Chỉnh Sửa</button>
                                <button className="btn btn-primary" style={{ flex: 2, background: '#10b981', border: 'none', padding: '12px', fontWeight: 700, fontSize: '1rem' }}
                                    disabled={submitLoading} onClick={confirmAndSubmitRecord}>
                                    {submitLoading ? 'Đang lưu...' : 'Xác Nhận & Hoàn Tất Khám Bệnh'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* ===== Modal Phiếu Tiêm Phòng (Modal Chính) ===== */}
            {isVacDiagnosing && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div className="glass-card animate-slide-up" style={{ background: 'white', padding: 0, borderRadius: '24px', width: '95%', maxWidth: '1200px', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '20px 32px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#10b981', fontWeight: 800 }}>VACCINATION: [PHIẾU TIÊM PHÒNG]</h2>
                                <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>Trực tiếp</span>
                            </div>
                            <button className="btn-icon" onClick={() => setIsVacDiagnosing(false)} style={{ background: '#f8fafc', borderRadius: '50%' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: 'white' }}>
                            <form id="vacRecordForm" onSubmit={(e) => { e.preventDefault(); handleVacAdd(); }}>
                                {/* Thẻ thông tin nhanh Pet & Chủ */}
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
                                    <div style={{ flex: 1, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: '16px 24px', borderRadius: '12px', border: '1px solid #bbf7d0', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Thú Cưng</div>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#064e3b' }}>{selectedPet?.name}</h3>
                                        <p style={{ margin: '4px 0 0', color: '#15803d', fontWeight: 500 }}>
                                            {selectedPet?.species === 'DOG' ? 'Chó' : 'Mèo'} • {selectedPet?.breed}
                                        </p>
                                        <div style={{ position: 'absolute', right: '16px', bottom: '16px' }}>
                                            <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'white', border: '1px solid #10b981', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => fetchPetHistory(selectedPet?._id, selectedPet?.name)}>
                                                [LỊCH SỬ] Xem Lịch Sử
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, background: '#f8fafc', padding: '16px 24px', borderRadius: '12px', border: '1px solid #eef2f5' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Chủ Nuôi</div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{foundCustomer?.fullName}</h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{foundCustomer?.phoneNumber}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '32px' }}>
                                    {/* Cột trái: Chi tiết vắc xin */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #ecfdf5', paddingBottom: '8px' }}>
                                            <h4 style={{ fontSize: '1rem', color: '#065f46', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                                                Thông Tin Tiêm Chủng
                                            </h4>
                                            <button type="button" className="btn"
                                                style={{ fontSize: '0.75rem', padding: '6px 12px', background: showVacInventoryTable ? '#64748b' : '#3b82f6', color: 'white', border: 'none' }}
                                                onClick={() => setShowVacInventoryTable(!showVacInventoryTable)}
                                            >
                                                {showVacInventoryTable ? 'Đóng Bảng Kho' : 'Bảng Kho Vắc-xin'}
                                            </button>
                                        </div>

                                        {showVacInventoryTable && (
                                            <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', maxHeight: '350px', overflowY: 'auto', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Chọn vắc-xin từ kho (Thủ công)</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{medicines.length} sản phẩm</div>
                                                </div>
                                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                                                            <th style={{ padding: '10px 8px' }}>Tên vắc-xin</th>
                                                            <th style={{ padding: '10px 8px', textAlign: 'center' }}>Tồn</th>
                                                            <th style={{ padding: '10px 8px', textAlign: 'right' }}>Giá</th>
                                                            <th style={{ padding: '10px 8px' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {medicines.map(m => (
                                                            <tr key={m._id} style={{ borderBottom: '1px solid #e2e8f0' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{m.name}</td>
                                                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                                    <span style={{
                                                                        background: m.stockQuantity < 5 ? '#fef2f2' : '#f0fdf4',
                                                                        color: m.stockQuantity < 5 ? '#ef4444' : '#10b981',
                                                                        padding: '2px 8px', borderRadius: '6px', fontWeight: 700
                                                                    }}>{m.stockQuantity}</span>
                                                                </td>
                                                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN').format(m.retailPrice)}đ</td>
                                                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                                                    <button type="button" className="btn-icon"
                                                                        onClick={() => {
                                                                            setVacForm({ ...vacForm, medicineId: m._id, medicineName: m.name, expiryDate: m.expiryDate });
                                                                            setVacMedSearch('');
                                                                            setShowVacInventoryTable(false);
                                                                        }}
                                                                        style={{ background: '#0ea5e9', color: 'white', width: '28px', height: '28px' }}>
                                                                        <Check size={16} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <div className="form-group" style={{ marginBottom: '20px' }}>
                                            <div style={{ marginBottom: '8px' }}>
                                                <label style={{ display: 'block', margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Tìm Vắc-xin/Thuốc (Trong kho) *</label>
                                            </div>


                                            <div style={{ position: 'relative' }} ref={vacMedSearchRef}>
                                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    style={{ paddingLeft: '40px', background: '#f0fdf4' }}
                                                    placeholder="Gõ tên vắc-xin để lấy dữ liệu kho..."
                                                    value={vacMedSearch}
                                                    onChange={(e) => setVacMedSearch(e.target.value)}
                                                    onFocus={() => { if (vacMedSearch.length >= 1) setShowVacMedSuggestions(true); }}
                                                />
                                                {showVacMedSuggestions && vacMedSuggestions.length > 0 && (
                                                    <div className="custom-scrollbar" style={{
                                                        position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                                                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                                                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 9999,
                                                        maxHeight: '300px', overflowY: 'auto', overflowX: 'hidden'
                                                    }}>
                                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                            {vacMedSuggestions.map(m => (
                                                                <li key={m._id}
                                                                    onClick={() => {
                                                                        setVacForm({ ...vacForm, medicineId: m._id, medicineName: m.name, expiryDate: m.expiryDate });
                                                                        setVacMedSearch('');
                                                                        setShowVacMedSuggestions(false);
                                                                    }}
                                                                    style={{
                                                                        padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', gap: '12px', transition: '0.2s'
                                                                    }}
                                                                    onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
                                                                    onMouseOut={e => e.currentTarget.style.background = 'white'}
                                                                >
                                                                    <div style={{
                                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                                        background: '#ecfdf5', color: '#10b981', display: 'flex',
                                                                        alignItems: 'center', justifyContent: 'center'
                                                                    }}>
                                                                        <Package size={16} />
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{m.name}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                            Hạn dùng: {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '---'} | Tồn: {m.stockQuantity} {m.unit || 'đơn vị'}
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {vacForm.medicineId && (
                                                <div style={{ marginTop: '12px', background: '#f0fdf4', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem' }}>{vacForm.medicineName}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '2px' }}>
                                                            Hạn sử dụng: <span style={{ fontWeight: 700 }}>{vacForm.expiryDate ? new Date(vacForm.expiryDate).toLocaleDateString() : '---'}</span>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => setVacForm({ ...vacForm, medicineId: '', medicineName: '', expiryDate: '' })} style={{ background: '#dcfce7', border: 'none', color: '#166534', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>Thay đổi</button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2" style={{ gap: '16px', marginBottom: '16px' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Mũi tiêm thứ mấy</label>
                                                <input type="number" className="input-field" value={vacForm.doseNumber} onChange={e => setVacForm({ ...vacForm, doseNumber: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Ngày tiêm (Hôm nay)</label>
                                                <input type="date" className="input-field" value={vacForm.administeredDate} readOnly style={{ background: '#f8fafc', fontWeight: 600, color: '#64748b', cursor: 'not-allowed' }} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2" style={{ gap: '16px', marginBottom: '16px' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>Ngày nhắc lại *</label>
                                                <input type="date" className="input-field" style={{ borderColor: '#fecaca' }} value={vacForm.reminderDate} onChange={e => setVacForm({ ...vacForm, reminderDate: e.target.value })} />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Phản ứng sau tiêm</label>
                                                <input type="text" className="input-field" value={vacForm.reaction} onChange={e => setVacForm({ ...vacForm, reaction: e.target.value })} placeholder="VD: Sốt nhẹ, bỏ ăn..." />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Ghi chú tiêm chủng</label>
                                            <textarea className="input-field" style={{ minHeight: '100px' }} value={vacForm.notes} onChange={e => setVacForm({ ...vacForm, notes: e.target.value })} placeholder="Lưu ý thêm về ca tiêm này..."></textarea>
                                        </div>
                                    </div>

                                    {/* Cột phải: Dịch vụ & Toa thuốc phụ */}
                                    <div style={{ borderLeft: '2px solid #f8fafc', paddingLeft: '32px' }}>

                                        <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #eef2f5', paddingBottom: '8px' }}>
                                            Dịch Vụ Đi Kèm
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '24px' }}>
                                            {availableServices.filter(s => s.type === 'SURCHARGE').map(s => (
                                                <div key={s._id}
                                                    onClick={() => toggleService(s._id)}
                                                    style={{
                                                        padding: '8px 12px', borderRadius: '10px', border: '1.5px solid',
                                                        borderColor: selectedServices.includes(s._id) ? '#10b981' : '#e2e8f0',
                                                        background: selectedServices.includes(s._id) ? '#f0fdf4' : 'white',
                                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '16px', height: '16px', borderRadius: '4px', border: '2px solid',
                                                        borderColor: selectedServices.includes(s._id) ? '#10b981' : '#cbd5e1',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: selectedServices.includes(s._id) ? '#10b981' : 'transparent'
                                                    }}>
                                                        {selectedServices.includes(s._id) && <Check size={12} color="white" />}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{new Intl.NumberFormat('vi-VN').format(s.price)}đ</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #eef2f5' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: '#64748b' }}>Tiền vắc-xin:</span>
                                                <strong style={{ color: '#10b981' }}>{new Intl.NumberFormat('vi-VN').format(medicines.find(m => m._id === vacForm.medicineId)?.retailPrice || 0)}đ</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed #cbd5e1' }}>
                                                <span style={{ color: '#64748b' }}>Tiền dịch vụ:</span>
                                                <strong>{new Intl.NumberFormat('vi-VN').format(selectedServices.reduce((sum, id) => sum + (availableServices.find(s => s._id === id)?.price || 0), 0))}đ</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>TỔNG CỘNG:</span>
                                                <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#059669' }}>
                                                    {new Intl.NumberFormat('vi-VN').format(
                                                        (medicines.find(m => m._id === vacForm.medicineId)?.retailPrice || 0) +
                                                        selectedServices.reduce((sum, id) => sum + (availableServices.find(s => s._id === id)?.price || 0), 0)
                                                    )}đ
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div style={{ padding: '20px 32px', borderTop: '1px solid #eef2f5', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: 'white' }}>
                            <button type="button" className="btn" style={{ background: '#f8fafc', border: '1px solid #eef2f5' }} onClick={() => setIsVacDiagnosing(false)}>Tạm Đóng</button>
                            <button form="vacRecordForm" type="submit" className="btn btn-primary" disabled={submitLoading} style={{ fontSize: '1.1rem', padding: '12px 32px', background: '#059669', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                                {submitLoading ? 'Đang Xử Lý...' : 'KIỂM TRA VÀ CHỜ THANH TOÁN'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ===== Modal xác nhận đơn tiêm chủng trước khi lưu ===== */}
            {showVacReviewModal && (() => {
                const fmt = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
                const vacPrice = medicines.find(m => m._id === vacForm.medicineId)?.retailPrice || 0;
                const servicesTotal = selectedServices.reduce((sum, id) => sum + (availableServices.find(s => s._id === id)?.price || 0), 0);
                const total = vacPrice + servicesTotal;

                return createPortal(
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
                        <div className="glass-card animate-slide-up" style={{ background: 'white', padding: 0, borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '2px solid #10b981', width: '95%', maxWidth: '750px', maxHeight: '90vh' }}>
                            <div style={{ padding: '20px 28px', background: '#ecfdf5', borderBottom: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#065f46' }}>Xác Nhận & Chờ Thanh Toán (Tiêm Phòng)</div>
                                    <div style={{ fontSize: '0.82rem', color: '#059669', marginTop: '2px' }}>Vui lòng kiểm tra kỹ thông tin vắc-xin và dịch vụ đi kèm.</div>
                                </div>
                                <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => setShowVacReviewModal(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ overflowY: 'auto', padding: '24px 28px', flex: 1 }}>
                                {/* Bệnh nhân/Chủ nuôi */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                                    <div style={{ flex: 1, background: '#f0fdf4', padding: '14px 18px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: '4px' }}>Bệnh nhân</div>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedPet?.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#166534' }}>{selectedPet?.species === 'DOG' ? 'Chó' : 'Mèo'} • {selectedPet?.breed}</div>
                                    </div>
                                    <div style={{ flex: 1, background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #eef2f5' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Chủ nuôi</div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{foundCustomer?.fullName}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{foundCustomer?.phoneNumber}</div>
                                    </div>
                                </div>

                                {/* Chi tiết tiêm */}
                                <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: '4px' }}>Vắc-xin thực hiện</div>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#064e3b' }}>{vacForm.medicineName}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#059669', background: 'white', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px', fontWeight: 600 }}>Mũi thứ: {vacForm.doseNumber}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: '4px' }}>Giá vắc-xin</div>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#059669' }}>{fmt(vacPrice)}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#166534', borderTop: '1px dashed #bbf7d0', paddingTop: '10px', marginTop: '5px' }}>
                                        <strong>Ngày nhắc lại:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{new Date(vacForm.reminderDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>

                                {/* Dịch vụ đi kèm */}
                                {selectedServices.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px', color: '#64748b' }}>Dịch vụ đi kèm ({selectedServices.length})</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {selectedServices.map(sId => {
                                                const s = availableServices.find(as => as._id === sId);
                                                return (
                                                    <div key={sId} style={{ background: 'white', border: '1px solid #eef2f5', padding: '8px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: '180px' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s?.name}</span>
                                                        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '10px' }}>{fmt(s?.price)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tổng cộng */}
                                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eef2f5' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>TỔNG THANH TOÁN:</span>
                                    <span style={{ fontWeight: 900, fontSize: '1.8rem', color: '#059669' }}>{fmt(total)}</span>
                                </div>
                            </div>

                            <div style={{ padding: '20px 28px', borderTop: '1px solid #eef2f5', background: 'white', display: 'flex', gap: '12px' }}>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowVacReviewModal(false)}>Quay lại Sửa</button>
                                <button className="btn btn-primary" style={{ flex: 2, background: '#10b981', border: 'none', padding: '14px', fontWeight: 800, fontSize: '1.1rem', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
                                    disabled={submitLoading} onClick={confirmAndSubmitVac}>
                                    {submitLoading ? 'Đang lưu...' : 'XÁC NHẬN & CHỜ THANH TOÁN'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}



            {/* Modal Lịch Sử Bệnh Án */}
            {isHistoryOpen && createPortal(
                <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 3200, display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="animate-slide-right" style={{ width: '500px', height: '100%', background: 'white', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #eef2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                [LỊCH SỬ] {selectedPetName || 'Bệnh Án'}
                            </h3>
                            <button className="btn-icon" onClick={() => setIsHistoryOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                            {petHistory.length === 0 && petVacHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chưa có lịch sử nào.</div>
                            ) : (
                                (() => {
                                    // Gộp cả 2 loại lịch sử và sắp xếp theo ngày
                                    const combinedHistory = [
                                        ...petHistory.map(h => ({ ...h, type: 'EXAM' })),
                                        ...petVacHistory.map(v => ({ ...v, type: 'VAC' }))
                                    ].sort((a, b) => new Date(b.administeredDate || b.createdAt) - new Date(a.administeredDate || a.createdAt));

                                    return combinedHistory.map((h, i) => (
                                        <div key={h._id} style={{
                                            marginBottom: '24px',
                                            padding: '16px',
                                            border: '1px solid',
                                            borderColor: h.type === 'VAC' ? '#bbf7d0' : '#eef2f5',
                                            borderRadius: '12px',
                                            background: h.type === 'VAC' ? '#f0fdf4' : (i === 0 ? '#f0f9ff' : 'white'),
                                            position: 'relative'
                                        }}>
                                            {/* Badge loại record */}
                                            <div style={{
                                                position: 'absolute', top: '-10px', right: '10px',
                                                background: h.type === 'VAC' ? '#10b981' : '#6366f1',
                                                color: 'white', padding: '2px 8px', borderRadius: '6px',
                                                fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase'
                                            }}>
                                                {h.type === 'VAC' ? '💉 Tiêm Phòng' : '🩺 Khám Bệnh'}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <strong style={{ color: h.type === 'VAC' ? '#065f46' : 'var(--primary)' }}>
                                                    {new Date(h.administeredDate || h.createdAt).toLocaleDateString('vi-VN')}
                                                </strong>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {h.type === 'VAC' ? 'KTV/BS: ' : 'BS: '} {h.doctorId?.fullName || h.staffId?.fullName || 'BS Trực'}
                                                </span>
                                            </div>

                                            {h.type === 'VAC' ? (
                                                <>
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Tên Vắc-xin/Thuốc:</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#064e3b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Syringe size={16} /> {h.medicineName || h.medicineId?.name || h.vaccineName || 'Vắc-xin'}
                                                            <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px' }}>Mũi {h.doseNumber || 1}</span>
                                                        </div>
                                                    </div>

                                                    {h.notes && (
                                                        <div style={{ fontSize: '0.85rem', color: '#15803d', background: '#f0fdf4', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #22c55e', marginBottom: '8px' }}>
                                                            <strong>Ghi chú:</strong> {h.notes}
                                                        </div>
                                                    )}
                                                    {h.reaction && (
                                                        <div style={{ fontSize: '0.85rem', color: '#dc2626', background: '#fef2f2', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>
                                                            <strong>Phản ứng:</strong> {h.reaction}
                                                        </div>
                                                    )}
                                                    {h.nextDueDate && (
                                                        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Calendar size={14} /> Ngày nhắc lại: {new Date(h.nextDueDate).toLocaleDateString('vi-VN')}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {/* Vital Signs Row */}
                                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '12px', background: '#f8fafc', padding: '8px', borderRadius: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                                            <Scale size={14} color="#6366f1" /> {h.weightAtVisit || '??'} kg
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                                            <Thermometer size={14} color="#ef4444" /> {h.temperature || '??'}°C
                                                        </div>
                                                    </div>

                                                    <div style={{ marginBottom: '10px' }}>
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Biểu hiện & Chẩn đoán</div>
                                                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                                                <AlertCircle size={14} style={{ marginTop: '3px', flexShrink: 0 }} color="#f97316" />
                                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                                    <strong>Triệu chứng:</strong> {h.symptoms}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                                <Activity size={14} style={{ marginTop: '3px', flexShrink: 0 }} color="#10b981" />
                                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                                    <strong>Chẩn đoán:</strong> {h.diagnosis}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {h.treatment && (
                                                            <div style={{ marginTop: '10px' }}>
                                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Hướng điều trị</div>
                                                                <div style={{ marginTop: '4px', fontSize: '0.9rem', color: '#1e293b', background: '#f1f5f9', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #64748b' }}>
                                                                    {h.treatment}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {h.prescriptions?.length > 0 && (
                                                        <div style={{ marginTop: '12px', background: '#fffbeb', padding: '12px', borderRadius: '10px', border: '1px solid #fef3c7' }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a16207', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Clipboard size={14} /> ĐƠN THUỐC CHI TIẾT
                                                            </div>
                                                            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#92400e' }}>
                                                                {h.prescriptions.map((p, idx) => (
                                                                    <li key={idx} style={{ marginBottom: '4px' }}>
                                                                        <strong style={{ color: '#78350f' }}>{p.medicineName || p.medicineId?.name}</strong>: {p.quantity} {p.medicineId?.unit || ''}
                                                                        {p.dosageInstructions && <div style={{ fontSize: '0.75rem', color: '#b45309', marginLeft: '0px' }}>↳ {p.dosageInstructions}</div>}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {h.services?.length > 0 && (
                                                        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                            {h.services.map((s, idx) => (
                                                                <span key={idx} style={{ fontSize: '0.7rem', background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                                    # {s.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {h.followUpDate && (
                                                        <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '8px', borderRadius: '6px' }}>
                                                            <Calendar size={14} /> Ngày tái khám: {new Date(h.followUpDate).toLocaleDateString('vi-VN')}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </Layout>
    );
};

export default MedicalRecords;
