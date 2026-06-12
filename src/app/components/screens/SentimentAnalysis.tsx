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
import { Heart, Meh, Frown, TrendingUp, AlertTriangle, Lightbulb, Star } from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { fetchApiJson, buildApiUrl } from "../../services/dashboardApi";

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
    { name: "Tích cực", value: 64, color: "#3E9675" },
    { name: "Trung lập", value: 22, color: "#E5A850" },
    { name: "Tiêu cực", value: 14, color: "#D26767" },
  ]);
  const [negKeywords, setNegKeywords] = useState<any[]>([]);
  const [negativeConversations, setNegativeConversations] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        const dates = getDatesFromRange(filters.dateRange, filters.customDateFrom, filters.customDateTo);
        if (dates.startDate && dates.endDate) {
          queryParams.set("startDate", dates.startDate);
          queryParams.set("endDate", dates.endDate);
        }

        const [sumRes, trendRes, topicRes, kwRes, convRes] = await Promise.all([
          fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-summary", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/sentiment-trend", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/topics", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/negative-keywords", queryParams.toString())),
          fetchApiJson<any>(buildApiUrl("/api/analytics/negative-conversations", queryParams.toString()))
        ]);

        if (sumRes.success) {
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
        
        if (trendRes.success) {
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

        if (topicRes.success) {
          const rawTopic = Array.isArray(topicRes.data) ? topicRes.data : [];
          setTopicSentiment(rawTopic.slice(0, 10).map(d => {
            const total = d.count || 1;
            const pos = d.positive !== undefined ? Math.round((d.positive / total) * 100) : 33;
            const neu = d.neutral !== undefined ? Math.round((d.neutral / total) * 100) : 33;
            const neg = d.negative !== undefined ? Math.round((d.negative / total) * 100) : 34;
            return {
              topic: d.topicLabel || "Chung",
              positive: pos,
              neutral: neu,
              negative: neg
            };
          }));
        }

        if (kwRes.success) {
          const rawKw = Array.isArray(kwRes.data) ? kwRes.data : [];
          setNegKeywords(rawKw.slice(0, 10).map(d => ({
            word: d.keyword,
            count: d.count,
            topic: d.issueType || "Chung"
          })));
        }

        if (convRes.success) {
          const rawConv = Array.isArray(convRes.data?.records) ? convRes.data.records : [];
          setNegativeConversations(rawConv.map(conv => {
            const waitTimeRaw = Date.now() - new Date(conv.messageAt).getTime();
            const waitHours = Math.floor(waitTimeRaw / (1000 * 60 * 60));
            const waitMins = Math.floor((waitTimeRaw / (1000 * 60)) % 60);
            const waitTimeStr = !isNaN(waitHours) && waitHours > 0 ? `${waitHours}g ${waitMins}p` : !isNaN(waitMins) ? `${waitMins}p` : "0p";
            const levelStr = conv.sentimentScore < 0.3 ? "Rất tiêu cực" : conv.sentimentScore < 0.6 ? "Tiêu cực" : "Hơi tiêu cực";
            return {
              id: `#${conv.messageId || conv.id_webchat_messagelogs || "N/A"}`,
              customer: conv.customerId || "Khách hàng",
              complaint: conv.textContent || "",
              topic: Array.isArray(conv.detectedTopics) && conv.detectedTopics.length > 0 ? conv.detectedTopics.join(", ") : (conv.detectedTopics || "Chung"),
              channel: conv.source || "Unknown",
              level: levelStr as NegLevel,
              waitTime: waitTimeStr,
              status: conv.needStaffReview ? "Cần xử lý" : "Chờ xử lý"
            };
          }));
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu cảm xúc:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filters]);

  const posPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.positive / summaryData.summary.total) * 100) + "%" : "0%";
  const neuPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.neutral / summaryData.summary.total) * 100) + "%" : "0%";
  const negPctStr = summaryData?.summary?.total ? Math.round((summaryData.summary.negative / summaryData.summary.total) * 100) + "%" : "0%";
  const satisfactionValue = summaryData?.avgSatisfaction ? (summaryData.avgSatisfaction > 5 ? summaryData.avgSatisfaction / 20 : summaryData.avgSatisfaction) : 0;
  const satisfactionStr = satisfactionValue > 0 ? satisfactionValue.toFixed(1) + "/5" : "0/5";

  const dynamicTopicData = topicSentiment && topicSentiment.length > 0 ? topicSentiment : [
    { topic: "Khác", positive: 33, neutral: 33, negative: 34 },
    { topic: "Lịch thi", positive: 33, neutral: 33, negative: 34 },
    { topic: "Hồ sơ / Biểu mẫu", positive: 33, neutral: 33, negative: 34 },
    { topic: "Tin học / MOS / IC3", positive: 33, neutral: 33, negative: 34 },
    { topic: "TOEIC", positive: 33, neutral: 33, negative: 34 },
    { topic: "Đăng ký thi", positive: 33, neutral: 33, negative: 34 },
    { topic: "Lệ phí / Học phí", positive: 33, neutral: 33, negative: 34 },
    { topic: "VSTEP", positive: 33, neutral: 33, negative: 34 },
    { topic: "Liên hệ tư vấn", positive: 33, neutral: 33, negative: 34 },
  ];

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: Heart, label: "Tỷ lệ tích cực", value: posPctStr, change: "+3%", color: "#228A61", bg: "#f0fdf4", trend: "+2.1% so với tuần trước" },
          { icon: Meh, label: "Tỷ lệ trung lập", value: neuPctStr, change: "0%", color: "#f59e0b", bg: "#fffbeb", trend: "Ổn định" },
          { icon: Frown, label: "Tỷ lệ tiêu cực", value: negPctStr, change: "-2%", color: ORANGE, bg: "#fff5f5", trend: "-1.8% so với tuần trước" },
          { icon: Star, label: "Mức độ hài lòng", value: satisfactionStr, change: "+0.2", color: "#a855f7", bg: "#faf5ff", trend: "Tăng so với tháng trước" },
        ].map(({ icon: Icon, label, value, change, color, bg, trend }) => (
          <div key={label} style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={22} style={{ color }} />
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
            
            const ChartComponent = chartType === "area" ? AreaChart : LineChart;
            const SeriesComponent = chartType === "area" ? Area : Line;
            
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
            
            const ChartComponent = chartType === "area" ? AreaChart : LineChart;
            const SeriesComponent = chartType === "area" ? Area : Line;
            
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
            
            const ChartComponent = chartType === "area" ? AreaChart : LineChart;
            const SeriesComponent = chartType === "area" ? Area : Line;
            
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

      {/* Negative Conversations Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Frown size={16} style={{ color: ORANGE }} />
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại có cảm xúc tiêu cực cần xử lý</h3>
            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: "#FFF4EE", border: "1px solid #FBCBB8", color: ORANGE, fontWeight: 600 }}>{negativeConversations.length} hội thoại</span>
          </div>
          <button
            onClick={() => {
              setNegativeConversations(prev => prev.map(c => ({ ...c, status: "Đã xử lý" })));
              toast.success("Đã đánh dấu xử lý toàn bộ danh sách");
            }}
            style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: `linear-gradient(135deg, #ED5206 0%, #F36C2E 100%)`, color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, boxShadow: "0 4px 12px rgba(237,82,6,0.18)" }}
          >
            Đánh dấu xử lý (tất cả)
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Khách hàng", "Nội dung phàn nàn", "Chủ đề", "Kênh", "Mức độ tiêu cực", "Thời gian chờ", "Trạng thái", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {negativeConversations.map((conv) => {
                const lc = negLevelConfig[conv.level];
                const sc = statusConfig[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
                return (
                  <tr key={conv.id}
                    style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fafbfc"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: NAVY, fontSize: "12px" }}>{conv.customer}</div>
                      <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.4)", fontFamily: "monospace", marginTop: "2px" }}>{conv.id}</div>
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
                            onClick={() => {
                              setNegativeConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: "Đã xử lý" } : c));
                              toast.success(`Đã đánh dấu xử lý ${conv.id}`);
                            }}
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

      {/* Keywords & AI */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "20px" }}>
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
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            {
              icon: TrendingUp,
              title: "Dự báo xu hướng cảm xúc",
              color: NAVY,
              content: "Sentiment tiêu cực có thể tăng 3-5% trong tuần tới do gần deadline đăng ký thi. Đặc biệt topic 'Lệ phí' và 'Tra cứu điểm' cần quan tâm.",
            },
            {
              icon: Lightbulb,
              title: "Khuyến nghị cải thiện",
              color: "#228A61",
              items: ["Cải thiện tốc độ tra cứu điểm thi", "Thêm FAQ cho topic Lệ phí", "Tăng độ chính xác trả lời về Lịch thi", "Bổ sung chính sách giảm giá học sinh vào cơ sở tri thức"],
            },
          ].map(({ icon: Icon, title, color, content, items }) => (
            <div key={title} style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", padding: "20px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>{title}</span>
              </div>
              {content && <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.7)", lineHeight: 1.6, margin: 0 }}>{content}</p>}
              {items && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", fontSize: "13px", color: "rgba(0,56,101,0.75)" }}>
                      <span style={{ color, fontWeight: 700 }}>•</span> {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
