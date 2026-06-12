const express = require('express');
const cors = require('cors');
require('dotenv').config();

const dashboardRoutes    = require('./routes/dashboard.routes');
const analyticsRoutes    = require('./routes/analytics.routes');
const errorMiddleware    = require('./middlewares/error.middleware');
const aiSentimentService = require('./services/ai-sentiment.service');

const app  = express();
const PORT = process.env.PORT || 5000;

// 1. Cấu hình CORS linh hoạt
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin:         corsOrigin === '*' ? '*' : corsOrigin.split(','),
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Parser JSON cho body của request
app.use(express.json());

// 3. Đăng ký các Route (tất cả API có tiền tố /api)
app.use('/api', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);

// 4. Xử lý lỗi 404 (Không tìm thấy route)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn ${req.originalUrl} không tồn tại trên hệ thống.`
  });
});

// 5. Middleware xử lý lỗi tập trung toàn hệ thống
app.use(errorMiddleware);

// ─── Kiểm tra PhoBERT ml-service khi backend khởi động ───────────────────────
/**
 * Gọi checkHealth() một lần sau khi server start.
 * Nếu ml-service khả dụng, tiếp tục gọi warmUp() để tránh cold start.
 * Backend vẫn khởi động bình thường dù ml-service không chạy hoặc warm-up thất bại.
 * Nếu ml-service không khả dụng, hệ thống tự dùng rule-based fallback.
 */
async function checkPhoBertOnStartup() {
  try {
    const health = await aiSentimentService.checkHealth();

    if (!health.available) {
      console.warn('[Backend] PhoBERT ml-service chưa khả dụng, hệ thống sẽ dùng rule-based fallback.');
      return;
    }

    // ml-service khả dụng → thực hiện warm-up proactively
    console.log('[Backend] PhoBERT ml-service sẵn sàng. Đang thực hiện warm-up...');

    try {
      await aiSentimentService.warmUp();
      console.log('[Backend] PhoBERT đã được warm-up thành công.');
    } catch (warmUpErr) {
      // warmUp() không bao giờ throw — nhánh này là safety net
      console.warn(`[Backend] PhoBERT warm-up thất bại: ${warmUpErr.message}. Hệ thống vẫn chạy, fallback sẵn sàng.`);
    }

  } catch (err) {
    // Không crash backend — chỉ log cảnh báo
    console.warn(`[Backend] Không thể kiểm tra ml-service: ${err.message}. Hệ thống sẽ dùng rule-based fallback.`);
  }
}

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
    console.log(` - [Sprint 6] Chạy phân tích: POST http://localhost:${PORT}/api/analytics/run`);
    console.log(` - [Sprint 6] Cảm xúc: GET http://localhost:${PORT}/api/analytics/sentiment-summary`);
    console.log(` - [Sprint 6] Chủ đề: GET http://localhost:${PORT}/api/analytics/topics`);
    console.log(` - [Sprint 6] Hài lòng: GET http://localhost:${PORT}/api/analytics/satisfaction-summary`);
    console.log(` - [Sprint 6] Cần xem xét: GET http://localhost:${PORT}/api/analytics/need-review-conversations`);
    console.log(` - [Sprint 6] Legacy cần xem xét: GET http://localhost:${PORT}/api/analytics/negative-conversations`);
    console.log(`========================================`);

    // Kiểm tra PhoBERT sau khi server đã lắng nghe — không block startup
    checkPhoBertOnStartup();
  });
}

module.exports = app;
