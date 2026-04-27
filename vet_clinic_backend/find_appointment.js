const mongoose = require('mongoose');
require('dotenv').config();

const Appointment = require('./src/models/Appointment');
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');

async function findRecentAppointments() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('Đang tìm các lịch hẹn gần đây nhất trong MongoDB...');
        
        // Tìm lịch hẹn mới tạo gần nhất
        const appointments = await Appointment.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('customerId', 'fullName')
            .populate('petId', 'name');

        if (appointments.length === 0) {
            console.log('Không có lịch hẹn nào lưu trong Database!');
        } else {
            console.log('--- DANH SÁCH 5 LỊCH HẸN MỚI NHẤT MỚI TẠO TRONG DB ---');
            appointments.forEach(app => {
                const customerName = app.customerId ? app.customerId.fullName : 'Không rõ';
                const petName = app.petId ? app.petId.name : 'Không rõ';
                console.log(`- ID MongoDB: ${app._id}`);
                console.log(`  + Khách: ${customerName} | Thú cưng: ${petName}`);
                console.log(`  + Ngày hẹn: ${app.date.toLocaleDateString('vi-VN')} | Giờ: ${app.timeSlot}`);
                console.log(`  + Tạo lúc: ${app.createdAt.toLocaleString('vi-VN')}`);
                console.log('-------------------------');
            });
        }
    } catch (err) {
        console.error('Lỗi kết nối DB:', err);
    } finally {
        await mongoose.disconnect();
    }
}

findRecentAppointments();
