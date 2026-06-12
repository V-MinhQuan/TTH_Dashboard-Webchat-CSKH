const dashboardService = require('../services/dashboard.service');

class DashboardController {
  /**
   * API Handler lấy toàn bộ KPI dashboard, hỗ trợ lọc theo ngày
   * GET /api/dashboard/kpi
   */
  async getKPI(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      // 1. Kiểm tra tính hợp lệ của ngày nếu được truyền lên
      if (startDate) {
        const parsedStart = Date.parse(startDate);
        if (isNaN(parsedStart)) {
          return res.status(400).json({
            success: false,
            message: 'Định dạng startDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ.'
          });
        }
      }

      if (endDate) {
        const parsedEnd = Date.parse(endDate);
        if (isNaN(parsedEnd)) {
          return res.status(400).json({
            success: false,
            message: 'Định dạng endDate không hợp lệ. Vui lòng truyền định dạng YYYY-MM-DD hoặc một chuỗi ngày hợp lệ.'
          });
        }
      }

      // Đảm bảo startDate không lớn hơn endDate
      if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
          return res.status(400).json({
            success: false,
            message: 'Ngày bắt đầu (startDate) không thể lớn hơn ngày kết thúc (endDate).'
          });
        }
      }

      // 2. Gọi service để lấy các chỉ số KPI
      const kpis = await dashboardService.getKPIs(startDate, endDate);

      // 3. Trả về response chuẩn
      return res.status(200).json({
        success: true,
        message: 'Dashboard KPI fetched successfully',
        data: kpis
      });
    } catch (err) {
      // Chuyển lỗi sang Error Middleware xử lý tập trung
      next(err);
    }
  }
}

module.exports = new DashboardController();
