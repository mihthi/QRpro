// --- FILE: logic.js (XỬ LÝ THUẬT TOÁN & DATA) ---

// 1. Khởi tạo FingerprintJS
let deviceFingerprint = "";
document.addEventListener("DOMContentLoaded", () => {
    FingerprintJS.load()
        .then(fp => fp.get())
        .then(result => {
            deviceFingerprint = result.visitorId;
            document.getElementById('fp-display').innerText = deviceFingerprint;
        });
});

// 2. Xử lý Nút "RÚT GỌN NGAY" (Tab 1)
async function generateShortLink() {
    const link = document.getElementById('shorten-input').value.trim();
    if (!link) return alert("Vui lòng nhập link cần rút gọn!");

    // Hiển thị thông báo đang xử lý để người dùng không bấm nhiều lần
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-text').innerText = "⏳ Đang kết nối máy chủ để tạo link...";
    document.getElementById('qr-render').innerHTML = ""; 

    try {
        // Gửi "Order" (đường link) xuống cho máy chủ đang chạy ở cổng 3000
        const API_URL = "https://qrpro-luev.onrender.com";

        const response = await fetch(`${API_URL}/api/shorten`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Gói ghém dữ liệu đúng chuẩn JSON để gửi đi
            body: JSON.stringify({
                original_url: link,
                link_type: 'link'
            })
        });

        const data = await response.json();

        // Nếu máy chủ báo thành công
        if (data.success) {
            const finalLink = data.short_url; // Lấy link thật từ Database
            // Hiển thị link thật và vẽ luôn mã QR cho nó
            showResult(`🎉 Thành công! Link rút gọn của bạn:<br><br> <a href="${finalLink}" target="_blank" style="font-size: 20px;">${finalLink}</a>`, "");
        } else {
            // Nếu máy chủ từ chối hoặc lỗi
            alert("Lỗi từ máy chủ: " + data.error);
            document.getElementById('result-box').style.display = 'none';
        }

    } catch (error) {
        console.error("Lỗi khi gọi API:", error);
        alert("Lỗi kết nối! Vui lòng kiểm tra xem Backend (Node.js) đã chạy chưa.");
        document.getElementById('result-box').style.display = 'none';
    }
}

// 3. Xử lý Nút "TẠO MÃ QR" (Tab 2)
function generateQRCode() {
    let finalDataToQR = "";
    
    // Dựa vào biến currentQRType (lấy từ ui.js) để biết người dùng đang ở form nào
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
        // Ghép chuỗi chuẩn Wi-Fi cho QR Code
        finalDataToQR = `WIFI:S:${name};T:WPA;P:${pass};;`;
    } 
   else if (currentQRType === 'location') {
        if (!selectedLat || !selectedLng) {
            return alert("Vui lòng tìm địa chỉ hoặc click chọn 1 điểm trên bản đồ!");
        }
        
        // Tạo link Google Maps trực tiếp bằng Tọa độ chính xác
        finalDataToQR = `https://maps.google.com/?q=${selectedLat},${selectedLng}`;
    }
    else if (currentQRType === 'file') {
        const fileInput = document.getElementById('qr-input-file');
        if (fileInput.files.length === 0) return alert("Vui lòng chọn 1 file!");
        
        if (fileInput.files[0].size > 5 * 1024 * 1024) {
            return alert("File vượt quá 5MB. Vui lòng chọn file nhẹ hơn!");
        }
        
        // Giả lập đã up lên S3
        finalDataToQR = "https://qrpro.vn/file/" + Math.random().toString(36).substring(2, 7);
    }

    // Vẽ QR và hiển thị
    showResult("Mã QR của bạn đã được tạo thành công!", finalDataToQR);
}

// 4. Hàm hỗ trợ: In kết quả ra màn hình
function showResult(messageText, qrData) {
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-text').innerHTML = messageText;

    const qrContainer = document.getElementById('qr-render');
    qrContainer.innerHTML = ""; // Xóa mã QR cũ

    // Chỉ vẽ mã QR nếu qrData có dữ liệu (tức là ở Tab Tạo Mã QR)
    if (qrData !== "") {
        new QRCode(qrContainer, {
            text: qrData,
            width: 220,
            height: 220,
            colorDark: "#000000", /* ĐÃ ĐỔI SANG MÀU ĐEN CHO DỄ QUÉT */
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}
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
// --- 5. TÍNH NĂNG GỢI Ý TỰ ĐỘNG ĐỊA ĐIỂM ---
const locationInput = document.getElementById('qr-input-location');
const suggestionBox = document.getElementById('location-suggestions');
let debounceTimer;

if (locationInput && suggestionBox) {
    // Bắt sự kiện mỗi khi người dùng gõ phím
    locationInput.addEventListener('input', function() {
        clearTimeout(debounceTimer); // Xóa bộ đếm cũ
        const query = this.value.trim();

        // Nếu gõ ít hơn 3 ký tự thì giấu hộp gợi ý đi
        if (query.length < 3) {
            suggestionBox.style.display = 'none';
            return;
        }

        // Đợi 0.6s sau khi ngừng gõ mới gọi API tìm kiếm
        debounceTimer = setTimeout(async () => {
            try {
                // Gọi API lấy 5 kết quả sát nhất
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
                const data = await response.json();

                suggestionBox.innerHTML = ''; // Xóa kết quả cũ

                if (data.length > 0) {
                    // Tạo danh sách hiển thị
                    data.forEach(place => {
                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.innerText = place.display_name; // Tên địa chỉ chi tiết
                        
                        // Xử lý khi click chọn 1 địa chỉ trong danh sách gợi ý
                        item.addEventListener('click', () => {
                            locationInput.value = place.display_name; // Điền vào ô input
                            suggestionBox.style.display = 'none'; // Giấu hộp gợi ý
                            
                            // Tự động di chuyển bản đồ đến điểm đó luôn
                            const lat = place.lat;
                            const lon = place.lon;
                            map.setView([lat, lon], 16);
                            marker.setLatLng([lat, lon]);
                            selectedLat = lat;
                            selectedLng = lon;
                        });

                        suggestionBox.appendChild(item);
                    });
                    suggestionBox.style.display = 'block'; // Hiện hộp gợi ý
                } else {
                    suggestionBox.style.display = 'none';
                }
            } catch (error) {
                console.error("Lỗi tìm địa chỉ gợi ý:", error);
            }
        }, 600); // 600 mili-giây
    });

    // Ẩn danh sách gợi ý khi người dùng click chuột ra ngoài vùng input
    document.addEventListener('click', function(e) {
        if (e.target !== locationInput && e.target !== suggestionBox) {
            suggestionBox.style.display = 'none';
        }
    });
}