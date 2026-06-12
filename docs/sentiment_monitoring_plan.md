# Sentiment + Issue Detection Monitoring Plan

## Scope

This plan monitors the FLIC WebChat sentiment pipeline after the Independent
Issue Detection layer. The module remains `PASS_WITH_MONITORING`: it supports
dashboard visualization and the staff-review queue, but it must not make
automatic business decisions without human review.

## Concepts

- `sentimentLabel`: one of `positive`, `neutral`, `negative`.
- `issueFlag`: independent issue detector output.
- `needStaffReview`: operational queue flag.
- A message can be `sentimentLabel = neutral`, `issueFlag = true`, and
  `needStaffReview = true`.

## Runtime Rule

ViSoBERT has been integrated at the experimental level but has not been
confirmed as the production runtime. The current runtime is
`ensemble-phobert-rule-v1` unless `/health` confirms `visobertAvailable=true`
and `actualAnalyzerVersion=ensemble-phobert-visobert-v1`.

## Weekly Metrics

Track these every week:

- Neutral messages that should have been reviewed but were missed.
- Issue false positives on informational questions.
- New typo/slang variants not covered by rules.
- Context-required cases that cannot be decided from one message.
- Top `issueType` by week.
- `needStaffReview` rate by week.
- Short acknowledgement errors.
- Informational questions incorrectly marked as issue or negative.

## SQL Checks

```sql
-- Need review rate by week
SELECT
  DATEPART(year, messageAt) AS yearNum,
  DATEPART(iso_week, messageAt) AS weekNum,
  COUNT(*) AS totalMessages,
  SUM(CASE WHEN needStaffReview = 1 THEN 1 ELSE 0 END) AS needReviewTotal,
  CAST(SUM(CASE WHEN needStaffReview = 1 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0) AS needReviewRate
FROM dbo.WebChat_MessageAnalytics
GROUP BY DATEPART(year, messageAt), DATEPART(iso_week, messageAt)
ORDER BY yearNum DESC, weekNum DESC;

-- Negative sentiment that is not in the staff-review queue
SELECT COUNT(*) AS negativeNotReviewed
FROM dbo.WebChat_MessageAnalytics
WHERE sentimentLabel = 'negative'
  AND ISNULL(needStaffReview, 0) = 0;

-- Informational questions incorrectly marked negative
SELECT TOP 100 a.id, a.messageId, a.sentimentLabel, a.needStaffReview, m.TextContent
FROM dbo.WebChat_MessageAnalytics a
JOIN dbo.WebChat_MessageLogs m
  ON CONVERT(NVARCHAR(100), a.messageId) = CONVERT(NVARCHAR(100), m.id_webchat_messagelogs)
WHERE a.sentimentLabel = 'negative'
  AND (
    m.TextContent LIKE N'%lịch thi%'
    OR m.TextContent LIKE N'%hồ sơ%'
    OR m.TextContent LIKE N'%lệ phí%'
    OR m.TextContent LIKE N'%bao nhiêu%'
    OR m.TextContent LIKE N'%có cần%'
  )
  AND NOT (
    m.TextContent LIKE N'%chưa nhận%'
    OR m.TextContent LIKE N'%không thấy%'
    OR m.TextContent LIKE N'%không mở được%'
    OR m.TextContent LIKE N'%không hợp lệ%'
    OR m.TextContent LIKE N'%rớt%'
    OR m.TextContent LIKE N'%lỗi%'
  );

-- Short acknowledgement errors
SELECT TOP 100 a.id, a.messageId, a.sentimentLabel, a.needStaffReview, m.TextContent
FROM dbo.WebChat_MessageAnalytics a
JOIN dbo.WebChat_MessageLogs m
  ON CONVERT(NVARCHAR(100), a.messageId) = CONVERT(NVARCHAR(100), m.id_webchat_messagelogs)
WHERE (a.sentimentLabel IN ('positive', 'negative') OR ISNULL(a.needStaffReview, 0) = 1)
  AND LTRIM(RTRIM(LOWER(m.TextContent))) IN (
    N'dạ', N'vâng', N'ok', N'ok ạ', N'dạ chị', N'dạ vâng', N'vâng ạ', N'ạ'
  );
```

When the issue metadata migration is applied, also track:

```sql
SELECT issueType, COUNT(*) AS total
FROM dbo.WebChat_MessageAnalytics
WHERE issueFlag = 1 OR issueType IS NOT NULL
GROUP BY issueType
ORDER BY total DESC;
```

## API Checks

- `GET /health` on ml-service.
- `GET /api/analytics/sentiment-summary`.
- `GET /api/analytics/need-review-conversations`.
- `GET /api/analytics/negative-conversations` as legacy compatibility only.
- `GET /api/analytics/need-review-keywords`.
- `GET /api/dashboard/kpi`.

## Frequency

- Daily during the first week after deployment.
- Weekly after the dashboard queue stabilizes.
- Immediately after any rule update, model update, or reprocess.

## Owner

- Primary: AI/Backend engineer responsible for the sentiment pipeline.
- Review partner: CSKH operations owner who can confirm true issue cases.

## Rule Update Criteria

Update `IssueDetector` rules only when at least one condition is met:

- Three or more missed issue cases share the same new typo/slang pattern.
- Any high-impact support issue is missed more than once.
- Informational false positives exceed 2% of reviewed samples.
- Short acknowledgement errors appear in production monitoring.
- CSKH confirms a new issue type that should enter the staff-review queue.

Always add or update tests before changing issue rules.
