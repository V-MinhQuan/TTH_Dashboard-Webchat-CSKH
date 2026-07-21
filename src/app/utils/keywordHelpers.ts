import type { FilterValues } from "../components/FilterPanel";
import { getAiFailureDefinition } from "../constants/aiFailureTaxonomy";
import {
  TOPIC_TAXONOMY,
  mapTopicToGroupId as mapTopicToTaxonomyGroupId,
  normalizeTopicText,
  topicLabelForGroupId,
} from "../constants/topicTaxonomy";

export const NAVY = "#003865";
export const ORANGE = "#D73C01";
export const CTA = "#ED5206";
export { TOPIC_TAXONOMY };
export const TOPIC_GROUP_COLORS: Record<string, string> = Object.fromEntries(
  TOPIC_TAXONOMY.map((topic) => [topic.id, topic.color]),
);
export const TOPIC_DONUT_COLORS = Object.values(TOPIC_GROUP_COLORS);

export type KeywordItem = {
  word: string;
  count: number;
  trend: number;
  canonicalKeyword?: string;
  actualPhrase?: string;
  detectionMethod?: string;
  confidence?: number | null;
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

export type KeywordAnalysisResponse = {
  success: boolean;
  message?: string;
  data: {
    groups: any[];
    trends: any[];
  };
};

export type SuggestedFaqItem = {
  question: string;
  suggestedAnswer: string;
  topic: string;
  freq: number;
  priority: string;
  source?: string;
  aiGenerated?: boolean;
  sourceQuestions?: { question: string; count: number }[];
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

const topicGroupMeta: Pick<KeywordGroup, "id" | "name" | "color">[] = TOPIC_TAXONOMY.map((topic) => ({
  id: topic.id,
  name: topic.label,
  color: topic.color,
}));

export function mapTopicToGroupId(value: string): string | null {
  return mapTopicToTaxonomyGroupId(value);
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
  return topicLabelForGroupId(groupId);
}

export function aiWrongAnswerNote(value: string | undefined) {
  const answer = (value || "").trim();
  return answer ? `Câu trả lời sai của AI:\n${answer}` : "";
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
  }

  if (filters.dateRange === "Tùy chỉnh") {
    if (startDate) params.set("startDate", formatLocalDate(startDate));
    if (endDate) params.set("endDate", formatLocalDate(endDate));
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
      color: group?.color || apiGroup.color || NAVY,
      totalQuestions: apiGroup.totalQuestions || 0,
      changeRate: apiGroup.changeRate || 0,
      aiFailed: aiFailed !== null && Number.isFinite(aiFailed) ? aiFailed : null,
      faqNeeded: apiGroup.faqNeeded || 0,
      keywords: (apiGroup.keywords || []).map((k: any) => ({
        word: k.word,
        count: k.count || 0,
        trend: apiGroup.changeRate || 0,
        canonicalKeyword: k.canonicalKeyword || k.standardKeyword || k.word,
        actualPhrase: k.actualPhrase || k.matchedPhrase || k.word,
        detectionMethod: k.detectionMethod || k.method || "keyword_rule",
        confidence: k.confidence == null ? null : Number(k.confidence),
      })),
    };
  });
}

export function mapTrendRows(apiRows: any[]) {
  return apiRows.map((row: any) => {
    const mapped: Record<string, number | string> = { date: row.date };
    TOPIC_TAXONOMY.forEach((topic) => {
      mapped[topic.label] = row[topic.label] || row[topic.shortLabel] || 0;
    });
    return mapped;
  });
}

export function normalizeFilterValue(value: string) {
  return normalizeTopicText(value);
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
