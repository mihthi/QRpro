// --- FILE: logic.js (XỬ LÝ THUẬT TOÁN & DATA) ---

const API_URL = "https://qrpro-luev.onrender.com"; // Đổi thành URL thật của backend
//const API_URL = "http://localhost:3000";
// 1. Khởi tạo FingerprintJS
let deviceFingerprint = "";
document.addEventListener("DOMContentLoaded", () => {
    FingerprintJS.load()
        .then(fp => fp.get())
        .then(result => {
            deviceFingerprint = result.visitorId;
            const fpDisplay = document.getElementById('fp-display');
            if(fpDisplay) fpDisplay.innerText = deviceFingerprint;
        });
});

// 2. Xử lý Nút "RÚT GỌN NGAY" (Tab 1)
async function generateShortLink() {
    const link = document.getElementById('shorten-input').value.trim();
    if (!link) return alert("Vui lòng nhập link cần rút gọn!");

    // Lấy tên tùy chỉnh nếu có (Bạn cần thêm <input id="custom-alias"> bên HTML)
    const customAliasElement = document.getElementById('custom-alias');
    const customAlias = customAliasElement ? customAliasElement.value.trim() : "";

    // --- XỬ LÝ UPLOAD FILE THẬT ---
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-title').innerText = "⏳ Đang xử lý..."; // Đổi tiêu đề thành Đang xử lý
    document.getElementById('result-text').innerText = "Đang tải file lên máy chủ (Vui lòng chờ)...";
    try {
        const response = await fetch(`${API_URL}/api/shorten`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                original_url: link,
                link_type: 'link',
                custom_alias: customAlias,
                fingerprint: deviceFingerprint
            })
        });

        const data = await response.json();

        if (data.success) {
            const finalLink = data.short_url; 
            showResult(`🎉 Thành công! Link rút gọn của bạn:<br><br> <a href="${finalLink}" target="_blank" style="font-size: 20px;">${finalLink}</a>`, "");
        } else {
            alert("Lỗi từ máy chủ: " + data.error);
            document.getElementById('result-box').style.display = 'none';
        }
    } catch (error) {
        console.error("Lỗi khi gọi API:", error);
        alert("Lỗi kết nối! Vui lòng kiểm tra lại máy chủ.");
        document.getElementById('result-box').style.display = 'none';
    }
}

// 3. Xử lý Nút "TẠO MÃ QR" (Tab 2)
async function generateQRCode() {
    let finalDataToQR = "";
    
    if (currentQRType === 'link') {
        const input = document.getElementById('qr-input-link').value.trim();
        if (!input) return alert("Vui lòng nhập URL!");
        finalDataToQR = input;
    } 
    else if (currentQRType === 'text') {
        const input = document.getElementById('qr-input-text').value.trim();
        if (!input) return alert("Vui lòng nhập văn bản!");
        finalDataToQR = input;
    } 
    else if (currentQRType === 'wifi') {
        const name = document.getElementById('qr-input-wifi-name').value.trim();
        const pass = document.getElementById('qr-input-wifi-pass').value.trim();
        if (!name) return alert("Vui lòng nhập tên Wi-Fi!");
        finalDataToQR = `WIFI:S:${name};T:WPA;P:${pass};;`;
    } 
    else if (currentQRType === 'location') {
        if (!selectedLat || !selectedLng) {
            return alert("Vui lòng tìm địa chỉ hoặc click chọn 1 điểm trên bản đồ!");
        }
        finalDataToQR = `https://maps.google.com/?q=${selectedLat},${selectedLng}`;
    }
    else if (currentQRType === 'file') {
        if (selectedFiles.length === 0) return showCustomAlert("Vui lòng chọn ít nhất 1 file!");
        if (selectedFiles.length > 10) return showCustomAlert("Chỉ được tải lên tối đa 10 file cùng lúc!");
        
        document.getElementById('result-box').style.display = 'block';
        document.getElementById('result-title').innerText = "⏳ Đang xử lý...";
        document.getElementById('result-title').style.color = "#374151";
        document.getElementById('result-text').innerText = "Đang tải file lên máy chủ (Vui lòng chờ)...";
        
        const formData = new FormData();
        // Đưa các file từ mảng selectedFiles vào gói hàng gửi đi
        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append('files', selectedFiles[i]);
        }
        formData.append('fingerprint', deviceFingerprint);

        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData 
            });
            const data = await response.json();
            
            if (data.success) {
                const finalDataToQR = data.short_url;
                showResult(`🎉 Bộ sưu tập file đã được tải lên thành công!<br><br> <a href="${finalDataToQR}" target="_blank" style="font-size: 18px;">${finalDataToQR}</a>`, finalDataToQR);
            } else {
                showCustomAlert(data.error);
                document.getElementById('result-box').style.display = 'none';
            }
        } catch (error) {
            console.error(error);
            showCustomAlert("Lỗi kết nối khi tải file lên!");
            document.getElementById('result-box').style.display = 'none';
        }
        return; 
    }

    // Vẽ QR cho các trường hợp không phải File
    if (finalDataToQR !== "") {
        showResult("Mã QR của bạn đã được tạo thành công!", finalDataToQR);
    }
}

// 4. Hàm hỗ trợ: In kết quả ra màn hình
function showResult(messageText, qrData) {
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-title').innerText = "🎉 Thành công!"; // Trả lại chữ Thành công
    document.getElementById('result-text').innerHTML = messageText;

    const qrContainer = document.getElementById('qr-render');
    qrContainer.innerHTML = ""; // Xóa mã QR cũ

    if (qrData !== "") {
        new QRCode(qrContainer, {
            text: qrData,
            width: 220,
            height: 220,
            colorDark: "#000000", 
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// ============================================================
// KHỐI LOGIC BẢN ĐỒ VÀ GỢI Ý ĐỊA ĐIỂM (Giữ nguyên của bạn)
// ============================================================
let map, marker;
let selectedLat = "", selectedLng = "";

function initMap() {
    if (!map) {
        map = L.map('map-preview').setView([10.762622, 106.660172], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        marker = L.marker([10.762622, 106.660172], {draggable: true}).addTo(map);

        marker.on('dragend', function(event) {
            let position = marker.getLatLng();
            selectedLat = position.lat;
            selectedLng = position.lng;
        });

        map.on('click', function(event) {
            marker.setLatLng(event.latlng);
            selectedLat = event.latlng.lat;
            selectedLng = event.latlng.lng;
        });
    } else {
        setTimeout(() => { map.invalidateSize(); }, 100);
    }
}

async function searchLocation() {
    const address = document.getElementById('qr-input-location').value.trim();
    if (!address) return alert("Vui lòng nhập địa chỉ để tìm!");

    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const data = await response.json();

    if (data.length > 0) {
        const lat = data[0].lat;
        const lon = data[0].lon;
        
        map.setView([lat, lon], 16);
        marker.setLatLng([lat, lon]);
        selectedLat = lat;
        selectedLng = lon;
    } else {
        alert("Không tìm thấy địa chỉ này trên bản đồ. Bạn có thể tự click chọn trên bản đồ nhé!");
    }
}

const locationInput = document.getElementById('qr-input-location');
const suggestionBox = document.getElementById('location-suggestions');
let debounceTimer;

if (locationInput && suggestionBox) {
    locationInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const query = this.value.trim();

        if (query.length < 3) {
            suggestionBox.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
                const data = await response.json();

                suggestionBox.innerHTML = ''; 

                if (data.length > 0) {
                    data.forEach(place => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.innerText = place.display_name; 
                        
                        item.addEventListener('click', () => {
                            locationInput.value = place.display_name; 
                            suggestionBox.style.display = 'none'; 
                            
                            const lat = place.lat;
                            const lon = place.lon;
                            map.setView([lat, lon], 16);
                            marker.setLatLng([lat, lon]);
                            selectedLat = lat;
                            selectedLng = lon;
                        });

                        suggestionBox.appendChild(item);
                    });
                    suggestionBox.style.display = 'block';
                } else {
                    suggestionBox.style.display = 'none';
                }
            } catch (error) {
                console.error("Lỗi tìm địa chỉ gợi ý:", error);
            }
        }, 600); 
    });

    document.addEventListener('click', function(e) {
        if (e.target !== locationInput && e.target !== suggestionBox) {
            suggestionBox.style.display = 'none';
        }
    });
}
// Hàm hiển thị danh sách tên file ngay khi người dùng bôi đen chọn
function updateFileList() {
    const fileInput = document.getElementById('qr-input-file');
    const displayArea = document.getElementById('file-list-display');
    
    // Nếu chưa chọn file nào thì giấu khung hiển thị đi
    if (!fileInput || fileInput.files.length === 0) {
        displayArea.style.display = 'none';
        return;
    }

    // Nếu có chọn file thì hiện khung lên và vẽ danh sách
    displayArea.style.display = 'block';
    let html = '<strong>📁 Các file bạn đã chọn:</strong><ul style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.6;">';
    
    for (let i = 0; i < fileInput.files.length; i++) {
        html += `<li style="color: #059669;">${fileInput.files[i].name}</li>`;
    }
    
    html += '</ul>';
    displayArea.innerHTML = html;
}

// Biến toàn cục lưu danh sách file người dùng đã chọn
let selectedFiles = [];

// 1. Khi người dùng chọn file từ máy tính
function handleFileSelect(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        // Kiểm tra dung lượng tối đa 5MB mỗi file
        if (files[i].size > 5 * 1024 * 1024) {
            showCustomAlert(`File "${files[i].name}" vượt quá 5MB. Vui lòng chọn file nhẹ hơn!`);
            continue;
        }
        selectedFiles.push(files[i]);
    }
    renderFileList();
}

// 2. Vẽ danh sách file ra màn hình kèm nút Xóa (dấu x)
function renderFileList() {
    const displayArea = document.getElementById('file-list-display');
    
    if (selectedFiles.length === 0) {
        displayArea.style.display = 'none';
        displayArea.innerHTML = '';
        // Reset lại input file để có thể chọn lại file cũ nếu muốn
        document.getElementById('qr-input-file').value = '';
        return;
    }

    displayArea.style.display = 'block';
    let html = '<strong style="display:block; margin-bottom:5px;">📁 Các file đã chọn:</strong><ul style="margin: 0; padding-left: 20px; line-height: 1.8;">';
    
    selectedFiles.forEach((file, index) => {
        html += `<li style="color: #059669; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;" title="${file.name}">${file.name}</span>
            <button type="button" onclick="removeFile(${index})" style="background: #fee2e2; color: #dc2626; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px; font-weight: bold;">Xóa</button>
        </li>`;
    });
    
    html += '</ul>';
    displayArea.innerHTML = html;
}

// 3. Hàm xóa file khi bấm nút Xóa
function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

// 4. Hàm thay thế Alert mặc định thành thông báo đẹp (Modal nhỏ hoặc đổi text kết quả)
function showCustomAlert(message) {
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-title').innerText = "⚠️ Chú ý!";
    document.getElementById('result-title').style.color = "#dc2626";
    document.getElementById('result-text').innerHTML = `<span style="color: #dc2626; font-weight: bold;">${message}</span>`;
    document.getElementById('qr-render').innerHTML = "";
}