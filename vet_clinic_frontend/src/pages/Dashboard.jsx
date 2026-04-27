import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { printReport } from "../utils/printService";
import Layout from "../components/Layout";
import { API } from "../constants";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import {
    Activity,
    Users,
    Calendar,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    ArrowLeft,
    PieChart as PieChartIcon,
    BarChart3,
    Search,
    Clock,
    Award,
    CheckCircle2,
    AlertTriangle,
    X,
    ChevronRight,
    CreditCard,
    ShoppingCart,
    UserPlus,
    Package,
    Star,
    Sparkles,
    Building2,
    Printer,
    MapPin,
    Phone,
    Mail,
    Plus,
    Edit2,
    Trash2,
    Check,
    Settings,
    ArrowRightLeft,
    Info,
    Building,
    Map,
    Crown,
    FileText,
    Syringe
} from 'lucide-react';
// Icons previously imported from react-icons/fa6 with wrong Fc names — replaced with lucide-react equivalents

const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0";
    return new Intl.NumberFormat("vi-VN").format(val);
};

const getStatusBadge = (status) => {
    switch (status) {
        case "COMPLETED":
            return <span className="badge badge-success">Hoàn Tất</span>;
        case "READY_FOR_PAYMENT":
            return <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#d97706' }}>Chờ Thanh Toán</span>;
        case "IN_PROGRESS":
            return <span className="badge badge-info">Đang Khám</span>;
        case "ARRIVED":
            return <span className="badge badge-primary" style={{ background: '#ede9fe', color: '#7c3aed' }}>Đã Đến</span>;
        case "BOOKED":
            return <span className="badge badge-default" style={{ background: '#f1f5f9', color: '#475569' }}>Đã Đặt</span>;
        default:
            return <span className="badge badge-default">{status || 'Chờ Duyệt'}</span>;
    }
};

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Khởi tạo ngày đầu tháng và hôm nay
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [dateRange, setDateRange] = useState({
        startDate: firstDay.toISOString().split("T")[0],
        endDate: today.toISOString().split("T")[0],
    });

    const [stats, setStats] = useState({
        metrics: {
            newCustomers: 0,
            newCustomersList: [],
            todayAppointments: 0,
            appointmentsList: [],
            periodRevenue: 0,
            periodInvoicesList: [],
            clinicProfit: 0,
            inventoryProfit: 0,
            inventoryProfitDetails: [],
            inpatientPets: 0,
            inpatientPetsList: [],
        },
        chartData: [],
        recentAppointments: [],
        advanced: {
            upcomingAppointments: [],
            topCustomers: [],
            staffPerformance: [],
            lowStockMedicines: [],
        },
    });
    const [dutyStaff, setDutyStaff] = useState({ currentShift: 'DAY', data: [] });
    const [loading, setLoading] = useState(true);
    const [selectedDetailView, setSelectedDetailView] = useState(null);
    const [showGreeting, setShowGreeting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    // ── Activity Log state ──
    const [actLogs, setActLogs]   = useState([]);
    const [actLoading, setActLoading] = useState(false);
    const [actDate, setActDate]   = useState(new Date().toISOString().split('T')[0]);
    const [actFilter, setActFilter] = useState('');
    const [actTotal, setActTotal] = useState(0);


    useEffect(() => {
        const hasSeenGreeting = sessionStorage.getItem("hasSeenGreeting");
        if (!hasSeenGreeting) {
            setShowGreeting(true);
            sessionStorage.setItem("hasSeenGreeting", "true");
            const timer = setTimeout(() => {
                setShowGreeting(false);
            }, 12000); // Ẩn sau 12 giây
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const token = sessionStorage.getItem("token");
                const [resStats, resDuty] = await Promise.all([
                    axios.get(`${API}/dashboard/stats`, {
                        params: { startDate: dateRange.startDate || "", endDate: dateRange.endDate || "" },
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    (() => {
                        // Tính ngày hôm nay và ca hiện tại theo múi giờ VN của trình duyệt
                        const now = new Date();
                        // Lấy "YYYY-MM-DD" theo local timezone
                        const todayLocal = now.getFullYear() + '-' +
                            String(now.getMonth() + 1).padStart(2, '0') + '-' +
                            String(now.getDate()).padStart(2, '0');
                        const hour = now.getHours();
                        let currentShift = 'DAY';
                        if (hour >= 14 && hour < 21) currentShift = 'EVENING';
                        if (hour >= 21 || hour < 8) currentShift = 'NIGHT';

                        return axios.get(`${API}/hrm/duty-staff`, {
                            params: { date: todayLocal, currentShift },
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    })()
                ]);

                if (resStats.data.success) setStats(resStats.data.data);
                if (resDuty.data.success) setDutyStaff(resDuty.data);
            } catch (error) {
                console.error("Lỗi khi tải Dashboard:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [dateRange]);

    const { metrics = {}, chartData = [], recentAppointments = [], advanced = {} } =
        stats || {};

    // Hàm xử lý in - uỷ thác cho printService.js
    const handlePrint = async (chartId = null) => {
        const metaText = `Kỳ báo cáo: Từ ngày ${dateRange.startDate} đến ngày ${dateRange.endDate}`;

        if (chartId) {
            await printReport({
                title: chartId === 'print-chart-revenue' ? 'Biểu Đồ Doanh Thu & Hoạt Động' : 'Cơ Cấu Nguồn Thu',
                chartId: chartId,
                metaInfo: metaText
            });
            return;
        }

        if (selectedDetailView) {
            const tableEl = document.querySelector('.table-responsive');
            if (tableEl) {
                const titleMap = {
                    revenue: 'Báo Cáo Doanh Thu Tổng Hợp',
                    clinicProfit: 'Báo Cáo Doanh Thu Khám Chữa Bệnh',
                    inventoryProfit: 'Báo Cáo Lợi Nhuận Thuốc & Vật Tư',
                    newCustomers: 'Danh Sách Khách Hàng Mới',
                    appointments: 'Danh Sách Lịch Hẹn & Ca Khám',
                    inpatientPets: 'Danh Sách Thú Cưng Nội Trú',
                    vipCustomers: 'Báo Cáo Khách Hàng Thân Thiết (VIP)',
                    staffPerformance: 'Báo Cáo Hiệu Suất Nhân Sự',
                    lowStock: 'Danh Sách Sản Phẩm Sắp Hết Kho',
                    upcomingAppointments: 'Danh Sách Lịch Hẹn Sắp Tới',
                };

                let summaryHTML = "";

                if (selectedDetailView === "revenue") {
                    const invoices = metrics.periodInvoicesList || [];
                    const totalRevenue = invoices.reduce((s, i) => s + (i.finalTotal || 0), 0);
                    const totalService = invoices.reduce((s, i) => s + (i.serviceTotal || 0), 0);
                    const totalMedicine = invoices.reduce((s, i) => s + (i.medicineTotal || 0), 0);
                    summaryHTML = `• Tổng số hóa đơn: <strong>${invoices.length}</strong><br/>• Tổng doanh thu dịch vụ: <strong>${formatCurrency(totalService)} đ</strong><br/>• Tổng doanh thu thuốc: <strong>${formatCurrency(totalMedicine)} đ</strong><br/>• <strong>Tổng cộng: ${formatCurrency(totalRevenue)} đ</strong>`;
                } else if (selectedDetailView === "clinicProfit") {
                    const invoices = metrics.periodInvoicesList || [];
                    const totalService = invoices.reduce((s, i) => s + (i.serviceTotal || 0), 0);
                    summaryHTML = `• Tổng số hóa đơn dịch vụ: <strong>${invoices.length}</strong><br/>• Tổng doanh thu khám chữa bệnh: <strong>${formatCurrency(totalService)} đ</strong><br/>• Lợi nhuận ước tính: <strong>${formatCurrency(metrics.clinicProfit || 0)} đ</strong>`;
                } else if (selectedDetailView === "inventoryProfit") {
                    const details = metrics.inventoryProfitDetails || [];
                    const totalProfit = metrics.inventoryProfit || 0;
                    summaryHTML = `• Tổng số mặt hàng: <strong>${details.length}</strong><br/>• Tổng lợi nhuận thuốc & vật tư: <strong>${formatCurrency(totalProfit)} đ</strong>`;
                } else if (selectedDetailView === "newCustomers") {
                    const customers = metrics.newCustomersList || [];
                    summaryHTML = `• Tổng số khách hàng mới trong kỳ: <strong>${customers.length} người</strong><br/>• Kỳ thống kê: <strong>${dateRange.startDate} → ${dateRange.endDate}</strong>`;
                } else if (selectedDetailView === "appointments") {
                    const apts = metrics.appointmentsList || [];
                    const completed = apts.filter(a => a.status === 'COMPLETED').length;
                    summaryHTML = `• Tổng số ca khám trong kỳ: <strong>${apts.length} ca</strong><br/>• Hoàn tất: <strong>${completed} ca</strong> | Còn lại: <strong>${apts.length - completed} ca</strong>`;
                } else if (selectedDetailView === "inpatientPets") {
                    const pets = metrics.inpatientPetsList || [];
                    summaryHTML = `• Tổng số thú cưng đang nội trú: <strong>${pets.length} con</strong><br/>• Cần theo dõi chặt chẽ và cập nhật tình trạng hằng ngày.`;
                } else if (selectedDetailView === "vipCustomers") {
                    const top = advanced.topCustomers || [];
                    const totalSpent = top.reduce((sum, item) => sum + (item.totalSpent || 0), 0);
                    summaryHTML = `• Tổng số khách hàng VIP: <strong>${top.length}</strong><br/>• Tổng doanh thu từ nhóm VIP: <strong>${formatCurrency(totalSpent)} đ</strong>`;
                } else if (selectedDetailView === "staffPerformance") {
                    const staff = advanced.staffPerformance || [];
                    const totalRevenue = staff.reduce((s, i) => s + (i.totalRevenue || 0), 0);
                    const totalInvoices = staff.reduce((s, i) => s + (i.invoiceCount || 0), 0);
                    summaryHTML = `• Tổng số nhân viên thống kê: <strong>${staff.length}</strong><br/>• Tổng hóa đơn xử lý: <strong>${totalInvoices} hóa đơn</strong><br/>• Tổng doanh thu tạo ra: <strong>${formatCurrency(totalRevenue)} đ</strong>`;
                } else if (selectedDetailView === "lowStock") {
                    const list = advanced.lowStockMedicines || [];
                    const critical = list.filter(m => m.stockQuantity < 5).length;
                    summaryHTML = `• Tổng số sản phẩm cần nhập hàng: <strong>${list.length} mã hàng</strong><br/>• Trong đó khẩn cấp (dưới 5 đơn vị): <strong>${critical} mã hàng</strong>`;
                } else if (selectedDetailView === "upcomingAppointments") {
                    const apts = advanced.upcomingAppointments || [];
                    summaryHTML = `• Tổng số lịch hẹn sắp tới: <strong>${apts.length} ca</strong><br/>• Vui lòng xác nhận và chuẩn bị trước ít nhất 30 phút.`;
                }

                await printReport({
                    title: titleMap[selectedDetailView] || 'Báo Cáo Chi Tiết',
                    contentHTML: tableEl.innerHTML,
                    metaInfo: metaText,
                    summaryHTML: summaryHTML
                });
            }
        }
    };

    // Hàm in trực tiếp cho Widget Card (không cần mở Detail View)
    const handlePrintDirectWidget = async (viewKey) => {
        const metaText = `Kỳ báo cáo: Từ ngày ${dateRange.startDate} đến ngày ${dateRange.endDate}`;
        let title = '';
        let tableHTML = '';
        let summaryHTML = '';

        if (viewKey === 'vipCustomers') {
            title = 'Báo Cáo Khách Hàng Thân Thiết (VIP)';
            const list = advanced.topCustomers || [];
            const totalSpent = list.reduce((sum, item) => sum + (item.totalSpent || 0), 0);
            summaryHTML = `• Tổng số khách hàng VIP: <strong>${list.length}</strong><br/>• Tổng doanh thu từ nhóm VIP: <strong>${formatCurrency(totalSpent)} đ</strong>`;

            tableHTML = `
                <table class="table print-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">STT</th>
                            <th>Họ Và Tên</th>
                            <th>Số điện thoại</th>
                            <th style="text-align: right;">Tổng Chi Tiêu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Không có dữ liệu</td></tr>' : list.map((item, index) => `
                            <tr>
                                <td style="text-align: center;">${index + 1}</td>
                                <td>${item.fullName || 'Khách vãng lai'}</td>
                                <td>${item.phoneNumber || 'N/A'}</td>
                                <td style="text-align: right; font-weight: bold; color: #16a34a;">${formatCurrency(item.totalSpent)} đ</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (viewKey === 'staffPerformance') {
            title = 'Báo Cáo Hiệu Suất Nhân Sự';
            const list = advanced.staffPerformance || [];
            const totalRevenue = list.reduce((s, i) => s + (i.totalRevenue || 0), 0);
            const totalInvoices = list.reduce((s, i) => s + (i.invoiceCount || 0), 0);
            summaryHTML = `• Tổng số nhân viên thống kê: <strong>${list.length}</strong><br/>• Tổng hóa đơn xử lý: <strong>${totalInvoices} hóa đơn</strong><br/>• Tổng doanh thu tạo ra: <strong>${formatCurrency(totalRevenue)} đ</strong>`;

            tableHTML = `
                <table class="table print-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">STT</th>
                            <th>Họ Và Tên</th>
                            <th>Vai Trò</th>
                            <th style="text-align: center;">Số Hóa Đơn</th>
                            <th style="text-align: right;">Doanh Thu Tạo Ra</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Không có dữ liệu</td></tr>' : list.map((item, index) => `
                            <tr>
                                <td style="text-align: center;">${index + 1}</td>
                                <td style="font-weight: bold;">${item.fullName}</td>
                                <td>${item.role === 'DOCTOR' ? 'Bác sĩ' : 'Nhân viên'}</td>
                                <td style="text-align: center;">${item.invoiceCount}</td>
                                <td style="text-align: right; font-weight: bold; color: #0284c7;">${formatCurrency(item.totalRevenue)} đ</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (viewKey === 'lowStock') {
            title = 'Cảnh Báo Sản Phẩm Sắp Hết Kho';
            const list = advanced.lowStockMedicines || [];
            const critical = list.filter(m => m.stockQuantity < 5).length;
            summaryHTML = `• Tổng số sản phẩm cần nhập hàng: <strong>${list.length} mã hàng</strong><br/>• Trong đó khẩn cấp (dưới 5 đơn vị): <strong style="color:red;">${critical} mã hàng</strong>`;

            tableHTML = `
                <table class="table print-table">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">STT</th>
                            <th>Mã SP</th>
                            <th>Tên Sản Phẩm</th>
                            <th>Danh Mục</th>
                            <th style="text-align: right;">Tồn Kho</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Kho hàng an toàn!</td></tr>' : list.map((item, index) => `
                            <tr>
                                <td style="text-align: center;">${index + 1}</td>
                                <td>${item.sku || 'N/A'}</td>
                                <td style="font-weight: bold;">${item.name}</td>
                                <td>${item.category === 'MEDICINE' ? 'Thuốc' : 'Vật tư'}</td>
                                <td style="text-align: right; font-weight: bold; color: #dc2626;">${item.stockQuantity} ${item.unit}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        if (tableHTML) {
            await printReport({
                title: title,
                contentHTML: tableHTML,
                metaInfo: metaText,
                summaryHTML: summaryHTML
            });
        }
    };

    const COLORS = [
        "var(--primary)",
        "var(--info)",
        "var(--warning)",
        "var(--danger)",
        "var(--success)",
    ];

    // Dữ liệu cho PieChart Cơ cấu doanh thu tính từ mảng hóa đơn thực thế đã lọc
    const sumService = (metrics?.periodInvoicesList || []).reduce((acc, inv) => acc + (inv.serviceTotal || 0), 0);
    const sumMedicineAndRetail = (metrics?.periodInvoicesList || []).reduce((acc, inv) => acc + ((inv.medicineTotal || 0) + (inv.retailTotal || 0)), 0);

    let revenueDistributionData = [
        { name: "Khám Chữa Bệnh", value: sumService },
        { name: "Thuốc & Vật tư", value: sumMedicineAndRetail },
    ];

    revenueDistributionData = revenueDistributionData.filter((item) => item.value > 0);

    return (
        <Layout>
            <div
                className={`dashboard-header flex-between animate-fade-in ${selectedDetailView ? "hide-print" : ""}`}
                style={{ marginBottom: "32px", gap: "20px", flexWrap: 'wrap' }}
            >
                <div style={{ flex: "1 1 300px" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            flexWrap: "wrap",
                            marginBottom: "8px",
                        }}
                    >
                        <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 4vw, 2rem)", letterSpacing: "-0.04em" }}>Chào mừng trở lại!</h1>
                        <div
                            className="glass-card hide-print"
                            style={{
                                padding: "6px 14px",
                                fontWeight: "700",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "0.85rem",
                                borderRadius: "10px",
                                color: "var(--primary-dark)",
                                background: "var(--primary-light)",
                                border: "1px solid rgba(15, 169, 172, 0.2)",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <Clock size={14} />
                            {new Date().toLocaleDateString("vi-VN", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                            })}
                        </div>
                    </div>
                    {showGreeting && (
                        <div className="animate-fade-in" style={{ opacity: 0.8 }}>
                            <p style={{ color: "var(--text-muted)", fontSize: "1rem", fontWeight: "500" }}>
                                Chúc <span style={{ color: "var(--primary)", fontWeight: "700" }}>{user?.fullName || "bạn"}</span> một ngày làm việc tuyệt vời tại VetCare! 🐾
                            </p>
                        </div>
                    )}
                </div>
                {/* View Details Logic Wrapper */}
                {!selectedDetailView && (
                    <div
                        className="hide-print filters-wrapper"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            marginLeft: "auto",
                            flexWrap: 'wrap'
                        }}
                    >
                        {/* BỘ LỌC NGÀY */}
                        <div
                            className="glass-card"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 12px",
                                borderRadius: "10px",
                                border: "1px solid #eef2f5",
                                background: '#fff',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <Calendar size={16} color="var(--primary)" />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="date"
                                    style={{ border: "none", background: "transparent", padding: 0, fontWeight: '600', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                />
                                <span style={{ color: '#cbd5e1' }}>→</span>
                                <input
                                    type="date"
                                    style={{ border: "none", background: "transparent", padding: 0, fontWeight: '600', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                        {/* Nút xem Lịch Sử Hệ Thống */}
                        <button
                            onClick={() => setSelectedDetailView('activityLog')}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap' }}
                        >
                            <FileText size={15} color="var(--primary)" /> Nhật ký hệ thống
                        </button>
                    </div>
                )}
            </div>

            {/* Khối Thẻ Thống Kê */}
            {!selectedDetailView && (
                <>
                    <div className="stats-grid mb-32 animate-slide-up">
                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => setSelectedDetailView("newCustomers")}
                        >
                            <div className="stat-icon-wrapper bg-primary-light">
                                <Users size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Khách Mới</p>
                                <div className="stat-value-group">
                                    <h3>{metrics?.newCustomers ?? 0}</h3>
                                    <span className="stat-trend trend-up">
                                        +12%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => setSelectedDetailView("appointments")}
                        >
                            <div className="stat-icon-wrapper bg-info-light">
                                <Calendar size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Lịch Hẹn</p>
                                <div className="stat-value-group">
                                    <h3>{metrics?.todayAppointments ?? 0}</h3>
                                    <span className="stat-trend trend-up">
                                        +5%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Cảnh Báo Tồn Kho - đưa lên stats grid */}
                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => setSelectedDetailView("lowStock")}
                        >
                            <div className="stat-icon-wrapper bg-danger-light">
                                <AlertTriangle size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Cảnh Báo Tồn Kho</p>
                                <div className="stat-value-group">
                                    <h3>{advanced?.lowStockMedicines?.length ?? 0}</h3>
                                    <span className="stat-trend trend-down">sản phẩm</span>
                                </div>
                            </div>
                        </div>

                        {/* Nhắc Tiêm Phòng - đưa lên stats grid */}
                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => navigate('/records?tab=vaccination')}
                        >
                            <div className="stat-icon-wrapper bg-warning-light">
                                <Syringe size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Nhắc Tiêm Phòng</p>
                                <div className="stat-value-group">
                                    <h3>{advanced?.upcomingVaccinations?.length ?? 0}</h3>
                                    <span className="stat-trend trend-up">lịch sắp tới</span>
                                </div>
                            </div>
                        </div>

                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => setSelectedDetailView("revenue")}
                        >
                            <div className="stat-icon-wrapper bg-success-light">
                                <DollarSign size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Doanh Thu</p>
                                <div className="stat-value-group">
                                    <h3>{formatCurrency(metrics?.periodRevenue)}đ</h3>
                                </div>
                            </div>
                        </div>

                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => setSelectedDetailView("clinicProfit")}
                        >
                            <div className="stat-icon-wrapper bg-info-light">
                                <ArrowUpRight size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Lợi Nhuận Dịch Vụ</p>
                                <div className="stat-value-group">
                                    <h3>{formatCurrency(metrics?.clinicProfit)}đ</h3>
                                </div>
                            </div>
                        </div>

                        <div
                            className="stat-card-v2 clickable-card"
                            onClick={() => setSelectedDetailView("inventoryProfit")}
                        >
                            <div className="stat-icon-wrapper bg-warning-light">
                                <Package size={28} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p className="stat-title">Lợi Nhuận Thuốc</p>
                                <div className="stat-value-group">
                                    <h3>{formatCurrency(metrics?.inventoryProfit)}đ</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- GIAI ĐOẠN 4: ADVANCED WIDGETS --- */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: "24px",
                            marginTop: "24px",
                            marginBottom: "24px",
                        }}
                    >
                        {/* 0. Lịch Trực Hôm Nay (Timeline style) */}
                        <div
                            className="glass-card"
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
                                border: "1px solid #bae6fd"
                            }}
                        >
                            <div className="flex-between mb-24">
                                <h3 className="flex-y-center" style={{ gap: "8px", fontSize: "1.1rem" }}>
                                    <Clock size={18} className="text-primary" />
                                    Phân Công Ca Trực Hôm Nay
                                </h3>
                            </div>
                            <div className="widget-list" style={{ flex: 1 }}>
                                {['DAY', 'EVENING', 'NIGHT'].map(sh => {
                                    const staffInShift = dutyStaff.data.filter(s => s.shift === sh);

                                    const shMeta = {
                                        DAY: { label: 'Ca Sáng (08:00 - 17:00)', icon: '☀️', color: '#f59e0b' },
                                        EVENING: { label: 'Ca Chiều (14:00 - 21:00)', icon: '🌅', color: '#0ea5e9' },
                                        NIGHT: { label: 'Ca Đêm (21:00 - 08:00)', icon: '🌙', color: '#6366f1' }
                                    }[sh];

                                    return (
                                        <div key={sh} style={{ marginBottom: '16px' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: shMeta.color, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                <span>{shMeta.icon}</span> {shMeta.label}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {staffInShift.length === 0 ? (
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Không có nhân sự</span>
                                                ) : staffInShift.map(s => (
                                                    <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                            {s.fullName?.[0]}
                                                        </div>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.fullName}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({s.role === 'DOCTOR' ? 'BS' : s.role === 'RECEPTIONIST' ? 'PT' : 'GR'})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => navigate('/schedule')}
                                style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '10px', border: '1px dashed #bae6fd', background: 'transparent', color: '#0284c7', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Xem Chi Tiết Lịch Tuần →
                            </button>
                        </div>
                        {/* 1. Top Khách Hàng VIP */}
                        <div
                            className="glass-card"
                            onClick={() => setSelectedDetailView("vipCustomers")}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                cursor: "pointer",
                            }}
                        >
                            <div className="flex-between mb-24">
                                <h3 className="flex-y-center" style={{ gap: "8px", fontSize: "1.1rem" }}>
                                    <Users size={18} className="text-primary" />
                                    Khách Hàng Thân Thiết
                                </h3>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePrintDirectWidget("vipCustomers"); }}
                                    className="btn-icon"
                                    title="In danh sách khách VIP"
                                    style={{ color: "var(--primary)" }}
                                >
                                    <Printer size={18} />
                                </button>
                            </div>
                            <div className="widget-list" style={{ flex: 1 }}>
                                {loading ? (
                                    <p className="text-muted text-center py-20">Đang tải...</p>
                                ) : advanced?.topCustomers?.length === 0 ? (
                                    <p className="text-muted text-center py-20">Chưa có dữ liệu</p>
                                ) : (
                                    advanced.topCustomers.slice(0, 5).map((cust, index) => (
                                        <div
                                            key={`vip-${index}`}
                                            className="flex-between"
                                            style={{
                                                padding: "12px 0",
                                                borderBottom: "1px solid #f1f5f9",
                                                gap: "12px",
                                            }}
                                        >
                                            <div style={{ width: "36px", textAlign: "center", display: "flex", justifyContent: "center" }}>
                                                {index === 0 ? (
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #fef08a 0%, #f59e0b 100%)", boxShadow: "0 4px 10px rgba(245, 158, 11, 0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <Crown size={18} color="#fff" fill="#fff" />
                                                    </div>
                                                ) : index === 1 ? (
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)", boxShadow: "0 4px 10px rgba(148, 163, 184, 0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <Award size={18} color="#fff" fill="#fff" />
                                                    </div>
                                                ) : index === 2 ? (
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #fed7aa 0%, #ea580c 100%)", boxShadow: "0 4px 10px rgba(234, 88, 12, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <Award size={18} color="#fff" fill="#fff" />
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--text-muted)", fontWeight: "700" }}>#{index + 1}</span>
                                                )}
                                            </div>
                                            <div className="flex-y-center" style={{ gap: "12px", flex: 1 }}>
                                                <div style={{ overflow: "hidden" }}>
                                                    <p style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--text-main)", margin: 0 }}>{cust.fullName || "Khách vãng lai"}</p>
                                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>{cust.phoneNumber || "---"}</p>
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: "700", color: "var(--success)", fontSize: "0.95rem" }}>
                                                {formatCurrency(cust.totalSpent)}đ
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 2. Hiệu Suất Nhân Viên */}
                        <div
                            className="glass-card"
                            onClick={() => setSelectedDetailView("staffPerformance")}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                cursor: "pointer",
                            }}
                        >
                            <div className="flex-between mb-24">
                                <h3 className="flex-y-center" style={{ gap: "8px", fontSize: "1.1rem" }}>
                                    <Activity size={18} className="text-primary" />
                                    Hiệu Suất Nhân Sự
                                </h3>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePrintDirectWidget("staffPerformance"); }}
                                    className="btn-icon"
                                    title="In báo cáo hiệu suất"
                                    style={{ color: "var(--primary)" }}
                                >
                                    <Printer size={18} />
                                </button>
                            </div>
                            <div className="widget-list" style={{ flex: 1 }}>
                                {loading ? (
                                    <p className="text-muted text-center py-20">Đang tải...</p>
                                ) : advanced?.staffPerformance?.length === 0 ? (
                                    <p className="text-muted text-center py-20">Chưa có dữ liệu</p>
                                ) : (
                                    advanced.staffPerformance.slice(0, 5).map((staff, index) => (
                                        <div
                                            key={`staff-${index}`}
                                            className="flex-between"
                                            style={{
                                                padding: "16px 12px",
                                                borderBottom: index < 4 ? "1px dashed #e2e8f0" : "none",
                                                background: index % 2 === 0 ? "transparent" : "#f8fafc",
                                                borderRadius: "8px",
                                                marginBottom: "4px"
                                            }}
                                        >
                                            <div style={{ flex: 1, paddingRight: "12px" }}>
                                                <p style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text-main)", margin: 0 }}>{staff.fullName}</p>
                                                <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                                    {staff.role === "DOCTOR" ? "Bác sĩ" : "Nhân viên"} • <span style={{ color: "var(--primary)" }}>{staff.invoiceCount} hóa đơn</span>
                                                </p>
                                            </div>
                                            <div style={{ fontWeight: "800", color: "var(--primary)", fontSize: "1rem" }}>
                                                {formatCurrency(staff.totalRevenue)}đ
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                    <div
                        className="dashboard-main-grid animate-slide-up"
                        style={{ animationDelay: "0.1s" }}
                    >
                        {/* CỘT TRÁI: 3 BIỂU ĐỒ */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {/* Khu vực Biểu Đồ */}
                            <div id="print-chart-revenue" className="glass-card chart-section">
                                <div className="card-header flex-between mb-24">
                                    <h3 style={{ fontSize: '1.1rem' }}>Hoạt Động Khám (7 Ngày)</h3>
                                    <button className="btn-icon" onClick={() => handlePrint("print-chart-revenue")} title="In biểu đồ">
                                        <Printer size={18} />
                                    </button>
                                </div>
                                <div style={{ width: "100%", height: 320 }}>
                                    {loading ? (
                                        <div className="flex-center" style={{ height: "100%" }}>
                                            Đang tải...
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={chartData}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                                                    tickFormatter={(value) => `${value / 1000}k`}
                                                />
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    vertical={false}
                                                    stroke="#eef2f5"
                                                />
                                                <Tooltip
                                                    formatter={(value) => [
                                                        `${formatCurrency(value)} đ`,
                                                        "Doanh Thu",
                                                    ]}
                                                    contentStyle={{
                                                        borderRadius: "12px",
                                                        border: "none",
                                                        boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="uv"
                                                    stroke="var(--primary)"
                                                    strokeWidth={3}
                                                    fillOpacity={0.15}
                                                    isAnimationActive={false}
                                                    fill="var(--primary)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Khu vực Biểu Đồ Tròn & Chi Nhánh (Có thể cho lên grid con nếu muốn) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                                {/* Biểu đồ tròn */}
                                <div id="print-chart-distribution" className="glass-card chart-section">
                                    <div className="card-header flex-between mb-24">
                                        <h3 style={{ fontSize: '1rem' }}>CƠ CẤU DOANH THU</h3>
                                        <button className="btn-icon" onClick={() => handlePrint("print-chart-distribution")} title="In">
                                            <Printer size={18} />
                                        </button>
                                    </div>
                                    <div style={{ width: "100%", height: 280 }}>
                                        {loading ? (
                                            <div className="flex-center" style={{ height: "100%" }}>
                                                Đang tải...
                                            </div>
                                        ) : revenueDistributionData.length === 0 ? (
                                            <p className="text-muted">Chưa có dữ liệu</p>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={revenueDistributionData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                                                        {revenueDistributionData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => [`${formatCurrency(value)} đ`, "Doanh Thu"]} />
                                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* CỘT PHẢI: LỊCH KHÁM SẮP TỚI */}
                        <div
                            className="glass-card recent-appointments"
                            style={{ display: "flex", flexDirection: "column", height: "100%" }}
                        >
                            <div className="card-header flex-between mb-24">
                                <h3 style={{ fontSize: '1.1rem' }}>LỊCH KHÁM SẮP TỚI</h3>
                                <button
                                    className="btn-link"
                                    onClick={() => setSelectedDetailView("upcomingAppointments")}
                                    style={{ color: "var(--primary)", fontWeight: "600", fontSize: "0.85rem" }}
                                >
                                    Xem tất cả
                                </button>
                            </div>
                            <div className="appointment-list" style={{ flex: 1 }}>
                                {loading ? (
                                    <div className="text-muted text-center py-20">Đang tải...</div>
                                ) : advanced?.upcomingAppointments?.length === 0 ? (
                                    <div className="text-muted text-center py-20">Chưa có lịch sắp tới.</div>
                                ) : (
                                    advanced.upcomingAppointments
                                        .slice(0, 8)
                                        .map((apt, index) => {
                                            const aptDate = new Date(apt.date);
                                            const now = new Date();
                                            // So sánh ngày theo giờ LOCAL của máy khách
                                            const toD = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                                            const isToday = toD(aptDate) === toD(now);
                                            const dateStr = isToday
                                                ? "Hôm nay"
                                                : aptDate.toLocaleDateString("vi-VN", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                });
                                            // Dùng timeSlot (chuỗi riêng "HH:MM") thay vì extract từ date UTC
                                            const timeStr = apt.timeSlot || aptDate.toLocaleTimeString("vi-VN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                            return (
                                                <div key={index} className="appointment-item" style={{ padding: '12px 0' }}>
                                                    <div
                                                        className="apt-time"
                                                        style={{ minWidth: "60px", textAlign: "center" }}
                                                    >
                                                        <strong
                                                            style={{
                                                                color: isToday ? "var(--success)" : "inherit",
                                                                fontSize: '0.9rem'
                                                            }}
                                                        >
                                                            {timeStr}
                                                        </strong>
                                                        <div
                                                            style={{
                                                                fontSize: "0.7rem",
                                                                color: isToday
                                                                    ? "var(--success)"
                                                                    : "var(--text-muted)",
                                                                fontWeight: isToday ? "600" : "normal",
                                                            }}
                                                        >
                                                            {dateStr}
                                                        </div>
                                                    </div>
                                                    <div className="apt-details" style={{ flex: 1 }}>
                                                        <h4 style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{apt.petId?.name || "Vô danh"}</h4>
                                                        <p style={{ fontSize: '0.75rem' }}>
                                                            {apt.customerId?.fullName || "Khách"} •{" "}
                                                            {apt.serviceId?.name || "Khám chung"}{" "}
                                                            {true
                                                                ? ""
                                                                : ""}
                                                        </p>
                                                    </div>
                                                    <div className="apt-status hide-on-mobile">
                                                        {getStatusBadge(apt.status)}
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* DETAIL VIEW MODAL / SECTION */}
            {
                selectedDetailView && (
                    <div className="detail-view-container animate-fade-in" style={{
                        position: 'relative',
                        width: '100%',
                        backgroundColor: 'var(--bg-main)',
                        padding: 'clamp(12px, 2vw, 24px)'
                    }}>
                        <div className="glass-card" style={{ maxWidth: '1400px', margin: '0 auto', background: '#fff', minHeight: 'calc(100vh - 120px)' }}>
                            <div
                                className="detail-header flex-between mb-24 hide-print"
                                style={{
                                    borderBottom: "1px solid var(--border-color)",
                                    padding: '1.5rem',
                                    flexWrap: "wrap",
                                    gap: "16px",
                                }}
                            >
                                <div
                                    style={{ display: "flex", alignItems: "center", gap: "12px" }}
                                >
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            setSelectedDetailView(null);
                                            setSearchTerm("");
                                        }}
                                        style={{ background: "#f1f5f9", color: "var(--text-main)" }}
                                        title="Quay lại"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <h2 style={{ fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', margin: 0 }}>
                                        {selectedDetailView === "revenue" && "Chi Tiết Doanh Thu"}
                                        {selectedDetailView === "clinicProfit" && "Chi Tiết Doanh Thu Dịch Vụ"}
                                        {selectedDetailView === "inventoryProfit" && "Báo Cáo Lợi Nhuận Thuốc"}
                                        {selectedDetailView === "newCustomers" && "Danh Sách Khách Hàng Mới"}
                                        {selectedDetailView === "appointments" && "Danh Sách Lịch Hẹn"}
                                        {selectedDetailView === "inpatientPets" && "Danh Sách Thú Cưng Nội Trú"}
                                        {selectedDetailView === "upcomingAppointments" && "Lịch Khám Sắp TớI"}
                                        {selectedDetailView === "vipCustomers" && "Khách Hàng VIP"}
                                        {selectedDetailView === "staffPerformance" && "Hiệu Suất Nhân Sự"}
                                        {selectedDetailView === "lowStock" && "Cần Nhập Hàng"}
                                        {selectedDetailView === "activityLog" && "Lịch Sử Hoạt Động Hệ Thống"}
                                    </h2>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        flex: "1 1 300px",
                                        justifyContent: "flex-end",
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "relative",
                                            flex: 1,
                                            maxWidth: "400px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: "12px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                color: "var(--text-muted)",
                                                display: "flex",
                                                alignItems: "center",
                                                pointerEvents: "none",
                                            }}
                                        >
                                            <Search size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm..."
                                            className="form-input"
                                            style={{
                                                width: "100%",
                                                padding: "12px 16px 12px 40px",
                                                borderRadius: "30px",
                                                border: "1px solid #cbd5e1",
                                                background: "#ffffff",
                                                color: "#334155",
                                                fontSize: "0.95rem",
                                                transition: "all 0.2s ease-in-out",
                                                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                                                outline: "none",
                                            }}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = "var(--primary)";
                                                e.target.style.boxShadow =
                                                    "0 0 0 4px rgba(3, 169, 244, 0.1)";
                                                e.target.style.background = "#fff";
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = "var(--border-color)";
                                                e.target.style.boxShadow =
                                                    "inset 0 2px 4px rgba(0,0,0,0.02)";
                                                e.target.style.background = "var(--bg-light)";
                                            }}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handlePrint()}
                                        style={{
                                            display: "flex",
                                            gap: "8px",
                                            whiteSpace: "nowrap",
                                            borderRadius: "30px",
                                            padding: "12px 24px",
                                            fontWeight: "500",
                                        }}
                                    >
                                        <Printer size={18} /> <span className="hide-on-mobile">In Báo Cáo</span>
                                    </button>
                                </div>
                            </div>


                            <div className="table-responsive">
                                {["revenue", "clinicProfit"].includes(selectedDetailView) ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Mã HĐ
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Ngày Giờ
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Khách Hàng
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    DV/Khám
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Tiền Thuốc
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Tổng Thu
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = metrics.periodInvoicesList?.filter((inv) => {
                                                    const search = searchTerm.toLowerCase();
                                                    const idMatch = inv._id?.toLowerCase().includes(search);
                                                    const nameMatch = inv.customerId?.fullName
                                                        ?.toLowerCase()
                                                        .includes(search);
                                                    return idMatch || nameMatch;
                                                });
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="6"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy dữ liệu.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((inv, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td style={{ padding: "12px" }} data-label="Mã HĐ">
                                                            {inv._id
                                                                ? inv._id
                                                                    .substring(inv._id.length - 6)
                                                                    .toUpperCase()
                                                                : "N/A"}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Ngày Giờ">
                                                            {new Date(inv.createdAt).toLocaleString("vi-VN")}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Khách Hàng">
                                                            {inv.customerId?.fullName || "Khách vãng lai"}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="DV/Khám">
                                                            {formatCurrency(inv.serviceTotal || 0)}đ
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Tiền Thuốc">
                                                            {formatCurrency(inv.medicineTotal || 0)}đ
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "bold",
                                                                color: "var(--success)",
                                                            }}
                                                            data-label="Tổng Thu"
                                                        >
                                                            {formatCurrency(inv.finalTotal || 0)}đ
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "newCustomers" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Họ Tên
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Ngày Tham Gia
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Số Điện Thoại
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Email
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = metrics.newCustomersList?.filter((item) => {
                                                    const search = searchTerm.toLowerCase();
                                                    return (
                                                        item.fullName?.toLowerCase().includes(search) ||
                                                        item.phoneNumber?.toLowerCase().includes(search) ||
                                                        item.email?.toLowerCase().includes(search)
                                                    );
                                                });
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="4"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy khách hàng.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td style={{ padding: "12px", fontWeight: "500" }} data-label="Họ Tên">
                                                            {item.fullName}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Ngày Tham Gia">
                                                            {new Date(item.createdAt).toLocaleString("vi-VN")}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Số Điện Thoại">
                                                            {item.phoneNumber}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Email">
                                                            {item.email || "N/A"}
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "appointments" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Ngày Giờ Khám
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Khách Hàng (SĐT)
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Thú Cưng
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Dịch Vụ Đặt
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Trạng Thái
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = metrics.appointmentsList?.filter((item) => {
                                                    const search = searchTerm.toLowerCase();
                                                    return (
                                                        item.customerId?.fullName
                                                            ?.toLowerCase()
                                                            .includes(search) ||
                                                        item.customerId?.phoneNumber
                                                            ?.toLowerCase()
                                                            .includes(search) ||
                                                        item.petId?.name?.toLowerCase().includes(search)
                                                    );
                                                });
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="5"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy lịch hẹn.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td style={{ padding: "12px" }} data-label="Ngày Giờ Khám">
                                                            {new Date(item.date).toLocaleString("vi-VN")}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Khách Hàng (SĐT)">
                                                            {item.customerId?.fullName || "Khách vãng lai"}{" "}
                                                            {item.customerId?.phoneNumber &&
                                                                `(${item.customerId.phoneNumber})`}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "500",
                                                                color: "var(--primary)",
                                                            }}
                                                            data-label="Thú Cưng"
                                                        >
                                                            {item.petId?.name || "Vô danh"}{" "}
                                                            {item.petId?.species && `(${item.petId.species})`}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Dịch Vụ Đặt">
                                                            {item.serviceId?.name || "Khám chung"}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Trạng Thái">
                                                            {getStatusBadge(item.status)}
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "inpatientPets" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Tên Thú Cưng
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Giống / Loài
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Khách Hàng Đăng Ký
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Thời Gian Bắt Đầu Khám / Nhập Viện
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = metrics.inpatientPetsList?.filter((item) => {
                                                    const search = searchTerm.toLowerCase();
                                                    return (
                                                        item.petId?.name?.toLowerCase().includes(search) ||
                                                        item.customerId?.fullName
                                                            ?.toLowerCase()
                                                            .includes(search) ||
                                                        item.customerId?.phoneNumber
                                                            ?.toLowerCase()
                                                            .includes(search)
                                                    );
                                                });
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="4"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy thú cưng nội trú.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "bold",
                                                                color: "var(--primary)",
                                                            }}
                                                            data-label="Tên Thú Cưng"
                                                        >
                                                            {item.petId?.name || "N/A"}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Giống / Loài">
                                                            {item.petId?.species || "N/A"}{" "}
                                                            {item.petId?.weight && `(${item.petId.weight} kg)`}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Khách Hàng Đăng Ký">
                                                            {item.customerId?.fullName || "N/A"}{" "}
                                                            {item.customerId?.phoneNumber &&
                                                                `(${item.customerId.phoneNumber})`}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Thời Gian">
                                                            {new Date(item.date).toLocaleString("vi-VN")}
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "inventoryProfit" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Mã HĐ
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Khách Hàng
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Ngày Giờ
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Doanh Thu Thuốc
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Vốn Nhập Nhóm Thuốc
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Lợi Nhuận
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = metrics.inventoryProfitDetails?.filter(
                                                    (item) => {
                                                        const search = searchTerm.toLowerCase();
                                                        return (
                                                            item.invoiceId?.toLowerCase().includes(search) ||
                                                            item.customerName?.toLowerCase().includes(search)
                                                        );
                                                    },
                                                );
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="6"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy giao dịch.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td style={{ padding: "12px" }} data-label="Mã HĐ">
                                                            {item.invoiceId
                                                                ? item.invoiceId
                                                                    .substring(item.invoiceId.length - 6)
                                                                    .toUpperCase()
                                                                : "N/A"}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Khách Hàng">
                                                            {item.customerName}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Ngày Giờ">
                                                            {new Date(item.createdAt).toLocaleString("vi-VN")}
                                                        </td>
                                                        <td style={{ padding: "12px", color: "var(--info)" }} data-label="Doanh Thu Thuốc">
                                                            {formatCurrency(item.medicineRevenue || 0)}đ
                                                        </td>
                                                        <td
                                                            style={{ padding: "12px", color: "var(--danger)" }}
                                                            data-label="Vốn Nhập"
                                                        >
                                                            {formatCurrency(item.medicineCost || 0)}đ
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "bold",
                                                                color: "var(--success)",
                                                            }}
                                                            data-label="Lợi Nhuận"
                                                        >
                                                            {formatCurrency(item.profit || 0)}đ
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "upcomingAppointments" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Giờ Khám
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Khách Hàng
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Thú Cưng
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Dịch Vụ
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Trạng Thái
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = advanced.upcomingAppointments?.filter(
                                                    (item) => {
                                                        const search = searchTerm.toLowerCase();
                                                        return (
                                                            item.customerId?.fullName
                                                                ?.toLowerCase()
                                                                .includes(search) ||
                                                            item.petId?.name?.toLowerCase().includes(search) ||
                                                            item.customerId?.phoneNumber
                                                                ?.toLowerCase()
                                                                .includes(search)
                                                        );
                                                    },
                                                );
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="5"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy lịch khám sắp tới.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => {
                                                    const aptDate = new Date(item.date);
                                                    const timeStr = aptDate.toLocaleTimeString("vi-VN", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    });
                                                    const dateStr = aptDate.toLocaleDateString("vi-VN");
                                                    return (
                                                        <tr
                                                            key={idx}
                                                            style={{ borderBottom: "1px solid #e1e8ed" }}
                                                        >
                                                            <td style={{ padding: "12px", fontWeight: "bold" }} data-label="Giờ Khám">
                                                                {timeStr}{" "}
                                                                <span
                                                                    style={{
                                                                        fontSize: "0.8rem",
                                                                        color: "var(--text-muted)",
                                                                        fontWeight: "normal",
                                                                    }}
                                                                >
                                                                    {dateStr}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: "12px" }} data-label="Khách Hàng">
                                                                {item.customerId?.fullName || "Khách vãng lai"}
                                                            </td>
                                                            <td style={{ padding: "12px" }} data-label="Thú Cưng">
                                                                {item.petId?.name || "Vô danh"}
                                                            </td>
                                                            <td style={{ padding: "12px" }} data-label="Dịch Vụ">
                                                                {item.serviceId?.name || "Khám chung"}
                                                            </td>
                                                            <td style={{ padding: "12px" }} data-label="Trạng Thái">
                                                                {getStatusBadge(item.status)}
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "vipCustomers" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>STT</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Tên Khách Hàng</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Số Điện Thoại</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Số Lần Ghé</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Tổng Chi Tiêu</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Điểm Tích Lũy</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = advanced.topCustomers?.filter((item) => {
                                                    const search = searchTerm.toLowerCase();
                                                    return (
                                                        item.fullName?.toLowerCase().includes(search) ||
                                                        item.phoneNumber?.toLowerCase().includes(search)
                                                    );
                                                });
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                                                                Không tìm thấy khách hàng.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => {
                                                    const spent = item.totalSpent || 0;
                                                    const points = Math.floor(spent / 1000);

                                                    return (
                                                        <tr key={idx} style={{ borderBottom: "1px solid #e1e8ed" }}>
                                                            <td style={{ padding: "12px", textAlign: "center" }} data-label="STT">
                                                                {idx + 1}
                                                            </td>
                                                            <td style={{ padding: "12px", fontWeight: "bold" }} data-label="Tên Khách Hàng">
                                                                {item.fullName || "Khách vãng lai"}
                                                            </td>
                                                            <td style={{ padding: "12px" }} data-label="Số Điện Thoại">
                                                                {item.phoneNumber || "N/A"}
                                                            </td>
                                                            <td style={{ padding: "12px", textAlign: "center" }} data-label="Số Lần Ghé">
                                                                {item.visitCount || 0}
                                                            </td>
                                                            <td style={{ padding: "12px", fontWeight: "bold", color: "var(--success)" }} data-label="Tổng Chi Tiêu">
                                                                {formatCurrency(item.totalSpent)} đ
                                                            </td>
                                                            <td style={{ padding: "12px" }} data-label="Điểm Tích Lũy">
                                                                <span style={{
                                                                    padding: "4px 8px",
                                                                    borderRadius: "4px",
                                                                    fontSize: "12px",
                                                                    background: idx === 0 ? "#fff7ed" : "#f8fafc",
                                                                    color: idx < 3 ? "#ea580c" : "#64748b",
                                                                    border: idx === 0 ? "1px solid #ffedd5" : "1px solid #e2e8f0",
                                                                    fontWeight: "bold"
                                                                }}>
                                                                    {formatCurrency(points)} điểm
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "staffPerformance" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Nhân Sự
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Vai Trò
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Số Lượng Hóa Đơn
                                                </th>
                                                <th
                                                    style={{
                                                        padding: "12px",
                                                        borderBottom: "2px solid #e1e8ed",
                                                    }}
                                                >
                                                    Doanh Thu Mang Về
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = advanced.staffPerformance?.filter((item) => {
                                                    const search = searchTerm.toLowerCase();
                                                    return item.fullName?.toLowerCase().includes(search);
                                                });
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="4"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy nhân sự.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "bold",
                                                                color: "var(--text-main)",
                                                            }}
                                                            data-label="Nhân Sự"
                                                        >
                                                            {item.fullName}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Vai Trò">
                                                            {item.role === "DOCTOR"
                                                                ? "Bác sĩ"
                                                                : item.role === "STAFF"
                                                                    ? "Thu ngân/Lễ tân"
                                                                    : item.role}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Số HĐ">
                                                            {item.invoiceCount}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "bold",
                                                                color: "var(--primary)",
                                                            }}
                                                            data-label="Doanh Thu"
                                                        >
                                                            {formatCurrency(item.totalRevenue)} đ
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : selectedDetailView === "lowStock" ? (
                                    <table
                                        className="table table-mobile-cards"
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            textAlign: "left",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                background: "var(--bg-main)",
                                                color: "var(--text-muted)",
                                            }}
                                        >
                                            <tr>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed", textAlign: "center", width: "50px" }}>STT</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Tên Sản Phẩm</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Danh Mục</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed", textAlign: "right" }}>Tồn Kho</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Đơn Vị</th>
                                                <th style={{ padding: "12px", borderBottom: "2px solid #e1e8ed" }}>Chi Nhánh</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = advanced.lowStockMedicines?.filter(
                                                    (item) => {
                                                        const search = searchTerm.toLowerCase();
                                                        return (
                                                            item.name?.toLowerCase().includes(search) ||
                                                            item.category?.toLowerCase().includes(search)
                                                        );
                                                    },
                                                );
                                                if (!list || list.length === 0)
                                                    return (
                                                        <tr>
                                                            <td
                                                                colSpan="6"
                                                                style={{ textAlign: "center", padding: "20px" }}
                                                            >
                                                                Không tìm thấy sản phẩm sắp hết.
                                                            </td>
                                                        </tr>
                                                    );
                                                return list.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ borderBottom: "1px solid #e1e8ed" }}
                                                    >
                                                        <td style={{ padding: "12px", textAlign: "center" }} data-label="STT">
                                                            {idx + 1}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "600",
                                                                color: "var(--text-main)",
                                                            }}
                                                            data-label="Sản Phẩm"
                                                        >
                                                            {item.name}
                                                        </td>
                                                        <td style={{ padding: "12px" }} data-label="Danh Mục">
                                                            <span
                                                                style={{
                                                                    fontSize: "0.8rem",
                                                                    padding: "4px 8px",
                                                                    background: "var(--bg-light)",
                                                                    borderRadius: "4px",
                                                                    color: "var(--text-muted)",
                                                                }}
                                                            >
                                                                {item.category}
                                                            </span>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                fontWeight: "bold",
                                                                textAlign: "right",
                                                                color:
                                                                    item.stockQuantity < 5
                                                                        ? "var(--danger)"
                                                                        : "var(--warning)",
                                                                fontSize: "1.2rem",
                                                            }}
                                                            data-label="Tồn Kho"
                                                        >
                                                            {item.stockQuantity}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                color: "var(--text-muted)",
                                                            }}
                                                            data-label="Đơn Vị"
                                                        >
                                                            {item.unit}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px",
                                                                color: "var(--text-muted)",
                                                            }}
                                                            data-label="Chi Nhánh"
                                                        >
                                                            {"Hệ Thống"}
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                ) : null}
                            </div>

                            {/* ── ACTIVITY LOG PANEL ── */}
                            {selectedDetailView === 'activityLog' && (() => {
                                // Fetch on mount and when date/filter changes
                                // We use a useEffect equivalent via inline logic + a separate effect
                                return null; // placeholder — real content rendered by component below
                            })()}
                            {selectedDetailView === 'activityLog' && (
                                <ActivityLogPanel
                                    actDate={actDate} setActDate={setActDate}
                                    actFilter={actFilter} setActFilter={setActFilter}
                                    actLogs={actLogs} setActLogs={setActLogs}
                                    actLoading={actLoading} setActLoading={setActLoading}
                                    actTotal={actTotal} setActTotal={setActTotal}
                                />
                            )}

                            {/* Chân trang đã được xử lý bởi printService.js */}
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

// ── Activity Log Panel Component ──────────────────────────────────────────────
function ActivityLogPanel({ actDate, setActDate, actFilter, setActFilter, actLogs, setActLogs, actLoading, setActLoading, actTotal, setActTotal }) {
    const token = sessionStorage.getItem('token');

    React.useEffect(() => {
        const fetchLogs = async () => {
            setActLoading(true);
            try {
                const params = { limit: 100 };
                if (actDate) params.date = actDate;
                if (actFilter) params.action = actFilter;
                const res = await axios.get(`${API}/activity-logs`, {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setActLogs(res.data.data);
                    setActTotal(res.data.total);
                }
            } catch (e) {
                console.error('ActivityLog fetch error:', e.message);
            } finally {
                setActLoading(false);
            }
        };
        fetchLogs();
    }, [actDate, actFilter]);

    const ACTION_META = {
        LOGIN: { label: 'Đăng nhập', color: '#0284c7', bg: '#e0f2fe' },
        LOGOUT: { label: 'Đăng xuất', color: '#64748b', bg: '#f1f5f9' },
        CREATE_APPOINTMENT: { label: 'Tạo lịch hẹn', color: '#16a34a', bg: '#dcfce7' },
        CANCEL_APPOINTMENT: { label: 'Hủy lịch hẹn', color: '#dc2626', bg: '#fee2e2' },
        CANCEL_APPOINTMENT_BY_CUSTOMER: { label: 'Khách tự hủy', color: '#dc2626', bg: '#fee2e2' },
        AUTO_CANCEL_NO_SHOW: { label: 'Auto hủy no-show', color: '#7c3aed', bg: '#ede9fe' },
        LATE_WARNING_SENT: { label: 'Cảnh báo trễ hẹn', color: '#ea580c', bg: '#fff7ed' },
        COMPLETE_APPOINTMENT: { label: 'Hoàn tất ca', color: '#16a34a', bg: '#dcfce7' },
        ACCEPT_APPOINTMENT: { label: 'Nhận ca', color: '#0891b2', bg: '#cffafe' },
        CHECKIN_APPOINTMENT: { label: 'Check-in', color: '#0369a1', bg: '#e0f2fe' },
        PROPOSE_RESCHEDULE: { label: 'Đề xuất đổi lịch', color: '#d97706', bg: '#fef3c7' },
        ACCEPT_RESCHEDULE: { label: 'Đồng ý đổi lịch', color: '#16a34a', bg: '#dcfce7' },
        REJECT_RESCHEDULE: { label: 'Từ chối đổi lịch', color: '#dc2626', bg: '#fee2e2' },
        ASSIGN_STAFF: { label: 'Phân công NV', color: '#7c3aed', bg: '#ede9fe' },
        CREATE_INVOICE: { label: 'Tạo hóa đơn', color: '#0f766e', bg: '#ccfbf1' },
        UPDATE_APPOINTMENT: { label: 'Cập nhật lịch', color: '#475569', bg: '#f1f5f9' },
    };

    const ROLE_LABEL = { ADMIN: 'Admin', DOCTOR: 'Bác sĩ', RECEPTIONIST: 'Lễ tân', GROOMER: 'Groomer', CUSTOMER: 'Khách', SYSTEM: 'Hệ thống' };
    const ROLE_COLOR = { ADMIN: '#7c3aed', DOCTOR: '#0284c7', RECEPTIONIST: '#0f766e', GROOMER: '#d97706', CUSTOMER: '#475569', SYSTEM: '#6b7280' };

    const fmtTime = (d) => {
        const dt = new Date(d);
        return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const FILTER_ACTIONS = ['', 'AUTO_CANCEL_NO_SHOW', 'LATE_WARNING_SENT', 'CANCEL_APPOINTMENT', 'CREATE_APPOINTMENT', 'COMPLETE_APPOINTMENT', 'LOGIN'];
    const FILTER_LABELS  = ['Tất cả', 'Auto hủy', 'Cảnh báo trễ', 'Hủy lịch', 'Tạo lịch', 'Hoàn tất', 'Đăng nhập'];

    return (
        <div style={{ padding: '24px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px' }}>
                    <Calendar size={15} color="var(--primary)" />
                    <input type="date" value={actDate} onChange={e => setActDate(e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {FILTER_ACTIONS.map((a, i) => (
                        <button key={a} onClick={() => setActFilter(a)}
                            style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                borderColor: actFilter === a ? 'var(--primary)' : '#e2e8f0',
                                background: actFilter === a ? 'var(--primary)' : 'white',
                                color: actFilter === a ? 'white' : 'var(--text-muted)' }}>
                            {FILTER_LABELS[i]}
                        </button>
                    ))}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {actTotal} bản ghi
                </span>
            </div>

            {/* Table */}
            {actLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải...</div>
            ) : actLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    <FileText size={40} style={{ opacity: 0.2, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600 }}>Không có hoạt động nào trong ngày này</div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Thời gian</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tác nhân</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Hành động</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Mô tả</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actLogs.map((log, i) => {
                                const actor = log.userId;
                                const isSystem = !actor || actor._id === '000000000000000000000001' || log.description?.startsWith('[Hệ thống]');
                                const actorName = isSystem ? 'Hệ thống' : (actor?.fullName || 'N/A');
                                const actorRole = isSystem ? 'SYSTEM' : (actor?.role || '');
                                const meta = ACTION_META[log.action] || { label: log.action, color: '#475569', bg: '#f1f5f9' };
                                return (
                                    <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                            {fmtTime(log.createdAt)}
                                        </td>
                                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{actorName}</div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: ROLE_COLOR[actorRole] || '#64748b' }}>
                                                {ROLE_LABEL[actorRole] || actorRole}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: meta.bg, color: meta.color }}>
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-main)', fontSize: '0.83rem', maxWidth: '500px' }}>
                                            {log.description}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default Dashboard;

