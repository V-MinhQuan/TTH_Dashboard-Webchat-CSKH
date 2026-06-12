const { poolPromise, sql } = require('../config/db');

/**
 * Repository cho module Phân tích Cảm xúc & Xu hướng Hội thoại (Sprint 6)
 *
 * Quy tắc JOIN từ schema thực tế:
 *  - CustomerId suy ra từ MessageLogs: CASE WHEN FromHost = 1 THEN ReceiverId ELSE SenderId END
 *  - Conversations JOIN bằng CustomerId + Source
 *  - User_Info JOIN bằng SenderId + Source
 */
class AnalyticsRepository {
  async _getOptionalAnalyticsColumns(pool) {
    try {
      const result = await pool.request().query(`
        SELECT
          COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzerVersion') AS analyzerVersionLen,
          COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentSource') AS sentimentSourceLen,
          COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueFlag') AS issueFlagLen,
          COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueType') AS issueTypeLen,
          COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueReason') AS issueReasonLen,
          COL_LENGTH('dbo.WebChat_MessageAnalytics', 'issueConfidence') AS issueConfidenceLen
      `);
      const row = result.recordset?.[0] || {};
      return {
        analyzerVersion: row.analyzerVersionLen !== null && row.analyzerVersionLen !== undefined,
        sentimentSource: row.sentimentSourceLen !== null && row.sentimentSourceLen !== undefined,
        issueFlag: row.issueFlagLen !== null && row.issueFlagLen !== undefined,
        issueType: row.issueTypeLen !== null && row.issueTypeLen !== undefined,
        issueReason: row.issueReasonLen !== null && row.issueReasonLen !== undefined,
        issueConfidence: row.issueConfidenceLen !== null && row.issueConfidenceLen !== undefined
      };
    } catch (err) {
      console.warn(`[AnalyticsRepository] Không thể kiểm tra cột analyzer source: ${err.message}`);
      return {
        analyzerVersion: false,
        sentimentSource: false,
        issueFlag: false,
        issueType: false,
        issueReason: false,
        issueConfidence: false
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách tin nhắn từ khách hàng chưa được phân tích
   * @param {object} options
   * @param {number} [options.limit=500]         - Số tin nhắn tối đa mỗi lần chạy
   * @param {string} [options.startDate]         - Lọc từ ngày (YYYY-MM-DD)
   * @param {string} [options.endDate]           - Lọc đến ngày (YYYY-MM-DD)
   * @param {boolean} [options.forceReanalyze=false] - Nếu true, lấy cả tin nhắn đã phân tích
   * @returns {Promise<Array>}
   */
  async getUnanalyzedMessages({ limit = 500, startDate, endDate, forceReanalyze = false } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    // Chỉ lấy tin nhắn từ khách hàng (FromHost = 0 hoặc NULL)
    conditions.push('(m.FromHost = 0 OR m.FromHost IS NULL)');

    // Chỉ lấy tin nhắn có nội dung text thực sự
    conditions.push('m.TextContent IS NOT NULL');
    conditions.push("LTRIM(RTRIM(m.TextContent)) <> ''");

    // Lọc theo khoảng thời gian
    if (startDate) {
      request.input('startDateParam', sql.DateTime, new Date(startDate));
      conditions.push('m.SentAt >= @startDateParam');
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      request.input('endDateParam', sql.DateTime, endDateTime);
      conditions.push('m.SentAt <= @endDateParam');
    }

    // Nếu không force reanalyze, bỏ qua tin đã phân tích
    if (!forceReanalyze) {
      conditions.push(`
        m.id_webchat_messagelogs NOT IN (
          SELECT messageId FROM dbo.WebChat_MessageAnalytics
        )
      `);
    }

    request.input('limitParam', sql.Int, limit);

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const query = `
      SELECT TOP (@limitParam)
        m.id_webchat_messagelogs   AS messageId,
        m.TextContent              AS textContent,
        m.SentAt                   AS messageAt,
        m.Source                   AS source,
        -- Suy ra customerId từ FromHost
        CASE WHEN m.FromHost = 1
          THEN m.ReceiverId
          ELSE m.SenderId
        END                        AS customerId,
        -- Lấy conversationId nếu có
        c.Id                       AS conversationId
      FROM dbo.WebChat_MessageLogs m
      LEFT JOIN dbo.WebChat_Conversations c
        ON c.CustomerId = CASE WHEN m.FromHost = 1 THEN m.ReceiverId ELSE m.SenderId END
        AND c.Source = m.Source
      ${whereClause}
      ORDER BY m.SentAt DESC
    `;

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Xóa analytics record cũ theo danh sách messageId (dùng khi force=true)
   *
   * Chia chunk 1000 IDs / lần để không vượt giới hạn 2100 parameters của SQL Server.
   * @param {number[]} messageIds
   */
  async deleteAnalyticsByMessageIds(messageIds) {
    if (!messageIds || messageIds.length === 0) return;
    const pool = await poolPromise;

    // SQL Server tối đa 2100 parameters/query → chia chunk 1000 để luôn an toàn
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
      const chunk = messageIds.slice(i, i + CHUNK_SIZE);
      const request = pool.request();
      const placeholders = chunk.map((_, j) => {
        request.input(`mid${j}`, sql.BigInt, chunk[j]);
        return `@mid${j}`;
      }).join(',');
      await request.query(
        `DELETE FROM dbo.WebChat_MessageAnalytics WHERE messageId IN (${placeholders})`
      );
    }
  }

  /**
   * Bulk insert kết quả phân tích vào WebChat_MessageAnalytics
   * Dùng transaction để đảm bảo tính toàn vẹn
   * @param {Array<object>} items - Danh sách kết quả phân tích
   * @returns {Promise<number>} Số bản ghi đã insert
   */
  async saveMessageAnalytics(items) {
    if (!items || items.length === 0) return 0;
    const pool = await poolPromise;
    const optionalColumns = await this._getOptionalAnalyticsColumns(pool);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let insertedCount = 0;
      for (const item of items) {
        const req = new sql.Request(transaction);
        req.input('messageId',               sql.BigInt,       item.messageId);
        req.input('conversationId',          sql.BigInt,       item.conversationId || null);
        req.input('customerId',              sql.NVarChar(200), item.customerId || null);
        req.input('source',                  sql.NVarChar(100), item.source || null);
        req.input('sentimentLabel',          sql.NVarChar(20),  item.sentimentLabel || 'neutral');
        req.input('sentimentScore',          sql.Float,         item.sentimentScore || 0.0);
        req.input('sentimentReason',         sql.NVarChar(500), item.sentimentReason || null);
        req.input('matchedPositiveKeywords', sql.NVarChar(sql.MAX), item.matchedPositiveKeywords || null);
        req.input('matchedNegativeKeywords', sql.NVarChar(sql.MAX), item.matchedNegativeKeywords || null);
        req.input('detectedTopics',          sql.NVarChar(sql.MAX), item.detectedTopics || null);
        req.input('detectedKeywords',        sql.NVarChar(sql.MAX), item.detectedKeywords || null);
        req.input('satisfactionScore',       sql.Float,         item.satisfactionScore ?? null);
        req.input('satisfactionLevel',       sql.NVarChar(20),  item.satisfactionLevel || null);
        req.input('satisfactionReason',      sql.NVarChar(500), item.satisfactionReason || null);
        req.input('needStaffReview',         sql.Bit,           item.needStaffReview ? 1 : 0);
        req.input('messageAt',              sql.DateTime,      item.messageAt || null);

        const insertColumns = [
          'messageId', 'conversationId', 'customerId', 'source',
          'sentimentLabel', 'sentimentScore', 'sentimentReason',
          'matchedPositiveKeywords', 'matchedNegativeKeywords',
          'detectedTopics', 'detectedKeywords',
          'satisfactionScore', 'satisfactionLevel', 'satisfactionReason',
          'needStaffReview', 'messageAt', 'analyzedAt'
        ];
        const insertValues = [
          '@messageId', '@conversationId', '@customerId', '@source',
          '@sentimentLabel', '@sentimentScore', '@sentimentReason',
          '@matchedPositiveKeywords', '@matchedNegativeKeywords',
          '@detectedTopics', '@detectedKeywords',
          '@satisfactionScore', '@satisfactionLevel', '@satisfactionReason',
          '@needStaffReview', '@messageAt', 'GETDATE()'
        ];

        if (optionalColumns.analyzerVersion) {
          req.input('analyzerVersion', sql.NVarChar(50), item.analyzerVersion || null);
          insertColumns.push('analyzerVersion');
          insertValues.push('@analyzerVersion');
        }

        if (optionalColumns.sentimentSource) {
          req.input('sentimentSource', sql.NVarChar(50), item.sentimentSource || null);
          insertColumns.push('sentimentSource');
          insertValues.push('@sentimentSource');
        }

        if (optionalColumns.issueFlag) {
          req.input('issueFlag', sql.Bit, item.issueFlag ? 1 : 0);
          insertColumns.push('issueFlag');
          insertValues.push('@issueFlag');
        }

        if (optionalColumns.issueType) {
          req.input('issueType', sql.NVarChar(100), item.issueType || null);
          insertColumns.push('issueType');
          insertValues.push('@issueType');
        }

        if (optionalColumns.issueReason) {
          req.input('issueReason', sql.NVarChar(1000), item.issueReason || null);
          insertColumns.push('issueReason');
          insertValues.push('@issueReason');
        }

        if (optionalColumns.issueConfidence) {
          req.input('issueConfidence', sql.Float, item.issueConfidence ?? null);
          insertColumns.push('issueConfidence');
          insertValues.push('@issueConfidence');
        }

        await req.query(`
          INSERT INTO dbo.WebChat_MessageAnalytics (${insertColumns.join(', ')})
          VALUES (${insertValues.join(', ')})
        `);
        insertedCount++;
      }
      await transaction.commit();
      return insertedCount;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Helper: xây dựng điều kiện WHERE + bind params cho các query đọc
   * @private
   */
  _buildReadFilters(request, { startDate, endDate, source, sentiment, topic } = {}) {
    const conditions = [];
    if (startDate) {
      request.input('startDate', sql.Date, new Date(startDate));
      conditions.push('a.messageAt >= @startDate');
    }
    if (endDate) {
      request.input('endDate', sql.Date, new Date(endDate));
      conditions.push('a.messageAt < DATEADD(day, 1, @endDate)');
    }
    if (source) {
      request.input('source', sql.NVarChar(100), source);
      conditions.push('a.source = @source');
    }
    if (sentiment) {
      request.input('sentiment', sql.NVarChar(20), sentiment);
      conditions.push('a.sentimentLabel = @sentiment');
    }
    if (topic) {
      request.input('topic', sql.NVarChar(250), `%${topic}%`);
      conditions.push('a.detectedTopics LIKE @topic');
    }
    return conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  }

  _buildNeedReviewFilters(request, { startDate, endDate, source, sentiment, topic } = {}, optionalColumns = {}) {
    const reviewConditions = [
      'a.needStaffReview = 1',
      "a.sentimentLabel = 'negative'"
    ];
    if (optionalColumns.issueFlag) {
      reviewConditions.push('a.issueFlag = 1');
    }
    const conditions = [`(${reviewConditions.join(' OR ')})`];
    if (startDate) {
      request.input('startDate', sql.Date, new Date(startDate));
      conditions.push('a.messageAt >= @startDate');
    }
    if (endDate) {
      request.input('endDate', sql.Date, new Date(endDate));
      conditions.push('a.messageAt < DATEADD(day, 1, @endDate)');
    }
    if (source) {
      request.input('source', sql.NVarChar(100), source);
      conditions.push('a.source = @source');
    }
    if (sentiment) {
      request.input('sentiment', sql.NVarChar(20), sentiment);
      conditions.push('a.sentimentLabel = @sentiment');
    }
    if (topic) {
      request.input('topic', sql.NVarChar(250), `%${topic}%`);
      conditions.push('a.detectedTopics LIKE @topic');
    }
    return 'WHERE ' + conditions.join(' AND ');
  }

  _buildNegativeConversationFilters(request, filters = {}, optionalColumns = {}) {
    return this._buildNeedReviewFilters(request, filters, optionalColumns);
  }

  /**
   * Tổng hợp cảm xúc (positive/negative/neutral)
   */
  async getSentimentSummary(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const where = this._buildReadFilters(request, filters);

    const result = await request.query(`
      SELECT
        a.sentimentLabel,
        COUNT(*) AS count,
        AVG(a.sentimentScore) AS avgScore
      FROM dbo.WebChat_MessageAnalytics a
      ${where}
      GROUP BY a.sentimentLabel
      ORDER BY count DESC
    `);
    return result.recordset;
  }

  async getAnalyzerVersionDistribution(filters = {}) {
    const pool = await poolPromise;
    const optionalColumns = await this._getOptionalAnalyticsColumns(pool);
    if (!optionalColumns.analyzerVersion && !optionalColumns.sentimentSource) {
      return [];
    }

    const request = pool.request();
    const where = this._buildReadFilters(request, filters);
    const sourceExpr = optionalColumns.sentimentSource ? 'a.sentimentSource' : 'NULL';
    const versionExpr = optionalColumns.analyzerVersion ? 'a.analyzerVersion' : 'NULL';

    const result = await request.query(`
      SELECT
        ${sourceExpr} AS sentimentSource,
        ${versionExpr} AS analyzerVersion,
        a.sentimentLabel,
        COUNT(*) AS total
      FROM dbo.WebChat_MessageAnalytics a
      ${where}
      GROUP BY ${sourceExpr}, ${versionExpr}, a.sentimentLabel
      ORDER BY analyzerVersion, a.sentimentLabel
    `);
    return result.recordset;
  }

  /**
   * Xu hướng cảm xúc theo ngày
   */
  async getSentimentTrend(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const where = this._buildReadFilters(request, filters);

    const result = await request.query(`
      SELECT
        CONVERT(DATE, a.messageAt) AS date,
        a.sentimentLabel,
        COUNT(*) AS count,
        AVG(a.sentimentScore) AS avgScore
      FROM dbo.WebChat_MessageAnalytics a
      ${where}
      GROUP BY CONVERT(DATE, a.messageAt), a.sentimentLabel
      ORDER BY date ASC, a.sentimentLabel
    `);
    return result.recordset;
  }

  /**
   * Tổng hợp chỉ số hài lòng
   */
  async getSatisfactionSummary(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const where = this._buildReadFilters(request, filters);

    const result = await request.query(`
      SELECT
        AVG(a.satisfactionScore)                 AS avgSatisfactionScore,
        COUNT(*)                                  AS totalMessages,
        SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS needReviewCount,
        a.satisfactionLevel,
        COUNT(*) AS levelCount
      FROM dbo.WebChat_MessageAnalytics a
      ${where}
      GROUP BY a.satisfactionLevel
      ORDER BY avgSatisfactionScore DESC
    `);
    return result.recordset;
  }

  /**
   * Xu hướng hài lòng theo ngày
   */
  async getSatisfactionTrend(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const where = this._buildReadFilters(request, filters);

    const result = await request.query(`
      SELECT
        CONVERT(DATE, a.messageAt) AS date,
        AVG(a.satisfactionScore)   AS avgScore,
        COUNT(*)                   AS count,
        SUM(CASE WHEN a.needStaffReview = 1 THEN 1 ELSE 0 END) AS needReviewCount
      FROM dbo.WebChat_MessageAnalytics a
      ${where}
      GROUP BY CONVERT(DATE, a.messageAt)
      ORDER BY date ASC
    `);
    return result.recordset;
  }

  /**
   * Lấy raw data detectedTopics để service parse JSON và tổng hợp
   */
  async getTopicRawData(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const where = this._buildReadFilters(request, filters);

    const result = await request.query(`
      SELECT
        a.detectedTopics,
        a.detectedKeywords,
        COUNT(*) AS msgCount
      FROM dbo.WebChat_MessageAnalytics a
      ${where ? where + ' AND' : 'WHERE'} a.detectedTopics IS NOT NULL
        AND a.detectedTopics <> '[]'
      GROUP BY a.detectedTopics, a.detectedKeywords
      ORDER BY msgCount DESC
    `);
    return result.recordset;
  }

  /**
   * Lấy keyword tiêu cực phổ biến (từ các tin nhắn negative)
   */
  async getNegativeKeywordsRaw(filters = {}) {
    const { mode = 'negative' } = filters;
    const pool = await poolPromise;
    const optionalColumns = await this._getOptionalAnalyticsColumns(pool);
    const request = pool.request();
    const { mode: _mode, ...readFilters } = filters;
    const where = this._buildReadFilters(request, readFilters);
    const issueTypeExpr = optionalColumns.issueType ? 'a.issueType' : 'CAST(NULL AS NVARCHAR(100))';
    const issueReasonExpr = optionalColumns.issueReason ? 'a.issueReason' : 'CAST(NULL AS NVARCHAR(1000))';
    const groupByFields = ['a.matchedNegativeKeywords'];
    if (optionalColumns.issueType) groupByFields.push('a.issueType');
    if (optionalColumns.issueReason) groupByFields.push('a.issueReason');
    const extraConditions = [];

    if (mode === 'needReview') {
      const reviewConditions = ['a.needStaffReview = 1', "a.sentimentLabel = 'negative'"];
      if (optionalColumns.issueFlag) {
        reviewConditions.push('a.issueFlag = 1');
      }
      extraConditions.push(`(${reviewConditions.join(' OR ')})`);
    } else if (mode === 'issue') {
      if (optionalColumns.issueFlag || optionalColumns.issueType) {
        const issueConditions = [];
        if (optionalColumns.issueFlag) issueConditions.push('a.issueFlag = 1');
        if (optionalColumns.issueType) issueConditions.push('a.issueType IS NOT NULL');
        extraConditions.push(`(${issueConditions.join(' OR ')})`);
      } else {
        extraConditions.push('1 = 0');
      }
    } else {
      extraConditions.push("a.sentimentLabel = 'negative'");
    }
    const keywordConditions = [
      "(a.matchedNegativeKeywords IS NOT NULL AND a.matchedNegativeKeywords <> '[]')"
    ];
    if (mode !== 'negative' && optionalColumns.issueType) {
      keywordConditions.push('a.issueType IS NOT NULL');
    }

    const result = await request.query(`
      SELECT
        a.matchedNegativeKeywords,
        ${issueTypeExpr} AS issueType,
        ${issueReasonExpr} AS issueReason,
        COUNT(*) AS msgCount
      FROM dbo.WebChat_MessageAnalytics a
      ${where ? where + ' AND' : 'WHERE'} ${extraConditions.join(' AND ')}
        AND (${keywordConditions.join(' OR ')})
      GROUP BY ${groupByFields.join(', ')}
      ORDER BY msgCount DESC
    `);
    return result.recordset;
  }

  /**
   * Danh sách hội thoại cần xem xét (needStaffReview = 1)
   * @param {object} filters
   * @param {number} [filters.page=1]
   * @param {number} [filters.pageSize=20]
   */
  async getNegativeConversations(filters = {}) {
    const { page = 1, pageSize = 20 } = filters;
    const pool = await poolPromise;
    const optionalColumns = await this._getOptionalAnalyticsColumns(pool);
    const countRequest = pool.request();
    const dataRequest = pool.request();

    const offset = (page - 1) * pageSize;
    dataRequest.input('pageSize', sql.Int, pageSize);
    dataRequest.input('offset',   sql.Int, offset);

    const countWhere = this._buildNegativeConversationFilters(countRequest, filters, optionalColumns);
    const dataWhere = this._buildNegativeConversationFilters(dataRequest, filters, optionalColumns);
    const issueFlagExpr = optionalColumns.issueFlag ? 'a.issueFlag' : 'CAST(NULL AS BIT)';
    const issueTypeExpr = optionalColumns.issueType ? 'a.issueType' : 'CAST(NULL AS NVARCHAR(100))';
    const issueReasonExpr = optionalColumns.issueReason ? 'a.issueReason' : 'CAST(NULL AS NVARCHAR(1000))';
    const issueConfidenceExpr = optionalColumns.issueConfidence ? 'a.issueConfidence' : 'CAST(NULL AS FLOAT)';

    // Lấy tổng số bản ghi
    const countResult = await countRequest.query(`
      SELECT COUNT(*) AS total
      FROM dbo.WebChat_MessageAnalytics a
      ${countWhere}
    `);

    const result = await dataRequest.query(`
      SELECT
        a.id,
        a.messageId,
        m.TextContent AS textContent,
        a.conversationId,
        a.customerId,
        a.source,
        a.sentimentLabel,
        a.sentimentScore,
        a.sentimentReason,
        a.satisfactionScore,
        a.satisfactionLevel,
        a.satisfactionReason,
        a.needStaffReview,
        ${issueFlagExpr} AS issueFlag,
        ${issueTypeExpr} AS issueType,
        ${issueReasonExpr} AS issueReason,
        ${issueConfidenceExpr} AS issueConfidence,
        a.detectedTopics,
        a.matchedNegativeKeywords,
        a.messageAt
      FROM dbo.WebChat_MessageAnalytics a
      LEFT JOIN dbo.WebChat_MessageLogs m
        ON m.id_webchat_messagelogs = a.messageId
      ${dataWhere}
      ORDER BY a.messageAt DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    return {
      records: result.recordset,
      pagination: {
        page,
        pageSize,
        total: countResult.recordset[0]?.total || 0
      }
    };
  }
}

module.exports = new AnalyticsRepository();
