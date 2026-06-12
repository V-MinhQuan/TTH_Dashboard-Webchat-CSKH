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

// Shuffling helper
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// CSV Escaping helper
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r/g, '').replace(/\n/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── KEYWORDS FOR STRATIFICATION ─────────────────────────────────────────────
const INFO_KEYWORDS = ['lich thi', 'ho so', 'le phi', 'hoc phi', 'con slot', 'khi nao', 'o dau', 'bao nhieu', 'co can', 'bao gio', 'gom gi', 'can gi', 'dung khong', 'duoc khong'];
const THANKS_KEYWORDS = ['cam on', 'cam on chi', 'cam on ad', 'cam on nhieu', 'cam on trung tam', 'cam on co', 'cam on thay', 'cam on nha', 'ok roi', 'oke roi', 'em hieu roi', 'tu van ro', 'ho tro tot', 'huu ich', 'tuyet voi'];
const SHORT_ACKS = ['da', 'vang', 'ok', 'oke', 'v', 'a', 'da vang', 'vang a', 'da a', 'ok a', 'tin hoc co ban a'];
const ISSUE_KEYWORDS = ['chua nhan mail', 'chua nhan email', 'khong thay ma qr', 'khong co ma qr', 'khong dang nhap duoc', 'khong mo duoc', 'extract', 'giai nen', 'khong goi duoc', 'khong nghe may', 'khong lien he duoc', 'khong hop le', 'ko hop le', 'khong kip', 'so khong kip', 'tre han', 'mat cccd', 'mat the sinh vien', 'rot', 'thi lai', 'chua co mail', 'chua co email', 'khong dang nhap', 'loi', 'bi loi', 'loi he thong', 'quen mat khau', 'quen pass', 'nop nham', 'chon nham'];

// ─── CATEGORIZATION FUNCTIONS ────────────────────────────────────────────────
function isHardCase(text, norm, words) {
  // 1. Long messages (words > 18)
  if (words > 18) return true;
  
  // 2. Very short messages (words > 0 and words <= 2)
  if (words > 0 && words <= 2) return true;

  // For word boundary checks, replace non-word chars with spaces and pad
  const padded = ' ' + norm.replace(/[\W_]+/g, ' ') + ' ';
  
  // 3. Mixed message (contains thanks/positive AND negative/issue markers as whole words)
  const hasPos = THANKS_KEYWORDS.some(kw => padded.includes(' ' + kw + ' '));
  const hasNeg = ['chua', 'khong', 'loi', 'mat', 'nham', 'rot', 'ko', 'kh'].some(kw => padded.includes(' ' + kw + ' '));
  if (hasPos && hasNeg) return true;

  // 4. Polite complaints / issues (polite markers + negative markers as whole words)
  const hasPolite = ['da', 'vui long', 'giup em', 'cho em hoi', 'nho trung tam'].some(kw => padded.includes(' ' + kw + ' '));
  if (hasPolite && hasNeg) return true;

  // 5. Typos / colloquial spellings (whole word match to avoid matching inner substrings of standard words)
  const hasTypos = ['ko', 'kh', 'e', 'c', 'tt', 'tbao', 'dki', 'đki', 'huhu', 'so ko kip', 'het slot'].some(kw => padded.includes(' ' + kw + ' '));
  if (hasTypos) return true;

  return false;
}

function isIssueCase(norm) {
  return ISSUE_KEYWORDS.some(kw => norm.includes(kw));
}

function isInfoCase(norm) {
  return INFO_KEYWORDS.some(kw => norm.includes(kw));
}

function isThanksCase(norm) {
  return THANKS_KEYWORDS.some(kw => norm.includes(kw));
}

function isShortCase(text, norm, words) {
  if (words > 0 && words <= 4) return true;
  return SHORT_ACKS.some(kw => norm === kw || norm === `${kw} ạ` || norm === `${kw}.`);
}

async function run() {
  console.log('Connecting to database...');
  const pool = await poolPromise;
  console.log('Connected. Querying candidate messages...');

  // Fetch candidate rows randomly
  const query = `
    SELECT TOP 4000
      a.id AS analyticsId,
      a.messageId,
      m.TextContent AS textContent,
      m.Source AS source,
      m.SentAt AS sentAt
    FROM dbo.WebChat_MessageAnalytics a
    JOIN dbo.WebChat_MessageLogs m ON a.messageId = m.id_webchat_messagelogs
    WHERE (m.FromHost = 0 OR m.FromHost IS NULL)
      AND m.TextContent IS NOT NULL
      AND LTRIM(RTRIM(m.TextContent)) <> ''
    ORDER BY NEWID()
  `;

  const result = await pool.request().query(query);
  const rows = result.recordset;
  console.log(`Fetched ${rows.length} random customer candidate rows.`);

  // Create pools
  const pools = {
    hard: [],
    issue: [],
    info: [],
    thanks: [],
    short: [],
    other: []
  };

  for (const r of rows) {
    const text = r.textContent || '';
    const norm = normalizeText(text);
    const words = getWordCount(text);

    if (isHardCase(text, norm, words)) {
      pools.hard.push(r);
    } else if (isIssueCase(norm)) {
      pools.issue.push(r);
    } else if (isThanksCase(norm)) {
      pools.thanks.push(r);
    } else if (isInfoCase(norm)) {
      pools.info.push(r);
    } else if (isShortCase(text, norm, words)) {
      pools.short.push(r);
    } else {
      pools.other.push(r);
    }
  }

  console.log(`Pool sizes:`);
  console.log(` - Hard Cases:   ${pools.hard.length}`);
  console.log(` - Support Issue: ${pools.issue.length}`);
  console.log(` - Info Questions: ${pools.info.length}`);
  console.log(` - Thanks/Positive: ${pools.thanks.length}`);
  console.log(` - Short Acks:    ${pools.short.length}`);
  console.log(` - Other general: ${pools.other.length}`);

  // Sample exactly 250 rows total
  const TARGET_TOTAL = 250;
  const groups = ['hard', 'issue', 'info', 'thanks', 'short'];
  const groupTargets = {
    hard: 50,
    issue: 50,
    info: 50,
    thanks: 50,
    short: 50
  };

  // Adjust targets if some pools are too small
  let remainingNeed = 0;
  groups.forEach(g => {
    if (pools[g].length < groupTargets[g]) {
      remainingNeed += (groupTargets[g] - pools[g].length);
      groupTargets[g] = pools[g].length;
    }
  });

  // Distribute remaining need to larger pools
  if (remainingNeed > 0) {
    const overflowCandidates = groups.filter(g => pools[g].length > groupTargets[g]);
    if (overflowCandidates.length > 0) {
      let extraPerGroup = Math.floor(remainingNeed / overflowCandidates.length);
      let remainder = remainingNeed % overflowCandidates.length;
      overflowCandidates.forEach((g, idx) => {
        const extra = extraPerGroup + (idx < remainder ? 1 : 0);
        const maxExtra = pools[g].length - groupTargets[g];
        const added = Math.min(extra, maxExtra);
        groupTargets[g] += added;
        remainingNeed -= added;
      });
    }
    
    // If we still need more and have "other", draw from other
    if (remainingNeed > 0 && pools.other.length > 0) {
      groupTargets.other = Math.min(remainingNeed, pools.other.length);
    }
  }

  console.log(`Final Sampling Targets:`, groupTargets);

  const sampledRows = [];
  Object.keys(groupTargets).forEach(g => {
    shuffle(pools[g]);
    const count = groupTargets[g];
    for (let i = 0; i < count; i++) {
      const row = pools[g].pop();
      row.samplingGroup = g;
      sampledRows.push(row);
    }
  });

  // Shuffle the final set so classes are randomly mixed
  shuffle(sampledRows);

  console.log(`Sampled total ${sampledRows.length} rows.`);

  // Write CSV content
  const headers = ['sampleId', 'analyticsId', 'messageId', 'TextContent', 'Source', 'SentAt', 'manualLabel', 'reviewerNote'];
  let csvContent = headers.join(',') + '\n';
  
  sampledRows.forEach((r, idx) => {
    const sentAtStr = r.sentAt ? new Date(r.sentAt).toISOString().replace('T', ' ').substring(0, 19) : '';
    const rowValues = [
      idx + 1,
      r.analyticsId,
      r.messageId,
      escapeCSV(r.textContent),
      escapeCSV(r.source),
      sentAtStr,
      '', // manualLabel (empty)
      ''  // reviewerNote (empty)
    ];
    csvContent += rowValues.join(',') + '\n';
  });

  const reportsDir = path.resolve(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.resolve(reportsDir, 'sentiment_blind_test_template.csv');
  fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');

  console.log(`\nSuccess! Blind test template created at:`);
  console.log(outputPath);

  // Group stats
  const stats = {
    total: sampledRows.length,
    bySamplingGroup: {},
    bySource: {}
  };

  sampledRows.forEach(r => {
    stats.bySamplingGroup[r.samplingGroup] = (stats.bySamplingGroup[r.samplingGroup] || 0) + 1;
    const src = r.source || 'Unknown';
    stats.bySource[src] = (stats.bySource[src] || 0) + 1;
  });

  console.log('\n=== BLIND TEST STATISTICS ===');
  console.log('Sampling groups:', stats.bySamplingGroup);
  console.log('Sources:', stats.bySource);

  process.exit(0);
}

run().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
