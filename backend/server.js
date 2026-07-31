require('dotenv').config(); // Mở két sắt .env lấy mật khẩu
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // Thư viện xử lý file upload
const { createClient } = require('@supabase/supabase-js');

// 1. Khởi tạo Máy chủ và kết nối Database
const app = express();
app.use(cors({
    origin: "*" // Tạm thời mở cho tất cả để dễ test, lúc chạy thật bạn đổi thành domain frontend
}));
app.use(express.json()); 

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cấu hình Multer lưu file tạm vào RAM trước khi đẩy lên Supabase
const upload = multer({ storage: multer.memoryStorage() });

// 2. Hàm tạo mã ngẫu nhiên (6 ký tự) - Giúp link trông xịn và đẹp hơn
function generateShortCode(length = 6) {
    const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += charset[Math.floor(Math.random() * charset.length)];
    }
    return result;
}

// 3. API 1: Xử lý yêu cầu RÚT GỌN LINK có hỗ trợ tên tùy chỉnh (Custom Alias)
app.post('/api/shorten', async (req, res) => {
    const { original_url, link_type = 'link', custom_alias } = req.body;

    if (!original_url) {
        return res.status(400).json({ error: 'Vui lòng cung cấp link gốc!' });
    }

    try {
        let shortCode = "";

        // Kiểm tra xem user có nhập tên link theo ý muốn không
        if (custom_alias && custom_alias.trim() !== "") {
            shortCode = custom_alias.trim();

            // Check xem tên này đã có ai xài chưa
            const { data: existingLink } = await supabase
                .from('links')
                .select('id')
                .eq('short_code', shortCode)
                .single();

            if (existingLink) {
                return res.status(400).json({ error: 'Tên link này đã tồn tại, vui lòng chọn tên khác!' });
            }
        } else {
            // Nếu không nhập, tự động sinh mã 6 ký tự
            shortCode = generateShortCode();
        }

        // Lưu vào Database với 1 thao tác duy nhất
        const { error: insertError } = await supabase
            .from('links')
            .insert([{ original_url, short_code: shortCode, link_type }]);

        if (insertError) throw insertError;

        const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
        const shortUrl = `${BASE_URL}/${shortCode}`;

        res.json({ success: true, short_url: shortUrl, short_code: shortCode });

    } catch (error) {
        console.error("Lỗi hệ thống shorten:", error);
        res.status(500).json({ error: 'Lỗi máy chủ khi tạo link!' });
    }
});

// 4. API 2: Xử lý Upload File (Hình ảnh / PDF) và tự động rút gọn
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn file!' });
    }

    try {
        const file = req.file;
        // Tạo tên file độc nhất để không bị trùng
        const fileName = `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;

        // Bước A: Upload file lên Supabase Storage (Nhớ tạo bucket tên là 'uploads' trên Supabase)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype
            });

        if (uploadError) throw uploadError;

        // Bước B: Lấy đường link Public của file
        const { data: publicUrlData } = supabase.storage
            .from('uploads')
            .getPublicUrl(fileName);
        
        const originalUrl = publicUrlData.publicUrl;

        // Bước C: Rút gọn link của file đó
        const shortCode = generateShortCode();
        const { error: insertError } = await supabase
            .from('links')
            .insert([{ original_url: originalUrl, short_code: shortCode, link_type: 'file' }]);

        if (insertError) throw insertError;

        const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
        const shortUrl = `${BASE_URL}/${shortCode}`;

        res.json({ success: true, short_url: shortUrl, short_code: shortCode, original_url: originalUrl });

    } catch (error) {
        console.error("Lỗi upload:", error);
        res.status(500).json({ error: 'Lỗi khi xử lý tải file lên!' });
    }
});

// 5. API 3: Chuyển hướng người dùng khi truy cập link ngắn
app.get('/:shortCode', async (req, res) => {
    const shortCode = req.params.shortCode;

    try {
        const { data, error } = await supabase
            .from('links')
            .select('original_url, click_count')
            .eq('short_code', shortCode)
            .single();

        if (error || !data) {
            return res.status(404).send("<h1>Lỗi 404</h1><p>Đường link này không tồn tại hoặc đã bị hết hạn!</p>");
        }

        // Cập nhật lượt click chạy ngầm, không dùng await để user được chuyển hướng ngay lập tức
        supabase
            .from('links')
            .update({ 
                click_count: data.click_count + 1,
                last_accessed_at: new Date().toISOString()
            })
            .eq('short_code', shortCode)
            .then();

        res.redirect(data.original_url);

    } catch (error) {
        console.error("Lỗi khi chuyển hướng:", error);
        res.status(500).send("Lỗi máy chủ!");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend đang chạy tại: http://localhost:${PORT}`);
});