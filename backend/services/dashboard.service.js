const conversationRepository = require('../repositories/conversation.repository');
const conversationCleanerService = require('./conversation-cleaner.service');

class DashboardService {
  /**
   * Tính toán các chỉ số KPI cho Dashboard dựa trên khoảng thời gian lọc
   * @param {string} [startDate] - Ngày bắt đầu lọc
   * @param {string} [endDate] - Ngày kết thúc lọc
   * @returns {Promise<Object>} Đối tượng KPI chứa các số liệu tổng hợp
   */
  async getKPIs(startDate, endDate) {
    // 1. Lấy dữ liệu hội thoại thô từ Repository
    const rawConversations = await conversationRepository.getConversations(startDate, endDate);

    // 2. Làm sạch và chuẩn hóa dữ liệu
    const cleanedConversations = conversationCleanerService.cleanAndNormalize(rawConversations);

    // 3. Tính toán tổng số hội thoại
    const totalConversations = cleanedConversations.length;

    // 4. Tính toán số lượng khách hàng mới (Số lượng customer_id duy nhất)
    const uniqueCustomerIds = new Set();
    cleanedConversations.forEach(c => {
      if (c.customer_id) {
        uniqueCustomerIds.add(c.customer_id);
      }
    });
    const newCustomers = uniqueCustomerIds.size;

    // 5. Thống kê số lượng hội thoại theo trạng thái (statusSummary)
    const statusSummary = {
      new: 0,
      open: 0,
      pending: 0,
      closed: 0,
      unknown: 0
    };

    // 6. Thống kê số lượng hội thoại theo nguồn dữ liệu (sourceSummary)
    const sourceSummary = {
      ZaloOA: 0,
      ZaloBusiness: 0,
      Facebook: 0,
      ChatWidget: 0,
      other: 0
    };

    let totalResponseTimeMs = 0;
    let validResponseTimeCount = 0;

    // Duyệt qua danh sách để phân loại và tính toán thời gian phản hồi
    cleanedConversations.forEach(c => {
      // Phân loại trạng thái
      if (statusSummary.hasOwnProperty(c.status)) {
        statusSummary[c.status]++;
      } else {
        statusSummary.unknown++;
      }

      // Phân loại nguồn dữ liệu
      if (sourceSummary.hasOwnProperty(c.source)) {
        sourceSummary[c.source]++;
      } else {
        sourceSummary.other++;
      }

      // Tính thời gian phản hồi đầu tiên (first_response_at - created_at)
      if (c.first_response_at && c.created_at) {
        const diffMs = c.first_response_at.getTime() - c.created_at.getTime();
        // Chỉ tính nếu thời gian phản hồi hợp lệ (lớn hơn hoặc bằng 0)
        if (diffMs >= 0) {
          totalResponseTimeMs += diffMs;
          validResponseTimeCount++;
        }
      }
    });

    // 7. Tính thời gian phản hồi trung bình (phút)
    let averageResponseTimeMinutes = 0;
    if (validResponseTimeCount > 0) {
      const avgMs = totalResponseTimeMs / validResponseTimeCount;
      averageResponseTimeMinutes = Math.round(avgMs / (1000 * 60)); // Chuyển từ ms sang phút và làm tròn
    }

    return {
      totalConversations,
      newCustomers,
      statusSummary,
      sourceSummary,
      averageResponseTimeMinutes
    };
  }
}

module.exports = new DashboardService();
