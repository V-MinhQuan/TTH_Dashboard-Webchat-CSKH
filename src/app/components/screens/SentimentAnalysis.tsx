import React, { useState, useEffect } from "react";

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() { 
    if (this.state.hasError) return (
      <div style={{ color: "#D73C01", padding: "20px", border: "1px solid #FBCBB8", backgroundColor: "#FFF4EE", borderRadius: "10px" }}>
        <strong>Lỗi hiển thị biểu đồ:</strong> {this.state.error?.message || "Lỗi không xác định"}
      </div>
    ); 
    return this.props.children; 
  }
}
import { Heart, Meh, Frown, TrendingUp, AlertTriangle, Lightbulb, Star, MessageCircle, Smile, AlertCircle, Activity, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { closeConversation, fetchApiJson, buildApiUrl, formatChannelParam } from "../../services/dashboardApi";
import { bulkCloseConversations, getCustomerPresentation } from "../../services/conversationApi";

const NAVY = "#003865";
const ORANGE = "#D73C01";

type NegLevel = "Rất tiêu cực" | "Tiêu cực" | "Hơi tiêu cực";

const negLevelConfig: Record<NegLevel, { bg: string; color: string; stars: number }> = {
  "Rất tiêu cực": { bg: "#FFF1F1", color: "#B42318", stars: 3 },
  "Tiêu cực":     { bg: "#FFF4EE", color: ORANGE,   stars: 2 },
  "Hơi tiêu cực": { bg: "#FFF7E6", color: "#B7791F", stars: 1 },
};

const statusConfig: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: "#FFF4EE", color: ORANGE },
  "Chờ xử lý":          { bg: "#FFF7E6", color: "#B7791F" },
  "Đang xử lý":          { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành":           { bg: "#EAF8F1", color: "#228A61" },
};

function getNegativeLevel(sentimentLabel: unknown, sentimentScore: unknown): NegLevel {
  const label = String(sentimentLabel || "").toLowerCase();
  const score = Number(sentimentScore);
  if (label !== "negative" || !Number.isFinite(score)) return "Hơi tiêu cực";

  if (score < 0) {
    if (score <= -0.75) return "Rất tiêu cực";
    if (score <= -0.45) return "Tiêu cực";
    return "Hơi tiêu cực";
  }

  if (score >= 0.8) return "Rất tiêu cực";
  if (score >= 0.6) return "Tiêu cực";
  return "Hơi tiêu cực";
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

function buildSentimentQueryParams(filters: FilterValues) {
  const queryParams = new URLSearchParams();
  const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
  if (dates.startDate && dates.endDate) {
    queryParams.set("startDate", dates.startDate);
    queryParams.set("endDate", dates.endDate);
  }
  if (filters.channel && filters.channel !== "Tất cả") queryParams.set("channel", formatChannelParam(filters.channel));
  if (filters.topic && filters.topic !== "Tất cả") queryParams.set("topic", filters.topic);
  if (filters.conversationStatus && filters.conversationStatus !== "Tất cả") queryParams.set("conversationStatus", filters.conversationStatus);
  if (filters.aiStatus && filters.aiStatus !== "Tất cả") queryParams.set("aiStatus", filters.aiStatus);
  return queryParams;
}

function mapPositiveConversation(conv: any) {
  const customer = getCustomerPresentation(
    conv.customerDisplayName || conv.customerName || conv.customer_name,
    conv.customerId,
    conv.phoneNumber,
  );
  return {
    id: conv.id,
    conversationId: Number(conv.conversationId),
    customer: customer.primary,
    customerReference: customer.secondary,
    content: conv.textContent || "Chưa có dữ liệu",
    topic: Array.isArray(conv.detectedTopics) && conv.detectedTopics.length > 0
      ? conv.detectedTopics.join(", ")
      : "Chưa xác định",
    channel: conv.source || "Chưa xác định",
    label: "Tích cực",
    score: Number.isFinite(Number(conv.sentimentScore)) ? Number(conv.sentimentScore) : null,
    messageAt: conv.messageAt || null,
  };
}

interface SentimentAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

function SentimentLoadingState() {
  const block = (style: React.CSSProperties = {}) => (
    <div
      style={{
        borderRadius: "10px",
        background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
        backgroundSize: "200% 100%",
        animation: "sentimentShimmer 1.4s infinite",
        ...style,
      }}
    />
  );

  return (
    <div>
      <style>{`
        @keyframes sentimentShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ marginBottom: "16px" }}>
        {block({ width: "220px", height: "22px", marginBottom: "8px" })}
        {block({ width: "330px", height: "14px" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ background: "#fff", borderRadius: "20px", padding: "24px", border: "1px solid rgba(0,56,101,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              {block({ width: "48px", height: "48px", borderRadius: "14px" })}
              <div style={{ flex: 1 }}>
                {block({ width: "70%", height: "14px", marginBottom: "6px" })}
                {block({ width: "90%", height: "24px" })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        {block({ height: "282px", backgroundColor: "#fff" })}
        {block({ height: "282px", backgroundColor: "#fff" })}
      </div>
      <div style={{ marginBottom: "24px" }}>
        {block({ height: "300px", backgroundColor: "#fff" })}
      </div>
    </div>
  );
}

export function SentimentAnalysis({ filters, onFiltersChange, onNavigate }: SentimentAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  
  const [sentimentTrend, setSentimentTrend] = useState<any[]>([]);
  const [topicSentiment, setTopicSentiment] = useState<any[]>([]);
  const [donutData, setDonutData] = useState<any[]>([
    { name: "Tích cực", value: 0, color: "#3E9675" },
    { name: "Trung lập", value: 0, color: "#E5A850" },
    { name: "Tiêu cực", value: 0, color: "#D26767" },
  ]);
  const [negKeywords, setNegKeywords] = useState<any[]>([]);
  const [negativeConversations, setNegativeConversations] = useState<any[]>([]);
  const [positiveConversations, setPositiveConversations] = useState<any[]>([]);
  const [positivePage, setPositivePage] = useState(1);
  const [positiveTotal, setPositiveTotal] = useState(0);
  const [positiveError, setPositiveError] = useState<string | null>(null);
  const [positiveLoading, setPositiveLoading] = useState(false);
  const [sentimentKpiTrend, setSentimentKpiTrend] = useState<{ pos: string; neu: string; neg: string }>({ pos: "", neu: "", neg: "" });
  const [selectedConvIds, setSelectedConvIds] = useState<Set<number>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const bulkGuard = React.useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setPositivePage(1);
  }, [filters]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const queryParams = buildSentimentQueryParams(filters);

        const [sumRes, trendRes, topicRes, kwRes, convRes] = await Promise.all([
          fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-summary", queryParams), { cache: false }),
          fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-trend", queryParams), { cache: false }),
          fetchApiJson<any>(buildApiUrl("/api/analytics/topics", queryParams), { cache: false }),
          fetchApiJson<any>(buildApiUrl("/api/analytics/negative-keywords", queryParams), { cache: false }),
          fetchApiJson<any>(buildApiUrl("/api/analytics/negative-conversations", queryParams), { cache: false }),
        ]);

        if (sumRes?.success) {
          setSummaryData(sumRes.data);
          const total = sumRes.data.summary?.total || 1;
          const pos = sumRes.data.summary?.positive || 0;
          const neu = sumRes.data.summary?.neutral || 0;
          const neg = sumRes.data.summary?.negative || 0;
          
          setDonutData([
            { name: "Tích cực", value: Math.round((pos / total) * 100) || 0, color: "#3E9675" },
            { name: "Trung lập", value: Math.round((neu / total) * 100) || 0, color: "#E5A850" },
            { name: "Tiêu cực", value: Math.round((neg / total) * 100) || 0, color: "#D26767" },
          ]);
        }
        
        if (trendRes?.success) {
          const rawTrend = Array.isArray(trendRes.data) ? trendRes.data : [];
          setSentimentTrend(rawTrend.map(d => {
            const total = (d.positive + d.neutral + d.negative) || 1;
            const dateObj = new Date(d.date);
            return {
              date: !isNaN(dateObj.getTime()) ? `${dateObj.getDate()}/${dateObj.getMonth() + 1}` : d.date,
              positive: Math.round((d.positive / total) * 100) || 0,
              neutral: Math.round((d.neutral / total) * 100) || 0,
              negative: Math.round((d.negative / total) * 100) || 0
            };
          }));
        }

        if (topicRes?.success) {
          const rawTopic = Array.isArray(topicRes.data) ? topicRes.data : [];
          setTopicSentiment(rawTopic.slice(0, 10).map(d => {
            const total = d.count || 1;
            const pos = d.positive !== undefined ? Math.round((d.positive / total) * 100) : 0;
            const neu = d.neutral !== undefined ? Math.round((d.neutral / total) * 100) : 0;
            const neg = d.negative !== undefined ? Math.round((d.negative / total) * 100) : 0;
            return {
              topic: d.topicLabel || "Không phân loại trong database",
              positive: pos,
              neutral: neu,
              negative: neg
            };
          }));
        }

        if (kwRes?.success) {
          const rawKw = Array.isArray(kwRes.data) ? kwRes.data : [];
          setNegKeywords(rawKw.slice(0, 10).map(d => ({
            word: d.keyword,
            count: d.count,
            topic: d.topicLabel || d.topic || "Khác"
          })));
        }

        if (convRes?.success) {
          const rawConv = Array.isArray(convRes.data?.records) ? convRes.data.records : [];
          const negativeReviewConversations = rawConv.filter(
            (conv) => Boolean(conv.needStaffReview)
          );
          setSelectedConvIds(new Set());
          setNegativeConversations(negativeReviewConversations.map(conv => {
            const waitTimeRaw = Date.now() - new Date(conv.messageAt).getTime();
            const waitDays = Math.floor(waitTimeRaw / (1000 * 60 * 60 * 24));
            const waitHours = Math.floor(waitTimeRaw / (1000 * 60 * 60));
            const waitMins = Math.floor((waitTimeRaw / (1000 * 60)) % 60);
            const waitTimeStr = waitDays >= 1 ? `${waitDays} ngày` : waitHours > 0 ? `${waitHours}g ${waitMins}p` : !isNaN(waitMins) ? `${waitMins}p` : "0p";
            const customer = getCustomerPresentation(
              conv.customerName || conv.customer_name,
              conv.customerId,
            );
            return {
              id: `#${conv.messageId || conv.id_webchat_messagelogs || "N/A"}`,
              conversationId: Number(conv.conversationId),
              customer: customer.primary,
              customerReference: customer.secondary,
              complaint: conv.textContent || "Chưa có dữ liệu",
              topic: Array.isArray(conv.detectedTopics) && conv.detectedTopics.length > 0 ? conv.detectedTopics.join(", ") : (conv.detectedTopics || "Chưa xác định"),
              channel: conv.source || "Chưa xác định",
              level: getNegativeLevel(conv.sentimentLabel, conv.sentimentScore),
              waitTime: waitTimeStr,
              status: conv.needStaffReview ? "Cần xử lý" : "Chờ xử lý",
              customerId: conv.customerId,
              source: conv.source,
            };
          }));
        }

        // Tính toán xu hướng tích cực/trung lập/tiêu cực từ trend data thực
        // (so sánh nửa đầu và nửa sau của dữ liệu trend để xác định chiều hướng)
        if (trendRes?.success && Array.isArray(trendRes.data) && trendRes.data.length >= 2) {
          const half = Math.floor(trendRes.data.length / 2);
          const firstHalf = trendRes.data.slice(0, half);
          const secondHalf = trendRes.data.slice(half);
          const avg = (arr: any[], key: string) => arr.reduce((s, d) => s + (d[key] || 0), 0) / Math.max(arr.length, 1);
          const posChange = avg(secondHalf, "positive") - avg(firstHalf, "positive");
          const neuChange = avg(secondHalf, "neutral") - avg(firstHalf, "neutral");
          const negChange = avg(secondHalf, "negative") - avg(firstHalf, "negative");
          setSentimentKpiTrend({
            pos: posChange > 0 ? `+${posChange.toFixed(1)}%` : posChange < 0 ? `${posChange.toFixed(1)}%` : "Ổn định",
            neu: neuChange > 0 ? `+${neuChange.toFixed(1)}%` : neuChange < 0 ? `${neuChange.toFixed(1)}%` : "Ổn định",
            neg: negChange > 0 ? `+${negChange.toFixed(1)}%` : negChange < 0 ? `${negChange.toFixed(1)}%` : "Ổn định",
          });
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu cảm xúc:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filters, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadPositiveConversations() {
      setPositiveLoading(true);
      setPositiveError(null);
      try {
        const queryParams = buildSentimentQueryParams(filters);
        queryParams.set("page", String(positivePage));
        queryParams.set("pageSize", "10");
        const response = await fetchApiJson<any>(
          buildApiUrl("/api/analytics/positive-conversations", queryParams),
          { cache: false },
        );
        if (cancelled) return;
        if (!response?.success) throw new Error("API hội thoại tích cực trả về dữ liệu không hợp lệ.");

        const records = Array.isArray(response.data?.records) ? response.data.records : [];
        setPositiveConversations(records.map(mapPositiveConversation));
        setPositiveTotal(Number(response.data?.pagination?.total) || 0);
      } catch (error) {
        if (cancelled) return;
        setPositiveConversations([]);
        setPositiveTotal(0);
        setPositiveError(error instanceof Error ? error.message : "Không thể tải hội thoại tích cực.");
      } finally {
        if (!cancelled) setPositiveLoading(false);
      }
    }

    void loadPositiveConversations();
    return () => {
      cancelled = true;
    };
  }, [filters, positivePage, refreshKey]);

  const posPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.positive / summaryData.summary.total) * 100) + "%" : "0%";
  const neuPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.neutral / summaryData.summary.total) * 100) + "%" : "0%";
  const negPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.negative / summaryData.summary.total) * 100) + "%" : "0%";
  const satisfactionValue = summaryData?.avgSatisfaction ? (summaryData.avgSatisfaction > 5 ? summaryData.avgSatisfaction / 20 : summaryData.avgSatisfaction) : 0;
  const satisfactionStr = satisfactionValue > 0 ? satisfactionValue.toFixed(1) + "/5" : "0/5";
  const satisfactionPctLabel = satisfactionValue > 0 ? `${Math.round(satisfactionValue * 20)} điểm %` : "0 điểm %";

  // Dữ liệu chủ đề từ API thực — hiển thị empty state nếu chưa có dữ liệu
  const dynamicTopicData = topicSentiment && topicSentiment.length > 0 ? topicSentiment : [];

  const handleCloseNegativeConversation = async (conv: any) => {
    if (!conv.customerId || !conv.source) {
      toast.error("Bản ghi thiếu customerId/source trong database nên không thể đóng hội thoại.");
      return;
    }

    try {
      await closeConversation(conv.customerId, conv.source);
      setNegativeConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: "Đã xử lý" } : c));
      toast.success(`Đã đóng hội thoại ${conv.id} trong database`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đóng hội thoại");
    }
  };

  const selectableIds = negativeConversations
    .filter((conv) => Number.isInteger(conv.conversationId) && conv.conversationId > 0 && conv.status !== "Đã xử lý")
    .map((conv) => conv.conversationId as number);
  const allPageSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedConvIds.has(id));

  const toggleAllPage = () => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBulkClose = async () => {
    if (bulkGuard.current || bulkSubmitting) return;
    bulkGuard.current = true;
    const selectedIds = new Set(selectedConvIds);
    const closable = negativeConversations.filter(
      (conv) => selectedIds.has(conv.conversationId) && conv.status !== "Đã xử lý"
    );
    if (closable.length === 0) {
      bulkGuard.current = false;
      toast.error("Không có hội thoại hợp lệ để xử lý.");
      return;
    }
    setBulkSubmitting(true);
    try {
      const result = await bulkCloseConversations(closable.map((c) => c.conversationId));
      setNegativeConversations((prev) =>
        prev.map((c) => selectedIds.has(c.conversationId) ? { ...c, status: "Đã xử lý" } : c)
      );
      setSelectedConvIds(new Set());
      setShowBulkConfirm(false);
      toast.success(`Đã cập nhật ${result.affected} hội thoại.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật hội thoại.");
    } finally {
      bulkGuard.current = false;
      setBulkSubmitting(false);
    }
  };

  const refreshNegConversations = () => {
    setSelectedConvIds(new Set());
    setRefreshKey((k) => k + 1);
  };

  return (
    <div style={{ padding: "24px", position: "relative" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {loading ? (
        <SentimentLoadingState />
      ) : (
        <>
          {/* Section Label */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích cảm xúc</h2>
            </div>
            <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Theo dõi và phân tích thái độ, mức độ hài lòng của khách hàng</p>
          </div>

          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              { icon: MessageCircle, label: "Tổng số hội thoại", value: summaryData?.summary?.total?.toString() || "0", change: "Theo bộ lọc", color: "#003BB9", bg: "#eff6ff", trend: "Số lượng hội thoại đã phân tích" },
              { icon: Smile, label: "Tỷ lệ Tích cực", value: posPctStr, change: "Theo bộ lọc", color: "#228A61", bg: "#f0fdf4", trend: "Phần trăm cảm xúc hài lòng" },
              { icon: Meh, label: "Tỷ lệ Trung lập", value: neuPctStr, change: "Theo bộ lọc", color: "#E5A850", bg: "#fffbeb", trend: "Phần trăm cảm xúc bình thường" },
              { icon: AlertCircle, label: "Tỷ lệ Tiêu cực", value: negPctStr, change: "Theo bộ lọc", color: ORANGE, bg: "#fff5f5", trend: "Phần trăm cảm xúc cần chú ý" },
              { icon: Activity, label: "Mức độ hài lòng chung", value: satisfactionStr, change: `(${satisfactionPctLabel})`, color: "#a855f7", bg: "#faf5ff", trend: "Điểm trung bình (quy đổi)" },
            ].map(({ icon: Icon, label, value, change, color, bg, trend }) => (
              <div key={label} style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={28} style={{ color }} />
                  </div>
              <div>
                <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{value}</div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.45)" }}>{trend}</div>
            <div style={{ marginTop: "10px", fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,56,101,0.5)", display: "inline-block", fontWeight: 500 }}>{change}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <ErrorBoundary>
        <ChartCard title="Xu hướng cảm xúc theo thời gian" data={sentimentTrend} onOpenBuilder={() => onNavigate("chartbuilder")}>
          {({ chartType, chartData, editValues }: any) => {
            const showLegend = editValues?.legend !== false;
            const safeData = Array.isArray(chartData) ? chartData : [];
            
            if (safeData.length < 14) {
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "rgba(0,56,101,0.4)", fontSize: "13px", fontStyle: "italic" }}>
                  Chưa đủ dữ liệu để dự báo. Cần tối thiểu 14 ngày lịch sử liên tục.
                </div>
              );
            }
            
            if (chartType === "pie" || chartType === "donut") {
              const pieData = [
                { name: "Tích cực", value: safeData.reduce((a: number, c: any) => a + (c.positive || 0), 0), fill: "#3E9675" },
                { name: "Trung lập", value: safeData.reduce((a: number, c: any) => a + (c.neutral || 0), 0), fill: "#E5A850" },
                { name: "Tiêu cực", value: safeData.reduce((a: number, c: any) => a + (c.negative || 0), 0), fill: "#D26767" },
              ];
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={chartType === "pie" ? 0 : 50} outerRadius={80} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    {showLegend && <Legend iconSize={10} />}
                  </PieChart>
                </ResponsiveContainer>
              );
            }

            if (chartType === "bar" || chartType === "hbar") {
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={safeData} layout={chartType === "hbar" ? "vertical" : "horizontal"}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                    {chartType === "hbar" ? <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} /> : <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />}
                    {chartType === "hbar" ? <YAxis dataKey="date" type="category" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} width={80} /> : <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} unit="%" />}
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    {showLegend && <Legend iconSize={10} />}
                    <Bar dataKey="positive" name="Tích cực" fill="#3E9675" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                    <Bar dataKey="neutral" name="Trung lập" fill="#E5A850" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                    <Bar dataKey="negative" name="Tiêu cực" fill="#D26767" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }
            
            const ChartComponent: any = chartType === "area" ? AreaChart : LineChart;
            const SeriesComponent: any = chartType === "area" ? Area : Line;
            
            return (
              <ResponsiveContainer width="100%" height={220}>
                <ChartComponent data={safeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} unit="%" />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  {showLegend && <Legend iconSize={10} />}
                  <SeriesComponent type="monotone" dataKey="positive" name="Tích cực" stroke="#3E9675" fill="#3E9675" strokeWidth={2} dot={{ r: 2 }} />
                  <SeriesComponent type="monotone" dataKey="neutral" name="Trung lập" stroke="#E5A850" fill="#E5A850" strokeWidth={2} dot={{ r: 2 }} />
                  <SeriesComponent type="monotone" dataKey="negative" name="Tiêu cực" stroke="#D26767" fill="#D26767" strokeWidth={2} dot={{ r: 2 }} />
                </ChartComponent>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary>
        <ChartCard title="Phân bổ cảm xúc tổng quan" data={donutData} defaultChartType="donut" onOpenBuilder={() => onNavigate("chartbuilder")}>
          {({ chartType, chartData, editValues }: any) => {
            const showLegend = editValues?.legend !== false;
            const safeData = Array.isArray(chartData) ? chartData : [];
            
            if (chartType === "pie" || chartType === "donut") {
              return (
                <div style={{ display: "flex", alignItems: "center", gap: "24px", height: "220px" }}>
                  <PieChart width={200} height={200}>
                    <Pie data={safeData} cx={100} cy={100} innerRadius={chartType === "pie" ? 0 : 55} outerRadius={85} dataKey="value">
                      {safeData.map((d: any) => <Cell key={`sentiment-donut-${d.name}`} fill={d.color || "#003BB9"} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </PieChart>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {showLegend && safeData.map((item: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: "140px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: item.color || "#003BB9" }} />
                          <span style={{ fontSize: "13px", color: "rgba(0,56,101,0.6)" }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#003865" }}>{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            if (chartType === "bar" || chartType === "hbar") {
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={safeData} layout={chartType === "hbar" ? "vertical" : "horizontal"} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                    {chartType === "hbar" ? <XAxis type="number" /> : <XAxis dataKey="name" tick={{ fontSize: 11 }} />}
                    {chartType === "hbar" ? <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} /> : <YAxis />}
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    {showLegend && <Legend />}
                    <Bar dataKey="value" name="Tỷ lệ">
                      {safeData.map((d: any, i: number) => <Cell key={i} fill={d.color || "#003BB9"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            }
            
            const ChartComponent: any = chartType === "area" ? AreaChart : LineChart;
            const SeriesComponent: any = chartType === "area" ? Area : Line;
            
            return (
              <ResponsiveContainer width="100%" height={220}>
                <ChartComponent data={safeData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  {showLegend && <Legend />}
                  <SeriesComponent type="monotone" dataKey="value" name="Tỷ lệ" stroke="#003BB9" fill="#003BB9" strokeWidth={2} />
                </ChartComponent>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
        </ErrorBoundary>
      </div>

      {/* Stacked by Topic */}
      <div style={{ marginBottom: "24px" }}>
        <ErrorBoundary>
        <ChartCard title="Cảm xúc theo chủ đề" data={dynamicTopicData} onOpenBuilder={() => onNavigate("chartbuilder")}>
          {({ chartType, chartData, editValues }: any) => {
            const showLegend = editValues?.legend !== false;
            const safeData = Array.isArray(chartData) ? chartData : [];

            // Hiển thị empty state nếu không có dữ liệu từ API
            if (safeData.length === 0) {
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "rgba(0,56,101,0.4)", fontSize: "13px", fontStyle: "italic" }}>
                  Chưa có dữ liệu phân tích chủ đề. Dữ liệu sẽ hiển thị khi ML service phân tích xong tin nhắn.
                </div>
              );
            }

            if (chartType === "pie" || chartType === "donut") {
              const pieData = safeData.map((d: any) => ({
                 name: d.topic,
                 value: (d.positive || 0) + (d.neutral || 0) + (d.negative || 0)
              }));
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={chartType === "pie" ? 0 : 60} outerRadius={90} dataKey="value" label={showLegend ? { fontSize: 11, fill: "rgba(0,56,101,0.6)" } : false}>
                      {pieData.map((d, i) => <Cell key={i} fill={`hsl(${(i * 50) % 360}, 70%, 55%)`} />)}
                    </Pie>
                    <Tooltip />
                    {showLegend && <Legend iconSize={10} />}
                  </PieChart>
                </ResponsiveContainer>
              );
            }
            
            if (chartType === "bar" || chartType === "hbar") {
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={safeData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }} layout={chartType === "hbar" ? "vertical" : "horizontal"}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" vertical={chartType !== "hbar"} horizontal={chartType === "hbar"} />
                    {chartType === "hbar" ? <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} tickFormatter={(v) => `${v}%`} /> : <XAxis dataKey="topic" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} dy={10} />}
                    {chartType === "hbar" ? <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} width={100} /> : <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} tickFormatter={(v) => `${v}%`} />}
                    <Tooltip cursor={{ fill: "rgba(0,56,101,0.02)" }} formatter={(v: any) => `${v}%`} />
                    {showLegend && <Legend iconSize={8} iconType="square" wrapperStyle={{ bottom: 0 }} />}
                    <Bar dataKey="positive" name="Tích cực" stackId="a" fill="#3E9675" />
                    <Bar dataKey="neutral" name="Trung lập" stackId="a" fill="#E5A850" />
                    <Bar dataKey="negative" name="Tiêu cực" stackId="a" fill="#D26767" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }
            
            const ChartComponent: any = chartType === "area" ? AreaChart : LineChart;
            const SeriesComponent: any = chartType === "area" ? Area : Line;
            
            return (
              <ResponsiveContainer width="100%" height={260}>
                <ChartComponent data={safeData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" vertical={false} />
                  <XAxis dataKey="topic" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={{ fill: "rgba(0,56,101,0.02)" }} formatter={(v: any) => `${v}%`} />
                  {showLegend && <Legend iconSize={8} iconType="square" wrapperStyle={{ bottom: 0 }} />}
                  <SeriesComponent type="monotone" dataKey="positive" name="Tích cực" stroke="#3E9675" fill="#3E9675" strokeWidth={2} />
                  <SeriesComponent type="monotone" dataKey="neutral" name="Trung lập" stroke="#E5A850" fill="#E5A850" strokeWidth={2} />
                  <SeriesComponent type="monotone" dataKey="negative" name="Tiêu cực" stroke="#D26767" fill="#D26767" strokeWidth={2} />
                </ChartComponent>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
        </ErrorBoundary>
      </div>

      {/* Positive Conversations Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Smile size={16} style={{ color: "#228A61" }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại có cảm xúc tích cực</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#ecfdf3", color: "#16794f", fontWeight: 600 }}>{positiveTotal} hội thoại</span>
          </div>
          <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.55)" }}>Quy tắc: cảm xúc của bản phân tích mới nhất trong mỗi hội thoại</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead><tr style={{ backgroundColor: "#f8fafc" }}>
              {["Khách hàng", "Nội dung đại diện", "Thời gian", "Chủ đề", "Kênh", "Cảm xúc", "Điểm", "Hành động"].map((header) => (
                <th key={header} className="flic-th">{header}</th>
              ))}
            </tr></thead>
            <tbody>
              {positiveLoading && <tr><td colSpan={8} style={{ padding: "22px", textAlign: "center", color: "rgba(0,56,101,0.55)" }}>Đang tải trang {positivePage}...</td></tr>}
              {!positiveLoading && positiveError && <tr><td colSpan={8} style={{ padding: "22px", textAlign: "center", color: "#b42318" }}>{positiveError}</td></tr>}
              {!positiveLoading && !positiveError && positiveConversations.length === 0 && <tr><td colSpan={8} style={{ padding: "22px", textAlign: "center", color: "rgba(0,56,101,0.55)" }}>Chưa có dữ liệu hội thoại tích cực trong khoảng lọc.</td></tr>}
              {!positiveLoading && !positiveError && positiveConversations.map((conversation) => (
                <tr key={conversation.id} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}>
                  <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600 }}>{conversation.customer}{conversation.customerReference && <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.45)" }}>{conversation.customerReference}</div>}</td>
                  <td style={{ padding: "12px 14px", maxWidth: "300px", color: "rgba(0,56,101,0.72)" }}>{conversation.content}</td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{conversation.messageAt ? new Date(conversation.messageAt).toLocaleString("vi-VN") : "Chưa xác định"}</td>
                  <td style={{ padding: "12px 14px" }}>{conversation.topic}</td>
                  <td style={{ padding: "12px 14px" }}>{conversation.channel}</td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}><span style={{ padding: "2px 8px", borderRadius: "999px", background: "#ecfdf3", color: "#16794f" }}>{conversation.label}</span></td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>{conversation.score === null ? "Chưa có dữ liệu" : conversation.score.toFixed(2)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}><button type="button" onClick={() => { sessionStorage.setItem("dashboard_open_conversation_id", String(conversation.conversationId)); onNavigate("conversation"); }} style={{ padding: "4px 9px", borderRadius: "6px", border: "1px solid rgba(0,56,101,0.16)", background: "#fff", color: NAVY, cursor: "pointer" }}>Xem chi tiết</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", padding: "12px 18px" }}>
          <button
            type="button"
            aria-label="Trang trước"
            title="Trang trước"
            disabled={positiveLoading || positivePage <= 1}
            onClick={() => setPositivePage((page) => Math.max(1, page - 1))}
            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.14)", background: "#fff", color: NAVY, display: "grid", placeItems: "center", cursor: positiveLoading || positivePage <= 1 ? "not-allowed" : "pointer", opacity: positiveLoading || positivePage <= 1 ? 0.45 : 1 }}
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <span style={{ fontSize: "12px", color: NAVY }}>Trang {positivePage}/{Math.max(1, Math.ceil(positiveTotal / 10))}</span>
          <button
            type="button"
            aria-label="Trang sau"
            title="Trang sau"
            disabled={positiveLoading || positivePage * 10 >= positiveTotal}
            onClick={() => setPositivePage((page) => page + 1)}
            style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.14)", background: "#fff", color: NAVY, display: "grid", placeItems: "center", cursor: positiveLoading || positivePage * 10 >= positiveTotal ? "not-allowed" : "pointer", opacity: positiveLoading || positivePage * 10 >= positiveTotal ? 0.45 : 1 }}
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Negative Conversations Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Frown size={16} style={{ color: ORANGE }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại có cảm xúc tiêu cực cần xử lý</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#FFF4EE", border: "1px solid #FBCBB8", color: ORANGE, fontWeight: 600 }}>{negativeConversations.length} hội thoại</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              aria-label="Làm mới danh sách hội thoại tiêu cực"
              onClick={refreshNegConversations}
              style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.15)", background: "#fff", color: NAVY, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
            >
              Làm mới
            </button>
          </div>
          {selectedConvIds.size > 0 && (
            <div role="toolbar" aria-label="Thao tác hàng loạt" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: NAVY, fontWeight: 600 }}>Đã chọn {selectedConvIds.size} hội thoại</span>
              <button
                onClick={() => setShowBulkConfirm(true)}
                style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, #ED5206 0%, #F36C2E 100%)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
              >
                Đánh dấu đã xử lý {selectedConvIds.size} hội thoại
              </button>
            </div>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", width: "40px", textAlign: "center", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả hội thoại trên trang"
                    checked={allPageSelected}
                    onChange={toggleAllPage}
                    disabled={selectableIds.length === 0}
                  />
                </th>
                {["Khách hàng", "Nội dung phàn nàn", "Chủ đề", "Kênh", "Mức độ tiêu cực", "Thời gian chờ", "Trạng thái", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {negativeConversations.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "22px 14px", textAlign: "center", color: "rgba(0,56,101,0.55)", fontSize: "12px" }}>
                    Không có hội thoại có cảm xúc tiêu cực cần xử lý trong khoảng lọc.
                  </td>
                </tr>
              )}
              {negativeConversations.map((conv) => {
                const lc = negLevelConfig[conv.level];
                const sc = statusConfig[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
                return (
                  <tr key={conv.id}
                    style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        aria-label={`Chọn hội thoại ${conv.id}`}
                        checked={selectedConvIds.has(conv.conversationId)}
                        disabled={!Number.isInteger(conv.conversationId) || conv.status === "Đã xử lý"}
                        onChange={() => setSelectedConvIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(conv.conversationId)) next.delete(conv.conversationId);
                          else next.add(conv.conversationId);
                          return next;
                        })}
                      />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: NAVY, fontSize: "12px" }}>{conv.customer}</div>
                      {conv.customerReference && <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", fontFamily: "monospace", marginTop: "2px" }}>{conv.customerReference}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: "240px" }}>
                      <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.7)", lineHeight: 1.5, fontStyle: "italic" }}>"{conv.complaint}"</div>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: "150px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", display: "inline-block", wordBreak: "break-word" }}>{conv.topic}</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "rgba(0,56,101,0.65)", whiteSpace: "nowrap" }}>{conv.channel}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: lc.bg, color: lc.color, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }}>{conv.level}</span>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {Array.from({ length: lc.stars }).map((_, i) => (
                            <span key={i} style={{ color: lc.color, fontSize: "11px" }}>●</span>
                          ))}
                          {Array.from({ length: 3 - lc.stars }).map((_, i) => (
                            <span key={i} style={{ color: "#e2e8f0", fontSize: "11px" }}>●</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: conv.waitTime.includes("g") && parseInt(conv.waitTime) >= 4 ? ORANGE : "rgba(0,56,101,0.65)", fontWeight: conv.waitTime.includes("g") && parseInt(conv.waitTime) >= 4 ? 600 : 400, whiteSpace: "nowrap" }}>{conv.waitTime}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, fontWeight: 600, whiteSpace: "nowrap" }}>{conv.status}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {conv.status !== "Đã xử lý" ? (
                          <button
                            onClick={() => { void handleCloseNegativeConversation(conv); }}
                            style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${ORANGE}30`, background: "#fff3ef", color: ORANGE, cursor: "pointer", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}
                          >
                            Đánh dấu xử lý
                          </button>
                        ) : (
                          <span style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", fontWeight: 600, textAlign: "center" }}>Hoàn tất</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keywords */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "20px", marginBottom: "24px" }}>
        <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={15} style={{ color: ORANGE }} /> Từ khóa gây cảm xúc tiêu cực
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {negKeywords.map((kw, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#FFF4EE" }}>
              <span style={{ fontSize: "11px", color: ORANGE, fontWeight: 700 }}>#{i + 1}</span>
              <span style={{ flex: 1, fontSize: "13px", color: NAVY }}>"{kw.word}"</span>
              <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{kw.topic}</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: ORANGE }}>{kw.count}</span>
            </div>
          ))}
          {negKeywords.length === 0 && (
            <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", margin: 0, fontStyle: "italic" }}>Chưa có dữ liệu từ khóa tiêu cực.</p>
          )}
        </div>
      </div>

      {showBulkConfirm && (
        <div
          role="presentation"
          onKeyDown={(e) => { if (e.key === "Escape" && !bulkSubmitting) setShowBulkConfirm(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,56,101,0.45)", zIndex: 1000, display: "grid", placeItems: "center", padding: "16px" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-confirm-title"
            aria-describedby="bulk-confirm-desc"
            style={{ width: "min(440px, 100%)", background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 55px rgba(0,56,101,0.24)" }}
          >
            <h3 id="bulk-confirm-title" style={{ margin: "0 0 10px", color: NAVY, fontSize: "18px" }}>Xác nhận đánh dấu đã xử lý</h3>
            <p id="bulk-confirm-desc" style={{ margin: "0 0 20px", color: "rgba(0,56,101,0.72)", lineHeight: 1.55 }}>
              Thao tác sẽ áp dụng cho chính xác {selectedConvIds.size} hội thoại đã chọn trên trang hiện tại.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                autoFocus
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkSubmitting}
                style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.2)", background: "#fff", color: NAVY, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={() => { void handleBulkClose(); }}
                disabled={bulkSubmitting}
                style={{ padding: "9px 14px", borderRadius: "8px", border: "none", background: "#ED5206", color: "#fff", fontWeight: 700, cursor: bulkSubmitting ? "not-allowed" : "pointer" }}
              >
                {bulkSubmitting ? "Đang xử lý..." : `Xác nhận xử lý ${selectedConvIds.size} hội thoại`}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
