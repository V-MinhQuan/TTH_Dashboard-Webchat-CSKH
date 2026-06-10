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
    if (typeof conversationRepository.getKpiAggregates === 'function') {
      try {
        const aggregates = await conversationRepository.getKpiAggregates(startDate, endDate);
        if (aggregates && aggregates.totals) {
          return this._buildKpisFromAggregates(aggregates);
        }
      } catch (err) {
        console.warn(`[DashboardService] getKpiAggregates failed, falling back to raw processing: ${err.message}`);
      }
    }

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

    // 8. Tính toán trendData theo ngày
    const trendMap = {};
    cleanedConversations.forEach(c => {
      if (c.created_at) {
        const dateObj = c.created_at;
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;

        if (!trendMap[dateKey]) {
          trendMap[dateKey] = {
            dateKey,
            total: 0,
            processed: 0,
            unprocessed: 0
          };
        }

        trendMap[dateKey].total++;
        if (c.status === 'closed') {
          trendMap[dateKey].processed++;
        } else {
          trendMap[dateKey].unprocessed++;
        }
      }
    });

    const trendData = Object.values(trendMap)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map(item => {
        const [, mm, dd] = item.dateKey.split('-');
        const formattedDate = `${parseInt(dd, 10)}/${parseInt(mm, 10)}`;
        return {
          date: formattedDate,
          total: item.total,
          processed: item.processed,
          unprocessed: item.unprocessed
        };
      });

    return {
      totalConversations,
      newCustomers,
      statusSummary,
      sourceSummary,
      averageResponseTimeMinutes,
      trendData
    };
  }

  _buildKpisFromAggregates({ totals = {}, statusRows = [], sourceRows = [], trendRows = [] }) {
    const statusSummary = {
      new: 0,
      open: 0,
      pending: 0,
      closed: 0,
      unknown: 0
    };

    statusRows.forEach(row => {
      const status = Object.prototype.hasOwnProperty.call(statusSummary, row.status)
        ? row.status
        : 'unknown';
      statusSummary[status] += Number(row.total || 0);
    });

    const sourceSummary = {
      ZaloOA: 0,
      ZaloBusiness: 0,
      Facebook: 0,
      ChatWidget: 0,
      other: 0
    };

    sourceRows.forEach(row => {
      const source = Object.prototype.hasOwnProperty.call(sourceSummary, row.source)
        ? row.source
        : 'other';
      sourceSummary[source] += Number(row.total || 0);
    });

    const trendData = trendRows.map(row => {
      const dateObj = row.dateKey instanceof Date ? row.dateKey : new Date(row.dateKey);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      return {
        date: `${parseInt(dd, 10)}/${parseInt(mm, 10)}`,
        total: Number(row.total || 0),
        processed: Number(row.processed || 0),
        unprocessed: Number(row.unprocessed || 0)
      };
    });

    return {
      totalConversations: Number(totals.totalConversations || 0),
      newCustomers: Number(totals.newCustomers || 0),
      statusSummary,
      sourceSummary,
      averageResponseTimeMinutes: Math.round(Number(totals.averageResponseTimeMinutes || 0)),
      trendData
    };
  }
}

module.exports = new DashboardService();
