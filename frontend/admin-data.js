// --- FILE: admin-data.js ---

let allData = []; 
let currentTab = 'link'; // Tab mặc định khi vừa vào trang

// 1. Hàm gọi API lấy dữ liệu từ Backend
async function fetchData() {
    const token = localStorage.getItem('admin_token');
    if (!token) return; // Nếu chưa đăng nhập thì thôi không gọi

    try {
        // Biến API_URL đã được khai báo ở file admin-auth.js nên ta xài ké luôn
        const response = await fetch(`${API_URL}/api/admin/links`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
            allData = result.data; // Lưu toàn bộ data vào biến
            renderTable();         // Tiến hành vẽ ra bảng
        } else {
            alert("Phiên đăng nhập hết hạn!");
            logoutAdmin();         // Nếu token hết hạn thì đuổi ra màn hình đăng nhập
        }
    } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
    }
}

// 2. Hàm xử lý khi người dùng bấm qua lại giữa các Tab
function switchTab(tabName) {
    currentTab = tabName;
    
    // Xóa màu xanh ở tất cả các tab, và bật màu xanh cho tab đang chọn
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    
    // Vẽ lại bảng với dữ liệu mới
    renderTable(); 
}

// 3. Hàm cốt lõi: Lọc dữ liệu và in ra bảng HTML
function renderTable() {
    const tbody = document.getElementById('data-table-body');
    if (!tbody) return;
    tbody.innerHTML = ''; // Xóa sạch dữ liệu cũ trên bảng

    // BỘ LỌC FRONTEND: Chỉ lấy những dòng có link_type khớp với Tab đang mở
    const filteredData = allData.filter(item => item.link_type === currentTab);

    // Bắt đầu dùng vòng lặp để vẽ từng hàng
    filteredData.forEach(item => {
        let displayUrl = item.original_url;
        // Nếu URL dài quá thì cắt bớt cho bảng đỡ xấu
        if (displayUrl.length > 50) displayUrl = displayUrl.substring(0, 50) + '...';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b";
        tr.innerHTML = `
            <td class="p-4 font-mono text-sm text-green-600 font-bold">${item.short_code}</td>
            <td class="p-4 text-sm text-gray-600 truncate max-w-xs" title='${item.original_url}'>${displayUrl}</td>
            <td class="p-4">
                <span class="px-2 py-1 text-xs rounded-full ${item.link_type === 'album' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">
                    ${item.link_type}
                </span>
            </td>
            <td class="p-4 font-bold text-gray-700">${item.click_count || 0}</td>
            <td class="p-4 text-sm text-gray-500">${new Date(item.created_at).toLocaleString('vi-VN')}</td>
            <td class="p-4 text-center">
                <a href="${API_URL}/${item.short_code}" target="_blank" class="text-blue-500 hover:underline text-sm mr-3">Thử</a>
                <button onclick="deleteItem('${item.id}')" class="text-red-500 hover:underline text-sm font-bold">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Nếu tab này chưa có dữ liệu nào
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Chưa có dữ liệu nào.</td></tr>`;
    }
}

// 4. Hàm Xóa dữ liệu
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
            fetchData(); // Tải lại bảng ngay lập tức sau khi xóa thành công
        } else {
            alert("Lỗi khi xóa: " + result.error);
        }
    } catch (error) {
        alert("Lỗi kết nối khi xóa!");
    }
}