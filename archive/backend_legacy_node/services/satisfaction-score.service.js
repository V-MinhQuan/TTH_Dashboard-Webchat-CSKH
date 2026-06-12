/**
 * Service: Tinh diem hai long khach hang (Customer Satisfaction Score)
 *
 * Interface duoc giu nguyen va bo sung tuy chon sentimentLabel de pipeline
 * co the day cac case cam xuc tieu cuc vao hang can nhan vien xem xet.
 */

const TOKEN_BOUNDARY = '[^\\p{L}\\p{N}]';

const CRISIS_KEYWORDS = [
  'lua dao', 'gian lan', 'to cao', 'khoi kien', 'khieu kien', 'kien cao',
  'canh sat', 'cong an', 'luat su', 'truyen thong', 'bao chi',
  'dang len mang', 'dang facebook', 'review xau', 'tay chay',
  'doi boi thuong', 'boi thuong', 'thiet hai', 'mat tien',
  'rat that vong', 'qua that vong', 'cuc ky that vong',
  'rat buc xuc', 'qua buc xuc', 'cuc ky buc xuc',
  'khong chap nhan duoc', 'khong the chap nhan',
  'phai giai quyet ngay', 'can giai quyet ngay lap tuc',
  'yeu cau gap quan ly', 'yeu cau gap giam doc',
  'da mat long tin', 'khong con tin tuong',

  'lừa đảo', 'gian lận', 'tố cáo', 'khởi kiện', 'khiếu kiện', 'kiện cáo',
  'cảnh sát', 'công an', 'luật sư', 'truyền thông', 'báo chí',
  'đăng lên mạng', 'đăng facebook', 'review xấu', 'tẩy chay',
  'đòi bồi thường', 'bồi thường', 'thiệt hại', 'mất tiền',
  'rất thất vọng', 'quá thất vọng', 'cực kỳ thất vọng',
  'rất bức xúc', 'quá bức xúc', 'cực kỳ bức xúc',
  'không chấp nhận được', 'không thể chấp nhận',
  'phải giải quyết ngay', 'cần giải quyết ngay lập tức',
  'yêu cầu gặp quản lý', 'yêu cầu gặp giám đốc',
  'đã mất lòng tin', 'không còn tin tưởng'
];

const STRONG_COMPLAINT_KEYWORDS = [
  'that vong', 'buc xuc', 'tuc gian', 'phan no',
  'rat te', 'te hai', 'qua te', 'kem coi',
  'khong giai quyet', 'mai khong giai quyet', 'cho qua lau',
  'loi', 'hong', 'lua dao',

  'thất vọng', 'bức xúc', 'tức giận', 'phẫn nộ',
  'rất tệ', 'tệ hại', 'quá tệ', 'kém cỏi',
  'không giải quyết', 'mãi không giải quyết', 'chờ quá lâu',
  'lỗi', 'hỏng', 'lừa đảo'
];

const SERIOUS_REVIEW_KEYWORDS = [
  'tra loi sai',
  'chatbot khong hieu',
  'khong phan hoi',
  'can gap nhan vien',
  'gap tu van vien',
  'cho lau',
  'khong dang nhap duoc',
  'loi dang nhap',
  'he thong loi',
  'khong vao duoc',
  'sai thong tin',
  'sai ten',
  'sai lich',
  'sai link',
  'khong xem duoc',

  'trả lời sai',
  'chatbot không hiểu',
  'không phản hồi',
  'cần gặp nhân viên',
  'gặp tư vấn viên',
  'chờ lâu',
  'không đăng nhập được',
  'lỗi đăng nhập',
  'hệ thống lỗi',
  'không vào được',
  'sai thông tin',
  'sai tên',
  'sai lịch',
  'sai link',
  'không xem được'
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchKeyword(text, keyword) {
  const escaped = escapeRegex(keyword.toLowerCase());
  const pattern = new RegExp(`(^|${TOKEN_BOUNDARY})${escaped}(?=$|${TOKEN_BOUNDARY})`, 'u');
  return pattern.test(text);
}

class SatisfactionScoreService {
  /**
   * @param {object} params
   * @param {number} params.sentimentScore - [-1.0, 1.0]
   * @param {'positive'|'negative'|'neutral'} [params.sentimentLabel]
   * @param {string[]} params.matchedNegativeKeywords
   * @param {string} params.cleanedText
   */
  calculateSatisfactionScore({
    sentimentScore = 0,
    sentimentLabel = 'neutral',
    matchedNegativeKeywords = [],
    cleanedText = ''
  }) {
    const text = cleanedText.toLowerCase();
    const baseScore = Math.round(50 + sentimentScore * 35);
    let adjustedScore = baseScore;
    const reasons = [];

    const negKeywordCount = matchedNegativeKeywords.length;
    if (negKeywordCount > 0) {
      const penalty = Math.min(negKeywordCount * 5, 25);
      adjustedScore -= penalty;
      reasons.push(`Có ${negKeywordCount} từ khóa tiêu cực (-${penalty} điểm)`);
    }

    const strongComplaintMatches = STRONG_COMPLAINT_KEYWORDS.filter(kw => matchKeyword(text, kw));
    if (strongComplaintMatches.length > 0) {
      const penalty = Math.min(strongComplaintMatches.length * 8, 20);
      adjustedScore -= penalty;
      reasons.push(`Phát hiện ${strongComplaintMatches.length} từ khóa phàn nàn mạnh (-${penalty} điểm)`);
    }

    const satisfactionScore = Math.max(0, Math.min(100, adjustedScore));

    let satisfactionLevel;
    if (satisfactionScore >= 80) {
      satisfactionLevel = 'very_satisfied';
    } else if (satisfactionScore >= 60) {
      satisfactionLevel = 'satisfied';
    } else if (satisfactionScore >= 40) {
      satisfactionLevel = 'neutral';
    } else if (satisfactionScore >= 20) {
      satisfactionLevel = 'unsatisfied';
    } else {
      satisfactionLevel = 'very_unsatisfied';
    }

    const seriousMatches = SERIOUS_REVIEW_KEYWORDS.filter(kw => matchKeyword(text, kw));
    const crisisMatches = CRISIS_KEYWORDS.filter(kw => matchKeyword(text, kw));
    const isNegative =
      sentimentLabel === 'negative' ||
      sentimentScore < -0.15 ||
      matchedNegativeKeywords.length > 0;

    const needStaffReview =
      isNegative ||
      satisfactionScore < 40 ||
      seriousMatches.length > 0 ||
      crisisMatches.length > 0;

    if (isNegative) {
      reasons.push('Cảm xúc tiêu cực cần nhân viên xem xét');
    }
    if (satisfactionScore < 40) {
      reasons.push('Điểm hài lòng dưới 40');
    }
    if (seriousMatches.length > 0) {
      reasons.push(`Phát hiện vấn đề cần hỗ trợ: "${seriousMatches.slice(0, 2).join('", "')}"`);
    }
    if (crisisMatches.length > 0) {
      reasons.push(`Phát hiện từ khóa khẩn cấp: "${crisisMatches.slice(0, 2).join('", "')}"`);
    }

    const satisfactionReason = reasons.length > 0
      ? reasons.join('; ')
      : `Điểm cơ bản từ cảm xúc: ${baseScore}/100`;

    return {
      satisfactionScore: Math.round(satisfactionScore * 10) / 10,
      satisfactionLevel,
      satisfactionReason,
      needStaffReview
    };
  }

  getLevelLabel(level) {
    const labels = {
      very_satisfied: 'Rất hài lòng',
      satisfied: 'Hài lòng',
      neutral: 'Trung tính',
      unsatisfied: 'Chưa hài lòng',
      very_unsatisfied: 'Rất không hài lòng'
    };
    return labels[level] || level;
  }
}

module.exports = new SatisfactionScoreService();
