import React, { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, ChevronDown, ChevronUp, FilePlus2, Clock, Table2, Activity, Download, BoldIcon } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { ApiRequestError, fetchApiJson, buildApiUrl } from "../../services/dashboardApi";
import { getSheetChatbotRows, type SheetChatbotStats } from "../../services/sheetChatbotApi";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import { bulkCloseConversations, getCustomerPresentation } from "../../services/conversationApi";
import { exportFailedConversationsCsv, getAllFailedConversations, getFailedConversations, getTopicFailures, type TopicFailureRecord } from "../../services/round3Api";
import { AI_FAILURE_TAXONOMY, getAiFailureDefinition } from "../../constants/aiFailureTaxonomy";
import { StatusBadge } from "../common/StatusBadge";
import { analyticsFiltersToSearchParams } from "../../utils/dateFilters";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const CTA = "#ED5206";
const CTA_SOFT = "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ORANGE_200 = "#FBCBB8";
const AMBER_50 = "#FFF7E6";
const AMBER_100 = "#FADFA8";
const AMBER_TEXT = "#B7791F";
const RED_50 = "#FFF1F1";
const RED_100 = "#F8CACA";
const RED_TEXT = "#B42318";
const BLUE_50 = "#EBF2FF";
const BLUE_200 = "#B9DCFF";
const OCEAN_PRIMARY = "#0077B6";
const OCEAN_SECONDARY = "#00A6D6";
const FAILED_QUESTIONS_PAGE_SIZE = 10;

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

const impactColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao": { bg: RED_50, color: RED_TEXT },
  "Ưu tiên trung bình": { bg: AMBER_50, color: AMBER_TEXT },
  "Ưu tiên thấp": { bg: "#f1f5f9", color: "#64748b" },
};

interface AIInsightsProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}
function getDatesFromRange(range: string, customFrom?: string, customTo?: string): { startDate?: string; endDate?: string } {
  const today = new Date();
  const formatDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (range === "Hôm nay") {
    return { startDate: formatDateStr(today), endDate: formatDateStr(today) };
  }
  if (range === "7 ngày qua") {
    const start = new Date();
    start.setDate(today.getDate() - 7);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "30 ngày qua") {
    const start = new Date();
    start.setDate(today.getDate() - 30);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "Tháng này") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatDateStr(start), endDate: formatDateStr(today) };
  }
  if (range === "Tháng trước") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDateStr(start), endDate: formatDateStr(end) };
  }
  if (range === "Tùy chỉnh" && customFrom && customTo) {
    return { startDate: customFrom, endDate: customTo };
  }
  return {};
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

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "16px" }}>
      {Array(4).fill(0).map((_, i) => (
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

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
      {Array(4).fill(0).map((_, i) => (
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
  if (Array.isArray(value) && value.length > 0) return value[0];
  if (typeof value === "string" && value.trim()) return value;
  return "Không phân loại trong database";
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

function topicFailureTotal(row: TopicFailureRecord) {
  return AI_FAILURE_TAXONOMY.reduce((total, definition) => total + Number(row[definition.analyticsKey] || 0), 0);
}

function visibleTopicFailureTotal(row: TopicFailureRecord) {
  return Number(row.thieuDL || 0) + Number(row.khongChac || 0);
}

function mapFailedConversation(record: any) {
  const customer = getCustomerPresentation(
    record.customerDisplayName || record.customerName || record.customer_name,
    record.customerId,
    record.phoneNumber,
  );
  return {
    id: record.id,
    messageId: record.messageId,
    question: record.textContent || "Chưa có dữ liệu",
    aiAnswer: record.aiAnswer || "Không tìm thấy câu trả lời AI tương ứng",
    conversationId: Number(record.conversationId),
    topic: displayTopic(record.detectedTopics),
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

async function exportFailedConversationsCsvFile(queryParams: URLSearchParams) {
  try {
    const exported = await exportFailedConversationsCsv(queryParams);
    downloadBlob(exported.filename, exported.blob);
    return { totalRecords: exported.totalRecords };
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }

    const result = await getAllFailedConversations(queryParams, { pageSize: 100 });
    const exportRows = result.records.map(mapFailedConversation);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `cau-hoi-ai-chua-xu-ly-toan-bo-du-lieu-da-loc-${date}.csv`,
      buildFailedConversationCsvRows(exportRows),
    );
    return { totalRecords: exportRows.length };
  }
}

export function AIInsights({ filters, onFiltersChange, onNavigate }: AIInsightsProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedChatbotRow, setExpandedChatbotRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [faqModalConv, setFaqModalConv] = useState<any>(null);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
  const [selectedFailureIds, setSelectedFailureIds] = useState<Set<number>>(() => new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [topN, setTopN] = useState(5);
  const [failedPage, setFailedPage] = useState(1);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFailed, setExportingFailed] = useState(false);
  const bulkSubmitGuard = useRef(false);

  const [qualityMetrics, setQualityMetrics] = useState<any>({ total_messages: 0, success_rate: 0, failure_count: 0, hallucination_count: 0, avg_confidence: 0 });
  const [staffActivity, setStaffActivity] = useState<any>({ reported_errors: 0, pending_review: 0 });
  const [failureTrend, setFailureTrend] = useState<any[]>([]);
  const [failureByTopic, setFailureByTopic] = useState<TopicFailureRecord[]>([]);
  const [failedConversations, setFailedConversations] = useState<any[]>([]);
  const [staffReportedErrors, setStaffReportedErrors] = useState<any[]>([]);
  const [suggestedFAQs, setSuggestedFAQs] = useState<any[]>([]);
  const [recentChatbotRows, setRecentChatbotRows] = useState<any[]>([]);
  const [sheetStats, setSheetStats] = useState<Partial<SheetChatbotStats>>({});

  useEffect(() => {
    let cancelled = false;
    const queryParams = analyticsFiltersToSearchParams(filters);
    const qs = queryParams.toString();

    const fetchData = async () => {
      setLoading(true);
      try {
        const [qm, sa, ft, fbt, fc, sre, sf, scRows] = await Promise.all([
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/quality-metrics?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/staff-activity?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/failure-trend?${qs}`)),
          getTopicFailures(queryParams),
          getFailedConversations(queryParams),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/staff-reported-errors?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/suggested-faqs?${qs}`)),
          getSheetChatbotRows({ pageSize: 5 })
        ]);

        if (cancelled) return;
        if (qm.success) setQualityMetrics(qm.data);
        if (sa.success) setStaffActivity(sa.data);
        if (ft.success) setFailureTrend(ft.data);
        setFailureByTopic(fbt);
        setFailedConversations(fc.records.map(mapFailedConversation));
        setFailedPage(1);
        setSelectedFailureIds(new Set());
        setShowConfirmAllModal(false);
        if (sre.success) setStaffReportedErrors(sre.data.records.map((r: any) => ({
          id: r.id, time: displayDateTime(r.messageAt), staff: "Chưa xác định", channel: r.source || "Chưa xác định",
          topic: displayTopic(r.detectedTopics), question: r.textContent || "Chưa có dữ liệu", aiAnswer: r.aiAnswer || "Không tìm thấy câu trả lời AI tương ứng",
          reason: r.issueType || "Chưa xác định", impact: "Chưa xác định", status: r.needStaffReview ? "Chờ quản lý xác nhận" : "Chưa xác định"
        })));
        if (sf.success) setSuggestedFAQs(sf.data);
        if (scRows.success) {
          setRecentChatbotRows(scRows.data || []);
          setSheetStats(scRows.stats || {});
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
  }, [filters]);

  const topFailureTopics = useMemo(
    () => [...failureByTopic]
      .filter((row) => visibleTopicFailureTotal(row) > 0)
      .sort((left, right) => visibleTopicFailureTotal(right) - visibleTopicFailureTotal(left))
      .slice(0, topN),
    [failureByTopic, topN],
  );
  const failedTotalPages = Math.max(1, Math.ceil(failedConversations.length / FAILED_QUESTIONS_PAGE_SIZE));
  const failedPageSafe = Math.min(failedPage, failedTotalPages);
  const paginatedFailedConversations = useMemo(
    () => failedConversations.slice(
      (failedPageSafe - 1) * FAILED_QUESTIONS_PAGE_SIZE,
      failedPageSafe * FAILED_QUESTIONS_PAGE_SIZE,
    ),
    [failedConversations, failedPageSafe],
  );
  const failedStartNumber = failedConversations.length === 0
    ? 0
    : (failedPageSafe - 1) * FAILED_QUESTIONS_PAGE_SIZE + 1;
  const failedEndNumber = Math.min(
    failedPageSafe * FAILED_QUESTIONS_PAGE_SIZE,
    failedConversations.length,
  );

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
    const row = failedConversations.find((conversation) => conversation.id === id);
    if (!row || !Number.isInteger(row.conversationId) || row.conversationId <= 0) {
      toast.error("Bản ghi chưa liên kết với hội thoại hợp lệ.");
      return;
    }
    try {
      const result = await bulkCloseConversations([row.conversationId]);
      setFailedConversations((current) => current.filter((conversation) => conversation.id !== id));
      setSelectedFailureIds((current) => {
        const next = new Set(current);
        next.delete(row.conversationId);
        return next;
      });
      if (showToast) toast.success(`Đã cập nhật ${result.affected} hội thoại.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật hội thoại.");
    }
  };

  const selectableFailureIds = paginatedFailedConversations
    .map((conversation) => conversation.conversationId)
    .filter((id): id is number => Number.isInteger(id) && id > 0);
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
      const result = await bulkCloseConversations(ids);
      setFailedConversations((current) => current.filter((row) => !selectedIds.has(row.conversationId)));
      setSelectedFailureIds(new Set());
      setShowConfirmAllModal(false);
      toast.success(`Đã cập nhật ${result.affected} hội thoại trên ${result.requested} hội thoại được chọn.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật các hội thoại đã chọn.");
    } finally {
      bulkSubmitGuard.current = false;
      setBulkSubmitting(false);
    }
  };

  const handleExportFailedConversations = async (format: "csv" | "json") => {
    if (exportingFailed) return;
    setExportingFailed(true);
    try {
      const queryParams = analyticsFiltersToSearchParams(filters);
      if (format === "csv") {
        const exported = await exportFailedConversationsCsvFile(queryParams);
        toast.success(
          exported.totalRecords > 0
            ? `Đã xuất ${exported.totalRecords} dòng lỗi AI theo bộ lọc.`
            : "Đã xuất file CSV chỉ có header vì bộ lọc không có dữ liệu.",
        );
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const scope = "-toan-bo-du-lieu-da-loc";
      const result = await getAllFailedConversations(queryParams, { pageSize: 100 });
      const exportRows = result.records.map(mapFailedConversation);
      if (!exportRows.length) {
        toast.warning("Không có dữ liệu lỗi AI để xuất.");
        return;
      }

      downloadJson(`cau-hoi-ai-chua-xu-ly${scope}-${date}.json`, {
        filters: Object.fromEntries(queryParams),
        total: result.total,
        exported: exportRows.length,
        records: exportRows,
      });
      toast.success(`Đã xuất ${exportRows.length}/${result.total} dòng lỗi AI theo bộ lọc.`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        toast.error(`Export thất bại (${error.status}): ${error.message}`);
      } else {
        toast.error(error instanceof Error ? error.message : "Không thể xuất toàn bộ dữ liệu lỗi AI đã lọc.");
      }
    } finally {
      setExportMenuOpen(false);
      setExportingFailed(false);
    }
  };
  const kpiStats = {
    ai_success: (qualityMetrics?.total_messages || 0) - (qualityMetrics?.failure_count || 0),
    ai_failure: qualityMetrics?.failure_count || 0,
    kb_updates_needed: staffActivity?.pending_review || 0,
    ai_accuracy: qualityMetrics?.success_rate || 0,
  };

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {loading ? <AIInsightsSkeleton /> : (
        <>
          {/* KPI Row - AI insights */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
            {[
              { icon: CheckCircle, label: "AI trả lời thành công", value: kpiStats.ai_success.toString(), change: "Theo bộ lọc" },
              { icon: XCircle, label: "AI trả lời thất bại", value: kpiStats.ai_failure.toString(), change: "Theo bộ lọc" },
              { icon: ShieldAlert, label: "Cần cập nhật tri thức", value: kpiStats.kb_updates_needed.toString(), change: "Theo bộ lọc" },
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
              } else if (Icon === ShieldAlert) {
                iconBg = "#FFF4EE";
                iconColor = ORANGE;
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
            <ChartCard title="Xu hướng AI trả lời sai theo ngày (+ dự báo 3 ngày)" onOpenBuilder={() => onNavigate("chartbuilder")} data={failureTrend} defaultChartType="line" supportedChartTypes={["line", "area", "bar", "hbar"]}>
              {({ chartType, chartData, editValues }: any) => {
                const isBar = chartType === "bar" || chartType === "hbar";
                const isArea = chartType === "area";
                const ChartComp = isBar ? BarChart : isArea ? AreaChart : LineChart;
                const layout = chartType === "hbar" ? "vertical" : "horizontal";

                return (
                  <ResponsiveContainer width="100%" height={210}>
                    <ChartComp data={chartData} layout={layout}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
                      <XAxis dataKey={layout === "vertical" ? undefined : "date"} type={layout === "vertical" ? "number" : "category"} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                      <YAxis dataKey={layout === "vertical" ? "date" : undefined} type={layout === "vertical" ? "category" : "number"} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} width={layout === "vertical" ? 70 : undefined} />
                      <Tooltip />
                      {editValues?.legend !== false && <Legend iconSize={10} />}
                      {layout === "horizontal" && <ReferenceLine x="28/4" stroke="rgba(0,56,101,0.2)" strokeDasharray="6 3" label={{ value: "Dự báo →", position: "insideTopRight", fontSize: 10, fill: "rgba(0,56,101,0.4)" }} />}

                      {isBar ? (
                        <>
                          <Bar dataKey="failure" name="AI phản hồi không chính xác" fill={OCEAN_PRIMARY} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                          <Bar dataKey="uncertain" name="AI phản hồi không chắc chắn" fill={OCEAN_SECONDARY} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                        </>
                      ) : isArea ? (
                        <>
                          <Area type="monotone" dataKey="failure" name="AI phản hồi không chính xác" stroke={OCEAN_PRIMARY} fill={`${OCEAN_PRIMARY}30`} strokeWidth={2} />
                          <Area type="monotone" dataKey="uncertain" name="AI phản hồi không chắc chắn" stroke={OCEAN_SECONDARY} fill={`${OCEAN_SECONDARY}30`} strokeWidth={2} />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" dataKey="failure" name="AI phản hồi không chính xác" stroke={OCEAN_PRIMARY} strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="uncertain" name="AI phản hồi không chắc chắn" stroke={OCEAN_SECONDARY} strokeWidth={2} dot={{ r: 2 }} />
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
                supportedChartTypes={["line", "area", "bar", "hbar"]}
                headerExtra={(
                  <label htmlFor="top-n-topics-select" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: NAVY, fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    Số chủ đề
                    <select id="top-n-topics-select" aria-label="Số chủ đề hiển thị" value={topN} onChange={(event) => setTopN(Number(event.target.value))} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.16)", color: NAVY, background: "#fff" }}>
                      {[5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                )}
              >
                {({ chartType, chartData, editValues }: any) => {
                  const isBar = chartType === "bar" || chartType === "hbar";
                  const isArea = chartType === "area";
                  const ChartComp = isBar ? BarChart : isArea ? AreaChart : LineChart;
                  const layout = chartType === "hbar" || chartType === "pie" || chartType === "donut" ? "vertical" : "horizontal";

                  return (
                    <ResponsiveContainer width="100%" height={210}>
                      <ChartComp
                        data={chartData}
                        layout={layout}
                        barSize={layout === "vertical" ? 8 : 20}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
                        <XAxis dataKey={layout === "vertical" ? undefined : "topic"} type={layout === "vertical" ? "number" : "category"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
                        <YAxis dataKey={layout === "vertical" ? "topic" : undefined} type={layout === "vertical" ? "category" : "number"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} width={layout === "vertical" ? 90 : undefined} />
                        <Tooltip />
                        {editValues?.legend !== false && <Legend />}

                        {isBar ? (
                          <>
                            <Bar dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={OCEAN_PRIMARY} />
                            <Bar dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill={OCEAN_SECONDARY} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                          </>
                        ) : isArea ? (
                          <>
                            <Area type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={`${OCEAN_PRIMARY}50`} stroke={OCEAN_PRIMARY} />
                            <Area type="monotone" dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill={`${OCEAN_SECONDARY}50`} stroke={OCEAN_SECONDARY} />
                          </>
                        ) : (
                          <>
                            <Line type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stroke={OCEAN_PRIMARY} dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="khongChac" name="AI không chắc chắn" stroke={OCEAN_SECONDARY} dot={{ r: 2 }} />
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
                <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Câu hỏi AI chưa xử lý được</h3>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ORANGE_50, color: ORANGE, border: `1px solid ${ORANGE_200}`, fontWeight: 600 }}>{failedConversations.length} câu hỏi</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    aria-label="Mở menu xuất dữ liệu"
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                    disabled={exportingFailed}
                    onClick={() => setExportMenuOpen((current) => !current)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: exportingFailed ? "not-allowed" : "pointer", fontSize: "12px", opacity: exportingFailed ? 0.72 : 1 }}
                  >
                    <Download size={13} aria-hidden="true" /> {exportingFailed ? "Đang xuất..." : "Xuất dữ liệu"} <ChevronDown size={12} aria-hidden="true" />
                  </button>
                  {exportMenuOpen && (
                    <div role="menu" aria-label="Định dạng xuất dữ liệu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: "130px", padding: "6px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", boxShadow: "0 10px 28px rgba(0,56,101,0.14)" }}>
                      <button role="menuitem" type="button" onClick={() => void handleExportFailedConversations("csv")} style={{ width: "100%", padding: "8px 10px", border: 0, borderRadius: "6px", background: "transparent", color: NAVY, textAlign: "left", cursor: "pointer" }}>Xuất CSV</button>
                      <button role="menuitem" type="button" onClick={() => void handleExportFailedConversations("json")} style={{ width: "100%", padding: "8px 10px", border: 0, borderRadius: "6px", background: "transparent", color: NAVY, textAlign: "left", cursor: "pointer" }}>Xuất JSON</button>
                    </div>
                  )}
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
                    {["Câu hỏi của KH", "Mã KH", "Chủ đề", "Kênh", "Lý do lỗi AI", "Mức độ tin cậy", "Mức ảnh hưởng", "Hành động"].map((h) => (
                      <th key={h} className="flic-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {failedConversations.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: "28px 14px", color: "rgba(0,56,101,0.55)", fontSize: "12px", textAlign: "center" }}>
                        Không có câu hỏi AI chưa xử lý trong phạm vi lọc hiện tại.
                      </td>
                    </tr>
                  )}
                  {paginatedFailedConversations.map((conv) => {
                    const isExpanded = expandedRow === conv.id;
                    const fc = failReasonColor[conv.failReason] || "#64748b";
                    const ic = impactColor[conv.impact] || { bg: "#f1f5f9", color: "#64748b" };
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
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ width: "40px", height: "5px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${conv.confidence * 100}%`, backgroundColor: conv.confidence < 0.4 ? RED_TEXT : AMBER_TEXT, borderRadius: "3px" }} />
                              </div>
                              <span style={{ fontSize: "11px", color: conv.confidence < 0.4 ? RED_TEXT : AMBER_TEXT, fontWeight: 600 }}>{(conv.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: ic.bg, color: ic.color, fontWeight: 600 }}>{conv.impact}</span>
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
                            <td colSpan={9} style={{ padding: "12px 14px 14px 28px" }}>
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
            {failedConversations.length > 0 && (
              <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ color: "rgba(0,56,101,0.62)", fontSize: "12px", fontWeight: 600 }}>
                  Hiển thị {failedStartNumber}-{failedEndNumber} / {failedConversations.length} câu hỏi
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
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: "0 0 16px 0" }}>Top chủ đề cần bổ sung dữ liệu</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(() => {
                const computedTopics = failureByTopic.map(item => {
                  const count = Object.keys(item)
                    .filter(k => k !== "topic")
                    .reduce((sum, key) => sum + (Number(item[key]) || 0), 0);
                  return { topic: item.topic, count };
                }).sort((a, b) => b.count - a.count).slice(0, 5);

                const maxCount = Math.max(...computedTopics.map(t => t.count), 1);
                const dataToRender = computedTopics.length > 0 ? computedTopics.map(t => ({ ...t, pct: Math.round((t.count / maxCount) * 100) })) : [];

                if (dataToRender.length === 0) {
                  return <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", fontStyle: "italic", padding: "10px 0" }}>Chưa có dữ liệu chủ đề nào cần bổ sung.</div>;
                }

                return dataToRender.map(item => (
                  <div key={item.topic} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "130px", fontSize: "12px", color: NAVY, fontWeight: 500, flexShrink: 0 }}>{item.topic}</div>
                    <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${item.pct}%`, backgroundColor: CTA, borderRadius: "4px", transition: "width 0.5s ease-out" }} />
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.65)", fontWeight: 600, width: "50px", textAlign: "right" }}>{item.count} lần</div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Dữ liệu đã bổ sung vào thư viện */}
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Dữ liệu đã bổ sung vào thư viện</h3>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>{sheetStats.approved ?? recentChatbotRows.length} mục</span>
              </div>
              <button onClick={() => onNavigate("chatbot_sheet")} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
                Xem Sheet Chatbot
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr>
                    {["Câu hỏi khách hàng", "Câu trả lời đúng đã bổ sung", "Người bổ sung", "Chủ đề", "Trạng thái", "Ghi chú nội bộ", "Ngày cập nhật", "Hành động"].map(h => (
                      <th key={h} className="flic-th" style={{ textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentChatbotRows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "rgba(0,56,101,0.4)" }}>Chưa có dữ liệu nào được bổ sung.</td>
                    </tr>
                  )}
                  {recentChatbotRows.map((item, i) => {
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
                            <td colSpan={8} style={{ padding: "12px 14px 14px 28px" }}>
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
            conversationId: faqModalConv.conversationId,
            messageId: faqModalConv.messageId,
          }}
          onClose={() => setFaqModalConv(null)}
          onSaved={async () => {
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
  );
}
