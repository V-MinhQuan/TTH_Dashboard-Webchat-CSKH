const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const analyticsController = require('../controllers/analytics.controller');
const { poolPromise } = require('../config/db');

/**
 * @route   GET /api/health
 * @desc    Kiểm tra backend có đang chạy bình thường không
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend is running successfully.'
  });
});

/**
 * @route   GET /api/test-db
 * @desc    Kiểm tra kết nối tới SQL Server bằng lệnh SELECT GETDATE()
 * @access  Public
 */
router.get('/test-db', async (req, res, next) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT GETDATE() AS db_time');
    
    return res.status(200).json({
      success: true,
      message: 'Database connection test successful',
      data: {
        serverTime: result.recordset[0].db_time
      }
    });
  } catch (err) {
    // Chuyển lỗi sang Error Middleware để trả về kết quả định dạng chuẩn
    next(err);
  }
});

/**
 * @route   GET /api/dashboard/kpi
 * @desc    Lấy KPI của dashboard, hỗ trợ lọc theo ngày
 * @access  Public
 */
router.get('/dashboard/kpi', dashboardController.getKPI);

/**
 * @route   POST /api/sentiment/predict
 * @desc    Dự báo cảm xúc thời gian thực
 * @access  Public
 */
router.post('/sentiment/predict', analyticsController.predictSentiment.bind(analyticsController));

/**
 * @route   GET /api/health/ml
 * @desc    Kiểm tra trạng thái sức khỏe ml-service
 * @access  Public
 */
router.get('/health/ml', analyticsController.getMlHealth.bind(analyticsController));

module.exports = router;
