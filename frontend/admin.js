// Đổi URL này thành URL Backend của bạn (Ví dụ: https://qrpro-luev.onrender.com)
// const API_URL = window.location.hostname === "localhost" 
//     ? "http://localhost:3000" 
//     : "https://qrpro-luev.onrender.com"; 
const API_URL = window.location.hostname === "localhost" 
    ? "http://localhost:3000" 
    : "https://www.hongthang.cloud"; 

    

let allData = []; 
let currentTab = 'link'; 

// 1. Kiểm tra trạng thái đăng nhập
window.onload = () => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        showDashboard();
        fetchData();
    }
};

// 2. Đăng Nhập
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
            fetchData();
        } else {
            errorMsg.innerText = data.error;
            errorMsg.classList.remove('hidden');
        }
    } catch (error) {
        errorMsg.innerText = "Lỗi kết nối đến máy chủ!";
        errorMsg.classList.remove('hidden');
    }
}

// 3. Đăng Xuất
function logoutAdmin() {
    localStorage.removeItem('admin_token');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
}

// 4. Lấy dữ liệu
async function fetchData() {
    const token = localStorage.getItem('admin_token');
    try {
        const response = await fetch(`${API_URL}/api/admin/links`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
            allData = result.data;
            renderTable(); 
        } else {
            alert("Phiên đăng nhập hết hạn!");
            logoutAdmin();
        }
    } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
    }
}

// 5. Chuyển Tab
function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    renderTable(); 
}

// 6. Vẽ dữ liệu ra bảng
function renderTable() {
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = '';

    const filteredData = allData.filter(item => item.link_type === currentTab);

    filteredData.forEach(item => {
        let displayUrl = item.original_url;
        if (displayUrl.length > 50) displayUrl = displayUrl.substring(0, 50) + '...';

        const tr = document.createElement('tr');
        tr.className = "table-row-hover border-b";
        tr.innerHTML = `
            <td class="p-4 font-mono text-sm text-green-600 font-bold">${item.short_code}</td>
            <td class="p-4 text-sm text-gray-600 truncate max-w-xs" title='${item.original_url}'>${displayUrl}</td>
            <td class="p-4"><span class="px-2 py-1 text-xs rounded-full ${item.link_type === 'album' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">${item.link_type}</span></td>
            <td class="p-4 font-bold text-gray-700">${item.click_count || 0}</td>
            <td class="p-4 text-sm text-gray-500">${new Date(item.created_at).toLocaleString('vi-VN')}</td>
            <td class="p-4 text-center">
                <a href="${API_URL}/${item.short_code}" target="_blank" class="text-blue-500 hover:underline text-sm mr-3">Thử</a>
                <button onclick="deleteItem('${item.id}')" class="text-red-500 hover:underline text-sm font-bold">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Chưa có dữ liệu nào.</td></tr>`;
    }
}

// 7. Xóa dữ liệu
async function deleteItem(id) {
    if (!confirm("Bạn có chắc chắn muốn xóa mục này vĩnh viễn không?")) return;

    const token = localStorage.getItem('admin_token');
    try {
        const response = await fetch(`${API_URL}/api/admin/links/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        if (result.success) {
            fetchData();
        } else {
            alert("Lỗi khi xóa: " + result.error);
        }
    } catch (error) {
        alert("Lỗi kết nối khi xóa!");
    }
}