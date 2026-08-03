// Đổi URL này thành URL Backend của bạn
const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000" 
    : "https://qrpro-luev.onrender.com";

// Kiểm tra khi vừa vào trang
window.onload = () => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        showDashboard();
        if(typeof fetchData === "function") fetchData(); // Gọi hàm bên file admin-data.js
    }
};

async function loginAdmin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const errorMsg = document.getElementById('login-error');

    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem('admin_token', data.token);
            showDashboard();
            if(typeof fetchData === "function") fetchData();
        } else {
            errorMsg.innerText = data.error;
            errorMsg.classList.remove('hidden');
        }
    } catch (error) {
        errorMsg.innerText = "Lỗi kết nối máy chủ!";
        errorMsg.classList.remove('hidden');
    }
}

function logoutAdmin() {
    // localStorage.removeItem('admin_token');
    // document.getElementById('dashboard-screen').classList.add('hidden');
    // document.getElementById('login-screen').classList.remove('hidden');
    localStorage.removeItem('admin_token');
    window.location.href = 'index.html';
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
}