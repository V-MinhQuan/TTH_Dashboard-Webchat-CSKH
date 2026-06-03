import { useState } from "react";
import { TrendingUp, TrendingDown, Hash, Brain, AlertCircle, Plus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const CTA = "#ED5206";
const COLORS = [NAVY, ORANGE, "rgba(0,56,101,0.6)", "rgba(215,60,1,0.6)", "rgba(0,56,101,0.3)", "rgba(215,60,1,0.3)"];

const topicGroups = [
  {
    id: "toeic",
    name: "TOEIC",
    color: NAVY,
    totalQuestions: 2847,
    changeRate: 12,
    aiFailed: 215,
    faqNeeded: 8,
    keywords: [
      { word: "lệ phí", count: 847, trend: 12 },
      { word: "lịch thi", count: 634, trend: 34 },
      { word: "điểm thi", count: 541, trend: 8 },
      { word: "chứng chỉ", count: 412, trend: 3 },
      { word: "đăng ký thi", count: 389, trend: 22 },
    ],
  },
  {
    id: "vstep",
    name: "VSTEP",
    color: "#1565C0",
    totalQuestions: 1923,
    changeRate: 28,
    aiFailed: 142,
    faqNeeded: 6,
    keywords: [
      { word: "lịch thi", count: 634, trend: 28 },
      { word: "hồ sơ", count: 412, trend: 11 },
      { word: "cấp chứng chỉ", count: 378, trend: 19 },
      { word: "ôn tập", count: 301, trend: 7 },
      { word: "kết quả thi", count: 267, trend: -3 },
    ],
  },
  {
    id: "tinhoc",
    name: "Tin học / MOS / IC3",
    color: "#42A5F5",
    totalQuestions: 1456,
    changeRate: 6,
    aiFailed: 98,
    faqNeeded: 5,
    keywords: [
      { word: "CNTT Cơ bản", count: 412, trend: 6 },
      { word: "CNTT Nâng cao", count: 334, trend: 18 },
      { word: "MOS", count: 289, trend: 12 },
      { word: "IC3", count: 256, trend: 9 },
      { word: "quên mật khẩu khóa học", count: 167, trend: 31 },
    ],
  },
  {
    id: "chuandaura",
    name: "Chuẩn đầu ra / Chứng chỉ",
    color: "#0288D1",
    totalQuestions: 1834,
    changeRate: 17,
    aiFailed: 176,
    faqNeeded: 9,
    keywords: [
      { word: "điều kiện chuẩn đầu ra", count: 523, trend: 17 },
      { word: "chứng chỉ hợp lệ", count: 445, trend: -12 },
      { word: "thời hạn chứng chỉ", count: 389, trend: 9 },
      { word: "quy đổi điểm", count: 312, trend: 6 },
    ],
  },
];

const barData = topicGroups.map((g) => ({ name: g.name.split(" / ")[0], "Hội thoại": g.totalQuestions, "AI thất bại": g.aiFailed }));

const trendData = [
  { date: "T1", TOEIC: 2200, VSTEP: 1400, "Tin học": 1100, "Chuẩn đầu ra": 1400 },
  { date: "T2", TOEIC: 2450, VSTEP: 1550, "Tin học": 1200, "Chuẩn đầu ra": 1560 },
  { date: "T3", TOEIC: 2600, VSTEP: 1700, "Tin học": 1350, "Chuẩn đầu ra": 1680 },
  { date: "T4", TOEIC: 2750, VSTEP: 1820, "Tin học": 1390, "Chuẩn đầu ra": 1760 },
  { date: "T5", TOEIC: 2847, VSTEP: 1923, "Tin học": 1456, "Chuẩn đầu ra": 1834 },
];

const donutData = topicGroups.map((g) => ({ name: g.name.split(" / ")[0], value: g.totalQuestions }));

const heatmapData = [
  { topic: "TOEIC", lệ_phí: 2, lịch_thi: 3, đăng_ký: 1, kết_quả: 4, chứng_chỉ: 2 },
  { topic: "VSTEP", lệ_phí: 1, lịch_thi: 4, đăng_ký: 3, kết_quả: 3, chứng_chỉ: 4 },
  { topic: "Tin học", lệ_phí: 1, lịch_thi: 2, đăng_ký: 2, kết_quả: 1, chứng_chỉ: 3 },
  { topic: "Chuẩn đầu ra", lệ_phí: 3, lịch_thi: 1, đăng_ký: 4, kết_quả: 2, chứng_chỉ: 5 },
];

const heatmapCols = ["lệ_phí", "lịch_thi", "đăng_ký", "kết_quả", "chứng_chỉ"];
const heatmapLabels: Record<string, string> = { lệ_phí: "Lệ phí", lịch_thi: "Lịch thi", đăng_ký: "Đăng ký", kết_quả: "Kết quả", chứng_chỉ: "Chứng chỉ" };

function heatColor(val: number) {
  if (val >= 5) return "#003865";
  if (val >= 4) return "#1565C0";
  if (val >= 3) return "#42A5F5";
  if (val >= 2) return "#B9DCFF";
  return "#EBF2FF";
}

function heatTextColor(val: number) {
  return val >= 3 ? "#fff" : "#003865";
}

interface Props {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function KeywordAnalysis({ filters, onFiltersChange, onNavigate }: Props) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {/* Page title */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>Phân tích Keywords</h1>
        <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)" }}>Phân tích theo 4 nhóm chủ đề chính</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
        {topicGroups.map((g) => (
          <div
            key={g.id}
            onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
            style={{
              backgroundColor: "#fff",
              borderRadius: "14px",
              padding: "16px 18px",
              border: `1.5px solid ${activeGroup === g.id ? g.color : "rgba(0,56,101,0.08)"}`,
              boxShadow: activeGroup === g.id ? `0 4px 16px ${g.color}20` : "0 2px 8px rgba(0,56,101,0.05)",
              cursor: "pointer",
              transition: "all 0.2s",
              borderLeft: `4px solid ${g.color}`,
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: NAVY, marginBottom: "10px" }}>{g.name}</div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: g.color, marginBottom: "6px" }}>{g.totalQuestions.toLocaleString("vi-VN")}</div>
            <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.5)", marginBottom: "8px" }}>tổng câu hỏi</div>
            <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
              <span style={{ color: g.changeRate > 0 ? "#228A61" : ORANGE, display: "flex", alignItems: "center", gap: "3px" }}>
                {g.changeRate > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(g.changeRate)}%
              </span>
              <span style={{ color: ORANGE, display: "flex", alignItems: "center", gap: "3px" }}>
                <AlertCircle size={11} /> {g.aiFailed} AI thất bại
              </span>
              <span style={{ color: CTA, display: "flex", alignItems: "center", gap: "3px" }}>
                <Plus size={11} /> {g.faqNeeded} FAQ
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row 1: Bar + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Bar chart */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: NAVY, marginBottom: "16px" }}>Số câu hỏi theo nhóm chủ đề</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
              <Tooltip />
              <Legend iconSize={10} />
              <Bar dataKey="Hội thoại" fill={NAVY} radius={[4, 4, 0, 0]} />
              <Bar dataKey="AI thất bại" fill={ORANGE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: NAVY, marginBottom: "16px" }}>Tỷ lệ nhóm chủ đề</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name">
                {donutData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v.toLocaleString("vi-VN")} />
              <Legend iconSize={10} formatter={(v) => <span style={{ fontSize: "11px", color: NAVY }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Line trend */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", marginBottom: "20px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: NAVY, marginBottom: "16px" }}>Xu hướng câu hỏi theo thời gian</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
            <Tooltip />
            <Legend iconSize={10} />
            <Line type="monotone" dataKey="TOEIC" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="VSTEP" stroke="#1565C0" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Tin học" stroke={CTA} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Chuẩn đầu ra" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap: AI error level */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 8px rgba(0,56,101,0.05)", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Brain size={16} style={{ color: ORANGE }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: NAVY }}>Mức độ lỗi AI theo nhóm chủ đề</span>
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "rgba(0,56,101,0.4)" }}>1 = thấp · 5 = cao</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th style={{ width: "140px", padding: "8px", fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", textAlign: "left" }}>Nhóm chủ đề</th>
                {heatmapCols.map((col) => (
                  <th key={col} style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "rgba(0,56,101,0.5)", textAlign: "center" }}>{heatmapLabels[col]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.topic}>
                  <td style={{ padding: "6px 8px", fontSize: "12px", fontWeight: 600, color: NAVY }}>{row.topic}</td>
                  {heatmapCols.map((col) => {
                    const val = (row as any)[col];
                    return (
                      <td key={col} style={{ padding: "6px 12px", textAlign: "center", borderRadius: "8px", backgroundColor: heatColor(val), fontSize: "13px", fontWeight: 700, color: heatTextColor(val) }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "12px", fontSize: "11px", color: "rgba(0,56,101,0.5)", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>Mức độ:</span>
          {[
            { label: "Thấp", val: 1 },
            { label: "Trung bình", val: 3 },
            { label: "Cao", val: 5 },
          ].map(({ label, val }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "16px", height: "16px", borderRadius: "4px", backgroundColor: heatColor(val), display: "inline-block", border: "1px solid rgba(0,56,101,0.1)" }} />
              {label}
            </span>
          ))}
          <span style={{ marginLeft: "8px", display: "flex", alignItems: "center", gap: "3px" }}>
            {["#EBF2FF", "#B9DCFF", "#42A5F5", "#1565C0", "#003865"].map((c) => (
              <span key={c} style={{ width: "20px", height: "12px", backgroundColor: c, display: "inline-block", borderRadius: "2px" }} />
            ))}
          </span>
        </div>
      </div>

      {/* Keyword detail cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
        {topicGroups.map((group) => (
          <div
            key={group.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              border: "1px solid rgba(0,56,101,0.08)",
              boxShadow: "0 2px 8px rgba(0,56,101,0.05)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(0,56,101,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "8px", height: "24px", borderRadius: "4px", backgroundColor: group.color }} />
              <span style={{ fontWeight: 700, fontSize: "14px", color: NAVY }}>{group.name}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "10px", fontSize: "11px" }}>
                <span style={{ color: "rgba(0,56,101,0.45)" }}>Từ khóa hàng đầu</span>
                <button onClick={() => toast.success(`Đã thêm ${group.faqNeeded} FAQ vào danh sách`)} style={{ padding: "2px 8px", borderRadius: "6px", border: `1px solid ${CTA}`, background: "#fff", color: CTA, cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>+{group.faqNeeded} FAQ cần thêm</button>
              </div>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {group.keywords.map((kw, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "18px", fontSize: "11px", color: "rgba(0,56,101,0.35)", fontWeight: 700, flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "12px", color: NAVY, fontWeight: 500 }}>{kw.word}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {kw.trend > 0 ? <TrendingUp size={11} style={{ color: "#228A61" }} /> : <TrendingDown size={11} style={{ color: ORANGE }} />}
                          <span style={{ fontSize: "11px", fontWeight: 600, color: kw.trend > 0 ? "#228A61" : ORANGE }}>{Math.abs(kw.trend)}%</span>
                          <span style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", marginLeft: "5px" }}>{kw.count.toLocaleString("vi-VN")}</span>
                        </div>
                      </div>
                      <div style={{ height: "5px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(kw.count / group.keywords[0].count) * 100}%`, backgroundColor: group.color, borderRadius: "3px", opacity: 0.75 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
