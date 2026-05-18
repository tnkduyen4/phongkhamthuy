import axios from 'axios';
const API = 'https://vet-clinic-backend-tgtd.onrender.com/api/v1';

/**
 * Tách riêng hàm upload Base64 sang Cloudinary
 * giúp tiết kiệm dụng lượng cho MongoDB
 */
export const uploadBase64ToCloudinary = async (base64String) => {
    try {
        // Nếu ảnh lấy về vốn đã là link HTTP (đã upload rồi) thì ko cần upload lại, trả về luôn
        if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
            return base64String;
        }

        const res = await fetch(base64String);
        const blob = await res.blob();
        const formData = new FormData();
        // Generate a random numeric filename with timestamp
        formData.append('image', blob, `face_auth_${Date.now()}.jpg`);
        
        const token = sessionStorage.getItem('token');
        const uploadRes = await axios.post(`${API}/upload`, formData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (uploadRes.data.success) {
            return uploadRes.data.data.imageUrl; // Trả về link CDN
        }
        throw new Error('Tải ảnh thất bại (Backend trả về lỗi)');
    } catch (e) {
        console.error("Lỗi Upload Cloudinary:", e);
        throw new Error('Lỗi tải ảnh lên hệ thống lưu trữ đám mây.');
    }
};
