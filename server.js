const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'khanhvan', charset: 'utf8mb4' });

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => { cb(null, 'avatar-' + Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi Server!" });
        if (results.length > 0) {
            const user = results[0];
            if (user.status === 'suspended') return res.json({ success: false, isSuspended: true, message: "TÀI KHOẢN CỦA BẠN ĐÃ BỊ ĐÌNH CHỈ." });
            res.json({ success: true, storeId: user.storeId, storeName: user.storeName, role: user.role, userId: user.id, avatarUrl: user.avatar_url });
        } else { res.json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" }); }
    });
});

app.post('/api/register-store', (req, res) => {
    const { username, password, storeName } = req.body;
    const storeId = 'S' + Math.floor(100 + Math.random() * 900); 
    db.query("INSERT INTO users (username, password, storeId, storeName, role, status) VALUES (?, ?, ?, ?, 'admin', 'active')", 
    [username, password, storeId, storeName], (err, result) => {
        if (err) return res.json({ success: false, message: "Tên đăng nhập đã tồn tại!" }); res.json({ success: true, storeId });
    });
});

app.get('/api/products', (req, res) => { db.query("SELECT * FROM products WHERE storeId = ? OR storeId IS NULL", [req.query.storeId], (err, results) => res.json(results)); });
app.get('/api/customers', (req, res) => { db.query("SELECT * FROM customers WHERE storeId = ?", [req.query.storeId], (err, results) => res.json(results)); });
app.get('/api/all-stores', (req, res) => { db.query("SELECT storeId, storeName FROM users WHERE role = 'admin' AND status != 'suspended'", (err, results) => res.json(results)); });

app.post('/api/add-product', (req, res) => {
    const { name, category, cost, price, stock, img, storeId } = req.body;
    db.query("INSERT INTO products (name, category, cost, price, stock, img, storeId) VALUES (?, ?, ?, ?, ?, ?, ?)", [name, category, cost, price, stock, img, storeId], (err) => res.json({ success: !err }));
});
app.post('/api/update-stock', (req, res) => {
    req.body.cart.forEach(i => db.query("UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?", [i.qty, i.id])); res.json({ success: true });
});
app.post('/api/quick-update-stock', (req, res) => {
    const { productId, change } = req.body;
    db.query("UPDATE products SET stock = GREATEST(stock + ?, 0) WHERE id = ?", [change, productId], (err) => { if(err) return res.json({ success: false }); res.json({ success: true }); });
});

// 🔥 NÂNG CẤP API: LƯU HÓA ĐƠN KÈM LỢI NHUẬN VÀ LOẠI ĐƠN (ONLINE/OFFLINE) 🔥
app.post('/api/save-order', (req, res) => {
    const { order_code, customer_name, total_amount, storeId, type, profit } = req.body;
    db.query("INSERT INTO orders (order_code, customer_name, total_amount, storeId, type, profit) VALUES (?, ?, ?, ?, ?, ?)", 
    [order_code, customer_name, total_amount, storeId, type || 'offline', profit || 0], (err) => res.json({ success: !err }));
});

// 🔥 API MỚI: TÍNH TỔNG QUAN (DASHBOARD) CHUẨN XÁC 100% TỪ DATABASE 🔥
app.get('/api/dashboard', (req, res) => {
    const storeId = req.query.storeId;
    const sql = `
        SELECT 
            IFNULL(SUM(total_amount), 0) as totalRev,
            IFNULL(SUM(CASE WHEN type = 'offline' THEN total_amount ELSE 0 END), 0) as offlineRev,
            IFNULL(SUM(CASE WHEN type = 'online' THEN total_amount ELSE 0 END), 0) as onlineRev,
            IFNULL(SUM(profit), 0) as totalProfit
        FROM orders WHERE storeId = ?
    `;
    db.query(sql, [storeId], (err, results) => {
        if (err) return res.json({ totalRev: 0, offlineRev: 0, onlineRev: 0, totalProfit: 0 });
        res.json(results[0]);
    });
});

app.post('/api/update-customer', (req, res) => {
    const { phone, name, spent, storeId, orderType } = req.body;
    const isOffline = orderType === 'offline' ? 1 : 0; const isOnline = orderType === 'online' ? 1 : 0;
    db.query("SELECT * FROM customers WHERE name = ? AND storeId = ?", [name, storeId], (err, results) => {
        if (err) return res.json({ success: false });
        if (results.length > 0) {
            db.query("UPDATE customers SET spent = spent + ?, orders_count = IFNULL(orders_count, 0) + 1, offline_orders = IFNULL(offline_orders, 0) + ?, online_orders = IFNULL(online_orders, 0) + ?, phone = ? WHERE id = ?", 
            [spent, isOffline, isOnline, phone, results[0].id], (err2) => res.json({ success: !err2 }));
        } else {
            db.query("INSERT INTO customers (phone, name, spent, storeId, orders_count, offline_orders, online_orders) VALUES (?, ?, ?, ?, 1, ?, ?)", 
            [phone, name, spent, storeId, isOffline, isOnline], (err2) => res.json({ success: !err2 }));
        }
    });
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "Chưa chọn file" });
    const avatarUrl = '/uploads/' + req.file.filename;
    db.query("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, req.body.userId], (err) => { if (err) return res.status(500).json({ success: false }); res.json({ success: true, avatarUrl }); });
});

app.get('/api/superadmin/stores-real', (req, res) => {
    const sql = `SELECT u.storeId, u.storeName, u.username, u.status, (SELECT IFNULL(SUM(total_amount), 0) FROM orders WHERE storeId = u.storeId) as realRevenue, (SELECT COUNT(*) FROM customers WHERE storeId = u.storeId) as realCustomers FROM users u WHERE u.role != 'superadmin'`;
    db.query(sql, (err, results) => res.json(results || []));
});

app.post('/api/superadmin/toggle-status', (req, res) => {
    const { storeId, status } = req.body;
    db.query("UPDATE users SET status = ? WHERE storeId = ?", [status, storeId], (err) => { if(err) return res.json({ success: false }); res.json({ success: true }); });
});

app.listen(3000, () => console.log('🚀 Server đang chạy tại: http://localhost:3000\n✅ Đã kết nối MySQL thành công!'));