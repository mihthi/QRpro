require('dotenv').config(); // Mở két sắt .env lấy mật khẩu
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// 1. Khởi tạo Máy chủ và kết nối Database
const app = express();
app.use(cors()); // Cho phép Frontend gọi tới
app.use(express.json()); // Giúp máy chủ đọc được dữ liệu dạng JSON

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Thuật toán mã hóa Base62 (Biến số thứ tự ID thành chữ ngắn)
const BASE62_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function encodeBase62(num) {
    if (num === 0) return BASE62_CHARSET[0];
    let result = "";
    while (num > 0) {
        result = BASE62_CHARSET[num % 62] + result;
        num = Math.floor(num / 62);
    }
    return result;
}

// 3. API 1: Xử lý yêu cầu RÚT GỌN LINK từ Frontend
app.post('/api/shorten', async (req, res) => {
    const { original_url, link_type = 'link' } = req.body;

    if (!original_url) {
        return res.status(400).json({ error: 'Vui lòng cung cấp link gốc!' });
    }

    try {
        // Bước A: Lưu link gốc vào Supabase để lấy ID tự động
        const { data: insertedData, error: insertError } = await supabase
            .from('links')
            .insert([{ original_url, link_type }])
            .select('id')
            .single();

        if (insertError) throw insertError;

        // Bước B: Chạy thuật toán Base62 với ID vừa có
        const id = insertedData.id;
        const shortCode = encodeBase62(id);

        // Bước C: Lưu ngược mã code ngắn này vào lại Database
        const { error: updateError } = await supabase
            .from('links')
            .update({ short_code: shortCode })
            .eq('id', id);

        if (updateError) throw updateError;

        // Trả kết quả về cho Giao diện
        const shortUrl = `https://tasty-dogs-jump.loca.lt/${shortCode}`;
        res.json({ success: true, short_url: shortUrl, short_code: shortCode });

    } catch (error) {
        console.error("Lỗi hệ thống:", error);
        res.status(500).json({ error: 'Lỗi máy chủ!' });
    }
});

// 4. Bật công tắc cho Máy chủ chạy ở cổng 3000
app.get('/:shortCode', async (req, res) => {
    const shortCode = req.params.shortCode;

    try {
        // Bước A: Vào Supabase tìm xem mã ngắn này tương ứng với Link gốc nào
        const { data, error } = await supabase
            .from('links')
            .select('original_url, click_count')
            .eq('short_code', shortCode)
            .single();

        // Nếu mã không tồn tại trong Database
        if (error || !data) {
            return res.status(404).send("<h1>Lỗi 404</h1><p>Đường link này không tồn tại hoặc đã bị hết hạn!</p>");
        }

        // Bước B: Cập nhật +1 lượt click và thời gian truy cập (Để phục vụ tính năng dọn rác 6 tháng)
        await supabase
            .from('links')
            .update({ 
                click_count: data.click_count + 1,
                last_accessed_at: new Date().toISOString()
            })
            .eq('short_code', shortCode);

        // Bước C: Ra lệnh cho trình duyệt chuyển hướng ngay lập tức sang Link gốc
        res.redirect(data.original_url);

    } catch (error) {
        console.error("Lỗi khi chuyển hướng:", error);
        res.status(500).send("Lỗi máy chủ!");
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Máy chủ Backend đang chạy tít mù tại: http://localhost:${PORT}`);
});