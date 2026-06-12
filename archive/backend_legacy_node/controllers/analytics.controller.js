const analyticsService = require('../services/analytics.service');
const aiSentimentService = require('../services/ai-sentiment.service');
const sentimentAnalyzer = require('../services/sentiment-analyzer.service');

/**
 * Controller cho module PhÃ¢n tÃ­ch Cáº£m xÃºc & Xu hÆ°á»›ng (Sprint 6)
 *
 * Táº¥t cáº£ response theo chuáº©n: { success: boolean, message: string, data: any }
 */

// â”€â”€â”€ Helper: Validate tham sá»‘ ngÃ y â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDateParams(req, res) {
  const { startDate, endDate } = req.query;

  if (startDate && !ISO_DATE_REGEX.test(startDate)) {
    res.status(400).json({
      success: false,
      message: 'Äá»‹nh dáº¡ng startDate khÃ´ng há»£p lá»‡. Vui lÃ²ng dÃ¹ng Ä‘á»‹nh dáº¡ng YYYY-MM-DD (vÃ­ dá»¥: 2026-06-01).'
    });
    return false;
  }

  if (endDate && !ISO_DATE_REGEX.test(endDate)) {
    res.status(400).json({
      success: false,
      message: 'Äá»‹nh dáº¡ng endDate khÃ´ng há»£p lá»‡. Vui lÃ²ng dÃ¹ng Ä‘á»‹nh dáº¡ng YYYY-MM-DD (vÃ­ dá»¥: 2026-06-30).'
    });
    return false;
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    res.status(400).json({
      success: false,
      message: 'NgÃ y báº¯t Ä‘áº§u (startDate) khÃ´ng thá»ƒ lá»›n hÆ¡n ngÃ y káº¿t thÃºc (endDate).'
    });
    return false;
  }

  return true;
}

// â”€â”€â”€ Helper: Láº¥y filters chung tá»« query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getCommonFilters(req) {
  return {
    startDate: req.query.startDate || undefined,
    endDate:   req.query.endDate   || undefined,
    source:    req.query.source    || undefined,
    sentiment: req.query.sentiment || undefined,
    topic:     req.query.topic     || undefined
  };
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getKeywordMode(req, defaultMode = 'negative') {
  const mode = req.query.mode || defaultMode;
  return ['negative', 'needReview', 'issue'].includes(mode) ? mode : null;
}

class AnalyticsController {

  /**
   * POST /api/analytics/run
   * KÃ­ch hoáº¡t pipeline phÃ¢n tÃ­ch tin nháº¯n
   */
  async runAnalytics(req, res, next) {
    try {
      const {
        limit = 500,
        startDate,
        endDate,
        forceReanalyze = false,
        force = false,
        mode
      } = req.body || {};

      // Validate limit
      const parsedLimit = parseInt(limit);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Tham sá»‘ limit khÃ´ng há»£p lá»‡. Vui lÃ²ng truyá»n sá»‘ nguyÃªn tá»« 1 Ä‘áº¿n 5000.'
        });
      }

      // Validate dates náº¿u cÃ³
      if (startDate && !ISO_DATE_REGEX.test(startDate)) {
        return res.status(400).json({
          success: false,
          message: 'Äá»‹nh dáº¡ng startDate khÃ´ng há»£p lá»‡. DÃ¹ng YYYY-MM-DD.'
        });
      }
      if (endDate && !ISO_DATE_REGEX.test(endDate)) {
        return res.status(400).json({
          success: false,
          message: 'Äá»‹nh dáº¡ng endDate khÃ´ng há»£p lá»‡. DÃ¹ng YYYY-MM-DD.'
        });
      }

      if (mode && mode !== 'reprocess-sample') {
        return res.status(400).json({
          success: false,
          message: 'Tham sá»‘ mode khÃ´ng há»£p lá»‡. Hiá»‡n chá»‰ há»— trá»£ "reprocess-sample" cho cháº¡y máº«u an toÃ n.'
        });
      }

      const shouldForceReanalyze = parseBoolean(forceReanalyze) || parseBoolean(force);

      console.log(`[AnalyticsController] Báº¯t Ä‘áº§u phÃ¢n tÃ­ch: limit=${parsedLimit}, force=${shouldForceReanalyze}, mode=${mode || 'default'}`);

      const result = await analyticsService.runAnalytics({
        limit: parsedLimit,
        startDate,
        endDate,
        forceReanalyze: shouldForceReanalyze,
        mode
      });

      return res.status(200).json({
        success: true,
        message: `PhÃ¢n tÃ­ch hoÃ n táº¥t. ÄÃ£ xá»­ lÃ½ ${result.processed} tin nháº¯n, lÆ°u ${result.saved} báº£n ghi.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/sentiment-summary
   * Tá»•ng há»£p cáº£m xÃºc (positive/negative/neutral)
   */
  async getSentimentSummary(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;
      const filters = getCommonFilters(req);
      const data = await analyticsService.getSentimentSummary(filters);
      return res.status(200).json({ success: true, message: 'Láº¥y tá»•ng há»£p cáº£m xÃºc thÃ nh cÃ´ng.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/sentiment-trend
   * Xu hÆ°á»›ng cáº£m xÃºc theo ngÃ y
   */
  async getSentimentTrend(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;
      const filters = getCommonFilters(req);
      const data = await analyticsService.getSentimentTrend(filters);
      return res.status(200).json({ success: true, message: 'Láº¥y xu hÆ°á»›ng cáº£m xÃºc thÃ nh cÃ´ng.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/satisfaction-summary
   * Tá»•ng há»£p Ä‘iá»ƒm hÃ i lÃ²ng
   */
  async getSatisfactionSummary(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;
      const filters = getCommonFilters(req);
      const data = await analyticsService.getSatisfactionSummary(filters);
      return res.status(200).json({ success: true, message: 'Láº¥y tá»•ng há»£p Ä‘iá»ƒm hÃ i lÃ²ng thÃ nh cÃ´ng.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/satisfaction-trend
   * Xu hÆ°á»›ng hÃ i lÃ²ng theo ngÃ y
   */
  async getSatisfactionTrend(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;
      const filters = getCommonFilters(req);
      const data = await analyticsService.getSatisfactionTrend(filters);
      return res.status(200).json({ success: true, message: 'Láº¥y xu hÆ°á»›ng hÃ i lÃ²ng thÃ nh cÃ´ng.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/topics
   * Danh sÃ¡ch chá»§ Ä‘á» phá»• biáº¿n
   */
  async getTopicSummary(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;
      const filters = getCommonFilters(req);
      const data = await analyticsService.getTopicSummary(filters);
      return res.status(200).json({ success: true, message: 'Láº¥y tá»•ng há»£p chá»§ Ä‘á» thÃ nh cÃ´ng.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/analytics/negative-keywords
   * Top tá»« khÃ³a tiÃªu cá»±c phá»• biáº¿n nháº¥t
   */
  async getNegativeKeywords(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;
      const mode = getKeywordMode(req, 'negative');
      if (!mode) {
        return res.status(400).json({
          success: false,
          message: 'mode khong hop le. Vui long dung negative, needReview hoac issue.'
        });
      }
      const filters = { ...getCommonFilters(req), mode };
      const data = await analyticsService.getNegativeKeywords(filters);
      return res.status(200).json({ success: true, message: 'Láº¥y danh sÃ¡ch tá»« khÃ³a tiÃªu cá»±c thÃ nh cÃ´ng.', data });
    } catch (err) {
      next(err);
    }
  }

  async getNeedReviewKeywords(req, res, next) {
    req.query.mode = req.query.mode || 'needReview';
    return this.getNegativeKeywords(req, res, next);
  }

  /**
   * GET /api/analytics/negative-conversations
   * Danh sÃ¡ch há»™i thoáº¡i cáº§n xem xÃ©t (needStaffReview = 1), há»— trá»£ phÃ¢n trang
   */
  async getNegativeConversations(req, res, next) {
    try {
      if (!validateDateParams(req, res)) return;

      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;

      if (page < 1 || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tham sá»‘ phÃ¢n trang khÃ´ng há»£p lá»‡. page â‰¥ 1, pageSize tá»« 1 Ä‘áº¿n 100.'
        });
      }

      const filters = {
        ...getCommonFilters(req),
        page,
        pageSize
      };

      const data = await analyticsService.getNegativeConversations(filters);
      return res.status(200).json({
        success: true,
        message: 'Lay danh sach hoi thoai can nhan vien xem xet thanh cong.',
        meta: {
          endpointStatus: req.path.includes('negative-conversations') ? 'legacy' : 'canonical',
          canonicalEndpoint: '/api/analytics/need-review-conversations'
        },
        data
      });    } catch (err) {
      next(err);
    }
  }
  async getNeedReviewConversations(req, res, next) {
    return this.getNegativeConversations(req, res, next);
  }

  async predictSentiment(req, res, next) {
    try {
      const { text, texts } = req.body || {};
      const inputText = typeof text === 'string'
        ? text
        : (Array.isArray(texts) && typeof texts[0] === 'string' ? texts[0] : '');

      if (!inputText.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tham số texts phải là một mảng chuỗi.'
        });
      }
      const result = await aiSentimentService.predictSingleForDashboard(inputText, sentimentAnalyzer);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMlHealth(req, res, next) {
    try {
      const health = await aiSentimentService.getMlRuntimeHealth();
      return res.status(200).json(health);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();

