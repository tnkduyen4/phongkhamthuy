const webpush = require('web-push');

// Cấu hình VAPID keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:admin@vetcare.com', // Thay bằng email thật của bạn
        publicVapidKey,
        privateVapidKey
    );
}

/**
 * @desc    Gửi thông báo Push đến một danh sách các subscription
 * @param   {Array} subscriptions - Danh sách các subscription của User
 * @param   {Object} payload - Dữ liệu thông báo (title, body, url, icon)
 */
const sendPushNotification = async (subscriptions, payload) => {
    if (!subscriptions || subscriptions.length === 0) return;

    const payloadString = JSON.stringify(payload);

    const pushPromises = subscriptions.map(subscription => {
        return webpush.sendNotification(subscription, payloadString)
            .catch(err => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log('Subscription đã hết hạn hoặc không tồn tại. Nên xóa khỏi DB.');
                    // TODO: Logic xóa subscription lỗi khỏi DB
                } else {
                    console.error('Lỗi khi gửi Push:', err);
                }
            });
    });

    await Promise.all(pushPromises);
};

module.exports = {
    sendPushNotification
};
