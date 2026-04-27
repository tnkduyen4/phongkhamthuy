require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const { startAppointmentLateCron } = require('./src/jobs/appointmentLateCron');
const { startAttendanceCron } = require('./src/jobs/attendanceCron');

// Khởi động Database trực tiếp trong server.js
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vet_clinic_db';
        mongoose.set('strictPopulate', false); 
        await mongoose.connect(uri);
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        console.error(`❌ Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    // Khởi động cron jobs
    startAppointmentLateCron();
    startAttendanceCron();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
