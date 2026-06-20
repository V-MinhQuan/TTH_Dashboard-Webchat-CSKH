import React, { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, ChevronDown, ChevronUp, FilePlus2, Clock, Table2, Activity, Download } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { fetchApiJson, buildApiUrl, formatChannelParam } from "../../services/dashboardApi";
import { AddSheetModal } from "./SheetChatbot";
import { createSheetChatbotRow, getSheetChatbotRows, type SheetChatbotStats } from "../../services/sheetChatbotApi";
import { useAuth } from "../../context/AuthContext";
import { bulkCloseConversations, getCustomerPresentation } from "../../services/conversationApi";
import { getFailedConversations, getTopicFailures, type TopicFailureRecord } from "../../services/round3Api";
import { AI_FAILURE_TAXONOMY, getAiFailureDefinition } from "../../constants/aiFailureTaxonomy";
import { StatusBadge } from "../common/StatusBadge";

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

function topicFailureTotal(row: TopicFailureRecord) {
  return AI_FAILURE_TAXONOMY.reduce((total, definition) => total + row[definition.analyticsKey], 0);
}

export function AIInsights({ filters, onFiltersChange, onNavigate }: AIInsightsProps) {
  const { user } = useAuth();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedChatbotRow, setExpandedChatbotRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [faqModalConv, setFaqModalConv] = useState<any>(null);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
  const [selectedFailureIds, setSelectedFailureIds] = useState<Set<number>>(() => new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [topN, setTopN] = useState(5);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
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
    let queryParams = new URLSearchParams();
    const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
    if (dates.startDate && dates.endDate) {
      queryParams.set("startDate", dates.startDate);
      queryParams.set("endDate", dates.endDate);
    }
    if (filters.channel && filters.channel !== "Tất cả") queryParams.set("channel", formatChannelParam(filters.channel));
    if (filters.topic && filters.topic !== "Tất cả") queryParams.set("topic", filters.topic);
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

        if (qm.success) setQualityMetrics(qm.data);
        if (sa.success) setStaffActivity(sa.data);
        if (ft.success) setFailureTrend(ft.data);
        setFailureByTopic(fbt);
        setSelectedTopic((current) => current && fbt.some((row) => row.topic === current) ? current : fbt[0]?.topic ?? null);
        setFailedConversations(fc.records.map((r) => {
          const customer = getCustomerPresentation(r.customerName || r.customer_name, r.customerId);
          return {
            id: r.id,
            question: r.textContent || "Tin nhắn khách hàng đang trống trong database",
            aiAnswer: r.aiAnswer || "Câu trả lời AI đang trống trong database",
            conversationId: Number(r.conversationId),
            topic: displayTopic(r.detectedTopics),
            channel: r.source || "Không có kênh trong database",
            failReason: displayFailureType(r.issueType),
            confidence: r.issueConfidence || 0,
            impact: "Ưu tiên cao",
            kbSuggestion: r.issueReason || "Chưa có gợi ý tri thức trong database",
            customerId: r.customerId || "Không có mã khách hàng trong database",
            customerName: customer.primary,
            customerReference: customer.secondary,
          };
        }));
        setSelectedFailureIds(new Set());
        setShowConfirmAllModal(false);
        if (sre.success) setStaffReportedErrors(sre.data.records.map((r: any) => ({
          id: r.id, time: displayDateTime(r.messageAt), staff: "Từ database MessageAnalytics", channel: r.source || "Không có kênh trong database",
          topic: displayTopic(r.detectedTopics), question: r.textContent || "Tin nhắn khách hàng đang trống trong database", aiAnswer: r.aiAnswer || "Câu trả lời AI đang trống trong database",
          reason: r.issueType || "Không có loại lỗi trong database", impact: "Ưu tiên trung bình", status: r.needStaffReview ? "Chờ quản lý xác nhận" : "Không có trạng thái review trong database"
        })));
        if (sf.success) setSuggestedFAQs(sf.data);
        if (scRows.success) {
          setRecentChatbotRows(scRows.data || []);
          setSheetStats(scRows.stats || {});
        }
      } catch (err) {
        console.error("Fetch API Error:", err);
        toast.error("Lỗi khi tải dữ liệu Phân tích AI");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const topFailureTopics = useMemo(
    () => [...failureByTopic]
      .sort((left, right) => topicFailureTotal(right) - topicFailureTotal(left))
      .slice(0, topN),
    [failureByTopic, topN],
  );
  const selectedTopicFailure = useMemo(
    () => failureByTopic.find((row) => row.topic === selectedTopic) ?? null,
    [failureByTopic, selectedTopic],
  );
  const relatedConversations = useMemo(
    () => selectedTopic
      ? failedConversations.filter((conversation) => conversation.topic === selectedTopic)
      : [],
    [failedConversations, selectedTopic],
  );

  const handleAddFaq = async (question: string, topic: string) => {
    try {
      await createSheetChatbotRow({
        question,
        correctAnswer: "Cần bổ sung câu trả lời chính thức từ quản lý.",
        topic,
        source: "AI trả lời sai",
        risk: "Trung bình",
        status: "Chờ xử lý",
        notes: "Tạo từ màn Phân tích AI.",
        addedBy: user?.name || "Dashboard",
      });
      toast.success("Đã thêm FAQ thành công vào Sheet Chatbot");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi khi thêm FAQ");
    }
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

  const selectableFailureIds = failedConversations
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

  const handleExportFailedConversations = (format: "csv" | "json") => {
    const exportRows = selectedTopic ? relatedConversations : failedConversations;
    if (!exportRows.length) {
      toast.warning("Không có dữ liệu lỗi AI để xuất.");
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const scope = selectedTopic ? `-${selectedTopic
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi-VN")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}` : "";
    if (format === "json") {
      downloadJson(`cau-hoi-ai-chua-xu-ly${scope}-${date}.json`, exportRows);
      setExportMenuOpen(false);
      toast.success(`Đã xuất ${exportRows.length} dòng lỗi AI.`);
      return;
    }

    const rows = [
      [
        "STT",
        "Câu hỏi khách hàng",
        "Câu trả lời AI",
        "Mã khách hàng",
        "Chủ đề",
        "Kênh",
        "Lý do lỗi AI",
        "Mức độ tin cậy (%)",
        "Mức ảnh hưởng",
        "Gợi ý tri thức",
      ],
      ...exportRows.map((item, index) => [
        index + 1,
        item.question,
        item.aiAnswer,
        item.customerId,
        item.topic,
        item.channel,
        item.failReason,
        `${Math.round((Number(item.confidence) || 0) * 100)}%`,
        item.impact,
        item.kbSuggestion,
      ]),
    ];

    downloadCsv(`cau-hoi-ai-chua-xu-ly${scope}-${date}.csv`, rows);
    setExportMenuOpen(false);
    toast.success(`Đã xuất ${exportRows.length} dòng lỗi AI.`);
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
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20px", marginBottom: "24px" }}>
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
                          <Bar dataKey="failure" name="AI phản hồi không chính xác" fill={ORANGE} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                          <Bar dataKey="hallucination" name="AI tự tạo thông tin" fill="#ef4444" radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                          <Bar dataKey="uncertain" name="AI phản hồi không chắc chắn" fill="#f59e0b" radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                        </>
                      ) : isArea ? (
                        <>
                          <Area type="monotone" dataKey="failure" name="AI phản hồi không chính xác" stroke={ORANGE} fill={`${ORANGE}30`} strokeWidth={2} />
                          <Area type="monotone" dataKey="hallucination" name="AI tự tạo thông tin" stroke="#ef4444" fill="#ef444430" strokeWidth={2} />
                          <Area type="monotone" dataKey="uncertain" name="AI phản hồi không chắc chắn" stroke="#f59e0b" fill="#f59e0b30" strokeWidth={2} />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" dataKey="failure" name="AI phản hồi không chính xác" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="hallucination" name="AI tự tạo thông tin" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="uncertain" name="AI phản hồi không chắc chắn" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                        </>
                      )}
                    </ChartComp>
                  </ResponsiveContainer>
                );
              }}
            </ChartCard>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                <label htmlFor="top-n-topics-select" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: NAVY, fontSize: "12px", fontWeight: 600 }}>
                  Số chủ đề hiển thị
                  <select id="top-n-topics-select" aria-label="Số chủ đề hiển thị" value={topN} onChange={(event) => setTopN(Number(event.target.value))} style={{ padding: "6px 9px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.16)", color: NAVY, background: "#fff" }}>
                    {[5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <ChartCard title="Lỗi về AI theo chủ đề" onOpenBuilder={() => onNavigate("chartbuilder")} data={topFailureTopics} defaultChartType="hbar" supportedChartTypes={["line", "area", "bar", "hbar"]}>
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
                        onClick={(state: any) => {
                          const topic = String(state?.activeLabel || "").trim();
                          if (topic) setSelectedTopic(topic);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
                        <XAxis dataKey={layout === "vertical" ? undefined : "topic"} type={layout === "vertical" ? "number" : "category"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
                        <YAxis dataKey={layout === "vertical" ? "topic" : undefined} type={layout === "vertical" ? "category" : "number"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} width={layout === "vertical" ? 90 : undefined} />
                        <Tooltip />
                        {editValues?.legend !== false && <Legend />}

                        {isBar ? (
                          <>
                            <Bar dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={ORANGE} />
                            <Bar dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="ngoaiPhamVi" name="Câu hỏi ngoài phạm vi" stackId="a" fill="#64748b" />
                            <Bar dataKey="hallucination" name="AI có nguy cơ tự tạo thông tin" stackId="a" fill="#ef4444" radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                          </>
                        ) : isArea ? (
                          <>
                            <Area type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={ORANGE} stroke={ORANGE} />
                            <Area type="monotone" dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill="#f59e0b" stroke="#f59e0b" />
                            <Area type="monotone" dataKey="ngoaiPhamVi" name="Câu hỏi ngoài phạm vi" stackId="a" fill="#64748b" stroke="#64748b" />
                            <Area type="monotone" dataKey="hallucination" name="AI có nguy cơ tự tạo thông tin" stackId="a" fill="#ef4444" stroke="#ef4444" />
                          </>
                        ) : (
                          <>
                            <Line type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stroke={ORANGE} dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="khongChac" name="AI không chắc chắn" stroke="#f59e0b" dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="ngoaiPhamVi" name="Câu hỏi ngoài phạm vi" stroke="#64748b" dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="hallucination" name="AI có nguy cơ tự tạo thông tin" stroke="#ef4444" dot={{ r: 2 }} />
                          </>
                        )}
                      </ChartComp>
                    </ResponsiveContainer>
                  );
                }}
              </ChartCard>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {topFailureTopics.map((item) => (
                  <button
                    key={item.topic}
                    type="button"
                    aria-label={`Xem chi tiết chủ đề ${item.topic}`}
                    aria-pressed={selectedTopic === item.topic}
                    onClick={() => setSelectedTopic(item.topic)}
                    style={{ padding: "5px 9px", borderRadius: "999px", border: `1px solid ${selectedTopic === item.topic ? ORANGE : "rgba(0,56,101,0.14)"}`, background: selectedTopic === item.topic ? ORANGE_50 : "#fff", color: selectedTopic === item.topic ? ORANGE : NAVY, fontSize: "11px", cursor: "pointer" }}
                  >
                    {item.topic} · {topicFailureTotal(item)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedTopic && selectedTopicFailure && (
            <section aria-labelledby="topic-drilldown-title" style={{ background: "#fff", border: "1px solid rgba(0,56,101,0.08)", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "20px 24px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <h3 id="topic-drilldown-title" style={{ color: NAVY, fontSize: "15px", fontWeight: 700, margin: 0 }}>Chi tiết chủ đề: {selectedTopic}</h3>
                <span style={{ color: ORANGE, fontWeight: 700, fontSize: "12px" }}>{topicFailureTotal(selectedTopicFailure)} lỗi</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 2fr) minmax(320px, 3fr)", gap: "20px", alignItems: "start" }}>
                <div style={{ overflowX: "auto" }}>
                  <table aria-label={`Phân loại lỗi của chủ đề ${selectedTopic}`} style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: "9px 10px", textAlign: "left", color: "rgba(0,56,101,0.6)" }}>Phân loại lỗi</th>
                        <th style={{ padding: "9px 10px", textAlign: "right", color: "rgba(0,56,101,0.6)" }}>Số lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {AI_FAILURE_TAXONOMY.map((definition) => (
                        <tr key={definition.id} style={{ borderTop: "1px solid rgba(0,56,101,0.06)" }}>
                          <td style={{ padding: "9px 10px", color: NAVY }}>{definition.label}</td>
                          <td style={{ padding: "9px 10px", textAlign: "right", color: NAVY, fontWeight: 700 }}>{selectedTopicFailure[definition.analyticsKey]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div role="region" aria-label={`Hội thoại liên quan đến chủ đề ${selectedTopic}`}>
                  <div style={{ color: NAVY, fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>Hội thoại liên quan ({relatedConversations.length})</div>
                  {relatedConversations.length === 0 ? (
                    <div style={{ padding: "18px", borderRadius: "10px", background: "#f8fafc", color: "rgba(0,56,101,0.55)", fontSize: "12px" }}>Chưa có hội thoại liên quan trong dữ liệu API hiện tại.</div>
                  ) : (
                    <div style={{ display: "grid", gap: "8px" }}>
                      {relatedConversations.map((conversation) => (
                        <div key={conversation.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(180px, 2fr)", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.08)", background: "#fbfdff" }}>
                          <div>
                            <div style={{ color: NAVY, fontWeight: 700, fontSize: "12px" }}>{conversation.customerName}</div>
                            {conversation.customerReference && <div style={{ color: "rgba(0,56,101,0.48)", fontSize: "10px", marginTop: "2px" }}>{conversation.customerReference}</div>}
                          </div>
                          <div style={{ color: "rgba(0,56,101,0.72)", fontSize: "12px", lineHeight: 1.45 }}>{conversation.question}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

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
                    onClick={() => setExportMenuOpen((current) => !current)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px" }}
                  >
                    <Download size={13} aria-hidden="true" /> Xuất dữ liệu <ChevronDown size={12} aria-hidden="true" />
                  </button>
                  {exportMenuOpen && (
                    <div role="menu" aria-label="Định dạng xuất dữ liệu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: "130px", padding: "6px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", boxShadow: "0 10px 28px rgba(0,56,101,0.14)" }}>
                      <button role="menuitem" type="button" onClick={() => handleExportFailedConversations("csv")} style={{ width: "100%", padding: "8px 10px", border: 0, borderRadius: "6px", background: "transparent", color: NAVY, textAlign: "left", cursor: "pointer" }}>Xuất CSV</button>
                      <button role="menuitem" type="button" onClick={() => handleExportFailedConversations("json")} style={{ width: "100%", padding: "8px 10px", border: 0, borderRadius: "6px", background: "transparent", color: NAVY, textAlign: "left", cursor: "pointer" }}>Xuất JSON</button>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.58)" }}>Phạm vi: trang hiện tại</span>
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
                    {["Câu trả lời của AI", "Mã KH", "Chủ đề", "Kênh", "Lý do lỗi AI", "Mức độ tin cậy", "Mức ảnh hưởng", "Hành động"].map((h) => (
                      <th key={h} className="flic-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {failedConversations.map((conv) => {
                    const isExpanded = expandedRow === conv.id;
                    const fc = failReasonColor[conv.failReason] || "#64748b";
                    const ic = impactColor[conv.impact];
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
                          <td style={{ padding: "12px 14px", maxWidth: "220px" }}>
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

          {/* AI sai đã bổ sung vào Sheet Chatbot */}
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle size={16} style={{ color: "#228A61" }} />
                <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>AI trả lời sai đã được bổ sung vào Sheet Chatbot</h3>
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
                          <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 500, maxWidth: "180px", cursor: "pointer", textDecoration: "underline" }} onClick={() => { localStorage.setItem("edit_chatbot_question", item.question); onNavigate("chatbot_sheet"); }}>{item.question}</td>
                          <td style={{ padding: "12px 14px", color: "#16a34a", maxWidth: "180px", fontSize: "11px" }}>{item.correctAnswer}</td>
                          <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600 }}>{item.addedBy}</td>
                          <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{item.topic}</span></td>
                          <td style={{ padding: "12px 14px" }}><StatusBadge status={item.status} /></td>
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
        <AddSheetModal
          initialValues={{
            question: faqModalConv.question,
            source: "AI trả lời sai",
            notes: faqModalConv.aiAnswer ? `[Câu AI sai]: ${faqModalConv.aiAnswer}` : "",
            topic: faqModalConv.topic,
          }}
          onClose={() => setFaqModalConv(null)}
          onSave={async (data) => {
            await createSheetChatbotRow({
              ...data,
              addedBy: user?.name || "Nhân viên",
            });
            handleMarkAsProcessed(faqModalConv.id, false);
            toast.success("Đã thêm FAQ vào Sheet Chatbot; dòng lỗi AI chỉ được ẩn trong phiên hiện tại.");
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
