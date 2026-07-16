import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FASTAPI_URL, checkBackendLive, predictSentiments } from './sentiment-api-client.js';
import { csvCell, normalizeLabel, parseCsv } from './sentiment-evaluation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const inputPath = path.resolve(
    process.argv[2] || path.resolve(__dirname, '../reports/sentiment_blind_test_template.csv')
  );
  const rows = parseCsv(inputPath);
  const reviewed = rows.map(row => ({
    ...row,
    text: String(row.TextContent || row.textContent || '').trim(),
    manualLabel: normalizeLabel(row.manualLabel)
  })).filter(row => row.text && row.manualLabel === 'negative');

  if (!reviewed.length) throw new Error('No manually reviewed negative rows were found.');
  console.log(`Checking FastAPI Backend at ${FASTAPI_URL}...`);
  await checkBackendLive();
  const predictions = await predictSentiments(reviewed.map(row => row.text));

  const missed = reviewed.map((row, index) => {
    const prediction = predictions[index];
    return {
      sampleId: row.sampleId || '',
      analyticsId: row.analyticsId || '',
      messageId: row.messageId || '',
      TextContent: row.text,
      Source: row.Source || '',
      SentAt: row.SentAt || '',
      manualLabel: row.manualLabel,
      predictedLabel: prediction.sentiment.label,
      confidence: prediction.sentiment.confidence,
      needStaffReview: prediction.needStaffReview === true,
      issueFlag: prediction.issue?.issueFlag === true,
      issueType: prediction.issue?.issueType || '',
      issueReason: prediction.issue?.issueReason || '',
      analyzerVersion: prediction.actualAnalyzerVersion || prediction.analyzerVersion || '',
      reviewerNote: row.reviewerNote || ''
    };
  }).filter(row => row.predictedLabel !== 'negative' || !row.needStaffReview);

  const headers = [
    'sampleId', 'analyticsId', 'messageId', 'TextContent', 'Source', 'SentAt',
    'manualLabel', 'predictedLabel', 'confidence', 'needStaffReview', 'issueFlag',
    'issueType', 'issueReason', 'analyzerVersion', 'reviewerNote'
  ];
  const outputPath = path.resolve(__dirname, '../reports/missed_support_issues_analysis.csv');
  const csv = [
    headers.join(','),
    ...missed.map(row => headers.map(header => csvCell(row[header])).join(','))
  ].join('\n');
  fs.writeFileSync(outputPath, `\uFEFF${csv}\n`, 'utf8');
  console.log(JSON.stringify({
    architecture: 'fastapi-huggingface-single-model',
    reviewedNegative: reviewed.length,
    missedOrNotQueued: missed.length,
    outputPath
  }, null, 2));
}

run().catch(error => {
  console.error(`Missed-issue extraction failed: ${error.message}`);
  process.exitCode = 1;
});
