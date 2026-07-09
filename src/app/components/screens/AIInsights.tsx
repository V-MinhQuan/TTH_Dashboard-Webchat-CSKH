import React, { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, FilePlus2, Clock, Table2, Activity, Download, BoldIcon, Filter } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, PieChart, Pie, Cell
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { ApiRequestError, fetchApiJson, buildApiUrl, getAIAnalyticsOverview, resolveAIIssues } from "../../services/dashboardApi";
import { getSheetChatbotRows, type SheetChatbotStats } from "../../services/sheetChatbotApi";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import { bulkCloseConversations, getCustomerPresentation } from "../../services/conversationApi";
import { getAllFailedConversations, getFailedConversations, getTopicFailures, type TopicFailureRecord } from "../../services/round3Api";
import { exportDashboardData } from "../../services/exportService";
import { getAiFailureDefinition } from "../../constants/aiFailureTaxonomy";
import { TOPIC_TAXONOMY, mapTopicToGroupId, topicLabelForGroupId } from "../../constants/topicTaxonomy";
import { StatusBadge } from "../common/StatusBadge";
import { analyticsFiltersToSearchParams, mapGlobalFiltersToAnalyticsRequest, getDateParamsFromFilters } from "../../utils/dateFilters";
import { TOPIC_COLORS } from "../../colors";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const CTA = "#ED5206";
const CTA_SOFT = "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ORANGE_200 = "#FBCBB8";
const AMBER_50 = "#FFF7E6";
const AMBER_100 = "#FADFA8";
const AMBER_TEXT = "#B7791F";
const RED_100 = "#F8CACA";
const RED_TEXT = "#B42318";
const BLUE_50 = "#EBF2FF";
const BLUE_200 = "#B9DCFF";
const OCEAN_PRIMARY = "#003865";
const OCEAN_SECONDARY = "#ED5206";
const FAILED_QUESTIONS_PAGE_SIZE = 10;
const TOPIC_DETAIL_CONVERSATIONS_PAGE_SIZE = 3;
const TABLE_FILTER_ALL = "Tất cả";
const AI_ANALYTICS_TIMEOUT_MS = 120000;
import { AI_TOPIC_FAILURE_TYPES, TOPIC_FAILURE_NUMERIC_KEYS } from "../../constants/aiErrorKeywords";
type OptionalAIInsightsDataKey = "staffReportedErrors" | "suggestedFAQs" | "recentChatbotRows";
const emptyOptionalAIInsightsErrors: Record<OptionalAIInsightsDataKey, boolean> = {
  staffReportedErrors: false,
  suggestedFAQs: false,
  recentChatbotRows: false,
};
type CriticalAIInsightsDataKey = "qualityMetrics" | "failureTrend" | "failureByTopic" | "failedConversations";
const criticalAIInsightsLabels: Record<CriticalAIInsightsDataKey, string> = {
  qualityMetrics: "chỉ số chất lượng AI",
  failureTrend: "xu hướng lỗi AI",
  failureByTopic: "lỗi theo chủ đề",
  failedConversations: "danh sách câu hỏi lỗi AI",
};

const failedTableHeaderFilterLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  whiteSpace: "nowrap",
};

const failedTableFilterControlStyle = (active: boolean): React.CSSProperties => ({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: "8px",
  border: active ? `1px solid ${ORANGE_200}` : "1px solid rgba(0,56,101,0.14)",
  background: active ? ORANGE_50 : "#fff",
  color: active ? CTA : "rgba(0,56,101,0.58)",
  cursor: "pointer",
  flexShrink: 0,
});

const failedTableFilterNativeSelectStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  fontSize: "11px",
  fontFamily: "inherit",
  opacity: 0,
  cursor: "pointer",
  outline: "none",
  border: 0,
};

const failedTableFilterOptionStyle: React.CSSProperties = {
  fontSize: "11px",
  fontFamily: "inherit",
};

type FailReason = "Không tìm thấy dữ liệu" | "Không hiểu câu hỏi" | "Thiếu thông tin" | "Thông tin không chính xác" | "Lỗi nguồn tri thức" | "Lỗi hệ thống" | "AI trả lời sai" | "Khác" | string;

const failReasonColor: Record<FailReason, string> = {
  "Không tìm thấy dữ liệu": ORANGE,
  "Không hiểu câu hỏi": "#8b5cf6",
  "Thiếu thông tin": AMBER_TEXT,
  "Thông tin không chính xác": RED_TEXT,
  "Lỗi nguồn tri thức": "#64748b",
  "Lỗi hệ thống": RED_TEXT,
  "AI trả lời sai": RED_TEXT,
  "Khác": "#64748b",
};

function displayFailureType(value: unknown): FailReason {
  const raw = String(value || "").trim();
  return getAiFailureDefinition(raw)?.label || raw || "Khác";
}

function uniqueSortedText(values: unknown[]) {
  const uniqueValues = new Set<string>();
  values.forEach((value) => {
    const text = String(value || "").trim();
    if (text) uniqueValues.add(text);
  });
  return Array.from(uniqueValues).sort((left, right) => left.localeCompare(right, "vi-VN"));
}

function TableFilterHeader({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const active = value !== TABLE_FILTER_ALL;
  return (
    <div style={failedTableHeaderFilterLabelStyle}>
      <span>{label}</span>
      <label
        data-print-hidden="true"
        title={active ? `Đang lọc: ${value}` : `Lọc theo ${label}`}
        style={failedTableFilterControlStyle(active)}
      >
        <Filter size={11} aria-hidden="true" />
        <select
          aria-label={`Lọc theo ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          style={failedTableFilterNativeSelectStyle}
        >
          <option value={TABLE_FILTER_ALL} style={failedTableFilterOptionStyle}>{TABLE_FILTER_ALL}</option>
          {options.map((option) => (
            <option key={option} value={option} style={failedTableFilterOptionStyle}>{option}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

interface AIInsightsProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
  refreshVersion?: number;
}

function SkeletonBlock({ w = "100%", h = "40px", radius = "10px" }: { w?: string; h?: string; radius?: string }) {
  return (
    <div
      className="animate-shimmer"
      style={{
        width: w,
        height: h,
        borderRadius: radius,
      }}
    />
  );
}

const AIInsightsSkeleton = () => (
  <div style={{ marginTop: "16px" }}>
    <SkeletonBlock w="200px" h="24px" radius="4px" />
    <div style={{ height: "20px" }} />

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "16px" }}>
      {Array(3).fill(0).map((_, i) => (
        <div key={i} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px 22px", border: "1px solid rgba(0,62,154,0.07)", display: "flex", flexDirection: "column", gap: "14px", height: "116px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SkeletonBlock h="38px" w="38px" radius="50%" />
            <SkeletonBlock h="18px" w="45px" radius="10px" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock h="14px" w="70%" />
            <SkeletonBlock h="24px" w="50%" />
          </div>
        </div>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
      {Array(3).fill(0).map((_, i) => (
        <div key={i} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px 22px", border: "1px solid rgba(0,62,154,0.07)", display: "flex", flexDirection: "column", gap: "14px", height: "116px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SkeletonBlock h="38px" w="38px" radius="50%" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock h="14px" w="70%" />
            <SkeletonBlock h="24px" w="50%" />
          </div>
        </div>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px", marginBottom: "24px" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(0,62,154,0.07)", height: "280px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <SkeletonBlock h="22px" w="30%" />
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "12px" }}>
          {[10, 30, 20, 60, 45, 80, 50, 70, 40, 90, 30, 50].map((h, idx) => (
            <SkeletonBlock key={idx} h={`${h}%`} w="100%" radius="6px" />
          ))}
        </div>
      </div>
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(0,62,154,0.07)", height: "280px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
        <div style={{ width: "100%", textAlign: "left" }}>
          <SkeletonBlock h="22px" w="50%" />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "12px", width: "100%" }}>
          {[60, 40, 80, 50, 90].map((h, idx) => (
            <SkeletonBlock key={idx} h={`${h}%`} w="100%" radius="4px" />
          ))}
        </div>
      </div>
    </div>

    <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(0,62,154,0.07)", height: "200px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <SkeletonBlock h="22px" w="30%" />
      <SkeletonBlock h="30px" w="100%" radius="6px" />
      <SkeletonBlock h="30px" w="100%" radius="6px" />
      <SkeletonBlock h="30px" w="100%" radius="6px" />
    </div>
  </div>
);

function displayTopic(value: unknown) {
  const topics = displayTopics(value);
  if (topics.length > 0) return topics[0];
  const raw = typeof value === "string" ? value : "";
  if (raw.trim()) return raw.trim();
  return "Không phân loại trong database";
}

function displayTopics(value: unknown) {
  const candidates = Array.isArray(value)
    ? value.map((item) => String(item || ""))
    : typeof value === "string"
      ? [value]
      : [];
  const topics: string[] = [];
  candidates.forEach((candidate) => {
    const groupId = mapTopicToGroupId(candidate);
    const label = groupId ? topicLabelForGroupId(groupId) : "";
    if (label && !topics.includes(label)) topics.push(label);
  });
  return topics;
}

function displayDateTime(value: unknown) {
  if (!value) return "Không có thời gian trong database";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[=+@-]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function spreadsheetIdentifier(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/^\d{11,}$/.test(text) || /^0\d+$/.test(text)) {
    return `\t${text}`;
  }
  return text;
}

function downloadCsv(filename: string, rows: Array<Array<unknown>>) {
  const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createEmptyTopicFailure(topic: string): TopicFailureRecord {
  return TOPIC_FAILURE_NUMERIC_KEYS.reduce(
    (record, key) => ({ ...record, [key]: 0 }),
    { topic } as TopicFailureRecord,
  );
}

function addTopicFailureCounts(target: TopicFailureRecord, source: TopicFailureRecord) {
  TOPIC_FAILURE_NUMERIC_KEYS.forEach((key) => {
    target[key] = Number(target[key] || 0) + Number(source[key] || 0);
  });
}

function canonicalizeTopicFailures(rows: TopicFailureRecord[]) {
  const grouped = new Map(
    TOPIC_TAXONOMY.map((topic) => [topic.id, createEmptyTopicFailure(topic.label)]),
  );

  rows.forEach((row) => {
    const groupId = mapTopicToGroupId(String(row.topic || ""));
    if (!groupId) return;
    const target = grouped.get(groupId);
    if (target) addTopicFailureCounts(target, row);
  });

  return TOPIC_TAXONOMY.map((topic) => grouped.get(topic.id) || createEmptyTopicFailure(topic.label));
}

function topicFailureVisibleCount(row: TopicFailureRecord, key: (typeof AI_TOPIC_FAILURE_TYPES)[number]["key"]) {
  return Number(row[key] || 0);
}

function visibleTopicFailureTotal(row: TopicFailureRecord) {
  return AI_TOPIC_FAILURE_TYPES.reduce((total, item) => total + topicFailureVisibleCount(row, item.key), 0);
}

function mapFailedConversation(record: any) {
  const customer = getCustomerPresentation(
    record.customerDisplayName || record.customerName || record.customer_name,
    record.customerId,
    record.phoneNumber,
  );
  const topics = displayTopics(record.detectedTopics);
  const topic = topics[0] || displayTopic(record.detectedTopics);

  const uniqueId = record.id ?? record.messageId ?? `fallback-${record.conversationId}-${Math.random().toString(36).slice(2)}`;

  return {
    id: uniqueId,
    messageId: record.messageId,
    question: record.textContent || "Chưa có dữ liệu",
    aiAnswer: record.aiAnswer || "Không tìm thấy câu trả lời AI tương ứng",
    conversationId: Number(record.conversationId),
    topic,
    topics: topics.length > 0 ? topics : [topic],
    channel: record.source || "Chưa xác định",
    failReason: displayFailureType(record.issueType),
    confidence: Number(record.issueConfidence) || 0,
    impact: "Chưa xác định",
    kbSuggestion: record.issueReason || "Chưa có dữ liệu",
    customerId: record.customerId || null,
    phoneNumber: record.phoneNumber || null,
    customerName: customer.primary,
    customerReference: customer.secondary,
    messageAt: record.messageAt || null,
  };
}

function buildFailedConversationCsvRows(records: Array<ReturnType<typeof mapFailedConversation>>) {
  return [
    [
      "STT",
      "Message ID",
      "Conversation ID",
      "Customer ID",
      "Số điện thoại",
      "Tên khách hàng",
      "Câu hỏi khách hàng",
      "Câu trả lời AI",
      "Chủ đề",
      "Kênh",
      "Lý do lỗi AI",
      "Mức độ tin cậy",
      "Gợi ý tri thức",
      "Thời gian",
    ],
    ...records.map((row, index) => [
      index + 1,
      spreadsheetIdentifier(row.messageId),
      spreadsheetIdentifier(row.conversationId),
      spreadsheetIdentifier(row.customerId),
      spreadsheetIdentifier(row.phoneNumber),
      row.customerName,
      row.question,
      row.aiAnswer,
      row.topic,
      row.channel,
      row.failReason,
      row.confidence,
      row.kbSuggestion,
      row.messageAt,
    ]),
  ];
}



export function AIInsights({ filters, onFiltersChange, onNavigate, refreshVersion = 0 }: AIInsightsProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedChatbotRow, setExpandedChatbotRow] = useState<string | null>(null);
  const [expandedTopicConv, setExpandedTopicConv] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [faqModalConv, setFaqModalConv] = useState<any>(null);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
  const [selectedFailureIds, setSelectedFailureIds] = useState<Set<number>>(() => new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [topN, setTopN] = useState(5);
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<string | null>(null);
  const [selectedTopicConversationPage, setSelectedTopicConversationPage] = useState(1);
  const [failedPage, setFailedPage] = useState(1);
  const [failedTopicFilter, setFailedTopicFilter] = useState(TABLE_FILTER_ALL);
  const [failedReasonFilter, setFailedReasonFilter] = useState(TABLE_FILTER_ALL);
  const [chatbotTopicFilter, setChatbotTopicFilter] = useState(TABLE_FILTER_ALL);
  const [chatbotChannelFilter, setChatbotChannelFilter] = useState(TABLE_FILTER_ALL);
  const [chatbotStatusFilter, setChatbotStatusFilter] = useState(TABLE_FILTER_ALL);
  const [exportingFailed, setExportingFailed] = useState(false);
  const bulkSubmitGuard = useRef(false);

  const [qualityMetrics, setQualityMetrics] = useState<any>({ total_messages: 0, success_rate: 0, failure_count: 0, hallucination_count: 0, avg_confidence: 0 });
  const [failureTrend, setFailureTrend] = useState<any[]>([]);
  const [failureByTopic, setFailureByTopic] = useState<TopicFailureRecord[]>([]);
  const [failedConversations, setFailedConversations] = useState<any[]>([]);
  const [failedConversationTotal, setFailedConversationTotal] = useState(0);
  const [staffReportedErrors, setStaffReportedErrors] = useState<any[]>([]);
  const [suggestedFAQs, setSuggestedFAQs] = useState<any[]>([]);
  const [recentChatbotRows, setRecentChatbotRows] = useState<any[]>([]);
  const [sheetStats, setSheetStats] = useState<Partial<SheetChatbotStats>>({});
  const [optionalDataErrors, setOptionalDataErrors] = useState<Record<OptionalAIInsightsDataKey, boolean>>(() => ({ ...emptyOptionalAIInsightsErrors }));

  useEffect(() => {
    let cancelled = false;
    const queryParams = analyticsFiltersToSearchParams(filters);
    const feedbackFilters = mapGlobalFiltersToAnalyticsRequest(filters);
    const qs = queryParams.toString();

    const fetchData = async () => {
      setLoading(true);
      setOptionalDataErrors({ ...emptyOptionalAIInsightsErrors });
      try {
        const criticalErrors: CriticalAIInsightsDataKey[] = [];
        const nextOptionalErrors: Record<OptionalAIInsightsDataKey, boolean> = { ...emptyOptionalAIInsightsErrors };
        const markOptionalFailure = (key: OptionalAIInsightsDataKey) => {
          nextOptionalErrors[key] = true;
          if (!cancelled) {
            setOptionalDataErrors((current) => (
              current[key] ? current : { ...current, [key]: true }
            ));
          }
        };
        const safeRequired = async <T,>(key: CriticalAIInsightsDataKey, request: Promise<T>): Promise<T | null> => {
          try {
            return await request;
          } catch (error) {
            criticalErrors.push(key);
            console.warn(`Critical AI insights request failed (${key}):`, error);
            return null;
          }
        };
        const safeOptional = async <T,>(key: OptionalAIInsightsDataKey, request: Promise<T>): Promise<T | null> => {
          try {
            return await request;
          } catch (error) {
            markOptionalFailure(key);
            console.warn("Optional AI insights request failed:", error);
            return null;
          }
        };

        const [qm, ft, fbt, fc, sre, sf, scRows] = await Promise.all([
          safeRequired("qualityMetrics", fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/quality-metrics?${qs}`), { cache: false, timeoutMs: AI_ANALYTICS_TIMEOUT_MS })),
          safeRequired("failureTrend", fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/failure-trend?${qs}`), { cache: false, timeoutMs: AI_ANALYTICS_TIMEOUT_MS })),
          safeRequired("failureByTopic", getTopicFailures(queryParams)),
          safeRequired("failedConversations", getFailedConversations(queryParams)),
          safeOptional("staffReportedErrors", fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/staff-reported-errors?${qs}`), { cache: false, timeoutMs: AI_ANALYTICS_TIMEOUT_MS })),
          safeOptional("suggestedFAQs", fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/suggested-faqs?${qs}`), { cache: false, timeoutMs: AI_ANALYTICS_TIMEOUT_MS })),
          safeOptional("recentChatbotRows", getSheetChatbotRows({ pageSize: 5, ...feedbackFilters })),
        ]);

        if (cancelled) return;
        if (qm?.success) setQualityMetrics(qm.data);
        if (ft?.success) setFailureTrend(ft.data.map((d: any) => ({
          date: d.date,
          thieuDL: d.thieuDL || 0,
          khongChac: d.khongChac || 0,
        })));
        if (Array.isArray(fbt)) setFailureByTopic(fbt);
        if (fc?.records) {
          setFailedConversations(fc.records.map(mapFailedConversation));
          setFailedConversationTotal(Number(fc.pagination?.total ?? fc.records.length) || 0);
        }
        setFailedPage(1);
        setSelectedFailureIds(new Set());
        setShowConfirmAllModal(false);
        if (sre?.success) setStaffReportedErrors(sre.data.records.map((r: any) => ({
          id: r.id, time: displayDateTime(r.messageAt), staff: "Chưa xác định", channel: r.source || "Chưa xác định",
          topic: displayTopic(r.detectedTopics), question: r.textContent || "Chưa có dữ liệu", aiAnswer: r.aiAnswer || "Không tìm thấy câu trả lời AI tương ứng",
          reason: r.issueType || "Chưa xác định", impact: "Chưa xác định", status: r.needStaffReview ? "Chờ quản lý xác nhận" : "Chưa xác định"
        })));
        else {
          if (sre) markOptionalFailure("staffReportedErrors");
          setStaffReportedErrors([]);
        }
        if (sf?.success) setSuggestedFAQs(sf.data);
        else {
          if (sf) markOptionalFailure("suggestedFAQs");
          setSuggestedFAQs([]);
        }
        if (scRows?.success) {
          setRecentChatbotRows(scRows.data || []);
          setSheetStats(scRows.stats || {});
        } else {
          if (scRows) markOptionalFailure("recentChatbotRows");
          setRecentChatbotRows([]);
          setSheetStats({});
        }
        setOptionalDataErrors(nextOptionalErrors);
        if (criticalErrors.length > 0) {
          const failedLabels = criticalErrors.map((key) => criticalAIInsightsLabels[key]);
          toast.warning(`Chưa tải được ${failedLabels.join(", ")}. Các phần đã tải vẫn được hiển thị.`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Fetch API Error:", err);
        toast.error("Lỗi khi tải dữ liệu Phân tích AI");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [filters, refreshVersion]);

  const canonicalFailureByTopic = useMemo(
    () => {
      let data = canonicalizeTopicFailures(failureByTopic).filter(row => row.topic !== "Khác");
      if (filters.topic && filters.topic !== "Tất cả") {
        const expectedGroupId = mapTopicToGroupId(filters.topic);
        data = data.filter(row => mapTopicToGroupId(row.topic) === expectedGroupId);
      }
      return data;
    },
    [failureByTopic, filters.topic],
  );
  const topFailureTopics = useMemo(
    () => [...canonicalFailureByTopic]
      .sort((left, right) => visibleTopicFailureTotal(right) - visibleTopicFailureTotal(left))
      .slice(0, topN)
      .map(t => ({
        topic: t.topic,
        thieuDL: t.thieuDL || 0,
        khongChac: t.khongChac || 0
      })),
    [canonicalFailureByTopic, topN],
  );
  const supplementalFailureTopics = useMemo(
    () => [...canonicalFailureByTopic]
      .filter((row) => mapTopicToGroupId(row.topic) !== "khac")
      .sort((left, right) => visibleTopicFailureTotal(right) - visibleTopicFailureTotal(left))
      .slice(0, topN),
    [canonicalFailureByTopic, topN],
  );
  const selectedTopicFailure = useMemo(
    () => selectedTopicDetail
      ? supplementalFailureTopics.find((row) => row.topic === selectedTopicDetail) || null
      : null,
    [selectedTopicDetail, supplementalFailureTopics],
  );
  const selectedTopicRelatedConversations = useMemo(
    () => selectedTopicDetail
      ? failedConversations.filter((conversation) => conversation.topic === selectedTopicDetail)
      : [],
    [failedConversations, selectedTopicDetail],
  );
  const selectedTopicConversationTotalPages = Math.max(
    1,
    Math.ceil(selectedTopicRelatedConversations.length / TOPIC_DETAIL_CONVERSATIONS_PAGE_SIZE),
  );
  const selectedTopicConversationPageSafe = Math.min(
    selectedTopicConversationPage,
    selectedTopicConversationTotalPages,
  );
  const paginatedSelectedTopicRelatedConversations = useMemo(
    () => selectedTopicRelatedConversations.slice(
      (selectedTopicConversationPageSafe - 1) * TOPIC_DETAIL_CONVERSATIONS_PAGE_SIZE,
      selectedTopicConversationPageSafe * TOPIC_DETAIL_CONVERSATIONS_PAGE_SIZE,
    ),
    [selectedTopicConversationPageSafe, selectedTopicRelatedConversations],
  );
  const selectedTopicConversationStartNumber = selectedTopicRelatedConversations.length === 0
    ? 0
    : (selectedTopicConversationPageSafe - 1) * TOPIC_DETAIL_CONVERSATIONS_PAGE_SIZE + 1;
  const selectedTopicConversationEndNumber = Math.min(
    selectedTopicConversationPageSafe * TOPIC_DETAIL_CONVERSATIONS_PAGE_SIZE,
    selectedTopicRelatedConversations.length,
  );

  const failedTopicOptions = useMemo(
    () => uniqueSortedText(failedConversations.map((conversation) => conversation.topic)),
    [failedConversations],
  );
  const failedReasonOptions = useMemo(
    () => uniqueSortedText(failedConversations.map((conversation) => conversation.failReason)),
    [failedConversations],
  );
  const filteredFailedConversations = useMemo(
    () => failedConversations.filter((conversation) => {
      if (filters.topic && filters.topic !== "Tất cả") {
        const expectedGroupId = mapTopicToGroupId(filters.topic);
        const convTopicId = mapTopicToGroupId(conversation.topic || "");
        if (convTopicId !== expectedGroupId) return false;
      }
      const matchesTopic = failedTopicFilter === TABLE_FILTER_ALL || conversation.topic === failedTopicFilter;
      const matchesReason = failedReasonFilter === TABLE_FILTER_ALL || conversation.failReason === failedReasonFilter;
      return matchesTopic && matchesReason;
    }),
    [failedConversations, failedReasonFilter, failedTopicFilter, filters.topic],
  );
  const hasFailedTableFilters =
    failedTopicFilter !== TABLE_FILTER_ALL ||
    failedReasonFilter !== TABLE_FILTER_ALL;

  const chatbotTopicOptions = useMemo(
    () => uniqueSortedText(recentChatbotRows.map((item) => item.topic)),
    [recentChatbotRows],
  );
  const chatbotChannelOptions = useMemo(
    () => uniqueSortedText(recentChatbotRows.map((item) => item.channel || "Chưa xác định")),
    [recentChatbotRows],
  );
  const chatbotStatusOptions = useMemo(
    () => uniqueSortedText(recentChatbotRows.map((item) => item.status)),
    [recentChatbotRows],
  );
  const filteredRecentChatbotRows = useMemo(
    () => recentChatbotRows.filter((item) => {
      const channelLabel = item.channel || "Chưa xác định";
      const matchesTopic = chatbotTopicFilter === TABLE_FILTER_ALL || item.topic === chatbotTopicFilter;
      const matchesChannel = chatbotChannelFilter === TABLE_FILTER_ALL || channelLabel === chatbotChannelFilter;
      const matchesStatus = chatbotStatusFilter === TABLE_FILTER_ALL || item.status === chatbotStatusFilter;
      return matchesTopic && matchesChannel && matchesStatus;
    }),
    [chatbotChannelFilter, chatbotStatusFilter, chatbotTopicFilter, recentChatbotRows],
  );
  const hasChatbotTableFilters =
    chatbotTopicFilter !== TABLE_FILTER_ALL ||
    chatbotChannelFilter !== TABLE_FILTER_ALL ||
    chatbotStatusFilter !== TABLE_FILTER_ALL;

  const failedConversationTotalSafe = Math.max(failedConversationTotal, failedConversations.length);

  const failedTotalPages = Math.max(1, Math.ceil(filteredFailedConversations.length / FAILED_QUESTIONS_PAGE_SIZE));
  const failedPageSafe = Math.min(failedPage, failedTotalPages);
  const paginatedFailedConversations = useMemo(
    () => filteredFailedConversations.slice(
      (failedPageSafe - 1) * FAILED_QUESTIONS_PAGE_SIZE,
      failedPageSafe * FAILED_QUESTIONS_PAGE_SIZE,
    ),
    [failedPageSafe, filteredFailedConversations],
  );
  const failedStartNumber = filteredFailedConversations.length === 0
    ? 0
    : (failedPageSafe - 1) * FAILED_QUESTIONS_PAGE_SIZE + 1;
  const failedEndNumber = Math.min(
    failedPageSafe * FAILED_QUESTIONS_PAGE_SIZE,
    filteredFailedConversations.length,
  );

  useEffect(() => {
    if (failedTopicFilter !== TABLE_FILTER_ALL && !failedTopicOptions.includes(failedTopicFilter)) {
      setFailedTopicFilter(TABLE_FILTER_ALL);
    }
  }, [failedTopicFilter, failedTopicOptions]);

  useEffect(() => {
    if (failedReasonFilter !== TABLE_FILTER_ALL && !failedReasonOptions.includes(failedReasonFilter)) {
      setFailedReasonFilter(TABLE_FILTER_ALL);
    }
  }, [failedReasonFilter, failedReasonOptions]);

  useEffect(() => {
    if (selectedTopicDetail && !canonicalFailureByTopic.some((row) => row.topic === selectedTopicDetail)) {
      setSelectedTopicDetail(null);
    }
  }, [canonicalFailureByTopic, selectedTopicDetail]);

  useEffect(() => {
    setSelectedTopicConversationPage(1);
  }, [selectedTopicDetail]);

  useEffect(() => {
    setSelectedTopicConversationPage((page) => (
      Math.min(Math.max(page, 1), selectedTopicConversationTotalPages)
    ));
  }, [selectedTopicConversationTotalPages]);

  useEffect(() => {
    setFailedPage(1);
    setSelectedFailureIds(new Set());
    setExpandedRow(null);
  }, [failedReasonFilter, failedTopicFilter]);

  useEffect(() => {
    if (chatbotTopicFilter !== TABLE_FILTER_ALL && !chatbotTopicOptions.includes(chatbotTopicFilter)) {
      setChatbotTopicFilter(TABLE_FILTER_ALL);
    }
  }, [chatbotTopicFilter, chatbotTopicOptions]);

  useEffect(() => {
    if (chatbotStatusFilter !== TABLE_FILTER_ALL && !chatbotStatusOptions.includes(chatbotStatusFilter)) {
      setChatbotStatusFilter(TABLE_FILTER_ALL);
    }
  }, [chatbotStatusFilter, chatbotStatusOptions]);

  useEffect(() => {
    if (chatbotChannelFilter !== TABLE_FILTER_ALL && !chatbotChannelOptions.includes(chatbotChannelFilter)) {
      setChatbotChannelFilter(TABLE_FILTER_ALL);
    }
  }, [chatbotChannelFilter, chatbotChannelOptions]);

  useEffect(() => {
    setExpandedChatbotRow(null);
  }, [chatbotChannelFilter, chatbotStatusFilter, chatbotTopicFilter]);

  useEffect(() => {
    setFailedPage((page) => Math.min(Math.max(page, 1), failedTotalPages));
  }, [failedTotalPages]);

  const goToFailedPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), failedTotalPages);
    setFailedPage(nextPage);
    setSelectedFailureIds(new Set());
    setExpandedRow(null);
  };

  const handleMarkAsProcessed = async (id: string | number, showToast = true) => {
    const row = failedConversations.find((conversation) => String(conversation.id) === String(id));
    if (!row || !Number.isInteger(row.id) || row.id <= 0) {
      toast.error("Bản ghi không hợp lệ.");
      return;
    }
    try {
      const result = await resolveAIIssues([row.id as number]);
      setFailedConversations((current) => current.filter((conversation) => String(conversation.id) !== String(id)));
      setSelectedFailureIds((current) => {
        const next = new Set(current);
        next.delete(row.id as number);
        return next;
      });
      if (showToast) toast.success("Đã đánh dấu xử lý");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái lỗi.");
    }
  };

  const selectableFailureIds = paginatedFailedConversations
    .map((conversation) => conversation.id as number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const allFailuresSelected =
    selectableFailureIds.length > 0 &&
    selectableFailureIds.every((id) => selectedFailureIds.has(id));

  const submitSelectedFailures = async () => {
    if (bulkSubmitGuard.current || bulkSubmitting || selectedFailureIds.size === 0) return;
    bulkSubmitGuard.current = true;
    const selectedIds = new Set(selectedFailureIds);
    setBulkSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await resolveAIIssues(ids);
      setFailedConversations((current) => current.filter((row) => !selectedIds.has(row.id as number)));
      setSelectedFailureIds(new Set());
      setShowConfirmAllModal(false);
      toast.success(`Đã cập nhật ${result.updated} lỗi trên ${ids.length} lỗi được chọn.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật các lỗi đã chọn.");
    } finally {
      bulkSubmitGuard.current = false;
      setBulkSubmitting(false);
    }
  };

  const handleExportFailedConversations = async () => {
    if (exportingFailed) return;
    setExportingFailed(true);
    try {
      const queryParams = analyticsFiltersToSearchParams(filters);
      
      const date = new Date().toISOString().slice(0, 10);
      const scope = "-toan-bo-du-lieu-da-loc";
      const result = await getAllFailedConversations(queryParams, { pageSize: 100 });
      const exportRows = result.records.map(mapFailedConversation);
      if (!exportRows.length) {
        toast.warning("Không có dữ liệu lỗi AI để xuất.");
        return;
      }

      const csvData = buildFailedConversationCsvRows(exportRows);
      const headers = csvData[0];
      const rows = csvData.slice(1);

      await exportDashboardData({
        format: "xlsx",
        target: document.createElement("div"),
        filenameBase: `cau-hoi-ai-chua-xu-ly${scope}-${date}`,
        filters: filters,
        rawData: { headers: headers as string[], rows: rows as string[][] }
      });
      
      toast.success(`Đã xuất ${exportRows.length}/${result.total} dòng lỗi AI theo bộ lọc.`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        toast.error(`Export thất bại (${error.status}): ${error.message}`);
      } else {
        toast.error(error instanceof Error ? error.message : "Không thể xuất toàn bộ dữ liệu lỗi AI đã lọc.");
      }
    } finally {
      setExportingFailed(false);
    }
  };
  const kpiStats = {
    ai_success: (qualityMetrics?.total_messages || 0) - (qualityMetrics?.failure_count || 0),
    ai_failure: qualityMetrics?.failure_count || 0,
    ai_accuracy: qualityMetrics?.success_rate || 0,
  };
  const optionalNoticeItems = useMemo(() => {
    const items: string[] = [];
    if (optionalDataErrors.staffReportedErrors) items.push("lỗi nhân viên báo cáo");
    if (optionalDataErrors.suggestedFAQs) items.push("FAQ gợi ý");
    return items;
  }, [optionalDataErrors.staffReportedErrors, optionalDataErrors.suggestedFAQs]);

  const getExportData = async () => {
    const datasets: any[] = [];

    // 1. Chỉ số chất lượng
    datasets.push({
      title: "Chỉ số chất lượng AI",
      headers: ["AI phản hồi thành công", "AI phản hồi thất bại", "Tỷ lệ chính xác (%)"],
      rows: [[
        String(kpiStats.ai_success),
        String(kpiStats.ai_failure),
        String(Math.round(kpiStats.ai_accuracy))
      ]]
    });

    // 2. Lỗi AI theo chủ đề
    datasets.push({
      title: "Lỗi theo chủ đề",
      headers: ["Chủ đề", "Thiếu dữ liệu", "AI không chắc chắn", "Tổng số lỗi"],
      rows: canonicalFailureByTopic.map(t => [
        t.topic,
        String(t.thieuDL || 0),
        String(t.khongChac || 0),
        String(visibleTopicFailureTotal(t))
      ])
    });

    // 3. Danh sách câu hỏi AI chưa xử lý (Fetch all pages)
    let failedRows: string[][] = [];
    const failedHeaders = [
      "Khách hàng",
      "Nguồn",
      "Chủ đề",
      "Nội dung khách hỏi (Câu cuối cùng)",
      "Lý do thất bại",
      "Câu trả lời của AI (Nếu có)",
      "Ngày xảy ra"
    ];
    let loadingToastId: string | number | undefined;

    try {
      loadingToastId = toast.loading("Đang tải toàn bộ dữ liệu lỗi AI để xuất Excel...");
      const queryParams = analyticsFiltersToSearchParams(filters);
      const result = await getAllFailedConversations(queryParams, { pageSize: 100 });
      const exportRows = result.records.map(mapFailedConversation);
      failedRows = buildFailedConversationCsvRows(exportRows).slice(1) as string[][];
      toast.dismiss(loadingToastId);
    } catch (e) {
      console.error("Lỗi tải danh sách lỗi AI:", e);
      if (loadingToastId) toast.dismiss(loadingToastId);
      toast.error("Không tải được toàn bộ lỗi AI, chỉ xuất dữ liệu hiện tại.");
      // Fallback
      failedRows = buildFailedConversationCsvRows(failedConversations.map(mapFailedConversation)).slice(1) as string[][];
    }

    datasets.push({
      title: "Danh sách lỗi AI",
      headers: failedHeaders,
      rows: failedRows
    });



    // 5. FAQ gợi ý bổ sung
    if (suggestedFAQs.length > 0) {
      datasets.push({
        title: "Gợi ý bổ sung FAQ",
        headers: ["Câu hỏi", "Số lần gặp", "Câu trả lời gợi ý", "Chủ đề", "Mức độ ưu tiên"],
        rows: suggestedFAQs.map(f => [
          f.question || "",
          String(f.freq || 0),
          f.suggestedAnswer || "",
          f.topic || "",
          f.priority || ""
        ])
      });
    }

    return datasets;
  };

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} getExportData={getExportData} isLoading={loading} />

      <div data-export-target="true">
        {loading ? <AIInsightsSkeleton /> : (
          <>
            {optionalNoticeItems.length > 0 && (
              <div style={{ marginBottom: "16px", borderRadius: "12px", border: `1px solid ${AMBER_100}`, background: AMBER_50, color: AMBER_TEXT, padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600 }}>
                <AlertTriangle size={15} aria-hidden="true" />
                <span>Dữ liệu phụ tạm thời chưa tải được: {optionalNoticeItems.join(", ")}. Dữ liệu chính vẫn đang hiển thị.</span>
              </div>
            )}

            {/* KPI Row - AI insights */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
              {[
                { icon: CheckCircle, label: "AI phản hồi thành công", value: kpiStats.ai_success.toString(), change: "Theo bộ lọc" },
                { icon: XCircle, label: "AI phản hồi thất bại", value: kpiStats.ai_failure.toString(), change: "Theo bộ lọc" },
                { icon: Activity, label: "Tỷ lệ chính xác", value: `${Math.round(kpiStats.ai_accuracy)}%`, change: "Theo bộ lọc" },
              ].map(({ icon: Icon, label, value, change }) => {
                const badgeBg = "#f8fafc";
                const badgeColor = "#64748b";
                let iconBg = "#EBF2FF";
                let iconColor = NAVY;
                if (Icon === CheckCircle) {
                  iconBg = "#EAF8F1";
                  iconColor = "#228A61";
                } else if (Icon === XCircle) {
                  iconBg = "#FFF1F1";
                  iconColor = "#B42318";
                } else if (Icon === Activity) {
                  iconBg = "#EBF2FF";
                  iconColor = NAVY;
                }

                return (
                  <div
                    key={label}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: "16px",
                      border: "1px solid rgba(0,56,101,0.08)",
                      boxShadow: "0 2px 10px rgba(0,62,154,0.06)",
                      padding: "20px 22px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "stretch",
                      transition: "box-shadow 0.2s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,62,154,0.11)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,62,154,0.06)";
                    }}
                  >
                    {/* Left Column: Icon (top) and Label (bottom) */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "72px" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={24} style={{ color: iconColor }} />
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(0,56,101,0.55)", lineHeight: 1.3 }}>{label}</div>
                    </div>

                    {/* Right Column: Value (bottom) */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-end", height: "100%", minHeight: "72px" }}>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: NAVY, lineHeight: 1 }}>{value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts */}
            <div className="ai-insights-chart-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: "20px", marginBottom: "24px", alignItems: "stretch" }}>
              <ChartCard title="Biểu đồ AI phản hồi thất bại theo ngày" onOpenBuilder={() => onNavigate("chartbuilder")} data={failureTrend} defaultChartType="line" supportedChartTypes={["line", "area", "bar", "hbar"]}>
                {({ chartType, chartData, editValues }: any) => {
                  const isBar = chartType === "bar" || chartType === "hbar";
                  const isArea = chartType === "area";
                  const ChartComp = isBar ? BarChart : isArea ? AreaChart : LineChart;
                  const layout = chartType === "hbar" ? "vertical" : "horizontal";

                  return (
                    <ResponsiveContainer width="100%" height={210}>
                      <ChartComp data={chartData} layout={layout}>
                        <CartesianGrid stroke="rgba(0,56,101,0.06)" horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
                        <XAxis dataKey={layout === "vertical" ? undefined : "date"} type={layout === "vertical" ? "number" : "category"} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                        <YAxis dataKey={layout === "vertical" ? "date" : undefined} type={layout === "vertical" ? "category" : "number"} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} width={layout === "vertical" ? 70 : undefined} />
                        <Tooltip />
                        {editValues?.legend !== false && <Legend iconSize={10} />}
                        {layout === "horizontal" && <ReferenceLine x="28/4" stroke="rgba(0,56,101,0.2)" label={{ value: "Dự báo →", position: "insideTopRight", fontSize: 10, fill: "rgba(0,56,101,0.4)" }} />}

                        {isBar ? (
                          <>
                            <Bar maxBarSize={40} dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={OCEAN_PRIMARY} />
                            <Bar maxBarSize={40} dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill={OCEAN_SECONDARY} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                          </>
                        ) : isArea ? (
                          <>
                            <Area type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" stroke={OCEAN_PRIMARY} fill={`${OCEAN_PRIMARY}30`} strokeWidth={2} />
                            <Area type="monotone" dataKey="khongChac" name="AI không chắc chắn" stackId="a" stroke={OCEAN_SECONDARY} fill={`${OCEAN_SECONDARY}30`} strokeWidth={2} />
                          </>
                        ) : (
                          <>
                            <Line type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stroke={OCEAN_PRIMARY} strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="khongChac" name="AI không chắc chắn" stroke={OCEAN_SECONDARY} strokeWidth={1.5} dot={false} />
                          </>
                        )}
                      </ChartComp>
                    </ResponsiveContainer>
                  );
                }}
              </ChartCard>

              <div style={{ minWidth: 0 }}>
                <ChartCard
                  title="Lỗi về AI theo chủ đề"
                  onOpenBuilder={() => onNavigate("chartbuilder")}
                  data={topFailureTopics}
                  defaultChartType="hbar"
                  supportedChartTypes={["line", "area", "bar", "hbar", "pie", "donut"]}
                >
                  {({ chartType, chartData, editValues }: any) => {
                    const showLegend = editValues?.legend !== false;

                    if (chartType === "pie" || chartType === "donut") {
                      const pieData = (Array.isArray(chartData) ? chartData : []).map((d: any) => ({
                        name: d.topic,
                        value: (d.thieuDL || 0) + (d.khongChac || 0)
                      }));

                      const COLORS = [OCEAN_PRIMARY, OCEAN_SECONDARY, "#00A3E0", "#00D2FF", "#ED5206"];
                      return (
                        <ResponsiveContainer width="100%" height={210}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={chartType === "pie" ? 0 : 50}
                              outerRadius={80}
                              dataKey="value"
                              label={showLegend ? { fontSize: 10, fill: "rgba(0,56,101,0.6)" } : false}
                            >
                              {pieData.map((d, i) => <Cell key={i} fill={TOPIC_COLORS[d.name] || COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            {showLegend && <Legend iconSize={10} />}
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    }

                    const isBar = chartType === "bar" || chartType === "hbar";
                    const isArea = chartType === "area";
                    const ChartComp = isBar ? BarChart : isArea ? AreaChart : LineChart;
                    const layout = chartType === "hbar" ? "vertical" : "horizontal";

                    return (
                      <ResponsiveContainer width="100%" height={210}>
                        <ChartComp
                          data={chartData}
                          layout={layout}
                          barSize={layout === "vertical" ? 8 : 20}
                        >
                          <CartesianGrid stroke="rgba(0,56,101,0.06)" horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
                          <XAxis dataKey={layout === "vertical" ? undefined : "topic"} type={layout === "vertical" ? "number" : "category"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
                          <YAxis dataKey={layout === "vertical" ? "topic" : undefined} type={layout === "vertical" ? "category" : "number"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} width={layout === "vertical" ? 90 : undefined} />
                          <Tooltip />
                          {showLegend && <Legend />}

                          {isBar ? (
                            <>
                              <Bar maxBarSize={40} dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={OCEAN_PRIMARY} />
                              <Bar maxBarSize={40} dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill={OCEAN_SECONDARY} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                            </>
                          ) : isArea ? (
                            <>
                              <Area type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={`${OCEAN_PRIMARY}50`} stroke={OCEAN_PRIMARY} />
                              <Area type="monotone" dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill={`${OCEAN_SECONDARY}50`} stroke={OCEAN_SECONDARY} />
                            </>
                          ) : (
                            <>
                              <Line type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stroke="#00A3E0" strokeWidth={1.5} dot={false} />
                              <Line type="monotone" dataKey="khongChac" name="AI không chắc chắn" stroke="#00D2FF" strokeWidth={1.5} dot={false} />
                            </>
                          )}
                        </ChartComp>
                      </ResponsiveContainer>
                    );
                  }}
                </ChartCard>
              </div>
            </div>

            {/* AI Failed Conversations Table */}
            <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <XCircle size={16} style={{ color: ORANGE }} />
                  <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Số lượng lỗi AI cần xử lý</h3>
                  <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ORANGE_50, color: ORANGE, border: `1px solid ${ORANGE_200}`, fontWeight: 600 }}>
                    {hasFailedTableFilters
                      ? `${filteredFailedConversations.length} câu hỏi / ${failedConversationTotalSafe} tổng`
                      : `${failedConversationTotalSafe} câu hỏi`}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      aria-label="Xuất dữ liệu lỗi AI"
                      disabled={exportingFailed}
                      onClick={() => void handleExportFailedConversations()}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: exportingFailed ? "not-allowed" : "pointer", fontSize: "12px", opacity: exportingFailed ? 0.72 : 1 }}
                    >
                      <Download size={11} aria-hidden="true" /> {exportingFailed ? "Đang xuất..." : "Xuất XLSX"}
                    </button>
                  </div>
                  <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.58)" }}>Phạm vi: toàn bộ dữ liệu đã lọc</span>
                </div>
              </div>
              {selectedFailureIds.size > 0 && (
                <div role="toolbar" aria-label="Thao tác hàng loạt lỗi AI" style={{ padding: "10px 24px", background: ORANGE_50, borderBottom: `1px solid ${ORANGE_200}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <strong style={{ color: NAVY, fontSize: "12px" }}>{selectedFailureIds.size} hội thoại đã chọn</strong>
                  <button onClick={() => setShowConfirmAllModal(true)} disabled={bulkSubmitting} style={{ padding: "7px 14px", borderRadius: "8px", border: "none", background: CTA, color: "#fff", fontWeight: 700 }}>
                    Đánh dấu đã xử lý
                  </button>
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th className="flic-th" style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả hội thoại lỗi AI trên trang hiện tại"
                          checked={allFailuresSelected}
                          onChange={() =>
                            setSelectedFailureIds((current) => {
                              if (allFailuresSelected) return new Set();
                              return new Set([...current, ...selectableFailureIds]);
                            })
                          }
                        />
                      </th>
                      <th className="flic-th">Câu hỏi của KH</th>
                      <th className="flic-th">Mã KH</th>
                      <th className="flic-th">
                        <div style={failedTableHeaderFilterLabelStyle}>
                          <span>Chủ đề</span>
                          <label
                            data-print-hidden="true"
                            title={failedTopicFilter === TABLE_FILTER_ALL ? "Lọc theo Chủ đề" : `Đang lọc: ${failedTopicFilter}`}
                            style={failedTableFilterControlStyle(failedTopicFilter !== TABLE_FILTER_ALL)}
                          >
                            <Filter size={11} aria-hidden="true" />
                            <select
                              aria-label="Lọc câu hỏi AI chưa xử lý theo Chủ đề"
                              value={failedTopicFilter}
                              onChange={(event) => setFailedTopicFilter(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              style={failedTableFilterNativeSelectStyle}
                            >
                              <option value={TABLE_FILTER_ALL} style={failedTableFilterOptionStyle}>Tất cả</option>
                              {failedTopicOptions.map((topic) => (
                                <option key={topic} value={topic} style={failedTableFilterOptionStyle}>{topic}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </th>
                      <th className="flic-th">Kênh</th>
                      <th className="flic-th">
                        <div style={failedTableHeaderFilterLabelStyle}>
                          <span>Lý do lỗi AI</span>
                          <label
                            data-print-hidden="true"
                            title={failedReasonFilter === TABLE_FILTER_ALL ? "Lọc theo Lý do lỗi AI" : `Đang lọc: ${failedReasonFilter}`}
                            style={failedTableFilterControlStyle(failedReasonFilter !== TABLE_FILTER_ALL)}
                          >
                            <Filter size={11} aria-hidden="true" />
                            <select
                              aria-label="Lọc câu hỏi AI chưa xử lý theo Lý do lỗi AI"
                              value={failedReasonFilter}
                              onChange={(event) => setFailedReasonFilter(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              style={failedTableFilterNativeSelectStyle}
                            >
                              <option value={TABLE_FILTER_ALL} style={failedTableFilterOptionStyle}>Tất cả</option>
                              {failedReasonOptions.map((reason) => (
                                <option key={reason} value={reason} style={failedTableFilterOptionStyle}>{reason}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </th>
                      <th className="flic-th">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFailedConversations.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "28px 14px", color: "rgba(0,56,101,0.55)", fontSize: "12px", textAlign: "center" }}>
                          {failedConversations.length === 0
                            ? "Không có câu hỏi AI chưa xử lý trong phạm vi lọc hiện tại."
                            : "Không có câu hỏi phù hợp với bộ lọc Chủ đề/Lý do lỗi AI."}
                        </td>
                      </tr>
                    )}
                    {paginatedFailedConversations.map((conv) => {
                      const isExpanded = expandedRow === conv.id;
                      const fc = failReasonColor[conv.failReason] || "#64748b";
                      return (
                        <React.Fragment key={conv.id}>
                          <tr
                            style={{ borderBottom: "1px solid rgba(0,56,101,0.04)", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                            onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                          >
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                aria-label={`Chọn hội thoại lỗi AI ${conv.id}`}
                                checked={selectedFailureIds.has(conv.conversationId)}
                                disabled={!Number.isInteger(conv.conversationId)}
                                onChange={() =>
                                  setSelectedFailureIds((current) => {
                                    const next = new Set(current);
                                    if (next.has(conv.conversationId)) next.delete(conv.conversationId);
                                    else next.add(conv.conversationId);
                                    return next;
                                  })
                                }
                              />
                            </td>
                            <td className="flic-td-left" style={{ padding: "12px 14px", maxWidth: "220px" }}>
                              <div style={{ color: NAVY, fontWeight: 500, fontSize: "12px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{conv.question}</div>
                              <div
                                onClick={() => setExpandedRow(isExpanded ? null : conv.id)}
                                style={{ fontSize: "11px", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", marginTop: "4px" }}
                              >
                                Xem chi tiết {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap" }}>
                              <div>{conv.customerName}</div>
                              {conv.customerReference && <div style={{ color: "rgba(0,56,101,0.48)", fontWeight: 500 }}>{conv.customerReference}</div>}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", whiteSpace: "nowrap" }}>{conv.topic}</span>
                            </td>
                            <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.65)", whiteSpace: "nowrap" }}>{conv.channel}</td>
                            <td style={{ padding: "12px 14px" }}>
                              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: `${fc}18`, color: fc, fontWeight: 600, whiteSpace: "nowrap" }}>{conv.failReason}</span>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                <button
                                  onClick={() => { void handleMarkAsProcessed(conv.id); }}
                                  style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${ORANGE}30`, background: "#fff3ef", color: ORANGE, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                                >
                                  Đánh dấu xử lý
                                </button>
                                <button
                                  onClick={() => setFaqModalConv(conv)}
                                  style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.15)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                                >
                                  Thêm FAQ
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${conv.id}-expanded`} style={{ backgroundColor: "#fff8f6" }}>
                              <td colSpan={7} style={{ padding: "12px 14px 14px 28px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "10px", color: ORANGE, fontWeight: 700, whiteSpace: "nowrap", paddingTop: "2px" }}>CÂU HỎI KHÁCH HÀNG:</span>
                                    <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.8)", lineHeight: 1.5, fontStyle: "italic" }}>{conv.question}</span>
                                  </div>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                    <span style={{ fontSize: "10px", color: ORANGE, fontWeight: 700, whiteSpace: "nowrap", paddingTop: "2px" }}>CÂU TRẢ LỜI AI:</span>
                                    <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.8)", lineHeight: 1.5, fontStyle: "italic" }}>{conv.aiAnswer}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredFailedConversations.length > 0 && (
                <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ color: "rgba(0,56,101,0.62)", fontSize: "12px", fontWeight: 600 }}>
                    Hiển thị {failedStartNumber}-{failedEndNumber} / {hasFailedTableFilters ? filteredFailedConversations.length : failedConversationTotalSafe} câu hỏi
                    {hasFailedTableFilters
                      ? ` (lọc trong ${failedConversations.length} dòng đã tải)`
                      : failedConversationTotalSafe > failedConversations.length ? ` (đã tải ${failedConversations.length} dòng đầu)` : ""}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => goToFailedPage(failedPageSafe - 1)}
                      disabled={failedPageSafe <= 1}
                      style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: failedPageSafe <= 1 ? "#f1f5f9" : "#fff", color: failedPageSafe <= 1 ? "rgba(0,56,101,0.35)" : NAVY, cursor: failedPageSafe <= 1 ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700 }}
                    >
                      Trước
                    </button>
                    <span style={{ minWidth: "76px", textAlign: "center", color: NAVY, fontSize: "12px", fontWeight: 700 }}>
                      Trang {failedPageSafe}/{failedTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToFailedPage(failedPageSafe + 1)}
                      disabled={failedPageSafe >= failedTotalPages}
                      style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: failedPageSafe >= failedTotalPages ? "#f1f5f9" : "#fff", color: failedPageSafe >= failedTotalPages ? "rgba(0,56,101,0.35)" : NAVY, cursor: failedPageSafe >= failedTotalPages ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700 }}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Top chủ đề cần bổ sung */}
            <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px", padding: "20px 24px" }}>
              <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0" }}>Chi tiết AI phản hồi thất bại theo chủ đề</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(() => {
                  const computedTopics = supplementalFailureTopics.map(item => ({
                    topic: item.topic,
                    count: visibleTopicFailureTotal(item),
                  }));

                  const maxCount = Math.max(...computedTopics.map(t => t.count), 1);
                  const dataToRender = computedTopics.length > 0 ? computedTopics.map(t => ({ ...t, pct: Math.round((t.count / maxCount) * 100) })) : [];

                  if (dataToRender.length === 0 || maxCount <= 0) {
                    return <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", fontStyle: "italic", padding: "10px 0" }}>Chưa có dữ liệu chủ đề nào cần bổ sung.</div>;
                  }

                  return dataToRender.map(item => (
                    <div key={item.topic} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "130px", fontSize: "12px", color: NAVY, fontWeight: 500, flexShrink: 0 }}>{item.topic}</div>
                      <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${item.pct}%`, backgroundColor: CTA, borderRadius: "4px", transition: "width 0.5s ease-out" }} />
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.65)", fontWeight: 600, width: "50px", textAlign: "right" }}>{item.count} lần</div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTopicConversationPage(1);
                          setSelectedTopicDetail(item.topic);
                        }}
                        style={{ padding: "5px 10px", borderRadius: "8px", border: selectedTopicDetail === item.topic ? `1px solid ${CTA}` : "1px solid rgba(0,56,101,0.12)", background: selectedTopicDetail === item.topic ? ORANGE_50 : "#f8fafc", color: selectedTopicDetail === item.topic ? CTA : NAVY, cursor: "pointer", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        Xem chi tiết chủ đề {item.topic}
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {selectedTopicFailure && (
              <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Chi tiết chủ đề: {selectedTopicFailure.topic}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedTopicDetail(null)}
                    style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                  >
                    Đóng
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.35fr)", gap: "18px", padding: "18px 24px" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table aria-label={`Phân loại lỗi của chủ đề ${selectedTopicFailure.topic}`} style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr>
                          <th className="flic-th" style={{ textAlign: "left" }}>Loại lỗi AI</th>
                          <th className="flic-th" style={{ textAlign: "right" }}>Số lần</th>
                        </tr>
                      </thead>
                      <tbody>
                        {AI_TOPIC_FAILURE_TYPES.map((definition) => {
                          const count = topicFailureVisibleCount(selectedTopicFailure, definition.key);

                          const relevantConvs = selectedTopicRelatedConversations.filter(c => c.failReason === definition.label);
                          const baseKeywords = definition.keywords ? definition.keywords.split(',').map(k => k.trim()) : [];
                          const matchedKeywords = new Set<string>();

                          relevantConvs.forEach(c => {
                            const text = ((c.question || "") + " " + (c.aiAnswer || "")).toLowerCase();
                            baseKeywords.forEach(k => {
                              if (text.includes(k.toLowerCase())) {
                                matchedKeywords.add(k);
                              }
                            });
                          });

                          const hasMatched = matchedKeywords.size > 0;
                          const displayKeywords = hasMatched
                            ? Array.from(matchedKeywords).join(", ")
                            : definition.keywords;
                          const prefix = hasMatched ? "Từ khóa:" : "Từ khóa thường gặp:";

                          return (
                            <tr key={definition.id}>
                              <td className="flic-td-left" style={{ padding: "10px 12px", color: NAVY }}>
                                <div>{definition.label}</div>
                                {definition.keywords && <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginTop: "4px" }}>{prefix} {displayKeywords}</div>}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: NAVY, fontWeight: 700 }}>{count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <section aria-label={`Hội thoại liên quan đến chủ đề ${selectedTopicFailure.topic}`} style={{ border: "1px solid rgba(0,56,101,0.08)", borderRadius: "12px", overflow: "hidden" }}>
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,56,101,0.06)", color: NAVY, fontSize: "12px", fontWeight: 700 }}>
                      Hội thoại liên quan
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {selectedTopicRelatedConversations.length === 0 && (
                        <div style={{ padding: "16px", color: "rgba(0,56,101,0.55)", fontSize: "12px" }}>Không có hội thoại liên quan trong dữ liệu đã tải.</div>
                      )}
                      {paginatedSelectedTopicRelatedConversations.map((conversation) => {
                        const isExpanded = expandedTopicConv === conversation.id;
                        
                        return (
                          <div key={conversation.id} style={{ padding: "12px", borderBottom: "1px solid rgba(0,56,101,0.05)" }}>
                            <div style={{ color: NAVY, fontSize: "12px", fontWeight: 700 }}>{conversation.customerName}</div>
                            {conversation.customerReference && <div style={{ color: "rgba(0,56,101,0.48)", fontSize: "11px", fontWeight: 600 }}>{conversation.customerReference}</div>}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                <span style={{ fontSize: "10px", color: ORANGE, fontWeight: 700, whiteSpace: "nowrap", paddingTop: "2px" }}>KHÁCH HÀNG:</span>
                                <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.8)", lineHeight: 1.45, ...(!isExpanded ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>
                                  {conversation.question}
                                </span>
                              </div>
                              {isExpanded && (
                                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                  <span style={{ fontSize: "10px", color: ORANGE, fontWeight: 700, whiteSpace: "nowrap", paddingTop: "2px" }}>AI TRẢ LỜI:</span>
                                  <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.8)", lineHeight: 1.45 }}>
                                    {conversation.aiAnswer}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div
                              onClick={() => setExpandedTopicConv(isExpanded ? null : conversation.id)}
                              style={{ fontSize: "11px", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", marginTop: "8px" }}
                            >
                              {isExpanded ? "Thu gọn" : "Xem chi tiết"} {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedTopicRelatedConversations.length > 0 && (
                      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(0,56,101,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                        <span style={{ color: "rgba(0,56,101,0.58)", fontSize: "12px", fontWeight: 600 }}>
                          Hiển thị {selectedTopicConversationStartNumber}-{selectedTopicConversationEndNumber} / {selectedTopicRelatedConversations.length} hội thoại
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedTopicConversationPage((page) => Math.max(1, page - 1))}
                            disabled={selectedTopicConversationPageSafe <= 1}
                            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: selectedTopicConversationPageSafe <= 1 ? "#f1f5f9" : "#fff", color: selectedTopicConversationPageSafe <= 1 ? "rgba(0,56,101,0.35)" : NAVY, cursor: selectedTopicConversationPageSafe <= 1 ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700 }}
                          >
                            Trước
                          </button>
                          <span style={{ color: NAVY, fontSize: "12px", fontWeight: 700 }}>
                            Trang {selectedTopicConversationPageSafe}/{selectedTopicConversationTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedTopicConversationPage((page) => Math.min(selectedTopicConversationTotalPages, page + 1))}
                            disabled={selectedTopicConversationPageSafe >= selectedTopicConversationTotalPages}
                            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: selectedTopicConversationPageSafe >= selectedTopicConversationTotalPages ? "#f1f5f9" : "#fff", color: selectedTopicConversationPageSafe >= selectedTopicConversationTotalPages ? "rgba(0,56,101,0.35)" : NAVY, cursor: selectedTopicConversationPageSafe >= selectedTopicConversationTotalPages ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 700 }}
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* Dữ liệu đã bổ sung vào thư viện */}
            <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Dữ liệu đã bổ sung vào thư viện</h3>
                </div>
                <button onClick={() => onNavigate("chatbot_sheet")} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
                  Xem Sheet Chatbot
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th className="flic-th" style={{ textAlign: "left" }}>Câu hỏi khách hàng</th>
                      <th className="flic-th" style={{ textAlign: "left" }}>Câu trả lời đúng đã bổ sung</th>
                      <th className="flic-th" style={{ textAlign: "left" }}>Người bổ sung</th>
                      <th className="flic-th" style={{ textAlign: "left" }}>
                        <TableFilterHeader label="Chủ đề" value={chatbotTopicFilter} options={chatbotTopicOptions} onChange={setChatbotTopicFilter} />
                      </th>
                      <th className="flic-th" style={{ textAlign: "left" }}>
                        <TableFilterHeader label="Kênh" value={chatbotChannelFilter} options={chatbotChannelOptions} onChange={setChatbotChannelFilter} />
                      </th>
                      <th className="flic-th" style={{ textAlign: "left" }}>
                        <TableFilterHeader label="Trạng thái" value={chatbotStatusFilter} options={chatbotStatusOptions} onChange={setChatbotStatusFilter} />
                      </th>
                      <th className="flic-th" style={{ textAlign: "left" }}>Ghi chú nội bộ</th>
                      <th className="flic-th" style={{ textAlign: "left" }}>Ngày cập nhật</th>
                      <th className="flic-th" style={{ textAlign: "left" }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecentChatbotRows.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "rgba(0,56,101,0.4)" }}>
                          {optionalDataErrors.recentChatbotRows
                            ? "Chưa tải được dữ liệu phụ của bảng này. Dữ liệu chính của trang vẫn đang hiển thị."
                            : recentChatbotRows.length === 0 ? "Chưa có dữ liệu nào được bổ sung." : "Không có dữ liệu phù hợp với bộ lọc Chủ đề/Kênh/Trạng thái."}
                        </td>
                      </tr>
                    )}
                    {filteredRecentChatbotRows.map((item, i) => {
                      const dateObj = new Date(item.addedAt || item.createdAt);
                      const isToday = new Date().toDateString() === dateObj.toDateString();
                      const formattedDate = isToday ? "Hôm nay" : dateObj.toLocaleDateString("vi-VN");
                      const isExpanded = expandedChatbotRow === (item.id || String(i));
                      return (
                        <React.Fragment key={item.id || i}>
                          <tr style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                          >
                            <td className="flic-td-left" style={{ padding: "12px 14px", color: NAVY, fontWeight: 500, maxWidth: "180px", cursor: "pointer", textDecoration: "underline" }} onClick={() => { localStorage.setItem("edit_chatbot_question", item.question); onNavigate("chatbot_sheet"); }}>{item.question}</td>
                            <td className="flic-td-left" style={{ padding: "12px 14px", color: "#16a34a", maxWidth: "180px", fontSize: "11px" }}>{item.correctAnswer}</td>
                            <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600 }}>{item.addedBy}</td>
                            <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{item.topic}</span></td>
                            <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.62)", whiteSpace: "nowrap" }}>{item.channel || "Chưa xác định"}</td>
                            <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} showDot={false} style={{ fontWeight: 600 }} /></td>
                            <td style={{ padding: "12px 14px", color: ORANGE, fontStyle: "italic", maxWidth: "160px", fontSize: "11px" }}>
                              <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.notes || "---"}
                              </div>
                              {item.notes && item.notes.length > 50 && (
                                <div
                                  onClick={() => setExpandedChatbotRow(isExpanded ? null : (item.id || String(i)))}
                                  style={{ fontSize: "11px", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", marginTop: "4px" }}
                                >
                                  Xem chi tiết {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.55)", whiteSpace: "nowrap" }}>{formattedDate}</td>
                            <td style={{ padding: "12px 14px" }}>
                              <button onClick={() => { localStorage.setItem("edit_chatbot_question", item.question); onNavigate("chatbot_sheet"); }} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${NAVY}30`, background: "#fff", color: NAVY, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>Chỉnh sửa</button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ backgroundColor: "#fff8f6" }}>
                              <td colSpan={9} style={{ padding: "12px 14px 14px 28px" }}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                                  <span style={{ fontSize: "10px", color: ORANGE, fontWeight: 700, whiteSpace: "nowrap", paddingTop: "2px" }}>GHI CHÚ CHI TIẾT:</span>
                                  <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.8)", lineHeight: 1.5, fontStyle: "italic" }}>{item.notes}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {faqModalConv && (
          <FeedbackFormDialog
            open
            mode="create"
            prefillData={{
              question: faqModalConv.question,
              source: "AI trả lời sai",
              notes: faqModalConv.aiAnswer ? `[Câu AI sai]: ${faqModalConv.aiAnswer}` : "",
              topic: faqModalConv.topic,
              channel: faqModalConv.channel,
              conversationId: faqModalConv.conversationId,
              messageId: faqModalConv.messageId,
            }}
            onClose={() => setFaqModalConv(null)}
            onSaved={async (saved) => {
              setRecentChatbotRows((current) => [saved, ...current].slice(0, 5));
              await handleMarkAsProcessed(faqModalConv.id, false);
            }}
          />
        )}

        {showConfirmAllModal && (
          <div role="presentation" onKeyDown={(event) => { if (event.key === "Escape" && !bulkSubmitting) setShowConfirmAllModal(false); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,56,101,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div role="dialog" aria-modal="true" aria-labelledby="ai-bulk-title" aria-describedby="ai-bulk-description" style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "400px", boxShadow: "0 10px 40px rgba(0,56,101,0.15)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#FFF4EE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <AlertTriangle size={24} style={{ color: ORANGE }} />
              </div>
              <h3 id="ai-bulk-title" style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 700, color: NAVY }}>Xác nhận đánh dấu xử lý</h3>
              <p id="ai-bulk-description" style={{ fontSize: "14px", color: "rgba(0,56,101,0.7)", lineHeight: 1.5, marginBottom: "24px", padding: "0 10px" }}>
                Thao tác chỉ áp dụng cho chính xác {selectedFailureIds.size} hội thoại đã chọn trên trang hiện tại.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "12px", width: "100%" }}>
                <button
                  onClick={() => setShowConfirmAllModal(false)}
                  disabled={bulkSubmitting}
                  style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.15)", background: "#fff", color: NAVY, cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => { void submitSelectedFailures(); }}
                  disabled={bulkSubmitting}
                  style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", background: ORANGE, color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
                >
                  {bulkSubmitting ? "Đang xử lý..." : `Xác nhận ${selectedFailureIds.size} hội thoại`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
