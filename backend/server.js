const express = require('express');
const cors = require('cors');
require('dotenv').config();

const dashboardRoutes = require('./routes/dashboard.routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Cấu hình CORS linh hoạt
// Lấy danh sách origin từ file .env. Nếu để *, cho phép tất cả các nguồn truy cập.
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Parser JSON cho body của request
app.use(express.json());

// 3. Đăng ký các Route (tất cả API có tiền tố /api)
app.use('/api', dashboardRoutes);

// 4. Xử lý lỗi 404 (Không tìm thấy route)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn ${req.originalUrl} không tồn tại trên hệ thống.`
  });
});

// 5. Middleware xử lý lỗi tập trung toàn hệ thống
app.use(errorMiddleware);

// Khởi động Server chỉ khi chạy trực tiếp file này (tránh xung đột cổng khi chạy tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(` Server đang chạy tại: http://localhost:${PORT}`);
    console.log(` Môi trường: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Hỗ trợ các API endpoints:`);
    console.log(` - Health check: GET http://localhost:${PORT}/api/health`);
    console.log(` - Test database: GET http://localhost:${PORT}/api/test-db`);
    console.log(` - Dashboard KPI: GET http://localhost:${PORT}/api/dashboard/kpi`);
    console.log(`========================================`);
  });
}

module.exports = app;
