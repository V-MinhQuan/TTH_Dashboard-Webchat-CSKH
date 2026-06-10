'use strict';

const fs = require('fs');
const path = require('path');

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

// Criteria check functions
function isPositive(text, norm, words) {
  const padded = ' ' + norm.replace(/[\W_]+/g, ' ') + ' ';
  
  // 1. Check if it contains positive/thanks keywords
  const positiveKeywords = ['cam on', 'cam on chi', 'cam on ad', 'cam on nhieu', 'cam on trung tam', 'cam on co', 'cam on thay', 'cam on nha', 'ok roi', 'oke roi', 'em hieu roi', 'tu van ro', 'ho tro tot', 'huu ich', 'tuyet voi'];
  const hasPosKeyword = positiveKeywords.some(kw => padded.includes(' ' + kw + ' '));
  
  // 2. Filter out if it also contains negative/issue markers (mixed messages are negative)
  const negativeKeywords = ['chua', 'khong', 'loi', 'mat', 'nham', 'rot', 'ko', 'kh', 'loi', 'sập', 'error'];
  const hasNegKeyword = negativeKeywords.some(kw => padded.includes(' ' + kw + ' '));

  return hasPosKeyword && !hasNegKeyword;
}

function isNegative(text, norm, words) {
  const padded = ' ' + norm.replace(/[\W_]+/g, ' ') + ' ';
  
  // 1. Key issue markers - very strong, always negative
  const issueKeywords = [
    'chua nhan mail', 'chua nhan email', 'chua co mail', 'chua co email', 'khong thay ma qr', 'khong co ma qr', 
    'khong dang nhap duoc', 'khong mo duoc', 'extract', 'giai nen', 'khong goi duoc', 'khong nghe may', 
    'khong lien he duoc', 'khong hop le', 'ko hop le', 'khong kip', 'so khong kip', 'tre han', 
    'mat cccd', 'mat the sinh vien', 'rot', 'thi lai', 'bi loi', 'loi he thong', 'quen mat khau', 
    'quen pass', 'nop nham', 'chon nham', 'loi', 'sập', 'error', 'khong lien he', 'kho khong vao',
    'chx nhan', 'chua nhan dc', 'k mo duoc', 'ko mo duoc', 'k mo dc', 'ko mo dc', 'k vao duoc', 'ko vao duoc',
    'chua thay mail', 'chua co thong bao', 'khong thay thong bao', 'chua nhan duoc thong tin',
    'sai noi dung chuyen khoan', 'form khong hien', 'khong hien form', 'khong gui duoc form', 'khong nop duoc form',
    'giai nen bao loi', 'file yeu cau mat khau', 'file bat nhap mat khau', 'mat khau file', 'tai lieu khong mo duoc',
    'so tre', 'qua han', 'het han', 'can gap', 'gap a', 'kip nop bang', 'khong kip nop bang', 'khong kip tot nghiep',
    'thi rot', 'bi rot', 'rot excel', 'rot thuc hanh', 'rot ly thuyet', 'dang ky thi lai', 'dang ki thi lai',
    'goi khong ai nghe', 'khong ai nghe may', 'khong nghe may', 'khong goi duoc', 'khong lien he duoc',
    'nhan khong ai tra loi', 'khong phan hoi', 'khong vao duoc'
  ];
  if (issueKeywords.some(kw => norm.includes(kw))) return true;

  // 2. Specific negative contexts like "rớt", "thi lại"
  if (padded.includes(' rot ') || padded.includes(' thi lai ') || padded.includes(' mat cccd ') || padded.includes(' mat the sinh vien ')) return true;
  
  // 3. "chưa nhận", "vẫn chưa nhận", "chưa nhận được"
  if (norm.includes('chua nhan') || norm.includes('van chua nhan') || norm.includes('chx nhan') || norm.includes('chua thay mail')) return true;

  // 4. Access issues
  const accessKeywords = ['khong vao duoc', 'ko vao duoc', 'k vao duoc', 'khong dang nhap', 'ko dang nhap', 'k dang nhap', 'vao khong duoc', 'vao ko duoc', 'vao kh duoc', 'vao k duoc'];
  if (accessKeywords.some(kw => norm.includes(kw))) return true;

  return false;
}

// ─── CSV PARSER & WRITER ─────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    let current = '';
    let inQuote = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuote && line[j + 1] === '"') {
          current += '"';
          j++;
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
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/\r/g, '').replace(/\n/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function run() {
  const filePath = path.resolve(__dirname, '../reports/sentiment_blind_test_template.csv');
  console.log(`Loading template: ${filePath}`);
  const rows = parseCSV(filePath);
  
  let posCount = 0;
  let neuCount = 0;
  let negCount = 0;

  const labeledRows = rows.map(r => {
    const text = r.TextContent;
    const norm = normalizeText(text);
    const words = getWordCount(text);

    let label = 'neutral';
    let note = '';

    if (isNegative(text, norm, words)) {
      label = 'negative';
      negCount++;
    } else if (isPositive(text, norm, words)) {
      label = 'positive';
      posCount++;
    } else {
      label = 'neutral';
      neuCount++;
    }

    return {
      ...r,
      manualLabel: label,
      reviewerNote: note
    };
  });

  // Write back to the same file
  const headers = ['sampleId', 'analyticsId', 'messageId', 'TextContent', 'Source', 'SentAt', 'manualLabel', 'reviewerNote'];
  let csvContent = headers.join(',') + '\n';
  labeledRows.forEach(r => {
    const rowValues = headers.map(h => escapeCSV(r[h]));
    csvContent += rowValues.join(',') + '\n';
  });

  fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');

  console.log(`\nSuccessfully labeled ${labeledRows.length} rows!`);
  console.log(` - positive: ${posCount}`);
  console.log(` - neutral:  ${neuCount}`);
  console.log(` - negative: ${negCount}`);
  
  process.exit(0);
}

run().catch(console.error);
