const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

/**
 * @route   POST /api/analytics/run
 * @desc    Kích hoạt pipeline phân tích cảm xúc & chủ đề cho tin nhắn mới
 * @body    { limit?: number, startDate?: string, endDate?: string, forceReanalyze?: boolean }
 * @access  Public (nội bộ - nên dùng cron job hoặc trigger thủ công)
 */
router.post('/run', analyticsController.runAnalytics.bind(analyticsController));

/**
 * @route   GET /api/analytics/sentiment-summary
 * @desc    Tổng hợp số lượng tin nhắn theo nhãn cảm xúc (positive/negative/neutral)
 * @query   startDate?, endDate?, source?
 * @access  Public
 */
router.get('/sentiment-summary', analyticsController.getSentimentSummary.bind(analyticsController));

/**
 * @route   GET /api/analytics/sentiment-trend
 * @desc    Xu hướng cảm xúc theo từng ngày
 * @query   startDate?, endDate?, source?
 * @access  Public
 */
router.get('/sentiment-trend', analyticsController.getSentimentTrend.bind(analyticsController));

/**
 * @route   GET /api/analytics/satisfaction-summary
 * @desc    Tổng hợp điểm hài lòng trung bình và phân bổ theo mức độ
 * @query   startDate?, endDate?, source?
 * @access  Public
 */
router.get('/satisfaction-summary', analyticsController.getSatisfactionSummary.bind(analyticsController));

/**
 * @route   GET /api/analytics/satisfaction-trend
 * @desc    Xu hướng điểm hài lòng theo từng ngày
 * @query   startDate?, endDate?, source?
 * @access  Public
 */
router.get('/satisfaction-trend', analyticsController.getSatisfactionTrend.bind(analyticsController));

/**
 * @route   GET /api/analytics/topics
 * @desc    Danh sách chủ đề hội thoại phổ biến nhất (sắp xếp giảm dần)
 * @query   startDate?, endDate?, source?
 * @access  Public
 */
router.get('/topics', analyticsController.getTopicSummary.bind(analyticsController));

/**
 * @route   GET /api/analytics/negative-keywords
 * @desc    Top 50 từ khóa tiêu cực xuất hiện nhiều nhất
 * @query   startDate?, endDate?, source?
 * @access  Public
 */
router.get('/negative-keywords', analyticsController.getNegativeKeywords.bind(analyticsController));

/**
 * @route   GET /api/analytics/need-review-keywords
 * @desc    Top tu khoa/issue type trong nhom can nhan vien xem xet
 * @query   startDate?, endDate?, source?, mode?=needReview|issue
 * @access  Public
 */
router.get('/need-review-keywords', analyticsController.getNeedReviewKeywords.bind(analyticsController));

/**
 * @route   GET /api/analytics/negative-conversations
 * @desc    Danh sách hội thoại cần xem xét thủ công (needStaffReview = 1), có phân trang
 * @query   startDate?, endDate?, source?, page?, pageSize?
 * @access  Public
 */
router.get('/negative-conversations', analyticsController.getNegativeConversations.bind(analyticsController));

/**
 * @route   GET /api/analytics/need-review-conversations
 * @desc    Canonical alias cho danh sach hoi thoai can nhan vien xem xet
 * @query   startDate?, endDate?, source?, page?, pageSize?
 * @access  Public
 */
router.get('/need-review-conversations', analyticsController.getNeedReviewConversations.bind(analyticsController));

module.exports = router;
