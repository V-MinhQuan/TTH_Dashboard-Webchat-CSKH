/**
 * Service: Phan tich cam xuc tieng Viet (rule-based fallback)
 *
 * Rule nay dung khi PhoBERT khong san sang hoac trong unit test. Interface
 * duoc giu nguyen de khong anh huong pipeline analytics.
 */

const TOKEN_BOUNDARY = '[^\\p{L}\\p{N}]';

const POSITIVE_KEYWORDS = {
  'tot': 0.4,
  'tot lam': 0.6,
  'tot qua': 0.6,
  'rat tot': 0.8,
  'tuyet': 0.6,
  'tuyet voi': 0.9,
  'xuat sac': 0.9,
  'hai long': 0.7,
  'rat hai long': 0.9,
  'cam on': 0.4,
  'cam on rat nhieu': 0.7,
  'cam on nhieu': 0.6,
  'thanks': 0.3,
  'thank you': 0.4,
  'ok roi': 0.3,
  'duoc roi': 0.3,
  'on roi': 0.4,
  'nhanh': 0.4,
  'nhanh chong': 0.5,
  'kip thoi': 0.5,
  'nhiet tinh': 0.6,
  'chu dao': 0.6,
  'chuyen nghiep': 0.7,
  'than thien': 0.5,
  'de hieu': 0.5,
  'ro rang': 0.5,
  'tu van ro': 0.5,
  'tu van tot': 0.7,
  'ho tro tot': 0.7,
  'giai quyet nhanh': 0.7,
  'giai quyet duoc': 0.6,
  'da xong': 0.4,
  'hoan thanh': 0.4,
  'chinh xac': 0.4,
  'dang tin': 0.5,
  'ung ho': 0.5,
  'thich': 0.4,
  'rat thich': 0.6,

  'tốt': 0.4,
  'tốt lắm': 0.6,
  'tốt quá': 0.6,
  'rất tốt': 0.8,
  'tuyệt': 0.6,
  'tuyệt vời': 0.9,
  'xuất sắc': 0.9,
  'hài lòng': 0.7,
  'rất hài lòng': 0.9,
  'cảm ơn': 0.4,
  'cảm ơn rất nhiều': 0.7,
  'cảm ơn nhiều': 0.6,
  'được rồi': 0.3,
  'ổn rồi': 0.4,
  'nhanh': 0.4,
  'nhanh chóng': 0.5,
  'kịp thời': 0.5,
  'nhiệt tình': 0.6,
  'chu đáo': 0.6,
  'chuyên nghiệp': 0.7,
  'thân thiện': 0.5,
  'dễ hiểu': 0.5,
  'rõ ràng': 0.5,
  'tư vấn rõ': 0.5,
  'tư vấn tốt': 0.7,
  'hỗ trợ tốt': 0.7,
  'giải quyết nhanh': 0.7,
  'giải quyết được': 0.6,
  'đã xong': 0.4,
  'hoàn thành': 0.4,
  'chính xác': 0.4,
  'đáng tin': 0.5,
  'ủng hộ': 0.5,
  'thích': 0.4,
  'rất thích': 0.6
};

const NEGATIVE_KEYWORDS = {
  'te': -0.6,
  'te qua': -0.8,
  'rat te': -0.9,
  'kem': -0.5,
  'do': -0.5,
  'toi': -0.6,
  'cho lau': -0.6,
  'cho mai': -0.7,
  'doi lau': -0.6,
  'cham tre': -0.6,
  'rat cham': -0.7,
  'qua cham': -0.7,
  'khong nhiet tinh': -0.5,
  'thieu chuyen nghiep': -0.7,
  'khong giai quyet': -0.7,
  'khong xu ly': -0.6,
  'chua giai quyet': -0.5,
  'khong ho tro': -0.6,
  'khong giup do': -0.6,
  'bo qua': -0.5,
  'khong phan hoi': -0.7,
  'khong tra loi': -0.6,
  'hong': -0.7,
  'loi': -0.5,
  'bi loi': -0.6,
  'sai': -0.5,
  'that vong': -0.7,
  'rat that vong': -0.9,
  'buc xuc': -0.7,
  'rat buc xuc': -0.9,
  'tuc gian': -0.8,
  'kho chiu': -0.5,
  'phan nan': -0.5,
  'khieu nai': -0.6,
  'khong hai long': -0.7,
  'khong chap nhan': -0.7,
  'lua dao': -0.9,
  'gian lan': -0.9,
  'to cao': -0.8,
  'khoi kien': -0.9,
  'khieu kien': -0.8,
  'kien cao': -0.8,
  'dang len mang': -0.6,
  'review xau': -0.6,
  'khong dang nhap duoc': -0.8,
  'loi dang nhap': -0.7,
  'khong vao duoc': -0.7,
  'chatbot tra loi sai': -0.8,
  'chatbot khong hieu': -0.7,
  'sai thong tin': -0.8,
  'sai ten': -0.7,
  'sai lich': -0.7,
  'sai link': -0.7,
  'sai ngay': -0.7,
  'sai gio': -0.7,
  'sai le phi': -0.7,
  'sai diem': -0.7,
  'sai sot': -0.7,
  'khong xem duoc': -0.8,
  'he thong loi': -0.8,
  'can gap nhan vien': -0.6,
  'can gap tu van vien': -0.6,

  'tệ': -0.6,
  'tệ quá': -0.8,
  'rất tệ': -0.9,
  'kém': -0.5,
  'dở': -0.5,
  'tồi': -0.6,
  'chờ lâu': -0.6,
  'chờ mãi': -0.7,
  'đợi lâu': -0.6,
  'chậm trễ': -0.6,
  'rất chậm': -0.7,
  'quá chậm': -0.7,
  'không nhiệt tình': -0.5,
  'thiếu chuyên nghiệp': -0.7,
  'không giải quyết': -0.7,
  'không xử lý': -0.6,
  'chưa giải quyết': -0.5,
  'không hỗ trợ': -0.6,
  'không giúp đỡ': -0.6,
  'bỏ qua': -0.5,
  'không phản hồi': -0.7,
  'không trả lời': -0.6,
  'hỏng': -0.7,
  'lỗi': -0.5,
  'bị lỗi': -0.6,
  'sai': -0.5,
  'thất vọng': -0.7,
  'rất thất vọng': -0.9,
  'bức xúc': -0.7,
  'rất bức xúc': -0.9,
  'tức giận': -0.8,
  'khó chịu': -0.5,
  'phàn nàn': -0.5,
  'khiếu nại': -0.6,
  'không hài lòng': -0.7,
  'không chấp nhận': -0.7,
  'lừa đảo': -0.9,
  'gian lận': -0.9,
  'tố cáo': -0.8,
  'khởi kiện': -0.9,
  'khiếu kiện': -0.8,
  'kiện cáo': -0.8,
  'đăng lên mạng': -0.6,
  'review xấu': -0.6,
  'không đăng nhập được': -0.8,
  'lỗi đăng nhập': -0.7,
  'không vào được': -0.7,
  'chatbot trả lời sai': -0.8,
  'chatbot không hiểu': -0.7,
  'sai thông tin': -0.8,
  'sai tên': -0.7,
  'sai lịch': -0.7,
  'sai link': -0.7,
  'sai ngày': -0.7,
  'sai giờ': -0.7,
  'sai lệ phí': -0.7,
  'sai điểm': -0.7,
  'sai sót': -0.7,
  'không xem được': -0.8,
  'hệ thống lỗi': -0.8,
  'cần gặp nhân viên': -0.6,
  'cần gặp tư vấn viên': -0.6
};

const NEGATION_WORDS = [
  'khong', 'chua', 'chang', 'dau co', 'dau phai', 'khong phai', 'khong he',
  'không', 'chưa', 'chẳng', 'đâu có', 'đâu phải', 'không phải', 'không hề'
];

const NEUTRAL_WHITELIST_PHRASES = [
  'dieu kien',
  'dieu kien ra truong',
  'dieu kien tot nghiep',
  'dieu kien chuan dau ra',
  'dieu kien thi',
  'dieu kien xet chung chi',
  'dieu kien hoc',
  'dieu kien dang ky',
  'điều kiện',
  'điều kiện ra trường',
  'điều kiện tốt nghiệp',
  'điều kiện chuẩn đầu ra',
  'điều kiện thi',
  'điều kiện xét chứng chỉ',
  'điều kiện học',
  'điều kiện đăng ký'
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchKeyword(text, keyword) {
  const escaped = escapeRegex(keyword.toLowerCase());
  const pattern = new RegExp(`(^|${TOKEN_BOUNDARY})${escaped}(?=$|${TOKEN_BOUNDARY})`, 'u');
  return pattern.test(text);
}

function findKeywordIndex(text, keyword) {
  const escaped = escapeRegex(keyword.toLowerCase());
  const pattern = new RegExp(`(^|${TOKEN_BOUNDARY})${escaped}(?=$|${TOKEN_BOUNDARY})`, 'u');
  const match = pattern.exec(text);
  if (!match) return -1;
  return match.index + (match[1] ? match[1].length : 0);
}

class SentimentAnalyzerService {
  analyzeSentiment(cleanedText) {
    if (!cleanedText || cleanedText.trim() === '') {
      return this._neutralResult('Văn bản rỗng');
    }

    const text = cleanedText.toLowerCase();
    const matchedPositive = [];
    const matchedNegative = [];
    let rawScore = 0;

    for (const [keyword, weight] of Object.entries(POSITIVE_KEYWORDS)) {
      const idx = findKeywordIndex(text, keyword);
      if (idx < 0) continue;

      const contextBefore = text.substring(Math.max(0, idx - 25), idx);
      const isNegated = NEGATION_WORDS.some(neg => matchKeyword(contextBefore, neg));

      if (isNegated) {
        rawScore -= weight * 0.8;
        matchedNegative.push(`không ${keyword}`);
      } else {
        rawScore += weight;
        matchedPositive.push(keyword);
      }
    }

    for (const [keyword, weight] of Object.entries(NEGATIVE_KEYWORDS)) {
      const idx = findKeywordIndex(text, keyword);
      if (idx < 0) continue;

      const contextBefore = text.substring(Math.max(0, idx - 25), idx);
      const isNegated = NEGATION_WORDS.some(neg => matchKeyword(contextBefore, neg));

      if (isNegated) {
        rawScore -= weight * 0.5;
      } else {
        rawScore += weight;
        matchedNegative.push(keyword);
      }
    }

    const isNeutralInfoQuestion = NEUTRAL_WHITELIST_PHRASES.some(phrase => matchKeyword(text, phrase));
    const normalizedScore = Math.max(-1.0, Math.min(1.0, rawScore));

    let sentimentLabel;
    let sentimentReason;

    if (normalizedScore > 0.15) {
      sentimentLabel = 'positive';
      const topKeywords = [...new Set(matchedPositive)].slice(0, 3).join(', ');
      sentimentReason = topKeywords
        ? `Phát hiện từ khóa tích cực: "${topKeywords}"`
        : 'Điểm tích cực tổng hợp';
    } else if (normalizedScore < -0.15) {
      sentimentLabel = 'negative';
      const topKeywords = [...new Set(matchedNegative)].slice(0, 3).join(', ');
      sentimentReason = topKeywords
        ? `Phát hiện từ khóa tiêu cực: "${topKeywords}"`
        : 'Điểm tiêu cực tổng hợp';
    } else {
      sentimentLabel = 'neutral';
      sentimentReason = isNeutralInfoQuestion
        ? 'Câu hỏi thông tin, không phát hiện tín hiệu cảm xúc rõ ràng'
        : 'Không phát hiện tín hiệu cảm xúc rõ ràng';
    }

    return {
      sentimentLabel,
      sentimentScore: Math.round(normalizedScore * 1000) / 1000,
      sentimentReason,
      matchedPositiveKeywords: [...new Set(matchedPositive)],
      matchedNegativeKeywords: [...new Set(matchedNegative)]
    };
  }

  _neutralResult(reason) {
    return {
      sentimentLabel: 'neutral',
      sentimentScore: 0.0,
      sentimentReason: reason,
      matchedPositiveKeywords: [],
      matchedNegativeKeywords: []
    };
  }
}

module.exports = new SentimentAnalyzerService();
