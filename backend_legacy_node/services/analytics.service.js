/**
 * Service: Orchestrator cho toÃ n bá»™ pipeline phÃ¢n tÃ­ch (Sprint 6)
 *
 * Luá»“ng: Repository (láº¥y tin) â†’ TextPreprocessing â†’ AI/Rule Sentiment â†’ Topic â†’ Satisfaction â†’ Repository (lÆ°u)
 *
 * Thay Ä‘á»•i (Sprint 7 â€” PhoBERT integration):
 *  - ThÃªm aiSentimentService Ä‘á»ƒ gá»i PhoBERT batch qua ml-service
 *  - Náº¿u ml-service khÃ´ng kháº£ dá»¥ng hoáº·c lá»—i, tá»± Ä‘á»™ng fallback sang rule-based
 *  - CÃ¡c method read vÃ  interface cá»§a runAnalytics() khÃ´ng thay Ä‘á»•i
 */

const analyticsRepository    = require('../repositories/analytics.repository');
const textPreprocessing      = require('./text-preprocessing.service');
const sentimentAnalyzer      = require('./sentiment-analyzer.service');
const topicDetector          = require('./topic-detector.service');
const satisfactionScore      = require('./satisfaction-score.service');
// PhoBERT bridge service â€” gá»i ml-service qua HTTP built-in, tá»± fallback náº¿u lá»—i
const aiSentimentService     = require('./ai-sentiment.service');

const ENSEMBLE_MODEL_VERSION = process.env.ENSEMBLE_MODEL_VERSION || 'ensemble-phobert-rule-v1';

class AnalyticsService {

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PIPELINE: Cháº¡y phÃ¢n tÃ­ch tin nháº¯n
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Cháº¡y toÃ n bá»™ pipeline phÃ¢n tÃ­ch vÃ  lÆ°u káº¿t quáº£ vÃ o DB
   *
   * @param {object} options
   * @param {number}  [options.limit=500]           - Sá»‘ tin nháº¯n tá»‘i Ä‘a má»—i láº§n
   * @param {string}  [options.startDate]           - Lá»c tá»« ngÃ y (YYYY-MM-DD)
   * @param {string}  [options.endDate]             - Lá»c Ä‘áº¿n ngÃ y (YYYY-MM-DD)
   * @param {boolean} [options.forceReanalyze=false]- PhÃ¢n tÃ­ch láº¡i tin Ä‘Ã£ xá»­ lÃ½
   * @param {string}  [options.mode]                 - "reprocess-sample" náº¿u cháº¡y máº«u cÃ³ kiá»ƒm soÃ¡t
   * @returns {Promise<object>}
   */
  async runAnalytics(options = {}) {
    const { limit = 500, startDate, endDate, forceReanalyze = false, mode } = options;

    // 1. Láº¥y tin nháº¯n cáº§n phÃ¢n tÃ­ch
    const messages = await analyticsRepository.getUnanalyzedMessages({
      limit,
      startDate,
      endDate,
      forceReanalyze
    });

    if (messages.length === 0) {
      return {
        selected: 0,
        processed: 0,
        saved: 0,
        updated: 0,
        skipped: 0,
        phobertCount: 0,
        ensembleCount: 0,
        fallbackCount: 0,
        negativeCount: 0,
        needStaffReviewCount: 0,
        mode: mode || 'default'
      };
    }

    // 2. Náº¿u force, xÃ³a record cÅ© trÆ°á»›c
    if (forceReanalyze) {
      const messageIds = messages.map(m => m.messageId);
      await analyticsRepository.deleteAnalyticsByMessageIds(messageIds);
    }

    // 3. Tiá»n xá»­ lÃ½ vÄƒn báº£n cho toÃ n bá»™ messages má»™t láº§n
    const cleanedTexts = messages.map(msg => textPreprocessing.cleanText(msg.textContent));

    // 4. PhÃ¢n tÃ­ch cáº£m xÃºc BATCH báº±ng PhoBERT (vá»›i fallback rule-based tá»± Ä‘á»™ng)
    // aiSentimentService khÃ´ng bao giá» throw â€” náº¿u ml-service lá»—i, tráº£ vá» rule-based-fallback
    let sentimentResults;
    try {
      sentimentResults = await aiSentimentService.analyzeBatch(cleanedTexts, sentimentAnalyzer);
    } catch (unexpectedErr) {
      // TrÆ°á»ng há»£p cá»±c ká»³ hiáº¿m: lá»—i khÃ´ng mong Ä‘á»£i trong báº£n thÃ¢n analyzeBatch
      console.warn(
        `[AnalyticsService] aiSentimentService.analyzeBatch lá»—i báº¥t ngá»: ${unexpectedErr.message}. ` +
        'Fallback sang rule-based cho toÃ n bá»™ batch.'
      );
      sentimentResults = cleanedTexts.map(text => {
        const result = sentimentAnalyzer.analyzeSentiment(text || '');
        return { ...result, source: 'rule-based-fallback' };
      });
    }

    // 5. Xá»­ lÃ½ tá»«ng tin nháº¯n: topic + satisfaction + build result
    const results = [];
    let skipped = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg         = messages[i];
      const cleanedText = cleanedTexts[i];
      const sentiment   = sentimentResults[i];

      try {
        // VÄƒn báº£n quÃ¡ ngáº¯n sau tiá»n xá»­ lÃ½ â†’ káº¿t quáº£ low-information
        if (!cleanedText || cleanedText.length < 3) {
          results.push(this._buildLowInformationResult(msg, cleanedText));
          continue;
        }

        // 5a. PhÃ¡t hiá»‡n chá»§ Ä‘á» (váº«n cháº¡y trong Node.js â€” khÃ´ng chuyá»ƒn sang Python)
        const topics = topicDetector.detectTopics(cleanedText);

        // 5b. TÃ­nh Ä‘iá»ƒm hÃ i lÃ²ng (váº«n cháº¡y trong Node.js)
        const satisfaction = satisfactionScore.calculateSatisfactionScore({
          sentimentScore:          sentiment.sentimentScore,
          sentimentLabel:          sentiment.sentimentLabel,
          matchedNegativeKeywords: sentiment.matchedNegativeKeywords || [],
          cleanedText
        });
        const sentimentNeedsReview = sentiment.needStaffReview === true;
        const finalNeedStaffReview = satisfaction.needStaffReview === true || sentimentNeedsReview;
        const finalSatisfactionReason = sentimentNeedsReview && satisfaction.needStaffReview !== true
          ? `${satisfaction.satisfactionReason || ''} Bo phan tich cam xuc danh dau can nhan vien xem xet.`.trim()
          : satisfaction.satisfactionReason;

        // 5c. XÃ¡c Ä‘á»‹nh analyzerVersion Ä‘á»ƒ ghi vÃ o DB (náº¿u cá»™t tá»“n táº¡i)
        // Náº¿u schema khÃ´ng cÃ³ cá»™t analyzerVersion, repository sáº½ bá» qua field nÃ y
        const src = sentiment.source || 'rule-based';
        let analyzerVersion;
        if (src === 'ensemble') {
          analyzerVersion = sentiment.analyzerVersion || ENSEMBLE_MODEL_VERSION;
        } else if (src === 'phobert' || src === 'cache') {
          analyzerVersion = 'phobert-onnx-v1';
        } else if (src === 'rule-based-fallback') {
          analyzerVersion = 'rule-based-fallback-v1';
        } else {
          analyzerVersion = 'rule-based-v1';
        }

        results.push({
          messageId:               msg.messageId,
          conversationId:          msg.conversationId,
          customerId:              msg.customerId,
          source:                  msg.source,
          messageAt:               msg.messageAt,

          // Sentiment (tá»« PhoBERT hoáº·c rule-based â€” cÃ¹ng interface)
          sentimentLabel:          sentiment.sentimentLabel,
          sentimentScore:          sentiment.sentimentScore,
          sentimentReason:         sentiment.sentimentReason,
          matchedPositiveKeywords: JSON.stringify(sentiment.matchedPositiveKeywords || []),
          matchedNegativeKeywords: JSON.stringify(sentiment.matchedNegativeKeywords || []),

          // Topics
          detectedTopics:          JSON.stringify(topics.detectedTopics),
          detectedKeywords:        JSON.stringify(topics.detectedKeywords),

          // Satisfaction
          satisfactionScore:       satisfaction.satisfactionScore,
          satisfactionLevel:       satisfaction.satisfactionLevel,
          satisfactionReason:      finalSatisfactionReason,
          needStaffReview:         finalNeedStaffReview,
          issueFlag:               sentiment.issueFlag === true,
          issueType:               sentiment.issueType || null,
          issueReason:             sentiment.issueReason || null,
          issueConfidence:         Number(sentiment.issueConfidence || 0),

          // analyzerVersion/sentimentSource â€” field bá»• sung, repository sáº½ bá» qua náº¿u schema chÆ°a cÃ³ cá»™t
          analyzerVersion,
          sentimentSource: src
        });
      } catch (err) {
        console.error(`[AnalyticsService] Loi khi phan tich messageId=${msg.messageId}:`, err.message);
        skipped++;
      }
    }

    // 6. LÆ°u káº¿t quáº£ vÃ o DB theo batch
    const saved = await analyticsRepository.saveMessageAnalytics(results);
    const phobertCount = results.filter(item =>
      item.sentimentSource === 'phobert' || item.sentimentSource === 'cache'
    ).length;
    const ensembleCount = results.filter(item =>
      item.sentimentSource === 'ensemble'
    ).length;
    const fallbackCount = results.filter(item =>
      item.sentimentSource === 'rule-based-fallback'
    ).length;
    const negativeCount = results.filter(item => item.sentimentLabel === 'negative').length;
    const needStaffReviewCount = results.filter(item => item.needStaffReview === true).length;

    return {
      selected: messages.length,
      processed: messages.length,
      saved,
      updated: forceReanalyze ? saved : 0,
      skipped,
      phobertCount,
      ensembleCount,
      fallbackCount,
      negativeCount,
      needStaffReviewCount,
      mode: mode || 'default'
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Tá»•ng há»£p cáº£m xÃºc
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getSentimentSummary(filters = {}) {
    const rows = await analyticsRepository.getSentimentSummary(filters);
    const analyzerVersionRows = await analyticsRepository.getAnalyzerVersionDistribution(filters);

    // Chuáº©n hÃ³a thÃ nh object dá»… dÃ¹ng á»Ÿ frontend
    const summary = { positive: 0, negative: 0, neutral: 0, total: 0 };
    const avgScores = {};

    rows.forEach(row => {
      const label = row.sentimentLabel || 'neutral';
      const count = parseInt(row.count) || 0;
      if (summary.hasOwnProperty(label)) {
        summary[label] = count;
      }
      summary.total += count;
      avgScores[label] = Math.round((row.avgScore || 0) * 1000) / 1000;
    });

    const analyzerVersionDistribution = analyzerVersionRows.map(row => ({
      sentimentSource: row.sentimentSource || null,
      analyzerVersion: row.analyzerVersion || null,
      sentimentLabel: row.sentimentLabel || 'neutral',
      total: parseInt(row.total) || 0
    }));

    return { summary, avgScores, analyzerVersionDistribution };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Xu hÆ°á»›ng cáº£m xÃºc theo ngÃ y
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getSentimentTrend(filters = {}) {
    const rows = await analyticsRepository.getSentimentTrend(filters);

    // Group theo ngÃ y
    const trendMap = {};
    rows.forEach(row => {
      const dateStr = row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0];

      if (!trendMap[dateStr]) {
        trendMap[dateStr] = { date: dateStr, positive: 0, negative: 0, neutral: 0 };
      }
      const label = row.sentimentLabel || 'neutral';
      if (trendMap[dateStr].hasOwnProperty(label)) {
        trendMap[dateStr][label] = parseInt(row.count) || 0;
      }
    });

    return Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Tá»•ng há»£p hÃ i lÃ²ng
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getSatisfactionSummary(filters = {}) {
    const rows = await analyticsRepository.getSatisfactionSummary(filters);

    let totalMessages = 0;
    let totalNeedReview = 0;
    let weightedScore = 0;
    const levelDistribution = {};

    rows.forEach(row => {
      const count = parseInt(row.levelCount) || 0;
      const level = row.satisfactionLevel || 'neutral';
      const avgScore = parseFloat(row.avgSatisfactionScore) || 0;
      const needReview = parseInt(row.needReviewCount) || 0;

      totalMessages += count;
      totalNeedReview += needReview;
      weightedScore += avgScore * count;
      levelDistribution[level] = (levelDistribution[level] || 0) + count;
    });

    const avgSatisfactionScore = totalMessages > 0
      ? Math.round((weightedScore / totalMessages) * 10) / 10
      : 0;

    return {
      avgSatisfactionScore,
      totalMessages,
      needReviewCount: totalNeedReview,
      levelDistribution
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Xu hÆ°á»›ng hÃ i lÃ²ng theo ngÃ y
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getSatisfactionTrend(filters = {}) {
    const rows = await analyticsRepository.getSatisfactionTrend(filters);

    return rows.map(row => ({
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0],
      avgScore: Math.round((row.avgScore || 0) * 10) / 10,
      count: parseInt(row.count) || 0,
      needReviewCount: parseInt(row.needReviewCount) || 0
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Tá»•ng há»£p chá»§ Ä‘á»
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getTopicSummary(filters = {}) {
    const rows = await analyticsRepository.getTopicRawData(filters);

    // Parse JSON array tá»« DB vÃ  Ä‘áº¿m táº§n suáº¥t
    const topicCount = {};

    rows.forEach(row => {
      if (!row.detectedTopics) return;
      try {
        const topics = JSON.parse(row.detectedTopics);
        const msgCount = parseInt(row.msgCount) || 1;
        if (Array.isArray(topics)) {
          topics.forEach(topic => {
            topicCount[topic] = (topicCount[topic] || 0) + msgCount;
          });
        }
      } catch {
        // Bá» qua row cÃ³ JSON khÃ´ng há»£p lá»‡
      }
    });

    // Chuyá»ƒn thÃ nh array cÃ³ label tiáº¿ng Viá»‡t, sáº¯p xáº¿p giáº£m dáº§n
    return Object.entries(topicCount)
      .map(([key, count]) => ({
        topicKey: key,
        topicLabel: topicDetector.getTopicLabel(key),
        count
      }))
      .sort((a, b) => b.count - a.count);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Keyword tiÃªu cá»±c phá»• biáº¿n
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getNegativeKeywords(filters = {}) {
    const rows = await analyticsRepository.getNegativeKeywordsRaw(filters);

    const keywordCount = {};
    rows.forEach(row => {
      const msgCount = parseInt(row.msgCount) || 1;
      try {
        const keywords = JSON.parse(row.matchedNegativeKeywords);
        if (Array.isArray(keywords)) {
          keywords.forEach(kw => {
            keywordCount[kw] = (keywordCount[kw] || 0) + msgCount;
          });
        }
      } catch {
        // Bá» qua JSON khÃ´ng há»£p lá»‡
      }
      if (row.issueType && row.issueType !== 'none') {
        const issueKeyword = `issue:${row.issueType}`;
        keywordCount[issueKeyword] = (keywordCount[issueKeyword] || 0) + msgCount;
      }
    });

    return Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Top 50 keyword
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // READ: Há»™i thoáº¡i cáº§n xem xÃ©t
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getNegativeConversations(filters = {}) {
    const result = await analyticsRepository.getNegativeConversations(filters);

    // Parse JSON fields trong records
    result.records = result.records.map(rec => ({
      ...rec,
      issueFlag: rec.issueFlag === null || rec.issueFlag === undefined ? null : rec.issueFlag === true || rec.issueFlag === 1,
      issueType: rec.issueType || null,
      issueReason: rec.issueReason || null,
      issueConfidence: rec.issueConfidence === null || rec.issueConfidence === undefined ? null : Number(rec.issueConfidence),
      detectedTopics: this._safeParseJson(rec.detectedTopics, []),
      matchedNegativeKeywords: this._safeParseJson(rec.matchedNegativeKeywords, [])
    }));

    return result;
  }

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _buildLowInformationResult(msg, cleanedText) {
    return {
      messageId:               msg.messageId,
      conversationId:          msg.conversationId,
      customerId:              msg.customerId,
      source:                  msg.source,
      messageAt:               msg.messageAt,

      sentimentLabel:          'neutral',
      sentimentScore:          0,
      sentimentReason:         cleanedText
        ? 'Ná»™i dung quÃ¡ ngáº¯n Ä‘á»ƒ phÃ¢n tÃ­ch cáº£m xÃºc cÃ³ Ã½ nghÄ©a.'
        : 'Ná»™i dung khÃ´ng cÃ²n vÄƒn báº£n sau bÆ°á»›c tiá»n xá»­ lÃ½.',
      matchedPositiveKeywords: JSON.stringify([]),
      matchedNegativeKeywords: JSON.stringify([]),

      detectedTopics:          JSON.stringify(['KhÃ¡c']),
      detectedKeywords:        JSON.stringify([]),

      satisfactionScore:       50,
      satisfactionLevel:       'neutral',
      satisfactionReason:      'Ná»™i dung khÃ´ng Ä‘á»§ tÃ­n hiá»‡u Ä‘á»ƒ tÃ­nh Ä‘iá»ƒm hÃ i lÃ²ng chi tiáº¿t.',
      needStaffReview:         false,
      issueFlag:               false,
      issueType:               null,
      issueReason:             null,
      issueConfidence:         0,
      analyzerVersion:         'rule-based-v1',
      sentimentSource:         'rule-based'
    };
  }

  _safeParseJson(str, defaultValue) {
    if (!str) return defaultValue;
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  }
}

module.exports = new AnalyticsService();

