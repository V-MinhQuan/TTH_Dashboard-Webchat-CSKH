'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');
const { poolPromise, sql } = require('../config/db');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const REQUIRE_VISOBERT = String(process.env.REQUIRE_VISOBERT || 'false').trim().toLowerCase() === 'true';
const DEFAULT_LIMIT = 1000;
const DEFAULT_BATCH_SIZE = 32;

function parseArgs(argv) {
  const args = {};
  argv.forEach(arg => {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function postJson(urlStr, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(options, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`ml-service HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`Invalid JSON from ml-service: ${raw.slice(0, 300)}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`ml-service timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getJson(urlStr, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET'
    };
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(options, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`ml-service HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`Invalid JSON from ml-service: ${raw.slice(0, 300)}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`ml-service health timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function increment(map, key) {
  const safeKey = key || 'unknown';
  map[safeKey] = (map[safeKey] || 0) + 1;
}

function summarize(rows) {
  const summary = {
    total: rows.length,
    oldDistribution: {},
    ensembleDistribution: {},
    visobertAvailableCount: 0,
    visobertUnavailableCount: 0,
    changes: {
      neutralToNegative: 0,
      neutralToPositive: 0,
      negativeToNeutral: 0,
      positiveToNeutral: 0,
      totalChanged: 0
    },
    topRuleReasons: {},
    topEnsembleReasons: {},
    samples: {
      neutralToNegative: [],
      negativeToNeutral: [],
      positiveToNeutral: []
    }
  };

  rows.forEach(row => {
    increment(summary.oldDistribution, row.oldLabel);
    increment(summary.ensembleDistribution, row.ensembleLabel);
    increment(summary.topRuleReasons, row.rulePriority || 'none');
    increment(summary.topEnsembleReasons, row.reason);
    if (row.visobertAvailable === true) {
      summary.visobertAvailableCount += 1;
    } else {
      summary.visobertUnavailableCount += 1;
    }
    if (row.oldLabel !== row.ensembleLabel) {
      summary.changes.totalChanged += 1;
    }
    if (row.oldLabel === 'neutral' && row.ensembleLabel === 'negative') {
      summary.changes.neutralToNegative += 1;
      if (summary.samples.neutralToNegative.length < 30) {
        summary.samples.neutralToNegative.push(sampleRow(row));
      }
    }
    if (row.oldLabel === 'neutral' && row.ensembleLabel === 'positive') {
      summary.changes.neutralToPositive += 1;
    }
    if (row.oldLabel === 'negative' && row.ensembleLabel === 'neutral') {
      summary.changes.negativeToNeutral += 1;
      if (summary.samples.negativeToNeutral.length < 30) {
        summary.samples.negativeToNeutral.push(sampleRow(row));
      }
    }
    if (row.oldLabel === 'positive' && row.ensembleLabel === 'neutral') {
      summary.changes.positiveToNeutral += 1;
      if (summary.samples.positiveToNeutral.length < 30) {
        summary.samples.positiveToNeutral.push(sampleRow(row));
      }
    }
  });

  summary.topRuleReasons = topEntries(summary.topRuleReasons, 20);
  summary.topEnsembleReasons = topEntries(summary.topEnsembleReasons, 20);

  return summary;
}

function topEntries(map, limit) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .reduce((acc, [reason, count]) => ({ ...acc, [reason]: count }), {});
}

function sampleRow(row) {
  return {
    analyticsId: row.analyticsId,
    messageId: row.messageId,
    oldLabel: row.oldLabel,
    ensembleLabel: row.ensembleLabel,
    reason: row.reason,
    rulePriority: row.rulePriority,
    matchedKeyword: row.matchedKeyword,
    textContent: row.textContent
  };
}

async function fetchSample(limit) {
  const pool = await poolPromise;
  const request = pool.request();
  request.input('limit', sql.Int, limit);
  const result = await request.query(`
    SELECT TOP (@limit)
      a.id AS analyticsId,
      a.messageId,
      a.sentimentLabel AS oldLabel,
      a.sentimentScore AS oldScore,
      a.sentimentSource AS oldSource,
      a.analyzerVersion AS oldAnalyzerVersion,
      m.Source AS messageSource,
      m.SentAt,
      m.TextContent
    FROM dbo.WebChat_MessageAnalytics a
    JOIN dbo.WebChat_MessageLogs m
      ON m.id_webchat_messagelogs = a.messageId
    WHERE m.TextContent IS NOT NULL
      AND LTRIM(RTRIM(m.TextContent)) <> ''
    ORDER BY NEWID()
  `);
  return result.recordset;
}

async function predictEnsemble(texts) {
  const response = await postJson(`${ML_SERVICE_URL}/predict-ensemble`, { texts });
  if (!response || response.success !== true || !Array.isArray(response.results)) {
    throw new Error('Invalid /predict-ensemble response');
  }
  return response.results;
}

async function assertVisobertRequirement() {
  const health = await getJson(`${ML_SERVICE_URL}/health`);
  if (REQUIRE_VISOBERT && health.visobertAvailable !== true) {
    throw new Error(`REQUIRE_VISOBERT=true but ViSoBERT is unavailable: ${health.visobertError || 'unknown error'}`);
  }
  return health;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const limit = Math.max(1, Number(args.limit || DEFAULT_LIMIT));
  const batchSize = Math.min(128, Math.max(1, Number(args['batch-size'] || DEFAULT_BATCH_SIZE)));
  const outputPath = path.resolve(args.out || path.join('reports', `ensemble-dry-run-${timestampForFile()}.csv`));
  const jsonPath = outputPath.replace(/\.csv$/i, '.summary.json');
  const health = await assertVisobertRequirement();

  const sample = await fetchSample(limit);
  const rows = [];

  for (let i = 0; i < sample.length; i += batchSize) {
    const batch = sample.slice(i, i + batchSize);
    const predictions = await predictEnsemble(batch.map(row => row.TextContent || ''));
    predictions.forEach((prediction, idx) => {
      const source = batch[idx];
      const final = prediction.final || {};
      const rule = prediction.rule || {};
      rows.push({
        analyticsId: source.analyticsId,
        messageId: source.messageId,
        oldLabel: source.oldLabel || 'neutral',
        oldScore: source.oldScore,
        oldSource: source.oldSource || '',
        oldAnalyzerVersion: source.oldAnalyzerVersion || '',
        ensembleLabel: final.label || 'neutral',
        ensembleScore: final.score ?? 0,
        confidence: final.confidence ?? 0,
        needStaffReview: final.needStaffReview === true,
        reason: final.reason || '',
        rulePriority: rule.priority || '',
        matchedKeyword: rule.matchedKeyword || '',
        mode: prediction.mode || '',
        analyzerVersion: prediction.analyzerVersion || '',
        actualAnalyzerVersion: prediction.actualAnalyzerVersion || prediction.analyzerVersion || '',
        visobertError: prediction.visobertError || prediction.visobert?.reason || health.visobertError || '',
        phobertLabel: prediction.phobert?.label || '',
        phobertConfidence: prediction.phobert?.confidence ?? '',
        visobertLabel: prediction.visobert?.label || '',
        visobertConfidence: prediction.visobert?.confidence ?? '',
        visobertAvailable: prediction.visobert?.available === true,
        messageSource: source.messageSource || '',
        sentAt: source.SentAt ? new Date(source.SentAt).toISOString() : '',
        textContent: source.TextContent || ''
      });
    });
    console.log(`Dry-run progress: ${Math.min(i + batch.length, sample.length)}/${sample.length}`);
  }

  const headers = [
    'analyticsId', 'messageId', 'oldLabel', 'oldScore', 'oldSource', 'oldAnalyzerVersion',
    'ensembleLabel', 'ensembleScore', 'confidence', 'needStaffReview', 'reason',
    'rulePriority', 'matchedKeyword', 'mode', 'analyzerVersion', 'actualAnalyzerVersion',
    'visobertError', 'phobertLabel', 'phobertConfidence', 'visobertLabel',
    'visobertConfidence', 'visobertAvailable',
    'messageSource', 'sentAt', 'textContent'
  ];
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))
  ].join('\n');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `\uFEFF${csv}`, 'utf8');

  const summary = summarize(rows);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify({
    dryRun: true,
    outputPath,
    jsonPath,
    health: {
      sentimentMode: health.sentimentMode,
      visobertAvailable: health.visobertAvailable,
      visobertError: health.visobertError,
      actualAnalyzerVersion: health.actualAnalyzerVersion
    },
    ...summary
  }, null, 2));
}

main()
  .catch(err => {
    console.error(`ensemble-dry-run failed: ${err.message}`);
    process.exitCode = 1;
  });
