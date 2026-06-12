/**
 * Service: Tiền xử lý văn bản tiếng Việt
 *
 * Mục tiêu: chuẩn hóa text input trước khi đưa vào sentiment/topic analyzer.
 * Giữ lại dấu tiếng Việt, chỉ xóa ký tự thừa.
 */

// ─── Bảng viết tắt phổ biến trong CSKH tiếng Việt ───────────────────────────
const ABBREVIATION_MAP = {
  // Từ phủ định / khó chịu
  'k': 'không',
  'ko': 'không',
  'hok': 'không',
  'khong': 'không',
  'kh': 'không',
  'đc': 'được',
  'dc': 'được',
  'đk': 'được',
  'ntn': 'như thế nào',
  'nma': 'nhưng mà',
  'nhma': 'nhưng mà',
  'cx': 'cũng',
  'cg': 'cũng',
  'mk': 'mình',
  'mn': 'mọi người',
  'ad': 'admin',
  'ib': 'inbox',
  'cs': 'có',
  'vs': 'với',
  'vd': 'ví dụ',
  'tks': 'thanks',
  'ty': 'thank you',
  'oke': 'ok',
  'okey': 'ok',
  'okê': 'ok',
  'bit': 'biết',
  'bik': 'biết',
  'biet': 'biết',
  'hiu': 'hiểu',
  'hỉu': 'hiểu',
  'r': 'rồi',
  'nt': 'như thế',
  'đt': 'điện thoại',
  'dv': 'dịch vụ',
  'đv': 'đơn vị',
  'ql': 'quản lý',
  'kk': 'khó khăn'
};

class TextPreprocessingService {

  /**
   * Chuẩn hóa văn bản tiếng Việt để phân tích cảm xúc
   * @param {string} text - Văn bản gốc
   * @returns {string} Văn bản đã chuẩn hóa
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text;

    // 1. Chuyển thành lowercase
    cleaned = cleaned.toLowerCase();

    // 2. Thay thế ký tự xuống dòng và tab bằng khoảng trắng
    cleaned = cleaned.replace(/[\r\n\t]+/g, ' ');

    // 3. Loại bỏ URL (http/https/www)
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    cleaned = cleaned.replace(/www\.[^\s]+/g, '');

    // 4. Loại bỏ emoji và ký tự Unicode đặc biệt ngoài tiếng Việt
    // Giữ lại: chữ cái Latin + dấu tiếng Việt + số + khoảng trắng + dấu câu cơ bản
    cleaned = cleaned.replace(/[^\p{L}\p{N}\s.,!?;:'"()-]/gu, ' ');

    // 5. Mở rộng các viết tắt phổ biến theo token, không match bên trong từ khác
    for (const [abbr, full] of Object.entries(ABBREVIATION_MAP)) {
      const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(
        new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'gu'),
        `$1${full}`
      );
    }
    cleaned = cleaned.trim();

    // 6. Loại bỏ dấu chấm than/hỏi lặp lại (!!!!! → !)
    cleaned = cleaned.replace(/!{2,}/g, '!');
    cleaned = cleaned.replace(/\?{2,}/g, '?');

    // 7. Chuẩn hóa khoảng trắng thừa
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Tách câu đơn giản cho văn bản tiếng Việt
   * @param {string} text - Văn bản đã clean
   * @returns {string[]} Danh sách câu
   */
  splitSentences(text) {
    if (!text) return [];
    return text
      .split(/[.!?;]/)
      .map(s => s.trim())
      .filter(s => s.length > 2);
  }
}

module.exports = new TextPreprocessingService();
