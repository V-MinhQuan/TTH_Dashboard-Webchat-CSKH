import React, { useState, useEffect } from "react";
import { Brain, AlertTriangle, CheckCircle, XCircle, HelpCircle, ShieldAlert, TrendingUp, ChevronDown, ChevronUp, FilePlus2, Clock, Table2, Activity } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { fetchApiJson, buildApiUrl } from "../../services/dashboardApi";
import { AddSheetModal } from "./SheetChatbot";
import { createSheetChatbotRow, getSheetChatbotRows } from "../../services/sheetChatbotApi";
import { useAuth } from "../../context/AuthContext";

const NAVY    = "#003865";
const ORANGE  = "#D73C01";
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ORANGE_200= "#FBCBB8";
const AMBER_50  = "#FFF7E6";
const AMBER_100 = "#FADFA8";
const AMBER_TEXT= "#B7791F";
const RED_50    = "#FFF1F1";
const RED_100   = "#F8CACA";
const RED_TEXT  = "#B42318";

type FailReason = "Không tìm thấy dữ liệu" | "Không hiểu intent" | "AI không chắc chắn" | "Câu hỏi ngoài phạm vi" | "AI có nguy cơ tự tạo thông tin" | "AI trả lời sai" | string;

const failReasonColor: Record<FailReason, string> = {
  "Không tìm thấy dữ liệu": ORANGE,
  "Không hiểu intent": "#8b5cf6",
  "AI không chắc chắn": AMBER_TEXT,
  "Câu hỏi ngoài phạm vi": "#64748b",
  "AI có nguy cơ tự tạo thông tin": RED_TEXT,
  "AI trả lời sai": RED_TEXT,
};

const priorityColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao":         { bg: ORANGE_50,  color: ORANGE },
  "Ưu tiên trung bình": { bg: AMBER_50,  color: AMBER_TEXT },
  "Ưu tiên thấp":        { bg: "#EAF8F1",  color: "#228A61" },
};

const impactColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao":         { bg: RED_50,    color: RED_TEXT },
  "Ưu tiên trung bình": { bg: AMBER_50, color: AMBER_TEXT },
  "Ưu tiên thấp":        { bg: "#f1f5f9", color: "#64748b" },
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
  if (range === "Tùy chọn" && customFrom && customTo) {
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

export function AIInsights({ filters, onFiltersChange, onNavigate }: AIInsightsProps) {
  const { user } = useAuth();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedChatbotRow, setExpandedChatbotRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [faqModalConv, setFaqModalConv] = useState<any>(null);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
  
  const [qualityMetrics, setQualityMetrics] = useState<any>({ total_messages: 0, success_rate: 0, failure_count: 0, hallucination_count: 0, avg_confidence: 0 });
  const [staffActivity, setStaffActivity] = useState<any>({ reported_errors: 0, pending_review: 0 });
  const [failureTrend, setFailureTrend] = useState<any[]>([]);
  const [failureByTopic, setFailureByTopic] = useState<any[]>([]);
  const [failedConversations, setFailedConversations] = useState<any[]>([]);
  const [staffReportedErrors, setStaffReportedErrors] = useState<any[]>([]);
  const [suggestedFAQs, setSuggestedFAQs] = useState<any[]>([]);
  const [recentChatbotRows, setRecentChatbotRows] = useState<any[]>([]);

  useEffect(() => {
    let queryParams = new URLSearchParams();
    const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
    if (dates.startDate && dates.endDate) {
      queryParams.set("startDate", dates.startDate);
      queryParams.set("endDate", dates.endDate);
    }
    if (filters.channel && filters.channel !== "Tất cả") queryParams.set("channel", filters.channel);
    if (filters.topic && filters.topic !== "Tất cả") queryParams.set("topic", filters.topic);
    const qs = queryParams.toString();

    const fetchData = async () => {
      setLoading(true);
      try {
        const [qm, sa, ft, fbt, fc, sre, sf, scRows] = await Promise.all([
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/quality-metrics?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/staff-activity?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/failure-trend?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/failure-by-topic?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/failed-conversations?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/staff-reported-errors?${qs}`)),
          fetchApiJson<any>(buildApiUrl(`/api/analytics/ai/suggested-faqs?${qs}`)),
          getSheetChatbotRows({ pageSize: 5 })
        ]);
        
        if (qm.success) setQualityMetrics(qm.data);
        if (sa.success) setStaffActivity(sa.data);
        if (ft.success) setFailureTrend(ft.data);
        if (fbt.success) setFailureByTopic(fbt.data);
        if (fc.success) setFailedConversations(fc.data.records.map((r: any) => ({
          id: r.id, question: r.textContent || "Không có nội dung", aiAnswer: r.aiAnswer || "Không có câu trả lời AI",
          topic: r.detectedTopics?.[0] || "Khác", channel: r.source || "Unknown", failReason: r.issueType || "Không xác định",
          confidence: r.issueConfidence || 0, impact: "Ưu tiên cao", kbSuggestion: r.issueReason || "Cần bổ sung kiến thức",
          customerId: r.customerId || "Ẩn danh"
        })));
        if (sre.success) setStaffReportedErrors(sre.data.records.map((r: any) => ({
          id: r.id, time: r.messageAt || "Hôm nay", staff: "Admin", channel: r.source || "Unknown",
          topic: r.detectedTopics?.[0] || "Khác", question: r.textContent || "", aiAnswer: r.aiAnswer || "",
          reason: r.issueType || "AI trả lời sai", impact: "Ưu tiên trung bình", status: "Chờ quản lý xác nhận"
        })));
        if (sf.success) setSuggestedFAQs(sf.data);
        if (scRows.success) setRecentChatbotRows(scRows.data || []);
      } catch (err) {
        console.error("Fetch API Error:", err);
        toast.error("Lỗi khi tải dữ liệu Phân tích AI");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const handleAddFaq = async (question: string, topic: string) => {
    try {
      const res = await fetch("/api/sheet-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          correctAnswer: "Đang cập nhật...",
          topic,
          source: "Phân tích AI"
        })
      });
      if (res.ok) {
        toast.success("Đã thêm FAQ thành công vào Sheet Chatbot");
      } else {
        toast.error("Thêm FAQ thất bại");
      }
    } catch (e) {
      toast.error("Lỗi khi thêm FAQ");
    }
  };

  const handleMarkAsProcessed = (id: string, showToast = true) => {
    setFailedConversations(prev => prev.filter(c => c.id !== id));
    if (showToast) {
      toast.success("Đã đánh dấu xử lý");
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {loading ? <AIInsightsSkeleton /> : (
        <>
          {/* Section Label */}
          <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích AI</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Phân tích câu hỏi, chủ đề và lỗi AI theo từng kênh</p>
      </div>

      {/* KPI Row - AI quality */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "16px" }}>
        {[
          { icon: CheckCircle, label: "Tỷ lệ AI trả lời thành công", value: `${qualityMetrics.success_rate}%`, change: "+2,1%", isWarning: false },
          { icon: XCircle, label: "AI trả lời thất bại", value: qualityMetrics.failure_count.toString(), change: "+24", isWarning: true },
          { icon: ShieldAlert, label: "Cảnh báo AI tự tạo thông tin", value: qualityMetrics.hallucination_count.toString(), change: "+5", isWarning: true },
          { icon: Activity, label: "Độ tin cậy trung bình", value: `${qualityMetrics.avg_confidence.toFixed(1)}%`, change: "+3%", isWarning: false },
        ].map(({ icon: Icon, label, value, change, isWarning }) => {
          const isNegative = change.startsWith("-");
          const badgeBg = isNegative ? "#FFF1F1" : "#EAF8F1";
          const badgeColor = isNegative ? "#B42318" : "#228A61";

          // Theme colors for icon circles
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
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} style={{ color: iconColor }} />
                </div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(0,56,101,0.55)", lineHeight: 1.3 }}>{label}</div>
              </div>

              {/* Right Column: Change badge (top) and Value (bottom, under Change badge) */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", height: "100%", minHeight: "72px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {change}
                </span>
                <div style={{ fontSize: "24px", fontWeight: 700, color: NAVY, lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI Row - Staff activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
        {[
          { icon: AlertTriangle, label: "Lỗi AI nhân viên ghi nhận", value: staffActivity.reported_errors.toString(), isWarning: true },
          { icon: FilePlus2, label: "FAQ nhân viên đã thêm", value: "28", isWarning: false },
          { icon: Clock, label: "Dữ liệu chờ duyệt", value: staffActivity.pending_review.toString(), isWarning: true },
          { icon: Table2, label: "Đã cập nhật vào Sheet Chatbot", value: "16", isWarning: false },
        ].map(({ icon: Icon, label, value, isWarning }) => {
          let iconBg = "#EBF2FF";
          let iconColor = NAVY;
          if (Icon === AlertTriangle || Icon === Clock) {
            iconBg = "#FFF4EE";
            iconColor = ORANGE;
          } else if (Icon === FilePlus2) {
            iconBg = "#EAF8F1";
            iconColor = "#228A61";
          } else if (Icon === Table2) {
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
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} style={{ color: iconColor }} />
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
        <ChartCard title="Xu hướng AI thất bại theo ngày (+ dự báo 3 ngày)" onOpenBuilder={() => onNavigate("chartbuilder")} data={failureTrend} defaultChartType="line" supportedChartTypes={["line", "area", "bar", "hbar"]}>
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
                      <Bar dataKey="failure" name="AI trả lời thất bại" fill={ORANGE} radius={layout === "vertical" ? [0,4,4,0] : [4,4,0,0]} />
                      <Bar dataKey="hallucination" name="AI tự tạo thông tin" fill="#ef4444" radius={layout === "vertical" ? [0,4,4,0] : [4,4,0,0]} />
                      <Bar dataKey="uncertain" name="AI không chắc chắn" fill="#f59e0b" radius={layout === "vertical" ? [0,4,4,0] : [4,4,0,0]} />
                    </>
                  ) : isArea ? (
                    <>
                      <Area type="monotone" dataKey="failure" name="AI trả lời thất bại" stroke={ORANGE} fill={`${ORANGE}30`} strokeWidth={2} />
                      <Area type="monotone" dataKey="hallucination" name="AI tự tạo thông tin" stroke="#ef4444" fill="#ef444430" strokeWidth={2} />
                      <Area type="monotone" dataKey="uncertain" name="AI không chắc chắn" stroke="#f59e0b" fill="#f59e0b30" strokeWidth={2} />
                    </>
                  ) : (
                    <>
                      <Line type="monotone" dataKey="failure" name="AI trả lời thất bại" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="hallucination" name="AI tự tạo thông tin" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="uncertain" name="AI không chắc chắn" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    </>
                  )}
                </ChartComp>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>

        <ChartCard title="Lỗi AI theo chủ đề (Stacked)" onOpenBuilder={() => onNavigate("chartbuilder")} data={failureByTopic} defaultChartType="hbar" supportedChartTypes={["line", "area", "bar", "hbar"]}>
          {({ chartType, chartData, editValues }: any) => {
            const isBar = chartType === "bar" || chartType === "hbar";
            const isArea = chartType === "area";
            const ChartComp = isBar ? BarChart : isArea ? AreaChart : LineChart;
            const layout = chartType === "hbar" || chartType === "pie" || chartType === "donut" ? "vertical" : "horizontal";

            return (
              <ResponsiveContainer width="100%" height={210}>
                <ChartComp data={chartData} layout={layout} barSize={layout === "vertical" ? 8 : 20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
                  <XAxis dataKey={layout === "vertical" ? undefined : "topic"} type={layout === "vertical" ? "number" : "category"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
                  <YAxis dataKey={layout === "vertical" ? "topic" : undefined} type={layout === "vertical" ? "category" : "number"} tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} width={layout === "vertical" ? 70 : undefined} />
                  <Tooltip />
                  {editValues?.legend !== false && <Legend />}
                  
                  {isBar ? (
                    <>
                      <Bar dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={ORANGE} />
                      <Bar dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="ngoaiPhamVi" name="Ngoài phạm vi" stackId="a" fill="#64748b" />
                      <Bar dataKey="hallucination" name="AI tự tạo thông tin" stackId="a" fill="#ef4444" radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
                    </>
                  ) : isArea ? (
                    <>
                      <Area type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stackId="a" fill={ORANGE} stroke={ORANGE} />
                      <Area type="monotone" dataKey="khongChac" name="AI không chắc chắn" stackId="a" fill="#f59e0b" stroke="#f59e0b" />
                      <Area type="monotone" dataKey="ngoaiPhamVi" name="Ngoài phạm vi" stackId="a" fill="#64748b" stroke="#64748b" />
                      <Area type="monotone" dataKey="hallucination" name="AI tự tạo thông tin" stackId="a" fill="#ef4444" stroke="#ef4444" />
                    </>
                  ) : (
                    <>
                      <Line type="monotone" dataKey="thieuDL" name="Không tìm thấy dữ liệu" stroke={ORANGE} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="khongChac" name="AI không chắc chắn" stroke="#f59e0b" dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="ngoaiPhamVi" name="Ngoài phạm vi" stroke="#64748b" dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="hallucination" name="AI tự tạo thông tin" stroke="#ef4444" dot={{ r: 2 }} />
                    </>
                  )}
                </ChartComp>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
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
            <button
              onClick={() => toast.success("Đã xuất danh sách câu hỏi AI thất bại")}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px" }}
            >
              Xuất danh sách
            </button>
            <button
              onClick={() => {
                setShowConfirmAllModal(true);
              }}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
            >
              Đánh dấu xử lý (tất cả)
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Câu trả lời AI", "Mã KH", "Chủ đề", "Kênh", "Lý do lỗi AI", "Mức độ tin cậy", "Mức ảnh hưởng", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {failedConversations.map((conv) => {
                const isExpanded = expandedRow === conv.id;
                const fc = failReasonColor[conv.failReason];
                const ic = impactColor[conv.impact];
                return (
                  <React.Fragment key={conv.id}>
                    <tr
                      style={{ borderBottom: "1px solid rgba(0,56,101,0.04)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
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
                        {conv.customerId}
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
                            onClick={() => handleMarkAsProcessed(conv.id)}
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
                        <td colSpan={8} style={{ padding: "12px 14px 14px 28px" }}>
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
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>AI sai đã được bổ sung vào Sheet Chatbot</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>16 mục</span>
          </div>
          <button onClick={() => onNavigate("chatbot_sheet")} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
            Xem Sheet Chatbot
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Câu hỏi khách hàng", "Câu trả lời đúng đã bổ sung", "Người bổ sung", "Chủ đề", "Trạng thái", "Ghi chú nội bộ", "Ngày cập nhật", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>{h}</th>
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
                    <td style={{ padding: "12px 14px" }}><span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: item.status === "Đã duyệt" ? "#dbeafe" : "#dcfce7", color: item.status === "Đã duyệt" ? "#2563eb" : "#16a34a", fontWeight: 600 }}>{item.status}</span></td>
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
            toast.success("Đã thêm FAQ và tự động đánh dấu xử lý");
          }}
        />
      )}

      {showConfirmAllModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,56,101,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "400px", boxShadow: "0 10px 40px rgba(0,56,101,0.15)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#FFF4EE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <AlertTriangle size={24} style={{ color: ORANGE }} />
            </div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 700, color: NAVY }}>Xác nhận đánh dấu xử lý</h3>
            <p style={{ fontSize: "14px", color: "rgba(0,56,101,0.7)", lineHeight: 1.5, marginBottom: "24px", padding: "0 10px" }}>
              Bạn có chắc chắn muốn đánh dấu xử lý toàn bộ các câu hỏi trong danh sách này không? Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", width: "100%" }}>
              <button
                onClick={() => setShowConfirmAllModal(false)}
                style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.15)", background: "#fff", color: NAVY, cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setFailedConversations([]);
                  toast.success("Đã đánh dấu xử lý toàn bộ danh sách");
                  setShowConfirmAllModal(false);
                }}
                style={{ flex: 1, padding: "10px 0", borderRadius: "8px", border: "none", background: ORANGE, color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
