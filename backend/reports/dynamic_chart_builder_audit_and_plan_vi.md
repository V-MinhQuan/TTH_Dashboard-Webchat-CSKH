# Audit và kế hoạch Dynamic Chart Builder

## 1. Phạm vi audit

Đã kiểm tra trực tiếp:

- `backend/app/routers/chart_builder.py`
- `backend/app/services/chart_builder_service.py`
- `backend/app/repositories/chart_builder_repository.py`
- `backend/app/schemas/chart_builder.py`
- `backend/app/db/session.py`
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/tests/test_chart_builder.py`
- Frontend Chart Builder, API service, TypeScript types và các component preview/settings.
- Metadata SQL Server của các bảng WebChat/User đã được code hiện tại sử dụng.

Không đọc hoặc đưa nội dung tin nhắn, mật khẩu, customer ID, sender ID, receiver ID ra catalog.

## 2. API hiện tại

| Endpoint | Chức năng hiện tại | Hạn chế |
|---|---|---|
| `GET /api/chart-builder/sources` | Trả 7 source định nghĩa tĩnh | Không phải data catalog; dimension/metric được hard-code |
| `POST /api/chart-builder/data` | Chạy query riêng theo `sourceId` | Mỗi tổ hợp mới cần thêm source và hàm query mới |
| `GET /api/chart-builder/configs` | Đọc JSON config đang active | Chỉ hiểu schema v1 |
| `POST /api/chart-builder/configs` | Lưu config JSON | Chỉ validate source/dimension/metric predefined |
| `DELETE /api/chart-builder/configs/{id}` | Soft-delete config | Giữ nguyên được |

Chưa có:

- `GET /api/chart-builder/catalog`
- `POST /api/chart-builder/preview`
- Custom query specification
- Aggregation/date grain/sort/Top N/type-aware filter
- Approved join resolver
- Execution metadata

## 3. Luồng query hiện tại

`SOURCE_CATALOG` nằm trong repository và ánh xạ trực tiếp tới các hàm:

- `_sentiment_by_date_query`
- `_sentiment_by_topic_query`
- `_satisfaction_trend_query`
- `_conversation_volume_query`
- `_keyword_frequency_query`
- `_topic_distribution_query`

Các giá trị filter được parameterize. Tuy nhiên:

- SQL được viết riêng cho từng chart source.
- Một số source lấy raw JSON rows rồi aggregate bằng Python.
- Chưa có query compiler dùng whitelist.
- `limit` chỉ thực sự áp dụng sau khi Python aggregate ở một số source.
- Cursor chưa đặt query timeout riêng cho Chart Builder.
- Không có metadata row count/execution time.

## 4. Saved config hiện tại

JSON v1:

```json
{
  "sourceId": "conversation_volume",
  "chartType": "bar",
  "groupBy": "channel",
  "yAxes": [
    {
      "column": "total_conversations",
      "color": "#D73C01"
    }
  ],
  "title": "Lưu lượng hội thoại",
  "filters": {}
}
```

Config không có `version` hoặc `mode`. Kế hoạch:

- Khi đọc: normalize thành `version=1`, `mode=predefined`.
- Config v2 dùng `version=2`, `mode=custom`.
- Không bulk-update `ConfigJson`.
- `/data` tiếp tục nhận request v1 và nhận thêm request v2.

## 5. Chart types hiện tại

Backend/frontend hiện chỉ hỗ trợ:

- `line`
- `bar`
- `stacked_bar`
- `pie`
- `donut`
- `area`

UI có tile disabled cho horizontal bar, scatter, combo và radar. Chưa có dual Y-axis hoặc `seriesType` trong backend config.

## 6. SQL Server đã xác minh

### 6.1 Runtime

| Thuộc tính | Giá trị |
|---|---|
| Database thực tế | `Dashboard_ChatBot` |
| SQL Server version | `12.0.2000.8` |
| Compatibility level | `120` |
| `ISJSON` | Không hỗ trợ |
| `OPENJSON` | Không hỗ trợ |

Tên database runtime không khớp mô tả cũ `dbFLIC_dev`; implementation phải dựa vào settings hiện hành, không hard-code database name.

### 6.2 Bảng và số dòng

| Bảng | Số dòng | Khả năng dùng |
|---|---:|---|
| `WebChat_Conversations` | 3,458 | Conversation volume, channel, response-time aggregate |
| `WebChat_MessageLogs` | 44,552 | Message volume, sender type, agent display name |
| `WebChat_MessageAnalytics` | 31,824 | Sentiment, satisfaction, need review, issue metrics |
| `WebChat_ConversationStatus` | 1,470 | Latest conversation status qua approved relationship |
| `WebChat_Messagelogs_User_Info` | 2,908 | Chứa customer display/avatar; không expose |
| `User` | 3 | Có password/email/phone; không expose vào BI catalog |
| `ChartConfigs` | 2, đều inactive | Lưu config v1/v2 trong JSON hiện có |

### 6.3 Quan hệ đã xác minh

| Quan hệ | Kết quả | Quyết định |
|---|---|---|
| Analytics → Conversations: `conversationId = Id` | Match 31,824/31,824 | Approved many-to-one |
| Conversation → Status: `CustomerId + Source` | Không có duplicate group hiện tại | Dùng `OUTER APPLY TOP 1` để chống nhân dòng |
| Analytics → MessageLogs qua `messageId` | Match 0 | Không approve |
| Conversation → latest host message | Match 2,808 conversation | Chỉ dùng trong dataset agent performance, có timeout/limit |

### 6.4 Field bị ẩn

- `User.Password`
- Email, điện thoại và username từ `User`
- `CustomerId`
- `SenderId`
- `ReceiverId`
- `TextContent`
- `sentimentReason`, `satisfactionReason`, `issueReason`
- Avatar URL và customer display name

### 6.5 Giới hạn dữ liệu

- `detectedTopics` và `detectedKeywords` là JSON text.
- SQL Server hiện tại không có JSON functions.
- Custom mode không thể aggregate topic/keyword hoàn toàn ở SQL side một cách an toàn.
- Hai field này sẽ xuất hiện trong catalog ở trạng thái unavailable với lý do rõ ràng.
- Legacy predefined source vẫn được giữ để không phá config cũ.
- Dữ liệu `MessageLogs` có max date `2026-06-27`, lớn hơn ngày audit `2026-06-15`; đây là rủi ro chất lượng dữ liệu, không tự sửa.

## 7. Rủi ro bảo mật và hiệu năng

| Rủi ro | Mức | Biện pháp |
|---|---|---|
| Raw table/column từ client | Critical | Chỉ resolve ID qua catalog immutable |
| SQL injection qua filter | Critical | Parameterize toàn bộ value, escape LIKE |
| Join gây nhân dòng | High | Approved relation map và cardinality |
| Trả raw records | High | Chỉ SELECT dimension + SQL aggregate |
| Query dài | High | Cursor timeout, max limit 5,000, preview cap nhỏ hơn |
| Sensitive columns | High | Không đưa vào catalog |
| JSON aggregate ở Python | Medium | Không cho custom mode dùng field JSON |
| Config v1 bị hỏng | High | Normalizer v1/v2, không rewrite DB |
| Agent query thiếu index phù hợp | Medium | Dataset riêng, aggregate-only, timeout; đề xuất index riêng nhưng không migrate |

## 8. Kiến trúc triển khai

### Backend

1. `app/config/chart_builder_catalog.py`
   - Immutable whitelist cho dataset, field, aggregation, filter, date grain và relation.
2. `app/services/chart_query_builder.py`
   - Validate và compile SELECT/GROUP BY/ORDER BY.
   - Không nhận raw SQL fragment từ request.
3. Mở rộng schemas:
   - Catalog metadata.
   - Custom request v2.
   - Type-aware filter.
   - Sort/Top N/limit.
   - Chart settings, axis group và series type.
4. Mở rộng repository:
   - Internal metadata availability check.
   - Read-only custom query với cursor timeout.
5. Mở rộng service/router:
   - `/catalog`, `/preview`, `/data`.
   - `/sources` và request v1 giữ nguyên.
   - Normalize config v1/v2.

### Frontend

1. Data Explorer dùng `/catalog`.
2. Dataset selector, field search, datatype/semantic badges.
3. Visual query settings:
   - Dimension/date grain.
   - Metric/aggregation/label/format/color/axis/series type.
   - Filter/operator/value.
   - Sort, Top N, row limit.
4. Debounced/cancellable `/preview`.
5. Preview hỗ trợ horizontal bar, scatter, combo, radar và dual axis.
6. Config v1 được load ở compatibility mode; config v2 dùng custom editor.

## 9. Test plan

- Compiler unit tests: whitelist, injection, aggregation, date grain, group by, count distinct, sorting, Top N, max limit và invalid relation.
- Service tests: type-aware filters, empty rows, metadata, config normalization.
- Router tests: catalog/preview/data/config.
- Frontend build và manual UI.
- Dữ liệu thật:
  - Conversations by channel.
  - Messages by month.
  - Sentiment by month.
  - Need-review by source.
  - Agent message volume.
  - Average response time by agent.
- Top keywords được ghi nhận unavailable do SQL Server 2014 không hỗ trợ JSON.

