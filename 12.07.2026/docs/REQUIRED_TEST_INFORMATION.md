# REQUIRED TEST INFORMATION

Danh sách dưới đây là đầu vào còn thiếu hoặc cần xác nhận trước khi có thể chạy đầy đủ 258 test case. Không ghi secret trực tiếp vào tài liệu này.

## Blocker công cụ và phiên chạy

| Hạng mục | Trạng thái baseline 2026-07-12 | Cần cung cấp/xử lý |
|---|---|---|
| Maven | Apache Maven 3.9.16 đã được tải và xác minh SHA-512 để chạy automation; `mvn` vẫn chưa có trên `PATH` | Cài Maven 3.9+ trên PATH hoặc cung cấp Maven Wrapper đã kiểm soát cho người chạy/CI |
| Java | Có Java 25.0.2 | Xác nhận dùng JDK 17 hoặc xác nhận JDK 25 tương thích với compiler release 17 |
| Browser | Selenium đã chạy Chrome 150.0.7871.114; Selenium Manager cấp ChromeDriver 150.0.7871.115 | CI cần Chrome/Edge tương thích; in-app browser tab không còn là blocker của Selenium suite |
| TypeScript gate | `npm run typecheck` fail với 51 lỗi trong 20 file | Sửa/triage drift trước khi dùng typecheck làm release gate |
| Backend readiness | `/api/health` trả 503 | Xử lý defect readiness hoặc xác nhận đây là behavior có chủ đích |

## Credential

Cần cung cấp qua environment variable hoặc CI secret:

- `FLIC_MANAGER_USERNAME`
- `FLIC_MANAGER_PASSWORD`
- `FLIC_STAFF_USERNAME`
- `FLIC_STAFF_PASSWORD`

Tài khoản phải là dữ liệu test, không phải tài khoản người dùng thật. Cần xác nhận tài khoản manager có quyền vào section “Người dùng & phân quyền” và tài khoản staff có đúng phạm vi dữ liệu dự kiến.

## Test data và DB

1. Test database hoặc tenant riêng, cùng chính sách refresh/reset.
2. Khoảng ngày có dữ liệu ổn định cho 30 ngày, 7 ngày, hôm nay và custom range.
3. Ít nhất một record cho mỗi kênh đang bật: Zalo OA, Zalo Business, Chat Widget, Facebook nếu cấu hình active.
4. Danh sách topic active và fixture có dữ liệu/không dữ liệu cho từng topic.
5. Conversation ID tồn tại, ID không tồn tại và conversation tiêu cực có message detail.
6. KPI/analytics fixture có expected totals để đối chiếu, không chỉ kiểm tra element hiển thị.
7. Feedback/user/chart config fixture do automation sở hữu, có API cleanup an toàn.
8. Quy tắc retention cho dữ liệu `AUTO_<TC_ID>_<timestamp>`.
9. Xác nhận public API được phép dùng để setup/cleanup; không cấp quyền sửa trực tiếp SQL Server nếu chưa phê duyệt.

## ML data

- Model/version chuẩn dùng cho execution.
- Bộ câu positive/negative đã được nghiệp vụ duyệt.
- Ngưỡng/tolerance nếu cần assertion score; không dùng duy nhất tiêu chí cảm tính `> 0.5` từ Excel.
- Cơ chế chuẩn bị controlled environment cho ML down, slow startup và timeout.
- Xác nhận ViSoBERT là optional hay bắt buộc trong readiness; payload hiện ghi `requireVisobert=false`.

## Controlled failure environment

Các case 500, timeout, DB down và ML down không được tạo bằng cách sửa production backend. Cần một trong các lựa chọn:

- Test environment có quyền dừng service;
- Mock/stub server riêng cho automation;
- URL dependency override dành cho test;
- Network fault injection đã được phê duyệt.

Cần cung cấp endpoint, cách reset và người chịu trách nhiệm. Nếu không có, các case giữ trạng thái `BLOCKED_ENVIRONMENT`.

## Requirement cần xác nhận

1. Excel dùng email nhưng UI active dùng username.
2. Excel yêu cầu JWT; backend dùng HMAC bearer session hai phần.
3. Excel phân biệt Admin/Manager/Staff; source active chỉ dùng manager/staff và map ADMIN/MANAGER về manager.
4. Staff hiện được phép xem activity của chính mình; Excel có case kỳ vọng bị chặn.
5. Global export không expose CSV; xác nhận CSV TC là N/A hay cần bổ sung feature.
6. Keyword page không có word cloud/search/pagination/navigation như một số TC.
7. Activity không có pagination/filter handler và không có cột actor như expected cũ.
8. Channel table, Feedback và User Management thiếu một số pagination/sort/edit control được mô tả trong Excel.
9. Avatar upload không có trong flow active.
10. Test Plan có rate-limiting task nhưng workbook không có TC 429 và source chưa có contract rate limit rõ ràng.

## Quyền chạy destructive

Mặc định `FLIC_ALLOW_DESTRUCTIVE_TESTS=false`. Trước khi đặt `true`, cần xác nhận bằng văn bản:

- Đúng test environment/tenant;
- Tài khoản automation được phép tạo/sửa/xóa;
- Cleanup API hoạt động;
- Không khóa tài khoản đang chạy;
- Không đổi mật khẩu tài khoản dùng chung;
- Có backup/rollback phù hợp.
