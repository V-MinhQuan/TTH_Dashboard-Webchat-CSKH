/**
 * Tests: Hybrid sentiment post-processing (TASK 1 + TASK 2 + TASK 4)
 *
 * Kiểm tra trực tiếp _applyHybridPostProcessing() và tích hợp với
 * satisfaction-score.service.js để đảm bảo toàn bộ pipeline hoạt động đúng.
 *
 * Cấu trúc:
 *  - Suite A: Neutral whitelist "điều kiện" → neutral (TASK 1)
 *  - Suite B: Strong negative override → negative (TASK 1)
 *  - Suite C: Priority — strong negative > whitelist (TASK 1)
 *  - Suite D: General info question (lịch thi + cue) → neutral (TASK 1)
 *  - Suite E: needStaffReview enforcement (TASK 2)
 *  - Suite F: Reprocess sample — format compatibility (TASK 3)
 *
 * Cách chạy: npm test (từ thư mục backend/)
 */

'use strict';

// Mock http để aiSentimentService không gọi network thật
jest.mock('http', () => ({ request: jest.fn() }));

// Load services
const aiSentimentService = require('../services/ai-sentiment.service');
const satisfactionScore  = require('../services/satisfaction-score.service');

// Lấy _applyHybridPostProcessing để test trực tiếp
const { _applyHybridPostProcessing } = aiSentimentService;

// ─── Helper: tạo kết quả PhoBERT giả với label bất kỳ ───────────────────────
function makePhoBERTResult(label, score = null) {
  const s = score !== null ? score : (label === 'positive' ? 0.85 : label === 'negative' ? -0.85 : 0);
  return {
    sentimentLabel:          label,
    sentimentScore:          s,
    sentimentReason:         `PhoBERT dự đoán cảm xúc với độ tin cậy 85%.`,
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: [],
    source:                  'phobert',
    confidence:              0.85,
    rawLabel:                label.toUpperCase().slice(0, 3),
    probabilities:           {
      positive: label === 'positive' ? 0.85 : 0.05,
      neutral:  label === 'neutral'  ? 0.85 : 0.10,
      negative: label === 'negative' ? 0.85 : 0.05
    }
  };
}

// ─── Helper: tạo neutral rule-based result ────────────────────────────────────
function makeRuleBasedNeutral() {
  return {
    sentimentLabel:          'neutral',
    sentimentScore:          0,
    sentimentReason:         'Không phát hiện tín hiệu cảm xúc rõ ràng',
    matchedPositiveKeywords: [],
    matchedNegativeKeywords: [],
    source:                  'rule-based',
    confidence:              0,
    rawLabel:                'NEU',
    probabilities:           { positive: 0, neutral: 1, negative: 0 }
  };
}

// ─── Helper: tính needStaffReview qua satisfaction service ───────────────────
function calcNeedStaffReview(result, cleanedText) {
  const satisf = satisfactionScore.calculateSatisfactionScore({
    sentimentScore:          result.sentimentScore,
    sentimentLabel:          result.sentimentLabel,
    matchedNegativeKeywords: result.matchedNegativeKeywords || [],
    cleanedText:             cleanedText
  });
  return satisf.needStaffReview;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Suite A — Neutral whitelist: câu hỏi "điều kiện" → neutral
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite A: Neutral whitelist (điều kiện)', () => {

  const WHITELIST_CASES = [
    { text: 'điều kiện ra trường là gì',           desc: 'điều kiện ra trường' },
    { text: 'điều kiện chuẩn đầu ra toeic là gì',  desc: 'điều kiện chuẩn đầu ra + TOEIC' },
    { text: 'em muốn hỏi điều kiện thi vstep',     desc: 'điều kiện thi VSTEP' },
    { text: 'điều kiện tốt nghiệp cần chứng chỉ gì', desc: 'điều kiện tốt nghiệp' },
    { text: 'điều kiện xét chứng chỉ là gì',       desc: 'điều kiện xét chứng chỉ' },
    { text: 'điều kiện đăng ký học phần',          desc: 'điều kiện đăng ký' },
    { text: 'điều kiện học tiếng anh',             desc: 'điều kiện học' }
  ];

  test.each(WHITELIST_CASES)(
    '$desc → sentimentLabel = "neutral"',
    ({ text }) => {
      // Mô phỏng PhoBERT sai (negative) cho các câu hỏi thông tin
      const phobertNegative = makePhoBERTResult('negative', -0.7);
      const result = _applyHybridPostProcessing(text, phobertNegative);

      expect(result.sentimentLabel).toBe('neutral');
      expect(result.sentimentScore).toBe(0);
    }
  );

  test('điều kiện ra trường là gì → sentimentReason đề cập câu hỏi thông tin', () => {
    const result = _applyHybridPostProcessing(
      'điều kiện ra trường là gì',
      makePhoBERTResult('negative', -0.7)
    );

    expect(result.sentimentReason).toMatch(/điều kiện|thông tin/i);
  });

  test('điều kiện chuẩn đầu ra toeic là gì → matchedNegativeKeywords phải rỗng sau override', () => {
    const phobertNeg = {
      ...makePhoBERTResult('negative', -0.7),
      matchedNegativeKeywords: ['toeic']  // giả sử có keyword
    };
    const result = _applyHybridPostProcessing(
      'điều kiện chuẩn đầu ra toeic là gì',
      phobertNeg
    );

    expect(result.sentimentLabel).toBe('neutral');
    // Override neutral phải xóa matchedNegativeKeywords
    expect(result.matchedNegativeKeywords).toEqual([]);
  });

  test('câu hỏi điều kiện được PhoBERT đoán đúng neutral → vẫn là neutral', () => {
    const phobertNeutral = makePhoBERTResult('neutral', 0);
    const result = _applyHybridPostProcessing(
      'điều kiện ra trường là gì',
      phobertNeutral
    );

    expect(result.sentimentLabel).toBe('neutral');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suite B — Strong negative override
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite B: Strong negative override', () => {

  const NEGATIVE_CASES = [
    {
      text: 'chatbot trả lời sai rồi',
      desc: 'chatbot trả lời sai',
      expectKeyword: 'trả lời sai'
    },
    {
      text: 'sai thông tin nhận bằng',
      desc: 'sai thông tin',
      expectKeyword: 'sai thông tin'
    },
    {
      text: 'không xem được điểm thi',
      desc: 'không xem được',
      expectKeyword: 'không xem được'
    },
    {
      text: 'em không đăng nhập được',
      desc: 'không đăng nhập được',
      expectKeyword: 'không đăng nhập được'
    },
    {
      text: 'hệ thống bị lỗi liên tục',
      desc: 'bị lỗi',
      expectKeyword: 'bị lỗi'
    },
    {
      text: 'chờ lâu quá mà chưa có phản hồi',
      desc: 'chờ lâu',
      expectKeyword: 'chờ lâu'
    },
    {
      text: 'chatbot không hiểu câu hỏi của em',
      desc: 'chatbot không hiểu',
      expectKeyword: 'chatbot không hiểu'
    },
    {
      text: 'sai ngày thi trên lịch',
      desc: 'sai ngày',
      expectKeyword: 'sai ngày'
    },
    {
      text: 'lỗi đăng nhập hoài',
      desc: 'lỗi đăng nhập',
      expectKeyword: 'lỗi đăng nhập'
    },
    {
      text: 'cần gặp nhân viên để giải quyết',
      desc: 'cần gặp nhân viên',
      expectKeyword: 'cần gặp nhân viên'
    },
    {
      text: 'gặp tư vấn viên trực tiếp được không',
      desc: 'gặp tư vấn viên',
      expectKeyword: 'gặp tư vấn viên'
    },
    {
      text: 'không phản hồi gì hết',
      desc: 'không phản hồi',
      expectKeyword: 'không phản hồi'
    }
  ];

  test.each(NEGATIVE_CASES)(
    '$desc → sentimentLabel = "negative"',
    ({ text }) => {
      // Mô phỏng PhoBERT sai (neutral) — override phải chuyển thành negative
      const phobertNeutral = makePhoBERTResult('neutral', 0);
      const result = _applyHybridPostProcessing(text, phobertNeutral);

      expect(result.sentimentLabel).toBe('negative');
    }
  );

  test.each(NEGATIVE_CASES)(
    '$desc → sentimentScore < -0.15 (thực sự âm)',
    ({ text }) => {
      const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
      expect(result.sentimentScore).toBeLessThan(-0.15);
    }
  );

  test('strong override: sentimentReason phải đề cập tín hiệu tiêu cực mạnh bằng tiếng Việt', () => {
    const result = _applyHybridPostProcessing(
      'chatbot trả lời sai rồi',
      makePhoBERTResult('neutral', 0)
    );

    expect(result.sentimentReason).toMatch(/tiêu cực|override|trả lời sai/i);
  });

  test('strong override: matchedNegativeKeywords phải bao gồm keyword đã phát hiện', () => {
    const result = _applyHybridPostProcessing(
      'em không đăng nhập được',
      makePhoBERTResult('neutral', 0)
    );

    expect(result.matchedNegativeKeywords.length).toBeGreaterThan(0);
    expect(result.matchedNegativeKeywords).toContain('không đăng nhập được');
  });

  test('strong override: score gốc đã âm sẵn → giữ giá trị âm hơn (min)', () => {
    // PhoBERT trả về -0.3, override phải đưa về -0.8 (mức tối thiểu)
    const result = _applyHybridPostProcessing(
      'sai thông tin nhận bằng',
      makePhoBERTResult('negative', -0.3)
    );

    expect(result.sentimentScore).toBeLessThanOrEqual(-0.8);
  });

  test('strong override: score gốc đã rất âm (-0.95) → không thay đổi thêm', () => {
    // Score gốc -0.95 → giữ min(-0.95, -0.8) = -0.95
    const result = _applyHybridPostProcessing(
      'hệ thống bị lỗi',
      makePhoBERTResult('negative', -0.95)
    );

    expect(result.sentimentScore).toBeLessThanOrEqual(-0.8);
    expect(result.sentimentLabel).toBe('negative');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suite C — Priority: strong negative > điều kiện whitelist
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite C: Priority (strong negative > whitelist)', () => {

  test('chatbot trả lời sai điều kiện tốt nghiệp → negative (strong override wins)', () => {
    // Chứa cả "trả lời sai" (strong negative) VÀ "điều kiện tốt nghiệp" (whitelist)
    const text = 'chatbot trả lời sai điều kiện tốt nghiệp';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));

    // Strong negative phải thắng
    expect(result.sentimentLabel).toBe('negative');
  });

  test('trả lời sai điều kiện chuẩn đầu ra → negative', () => {
    const text = 'trả lời sai điều kiện chuẩn đầu ra';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
    expect(result.sentimentLabel).toBe('negative');
  });

  test('không xem được điều kiện thi → negative (strong negative wins)', () => {
    const text = 'không xem được điều kiện thi';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
    // "không xem được" là strong negative keyword
    expect(result.sentimentLabel).toBe('negative');
  });

  test('sai thông tin về điều kiện đăng ký → negative', () => {
    const text = 'sai thông tin về điều kiện đăng ký';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('positive', 0.5));
    expect(result.sentimentLabel).toBe('negative');
  });

  test('câu hỏi thuần túy về điều kiện (không có strong negative) → neutral', () => {
    const text = 'điều kiện tốt nghiệp cần chứng chỉ gì';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('negative', -0.7));
    // Không có strong negative → whitelist thắng
    expect(result.sentimentLabel).toBe('neutral');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suite D — General info question (lịch thi + question cue) → neutral
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite D: General information questions', () => {

  test('lịch thi TOEIC khi nào có → neutral', () => {
    const text = 'lịch thi toeic khi nào có';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('negative', -0.4));
    expect(result.sentimentLabel).toBe('neutral');
  });

  test('lịch thi ở đâu → neutral', () => {
    const text = 'lịch thi ở đâu';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('negative', -0.4));
    expect(result.sentimentLabel).toBe('neutral');
  });

  test('lịch thi bao giờ có → neutral', () => {
    const text = 'lịch thi bao giờ có';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('negative', -0.4));
    expect(result.sentimentLabel).toBe('neutral');
  });

  test('lịch thi sai ngày → negative (strong negative wins over lịch thi)', () => {
    // "sai ngày" là strong negative keyword
    const text = 'lịch thi sai ngày rồi';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
    expect(result.sentimentLabel).toBe('negative');
  });

  test('câu hỏi thuần thông tin (không có strong negative, không có whitelist) → không bị override', () => {
    const text = 'trường mình có bao nhiêu khoa';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('positive', 0.6));
    // Không thay đổi — giữ nguyên PhoBERT
    expect(result.sentimentLabel).toBe('positive');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suite E — needStaffReview enforcement (TASK 2)
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite E: needStaffReview enforcement', () => {

  test('sentimentLabel=negative luôn → needStaffReview=true', () => {
    const result = _applyHybridPostProcessing(
      'em không đăng nhập được',
      makePhoBERTResult('neutral', 0)
    );
    // Override → negative
    const needReview = calcNeedStaffReview(result, 'em không đăng nhập được');
    expect(result.sentimentLabel).toBe('negative');
    expect(needReview).toBe(true);
  });

  test('"điều kiện ra trường là gì" → neutral + needStaffReview=false', () => {
    const text = 'điều kiện ra trường là gì';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('negative', -0.8));
    const needReview = calcNeedStaffReview(result, text);

    expect(result.sentimentLabel).toBe('neutral');
    expect(needReview).toBe(false);
  });

  test('"chatbot trả lời sai điều kiện tốt nghiệp" → negative + needStaffReview=true', () => {
    const text = 'chatbot trả lời sai điều kiện tốt nghiệp';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
    const needReview = calcNeedStaffReview(result, text);

    expect(result.sentimentLabel).toBe('negative');
    expect(needReview).toBe(true);
  });

  test('"em không đăng nhập được" → negative + needStaffReview=true', () => {
    const text = 'em không đăng nhập được';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
    const needReview = calcNeedStaffReview(result, text);

    expect(result.sentimentLabel).toBe('negative');
    expect(needReview).toBe(true);
  });

  test('"lịch thi TOEIC khi nào có" → neutral + needStaffReview=false', () => {
    const text = 'lịch thi toeic khi nào có';
    const result = _applyHybridPostProcessing(text, makePhoBERTResult('negative', -0.4));
    const needReview = calcNeedStaffReview(result, text);

    expect(result.sentimentLabel).toBe('neutral');
    expect(needReview).toBe(false);
  });

  test('satisfactionScore < 40 luôn → needStaffReview=true (dù sentiment trung tính)', () => {
    // Dùng satisfaction score service trực tiếp với score âm mạnh
    const satisf = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: -0.7,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: ['thất vọng'],
      cleanedText: 'thất vọng quá'
    });

    expect(satisf.satisfactionScore).toBeLessThan(40);
    expect(satisf.needStaffReview).toBe(true);
  });

  test('từ khóa "trả lời sai" luôn → needStaffReview=true (dù sentiment score = 0)', () => {
    // Kiểm tra satisfaction service nhận diện keyword "trả lời sai" qua cleanedText
    const satisf = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'chatbot trả lời sai thông tin rồi'
    });

    expect(satisf.needStaffReview).toBe(true);
  });

  test('từ khóa "sai thông tin" trong cleanedText → needStaffReview=true', () => {
    const satisf = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'sai thông tin nhận bằng rồi'
    });

    expect(satisf.needStaffReview).toBe(true);
  });

  test('từ khóa "không đăng nhập được" → needStaffReview=true', () => {
    const satisf = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'em không đăng nhập được hệ thống'
    });

    expect(satisf.needStaffReview).toBe(true);
  });

  test('từ khóa "hệ thống lỗi" → needStaffReview=true', () => {
    const satisf = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0,
      sentimentLabel: 'neutral',
      matchedNegativeKeywords: [],
      cleanedText: 'hệ thống lỗi không vào được'
    });

    expect(satisf.needStaffReview).toBe(true);
  });

  test('cảm xúc tích cực thuần túy → needStaffReview=false', () => {
    const satisf = satisfactionScore.calculateSatisfactionScore({
      sentimentScore: 0.9,
      sentimentLabel: 'positive',
      matchedNegativeKeywords: [],
      cleanedText: 'cảm ơn tư vấn rất nhiệt tình'
    });

    expect(satisf.needStaffReview).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suite F — Output format: hybrid kết quả vẫn tương thích pipeline
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite F: Pipeline output format compatibility', () => {

  const REQUIRED_FIELDS = [
    'sentimentLabel', 'sentimentScore', 'sentimentReason',
    'matchedPositiveKeywords', 'matchedNegativeKeywords',
    'source', 'confidence', 'rawLabel', 'probabilities'
  ];

  test('kết quả hybrid phải có đầy đủ tất cả trường bắt buộc', () => {
    const result = _applyHybridPostProcessing(
      'điều kiện ra trường là gì',
      makePhoBERTResult('negative', -0.7)
    );

    REQUIRED_FIELDS.forEach(field => {
      expect(result).toHaveProperty(field);
    });
  });

  test('kết quả hybrid override negative phải có đầy đủ trường', () => {
    const result = _applyHybridPostProcessing(
      'chatbot trả lời sai rồi',
      makePhoBERTResult('neutral', 0)
    );

    REQUIRED_FIELDS.forEach(field => {
      expect(result).toHaveProperty(field);
    });
  });

  test('sentimentLabel phải luôn là một trong 3 giá trị hợp lệ', () => {
    const VALID_LABELS = ['positive', 'negative', 'neutral'];
    const CASES = [
      'điều kiện ra trường là gì',
      'chatbot trả lời sai rồi',
      'cảm ơn hỗ trợ tốt',
      'lịch thi toeic khi nào có',
      'em không đăng nhập được'
    ];

    CASES.forEach(text => {
      const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
      expect(VALID_LABELS).toContain(result.sentimentLabel);
    });
  });

  test('sentimentScore phải luôn trong [-1, 1]', () => {
    const CASES = [
      { text: 'điều kiện ra trường là gì', phobert: makePhoBERTResult('negative', -0.9) },
      { text: 'chatbot trả lời sai rồi',  phobert: makePhoBERTResult('neutral',  0) },
      { text: 'rất hài lòng với dịch vụ', phobert: makePhoBERTResult('positive', 0.9) }
    ];

    CASES.forEach(({ text, phobert }) => {
      const result = _applyHybridPostProcessing(text, phobert);
      expect(result.sentimentScore).toBeGreaterThanOrEqual(-1);
      expect(result.sentimentScore).toBeLessThanOrEqual(1);
    });
  });

  test('probabilities phải tổng ≈ 1', () => {
    const CASES = [
      'điều kiện ra trường là gì',
      'chatbot trả lời sai rồi',
      'em không đăng nhập được'
    ];

    CASES.forEach(text => {
      const result = _applyHybridPostProcessing(text, makePhoBERTResult('neutral', 0));
      if (result.probabilities) {
        const sum = (result.probabilities.positive || 0) +
                    (result.probabilities.neutral  || 0) +
                    (result.probabilities.negative || 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
      }
    });
  });

  test('source phải được giữ nguyên từ PhoBERT sau hybrid override', () => {
    const result = _applyHybridPostProcessing(
      'điều kiện ra trường là gì',
      makePhoBERTResult('negative', -0.7)
    );
    // Hybrid override không thay đổi source — vẫn truy vết được PhoBERT là nguồn gốc
    expect(result.source).toBe('phobert');
  });

  test('null/undefined text không crash _applyHybridPostProcessing', () => {
    expect(() => _applyHybridPostProcessing(null,      makeRuleBasedNeutral())).not.toThrow();
    expect(() => _applyHybridPostProcessing(undefined, makeRuleBasedNeutral())).not.toThrow();
    expect(() => _applyHybridPostProcessing('',        makeRuleBasedNeutral())).not.toThrow();
  });

  test('null/undefined result không crash _applyHybridPostProcessing', () => {
    // Test edge case: nếu ai đó truyền result không hợp lệ
    expect(() => _applyHybridPostProcessing('text thử', {})).not.toThrow();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Suite G — Reprocess sample API format compatibility (TASK 3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('HybridPostProcessing — Suite G: Reprocess sample format compatibility', () => {

  // Mock DB + ai-sentiment để test analytics.service trực tiếp
  let analyticsService;
  let analyticsRepository;
  let aiSentimentServiceMock;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../config/db', () => ({
      sql: {
        Transaction: jest.fn().mockImplementation(() => ({
          begin:    jest.fn().mockResolvedValue(undefined),
          commit:   jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined)
        })),
        Request: jest.fn().mockImplementation(() => ({
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockResolvedValue({ recordset: [] })
        }))
      },
      poolPromise: Promise.resolve({
        request: () => ({
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockResolvedValue({ recordset: [] })
        })
      })
    }));

    jest.doMock('../repositories/analytics.repository');
    jest.doMock('../services/ai-sentiment.service');
  });

  test('runAnalytics({ limit: 100, force: true, mode: "reprocess-sample" }) trả về đúng summary fields', async () => {
    const { default: analyticsRepositoryMock } = await import('../repositories/analytics.repository').catch(() => ({}));
    jest.mock('../repositories/analytics.repository');

    const analyticsServiceLocal = require('../services/analytics.service');
    const analyticsRepositoryLocal = require('../repositories/analytics.repository');
    const aiServiceLocal = require('../services/ai-sentiment.service');

    analyticsRepositoryLocal.getUnanalyzedMessages = jest.fn().mockResolvedValue([
      { messageId: 1, textContent: 'em không đăng nhập được',   conversationId: 10, customerId: 'C1', source: 'ZaloOA', messageAt: new Date() },
      { messageId: 2, textContent: 'điều kiện ra trường là gì', conversationId: 11, customerId: 'C2', source: 'FB',     messageAt: new Date() }
    ]);
    analyticsRepositoryLocal.saveMessageAnalytics         = jest.fn().mockResolvedValue(2);
    analyticsRepositoryLocal.deleteAnalyticsByMessageIds  = jest.fn().mockResolvedValue(undefined);

    aiServiceLocal.analyzeBatch = jest.fn().mockResolvedValue([
      {
        sentimentLabel: 'neutral', sentimentScore: 0, sentimentReason: 'Test PhoBERT neutral',
        matchedPositiveKeywords: [], matchedNegativeKeywords: [],
        source: 'phobert', confidence: 0.5, rawLabel: 'NEU',
        probabilities: { positive: 0.1, neutral: 0.8, negative: 0.1 }
      },
      {
        sentimentLabel: 'negative', sentimentScore: -0.9, sentimentReason: 'PhoBERT tiêu cực',
        matchedPositiveKeywords: [], matchedNegativeKeywords: [],
        source: 'phobert', confidence: 0.9, rawLabel: 'NEG',
        probabilities: { positive: 0.05, neutral: 0.05, negative: 0.9 }
      }
    ]);

    const result = await analyticsServiceLocal.runAnalytics({
      limit: 100,
      forceReanalyze: true,
      mode: 'reprocess-sample'
    });

    // Kiểm tra tất cả fields bắt buộc trong response summary
    expect(result).toHaveProperty('selected');
    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('saved');
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('phobertCount');
    expect(result).toHaveProperty('fallbackCount');
    expect(result).toHaveProperty('negativeCount');
    expect(result).toHaveProperty('needStaffReviewCount');
    expect(result).toHaveProperty('mode');

    expect(result.mode).toBe('reprocess-sample');
    expect(result.selected).toBe(2);
  });

  test('runAnalytics với limit=100 KHÔNG reprocess quá limit', async () => {
    const analyticsServiceLocal = require('../services/analytics.service');
    const analyticsRepositoryLocal = require('../repositories/analytics.repository');
    const aiServiceLocal = require('../services/ai-sentiment.service');

    // Repository chỉ trả về 2 rows (đã bị limit bởi repository)
    analyticsRepositoryLocal.getUnanalyzedMessages = jest.fn().mockResolvedValue([
      { messageId: 1, textContent: 'test message 1', conversationId: 10, customerId: 'C1', source: 'ZaloOA', messageAt: new Date() },
      { messageId: 2, textContent: 'test message 2', conversationId: 11, customerId: 'C2', source: 'FB',     messageAt: new Date() }
    ]);
    analyticsRepositoryLocal.saveMessageAnalytics        = jest.fn().mockResolvedValue(2);
    analyticsRepositoryLocal.deleteAnalyticsByMessageIds = jest.fn().mockResolvedValue(undefined);
    aiServiceLocal.analyzeBatch = jest.fn().mockResolvedValue([
      { sentimentLabel: 'neutral', sentimentScore: 0, sentimentReason: 'test', matchedPositiveKeywords: [], matchedNegativeKeywords: [], source: 'phobert', confidence: 0.5, rawLabel: 'NEU', probabilities: { positive: 0.1, neutral: 0.8, negative: 0.1 } },
      { sentimentLabel: 'neutral', sentimentScore: 0, sentimentReason: 'test', matchedPositiveKeywords: [], matchedNegativeKeywords: [], source: 'phobert', confidence: 0.5, rawLabel: 'NEU', probabilities: { positive: 0.1, neutral: 0.8, negative: 0.1 } }
    ]);

    const result = await analyticsServiceLocal.runAnalytics({
      limit: 100,
      forceReanalyze: true,
      mode: 'reprocess-sample'
    });

    // Phải gọi repository với limit=100 (không tự mình tăng)
    expect(analyticsRepositoryLocal.getUnanalyzedMessages).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
    // Kết quả phải là số rows repository trả về (2), không phải 100
    expect(result.selected).toBe(2);
    // deleteAnalyticsByMessageIds chỉ xóa các messageId đã chọn (không xóa toàn bộ)
    expect(analyticsRepositoryLocal.deleteAnalyticsByMessageIds).toHaveBeenCalledWith([1, 2]);
  });
});
