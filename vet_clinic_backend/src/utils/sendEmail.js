const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Khởi tạo transporter (cấu hình dịch vụ email)
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Sử dụng Gmail (bạn có thể đổi theo nhà cung cấp)
        auth: {
            user: process.env.EMAIL_USER, // Địa chỉ email của bạn
            pass: process.env.EMAIL_PASS  // Mật khẩu ứng dụng (App Password)
        }
    });

    // 2. Định nghĩa nội dung email
    const mailOptions = {
        from: `VetCare System <${process.env.EMAIL_USER || 'no-reply@vetcare.local'}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    // Nếu bạn muốn test mà chưa có email thật, nó sẽ không lỗi vòng ngoài
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ EMAIL_USER hoặc EMAIL_PASS chưa được cài đặt trong .env. In nội dung email ra console thay thế cho việc gửi thật:');
        console.log(`[TO: ${options.email}] [SUBJECT: ${options.subject}]\n${options.message}`);
        return; // Dừng lại ở đây nếu không có cấu hình
    }

    // 3. Gửi email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
