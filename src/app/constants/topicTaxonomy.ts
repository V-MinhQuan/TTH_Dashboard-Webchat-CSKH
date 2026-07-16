export const TOPIC_TAXONOMY = [
  {
    id: "sat_hach_cntt",
    label: "Sát hạch CNTT",
    shortLabel: "Sát hạch CNTT",
    color: "#002E8D",
    sheetTopic: "Sát hạch CNTT",
    scopeTerms: [
      "Sát hạch CNTT",
      "Sát hạch Công nghệ thông tin",
      "thi CNTT",
      "thi Công nghệ thông tin",
      "đăng ký thi CNTT",
      "đăng ký sát hạch CNTT",
      "lịch thi CNTT",
      "ngày thi CNTT",
      "ca thi CNTT",
      "lệ phí thi CNTT",
      "phí thi CNTT",
      "điểm thi CNTT",
      "kết quả thi CNTT",
      "xem điểm CNTT",
      "chứng chỉ CNTT",
      "nhận chứng chỉ CNTT",
      "cấp chứng chỉ CNTT",
      "CNTT cơ bản",
      "CNTT nâng cao",
      "Tin học cơ bản",
      "Tin học nâng cao",
      "Tin cơ bản",
      "Tin nâng cao",
      "THCB",
      "THNC",
      "IC3",
    ],
    excludeTerms: ["TOEIC", "MOS", "VSTEP", "B1", "B2", "Học Tiếng Anh", "Học Tin học"],
  },
  {
    id: "toeic",
    label: "TOEIC",
    shortLabel: "TOEIC",
    color: "#00A3E0",
    sheetTopic: "TOEIC",
    scopeTerms: [
      "TOEIC",
      "thi TOEIC",
      "đăng ký TOEIC",
      "đăng ký thi TOEIC",
      "lịch thi TOEIC",
      "ngày thi TOEIC",
      "ca thi TOEIC",
      "lệ phí TOEIC",
      "phí thi TOEIC",
      "điểm TOEIC",
      "điểm thi TOEIC",
      "kết quả TOEIC",
      "xem điểm TOEIC",
      "chứng chỉ TOEIC",
      "nhận chứng chỉ TOEIC",
      "cấp chứng chỉ TOEIC",
    ],
    excludeTerms: ["MOS", "VSTEP", "CNTT", "IC3", "Sát hạch", "Học Tin học"],
  },
  {
    id: "mos",
    label: "MOS",
    shortLabel: "MOS",
    color: "#00D2FF",
    sheetTopic: "MOS",
    scopeTerms: [
      "MOS",
      "Microsoft Office Specialist",
      "thi MOS",
      "đăng ký MOS",
      "đăng ký thi MOS",
      "lịch thi MOS",
      "ngày thi MOS",
      "ca thi MOS",
      "lệ phí MOS",
      "phí thi MOS",
      "điểm MOS",
      "điểm thi MOS",
      "kết quả MOS",
      "xem điểm MOS",
      "chứng chỉ MOS",
      "nhận chứng chỉ MOS",
      "cấp chứng chỉ MOS",
    ],
    excludeTerms: ["TOEIC", "VSTEP", "CNTT", "IC3", "Sát hạch"],
  }, 
  {
    id: "hoc_tieng_anh",
    label: "Học Tiếng Anh",
    shortLabel: "Học Tiếng Anh",
    color: "#308D16",
    sheetTopic: "Học Tiếng Anh",
    scopeTerms: [
      "Học Tiếng Anh",
      "Tiếng Anh",
      "Anh văn",
      "Ngoại ngữ",
      "khóa tiếng Anh",
      "lớp tiếng Anh",
      "khóa Anh văn",
      "lớp Anh văn",
      "học tiếng Anh",
      "đăng ký khóa tiếng Anh",
      "đăng ký lớp tiếng Anh",
      "ôn tiếng Anh",
      "luyện tiếng Anh",
      "tiếng Anh giao tiếp",
      "học giao tiếp tiếng Anh",
      "luyện nghe",
      "luyện nói",
      "luyện đọc",
      "luyện viết",
      "VSTEP",
      "B1",
      "B2",
      "chuẩn đầu ra ngoại ngữ",
      "học phí tiếng Anh",
    ],
    excludeTerms: ["MOS", "CNTT", "IC3", "Sát hạch CNTT", "Học Tin học"],
  },
  {
    id: "hoc_tin_hoc",
    label: "Học Tin học",
    shortLabel: "Học Tin học",
    color: "#FFA100",
    sheetTopic: "Học Tin học",
    scopeTerms: [
      "Học Tin học",
      "khóa tin học",
      "lớp tin học",
      "học tin học",
      "đăng ký khóa tin học",
      "đăng ký lớp tin học",
      "tin học văn phòng",
      "Microsoft Office",
      "Word",
      "Excel",
      "PowerPoint",
      "học Word",
      "học Excel",
      "học PowerPoint",
      "ôn tin học",
      "học phí tin học",
      "đăng nhập khóa học",
      "quên mật khẩu khóa học",
    ],
    excludeTerms: ["TOEIC", "VSTEP", "Sát hạch CNTT", "CNTT Cơ bản", "CNTT Nâng cao", "IC3"],
  },
  {
    id: "khac",
    label: "Khác",
    shortLabel: "Khác",
    color: "#64748B",
    sheetTopic: "Khác",
    scopeTerms: ["Khác"],
    excludeTerms: [],
  },
] as const;

export type TopicGroup = (typeof TOPIC_TAXONOMY)[number];
export type TopicGroupId = TopicGroup["id"];

export const TOPIC_FILTER_OPTIONS = TOPIC_TAXONOMY.filter((topic) => topic.id !== "khac").map((topic) => ({
  value: topic.label,
  label: topic.label,
  available: true,
}));

export function normalizeTopicText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function topicGroupById(groupId: string | null | undefined) {
  return TOPIC_TAXONOMY.find((topic) => topic.id === groupId) || null;
}

export function mapTopicToGroupId(value: string): TopicGroupId | null {
  if (TOPIC_TAXONOMY.some((topic) => topic.id === value)) return value as TopicGroupId;

  const normalized = normalizeTopicText(value);
  if (!normalized || normalized === "tat ca") return null;
  if (TOPIC_TAXONOMY.some((topic) => topic.id === normalized)) return normalized as TopicGroupId;

  const legacyExact: Record<string, TopicGroupId> = {
    "tin hoc": "hoc_tin_hoc",
    "tin hoc / mos / ic3": "mos",
    "chuan dau ra": "hoc_tieng_anh",
    "chuan dau ra / chung chi": "hoc_tieng_anh",
    "chuan dau ra ngoai ngu": "hoc_tieng_anh",
    "other": "khac",
    "unknown": "khac",
    "none": "khac",
  };
  if (legacyExact[normalized]) return legacyExact[normalized];

  if (matchesScopeTerms(normalized, "toeic")) return "toeic";
  if (matchesScopeTerms(normalized, "mos")) return "mos";
  if (matchesScopeTerms(normalized, "sat_hach_cntt")) return "sat_hach_cntt";
  if (matchesScopeTerms(normalized, "hoc_tieng_anh")) return "hoc_tieng_anh";
  if (matchesScopeTerms(normalized, "hoc_tin_hoc")) return "hoc_tin_hoc";

  return "khac";
}

function hasCodeToken(text: string, code: string) {
  return new RegExp(`(^|[^a-z0-9_])${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9_])`).test(text);
}

function matchesScopeTerms(text: string, topicId: Exclude<TopicGroupId, "khac">) {
  const topic = TOPIC_TAXONOMY.find((item) => item.id === topicId);
  if (!topic) return false;

  return topic.scopeTerms.some((term) => {
    const normalizedTerm = normalizeTopicText(term);
    if (!normalizedTerm || normalizedTerm === "khac") return false;
    if (/^[a-z0-9]+$/.test(normalizedTerm) && normalizedTerm.length <= 10) {
      return hasCodeToken(text, normalizedTerm);
    }
    return text.includes(normalizedTerm);
  });
}

export function topicLabelForGroupId(groupId: string | null | undefined) {
  return topicGroupById(groupId)?.label || "Khác";
}

