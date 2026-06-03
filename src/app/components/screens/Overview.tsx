import { useState } from "react";
import {
  MessageSquare, MessageCircle, Clock, CheckCircle, XCircle, AlertTriangle,
  Users, TrendingUp, TrendingDown, Eye, Flag, Plus, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { KPICard } from "../KPICard";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY = "#003BB9";
const ORANGE = "#D73C01";

function viNum(n: number) {
  return n.toLocaleString("vi-VN");
}

const trendData = [
  { date: "20/1", total: 320, processed: 285, unprocessed: 35, ai_ok: 270, ai_fail: 50 },
  { date: "21/1", total: 410, processed: 360, unprocessed: 50, ai_ok: 340, ai_fail: 70 },
  { date: "22/1", total: 380, processed: 328, unprocessed: 52, ai_ok: 305, ai_fail: 75 },
  { date: "23/1", total: 520, processed: 455, unprocessed: 65, ai_ok: 430, ai_fail: 90 },
  { date: "24/1", total: 490, processed: 432, unprocessed: 58, ai_ok: 405, ai_fail: 85 },
  { date: "25/1", total: 610, processed: 540, unprocessed: 70, ai_ok: 512, ai_fail: 98 },
  { date: "26/1", total: 580, processed: 515, unprocessed: 65, ai_ok: 490, ai_fail: 90 },
];

const forecastData = [
  ...trendData,
  { date: "27/1", total: 620, processed: null, unprocessed: null, ai_ok: null, ai_fail: null, forecast: 620 },
  { date: "28/1", total: null, processed: null, unprocessed: null, ai_ok: null, ai_fail: null, forecast: 680 },
  { date: "29/1", total: null, processed: null, unprocessed: null, ai_ok: null, ai_fail: null, forecast: 720 },
  { date: "30/1", total: null, processed: null, unprocessed: null, ai_ok: null, ai_fail: null, forecast: 750 },
];

const channelData = [
  { name: "Zalo Business", hoiday: 1321, tinNhan: 22931 },
  { name: "Facebook", hoiday: 1143, tinNhan: 16845 },
  { name: "Zalo OA", hoiday: 404, tinNhan: 4085 },
  { name: "Chat Widget", hoiday: 38, tinNhan: 193 },
];

const COLORS = [NAVY, "#1565C0", "#42A5F5", "#7BB6FF"];

const topicData = [
  { name: "TOEIC", value: 420 },
  { name: "VSTEP", value: 280 },
  { name: "Chuẩn đầu ra", value: 350 },
  { name: "Tin học", value: 190 },
  { name: "Lịch thi", value: 380 },
  { name: "Lệ phí", value: 310 },
];
const TOPIC_COLORS = [NAVY, "#1565C0", "#42A5F5", "#0288D1", "#7BB6FF", ORANGE];

const urgentAlerts = [
  {
    id: 1,
    type: "overtime",
    priority: "Ưu tiên cao",
    title: "Hội thoại chờ quá 10 giờ",
    customer: "Nguyễn Văn A",
    channel: "Facebook",
    topic: "TOEIC",
    waitTime: "12 giờ 34 phút",
    desc: "Khách hỏi lệ phí thi TOEIC, chatbot trả lời không đủ thông tin",
  },
  {
    id: 2,
    type: "ai_uncertain",
    priority: "Ưu tiên cao",
    title: "AI không chắc chắn",
    customer: "Trần Thị B",
    channel: "Zalo OA",
    topic: "Chuẩn đầu ra",
    waitTime: "3 giờ 15 phút",
    desc: "Câu hỏi về điều kiện miễn chuẩn đầu ra — Độ tin cậy: 32%",
  },
  {
    id: 3,
    type: "ai_no_data",
    priority: "Ưu tiên cao",
    title: "AI không tìm thấy dữ liệu",
    customer: "Lê Văn C",
    channel: "Chat Widget",
    topic: "MOS/IC3",
    waitTime: "1 giờ 50 phút",
    desc: "Câu hỏi về lịch thi IC3 2025 — không có trong cơ sở tri thức",
  },
  {
    id: 4,
    type: "spike",
    priority: "Ưu tiên trung bình",
    title: "Chủ đề tăng đột biến",
    customer: "—",
    channel: "Tất cả",
    topic: "VSTEP",
    waitTime: "—",
    desc: "+156% câu hỏi về VSTEP trong 2 giờ qua — có thể do thông báo lịch thi mới",
  },
  {
    id: 5,
    type: "negative",
    priority: "Ưu tiên trung bình",
    title: "Cảm xúc tiêu cực",
    customer: "Phạm Thị D",
    channel: "Zalo Business",
    topic: "Lịch thi",
    waitTime: "45 phút",
    desc: '"Chatbot trả lời không đúng thông tin lịch thi, tôi hỏi 3 lần rồi"',
  },
  {
    id: 6,
    type: "admin",
    priority: "Ưu tiên trung bình",
    title: "Chờ quản lý xác nhận",
    customer: "Hoàng Văn E",
    channel: "Facebook",
    topic: "Lệ phí thi",
    waitTime: "2 giờ 10 phút",
    desc: "Câu hỏi về học bổng miễn lệ phí — cần quản lý xác nhận chính sách",
  },
];

const alertTypeIcon: Record<string, typeof AlertTriangle> = {
  overtime: Clock,
  ai_uncertain: AlertTriangle,
  ai_no_data: XCircle,
  spike: TrendingUp,
  negative: Users,
  admin: Users,
};

const topQuestions = [
  { question: "Lịch thi VSTEP tháng này khi nào?", topic: "VSTEP", count: 234, channel: "Zalo OA", trend: 28 },
  { question: "Lệ phí thi TOEIC hiện tại là bao nhiêu?", topic: "TOEIC", count: 198, channel: "Facebook", trend: -12 },
  { question: "Chuẩn đầu ra ngoại ngữ cần chứng chỉ gì?", topic: "Chuẩn đầu ra", count: 178, channel: "Chat Widget", trend: 19 },
  { question: "Đăng ký thi CNTT nhóm trên 3 bạn thế nào?", topic: "CNTT Cơ bản", count: 145, channel: "Zalo Business", trend: -31 },
  { question: "Bao lâu có kết quả thi?", topic: "Tra cứu điểm", count: 132, channel: "Facebook", trend: 8 },
  { question: "Hồ sơ đăng ký thi CNTT cần những gì?", topic: "CNTT Nâng cao", count: 121, channel: "Chat Widget", trend: -41 },
];

const priorityConversations = [
  { id: "HT-2451", customer: "Sinh viên A", channel: "Facebook", topic: "TOEIC", wait: "12 giờ 34 phút", status: "Chờ quản lý xác nhận", priority: "Ưu tiên cao", isOvertime: true },
  { id: "HT-2449", customer: "Sinh viên B", channel: "Zalo OA", topic: "VSTEP", wait: "3 giờ 15 phút", status: "Chờ xử lý", priority: "Ưu tiên cao", isOvertime: false },
  { id: "HT-2445", customer: "Sinh viên C", channel: "Chat Widget", topic: "Chuẩn đầu ra", wait: "1 giờ 50 phút", status: "Đang xử lý", priority: "Ưu tiên trung bình", isOvertime: false },
  { id: "HT-2440", customer: "Sinh viên D", channel: "Zalo Business", topic: "Lịch thi", wait: "45 phút", status: "Chờ xử lý", priority: "Ưu tiên trung bình", isOvertime: false },
  { id: "HT-2438", customer: "Sinh viên E", channel: "Facebook", topic: "Lệ phí thi", wait: "2 giờ 10 phút", status: "Chờ quản lý xác nhận", priority: "Ưu tiên thấp", isOvertime: false },
];

const statusColors: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: "#FFF4EE", color: "#D73C01" },
  "Chờ xử lý":            { bg: "#FFF7E6", color: "#B7791F" },
  "Đang xử lý":          { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành":           { bg: "#EAF8F1", color: "#228A61" },
};

const priorityColors: Record<string, { bg: string; color: string; border: string }> = {
  "Ưu tiên cao":         { bg: "#FFF4EE", color: "#D73C01", border: "#FBCBB8" },
  "Ưu tiên trung bình": { bg: "#FFF7E6", color: "#B7791F", border: "#FADFA8" },
  "Ưu tiên thấp":        { bg: "#EAF8F1", color: "#228A61", border: "#BFEAD3" },
};

function SkeletonBlock({ w = "100%", h = "40px", radius = "10px" }: { w?: string; h?: string; radius?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

interface OverviewProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (screen: string) => void;
  isRefreshing?: boolean;
  lastUpdated?: string;
  onManualRefresh?: () => void;
}

export function Overview({ filters, onFiltersChange, onNavigate, isRefreshing, lastUpdated, onManualRefresh }: OverviewProps) {
  const mult = filters.dateRange === "Hôm nay" ? 0.08 : filters.dateRange === "7 ngày qua" ? 0.23 : filters.dateRange === "Tháng này" || filters.dateRange === "30 ngày qua" ? 1 : filters.dateRange === "Quý này" ? 3 : 1;

  const dynamicTrendData = trendData.map(d => ({ ...d, total: Math.round(d.total * mult), processed: Math.round(d.processed * mult), unprocessed: Math.round(d.unprocessed * mult), ai_ok: Math.round(d.ai_ok * mult), ai_fail: Math.round(d.ai_fail * mult) }));
  const dynamicForecastData = forecastData.map(d => ({ ...d, total: d.total ? Math.round(d.total * mult) : null, processed: d.processed ? Math.round(d.processed * mult) : null, unprocessed: d.unprocessed ? Math.round(d.unprocessed * mult) : null, ai_ok: d.ai_ok ? Math.round(d.ai_ok * mult) : null, ai_fail: d.ai_fail ? Math.round(d.ai_fail * mult) : null, forecast: d.forecast ? Math.round(d.forecast * mult) : null }));
  const dynamicChannelData = channelData.map(d => ({ ...d, hoiday: Math.round(d.hoiday * mult), tinNhan: Math.round(d.tinNhan * mult) }));
  const dynamicTopicData = topicData.map(d => ({ ...d, value: Math.round(d.value * mult) }));

  const kpis = [
    { title: "Tổng hội thoại", value: viNum(Math.round(2907 * mult)), change: 12, icon: MessageSquare, isWarning: false },
    { title: "Tổng tin nhắn", value: viNum(Math.round(44545 * mult)), change: 8, icon: MessageCircle, isWarning: false },
    { title: "Chờ xử lý", value: viNum(Math.round(1469 * mult)), change: 18, icon: AlertTriangle, isWarning: true },
    { title: "Đã xử lý", value: viNum(Math.round(1438 * mult)), change: 11, icon: CheckCircle, isWarning: false },
    { title: "AI trả lời thất bại", value: viNum(Math.round(215 * mult)), change: 15, icon: XCircle, isWarning: true },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Section Label */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Tổng quan hệ thống</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,62,154,0.5)", marginLeft: "14px", marginTop: "4px" }}>Theo dõi hoạt động WebChat CSKH và chất lượng chatbot AI</p>
      </div>

      {/* Live indicator + refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#228A61", animation: "glowPulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "12px", color: "#228A61", fontWeight: 600 }}>Trực tiếp</span>
          </div>
          <span style={{ fontSize: "12px", color: "rgba(0,62,154,0.5)" }}>Cập nhật gần nhất: {lastUpdated ?? "--:--"} hôm nay</span>
          <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.35)" }}>· Tự động cập nhật mỗi 30 phút</span>
          <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.3)" }}>· Dữ liệu: 12/10/2025 – 17/05/2026</span>
          {isRefreshing && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <RefreshCw size={12} style={{ color: ORANGE, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "11px", color: ORANGE, fontWeight: 600 }}>Đang cập nhật...</span>
            </div>
          )}
        </div>
        {onManualRefresh && (
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${NAVY}20`, background: "#fff", color: NAVY, cursor: isRefreshing ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", opacity: isRefreshing ? 0.6 : 1, flexShrink: 0 }}
          >
            <RefreshCw size={12} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} /> Làm mới
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {kpis.map((kpi) =>
          isRefreshing ? (
            <div key={kpi.title} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,62,154,0.07)" }}>
              <SkeletonBlock h="40px" w="40px" radius="10px" />
              <div style={{ marginTop: "14px" }}><SkeletonBlock h="26px" w="55%" /></div>
              <div style={{ marginTop: "6px" }}><SkeletonBlock h="12px" w="75%" /></div>
            </div>
          ) : (
            <KPICard key={kpi.title} title={kpi.title} value={kpi.value} change={kpi.change} icon={kpi.icon} isWarning={kpi.isWarning} />
          )
        )}
      </div>

      {/* Cần xử lý ngay */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h2 style={{ color: NAVY, fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <AlertTriangle size={16} style={{ color: ORANGE }} />
            Cần xử lý ngay
            <span style={{ fontSize: "11px", backgroundColor: "#FFF4EE", color: ORANGE, border: "1px solid #FBCBB8", borderRadius: "20px", padding: "2px 8px", fontWeight: 700 }}>{urgentAlerts.length}</span>
          </h2>
          {/* Nút Xem tất cả hội thoại đã ẩn */}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          {urgentAlerts.map((alert) => {
            const isHigh = alert.priority === "Ưu tiên cao";
            const Icon = alertTypeIcon[alert.type] || AlertTriangle;
            return (
              <div
                key={alert.id}
                style={{
                  padding: "15px 18px",
                  borderRadius: "12px",
                  backgroundColor: "#fff",
                  border: "1px solid rgba(0,62,154,0.08)",
                  borderLeft: isHigh ? `3px solid ${ORANGE}` : `3px solid #f59e0b`,
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,62,154,0.1)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <Icon size={14} style={{ color: isHigh ? ORANGE : "#d97706", flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: "13px", color: NAVY }}>{alert.title}</span>
                    <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: isHigh ? "#FFF4EE" : "#FFF7E6", color: isHigh ? ORANGE : "#B7791F", fontWeight: 700 }}>{alert.priority}</span>
                  </div>
                  {alert.waitTime !== "—" && (
                    <span style={{ fontSize: "11px", fontWeight: 600, color: isHigh ? ORANGE : "#B7791F", flexShrink: 0, marginLeft: "8px" }}>{alert.waitTime}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "5px", marginBottom: "7px", flexWrap: "wrap" }}>
                  {alert.customer !== "" && <span style={{ fontSize: "11px", color: NAVY, fontWeight: 500 }}>{alert.customer}</span>}
                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{alert.channel}</span>
                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,62,154,0.6)" }}>{alert.topic}</span>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(0,62,154,0.6)", marginBottom: "11px", lineHeight: 1.4 }}>{alert.desc}</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {/* Button "Xem" removed */}
                  <button onClick={() => toast.success("Đã đánh dấu cần xử lý")} style={{ padding: "4px 10px", borderRadius: "7px", border: `1px solid ${NAVY}15`, background: "#fff", color: "rgba(0,62,154,0.65)", cursor: "pointer", fontSize: "11px", fontWeight: 500, display: "flex", alignItems: "center", gap: "3px" }}>
                    <Flag size={10} /> Đánh dấu
                  </button>
                  <button onClick={() => toast.success("Đã đánh dấu xử lý")} style={{ padding: "4px 10px", borderRadius: "7px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                    <CheckCircle size={10} /> Xử lý
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <ChartCard title="Xu hướng hội thoại & Dự báo 7 ngày tới" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <ReferenceLine x="26/1" stroke="rgba(0,56,101,0.2)" strokeDasharray="4 4" label={{ value: "Hôm nay", fill: "rgba(0,56,101,0.4)", fontSize: 10 }} />
              <Line type="monotone" dataKey="total" name="Thực tế" stroke={NAVY} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="Dự báo" stroke={ORANGE} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: ORANGE }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Phân bổ theo kênh (hội thoại)" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="hoiday" nameKey="name">
                {channelData.map((entry, i) => <Cell key={`overview-ch-${entry.name}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => viNum(v)} />
              <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: "11px", color: NAVY }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Channel stats row */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", boxShadow: "0 2px 10px rgba(0,62,154,0.05)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,62,154,0.06)" }}>
          <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Thống kê theo kênh (12/10/2025 – 17/05/2026)</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {channelData.map((ch, i) => (
            <div key={ch.name} style={{ padding: "18px 22px", borderRight: i < 3 ? "1px solid rgba(0,62,154,0.06)" : "none" }}>
              <div style={{ fontSize: "11px", color: "rgba(0,62,154,0.5)", fontWeight: 500, marginBottom: "6px" }}>{ch.name}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "3px" }}>{viNum(ch.hoiday)}</div>
              <div style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>hội thoại</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(0,62,154,0.65)", marginTop: "5px" }}>{viNum(ch.tinNhan)}</div>
              <div style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>tin nhắn</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Questions */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", boxShadow: "0 2px 10px rgba(0,62,154,0.05)", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,62,154,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Câu hỏi nổi bật từ khách hàng</h3>
          <button onClick={() => onNavigate("question")} style={{ fontSize: "12px", color: NAVY, border: `1px solid ${NAVY}20`, background: "#f8fafc", padding: "5px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 500 }}>
            Xem toàn bộ
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["#", "Câu hỏi", "Chủ đề", "Số lần", "Kênh phổ biến", "Xu hướng", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,62,154,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,62,154,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topQuestions.map((q, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(0,62,154,0.04)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "12px 16px", color: "rgba(0,62,154,0.3)", fontWeight: 700, fontSize: "12px" }}>#{i + 1}</td>
                  <td style={{ padding: "12px 16px", color: NAVY, maxWidth: "280px" }}>{q.question}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{q.topic}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: NAVY }}>{q.count}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(0,62,154,0.6)", fontSize: "12px" }}>{q.channel}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {q.trend >= 0 ? (
                        <>
                          <TrendingUp size={12} style={{ color: "#228A61" }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#228A61" }}>+{q.trend}%</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown size={12} style={{ color: ORANGE }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: ORANGE }}>{q.trend}%</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => onNavigate("question")} style={{ padding: "4px 9px", borderRadius: "7px", border: `1px solid ${NAVY}20`, background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Eye size={10} /> Chi tiết
                      </button>
                      <button onClick={() => toast.success("Đã thêm vào FAQ đề xuất")} style={{ padding: "4px 9px", borderRadius: "7px", border: `1px solid ${NAVY}15`, background: "#fff", color: "rgba(0,62,154,0.65)", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Plus size={10} /> Thêm FAQ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Priority Conversations Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", boxShadow: "0 2px 10px rgba(0,62,154,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,62,154,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại ưu tiên xử lý</h3>
          {/* Nút Quản lý hội thoại đã ẩn */}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["ID", "Khách hàng", "Kênh", "Chủ đề", "Thời gian chờ", "Trạng thái", "Ưu tiên", "Hành động"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,62,154,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,62,154,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priorityConversations.map((conv) => {
                const ss = statusColors[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
                const pc = priorityColors[conv.priority];
                return (
                  <tr key={conv.id} style={{ borderBottom: "1px solid rgba(0,62,154,0.04)" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "12px 16px", color: "rgba(0,62,154,0.4)", fontFamily: "monospace", fontSize: "12px" }}>{conv.id}</td>
                    <td style={{ padding: "12px 16px", color: NAVY, fontWeight: 500 }}>{conv.customer}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6" }}>{conv.channel}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: NAVY }}>{conv.topic}</td>
                    <td style={{ padding: "12px 16px", color: conv.isOvertime ? ORANGE : "rgba(0,62,154,0.7)", fontWeight: conv.isOvertime ? 700 : 400, whiteSpace: "nowrap" }}>
                      {conv.isOvertime && <span style={{ marginRight: "4px" }}>⚠</span>}{conv.wait}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ss.bg, color: ss.color, fontWeight: 500, whiteSpace: "nowrap" }}>{conv.status}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>{conv.priority}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => toast.success("Đã đánh dấu xử lý")} style={{ padding: "4px 9px", borderRadius: "7px", border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                        <CheckCircle size={10} /> Xử lý
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
