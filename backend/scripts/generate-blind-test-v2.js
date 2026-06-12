'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { poolPromise } = require('../config/db');

function normalizeText(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

function getWordCount(s) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r/g, '').replace(/\n/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─── CLASSIFICATION REGEXES / KEYWORDS ──────────────────────────────────────────
const CATEGORIES = {
  info: ['lich thi', 'ho so', 'le phi', 'hoc phi', 'con slot', 'khi nao', 'o dau', 'bao nhieu', 'co can'],
  short_ack: ['da', 'vang', 'ok', 'oke', 'v', 'a', 'da vang', 'vang a', 'da a', 'ok a'],
  thanks: ['cam on', 'cam on chi', 'cam on ad', 'cam on nhieu', 'tuyet voi', 'tot qua'],
  missing_email: ['chua nhan mail', 'chua nhan email', 'chua thay mail', 'khong thay mail', 'chua co mail'],
  payment_qr: ['ma qr', 'chuyen khoan roi', 'thanh toan roi', 'qr code', 'chua xac nhan thanh toan'],
  registration: ['khong dang ky duoc', 'loi dang ky', 'form dang ky', 'khong gui duoc form'],
  file_doc: ['khong giai nen', 'khong mo duoc file', 'file loi', 'giai nen bao loi', 'mat khau file'],
  deadline: ['khong kip', 'so khong kip', 'tre han', 'qua han', 'het han', 'can gap', 'gap a', 'kip nop'],
  exam_retest: ['thi rot', 'thi lai', 'rot excel', 'rot thuc hanh', 'dang ky thi lai'],
  access_login: ['khong dang nhap duoc', 'khong vao duoc web', 'khong truy cap duoc', 'loi dang nhap'],
  contact_fail: ['khong nghe may', 'goi khong duoc', 'khong lien he duoc', 'khong phan hoi', 'tra loi dum', 'tra loi giup'],
  typo_slang: ['kh', 'chx', 'dc', 'ko', 'vuiii', 'hong', 'hong', 'mik', 'ng'],
  ambiguous_context: ['tra loi nguoi that', 'chatbot tu dong', 'bot hay nguoi', 'ad oi', 'trung tam oi']
};

async function run() {
  console.log('======================================================');
  console.log('         GENERATING FRESH BLIND TEST V2 DATASET');
  console.log('======================================================\n');

  const oldTemplatePath = path.resolve(__dirname, '../reports/sentiment_blind_test_template.csv');
  const excludedIds = new Set();

  if (fs.existsSync(oldTemplatePath)) {
    console.log(`Loading old blind test message IDs from:\n${oldTemplatePath}`);
    const raw = fs.readFileSync(oldTemplatePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    // Bỏ qua header
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length > 2) {
        const msgId = parseInt(parts[2].trim());
        if (!isNaN(msgId)) {
          excludedIds.add(msgId);
        }
      }
    }
    console.log(`Loaded ${excludedIds.size} message IDs to exclude.\n`);
  } else {
    console.log('Warning: sentiment_blind_test_template.csv not found. No exclusions will be made.\n');
  }

  const pool = await poolPromise;
  console.log('Querying WebChat_MessageLogs for potential new samples...');

  // Lấy danh sách tin nhắn lớn
  const query = `
    SELECT TOP 5000
      id_webchat_messagelogs AS messageId,
      TextContent AS textContent,
      Source AS source,
      SentAt AS sentAt
    FROM dbo.WebChat_MessageLogs
    WHERE TextContent IS NOT NULL 
      AND LTRIM(RTRIM(TextContent)) <> ''
      AND (FromHost = 0 OR FromHost IS NULL)
    ORDER BY id_webchat_messagelogs DESC;
  `;

  const dbRes = await pool.request().query(query);
  const allMessages = dbRes.recordset;
  console.log(`Fetched ${allMessages.length} total customer messages.`);

  // Loại trừ các messageId cũ
  const freshMessages = allMessages.filter(m => !excludedIds.has(Number(m.messageId)));
  console.log(`Found ${freshMessages.length} fresh customer messages.`);

  // Phân tầng theo từ khóa
  const categorizedPools = {};
  Object.keys(CATEGORIES).forEach(cat => {
    categorizedPools[cat] = [];
  });
  const remainingPool = [];

  for (const m of freshMessages) {
    const text = m.textContent || '';
    const norm = normalizeText(text);
    const words = getWordCount(text);

    let matched = false;

    // Duyệt qua các nhóm từ khóa để phân tầng
    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
      // Short ack check thêm ranh giới từ hoặc độ dài
      if (cat === 'short_ack') {
        if (words <= 4 && keywords.some(kw => norm === kw || norm === `${kw} ạ` || norm === `${kw}.`)) {
          categorizedPools[cat].push(m);
          matched = true;
          break;
        }
      } else {
        if (keywords.some(kw => norm.includes(kw))) {
          categorizedPools[cat].push(m);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      remainingPool.push(m);
    }
  }

  console.log('\n--- FRESH CATEGORIZED POOLS ---');
  Object.entries(categorizedPools).forEach(([cat, pool]) => {
    console.log(`- ${cat.padEnd(20)}: ${pool.length} messages`);
  });
  console.log(`- remainingPool      : ${remainingPool.length} messages`);

  // Lấy mẫu phân tầng (stratified sampling)
  // Mục tiêu: mỗi nhóm lấy tối đa 20 dòng. Phần còn lại lấy từ remainingPool
  const sampledList = [];
  const targetPerCategory = 18;

  Object.entries(categorizedPools).forEach(([cat, pool]) => {
    shuffle(pool);
    const count = Math.min(pool.length, targetPerCategory);
    for (let i = 0; i < count; i++) {
      sampledList.push(pool[i]);
    }
    console.log(`Sampled ${count} from ${cat}`);
  });

  // Điền đầy bằng remainingPool hoặc các pool khác cho đủ 250 mẫu
  const targetTotal = 250;
  shuffle(remainingPool);

  while (sampledList.length < targetTotal && remainingPool.length > 0) {
    sampledList.push(remainingPool.pop());
  }

  // Nếu vẫn thiếu, gom tất cả các pool chưa được chọn hết
  if (sampledList.length < targetTotal) {
    Object.values(categorizedPools).forEach(pool => {
      while (sampledList.length < targetTotal && pool.length > sampledList.length) {
        // Lấy các phần tử chưa được chọn
        const next = pool.pop();
        if (next && !sampledList.some(s => s.messageId === next.messageId)) {
          sampledList.push(next);
        }
      }
    });
  }

  // Shuffle kết quả cuối cùng để các nhóm trộn ngẫu nhiên
  shuffle(sampledList);

  console.log(`\nFinal sample size for Blind Test v2: ${sampledList.length} rows.`);

  // 4. Tạo CSV
  const csvHeaders = 'sampleId,messageId,TextContent,Source,SentAt,manualSentimentLabel,manualIssueFlag,manualNeedStaffReview,reviewerNote';
  const csvRows = sampledList.slice(0, targetTotal).map((m, idx) => {
    const sId = idx + 1;
    const sentAtStr = m.sentAt ? m.sentAt.toISOString().replace('T', ' ').substring(0, 19) : '';
    return `${sId},${m.messageId},${escapeCSV(m.textContent)},${escapeCSV(m.source)},${sentAtStr},,,`;
  });

  const csvContent = '\ufeff' + [csvHeaders, ...csvRows].join('\n');
  const csvPath = path.resolve(__dirname, '../reports/sentiment_blind_test_v2_template.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log(`\nCreated Blind Test v2 template CSV at:\n${csvPath}`);

  // 5. Tạo README gán nhãn
  const readmeContent = `# HƯỚNG DẪN GÁN NHÃN BLIND TEST V2 (BLIND TEST V2 ANNOTATION README)

Tệp dữ liệu kiểm thử mù v2 \`sentiment_blind_test_v2_template.csv\` chứa 250 câu tương tác mới của khách hàng, được trích xuất ngẫu nhiên để rà soát hệ thống Phân tích Cảm xúc & Phát hiện Sự cố.

## 1. Cấu trúc các cột cần gán nhãn thủ công
Người đánh giá (Reviewer) cần điền thông tin vào 4 cột cuối:
*   \`manualSentimentLabel\`: Nhãn cảm xúc của khách hàng.
*   \`manualIssueFlag\`: Trạng thái chứa sự cố nghiệp vụ cần xử lý.
*   \`manualNeedStaffReview\`: Xác nhận hội thoại cần chuyển tiếp nhân viên hỗ trợ.
*   \`reviewerNote\`: Ghi chú lý giải lựa chọn (nếu có).

---

## 2. Quy tắc gán nhãn chi tiết (Annotation Rules)

### A. Cột \`manualSentimentLabel\`
Chọn một trong ba giá trị sau:
1.  **\`positive\`**: Tin nhắn cảm ơn, khen ngợi trung tâm, thể hiện sự hài lòng.
    *   *Ví dụ:* "Dạ em cảm ơn chị nhiều ạ", "Tốt quá, cảm ơn trung tâm nhé"
2.  **\`negative\`**: Tin nhắn phàn nàn, cáu gắt, bức xúc, hỏi đi hỏi lại do lỗi hệ thống hoặc do bot trả lời sai.
    *   *Ví dụ:* "sao lại trả lời 2 ý khác nhau thế", "web bị sao vào không được", "huhu thi trượt rồi"
3.  **\`neutral\`**: Tin nhắn hỏi thông tin thông thường hoặc từ chào hỏi, xác nhận ngắn.
    *   *Ví dụ:* "lịch thi toeic coi ở đâu ạ", "Dạ", "Vâng ạ", "Ok", "hồ sơ cần những gì ạ"

### B. Cột \`manualIssueFlag\` (Độc lập với Cảm xúc)
*   Điền **\`true\`** nếu tin nhắn phản ánh một sự cố vận hành nghiệp vụ thực tế hoặc vấn đề kỹ thuật khách hàng gặp phải cần can thiệp.
    *   *Các lỗi thuộc nhóm sự cố:* chưa nhận được mail/tin nhắn, lỗi mã QR/thanh toán, không đăng ký thi được, file ôn tập bị lỗi/cần mật khẩu, sắp trễ hạn nộp, thi rượt/thi lại, lỗi đăng nhập/hệ thống, không gọi được hotline.
*   Điền **\`false\`** nếu tin nhắn chỉ là câu hỏi thông tin thông thường (hỏi lịch thi, học phí, thủ tục), từ đệm chào hỏi hoặc cảm ơn.

### C. Cột \`manualNeedStaffReview\` (Cực kỳ quan trọng)
*   Điền **\`true\`** cho tất cả các ca:
    1.  Khách hàng có sắc thái cảm xúc tiêu cực (\`manualSentimentLabel = negative\`).
    2.  Hội thoại phát hiện có sự cố cần xử lý (\`manualIssueFlag = true\`).
    3.  Tin nhắn mơ hồ nhưng mang dấu hiệu muốn kết nối hỗ trợ, bot trả lời sai, hoặc nghi ngờ chatbot tự động (\`manualNeedStaffReview = true\`).
*   Điền **\`false\`** cho các câu hỏi thông tin chung đã có sẵn FAQs chuẩn, từ đệm chào hỏi xã giao hoặc lời cảm ơn.

---

## 3. Một số lưu ý đặc biệt cho Blind Test v2
*   **Mơ hồ nghiệp vụ:** Nếu câu hỏi không chứa từ lỗi kỹ thuật nhưng có thái độ bức xúc hoặc giục ("trả lời em với") -> gán \`manualNeedStaffReview = true\`.
*   **Không tự sử dụng kết quả đoán của mô hình làm Ground Truth:** Ground Truth bắt buộc phải được đánh giá khách quan bằng mắt của chuyên viên vận hành.
*   **Quy định định dạng:** Vui lòng nhập đúng các giá trị viết thường (\`positive\`, \`neutral\`, \`negative\`) và viết thường boolean (\`true\`, \`false\`) để tránh lỗi khi chạy script tự động đánh giá.
`;

  const readmePath = path.resolve(__dirname, '../reports/sentiment_blind_test_v2_readme.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log(`Created Blind Test v2 readme at:\n${readmePath}`);

  process.exit(0);
}

run().catch(e => {
  console.error('Failed to generate blind test v2:', e);
  process.exit(1);
});
