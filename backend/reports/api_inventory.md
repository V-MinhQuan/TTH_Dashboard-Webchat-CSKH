# API Inventory - Node to FastAPI Migration

Scope: controlled migration inside `backend/`; Node.js remains the rollback backend. Inventory was built from `backend/server.js`, `backend/routes/*.js`, controllers/services/repositories, and `src/app/services/analyticsApi.ts`.

| Endpoint | Method | Query params | Request body | Current response shape | Current Node handler | Frontend uses it | FastAPI replacement | Migration status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/health` | GET | none | none | `{ message, timestamp, status }` | `backend/routes/dashboard.routes.js` | No direct usage found | `/api/health` | implemented/tested |
| `/api/health/ml` | GET | none | none | ML runtime status object | `backend/routes/dashboard.routes.js` -> `analyticsController.getMlHealth` | Not in `analyticsApi.ts`; dashboard/manual health can use it | `/api/health/ml` | implemented/tested |
| `/api/test-db` | GET | none | none | `{ success, message, result }` | `backend/routes/dashboard.routes.js` | No direct usage found | Not migrated; use `/api/health.details.database` | pending |
| `/api/dashboard/kpi` | GET | `startDate`, `endDate`; FastAPI also accepts `dateRange`, `fromDate`, `toDate`, `channel`, `topic`, `conversationStatus`, `aiStatus` | none | `{ success, message, data }` where data includes KPI fields | `backend/controllers/dashboard.controller.js` -> `dashboard.service.js` -> `conversation.repository.js` | Yes, `src/app/services/analyticsApi.ts` | `/api/dashboard/kpi` | implemented/tested |
| `/api/analytics/run` | POST | none | `{ limit, startDate, endDate, forceReanalyze, force, mode }` | `{ success, message, data }` after DB write/reprocess | `backend/controllers/analytics.controller.js` -> `analytics.service.js` | Yes, `runAnalytics()` | FastAPI returns controlled `501` | pending; write flow intentionally not migrated |
| `/api/analytics/sentiment-summary` | GET | `startDate`, `endDate`, `source`, `sentiment`, `topic`; FastAPI also accepts `dateRange`, `fromDate`, `toDate`, `channel`, `issueType`, `sentimentLabel` | none | `{ success, message, data: { summary, avgScores, analyzerVersionDistribution } }` | `analytics.controller.js` -> `analytics.service.js` -> `analytics.repository.js` | Yes | `/api/analytics/sentiment-summary` | implemented/tested |
| `/api/analytics/sentiment-trend` | GET | same read filters | none | `{ success, message, data: [] }` | same analytics chain | Yes | `/api/analytics/sentiment-trend` | implemented/tested |
| `/api/analytics/satisfaction-summary` | GET | same read filters | none | `{ success, message, data }` | same analytics chain | Yes | `/api/analytics/satisfaction-summary` | implemented/tested |
| `/api/analytics/satisfaction-trend` | GET | same read filters | none | `{ success, message, data: [] }` | same analytics chain | Yes | `/api/analytics/satisfaction-trend` | implemented/tested |
| `/api/analytics/topics` | GET | same read filters | none | `{ success, message, data: [] }` | same analytics chain | Yes | `/api/analytics/topics` | implemented/tested |
| `/api/analytics/need-review-conversations` | GET | `page`, `pageSize`, `startDate`, `endDate`, `source`, `topic`; FastAPI also accepts `dateRange`, `fromDate`, `toDate`, `channel`, `search`, `issueType`, `sentimentLabel` | none | `{ success, message, data: { records, pagination } }` | `analytics.controller.js` -> `analytics.service.js` -> `analytics.repository.js` | Yes | `/api/analytics/need-review-conversations` | implemented/tested |
| `/api/analytics/negative-conversations` | GET | same as need-review | none | Legacy endpoint with `meta.canonicalEndpoint` | same as need-review | Yes | `/api/analytics/negative-conversations` | implemented/tested; legacy retained |
| `/api/analytics/need-review-keywords` | GET | `mode=needReview|negative|issue` plus read filters | none | `{ success, message, data: [{ keyword, count }] }` | `analytics.controller.js` -> `analytics.service.js` | Yes | `/api/analytics/need-review-keywords` | implemented/tested |
| `/api/analytics/negative-keywords` | GET | `mode=negative|needReview|issue` plus read filters | none | `{ success, message, data: [{ keyword, count }] }` | `analytics.controller.js` -> `analytics.service.js` | Yes | `/api/analytics/negative-keywords` | implemented/tested |
| `/api/sentiment/predict` | POST | none | `{ text }` or Node also accepts first `texts[]` item | normalized sentiment + issue metadata | `backend/routes/dashboard.routes.js` -> `analyticsController.predictSentiment` -> `ai-sentiment.service.js` | Not in `analyticsApi.ts`; useful for dashboard/manual test | `/api/sentiment/predict` | implemented/tested |
| `/api/conversations` | GET | FastAPI: `page`, `pageSize`, date filters, `channel/source`, `search` | none | No Express route currently mounted | `conversation.repository.js` exists but no route found | No direct usage found | `/api/conversations` | implemented/tested minimally |
| `/api/conversations/:id` | GET | none | none | No Express route currently mounted | no current route found | No direct usage found | `/api/conversations/{conversation_id}` | implemented minimally |
| `/api/conversations/by-message/:messageId` | GET | none | none | No Express route currently mounted | no current route found | No direct usage found | `/api/conversations/by-message/{message_id}` | implemented minimally |

Notes:

- FastAPI dashboard/analytics endpoints keep the frontend-compatible envelope `{ success, message, data }`.
- Need-review logic in FastAPI is `needStaffReview = 1 OR issueFlag = 1 OR sentimentLabel = 'negative'`; if `issueFlag` is unavailable, it falls back to `needStaffReview = 1 OR sentimentLabel = 'negative'`.
- `POST /api/analytics/run` is intentionally not migrated because it can write/reprocess analytics data.

