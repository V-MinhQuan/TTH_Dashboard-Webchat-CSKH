'use strict';

jest.mock('http', () => ({
  request: jest.fn()
}));

const { EventEmitter } = require('events');
const http = require('http');

const mockRuleBasedAnalyzer = {
  analyzeSentiment: jest.fn((text) => ({
    sentimentLabel: text.includes('loi') ? 'negative' : 'neutral',
    sentimentScore: text.includes('loi') ? -0.6 : 0,
    sentimentReason: 'mock rule-based fallback',
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: text.includes('loi') ? ['loi'] : []
  }))
};

function mockJsonResponse(responseBody, statusCode = 200, onBody) {
  http.request.mockImplementation((options, callback) => {
    const req = new EventEmitter();
    let body = '';
    req.write = jest.fn((chunk) => {
      body += chunk;
    });
    req.end = jest.fn(() => {
      if (onBody) onBody(options, body);
      const res = new EventEmitter();
      res.statusCode = statusCode;
      res.setEncoding = jest.fn();
      setImmediate(() => {
        callback(res);
        res.emit('data', JSON.stringify(responseBody));
        res.emit('end');
      });
    });
    req.setTimeout = jest.fn();
    req.destroy = jest.fn();
    return req;
  });
}

function mockRequestError(message) {
  http.request.mockImplementation(() => {
    const req = new EventEmitter();
    req.write = jest.fn();
    req.end = jest.fn(() => {
      setImmediate(() => req.emit('error', new Error(message)));
    });
    req.setTimeout = jest.fn();
    req.destroy = jest.fn();
    return req;
  });
}

describe('ai-sentiment proxy methods', () => {
  let aiSentimentService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ML_SERVICE_URL = 'http://localhost:8001';
    aiSentimentService = require('../services/ai-sentiment.service');
    aiSentimentService.clearCache();
    aiSentimentService._setIsWarmedUp(false);
    mockRuleBasedAnalyzer.analyzeSentiment.mockClear();
  });

  test('predictSingleForDashboard calls /predict-ensemble and preserves issue metadata', async () => {
    const captured = {};
    mockJsonResponse({
      success: true,
      mode: 'phobert_rule',
      model: 'ensemble-phobert-rule-v1',
      engine: 'ensemble',
      count: 1,
      results: [{
        text: 'em chua nhan duoc email xac nhan',
        mode: 'phobert_rule',
        final: {
          label: 'neutral',
          confidence: 0.76,
          score: 0,
          needStaffReview: true,
          reason: 'issue_detection',
          probabilities: { positive: 0, neutral: 1, negative: 0 }
        },
        rule: { priority: 'none' },
        phobert: { label: 'neutral', confidence: 0.76 },
        visobert: { available: false, error: 'ENABLE_VISOBERT=false' },
        issue: {
          issueFlag: true,
          issueType: 'missing_email_or_notification',
          issueReason: 'matched pattern: chua nhan email',
          issueConfidence: 0.9
        },
        analyzerVersion: 'ensemble-phobert-rule-v1',
        actualAnalyzerVersion: 'ensemble-phobert-rule-v1'
      }]
    }, 200, (options, body) => {
      captured.options = options;
      captured.body = JSON.parse(body);
    });

    const result = await aiSentimentService.predictSingleForDashboard(
      'em chua nhan duoc email xac nhan',
      mockRuleBasedAnalyzer
    );

    expect(captured.options.path).toBe('/predict-ensemble');
    expect(captured.body).toEqual({ texts: ['em chua nhan duoc email xac nhan'] });
    expect(result.sentiment).toEqual({ label: 'neutral', confidence: 0.76 });
    expect(result.issue.issueFlag).toBe(true);
    expect(result.issue.issueType).toBe('missing_email_or_notification');
    expect(result.issue.issueConfidence).toBe(0.9);
    expect(result.needStaffReview).toBe(true);
    expect(result.analyzerVersion).toBe('ensemble-phobert-rule-v1');
    expect(result.source).toBe('ml-service');
  });

  test('predictSingleForDashboard returns explicit fallback when ml-service fails', async () => {
    mockRequestError('ECONNREFUSED');

    const result = await aiSentimentService.predictSingleForDashboard(
      'em k mo dc file',
      mockRuleBasedAnalyzer
    );

    expect(result.source).toBe('fallback');
    expect(result.fallbackSource).toBe('backend-rule-based');
    expect(result.fallbackReason).toContain('ECONNREFUSED');
    expect(result.analyzerVersion).toBe('rule-based-fallback-v1');
    expect(result.issue.issueFlag).toBe(true);
    expect(result.issue.issueType).toBe('file_extract_or_document_issue');
    expect(result.needStaffReview).toBe(true);
  });

  test('getMlRuntimeHealth maps ViSoBERT unavailable as experimental not active', async () => {
    mockJsonResponse({
      success: true,
      status: 'ok',
      modelLoaded: true,
      modelName: 'wonrax/phobert-base-vietnamese-sentiment',
      engine: 'onnxruntime',
      sentimentMode: 'ensemble',
      phobertAvailable: true,
      visobertAvailable: false,
      visobertError: 'ENABLE_VISOBERT=false',
      actualAnalyzerVersion: 'ensemble-phobert-rule-v1',
      activeAnalyzerVersion: 'ensemble-phobert-rule-v1'
    });

    const health = await aiSentimentService.getMlRuntimeHealth();

    expect(health.status).toBe('ok');
    expect(health.mlServiceReachable).toBe(true);
    expect(health.phobertAvailable).toBe(true);
    expect(health.visobertAvailable).toBe(false);
    expect(health.visobertStatus).toBe('experimental_not_active');
    expect(health.visobertNote).toContain('experimental');
    expect(health.issueDetectorAvailable).toBe(true);
  });

  test('getMlRuntimeHealth maps offline response without claiming ML success', async () => {
    mockRequestError('connect ECONNREFUSED');

    const health = await aiSentimentService.getMlRuntimeHealth();

    expect(health.status).toBe('unreachable');
    expect(health.mlServiceReachable).toBe(false);
    expect(health.actualAnalyzerVersion).toBe('unavailable');
    expect(health.issueDetectorAvailable).toBe(false);
    expect(health.visobertNote).toContain('unreachable');
  });
});
