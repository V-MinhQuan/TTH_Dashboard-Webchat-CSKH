# Backend API - Dashboard Chăm sóc Khách hàng

Backend API được xây dựng trên nền tảng Node.js, Express.js và Microsoft SQL Server nhằm phục vụ dữ liệu KPI cho giao diện Dashboard CSKH.

## 1. Cấu trúc thư mục dự án

```text
backend/
├── config/
│   └── db.js                        # Kết nối và quản lý Connection Pool SQL Server
├── controllers/
│   └── dashboard.controller.js      # Tiếp nhận request, kiểm tra dữ liệu đầu vào
├── repositories/
│   └── conversation.repository.js   # Truy vấn SQL Server trực tiếp (Có map bảng/cột)
├── routes/
│   └── dashboard.routes.js          # Khai báo các endpoints của ứng dụng
├── services/
│   ├── conversation-cleaner.service.js # Làm sạch dữ liệu, loại bỏ trùng lặp, chuẩn hóa
│   └── dashboard.service.js         # Tổng hợp dữ liệu thành các chỉ số KPI cần thiết
├── middlewares/
│   └── error.middleware.js          # Middleware xử lý lỗi toàn hệ thống và bảo mật
├── .env.example                     # File chứa cấu hình môi trường mẫu
├── .env                             # File cấu hình môi trường thực tế (Chứa thông tin kết nối)
├── server.js                        # Entry point - khởi tạo ứng dụng Express
├── package.json                     # Khai báo dependencies và các script khởi chạy
└── README.md                        # Hướng dẫn sử dụng và triển khai dự án này
```

---

## 2. Hướng dẫn cài đặt và cấu hình

### Bước 1: Di chuyển vào thư mục backend
Mở terminal/command prompt và chuyển hướng vào thư mục backend:
```bash
cd backend
```

### Bước 2: Cài đặt các thư viện phụ thuộc
Chạy lệnh sau để tải các package khai báo trong `package.json`:
```bash
npm install
```
*Các thư viện được cài đặt gồm:*
- **express**: Framework xây dựng API.
- **mssql**: Kết nối và thực thi các câu lệnh SQL trên SQL Server.
- **cors**: Cho phép frontend React gọi API chéo nguồn.
- **dotenv**: Đọc các cấu hình từ file `.env`.
- **nodemon** (devDependencies): Tự động restart server khi có thay đổi code trong lúc phát triển.

### Bước 3: Cấu hình biến môi trường
Tạo file `.env` (đã được tạo tự động) và điền các thông tin kết nối thực tế của bạn:
```env
PORT=5000
DB_USER=Dien_Username_Cua_Ban
DB_PASSWORD=Dien_Password_Cua_Ban
DB_SERVER=14.225.192.252
DB_PORT=1433
DB_DATABASE=Dien_DatabaseName_Cua_Ban
DB_TRUST_SERVER_CERTIFICATE=true
CORS_ORIGIN=*
```

---

## 3. Cách chạy ứng dụng

### Chạy ở chế độ phát triển (Development)
Server sẽ tự động restart khi bạn chỉnh sửa file nguồn:
```bash
npm run dev
```

### Chạy ở chế độ production
```bash
npm start
```

---

## 4. Hướng dẫn kiểm thử API (Sử dụng Browser/Postman)

### 4.1. Kiểm tra trạng thái server (Health Check)
- **URL**: `http://localhost:5000/api/health`
- **Method**: `GET`
- **Response mẫu**:
  ```json
  {
    "success": true,
    "message": "Backend is running successfully."
  }
  ```

### 4.2. Kiểm tra kết nối SQL Server (Test DB)
- **URL**: `http://localhost:5000/api/test-db`
- **Method**: `GET`
- **Description**: API này thực hiện chạy câu lệnh `SELECT GETDATE()` trên SQL Server của bạn và trả về thời gian hiện tại của DB Server.
- **Response thành công**:
  ```json
  {
    "success": true,
    "message": "Database connection test successful",
    "data": {
      "serverTime": "2026-06-03T01:58:20.000Z"
    }
  }
  ```

### 4.3. Lấy chỉ số KPI Dashboard (Mặc định)
- **URL**: `http://localhost:5000/api/dashboard/kpi`
- **Method**: `GET`
- **Response mẫu**:
  ```json
  {
    "success": true,
    "message": "Dashboard KPI fetched successfully",
    "data": {
      "totalConversations": 120,
      "newCustomers": 85,
      "statusSummary": {
        "new": 20,
        "open": 40,
        "pending": 15,
        "closed": 45,
        "unknown": 0
      },
      "sourceSummary": {
        "ZaloOA": 30,
        "ZaloBusiness": 10,
        "Facebook": 50,
        "ChatWidget": 25,
        "other": 5
      },
      "averageResponseTimeMinutes": 12
    }
  }
  ```

### 4.4. Lấy chỉ số KPI Dashboard có lọc theo ngày
- **URL**: `http://localhost:5000/api/dashboard/kpi?startDate=2026-06-01&endDate=2026-06-30`
- **Method**: `GET`
- **Query Params**:
  - `startDate`: Ngày bắt đầu lọc (định dạng `YYYY-MM-DD`).
  - `endDate`: Ngày kết thúc lọc (định dạng `YYYY-MM-DD`).

---

## 5. Hướng dẫn Frontend React (Vite/TypeScript) kết nối API

Tại mã nguồn Frontend React của bạn, hãy làm theo hướng dẫn dưới đây để gọi API này:

### Bước 1: Khai báo Types cho API Response (TypeScript)

Tạo file chứa định nghĩa kiểu dữ liệu, ví dụ `src/types/dashboard.ts`:
```typescript
export interface KPIStatusSummary {
  new: number;
  open: number;
  pending: number;
  closed: number;
  unknown: number;
}

export interface KPISourceSummary {
  ZaloOA: number;
  ZaloBusiness: number;
  Facebook: number;
  ChatWidget: number;
  other: number;
}

export interface KPIData {
  totalConversations: number;
  newCustomers: number;
  statusSummary: KPIStatusSummary;
  sourceSummary: KPISourceSummary;
  averageResponseTimeMinutes: number;
}

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
```

### Bước 2: Viết hàm gọi API sử dụng `fetch` hoặc `axios`

Ví dụ hàm gọi API trong file `src/services/dashboard.service.ts`:
```typescript
import { KPIData, APIResponse } from '../types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function fetchKPIData(startDate?: string, endDate?: string): Promise<KPIData> {
  const url = new URL(`${API_BASE_URL}/dashboard/kpi`);
  
  if (startDate) url.searchParams.append('startDate', startDate);
  if (endDate) url.searchParams.append('endDate', endDate);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const resJson: APIResponse<KPIData> = await response.json();
  if (!response.ok || !resJson.success) {
    throw new Error(resJson.message || 'Lỗi khi lấy dữ liệu KPI');
  }

  return resJson.data;
}
```

### Bước 3: Sử dụng Hook trong Component của React để hiển thị dữ liệu

```tsx
import React, { useEffect, useState } from 'react';
import { fetchKPIData } from './services/dashboard.service';
import { KPIData } from './types/dashboard';

export default function Dashboard() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc khoảng thời gian mặc định
  const [filters, setFilters] = useState({
    startDate: '2026-06-01',
    endDate: '2026-06-30'
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchKPIData(filters.startDate, filters.endDate);
        setKpiData(data);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [filters]);

  if (loading) return <div>Đang tải dữ liệu...</div>;
  if (error) return <div style={{ color: 'red' }}>Lỗi: {error}</div>;
  if (!kpiData) return <div>Không có dữ liệu.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard CSKH</h1>
      
      {/* Thống kê Tổng quan */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-100 rounded">
          <h3>Tổng số hội thoại</h3>
          <p className="text-xl font-bold">{kpiData.totalConversations}</p>
        </div>
        <div className="p-4 bg-green-100 rounded">
          <h3>Khách hàng mới</h3>
          <p className="text-xl font-bold">{kpiData.newCustomers}</p>
        </div>
        <div className="p-4 bg-yellow-100 rounded">
          <h3>Thời gian phản hồi TB</h3>
          <p className="text-xl font-bold">{kpiData.averageResponseTimeMinutes} phút</p>
        </div>
      </div>

      {/* Hiển thị chi tiết theo Status và Source */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="font-bold mb-2">Trạng thái hội thoại</h2>
          <ul>
            <li>Mới (New): {kpiData.statusSummary.new}</li>
            <li>Đang xử lý (Open): {kpiData.statusSummary.open}</li>
            <li>Chờ (Pending): {kpiData.statusSummary.pending}</li>
            <li>Hoàn tất (Closed): {kpiData.statusSummary.closed}</li>
          </ul>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-bold mb-2">Nguồn dữ liệu</h2>
          <ul>
            <li>ZaloOA: {kpiData.sourceSummary.ZaloOA}</li>
            <li>ZaloBusiness: {kpiData.sourceSummary.ZaloBusiness}</li>
            <li>Facebook: {kpiData.sourceSummary.Facebook}</li>
            <li>ChatWidget: {kpiData.sourceSummary.ChatWidget}</li>
            <li>Khác: {kpiData.sourceSummary.other}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Hướng dẫn chạy thử nghiệm tự động (Unit Test / Integration Test)

Chúng tôi đã viết đầy đủ bộ test suite bằng **Jest** và **Supertest** để kiểm tra tính đúng đắn của logic dọn dẹp dữ liệu, tính toán KPI và các API Endpoints.

### Cách chạy kiểm thử:
Di chuyển vào thư mục `backend` và chạy lệnh:
```bash
npm test
```

### Các Suite Test đã cài đặt:
1. **`conversation-cleaner.test.js`**: Kiểm tra quá trình dọn dẹp (loại trùng lặp, bỏ bản ghi lỗi, chuẩn hóa status/source).
2. **`dashboard.service.test.js`**: Sử dụng Mock Repository để kiểm tra tính toán KPI (các tổng hợp số lượng, khách hàng mới, thời gian phản hồi trung bình).
3. **`dashboard.api.test.js`**: Sử dụng Supertest để giả lập gọi HTTP request tới các API `/api/health`, `/api/dashboard/kpi`, `/api/test-db` nhằm kiểm thử phản hồi, xử lý lỗi và validate dữ liệu đầu vào.

