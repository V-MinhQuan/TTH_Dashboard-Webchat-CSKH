'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../config/db');

// Helper to normalize Vietnamese text (lowercase, accent-stripped) for stable keyword matching
function normalizeText(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

// Word count helper
function getWordCount(s) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ─── KEYWORD GROUPS ──────────────────────────────────────────────────────────
const ISSUE_KEYWORDS = [
  'chua nhan mail', 'chua nhan email', 'chua nhan duoc mail', 'chua nhan duoc email',
  'khong thay ma qr', 'khong co ma qr', 'khong thay ma',
  'rot', 'rot excel', 'rot thuc hanh',
  'khong mo duoc', 'khong mo duoc file',
  'extract', 'giai nen',
  'khong goi duoc', 'khong nghe may', 'khong lien he duoc',
  'khong hop le', 'ko hop le',
  'khong kip', 'so khong kip',
  'mat cccd', 'mat the sinh vien',
  'bi loi', 'loi he thong', 'loi dang nhap'
];

const INFO_KEYWORDS = [
  'lich thi', 'ho so', 'le phi', 'hoc phi', 'con slot', 'khi nao', 'o dau'
];

const THANKS_KEYWORDS = [
  'cam on', 'cam on chi', 'cam on ad', 'cam on nhieu', 'cam on trung tam',
  'cam on co', 'cam on thay', 'cam on nha', 'ok roi', 'oke roi', 'em hieu roi'
];

const SHORT_ACKS = [
  'da', 'vang', 'ok', 'oke', 'v', 'a', 'da vang', 'vang a', 'da a', 'ok a', 'tin hoc co ban a'
];

// ─── CLASSIFICATION HELPERS ───────────────────────────────────────────────────
function isIssue(normalized) {
  return ISSUE_KEYWORDS.some(kw => normalized.includes(kw));
}

function isInfo(normalized) {
  return INFO_KEYWORDS.some(kw => normalized.includes(kw));
}

function isThanks(normalized) {
  return THANKS_KEYWORDS.some(kw => normalized.includes(kw));
}

function isShort(text, normalized) {
  const words = getWordCount(text);
  if (words <= 4) return true;
  return SHORT_ACKS.some(kw => normalized === kw || normalized === `${kw} ạ` || normalized === `${kw}.`);
}

function isLong(text) {
  return getWordCount(text) > 15;
}

// ─── SMART SUGGESTED LABEL ───────────────────────────────────────────────────
function getSuggestedLabel(text, normalized, currentLabel) {
  if (isThanks(normalized)) return 'positive';
  if (isIssue(normalized)) return 'negative';
  if (isInfo(normalized)) return 'neutral';
  return currentLabel;
}

// ─── SHUFFLE HELPER ──────────────────────────────────────────────────────────
// Seeded random shuffle for deterministic runs if needed (we'll just use normal Math.random)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─── CSV ESCAPING ────────────────────────────────────────────────────────────
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r/g, '').replace(/\n/g, ' '); // Clean newlines for excel readability
  if (str.includes(',') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function run() {
  console.log('Connecting to database...');
  const pool = await poolPromise;
  console.log('Connected. Querying WebChat analytics & logs...');

  const query = `
    SELECT
      a.id AS analyticsId,
      a.messageId,
      m.TextContent AS textContent,
      m.Source AS source,
      m.SentAt AS sentAt,
      a.sentimentLabel AS sentimentLabel,
      a.sentimentSource AS sentimentSource,
      a.analyzerVersion AS analyzerVersion,
      a.needStaffReview AS needStaffReview,
      a.detectedTopics AS detectedTopics
    FROM dbo.WebChat_MessageAnalytics a
    JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messagelogs
    WHERE m.TextContent IS NOT NULL
      AND LTRIM(RTRIM(m.TextContent)) <> ''
    ORDER BY m.SentAt DESC
  `;

  const result = await pool.request().query(query);
  const rows = result.recordset;
  console.log(`Fetched ${rows.length} rows from database.`);

  // Separate pools by current predicted sentiment class
  const positivePool = [];
  const neutralPool = [];
  const negativePool = [];

  for (const row of rows) {
    const text = row.textContent || '';
    const norm = normalizeText(text);

    // Grouping category matching flags for logging & balancing checks
    row.isIssueFlag = isIssue(norm) ? 1 : 0;
    row.isInfoFlag = isInfo(norm) ? 1 : 0;
    row.isThanksFlag = isThanks(norm) ? 1 : 0;
    row.isShortFlag = isShort(text, norm) ? 1 : 0;
    row.isLongFlag = isLong(text) ? 1 : 0;

    // Clean topics field
    let topicLabel = '';
    if (row.detectedTopics) {
      try {
        const parsed = JSON.parse(row.detectedTopics);
        if (Array.isArray(parsed)) {
          topicLabel = parsed.join(', ');
        } else {
          topicLabel = String(row.detectedTopics);
        }
      } catch (e) {
        topicLabel = String(row.detectedTopics);
      }
    }
    row.topicCleaned = topicLabel;

    // Suggested Label
    row.suggestedManualLabel = getSuggestedLabel(text, norm, row.sentimentLabel);

    if (row.sentimentLabel === 'positive') {
      positivePool.push(row);
    } else if (row.sentimentLabel === 'negative') {
      negativePool.push(row);
    } else {
      neutralPool.push(row);
    }
  }

  console.log(`Pools size -> Positive: ${positivePool.length}, Neutral: ${neutralPool.length}, Negative: ${negativePool.length}`);

  // Target counts
  const POSITIVE_TARGET = 150;
  const NEUTRAL_TARGET = 200;
  const NEGATIVE_TARGET = 150;

  // Sampling strategy: prioritize rows with keywords / special features to ensure coverage
  function sampleFromPool(pool, targetCount, labelName) {
    // Separate into "special" (matches any of the interesting criteria) and "regular"
    const special = [];
    const regular = [];

    for (const row of pool) {
      const isSpecial = row.isIssueFlag || row.isInfoFlag || row.isThanksFlag || row.isShortFlag || row.isLongFlag;
      if (isSpecial) {
        special.push(row);
      } else {
        regular.push(row);
      }
    }

    shuffle(special);
    shuffle(regular);

    const sampled = [];
    // Draw from special first
    while (sampled.length < targetCount && special.length > 0) {
      sampled.push(special.pop());
    }
    // Fill remaining with regular
    while (sampled.length < targetCount && regular.length > 0) {
      sampled.push(regular.pop());
    }

    console.log(`Sampled ${sampled.length} rows for class "${labelName}" (${sampled.filter(r => r.isIssueFlag).length} issues, ${sampled.filter(r => r.isInfoFlag).length} info, ${sampled.filter(r => r.isThanksFlag).length} thanks, ${sampled.filter(r => r.isShortFlag).length} short, ${sampled.filter(r => r.isLongFlag).length} long)`);
    return sampled;
  }

  const sampledPositives = sampleFromPool(positivePool, POSITIVE_TARGET, 'positive');
  const sampledNeutrals = sampleFromPool(neutralPool, NEUTRAL_TARGET, 'neutral');
  const sampledNegatives = sampleFromPool(negativePool, NEGATIVE_TARGET, 'negative');

  const finalSample = [...sampledPositives, ...sampledNeutrals, ...sampledNegatives];
  shuffle(finalSample); // Shuffle so classes are randomly mixed in the CSV

  console.log(`Total sample size: ${finalSample.length}`);

  // Write CSV content
  const headers = [
    'analyticsId',
    'messageId',
    'TextContent',
    'Source',
    'SentAt',
    'current sentimentLabel',
    'sentimentSource',
    'analyzerVersion',
    'needStaffReview',
    'suggestedManualLabel',
    'manualLabel',
    'reviewerNote',
    'issueFlag',
    'topic'
  ];

  let csvContent = headers.join(',') + '\n';
  for (const r of finalSample) {
    const rowValues = [
      r.analyticsId,
      r.messageId,
      escapeCSV(r.textContent),
      escapeCSV(r.source),
      r.sentAt ? r.sentAt.toISOString().replace('T', ' ').substring(0, 19) : '',
      r.sentimentLabel,
      r.sentimentSource || '',
      r.analyzerVersion || '',
      r.needStaffReview ? 'true' : 'false',
      r.suggestedManualLabel,
      '', // manualLabel (empty for reviewer)
      '', // reviewerNote (empty for reviewer)
      r.isIssueFlag,
      escapeCSV(r.topicCleaned)
    ];
    csvContent += rowValues.join(',') + '\n';
  }

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.resolve(reportsDir, 'sentiment_evaluation_template.csv');
  // Write with UTF-8 BOM so Excel opens it correctly with accents
  fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');

  console.log(`\nSuccess! Evaluation sample template created at:`);
  console.log(outputPath);

  // Group stats
  const stats = {
    total: finalSample.length,
    byLabel: { positive: 0, neutral: 0, negative: 0 },
    byGroup: { issue: 0, informational: 0, thanks: 0, short: 0, long: 0 },
    bySource: {}
  };

  for (const r of finalSample) {
    stats.byLabel[r.sentimentLabel]++;
    if (r.isIssueFlag) stats.byGroup.issue++;
    if (r.isInfoFlag) stats.byGroup.informational++;
    if (r.isThanksFlag) stats.byGroup.thanks++;
    if (r.isShortFlag) stats.byGroup.short++;
    if (r.isLongFlag) stats.byGroup.long++;
    const src = r.source || 'Unknown';
    stats.bySource[src] = (stats.bySource[src] || 0) + 1;
  }

  console.log('\n=== SAMPLE STATISTICS ===');
  console.log('Total samples:', stats.total);
  console.log('Labels distribution:', JSON.stringify(stats.byLabel, null, 2));
  console.log('Groups distribution:', JSON.stringify(stats.byGroup, null, 2));
  console.log('Sources distribution:', JSON.stringify(stats.bySource, null, 2));

  process.exit(0);
}

run().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
