# Báo cáo quét cleanup trước khi push GitHub

## 1. Thời gian quét

- Thời điểm chạy: `2026-06-10 16:21:08 +07:00`
- Phạm vi: chỉ đọc project, phân loại file/folder, tạo báo cáo.
- Không thực hiện: không xóa file, không sửa `.gitignore`, không chạy migration, không reprocess DB, không commit, không push.

## 2. Tổng quan project hiện tại

Project đang ở trạng thái migration song song:

- Frontend React/TypeScript: `src/`
- FastAPI backend mới: `backend/app/`
- Node.js backend cũ giữ rollback: `backend/server.js`, `backend/routes/`, `backend/controllers/`, `backend/services/`, `backend/repositories/`
- AI service: `ml-service/`
- SQL Server cấu hình qua local `.env`
- Báo cáo migration/smoke test: `backend/reports/`

Kết luận tổng quan: chưa nên xóa Node.js backend vì vẫn là rollback path. Chỉ nên cleanup cache, virtual env/dependency local, file runtime, và các artifact test sau khi có duyệt.

## 3. Safe to delete now

Nhóm này là cache/build/runtime generated, có thể tạo lại, không phải source code:

| Nhóm | Path hiện có |
| --- | --- |
| Pytest cache | `backend/.pytest_cache/` |
| Pytest cache | `ml-service/.pytest_cache/` |
| Python cache | `backend/app/__pycache__/` |
| Python cache | `backend/app/core/__pycache__/` |
| Python cache | `backend/app/db/__pycache__/` |
| Python cache | `backend/app/repositories/__pycache__/` |
| Python cache | `backend/app/routers/__pycache__/` |
| Python cache | `backend/app/schemas/__pycache__/` |
| Python cache | `backend/app/services/__pycache__/` |
| Python cache | `backend/app/utils/__pycache__/` |
| Python cache | `backend/tests_fastapi/__pycache__/` |
| Python cache | `ml-service/app/__pycache__/` |
| Python cache | `ml-service/tests/__pycache__/` |
| Python bytecode | `*.pyc` dưới `backend/` và `ml-service/` |

Không thấy các thư mục `dist/`, `build/`, `.vite/`, `.cache/`, `coverage/`, `htmlcov/`, `logs/`, `tmp/`, `temp/` tại thời điểm quét.

## 4. Should keep

Không xóa các nhóm này:

- `.env` local: giữ trên máy, không push public.
- `.env.example`, `backend/.env.example`, `ml-service/.env.example`: giữ để người khác biết cấu hình mẫu.
- `backend/app/`: FastAPI backend mới.
- `backend/server.js`: Node.js rollback backend entrypoint.
- `backend/routes/`, `backend/controllers/`, `backend/services/`, `backend/repositories/`: Node.js rollback backend.
- `backend/package.json`, `backend/package-lock.json`: Node.js backend dependency lock.
- `backend/requirements.txt`: FastAPI backend dependency.
- `backend/db/migrations/`: migration script, không chạy/xóa khi chưa duyệt.
- `backend/database/`: SQL script lịch sử/migration draft, cần giữ hoặc duyệt riêng.
- `backend/tests/`, `backend/tests_fastapi/`: test suites.
- `ml-service/`: AI service source, tests, requirements, README.
- `src/`: frontend source.
- `src/app/services/`, `src/app/types/`, `src/app/config/`: frontend API/type/config mới.
- `package.json`, `package-lock.json`, `vite.config.ts`: frontend build/dev config.
- `README.md`, `docs/`, `guidelines/`: tài liệu project.
- `backend/reports/`: giữ folder báo cáo; chỉ xóa từng artifact cũ khi có duyệt.

## 5. Should ignore in Git but not delete

Những mục này cần giữ local nhưng không nên push GitHub:

| Path | Trạng thái | Lý do |
| --- | --- | --- |
| `.env` | tồn tại, ignored, chưa tracked | Có thể chứa cấu hình local/secret. |
| `backend/.env` | tồn tại, ignored, chưa tracked | Có thể chứa DB credentials. |
| `ml-service/.env` | tồn tại, ignored, chưa tracked | Có thể chứa ML runtime config. |
| `node_modules/` | tồn tại, ignored | Dependency frontend local. |
| `backend/node_modules/` | tồn tại, ignored | Dependency Node.js backend local. |
| `backend/.venv/` | tồn tại, ignored | Python virtualenv backend local. |
| `ml-service/.venv/` | tồn tại, ignored | Python virtualenv ml-service local. |
| `ml-service/models/` | tồn tại, ignored | Model ONNX lớn, cần cho runtime local. |
| `ml-service/data/` | tồn tại, ignored | Runtime data/metrics local. |
| `.sixth/` | tồn tại, ignored | Local tool/workflow folder. |

Model local đáng chú ý:

- `ml-service/models/phobert-sentiment-onnx/model.onnx`: khoảng `515.29 MB`.
- Không nên push file này lên public GitHub. Nếu cần chia sẻ model, dùng Git LFS, release artifact, cloud storage, hoặc script download.

## 6. Need user approval before delete

Các file này có thể là artifact cũ/dry-run/test evidence, nhưng cần bạn duyệt trước khi xóa vì có thể phục vụ audit hoặc chứa dữ liệu đánh giá:

### `backend/reports/`

- `backend/reports/devtest_issue_reprocess_dry_run.csv`
- `backend/reports/devtest_issue_reprocess_dry_run_summary.json`
- `backend/reports/devtest_issue_reprocess_validation_report.txt`
- `backend/reports/ensemble-dry-run-1000.csv`
- `backend/reports/ensemble-dry-run-1000.summary.json`
- `backend/reports/ensemble-dry-run-2026-06-05T09-49-42-229Z.csv`
- `backend/reports/ensemble-dry-run-2026-06-05T09-49-42-229Z.summary.json`
- `backend/reports/fastapi_backend_migration_check_raw.json`
- `backend/reports/issue_detection_before_after_report.csv`
- `backend/reports/issue_metadata_migration_devtest_report.txt`
- `backend/reports/issue_metadata_persistence_test_report.txt`
- `backend/reports/missed_support_issues_analysis.csv`
- `backend/reports/sentiment_blind_test_template.csv`
- `backend/reports/sentiment_blind_test_v2_template.csv`
- `backend/reports/sentiment_evaluation_effective_labels.csv`
- `backend/reports/sentiment_evaluation_mock.csv`
- `backend/reports/sentiment_evaluation_template.csv`

### Root `reports/`

- `reports/ensemble-dry-run-2026-06-08T04-07-00-991Z.csv`
- `reports/ensemble-dry-run-2026-06-08T04-07-00-991Z.summary.json`

### SQL/draft files cần kiểm tra owner trước khi xóa

- `backend/database/sprint6_add_analyzer_version.sql`
- `backend/database/sprint6_message_analytics.sql`

Ghi chú: các file CSV/JSON/TXT report có thể chứa dữ liệu hội thoại, customer text, hoặc evidence test. Không nên push public nếu chưa rà soát dữ liệu nhạy cảm.

## 7. Trạng thái `.env`

| File | Tồn tại | Tracked | Ignored | Khuyến nghị |
| --- | --- | --- | --- | --- |
| `.env` | có | không | có | giữ local, không push |
| `backend/.env` | có | không | có | giữ local, không push |
| `ml-service/.env` | có | không | có | giữ local, không push |
| `backend/.env.example` | có | không | không | nên keep và có thể đưa vào Git |
| `ml-service/.env.example` | có | không | không | nên keep và có thể đưa vào Git |

Không in nội dung `.env` trong báo cáo để tránh lộ secret.

## 8. Trạng thái `.venv`

| Path | Tồn tại | Git ignore | Khuyến nghị |
| --- | --- | --- | --- |
| `backend/.venv/` | có | có | không push; có thể xóa local nếu muốn cài lại |
| `ml-service/.venv/` | có | có | không push; có thể xóa local nếu muốn cài lại |

Không cần xóa `.venv` nếu bạn vẫn chạy project local. Nếu cần cleanup dung lượng, có thể xóa và tạo lại bằng `python -m venv .venv`.

## 9. Trạng thái `node_modules`

| Path | Tồn tại | Git ignore | Khuyến nghị |
| --- | --- | --- | --- |
| `node_modules/` | có | có | không push; giữ local để chạy frontend |
| `backend/node_modules/` | có | có | không push; giữ local để chạy Node rollback |

Không nên commit `node_modules/`.

## 10. Trạng thái `dist/build/cache`

Tại thời điểm quét:

- Không thấy `dist/`.
- Không thấy `build/` ngoài dependency/venv đã exclude.
- Không thấy `.vite/`.
- Không thấy `.cache/`.
- Có `.pytest_cache/` trong `backend/` và `ml-service/`.
- Có nhiều `__pycache__/` trong `backend/` và `ml-service/`.

## 11. Trạng thái `.gitignore`

`.gitignore` đang ở trạng thái modified:

```text
 M .gitignore
```

Nội dung hiện tại đã ignore được nhiều nhóm quan trọng:

- `node_modules/`
- `dist/`
- `.env`, `.env.*`, giữ lại `!.env.example`
- `*.log`
- `.DS_Store`, `Thumbs.db`
- `.vscode/`, `.idea/`, `*.swp`
- `__pycache__/`, `*.py[cod]`, `.venv/`, `venv/`, `env/`, `.pytest_cache/`, `.coverage`, `htmlcov/`, `build/`
- `*.zip`, `*.tar.gz`
- `.ensemble-reprocess-state.json`, `scratch_*.js`
- `ml-service/models/`, `ml-service/data/`

Thiếu hoặc nên bổ sung để đầy đủ hơn:

- `.mypy_cache/`
- `.ruff_cache/`
- `coverage/`
- `.vite/`
- `.cache/`
- `logs/`
- `tmp/`
- `temp/`
- `*.tmp`
- `*.bak`
- `*.backup`
- `*.old`
- `!backend/.env.example`
- `!ml-service/.env.example`

## 12. Proposed `.gitignore` updates

Chưa áp dụng. Đề xuất thêm nếu bạn duyệt:

```gitignore
# Python extra caches
.mypy_cache/
.ruff_cache/
coverage/

# Node/Vite extra caches
.vite/
.cache/

# Logs and temp folders
logs/
tmp/
temp/
*.tmp
*.bak
*.backup
*.old

# Keep environment examples explicit
!backend/.env.example
!ml-service/.env.example
```

Nếu muốn chuẩn hóa theo spec cleanup, cũng có thể giữ nguyên block hiện tại và chỉ thêm các dòng còn thiếu ở trên.

## 13. `git status --short` result

Kết quả không bao gồm ignored files:

```text
 M .gitignore
 M backend/package-lock.json
 M backend/repositories/conversation.repository.js
 M backend/routes/dashboard.routes.js
 M backend/server.js
 M backend/services/dashboard.service.js
 M backend/tests/dashboard.api.test.js
 M package-lock.json
 M src/app/App.tsx
 M src/app/colors.ts
 M src/app/components/AIChatWidget.tsx
 M src/app/components/ChartCard.tsx
 M src/app/components/FilterPanel.tsx
 M src/app/components/screens/AIInsights.tsx
 M src/app/components/screens/ChartBuilder.tsx
 M src/app/components/screens/ConversationDetail.tsx
 M src/app/components/screens/Overview.tsx
 M src/app/components/screens/SentimentAnalysis.tsx
 M vite.config.ts
?? backend/.env.example
?? backend/app/
?? backend/controllers/analytics.controller.js
?? backend/database/
?? backend/db/
?? backend/docs/
?? backend/reports/
?? backend/repositories/analytics.repository.js
?? backend/requirements.txt
?? backend/routes/analytics.routes.js
?? backend/scripts/
?? backend/services/ai-sentiment.service.js
?? backend/services/analytics.service.js
?? backend/services/satisfaction-score.service.js
?? backend/services/sentiment-analyzer.service.js
?? backend/services/text-preprocessing.service.js
?? backend/services/topic-detector.service.js
?? backend/tests/ai-sentiment.test.js
?? backend/tests/analytics.api.test.js
?? backend/tests/analytics.service.phobert.test.js
?? backend/tests/hybrid-sentiment.test.js
?? backend/tests/satisfaction-score.test.js
?? backend/tests/sentiment-analyzer.test.js
?? backend/tests/sentiment-proxy.service.test.js
?? backend/tests/text-preprocessing.test.js
?? backend/tests/topic-detector.test.js
?? backend/tests_fastapi/
?? docs/sentiment_monitoring_plan.md
?? ml-service/
?? reports/
?? src/app/components/common/
?? src/app/config/
?? src/app/services/
?? src/app/types/
```

Ignored file/folder samples:

```text
!! .env
!! backend/.env
!! ml-service/.env
!! backend/.pytest_cache/
!! ml-service/.pytest_cache/
!! backend/.venv/
!! ml-service/.venv/
!! node_modules/
!! backend/node_modules/
!! ml-service/models/
!! ml-service/data/
```

## 14. Files that may contain secrets or sensitive data

Không đọc/in nội dung secret. Các path cần xử lý cẩn thận:

- `.env`
- `backend/.env`
- `ml-service/.env`
- `backend/reports/*.csv`
- `backend/reports/*raw*.json`
- `backend/reports/*dry-run*.json`
- `backend/reports/*dry-run*.csv`
- `reports/*.csv`
- `reports/*.json`
- `ml-service/data/metrics.json`

Lý do: `.env` có thể chứa credential; CSV/JSON report có thể chứa dữ liệu hội thoại/customer text/evidence test.

## 15. Recommended next cleanup step

Thứ tự đề xuất:

1. Duyệt nhóm `Safe to delete now` và xóa cache Python/pytest.
2. Cập nhật `.gitignore` với các pattern còn thiếu nếu bạn đồng ý.
3. Rà soát `backend/reports/*.csv`, `backend/reports/*raw*.json`, root `reports/` trước khi quyết định commit hoặc xóa.
4. Giữ `ml-service/models/` local nhưng không push; nếu cần chia sẻ model, dùng artifact storage hoặc Git LFS.
5. Sau cleanup, chạy lại `git status --short` và test tối thiểu trước khi commit.

## 16. Proposed cleanup commands

Chưa chạy các lệnh dưới đây. Chỉ đề xuất để bạn duyệt.

### Xóa cache Python/pytest an toàn

```powershell
Get-ChildItem -Recurse -Force -Directory -Include __pycache__, .pytest_cache |
  Remove-Item -Recurse -Force

Get-ChildItem -Recurse -Force -File -Include *.pyc, *.pyo |
  Remove-Item -Force
```

### Xóa build/cache/log nếu xuất hiện sau này

```powershell
Remove-Item -Recurse -Force dist, build, .vite, .cache, coverage, htmlcov, logs, tmp, temp -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Force -File -Include *.log, *.tmp, *.bak, *.backup, *.old |
  Remove-Item -Force
```

### Không chạy nếu chưa duyệt: xóa report/dry-run artifact

```powershell
# Chỉ chạy sau khi đã backup hoặc xác nhận không cần audit evidence
Remove-Item backend\reports\*dry-run* -Force
Remove-Item backend\reports\*.csv -Force
Remove-Item reports\*.csv -Force
```

### Không chạy nếu chưa duyệt: remove tracked secret khỏi Git index

Hiện `.env`, `backend/.env`, `ml-service/.env` chưa tracked, nên chưa cần. Nếu sau này phát hiện tracked:

```powershell
git rm --cached .env backend/.env ml-service/.env
```

## 17. Kết luận

Trạng thái cleanup đề xuất: `READY_FOR_USER_APPROVAL`.

Có thể cleanup ngay nhóm cache Python/pytest. Không nên xóa Node.js rollback backend, FastAPI backend, ml-service, source frontend, docs, reports chính, hoặc local env/model files. Các report CSV/JSON dry-run cần bạn duyệt riêng trước khi xóa hoặc trước khi push public.
