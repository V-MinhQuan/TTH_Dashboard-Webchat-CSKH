const sql = require('mssql');
require('dotenv').config();

// Cấu hình kết nối SQL Server lấy từ các biến môi trường (.env)
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || '14.225.192.252',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true', // Đọc cấu hình từ .env (đặt false nếu DB không hỗ trợ SSL)
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true', // Chấp nhận chứng chỉ tự ký
    cryptoCredentialsDetails: {
      minVersion: 'TLSv1' // Hỗ trợ tương thích ngược với SQL Server cũ (TLS 1.0 / 1.1)
    }
  }
};

console.log('Đang kết nối tới Database với cấu hình:', {
  server: dbConfig.server,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  trustServerCertificate: dbConfig.options.trustServerCertificate
});

// Tạo đối tượng ConnectionPool và bắt đầu kết nối
const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('=== KẾT NỐI DATABASE THÀNH CÔNG ===');
    return pool;
  })
  .catch(err => {
    console.error('=== KẾT NỐI DATABASE THẤT BẠI ===');
    console.error('Chi tiết lỗi:', err.message);
    // Trả về một đối tượng giả lập để tránh lỗi unhandled rejection làm sập server.
    // Khi controller/repository gọi pool.request(), nó sẽ ném lỗi kết nối ra để middleware xử lý.
    return {
      err,
      request: () => {
        throw new Error('Database connection failed: ' + err.message);
      }
    };
  });

module.exports = {
  sql,
  poolPromise
};
