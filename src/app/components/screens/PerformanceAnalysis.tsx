import { Zap, Clock, CheckCircle, TrendingDown, Star, MessageSquareMore, TimerReset, Target, FileWarning, FilePlus2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";

const NAVY      = "#003865";
const ORANGE    = "#D73C01";
const CTA       = "#ED5206";
const CTA_SOFT  = "#F36C2E";
const AMBER_TEXT = "#B7791F"; // softer amber for warnings
const AMBER_50   = "#FFF7E6";  // amber bg
const GREEN_SOFT = "#EAF8F1";
const RED_SOFT   = "#FFF1F1";
const RED_TEXT   = "#B42318";

const performanceTrend = [
  { date: "1/1", response_time: 2.8, resolve_rate: 88, ai_success: 87 },
  { date: "1/5", response_time: 2.4, resolve_rate: 91, ai_success: 89 },
  { date: "1/10", response_time: 3.1, resolve_rate: 86, ai_success: 85 },
  { date: "1/15", response_time: 2.2, resolve_rate: 93, ai_success: 92 },
  { date: "1/20", response_time: 2.6, resolve_rate: 90, ai_success: 88 },
  { date: "1/25", response_time: 2.9, resolve_rate: 87, ai_success: 86 },
  { date: "1/30", response_time: 2.3, resolve_rate: 92, ai_success: 91 },
];

const agentPerformance = [
  { name: "AI Bot", handled: 1113, resolved: 996, avg_time: 1.8, rating: 4.4 },
  { name: "Nhân viên CSKH 1", handled: 89, resolved: 81, avg_time: 8.5, rating: 4.7 },
  { name: "Nhân viên CSKH 2", handled: 67, resolved: 59, avg_time: 9.2, rating: 4.5 },
  { name: "Nhân viên CSKH 3", handled: 45, resolved: 38, avg_time: 12.1, rating: 4.2 },
];

const processingVolume = [
  { hour: "8h", volume: 45 },
  { hour: "9h", volume: 89 },
  { hour: "10h", volume: 134 },
  { hour: "11h", volume: 158 },
  { hour: "12h", volume: 112 },
  { hour: "13h", volume: 98 },
  { hour: "14h", volume: 145 },
  { hour: "15h", volume: 167 },
  { hour: "16h", volume: 189 },
  { hour: "17h", volume: 156 },
  { hour: "18h", volume: 98 },
  { hour: "19h", volume: 67 },
];

interface PerformanceAnalysisProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function PerformanceAnalysis({ filters, onFiltersChange, onNavigate }: PerformanceAnalysisProps) {
  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Section Label */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: 0 }}>Hiệu suất cá nhân</h2>
        </div>
        <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "14px", marginTop: "4px" }}>Theo dõi chất lượng phản hồi, thời gian xử lý và đánh giá hài lòng</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: TimerReset, label: "Thời gian phản hồi TB", value: "2 phút", change: "-12%", positiveDown: true },
          { icon: Target, label: "Tỷ lệ giải quyết", value: "91,2%", change: "+2,1%", positiveDown: false },
          { icon: Zap, label: "AI xử lý tự động", value: "89,3%", change: "+1,8%", positiveDown: false },
          { icon: TrendingDown, label: "Hội thoại leo thang", value: "8,8%", change: "-2,4%", positiveDown: true },
          { icon: Star, label: "Điểm hài lòng NPS", value: "72", change: "+5", positiveDown: false },
        ].map(({ icon: Icon, label, value, change }) => {
          const isNegative = change.startsWith("-");
          const isPositive = change.startsWith("+");
          const badgeBg = isPositive ? GREEN_SOFT : isNegative ? RED_SOFT : "#f1f5f9";
          const badgeColor = isPositive ? "#228A61" : isNegative ? RED_TEXT : "#64748b";
          return (
            <div
              key={label}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1px solid rgba(0,56,101,0.08)",
                boxShadow: "0 2px 8px rgba(0,56,101,0.05)",
                padding: "20px 22px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "stretch",
                transition: "box-shadow 0.2s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,62,154,0.11)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,56,101,0.05)";
              }}
            >
              {/* Left Column: Icon (top) and Label (bottom) */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "72px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#EBF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} style={{ color: "#003865" }} />
                </div>
                <div style={{ marginTop: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(0,56,101,0.5)", lineHeight: 1.3 }}>{label}</div>
                </div>
              </div>

              {/* Right Column: Badge (top) and Value (bottom) */}
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
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#003865", lineHeight: 1 }}>{value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <ChartCard title="Hiệu suất xử lý theo thời gian" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="area" supportedChartTypes={["area"]}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={performanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Area type="monotone" dataKey="resolve_rate" name="Tỷ lệ giải quyết (%)" stroke="#228A61" fill="#228A6120" strokeWidth={2} />
              <Area type="monotone" dataKey="ai_success" name="AI trả lời thành công (%)" stroke={CTA} fill={`${CTA}18`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Số lượng hội thoại theo giờ" onOpenBuilder={() => onNavigate("chartbuilder")} defaultChartType="bar" supportedChartTypes={["bar"]}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={processingVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Bar dataKey="volume" name="Hội thoại" fill={NAVY} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Agent Performance */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
          <h3 style={{ color: NAVY, fontSize: "15px", fontWeight: 700 }}>Hiệu suất xử lý theo nhân viên</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              {["Nhân viên", "Đã xử lý", "Đã giải quyết", "Tỷ lệ GQ", "T/g phản hồi TB", "Đánh giá"].map((h) => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600, color: "rgba(0,56,101,0.55)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentPerformance.map((agent, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,56,101,0.04)" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
              >
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: i === 0 ? `linear-gradient(135deg, ${NAVY}, #1565C0)` : `linear-gradient(135deg, #64748b, #94a3b8)`,
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700
                    }}>
                      {i === 0 ? "AI" : `A${i}`}
                    </div>
                    <span style={{ fontWeight: 600, color: NAVY }}>{agent.name}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", color: NAVY, fontWeight: 600 }}>{agent.handled.toLocaleString()}</td>
                <td style={{ padding: "14px 20px", color: "#228A61", fontWeight: 600 }}>{agent.resolved.toLocaleString()}</td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ flex: 1, height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(agent.resolved / agent.handled) * 100}%`, backgroundColor: "#228A61", borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>{Math.round((agent.resolved / agent.handled) * 100)}%</span>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", color: agent.avg_time > 10 ? AMBER_TEXT : "rgba(0,56,101,0.7)", fontWeight: agent.avg_time > 10 ? 600 : 400 }}>{agent.avg_time} phút</td>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", gap: "2px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} style={{ color: star <= Math.round(agent.rating) ? AMBER_TEXT : "#e2e8f0", fontSize: "14px" }}>★</span>
                    ))}
                    <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", marginLeft: "4px" }}>{agent.rating}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
