# API Parity Report

Generated at: 2026-06-10T15:33:02
Node base URL: `http://localhost:5000`
FastAPI base URL: `http://localhost:8000`

This report is read-only. It does not run migrations, reprocess analytics, or write production data.

Summary verdict: all checked read endpoints returned HTTP 200 on both Node.js and FastAPI. Differences observed are additive FastAPI fields and are acceptable for frontend compatibility because FastAPI does not remove Node response keys.

| Endpoint | Node status | FastAPI status | Verdict | Notes |
| --- | ---: | ---: | --- | --- |
| `/api/dashboard/kpi` | 200 | 200 | ok | Status and top-level data keys match. |
| `/api/analytics/sentiment-summary` | 200 | 200 | ok | Status and top-level data keys match. |
| `/api/analytics/sentiment-trend` | 200 | 200 | ok | Status and top-level data keys match. |
| `/api/analytics/need-review-conversations` | 200 | 200 | ok | Status and top-level data keys match. |
| `/api/analytics/negative-conversations` | 200 | 200 | ok | Status and top-level data keys match. |
| `/api/analytics/need-review-keywords` | 200 | 200 | ok | Status and top-level data keys match. |
| `/api/analytics/negative-keywords` | 200 | 200 | ok | Status and top-level data keys match. |

## Details

### `/api/dashboard/kpi`

- Node error: ``
- FastAPI error: ``
- Node data keys: `averageResponseTimeMinutes, newCustomers, sourceSummary, statusSummary, totalConversations, trendData`
- FastAPI data keys: `aiFailedCount, averageResponseTimeMinutes, completedConversations, needStaffReviewCount, newCustomers, pendingConversations, sourceSummary, statusSummary, totalConversations, totalMessages, trendData`
- Missing in FastAPI: ``
- Important metrics: `{"totalConversations": {"node": 3437, "fastapi": 3437}, "totalMessages": {"node": null, "fastapi": 44552}, "needStaffReviewCount": {"node": null, "fastapi": 299}}`

### `/api/analytics/sentiment-summary`

- Node error: ``
- FastAPI error: ``
- Node data keys: `analyzerVersionDistribution, avgScores, summary`
- FastAPI data keys: `analyzerVersionDistribution, avgSatisfaction, avgScores, issueFlag, metadata, needStaffReview, negative, neutral, positive, summary, total`
- Missing in FastAPI: ``
- Important metrics: `{"total": {"node": null, "fastapi": 20183}, "summary.total": {"node": 20183, "fastapi": 20183}}`

### `/api/analytics/sentiment-trend`

- Node error: ``
- FastAPI error: ``
- Node data keys: `date, negative, neutral, positive`
- FastAPI data keys: `date, issueFlag, needStaffReview, negative, neutral, positive`
- Missing in FastAPI: ``
- Important metrics: `{}`

### `/api/analytics/need-review-conversations`

- Node error: ``
- FastAPI error: ``
- Node data keys: `pagination, records`
- FastAPI data keys: `metadata, pagination, records`
- Missing in FastAPI: ``
- Important metrics: `{"pagination.total": {"node": 299, "fastapi": 299}}`

### `/api/analytics/negative-conversations`

- Node error: ``
- FastAPI error: ``
- Node data keys: `pagination, records`
- FastAPI data keys: `metadata, pagination, records`
- Missing in FastAPI: ``
- Important metrics: `{"pagination.total": {"node": 299, "fastapi": 299}}`

### `/api/analytics/need-review-keywords`

- Node error: ``
- FastAPI error: ``
- Node data keys: `count, keyword`
- FastAPI data keys: `count, keyword`
- Missing in FastAPI: ``
- Important metrics: `{}`

### `/api/analytics/negative-keywords`

- Node error: ``
- FastAPI error: ``
- Node data keys: `count, keyword`
- FastAPI data keys: `count, keyword`
- Missing in FastAPI: ``
- Important metrics: `{}`
