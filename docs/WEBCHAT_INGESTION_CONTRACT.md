# WebChat ingestion contract for customer sentiment

## Scope

The WebChat producer is outside this repository. Its product/service name,
delivery guarantees and deployment ownership are `NEEDS_EXTERNAL_CONFIRMATION`.
This document records only the contract verified from the SQL schema, current
data distribution and FastAPI repository queries.

## Persisted message contract

The external producer writes one message per row to
`dbo.WebChat_MessageLogs`.

| Meaning | SQL field | Verified contract |
| --- | --- | --- |
| Stable internal message key | `id_webchat_messageLogs` | Integer primary key; canonical sentiment idempotency key |
| External message identifier | `messageId` | Not unique in the current dataset; must not be used alone for idempotency |
| Direction | `FromHost` | `0` customer; `1` host-side sender; `NULL` is not eligible |
| Sender/receiver | `SenderId`, `ReceiverId` | Customer id is `SenderId` when `FromHost=0` |
| Content | `TextContent` | Contains the content for that row, regardless of sender direction |
| Host identity | `HostDisplayName` | Exact `AI Assistant` identifies current AI replies when `FromHost=1`; other host names are staff/other host-side messages |
| Timestamp | `SentAt` | Message creation/sent time |
| Channel | `Source` | WebChat channel/source |
| Conversation | `WebChat_Conversations.Id` | Resolved by the verified unique key `(CustomerId, Source)` |

`WebChat_MessageLogs` is the immutable message envelope. Topic and keyword
classification is persisted in `dbo.WebChat_MessageAnalytics`, keyed by
`messageId = WebChat_MessageLogs.id_webchat_messageLogs`. Producers must upsert
the following analytics fields instead of updating the message row:
`primaryTopicId`, `detectedTopics`, `detectedKeywords`, `topicConfidence`,
`topicSource`, `contextMessageId`, `contextDistance`, `classifierVersion`, and
`keywordAnalyzedAt`. During the compatibility rollout, legacy columns may still
exist on `WebChat_MessageLogs`, but they are not the canonical read source.
The supported SQL write contract is
`dbo.WebChat_UpsertMessageTopicAnalytics`; producers should call it only after
the message row has been persisted successfully.

There is no persisted `Role`, `SenderType` or `MessageType` column in
`WebChat_MessageLogs`. A dedicated system-message discriminator is therefore
`NEEDS_EXTERNAL_CONFIRMATION`; rows other than explicit `FromHost=0` fail
closed and are not sent to sentiment inference.

## Customer sentiment eligibility

A message is ready for customer sentiment analysis when all conditions hold:

1. `FromHost = 0`.
2. `TextContent` is non-null and non-blank.
3. `Source` and `SenderId` are real, non-placeholder values.
4. `id_webchat_messageLogs` is greater than the fixed
   `HF_ANALYSIS_CUTOVER_MESSAGE_ID`.
5. No canonical analytics row already exists for that internal message id.

An Assistant response is not required. Consecutive customer messages create
independent jobs. Assistant, staff, unknown-direction and blank rows never
create a customer-sentiment job.

## Discovery and idempotency

FastAPI polls `WebChat_MessageLogs` through
`SentimentRepository.discover_pending_jobs()`. The canonical contract is one
customer-sentiment row per internal `messageId` in
`WebChat_MessageAnalytics`. The existing unique index on
`WebChat_MessageAnalytics.messageId`, together with the transactional
`NOT EXISTS ... WITH (UPDLOCK, HOLDLOCK)` check, prevents duplicate scans from
creating a second job.

`analyzerVersion` records which model produced a completed result. The current
Dashboard schema intentionally stores one canonical result per customer
message rather than multiple parallel versions. A model-version re-analysis
must therefore be an explicit, audited update/requeue operation; it must not
insert a second canonical row.

## Updates, deletes and ingestion retries

- Updating message content after a completed analysis does not automatically
  invalidate or rerun sentiment. Producer edit semantics are
  `NEEDS_EXTERNAL_CONFIRMATION`.
- Deletion/cascade behavior is governed by the database foreign key; the
  external producer must not delete analyzed messages without an approved
  retention process. Producer deletion semantics are
  `NEEDS_EXTERNAL_CONFIRMATION`.
- Retrying ingestion against the same internal row is idempotent.
- Creating a second SQL row for the same external `messageId` is not guaranteed
  idempotent because the observed external identifier is not unique. The
  producer must preserve the original internal row or provide a stronger
  external deduplication contract (`NEEDS_EXTERNAL_CONFIRMATION`).

## Sender categories verified from current data

- Customer: `FromHost=0`.
- AI Assistant: `FromHost=1` and `HostDisplayName='AI Assistant'`.
- Staff/other host sender: `FromHost=1` with another display name.
- System: no dedicated schema field; `NEEDS_EXTERNAL_CONFIRMATION` and excluded
  unless it is explicitly a customer row, which the producer must prevent.

Only customer `TextContent` may populate customer sentiment. Assistant-response
quality, if introduced later, requires a separate metric and persistence
contract.
