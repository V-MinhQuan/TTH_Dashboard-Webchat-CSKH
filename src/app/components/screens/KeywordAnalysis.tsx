import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Hash, Brain, AlertCircle, Plus, X, HelpCircle, CheckCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { buildApiUrl, fetchApiJson } from "../../services/dashboardApi";
import { createSheetChatbotRow } from "../../services/sheetChatbotApi";
import { useAuth } from "../../context/AuthContext";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const CTA = "#ED5206";
const COLORS = [NAVY, ORANGE, "rgba(0,56,101,0.6)", "rgba(215,60,1,0.6)", "rgba(0,56,101,0.3)", "rgba(215,60,1,0.3)"];

type KeywordItem = {
  word: string;
  count: number;
  trend: number;
};

type KeywordGroup = {
  id: string;
  name: string;
  color: string;
  totalQuestions: number;
  changeRate: number;
  aiFailed: number;
  faqNeeded: number;
  keywords: KeywordItem[];
};

type KeywordGroupsResponse = {
  success: boolean;
  message?: string;
  data: any[];
};

type KeywordHeatmapResponse = {
  success: boolean;
  message?: string;
  data: any[];
  columns?: { key: string; label: string }[];
};

type KeywordTrendResponse = {
  success: boolean;
  message?: string;
  data: any[];
};

const missingFaqsData: Record<string, { question: string; source: string; added?: boolean }[]> = {
  toeic: [
    { question: "Lệ phí thi TOEIC cho người đi làm là bao nhiêu?", source: "Phát hiện từ 34 hội thoại khách hỏi" },
    { question: "Có được mang nước vào phòng thi TOEIC không?", source: "AI không trả lời được 12 lần" },
    { question: "Đăng ký thi TOEIC online trước bao nhiêu ngày?", source: "Phát hiện từ 22 hội thoại" },
    { question: "Mất CMT/CCCD thì dùng hộ chiếu đi thi TOEIC được không?", source: "AI không chắc chắn (8 lần)" },
    { question: "Thời gian nhận kết quả thi TOEIC Online và Offline khác nhau như thế nào?", source: "Phát hiện từ 18 hội thoại" },
    { question: "Thi thử TOEIC miễn phí tại FLIC vào thứ mấy?", source: "Nhân viên đề xuất" },
    { question: "Cách gia hạn chứng chỉ TOEIC hết hạn?", source: "AI không trả lời được 5 lần" },
    { question: "Quy trình phúc khảo điểm thi TOEIC?", source: "Phát hiện từ 14 hội thoại" },
  ],
  vstep: [
    { question: "Bằng VSTEP B1 có thời hạn bao lâu?", source: "Phát hiện từ 45 hội thoại khách hỏi" },
    { question: "Lịch thi VSTEP tháng 6/2026 tại FLIC?", source: "AI không trả lời được 28 lần" },
    { question: "Hồ sơ đăng ký thi VSTEP cần những giấy tờ gì?", source: "Phát hiện từ 19 hội thoại" },
    { question: "Cấu trúc đề thi nói VSTEP gồm mấy phần?", source: "AI không chắc chắn (12 lần)" },
    { question: "Có được sử dụng tai nghe chống ồn trong phòng thi VSTEP không?", source: "AI không trả lời được 6 lần" },
    { question: "Bao lâu sau khi thi VSTEP thì nhận được chứng chỉ giấy?", source: "Phát hiện từ 15 hội thoại" },
  ],
  tinhoc: [
    { question: "Chứng chỉ tin học cơ bản có bắt buộc cho đầu ra đại học không?", source: "Phát hiện từ 16 hội thoại" },
    { question: "Lệ phí thi chứng chỉ MOS Excel là bao nhiêu?", source: "AI không trả lời được 12 lần" },
    { question: "Có được bảo lưu kết quả thi MOS nếu trượt 1 môn không?", source: "Phát hiện từ 9 hội thoại" },
    { question: "Tài khoản học IC3 trực tuyến tại FLIC đăng nhập ở đâu?", source: "AI không chắc chắn (15 lần)" },
    { question: "Đăng ký thi MOS tại FLIC được giảm giá bao nhiêu?", source: "Nhân viên đề xuất" },
  ],
  chuandaura: [
    { question: "Quy đổi chứng chỉ IELTS sang chuẩn đầu ra của trường như thế nào?", source: "Phát hiện từ 52 hội thoại khách hỏi" },
    { question: "Chứng chỉ TOEIC do IIG cấp có được công nhận chuẩn đầu ra không?", source: "AI không trả lời được 23 lần" },
    { question: "Học sinh hệ chất lượng cao cần chuẩn đầu ra tiếng Anh gì?", source: "Phát hiện từ 18 hội thoại" },
    { question: "Hồ sơ xét miễn chuẩn đầu ra nộp cho ai?", source: "AI không chắc chắn (11 lần)" },
    { question: "Khi nào là hạn cuối xét chuẩn đầu ra tốt nghiệp đợt 1?", source: "Phát hiện từ 25 hội thoại" },
    { question: "Chứng chỉ Tin học văn phòng của trường có được xét đầu ra không?", source: "AI không trả lời được 9 lần" },
    { question: "Quy trình nộp chứng chỉ tiếng Anh quốc tế trực tuyến?", source: "Phát hiện từ 12 hội thoại" },
    { question: "Lệ phí xét chuẩn đầu ra ngoại ngữ là bao nhiêu?", source: "AI không chắc chắn (6 lần)" },
    { question: "Trường hợp chứng chỉ hết hạn trong thời gian xét tốt nghiệp?", source: "Nhân viên đề xuất" },
  ],
};


const topicGroups: KeywordGroup[] = [
  {
    id: "toeic",
    name: "TOEIC",
    color: NAVY,
    totalQuestions: 2847,
    changeRate: 12,
    aiFailed: 215,
    faqNeeded: 8,
    keywords: [
      { word: "lệ phí", count: 847, trend: 12 },
      { word: "lịch thi", count: 634, trend: 34 },
      { word: "điểm thi", count: 541, trend: 8 },
      { word: "chứng chỉ", count: 412, trend: 3 },
      { word: "đăng ký thi", count: 389, trend: 22 },
    ],
  },
  {
    id: "vstep",
    name: "VSTEP",
    color: "#1565C0",
    totalQuestions: 1923,
    changeRate: 28,
    aiFailed: 142,
    faqNeeded: 6,
    keywords: [
      { word: "lịch thi", count: 634, trend: 28 },
      { word: "hồ sơ", count: 412, trend: 11 },
      { word: "cấp chứng chỉ", count: 378, trend: 19 },
      { word: "ôn tập", count: 301, trend: 7 },
      { word: "kết quả thi", count: 267, trend: -3 },
    ],
  },
  {
    id: "tinhoc",
    name: "Tin học / MOS / IC3",
    color: "#42A5F5",
    totalQuestions: 1456,
    changeRate: 6,
    aiFailed: 98,
    faqNeeded: 5,
    keywords: [
      { word: "CNTT Cơ bản", count: 412, trend: 6 },
      { word: "CNTT Nâng cao", count: 334, trend: 18 },
      { word: "MOS", count: 289, trend: 12 },
      { word: "IC3", count: 256, trend: 9 },
      { word: "quên mật khẩu khóa học", count: 167, trend: 31 },
    ],
  },
  {
    id: "chuandaura",
    name: "Chuẩn đầu ra / Chứng chỉ",
    color: "#0288D1",
    totalQuestions: 1834,
    changeRate: 17,
    aiFailed: 176,
    faqNeeded: 9,
    keywords: [
      { word: "điều kiện chuẩn đầu ra", count: 523, trend: 17 },
      { word: "chứng chỉ hợp lệ", count: 445, trend: -12 },
      { word: "thời hạn chứng chỉ", count: 389, trend: 9 },
      { word: "quy đổi điểm", count: 312, trend: 6 },
    ],
  },
];

const trendData = [
  { date: "T1", TOEIC: 2200, VSTEP: 1400, "Tin học": 1100, "Chuẩn đầu ra": 1400 },
  { date: "T2", TOEIC: 2450, VSTEP: 1550, "Tin học": 1200, "Chuẩn đầu ra": 1560 },
  { date: "T3", TOEIC: 2600, VSTEP: 1700, "Tin học": 1350, "Chuẩn đầu ra": 1680 },
  { date: "T4", TOEIC: 2750, VSTEP: 1820, "Tin học": 1390, "Chuẩn đầu ra": 1760 },
  { date: "T5", TOEIC: 2847, VSTEP: 1923, "Tin học": 1456, "Chuẩn đầu ra": 1834 },
];

const heatmapData = [
  { topic: "TOEIC", lệ_phí: 2, lịch_thi: 3, đăng_ký: 1, kết_quả: 4, chứng_chỉ: 2 },
  { topic: "VSTEP", lệ_phí: 1, lịch_thi: 4, đăng_ký: 3, kết_quả: 3, chứng_chỉ: 4 },
  { topic: "Tin học", lệ_phí: 1, lịch_thi: 2, đăng_ký: 2, kết_quả: 1, chứng_chỉ: 3 },
  { topic: "Chuẩn đầu ra", lệ_phí: 3, lịch_thi: 1, đăng_ký: 4, kết_quả: 2, chứng_chỉ: 5 },
];

const heatmapCols = ["lệ_phí", "lịch_thi", "đăng_ký", "kết_quả", "chứng_chỉ"];
const heatmapLabels: Record<string, string> = { lệ_phí: "Lệ phí", lịch_thi: "Lịch thi", đăng_ký: "Đăng ký", kết_quả: "Kết quả", chứng_chỉ: "Chứng chỉ" };

function heatColor(val: number) {
  if (val >= 5) return "#003865";
  if (val >= 4) return "#1565C0";
  if (val >= 3) return "#42A5F5";
  if (val >= 2) return "#B9DCFF";
  return "#EBF2FF";
}

function heatTextColor(val: number) {
  return val >= 3 ? "#fff" : "#003865";
}

function normalizeFaqText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function generateFaqSuggestions(groups: KeywordGroup[]) {
  const templates: Record<string, (keyword: string, count: number, aiFailed: number) => string> = {
    toeic: (keyword, count, aiFailed) => `Câu hỏi về ${keyword} trong TOEIC đang được khách hàng tìm nhiều (${count.toLocaleString("vi-VN")} hội thoại, ${aiFailed} lần AI thất bại)`,
    vstep: (keyword, count, aiFailed) => `Câu hỏi về ${keyword} trong VSTEP cần được giải đáp rõ hơn (${count.toLocaleString("vi-VN")} hội thoại, ${aiFailed} lần AI thất bại)`,
    tinhoc: (keyword, count, aiFailed) => `Câu hỏi về ${keyword} trong bộ môn Tin học / MOS / IC3 cần thêm FAQ (${count.toLocaleString("vi-VN")} hội thoại, ${aiFailed} lần AI thất bại)`,
    chuandaura: (keyword, count, aiFailed) => `Câu hỏi về ${keyword} trong Chuẩn đầu ra cần được cập nhật FAQ (${count.toLocaleString("vi-VN")} hội thoại, ${aiFailed} lần AI thất bại)`,
  };

  return groups.reduce<Record<string, { question: string; source: string; added?: boolean }[]>>((acc, group) => {
    const baseItems = (group.keywords || [])
      .slice(0, 5)
      .map((kw) => ({
        question: templates[group.id]?.(kw.word, kw.count, group.aiFailed) || `Câu hỏi về ${kw.word} trong ${group.name}`,
        source: `Phát hiện từ ${kw.count.toLocaleString("vi-VN")} hội thoại · AI thất bại ${group.aiFailed} lần`,
        added: false,
      }));

    const unique = baseItems.filter((item, index, arr) => (
      arr.findIndex((candidate) => normalizeFaqText(candidate.question) === normalizeFaqText(item.question)) === index
    ));

    acc[group.id] = [...(missingFaqsData[group.id] || []), ...unique].slice(0, 8);
    return acc;
  }, {});
}

function mergeFaqSuggestions(existing: Record<string, { question: string; source: string; added?: boolean }[]>, groups: KeywordGroup[]) {
  const generated = generateFaqSuggestions(groups);

  return Object.keys(generated).reduce<Record<string, { question: string; source: string; added?: boolean }[]>>((acc, groupId) => {
    const kept = (existing[groupId] || []).filter((item) => !item.added);
    const map = new Map(kept.map((item) => [normalizeFaqText(item.question), item]));

    const merged = [...kept];

    generated[groupId].forEach((item) => {
      if (!map.has(normalizeFaqText(item.question))) merged.push(item);
    });

    acc[groupId] = merged.slice(0, 8);
    return acc;
  }, {});
}

interface Props {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onApplyFilters?: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Chuyển FilterValues → query params để gửi lên API backend */
function buildApiParams(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();
  params.set("pageSize", "100");

  // --- Khoảng thời gian ---
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (filters.dateRange === "Tùy chỉnh") {
    if (filters.customDateFrom) startDate = new Date(filters.customDateFrom);
    if (filters.customDateTo)   endDate   = new Date(filters.customDateTo);
  } else {
    endDate = new Date(now);
    startDate = new Date(now);
    if      (filters.dateRange === "Hôm nay")    { startDate.setHours(0, 0, 0, 0); }
    else if (filters.dateRange === "7 ngày qua")  { startDate.setDate(now.getDate() - 7); }
    else if (filters.dateRange === "30 ngày qua") { startDate.setDate(now.getDate() - 30); }
    else if (filters.dateRange === "Tháng này")   { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (filters.dateRange === "Quý này") {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1);
    }
  }

  if (filters.dateRange === "Tùy chỉnh") {
    if (filters.customDateFrom) params.set("startDate", filters.customDateFrom);
    if (filters.customDateTo) params.set("endDate", filters.customDateTo);
  } else {
    if (startDate) params.set("startDate", formatLocalDate(startDate));
    if (endDate) params.set("endDate", formatLocalDate(endDate));
  }

  // --- Kênh ---
  const channelMap: Record<string, string> = {
    "Zalo OA":       "ZaloOA",
    "Zalo Business": "ZaloBusiness",
    "Chat Widget":   "ChatWidget",
    "Facebook":      "Facebook",
  };
  if (filters.channel && filters.channel !== "Tất cả") {
    const mapped = channelMap[filters.channel];
    if (mapped) params.set("channel", mapped);
  }

  if (filters.topic && filters.topic !== "Tất cả") {
    params.set("topic", filters.topic);
  }

  if (filters.conversationStatus && filters.conversationStatus !== "Tất cả") {
    params.set("conversationStatus", filters.conversationStatus);
  }

  if (filters.aiStatus && filters.aiStatus !== "Tất cả") {
    params.set("aiStatus", filters.aiStatus);
  }

  return params;
}

function buildTrendApiParams(filters: FilterValues): URLSearchParams {
  const params = buildApiParams(filters);
  params.delete("pageSize");
  params.set("granularity", getTrendGranularity(filters));
  params.set("months", "8");
  return params;
}

function getTrendGranularity(filters: FilterValues) {
  if (filters.dateRange === "Quý này") return "week";

  if (filters.dateRange === "Tùy chỉnh" && filters.customDateFrom && filters.customDateTo) {
    const start = new Date(filters.customDateFrom);
    const end = new Date(filters.customDateTo);
    const days = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 45) return "day";
    if (days <= 120) return "week";
    return "month";
  }

  return "day";
}

function mapApiGroups(apiGroups: any[]): KeywordGroup[] {
  return apiGroups.map((apiGroup: any) => {
    const group = topicGroups.find(g => g.id === apiGroup.id);
    return {
      id: apiGroup.id,
      name: apiGroup.name || group?.name || apiGroup.id,
      color: apiGroup.color || group?.color || NAVY,
      totalQuestions: apiGroup.totalQuestions || 0,
      changeRate: apiGroup.changeRate || 0,
      aiFailed: apiGroup.aiFailed || 0,
      faqNeeded: group?.faqNeeded || 0,
      keywords: (apiGroup.keywords || []).map((k: any) => ({
        word: k.word,
        count: k.count || 0,
        trend: apiGroup.changeRate || 0,
      })),
    };
  });
}

function mapTrendRows(apiRows: any[]) {
  return apiRows.map((row: any) => ({
    date: row.date,
    TOEIC: row["TOEIC"] || 0,
    VSTEP: row["VSTEP"] || 0,
    "Tin học": row["Tin học / MOS / IC3"] || row["Tin học"] || 0,
    "Chuẩn đầu ra": row["Chuẩn đầu ra / Chứng chỉ"] || row["Chuẩn đầu ra"] || 0,
  }));
}

function normalizeFilterValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesKeywordFilter(topic: string, keyword: string) {
  const normalizedTopic = normalizeFilterValue(topic);
  if (!normalizedTopic || normalizedTopic === "tat ca") return true;

  const normalizedKeyword = normalizeFilterValue(keyword);
  if (!normalizedKeyword) return false;

  return normalizedKeyword === normalizedTopic ||
    normalizedKeyword.startsWith(`${normalizedTopic} `) ||
    normalizedKeyword.endsWith(` ${normalizedTopic}`) ||
    normalizedKeyword.includes(` ${normalizedTopic} `);
}

function KeywordLoadingState() {
  const block = (style: React.CSSProperties = {}) => (
    <div
      style={{
        borderRadius: "10px",
        background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
        backgroundSize: "200% 100%",
        animation: "keywordShimmer 1.4s infinite",
        ...style,
      }}
    />
  );

  return (
    <div>
      <style>{`
        @keyframes keywordShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ marginBottom: "20px" }}>
        {block({ width: "220px", height: "24px", marginBottom: "8px" })}
        {block({ width: "320px", height: "15px" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ background: "#fff", borderRadius: "14px", padding: "18px", border: "1px solid rgba(0,56,101,0.08)", minHeight: "142px" }}>
            {block({ width: "45%", height: "16px", marginBottom: "18px" })}
            {block({ width: "28%", height: "30px", marginBottom: "10px" })}
            {block({ width: "35%", height: "13px", marginBottom: "16px" })}
            <div style={{ display: "flex", gap: "10px" }}>
              {block({ width: "52px", height: "14px" })}
              {block({ width: "86px", height: "14px" })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", height: "262px" }}>
          {block({ width: "220px", height: "18px", marginBottom: "24px" })}
          <div style={{ height: "190px", display: "flex", alignItems: "flex-end", gap: "16px" }}>
            {[58, 82, 44, 70, 38, 92].map((height, i) => (
              <div key={i} style={{ flex: 1, height: `${height}%`, borderRadius: "6px 6px 0 0", background: i % 2 ? "#eef3f8" : "#f6f8fb" }} />
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", height: "262px" }}>
          {block({ width: "160px", height: "18px", marginBottom: "28px" })}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "138px", height: "138px", borderRadius: "50%", border: "18px solid #eef3f8", borderTopColor: "#d7e4f2" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KeywordErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,56,101,0.08)", borderRadius: "16px", padding: "44px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: NAVY, marginBottom: "8px" }}>Không thể tải dữ liệu Keywords</div>
      <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", marginBottom: "18px" }}>{message}</div>
      <button onClick={onRetry} style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>
        Tải lại
      </button>
    </div>
  );
}

export function KeywordAnalysis({ filters, onFiltersChange, onApplyFilters, onNavigate }: Props) {
  const { user } = useAuth();
  // appliedFilters chỉ cập nhật khi bấm "Áp dụng", không re-fetch khi thay đổi bộ lọc chưa áp dụng
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(filters);
  const [missingFaqs, setMissingFaqs] = useState<Record<string, { question: string; source: string; added?: boolean }[]>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flic_missing_faqs");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return missingFaqsData;
  });

  useEffect(() => {
    localStorage.setItem("flic_missing_faqs", JSON.stringify(missingFaqs));
  }, [missingFaqs]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [composingIndex, setComposingIndex] = useState<number | null>(null);
  const [composeAnswer, setComposeAnswer] = useState("");

  const getFaqNeededCount = (groupId: string) => {
    const items = missingFaqs[groupId] || [];
    return items.filter(item => !item.added).length;
  };

  const handleSaveMissingFaq = async (index: number, question: string, source: string) => {
    if (!composeAnswer.trim()) {
      toast.error("Vui lòng nhập câu trả lời");
      return;
    }

    try {
      // Map selectedGroupId to display topic name
      const topicMapSheet: Record<string, string> = {
        toeic: "TOEIC",
        vstep: "VSTEP",
        tinhoc: "MOS/IC3",
        chuandaura: "Chuẩn đầu ra ngoại ngữ"
      };

      // Map source string to SourceType
      let sheetSource: any = "Nhân viên đề xuất";
      if (source.toLowerCase().includes("không trả lời được") || source.toLowerCase().includes("không tìm thấy")) {
        sheetSource = "Không tìm thấy dữ liệu";
      } else if (source.toLowerCase().includes("không chắc chắn")) {
        sheetSource = "AI không chắc chắn";
      } else if (source.toLowerCase().includes("hội thoại")) {
        sheetSource = "Câu hỏi lặp lại nhiều lần";
      } else if (source.toLowerCase().includes("trả lời sai")) {
        sheetSource = "AI trả lời sai";
      }

      await createSheetChatbotRow({
        addedBy: user?.name || "Người dùng ẩn danh",
        question: question,
        correctAnswer: composeAnswer,
        topic: topicMapSheet[selectedGroupId!] || "TOEIC",
        source: sheetSource,
        risk: "Trung bình",
        status: "Chờ xử lý",
        notes: "Thêm từ Phân tích Keywords"
      });

      // 1. Mark as added in missingFaqs
      const groupItems = [...(missingFaqs[selectedGroupId!] || [])];
      groupItems[index] = { ...groupItems[index], added: true };
      setMissingFaqs({
        ...missingFaqs,
        [selectedGroupId!]: groupItems
      });

      // 2. Reset compose state
      setComposeAnswer("");
      setComposingIndex(null);
      toast.success("Đã chuyển đề xuất FAQ vào Sheet Chatbot chờ duyệt!");
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra khi thêm FAQ");
    }
  };

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<KeywordGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Hàm xử lý khi bấm "Áp dụng" — cập nhật appliedFilters để trigger fetch
  const handleApplyFilters = (newFilters: FilterValues) => {
    setLoading(true);
    onFiltersChange(newFilters);
    setAppliedFilters(newFilters);
    if (onApplyFilters) onApplyFilters(newFilters);
  };

  useEffect(() => {
    setAppliedFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (groups) {
      setMissingFaqs((prev) => mergeFaqSuggestions(prev, groups));
    }
  }, [groups]);
  const [heatmapRows, setHeatmapRows] = useState<any[]>([]);
  const [trendRows, setTrendRows] = useState<any[]>([]);
  const [heatmapColsDyn, setHeatmapColsDyn] = useState<{key:string; label:string}[]>(
    heatmapCols.map(k => ({ key: k, label: heatmapLabels[k] }))
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const params = buildApiParams(appliedFilters);
      const trendParams = buildTrendApiParams(appliedFilters);

      try {
        setLoading(true);
        setLoadError(null);

        const [groupsJson, hJson, tJson] = await Promise.all([
          fetchApiJson<KeywordGroupsResponse>(buildApiUrl("/api/admin/crm-keywords/groups", params)),
          fetchApiJson<KeywordHeatmapResponse>(buildApiUrl("/api/admin/crm-keywords/heatmap", params)),
          fetchApiJson<KeywordTrendResponse>(buildApiUrl("/api/admin/crm-keywords/trends", trendParams)),
        ]);

        if (!groupsJson.success || !Array.isArray(groupsJson.data)) {
          throw new Error(groupsJson.message || "Không thể tải thống kê nhóm Keywords.");
        }
        if (!hJson.success || !Array.isArray(hJson.data)) {
          throw new Error(hJson.message || "Không thể tải dữ liệu heatmap Keywords.");
        }
        if (!tJson.success || !Array.isArray(tJson.data)) {
          throw new Error(tJson.message || "Không thể tải dữ liệu xu hướng Keywords.");
        }

        if (cancelled) return;

        const nextData = {
          groups: mapApiGroups(groupsJson.data),
          heatmapRows: hJson.data,
          heatmapCols: hJson.columns || heatmapCols.map(k => ({ key: k, label: heatmapLabels[k] })),
          trendRows: mapTrendRows(tJson.data),
        };

        setGroups(nextData.groups);
        setHeatmapRows(nextData.heatmapRows);
        setHeatmapColsDyn(nextData.heatmapCols);
        setTrendRows(nextData.trendRows);
      } catch (err: any) {
        if (cancelled) return;

        console.error("Lỗi khi tải dữ liệu Keywords:", err);
        setGroups(null);
        setHeatmapRows([]);
        setTrendRows([]);
        setLoadError(err.message || "Không thể kết nối API Keywords.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  // Chỉ re-fetch khi appliedFilters thay đổi (khi bấm "Áp dụng")
  }, [appliedFilters]);

  const retryLoadData = () => {
    setAppliedFilters({ ...appliedFilters });
  };

  const renderLoadingOrError = () => {
    if (loading) return <KeywordLoadingState />;
    if (loadError) return <KeywordErrorState message={loadError} onRetry={retryLoadData} />;
    return null;
  };

  const nonDataState = renderLoadingOrError();

  if (nonDataState) {
    return (
      <div style={{ padding: "24px" }}>
        <FilterPanel filters={filters} onFiltersChange={handleApplyFilters} />
        {nonDataState}
      </div>
    );
  }

  // 1. Topic (Chủ đề) Filter
  const filteredGroups = (groups || []).filter(g => {
    const topic = appliedFilters.topic || "";
    if (!topic || topic === "Tất cả") return true;

    const normalizedTopic = normalizeFilterValue(topic);
    const normalizedGroupName = normalizeFilterValue(g.name);
    const tokenCoverage = normalizedTopic
      .split(" ")
      .filter(Boolean)
      .filter(token => normalizedGroupName.includes(token)).length;

    const aliases: Record<string, string[]> = {
      toeic: ["toeic"],
      vstep: ["vstep"],
      tinhoc: ["tin hoc", "tin hoc co so", "mos ic3", "mos", "ic3"],
      chuandaura: ["chuan dau ra", "chung chi", "chuẩn đầu ra"],
    };

    if (aliases[g.id]?.some(alias => normalizedTopic === alias || normalizedTopic.includes(alias) || alias.includes(normalizedTopic))) {
      return true;
    }

    return g.keywords.some(k => matchesKeywordFilter(topic, k.word)) ||
      (normalizedGroupName === normalizedTopic || normalizedGroupName.includes(normalizedTopic) || (tokenCoverage >= 2 && normalizedTopic.split(" ").length >= 2));
  });

  // Trạng thái hội thoại và trạng thái AI đã được backend query theo bộ lọc.
  const scaleFactor = 1.0;

  // Apply scaling to groups
  const finalGroups = filteredGroups.map(g => ({
    ...g,
    totalQuestions: Math.round(g.totalQuestions * scaleFactor),
    keywords: g.keywords.map(k => ({
      ...k,
      count: Math.round(k.count * scaleFactor)
    }))
  }));

  // Apply scaling to trendRows
  const finalTrendRows = trendRows.map(row => ({
    ...row,
    TOEIC: Math.round(row.TOEIC * scaleFactor),
    VSTEP: Math.round(row.VSTEP * scaleFactor),
    "Tin học": Math.round(row["Tin học"] * scaleFactor),
    "Chuẩn đầu ra": Math.round(row["Chuẩn đầu ra"] * scaleFactor),
  }));

  // Apply scaling to heatmapRows
  const finalHeatmapRows = heatmapRows.map((row: any) => {
    const newRow = { ...row };
    heatmapColsDyn.forEach(col => {
      const originalVal = row[`${col.key}_raw`] !== undefined ? row[`${col.key}_raw`] : row[col.key];
      const scaledRaw = Math.round(originalVal * scaleFactor);
      newRow[`${col.key}_raw`] = scaledRaw;
      
      // Keep normalized score in range 1-5
      const origScore = row[col.key] || 1;
      newRow[col.key] = scaledRaw === 0 ? 1 : Math.max(1, Math.min(5, Math.ceil(origScore * (scaleFactor > 0 ? Math.sqrt(scaleFactor) : 0))));
    });
    return newRow;
  });

  const barData = finalGroups.map((g) => ({ name: g.name.split(" / ")[0], "Hội thoại": g.totalQuestions, "AI thất bại": g.aiFailed }));
  const donutData = finalGroups.map((g) => ({ name: g.name.split(" / ")[0], value: g.totalQuestions }));

  return (
    <div style={{ padding: "24px" }}>
      {/* Truyền handleApplyFilters để chỉ fetch khi bấm "Áp dụng" */}
      <FilterPanel filters={filters} onFiltersChange={handleApplyFilters} />

      {/* Page title */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>Phân tích Keywords</h1>
        <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)" }}>Phân tích theo 4 nhóm chủ đề chính</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
        {finalGroups.map((g) => (
          <div
            key={g.id}
            onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
            style={{
              backgroundColor: "#fff",
              borderRadius: "14px",
              padding: "16px 18px",
              border: `1.5px solid ${activeGroup === g.id ? g.color : "rgba(0,56,101,0.08)"}`,
              boxShadow: activeGroup === g.id ? `0 4px 16px ${g.color}20` : "0 2px 8px rgba(0,56,101,0.05)",
              cursor: "pointer",
              transition: "all 0.2s",
              borderLeft: `4px solid ${g.color}`,
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY, marginBottom: "10px" }}>{g.name}</div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: g.color, marginBottom: "6px" }}>{g.totalQuestions.toLocaleString("vi-VN")}</div>
            <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginBottom: "8px" }}>tổng câu hỏi</div>
            <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
              <span style={{ color: g.changeRate > 0 ? "#228A61" : ORANGE, display: "flex", alignItems: "center", gap: "3px" }}>
                {g.changeRate > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(g.changeRate)}%
              </span>
              <span style={{ color: ORANGE, display: "flex", alignItems: "center", gap: "3px" }}>
                <AlertCircle size={11} /> {g.aiFailed} AI thất bại
              </span>
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGroupId(g.id);
                  setComposingIndex(null);
                  setComposeAnswer("");
                }}
                style={{ color: CTA, display: "flex", alignItems: "center", gap: "3px", cursor: "pointer" }}
              >
                <Plus size={11} /> {getFaqNeededCount(g.id)} FAQ
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1: Bar + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Bar chart */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: NAVY, marginBottom: "16px" }}>Số câu hỏi theo nhóm chủ đề</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Bar dataKey="Hội thoại" fill={NAVY} radius={[4, 4, 0, 0]} />
              <Bar dataKey="AI thất bại" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: NAVY, marginBottom: "16px" }}>Tỷ lệ nhóm chủ đề</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name">
                {donutData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v.toLocaleString("vi-VN")} />
              <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: "11px", color: NAVY }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Line trend */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", marginBottom: "20px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: NAVY, marginBottom: "16px" }}>Xu hướng câu hỏi theo thời gian</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={finalTrendRows} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <Tooltip />
            <Legend iconSize={10} />
            <Line type="monotone" dataKey="TOEIC" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="VSTEP" stroke="#1565C0" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Tin học" stroke={CTA} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Chuẩn đầu ra" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap: AI error level */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Brain size={16} style={{ color: ORANGE }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: NAVY }}>Mức độ lỗi AI theo nhóm chủ đề</span>
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "rgba(0,56,101,0.4)" }}>1 = thấp · 5 = cao</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th style={{ width: "140px", padding: "8px", fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", textAlign: "left" }}>Nhóm chủ đề</th>
                {heatmapColsDyn.map((col) => (
                  <th key={col.key} style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", textAlign: "center" }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finalHeatmapRows.map((row: any) => (
                <tr key={row.topic}>
                  <td style={{ padding: "6px 8px", fontSize: "12px", fontWeight: 600, color: NAVY }}>{row.topic}</td>
                  {heatmapColsDyn.map((col) => {
                    const val = (row as any)[col.key];
                    const rawVal = (row as any)[`${col.key}_raw`];
                    return (
                      <td key={col.key} title={rawVal !== undefined ? `${rawVal} tin nhắn` : ''} style={{ padding: "6px 12px", textAlign: "center", borderRadius: "8px", backgroundColor: heatColor(val), fontSize: "13px", fontWeight: 700, color: heatTextColor(val), cursor: rawVal !== undefined ? "help" : "default" }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "12px", fontSize: "11px", color: "rgba(0,56,101,0.5)", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>Mức độ:</span>
          {[
            { label: "Thấp", val: 1 },
            { label: "Trung bình", val: 3 },
            { label: "Cao", val: 5 },
          ].map(({ label, val }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "16px", height: "16px", borderRadius: "4px", backgroundColor: heatColor(val), display: "inline-block", border: "1px solid rgba(0,56,101,0.1)" }} />
              {label}
            </span>
          ))}
          <span style={{ marginLeft: "8px", display: "flex", alignItems: "center", gap: "3px" }}>
            {["#EBF2FF", "#B9DCFF", "#42A5F5", "#1565C0", "#003865"].map((c) => (
              <span key={c} style={{ width: "20px", height: "12px", backgroundColor: c, display: "inline-block", borderRadius: "2px" }} />
            ))}
          </span>
        </div>
      </div>

      {/* Keyword detail cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
        {finalGroups.map((group) => (
          <div
            key={group.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1px solid rgba(0,56,101,0.08)",
              boxShadow: "0 2px 8px rgba(0,56,101,0.05)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "8px", height: "24px", borderRadius: "4px", backgroundColor: group.color }} />
              <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>{group.name}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "10px", fontSize: "11px" }}>
                <span style={{ color: "rgba(0,56,101,0.45)" }}>Từ khóa hàng đầu</span>
                <button
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setComposingIndex(null);
                    setComposeAnswer("");
                  }}
                  style={{ padding: "2px 8px", borderRadius: "6px", border: `1px solid ${CTA}`, background: "#fff", color: CTA, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                >
                  +{getFaqNeededCount(group.id)} FAQ cần thêm
                </button>
              </div>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {group.keywords.map((kw, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "18px", fontSize: "11px", color: "rgba(0,56,101,0.35)", fontWeight: 700, flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "12px", color: NAVY, fontWeight: 500 }}>{kw.word}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {kw.trend > 0 ? <TrendingUp size={11} style={{ color: "#228A61" }} /> : <TrendingDown size={11} style={{ color: ORANGE }} />}
                          <span style={{ fontSize: "11px", fontWeight: 600, color: kw.trend > 0 ? "#228A61" : ORANGE }}>{Math.abs(kw.trend)}%</span>
                          <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", marginLeft: "5px" }}>{kw.count.toLocaleString("vi-VN")}</span>
                        </div>
                      </div>
                      <div style={{ height: "5px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(kw.count / group.keywords[0].count) * 100}%`, backgroundColor: group.color, borderRadius: "3px", opacity: 0.75 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal đề xuất FAQ bổ sung */}
      {selectedGroupId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,56,101,0.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "#fff", width: "600px", borderRadius: "18px", padding: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ padding: "8px", borderRadius: "10px", backgroundColor: "#fff7e6" }}>
                  <Brain size={20} style={{ color: ORANGE }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>FAQ đề xuất bổ sung</h3>
                  <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)" }}>Nhóm {selectedGroupId.toUpperCase()} · Chọn câu hỏi để biên soạn câu trả lời</span>
                </div>
              </div>
              <button onClick={() => setSelectedGroupId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,56,101,0.4)", padding: "4px" }}><X size={20} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
              {(() => {
                const itemsToRender = (missingFaqs[selectedGroupId] || [])
                  .map((item, originalIndex) => ({ ...item, originalIndex }))
                  .filter(item => !item.added);

                if (itemsToRender.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(0,56,101,0.4)", fontSize: "13px" }}>Không có câu hỏi đề xuất nào.</div>
                  );
                }

                return itemsToRender.map((item) => {
                  const index = item.originalIndex;
                  return (
                    <div key={index} style={{ border: "1.5px solid rgba(0,56,101,0.06)", borderRadius: "12px", padding: "16px", backgroundColor: "#fff", transition: "all 0.2s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: NAVY, fontSize: "13px", lineHeight: 1.4 }}>{item.question}</div>
                          <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", marginTop: "4px" }}>Nguồn: {item.source}</div>
                        </div>
                        <div>
                          {composingIndex !== index && (
                            <button onClick={() => { setComposingIndex(index); setComposeAnswer(""); }} style={{ padding: "5px 12px", borderRadius: "8px", border: `1px solid ${CTA}`, background: "#fff", color: CTA, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>Soạn câu trả lời</button>
                          )}
                        </div>
                      </div>

                      {composingIndex === index && (
                        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px dashed rgba(0,56,101,0.1)", paddingTop: "14px" }}>
                          <textarea
                            value={composeAnswer}
                            onChange={(e) => setComposeAnswer(e.target.value)}
                            placeholder="Nhập câu trả lời chính thức cho câu hỏi này..."
                            rows={3}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                          />
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button onClick={() => setComposingIndex(null)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1.5px solid rgba(0,56,101,0.12)", backgroundColor: "#fff", color: NAVY, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>Hủy</button>
                            <button onClick={() => handleSaveMissingFaq(index, item.question, item.source)} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", backgroundColor: CTA, color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>Lưu & Bổ sung FAQ</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", borderTop: "1px solid rgba(0,56,101,0.06)", paddingTop: "16px" }}>
              <button onClick={() => setSelectedGroupId(null)} style={{ padding: "8px 18px", borderRadius: "8px", border: "1.5px solid rgba(0,56,101,0.12)", backgroundColor: "#fff", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
