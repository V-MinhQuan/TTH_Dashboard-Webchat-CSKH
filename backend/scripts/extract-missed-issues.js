'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

function normalizeText(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

// Helper to categorize missed issues based on text patterns
function categorizeError(text) {
  const norm = normalizeText(text);
  
  // 1. typo_slang_abbreviation
  const typoSlang = ['k thay', 'ko thay', 'k nhan', 'ko nhan', 'chx', 'nhan dc', 'k mo', 'ko mo', 'k vao', 'ko vao', 'hong thay', 'hong', 'hông', 'dc', 'k ', 'ko '];
  if (typoSlang.some(kw => norm.includes(kw))) {
    return {
      category: 'typo_slang_abbreviation',
      suggestedFix: 'Thêm luật regex hoặc từ điển từ viết tắt/slang (k -> không, chx -> chưa, dc -> được).',
      suggestedIssueType: 'typo_slang_abbreviation'
    };
  }
  
  // 2. missing_email_or_notification
  const emailNotification = ['mail', 'email', 'thong bao', 'thong tin'];
  if (emailNotification.some(kw => norm.includes(kw))) {
    return {
      category: 'missing_email_or_notification',
      suggestedFix: 'Thêm luật đối sánh cụm từ liên quan tới email/mail/thông báo chưa nhận được.',
      suggestedIssueType: 'missing_email_or_notification'
    };
  }

  // 3. payment_or_qr_issue
  const paymentQR = ['qr', 'chuyen khoan', 'thanh toan', 'ck', 'le phi', 'nap tien'];
  if (paymentQR.some(kw => norm.includes(kw))) {
    return {
      category: 'payment_or_qr_issue',
      suggestedFix: 'Thêm luật đối sánh cho sự cố thanh toán, chuyển khoản, không thấy mã QR.',
      suggestedIssueType: 'payment_or_qr_issue'
    };
  }

  // 4. registration_issue
  const registration = ['dang ky', 'dang ki', 'form', 'dien form', 'slot', 'dk'];
  if (registration.some(kw => norm.includes(kw))) {
    return {
      category: 'registration_issue',
      suggestedFix: 'Thêm luật phát hiện lỗi đăng ký, lỗi tải hoặc hiển thị biểu mẫu (form).',
      suggestedIssueType: 'registration_issue'
    };
  }

  // 5. file_extract_or_document_issue
  const fileExtract = ['extract', 'giai nen', 'file', 'mat khau', 'zip', 'rar', 'nhat ky', 'tai lieu'];
  if (fileExtract.some(kw => norm.includes(kw))) {
    return {
      category: 'file_extract_or_document_issue',
      suggestedFix: 'Thêm luật phát hiện lỗi giải nén, lỗi file, yêu cầu mật khẩu file.',
      suggestedIssueType: 'file_extract_or_document_issue'
    };
  }

  // 6. deadline_or_urgency_issue
  const deadlineUrgency = ['kip', 'tre', 'han', 'gap'];
  if (deadlineUrgency.some(kw => norm.includes(kw))) {
    return {
      category: 'deadline_or_urgency_issue',
      suggestedFix: 'Thêm luật phát hiện sự cố liên quan đến trễ hạn, không kịp, hoặc yêu cầu khẩn cấp.',
      suggestedIssueType: 'deadline_or_urgency_issue'
    };
  }

  // 7. exam_result_or_retake_issue
  const examRetake = ['rot', 'thi lai', 'truot', 'khong dat', 'thi lai'];
  if (examRetake.some(kw => norm.includes(kw))) {
    return {
      category: 'exam_result_or_retake_issue',
      suggestedFix: 'Thêm luật nhận dạng vấn đề rớt môn học, thi lại hoặc điểm số không đạt.',
      suggestedIssueType: 'exam_result_or_retake_issue'
    };
  }

  // 8. access_or_login_issue
  const accessLogin = ['dang nhap', 'truy cap', 'vao duoc', 'hop le', 'acc', 'tk', 'mat khau', 'password'];
  if (accessLogin.some(kw => norm.includes(kw))) {
    return {
      category: 'access_or_login_issue',
      suggestedFix: 'Thêm luật nhận diện lỗi đăng nhập, lỗi tài khoản hoặc giá trị không hợp lệ.',
      suggestedIssueType: 'access_or_login_issue'
    };
  }

  // 9. contact_failure
  const contact = ['goi', 'lien he', 'nghe may', 'nhan tin', 'tra loi', 'hotline', 'sdt'];
  if (contact.some(kw => norm.includes(kw))) {
    return {
      category: 'contact_failure',
      suggestedFix: 'Thêm luật phát hiện khiếu nại không liên lạc được với trung tâm qua hotline/chat.',
      suggestedIssueType: 'contact_failure'
    };
  }

  // 10. ambiguous_but_needs_review
  return {
    category: 'ambiguous_but_needs_review',
    suggestedFix: 'Chuyển sang chế độ duyệt thủ công của nhân viên để tránh bỏ sót sự cố mập mờ.',
    suggestedIssueType: 'ambiguous_but_needs_review'
  };
}

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

function parseRow(line) {
  const values = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r/g, '').replace(/\n/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── HTTP POST HELPER ────────────────────────────────────────────────────────
function postJson(urlStr, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || 80,
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        }
        resolve(JSON.parse(raw));
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  const templatePath = path.resolve(__dirname, '../reports/sentiment_blind_test_template.csv');
  console.log(`Reading blind test from: ${templatePath}`);
  const rows = parseCSV(templatePath);

  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  console.log(`Querying active pipeline predictions for ${rows.length} rows...`);

  const texts = rows.map(r => r.TextContent);
  const BATCH_SIZE = 32;
  const predictions = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const res = await postJson(`${mlServiceUrl}/predict-ensemble`, { texts: slice });
    predictions.push(...res.results);
  }

  // Reconstruct active PhoBERT + Rule predictions
  const missedIssues = [];
  rows.forEach((r, idx) => {
    const res = predictions[idx];
    const ruleLabel = res.rule?.label;
    const rulePriority = res.rule?.priority;
    const phLabel = res.phobert?.label || 'neutral';
    const phConf = res.phobert?.confidence || 0.0;
    
    let phobertRuleLabel = 'neutral';
    if (ruleLabel) {
      phobertRuleLabel = ruleLabel;
    } else {
      if (phLabel === 'negative' && phConf >= 0.60) {
        phobertRuleLabel = 'neutral';
      } else if (phLabel === 'positive' && phConf >= 0.65) {
        phobertRuleLabel = 'neutral';
      } else if (phLabel === 'neutral' && phConf >= 0.55) {
        phobertRuleLabel = 'neutral';
      } else {
        phobertRuleLabel = 'neutral';
      }
    }

    if (r.manualLabel === 'negative' && phobertRuleLabel === 'neutral') {
      const isRuleHit = rulePriority && rulePriority !== 'none' && rulePriority !== '';
      const matchedRuleName = isRuleHit ? res.rule?.reason : 'none';
      const currentReasonVal = res.final?.reason || 'low_confidence_phobert_only';
      
      const { category, suggestedFix, suggestedIssueType } = categorizeError(r.TextContent);

      missedIssues.push({
        sampleId: r.sampleId,
        analyticsId: r.analyticsId,
        messageId: r.messageId,
        TextContent: r.TextContent,
        Source: r.Source,
        SentAt: r.SentAt,
        manualLabel: r.manualLabel,
        predictedLabel: phobertRuleLabel,
        ruleHit: isRuleHit ? 'true' : 'false',
        matchedRule: matchedRuleName,
        currentReason: currentReasonVal,
        errorCategory: category,
        suggestedFix: suggestedFix,
        shouldSetIssueFlag: 'true',
        shouldSetNeedStaffReview: 'true',
        suggestedIssueType: suggestedIssueType,
        reviewerNote: r.reviewerNote
      });
    }
  });

  console.log(`Found ${missedIssues.length} missed issues (expected: 36).`);

  const categoryCounts = {};
  missedIssues.forEach(item => {
    categoryCounts[item.errorCategory] = (categoryCounts[item.errorCategory] || 0) + 1;
  });

  console.log('Category breakdown:');
  console.log(JSON.stringify(categoryCounts, null, 2));

  // Write to missed_support_issues_analysis.csv
  const headers = [
    'sampleId', 'analyticsId', 'messageId', 'TextContent', 'Source', 'SentAt',
    'manualLabel', 'predictedLabel', 'ruleHit', 'matchedRule', 'currentReason',
    'errorCategory', 'suggestedFix', 'shouldSetIssueFlag', 'shouldSetNeedStaffReview',
    'suggestedIssueType', 'reviewerNote'
  ];

  let csvContent = headers.join(',') + '\n';
  missedIssues.forEach(r => {
    const rowValues = headers.map(h => escapeCSV(r[h]));
    csvContent += rowValues.join(',') + '\n';
  });

  const outputPath = path.resolve(__dirname, '../reports/missed_support_issues_analysis.csv');
  fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');
  console.log(`Missed issues analysis exported to: ${outputPath}`);

  process.exit(0);
}

run().catch(console.error);
