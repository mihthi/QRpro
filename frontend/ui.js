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

    if (qrType === 'location') {
        initMap();
    }
}

// ==========================================
// KHỐI XỬ LÝ POPUP ĐĂNG NHẬP ADMIN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const btnLogin = document.querySelector(".btn-login"); 
    const loginModal = document.getElementById("login-modal");
    const closeBtn = document.getElementById("close-login-btn");

    // Mở Popup
    if (btnLogin && loginModal) {
        btnLogin.addEventListener("click", () => {
            loginModal.classList.add("show");
        });
    }

    // Đóng Popup khi bấm nút X
    if (closeBtn && loginModal) {
        closeBtn.addEventListener("click", () => {
            loginModal.classList.remove("show");
        });
    }

    // Đóng Popup khi click ra vùng nền đen bên ngoài
    window.addEventListener("click", (event) => {
        if (event.target === loginModal) {
            loginModal.classList.remove("show");
        }
    });
});

// Logic gửi dữ liệu đăng nhập
async function handleLoginPopup() {
    const user = document.getElementById('admin-user-popup').value;
    const pass = document.getElementById('admin-pass-popup').value;
    const errorMsg = document.getElementById('login-error-popup');

    const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000" 
    : "https://qrpro-luev.onrender.com";

    errorMsg.style.display = 'none'; 
    
    if(!user || !pass) {
        errorMsg.innerText = "Vui lòng nhập đủ tài khoản và mật khẩu!";
        errorMsg.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        const data = await response.json();

        if (data.success) {
            // Lưu vé vào trình duyệt và chuyển trang
            localStorage.setItem('admin_token', data.token);
            window.location.href = "admin.html"; 
        } else {
            errorMsg.innerText = data.error || "Sai tài khoản hoặc mật khẩu!";
            errorMsg.style.display = 'block';
        }
    } catch (error) {
        errorMsg.innerText = "Lỗi kết nối máy chủ!";
        errorMsg.style.display = 'block';
    }
}