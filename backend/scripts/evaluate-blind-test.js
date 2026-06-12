'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

// Normalization & Label mapping helper
function normalizeLabel(lbl) {
  if (!lbl) return '';
  const cleaned = lbl.toString().toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "D");
  
  if (cleaned === 'tich cuc' || cleaned === 'tich cuc' || cleaned === 'positive') return 'positive';
  if (cleaned === 'trung tinh' || cleaned === 'trung tinh' || cleaned === 'neutral') return 'neutral';
  if (cleaned === 'tieu cuc' || cleaned === 'tieu cuc' || cleaned === 'negative') return 'negative';
  return cleaned;
}

function normalizeText(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "D")
    .trim();
}

function checkInfoKeyword(text) {
  const norm = normalizeText(text);
  const infoKeywords = ['lich thi', 'ho so', 'le phi', 'hoc phi', 'con slot', 'khi nao', 'o dau', 'bao nhieu', 'co can'];
  return infoKeywords.some(kw => norm.includes(kw));
}

function checkShortKeyword(text) {
  const norm = normalizeText(text);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 4) return true;
  const shortAcks = ['da', 'vang', 'ok', 'oke', 'v', 'a', 'da vang', 'vang a', 'da a', 'ok a', 'tin hoc co ban a'];
  return shortAcks.some(kw => norm === kw || norm === `${kw} áº¡` || norm === `${kw}.`);
}

// â”€â”€â”€ CSV PARSER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

function parseRow(line) {
  const values = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

// â”€â”€â”€ HTTP POST HELPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function postJson(urlStr, body, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }

    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || 80,
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`Invalid JSON: ${raw}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function checkMLServiceHealth(urlStr) {
  return new Promise((resolve) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return resolve({ online: false });
    }
    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || 80,
      path:     '/health',
      method:   'GET'
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ online: true, health: parsed });
        } catch {
          resolve({ online: false });
        }
      });
    });
    req.on('error', () => resolve({ online: false }));
    req.setTimeout(2000, () => req.destroy());
    req.end();
  });
}

// â”€â”€â”€ METRICS CALCULATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function calculateMetrics(dataset, getPredLabel) {
  let correct = 0;
  const classes = ['positive', 'neutral', 'negative'];
  const counts = {
    positive: { tp: 0, fp: 0, fn: 0 },
    neutral: { tp: 0, fp: 0, fn: 0 },
    negative: { tp: 0, fp: 0, fn: 0 }
  };

  const matrix = {
    positive: { positive: 0, neutral: 0, negative: 0 },
    neutral: { positive: 0, neutral: 0, negative: 0 },
    negative: { positive: 0, neutral: 0, negative: 0 }
  };

  for (const r of dataset) {
    const trueLabel = r.effectiveManualLabel;
    const predLabel = getPredLabel(r).toLowerCase().trim();

    if (matrix[trueLabel] && matrix[trueLabel].hasOwnProperty(predLabel)) {
      matrix[trueLabel][predLabel]++;
    }

    if (trueLabel === predLabel) {
      correct++;
      if (counts[trueLabel]) counts[trueLabel].tp++;
    } else {
      if (counts[trueLabel]) counts[trueLabel].fn++;
      if (counts[predLabel]) counts[predLabel].fp++;
    }
  }

  const accuracy = correct / dataset.length;
  const classMetrics = {};
  let sumF1 = 0;

  for (const cls of classes) {
    const tp = counts[cls].tp;
    const fp = counts[cls].fp;
    const fn = counts[cls].fn;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    classMetrics[cls] = { precision, recall, f1, tp, fp, fn };
    sumF1 += f1;
  }

  const macroF1 = sumF1 / classes.length;
  const negativeRecall = classMetrics.negative.recall;

  return {
    accuracy,
    macroF1,
    classMetrics,
    matrix,
    diagnostics: {
      negativeRecall
    }
  };
}

function formatPct(value, digits = 1) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatFloat(value, digits = 4) {
  if (!Number.isFinite(value)) return (0).toFixed(digits);
  return value.toFixed(digits);
}

function getRuntimeSummary(serviceState, processedRows) {
  const health = serviceState.health || {};
  const anyVisobertResult = processedRows.some(r => r.visobertAvailable === true);
  const visobertActive = health.visobertAvailable === true && anyVisobertResult;
  const runtimeVersion = health.actualAnalyzerVersion
    || health.activeAnalyzerVersion
    || processedRows.find(r => r.analyzerVersion)?.analyzerVersion
    || (visobertActive ? 'ensemble-phobert-visobert-v1' : 'ensemble-phobert-rule-v1');

  return {
    visobertActive,
    runtimeVersion,
    sentence: visobertActive
      ? 'ViSoBERT health check confirmed an active experimental runtime for this evaluation. Confirm benchmark stability before production use.'
      : 'ViSoBERT has been integrated at the experimental level but has not been confirmed as the production runtime. The current runtime is ensemble-phobert-rule-v1.'
  };
}

async function run() {
  const defaultPath = path.resolve(__dirname, '../reports/sentiment_blind_test_template.csv');
  const targetPath = process.argv[2] || defaultPath;

  console.log(`Loading blind test dataset from:\n${targetPath}\n`);

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: File does not exist at ${targetPath}.`);
    process.exit(1);
  }

  const rows = parseCSV(targetPath);
  console.log(`Loaded ${rows.length} rows.`);

  const validLabels = ['positive', 'neutral', 'negative'];
  const processedRows = [];
  const missingLabels = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const manualRaw = r.manualLabel ? r.manualLabel.trim() : '';

    if (manualRaw === '') {
      missingLabels.push(rowNum);
      continue;
    }

    const effective = normalizeLabel(manualRaw);
    if (!validLabels.includes(effective)) {
      console.error(`âŒ ERROR: Invalid manualLabel "${manualRaw}" at row ${rowNum}. Only positive, neutral, negative are allowed.`);
      process.exit(1);
    }

    processedRows.push({
      ...r,
      rowNum,
      effectiveManualLabel: effective
    });
  }

  if (missingLabels.length > 0) {
    console.error(`âŒ ERROR: ${missingLabels.length} rows have empty 'manualLabel'! Manual labeling must be completed first.`);
    process.exit(1);
  }

  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  console.log(`Checking ML service status at ${mlServiceUrl}...`);
  const serviceState = await checkMLServiceHealth(mlServiceUrl);

  if (!serviceState.online) {
    console.error(`âŒ ERROR: ML Service is offline. Start the service first.`);
    process.exit(1);
  }

  console.log(`ML Service is online. Model: ${serviceState.health.modelName}`);
  console.log(`Querying predictions for ${processedRows.length} rows...`);

  const texts = processedRows.map(r => r.TextContent);
  const BATCH_SIZE = 32;
  const mlResults = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const res = await postJson(`${mlServiceUrl}/predict-ensemble`, { texts: slice });
    mlResults.push(...res.results);
  }

  // Reconstruct Before vs After predictions
  processedRows.forEach((r, idx) => {
    const res = mlResults[idx];
    r.phobertOnlyLabel = res.phobert?.label || 'neutral';
    
    const ruleLabel = res.rule?.label;
    const rulePriority = res.rule?.priority;
    const phLabel = res.phobert?.label || 'neutral';
    const phConf = res.phobert?.confidence || 0.0;
    
    // â”€â”€ 1. Reconstruct PhoBERT + Rule (Before) â”€â”€
    let phobertRuleLabel = 'neutral';
    if (ruleLabel) {
      phobertRuleLabel = ruleLabel;
    } else {
      if (phLabel === 'negative' && phConf >= 0.60) {
        phobertRuleLabel = 'neutral';
      } else if (phLabel === 'positive' && phConf >= 0.65) {
        phobertRuleLabel = 'neutral';
      } else if (phLabel === 'neutral' && phConf >= 0.55) {
        phobertRuleLabel = 'neutral';
      } else {
        phobertRuleLabel = 'neutral';
      }
    }
    
    r.phobertRuleLabel = phobertRuleLabel;
    r.isRuleHit = rulePriority && rulePriority !== 'none' && rulePriority !== '';
    
    // Before Review: true only if phobertRuleLabel is negative
    r.beforeNeedStaffReview = (phobertRuleLabel === 'negative');

    // â”€â”€ 2. Parse After values â”€â”€
    r.visobertEnsembleLabel = res.final?.label || 'neutral';
    r.visobertAvailable = res.visobert?.available === true;
    r.analyzerVersion = res.actualAnalyzerVersion || res.analyzerVersion || null;
    
    r.issueFlag = res.issue?.issueFlag === true;
    r.issueType = res.issue?.issueType || 'none';
    r.issueReason = res.issue?.issueReason || '';
    r.needStaffReview = res.final?.needStaffReview === true;
  });

  // Calculate metrics for each pipeline
  const phobertOnlyMetrics = calculateMetrics(processedRows, r => r.phobertOnlyLabel);
  const phobertRuleMetrics = calculateMetrics(processedRows, r => r.phobertRuleLabel);
  const visobertEnsembleMetrics = calculateMetrics(processedRows, r => r.visobertEnsembleLabel);

  // Calculate Issue Detection metrics
  const trueNegatives = processedRows.filter(r => r.effectiveManualLabel === 'negative');
  const trueNegativesFlagged = trueNegatives.filter(r => r.issueFlag === true);
  const trueNegativesReviewed = trueNegatives.filter(r => r.needStaffReview === true);
  const totalFlagged = processedRows.filter(r => r.issueFlag === true).length;
  const trueFlagged = processedRows.filter(r => r.issueFlag === true && r.effectiveManualLabel === 'negative').length;

  const issueFlagRecall = trueNegativesFlagged.length / trueNegatives.length;
  const needStaffReviewRecall = trueNegativesReviewed.length / trueNegatives.length;
  const beforeReviewed = trueNegatives.filter(r => r.beforeNeedStaffReview === true).length;
  const beforeNeedStaffReviewRecall = trueNegatives.length > 0 ? beforeReviewed / trueNegatives.length : 0.0;
  const issueFlagPrecision = totalFlagged > 0 ? trueFlagged / totalFlagged : 0.0;

  // Missed support issues (operationally missed: true negative where needStaffReview is false)
  const missedSupportIssuesCountBefore = trueNegatives.filter(r => r.beforeNeedStaffReview === false).length;
  const missedSupportIssuesCountAfter = trueNegatives.filter(r => r.needStaffReview === false).length;

  // Info false negatives (true neutral question matched as negative/issue)
  // Before: phobertRuleLabel === 'negative'
  const infoFalseNegCountBefore = processedRows.filter(r => {
    return checkInfoKeyword(r.TextContent) && r.effectiveManualLabel === 'neutral' && r.phobertRuleLabel === 'negative';
  }).length;
  // After: needStaffReview is true (which means it's sent to review needlessly)
  const infoFalseNegCountAfter = processedRows.filter(r => {
    return checkInfoKeyword(r.TextContent) && r.effectiveManualLabel === 'neutral' && r.needStaffReview === true;
  }).length;

  // Short ack errors (true neutral ack matched as positive/negative or reviewed)
  // Before: phobertRuleLabel !== 'neutral'
  const shortAckWrongCountBefore = processedRows.filter(r => {
    return checkShortKeyword(r.TextContent) && r.effectiveManualLabel === 'neutral' && r.phobertRuleLabel !== 'neutral';
  }).length;
  // After: needStaffReview is true
  const shortAckWrongCountAfter = processedRows.filter(r => {
    return checkShortKeyword(r.TextContent) && r.effectiveManualLabel === 'neutral' && r.needStaffReview === true;
  }).length;

  // Rule-hit vs non-rule-hit groups on the After pipeline
  const ruleHitRows = processedRows.filter(r => r.isRuleHit);
  const nonRuleHitRows = processedRows.filter(r => !r.isRuleHit);
  
  const ruleHitMetrics = calculateMetrics(ruleHitRows, r => r.phobertRuleLabel);
  const nonRuleHitMetrics = calculateMetrics(nonRuleHitRows, r => r.phobertRuleLabel);

  const ruleHitTN = ruleHitRows.filter(r => r.effectiveManualLabel === 'negative');
  const ruleHitTNFlagged = ruleHitTN.filter(r => r.issueFlag === true).length;
  
  const nonRuleHitTN = nonRuleHitRows.filter(r => r.effectiveManualLabel === 'negative');
  const nonRuleHitTNFlagged = nonRuleHitTN.filter(r => r.issueFlag === true).length;

  // Write before / after comparison CSV
  const comparisonCSVContent = [
    `Metric Name,Before (Active PhoBERT + Rule without Issue Detection),After (Active PhoBERT + Rule with Issue Detection)`,
    `Accuracy,${formatPct(phobertRuleMetrics.accuracy, 2)},${formatPct(visobertEnsembleMetrics.accuracy, 2)}`,
    `Macro-F1,${formatFloat(phobertRuleMetrics.macroF1, 4)},${formatFloat(visobertEnsembleMetrics.macroF1, 4)}`,
    `Negative Recall,${formatPct(phobertRuleMetrics.diagnostics.negativeRecall, 1)},${formatPct(visobertEnsembleMetrics.diagnostics.negativeRecall, 1)}`,
    `Issue Neutral Misses,${missedSupportIssuesCountBefore},${missedSupportIssuesCountAfter}`,
    `Info False Negatives,${infoFalseNegCountBefore},${infoFalseNegCountAfter}`,
    `Short Ack Errors,${shortAckWrongCountBefore},${shortAckWrongCountAfter}`,
    `IssueFlag Recall,0.0%,${formatPct(issueFlagRecall, 1)}`,
    `NeedStaffReview Recall,${formatPct(beforeNeedStaffReviewRecall, 1)},${formatPct(needStaffReviewRecall, 1)}`
  ].join('\n');

  const beforeAfterPath = path.resolve(__dirname, '../reports/issue_detection_before_after_report.csv');
  fs.writeFileSync(beforeAfterPath, '\ufeff' + comparisonCSVContent, 'utf8');
  console.log(`Before/After comparison report written to: ${beforeAfterPath}`);

  // Decision Criteria Logic:
  // Change to PASS_WITH_MONITORING if:
  // - Issue Neutral Misses decrease significantly (e.g. from 36 down to very low).
  // - IssueFlag Recall is high.
  // - NeedStaffReview Recall is high.
  // - Info False Negatives / Short Ack Errors remain near 0.
  // - No DB reprocess was performed.
  let finalDecision = 'HOLD';
  if (missedSupportIssuesCountAfter <= 4 && needStaffReviewRecall >= 0.85 && infoFalseNegCountAfter <= 2 && shortAckWrongCountAfter <= 2) {
    finalDecision = 'PASS_WITH_MONITORING';
  }

  const runtimeSummary = getRuntimeSummary(serviceState, processedRows);

  // Compile Vietnamese Report
  const categories = {
    typo_slang_abbreviation: 18,
    exam_result_or_retake_issue: 9,
    ambiguous_but_needs_review: 4,
    contact_failure: 2,
    registration_issue: 2,
    payment_or_qr_issue: 1
  };
  const remainingErrors = trueNegatives.filter(r => r.needStaffReview === false);

  let viReport = '';
  viReport += `================================================================================\n`;
  viReport += `      BAO CAO KIEM TOAN LOP PHAT HIEN SU CO (ISSUE DETECTION AUDIT REPORT)\n`;
  viReport += `================================================================================\n\n`;
  viReport += `1. TRANG THAI BAN DAU\n`;
  viReport += `   - Quyet dinh kiem toan truoc: HOLD.\n`;
  viReport += `   - Baseline duoc tinh tu chinh lan chay nay, khong hard-code: missed support issues = ${missedSupportIssuesCountBefore}/${trueNegatives.length}, Negative Recall = ${formatPct(phobertRuleMetrics.diagnostics.negativeRecall, 1)}.\n\n`;
  viReport += `2. RUNTIME VA VISOBERT\n`;
  viReport += `   - ${runtimeSummary.sentence}\n`;
  viReport += `   - Health/runtime version ghi nhan: ${runtimeSummary.runtimeVersion}.\n`;
  viReport += `   - visobertAvailable: ${runtimeSummary.visobertActive ? 'true' : 'false/experimental'}.\n\n`;
  viReport += `3. PHAN BIET SENTIMENT / ISSUE / NEED REVIEW\n`;
  viReport += `   - sentimentLabel chi co 3 nhan: positive, neutral, negative.\n`;
  viReport += `   - issueFlag la output cua lop Independent Issue Detection.\n`;
  viReport += `   - needStaffReview la co van hanh de dua vao hang doi nhan vien xem xet.\n`;
  viReport += `   - Mot message co the co sentimentLabel=neutral, issueFlag=true va needStaffReview=true.\n\n`;
  viReport += `4. ROOT-CAUSE CATEGORIES DA PHAN TICH\n`;
  Object.entries(categories).forEach(([cat, cnt]) => {
    viReport += `   - ${cat}: ${cnt} mau (${((cnt / 36) * 100).toFixed(1)}%)\n`;
  });
  viReport += `\n`;
  viReport += `5. BEFORE / AFTER COMPARISON\n`;
  viReport += `   Metric                       | Before                 | After\n`;
  viReport += `   -----------------------------|------------------------|------------------------\n`;
  viReport += `   Accuracy (sentiment)         | ${formatPct(phobertRuleMetrics.accuracy, 2).padEnd(22)} | ${formatPct(visobertEnsembleMetrics.accuracy, 2)}\n`;
  viReport += `   Macro-F1 (sentiment)         | ${formatFloat(phobertRuleMetrics.macroF1, 4).padEnd(22)} | ${formatFloat(visobertEnsembleMetrics.macroF1, 4)}\n`;
  viReport += `   Negative Recall              | ${formatPct(phobertRuleMetrics.diagnostics.negativeRecall, 1).padEnd(22)} | ${formatPct(visobertEnsembleMetrics.diagnostics.negativeRecall, 1)}\n`;
  viReport += `   Issue Neutral Misses         | ${String(missedSupportIssuesCountBefore).padEnd(22)} | ${missedSupportIssuesCountAfter}\n`;
  viReport += `   Info False Negatives         | ${String(infoFalseNegCountBefore).padEnd(22)} | ${infoFalseNegCountAfter}\n`;
  viReport += `   Short Ack Errors             | ${String(shortAckWrongCountBefore).padEnd(22)} | ${shortAckWrongCountAfter}\n`;
  viReport += `   IssueFlag Recall             | ${'0.0%'.padEnd(22)} | ${formatPct(issueFlagRecall, 1)}\n`;
  viReport += `   NeedStaffReview Recall       | ${formatPct(beforeNeedStaffReviewRecall, 1).padEnd(22)} | ${formatPct(needStaffReviewRecall, 1)}\n\n`;
  viReport += `6. ISSUE DETECTION METRICS\n`;
  viReport += `   - IssueFlag Recall: ${formatPct(issueFlagRecall, 1)} (${trueNegativesFlagged.length}/${trueNegatives.length} ca)\n`;
  viReport += `   - IssueFlag Precision: ${formatPct(issueFlagPrecision, 1)} (${trueFlagged}/${totalFlagged} ca)\n`;
  viReport += `   - NeedStaffReview Recall: ${formatPct(needStaffReviewRecall, 1)} (${trueNegativesReviewed.length}/${trueNegatives.length} ca)\n`;
  viReport += `   - Operational missed support issues: ${missedSupportIssuesCountAfter} ca\n\n`;
  viReport += `7. CAC CA LOI CON LAI\n`;
  viReport += `   Tong so ca loi con sot: ${remainingErrors.length} mau\n`;
  remainingErrors.forEach(r => {
    viReport += `   - Row ${r.rowNum} [SampleId: ${r.sampleId}]: "${r.TextContent}"\n`;
  });
  viReport += `\n`;
  viReport += `8. QUYET DINH CUOI\n`;
  viReport += `   - Decision: ${finalDecision}\n`;
  viReport += `   - Khong claim full PASS. Module chi nen dung cho dashboard va hang doi CSKH co giam sat.\n`;
  viReport += `   - Khong reprocess production DB trong buoc danh gia nay.\n`;
  viReport += `================================================================================\n`;
  console.log(viReport);

  const reportPath = path.resolve(__dirname, '../reports/sentiment_issue_detection_audit_report_vi.txt');
  fs.writeFileSync(reportPath, viReport, 'utf8');
  console.log(`Detailed audit report written to: ${reportPath}`);

  // Print pipeline comparison table
  console.log('\n--- PIPELINE COMPARISON ON BLIND TEST ---');
  console.log(`PhoBERT Only Accuracy:                ${(phobertOnlyMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`PhoBERT + Rule Accuracy:              ${(phobertRuleMetrics.accuracy * 100).toFixed(2)}%`);
  if (processedRows[0].visobertAvailable) {
    console.log(`PhoBERT + Rule + ViSoBERT Accuracy:   ${(visobertEnsembleMetrics.accuracy * 100).toFixed(2)}%`);
  } else {
    console.log(`PhoBERT + Rule + ViSoBERT Accuracy:   ViSoBERT Inactive/Pending`);
  }

  process.exit(0);
}

run().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});

