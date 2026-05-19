/**
 * faceVerify.js — Nhận diện & so sánh khuôn mặt dùng face-api.js
 * Models tải từ CDN jsdelivr (~10MB), cache lại sau lần đầu.
 */
import * as faceapi from 'face-api.js';

// Dùng model local (public/weights/) — đã tải sẵn, không phụ thuộc CDN
const MODEL_URL = '/weights';

let modelsLoaded   = false;
let modelLoadPromise = null;

// ─── Load models (chỉ tải 1 lần, gọi nhiều lần an toàn) ───────────────────
export const loadFaceModels = (onProgress) => {
    if (modelsLoaded) return Promise.resolve();
    if (modelLoadPromise)  return modelLoadPromise;

    modelLoadPromise = (async () => {
        try {
            onProgress?.('Đang tải mô hình phát hiện khuôn mặt...');
            await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);

            onProgress?.('Đang tải mô hình điểm nhận dạng...');
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

            onProgress?.('Đang tải mô hình nhận diện...');
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

            modelsLoaded = true;
            onProgress?.(null); // xong
        } catch (err) {
            console.error('[faceVerify.js] model load error:', err);
            modelLoadPromise = null; // cho phép thử lại
            throw new Error('Tải mô hình AI thất bại. Kiểm tra kết nối mạng.');
        }
    })();

    return modelLoadPromise;
};

// ─── Trích descriptor từ element (img / canvas / video) ───────────────────
const getDescriptor = async (element) => {
    const det = await faceapi
        .detectSingleFace(element, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    return det?.descriptor ?? null;
};

// ─── Tải ảnh từ URL về <img> element ──────────────────────────────────────
const loadImage = (url) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Không thể tải ảnh mẫu từ hồ sơ'));
        img.src = url;
    });

/**
 * So sánh ảnh mẫu (URL) với ảnh vừa chụp (Canvas element).
 * @returns {{ success: boolean, score: number, message: string }}
 *   score: 0–1 (1 = giống hoàn toàn)
 *   success: true nếu score >= THRESHOLD
 */
export const verifyFace = async (referencePhotoUrl, capturedCanvas) => {
    const THRESHOLD = 0.55; // khoảng cách euclidean ≤ 0.45 → score ≥ 0.55 → pass

    // 1. Load ảnh mẫu
    let refImg;
    try {
        refImg = await loadImage(referencePhotoUrl);
    } catch {
        return { success: false, score: 0, message: 'Không thể tải ảnh mẫu. Kiểm tra ảnh hồ sơ của bạn.' };
    }

    // 2. Lấy descriptor ảnh mẫu
    const refDesc = await getDescriptor(refImg);
    if (!refDesc) {
        return {
            success: false, score: 0,
            message: 'Không nhận diện được khuôn mặt trong ảnh hồ sơ. Hãy cập nhật ảnh hồ sơ rõ mặt hơn.'
        };
    }

    // 3. Lấy descriptor ảnh chụp
    const capDesc = await getDescriptor(capturedCanvas);
    if (!capDesc) {
        return {
            success: false, score: 0,
            message: 'Không nhận diện được khuôn mặt trong ảnh vừa chụp. Vui lòng chụp lại rõ mặt hơn.'
        };
    }

    // 4. Tính khoảng cách euclidean (0 = giống hệt, > 0.6 = khác người)
    const distance = faceapi.euclideanDistance(refDesc, capDesc);
    const score    = Math.max(0, Math.min(1, 1 - distance));

    return {
        success: score >= THRESHOLD,
        score,
        distance,
        message: score >= THRESHOLD
            ? `Xác thực thành công (Khớp ${Math.round(score * 100)}%)`
            : `Khuôn mặt không khớp (${Math.round(score * 100)}%). Vui lòng thử lại.`
    };
};

// ─── Helpers kiểm tra chất lượng ảnh ─────────────────────────────────────────

/**
 * Tính độ sắc nét bằng Mean Absolute Laplacian (trên vùng face region).
 * Score > 2.5 = đủ sắc nét; < 2.5 = ảnh mờ/rung.
 */
const computeSharpness = (canvas, box) => {
    const ctx = canvas.getContext('2d');
    const { x, y, width: w, height: h } = box;
    // Expand face box 20% để lấy thêm viền
    const px = Math.max(0, Math.floor(x * 0.9));
    const py = Math.max(0, Math.floor(y * 0.9));
    const pw = Math.min(canvas.width  - px, Math.floor(w * 1.2));
    const ph = Math.min(canvas.height - py, Math.floor(h * 1.2));
    if (pw < 4 || ph < 4) return 999;

    const data = ctx.getImageData(px, py, pw, ph).data;
    const gray = new Float32Array(pw * ph);
    for (let i = 0; i < pw * ph; i++) {
        const p = i * 4;
        gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    let sum = 0, count = 0;
    for (let row = 1; row < ph - 1; row++) {
        for (let col = 1; col < pw - 1; col++) {
            const idx = row * pw + col;
            const lap = Math.abs(-4 * gray[idx]
                + gray[idx - 1] + gray[idx + 1]
                + gray[idx - pw] + gray[idx + pw]);
            sum += lap; count++;
        }
    }
    return count > 0 ? sum / count : 0;
};

/**
 * Tính độ sáng trung bình toàn ảnh (0–255).
 * Tối quá < 45, quá sáng > 215.
 */
const computeBrightness = (canvas) => {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / n;
};

/**
 * validateFacePhoto — Kiểm tra ảnh trước khi đăng ký FaceID
 *
 * Lớp bảo vệ:
 *  1. Phát hiện số khuôn mặt (threshold 0.25 để bắt cả mặt phụ xa, mờ phía sau)
 *  2. Không có mặt chính
 *  3. Nhiều hơn 1 người
 *  4. Độ sáng quá thấp / quá cao
 *  5. Confidence mặt chính < 0.72 (ảnh in, màn hình chiếu lại)
 *  6. Khuôn mặt quá nhỏ
 *  7. Bounding box sát biên (mặt bị cắt)
 *  8. Độ sắc nét (blur)
 *  9. Mặt nghiêng quá nhiều (landmark offset)
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ valid: boolean, message: string, faceCount?: number }}
 */
export const validateFacePhoto = async (canvas) => {
    // ── 1. Dùng threshold THẤP (0.25) để bắt khuôn mặt phụ phía sau ──────────
    const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
        .withFaceLandmarks();

    // ── 2. Không có mặt ───────────────────────────────────────────────────────
    if (detections.length === 0) {
        return {
            valid: false, faceCount: 0,
            message: 'Không phát hiện khuôn mặt. Hãy nhìn thẳng vào camera và đảm bảo đủ ánh sáng.'
        };
    }

    // ── 3. Nhiều hơn 1 người (kể cả người mờ phía sau) ───────────────────────
    if (detections.length > 1) {
        return {
            valid: false, faceCount: detections.length,
            message: `Phát hiện ${detections.length} khuôn mặt trong ảnh (có thể có người phía sau). Chỉ được có 1 người duy nhất trong khung hình.`
        };
    }

    const det        = detections[0];
    const confidence = det.detection.score;
    const box        = det.detection.box;
    const imgW       = canvas.width;
    const imgH       = canvas.height;

    // ── 4. Kiểm tra độ sáng ───────────────────────────────────────────────────
    const brightness = computeBrightness(canvas);
    if (brightness < 45) {
        return {
            valid: false, faceCount: 1,
            message: `Ảnh quá tối (độ sáng ${Math.round(brightness)}/255). Hãy chụp ở nơi có ánh sáng tốt hơn.`
        };
    }
    if (brightness > 215) {
        return {
            valid: false, faceCount: 1,
            message: 'Ảnh quá sáng / bị lóa. Hãy tránh nguồn sáng mạnh chiếu thẳng vào mặt.'
        };
    }

    // ── 5. Confidence thấp → ảnh in, màn hình chiếu lại, hoặc mờ nặng ─────────
    if (confidence < 0.72) {
        return {
            valid: false, faceCount: 1,
            message: `Chất lượng nhận diện thấp (${Math.round(confidence * 100)}%). Có thể là ảnh in, màn hình chiếu lại, hoặc thiếu sáng. Hãy chụp trực tiếp.`
        };
    }

    // ── 6. Khuôn mặt quá nhỏ ─────────────────────────────────────────────────
    const faceAreaRatio = (box.width * box.height) / (imgW * imgH);
    if (faceAreaRatio < 0.07) {
        return {
            valid: false, faceCount: 1,
            message: 'Khuôn mặt quá nhỏ trong ảnh. Hãy đứng gần camera hơn.'
        };
    }

    // ── 7. Bounding box sát biên → mặt bị cắt ────────────────────────────────
    const MARGIN = 0.03;
    if (
        box.x < imgW * MARGIN ||
        box.y < imgH * MARGIN ||
        (box.x + box.width)  > imgW * (1 - MARGIN) ||
        (box.y + box.height) > imgH * (1 - MARGIN)
    ) {
        return {
            valid: false, faceCount: 1,
            message: 'Khuôn mặt bị cắt ở cạnh ảnh. Hãy lùi ra hoặc căn giữa khuôn mặt trong khung.'
        };
    }

    // ── 8. Blur detection (Laplacian trên vùng mặt) ───────────────────────────
    const sharpness = computeSharpness(canvas, box);
    if (sharpness < 2.5) {
        return {
            valid: false, faceCount: 1,
            message: `Ảnh bị mờ (độ sắc nét ${sharpness.toFixed(1)}). Giữ nguyên tư thế, đảm bảo đủ sáng và không rung tay khi chụp.`
        };
    }

    // ── 9. Mặt nghiêng quá mức (landmark nose offset) ────────────────────────
    const lm       = det.landmarks.positions;
    const leftEye  = lm[36];
    const rightEye = lm[45];
    const noseTip  = lm[30];
    const eyeMidX  = (leftEye.x + rightEye.x) / 2;
    const eyeSpan  = Math.abs(rightEye.x - leftEye.x);
    const noseOffset = eyeSpan > 0 ? Math.abs(noseTip.x - eyeMidX) / eyeSpan : 0;
    if (noseOffset > 0.28) {
        return {
            valid: false, faceCount: 1,
            message: 'Khuôn mặt nghiêng quá nhiều. Hãy nhìn thẳng vào camera.'
        };
    }

    return {
        valid: true,
        faceCount: 1,
        confidence: Math.round(confidence * 100),
        sharpness: Math.round(sharpness * 10) / 10,
        message: `Ảnh hợp lệ — 1 khuôn mặt, sắc nét ${sharpness.toFixed(1)}, chất lượng ${Math.round(confidence * 100)}%.`
    };
};

/**
 * checkFaceDuplicate — Kiểm tra khuôn mặt mới có trùng với nhân viên đã đăng ký không.
 *
 * @param {HTMLCanvasElement} canvas - Canvas ảnh vừa chụp (khuôn mặt mới)
 * @param {Array<{_id, fullName, verificationPhoto}>} staffList - Danh sách nhân viên đã đăng ký ảnh
 * @returns {{ isDuplicate: boolean, matchedPerson: string|null, distance: number|null, message: string }}
 */
export const checkFaceDuplicate = async (canvas, staffList) => {
    // Ngưỡng khoảng cách Euclidean: <= 0.50 → CÙNG người (strict hơn verifyFace để bắt giả mạo)
    const DUPLICATE_THRESHOLD = 0.50;

    if (!staffList || staffList.length === 0) {
        return { isDuplicate: false, matchedPerson: null, distance: null, message: 'Không có nhân viên nào để so sánh.' };
    }

    // 1. Lấy descriptor của ảnh mới chụp
    const newDesc = await getDescriptor(canvas);
    if (!newDesc) {
        return { isDuplicate: false, matchedPerson: null, distance: null, message: 'Không thể trích xuất đặc trưng khuôn mặt từ ảnh chụp.' };
    }

    // 2. So sánh lần lượt với từng nhân viên đã đăng ký
    let closestDistance = Infinity;
    let closestPerson = null;

    for (const staff of staffList) {
        if (!staff.verificationPhoto) continue;

        try {
            const refImg = await loadImage(staff.verificationPhoto);
            const refDesc = await getDescriptor(refImg);
            if (!refDesc) continue;

            const distance = faceapi.euclideanDistance(newDesc, refDesc);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPerson = staff.fullName;
            }
        } catch {
            // Bỏ qua nếu không load được ảnh của nhân viên đó
            continue;
        }
    }

    if (closestDistance <= DUPLICATE_THRESHOLD) {
        return {
            isDuplicate: true,
            matchedPerson: closestPerson,
            distance: closestDistance,
            message: `⚠️ Khuôn mặt này đã trùng với nhân viên "${closestPerson}" (độ tương đồng ${Math.round((1 - closestDistance) * 100)}%). Không thể dùng ảnh của người khác để đăng ký.`
        };
    }

    return {
        isDuplicate: false,
        matchedPerson: null,
        distance: closestDistance,
        message: 'Khuôn mặt hợp lệ, không trùng với nhân viên nào.'
    };
};
