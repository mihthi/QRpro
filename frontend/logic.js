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

    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-text').innerText = "⏳ Đang kết nối máy chủ để tạo link...";
    document.getElementById('qr-render').innerHTML = ""; 

    try {
        const response = await fetch(`${API_URL}/api/shorten`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                original_url: link,
                link_type: 'link',
                custom_alias: customAlias
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
        const fileInput = document.getElementById('qr-input-file');
        if (fileInput.files.length === 0) return alert("Vui lòng chọn 1 file!");
        
        if (fileInput.files[0].size > 5 * 1024 * 1024) {
            return alert("File vượt quá 5MB. Vui lòng chọn file nhẹ hơn!");
        }
        
        // --- XỬ LÝ UPLOAD FILE THẬT ---
        document.getElementById('result-box').style.display = 'block';
        document.getElementById('result-text').innerText = "⏳ Đang tải file lên máy chủ...";
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData 
                // Không set header Content-Type, trình duyệt tự xử lý cho FormData
            });
            
            const data = await response.json();
            
            if (data.success) {
                finalDataToQR = data.short_url;
                showResult(`🎉 File đã được tải lên và rút gọn!<br><br> <a href="${finalDataToQR}" target="_blank" style="font-size: 18px;">${finalDataToQR}</a>`, finalDataToQR);
            } else {
                alert("Lỗi tải file: " + data.error);
                document.getElementById('result-box').style.display = 'none';
            }
        } catch (error) {
            console.error(error);
            alert("Lỗi kết nối khi tải file lên!");
            document.getElementById('result-box').style.display = 'none';
        }
        return; // Dừng hàm lại vì showResult đã được gọi thành công ở trên
    }

    // Vẽ QR cho các trường hợp không phải File
    if (finalDataToQR !== "") {
        showResult("Mã QR của bạn đã được tạo thành công!", finalDataToQR);
    }
}

// 4. Hàm hỗ trợ: In kết quả ra màn hình
function showResult(messageText, qrData) {
    document.getElementById('result-box').style.display = 'block';
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