import { useState } from "react";
import { MessageSquare, TrendingUp, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY = "#003BB9";
const ORANGE = "#D73C01";
const GREEN = "#228A61";

const channelData = [
  { channel: "Zalo Business", total: 420, unresolved: 58, ai_ok: 372, ai_fail: 48, avg_time: 4.2, satisfaction: 89, negative: 32 },
  { channel: "Facebook", total: 310, unresolved: 42, ai_ok: 265, ai_fail: 45, avg_time: 5.8, satisfaction: 84, negative: 41 },
  { channel: "Zalo OA", total: 280, unresolved: 31, ai_ok: 249, ai_fail: 31, avg_time: 3.5, satisfaction: 92, negative: 18 },
  { channel: "Chat Widget", total: 140, unresolved: 29, ai_ok: 112, ai_fail: 28, avg_time: 6.1, satisfaction: 81, negative: 24 },
];

const channelTrend = [
  { date: "T2", "Zalo Business": 58, Facebook: 42, "Zalo OA": 38, "Chat Widget": 18 },
  { date: "T3", "Zalo Business": 65, Facebook: 48, "Zalo OA": 42, "Chat Widget": 22 },
  { date: "T4", "Zalo Business": 72, Facebook: 54, "Zalo OA": 45, "Chat Widget": 25 },
  { date: "T5", "Zalo Business": 68, Facebook: 50, "Zalo OA": 48, "Chat Widget": 20 },
  { date: "T6", "Zalo Business": 82, Facebook: 61, "Zalo OA": 52, "Chat Widget": 28 },
  { date: "T7", "Zalo Business": 78, Facebook: 58, "Zalo OA": 49, "Chat Widget": 26 },
  { date: "CN", "Zalo Business": 55, Facebook: 40, "Zalo OA": 35, "Chat Widget": 18 },
];

const channelStatusData = [
  { channel: "Zalo Business", "Chờ xử lý": 58, "Đang xử lý": 124, "Chờ quản lý xác nhận": 38, "Hoàn thành": 200 },
  { channel: "Facebook", "Chờ xử lý": 42, "Đang xử lý": 89, "Chờ quản lý xác nhận": 31, "Hoàn thành": 148 },
  { channel: "Zalo OA", "Chờ xử lý": 31, "Đang xử lý": 72, "Chờ quản lý xác nhận": 22, "Hoàn thành": 155 },
  { channel: "Chat Widget", "Chờ xử lý": 29, "Đang xử lý": 38, "Chờ quản lý xác nhận": 18, "Hoàn thành": 55 },
];

const allTopics = ["TOEIC", "VSTEP", "Chuẩn đầu ra", "Tin học", "MOS/IC3", "Lệ phí", "Lịch thi", "Tra cứu điểm"];
const allChannels = ["Zalo Business", "Facebook", "Zalo OA", "Chat Widget"];

const heatmapData: { channel: string; topic: string; value: number }[] = [
  { channel: "Zalo Business", topic: "TOEIC", value: 8 },
  { channel: "Zalo Business", topic: "VSTEP", value: 14 },
  { channel: "Zalo Business", topic: "Chuẩn đầu ra", value: 6 },
  { channel: "Zalo Business", topic: "Tin học", value: 4 },
  { channel: "Zalo Business", topic: "MOS/IC3", value: 5 },
  { channel: "Zalo Business", topic: "Lệ phí", value: 11 },
  { channel: "Zalo Business", topic: "Lịch thi", value: 9 },
  { channel: "Zalo Business", topic: "Tra cứu điểm", value: 3 },
  { channel: "Facebook", topic: "TOEIC", value: 11 },
  { channel: "Facebook", topic: "VSTEP", value: 9 },
  { channel: "Facebook", topic: "Chuẩn đầu ra", value: 7 },
  { channel: "Facebook", topic: "Tin học", value: 3 },
  { channel: "Facebook", topic: "MOS/IC3", value: 4 },
  { channel: "Facebook", topic: "Lệ phí", value: 13 },
  { channel: "Facebook", topic: "Lịch thi", value: 8 },
  { channel: "Facebook", topic: "Tra cứu điểm", value: 6 },
  { channel: "Zalo OA", topic: "TOEIC", value: 6 },
  { channel: "Zalo OA", topic: "VSTEP", value: 7 },
  { channel: "Zalo OA", topic: "Chuẩn đầu ra", value: 4 },
  { channel: "Zalo OA", topic: "Tin học", value: 2 },
  { channel: "Zalo OA", topic: "MOS/IC3", value: 3 },
  { channel: "Zalo OA", topic: "Lệ phí", value: 5 },
  { channel: "Zalo OA", topic: "Lịch thi", value: 9 },
  { channel: "Zalo OA", topic: "Tra cứu điểm", value: 4 },
  { channel: "Chat Widget", topic: "TOEIC", value: 7 },
  { channel: "Chat Widget", topic: "VSTEP", value: 5 },
  { channel: "Chat Widget", topic: "Chuẩn đầu ra", value: 3 },
  { channel: "Chat Widget", topic: "Tin học", value: 6 },
  { channel: "Chat Widget", topic: "MOS/IC3", value: 2 },
  { channel: "Chat Widget", topic: "Lệ phí", value: 8 },
  { channel: "Chat Widget", topic: "Lịch thi", value: 6 },
  { channel: "Chat Widget", topic: "Tra cứu điểm", value: 9 },
];

// Navy family for multi-channel charts
const CHANNEL_COLORS: Record<string, string> = {
  "Zalo Business": "#003865",
  Facebook: "#1565C0",
  "Zalo OA": "#42A5F5",
  "Chat Widget": "#7BB6FF",
};

const PIE_COLORS = ["#003865", "#1565C0", "#42A5F5", "#7BB6FF"];

// Ocean Blue heatmap gradient: low → high
function getHeatColor(value: number): string {
  if (value === 0) return "#EBF2FF";
  if (value <= 3) return "#B8D8FF";
  if (value <= 7) return "#7BB6FF";
  if (value <= 11) return "#1565C0";
  return "#003865";
}

function getHeatTextColor(value: number): string {
  return value >= 4 ? "#fff" : "#003865";
}

interface ChannelAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function ChannelAnalysis({ filters, onFiltersChange, onNavigate }: ChannelAnalysisProps) {
  const [heatmapChannelFilter, setHeatmapChannelFilter] = useState("Tất cả");
  const [heatmapTopicFilter, setHeatmapTopicFilter] = useState("Tất cả");

  const visibleChannels = heatmapChannelFilter === "Tất cả" ? allChannels : [heatmapChannelFilter];
  const visibleTopics = heatmapTopicFilter === "Tất cả" ? allTopics : [heatmapTopicFilter];

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Section Label */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Phân tích theo kênh</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Phân tích câu hỏi, chủ đề và lỗi AI theo từng kênh</p>
      </div>

      {/* Channel Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "24px" }}>
        {channelData.map((ch) => (
          <div
            key={ch.channel}
            style={{
              backgroundColor: "#fff",
              borderRadius: "20px",
              border: "1px solid rgba(0,56,101,0.08)",
              boxShadow: "0 2px 12px rgba(0,56,101,0.06)",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,56,101,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,56,101,0.06)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: CHANNEL_COLORS[ch.channel] }} />
              <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>{ch.channel}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { icon: MessageSquare, label: "Hội thoại", value: ch.total, color: NAVY },
                { icon: AlertTriangle, label: "Chờ xử lý", value: ch.unresolved, color: ORANGE },
                { icon: CheckCircle, label: "AI thành công", value: `${Math.round((ch.ai_ok / ch.total) * 100)}%`, color: GREEN },
                { icon: Clock, label: "Phản hồi TB", value: `${ch.avg_time} phút`, color: "#d97706" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "10px 8px", borderRadius: "10px", backgroundColor: "#f8fafc" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.45)", marginTop: "2px" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <ChartCard title="Xu hướng hội thoại theo kênh (7 ngày qua)" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={channelTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Line type="monotone" dataKey="Zalo Business" stroke={CHANNEL_COLORS["Zalo Business"]} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Facebook" stroke={CHANNEL_COLORS["Facebook"]} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Zalo OA" stroke={CHANNEL_COLORS["Zalo OA"]} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Chat Widget" stroke={CHANNEL_COLORS["Chat Widget"]} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Phân bổ hội thoại theo kênh" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={channelData.map(c => ({ name: c.channel, value: c.total }))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {channelData.map((entry, i) => <Cell key={`channel-pie-${entry.channel}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: "11px" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2: Stacked Status + AI Fail */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <ChartCard title="Trạng thái xử lý theo kênh" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={channelStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Bar dataKey="Chờ xử lý" stackId="a" fill={ORANGE} />
              <Bar dataKey="Đang xử lý" stackId="a" fill="#42A5F5" />
              <Bar dataKey="Chờ quản lý xác nhận" stackId="a" fill="#d97706" />
              <Bar dataKey="Hoàn thành" stackId="a" fill={GREEN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="So sánh AI thành công / thất bại theo kênh" onOpenBuilder={() => onNavigate("chartbuilder")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="channel" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Bar dataKey="ai_ok" name="AI thành công" fill={NAVY} radius={[4, 4, 0, 0]} />
              <Bar dataKey="ai_fail" name="AI thất bại" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Heatmap: AI fail by channel + topic — Ocean Blue */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Heatmap: AI thất bại theo kênh × chủ đề</h3>
            <p style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", margin: "2px 0 0" }}>Số câu hỏi AI không xử lý được — màu đậm hơn = tần suất cao hơn</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Channel filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.04em" }}>KÊNH</label>
              <select
                value={heatmapChannelFilter}
                onChange={(e) => setHeatmapChannelFilter(e.target.value)}
                style={{ padding: "5px 24px 5px 8px", borderRadius: "7px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, backgroundColor: "#fff", cursor: "pointer", outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23003865' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
              >
                <option value="Tất cả">Tất cả kênh</option>
                {allChannels.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* Topic filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10px", fontWeight: 600, color: "rgba(0,56,101,0.5)", letterSpacing: "0.04em" }}>CHỦ ĐỀ</label>
              <select
                value={heatmapTopicFilter}
                onChange={(e) => setHeatmapTopicFilter(e.target.value)}
                style={{ padding: "5px 24px 5px 8px", borderRadius: "7px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, backgroundColor: "#fff", cursor: "pointer", outline: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23003865' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
              >
                <option value="Tất cả">Tất cả chủ đề</option>
                {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              onClick={() => toast.info("Đang mở trong Trình tạo biểu đồ...")}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "11px", alignSelf: "flex-end" }}
            >
              Mở Trình tạo biểu đồ
            </button>
          </div>
        </div>
        <div style={{ padding: "20px", overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 16px", textAlign: "left", color: "rgba(0,56,101,0.5)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", minWidth: "110px" }}>KÊNH / CHỦ ĐỀ</th>
                {visibleTopics.map((t) => (
                  <th key={t} style={{ padding: "8px 12px", textAlign: "center", color: "rgba(0,56,101,0.6)", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleChannels.map((ch) => (
                <tr key={ch}>
                  <td style={{ padding: "8px 16px", color: NAVY, fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: CHANNEL_COLORS[ch] }} />
                      {ch}
                    </div>
                  </td>
                  {visibleTopics.map((topic) => {
                    const cell = heatmapData.find((d) => d.channel === ch && d.topic === topic);
                    const val = cell?.value ?? 0;
                    const bg = getHeatColor(val);
                    const textColor = getHeatTextColor(val);
                    return (
                      <td key={`${ch}-${topic}`} style={{ padding: "4px 6px", textAlign: "center" }}>
                        <div
                          style={{
                            width: "48px",
                            height: "36px",
                            borderRadius: "8px",
                            backgroundColor: bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: textColor,
                            margin: "0 auto",
                            cursor: "pointer",
                            transition: "opacity 0.15s",
                          }}
                          title={`${ch} × ${topic}: ${val} lỗi`}
                          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.opacity = "0.8"}
                          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.opacity = "1"}
                        >
                          {val}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px" }}>
            <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)" }}>Mức độ:</span>
            {[
              { label: "0 (thấp nhất)", color: "#EBF2FF", text: "#003865" },
              { label: "1–3", color: "#B8D8FF", text: "#003865" },
              { label: "4–7", color: "#7BB6FF", text: "#fff" },
              { label: "8–11", color: "#1565C0", text: "#fff" },
              { label: "≥12 (cao nhất)", color: "#003865", text: "#fff" },
            ].map(({ label, color, text }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "3px", backgroundColor: color, border: "1px solid rgba(0,56,101,0.1)" }} />
                <span style={{ fontSize: "10px", color: "rgba(0,56,101,0.6)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Channel Detail Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
          <h3 style={{ color: NAVY, fontSize: "14px", fontWeight: 700, margin: 0 }}>Chi tiết theo kênh</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                {["Kênh", "Tổng hội thoại", "Chờ xử lý", "T/g phản hồi TB", "AI thất bại", "Cảm xúc tiêu cực", "Mức hài lòng", "Hành động"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.5)", fontSize: "10px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelData.map((ch) => (
                <tr key={ch.channel}
                  style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: CHANNEL_COLORS[ch.channel] }} />
                      <span style={{ fontWeight: 600, color: NAVY }}>{ch.channel}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: NAVY }}>{ch.total}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ color: ORANGE, fontWeight: 700 }}>{ch.unresolved}</span>
                    <span style={{ color: "rgba(0,56,101,0.4)", fontSize: "10px", marginLeft: "4px" }}>({Math.round(ch.unresolved / ch.total * 100)}%)</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: ch.avg_time > 5 ? ORANGE : GREEN, fontWeight: 600 }}>{ch.avg_time} phút</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ color: ORANGE, fontWeight: 700 }}>{ch.ai_fail}</span>
                    <span style={{ color: "rgba(0,56,101,0.4)", fontSize: "10px", marginLeft: "4px" }}>({Math.round(ch.ai_fail / ch.total * 100)}%)</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ color: ch.negative > 30 ? ORANGE : "#d97706", fontWeight: 600 }}>{ch.negative}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "50px", height: "5px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${ch.satisfaction}%`, backgroundColor: ch.satisfaction >= 90 ? GREEN : "#d97706", borderRadius: "3px" }} />
                      </div>
                      <span style={{ fontSize: "11px", color: ch.satisfaction >= 90 ? GREEN : "#d97706", fontWeight: 600 }}>{ch.satisfaction}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => {
                        onFiltersChange({ ...filters, channel: ch.channel });
                        toast.info(`Đã lọc chi tiết theo kênh: ${ch.channel}`);
                      }}
                      style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid rgba(0,56,101,0.12)", background: "#f8fafc", color: NAVY, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
