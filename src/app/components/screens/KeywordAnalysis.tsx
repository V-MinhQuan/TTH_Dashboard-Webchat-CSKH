import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Brain, RefreshCw, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { buildApiUrl, fetchApiJson } from "../../services/dashboardApi";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import { cn } from "../ui/utils";
import {
  aiWrongAnswerNote,
  buildApiParams,
  buildTrendApiParams,
  failureSourceFromSuggestion,
  mapApiGroups,
  mapTrendRows,
  matchesKeywordFilter,
  NAVY,
  normalizeFaqText,
  normalizeFilterValue,
  ORANGE,
  TOPIC_TAXONOMY,
  TOPIC_GROUP_COLORS,
  TOPIC_DONUT_COLORS,
  topicForGroupId,
  type KeywordGroup,
  type KeywordGroupsResponse,
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
const TOPIC_LINE_DASHES: Record<string, string | undefined> = {
  sat_hach_cntt: undefined,
  toeic: "7 3",
  mos: "2 4",
  hoc_tieng_anh: "10 3 2 3",
  hoc_tin_hoc: "4 3",
};
const TOPIC_LINE_STYLES = Object.fromEntries(
  TOPIC_TAXONOMY.map((topic) => [
    topic.id,
    { color: TOPIC_GROUP_COLORS[topic.id], dash: TOPIC_LINE_DASHES[topic.id] },
  ]),
) as Record<string, { color: string; dash?: string }>;

const groupToneClasses: Record<string, { activeBorder: string; activeShadow: string; text: string; strip: string }> = {
  sat_hach_cntt: {
    activeBorder: "border-[#003865]",
    activeShadow: "shadow-[0_4px_16px_rgba(0,56,101,0.13)]",
    text: "text-[#003865]",
    strip: "bg-[#003865]",
  },
  toeic: {
    activeBorder: "border-[#ED5206]",
    activeShadow: "shadow-[0_4px_16px_rgba(237,82,6,0.16)]",
    text: "text-[#ED5206]",
    strip: "bg-[#ED5206]",
  },
  mos: {
    activeBorder: "border-[#1565C0]",
    activeShadow: "shadow-[0_4px_16px_rgba(21,101,192,0.16)]",
    text: "text-[#1565C0]",
    strip: "bg-[#1565C0]",
  },
  hoc_tieng_anh: {
    activeBorder: "border-[#F36C2E]",
    activeShadow: "shadow-[0_4px_16px_rgba(243,108,46,0.16)]",
    text: "text-[#F36C2E]",
    strip: "bg-[#F36C2E]",
  },
  hoc_tin_hoc: {
    activeBorder: "border-[#0288D1]",
    activeShadow: "shadow-[0_4px_16px_rgba(2,136,209,0.16)]",
    text: "text-[#0288D1]",
    strip: "bg-[#0288D1]",
  },
  khac: {
    activeBorder: "border-[#64748B]",
    activeShadow: "shadow-[0_4px_16px_rgba(100,116,139,0.14)]",
    text: "text-[#64748B]",
    strip: "bg-[#64748B]",
  },
};

const defaultGroupTone = groupToneClasses.sat_hach_cntt;
const loadingBarHeights = ["h-[58%]", "h-[82%]", "h-[44%]", "h-[70%]", "h-[38%]", "h-[92%]"];
const emptyMissingFaqGroups: Record<string, MissingFaqItem[]> = Object.fromEntries(
  TOPIC_TAXONOMY.map((topic) => [topic.id, [] as MissingFaqItem[]]),
);
const GROUP_FAQ_LIMIT = 1;
const GROUP_FAQ_CANDIDATE_LIMIT = 50;
const GROUP_FAQ_KEYWORD_LIMIT = 24;
const GROUP_FAQ_SCOPE_TERMS: Record<string, string[]> = Object.fromEntries(
  TOPIC_TAXONOMY.map((topic) => [topic.id, [...topic.scopeTerms]]),
);
const TOPIC_ALIAS_TERMS: Record<string, string[]> = Object.fromEntries(
  TOPIC_TAXONOMY.map((topic) => [
    topic.id,
    [topic.label, topic.shortLabel, topic.sheetTopic, ...topic.scopeTerms].map(normalizeFilterValue),
  ]),
);
const GROUP_FAQ_EXCLUDE_TERMS: Record<string, string[]> = Object.fromEntries(
  TOPIC_TAXONOMY.map((topic) => [topic.id, [...topic.excludeTerms]]),
);

type GroupFaqQueryData = {
  groupId: string;
  missingFaqs: MissingFaqItem[];
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

function uniqueGroupKeywords(group: KeywordGroup) {
  const seen = new Set<string>();
  return group.keywords
    .map((keyword) => keyword.word?.trim())
    .filter((word): word is string => Boolean(word))
    .filter((word) => {
      const key = normalizeFilterValue(word);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, GROUP_FAQ_KEYWORD_LIMIT);
}

function buildGroupSuggestedFaqParams(baseParams: URLSearchParams, group: KeywordGroup) {
  const keywords = uniqueGroupKeywords(group);
  const params = new URLSearchParams(baseParams);
  params.set("topicLabel", group.name);
  params.set("limit", String(GROUP_FAQ_LIMIT));
  params.set("candidateLimit", String(GROUP_FAQ_CANDIDATE_LIMIT));
  params.delete("keywords");
  params.delete("scopeKeywords");
  params.delete("excludeKeywords");
  keywords.forEach((keyword) => params.append("keywords", keyword));
  (GROUP_FAQ_SCOPE_TERMS[group.id] || []).forEach((keyword) => params.append("scopeKeywords", keyword));
  (GROUP_FAQ_EXCLUDE_TERMS[group.id] || []).forEach((keyword) => params.append("excludeKeywords", keyword));
  return { params, keywords };
}

async function loadKeywordGroupsData(filters: FilterValues, signal?: AbortSignal): Promise<KeywordGroup[]> {
  const params = buildApiParams(filters);
  params.set("includeChangeRate", "false");

  const groupsJson = await fetchApiJson<KeywordGroupsResponse>(
    buildApiUrl("/api/admin/crm-keywords/groups", params),
    { signal },
  );

  if (!groupsJson.success || !Array.isArray(groupsJson.data)) {
    throw new Error(groupsJson.message || "Không thể tải thống kê nhóm Keywords.");
  }

  return mapApiGroups(groupsJson.data);
}

async function loadKeywordTrendData(filters: FilterValues, signal?: AbortSignal): Promise<any[]> {
  const trendParams = buildTrendApiParams(filters);

  const trendsJson = await fetchApiJson<KeywordTrendResponse>(
    buildApiUrl("/api/admin/crm-keywords/trends", trendParams),
    { signal },
  );

  if (!trendsJson.success || !Array.isArray(trendsJson.data)) {
    throw new Error(trendsJson.message || "Không thể tải dữ liệu xu hướng Keywords.");
  }

  return mapTrendRows(trendsJson.data);
}

async function loadGroupSuggestedFaqs(filters: FilterValues, group: KeywordGroup, signal?: AbortSignal): Promise<GroupFaqQueryData> {
  const params = buildApiParams(filters);
  const trendParams = buildTrendApiParams(filters);
  trendParams.forEach((value, key) => params.set(key, value));

  const { params: faqParams, keywords } = buildGroupSuggestedFaqParams(params, group);
  if (keywords.length === 0) {
    return { groupId: group.id, missingFaqs: [] };
  }

  const faqsJson = await fetchApiJson<SuggestedFaqResponse>(
    buildApiUrl("/api/analytics/ai/suggested-faqs", faqParams),
    { signal, cache: false },
  );

  if (!faqsJson.success || !Array.isArray(faqsJson.data)) {
    throw new Error(faqsJson.message || "Không thể tải FAQ đề xuất.");
  }

  return {
    groupId: group.id,
    missingFaqs: faqsJson.data.slice(0, GROUP_FAQ_LIMIT).flatMap((item) => {
      if (!item.question?.trim()) return [];
      return [{
        question: item.question.trim(),
        source: item.source || `Tổng hợp từ ${item.freq} hội thoại chứa từ khóa chủ đề`,
        suggestedAnswer: item.suggestedAnswer || "",
        added: false,
      }];
    }),
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
      <div className="mb-6 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
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
  const queryClient = useQueryClient();
  // appliedFilters chỉ cập nhật khi bấm "Áp dụng", không re-fetch khi thay đổi bộ lọc chưa áp dụng
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(filters);
  const [addedFaqKeys, setAddedFaqKeys] = useState<Record<string, Record<string, boolean>>>({});
  const [loadedMissingFaqsByGroup, setLoadedMissingFaqsByGroup] = useState<Record<string, MissingFaqItem[]>>({});
  const [faqLoadErrorsByGroup, setFaqLoadErrorsByGroup] = useState<Record<string, string>>({});

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeMissingFaq, setActiveMissingFaq] = useState<{ groupId: string; index: number; item: MissingFaqItem } | null>(null);

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
  const groupsQuery = useQuery({
    queryKey: ["keyword-groups", appliedFilters],
    queryFn: ({ signal }) => loadKeywordGroupsData(appliedFilters, signal),
  });

  const trendQuery = useQuery({
    queryKey: ["keyword-trends", appliedFilters],
    queryFn: ({ signal }) => loadKeywordTrendData(appliedFilters, signal),
  });

  const groups = groupsQuery.data || [];
  const trendRows = trendQuery.data || [];
  const selectedGroup = selectedGroupId ? groups.find((group) => group.id === selectedGroupId) || null : null;
  const selectedGroupFaqsLoaded = Boolean(selectedGroupId && Object.prototype.hasOwnProperty.call(loadedMissingFaqsByGroup, selectedGroupId));

  const selectedFaqQuery = useQuery({
    queryKey: [
      "keyword-suggested-faqs",
      appliedFilters,
      selectedGroupId,
      selectedGroup?.keywords.map((keyword) => `${keyword.word}:${keyword.count}`).join("|") || "",
    ],
    queryFn: ({ signal }) => {
      if (!selectedGroup) return Promise.resolve({ groupId: selectedGroupId || "", missingFaqs: [] });
      return loadGroupSuggestedFaqs(appliedFilters, selectedGroup, signal);
    },
    enabled: Boolean(selectedGroup && selectedGroupId && !selectedGroupFaqsLoaded),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const missingFaqs = useMemo<Record<string, MissingFaqItem[]>>(() => {
    const source = { ...emptyMissingFaqGroups, ...loadedMissingFaqsByGroup };
    return Object.fromEntries(
      Object.entries(source).map(([groupId, items]) => [
        groupId,
        items.map((item) => ({
          ...item,
          added: Boolean(item.added || addedFaqKeys[groupId]?.[normalizeFaqText(item.question)]),
        })),
      ]),
    ) as Record<string, MissingFaqItem[]>;
  }, [loadedMissingFaqsByGroup, addedFaqKeys]);

  const isFaqGroupLoaded = (groupId: string) => Object.prototype.hasOwnProperty.call(loadedMissingFaqsByGroup, groupId);

  const getFaqNeededCount = (group: KeywordGroup) => {
    if (!isFaqGroupLoaded(group.id)) return Math.max(0, group.faqNeeded || 0);
    const items = missingFaqs[group.id] || [];
    return items.filter((item) => !item.added).length;
  };

  // Hàm xử lý khi bấm "Áp dụng" - cập nhật appliedFilters để trigger fetch
  const handleApplyFilters = (newFilters: FilterValues) => {
    queryClient.cancelQueries({ queryKey: ["keyword-groups"] });
    queryClient.cancelQueries({ queryKey: ["keyword-trends"] });
    queryClient.cancelQueries({ queryKey: ["keyword-suggested-faqs"] });
    setLoadedMissingFaqsByGroup({});
    setFaqLoadErrorsByGroup({});
    setSelectedGroupId(null);
    setActiveMissingFaq(null);
    onFiltersChange(newFilters);
    setAppliedFilters(newFilters);
    if (onApplyFilters) onApplyFilters(newFilters);
  };

  useEffect(() => {
    setLoadedMissingFaqsByGroup({});
    setFaqLoadErrorsByGroup({});
    setSelectedGroupId(null);
    setActiveMissingFaq(null);
    setAppliedFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!selectedFaqQuery.data?.groupId) return;
    setLoadedMissingFaqsByGroup((current) => ({
      ...current,
      [selectedFaqQuery.data.groupId]: selectedFaqQuery.data.missingFaqs,
    }));
    setFaqLoadErrorsByGroup((current) => {
      const next = { ...current };
      delete next[selectedFaqQuery.data.groupId];
      return next;
    });
  }, [selectedFaqQuery.data]);

  useEffect(() => {
    if (!selectedGroupId || !selectedFaqQuery.isError) return;
    const message = selectedFaqQuery.error instanceof Error ? selectedFaqQuery.error.message : "Chưa tải được dữ liệu phụ FAQ đề xuất.";
    setFaqLoadErrorsByGroup((current) => ({ ...current, [selectedGroupId]: message }));
  }, [selectedFaqQuery.error, selectedFaqQuery.isError, selectedGroupId]);

  const retryLoadData = () => {
    groupsQuery.refetch();
    trendQuery.refetch();
  };

  const renderLoadingOrError = () => {
    if (groupsQuery.isPending) return <KeywordLoadingState />;
    if (groupsQuery.isError && !groupsQuery.data) {
      const message = groupsQuery.error instanceof Error ? groupsQuery.error.message : "Không thể kết nối API Keywords.";
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
  const filteredGroups = groups.filter((g) => {
    const topic = appliedFilters.topic || "";
    if (!topic || topic === "Tất cả") return true;

    const normalizedTopic = normalizeFilterValue(topic);
    const normalizedGroupName = normalizeFilterValue(g.name);
    const tokenCoverage = normalizedTopic
      .split(" ")
      .filter(Boolean)
      .filter((token) => normalizedGroupName.includes(token)).length;

    if (TOPIC_ALIAS_TERMS[g.id]?.some((alias) => normalizedTopic === alias || normalizedTopic.includes(alias) || alias.includes(normalizedTopic))) {
      return true;
    }

    return g.keywords.some((k) => matchesKeywordFilter(topic, k.word)) ||
      (normalizedGroupName === normalizedTopic || normalizedGroupName.includes(normalizedTopic) || (tokenCoverage >= 2 && normalizedTopic.split(" ").length >= 2));
  });

  const finalGroups = filteredGroups;
  const finalTrendRows = trendRows;

  const displayedGroups = activeGroup ? finalGroups.filter((g) => g.id === activeGroup) : finalGroups;
  const displayedKeywordGroups = displayedGroups.filter((group) => group.id !== "khac");
  const selectedGroupFaqsLoading = Boolean(selectedGroupId && selectedFaqQuery.isFetching && !isFaqGroupLoaded(selectedGroupId));
  const selectedGroupFaqError = selectedGroupId ? faqLoadErrorsByGroup[selectedGroupId] : undefined;

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
          <p className="m-0 text-[13px] text-[rgba(0,56,101,0.5)]">Phân tích theo 6 chủ đề hệ thống</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-3.5 md:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))]">
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
        {trendQuery.isPending ? (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[rgba(0,56,101,0.14)] bg-[#f8fafc] text-xs font-semibold text-[rgba(0,56,101,0.56)]">
            Đang tải dữ liệu xu hướng theo bộ lọc...
          </div>
        ) : trendQuery.isError ? (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[#f4b4a2] bg-[#fff7f4] px-4 text-center text-xs font-semibold text-[#b73512]">
            Chưa tải được dữ liệu xu hướng. Các số liệu tổng phía trên vẫn đang dùng bộ lọc đã áp dụng.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={finalTrendRows} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              {TOPIC_TAXONOMY.map((topic) => {
                const style = TOPIC_LINE_STYLES[topic.id];
                return (!activeGroup || activeGroup === topic.id) ? (
                  <Line
                    key={topic.id}
                    type="monotone"
                    dataKey={topic.label}
                    stroke={style.color}
                    strokeDasharray={style.dash}
                    strokeWidth={2.8}
                    dot={{ r: 3, fill: style.color }}
                  />
                ) : null;
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Keyword detail cards */}
      <div className={cn("grid gap-5", activeGroup ? "grid-cols-[1fr]" : "grid-cols-2")}>
        {displayedKeywordGroups.length === 0 && (
          <div className="rounded-2xl border border-[rgba(0,56,101,0.08)] bg-white px-5 py-6 text-center text-xs text-[rgba(0,56,101,0.48)]">
            Không hiển thị từ khóa riêng cho chủ đề Khác.
          </div>
        )}
        {displayedKeywordGroups.map((group) => (
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
                  title={faqLoadErrorsByGroup[group.id] || undefined}
                  className="cursor-pointer rounded-md border border-[#ED5206] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#ED5206]"
                >
                  {selectedGroupId === group.id && selectedFaqQuery.isFetching && !isFaqGroupLoaded(group.id)
                    ? "FAQ đang tải"
                    : faqLoadErrorsByGroup[group.id]
                      ? "FAQ lỗi tải"
                      : `+${getFaqNeededCount(group)} FAQ cần thêm`}
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
                  <span className="text-xs text-[rgba(0,56,101,0.5)]">Nhóm {selectedGroupId.toUpperCase()} · Chọn câu hỏi để mở Form FAQ</span>
                </div>
              </div>
              <button onClick={() => setSelectedGroupId(null)} className="cursor-pointer border-0 bg-transparent p-1 text-[rgba(0,56,101,0.4)]"><X size={20} /></button>
            </div>

            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto pr-1">
              {(() => {
                const itemsToRender = (missingFaqs[selectedGroupId] || [])
                  .map((item, originalIndex) => ({ ...item, originalIndex }))
                  .filter((item) => !item.added);

                if (selectedGroupFaqsLoading) {
                  return (
                    <div className="rounded-xl border border-[rgba(0,56,101,0.08)] bg-[#F8FBFD] px-5 py-7 text-center">
                      <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[#003BB9]" aria-hidden="true" />
                      <div className="text-[13px] font-semibold text-[#003865]">Đang tải FAQ đề xuất cho nhóm này...</div>
                      <div className="mt-1 text-xs text-[rgba(0,56,101,0.55)]">Dữ liệu từ khóa chính vẫn đang hiển thị bình thường.</div>
                    </div>
                  );
                }

                if (itemsToRender.length === 0) {
                  if (selectedGroupFaqError) {
                    return (
                      <div className="rounded-xl border border-[#FADFA8] bg-[#FFF7E6] px-5 py-6 text-center">
                        <AlertTriangle size={22} className="mx-auto mb-2 text-[#B7791F]" aria-hidden="true" />
                        <div className="text-[13px] font-semibold text-[#8A5A14]">{selectedGroupFaqError}</div>
                        <div className="mt-1 text-xs text-[rgba(0,56,101,0.55)]">Dữ liệu từ khóa chính vẫn đang hiển thị bình thường.</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedGroupId) return;
                            setFaqLoadErrorsByGroup((current) => {
                              const next = { ...current };
                              delete next[selectedGroupId];
                              return next;
                            });
                            selectedFaqQuery.refetch();
                          }}
                          className="mt-4 cursor-pointer rounded-lg border border-[#ED5206] bg-white px-3 py-1.5 text-xs font-semibold text-[#ED5206]"
                        >
                          Tải lại FAQ
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
                            Thêm FAQ
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
