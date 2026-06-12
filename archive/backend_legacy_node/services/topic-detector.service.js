/**
 * Service: Phát hiện chủ đề hội thoại theo nghiệp vụ FLIC.
 *
 * Output giữ nguyên contract cũ:
 * - detectedTopics: string[]
 * - detectedKeywords: string[]
 */

const TOPIC_TAXONOMY = {
  'TOEIC': {
    label: 'TOEIC',
    keywords: [
      'toeic', 'chứng chỉ toeic', 'thi toeic', 'điểm toeic', 'lịch thi toeic',
      'toeic 2 kỹ năng', 'toeic 4 kỹ năng'
    ]
  },
  'VSTEP': {
    label: 'VSTEP',
    keywords: [
      'vstep', 'chứng chỉ vstep', 'thi vstep', 'tiếng anh b1', 'tiếng anh b2',
      'b1', 'b2'
    ]
  },
  'Tin học / MOS / IC3': {
    label: 'Tin học / MOS / IC3',
    keywords: [
      'mos', 'ic3', 'tin học', 'chứng chỉ tin học', 'chuẩn tin học',
      'tin học văn phòng'
    ]
  },
  'Chuẩn đầu ra / Chứng chỉ': {
    label: 'Chuẩn đầu ra / Chứng chỉ',
    keywords: [
      'chuẩn đầu ra', 'chứng chỉ', 'xét chuẩn', 'điều kiện tốt nghiệp',
      'điều kiện ra trường', 'tốt nghiệp', 'xét tốt nghiệp'
    ]
  },
  'Lịch thi': {
    label: 'Lịch thi',
    keywords: [
      'lịch thi', 'ngày thi', 'ca thi', 'phòng thi', 'giờ thi',
      'khi nào thi', 'thời gian thi'
    ]
  },
  'Lệ phí / Học phí': {
    label: 'Lệ phí / Học phí',
    keywords: [
      'lệ phí', 'học phí', 'phí thi', 'đóng tiền', 'thanh toán',
      'chuyển khoản', 'biên lai'
    ]
  },
  'Tra cứu điểm': {
    label: 'Tra cứu điểm',
    keywords: [
      'điểm thi', 'kết quả thi', 'tra cứu điểm', 'khi nào có điểm',
      'xem điểm', 'bảng điểm'
    ]
  },
  'Đăng ký thi': {
    label: 'Đăng ký thi',
    keywords: [
      'đăng ký thi', 'đăng kí thi', 'form đăng ký', 'phiếu đăng ký',
      'hạn đăng ký', 'mở đăng ký'
    ]
  },
  'Đăng nhập hệ thống': {
    label: 'Đăng nhập hệ thống',
    keywords: [
      'đăng nhập', 'tài khoản', 'mật khẩu', 'quên mật khẩu',
      'không vào được', 'không đăng nhập được', 'lỗi đăng nhập'
    ]
  },
  'Hồ sơ / Biểu mẫu': {
    label: 'Hồ sơ / Biểu mẫu',
    keywords: [
      'hồ sơ', 'biểu mẫu', 'giấy xác nhận', 'giấy tờ',
      'đơn đăng ký', 'mẫu đơn'
    ]
  },
  'Liên hệ tư vấn': {
    label: 'Liên hệ tư vấn',
    keywords: [
      'tư vấn', 'liên hệ', 'hotline', 'gặp nhân viên',
      'gặp tư vấn viên', 'số điện thoại', 'fanpage'
    ]
  },
  'Khiếu nại / Lỗi hệ thống': {
    label: 'Khiếu nại / Lỗi hệ thống',
    keywords: [
      'lỗi', 'bị lỗi', 'sai', 'không được', 'không phản hồi',
      'hệ thống lỗi', 'chatbot trả lời sai', 'chatbot không hiểu', 'chờ lâu'
    ]
  },
  'Khác': {
    label: 'Khác',
    keywords: []
  }
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchKeyword(text, keyword) {
  if (!keyword) return false;
  const escaped = escapeRegex(keyword.toLowerCase());
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u');
  return pattern.test(text);
}

class TopicDetectorService {
  detectTopics(cleanedText) {
    if (!cleanedText || cleanedText.trim() === '') {
      return { detectedTopics: [], detectedKeywords: [] };
    }

    const text = cleanedText.toLowerCase();
    const detectedTopics = new Set();
    const detectedKeywords = new Set();

    for (const [topicKey, topicDef] of Object.entries(TOPIC_TAXONOMY)) {
      if (topicKey === 'Khác') continue;

      for (const keyword of topicDef.keywords) {
        if (matchKeyword(text, keyword)) {
          detectedTopics.add(topicKey);
          detectedKeywords.add(keyword);
        }
      }
    }

    if (detectedTopics.size === 0) {
      detectedTopics.add('Khác');
    }

    return {
      detectedTopics: [...detectedTopics],
      detectedKeywords: [...detectedKeywords]
    };
  }

  getTopicLabel(topicKey) {
    return TOPIC_TAXONOMY[topicKey]?.label || topicKey;
  }

  getTaxonomy() {
    return TOPIC_TAXONOMY;
  }
}

module.exports = new TopicDetectorService();
