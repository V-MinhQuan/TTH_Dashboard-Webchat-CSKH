'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');
const satisfactionScoreService = require('../services/satisfaction-score.service');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ENSEMBLE_MODEL_VERSION = process.env.ENSEMBLE_MODEL_VERSION || 'ensemble-phobert-rule-v1';
const REQUIRE_VISOBERT = String(process.env.REQUIRE_VISOBERT || 'false').trim().toLowerCase() === 'true';
const DEFAULT_BATCH_SIZE = 500;
let poolPromise;
let sql;

function parseArgs(argv) {
  const args = {};
  argv.forEach(arg => {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function timestampForName() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function readState(statePath) {
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function writeState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function normalizeState(rawState, batchSize, totalSelected) {
  const totalProcessed = Number(rawState?.totalProcessed ?? rawState?.processed ?? 0);
  const totalUpdated = Number(rawState?.totalUpdated ?? rawState?.updated ?? 0);
  const failedRows = Array.isArray(rawState?.failedRows) ? rawState.failedRows : [];
  return {
    ...rawState,
    startedAt: rawState?.startedAt || new Date().toISOString(),
    lastAnalyticsId: Number(rawState?.lastAnalyticsId || 0),
    totalSelected,
    totalProcessed,
    totalUpdated,
    processed: totalProcessed,
    updated: totalUpdated,
    failedRows,
    failedRowCount: failedRows.length,
    batchSize,
    totalBatches: Math.ceil(totalSelected / batchSize)
  };
}

function postJson(urlStr, body, timeoutMs = 60000) {
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

async function assertVisobertRequirement() {
  if (!REQUIRE_VISOBERT) return null;
  const health = await getJson(`${ML_SERVICE_URL}/health`);
  if (health.visobertAvailable !== true) {
    throw new Error(`REQUIRE_VISOBERT=true but ViSoBERT is unavailable: ${health.visobertError || 'unknown error'}`);
  }
  return health;
}

async function getOptionalColumns(pool) {
  const result = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.WebChat_MessageAnalytics', 'analyzerVersion') AS analyzerVersionLen,
      COL_LENGTH('dbo.WebChat_MessageAnalytics', 'sentimentSource') AS sentimentSourceLen
  `);
  const row = result.recordset?.[0] || {};
  return {
    analyzerVersion: row.analyzerVersionLen !== null && row.analyzerVersionLen !== undefined,
    sentimentSource: row.sentimentSourceLen !== null && row.sentimentSourceLen !== undefined
  };
}

async function getTotalSelected(pool) {
  const result = await pool.request().query(`
    SELECT COUNT(*) AS totalSelected
    FROM dbo.WebChat_MessageAnalytics a
    JOIN dbo.WebChat_MessageLogs m
      ON m.id_webchat_messagelogs = a.messageId
    WHERE m.TextContent IS NOT NULL
      AND LTRIM(RTRIM(m.TextContent)) <> ''
  `);
  return Number(result.recordset?.[0]?.totalSelected || 0);
}

async function getTableRowCount(pool, tableName) {
  if (!/^WebChat_MessageAnalytics_Backup_Ensemble_\d{14}$/.test(tableName)) {
    throw new Error(`Invalid backup table name in state: ${tableName}`);
  }
  const result = await pool.request().query(`
    SELECT COUNT(*) AS backupRows
    FROM [dbo].[${tableName}]
  `);
  return Number(result.recordset?.[0]?.backupRows || 0);
}

async function ensureBackup(pool, state, statePath) {
  if (state.backupTable) {
    const backupRows = await getTableRowCount(pool, state.backupTable);
    const totalSelected = state.totalSelected || await getTotalSelected(pool);
    if (backupRows !== totalSelected) {
      throw new Error(
        `Existing backup dbo.${state.backupTable} has ${backupRows} rows, expected ${totalSelected}.`
      );
    }
    console.log(`Existing backup verified: dbo.${state.backupTable}, rows=${backupRows}`);
    return state.backupTable;
  }
  const backupTable = `WebChat_MessageAnalytics_Backup_Ensemble_${timestampForName()}`;
  await pool.request().query(`
    SELECT *
    INTO [dbo].[${backupTable}]
    FROM dbo.WebChat_MessageAnalytics
  `);
  const nextState = {
    ...state,
    backupTable,
    backupCreatedAt: new Date().toISOString(),
    backupRows: await getTableRowCount(pool, backupTable)
  };
  writeState(statePath, nextState);
  console.log(`Backup created: dbo.${backupTable}`);
  return backupTable;
}

async function fetchBatch(pool, lastAnalyticsId, batchSize, limitRemaining) {
  const request = pool.request();
  request.input('lastAnalyticsId', sql.BigInt, lastAnalyticsId);
  request.input('batchSize', sql.Int, Math.min(batchSize, limitRemaining || batchSize));
  const result = await request.query(`
    SELECT TOP (@batchSize)
      a.id AS analyticsId,
      a.messageId,
      m.TextContent
    FROM dbo.WebChat_MessageAnalytics a
    JOIN dbo.WebChat_MessageLogs m
      ON m.id_webchat_messagelogs = a.messageId
    WHERE a.id > @lastAnalyticsId
      AND m.TextContent IS NOT NULL
      AND LTRIM(RTRIM(m.TextContent)) <> ''
    ORDER BY a.id ASC
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

function buildAnalyticsFields(prediction, text) {
  const final = prediction.final || {};
  const rule = prediction.rule || {};
  const label = ['positive', 'neutral', 'negative'].includes(final.label)
    ? final.label
    : 'neutral';
  const matchedKeyword = rule.matchedKeyword || null;
  const matchedPositiveKeywords = label === 'positive' && matchedKeyword ? [matchedKeyword] : [];
  const matchedNegativeKeywords = (label === 'negative' || final.needStaffReview) && matchedKeyword
    ? [matchedKeyword]
    : [];
  const score = Number(final.score || 0);
  const satisfaction = satisfactionScoreService.calculateSatisfactionScore({
    sentimentScore: score,
    sentimentLabel: label,
    matchedNegativeKeywords,
    cleanedText: text || ''
  });
  const needStaffReview = satisfaction.needStaffReview === true || final.needStaffReview === true;
  const satisfactionReason = final.needStaffReview === true && satisfaction.needStaffReview !== true
    ? `${satisfaction.satisfactionReason || ''} Bo phan tich cam xuc danh dau can nhan vien xem xet.`.trim()
    : satisfaction.satisfactionReason;

  return {
    sentimentLabel: label,
    sentimentScore: Math.max(-1, Math.min(1, score)),
    sentimentReason: `Ensemble final=${label}, confidence=${Math.round(Number(final.confidence || 0) * 100)}%, reason=${final.reason || 'n/a'}.`,
    matchedPositiveKeywords: JSON.stringify(matchedPositiveKeywords),
    matchedNegativeKeywords: JSON.stringify(matchedNegativeKeywords),
    satisfactionScore: satisfaction.satisfactionScore,
    satisfactionLevel: satisfaction.satisfactionLevel,
    satisfactionReason,
    needStaffReview,
    analyzerVersion: prediction.actualAnalyzerVersion || prediction.analyzerVersion || ENSEMBLE_MODEL_VERSION,
    sentimentSource: 'ensemble'
  };
}

async function updateBatch(pool, optionalColumns, rows, predictions) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const fields = buildAnalyticsFields(predictions[i], row.TextContent || '');
      const request = new sql.Request(transaction);
      request.input('analyticsId', sql.BigInt, row.analyticsId);
      request.input('sentimentLabel', sql.NVarChar(20), fields.sentimentLabel);
      request.input('sentimentScore', sql.Float, fields.sentimentScore);
      request.input('sentimentReason', sql.NVarChar(500), fields.sentimentReason);
      request.input('matchedPositiveKeywords', sql.NVarChar(sql.MAX), fields.matchedPositiveKeywords);
      request.input('matchedNegativeKeywords', sql.NVarChar(sql.MAX), fields.matchedNegativeKeywords);
      request.input('satisfactionScore', sql.Float, fields.satisfactionScore);
      request.input('satisfactionLevel', sql.NVarChar(20), fields.satisfactionLevel);
      request.input('satisfactionReason', sql.NVarChar(500), fields.satisfactionReason);
      request.input('needStaffReview', sql.Bit, fields.needStaffReview ? 1 : 0);

      const setClauses = [
        'sentimentLabel = @sentimentLabel',
        'sentimentScore = @sentimentScore',
        'sentimentReason = @sentimentReason',
        'matchedPositiveKeywords = @matchedPositiveKeywords',
        'matchedNegativeKeywords = @matchedNegativeKeywords',
        'satisfactionScore = @satisfactionScore',
        'satisfactionLevel = @satisfactionLevel',
        'satisfactionReason = @satisfactionReason',
        'needStaffReview = @needStaffReview',
        'analyzedAt = GETDATE()'
      ];

      if (optionalColumns.analyzerVersion) {
        request.input('analyzerVersion', sql.NVarChar(50), fields.analyzerVersion);
        setClauses.push('analyzerVersion = @analyzerVersion');
      }
      if (optionalColumns.sentimentSource) {
        request.input('sentimentSource', sql.NVarChar(50), fields.sentimentSource);
        setClauses.push('sentimentSource = @sentimentSource');
      }

      await request.query(`
        UPDATE dbo.WebChat_MessageAnalytics
        SET ${setClauses.join(', ')}
        WHERE id = @analyticsId
      `);
    }
    await transaction.commit();
    return rows.length;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function main() {
  if (process.env.ENSEMBLE_WRITE_DB !== 'true') {
    console.log('ENSEMBLE_WRITE_DB is not true. No database changes were made.');
    console.log('Use dry-run first: node scripts/ensemble-dry-run.js --limit=1000');
    return;
  }

  await assertVisobertRequirement();
  ({ poolPromise, sql } = require('../config/db'));

  const args = parseArgs(process.argv.slice(2));
  const statePath = path.resolve(args.state || '.ensemble-reprocess-state.json');
  if (hasFlag('reset') && fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
  const batchSize = Math.max(1, Number(args['batch-size'] || DEFAULT_BATCH_SIZE));
  const limit = args.limit ? Math.max(1, Number(args.limit)) : null;

  const pool = await poolPromise;
  const optionalColumns = await getOptionalColumns(pool);
  const totalSelected = await getTotalSelected(pool);
  let state = normalizeState(readState(statePath) || {
    lastAnalyticsId: 0,
    processed: 0,
    updated: 0,
    startedAt: new Date().toISOString()
  }, batchSize, totalSelected);

  await ensureBackup(pool, state, statePath);
  state = normalizeState(readState(statePath) || state, batchSize, totalSelected);
  state = {
    ...state,
    resumedAt: hasFlag('resume') ? new Date().toISOString() : state.resumedAt,
    updatedAt: new Date().toISOString()
  };
  writeState(statePath, state);

  while (true) {
    const remaining = limit ? limit - state.totalProcessed : null;
    if (remaining !== null && remaining <= 0) break;

    const rows = await fetchBatch(pool, state.lastAnalyticsId || 0, batchSize, remaining);
    if (rows.length === 0) break;

    try {
      const predictions = await predictEnsemble(rows.map(row => row.TextContent || ''));
      const updated = await updateBatch(pool, optionalColumns, rows, predictions);
      const lastAnalyticsId = rows[rows.length - 1].analyticsId;
      const totalProcessedNext = state.totalProcessed + rows.length;
      const totalUpdatedNext = state.totalUpdated + updated;
      state = {
        ...state,
        lastAnalyticsId,
        totalProcessed: totalProcessedNext,
        totalUpdated: totalUpdatedNext,
        processed: totalProcessedNext,
        updated: totalUpdatedNext,
        failedRowCount: state.failedRows.length,
        updatedAt: new Date().toISOString()
      };
      writeState(statePath, state);
      console.log(`Reprocess progress: processed=${state.totalProcessed}/${state.totalSelected}, updated=${state.totalUpdated}, lastAnalyticsId=${state.lastAnalyticsId}`);
    } catch (err) {
      const failedAt = new Date().toISOString();
      const failedRows = rows.map(row => ({
        analyticsId: row.analyticsId,
        messageId: row.messageId,
        failedAt,
        error: err.message
      }));
      state = {
        ...state,
        failedRows: [...state.failedRows, ...failedRows],
        failedRowCount: state.failedRows.length + failedRows.length,
        lastError: err.message,
        failedAt,
        updatedAt: failedAt
      };
      writeState(statePath, state);
      throw err;
    }
  }

  state = {
    ...state,
    finishedAt: new Date().toISOString(),
    failedRowCount: state.failedRows.length
  };
  writeState(statePath, state);
  console.log(JSON.stringify({ done: true, ...state }, null, 2));
}

main()
  .catch(err => {
    console.error(`ensemble-reprocess failed: ${err.message}`);
    process.exitCode = 1;
  });
