import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, X, Plus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { buildApiUrl, fetchApiJson } from "../../services/dashboardApi";
import { useAuth } from "../../context/AuthContext";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import { AI_FAILURE_TAXONOMY } from "../../constants/aiFailureTaxonomy";
import { cn } from "../ui/utils";
import {
  aiWrongAnswerNote,
  buildApiParams,
  buildTrendApiParams,
  emptyAiErrorKeywordForm,
  failureSourceFromSuggestion,
  mapApiGroups,
  mapTopicToGroupId,
  mapTrendRows,
  matchesKeywordFilter,
  NAVY,
  normalizeFaqText,
  normalizeFilterValue,
  ORANGE,
  persistAiErrorKeyword,
  TOPIC_GROUP_COLORS,
  TOPIC_DONUT_COLORS,
  topicForGroupId,
  type AiErrorKeywordPayload,
  type KeywordGroup,
  type KeywordGroupsResponse,
  type KeywordHeatmapResponse,
  type KeywordTrendResponse,
  type MissingFaqItem,
  type SuggestedFaqResponse,
} from "../../utils/keywordHelpers";

interface Props {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onApplyFilters?: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

const cardShellClass = "bg-white rounded-[16px] p-5 border border-[rgba(0,56,101,0.08)] shadow-[0_2px_8px_rgba(0,56,101,0.05)]";
const labelTextClass = "text-[11px] text-[rgba(0,56,101,0.5)]";
const navyTitleClass = "text-[#003865] font-bold";
const modalLabelClass = "text-[#003865] text-xs font-semibold";
const modalInputClass = "mt-1.5 w-full box-border rounded-lg border border-[rgba(0,56,101,0.16)] px-3 py-2.5 text-[#003865] outline-none";
const TOPIC_LINE_STYLES = {
  toeic: { color: TOPIC_GROUP_COLORS.toeic, dash: undefined },
  vstep: { color: TOPIC_GROUP_COLORS.vstep, dash: "7 3" },
  tinhoc: { color: TOPIC_GROUP_COLORS.tinhoc, dash: "2 4" },
  chuandaura: { color: TOPIC_GROUP_COLORS.chuandaura, dash: "10 3 2 3" },
} as const;

const groupToneClasses: Record<string, { activeBorder: string; activeShadow: string; text: string; strip: string }> = {
  toeic: {
    activeBorder: "border-[#003865]",
    activeShadow: "shadow-[0_4px_16px_rgba(0,56,101,0.13)]",
    text: "text-[#003865]",
    strip: "bg-[#003865]",
  },
  vstep: {
    activeBorder: "border-[#ED5206]",
    activeShadow: "shadow-[0_4px_16px_rgba(237,82,6,0.16)]",
    text: "text-[#ED5206]",
    strip: "bg-[#ED5206]",
  },
  tinhoc: {
    activeBorder: "border-[#1565C0]",
    activeShadow: "shadow-[0_4px_16px_rgba(21,101,192,0.16)]",
    text: "text-[#1565C0]",
    strip: "bg-[#1565C0]",
  },
  chuandaura: {
    activeBorder: "border-[#F36C2E]",
    activeShadow: "shadow-[0_4px_16px_rgba(243,108,46,0.16)]",
    text: "text-[#F36C2E]",
    strip: "bg-[#F36C2E]",
  },
};

const defaultGroupTone = groupToneClasses.toeic;
const heatScaleClasses = ["bg-[#f1f5f9]", "bg-[#EBF2FF]", "bg-[#B9DCFF]", "bg-[#42A5F5]", "bg-[#1565C0]", "bg-[#003865]"];
const loadingBarHeights = ["h-[58%]", "h-[82%]", "h-[44%]", "h-[70%]", "h-[38%]", "h-[92%]"];
const emptyMissingFaqGroups: Record<string, MissingFaqItem[]> = {
  toeic: [],
  vstep: [],
  tinhoc: [],
  chuandaura: [],
};
const emptyKeywordOptionalErrors = {
  suggestedFaqs: false,
};

type KeywordAnalysisQueryData = {
  groups: KeywordGroup[];
  heatmapRows: any[];
  trendRows: any[];
  heatmapColsDyn: { key: string; label: string }[];
  missingFaqs: Record<string, MissingFaqItem[]>;
  optionalErrors: typeof emptyKeywordOptionalErrors;
};

function toneForGroup(groupId: string) {
  return groupToneClasses[groupId] || defaultGroupTone;
}

function summaryCardClass(group: KeywordGroup, activeGroup: string | null) {
  const tone = toneForGroup(group.id);
  const isActive = activeGroup === group.id;
  return cn(
    "relative cursor-pointer overflow-hidden rounded-[14px] border-[1.5px] bg-white px-[18px] py-4 pl-[22px] transition-all",
    isActive ? cn(tone.activeBorder, tone.activeShadow) : "border-[rgba(0,56,101,0.08)] shadow-[0_2px_8px_rgba(0,56,101,0.05)]",
  );
}

function heatCellClass(val: number, hasRawValue: boolean) {
  const base = "rounded-lg px-3 py-1.5 text-center text-[13px] font-bold";
  const color = val <= 0
    ? "bg-[#f1f5f9] text-[#003865]"
    : val >= 5
      ? "bg-[#003865] text-white"
      : val >= 4
        ? "bg-[#1565C0] text-white"
        : val >= 3
          ? "bg-[#42A5F5] text-white"
          : val >= 2
            ? "bg-[#B9DCFF] text-[#003865]"
            : "bg-[#EBF2FF] text-[#003865]";

  return cn(base, color, hasRawValue ? "cursor-help" : "cursor-default");
}

function heatLegendClass(val: number) {
  if (val <= 0) return "bg-[#f1f5f9]";
  if (val >= 5) return "bg-[#003865]";
  if (val >= 4) return "bg-[#1565C0]";
  if (val >= 3) return "bg-[#42A5F5]";
  if (val >= 2) return "bg-[#B9DCFF]";
  return "bg-[#EBF2FF]";
}

async function loadKeywordAnalysisData(filters: FilterValues, signal?: AbortSignal): Promise<KeywordAnalysisQueryData> {
  const params = buildApiParams(filters);
  const trendParams = buildTrendApiParams(filters);
  let suggestedFaqsLoadFailed = false;

  const [groupsJson, hJson, tJson, faqsJson] = await Promise.all([
    fetchApiJson<KeywordGroupsResponse>(buildApiUrl("/api/admin/crm-keywords/groups", params), { signal }),
    fetchApiJson<KeywordHeatmapResponse>(buildApiUrl("/api/admin/crm-keywords/heatmap", params), { signal }),
    fetchApiJson<KeywordTrendResponse>(buildApiUrl("/api/admin/crm-keywords/trends", trendParams), { signal }),
    fetchApiJson<SuggestedFaqResponse>(buildApiUrl("/api/analytics/ai/suggested-faqs", params), { signal })
      .catch((error) => {
        if (signal?.aborted) throw error;
        suggestedFaqsLoadFailed = true;
        console.warn("Optional suggested FAQ request failed:", error);
        return null;
      }),
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
  const missingFaqs: Record<string, MissingFaqItem[]> = {
    toeic: [],
    vstep: [],
    tinhoc: [],
    chuandaura: [],
  };

  const suggestedFaqsUnavailable = suggestedFaqsLoadFailed || Boolean(faqsJson && !faqsJson.success);
  const suggestedFaqRows = faqsJson?.success && Array.isArray(faqsJson.data) ? faqsJson.data : [];
  suggestedFaqRows.forEach((item) => {
    const groupId = mapTopicToGroupId(`${item.topic || ""} ${item.question || ""} ${item.suggestedAnswer || ""}`);
    if (!groupId || !item.question?.trim()) return;

    missingFaqs[groupId].push({
      question: item.question.trim(),
      source: `Phát hiện từ ${item.freq} hội thoại`,
      suggestedAnswer: item.suggestedAnswer || "",
      added: false,
    });
  });

  return {
    groups: mapApiGroups(groupsJson.data),
    heatmapRows: hJson.data,
    trendRows: mapTrendRows(tJson.data),
    heatmapColsDyn: hJson.columns && Array.isArray(hJson.columns) ? hJson.columns : [],
    missingFaqs,
    optionalErrors: {
      suggestedFaqs: suggestedFaqsUnavailable,
    },
  };
}

function ShimmerBlock({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "rounded-[10px] bg-gradient-to-r from-[#f0f4f8] via-[#e2e8f0] to-[#f0f4f8] bg-[length:200%_100%] animate-pulse",
        className,
      )}
    />
  );
}

function KeywordLoadingState() {
  return (
    <div>
      <div className="mb-5">
        <ShimmerBlock className="mb-2 h-6 w-[220px]" />
        <ShimmerBlock className="h-[15px] w-[320px]" />
      </div>
      <div className="mb-6 grid grid-cols-4 gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="min-h-[142px] rounded-[14px] border border-[rgba(0,56,101,0.08)] bg-white p-[18px]">
            <ShimmerBlock className="mb-[18px] h-4 w-[45%]" />
            <ShimmerBlock className="mb-2.5 h-[30px] w-[28%]" />
            <ShimmerBlock className="mb-4 h-[13px] w-[35%]" />
            <div className="flex gap-2.5">
              <ShimmerBlock className="h-[14px] w-[52px]" />
              <ShimmerBlock className="h-[14px] w-[86px]" />
            </div>
          </div>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-[2fr_1fr] gap-5">
        <div className="h-[262px] rounded-2xl border border-[rgba(0,56,101,0.08)] bg-white p-5">
          <ShimmerBlock className="mb-6 h-[18px] w-[220px]" />
          <div className="flex h-[190px] items-end gap-4">
            {loadingBarHeights.map((heightClass, i) => (
              <div key={i} className={cn("flex-1 rounded-t-md", heightClass, i % 2 ? "bg-[#eef3f8]" : "bg-[#f6f8fb]")} />
            ))}
          </div>
        </div>
        <div className="h-[262px] rounded-2xl border border-[rgba(0,56,101,0.08)] bg-white p-5">
          <ShimmerBlock className="mb-7 h-[18px] w-40" />
          <div className="flex justify-center">
            <div className="h-[138px] w-[138px] rounded-full border-[18px] border-[#eef3f8] border-t-[#d7e4f2]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KeywordErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[rgba(0,56,101,0.08)] bg-white px-6 py-11 text-center">
      <div className="mb-2 text-[15px] font-bold text-[#003865]">Không thể tải dữ liệu Keywords</div>
      <div className="mb-[18px] text-[13px] text-[rgba(0,56,101,0.55)]">{message}</div>
      <button
        onClick={onRetry}
        className="cursor-pointer rounded-lg border-0 bg-[#003865] px-[18px] py-[9px] text-xs font-bold text-white"
      >
        Tải lại
      </button>
    </div>
  );
}

export function KeywordAnalysis({ filters, onFiltersChange, onApplyFilters }: Props) {
  const { role } = useAuth();
  // appliedFilters chỉ cập nhật khi bấm "Áp dụng", không re-fetch khi thay đổi bộ lọc chưa áp dụng
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(filters);
  const [addedFaqKeys, setAddedFaqKeys] = useState<Record<string, Record<string, boolean>>>({});

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeMissingFaq, setActiveMissingFaq] = useState<{ groupId: string; index: number; item: MissingFaqItem } | null>(null);
  const [showAiErrorKeywordModal, setShowAiErrorKeywordModal] = useState(false);
  const [isSavingAiErrorKeyword, setIsSavingAiErrorKeyword] = useState(false);
  const [aiErrorKeywordForm, setAiErrorKeywordForm] = useState(emptyAiErrorKeywordForm);

  const handleCreateAiErrorKeyword = async () => {
    const normalized = {
      keyword: aiErrorKeywordForm.keyword.trim(),
      errorGroup: aiErrorKeywordForm.errorGroup,
      topic: aiErrorKeywordForm.topic.trim(),
      description: aiErrorKeywordForm.description.trim(),
    };

    if (!normalized.keyword || !normalized.topic || !normalized.description) {
      toast.error("Vui lòng nhập đầy đủ từ khóa, chủ đề và mô tả.");
      return;
    }
    if (normalized.keyword.length > 200 || normalized.description.length > 1000) {
      toast.error("Từ khóa hoặc mô tả vượt quá độ dài cho phép.");
      return;
    }
    if ([normalized.keyword, normalized.topic, normalized.description].some((value) => /<[^>]*>|javascript:/iu.test(value))) {
      toast.error("Nội dung chứa HTML hoặc mã không an toàn.");
      return;
    }

    const payload: AiErrorKeywordPayload = {
      keyword: normalized.keyword,
      error_group: normalized.errorGroup,
      topic: normalized.topic,
      care_hub: null,
      description: normalized.description,
      status: "active",
    };

    try {
      setIsSavingAiErrorKeyword(true);
      await persistAiErrorKeyword(payload);
      setAiErrorKeywordForm(emptyAiErrorKeywordForm);
      setShowAiErrorKeywordModal(false);
      toast.success("Đã thêm từ khóa lỗi AI");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu từ khóa lỗi AI.");
    } finally {
      setIsSavingAiErrorKeyword(false);
    }
  };

  const getFaqNeededCount = (groupId: string) => {
    const items = missingFaqs[groupId] || [];
    return items.filter((item) => !item.added).length;
  };

  const markMissingFaqAdded = (groupId: string, index: number) => {
    const item = missingFaqs[groupId]?.[index];
    if (!item) return;

    const faqKey = normalizeFaqText(item.question);
    setAddedFaqKeys((current) => {
      return {
        ...current,
        [groupId]: {
          ...(current[groupId] || {}),
          [faqKey]: true,
        },
      };
    });
  };

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const keywordQuery = useQuery({
    queryKey: ["keyword-analysis", appliedFilters],
    queryFn: ({ signal }) => loadKeywordAnalysisData(appliedFilters, signal),
    placeholderData: (previousData) => previousData,
  });

  const missingFaqs = useMemo<Record<string, MissingFaqItem[]>>(() => {
    const source = keywordQuery.data?.missingFaqs || emptyMissingFaqGroups;
    return Object.fromEntries(
      Object.entries(source).map(([groupId, items]) => [
        groupId,
        items.map((item) => ({
          ...item,
          added: Boolean(item.added || addedFaqKeys[groupId]?.[normalizeFaqText(item.question)]),
        })),
      ]),
    ) as Record<string, MissingFaqItem[]>;
  }, [keywordQuery.data?.missingFaqs, addedFaqKeys]);

  // Hàm xử lý khi bấm "Áp dụng" - cập nhật appliedFilters để trigger fetch
  const handleApplyFilters = (newFilters: FilterValues) => {
    onFiltersChange(newFilters);
    setAppliedFilters(newFilters);
    if (onApplyFilters) onApplyFilters(newFilters);
  };

  useEffect(() => {
    setAppliedFilters(filters);
  }, [filters]);

  const retryLoadData = () => {
    keywordQuery.refetch();
  };

  const renderLoadingOrError = () => {
    if (keywordQuery.isPending) return <KeywordLoadingState />;
    if (keywordQuery.isError && !keywordQuery.data) {
      const message = keywordQuery.error instanceof Error ? keywordQuery.error.message : "Không thể kết nối API Keywords.";
      return <KeywordErrorState message={message} onRetry={retryLoadData} />;
    }
    return null;
  };

  const nonDataState = renderLoadingOrError();

  if (nonDataState) {
    return (
      <div className="p-6">
        <FilterPanel filters={filters} onFiltersChange={handleApplyFilters} />
        {nonDataState}
      </div>
    );
  }

  // 1. Topic (Chủ đề) Filter
  const groups = keywordQuery.data?.groups || [];
  const heatmapRows = keywordQuery.data?.heatmapRows || [];
  const trendRows = keywordQuery.data?.trendRows || [];
  const heatmapColsDyn = keywordQuery.data?.heatmapColsDyn || [];
  const suggestedFaqsLoadFailed = Boolean(keywordQuery.data?.optionalErrors?.suggestedFaqs);

  const filteredGroups = groups.filter((g) => {
    const topic = appliedFilters.topic || "";
    if (!topic || topic === "Tất cả") return true;

    const normalizedTopic = normalizeFilterValue(topic);
    const normalizedGroupName = normalizeFilterValue(g.name);
    const tokenCoverage = normalizedTopic
      .split(" ")
      .filter(Boolean)
      .filter((token) => normalizedGroupName.includes(token)).length;

    const aliases: Record<string, string[]> = {
      toeic: ["toeic"],
      vstep: ["vstep"],
      tinhoc: ["tin hoc", "tin hoc co so", "mos ic3", "mos", "ic3"],
      chuandaura: ["chuan dau ra", "chung chi", "chuẩn đầu ra"],
    };

    if (aliases[g.id]?.some((alias) => normalizedTopic === alias || normalizedTopic.includes(alias) || alias.includes(normalizedTopic))) {
      return true;
    }

    return g.keywords.some((k) => matchesKeywordFilter(topic, k.word)) ||
      (normalizedGroupName === normalizedTopic || normalizedGroupName.includes(normalizedTopic) || (tokenCoverage >= 2 && normalizedTopic.split(" ").length >= 2));
  });

  const finalGroups = filteredGroups;
  const finalTrendRows = trendRows;
  const finalHeatmapRows = heatmapRows;

  const displayedGroups = activeGroup ? finalGroups.filter((g) => g.id === activeGroup) : finalGroups;
  const displayedHeatmapRows = activeGroup ? finalHeatmapRows.filter((r) => mapTopicToGroupId(r.topic) === activeGroup) : finalHeatmapRows;

  const hasAiFailedMetric = finalGroups.some((g) => g.aiFailed !== null);

  const barData = finalGroups.map((g) => ({ name: g.name.split(" / ")[0], "Số câu hỏi": g.totalQuestions, "Số câu AI phản hồi không chính xác": g.aiFailed }));
  const donutData = finalGroups.map((g) => ({ id: g.id, name: g.name.split(" / ")[0], value: g.totalQuestions }));

  return (
    <div className="p-6" data-export-target="true">
      {/* Truyền handleApplyFilters để chỉ fetch khi bấm "Áp dụng" */}
      <FilterPanel filters={filters} onFiltersChange={handleApplyFilters} />

      {/* Page title */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-bold text-[#003865]">Phân tích từ khóa</h1>
          <p className="m-0 text-[13px] text-[rgba(0,56,101,0.5)]">Phân tích theo 4 nhóm chủ đề chính</p>
        </div>
        {role === "manager" && (
          <button
            type="button"
            onClick={() => setShowAiErrorKeywordModal(true)}
            className="inline-flex cursor-pointer items-center gap-[7px] rounded-[9px] border-0 bg-[#003865] px-4 py-[9px] text-xs font-bold text-white"
          >
            <Plus size={14} /> Thêm từ khóa lỗi AI
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-3.5">
        {finalGroups.map((g) => (
          <div key={g.id} onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)} className={summaryCardClass(g, activeGroup)}>
            <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", toneForGroup(g.id).strip)} />
            <div className="mb-2.5 text-[13px] font-bold text-[#003865]">{g.name}</div>
            <div className={cn("mb-1.5 text-[22px] font-bold", toneForGroup(g.id).text)}>{g.totalQuestions.toLocaleString("vi-VN")}</div>
            <div className={labelTextClass}>tổng câu hỏi</div>
          </div>
        ))}
      </div>

      {/* Charts row 1: Bar + Donut */}
      <div className="mb-5 grid grid-cols-[2fr_1fr] gap-5">
        {/* Bar chart */}
        <div className={cardShellClass}>
          <div className="mb-4 text-sm font-bold text-[#003865]">Số câu hỏi theo nhóm chủ đề</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Bar dataKey="Số câu hỏi" fill={NAVY} radius={[4, 4, 0, 0]} />
              {hasAiFailedMetric && <Bar dataKey="Số câu AI phản hồi không chính xác" fill={ORANGE} radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
          {!hasAiFailedMetric && (
            <div className="mt-[-10px] text-[11px] text-[rgba(0,56,101,0.55)]">
              API chưa trả số liệu AI phản hồi không chính xác từ database.
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div className={cardShellClass}>
          <div className="mb-4 text-sm font-bold text-[#003865]">Tỷ lệ nhóm chủ đề</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                nameKey="name"
                paddingAngle={3}
              >
                {donutData.map((item, i) => (
                  <Cell
                    key={`cell-${item.id}-${i}`}
                    fill={TOPIC_GROUP_COLORS[item.id] || TOPIC_DONUT_COLORS[i % TOPIC_DONUT_COLORS.length]}
                    stroke="#fff"
                    strokeWidth={3}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v.toLocaleString("vi-VN")} />
              <Legend iconSize={10} formatter={(v) => <span className="text-[11px] text-[#003865]">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Line trend */}
      <div className={cn(cardShellClass, "mb-5")}>
        <div className="mb-4 text-sm font-bold text-[#003865]">Xu hướng chủ đề theo thời gian</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={finalTrendRows} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <Tooltip />
            <Legend iconSize={10} />
            {(!activeGroup || activeGroup === "toeic") && <Line type="monotone" dataKey="TOEIC" stroke={TOPIC_LINE_STYLES.toeic.color} strokeDasharray={TOPIC_LINE_STYLES.toeic.dash} strokeWidth={2.8} dot={{ r: 3, fill: TOPIC_LINE_STYLES.toeic.color }} />}
            {(!activeGroup || activeGroup === "vstep") && <Line type="monotone" dataKey="VSTEP" stroke={TOPIC_LINE_STYLES.vstep.color} strokeDasharray={TOPIC_LINE_STYLES.vstep.dash} strokeWidth={2.8} dot={{ r: 3, fill: TOPIC_LINE_STYLES.vstep.color }} />}
            {(!activeGroup || activeGroup === "tinhoc") && <Line type="monotone" dataKey="Tin học" stroke={TOPIC_LINE_STYLES.tinhoc.color} strokeDasharray={TOPIC_LINE_STYLES.tinhoc.dash} strokeWidth={2.8} dot={{ r: 3, fill: TOPIC_LINE_STYLES.tinhoc.color }} />}
            {(!activeGroup || activeGroup === "chuandaura") && <Line type="monotone" dataKey="Chuẩn đầu ra" stroke={TOPIC_LINE_STYLES.chuandaura.color} strokeDasharray={TOPIC_LINE_STYLES.chuandaura.dash} strokeWidth={2.8} dot={{ r: 3, fill: TOPIC_LINE_STYLES.chuandaura.color }} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap: AI error level */}
      <div className={cn(cardShellClass, "mb-5")}>
        <div className="mb-4 flex items-center gap-2">
          <Brain size={16} className="text-[#D73C01]" />
          <span className="text-sm font-bold text-[#003865]">Mức độ lỗi AI theo nhóm chủ đề</span>
          <span className="ml-auto text-[11px] text-[rgba(0,56,101,0.4)]">0 = không có lỗi · 5 = cao</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate [border-spacing:4px]">
            <thead>
              <tr>
                <th className="w-[140px] p-2 text-left text-[11px] font-semibold text-[rgba(0,56,101,0.5)]">Nhóm chủ đề</th>
                {heatmapColsDyn.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-center text-[11px] font-semibold text-[rgba(0,56,101,0.5)]">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedHeatmapRows.map((row: any) => (
                <tr key={row.topic}>
                  <td className="px-2 py-1.5 text-xs font-semibold text-[#003865]">{row.topic}</td>
                  {heatmapColsDyn.map((col) => {
                    const val = (row as any)[col.key];
                    const rawVal = (row as any)[`${col.key}_raw`];
                    return (
                      <td key={col.key} title={rawVal !== undefined ? `${rawVal} lỗi AI từ database` : ""} className={heatCellClass(val, rawVal !== undefined)}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-[rgba(0,56,101,0.5)]">
          <span className="font-semibold">Mức độ:</span>
          <span className="flex items-center gap-[5px]">
            <span className={cn("inline-block h-4 w-4 rounded border border-[rgba(0,56,101,0.1)]", heatLegendClass(0))} />
            Không có
          </span>
          {[
            { label: "Thấp", val: 1 },
            { label: "Trung bình", val: 3 },
            { label: "Cao", val: 5 },
          ].map(({ label, val }) => (
            <span key={label} className="flex items-center gap-[5px]">
              <span className={cn("inline-block h-4 w-4 rounded border border-[rgba(0,56,101,0.1)]", heatLegendClass(val))} />
              {label}
            </span>
          ))}
          <span className="ml-2 flex items-center gap-[3px]">
            {heatScaleClasses.map((colorClass) => (
              <span key={colorClass} className={cn("inline-block h-3 w-5 rounded-[2px]", colorClass)} />
            ))}
          </span>
        </div>
      </div>

      {suggestedFaqsLoadFailed && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#FADFA8] bg-[#FFF7E6] px-4 py-3 text-xs font-semibold text-[#8A5A14]">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>FAQ đề xuất bổ sung tạm thời chưa tải được. Các biểu đồ và từ khóa chính vẫn đang hiển thị.</span>
        </div>
      )}

      {/* Keyword detail cards */}
      <div className={cn("grid gap-5", activeGroup ? "grid-cols-[1fr]" : "grid-cols-2")}>
        {displayedGroups.map((group) => (
          <div key={group.id} className="overflow-hidden rounded-2xl border border-[rgba(0,56,101,0.08)] bg-white shadow-[0_2px_8px_rgba(0,56,101,0.05)]">
            <div className="flex items-center gap-2.5 border-b border-[rgba(0,56,101,0.06)] px-[18px] py-4">
              <div className={cn("h-6 w-2 rounded", toneForGroup(group.id).strip)} />
              <span className="text-sm font-bold text-[#003865]">{group.name}</span>
              <div className="ml-auto flex gap-2.5 text-[11px]">
                <span className="text-[rgba(0,56,101,0.45)]">Từ khóa hàng đầu</span>
                <button
                  onClick={() => {
                    setSelectedGroupId(group.id);
                  }}
                  title={suggestedFaqsLoadFailed ? "Dữ liệu FAQ đề xuất tạm thời chưa tải được" : undefined}
                  className="cursor-pointer rounded-md border border-[#ED5206] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#ED5206]"
                >
                  {suggestedFaqsLoadFailed ? "FAQ chưa tải" : `+${getFaqNeededCount(group.id)} FAQ cần thêm`}
                </button>
              </div>
            </div>
            <div className="px-[18px] py-3.5">
              <div className="flex flex-col gap-[9px]">
                {group.keywords.length === 0 && (
                  <div className="py-3 text-xs text-[rgba(0,56,101,0.45)]">
                    Không có từ khóa phát sinh trong khoảng lọc.
                  </div>
                )}
                {group.keywords.map((kw, i) => {
                  const maxCount = group.keywords[0]?.count || 0;
                  const widthPct = maxCount > 0 ? (kw.count / maxCount) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="w-[18px] shrink-0 text-[11px] font-bold text-[rgba(0,56,101,0.35)]">#{i + 1}</span>
                      <div className="flex-1">
                        <div className="mb-[3px] flex justify-between">
                          <span className="text-xs font-medium text-[#003865]">{kw.word}</span>
                          <div className="flex items-center gap-1">
                            <span className="ml-[5px] text-[11px] text-[rgba(0,56,101,0.45)]">{kw.count.toLocaleString("vi-VN")}</span>
                          </div>
                        </div>
                        <svg className="block h-[5px] w-full overflow-hidden rounded-[3px] bg-[#f1f5f9]" viewBox="0 0 100 5" preserveAspectRatio="none" aria-hidden="true">
                          <rect width={widthPct} height="5" rx="3" fill={group.color} opacity="0.75" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAiErrorKeywordModal && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(0,56,101,0.45)] p-5 backdrop-blur-[4px]">
          <div role="dialog" aria-label="Thêm từ khóa lỗi AI" className="w-[520px] max-w-full rounded-[18px] bg-white p-[26px] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="m-0 text-[17px] font-bold text-[#003865]">Thêm từ khóa lỗi AI</h3>
                <p className="mt-[5px] mb-0 text-xs text-[rgba(0,56,101,0.55)]">Từ khóa sẽ được lưu vào database sau khi kiểm tra hợp lệ.</p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => { setShowAiErrorKeywordModal(false); setAiErrorKeywordForm(emptyAiErrorKeywordForm); }}
                className="cursor-pointer border-0 bg-transparent p-1 text-[rgba(0,56,101,0.5)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              <label className={modalLabelClass}>
                Từ khóa lỗi AI
                <input
                  aria-label="Từ khóa lỗi AI"
                  maxLength={200}
                  value={aiErrorKeywordForm.keyword}
                  onChange={(event) => setAiErrorKeywordForm((current) => ({ ...current, keyword: event.target.value }))}
                  className={modalInputClass}
                />
              </label>

              <label className={modalLabelClass}>
                Nhóm lỗi AI
                <select
                  aria-label="Nhóm lỗi AI"
                  value={aiErrorKeywordForm.errorGroup}
                  onChange={(event) => setAiErrorKeywordForm((current) => ({ ...current, errorGroup: event.target.value }))}
                  className={cn(modalInputClass, "bg-white")}
                >
                  {AI_FAILURE_TAXONOMY.map((item) => <option key={item.id} value={item.apiValue}>{item.label}</option>)}
                </select>
              </label>

              <label className={modalLabelClass}>
                Chủ đề
                <input
                  aria-label="Chủ đề"
                  maxLength={200}
                  value={aiErrorKeywordForm.topic}
                  onChange={(event) => setAiErrorKeywordForm((current) => ({ ...current, topic: event.target.value }))}
                  className={modalInputClass}
                />
              </label>

              <label className={modalLabelClass}>
                Mô tả
                <textarea
                  aria-label="Mô tả"
                  maxLength={1000}
                  rows={4}
                  value={aiErrorKeywordForm.description}
                  onChange={(event) => setAiErrorKeywordForm((current) => ({ ...current, description: event.target.value }))}
                  className={cn(modalInputClass, "resize-y font-[inherit]")}
                />
              </label>
            </div>

            <div className="mt-[22px] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => { setShowAiErrorKeywordModal(false); setAiErrorKeywordForm(emptyAiErrorKeywordForm); }}
                className="cursor-pointer rounded-lg border border-[rgba(0,56,101,0.16)] bg-white px-4 py-[9px] font-semibold text-[#003865]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingAiErrorKeyword}
                onClick={() => void handleCreateAiErrorKeyword()}
                className={cn(
                  "rounded-lg border-0 px-[18px] py-[9px] font-bold text-white",
                  isSavingAiErrorKeyword ? "cursor-not-allowed bg-slate-400" : "cursor-pointer bg-[#ED5206]",
                )}
              >
                {isSavingAiErrorKeyword ? "Đang lưu..." : "Lưu từ khóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal đề xuất FAQ bổ sung */}
      {selectedGroupId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(0,56,101,0.45)] backdrop-blur-[4px]">
          <div className="flex max-h-[85vh] w-[600px] flex-col overflow-y-auto rounded-[18px] bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-[10px] bg-[#fff7e6] p-2">
                  <Brain size={20} className="text-[#D73C01]" />
                </div>
                <div>
                  <h3 className={cn(navyTitleClass, "m-0 text-base")}>FAQ đề xuất bổ sung</h3>
                  <span className="text-xs text-[rgba(0,56,101,0.5)]">Nhóm {selectedGroupId.toUpperCase()} · Chọn câu hỏi để biên soạn câu trả lời</span>
                </div>
              </div>
              <button onClick={() => setSelectedGroupId(null)} className="cursor-pointer border-0 bg-transparent p-1 text-[rgba(0,56,101,0.4)]"><X size={20} /></button>
            </div>

            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto pr-1">
              {(() => {
                const itemsToRender = (missingFaqs[selectedGroupId] || [])
                  .map((item, originalIndex) => ({ ...item, originalIndex }))
                  .filter((item) => !item.added);

                if (itemsToRender.length === 0) {
                  if (suggestedFaqsLoadFailed) {
                    return (
                      <div className="rounded-xl border border-[#FADFA8] bg-[#FFF7E6] px-5 py-6 text-center">
                        <AlertTriangle size={22} className="mx-auto mb-2 text-[#B7791F]" aria-hidden="true" />
                        <div className="text-[13px] font-semibold text-[#8A5A14]">Chưa tải được dữ liệu phụ FAQ đề xuất.</div>
                        <div className="mt-1 text-xs text-[rgba(0,56,101,0.55)]">Dữ liệu từ khóa chính vẫn đang hiển thị bình thường.</div>
                        <button
                          type="button"
                          onClick={() => retryLoadData()}
                          className="mt-4 cursor-pointer rounded-lg border border-[#ED5206] bg-white px-3 py-1.5 text-xs font-semibold text-[#ED5206]"
                        >
                          Tải lại dữ liệu
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="py-10 text-center text-[13px] text-[rgba(0,56,101,0.4)]">Không có câu hỏi đề xuất nào.</div>
                  );
                }

                return itemsToRender.map((item) => {
                  const index = item.originalIndex;
                  return (
                    <div key={index} className="rounded-xl border-[1.5px] border-[rgba(0,56,101,0.06)] bg-white p-4 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold leading-[1.4] text-[#003865]">{item.question}</div>
                          <div className="mt-1.5 text-[11px] text-[rgba(0,56,101,0.45)]">
                            Nguồn phát hiện: {item.source}
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => setActiveMissingFaq({
                              groupId: selectedGroupId,
                              index,
                              item: {
                                question: item.question,
                                source: item.source,
                                suggestedAnswer: item.suggestedAnswer,
                              },
                            })}
                            className="cursor-pointer rounded-lg border border-[#ED5206] bg-white px-3 py-[5px] text-[11px] font-semibold text-[#ED5206]"
                          >
                            Soạn câu trả lời
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-5 flex justify-end border-t border-[rgba(0,56,101,0.06)] pt-4">
              <button
                onClick={() => setSelectedGroupId(null)}
                className="cursor-pointer rounded-lg border-[1.5px] border-[rgba(0,56,101,0.12)] bg-white px-[18px] py-2 text-xs font-semibold text-[#003865]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMissingFaq && (
        <FeedbackFormDialog
          open
          mode="create"
          prefillData={{
            question: activeMissingFaq.item.question,
            answer: "",
            topic: topicForGroupId(activeMissingFaq.groupId),
            source: failureSourceFromSuggestion(activeMissingFaq.item.source),
            risk: "Trung bình",
            status: "Chờ xử lý",
            notes: aiWrongAnswerNote(activeMissingFaq.item.suggestedAnswer),
          }}
          onClose={() => setActiveMissingFaq(null)}
          onSaved={() => {
            markMissingFaqAdded(activeMissingFaq.groupId, activeMissingFaq.index);
            setActiveMissingFaq(null);
          }}
        />
      )}
    </div>
  );
}
