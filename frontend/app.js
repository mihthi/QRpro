// 1. BIẾN TOÀN CỤC CHỨA ID THIẾT BỊ
let deviceFingerprint = "";

// 2. KHỞI TẠO HỆ THỐNG NHẬN DIỆN THIẾT BỊ KHI TRANG VỪA TẢI
document.addEventListener("DOMContentLoaded", () => {
    const fpPromise = FingerprintJS.load();
    fpPromise
        .then(fp => fp.get())
        .then(result => {
            deviceFingerprint = result.visitorId;
            document.getElementById('fp-display').innerText = deviceFingerprint;
        })
        .catch(error => {
            console.error("Lỗi nhận diện thiết bị:", error);
            document.getElementById('fp-display').innerText = "Không thể nhận diện";
        });
});

// 3. LOGIC CHUYỂN ĐỔI TAB (LINK VÀ FILE)
function switchTab(tabName) {
    // Ẩn tất cả nội dung
    document.getElementById('content-link').style.display = 'none';
    document.getElementById('content-file').style.display = 'none';
    document.getElementById('result-box').style.display = 'none'; // Ẩn luôn kết quả cũ

    // Xóa class active của tất cả các tab
    document.getElementById('tab-link').classList.remove('active');
    document.getElementById('tab-file').classList.remove('active');

    // Hiển thị nội dung và bật active cho tab được chọn
    document.getElementById('content-' + tabName).style.display = 'block';
    document.getElementById('tab-' + tabName).classList.add('active');
}

// 4. XỬ LÝ KHI NGƯỜI DÙNG BẤM NÚT "TẠO MÃ"
function processForm(type) {
    let finalDataToQR = "";
    let messageToUser = "";

    // LUỒNG 1: QR TĨNH (VĂN BẢN/LINK)
    if (type === 'link') {
        const urlInput = document.getElementById('url-input').value.trim();
        if (urlInput === "") {
            alert("Vui lòng không để trống ô nhập liệu!");
            return;
        }
        
        finalDataToQR = urlInput;
        messageToUser = "Đây là mã QR Tĩnh vĩnh viễn của bạn.";
    } 
    
    // LUỒNG 2 & 3: TẢI FILE LÊN (QR ĐỘNG)
    else if (type === 'file') {
        const fileInput = document.getElementById('file-input');
        
        // Kiểm tra xem đã chọn file chưa
        if (fileInput.files.length === 0) {
            alert("Vui lòng chọn một file từ máy tính!");
            return;
        }

        const selectedFile = fileInput.files[0];
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB tính bằng Byte

        // CHẶN BẢO MẬT: Kiểm tra dung lượng file
        if (selectedFile.size > MAX_FILE_SIZE) {
            alert(`Lỗi! Dung lượng file của bạn là ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB.\nHệ thống chỉ cho phép tối đa 5MB.`);
            return;
        }

        // Tương lai: Gửi `selectedFile` và `deviceFingerprint` xuống Backend (Node.js) ở đây.
        // Tạm thời giả lập Backend trả về một Link rút gọn:
        const mockShortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        finalDataToQR = "https://qrpro.vn/" + mockShortCode;
        messageToUser = `Link tải file của bạn: ${finalDataToQR}`;
    }

    // Hiển thị kết quả ra màn hình
    document.getElementById('result-box').style.display = 'block';
    document.getElementById('result-text').innerText = messageToUser;
    
    // Xóa mã QR cũ và vẽ mã QR mới
    const qrContainer = document.getElementById('qr-render');
    qrContainer.innerHTML = ""; // Xóa canvas cũ
    
    new QRCode(qrContainer, {
        text: finalDataToQR,
        width: 200,
        height: 200,
        colorDark: "#2fb33b", // Quét bằng màu Xanh lá chủ đạo
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H // Chuẩn phục hồi lỗi cao nhất
    });
}