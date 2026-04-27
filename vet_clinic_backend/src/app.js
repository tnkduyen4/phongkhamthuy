const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Rate Limiting ────────────────────────────────────────────────────────────

// Giới hạn API chung: 200 request/phút
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 phút
    max: 200,
    message: { success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(morgan('dev')); // log APIs requests
app.use('/api/', generalLimiter);          // Áp dụng chung cho mọi API

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Vet Clinic API is running properly' });
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const medicalRecordRoutes = require('./routes/medicalRecordRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productRoutes = require('./routes/productRoutes');
const hrmRoutes = require('./routes/hrmRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const groomingRoutes = require('./routes/groomingRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const vaccinationRoutes = require('./routes/vaccinationRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Định nghĩa API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/pets', petRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/records', medicalRecordRoutes);
app.use('/api/v1/upload', uploadRoutes); // Dùng cho Cloudinary
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/hrm', hrmRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/grooming', groomingRoutes);
app.use('/api/v1/activity-logs', activityLogRoutes);
app.use('/api/v1/vaccinations', vaccinationRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/chat', chatRoutes);

app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('--- 🚨 GLOBAL ERROR CAUGHT 🚨 ---');
    console.error('Type:', err.constructor.name);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.dir(err, { depth: null, colors: true });
    
    res.status(err.status || 500).json({ 
        success: false, 
        message: 'Lỗi hệ thống: ' + (err.message || 'Lỗi không xác định'),
        detail: err.message
    });
});

module.exports = app;
