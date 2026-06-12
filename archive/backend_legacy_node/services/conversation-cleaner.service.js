class ConversationCleanerService {
  /**
   * Làm sạch và chuẩn hóa dữ liệu hội thoại từ Database trước khi tính toán KPI
   * @param {Array} conversations - Mảng các bản ghi hội thoại thô từ DB
   * @returns {Array} Mảng các bản ghi đã làm sạch và chuẩn hóa
   */
  cleanAndNormalize(conversations) {
    if (!Array.isArray(conversations)) {
      return [];
    }

    const seenIds = new Set();
    const cleaned = [];

    for (const record of conversations) {
      // 1. Loại bỏ dữ liệu lỗi: thiếu id hoặc thiếu created_at
      if (!record.id || !record.created_at) {
        continue;
      }

      // Kiểm tra xem thời gian created_at có hợp lệ không
      const createdAtDate = new Date(record.created_at);
      if (isNaN(createdAtDate.getTime())) {
        continue;
      }

      // 2. Loại bỏ dữ liệu trùng lặp theo id
      const idStr = String(record.id).trim();
      if (seenIds.has(idStr)) {
        continue;
      }
      seenIds.add(idStr);

      // 3. Chuẩn hóa trạng thái hội thoại
      const statusRaw = record.status ? String(record.status).toLowerCase().trim() : '';
      let status = 'unknown';
      if (statusRaw === 'new' || statusRaw === 'mới') {
        status = 'new';
      } else if (statusRaw === 'open' || statusRaw === 'đang xử lý' || statusRaw === 'processing') {
        status = 'open';
      } else if (statusRaw === 'pending' || statusRaw === 'chờ xử lý') {
        status = 'pending';
      } else if (
        statusRaw === 'closed' || 
        statusRaw === 'done' || 
        statusRaw === 'hoàn tất' || 
        statusRaw === 'complete'
      ) {
        status = 'closed';
      }

      // 4. Chuẩn hóa nguồn dữ liệu (Source)
      const sourceRaw = record.source ? String(record.source).toLowerCase().trim() : '';
      let source = 'other';
      if (sourceRaw === 'facebook' || sourceRaw === 'fb' || sourceRaw === 'messenger') {
        source = 'Facebook';
      } else if (sourceRaw === 'zalooa' || sourceRaw === 'zalo') {
        source = 'ZaloOA';
      } else if (sourceRaw === 'zalobusiness' || sourceRaw === 'zalobiz') {
        source = 'ZaloBusiness';
      } else if (sourceRaw === 'chatwidget' || sourceRaw === 'website' || sourceRaw === 'web') {
        source = 'ChatWidget';
      }

      // 5. Chuẩn hóa thời gian phản hồi đầu tiên và cập nhật
      let firstResponseAt = null;
      if (record.first_response_at) {
        const d = new Date(record.first_response_at);
        if (!isNaN(d.getTime())) {
          firstResponseAt = d;
        }
      }

      let updatedAt = null;
      if (record.updated_at) {
        const d = new Date(record.updated_at);
        if (!isNaN(d.getTime())) {
          updatedAt = d;
        }
      }

      cleaned.push({
        id: idStr,
        customer_id: record.customer_id ? String(record.customer_id).trim() : null,
        customer_name: record.customer_name ? String(record.customer_name).trim() : 'Khách hàng',
        status,
        source,
        created_at: createdAtDate,
        first_response_at: firstResponseAt,
        updated_at: updatedAt
      });
    }

    return cleaned;
  }
}

module.exports = new ConversationCleanerService();
