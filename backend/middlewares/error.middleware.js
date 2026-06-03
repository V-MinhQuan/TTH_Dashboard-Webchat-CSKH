/**
 * Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng Express
 */
module.exports = (err, req, res, next) => {
  // 1. Log chi tiết lỗi trên server để developer tiện debug
  console.error('--- HỆ THỐNG GẶP LỖI ---');
  console.error(err);

  const status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // 2. Bảo mật: Tránh để lộ mật khẩu, thông tin nhạy cảm của SQL Server
  // Khi kết nối thất bại, thông báo lỗi của thư viện mssql có thể chứa username hoặc IP
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('login failed') ||
    lowerMsg.includes('password') ||
    lowerMsg.includes('credentials') ||
    lowerMsg.includes('connection')
  ) {
    message = 'Không thể kết nối hoặc xác thực với Cơ sở dữ liệu. Vui lòng kiểm tra lại cấu hình file .env.';
  }

  // 3. Trả về định dạng JSON chuẩn
  res.status(status).json({
    success: false,
    message: message,
    // Chỉ trả về stack trace khi ở môi trường phát triển (development)
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
