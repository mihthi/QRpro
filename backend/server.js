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
const upload = multer({
    storage: multer.memoryStorage(), // Giữ file trong RAM tạm thời để đẩy lên S3
    limits: {
        files: 3,                  // Giới hạn tối đa: 10 file trong 1 lần tải
        fileSize: 10 * 1024 * 1024   // Giới hạn dung lượng: 10MB mỗi file (Tính bằng Byte: 5 * 1024 * 1024)
    },
    // (Tùy chọn) Bộ lọc chỉ cho phép ảnh hoặc PDF
    // fileFilter: function (req, file, cb) {
    //     if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    //         cb(null, true);
    //     } else {
    //         cb(new Error('Chỉ chấp nhận file hình ảnh hoặc PDF!'));
    //     }
    // }
});

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Khởi tạo bộ kết nối với Amazon S3 bằng chìa khóa trong .env
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// API 1: Xử lý yêu cầu RÚT GỌN LINK (Văn bản, link URL)
app.post('/api/shorten', async (req, res) => {
    const { original_url, link_type, custom_alias } = req.body;
    if (!original_url) return res.status(400).json({ error: "Thiếu URL gốc!" });

    try {
        let shortCode = custom_alias ? custom_alias : generateShortCode();
        const { error } = await supabase.from('links').insert([{ 
            original_url, 
            short_code: shortCode, 
            link_type: link_type || 'link' 
        }]);
        
        if (error) throw error;
        
        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        res.json({ success: true, short_url: `${BASE_URL}/${shortCode}`, short_code: shortCode });
    } catch (error) {
        console.error("Lỗi rút gọn link:", error);
        res.status(500).json({ error: "Lỗi máy chủ hoặc tên rút gọn đã tồn tại!" });
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
// --- HÀM BẢO VỆ: ĐẾM LƯỢT TRONG NGÀY ---
async function checkRateLimit(fingerprint) {
    if (!fingerprint) return true; // Nếu lỗi không có vân tay thì tạm cho qua
    
    // Lấy ngày hôm nay (Ví dụ: 2026-07-31)
    const today = new Date().toISOString().split('T')[0];
    
    // Yêu cầu Supabase đếm số dòng của vân tay này trong ngày hôm nay
    const { count, error } = await supabase
        .from('links')
        .select('*', { count: 'exact', head: true })
        .eq('fingerprint', fingerprint)
        .gte('created_at', today);
        
    return count < 3; // Nếu nhỏ hơn 10 thì trả về true (Cho phép đi tiếp)
}

// 3. API 1: Xử lý yêu cầu RÚT GỌN LINK có hỗ trợ tên tùy chỉnh (Custom Alias)
// API 2: Upload MẢNG File lên S3 & Tạo Album (Đã tích hợp chặn 10 lượt/ngày)
app.post('/api/upload', upload.array('files', 3), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 file!' });
    }

    const fingerprint = req.body.fingerprint;

    // --- KIỂM TRA GIỚI HẠN 10 LƯỢT/NGÀY ---
    if (fingerprint) {
        const today = new Date().toISOString().split('T')[0];
        const { count, error: countError } = await supabase
            .from('links')
            .select('*', { count: 'exact', head: true })
            .eq('fingerprint', fingerprint)
            .gte('created_at', today);

        if (count >= 3) {
            return res.status(403).json({ error: "Hôm nay bạn đã tạo tối đa 3 mã/link. Hãy quay lại vào ngày mai nhé!" });
        }
    }
    // ---------------------------------------

    try {
        const bucketName = process.env.AWS_BUCKET_NAME;
        const region = process.env.AWS_REGION;

        // Dùng vòng lặp tải toàn bộ mảng lên S3
        const uploadPromises = req.files.map(file => {
            const fileName = `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
            console.log(file.originalname);
            const uploadParams = {
                Bucket: bucketName,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype
            };
            
            return s3Client.send(new PutObjectCommand(uploadParams)).then(() => {
                return `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
            });
        });

        // Chờ tất cả file tải xong và lấy danh sách link AWS
        const fileUrls = await Promise.all(uploadPromises);
        
        // Rút gọn link, đánh dấu loại 'album' và LƯU LẠI FINGERPRINT
        const shortCode = generateShortCode(); 
        const { error: insertError } = await supabase
            .from('links')
            .insert([{ 
                original_url: JSON.stringify(fileUrls), // Lưu nguyên mảng vào Database
                short_code: shortCode, 
                link_type: 'album',
                fingerprint: fingerprint // Lưu mã vân tay thiết bị vào bảng
            }]);

        if (insertError) throw insertError;

        const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const shortUrl = `${BASE_URL}/${shortCode}`;

        res.json({ success: true, short_url: shortUrl, short_code: shortCode });

    } catch (error) {
        console.error("Lỗi khi tải file lên S3:", error);
        res.status(500).json({ error: 'Lỗi khi đẩy file lên kho chứa Amazon!' });
    }
});

// 5. API 3: Chuyển hướng người dùng khi truy cập link ngắn
app.get('/:shortCode', async (req, res) => {
    const shortCode = req.params.shortCode;

    try {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .eq('short_code', shortCode)
            .single();

        if (error || !data) {
            return res.status(404).send("<h1>Lỗi 404</h1><p>Đường link này không tồn tại!</p>");
        }

        // Cập nhật lượt click
        supabase
            .from('links')
            .update({ 
                click_count: (data.click_count || 0) + 1,
                last_accessed_at: new Date().toISOString()
            })
            .eq('short_code', shortCode)
            .then();

        // NẾU LÀ LOẠI ALBUM ẢNH
        if (data.link_type === 'album') {
            const urls = JSON.parse(data.original_url);
            
            let htmlGallery = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Bộ sưu tập QR Pro</title>
                    <style>
                        body { font-family: sans-serif; background-color: #f3f4f6; padding: 20px; text-align: center; }
                        .gallery { display: flex; flex-direction: column; gap: 15px; align-items: center; max-width: 600px; margin: 0 auto; }
                        img { max-width: 100%; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 3px solid white; }
                        .pdf-btn { display: block; width: 100%; box-sizing: border-box; padding: 15px; background: white; border-radius: 12px; text-decoration: none; color: #10b981; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    </style>
                </head>
                <body>
                    <h3 style="color:#374151">Bộ Sưu Tập File</h3>
                    <div class="gallery">
            `;
            
            urls.forEach(url => {
                            try {
                                // Giải mã chuẩn tiếng Việt để không bị lỗi ký tự lạ
                                const rawFileName = url.split('/').pop().split('?')[0];

                                let displayName = decodeURIComponent(rawFileName);

                                // sửa lỗi UTF8
                                displayName = Buffer
                                    .from(displayName, "latin1")
                                    .toString("utf8");

                                // bỏ timestamp
                                displayName = displayName.replace(/^\d+_/, "");

                                if (url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                                    htmlGallery += `
                                        <div style="margin-bottom: 10px; width: 100%;">
                                            <img src="${url}" loading="lazy" style="width: 100%; border-radius: 12px;" />
                                            <p style="font-size: 14px; color: #374151; font-weight: bold; margin-top: 6px;">${displayName}</p>
                                        </div>
                                    `;
                                } else {
                                    // Chỉ hiển thị đúng tên file gọn gàng, không có chữ thừa
                                    htmlGallery += `<a href="${url}" target="_blank" class="file-btn">📎 ${displayName}</a>`;
                                }
                            } catch (e) {
                                htmlGallery += `<a href="${url}" target="_blank" class="file-btn">📎 Tải xuống file</a>`;
                            }
                        });

            htmlGallery += `</div></body></html>`;
            return res.send(htmlGallery);
        }

        // NẾU LÀ LOẠI LINK BÌNH THƯỜNG => Chuyển hướng thẳng
        res.redirect(data.original_url);

    } catch (error) {
        console.error("Lỗi hệ thống:", error);
        res.status(500).send("Lỗi máy chủ!");
    }
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    // So sánh với thông tin trong két sắt .env
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        res.json({ success: true, token: process.env.ADMIN_TOKEN });
    } else {
        res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu!" });
    }
});

// Middleware: Người bảo vệ - Kiểm tra Token
function verifyAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (token === `Bearer ${process.env.ADMIN_TOKEN}`) {
        next();
    } else {
        res.status(403).json({ error: "Không có quyền truy cập!" });
    }
}

// 2. API Lấy toàn bộ dữ liệu từ bảng links
app.get('/api/admin/links', verifyAdmin, async (req, res) => {
    const secretKey = req.query.key;
    if (secretKey !== 'gjcungdc') {
        return res.status(403).json({ success: false, message: 'Sai mã bảo vệ!' });
    }
    const { data, error } = await supabase
        .from('links')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// 3. API Xóa 1 dữ liệu bất kỳ bằng ID
app.delete('/api/admin/links/:id', verifyAdmin, async (req, res) => {
    const linkId = req.params.id;
    const { error } = await supabase.from('links').delete().eq('id', linkId);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// =======================================================
// API ẨN: TỰ ĐỘNG DỌN RÁC (Được gọi bởi cron-job.org)
// =======================================================
app.get('/api/admin/cron-cleanup', async (req, res) => {
    // 1. Kiểm tra chìa khóa bảo mật (Ngăn chặn người ngoài gọi bậy bạ)
    const secretKey = req.query.key;
    if (secretKey !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: "Từ chối truy cập! Sai chìa khóa." });
    }

    try {
        const today = new Date();
        let deletedCount = 0;

        // ĐIỀU KIỆN 1: Xóa link quá 7 ngày mà không có ai click
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
        const { data: data1, error: err1 } = await supabase
            .from('links')
            .delete()
            .or('click_count.eq.0,click_count.is.null') 
            .lt('created_at', sevenDaysAgo)
            .select(); // Lấy ra danh sách đã xóa để đếm

        if (!err1 && data1) deletedCount += data1.length;

        // ĐIỀU KIỆN 2: Xóa link ngủ đông quá 90 ngày
        const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString();
        const { data: data2, error: err2 } = await supabase
            .from('links')
            .delete()
            .lt('last_accessed_at', ninetyDaysAgo)
            .select();

        if (!err2 && data2) deletedCount += data2.length;

        // Trả kết quả về cho hệ thống cron-job
        res.json({ 
            success: true, 
            message: `Hoàn tất! Đã dọn dẹp tổng cộng ${deletedCount} link rác.` 
        });

    } catch (error) {
        console.error("Lỗi dọn rác:", error);
        res.status(500).json({ error: "Lỗi máy chủ khi dọn dẹp" });
    }
});
// =======================================================
// BẬT MÁY CHỦ LẮNG NGHE TẠI CỔNG
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend đang chạy tại cổng: ${PORT}`);
});

module.exports = app;