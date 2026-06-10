# Sentiment + Issue Detection API Contract

## Core Concepts

- `sentimentLabel` has exactly three values: `positive`, `neutral`, `negative`.
- `issueFlag` is produced by the Independent Issue Detection layer.
- `needStaffReview` is an operational queue flag, not a sentiment label.
- A message can be `sentimentLabel = neutral`, `issueFlag = true`, and
  `needStaffReview = true`.

## ML Service Endpoint Contract

For dashboard workflows that need issue metadata, call:

```http
POST /predict-ensemble
```

`/predict-ensemble` returns:

- `final.label`
- `final.confidence`
- `final.needStaffReview`
- `issue.issueFlag`
- `issue.issueType`
- `issue.issueReason`
- `issue.issueConfidence`
- `actualAnalyzerVersion`

The legacy `POST /predict` endpoint may remain unchanged for backward
compatibility. Do not use it for dashboard workflows that need issue metadata.

## ViSoBERT Runtime Status

ViSoBERT has been integrated at the experimental level but has not been
confirmed as the production runtime. The current runtime is
`ensemble-phobert-rule-v1` unless `/health` confirms:

- `visobertAvailable = true`
- `actualAnalyzerVersion = ensemble-phobert-visobert-v1`

## Backend Analytics Endpoints

### Canonical Staff Review Queue

```http
GET /api/analytics/need-review-conversations
```

Returns conversations matching:

```sql
needStaffReview = 1
OR issueFlag = 1
OR sentimentLabel = 'negative'
```

`GET /api/analytics/negative-conversations` is retained as a legacy alias.

### Keywords

```http
GET /api/analytics/negative-keywords?mode=negative
GET /api/analytics/negative-keywords?mode=needReview
GET /api/analytics/negative-keywords?mode=issue
GET /api/analytics/need-review-keywords
```

Modes:

- `negative`: only `sentimentLabel = 'negative'`.
- `needReview`: `needStaffReview = 1 OR issueFlag = 1 OR sentimentLabel = 'negative'`.
- `issue`: `issueFlag = 1 OR issueType IS NOT NULL`.

When issue metadata columns are not present yet, issue-specific fields are
returned as `null` or issue-only mode returns an empty result instead of
throwing.

## DB Migration

Prepared migration:

```text
backend/db/migrations/add_issue_metadata_to_message_analytics.sql
```

Do not reprocess production DB until this migration is approved and applied.
