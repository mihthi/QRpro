// --- FILE: ui.js (XỬ LÝ GIAO DIỆN) ---

// 1. Hàm chuyển đổi Main Tab (Rút gọn Link <-> Tạo mã QR)
function switchMainTab(tabName) {
    // Đổi màu nút active
    document.getElementById('tab-rutgon').classList.remove('active');
    document.getElementById('tab-taomat').classList.remove('active');
    document.getElementById('tab-' + tabName).classList.add('active');

    // Ẩn/hiện nội dung tương ứng
    document.getElementById('content-rutgon').style.display = 'none';
    document.getElementById('content-taomat').style.display = 'none';
    document.getElementById('content-' + tabName).style.display = 'block';

    // Ẩn khung kết quả mỗi khi chuyển tab
    document.getElementById('result-box').style.display = 'none';
}

// 2. Biến lưu loại QR đang chọn hiện tại
let currentQRType = 'link'; 

// 3. Hàm chuyển đổi các loại QR (Link, Text, Wifi, File)
function switchQRTab(qrType) {
    currentQRType = qrType;

    // Reset màu tất cả các nút QR
    const qrTabs = document.querySelectorAll('.qr-type-item');
    qrTabs.forEach(tab => tab.classList.remove('active'));
    
    // Bật màu nút đang chọn
    document.getElementById('qr-tab-' + qrType).classList.add('active');

    // Ẩn tất cả các form nhập liệu
    const qrForms = document.querySelectorAll('.qr-form-content');
    qrForms.forEach(form => form.style.display = 'none');

    // Hiển thị form tương ứng
    document.getElementById('qr-form-' + qrType).style.display = 'block';
    
    // Ẩn khung kết quả
    document.getElementById('result-box').style.display = 'none';

    // ----> THÊM 3 DÒNG NÀY VÀO CUỐI HÀM <----
    if (qrType === 'location') {
        initMap();
    }
}