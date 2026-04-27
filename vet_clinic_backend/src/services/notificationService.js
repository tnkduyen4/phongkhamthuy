const axios = require('axios');

/**
 * @desc    Gửi thông báo khẩn cấp qua Telegram
 * @param   {Object} data - Dữ liệu thông báo (title, message, type)
 */
const sendTelegramAlert = async (data) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            console.log('TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID chưa được cấu hình. Bỏ qua gửi tin nhắn.');
            return;
        }

        const text = `
🚨 *THÔNG BÁO CẤP CỨU KHẨN CẤP* 🚨
---------------------------------
📌 *Tiêu đề:* ${data.title}
📝 *Nội dung:* ${data.message}
🕒 *Thời gian:* ${new Date().toLocaleTimeString('vi-VN')}
🔗 [MỞ HỒ SƠ BỆNH ÁN](http://vetcare-clinic.com/records)
---------------------------------
⚠️ *Bác sĩ trực vui lòng kiểm tra ngay!*
        `;

        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });

        console.log('Đã gửi thông báo cấp cứu qua Telegram.');
    } catch (error) {
        console.error('Lỗi khi gửi thông báo Telegram:', error.message);
    }
};

module.exports = {
    sendTelegramAlert
};
