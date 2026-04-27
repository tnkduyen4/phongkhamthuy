const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Require models to verify DB directly
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');
const Service = require('./src/models/Service');
const Appointment = require('./src/models/Appointment');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function runIntegrationTest() {
    let testCustomer, testPet, testService, testAppointment;
    console.log('--- STARTING VET CLINIC API INTEGRATION TEST ---');

    try {
        // 1. Kết nối DB
        console.log('[1/5] Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Tìm một Admin để tạo Token giả lập đăng nhập
        const admin = await User.findOne({ role: 'ADMIN' });
        if (!admin) {
            console.error('❌ Could not find an ADMIN user in the database. Cannot proceed.');
            process.exit(1);
        }
        
        // Tạo token
        const token = jwt.sign(
            { id: admin._id, role: admin.role, phone: admin.phoneNumber },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const axiosInstance = axios.create({
            baseURL: BASE_URL,
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log(`✅ Logged in as ADMIN (Phone: ${admin.phoneNumber})`);

        // ============================================
        // 3. Test Tạo Khách Hàng (Customer)
        // ============================================
        console.log('\n[2/5] Testing CREATE CUSTOMER API...');
        const customerData = {
            fullName: 'Test Customer Auto',
            phoneNumber: '0999888771',
            email: 'testcustomer1@example.com'
        };

        const cusRes = await axiosInstance.post('/users/quick-customer', customerData);
        if (cusRes.data.success) {
            console.log(`--> API trả về thành công: Tạo khách hàng _id=${cusRes.data.data._id}`);
            
            // KIỂM TRA MONGODB
            testCustomer = await User.findById(cusRes.data.data._id);
            if (testCustomer && testCustomer.fullName === 'Test Customer Auto') {
                console.log('✅ PASS: Khách hàng ĐÃ ĐƯỢC LƯU vào MongoDB thành công!');
            } else {
                console.error('❌ FAIL: Không tìm thấy khách hàng trong MongoDB.');
            }
        } else {
            console.error('❌ API Tạo Customer thất bại:', cusRes.data);
        }

        // ============================================
        // 4. Test Thêm Thú Cưng (Pet)
        // ============================================
        console.log('\n[3/5] Testing CREATE PET API...');
        const petData = {
            ownerId: testCustomer._id,
            name: 'Milo Auto',
            species: 'DOG',
            breed: 'Poodle',
            gender: 'MALE',
            age: 2,
            weight: 5
        };

        const petRes = await axiosInstance.post('/pets', petData);
        if (petRes.data.success) {
            console.log(`--> API trả về thành công: Thêm thú cưng _id=${petRes.data.data._id}`);
            
            // KIỂM TRA MONGODB
            testPet = await Pet.findById(petRes.data.data._id);
            if (testPet && testPet.name === 'Milo Auto') {
                console.log('✅ PASS: Thú cưng ĐÃ ĐƯỢC LƯU vào MongoDB thành công!');
            } else {
                console.error('❌ FAIL: Không tìm thấy thú cưng trong MongoDB.');
            }
        } else {
            console.error('❌ API Thêm Pet thất bại:', petRes.data);
        }

        // ============================================
        // 5. Test Thêm Dịch Vụ (Service)
        // ============================================
        console.log('\n[4/5] Testing CREATE SERVICE API...');
        const serviceData = {
            name: 'Khám Tổng Quát AutoTest',
            type: 'MEDICAL',
            price: 150000,
            estimatedDuration: 30
        };

        const srvRes = await axiosInstance.post('/services', serviceData);
        if (srvRes.data.success) {
            console.log(`--> API trả về thành công: Tạo dịch vụ _id=${srvRes.data.data._id}`);
            
            // KIỂM TRA MONGODB
            testService = await Service.findById(srvRes.data.data._id);
            if (testService && testService.name === 'Khám Tổng Quát AutoTest') {
                console.log('✅ PASS: Dịch vụ ĐÃ ĐƯỢC LƯU vào MongoDB thành công!');
            } else {
                console.error('❌ FAIL: Không tìm thấy dịch vụ trong MongoDB.');
            }
        } else {
            console.error('❌ API Thêm Service thất bại:', srvRes.data);
        }

        // ============================================
        // 6. Test Đặt Lịch Hẹn (Appointment)
        // ============================================
        console.log('\n[5/5] Testing CREATE APPOINTMENT API...');
        const appointmentData = {
            customerId: testCustomer._id,
            petId: testPet._id,
            serviceId: testService._id,
            type: 'MEDICAL',
            bookingSource: 'CUSTOMER_APP',
            date: new Date().toISOString().split('T')[0], // Hôm nay yyyy-mm-dd
            timeSlot: '10:00 - 10:30',
            customerNotes: 'Auto test appointment'
        };

        const apptRes = await axiosInstance.post('/appointments', appointmentData);
        if (apptRes.data.success) {
            console.log(`--> API trả về thành công: Tạo lịch hẹn _id=${apptRes.data.data._id}`);
            
            // KIỂM TRA MONGODB
            testAppointment = await Appointment.findById(apptRes.data.data._id);
            if (testAppointment && testAppointment.customerNotes === 'Auto test appointment') {
                console.log('✅ PASS: Lịch hẹn ĐÃ ĐƯỢC LƯU vào MongoDB thành công!');
            } else {
                console.error('❌ FAIL: Không tìm thấy lịch hẹn trong MongoDB.');
            }
        } else {
            console.error('❌ API Đặt lịch hẹn thất bại:', apptRes.data);
        }

    } catch (err) {
        console.error('\n❌ CÓ LỖI CHƯƠNG TRÌNH HOẶC API:');
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.dir(err);
        }
    } finally {
        // ============================================
        // 7. Dọn dẹp Database
        // ============================================
        console.log('\n--- CLEANING UP TEST DATA ---');
        if (testAppointment) {
            await Appointment.findByIdAndDelete(testAppointment._id);
            console.log('🗑️ Deleted test Appointment');
        }
        if (testService) {
            await Service.findByIdAndDelete(testService._id);
            console.log('🗑️ Deleted test Service');
        }
        if (testPet) {
            await Pet.findByIdAndDelete(testPet._id);
            console.log('🗑️ Deleted test Pet');
        }
        if (testCustomer) {
            await User.findByIdAndDelete(testCustomer._id);
            console.log('🗑️ Deleted test Customer');
        }
        
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB. TEST FINISHED!');
    }
}

runIntegrationTest();
