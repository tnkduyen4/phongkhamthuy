import axios from 'axios';
import { API } from '../constants';

const VAPID_PUBLIC_KEY = 'BBQac1nF9i--9fvhcZYH26U93GatPXS7yS9SFsbv2CoyfT4ZgmyGNmEbtLbR-xRWDUtt-Si4vjXojzweZAkGW6E';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const subscribeUserToPush = async () => {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Trình duyệt không hỗ trợ Web Push.');
            return;
        }

        // 1. Đăng ký Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker đã đăng ký.');

        // 2. Chờ SW sẵn sàng
        await navigator.serviceWorker.ready;

        // 3. Yêu cầu quyền thông báo
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Người dùng từ chối quyền thông báo.');
            return;
        }

        // 4. Kiểm tra subscription hiện tại
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // 5. Tạo subscription mới
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        // 6. Gửi subscription lên Backend
        const token = sessionStorage.getItem('token');
        await axios.post(`${API}/notifications/subscribe`, subscription, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Đã đăng ký Web Push thành công trên thiết bị này.');
    } catch (error) {
        console.error('Lỗi khi đăng ký Web Push:', error);
    }
};
