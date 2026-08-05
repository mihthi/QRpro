// --- FILE: admin-data.js ---

let allData = []; 
let currentTab = 'link'; 
let searchTerm = '';     
let sortOrder = 'newest'; 

// CÁC BIẾN QUẢN LÝ CHỌN NHIỀU DÒNG
let currentFilteredData = []; // Lưu danh sách đang hiển thị trên màn hình
let selectedIds = [];         // Lưu các ID đang được tích chọn

// 1. Lấy dữ liệu
async function fetchData() {
    const token = localStorage.getItem('admin_token');
    if (!token) return; 

    try {
        const response = await fetch(`${API_URL}/api/admin/links`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
            allData = result.data; 
            clearSelection(); // Reset chọn khi có dữ liệu mới
            renderTable();         
        } else {
            alert("Phiên đăng nhập hết hạn!");
            logoutAdmin();         
        }
    } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
    }
}

// 2. Chuyển Tab
function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    clearSelection(); // Đổi tab thì bỏ chọn hết
    renderTable(); 
}

// 3. Tìm kiếm và Sắp xếp
function handleSearch() {
    searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    clearSelection();
    renderTable(); 
}

function handleSort() {
    sortOrder = document.getElementById('sort-select').value;
    renderTable(); 
}

// ==========================================
// CÁC HÀM XỬ LÝ CHỌN DÒNG & XÓA HÀNG LOẠT
// ==========================================

// Reset chọn
function clearSelection() {
    selectedIds = [];
    updateBulkDeleteUI();
}

// Bật/tắt trạng thái chọn 1 dòng
function toggleSelect(id) {
    const index = selectedIds.indexOf(id);
    if (index > -1) {
        selectedIds.splice(index, 1); // Đã chọn rồi thì gỡ ra
    } else {
        selectedIds.push(id); // Chưa chọn thì thêm vào
    }
    renderTable(); 
    updateBulkDeleteUI();
}

// Bật/tắt nút "Chọn tất cả"
function toggleSelectAll(checkbox) {
    if (checkbox.checked) {
        selectedIds = currentFilteredData.map(item => item.id); // Lấy hết ID đang hiển thị
    } else {
        selectedIds = [];
    }
    renderTable();
    updateBulkDeleteUI();
}

// Cập nhật giao diện nút Xóa
function updateBulkDeleteUI() {
    const btn = document.getElementById('bulk-delete-btn');
    const selectAllCb = document.getElementById('select-all-cb');
    
    if (selectedIds.length > 0) {
        btn.innerText = `🗑️ Xóa (${selectedIds.length})`;
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }

    // Cập nhật trạng thái ô tích "Chọn tất cả" trên Header
    if (selectAllCb) {
        selectAllCb.checked = currentFilteredData.length > 0 && selectedIds.length === currentFilteredData.length;
    }
}

// Xóa hàng loạt
async function deleteSelectedItems() {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.length} mục đã chọn không?`)) return;

    const token = localStorage.getItem('admin_token');
    try {
        // Dùng Promise.all để gửi nhiều yêu cầu xóa cùng 1 lúc lên server
        const deletePromises = selectedIds.map(id => 
            fetch(`${API_URL}/api/admin/links/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
        );

        await Promise.all(deletePromises);
        
        // Xóa xong thì làm mới lại danh sách
        fetchData(); 
    } catch (error) {
        alert("Có lỗi xảy ra khi xóa hàng loạt!");
    }
}

// ==========================================
// HÀM VẼ BẢNG (ĐÃ CẬP NHẬT GIAO DIỆN CHỌN)
// ==========================================
function renderTable() {
    const tbody = document.getElementById('data-table-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    // Lọc dữ liệu
    currentFilteredData = allData.filter(item => item.link_type === currentTab);

    if (searchTerm !== '') {
        currentFilteredData = currentFilteredData.filter(item => {
            const codeMatch = item.short_code && item.short_code.toLowerCase().includes(searchTerm);
            const urlMatch = item.original_url && item.original_url.toLowerCase().includes(searchTerm);
            return codeMatch || urlMatch;
        });
    }

    // Sắp xếp
    currentFilteredData.sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortOrder === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        if (sortOrder === 'clicks_desc') return (b.click_count || 0) - (a.click_count || 0);
        return 0;
    });

    updateBulkDeleteUI();

    // Vẽ từng dòng
    currentFilteredData.forEach(item => {
        let displayUrl = item.original_url;
        if (displayUrl.length > 50) displayUrl = displayUrl.substring(0, 50) + '...';

        const isSelected = selectedIds.includes(item.id);
        const tr = document.createElement('tr');
        
        // NẾU ĐƯỢC CHỌN: In đậm (font-bold) và tô màu nền (bg-green-50). Click vào đâu trên dòng cũng được.
        tr.className = `border-b cursor-pointer transition-colors ${isSelected ? 'bg-green-50 font-bold' : 'hover:bg-gray-50'}`;
        tr.onclick = () => toggleSelect(item.id); 

        tr.innerHTML = `
            <td class="p-4 text-center">
                <!-- event.stopPropagation() để không bị lỗi bấm 2 lần khi click thẳng vào ô vuông -->
                <input type="checkbox" class="w-4 h-4 cursor-pointer" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelect('${item.id}')">
            </td>
            <td class="p-4 font-mono text-sm text-green-600 ${!isSelected ? 'font-bold' : ''}">${item.short_code}</td>
            <td class="p-4 text-sm ${isSelected ? 'text-gray-900' : 'text-gray-600'} truncate max-w-xs" title='${item.original_url}'>${displayUrl}</td>
            <td class="p-4">
                <span class="px-2 py-1 text-xs rounded-full ${item.link_type === 'album' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">
                    ${item.link_type}
                </span>
            </td>
            <td class="p-4 ${isSelected ? 'text-gray-900' : 'text-gray-700'}">${item.click_count || 0}</td>
            <td class="p-4 text-sm ${isSelected ? 'text-gray-700' : 'text-gray-500'}">${new Date(item.created_at).toLocaleString('vi-VN')}</td>
            <td class="p-4 text-center">
                <a href="${API_URL}/${item.short_code}" target="_blank" onclick="event.stopPropagation()" class="text-blue-500 hover:underline text-sm mr-3">Thử</a>
                <button onclick="event.stopPropagation(); deleteItem('${item.id}')" class="text-red-500 hover:underline text-sm ${!isSelected ? 'font-bold' : ''}">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (currentFilteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">Không tìm thấy dữ liệu phù hợp.</td></tr>`;
    }
}

// Xóa 1 dữ liệu (Giữ nguyên)
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