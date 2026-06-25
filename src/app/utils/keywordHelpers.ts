import type { FilterValues } from "../components/FilterPanel";
import { getAiFailureDefinition } from "../constants/aiFailureTaxonomy";
import { buildApiUrl, fetchApiJson } from "../services/dashboardApi";
import * as round3Api from "../services/round3Api";

export const NAVY = "#003865";
export const ORANGE = "#D73C01";
export const CTA = "#ED5206";
export const TOPIC_GROUP_COLORS: Record<string, string> = {
  toeic: NAVY,
  vstep: CTA,
  tinhoc: "#1565C0",
  chuandaura: "#F36C2E",
};
export const TOPIC_DONUT_COLORS = Object.values(TOPIC_GROUP_COLORS);

export type AiErrorKeywordPayload = {
  keyword: string;
  error_group: string;
  topic: string;
  care_hub: null;
  description: string;
  status: "active";
};

type Round3KeywordApi = typeof round3Api & {
  createAiErrorKeyword?: (payload: AiErrorKeywordPayload) => Promise<unknown>;
};

export const emptyAiErrorKeywordForm = {
  keyword: "",
  errorGroup: getAiFailureDefinition("missing_data")!.apiValue,
  topic: "",
  description: "",
};

export type KeywordItem = {
  word: string;
  count: number;
  trend: number;
};

export type KeywordGroup = {
  id: string;
  name: string;
  color: string;
  totalQuestions: number;
  changeRate: number;
  aiFailed: number | null;
  faqNeeded: number;
  keywords: KeywordItem[];
};

export type KeywordGroupsResponse = {
  success: boolean;
  message?: string;
  data: any[];
};

export type KeywordHeatmapResponse = {
  success: boolean;
  message?: string;
  data: any[];
  columns?: { key: string; label: string }[];
};

export type KeywordTrendResponse = {
  success: boolean;
  message?: string;
  data: any[];
};

export type SuggestedFaqItem = {
  question: string;
  suggestedAnswer: string;
  topic: string;
  freq: number;
  priority: string;
};

export type SuggestedFaqResponse = {
  success: boolean;
  message?: string;
  data: SuggestedFaqItem[];
};

export type MissingFaqItem = {
  question: string;
  source: string;
  added?: boolean;
  suggestedAnswer?: string;
};

const topicGroupMeta: Pick<KeywordGroup, "id" | "name" | "color">[] = [
  { id: "toeic", name: "TOEIC", color: TOPIC_GROUP_COLORS.toeic },
  { id: "vstep", name: "VSTEP", color: TOPIC_GROUP_COLORS.vstep },
  { id: "tinhoc", name: "Tin học / MOS / IC3", color: TOPIC_GROUP_COLORS.tinhoc },
  { id: "chuandaura", name: "Chuẩn đầu ra / Chứng chỉ", color: TOPIC_GROUP_COLORS.chuandaura },
];

export function mapTopicToGroupId(value: string): string | null {
  if (!value) return null;
  const t = value.toLowerCase();
  if (t.includes("toeic")) return "toeic";
  if (t.includes("vstep")) return "vstep";
  if (t.includes("tin học") || t.includes("mos") || t.includes("ic3") || t.includes("cntt") || t.includes("sát hạch")) return "tinhoc";
  if (t.includes("chuẩn đầu ra") || t.includes("chứng chỉ")) return "chuandaura";
  return null;
}

export function normalizeFaqText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function failureSourceFromSuggestion(source: string) {
  const normalized = source.toLocaleLowerCase("vi-VN");
  if (normalized.includes("không chắc chắn")) return getAiFailureDefinition("uncertain")!.apiValue;
  if (normalized.includes("ngoài phạm vi")) return getAiFailureDefinition("out_of_scope")!.apiValue;
  if (normalized.includes("tự tạo thông tin") || normalized.includes("bịa thông tin")) {
    return getAiFailureDefinition("hallucination_risk")!.apiValue;
  }
  return getAiFailureDefinition("missing_data")!.apiValue;
}

export function topicForGroupId(groupId: string | null) {
  const topicMapSheet: Record<string, string> = {
    toeic: "TOEIC",
    vstep: "VSTEP",
    tinhoc: "MOS/IC3",
    chuandaura: "Chuẩn đầu ra ngoại ngữ",
  };
  return groupId ? topicMapSheet[groupId] || "TOEIC" : "TOEIC";
}

export function aiWrongAnswerNote(value: string | undefined) {
  const answer = (value || "").trim();
  return answer ? `Câu trả lời sai của AI:\n${answer}` : "";
}

export async function persistAiErrorKeyword(payload: AiErrorKeywordPayload) {
  const api = round3Api as Round3KeywordApi;
  if (typeof api.createAiErrorKeyword === "function") {
    return api.createAiErrorKeyword(payload);
  }

  const response = await fetchApiJson<{ success: boolean; message?: string; data: unknown }>(
    buildApiUrl("/api/ai-error-keywords"),
    { method: "POST", cache: false, body: JSON.stringify(payload) },
  );
  if (!response.success) throw new Error(response.message || "Không thể lưu từ khóa lỗi AI.");
  return response.data;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Chuyển FilterValues sang query params để gửi lên API backend. */
export function buildApiParams(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams();
  params.set("pageSize", "100");

  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (filters.dateRange === "Tùy chỉnh") {
    if (filters.customDateFrom) startDate = new Date(filters.customDateFrom);
    if (filters.customDateTo) endDate = new Date(filters.customDateTo);
  } else {
    endDate = new Date(now);
    startDate = new Date(now);
    if (filters.dateRange === "Hôm nay") startDate.setHours(0, 0, 0, 0);
    else if (filters.dateRange === "7 ngày qua") startDate.setDate(now.getDate() - 7);
    else if (filters.dateRange === "30 ngày qua") startDate.setDate(now.getDate() - 30);
    else if (filters.dateRange === "Tháng này") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
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

  const channelMap: Record<string, string> = {
    "Zalo OA": "ZaloOA",
    "Zalo Business": "ZaloBusiness",
    "Chat Widget": "ChatWidget",
    Facebook: "Facebook",
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

export function buildTrendApiParams(filters: FilterValues): URLSearchParams {
  const params = buildApiParams(filters);
  params.delete("pageSize");
  params.set("granularity", getTrendGranularity(filters));
  params.set("months", "8");
  return params;
}

export function getTrendGranularity(filters: FilterValues) {
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

export function mapApiGroups(apiGroups: any[]): KeywordGroup[] {
  return apiGroups.map((apiGroup: any) => {
    const group = topicGroupMeta.find((g) => g.id === apiGroup.id);
    const aiFailed = apiGroup.aiFailed == null ? null : Number(apiGroup.aiFailed);
    return {
      id: apiGroup.id,
      name: apiGroup.name || group?.name || apiGroup.id,
      color: apiGroup.color || group?.color || NAVY,
      totalQuestions: apiGroup.totalQuestions || 0,
      changeRate: apiGroup.changeRate || 0,
      aiFailed: aiFailed !== null && Number.isFinite(aiFailed) ? aiFailed : null,
      faqNeeded: apiGroup.faqNeeded || 0,
      keywords: (apiGroup.keywords || []).map((k: any) => ({
        word: k.word,
        count: k.count || 0,
        trend: apiGroup.changeRate || 0,
      })),
    };
  });
}

export function mapTrendRows(apiRows: any[]) {
  return apiRows.map((row: any) => ({
    date: row.date,
    TOEIC: row.TOEIC || 0,
    VSTEP: row.VSTEP || 0,
    "Tin học": row["Tin học / MOS / IC3"] || row["Tin học"] || 0,
    "Chuẩn đầu ra": row["Chuẩn đầu ra / Chứng chỉ"] || row["Chuẩn đầu ra"] || 0,
  }));
}

export function normalizeFilterValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesKeywordFilter(topic: string, keyword: string) {
  const normalizedTopic = normalizeFilterValue(topic);
  if (!normalizedTopic || normalizedTopic === "tat ca") return true;

  const normalizedKeyword = normalizeFilterValue(keyword);
  if (!normalizedKeyword) return false;

  return (
    normalizedKeyword === normalizedTopic ||
    normalizedKeyword.startsWith(`${normalizedTopic} `) ||
    normalizedKeyword.endsWith(` ${normalizedTopic}`) ||
    normalizedKeyword.includes(` ${normalizedTopic} `)
  );
}
