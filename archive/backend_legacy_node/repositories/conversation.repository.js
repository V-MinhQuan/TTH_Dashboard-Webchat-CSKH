const { poolPromise, sql } = require('../config/db');


class ConversationRepository {
  _buildDateFilter(request, startDate, endDate, alias = 'c') {
    const conditions = [`${alias}.LastCustomerMessageAt IS NOT NULL`];

    if (startDate) {
      request.input('startDateParam', sql.DateTime, new Date(startDate));
      conditions.push(`${alias}.LastCustomerMessageAt >= @startDateParam`);
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      request.input('endDateParam', sql.DateTime, endDateTime);
      conditions.push(`${alias}.LastCustomerMessageAt <= @endDateParam`);
    }

    return `WHERE ${conditions.join(' AND ')}`;
  }

  async getKpiAggregates(startDate, endDate) {
    const pool = await poolPromise;
    const request = pool.request();
    const whereClause = this._buildDateFilter(request, startDate, endDate, 'c');

    const statusExpr = `
      CASE
        WHEN s.NoResponseNeeded = 1 THEN 'closed'
        WHEN s.NoResponseNeeded = 0 THEN 'open'
        ELSE 'new'
      END
    `;
    const sourceExpr = `
      CASE
        WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('facebook', 'fb', 'messenger') THEN 'Facebook'
        WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('zalooa', 'zalo') THEN 'ZaloOA'
        WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('zalobusiness', 'zalobiz') THEN 'ZaloBusiness'
        WHEN LOWER(LTRIM(RTRIM(c.Source))) IN ('chatwidget', 'website', 'web') THEN 'ChatWidget'
        ELSE 'other'
      END
    `;

    const result = await request.query(`
      SELECT
        COUNT(DISTINCT c.Id) AS totalConversations,
        COUNT(DISTINCT c.CustomerId) AS newCustomers,
        AVG(CASE
          WHEN c.LastHostMessageAt IS NOT NULL
           AND c.LastHostMessageAt >= c.LastCustomerMessageAt
          THEN DATEDIFF(MINUTE, c.LastCustomerMessageAt, c.LastHostMessageAt)
          ELSE NULL
        END) AS averageResponseTimeMinutes
      FROM WebChat_Conversations c
      LEFT JOIN WebChat_ConversationStatus s
        ON c.CustomerId = s.CustomerId AND c.Source = s.Source
      ${whereClause};

      SELECT ${statusExpr} AS status, COUNT(DISTINCT c.Id) AS total
      FROM WebChat_Conversations c
      LEFT JOIN WebChat_ConversationStatus s
        ON c.CustomerId = s.CustomerId AND c.Source = s.Source
      ${whereClause}
      GROUP BY ${statusExpr};

      SELECT ${sourceExpr} AS source, COUNT(DISTINCT c.Id) AS total
      FROM WebChat_Conversations c
      ${whereClause}
      GROUP BY ${sourceExpr};

      SELECT
        CONVERT(date, c.LastCustomerMessageAt) AS dateKey,
        COUNT(DISTINCT c.Id) AS total,
        SUM(CASE WHEN s.NoResponseNeeded = 1 THEN 1 ELSE 0 END) AS processed,
        SUM(CASE WHEN ISNULL(s.NoResponseNeeded, 0) <> 1 THEN 1 ELSE 0 END) AS unprocessed
      FROM WebChat_Conversations c
      LEFT JOIN WebChat_ConversationStatus s
        ON c.CustomerId = s.CustomerId AND c.Source = s.Source
      ${whereClause}
      GROUP BY CONVERT(date, c.LastCustomerMessageAt)
      ORDER BY dateKey ASC;
    `);

    return {
      totals: result.recordsets?.[0]?.[0] || {},
      statusRows: result.recordsets?.[1] || [],
      sourceRows: result.recordsets?.[2] || [],
      trendRows: result.recordsets?.[3] || []
    };
  }

  /**
   * Lấy danh sách hội thoại từ Database, có hỗ trợ lọc theo khoảng thời gian
   * @param {string} [startDate] - Ngày bắt đầu lọc (YYYY-MM-DD)
   * @param {string} [endDate] - Ngày kết thúc lọc (YYYY-MM-DD)
   * @returns {Promise<Array>} Danh sách các bản ghi thô từ Database
   */
  async getConversations(startDate, endDate) {
    try {
      const pool = await poolPromise;
      
      // Sử dụng cấu trúc bảng thực tế từ DB: WebChat_Conversations, WebChat_Messagelogs_User_Info, WebChat_ConversationStatus
      let query = `
        SELECT 
          c.Id AS id,
          c.CustomerId AS customer_id,
          u.DisplayName AS customer_name,
          CASE 
            WHEN s.NoResponseNeeded = 1 THEN 'closed'
            WHEN s.NoResponseNeeded = 0 THEN 'open'
            ELSE 'new'
          END AS status,
          c.Source AS source,
          c.LastCustomerMessageAt AS created_at,
          c.LastHostMessageAt AS first_response_at,
          c.LastMessageAt AS updated_at
        FROM WebChat_Conversations c
        LEFT JOIN WebChat_Messagelogs_User_Info u 
          ON c.CustomerId = u.SenderId AND c.Source = u.Source
        LEFT JOIN WebChat_ConversationStatus s 
          ON c.CustomerId = s.CustomerId AND c.Source = s.Source
      `;

      const request = pool.request();
      const conditions = [];

      // Lọc theo startDate (từ 00:00:00 của ngày đó)
      if (startDate) {
        request.input('startDateParam', sql.DateTime, new Date(startDate));
        conditions.push(`c.LastCustomerMessageAt >= @startDateParam`);
      }

      // Lọc theo endDate (đến 23:59:59.999 của ngày đó)
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        
        request.input('endDateParam', sql.DateTime, endDateTime);
        conditions.push(`c.LastCustomerMessageAt <= @endDateParam`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Sắp xếp theo thứ tự tin nhắn khách hàng mới nhất trước
      query += ` ORDER BY c.LastCustomerMessageAt DESC`;

      console.log(`Đang thực hiện truy vấn SQL thực tế...`);
      const result = await request.query(query);
      return result.recordset;
    } catch (err) {
      console.error('Lỗi khi truy xuất dữ liệu trong ConversationRepository:', err);
      throw err;
    }
  }
}

module.exports = new ConversationRepository();
