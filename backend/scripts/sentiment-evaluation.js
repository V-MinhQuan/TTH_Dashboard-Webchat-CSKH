import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FASTAPI_URL,
  VALID_LABELS,
  checkBackendLive,
  predictSentiments
} from './sentiment-api-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseRow(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Evaluation CSV not found: ${filePath}`);
  const lines = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('Evaluation CSV must contain a header and at least one data row.');
  const headers = parseRow(lines[0]).map(value => value.trim());
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseRow(line);
    const row = { rowNumber: rowIndex + 2 };
    headers.forEach((header, index) => { row[header] = String(values[index] || '').trim(); });
    return row;
  });
}

function normalizeLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  const plain = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  if (plain === 'positive' || plain === 'tich cuc') return 'positive';
  if (plain === 'negative' || plain === 'tieu cuc') return 'negative';
  if (plain === 'neutral' || plain === 'trung tinh') return 'neutral';
  return '';
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\r?\n/g, ' ');
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function calculateMetrics(rows, predictionKey) {
  const labels = [...VALID_LABELS];
  const matrix = Object.fromEntries(labels.map(actual => [
    actual,
    Object.fromEntries(labels.map(predicted => [predicted, 0]))
  ]));
  for (const row of rows) matrix[row.truthLabel][row[predictionKey]] += 1;

  let correct = 0;
  const byLabel = {};
  for (const label of labels) {
    const tp = matrix[label][label];
    const fp = labels.reduce((sum, actual) => sum + (actual === label ? 0 : matrix[actual][label]), 0);
    const fn = labels.reduce((sum, predicted) => sum + (predicted === label ? 0 : matrix[label][predicted]), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    byLabel[label] = { precision, recall, f1, tp, fp, fn };
    correct += tp;
  }
  return {
    total: rows.length,
    accuracy: rows.length ? correct / rows.length : 0,
    macroF1: labels.reduce((sum, label) => sum + byLabel[label].f1, 0) / labels.length,
    matrix,
    byLabel
  };
}

function formatMetrics(metrics) {
  return {
    ...metrics,
    accuracy: Number(metrics.accuracy.toFixed(6)),
    macroF1: Number(metrics.macroF1.toFixed(6))
  };
}

export async function evaluateCsv({ inputPath, requireManualLabels = false, reportPrefix }) {
  const rows = parseCsv(inputPath);
  const prepared = rows.map(row => {
    const text = String(row.TextContent || row.textContent || '').trim();
    const manualLabel = normalizeLabel(row.manualLabel);
    const currentLabel = normalizeLabel(row['current sentimentLabel'] || row.sentimentLabel);
    const truthLabel = manualLabel || (!requireManualLabels ? currentLabel : '');
    if (!text) throw new Error(`Row ${row.rowNumber} has empty TextContent.`);
    if (!truthLabel) throw new Error(`Row ${row.rowNumber} has no valid manual label.`);
    return { ...row, text, truthLabel, currentLabel };
  });

  console.log(`Checking FastAPI Backend at ${FASTAPI_URL}...`);
  await checkBackendLive();
  console.log(`Requesting ${prepared.length} Hugging Face predictions through the Backend...`);
  const predictions = await predictSentiments(prepared.map(row => row.text));

  const evaluated = prepared.map((row, index) => {
    const prediction = predictions[index];
    return {
      ...row,
      hfLabel: prediction.sentiment.label,
      hfConfidence: prediction.sentiment.confidence,
      hfScore: prediction.sentimentScore,
      needStaffReview: prediction.needStaffReview === true,
      issueFlag: prediction.issue?.issueFlag === true,
      issueType: prediction.issue?.issueType || '',
      issueReason: prediction.issue?.issueReason || '',
      analyzerVersion: prediction.actualAnalyzerVersion || prediction.analyzerVersion || '',
      analysisSource: prediction.analysisSource || prediction.source || '',
      analysisStatus: prediction.analysisStatus
    };
  });

  const hfMetrics = calculateMetrics(evaluated, 'hfLabel');
  const comparableCurrent = evaluated.filter(row => VALID_LABELS.has(row.currentLabel));
  const currentMetrics = comparableCurrent.length ? calculateMetrics(comparableCurrent, 'currentLabel') : null;
  const issueRecallRows = evaluated.filter(row => row.truthLabel === 'negative');
  const reviewedNegative = issueRecallRows.filter(row => row.needStaffReview).length;

  const reportsDir = path.resolve(__dirname, '../reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const csvPath = path.join(reportsDir, `${reportPrefix}_results.csv`);
  const summaryPath = path.join(reportsDir, `${reportPrefix}_summary.json`);
  const reportPath = path.join(reportsDir, `${reportPrefix}_report_vi.txt`);
  const headers = [
    'rowNumber', 'analyticsId', 'messageId', 'TextContent', 'truthLabel', 'currentLabel',
    'hfLabel', 'hfConfidence', 'hfScore', 'needStaffReview', 'issueFlag', 'issueType',
    'issueReason', 'analyzerVersion', 'analysisSource', 'analysisStatus'
  ];
  const csv = [
    headers.join(','),
    ...evaluated.map(row => headers.map(header => csvCell(header === 'TextContent' ? row.text : row[header])).join(','))
  ].join('\n');
  fs.writeFileSync(csvPath, `\uFEFF${csv}\n`, 'utf8');

  const summary = {
    architecture: 'fastapi-huggingface-single-model',
    fastapiUrl: FASTAPI_URL,
    model: evaluated[0]?.analyzerVersion || null,
    total: evaluated.length,
    hfMetrics: formatMetrics(hfMetrics),
    currentMetrics: currentMetrics ? formatMetrics(currentMetrics) : null,
    negativeNeedStaffReviewRecall: issueRecallRows.length ? reviewedNegative / issueRecallRows.length : null,
    outputs: { csvPath, summaryPath, reportPath }
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  const report = [
    'BAO CAO DANH GIA SENTIMENT - FASTAPI + HUGGING FACE',
    `Tong mau: ${summary.total}`,
    `Model: ${summary.model || 'unknown'}`,
    `Accuracy: ${(hfMetrics.accuracy * 100).toFixed(2)}%`,
    `Macro-F1: ${hfMetrics.macroF1.toFixed(4)}`,
    `Negative needStaffReview recall: ${summary.negativeNeedStaffReviewRecall === null ? 'N/A' : `${(summary.negativeNeedStaffReviewRecall * 100).toFixed(2)}%`}`,
    currentMetrics ? `Current-label baseline accuracy: ${(currentMetrics.accuracy * 100).toFixed(2)}%` : 'Current-label baseline: N/A',
    '',
    'Luu y: ket qua loi provider khong duoc tinh thanh neutral; script dung ngay neu API khong tra prediction completed.'
  ].join('\n');
  fs.writeFileSync(reportPath, `${report}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

export { csvCell, normalizeLabel, parseCsv };
