const { poolPromise, sql } = require('../config/db');


class ConversationRepository {
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
