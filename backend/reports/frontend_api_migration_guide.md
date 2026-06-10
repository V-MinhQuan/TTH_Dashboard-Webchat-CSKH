# Frontend API Migration Guide - FastAPI Parallel Run

Target switch after parity validation:

```env
VITE_API_URL=http://localhost:8000/api
```

The current frontend uses `VITE_API_URL`, not `VITE_API_BASE_URL`, in `src/app/services/analyticsApi.ts`.

| Frontend function/file | Old Node API | New FastAPI API | Response differences | Status |
| --- | --- | --- | --- | --- |
| `fetchDashboardKpi` in `src/app/services/analyticsApi.ts` | `GET /api/dashboard/kpi` | same | Envelope remains `{ success, message, data }`; FastAPI data adds `totalMessages`, `needStaffReviewCount`, `pendingConversations`, `completedConversations`, `aiFailedCount` while preserving legacy KPI fields. | implemented/tested |
| `fetchSentimentSummary` | `GET /api/analytics/sentiment-summary` | same | Preserves `summary`, `avgScores`, `analyzerVersionDistribution`; FastAPI also returns flat counts and `metadata.issueMetadataAvailable`. | implemented/tested |
| `fetchSentimentTrend` | `GET /api/analytics/sentiment-trend` | same | Preserves daily `positive/neutral/negative`; FastAPI also returns `issueFlag` and `needStaffReview`. | implemented/tested |
| `fetchSatisfactionSummary` | `GET /api/analytics/satisfaction-summary` | same | Shape preserved. | implemented/tested |
| `fetchSatisfactionTrend` | `GET /api/analytics/satisfaction-trend` | same | Shape preserved. | implemented/tested |
| `fetchTopicSummary` | `GET /api/analytics/topics` | same | Shape preserved. Topic labels are best-effort in FastAPI. | implemented/tested |
| `fetchNegativeKeywords` | `GET /api/analytics/negative-keywords` | same | Shape preserved. Supports `mode=negative|needReview|issue`. | implemented/tested |
| `fetchNeedReviewKeywords` | `GET /api/analytics/need-review-keywords` | same | Shape preserved. Default mode is `needReview`. | implemented/tested |
| `fetchNegativeConversations` | `GET /api/analytics/negative-conversations` | same | Legacy endpoint retained. FastAPI adds `data.metadata.legacy=true` and `canonicalEndpoint`. | implemented/tested |
| `fetchNeedReviewConversations` | `GET /api/analytics/need-review-conversations` | same | Shape preserved with additional `metadata.issueMetadataAvailable`. | implemented/tested |
| `runAnalytics` | `POST /api/analytics/run` | same path, FastAPI returns `501` | Deliberately not migrated to avoid unapproved DB reprocess/write. Keep using Node rollback for this admin action until approved. | pending |

Frontend migration steps:

1. Run Node.js backend on port `5000` as rollback.
2. Run FastAPI backend on port `8000`.
3. Run `python backend/scripts/api_parity_check.py` from repo root or `python scripts/api_parity_check.py` from `backend/`.
4. Switch local frontend env to `VITE_API_URL=http://localhost:8000/api`.
5. Validate Overview, Sentiment Analysis, Urgent/Need Review flows, and keyword panels.
6. Keep Node.js available until API parity and UI smoke tests pass.

Known frontend impact:

- No code change is required for the current `analyticsApi.ts` read endpoints if `VITE_API_URL` is updated.
- Any button that calls `runAnalytics()` should remain pointed at Node.js or be hidden/disabled during FastAPI parallel run because FastAPI intentionally refuses that write flow.

