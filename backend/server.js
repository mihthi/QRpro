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

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Khởi tạo bộ kết nối với Amazon S3 bằng chìa khóa trong .env
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

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
// API 2: Xử lý Upload File (Hình ảnh / PDF) lên Amazon S3
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn file!' });
    }

    try {
        const file = req.file;
        const fileName = `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
        const bucketName = process.env.AWS_BUCKET_NAME;
        const region = process.env.AWS_REGION;

        // Bước A: Gửi file thẳng lên kho Amazon S3
        const uploadParams = {
            Bucket: bucketName,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: 'public-read' // Cấp quyền Public để ai quét QR cũng xem được
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Bước B: Lấy đường link gốc chuẩn của Amazon S3
        const originalUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;

        // Bước C: Rút gọn link của S3 bằng cơ sở dữ liệu Supabase
        const shortCode = generateShortCode(); 
        const { error: insertError } = await supabase
            .from('links')
            .insert([{ original_url: originalUrl, short_code: shortCode, link_type: 'file' }]);

        if (insertError) throw insertError;

        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const shortUrl = `${BASE_URL}/${shortCode}`;

        // Trả kết quả về cho giao diện vẽ mã QR
        res.json({ success: true, short_url: shortUrl, short_code: shortCode, original_url: originalUrl });

    } catch (error) {
        console.error("Lỗi khi tải file lên S3:", error);
        res.status(500).json({ error: 'Lỗi khi đẩy file lên kho chứa Amazon!' });
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