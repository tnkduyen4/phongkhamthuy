/**
 * printService.js - VetCare Unified Print System v3.0
 * Fix: Force bảng ngang (không bị mobile-card layout), header hành chính chuẩn.
 */

const CLINIC_NAME = 'HỆ THỐNG PHÒNG KHÁM THÚ Y VETCARE';
const CLINIC_INFO = {
    address: 'Số 123, Đường Thú Y, Quận Cầu Giấy, TP. Hà Nội',
    phone: '0987.654.321',
    website: 'www.vetcare.com',
    email: 'contact@vetcare.com',
};

// CSS này được inject vào <head> khi in, độc lập với CSS của app
const PRINT_ONLY_CSS = `
    /* ===== RESET TOÀN BỘ KHI IN - ĐỘC LẬP VỚI APP CSS ===== */
    @media print {
        @page { 
            size: A4 portrait; 
            margin: 12mm 10mm 18mm 10mm;
        }

        /* Ẩn mọi thứ ngoài vùng in */
        body > *:not(#report-print-area) {
            display: none !important;
        }

        html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        #report-print-area {
            display: block !important;
            width: 100% !important;
            position: relative !important;
            color: #000 !important;
            font-family: 'Times New Roman', Times, serif !important;
            background: white !important;
        }

        /* ===== FORCE BẢNG NGANG - OVERRIDE MỌI CSS MOBILE ===== */
        /* Đây là fix chính để bảng không bị card layout */
        #report-print-area table,
        #report-print-area .print-table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
            border: 2px solid #000 !important;
            page-break-inside: auto !important;
        }

        #report-print-area thead,
        #report-print-area .print-table thead {
            display: table-header-group !important;
        }

        #report-print-area tbody,
        #report-print-area .print-table tbody {
            display: table-row-group !important;
        }

        #report-print-area tr,
        #report-print-area .print-table tr {
            display: table-row !important;          /* OVERRIDE flex-direction:column */
            page-break-inside: avoid !important;
            background: transparent !important;
            flex-direction: unset !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
        }

        #report-print-area th,
        #report-print-area td,
        #report-print-area .print-table th,
        #report-print-area .print-table td {
            display: table-cell !important;         /* OVERRIDE display:flex */
            border: 1px solid #333 !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
            color: #000 !important;
            word-wrap: break-word !important;
            vertical-align: middle !important;
            width: auto !important;                 /* OVERRIDE width:100% */
            text-align: left !important;
            min-height: unset !important;
            justify-content: unset !important;
        }

        /* Ẩn label giả mobile (data-label ::before) */
        #report-print-area td::before,
        #report-print-area .print-table td::before {
            content: none !important;
            display: none !important;
        }
        
        /* Ẩn thead trả lại (mobile ẩn thead) */
        #report-print-area thead {
            display: table-header-group !important;
            visibility: visible !important;
        }

        #report-print-area th {
            background: #cccccc !important;
            font-weight: bold !important;
            text-align: center !important;
            text-transform: uppercase !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Zebra striping */
        #report-print-area tbody tr:nth-child(even) td {
            background: #f0f0f0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Hàng tổng cuối */
        #report-print-area tr.grand-total-row td {
            background: #b8e4ba !important;
            font-weight: bold !important;
            border-top: 2px solid #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* BIỂU ĐỒ */
        .chart-print-container {
            text-align: center !important;
            margin: 16px 0 !important;
            page-break-inside: avoid !important;
        }
        .chart-print-container img {
            max-width: 90% !important;
            height: auto !important;
            border: 1px solid #999 !important;
        }

        .text-center { text-align: center !important; }
        .text-right { text-align: right !important; }
    }
    
    #report-print-area { display: none; }
`;

/**
 * Làm sạch HTML: xóa class mobile, data-label, inline style gây hại
 */
function sanitizeTableHTML(html) {
    if (!html) return '';
    
    // Tạo DOM tạm để xử lý
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Xóa các class gây lỗi layout mobile
    const problematicClasses = [
        'table-mobile-cards', 'table-mobile', 'hide-on-mobile',
        'animate-fade-in', 'animate-slide-up', 'animate-slide-in',
        'clickable-card', 'hover-row',
    ];

    tempDiv.querySelectorAll('*').forEach(el => {
        problematicClasses.forEach(cls => el.classList.remove(cls));

        // Xóa event handlers inline (onclick, etc.)
        ['onclick', 'onmouseover', 'onmouseout'].forEach(ev => el.removeAttribute(ev));

        // Xóa style cursor pointer
        if (el.style && el.style.cursor) el.style.cursor = '';
    });

    // Bỏ ẩn thead (mobile ẩn thead bằng display:none class)
    tempDiv.querySelectorAll('thead').forEach(thead => {
        thead.style.display = '';
    });

    // Xóa badge gradient (giữ text)
    tempDiv.querySelectorAll('.badge').forEach(badge => {
        badge.style.cssText = 'font-size: 10px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; background: #eee; color: #333;';
    });

    return tempDiv.innerHTML;
}

async function captureToImage(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return null;
    try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(el, {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
        });
        return canvas.toDataURL('image/png');
    } catch (err) {
        return null;
    }
}

function getNow() {
    const now = new Date();
    return {
        fullTime: now.toLocaleString('vi-VN'),
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear()
    };
}

function cleanup() {
    const el = document.getElementById('report-print-area');
    if (el) el.remove();
    const style = document.getElementById('report-print-style');
    if (style) style.remove();
}

/**
 * Hàm in báo cáo chính
 * @param {string} title - Tiêu đề báo cáo
 * @param {string} contentHTML - HTML bảng dữ liệu (từ .table-responsive)
 * @param {string|null} chartId - ID element biểu đồ cần capture
 * @param {string} metaInfo - Thông tin kỳ báo cáo (null = hiện thời điểm in, '' = ẩn hẳn)
 * @param {string} summaryHTML - Phần tổng kết/ghi chú
 * @param {boolean} hideSignatures - Ẩn chữ ký 3 cột (dùng khi in phiếu lương đã kèm chữ ký)
 */
export async function printReport({ title, contentHTML = '', chartId = null, metaInfo = null, summaryHTML = '', hideSignatures = false }) {
    cleanup();
    const { day, month, year, fullTime } = getNow();

    const userObj = (() => {
        try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
    })();
    const userName = userObj?.fullName || '................................';
    const userRole = userObj?.role === 'ADMIN' ? 'Quản trị viên'
        : userObj?.role === 'DOCTOR' ? 'Bác sĩ thú y'
        : userObj?.role === 'STAFF' ? 'Nhân viên'
        : 'Người dùng';

    // Inject CSS print (độc lập, không phụ thuộc app CSS)
    const style = document.createElement('style');
    style.id = 'report-print-style';
    style.textContent = PRINT_ONLY_CSS;
    document.head.appendChild(style);

    // Capture biểu đồ nếu cần
    let chartImage = null;
    if (chartId) chartImage = await captureToImage(chartId);

    // Làm sạch HTML bảng
    const cleanContent = sanitizeTableHTML(contentHTML);

    const area = document.createElement('div');
    area.id = 'report-print-area';

    area.innerHTML = `
        <div style="padding: 6px 14px; font-family: 'Times New Roman', Times, serif; color: #000;">

            <!-- ===== HEADER HÀNH CHÍNH ===== -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 3px double #000;">
                
                <div style="width: 54%; line-height: 1.4;">
                    <div style="font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${CLINIC_NAME}
                    </div>
                    <div style="font-size: 9.5px; margin-top: 2px; color: #222;">
                        Địa chỉ: ${CLINIC_INFO.address}
                    </div>
                    <div style="font-size: 9.5px; margin-top: 1px; color: #222;">
                        ĐT: ${CLINIC_INFO.phone} &nbsp;|&nbsp; Web: ${CLINIC_INFO.website}
                    </div>
                </div>

                <div style="width: 44%; text-align: center; font-size: 10.5px; line-height: 1.5;">
                    <div style="font-weight: bold; font-size: 11px; text-transform: uppercase;">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div style="font-weight: bold; font-size: 10.5px; text-decoration: underline;">
                        Độc lập - Tự do - Hạnh phúc
                    </div>
                    <div style="margin-top: 4px; font-size: 10px; font-style: italic;">
                        Hà Nội, ngày <strong>${day}</strong> tháng <strong>${month}</strong> năm <strong>${year}</strong>
                    </div>
                </div>
            </div>

            <!-- ===== TIÊU ĐỀ ===== -->
            <div style="text-align: center; margin: 8px 0 12px 0;">
                <div style="font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; color: #000;">
                    ${title}
                </div>
                ${metaInfo !== '' ? `<div style="font-size: 10.5px; font-style: italic; color: #444; margin-top: 4px;">
                    ${metaInfo !== null ? metaInfo : `Thời điểm in: ${fullTime}`}
                </div>` : ''}
                <div style="margin: 6px auto 0; width: 60px; height: 2px; background: #000;"></div>
            </div>

            <!-- ===== BẢNG DỮ LIỆU (ĐÃ LÀM SẠCH CSS MOBILE) ===== -->
            ${cleanContent ? `
            <div class="print-table-wrapper" style="margin-bottom: 18px;">
                ${cleanContent}
            </div>` : ''}

            <!-- ===== BIỂU ĐỒ ===== -->
            ${chartImage ? `
            <div class="chart-print-container">
                <div style="font-weight: bold; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #bbb; padding-bottom: 4px;">
                    Biểu đồ minh họa
                </div>
                <img src="${chartImage}" alt="Biểu đồ" style="max-width:90%; height:auto; border:1px solid #aaa;" />
            </div>` : ''}

            <!-- ===== TỔNG KẾT ===== -->
            ${summaryHTML ? `
            <div style="margin: 16px 0 14px; padding: 10px 14px; border: 1.5px solid #000; background: #e6e6e6; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; text-transform: uppercase;">
                    ■ Tổng kết / Ghi chú:
                </div>
                <div style="font-size: 11.5px; line-height: 1.9;">
                    ${summaryHTML}
                </div>
            </div>` : ''}

            <!-- ===== CHỮ KÝ 3 CỘT ===== -->
            ${hideSignatures ? '' : `
            <div style="margin-top: 36px; display: flex; justify-content: space-between; text-align: center; page-break-inside: avoid; gap: 10px;">
                
                <div style="flex: 1; font-size: 11px; line-height: 1.7;">
                    <div style="font-weight: bold; text-transform: uppercase; font-size: 11.5px;">Người lập biểu</div>
                    <div style="font-style: italic; font-size: 10.5px; color: #555;">(Ký, ghi rõ họ tên)</div>
                    <div style="height: 60px;"></div>
                    <div style="font-weight: bold; font-size: 11px; border-top: 1px solid #333; padding-top: 4px; margin-top: 2px;">${userName}</div>
                    ${userObj?.fullName ? `<div style="font-size: 10px; color: #555; font-style: italic;">${userRole}</div>` : ''}
                </div>

                <div style="flex: 1; font-size: 11px; line-height: 1.7;">
                    <div style="font-weight: bold; text-transform: uppercase; font-size: 11.5px;">Kế toán trưởng</div>
                    <div style="font-style: italic; font-size: 10.5px; color: #555;">(Ký, ghi rõ họ tên)</div>
                    <div style="height: 60px;"></div>
                    <div style="font-weight: bold; font-size: 11px; border-top: 1px solid #333; padding-top: 4px; margin-top: 2px;">................................</div>
                </div>

                <div style="flex: 1; font-size: 11px; line-height: 1.7;">
                    <div style="font-weight: bold; text-transform: uppercase; font-size: 11.5px;">Giám đốc</div>
                    <div style="font-style: italic; font-size: 10.5px; color: #555;">(Ký tên, đóng dấu)</div>
                    <div style="height: 60px;"></div>
                    <div style="font-weight: bold; font-size: 11px; border-top: 1px solid #333; padding-top: 4px; margin-top: 2px;">................................</div>
                </div>
            </div>`}


        </div>
    `;

    document.body.appendChild(area);

    // Chờ ảnh load
    const imgs = area.querySelectorAll('img');
    if (imgs.length > 0) {
        await Promise.all(Array.from(imgs).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));
    }

    setTimeout(() => {
        window.print();
        cleanup();
    }, 500);
}

/**
 * In hàng loạt phiếu lương — mỗi nhân viên 1 trang hoàn chỉnh (header + tiêu đề + nội dung phiếu)
 * @param {Array<{title: string, payslipHTML: string}>} pages - Mảng trang, mỗi phần tử là 1 phiếu
 */
export async function printBatchPayslips(pages) {
    if (!pages || pages.length === 0) return;
    cleanup();
    const { day, month, year, fullTime } = getNow();

    const style = document.createElement('style');
    style.id = 'report-print-style';
    style.textContent = PRINT_ONLY_CSS;
    document.head.appendChild(style);

    const buildPage = ({ title, payslipHTML }, isLast) => `
        <div style="${isLast ? '' : 'page-break-after: always;'} font-family: 'Times New Roman', Times, serif; color: #000;">

            <!-- Header hành chính -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 3px double #000;">
                <div style="width: 54%; line-height: 1.4;">
                    <div style="font-weight: bold; font-size: 12px; text-transform: uppercase;">${CLINIC_NAME}</div>
                    <div style="font-size: 9.5px; margin-top: 2px; color: #222;">Địa chỉ: ${CLINIC_INFO.address}</div>
                    <div style="font-size: 9.5px; margin-top: 1px; color: #222;">ĐT: ${CLINIC_INFO.phone} &nbsp;|&nbsp; Web: ${CLINIC_INFO.website}</div>
                </div>
                <div style="width: 44%; text-align: center; font-size: 10.5px; line-height: 1.5;">
                    <div style="font-weight: bold; font-size: 11px; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div style="font-weight: bold; font-size: 10.5px; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</div>
                    <div style="margin-top: 4px; font-size: 10px; font-style: italic;">
                        Hà Nội, ngày <strong>${day}</strong> tháng <strong>${month}</strong> năm <strong>${year}</strong>
                    </div>
                </div>
            </div>

            <!-- Tiêu đề phiếu -->
            <div style="text-align: center; margin: 8px 0 12px 0;">
                <div style="font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2;">${title}</div>
                <div style="margin: 6px auto 0; width: 60px; height: 2px; background: #000;"></div>
            </div>

            <!-- Nội dung phiếu lương (bảng + chữ ký từ buildPayslipHTML) -->
            ${payslipHTML}
        </div>`;

    const area = document.createElement('div');
    area.id = 'report-print-area';
    area.innerHTML = `<div style="padding: 6px 14px;">
        ${pages.map((p, i) => buildPage(p, i === pages.length - 1)).join('\n')}
    </div>`;

    document.body.appendChild(area);

    setTimeout(() => {
        window.print();
        cleanup();
    }, 500);
}
