/**
 * Service: AI Sentiment — cầu nối giữa analytics pipeline và ml-service
 *
 * Vai trò:
 *  - Gọi ml-service (Python FastAPI + PhoBERT) qua HTTP built-in
 *  - Hỗ trợ batch processing (tối đa 32 văn bản/batch)
 *  - LRU cache đơn giản để tránh gọi lại model cho văn bản đã xử lý
 *  - Cache key bao gồm model version để tránh trả kết quả cũ khi nâng cấp model
 *  - Tự động fallback sang rule-based nếu ml-service không khả dụng
 *  - Timeout phân tầng: request đầu tiên dùng timeout dài hơn (cold start)
 *
 * Ràng buộc kỹ thuật:
 *  - Chỉ dùng built-in Node.js: http, https, URL
 *  - Không cài thêm bất kỳ npm package nào
 *  - Backend không bao giờ crash vì lỗi ml-service
 *
 * Biến môi trường:
 *  ML_SERVICE_URL         URL của ml-service (mặc định: http://localhost:8001)
 *  ML_TIMEOUT_MS          Timeout bình thường sau warm-up (mặc định: 5000ms)
 *  ML_TIMEOUT_FIRST_MS    Timeout cho request đầu tiên / cold start (mặc định: 15000ms)
 *  ML_MIN_TEXT_LENGTH     Độ dài tối thiểu để gửi lên PhoBERT (mặc định: 2)
 *  ML_MODEL_VERSION       Phiên bản model để namespace cache (mặc định: phobert-onnx-v1)
 *  ML_WARMUP_ENABLED      Bật/tắt proactive warm-up khi backend khởi động (mặc định: true)
 *  ML_WARMUP_TEXT         Văn bản dùng để warm-up PhoBERT (mặc định: xin chào)
 */

'use strict';

const http  = require('http');
const https = require('https');
const { URL } = require('url');

// ─── Cấu hình — đọc từ biến môi trường ───────────────────────────────────────
const ML_SERVICE_URL    = process.env.ML_SERVICE_URL    || 'http://localhost:8001';
const BATCH_SIZE        = 32;
const TIMEOUT_MS        = Number(process.env.ML_TIMEOUT_MS       || 5000);
const TIMEOUT_FIRST_MS  = Number(process.env.ML_TIMEOUT_FIRST_MS || 15000);
const MIN_TEXT_LENGTH   = Number(process.env.ML_MIN_TEXT_LENGTH  || 2);
const MODEL_VERSION     = process.env.ML_MODEL_VERSION           || 'phobert-onnx-v1';
const ENSEMBLE_MODEL_VERSION = process.env.ENSEMBLE_MODEL_VERSION || 'ensemble-phobert-rule-v1';
const RAW_SENTIMENT_MODE = String(process.env.SENTIMENT_MODE || 'phobert').trim().toLowerCase();
const SENTIMENT_MODE = ['phobert', 'visobert', 'ensemble'].includes(RAW_SENTIMENT_MODE)
  ? RAW_SENTIMENT_MODE
  : 'phobert';
const ACTIVE_MODEL_VERSION = SENTIMENT_MODE === 'ensemble'
  ? ENSEMBLE_MODEL_VERSION
  : MODEL_VERSION;
const PREDICT_ENDPOINT = SENTIMENT_MODE === 'ensemble'
  ? '/predict-ensemble'
  : '/predict';
const MAX_CACHE_SIZE    = 10000;

// Warm-up — gửi một request nhỏ sau khi backend khởi động để tránh cold start
// cho request phân tích thật đầu tiên
const WARMUP_ENABLED = process.env.ML_WARMUP_ENABLED !== 'false'; // mặc định true
const WARMUP_TEXT    = process.env.ML_WARMUP_TEXT || 'xin chào';

// ─── Hybrid post-processing cho domain FLIC ──────────────────────────────────
// Ưu tiên: tín hiệu tiêu cực mạnh > whitelist câu hỏi thông tin về điều kiện.
const TOKEN_BOUNDARY = '[^\\p{L}\\p{N}]';

const INFORMATION_CONDITION_PHRASES = [
  'điều kiện ra trường',
  'điều kiện tốt nghiệp',
  'điều kiện chuẩn đầu ra',
  'điều kiện thi',
  'điều kiện xét chứng chỉ',
  'điều kiện học',
  'điều kiện đăng ký'
];

const GENERAL_INFORMATION_PHRASES = [
  'lịch thi'
];

const QUESTION_CUES = [
  'khi nào',
  'bao giờ',
  'là gì',
  'có chưa',
  'ở đâu',
  'bao nhiêu'
];

const STRONG_NEGATIVE_KEYWORDS = [
  'trả lời sai',
  'chatbot trả lời sai',
  'chatbot không hiểu',
  'sai thông tin',
  'sai tên',
  'sai lịch',
  'sai link',
  'sai ngày',
  'sai giờ',
  'sai lệ phí',
  'sai điểm',
  'sai sót',
  'không xem được',
  'không đăng nhập được',
  'không vào được',
  'không phản hồi',
  'chờ lâu',
  'hệ thống lỗi',
  'bị lỗi',
  'lỗi đăng nhập',
  'cần gặp nhân viên',
  'gặp tư vấn viên'
];

// ─── Trạng thái warm-up: request đầu tiên thành công → dùng timeout ngắn hơn ─
const FALLBACK_ISSUE_PATTERNS = [
  {
    issueType: 'missing_email_or_notification',
    patterns: [
      'chua thay mail', 'chua nhan mail', 'chua nhan duoc mail',
      'chua nhan email', 'chua nhan duoc email', 'chx nhan dc mail',
      'k nhan mail', 'ko nhan mail'
    ]
  },
  {
    issueType: 'payment_or_qr_issue',
    patterns: [
      'khong thay ma qr', 'khong co ma qr', 'chua thay ma qr',
      'chua co ma qr', 'ko thay ma qr', 'k thay ma qr'
    ]
  },
  {
    issueType: 'file_extract_or_document_issue',
    patterns: [
      'khong mo duoc file', 'khong mo dc file', 'khong tai duoc file',
      'k mo dc file', 'ko mo dc file', 'extract', 'giai nen',
      'yeu cau mat khau', 'file can mat khau'
    ]
  },
  {
    issueType: 'access_or_login_issue',
    patterns: [
      'khong dang nhap duoc', 'khong truy cap duoc', 'khong vao duoc',
      'kh vao duoc', 'kh vao', 'kh duoc', 'web bi sao',
      'khong the truy cap'
    ]
  },
  {
    issueType: 'contact_failure',
    patterns: [
      'khong ai tra loi', 'khong phan hoi', 'tra loi dum',
      'tra loi giup', 'goi khong ai nghe', 'khong nghe may'
    ]
  }
];

let isWarmedUp = false;

// ─── Structured logging helper ────────────────────────────────────────────────

/**
 * Ghi log dạng JSON line an toàn.
 * Chỉ ghi các trường kỹ thuật — KHÔNG ghi nội dung tin nhắn đầy đủ.
 *
 * @param {'info'|'warn'|'error'} level
 * @param {string} event
 * @param {object} [data]
 */
function logJson(level, event, data = {}) {
  try {
    const record = {
      level,
      event,
      ts: new Date().toISOString(),
      ...data
    };
    if (level === 'warn' || level === 'error') {
      console.warn(JSON.stringify(record));
    } else {
      console.log(JSON.stringify(record));
    }
  } catch {
    // Logging không bao giờ crash app
  }
}

function _escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _matchPhrase(text, phrase) {
  const escaped = _escapeRegex(String(phrase).toLowerCase());
  const pattern = new RegExp(`(^|${TOKEN_BOUNDARY})${escaped}(?=$|${TOKEN_BOUNDARY})`, 'u');
  return pattern.test(String(text || '').toLowerCase());
}

function _firstMatchedPhrase(text, phrases) {
  return phrases.find(phrase => _matchPhrase(text, phrase)) || null;
}

function _normalizeScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(Math.max(-1, Math.min(1, num)) * 1000) / 1000;
}

function _clampProbability(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.max(0, Math.min(1, num)) * 10000) / 10000;
}

function _normalizeLabel(value) {
  return ['positive', 'neutral', 'negative'].includes(value) ? value : 'neutral';
}

function _stripVietnameseAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function _normalizeForFallbackIssue(text) {
  return _stripVietnameseAccents(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\W_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _detectFallbackIssue(text) {
  const normalized = _normalizeForFallbackIssue(text);
  const padded = ` ${normalized} `;

  for (const group of FALLBACK_ISSUE_PATTERNS) {
    for (const pattern of group.patterns) {
      const normalizedPattern = _normalizeForFallbackIssue(pattern);
      if (normalizedPattern && padded.includes(` ${normalizedPattern} `)) {
        return {
          issueFlag: true,
          issueType: group.issueType,
          issueReason: `fallback matched pattern: ${pattern}`,
          issueConfidence: 0.7
        };
      }
    }
  }

  return {
    issueFlag: false,
    issueType: 'none',
    issueReason: 'fallback no issue pattern matched',
    issueConfidence: 0
  };
}

function _withProbabilityForLabel(result, label, score) {
  return {
    ...result,
    probabilities: _normalizeProbabilities(label, score)
  };
}

/**
 * Áp rule hybrid sau kết quả PhoBERT/cache/fallback.
 * Không thay đổi source để vẫn truy vết được nguồn phân tích ban đầu.
 *
 * @param {string} text
 * @param {object} result
 * @returns {object}
 */
function _applyHybridPostProcessing(text, result) {
  const base = {
    ...result,
    sentimentScore: _normalizeScore(result?.sentimentScore),
    matchedPositiveKeywords: Array.isArray(result?.matchedPositiveKeywords)
      ? [...result.matchedPositiveKeywords]
      : [],
    matchedNegativeKeywords: Array.isArray(result?.matchedNegativeKeywords)
      ? [...result.matchedNegativeKeywords]
      : []
  };

  const strongKeyword = _firstMatchedPhrase(text, STRONG_NEGATIVE_KEYWORDS);
  if (strongKeyword) {
    const score = base.sentimentScore < -0.15
      ? Math.min(base.sentimentScore, -0.8)
      : -0.8;
    return _withProbabilityForLabel({
      ...base,
      sentimentLabel: 'negative',
      sentimentScore: _normalizeScore(score),
      sentimentReason: `Hybrid override: phát hiện tín hiệu tiêu cực mạnh "${strongKeyword}".`,
      matchedNegativeKeywords: [...new Set([...base.matchedNegativeKeywords, strongKeyword])]
    }, 'negative', score);
  }

  const informationPhrase = _firstMatchedPhrase(text, INFORMATION_CONDITION_PHRASES);
  if (informationPhrase) {
    return _withProbabilityForLabel({
      ...base,
      sentimentLabel: 'neutral',
      sentimentScore: 0,
      sentimentReason: 'Câu hỏi về điều kiện/thông tin, không phải phản hồi tiêu cực.',
      matchedNegativeKeywords: []
    }, 'neutral', 0);
  }

  const generalInfoPhrase = _firstMatchedPhrase(text, GENERAL_INFORMATION_PHRASES);
  const hasQuestionCue = QUESTION_CUES.some(cue => _matchPhrase(text, cue));
  if (generalInfoPhrase && hasQuestionCue) {
    return _withProbabilityForLabel({
      ...base,
      sentimentLabel: 'neutral',
      sentimentScore: 0,
      sentimentReason: 'Câu hỏi thông tin, không phải phản hồi cảm xúc.',
      matchedNegativeKeywords: []
    }, 'neutral', 0);
  }

  return base;
}

// ─── LRU Cache đơn giản dùng Map ─────────────────────────────────────────────
// Map giữ thứ tự insertion → xóa phần tử cũ nhất khi đầy
const _cache = new Map();

/**
 * Lấy kết quả từ cache theo key.
 * Khi hit: delete rồi re-set để key trở thành mới nhất (LRU).
 */
function _cacheGet(key) {
  if (!_cache.has(key)) return null;
  const value = _cache.get(key);
  // LRU: đưa item lên cuối (newest)
  _cache.delete(key);
  _cache.set(key, value);
  return value;
}

/**
 * Lưu kết quả vào cache.
 * Nếu cache đầy, xóa phần tử cũ nhất (first key trong Map).
 */
function _cacheSet(key, value) {
  if (!key) return; // Không cache key rỗng
  if (_cache.size >= MAX_CACHE_SIZE) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, value);
}

/**
 * Tạo cache key bao gồm model version.
 * Khi MODEL_VERSION thay đổi, toàn bộ cache cũ tự trở thành miss.
 *
 * @param {string} normalizedText
 * @returns {string}
 */
function _cacheKey(normalizedText) {
  return `${SENTIMENT_MODE}:${ACTIVE_MODEL_VERSION}:${normalizedText}`;
}

// ─── HTTP helper: POST JSON ────────────────────────────────────────────────────

/**
 * Gửi POST request với body JSON, dùng http/https built-in.
 * @param {string} urlStr
 * @param {object} body
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
function _postJson(urlStr, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return reject(new Error(`URL không hợp lệ: ${urlStr}`));
    }

    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(
            `ml-service trả về HTTP ${res.statusCode}: ${raw.slice(0, 200)}`
          ));
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`ml-service trả về JSON không hợp lệ: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`ml-service timeout sau ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Gửi GET request, dùng http/https built-in.
 * @param {string} urlStr
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
function _getJson(urlStr, timeoutMs) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return reject(new Error(`URL không hợp lệ: ${urlStr}`));
    }

    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'GET'
    };

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(
            `ml-service trả về HTTP ${res.statusCode}: ${raw.slice(0, 200)}`
          ));
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`JSON không hợp lệ từ GET ${urlStr}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`GET ${urlStr} timeout sau ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

// ─── Helper: chuẩn hóa probabilities rule-based thành tổng = 1 ───────────────

/**
 * Tính probabilities chuẩn (tổng = 1) cho kết quả rule-based.
 *
 * Quy tắc:
 *  - positive: { positive: conf, neutral: 1-conf, negative: 0 }
 *  - negative: { positive: 0, neutral: 1-conf, negative: conf }
 *  - neutral:  { positive: 0, neutral: 1, negative: 0 }
 *
 * Nếu label là positive/negative nhưng confidence = 0, dùng mức tối thiểu 0.6
 * để phản ánh rằng đây là kết quả từ rule match (không phải ngẫu nhiên).
 *
 * @param {string} label    - 'positive' | 'negative' | 'neutral'
 * @param {number} rawScore - Giá trị sentimentScore từ rule-based [-1, 1]
 * @returns {{ positive: number, neutral: number, negative: number }}
 */
function _normalizeProbabilities(label, rawScore) {
  // Clamp confidence [0, 1]
  let conf = Math.min(1, Math.max(0, Math.abs(rawScore)));

  if (label === 'neutral') {
    return { positive: 0, neutral: 1, negative: 0 };
  }

  // Nếu label là positive/negative nhưng confidence = 0 → dùng tối thiểu 0.6
  if (conf === 0) {
    conf = 0.6;
  }

  const remain = Math.round((1 - conf) * 10000) / 10000;

  if (label === 'positive') {
    return {
      positive: Math.round(conf   * 10000) / 10000,
      neutral:  Math.round(remain * 10000) / 10000,
      negative: 0
    };
  }

  // label === 'negative'
  return {
    positive: 0,
    neutral:  Math.round(remain * 10000) / 10000,
    negative: Math.round(conf   * 10000) / 10000
  };
}

// ─── Normalize kết quả từ PhoBERT sang định dạng hệ thống ────────────────────

/**
 * Chuyển đổi kết quả từ ml-service sang định dạng chuẩn của hệ thống.
 * Tương thích 100% với output của sentiment-analyzer.service.js
 *
 * @param {object} item - Item từ ml-service /predict response
 * @returns {object} Kết quả chuẩn hóa
 */
function _normalizeAiResult(item) {
  const { label, score, confidence, rawLabel, probabilities } = item;

  const clampedScore = Math.max(-1.0, Math.min(1.0, score));
  const source = item?.source || 'phobert';
  const displaySource = source === 'visobert'
    ? 'ViSoBERT'
    : (source === 'ensemble' ? 'Ensemble' : 'PhoBERT');

  const pct = Math.round((confidence || 0) * 100);
  let sentimentReason;
  if (label === 'positive') {
    sentimentReason = `${displaySource} du doan cam xuc tich cuc voi do tin cay ${pct}%.`;
  } else if (label === 'negative') {
    sentimentReason = `${displaySource} du doan cam xuc tieu cuc voi do tin cay ${pct}%.`;
  } else {
    sentimentReason = `${displaySource} du doan cam xuc trung tinh voi do tin cay ${pct}%.`;
  }

  return {
    sentimentLabel:          label || 'neutral',
    sentimentScore:          Math.round(clampedScore * 1000) / 1000,
    sentimentReason,
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: [],
    source,
    confidence:              confidence || 0,
    rawLabel:                rawLabel || '',
    probabilities:           probabilities || { positive: 0, neutral: 1, negative: 0 }
  };
}

function _normalizeEnsembleResult(item) {
  const final = item?.final || {};
  const rule = item?.rule || {};
  const issue = item?.issue || {};
  const label = ['positive', 'neutral', 'negative'].includes(final.label)
    ? final.label
    : 'neutral';
  const score = _normalizeScore(final.score);
  const confidence = Math.max(0, Math.min(1, Number(final.confidence || 0)));
  const matchedKeyword = rule.matchedKeyword || null;
  const matchedPositiveKeywords = label === 'positive' && matchedKeyword
    ? [matchedKeyword]
    : [];
  const matchedNegativeKeywords = (label === 'negative' || final.needStaffReview || issue.issueFlag) && matchedKeyword
    ? [matchedKeyword]
    : [];

  return {
    sentimentLabel: label,
    sentimentScore: score,
    sentimentReason: `Ensemble final=${label}, confidence=${Math.round(confidence * 100)}%, reason=${final.reason || 'n/a'}.`,
    matchedPositiveKeywords,
    matchedNegativeKeywords,
    source: 'ensemble',
    analyzerVersion: item?.actualAnalyzerVersion || item?.analyzerVersion || ENSEMBLE_MODEL_VERSION,
    confidence,
    rawLabel: label.toUpperCase(),
    probabilities: final.probabilities || _normalizeProbabilities(label, score),
    needStaffReview: final.needStaffReview === true || issue.issueFlag === true,
    issueFlag: issue.issueFlag === true,
    issueType: issue.issueType || 'none',
    issueReason: issue.issueReason || '',
    issueConfidence: Number(issue.issueConfidence || 0),
    ensembleAudit: {
      rule,
      phobert: item?.phobert || null,
      visobert: item?.visobert || null,
      mode: item?.mode || null,
      actualAnalyzerVersion: item?.actualAnalyzerVersion || item?.analyzerVersion || null,
      visobertError: item?.visobertError || item?.visobert?.reason || null,
      issue: item?.issue || null,
      sentiment: item?.sentiment || null
    }
  };
}

function _normalizePredictProxyResult(item, response = {}) {
  const final = item?.final || item?.sentiment || item || {};
  const issue = item?.issue || {};
  const label = _normalizeLabel(final.label || item?.label);
  const confidence = _clampProbability(final.confidence ?? item?.confidence, 0);
  const issueFlag = issue.issueFlag === true;
  const analyzerVersion =
    item?.actualAnalyzerVersion ||
    item?.analyzerVersion ||
    response?.model ||
    ENSEMBLE_MODEL_VERSION;

  return {
    sentiment: {
      label,
      confidence
    },
    issue: {
      issueFlag,
      issueType: issue.issueType || 'none',
      issueReason: issue.issueReason || 'no issue metadata returned',
      issueConfidence: _clampProbability(issue.issueConfidence, 0)
    },
    needStaffReview: final.needStaffReview === true || item?.needStaffReview === true || issueFlag,
    analyzerVersion,
    actualAnalyzerVersion: analyzerVersion,
    source: 'ml-service',
    endpoint: '/predict-ensemble',
    sentimentMode: item?.mode || response?.mode || 'ensemble',
    phobert: item?.phobert || null,
    visobert: item?.visobert || null,
    rule: item?.rule || null
  };
}

function _buildPredictFallbackResult(text, error, ruleBasedAnalyzer) {
  const fallback = _ruleBasedResult(text || '', ruleBasedAnalyzer, 'rule-based-fallback');
  const normalized = _applyHybridPostProcessing(text || '', fallback);
  const issue = _detectFallbackIssue(text || '');
  const label = _normalizeLabel(normalized.sentimentLabel);
  const confidence = _clampProbability(normalized.confidence, Math.abs(Number(normalized.sentimentScore || 0)));

  return {
    sentiment: {
      label,
      confidence
    },
    issue,
    needStaffReview: issue.issueFlag === true || normalized.needStaffReview === true || label === 'negative',
    analyzerVersion: 'rule-based-fallback-v1',
    actualAnalyzerVersion: 'rule-based-fallback-v1',
    source: 'fallback',
    endpoint: '/predict-ensemble',
    mlServiceReachable: false,
    fallbackSource: 'backend-rule-based',
    fallbackReason: error?.message || String(error || 'ml-service unavailable')
  };
}

function _normalizeMlRuntimeHealth(response = {}) {
  const reachable = true;
  const phobertAvailable = response.phobertAvailable === true || response.phobertLoaded === true || response.modelLoaded === true;
  const visobertAvailable = response.visobertAvailable === true;
  const actualAnalyzerVersion =
    response.actualAnalyzerVersion ||
    response.activeAnalyzerVersion ||
    response.ensembleVersion ||
    (visobertAvailable ? 'ensemble-phobert-visobert-v1' : ENSEMBLE_MODEL_VERSION);
  const activeAnalyzerVersion = response.activeAnalyzerVersion || actualAnalyzerVersion;

  return {
    status: response.status || (response.success === false ? 'model_not_loaded' : 'ok'),
    mlServiceReachable: reachable,
    sentimentMode: response.sentimentMode || 'ensemble',
    phobertAvailable,
    visobertAvailable,
    visobertError: visobertAvailable ? null : (response.visobertError || 'ENABLE_VISOBERT=false'),
    requireVisobert: response.requireVisobert === true,
    activeAnalyzerVersion,
    actualAnalyzerVersion,
    issueDetectorAvailable: true,
    modelLoaded: response.modelLoaded === true,
    modelName: response.modelName || '',
    engine: response.engine || '',
    visobertModelName: response.visobertModelName || null,
    visobertStatus: visobertAvailable
      ? 'experimental_active_not_production_approved'
      : 'experimental_not_active',
    visobertNote: visobertAvailable
      ? 'ViSoBERT is reachable but remains experimental until separately approved for production automation.'
      : 'ViSoBERT is experimental and not active in production runtime.',
    success: response.success === true
  };
}

/**
 * Tạo kết quả từ rule-based analyzer với probabilities tổng = 1.
 *
 * @param {string} text
 * @param {object} ruleBasedAnalyzer
 * @param {string} sourceOverride - "rule-based" hoặc "rule-based-fallback"
 */
function _ruleBasedResult(text, ruleBasedAnalyzer, sourceOverride) {
  const result = ruleBasedAnalyzer.analyzeSentiment(text || '');
  const label  = result.sentimentLabel || 'neutral';
  const score  = result.sentimentScore || 0;

  // Tính confidence từ score, clamp [0, 1]
  const confidence = Math.min(1, Math.max(0, Math.abs(score)));

  // Probabilities chuẩn: tổng luôn = 1
  const probabilities = _normalizeProbabilities(label, score);

  return {
    ...result,
    source:       sourceOverride,
    confidence,
    rawLabel:     label.toUpperCase(),
    probabilities
  };
}

// ─── Chọn timeout theo trạng thái warm-up ─────────────────────────────────────

/**
 * Trả về timeout phù hợp:
 *  - Nếu chưa warm-up: TIMEOUT_FIRST_MS (dài hơn, cho cold start)
 *  - Nếu đã warm-up: TIMEOUT_MS (bình thường)
 */
function _getTimeoutMs() {
  return isWarmedUp ? TIMEOUT_MS : TIMEOUT_FIRST_MS;
}

// ─── Xử lý một batch gửi lên ml-service ──────────────────────────────────────

/**
 * Gửi một batch văn bản lên ml-service và map kết quả về.
 * Nếu thất bại (bất kỳ lý do nào), trả về fallback rule-based cho toàn batch.
 *
 * @param {string[]}  eligibleTexts
 * @param {number[]}  originalIndexes
 * @param {object[]}  resultSlots
 * @param {string[]}  inputTexts
 * @param {object}    ruleBasedAnalyzer
 */
async function _processBatchWithFallback(
  eligibleTexts,
  originalIndexes,
  resultSlots,
  inputTexts,
  ruleBasedAnalyzer
) {
  if (eligibleTexts.length === 0) return;

  const timeoutMs = _getTimeoutMs();
  const startTime = Date.now();

  try {
    const response = await _postJson(
      `${ML_SERVICE_URL}${PREDICT_ENDPOINT}`,
      { texts: eligibleTexts },
      timeoutMs
    );

    if (!response || !response.success || !Array.isArray(response.results)) {
      throw new Error('ml-service trả về response không hợp lệ');
    }

    const latencyMs = Date.now() - startTime;

    // Request thành công → đánh dấu đã warm-up
    isWarmedUp = true;

    logJson('info', 'ml_predict_success', {
      count:     eligibleTexts.length,
      latencyMs,
      source:    SENTIMENT_MODE === 'ensemble' ? 'ensemble' : 'phobert',
      endpoint:  PREDICT_ENDPOINT,
      timeout:   timeoutMs
    });

    originalIndexes.forEach((origIdx, batchIdx) => {
      const aiItem = response.results[batchIdx];

      if (!aiItem) {
        logJson('warn', 'ml_predict_fallback', {
          reason: 'missing_result',
          batchIdx,
          origIdx
        });
        const fallback = _ruleBasedResult(
          inputTexts[origIdx],
          ruleBasedAnalyzer,
          'rule-based-fallback'
        );
        resultSlots[origIdx] = _applyHybridPostProcessing(inputTexts[origIdx], fallback);
        return;
      }

      const baseResult = SENTIMENT_MODE === 'ensemble'
        ? _normalizeEnsembleResult(aiItem)
        : _normalizeAiResult(aiItem);
      const normalized = SENTIMENT_MODE === 'ensemble'
        ? baseResult
        : _applyHybridPostProcessing(inputTexts[origIdx], baseResult);
      resultSlots[origIdx] = normalized;

      // Cache key bao gồm model version → cache cũ tự động miss khi nâng cấp model
      const key = _cacheKey((inputTexts[origIdx] || '').trim());
      if (key) {
        _cacheSet(key, normalized);
      }
    });

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.message && err.message.includes('timeout');

    logJson('warn', isTimeout ? 'ml_predict_timeout' : 'ml_predict_fallback', {
      fallbackCount: eligibleTexts.length,
      latencyMs,
      timeout:      timeoutMs,
      errorMessage: err.message
    });

    originalIndexes.forEach((origIdx) => {
      const fallback = _ruleBasedResult(
        inputTexts[origIdx],
        ruleBasedAnalyzer,
        'rule-based-fallback'
      );
      resultSlots[origIdx] = _applyHybridPostProcessing(inputTexts[origIdx], fallback);
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Phân tích cảm xúc batch với PhoBERT + fallback rule-based.
 *
 * Luồng xử lý mỗi văn bản:
 *  1. null/rỗng/quá ngắn (< MIN_TEXT_LENGTH ký tự) → rule-based ngay
 *  2. Có trong cache (theo model version) → trả về cache
 *  3. Còn lại → gom thành batch gửi ml-service
 *  4. Nếu ml-service thất bại → fallback toàn batch đó
 *
 * @param {string[]} texts
 * @param {object}   ruleBasedAnalyzer
 * @returns {Promise<object[]>}
 */
async function analyzeBatch(texts, ruleBasedAnalyzer) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const results = new Array(texts.length).fill(null);

  for (let batchStart = 0; batchStart < texts.length; batchStart += BATCH_SIZE) {
    const batchSlice = texts.slice(batchStart, batchStart + BATCH_SIZE);

    const eligibleTexts   = [];
    const eligibleIndexes = [];

    batchSlice.forEach((text, localIdx) => {
      const globalIdx = batchStart + localIdx;
      const cleaned   = (text || '').trim();

      // Văn bản rỗng hoặc quá ngắn → rule-based ngay (không gửi lên ml-service)
      // MIN_TEXT_LENGTH mặc định 2 để bắt được "tệ", "ok", "tốt", v.v.
      // Chuỗi 1 ký tự vẫn dùng rule-based vì thường không đủ ngữ nghĩa
      if (!cleaned || cleaned.length < MIN_TEXT_LENGTH) {
        const ruleBased = _ruleBasedResult(cleaned, ruleBasedAnalyzer, 'rule-based');
        results[globalIdx] = _applyHybridPostProcessing(cleaned, ruleBased);
        return;
      }

      // Kiểm tra cache — key gồm model version để tránh trả kết quả của model cũ
      const key    = _cacheKey(cleaned);
      const cached = _cacheGet(key);
      if (cached) {
        const cacheSource = SENTIMENT_MODE === 'ensemble' ? 'ensemble' : 'cache';
        logJson('info', 'ml_cache_hit', { source: cacheSource, sentimentMode: SENTIMENT_MODE });
        results[globalIdx] = SENTIMENT_MODE === 'ensemble'
          ? { ...cached, source: 'ensemble' }
          : _applyHybridPostProcessing(cleaned, { ...cached, source: 'cache' });
        return;
      }

      eligibleTexts.push(cleaned);
      eligibleIndexes.push(globalIdx);
    });

    await _processBatchWithFallback(
      eligibleTexts,
      eligibleIndexes,
      results,
      texts.map(t => (t || '').trim()),
      ruleBasedAnalyzer
    );
  }

  return results;
}

/**
 * Phân tích cảm xúc cho một văn bản đơn lẻ.
 * Wrapper gọi analyzeBatch với mảng 1 phần tử.
 *
 * @param {string} text
 * @param {object} ruleBasedAnalyzer
 * @returns {Promise<object>}
 */
async function analyzeOne(text, ruleBasedAnalyzer) {
  const results = await analyzeBatch([text], ruleBasedAnalyzer);
  return results[0];
}

async function predictSingleForDashboard(text, ruleBasedAnalyzer) {
  const cleaned = (text || '').trim();
  const timeoutMs = _getTimeoutMs();
  const startTime = Date.now();

  try {
    const response = await _postJson(
      `${ML_SERVICE_URL}/predict-ensemble`,
      { texts: [cleaned] },
      timeoutMs
    );

    if (!response || response.success !== true || !Array.isArray(response.results)) {
      throw new Error('ml-service /predict-ensemble response is invalid');
    }

    const item = response.results[0];
    if (!item) {
      throw new Error('ml-service /predict-ensemble returned no prediction item');
    }

    isWarmedUp = true;
    logJson('info', 'ml_predict_proxy_success', {
      latencyMs: Date.now() - startTime,
      endpoint: '/predict-ensemble'
    });

    return _normalizePredictProxyResult(item, response);
  } catch (err) {
    logJson('warn', 'ml_predict_proxy_fallback', {
      latencyMs: Date.now() - startTime,
      endpoint: '/predict-ensemble',
      errorMessage: err.message
    });
    return _buildPredictFallbackResult(cleaned, err, ruleBasedAnalyzer);
  }
}

async function getMlRuntimeHealth() {
  try {
    const response = await _getJson(`${ML_SERVICE_URL}/health`, TIMEOUT_FIRST_MS);
    const health = _normalizeMlRuntimeHealth(response);

    logJson('info', 'ml_runtime_health_proxy', {
      reachable: true,
      status: health.status,
      actualAnalyzerVersion: health.actualAnalyzerVersion,
      visobertAvailable: health.visobertAvailable
    });

    return health;
  } catch (err) {
    logJson('warn', 'ml_runtime_health_proxy', {
      reachable: false,
      status: 'unreachable',
      errorMessage: err.message
    });

    return {
      status: 'unreachable',
      mlServiceReachable: false,
      sentimentMode: 'unavailable',
      phobertAvailable: false,
      visobertAvailable: false,
      visobertError: err.message,
      requireVisobert: false,
      activeAnalyzerVersion: 'rule-based-fallback-v1',
      actualAnalyzerVersion: 'unavailable',
      issueDetectorAvailable: false,
      modelLoaded: false,
      modelName: '',
      engine: '',
      visobertModelName: null,
      visobertStatus: 'experimental_not_active',
      visobertNote: 'ViSoBERT is experimental and not active because ml-service is unreachable.',
      success: false,
      error: err.message
    };
  }
}

/**
 * Kiểm tra trạng thái ml-service.
 * @returns {Promise<object>} { available: boolean, status: string }
 */
async function checkHealth() {
  try {
    const response = await _getJson(`${ML_SERVICE_URL}/health`, TIMEOUT_FIRST_MS);
    const available = response.success === true && response.modelLoaded === true;

    logJson('info', 'ml_health_check', {
      available,
      status:    response.status || 'unknown',
      modelName: response.modelName || '',
      sentimentMode: response.sentimentMode || SENTIMENT_MODE,
      visobertAvailable: response.visobertAvailable === true
    });

    return {
      available,
      status:      response.status || 'unknown',
      modelLoaded: response.modelLoaded || false,
      modelName:   response.modelName || '',
      engine:      response.engine || '',
      sentimentMode: response.sentimentMode || SENTIMENT_MODE,
      phobertAvailable: response.phobertAvailable === true,
      visobertAvailable: response.visobertAvailable === true,
      visobertError: response.visobertError || null,
      requireVisobert: response.requireVisobert === true,
      ensembleVersion: response.ensembleVersion || '',
      activeAnalyzerVersion: response.activeAnalyzerVersion || response.actualAnalyzerVersion || response.ensembleVersion || '',
      actualAnalyzerVersion: response.actualAnalyzerVersion || response.activeAnalyzerVersion || response.ensembleVersion || '',
      issueDetectorAvailable: true
    };
  } catch (err) {
    logJson('warn', 'ml_health_check', {
      available:    false,
      status:       'unreachable',
      errorMessage: err.message
    });
    return {
      available:   false,
      status:      'unreachable',
      error:       err.message,
      modelLoaded: false
    };
  }
}

/**
 * Proactive warm-up: gửi một văn bản ngắn đến ml-service ngay khi backend khởi động.
 *
 * Mục đích:
 *  - Khởi động ONNX Runtime trước request thật đầu tiên
 *  - Giảm rủi ro timeout vì cold start trong lần predict đầu tiên
 *
 * Hành vi:
 *  - Nếu ML_WARMUP_ENABLED=false → log ml_warmup_skipped và thoát ngay
 *  - Nếu thành công → đặt isWarmedUp=true, log ml_warmup_success
 *  - Nếu thất bại → chỉ log ml_warmup_failed, KHÔNG throw, backend vẫn chạy bình thường
 *
 * @returns {Promise<void>}
 */
async function warmUp() {
  if (!WARMUP_ENABLED) {
    logJson('info', 'ml_warmup_skipped', { reason: 'ML_WARMUP_ENABLED=false' });
    return;
  }

  const startTime = Date.now();

  try {
    const response = await _postJson(
      `${ML_SERVICE_URL}${PREDICT_ENDPOINT}`,
      { texts: [WARMUP_TEXT] },
      TIMEOUT_FIRST_MS
    );

    const latencyMs = Date.now() - startTime;

    if (!response || !response.success || !Array.isArray(response.results)) {
      throw new Error('ml-service trả về response warm-up không hợp lệ');
    }

    // Warm-up thành công → đánh dấu để dùng TIMEOUT_MS cho các request sau
    isWarmedUp = true;

    logJson('info', 'ml_warmup_success', {
      latencyMs,
      endpoint: PREDICT_ENDPOINT,
      sentimentMode: SENTIMENT_MODE,
      timeout: TIMEOUT_FIRST_MS
    });

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.message && err.message.includes('timeout');

    logJson('warn', 'ml_warmup_failed', {
      latencyMs,
      timeout:      TIMEOUT_FIRST_MS,
      isTimeout,
      errorMessage: err.message
    });

    // KHÔNG throw — backend vẫn tiếp tục hoạt động bình thường
    // Request thật đầu tiên vẫn dùng TIMEOUT_FIRST_MS và có fallback rule-based
  }
}

/**
 * Xóa toàn bộ cache.
 * Dùng khi cần debug hoặc sau khi re-train model.
 */
function clearCache() {
  _cache.clear();
  logJson('info', 'cache_cleared', { size: 0 });
}

/**
 * Trả về thống kê cache hiện tại.
 * @returns {{ size: number, maxSize: number, modelVersion: string }}
 */
function getCacheStats() {
  return {
    size:         _cache.size,
    maxSize:      MAX_CACHE_SIZE,
    modelVersion: ACTIVE_MODEL_VERSION,
    phobertModelVersion: MODEL_VERSION,
    ensembleModelVersion: ENSEMBLE_MODEL_VERSION,
    sentimentMode: SENTIMENT_MODE
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────
module.exports = {
  analyzeBatch,
  analyzeOne,
  predictSingleForDashboard,
  getMlRuntimeHealth,
  checkHealth,
  warmUp,
  clearCache,
  getCacheStats,
  // Export để test có thể đọc trạng thái internal
  _getIsWarmedUp:    () => isWarmedUp,
  _setIsWarmedUp:    (val) => { isWarmedUp = val; },
  _getWarmupEnabled: () => WARMUP_ENABLED,
  _getWarmupText:    () => WARMUP_TEXT,
  _applyHybridPostProcessing
};
