export const TOPIC_TAXONOMY = [
  {
    id: "sat_hach_cntt",
    label: "Sát hạch CNTT (Sát hạch Công nghệ thông tin)",
    shortLabel: "Sát hạch CNTT",
    color: "#003865",
    sheetTopic: "Sát hạch CNTT",
    scopeTerms: [
      "Sát hạch CNTT",
      "Sát hạch Công nghệ thông tin",
      "CNTT",
      "Công nghệ thông tin",
      "CNTT Cơ bản",
      "CNTT Nâng cao",
      "Tin cơ bản",
      "Tin nâng cao",
      "THCB",
      "THNC",
      "IC3",
      "thi CNTT",
      "chứng chỉ CNTT",
    ],
    excludeTerms: ["TOEIC", "MOS", "VSTEP", "B1", "B2", "Học Tiếng Anh", "Học Tin học"],
  },
  {
    id: "toeic",
    label: "TOEIC",
    shortLabel: "TOEIC",
    color: "#ED5206",
    sheetTopic: "TOEIC",
    scopeTerms: ["TOEIC", "thi TOEIC", "lịch thi TOEIC", "đăng ký TOEIC", "lệ phí TOEIC", "điểm thi TOEIC", "chứng chỉ TOEIC"],
    excludeTerms: ["MOS", "VSTEP", "CNTT", "IC3", "Sát hạch", "Học Tin học"],
  },
  {
    id: "mos",
    label: "MOS",
    shortLabel: "MOS",
    color: "#1565C0",
    sheetTopic: "MOS",
    scopeTerms: ["MOS", "Microsoft Office Specialist", "thi MOS", "lịch thi MOS", "chứng chỉ MOS", "điểm thi MOS"],
    excludeTerms: ["TOEIC", "VSTEP", "CNTT", "IC3", "Sát hạch"],
  },
  {
    id: "hoc_tieng_anh",
    label: "Học Tiếng Anh",
    shortLabel: "Học Tiếng Anh",
    color: "#F36C2E",
    sheetTopic: "Học Tiếng Anh",
    scopeTerms: [
      "Học Tiếng Anh",
      "Tiếng Anh",
      "Anh văn",
      "Ngoại ngữ",
      "khóa tiếng Anh",
      "lớp tiếng Anh",
      "VSTEP",
      "B1",
      "B2",
      "ôn tiếng Anh",
      "chuẩn đầu ra ngoại ngữ",
    ],
    excludeTerms: ["MOS", "CNTT", "IC3", "Sát hạch CNTT", "Học Tin học"],
  },
  {
    id: "hoc_tin_hoc",
    label: "Học Tin học",
    shortLabel: "Học Tin học",
    color: "#0288D1",
    sheetTopic: "Học Tin học",
    scopeTerms: [
      "Học Tin học",
      "khóa tin học",
      "lớp tin học",
      "tin học văn phòng",
      "học Word",
      "học Excel",
      "học PowerPoint",
      "ôn tin học",
      "quên mật khẩu khóa học",
    ],
    excludeTerms: ["TOEIC", "VSTEP", "Sát hạch CNTT", "CNTT Cơ bản", "CNTT Nâng cao", "IC3"],
  },
] as const;

export type TopicGroup = (typeof TOPIC_TAXONOMY)[number];
export type TopicGroupId = TopicGroup["id"];

export const TOPIC_FILTER_OPTIONS = TOPIC_TAXONOMY.map((topic) => ({
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
  };
  if (legacyExact[normalized]) return legacyExact[normalized];

  if (hasCodeToken(normalized, "vstep") || hasCodeToken(normalized, "b1") || hasCodeToken(normalized, "b2")) {
    return "hoc_tieng_anh";
  }
  if (hasCodeToken(normalized, "toeic")) return "toeic";
  if (hasCodeToken(normalized, "mos") || normalized.includes("microsoft office specialist")) return "mos";
  if (
    normalized.includes("sat hach") ||
    normalized.includes("cntt") ||
    normalized.includes("cong nghe thong tin") ||
    normalized.includes("ic3") ||
    normalized.includes("thcb") ||
    normalized.includes("thnc") ||
    normalized.includes("tin co ban") ||
    normalized.includes("tin nang cao")
  ) {
    return "sat_hach_cntt";
  }
  if (
    normalized.includes("hoc tieng anh") ||
    normalized.includes("tieng anh") ||
    normalized.includes("anh van") ||
    normalized.includes("ngoai ngu") ||
    normalized.includes("chuan dau ra") ||
    normalized.includes("dau ra") ||
    normalized.includes("xet tot nghiep")
  ) {
    return "hoc_tieng_anh";
  }
  if (
    normalized.includes("hoc tin hoc") ||
    normalized.includes("khoa tin hoc") ||
    normalized.includes("lop tin hoc") ||
    normalized.includes("tin hoc van phong") ||
    normalized.includes("hoc word") ||
    normalized.includes("hoc excel") ||
    normalized.includes("hoc powerpoint") ||
    normalized.includes("on tin hoc")
  ) {
    return "hoc_tin_hoc";
  }

  return null;
}

function hasCodeToken(text: string, code: string) {
  return new RegExp(`(^|[^a-z0-9_])${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9_])`).test(text);
}

export function topicLabelForGroupId(groupId: string | null | undefined) {
  return topicGroupById(groupId)?.label || TOPIC_TAXONOMY[0].label;
}
