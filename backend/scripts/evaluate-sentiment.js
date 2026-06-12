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
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  
  if (cleaned === 'tich cuc' || cleaned === 'tích cực' || cleaned === 'positive') return 'positive';
  if (cleaned === 'trung tinh' || cleaned === 'trung tính' || cleaned === 'neutral') return 'neutral';
  if (cleaned === 'tieu cuc' || cleaned === 'tiêu cực' || cleaned === 'negative') return 'negative';
  return cleaned;
}

function normalizeText(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

function checkInfoKeyword(text) {
  const norm = normalizeText(text);
  const infoKeywords = ['lich thi', 'ho so', 'le phi', 'hoc phi', 'con slot', 'khi nao', 'o dau'];
  return infoKeywords.some(kw => norm.includes(kw));
}

function checkShortKeyword(text) {
  const norm = normalizeText(text);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 4) return true;
  const shortAcks = ['da', 'vang', 'ok', 'oke', 'v', 'a', 'da vang', 'vang a', 'da a', 'ok a', 'tin hoc co ban a'];
  return shortAcks.some(kw => norm === kw || norm === `${kw} ạ` || norm === `${kw}.`);
}

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
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

// ─── CSV ESCAPING ────────────────────────────────────────────────────────────
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r/g, '').replace(/\n/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── HTTP POST HELPER ────────────────────────────────────────────────────────
function postJson(urlStr, body, timeoutMs = 15000) {
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

    req.on('error', (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

// Check if ML Service is running
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

// ─── METRICS CALCULATION ─────────────────────────────────────────────────────
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

  // Issue neutral miss: True = negative, Predicted = neutral
  const issueNeutralMissCount = matrix.negative.neutral;

  // Informational false negative: contains info keywords, True = neutral, Predicted = negative
  const infoFalseNegCount = dataset.filter(r => {
    const trueLabel = r.effectiveManualLabel;
    const predLabel = getPredLabel(r).toLowerCase().trim();
    const isInfo = r.issueFlag === '0' && checkInfoKeyword(r.TextContent);
    return isInfo && trueLabel === 'neutral' && predLabel === 'negative';
  }).length;

  // Short acknowledgement false positive/negative count: short ack, True = neutral, Predicted = positive or negative
  const shortAckWrongCount = dataset.filter(r => {
    const trueLabel = r.effectiveManualLabel;
    const predLabel = getPredLabel(r).toLowerCase().trim();
    const isShort = checkShortKeyword(r.TextContent);
    return isShort && trueLabel === 'neutral' && (predLabel === 'positive' || predLabel === 'negative');
  }).length;

  return {
    accuracy,
    macroF1,
    classMetrics,
    matrix,
    diagnostics: {
      negativeRecall,
      issueNeutralMissCount,
      infoFalseNegCount,
      shortAckWrongCount
    }
  };
}

// Helper to determine Pass/Hold/Monitor decision
function getConclusionDecision(accuracy, macroF1, negativeRecall) {
  if (accuracy >= 0.85 && macroF1 >= 0.80 && negativeRecall >= 0.85) {
    return 'PASS';
  } else if (accuracy >= 0.75 && macroF1 >= 0.70 && negativeRecall >= 0.75) {
    return 'PASS_WITH_MONITORING';
  } else {
    return 'HOLD';
  }
}

async function run() {
  const defaultPath = path.resolve(__dirname, '../reports/sentiment_evaluation_template.csv');
  const targetPath = process.argv[2] || defaultPath;

  console.log(`Loading evaluation dataset from:\n${targetPath}\n`);

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: File does not exist at ${targetPath}. Please run the sampling script first.`);
    process.exit(1);
  }

  const rows = parseCSV(targetPath);
  console.log(`Loaded ${rows.length} rows.`);

  const validLabels = ['positive', 'neutral', 'negative'];
  const invalidRows = [];
  let blankManualCount = 0;
  let invalidPredictedCount = 0;
  
  const processedRows = [];
  
  // ─── STAGE 1: HUMAN VALIDATION LOGIC & VALIDATION ────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // CSV is 1-indexed + header row
    const manualRaw = r.manualLabel ? r.manualLabel.trim() : '';
    const currentRaw = r['current sentimentLabel'] ? r['current sentimentLabel'].trim() : '';
    
    let effective = '';
    let wasCorrected = false;
    
    if (manualRaw !== '') {
      effective = normalizeLabel(manualRaw);
      // Requirement 5: Check if explicitly filled manualLabel is invalid
      if (!validLabels.includes(effective)) {
        invalidRows.push({
          rowNum,
          messageId: r.messageId || 'Unknown',
          invalidValue: manualRaw
        });
      }
      wasCorrected = (effective !== normalizeLabel(currentRaw));
    } else {
      effective = normalizeLabel(currentRaw);
      wasCorrected = false;
      blankManualCount++;
      // Check if fallback predicted label is also invalid
      if (!validLabels.includes(effective)) {
        invalidPredictedCount++;
      }
    }
    
    processedRows.push({
      ...r,
      rowNum,
      effectiveManualLabel: effective,
      wasCorrected
    });
  }

  // Requirement 5 check: Stop if there are explicitly invalid manual labels
  if (invalidRows.length > 0) {
    console.error(`\n❌ ERROR: Invalid manualLabel values detected! Terminating.`);
    invalidRows.forEach(item => {
      console.error(`   - Row: ${item.rowNum} | MessageID: ${item.messageId} | Invalid Value: "${item.invalidValue}"`);
    });
    console.error(`Allowed labels are: positive, neutral, negative (or Vietnamese: tích cực, trung tính, tiêu cực).`);
    process.exit(1);
  }

  // Requirement 12 check: Stop if too many blank manual labels have no valid current predicted labels
  // Threshold: if any row has no valid effective label (meaning empty manual + invalid predicted)
  const rowsWithNoValidLabel = processedRows.filter(r => !validLabels.includes(r.effectiveManualLabel));
  if (rowsWithNoValidLabel.length > 0) {
    console.error(`\n❌ ERROR: Some rows have blank 'manualLabel' and no valid 'current sentimentLabel'!`);
    rowsWithNoValidLabel.forEach(item => {
      console.error(`   - Row: ${item.rowNum} | MessageID: ${item.messageId} | Current Label: "${item['current sentimentLabel']}"`);
    });
    console.error(`Evaluation cannot proceed. Please correct these row labels and run again.`);
    process.exit(1);
  }

  // Calculate statistics
  const totalRows = processedRows.length;
  const manuallyCorrectedRows = processedRows.filter(r => r.wasCorrected).length;
  // If manualLabel is NOT empty, it means human reviewed and made a validation.
  // Note: some reviews confirm the original prediction (so manualLabel is set equal to current label).
  // The user prompt defined:
  // - manuallyCorrectedRows = number of rows where `manualLabel` is not empty (i.e. reviewed/touched)
  // - keptOriginalRows = number of rows where `manualLabel` is empty
  const reviewedRows = processedRows.filter(r => r.manualLabel && r.manualLabel.trim() !== '').length;
  const keptOriginalRows = processedRows.filter(r => !r.manualLabel || r.manualLabel.trim() === '').length;
  const correctionRate = reviewedRows / totalRows;

  // Print raw validation summary
  console.log(`--- Labeling Mode: human_validated_predictions ---`);
  console.log(`Total samples:            ${totalRows}`);
  console.log(`Manually reviewed/filled: ${reviewedRows}`);
  console.log(`Kept original (blank):    ${keptOriginalRows}`);
  console.log(`Correction rate:          ${(correctionRate * 100).toFixed(2)}%\n`);

  // ─── STAGE 2: PIPELINE EXTRACTIONS & API QUERY ──────────────────────────────
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  console.log(`Checking ML service status at ${mlServiceUrl}...`);
  const serviceState = await checkMLServiceHealth(mlServiceUrl);

  if (serviceState.online) {
    console.log(`ML Service is online. Model loaded: ${serviceState.health.modelName}`);
    console.log(`ViSoBERT adapter availability: ${serviceState.health.visobertAvailable ? 'ENABLED' : 'DISABLED'} (${serviceState.health.visobertError || 'no error'})`);
    console.log(`\nQuerying predictions from ML service for pipeline comparison...`);

    const texts = processedRows.map(r => r.TextContent);
    const BATCH_SIZE = 32;
    const mlResults = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      try {
        const res = await postJson(`${mlServiceUrl}/predict-ensemble`, { texts: slice });
        if (res && res.success && Array.isArray(res.results)) {
          mlResults.push(...res.results);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (e) {
        console.error(`Error querying prediction batch starting at index ${i}:`, e.message);
        console.log('Skipping comparison, falling back to CSV active label only.');
        serviceState.online = false;
        break;
      }
    }

    if (serviceState.online) {
      processedRows.forEach((r, idx) => {
        const result = mlResults[idx];
        r.phobertOnlyLabel = result?.phobert?.label || 'neutral';
        r.phobertRuleLabel = normalizeLabel(r['current sentimentLabel']) || 'neutral';
        r.visobertEnsembleLabel = result?.final?.label || 'neutral';
        r.visobertAvailable = result?.visobert?.available === true;
      });
    }
  } else {
    console.log(`ML Service is offline. Skipping comparison. Evaluating active pipeline from CSV...`);
  }

  // ─── STAGE 3: METRIC CALCULATIONS ────────────────────────────────────────────
  // Active pipeline is the 'current sentimentLabel' column evaluated against effective manual label
  const activeMetrics = calculateMetrics(processedRows, r => r['current sentimentLabel']);

  // Phân phối nhãn thực tế
  const labelDist = { positive: 0, neutral: 0, negative: 0 };
  processedRows.forEach(r => {
    labelDist[r.effectiveManualLabel]++;
  });

  // Main error patterns analysis
  const errorPatterns = {
    missedIssues: 0,       // True negative, predicted neutral
    infoFalseNegatives: 0, // True neutral, predicted negative (with info keywords)
    shortAckErrors: 0,     // True neutral, predicted positive/negative (short ack)
    otherErrors: 0
  };

  processedRows.forEach(r => {
    if (r.wasCorrected) {
      const trueLabel = r.effectiveManualLabel;
      const predLabel = r['current sentimentLabel'].toLowerCase().trim();
      
      if (trueLabel === 'negative' && predLabel === 'neutral') {
        errorPatterns.missedIssues++;
      } else if (trueLabel === 'neutral' && predLabel === 'negative' && checkInfoKeyword(r.TextContent)) {
        errorPatterns.infoFalseNegatives++;
      } else if (trueLabel === 'neutral' && (predLabel === 'positive' || predLabel === 'negative') && checkShortKeyword(r.TextContent)) {
        errorPatterns.shortAckErrors++;
      } else {
        errorPatterns.otherErrors++;
      }
    }
  });

  const finalDecision = getConclusionDecision(
    activeMetrics.accuracy,
    activeMetrics.macroF1,
    activeMetrics.diagnostics.negativeRecall
  );

  // ─── STAGE 4: EXPORT EFFECTIVE LABELS FILE ───────────────────────────────────
  const headers = [
    'analyticsId',
    'messageId',
    'TextContent',
    'current sentimentLabel',
    'manualLabel',
    'effectiveManualLabel',
    'wasCorrected',
    'reviewerNote',
    'issueFlag',
    'needStaffReview',
    'sentimentSource',
    'analyzerVersion'
  ];

  let csvContent = headers.join(',') + '\n';
  for (const r of processedRows) {
    const rowValues = [
      r.analyticsId,
      r.messageId,
      escapeCSV(r.TextContent),
      r['current sentimentLabel'],
      r.manualLabel || '',
      r.effectiveManualLabel,
      r.wasCorrected ? 'true' : 'false',
      escapeCSV(r.reviewerNote || ''),
      r.issueFlag || '0',
      r.needStaffReview || 'FALSE',
      r.sentimentSource || '',
      r.analyzerVersion || ''
    ];
    csvContent += rowValues.join(',') + '\n';
  }

  const reportsDir = path.resolve(__dirname, '../reports');
  const exportPath = path.resolve(reportsDir, 'sentiment_evaluation_effective_labels.csv');
  fs.writeFileSync(exportPath, '\ufeff' + csvContent, 'utf8');
  console.log(`\nExported effective labels file to:`);
  console.log(exportPath);

  // ─── STAGE 5: GENERATE VIETNAMESE REPORT ─────────────────────────────────────
  let viReport = '';
  viReport += `================================================================================\n`;
  viReport += `            BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG MODULE PHÂN TÍCH CẢM XÚC\n`;
  viReport += `================================================================================\n\n`;
  viReport += `- Phương pháp đánh giá: Human-validated predictions (Nhãn đối chứng xác thực bởi con người)\n`;
  viReport += `- Chế độ nhãn (labelingMode): human_validated_predictions\n`;
  viReport += `- Tổng số mẫu đánh giá (Total samples): ${totalRows}\n`;
  viReport += `- Số mẫu giữ nguyên nhãn gốc (Kept original): ${keptOriginalRows}\n`;
  viReport += `- Số mẫu được sửa đổi/nhận xét (Manually corrected/reviewed): ${reviewedRows}\n`;
  viReport += `- Tỷ lệ sửa đổi (Correction rate): ${(correctionRate * 100).toFixed(2)}%\n\n`;

  viReport += `Phân phối nhãn thực tế sau khi con người xác thực (effectiveManualLabel):\n`;
  for (const [lbl, count] of Object.entries(labelDist)) {
    const pct = ((count / totalRows) * 100).toFixed(2);
    viReport += `  * ${lbl.padEnd(10)}: ${count} mẫu (${pct}%)\n`;
  }
  viReport += `\n`;

  viReport += `--------------------------------------------------------------------------------\n`;
  viReport += ` CHỈ SỐ ĐÁNH GIÁ CHẤT LƯỢNG (PHOBERT + RULE - ACTIVE PIPELINE)\n`;
  viReport += `--------------------------------------------------------------------------------\n`;
  viReport += `Độ chính xác toàn cục (Accuracy): ${(activeMetrics.accuracy * 100).toFixed(2)}%\n`;
  viReport += `Macro-F1 Score:                   ${activeMetrics.macroF1.toFixed(4)}\n\n`;

  viReport += `Bảng thống kê chi tiết theo từng lớp cảm xúc:\n`;
  viReport += `  Nhãn cảm xúc |  Precision  |   Recall    |  F1-Score   | TP / FP / FN\n`;
  viReport += `  -------------|-------------|-------------|-------------|-------------\n`;
  for (const [cls, m] of Object.entries(activeMetrics.classMetrics)) {
    const padCls = cls.padEnd(12);
    const p = (m.precision * 100).toFixed(2).padStart(6) + '%';
    const r = (m.recall * 100).toFixed(2).padStart(6) + '%';
    const f = m.f1.toFixed(4).padStart(9);
    const counts = `${m.tp} / ${m.fp} / ${m.fn}`.padStart(11);
    viReport += `  ${padCls} |    ${p}   |    ${r}   |  ${f}  | ${counts}\n`;
  }
  viReport += `\n`;

  viReport += `Ma trận nhầm lẫn (Confusion Matrix):\n`;
  viReport += `  (Dòng: Nhãn thực tế (Manual) | Cột: Nhãn dự đoán (Predicted))\n`;
  viReport += `                  Dự đoán Tích cực | Dự đoán Trung tính | Dự đoán Tiêu cực\n`;
  viReport += `  Thực Tích cực : ${String(activeMetrics.matrix.positive.positive).padStart(16)} | ${String(activeMetrics.matrix.positive.neutral).padStart(18)} | ${String(activeMetrics.matrix.positive.negative).padStart(17)}\n`;
  viReport += `  Thực Trung tính: ${String(activeMetrics.matrix.neutral.positive).padStart(16)} | ${String(activeMetrics.matrix.neutral.neutral).padStart(18)} | ${String(activeMetrics.matrix.neutral.negative).padStart(17)}\n`;
  viReport += `  Thực Tiêu cực : ${String(activeMetrics.matrix.negative.positive).padStart(16)} | ${String(activeMetrics.matrix.negative.neutral).padStart(18)} | ${String(activeMetrics.matrix.negative.negative).padStart(17)}\n\n`;

  viReport += `Chỉ số chẩn đoán lỗi đặc thù nghiệp vụ:\n`;
  viReport += `  - Tỷ lệ nhận diện đúng tiêu cực (Negative Recall):    ${(activeMetrics.diagnostics.negativeRecall * 100).toFixed(2)}%\n`;
  viReport += `  - Số ca Lỗi bị bỏ sót thành Trung tính (Missed):       ${activeMetrics.diagnostics.issueNeutralMissCount} mẫu\n`;
  viReport += `  - Số ca Câu hỏi thông tin bị nhầm thành Tiêu cực (FN):  ${activeMetrics.diagnostics.infoFalseNegCount} mẫu\n`;
  viReport += `  - Số ca Từ đệm/Chat ngắn bị nhầm thành Tích cực/Tiêu cực: ${activeMetrics.diagnostics.shortAckWrongCount} mẫu\n\n`;

  viReport += `--------------------------------------------------------------------------------\n`;
  viReport += ` PHÂN TÍCH CÁC DẠNG LỖI CHÍNH (MAIN ERROR PATTERNS)\n`;
  viReport += `--------------------------------------------------------------------------------\n`;
  viReport += `Tổng số ca dự đoán sai lệch so với nhãn thực tế: ${reviewedRows} mẫu\n`;
  viReport += `  1. Lỗi bỏ sót phản hồi Tiêu cực (Missed Support Issues) -> dự đoán thành Trung tính:\n`;
  viReport += `     => Số lượng: ${errorPatterns.missedIssues} mẫu (${((errorPatterns.missedIssues / totalRows) * 100).toFixed(2)}% tổng dữ liệu)\n`;
  viReport += `  2. Lỗi nhầm lẫn câu hỏi thông tin thành Tiêu cực (Informational False Negatives):\n`;
  viReport += `     => Số lượng: ${errorPatterns.infoFalseNegatives} mẫu (${((errorPatterns.infoFalseNegatives / totalRows) * 100).toFixed(2)}% tổng dữ liệu)\n`;
  viReport += `  3. Lỗi nhầm lẫn từ đệm/phản hồi ngắn (Short Acknowledgement noise) thành Cảm xúc:\n`;
  viReport += `     => Số lượng: ${errorPatterns.shortAckErrors} mẫu (${((errorPatterns.shortAckErrors / totalRows) * 100).toFixed(2)}% tổng dữ liệu)\n`;
  viReport += `  4. Các dạng lệch nhãn khác (lệch tích cực/trung tính, v.v.):\n`;
  viReport += `     => Số lượng: ${errorPatterns.otherErrors} mẫu (${((errorPatterns.otherErrors / totalRows) * 100).toFixed(2)}% tổng dữ liệu)\n\n`;

  if (serviceState.online) {
    // Calculate comparison metrics
    const phobertOnlyMetrics = calculateMetrics(processedRows, r => r.phobertOnlyLabel);
    const phobertRuleMetrics = calculateMetrics(processedRows, r => r.phobertRuleLabel);

    viReport += `--------------------------------------------------------------------------------\n`;
    viReport += ` SO SÁNH HIỆU NĂNG GIỮA CÁC ĐƯỜNG ỐNG (PIPELINES COMPARISON)\n`;
    viReport += `--------------------------------------------------------------------------------\n`;
    viReport += `  Chỉ số đánh giá          | PhoBERT Only | PhoBERT + Rule | PhoBERT+Rule+ViSoBERT\n`;
    viReport += `  -------------------------|--------------|----------------|----------------------\n`;
    
    const pAcc = (phobertOnlyMetrics.accuracy * 100).toFixed(2) + '%';
    const prAcc = (phobertRuleMetrics.accuracy * 100).toFixed(2) + '%';
    const vAcc = processedRows[0].visobertAvailable ? (calculateMetrics(processedRows, r => r.visobertEnsembleLabel).accuracy * 100).toFixed(2) + '%' : 'Inactive/Pending';
    viReport += `  Accuracy                 |     ${pAcc.padStart(7)}  |     ${prAcc.padStart(7)}  | ${vAcc}\n`;

    const pF1 = phobertOnlyMetrics.macroF1.toFixed(4);
    const prF1 = phobertRuleMetrics.macroF1.toFixed(4);
    const vF1 = processedRows[0].visobertAvailable ? calculateMetrics(processedRows, r => r.visobertEnsembleLabel).macroF1.toFixed(4) : 'Inactive/Pending';
    viReport += `  Macro-F1                 |     ${pF1.padStart(7)}  |     ${prF1.padStart(7)}  | ${vF1}\n`;

    const pNegRec = (phobertOnlyMetrics.diagnostics.negativeRecall * 100).toFixed(1) + '%';
    const prNegRec = (phobertRuleMetrics.diagnostics.negativeRecall * 100).toFixed(1) + '%';
    const vNegRec = processedRows[0].visobertAvailable ? (calculateMetrics(processedRows, r => r.visobertEnsembleLabel).diagnostics.negativeRecall * 100).toFixed(1) + '%' : 'Inactive/Pending';
    viReport += `  Negative Recall          |     ${pNegRec.padStart(7)}  |     ${prNegRec.padStart(7)}  | ${vNegRec}\n`;

    const pMiss = phobertOnlyMetrics.diagnostics.issueNeutralMissCount;
    const prMiss = phobertRuleMetrics.diagnostics.issueNeutralMissCount;
    const vMiss = processedRows[0].visobertAvailable ? calculateMetrics(processedRows, r => r.visobertEnsembleLabel).diagnostics.issueNeutralMissCount : 'Inactive/Pending';
    viReport += `  Issue Neutral Misses     |     ${String(pMiss).padStart(7)}  |     ${String(prMiss).padStart(7)}  | ${vMiss}\n`;

    const pInfoFN = phobertOnlyMetrics.diagnostics.infoFalseNegCount;
    const prInfoFN = phobertRuleMetrics.diagnostics.infoFalseNegCount;
    const vInfoFN = processedRows[0].visobertAvailable ? calculateMetrics(processedRows, r => r.visobertEnsembleLabel).diagnostics.infoFalseNegCount : 'Inactive/Pending';
    viReport += `  Info False Negatives     |     ${String(pInfoFN).padStart(7)}  |     ${String(prInfoFN).padStart(7)}  | ${vInfoFN}\n`;

    const pAck = phobertOnlyMetrics.diagnostics.shortAckWrongCount;
    const prAck = phobertRuleMetrics.diagnostics.shortAckWrongCount;
    const vAck = processedRows[0].visobertAvailable ? calculateMetrics(processedRows, r => r.visobertEnsembleLabel).diagnostics.shortAckWrongCount : 'Inactive/Pending';
    viReport += `  Short Ack False Pos/Neg  |     ${String(pAck).padStart(7)}  |     ${String(prAck).padStart(7)}  | ${vAck}\n\n`;
  }

  viReport += `--------------------------------------------------------------------------------\n`;
  viReport += ` KẾT LUẬN CUỐI CÙNG (FINAL QUALITY CONCLUSION)\n`;
  viReport += `--------------------------------------------------------------------------------\n`;
  viReport += `Đánh giá tổng quan chất lượng module: ${finalDecision}\n`;
  viReport += `Khuyến nghị hành động:\n`;
  if (finalDecision === 'PASS') {
    viReport += `  => Module đạt yêu cầu chất lượng xuất sắc. Sẵn sàng vận hành tự động toàn phần.\n`;
  } else if (finalDecision === 'PASS_WITH_MONITORING') {
    viReport += `  => Module được PHÊ DUYỆT nhưng cần GIÁM SÁT thêm. Cần tiếp tục theo dõi các ca phản hồi\n`;
    viReport += `     tiêu cực bị bỏ sót và định kỳ cập nhật bộ từ khóa hỗ trợ (Rule adapter) cho các chủ đề mới.\n`;
  } else {
    viReport += `  => TẠM DỪNG (HOLD). Chất lượng module chưa đạt yêu cầu tối thiểu (Accuracy < 75% hoặc F1 < 0.70).\n`;
    viReport += `     Cần rà soát lại trọng số mô hình hoặc bổ sung lượng lớn quy tắc nghiệp vụ trong bộ lọc.\n`;
  }
  viReport += `================================================================================\n`;

  console.log(viReport);

  const reportPath = path.resolve(reportsDir, 'sentiment_evaluation_report_vi.txt');
  fs.writeFileSync(reportPath, viReport, 'utf8');
  console.log(`Báo cáo chi tiết tiếng Việt đã được xuất ra file:`);
  console.log(reportPath);

  process.exit(0);
}

run().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
